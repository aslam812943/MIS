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
      const requesterId = (req as any).user?.id;
      const requesterRole = (req as any).user?.role;
      
      if (!requesterId) {
        res.status(HttpStatus.UNAUTHORIZED).json({ message: 'User not authenticated' });
        return;
      }
      
      // We explicitly ignore any branch_id or department_id sent from the client
      const { branch_id, department_id, ...safeBody } = req.body;
      
      // If employee, user_id is strictly forced to their own ID
      // If HOD, they can pass target employee's user_id in the body, otherwise it defaults to themselves
      const targetUserId = requesterRole === 'hod' ? (req.body.user_id || requesterId) : requesterId;
      
      const payload = {
        ...safeBody,
        user_id: targetUserId
      };

      const entry = await this.dataEntryService.saveEntry(payload, requesterId, requesterRole);
      res.status(HttpStatus.OK).json(entry);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save data entry';
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message });
    }
  };

  getDepartmentEntries = async (req: Request, res: Response): Promise<void> => {
    try {
      const { date } = req.query;
      const requesterId = (req as any).user?.id;
      const requesterRole = (req as any).user?.role;

      if (requesterRole !== 'hod' && requesterRole !== 'admin') {
        res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Only HOD or Admin can access department entries.' });
        return;
      }

      if (!date || !requesterId) {
        res.status(HttpStatus.BAD_REQUEST).json({ message: 'Date and user context must be present.' });
        return;
      }

      const entries = await this.dataEntryService.getDepartmentEntries(requesterId, date as string);
      res.status(HttpStatus.OK).json(entries);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get department data entries';
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message });
    }
  };

  verifyEntry = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const requesterId = (req as any).user?.id;
      const requesterRole = (req as any).user?.role;

      if (requesterRole !== 'hod') {
        res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Only HOD can verify department entries.' });
        return;
      }

      if (!id) {
        res.status(HttpStatus.BAD_REQUEST).json({ message: 'Entry ID is required.' });
        return;
      }

      const entry = await this.dataEntryService.verifyEntry(id as string, requesterId);
      res.status(HttpStatus.OK).json(entry);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to verify entry';
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message });
    }
  };
}
