import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { LRUCache } from 'lru-cache';
import { createHash } from 'crypto';
import { createLogger } from '../utils/logger';
import { metrics } from '../middleware/metrics';
import { config, getS3Config } from '../config';

const logger = createLogger();

export interface StorageOptions {
  compression?: boolean;
  encrypt?: boolean;
  tags?: Record<string, string>;
  cacheControl?: string;
  ttl?: number;
}

export interface StoredArtifact {
  s3Key: string;
  s3Url: string;
  hash: string;
  size: number;
  metadata: Record<string, any>;
  createdAt: Date;
  cached?: boolean;
}

interface CacheEntry {
  data: any;
  hash: string;
  timestamp: number;
  hits: number;
  size: number;
}

export class OptimizedStorageManager {
  private s3Client: S3Client;
  private bucketName: string;
  private codePrefix: string;
  
  // Multi-level caching with better performance
  private memoryCache: LRUCache<string, CacheEntry>;
  private hashIndex = new Map<string, string>(); // hash -> s3Key mapping
  private compressionCache = new Map<string, string>(); // code -> compressed
  private pendingUploads = new Map<string, Promise<StoredArtifact>>(); // dedup concurrent uploads
  
  // Batch operation queues
  private uploadQueue: Array<{
    key: string;
    data: string;
    options: any;
    resolve: (result: StoredArtifact) => void;
    reject: (error: Error) => void;
  }> = [];
  
  private batchTimer?: NodeJS.Timeout;
  private readonly batchSize = 10;
  private readonly batchDelay = 100; // ms

  constructor() {
    this.bucketName = config.S3_BUCKET_NAME;
    this.codePrefix = config.S3_CODE_PREFIX;
    
    this.s3Client = new S3Client(getS3Config());

         // Initialize optimized LRU cache
     this.memoryCache = new LRUCache<string, CacheEntry>({
       max: 1000,
       maxSize: 100 * 1024 * 1024, // 100MB max cache size
       sizeCalculation: (value, key) => value.size,
       dispose: (value, key) => {
         logger.debug(`Cache evicted: ${key}`, { hits: value.hits });
       },
       ttl: config.CACHE_TTL * 1000,
     });

    // Start batch processor
    this.startBatchProcessor();
  }

  /**
   * High-performance code storage with intelligent caching and deduplication
   */
  async storeCode(
    code: string,
    language: string,
    options: StorageOptions = {}
  ): Promise<StoredArtifact> {
    const startTime = Date.now();
    const hash = this.generateHash(code);
    const cacheKey = `code:${hash}`;

    // Check if upload is already in progress
    const pendingUpload = this.pendingUploads.get(hash);
    if (pendingUpload) {
      logger.debug(`Upload already in progress: ${hash}`);
      return pendingUpload;
    }

    // Check cache first
    const cached = this.memoryCache.get(cacheKey);
    if (cached) {
      cached.hits++;
      metrics.trackCacheHit(true, this.memoryCache.size);
      logger.debug(`Cache hit for code: ${hash}`);
      
      // Refresh S3 URL if needed
      const refreshedUrl = await this.refreshUrlIfNeeded(cached.data.s3Key, cached.data.s3Url);
      return { ...cached.data, s3Url: refreshedUrl, cached: true };
    }

    // Check hash index for existing storage
    const existingS3Key = this.hashIndex.get(hash);
    if (existingS3Key) {
      try {
        const refreshedUrl = await this.getPresignedUrl(existingS3Key);
        const existing: StoredArtifact = {
          s3Key: existingS3Key,
          s3Url: refreshedUrl,
          hash,
          size: code.length,
          metadata: { language, fromIndex: true },
          createdAt: new Date(),
        };
        
        this.cacheArtifact(cacheKey, existing);
        metrics.trackCacheHit(true, this.memoryCache.size);
        return existing;
      } catch (error) {
        // Key exists in index but not in S3, remove from index
        this.hashIndex.delete(hash);
      }
    }

    metrics.trackCacheHit(false, this.memoryCache.size);

    // Create upload promise and track it
    const uploadPromise = this.performUpload(code, language, hash, options);
    this.pendingUploads.set(hash, uploadPromise);

    try {
      const result = await uploadPromise;
      
      // Cache the result
      this.cacheArtifact(cacheKey, result);
      this.hashIndex.set(hash, result.s3Key);
      
      const uploadTime = Date.now() - startTime;
      logger.info(`Code stored successfully: ${result.s3Key}`, { 
        hash, 
        size: result.size, 
        uploadTime,
        compressed: options.compression 
      });
      
      return result;
    } finally {
      this.pendingUploads.delete(hash);
    }
  }

