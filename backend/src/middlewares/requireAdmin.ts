import type { Request, Response, NextFunction } from 'express';
import { HttpStatus } from '../utils/httpStatus.js';

/**
 * Middleware to ensure the authenticated user has the 'admin' role.
 * This MUST be used after the requireAuth middleware.
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // requireAuth middleware has already verified the token and attached the user to req.user
    const user = (req as any).user;

    if (!user) {
      res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Authentication required' });
      return;
    }

    if (user.role !== 'admin') {
      res.status(HttpStatus.FORBIDDEN).json({ message: 'Access denied. Administrator privileges required.' });
      return;
    }

    next();
  } catch (err) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Error verifying administrator privileges' });
  }
};
