import { type Request, type Response } from 'express';
import { FinanceService } from '../services/FinanceService.js';
import { HttpStatus } from '../utils/httpStatus.js';
import { logAudit } from '../utils/auditLogger.js';

export class FinanceController {
  constructor(private financeService: FinanceService) {}

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
        msg.includes('cannot be before')
      ) {
        return HttpStatus.BAD_REQUEST;
      }
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  /**
   * Recognized validation/authorization errors (400/403) carry a specific,
   * useful message that's safe to show the user (e.g. "PAN required").
   * Anything that falls through to 500 is an unexpected failure — most
   * often a raw Postgres/Supabase error — which used to be forwarded to the
   * client verbatim (leaking column/constraint names). Those are now logged
   * server-side and replaced with a generic message in the response.
   */
  private respondError(res: Response, error: unknown, fallbackMessage: string): void {
    const status = this.getErrorStatus(error);
    const rawMessage = error instanceof Error ? error.message : fallbackMessage;

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error('[FinanceController]', rawMessage);
      res.status(status).json({ message: fallbackMessage });
      return;
    }

    res.status(status).json({ message: rawMessage });
  }

  getDashboardStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { branchId, startDate, endDate } = req.query;

      const stats = await this.financeService.getDashboardStats(
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

      const entries = await this.financeService.getEntries(
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

      const entry = await this.financeService.createEntry(requesterId, sheet as string, req.body);

      await logAudit(
        req,
        'INSERT',
        `finance_${String(sheet).replace(/-/g, '_')}`,
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

      const entry = await this.financeService.updateEntry(requesterId, sheet as string, id as string, req.body);

      await logAudit(
        req,
        'UPDATE',
        `finance_${String(sheet).replace(/-/g, '_')}`,
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

      await this.financeService.deleteEntry(requesterId, sheet as string, id as string);

      await logAudit(
        req,
        'DELETE',
        `finance_${String(sheet).replace(/-/g, '_')}`,
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

      const updated = await this.financeService.bulkUpdate(requesterId, sheet as string, ids, updates);

      await logAudit(
        req,
        'UPDATE',
        `finance_${String(sheet).replace(/-/g, '_')}`,
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

      const imported = await this.financeService.bulkImport(requesterId, sheet as string, records);

      await logAudit(
        req,
        'INSERT',
        `finance_${String(sheet).replace(/-/g, '_')}`,
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