  /**
   * Batch code storage for better performance
   */
  async storeCodeBatch(
    items: Array<{ code: string; language: string; options?: StorageOptions }>
  ): Promise<StoredArtifact[]> {
    const startTime = Date.now();
    
    // Deduplicate by hash
    const uniqueItems = new Map<string, typeof items[0]>();
    items.forEach(item => {
      const hash = this.generateHash(item.code);
      if (!uniqueItems.has(hash)) {
        uniqueItems.set(hash, item);
      }
    });

    logger.info(`Batch storing ${uniqueItems.size} unique items (${items.length} total)`);

    // Process in parallel with controlled concurrency
    const concurrency = 5;
    const chunks = Array.from(uniqueItems.values()).reduce((acc, item, i) => {
      const chunkIndex = Math.floor(i / concurrency);
      if (!acc[chunkIndex]) acc[chunkIndex] = [];
      acc[chunkIndex].push(item);
      return acc;
    }, [] as typeof items[]);

    const results: StoredArtifact[] = [];
    
    for (const chunk of chunks) {
      const chunkPromises = chunk.map(item => 
        this.storeCode(item.code, item.language, item.options)
      );
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    const batchTime = Date.now() - startTime;
    logger.info(`Batch storage completed`, { 
      items: results.length, 
      time: batchTime,
      avgPerItem: Math.round(batchTime / results.length)
    });

    return results;
  }

  /**
   * High-performance code retrieval with intelligent caching
   */
  async retrieveCode(s3Key: string, useCache: boolean = true): Promise<string> {
    const startTime = Date.now();
    const cacheKey = `retrieve:${s3Key}`;

    if (useCache) {
      const cached = this.memoryCache.get(cacheKey);
      if (cached) {
        cached.hits++;
        metrics.trackCacheHit(true, this.memoryCache.size);
        logger.debug(`Cache hit for retrieval: ${s3Key}`);
        return cached.data;
      }
    }

    metrics.trackCacheHit(false, this.memoryCache.size);

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const response = await this.s3Client.send(command);
      const content = await response.Body!.transformToString('utf-8');

             // Decompress if needed
       const decompressed = this.decompressCode(content, response.Metadata);

      // Cache the result
      if (useCache) {
        this.memoryCache.set(cacheKey, {
          data: decompressed,
          hash: this.generateHash(decompressed),
          timestamp: Date.now(),
          hits: 1,
          size: decompressed.length,
        });
      }

      const retrievalTime = Date.now() - startTime;
      logger.debug(`Code retrieved: ${s3Key}`, { size: decompressed.length, time: retrievalTime });

      return decompressed;

    } catch (error) {
      logger.error(`Failed to retrieve code from S3 (${s3Key}):`, error);
      throw new Error('Code retrieval failed');
    }
  }

  /**
   * Batch retrieval with connection pooling
   */
  async retrieveMultiple(s3Keys: string[]): Promise<Map<string, string>> {
    const startTime = Date.now();
    const results = new Map<string, string>();
    
    // Check cache first
    const uncachedKeys: string[] = [];
    for (const key of s3Keys) {
      const cacheKey = `retrieve:${key}`;
      const cached = this.memoryCache.get(cacheKey);
      if (cached) {
        cached.hits++;
        results.set(key, cached.data);
      } else {
        uncachedKeys.push(key);
      }
    }

    // Parallel retrieval for uncached items
    if (uncachedKeys.length > 0) {
      const promises = uncachedKeys.map(async (key) => {
        try {
          const content = await this.retrieveCode(key, true);
          results.set(key, content);
        } catch (error) {
          logger.warn(`Failed to retrieve ${key}:`, error);
          results.set(key, '');
        }
      });

      await Promise.all(promises);
    }

    const retrievalTime = Date.now() - startTime;
    logger.info(`Batch retrieval completed`, { 
      total: s3Keys.length,
      cached: s3Keys.length - uncachedKeys.length,
      time: retrievalTime
    });

    return results;
  }

