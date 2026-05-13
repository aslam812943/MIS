import { type Request, type Response } from 'express';
import type { IAuthService } from '../services/interfaces/IAuthService.js';
import { HttpStatus } from '../utils/httpStatus.js';

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
   * Validates input, calls the auth service, and returns the result or an error message.
   * 
   * @param req Express Request object containing email and password in the body.
   * @param res Express Response object.
   * @returns A Promise that resolves to void.
   */
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(HttpStatus.BAD_REQUEST).json({ message: 'Email and password are required' });
        return;
      }

      const loginResult = await this.authService.login(email, password);
      res.status(HttpStatus.OK).json(loginResult);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during login';
      res.status(HttpStatus.UNAUTHORIZED).json({ message: errorMessage });
    }
  };
}
