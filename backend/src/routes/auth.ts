import { Router } from 'express';
import { z } from 'zod';
import { generateToken, comparePassword } from '../utils/auth';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { createLogger } from '../utils/logger';
import { prisma } from '../utils/database';

const router = Router();
const logger = createLogger();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    logger.info('User logged in successfully', { userId: user.id, email: user.email });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        credits: user.credits,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error) {
    logger.error('Login error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }

    res.status(500).json({
      error: 'Login failed',
      message: 'Unable to authenticate'
    });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        credits: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            conversations: true,
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User account no longer exists'
      });
    }

    res.json({
      user: {
        ...user,
        conversationCount: user._count.conversations,
      }
    });
  } catch (error) {
    logger.error('Get user profile error:', error);
    res.status(500).json({
      error: 'Failed to get user profile',
      message: 'Unable to retrieve user information'
    });
  }
});

// POST /api/auth/refresh
router.post('/refresh', requireAuth, async (req, res) => {
  try {
    const { userId, email, username } = (req as AuthenticatedRequest).user;

    // Generate new token
    const token = generateToken({
      userId,
      email,
      username,
    });

    logger.info('Token refreshed', { userId });

    res.json({
      message: 'Token refreshed successfully',
      token,
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Token refresh failed',
      message: 'Unable to refresh token'
    });
  }
});

export default router;