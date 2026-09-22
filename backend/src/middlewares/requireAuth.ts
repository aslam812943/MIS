import type { Request, Response, NextFunction } from 'express';
import { HttpStatus } from '../utils/httpStatus.js';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import jwt from 'jsonwebtoken';
import { isFranchiseRole, isFranchiseApiPathAllowed } from '../utils/franchiseAccess.js';

/**
 * Express middleware to enforce JWT authentication via cookies or Authorization header.
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = req.cookies?.token || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

    if (!token) {
      res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Authentication required. Please log in.' });
      return;
    }

    // Verify the custom JWT token
    try {
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'mis-super-secret-key-2025');

      // Dealer calculation direct authentication
      if (decoded.role === 'dealer_calculation') {
        (req as any).user = decoded;
        return next();
      }
      
      // LIVE STATUS CHECK: Ensure user wasn't blocked after token was issued
      const { data: profile, error: profileError } = await (supabaseAdmin || supabase)
        .from('profiles')
        .select('status,role')
        .eq('id', decoded.id)
        .single();

      if (profileError || !profile || profile.status !== 'active') {
        res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Account suspended or not found. Please contact support.' });
        return;
      }

      // Attach the decoded user data to the request object
      let effectiveRole = profile.role;
      if (profile.role === 'franchise_owner' && decoded.role === 'franchise_staff') {
        const { data: member, error } = await (supabaseAdmin || supabase)
          .from('franchise_users')
          .select('shared_access,status')
          .eq('user_id', decoded.id)
          .maybeSingle();
        if (error || !member?.shared_access || member.status !== 'active') {
          res.status(HttpStatus.FORBIDDEN).json({ message: 'Staff access is disabled for this franchise login.' });
          return;
        }
        effectiveRole = 'franchise_staff';
      }
      (req as any).user = { ...decoded, role: effectiveRole };

      // External franchise accounts cannot use internal staff/task/department
      // APIs, including routes that historically allowed every authenticated user.
      if (isFranchiseRole(profile.role) && !isFranchiseApiPathAllowed(req.originalUrl)) {
        res.status(HttpStatus.FORBIDDEN).json({ message: 'Access denied. Use the Franchise portal for this account.' });
        return;
      }
      
      next();
    } catch (error) {
      res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Invalid or expired token. Please log in again.' });
      return;
    }
  } catch (error) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error during authentication verification.' });
  }
};
