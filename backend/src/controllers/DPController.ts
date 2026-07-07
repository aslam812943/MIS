import { type Request, type Response } from 'express';
import { DPService } from '../services/DPService.js';
import { HttpStatus } from '../utils/httpStatus.js';
import { logAudit } from '../utils/auditLogger.js';

export class DPController {
  constructor(private dpService: DPService) {}

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
        msg.includes('must be')
      ) {
        return HttpStatus.BAD_REQUEST;
      }
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  getVerifiedClients = async (req: Request, res: Response): Promise<void> => {
    try {
      const clients = await this.dpService.getVerifiedClients();
      res.status(HttpStatus.OK).json(clients);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve clients';
      res.status(this.getErrorStatus(error)).json({ message });
    }
  };

  getDashboardStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { branchId, startDate, endDate } = req.query;

      const stats = await this.dpService.getDashboardStats(
        requesterId,
        branchId as string,
        startDate as string,
        endDate as string
      );
      res.status(HttpStatus.OK).json(stats);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve dashboard stats';
      res.status(this.getErrorStatus(error)).json({ message });
    }
  };

  getEntries = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { sheet } = req.params;
      const { branchId, search, startDate, endDate } = req.query;

      const entries = await this.dpService.getEntries(
        requesterId,
        sheet as string,
        branchId as string,
        search as string,
        startDate as string,
        endDate as string
      );
      res.status(HttpStatus.OK).json(entries);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve entries';
      res.status(this.getErrorStatus(error)).json({ message });
    }
  };

  createEntry = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { sheet } = req.params;
      
      const entry = await this.dpService.createEntry(requesterId, sheet as string, req.body);
      
      // Audit log entry creation
      await logAudit(
        req,
        'INSERT',
        `dp_${String(sheet).replace(/-/g, '_')}`,
        entry.id,
        null,
        entry
      );

      res.status(HttpStatus.CREATED).json(entry);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create entry';
      res.status(this.getErrorStatus(error)).json({ message });
    }
  };

  updateEntry = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { sheet, id } = req.params;

      const entry = await this.dpService.updateEntry(requesterId, sheet as string, id as string, req.body);

      // Audit log entry update
      await logAudit(
        req,
        'UPDATE',
        `dp_${String(sheet).replace(/-/g, '_')}`,
        id as string,
        null,
        entry
      );

      res.status(HttpStatus.OK).json(entry);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update entry';
      res.status(this.getErrorStatus(error)).json({ message });
    }
  };

  deleteEntry = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { sheet, id } = req.params;

      await this.dpService.deleteEntry(requesterId, sheet as string, id as string);

      // Audit log entry deletion
      await logAudit(
        req,
        'DELETE',
        `dp_${String(sheet).replace(/-/g, '_')}`,
        id as string,
        null,
        null
      );

      res.status(HttpStatus.NO_CONTENT).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete entry';
      res.status(this.getErrorStatus(error)).json({ message });
    }
  };

  bulkUpdate = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { sheet } = req.params;
      const { ids, updates } = req.body;

      const updated = await this.dpService.bulkUpdate(requesterId, sheet as string, ids, updates);

      await logAudit(
        req,
        'UPDATE',
        `dp_${String(sheet).replace(/-/g, '_')}`,
        undefined,
        null,
        { updated_rows: ids.length, updates }
      );

      res.status(HttpStatus.OK).json(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to apply batch updates';
      res.status(this.getErrorStatus(error)).json({ message });
    }
  };

  bulkImport = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { sheet } = req.params;
      const { records } = req.body;

      const imported = await this.dpService.bulkImport(requesterId, sheet as string, records);

      await logAudit(
        req,
        'INSERT',
        `dp_${String(sheet).replace(/-/g, '_')}`,
        undefined,
        null,
        { imported_rows: records.length }
      );

      res.status(HttpStatus.CREATED).json(imported);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to complete CSV import';
      res.status(this.getErrorStatus(error)).json({ message });
    }
  };
}
