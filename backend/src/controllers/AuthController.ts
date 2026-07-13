import { type Request, type Response } from 'express';
import type { IAuthService } from '../services/interfaces/IAuthService.js';
import { HttpStatus } from '../utils/httpStatus.js';
import { logLoginEvent, logLogoutEvent } from '../utils/auditLogger.js';
import jwt from 'jsonwebtoken';

/**
 * Controller responsible for handling authentication-related requests.
 */
export class AuthController {
  /**
   * @param authService The authentication service implementation.
   */
  constructor(private authService: IAuthService) {}

  /**
   * Processes the user login request.
   * Validates input, calls the auth service, generates a JWT, and sets a secure cookie.
   */
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, role } = req.body;

      if (!email || !password || !role) {
        res.status(HttpStatus.BAD_REQUEST).json({ message: 'Email, password, and role are required' });
        return;
      }

      const loginResult = await this.authService.login(email, password, role);

      // Generate secure JWT token
      const token = jwt.sign(
        { 
          id: loginResult.user.id, 
          email: loginResult.user.email, 
          role: loginResult.user.role 
        },
        process.env.JWT_SECRET || 'mis-super-secret-key-2025',
        { expiresIn: '2h' }
      );

      // Set secure HTTP-only cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
      });

      // Record the login in the audit trail (fire-and-forget, doesn't block the response)
      logLoginEvent(req, {
        id: loginResult.user.id,
        email: loginResult.user.email,
        role: loginResult.user.role
      });

      // Send user data back (but not the session token as it's in the cookie)
      res.status(HttpStatus.OK).json({
        user: loginResult.user,
        message: 'Login successful'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during login';
      res.status(HttpStatus.UNAUTHORIZED).json({ message: errorMessage });
    }
  };

  /**
   * Processes the user logout request.
   * Clears the authentication cookie and records the logout (with session
   * duration) in the audit trail.
   */
  logout = async (req: Request, res: Response): Promise<void> => {
    const token = req.cookies?.token;

    if (token) {
      try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'mis-super-secret-key-2025');
        await logLogoutEvent(req, { id: decoded.id, email: decoded.email, role: decoded.role });
      } catch {
        // Token already invalid/expired — nothing meaningful to record.
      }
    }

    res.clearCookie('token');
    res.status(HttpStatus.OK).json({ message: 'Logged out successfully' });
  };

  /**
   * Handles the request to send a password reset OTP.
   */
  requestOTP = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, role } = req.body;

      if (!email || !role) {
        res.status(HttpStatus.BAD_REQUEST).json({ message: 'Email and role are required' });
        return;
      }

      await this.authService.requestPasswordReset(email, role);
      res.status(HttpStatus.OK).json({ message: 'If an account exists, an OTP has been sent to your email.' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to request OTP';
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: errorMessage });
    }
  };

  /**
   * Handles the password reset request using OTP.
   */
  resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, otp, newPassword, role } = req.body;

      if (!email || !otp || !newPassword || !role) {
        res.status(HttpStatus.BAD_REQUEST).json({ message: 'Email, OTP, new password, and role are required' });
        return;
      }

      await this.authService.resetPassword(email, otp, newPassword, role);
      res.status(HttpStatus.OK).json({ message: 'Password reset successful. You can now log in with your new password.' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset password';
      res.status(HttpStatus.BAD_REQUEST).json({ message: errorMessage });
    }
  };
}
