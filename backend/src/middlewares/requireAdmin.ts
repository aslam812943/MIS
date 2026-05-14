import type { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';
import { HttpStatus } from '../utils/httpStatus.js';

/**
 * Middleware to ensure the authenticated user has the 'admin' role.
 * This must be used AFTER the requireAuth middleware.
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Authentication required' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Invalid session' });
      return;
    }

    // Fetch the role from the profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      res.status(HttpStatus.FORBIDDEN).json({ message: 'User profile not found' });
      return;
    }

    if (profile.role !== 'admin') {
      res.status(HttpStatus.FORBIDDEN).json({ message: 'Access denied. Administrator privileges required.' });
      return;
    }

    next();
  } catch (err) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Error verifying administrator privileges' });
  }
};
