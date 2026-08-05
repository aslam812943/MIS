import { type Request, type Response } from 'express';
import { SalesService } from '../services/SalesService.js';
import { HttpStatus } from '../utils/httpStatus.js';
import { logAudit } from '../utils/auditLogger.js';

export class SalesController {
  constructor(private salesService: SalesService) {}

  private getErrorStatus(error: any): number {
    if (error instanceof Error) {
      const msg = error.message;
      if (msg.includes('Unauthorized') || msg.includes('access denied') || msg.includes('Access denied')) {
        return 403;
      }
      if (
        msg.includes('Invalid') ||
        msg.includes('required') ||
        msg.includes('Locked') ||
        msg.includes('negative') ||
        msg.includes('digits') ||
        msg.includes('format') ||
        msg.includes('not found')
      ) {
        return 400;
      }
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private respondError(res: Response, error: unknown, fallbackMessage: string): void {
    const status = this.getErrorStatus(error);
    const rawMessage = error instanceof Error ? error.message : fallbackMessage;

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error('[SalesController]', rawMessage);
      res.status(status).json({ message: fallbackMessage });
      return;
    }
    res.status(status).json({ message: rawMessage });
  }

  getSales = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { status, productType, branchId, search } = req.query;
      const sales = await this.salesService.getSales(requesterId, {
        status: status as string,
        productType: productType as string,
        branchId: branchId as string,
        search: search as string,
      });
      res.status(HttpStatus.OK).json(sales);
    } catch (error) {
      this.respondError(res, error, 'Failed to retrieve sales.');
    }
  };

  createSale = async (req: Request, res: Response): Promise<void> => {
    try {
      const creatorId = (req as any).user.id;
      const sale = await this.salesService.createSale(req.body, creatorId);
      logAudit(req, 'INSERT', 'sales', sale.id, null, sale);
      res.status(HttpStatus.CREATED).json(sale);
    } catch (error) {
      this.respondError(res, error, 'Failed to create sale.');
    }
  };

  updateSale = async (req: Request, res: Response): Promise<void> => {
    try {
      const updaterId = (req as any).user.id;
      const id = req.params.id as string;
      const allSales = await this.salesService.getSales(updaterId, {});
      const oldSale = allSales.find((s) => s.id === id);
      const sale = await this.salesService.updateSale(id, req.body, updaterId);
      logAudit(req, 'UPDATE', 'sales', id, oldSale || null, sale);
      res.status(HttpStatus.OK).json(sale);
    } catch (error) {
      this.respondError(res, error, 'Failed to update sale.');
    }
  };

  deleteSale = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const id = req.params.id as string;
      const allSales = await this.salesService.getSales(requesterId, {});
      const oldSale = allSales.find((s) => s.id === id);
      await this.salesService.deleteSale(id, requesterId);
      logAudit(req, 'DELETE', 'sales', id, oldSale || null, null);
      res.status(HttpStatus.NO_CONTENT).send();
    } catch (error) {
      this.respondError(res, error, 'Failed to delete sale.');
    }
  };

  getDashboardData = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { branchId, startDate, endDate } = req.query;
      const dashboardData = await this.salesService.getDashboardData(
        requesterId,
        branchId as string,
        startDate as string,
        endDate as string
      );
      res.status(HttpStatus.OK).json(dashboardData);
    } catch (error) {
      this.respondError(res, error, 'Failed to retrieve dashboard metrics.');
    }
  };
}
