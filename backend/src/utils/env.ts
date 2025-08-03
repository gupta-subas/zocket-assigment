import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  PORT: z.string().optional().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
  CORS_ORIGINS: z.string().optional().default('http://localhost:3000'),
  
  // AWS S3 Configuration
  AWS_REGION: z.string().min(1, 'AWS_REGION is required'),
  AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS_ACCESS_KEY_ID is required'),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, 'AWS_SECRET_ACCESS_KEY is required'),
  S3_BUCKET_NAME: z.string().min(1, 'S3_BUCKET_NAME is required'),
  S3_CODE_PREFIX: z.string().optional().default('code-artifacts/'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(): EnvConfig {
  try {
    const config = envSchema.parse(process.env);
    console.log('✅ Environment variables validated successfully');
    return config;
  } catch (error) {
    console.error('❌ Environment validation failed:');
    
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    
    console.error('\nPlease check your .env file and ensure all required variables are set.');
    console.error('You can use .env.example as a reference.');
    
    process.exit(1);
  }
}

export function getEnvConfig(): EnvConfig {
  return validateEnv();
}