import { type Request, type Response } from 'express';
import { ProfileService } from '../services/ProfileService.js';
import { HttpStatus } from '../utils/httpStatus.js';

export class ProfileController {
  constructor(private profileService: ProfileService) {}

  updateProfile = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { full_name, phone_number } = req.body;
      const file = req.file;

      const updatedUser = await this.profileService.updateProfile(userId, { full_name, phone_number }, file);
      res.status(HttpStatus.OK).json(updatedUser);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: errorMessage });
    }
  };

  changePassword = async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = (req as any).user;

      if (!currentPassword || !newPassword) {
        res.status(HttpStatus.BAD_REQUEST).json({ message: 'Current and new passwords are required' });
        return;
      }

      await this.profileService.changePassword(user.id, user.email, currentPassword, newPassword);
      res.status(HttpStatus.OK).json({ message: 'Password updated successfully' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update password';
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: errorMessage });
    }
  };

  getMe = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const profile = await this.profileService.getProfile(userId);
      res.status(HttpStatus.OK).json(profile);
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch profile' });
    }
  };
}
