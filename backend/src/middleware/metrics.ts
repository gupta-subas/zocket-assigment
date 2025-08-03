import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import { config } from '../config';

const logger = createLogger();

interface Metrics {
  // Request metrics
  totalRequests: number;
  requestsByEndpoint: Map<string, number>;
  requestsByStatus: Map<number, number>;
  averageResponseTime: number;
  responseTimeHistory: number[];
  
  // Error metrics
  errorRate: number;
  errorsByType: Map<string, number>;
  
  // Performance metrics
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  
  // Cache metrics
  cacheHitRate: number;
  cacheSize: number;
  
  // Build metrics
  buildSuccessRate: number;
  averageBuildTime: number;
  
  // AI metrics
  aiRequestCount: number;
  averageAiResponseTime: number;
  aiErrorRate: number;
  
  // Database metrics
  dbQueryCount: number;
  averageDbResponseTime: number;
  dbErrorCount: number;
}

class MetricsCollector {
  private metrics: Metrics = {
    totalRequests: 0,
    requestsByEndpoint: new Map(),
    requestsByStatus: new Map(),
    averageResponseTime: 0,
    responseTimeHistory: [],
    errorRate: 0,
    errorsByType: new Map(),
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    cacheHitRate: 0,
    cacheSize: 0,
    buildSuccessRate: 0,
    averageBuildTime: 0,
    aiRequestCount: 0,
    averageAiResponseTime: 0,
    aiErrorRate: 0,
    dbQueryCount: 0,
    averageDbResponseTime: 0,
    dbErrorCount: 0,
  };

  private readonly maxHistorySize = 1000;

  constructor() {
    if (config.ENABLE_METRICS) {
      this.startSystemMetricsCollection();
    }
  }

  // Request tracking middleware
  trackRequest() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const endpoint = `${req.method} ${req.route?.path || req.path}`;

      // Track request start
      this.metrics.totalRequests++;
      this.incrementMapValue(this.metrics.requestsByEndpoint, endpoint);

      // Track response
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        
        // Update response time metrics
        this.updateResponseTime(responseTime);
        
        // Track status codes
        this.incrementMapValue(this.metrics.requestsByStatus, res.statusCode);
        
        // Track errors
        if (res.statusCode >= 400) {
          this.trackError('http_error', `${res.statusCode}`);
        }

