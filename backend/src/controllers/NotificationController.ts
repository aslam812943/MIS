import { type Request, type Response } from 'express';
import { NotificationService } from '../services/NotificationService.js';
import { HttpStatus } from '../utils/httpStatus.js';

/**
 * Controller for in-app notifications.
 */
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  getMyNotifications = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const notifications = await this.notificationService.getUserNotifications(userId);
      res.status(HttpStatus.OK).json(notifications);
    } catch (error) {
      console.error('[NotificationController] getMyNotifications', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch notifications.' });
    }
  };

  getUnreadCount = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const count = await this.notificationService.getUnreadCount(userId);
      res.status(HttpStatus.OK).json({ count });
    } catch (error) {
      console.error('[NotificationController] getUnreadCount', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch unread count.' });
    }
  };

  markAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const id = req.params.id as string;
      await this.notificationService.markAsRead(id, userId);
      res.status(HttpStatus.OK).json({ message: 'Notification marked as read.' });
    } catch (error) {
      console.error('[NotificationController] markAsRead', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Failed to update notification.' });
    }
  };

  markAllAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      await this.notificationService.markAllAsRead(userId);
      res.status(HttpStatus.OK).json({ message: 'All notifications marked as read.' });
    } catch (error) {
      console.error('[NotificationController] markAllAsRead', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Failed to update notifications.' });
    }
  };

  /**
   * Admin-only manual trigger — useful to re-run the scan on demand
   * without waiting for the daily schedule (e.g. right after deploying).
   */
  runCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.notificationService.runDueItemCheck();
      res.status(HttpStatus.OK).json(result);
    } catch (error) {
      console.error('[NotificationController] runCheck', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Failed to run notification check.' });
    }
  };
}
