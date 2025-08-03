import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  // Server Configuration
  PORT: z.string().transform(Number).default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  
  // Database Configuration
  DATABASE_URL: z.string(),
  
  // Authentication
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.string().transform(Number).default('12'),
  
  // AI Configuration
  GEMINI_API_KEY: z.string(),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash-exp'),
  GEMINI_TEMPERATURE: z.string().transform(Number).default('0.7'),
  GEMINI_MAX_TOKENS: z.string().transform(Number).default('8192'),
  
  // AWS S3 Configuration
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  S3_BUCKET_NAME: z.string(),
  S3_CODE_PREFIX: z.string().default('code-artifacts/'),
  S3_PRESIGNED_URL_EXPIRES: z.string().transform(Number).default('3600'), // 1 hour
  
  // Cache Configuration
  CACHE_MAX_SIZE: z.string().transform(Number).default('50'), // MB
  CACHE_TTL: z.string().transform(Number).default('3600'), // seconds
  
  // Rate Limiting
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('900000'), // 15 minutes
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
  RATE_LIMIT_STRICT_MAX: z.string().transform(Number).default('50'),
  
  // Build Configuration
  BUILD_TIMEOUT: z.string().transform(Number).default('30000'), // 30 seconds
  BUILD_CACHE_SIZE: z.string().transform(Number).default('100'),
  
  // Monitoring
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  ENABLE_METRICS: z.string().transform(val => val === 'true').default('false'),
  
  // Features
  ENABLE_STREAMING: z.string().transform(val => val === 'true').default('true'),
  ENABLE_CODE_EXECUTION: z.string().transform(val => val === 'true').default('true'),
  ENABLE_ERROR_RESOLUTION: z.string().transform(val => val === 'true').default('true'),
});

// Validate and parse configuration
export const config = configSchema.parse(process.env);

// Type-safe configuration object
export type Config = z.infer<typeof configSchema>;

// Utility functions
export const isDevelopment = config.NODE_ENV === 'development';
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';

// Database configuration based on environment
export const getDatabaseConfig = () => ({
  log: isProduction ? ['error'] : ['error', 'warn'],
  datasources: {
    db: {
      url: config.DATABASE_URL,
    },
  },
  // Add connection pooling for production
  ...(isProduction && {
    datasourceTimeout: 20000,
    connectionLimit: 20,
  }),
});

// S3 client configuration
export const getS3Config = () => ({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
  maxRetries: 3,
  retryMode: 'adaptive' as const,
});

// Gemini configuration
export const getGeminiConfig = () => ({
  apiKey: config.GEMINI_API_KEY,
  model: config.GEMINI_MODEL,
  generationConfig: {
    temperature: config.GEMINI_TEMPERATURE,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: config.GEMINI_MAX_TOKENS,
  },
});

// Rate limiting configuration
export const getRateLimitConfig = () => ({
  windowMs: config.RATE_LIMIT_WINDOW,
  max: config.RATE_LIMIT_MAX,
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const getStrictRateLimitConfig = () => ({
  ...getRateLimitConfig(),
  max: config.RATE_LIMIT_STRICT_MAX,
}); 