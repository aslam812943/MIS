import type { Request, Response, NextFunction } from 'express';
import { HttpStatus } from '../utils/httpStatus.js';

/**
 * Middleware to ensure the authenticated user has either the 'admin' or 'hr' role.
 * This MUST be used after the requireAuth middleware.
 */
export const requireAdminOrHR = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;

    if (!user) {
      res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Authentication required' });
      return;
    }

    if (user.role !== 'admin' && user.role !== 'hr') {
      res.status(HttpStatus.FORBIDDEN).json({ message: 'Access denied. Administrator or HR privileges required.' });
      return;
    }

    next();
  } catch (err) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Error verifying privileges' });
  }
};
