import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';

const logger = createLogger();

export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private codePrefix: string;

  constructor() {
    this.bucketName = process.env.S3_BUCKET_NAME!;
    this.codePrefix = process.env.S3_CODE_PREFIX || 'code-artifacts/';
    
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  /**
   * Upload code content to S3
   */
  async uploadCode(
    code: string, 
    language: string, 
    filename?: string
  ): Promise<{ s3Key: string; s3Url: string; fileSize: number }> {
    try {
      const fileExtension = this.getFileExtension(language);
      const s3Key = `${this.codePrefix}${filename || uuidv4()}${fileExtension}`;
      
      const buffer = Buffer.from(code, 'utf-8');
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: buffer,
        ContentType: this.getContentType(language),
        ContentEncoding: 'utf-8',
        Metadata: {
          language: language,
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(command);
      
      // Generate presigned URL for access (valid for 1 hour)
      const s3Url = await this.getPresignedUrl(s3Key, 3600);
      
      logger.info(`Code uploaded to S3: ${s3Key}`);
      
      return {
        s3Key,
        s3Url,
        fileSize: buffer.length,
      };
    } catch (error) {
      logger.error('Error uploading code to S3:', error);
      throw new Error('Failed to upload code to S3');
    }
  }

  /**
   * Get code content from S3
   */
  async getCode(s3Key: string): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new Error('No content found in S3 object');
      }

      const content = await response.Body.transformToString('utf-8');
      return content;
    } catch (error) {
      logger.error(`Error getting code from S3 (${s3Key}):`, error);
      throw new Error('Failed to retrieve code from S3');
    }
  }

  /**
   * Generate presigned URL for accessing S3 object
   */
  async getPresignedUrl(s3Key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      logger.error(`Error generating presigned URL for ${s3Key}:`, error);
      throw new Error('Failed to generate presigned URL');
    }
  }

  /**
   * Delete code from S3
   */
  async deleteCode(s3Key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      await this.s3Client.send(command);
      logger.info(`Code deleted from S3: ${s3Key}`);
    } catch (error) {
      logger.error(`Error deleting code from S3 (${s3Key}):`, error);
      throw new Error('Failed to delete code from S3');
    }
  }

  /**
   * Upload multiple files as a project structure
   */
  async uploadProject(
    files: { fileName: string; content: string; language: string }[],
    projectName: string
  ): Promise<{ projectS3Key: string; projectS3Url: string; files: Array<{ fileName: string; s3Key: string; s3Url: string; fileSize: number }> }> {
    try {
      const projectId = uuidv4();
      const projectS3Key = `${this.codePrefix}projects/${projectId}/${projectName}`;
      
      // Upload project manifest
      const manifest = {
        projectName,
        files: files.map(f => ({
          fileName: f.fileName,
          language: f.language,
          size: Buffer.from(f.content, 'utf-8').length,
        })),
        createdAt: new Date().toISOString(),
      };
      
      const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8');
      
      const manifestCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `${projectS3Key}/project.json`,
        Body: manifestBuffer,
        ContentType: 'application/json',
        Metadata: {
          projectId,
          projectName,
          fileCount: files.length.toString(),
        },
      });

      await this.s3Client.send(manifestCommand);
      
      // Upload individual files
      const uploadedFiles = [];
      
      for (const file of files) {
        const fileS3Key = `${projectS3Key}/${file.fileName}`;
        const buffer = Buffer.from(file.content, 'utf-8');
        
        const command = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: fileS3Key,
          Body: buffer,
          ContentType: this.getContentType(file.language),
          ContentEncoding: 'utf-8',
          Metadata: {
            projectId,
            fileName: file.fileName,
            language: file.language,
          },
        });

        await this.s3Client.send(command);
        
        const fileS3Url = await this.getPresignedUrl(fileS3Key, 3600);
        
        uploadedFiles.push({
          fileName: file.fileName,
          s3Key: fileS3Key,
          s3Url: fileS3Url,
          fileSize: buffer.length,
        });
      }
      
      const projectS3Url = await this.getPresignedUrl(`${projectS3Key}/project.json`, 3600);
      
      logger.info(`Project uploaded to S3: ${projectS3Key}`, { fileCount: files.length });
      
      return {
        projectS3Key,
        projectS3Url,
        files: uploadedFiles,
      };
    } catch (error) {
      logger.error('Error uploading project to S3:', error);
      throw new Error('Failed to upload project to S3');
    }
  }

  /**
   * Get project structure from S3
   */
  async getProject(projectS3Key: string): Promise<{ manifest: any; files: Array<{ fileName: string; content: string }> }> {
    try {
      // Get manifest
      const manifestCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: `${projectS3Key}/project.json`,
      });

      const manifestResponse = await this.s3Client.send(manifestCommand);
      const manifest = JSON.parse(await manifestResponse.Body!.transformToString('utf-8'));
      
      // Get all files
      const files = [];
      
      for (const fileInfo of manifest.files) {
        const fileCommand = new GetObjectCommand({
          Bucket: this.bucketName,
          Key: `${projectS3Key}/${fileInfo.fileName}`,
        });

        const fileResponse = await this.s3Client.send(fileCommand);
        const content = await fileResponse.Body!.transformToString('utf-8');
        
        files.push({
          fileName: fileInfo.fileName,
          content,
        });
      }
      
      return { manifest, files };
    } catch (error) {
      logger.error(`Error getting project from S3 (${projectS3Key}):`, error);
      throw new Error('Failed to retrieve project from S3');
    }
  }

  /**
   * Upload built/compiled code (e.g., for React components)
   */
  async uploadBuiltCode(
    builtCode: string,
    originalS3Key: string,
    buildType: 'bundle' | 'transpiled' = 'bundle'
  ): Promise<{ s3Key: string; s3Url: string }> {
    try {
      const buildS3Key = originalS3Key.replace(
        this.codePrefix,
        `${this.codePrefix}built/${buildType}/`
      );
      
      const buffer = Buffer.from(builtCode, 'utf-8');
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: buildS3Key,
        Body: buffer,
        ContentType: 'application/javascript',
        ContentEncoding: 'utf-8',
        Metadata: {
          buildType: buildType,
          originalKey: originalS3Key,
          builtAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(command);
      
      const s3Url = await this.getPresignedUrl(buildS3Key, 3600);
      
      logger.info(`Built code uploaded to S3: ${buildS3Key}`);
      
      return {
        s3Key: buildS3Key,
        s3Url,
      };
    } catch (error) {
      logger.error('Error uploading built code to S3:', error);
      throw new Error('Failed to upload built code to S3');
    }
  }

  /**
   * Get file extension based on language
   */
  private getFileExtension(language: string): string {
    const extensions: Record<string, string> = {
      javascript: '.js',
      typescript: '.ts',
      react: '.tsx',
      python: '.py',
      html: '.html',
      css: '.css',
      json: '.json',
      yaml: '.yml',
      markdown: '.md',
      sql: '.sql',
      bash: '.sh',
      java: '.java',
      cpp: '.cpp',
      csharp: '.cs',
      go: '.go',
      rust: '.rs',
      php: '.php',
      ruby: '.rb',
      swift: '.swift',
      kotlin: '.kt',
    };

    return extensions[language.toLowerCase()] || '.txt';
  }

  /**
   * Get content type based on language
   */
  private getContentType(language: string): string {
    const contentTypes: Record<string, string> = {
      javascript: 'application/javascript',
      typescript: 'application/typescript',
      react: 'application/typescript',
      python: 'text/x-python',
      html: 'text/html',
      css: 'text/css',
      json: 'application/json',
      yaml: 'application/x-yaml',
      markdown: 'text/markdown',
      sql: 'application/sql',
      bash: 'application/x-sh',
      java: 'text/x-java-source',
      cpp: 'text/x-c++src',
      csharp: 'text/x-csharp',
      go: 'text/x-go',
      rust: 'text/x-rustsrc',
      php: 'application/x-httpd-php',
      ruby: 'application/x-ruby',
      swift: 'text/x-swift',
      kotlin: 'text/x-kotlin',
    };

    if (!language) {
      return 'text/plain';
    }
    return contentTypes[language.toLowerCase()] || 'text/plain';
  }

  /**
   * Update S3 URL with new presigned URL (refresh expired URLs)
   */
  async refreshPresignedUrl(s3Key: string, expiresIn: number = 3600): Promise<string> {
    return this.getPresignedUrl(s3Key, expiresIn);
  }
}

export const s3Service = new S3Service();