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
      const user = await this.userService.createUser(req.body);

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

      const oldUser = await this.userService.getUserById(id);
      const user = await this.userService.updateUser(id, req.body);

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

      const oldUser = await this.userService.getUserById(id);
      const user = await this.userService.updateUserStatus(id, status);

      // Audit Log
      logAudit(req, 'UPDATE', 'profiles', id, oldUser, user);

      res.status(HttpStatus.OK).json(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update user status';
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message });
    }
  };
}
