import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { createLogger } from './utils/logger';
import { validateEnv } from './utils/env';
import authRoutes from './routes/auth';
import chatRoutes from './routes/chat';

import conversationRoutes from './routes/conversations';
import artifactRoutes from './routes/artifacts';

import { generalRateLimit, strictRateLimit, authRateLimit } from './middleware/rate-limit';

dotenv.config();

const app = express();
const logger = createLogger();

// Singleton PrismaClient instance with optimized configuration
const prisma = new PrismaClient({
  log: ['error', 'warn'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Make prisma available globally to avoid multiple instances
declare global {
  var __prisma: PrismaClient | undefined;
}

if (!global.__prisma) {
  global.__prisma = prisma;
}

export { prisma };

// Validate environment variables
validateEnv();

const PORT = process.env.PORT || 3001;
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:3001', 
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001'
];

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"],
    },
  },
}));

app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true,
  optionsSuccessStatus: 200,
}));

app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiting
app.use(generalRateLimit);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Routes with specific rate limits
app.use('/api/auth', authRateLimit, authRoutes);
app.use('/api/chat', strictRateLimit, chatRoutes);

app.use('/api/conversations', conversationRoutes);

app.use('/api/artifacts', artifactRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl 
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  
  if (err.code === 'P2002') {
    return res.status(409).json({ 
      error: 'Duplicate entry',
      message: 'A record with this data already exists'
    });
  }
  
  if (err.code === 'P2025') {
    return res.status(404).json({ 
      error: 'Record not found',
      message: 'The requested resource was not found'
    });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down server...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down server...');
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📖 API Documentation available at http://localhost:${PORT}/health`);
  logger.info(`🌍 CORS enabled for: ${CORS_ORIGINS.join(', ')}`);
});

export default app;