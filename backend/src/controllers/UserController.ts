import { type Request, type Response } from 'express';
import { UserService } from '../services/UserService.js';
import { HttpStatus } from '../utils/httpStatus.js';
import { logAudit } from '../utils/auditLogger.js';

/**
 * Controller responsible for user management.
 */
export class UserController {
  constructor(private userService: UserService) {}

  /**
   * Maps a caught error to the correct HTTP status. Everything here is a
   * known, user-facing validation/authorization message that UserService
   * throws deliberately (e.g. "Access denied...", "Invalid email address
   * format.") — anything that doesn't match is an unexpected failure and
   * falls through to 500.
   */
  private getErrorStatus(error: unknown): number {
    if (error instanceof Error) {
      // Case-insensitive: a thrown message like "One or more selected
      // modules are invalid." (lowercase "invalid") previously slipped past
      // a case-sensitive check for 'Invalid' and fell through to a generic
      // 500, hiding the real, safe-to-show reason from the admin.
      const msg = error.message.toLowerCase();
      if (msg.includes('access denied') || msg.includes('cannot delete your own') || msg.includes('cannot block or resign your own')) {
        return HttpStatus.FORBIDDEN;
      }
      if (
        msg.includes('invalid') ||
        msg.includes('required') ||
        msg.includes('cannot exceed') ||
        msg.includes('must be') ||
        msg.includes('not found') ||
        msg.includes('last remaining administrator') ||
        msg.includes('already been registered') ||
        msg.includes('already exists') ||
        msg.includes('already registered')
      ) {
        return HttpStatus.BAD_REQUEST;
      }
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  /**
   * Recognized validation/authorization errors (400/403) carry a specific
   * message that's safe to show the user. Anything that falls through to
   * 500 is an unexpected failure — usually a raw Postgres/Supabase Auth
   * error — which used to be forwarded to the client verbatim. Those are
   * now logged server-side and replaced with a generic message.
   */
  private respondError(res: Response, error: unknown, fallbackMessage: string): void {
    const status = this.getErrorStatus(error);
    const rawMessage = error instanceof Error ? error.message : fallbackMessage;

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error('[UserController]', rawMessage);
      res.status(status).json({ message: fallbackMessage });
      return;
    }

    res.status(status).json({ message: rawMessage });
  }

  /**
   * Creates a new user.
   */
  createUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const requestingUser = (req as any).user;
      const user = await this.userService.createUser(req.body, requestingUser);

      // Audit Log
      logAudit(req, 'INSERT', 'profiles', user.id, null, user);

      res.status(HttpStatus.CREATED).json(user);
    } catch (error) {
      this.respondError(res, error, 'Failed to create user.');
    }
  };

  /**
   * Retrieves all users.
   */
  getUsers = async (req: Request, res: Response): Promise<void> => {
    try {
      const users = await this.userService.getAllUsers();
      res.status(HttpStatus.OK).json(users);
    } catch (error) {
      this.respondError(res, error, 'Failed to fetch users.');
    }
  };

  /**
   * Deletes a user.
   */
  deleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const requestingUser = (req as any).user;

      const oldUser = await this.userService.getUserById(id);
      await this.userService.deleteUser(id, requestingUser);

      // Audit Log
      logAudit(req, 'DELETE', 'profiles', id, oldUser, null);

      res.status(HttpStatus.OK).json({ message: 'User deleted successfully' });
    } catch (error) {
      this.respondError(res, error, 'Failed to delete user.');
    }
  };

  /**
   * Updates a user profile.
   */
  updateUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const requestingUser = (req as any).user;

      const oldUser = await this.userService.getUserById(id);
      const user = await this.userService.updateUser(id, req.body, requestingUser);

      // Audit Log
      logAudit(req, 'UPDATE', 'profiles', id, oldUser, user);

      res.status(HttpStatus.OK).json(user);
    } catch (error) {
      this.respondError(res, error, 'Failed to update user.');
    }
  };

  /**
   * Blocks or unblocks a user.
   */
  updateStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { status } = req.body;
      const requestingUser = (req as any).user;

      const oldUser = await this.userService.getUserById(id);
      const user = await this.userService.updateUserStatus(id, status, requestingUser);

      // Audit Log
      logAudit(req, 'UPDATE', 'profiles', id, oldUser, user);

      res.status(HttpStatus.OK).json(user);
    } catch (error) {
      this.respondError(res, error, 'Failed to update user status.');
    }
  };

  /**
   * Retrieves dashboard metrics and distribution chart values for HR.
   */
  getHRDashboardData = async (req: Request, res: Response): Promise<void> => {
    try {
      const { range, startDate, endDate } = req.query;
      const data = await this.userService.getHRDashboardData({
        range: range as string,
        startDate: startDate as string,
        endDate: endDate as string
      });
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      this.respondError(res, error, 'Failed to fetch HR dashboard metrics.');
    }
  };
}
