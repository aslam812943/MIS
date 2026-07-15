import { type Request, type Response } from 'express';
import { ITService } from '../services/ITService.js';
import { HttpStatus } from '../utils/httpStatus.js';
import { logAudit } from '../utils/auditLogger.js';

export class ITController {
  constructor(private itService: ITService) {}

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
        msg.includes('already exists')
      ) {
        return HttpStatus.BAD_REQUEST;
      }
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  /**
   * Recognized validation/authorization errors (400/403) carry a specific
   * message that's safe to show the user. Anything that falls through to
   * 500 is an unexpected failure — usually a raw Postgres/Supabase error —
   * which used to be forwarded to the client verbatim. Those are now logged
   * server-side and replaced with a generic message in the response.
   */
  private respondError(res: Response, error: unknown, fallbackMessage: string): void {
    const status = this.getErrorStatus(error);
    const rawMessage = error instanceof Error ? error.message : fallbackMessage;

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error('[ITController]', rawMessage);
      res.status(status).json({ message: fallbackMessage });
      return;
    }

    res.status(status).json({ message: rawMessage });
  }

  getVendorsDropdown = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const vendors = await this.itService.getVendorsDropdown(requesterId);
      res.status(HttpStatus.OK).json(vendors);
    } catch (error) {
      this.respondError(res, error, 'Failed to retrieve vendors.');
    }
  };

  getITStaffDropdown = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const staff = await this.itService.getITStaffDropdown(requesterId);
      res.status(HttpStatus.OK).json(staff);
    } catch (error) {
      this.respondError(res, error, 'Failed to retrieve IT staff.');
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

      const fileUrl = await this.itService.uploadDocument(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      res.status(HttpStatus.OK).json({ fileUrl });
    } catch (error) {
      this.respondError(res, error, 'Failed to upload document.');
    }
  };

  getDashboardStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { branchId, startDate, endDate } = req.query;

      const stats = await this.itService.getDashboardStats(
        requesterId,
        branchId as string,
        startDate as string,
        endDate as string
      );
      res.status(HttpStatus.OK).json(stats);
    } catch (error) {
      this.respondError(res, error, 'Failed to retrieve dashboard stats.');
    }
  };

  getEntries = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { sheet } = req.params;
      const { branchId, search, startDate, endDate } = req.query;

      const entries = await this.itService.getEntries(
        requesterId,
        sheet as string,
        branchId as string,
        search as string,
        startDate as string,
        endDate as string
      );
      res.status(HttpStatus.OK).json(entries);
    } catch (error) {
      this.respondError(res, error, 'Failed to retrieve entries.');
    }
  };

  createEntry = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { sheet } = req.params;

      const entry = await this.itService.createEntry(requesterId, sheet as string, req.body);

      // Audit log entry creation
      await logAudit(
        req,
        'INSERT',
        `it_${String(sheet).replace(/-/g, '_')}`,
        entry.id,
        null,
        entry
      );

      res.status(HttpStatus.CREATED).json(entry);
    } catch (error) {
      this.respondError(res, error, 'Failed to create entry.');
    }
  };

  updateEntry = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { sheet, id } = req.params;

      const entry = await this.itService.updateEntry(requesterId, sheet as string, id as string, req.body);

      // Audit log entry update
      await logAudit(
        req,
        'UPDATE',
        `it_${String(sheet).replace(/-/g, '_')}`,
        id as string,
        null,
        entry
      );

      res.status(HttpStatus.OK).json(entry);
    } catch (error) {
      this.respondError(res, error, 'Failed to update entry.');
    }
  };

  deleteEntry = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { sheet, id } = req.params;

      await this.itService.deleteEntry(requesterId, sheet as string, id as string);

      // Audit log entry deletion
      await logAudit(
        req,
        'DELETE',
        `it_${String(sheet).replace(/-/g, '_')}`,
        id as string,
        null,
        null
      );

      res.status(HttpStatus.NO_CONTENT).send();
    } catch (error) {
      this.respondError(res, error, 'Failed to delete entry.');
    }
  };

  bulkUpdate = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { sheet } = req.params;
      const { ids, updates } = req.body;

      const updated = await this.itService.bulkUpdate(requesterId, sheet as string, ids, updates);

      await logAudit(
        req,
        'UPDATE',
        `it_${String(sheet).replace(/-/g, '_')}`,
        undefined,
        null,
        { updated_rows: Array.isArray(ids) ? ids.length : 0, updates }
      );

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

      const imported = await this.itService.bulkImport(requesterId, sheet as string, records);

      await logAudit(
        req,
        'INSERT',
        `it_${String(sheet).replace(/-/g, '_')}`,
        undefined,
        null,
        { imported_rows: Array.isArray(records) ? records.length : 0 }
      );

      res.status(HttpStatus.CREATED).json(imported);
    } catch (error) {
      this.respondError(res, error, 'Failed to complete CSV import.');
    }
  };
}
