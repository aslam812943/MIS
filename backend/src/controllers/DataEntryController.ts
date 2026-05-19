import { type Request, type Response } from 'express';
import { DataEntryService } from '../services/DataEntryService.js';
import { HttpStatus } from '../utils/httpStatus.js';

export class DataEntryController {
  constructor(private dataEntryService: DataEntryService) {}

  getEntry = async (req: Request, res: Response): Promise<void> => {
    try {
      const { date, moduleId } = req.query;
      const userId = (req as any).user?.id;
      
      if (!date || !moduleId || !userId) {
        res.status(HttpStatus.BAD_REQUEST).json({ message: 'Missing required parameters: date, moduleId, or user not authenticated' });
        return;
      }

      const entry = await this.dataEntryService.getEntry(date as string, moduleId as string, userId as string);
      res.status(HttpStatus.OK).json(entry);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get data entry';
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message });
    }
  };

  saveEntry = async (req: Request, res: Response): Promise<void> => {
    try {
      // User is injected by requireAuth middleware
      const userId = (req as any).user?.id;
      
      if (!userId) {
        res.status(HttpStatus.UNAUTHORIZED).json({ message: 'User not authenticated' });
        return;
      }
      
      // We explicitly ignore any branch_id sent from the client
      // The service will fetch it securely from the user profile
      const { branch_id, ...safeBody } = req.body;
      
      const payload = {
        ...safeBody,
        user_id: userId
      };

      const entry = await this.dataEntryService.saveEntry(payload);
      res.status(HttpStatus.OK).json(entry);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save data entry';
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message });
    }
  };
}
