import type { Request, Response, NextFunction } from 'express';
import { HttpStatus } from '../utils/httpStatus.js';
import { supabase } from '../config/supabase.js';
import jwt from 'jsonwebtoken';

/**
 * Express middleware to enforce JWT authentication via cookies.
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.cookies.token;

    if (!token) {
      res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Authentication required. Please log in.' });
      return;
    }

    // Verify the custom JWT token
    try {
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'mis-super-secret-key-2025');
      
      // LIVE STATUS CHECK: Ensure user wasn't blocked after token was issued
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', decoded.id)
        .single();

      if (profileError || !profile || profile.status === 'blocked') {
        res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Account suspended or not found. Please contact support.' });
        return;
      }

      // Attach the decoded user data to the request object
      (req as any).user = decoded;
      
      next();
    } catch (error) {
      res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Invalid or expired token. Please log in again.' });
      return;
    }
  } catch (error) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error during authentication verification.' });
  }
};
