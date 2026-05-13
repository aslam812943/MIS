import type { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';
import { HttpStatus } from '../utils/httpStatus.js';

/**
 * Express middleware to enforce JWT authentication.
 * Extracts the Bearer token from the Authorization header and verifies it via Supabase.
 * If the token is missing, invalid, or expired, it returns a 401 Unauthorized response.
 *
 * @param req Express Request object.
 * @param res Express Response object.
 * @param next Express NextFunction to pass control to the next middleware.
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Authentication required. Token missing or malformed.' });
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Authentication required. Token missing.' });
      return;
    }

    // Verify the JWT token using Supabase's auth API.
    // Supabase inherently checks the 1-hour expiration and signature validity.
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Invalid or expired token. Please log in again.' });
      return;
    }

    // Optionally, you can attach the verified user object to the request for downstream use.
    // (req as any).user = data.user;

    next();
  } catch (error) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error during authentication verification.' });
  }
};