        // Log slow requests
        if (responseTime > 5000) {
          logger.warn('Slow request detected', {
            endpoint,
            responseTime,
            statusCode: res.statusCode,
          });
        }
      });

      next();
    };
  }

  // Track various metrics
  trackCacheHit(hit: boolean, size: number) {
    this.metrics.cacheSize = size;
    // Simple moving average for cache hit rate
    this.metrics.cacheHitRate = this.metrics.cacheHitRate * 0.95 + (hit ? 1 : 0) * 0.05;
  }

  trackBuild(success: boolean, buildTime: number) {
    this.metrics.buildSuccessRate = this.metrics.buildSuccessRate * 0.95 + (success ? 1 : 0) * 0.05;
    this.metrics.averageBuildTime = this.metrics.averageBuildTime * 0.9 + buildTime * 0.1;
  }

  trackAiRequest(responseTime: number, error: boolean = false) {
    this.metrics.aiRequestCount++;
    this.metrics.averageAiResponseTime = 
      this.metrics.averageAiResponseTime * 0.9 + responseTime * 0.1;
    
    if (error) {
      this.metrics.aiErrorRate = this.metrics.aiErrorRate * 0.95 + 0.05;
    } else {
      this.metrics.aiErrorRate = this.metrics.aiErrorRate * 0.95;
    }
  }

  trackDbQuery(responseTime: number, error: boolean = false) {
    this.metrics.dbQueryCount++;
    this.metrics.averageDbResponseTime = 
      this.metrics.averageDbResponseTime * 0.9 + responseTime * 0.1;
    
    if (error) {
      this.metrics.dbErrorCount++;
    }
  }

  trackError(type: string, details?: string) {
    const errorKey = details ? `${type}:${details}` : type;
    this.incrementMapValue(this.metrics.errorsByType, errorKey);
    
    // Update error rate
    const totalRequests = this.metrics.totalRequests || 1;
    const totalErrors = Array.from(this.metrics.errorsByType.values())
      .reduce((sum, count) => sum + count, 0);
    this.metrics.errorRate = totalErrors / totalRequests;
  }

  // Get current metrics
  getMetrics(): Metrics & { timestamp: number; uptime: number } {
    return {
      ...this.metrics,
      timestamp: Date.now(),
      uptime: process.uptime(),
    };
  }

  // Get health status
  getHealth(): { status: 'healthy' | 'degraded' | 'unhealthy'; issues: string[] } {
    const issues: string[] = [];
    
    // Check error rate
    if (this.metrics.errorRate > 0.1) {
      issues.push('High error rate detected');
    }
    
    // Check response time
    if (this.metrics.averageResponseTime > 2000) {
      issues.push('High response times detected');
    }
    
    // Check memory usage
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed / memUsage.heapTotal > 0.9) {
      issues.push('High memory usage detected');
    }
    
    // Check AI error rate
    if (this.metrics.aiErrorRate > 0.05) {
      issues.push('High AI service error rate');
    }

    return {
      status: issues.length === 0 ? 'healthy' : issues.length <= 2 ? 'degraded' : 'unhealthy',
      issues,
    };
  }

  // Reset metrics
  reset() {
    Object.keys(this.metrics).forEach(key => {
      const value = this.metrics[key as keyof Metrics];
      if (typeof value === 'number') {
        (this.metrics as any)[key] = 0;
      } else if (value instanceof Map) {
        value.clear();
      } else if (Array.isArray(value)) {
        value.length = 0;
      }
    });
  }

  // Private helper methods
  private updateResponseTime(responseTime: number) {
    this.metrics.responseTimeHistory.push(responseTime);
    
    // Keep history size manageable
    if (this.metrics.responseTimeHistory.length > this.maxHistorySize) {
      this.metrics.responseTimeHistory.shift();
    }
    
    // Calculate average
    this.metrics.averageResponseTime = 
      this.metrics.responseTimeHistory.reduce((sum, time) => sum + time, 0) / 
      this.metrics.responseTimeHistory.length;
  }

  private incrementMapValue<K>(map: Map<K, number>, key: K) {
    map.set(key, (map.get(key) || 0) + 1);
  }

  private startSystemMetricsCollection() {
    setInterval(() => {
      this.metrics.memoryUsage = process.memoryUsage();
      this.metrics.cpuUsage = process.cpuUsage(this.metrics.cpuUsage);
      
      // Log metrics periodically
      if (config.LOG_LEVEL === 'debug') {
        logger.debug('System metrics', {
          memory: this.metrics.memoryUsage,
          requests: this.metrics.totalRequests,
          averageResponseTime: this.metrics.averageResponseTime,
          errorRate: this.metrics.errorRate,
        });
      }
    }, 60000); // Every minute
  }
}

// Global metrics instance
export const metrics = new MetricsCollector();

// Express middleware
export const metricsMiddleware = () => metrics.trackRequest();

// Health check endpoint
export const healthCheck = (req: Request, res: Response) => {
  const health = metrics.getHealth();
  const responseCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 206 : 503;
  
  res.status(responseCode).json({
    status: health.status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    issues: health.issues,
    version: process.env.npm_package_version || '1.0.0',
  });
};

// Metrics endpoint
export const metricsEndpoint = (req: Request, res: Response) => {
  if (!config.ENABLE_METRICS) {
    return res.status(404).json({ error: 'Metrics not enabled' });
  }
  
  const allMetrics = metrics.getMetrics();
  
  res.json({
    ...allMetrics,
    // Convert Maps to objects for JSON serialization
    requestsByEndpoint: Object.fromEntries(allMetrics.requestsByEndpoint),
    requestsByStatus: Object.fromEntries(allMetrics.requestsByStatus),
    errorsByType: Object.fromEntries(allMetrics.errorsByType),
  });
}; 