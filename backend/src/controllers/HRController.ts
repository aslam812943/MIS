import { type Request, type Response } from 'express';
import { HRService } from '../services/HRService.js';
import { HttpStatus } from '../utils/httpStatus.js';
import { logAudit } from '../utils/auditLogger.js';

export class HRController {
  constructor(private hrService: HRService) {}

  private getErrorStatus(error: any): number {
    if (error instanceof Error) {
      const msg = error.message;
      if (msg.includes('Unauthorized') || msg.includes('Access denied') || msg.includes('access denied')) {
        return HttpStatus.FORBIDDEN;
      }
      if (
        msg.includes('Invalid') ||
        msg.includes('required') ||
        msg.includes('Required') ||
        msg.includes('cannot exceed') ||
        msg.includes('must be') ||
        msg.includes('already exists') ||
        msg.includes('not found')
      ) {
        return HttpStatus.BAD_REQUEST;
      }
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private respondError(res: Response, error: unknown, fallbackMessage: string): void {
    const status = this.getErrorStatus(error);
    const rawMessage = error instanceof Error ? error.message : fallbackMessage;

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error('[HRController]', rawMessage);
      res.status(status).json({ message: fallbackMessage });
      return;
    }

    res.status(status).json({ message: rawMessage });
  }

  getOpenPositionsDropdown = async (_req: Request, res: Response): Promise<void> => {
    try {
      const positions = await this.hrService.getOpenPositionsDropdown();
      res.status(HttpStatus.OK).json(positions);
    } catch (error) {
      this.respondError(res, error, 'Failed to retrieve open positions.');
    }
  };

  uploadDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(HttpStatus.BAD_REQUEST).json({ message: 'No file uploaded.' });
        return;
      }

      if (req.file.size > 5 * 1024 * 1024) {
        res.status(HttpStatus.BAD_REQUEST).json({ message: 'File size exceeds maximum limit of 5MB.' });
        return;
      }

      const allowedMimes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      const allowedExts = ['pdf', 'png', 'jpg', 'jpeg'];
      const fileExt = (req.file.originalname.split('.').pop() || '').toLowerCase();

      if (!allowedMimes.includes(req.file.mimetype) || !allowedExts.includes(fileExt)) {
        res.status(HttpStatus.BAD_REQUEST).json({ message: 'Unsupported file format. Only PDF, PNG, and JPEG are allowed.' });
        return;
      }

      const fileUrl = await this.hrService.uploadDocument(req.file.buffer, req.file.originalname, req.file.mimetype);
      res.status(HttpStatus.OK).json({ fileUrl });
    } catch (error) {
      this.respondError(res, error, 'Failed to upload document.');
    }
  };

  getDashboardStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate } = req.query;
      const stats = await this.hrService.getDashboardStats(startDate as string, endDate as string);
      res.status(HttpStatus.OK).json(stats);
    } catch (error) {
      this.respondError(res, error, 'Failed to retrieve HR dashboard stats.');
    }
  };

  getEntries = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sheet } = req.params;
      const { search, startDate, endDate } = req.query;
      const entries = await this.hrService.getEntries(sheet as string, search as string, startDate as string, endDate as string);
      res.status(HttpStatus.OK).json(entries);
    } catch (error) {
      this.respondError(res, error, 'Failed to retrieve entries.');
    }
  };

  createEntry = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { sheet } = req.params;
      const entry = await this.hrService.createEntry(requesterId, sheet as string, req.body);

      await logAudit(req, 'INSERT', `hr_${String(sheet).replace(/-/g, '_')}`, entry.id, null, entry);

      res.status(HttpStatus.CREATED).json(entry);
    } catch (error) {
      this.respondError(res, error, 'Failed to create entry.');
    }
  };

  updateEntry = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { sheet, id } = req.params;
      const entry = await this.hrService.updateEntry(requesterId, sheet as string, id as string, req.body);

      await logAudit(req, 'UPDATE', `hr_${String(sheet).replace(/-/g, '_')}`, id as string, null, entry);

      res.status(HttpStatus.OK).json(entry);
    } catch (error) {
      this.respondError(res, error, 'Failed to update entry.');
    }
  };

  deleteEntry = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sheet, id } = req.params;
      await this.hrService.deleteEntry(sheet as string, id as string);

      await logAudit(req, 'DELETE', `hr_${String(sheet).replace(/-/g, '_')}`, id as string, null, null);

      res.status(HttpStatus.NO_CONTENT).send();
    } catch (error) {
      this.respondError(res, error, 'Failed to delete entry.');
    }
  };

  bulkUpdate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sheet } = req.params;
      const { ids, updates } = req.body;
      const updated = await this.hrService.bulkUpdate(sheet as string, ids, updates);

      await logAudit(req, 'UPDATE', `hr_${String(sheet).replace(/-/g, '_')}`, undefined, null, { updated_rows: Array.isArray(ids) ? ids.length : 0, updates });

      res.status(HttpStatus.OK).json(updated);
    } catch (error) {
      this.respondError(res, error, 'Failed to apply batch updates.');
    }
  };

  bulkImport = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { sheet } = req.params;
      const { records } = req.body;
      const result = await this.hrService.bulkImport(requesterId, sheet as string, records);

      await logAudit(req, 'INSERT', `hr_${String(sheet).replace(/-/g, '_')}`, undefined, null, { imported_rows: result.inserted.length, failed_rows: result.failed.length });

      res.status(HttpStatus.CREATED).json(result);
    } catch (error) {
      this.respondError(res, error, 'Failed to complete CSV import.');
    }
  };
}
