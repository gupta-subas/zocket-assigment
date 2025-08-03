import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader, JWTPayload } from '../utils/auth';
import { createLogger } from '../utils/logger';

const logger = createLogger();

export interface AuthenticatedRequest extends Request {
  user: JWTPayload;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No token provided' 
      });
    }

    const payload = verifyToken(token);
    (req as AuthenticatedRequest).user = payload;
    
    next();
  } catch (error) {
    logger.warn('Authentication failed:', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(401).json({ 
      error: 'Authentication failed',
      message: 'Invalid token' 
    });
  }
}

// Special auth middleware for preview endpoints that can accept tokens via query params
export function requireAuthWithQueryToken(req: Request, res: Response, next: NextFunction) {
  try {
    // First try to get token from Authorization header
    let token = extractTokenFromHeader(req.headers.authorization);
    
    // If no header token, try query parameter for iframe compatibility
    if (!token && req.query.token) {
      token = req.query.token as string;
    }
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No token provided' 
      });
    }

    const payload = verifyToken(token);
    (req as AuthenticatedRequest).user = payload;
    
    next();
  } catch (error) {
    logger.warn('Authentication failed:', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(401).json({ 
      error: 'Authentication failed',
      message: 'Invalid token' 
    });
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (token) {
      const payload = verifyToken(token);
      (req as AuthenticatedRequest).user = payload;
    }
    
    next();
  } catch (error) {
    // For optional auth, we don't fail if token is invalid
    logger.debug('Optional auth failed:', error);
    next();
  }
}