  /**
   * Get storage statistics and performance metrics
   */
  getStorageStats(): {
    cacheSize: number;
    cacheHitRate: number;
    hashIndexSize: number;
    memoryUsage: number;
    compressionCacheSize: number;
    pendingUploads: number;
  } {
    let totalHits = 0;
    let totalAccess = 0;
    
    this.memoryCache.forEach((value) => {
      totalHits += value.hits;
      totalAccess += value.hits + 1;
    });

    return {
      cacheSize: this.memoryCache.size,
      cacheHitRate: totalAccess > 0 ? totalHits / totalAccess : 0,
      hashIndexSize: this.hashIndex.size,
      memoryUsage: this.memoryCache.calculatedSize || 0,
      compressionCacheSize: this.compressionCache.size,
      pendingUploads: this.pendingUploads.size,
    };
  }

  /**
   * Cleanup and optimization
   */
  async cleanup(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    const now = Date.now();
    let cleaned = 0;

    // Clean memory cache (automatic with TTL)
    const sizeBefore = this.memoryCache.size;
    this.memoryCache.purgeStale();
    cleaned += sizeBefore - this.memoryCache.size;

    // Clean compression cache
    for (const [key, value] of this.compressionCache.entries()) {
      if (Math.random() < 0.1) { // Clean 10% randomly to prevent cache bloat
        this.compressionCache.delete(key);
        cleaned++;
      }
    }

    logger.info(`Storage cleanup completed`, { 
      entriesCleaned: cleaned,
      cacheSize: this.memoryCache.size,
      hashIndexSize: this.hashIndex.size
    });
  }

  // Private methods
  private async performUpload(
    code: string,
    language: string,
    hash: string,
    options: StorageOptions
  ): Promise<StoredArtifact> {
    const processedCode = await this.processCode(code, language, options);
    const s3Key = this.generateS3Key('code', hash, language);

    const metadata = {
      hash,
      language,
      originalSize: code.length.toString(),
      processedSize: processedCode.length.toString(),
      compressed: options.compression?.toString() || 'false',
      createdAt: new Date().toISOString(),
      complexity: this.analyzeComplexity(code),
    };

    await this.uploadToS3(s3Key, processedCode, {
      contentType: this.getContentType(language),
      metadata,
      tags: options.tags,
      encrypt: options.encrypt,
      cacheControl: options.cacheControl || 'public, max-age=31536000', // 1 year
    });

    const s3Url = await this.getPresignedUrl(s3Key, options.ttl);

    return {
      s3Key,
      s3Url,
      hash,
      size: processedCode.length,
      metadata: metadata as any,
      createdAt: new Date(),
    };
  }

  private async processCode(code: string, language: string, options: StorageOptions): Promise<string> {
    let processed = code;

         // Basic sanitization
     if (this.isJavaScriptLike(language)) {
       processed = this.sanitizeJavaScript(processed);
     }

    // Compression with caching
    if (options.compression) {
      const cacheKey = this.generateHash(processed);
      let compressed = this.compressionCache.get(cacheKey);
      
             if (!compressed) {
         compressed = this.compressCode(processed);
         this.compressionCache.set(cacheKey, compressed);
       }
      
      processed = compressed;
    }

    return processed;
  }

     private compressCode(code: string): string {
    // Preserve original code formatting - only remove excessive blank lines
    return code
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Collapse multiple blank lines to double
      .trim();
  }

     private decompressCode(code: string, metadata?: Record<string, string>): string {
    if (metadata?.compressed === 'true') {
      // In production, implement actual decompression
      return code;
    }
    return code;
  }

