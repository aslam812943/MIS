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
      const message = error instanceof Error ? error.message : 'Failed to create user';
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message });
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
      const message = error instanceof Error ? error.message : 'Failed to fetch users';
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message });
    }
  };

  /**
   * Deletes a user.
   */
  deleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;

      const oldUser = await this.userService.getUserById(id);
      await this.userService.deleteUser(id);

      // Audit Log
      logAudit(req, 'DELETE', 'profiles', id, oldUser, null);

      res.status(HttpStatus.OK).json({ message: 'User deleted successfully' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete user';
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message });
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
      const message = error instanceof Error ? error.message : 'Failed to update user';
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message });
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
      const message = error instanceof Error ? error.message : 'Failed to update user status';
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message });
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
      const message = error instanceof Error ? error.message : 'Failed to fetch HR dashboard metrics';
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message });
    }
  };
}