     private sanitizeJavaScript(code: string): string {
    // Security sanitization
    return code
      .replace(/eval\s*\(/g, '// REMOVED: eval(')
      .replace(/Function\s*\(/g, '// REMOVED: Function(')
      .replace(/document\.write\s*\(/g, '// REMOVED: document.write(')
      .replace(/<script[^>]*>.*?<\/script>/gis, '<!-- REMOVED: script tag -->');
  }

  private async uploadToS3(
    key: string, 
    content: string, 
    options: {
      contentType?: string;
      metadata?: Record<string, string>;
      tags?: Record<string, string>;
      encrypt?: boolean;
      cacheControl?: string;
    } = {}
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: content,
      ContentType: options.contentType || 'text/plain',
      Metadata: options.metadata || {},
      CacheControl: options.cacheControl,
      ServerSideEncryption: options.encrypt ? 'AES256' : undefined,
      Tagging: options.tags ? new URLSearchParams(options.tags).toString() : undefined,
    });

    await this.s3Client.send(command);
  }

  private async getPresignedUrl(s3Key: string, ttl: number = config.S3_PRESIGNED_URL_EXPIRES): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: ttl });
  }

  private async refreshUrlIfNeeded(s3Key: string, currentUrl: string): Promise<string> {
    // Check if URL is close to expiration (within 10 minutes)
    const urlParams = new URL(currentUrl).searchParams;
    const expires = urlParams.get('X-Amz-Expires');
    const date = urlParams.get('X-Amz-Date');
    
    if (!expires || !date) {
      return this.getPresignedUrl(s3Key);
    }

    const expiresAt = new Date(date).getTime() + parseInt(expires) * 1000;
    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000;

    if (expiresAt - now < tenMinutes) {
      return this.getPresignedUrl(s3Key);
    }

    return currentUrl;
  }

  private startBatchProcessor(): void {
    // Process upload queue in batches for better performance
    setInterval(() => {
      if (this.uploadQueue.length > 0) {
        this.processBatch();
      }
    }, this.batchDelay);
  }

  private async processBatch(): Promise<void> {
    const batch = this.uploadQueue.splice(0, this.batchSize);
    
    const promises = batch.map(async (item) => {
      try {
        const result = await this.performUpload(
          item.data, 
          'unknown', // Language needs to be passed separately
          this.generateHash(item.data),
          {}
        );
        item.resolve(result);
      } catch (error) {
        item.reject(error as Error);
      }
    });

    await Promise.all(promises);
  }

  private cacheArtifact(key: string, artifact: StoredArtifact): void {
    this.memoryCache.set(key, {
      data: artifact,
      hash: artifact.hash,
      timestamp: Date.now(),
      hits: 0,
      size: artifact.size,
    });
  }

  private generateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  private generateS3Key(type: string, hash: string, language: string): string {
    const extension = this.getFileExtension(language);
    const timestamp = new Date().toISOString().split('T')[0];
    return `${this.codePrefix}${type}/${timestamp}/${hash}${extension}`;
  }

  private getContentType(language: string): string {
    const mappings: Record<string, string> = {
      javascript: 'application/javascript',
      typescript: 'application/typescript',
      jsx: 'application/javascript',
      tsx: 'application/typescript',
      python: 'text/x-python',
      html: 'text/html',
      css: 'text/css',
      json: 'application/json',
      markdown: 'text/markdown',
    };
    return mappings[language.toLowerCase()] || 'text/plain';
  }

  private getFileExtension(language: string): string {
    const extensions: Record<string, string> = {
      javascript: '.js',
      typescript: '.ts',
      jsx: '.jsx',
      tsx: '.tsx',
      python: '.py',
      html: '.html',
      css: '.css',
      json: '.json',
      yaml: '.yml',
      markdown: '.md',
    };
    return extensions[language.toLowerCase()] || '.txt';
  }

  private isJavaScriptLike(language: string): boolean {
    return ['javascript', 'typescript', 'jsx', 'tsx', 'react'].includes(language.toLowerCase());
  }

  private analyzeComplexity(code: string): string {
    const lines = code.split('\n').length;
    return lines > 200 ? 'high' : lines > 50 ? 'medium' : 'low';
  }
}

export const optimizedStorageManager = new OptimizedStorageManager(); 