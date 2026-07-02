import { type Request, type Response } from 'express';
import { SettlementService } from '../services/SettlementService.js';
import { HttpStatus } from '../utils/httpStatus.js';
import { logAudit } from '../utils/auditLogger.js';

export class SettlementController {
  constructor(private settlementService: SettlementService) {}

  private getErrorStatus(error: any): number {
    if (error instanceof Error) {
      const msg = error.message;
      if (msg.includes('Unauthorized') || msg.includes('access denied') || msg.includes('Access denied')) {
        return 403; // Forbidden
      }
      if (
        msg.includes('Invalid') ||
        msg.includes('Required') ||
        msg.includes('positive') ||
        msg.includes('negative') ||
        msg.includes('must be') ||
        msg.includes('required') ||
        msg.includes('exists') ||
        msg.includes('cannot exceed') ||
        msg.includes('must be an integer')
      ) {
        return 400; // Bad Request
      }
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  /* ═══════════════════════════════════════════════
     PART 5: DASHBOARD CONTROLLER
     ═══════════════════════════════════════════════ */

  /**
   * Get Dashboard statistics
   */
  getDashboardStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { branchId } = req.query;

      const stats = await this.settlementService.getDashboardStats(requesterId, branchId as string);

      res.status(HttpStatus.OK).json(stats);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve dashboard stats';
      res.status(this.getErrorStatus(error)).json({ message });
    }
  };

  /* ═══════════════════════════════════════════════
     PART 1: PAY-IN / PAY-OUT CONTROLLER
     ═══════════════════════════════════════════════ */

  /**
   * Get Pay-in/Pay-out records
   */
  getPayInPayOutRecords = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { status, branchId, search } = req.query;

      const records = await this.settlementService.getPayInPayOutRecords(requesterId, {
        status: status as string,
        branchId: branchId as string,
        search: search as string,
      });

      res.status(HttpStatus.OK).json(records);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve records';
      res.status(this.getErrorStatus(error)).json({ message });
    }
  };

  /**
   * Create a Pay-in/Pay-out record
   */
  createPayInPayOutRecord = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const record = await this.settlementService.createPayInPayOutRecord(requesterId, req.body);

      // Audit Log
      logAudit(req, 'INSERT', 'settlement_payin_payout', record.id!, null, record);

      res.status(HttpStatus.CREATED).json(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create record';
      res.status(this.getErrorStatus(error)).json({ message });
    }
  };

  /**
   * Update a Pay-in/Pay-out record
   */
  updatePayInPayOutRecord = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const id = req.params.id as string;

      // Get old record for audit logging
      const allRecords = await this.settlementService.getPayInPayOutRecords(requesterId, {});
      const oldRecord = allRecords.find(r => r.id === id);

      const record = await this.settlementService.updatePayInPayOutRecord(requesterId, id, req.body);

      // Audit Log
      logAudit(req, 'UPDATE', 'settlement_payin_payout', id, oldRecord || null, record);

      res.status(HttpStatus.OK).json(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update record';
      res.status(this.getErrorStatus(error)).json({ message });
    }
  };

  /* ═══════════════════════════════════════════════
     PART 2: CLIENT SERVICE REQUESTS CONTROLLER
     ═══════════════════════════════════════════════ */

  /**
   * Get Client Requests
   */
  getClientRequestRecords = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { status, branchId, search } = req.query;

      const records = await this.settlementService.getClientRequestRecords(requesterId, {
        status: status as string,
        branchId: branchId as string,
        search: search as string,
      });

      res.status(HttpStatus.OK).json(records);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve Client Requests';
      res.status(this.getErrorStatus(error)).json({ message });
    }
  };

  /**
   * Create a Client Request
   */
  createClientRequestRecord = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const record = await this.settlementService.createClientRequestRecord(requesterId, req.body);

      // Audit Log
      logAudit(req, 'INSERT', 'settlement_client_requests', record.id!, null, record);

      res.status(HttpStatus.CREATED).json(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create Client Request';
      res.status(this.getErrorStatus(error)).json({ message });
    }
  };

  /**
   * Update a Client Request
   */
  updateClientRequestRecord = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const id = req.params.id as string;

      // Get old record for audit logging
      const allRecords = await this.settlementService.getClientRequestRecords(requesterId, {});
      const oldRecord = allRecords.find(r => r.id === id);

      const record = await this.settlementService.updateClientRequestRecord(requesterId, id, req.body);

      // Audit Log
      logAudit(req, 'UPDATE', 'settlement_client_requests', id, oldRecord || null, record);

      res.status(HttpStatus.OK).json(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update Client Request';
      res.status(this.getErrorStatus(error)).json({ message });
    }
  };

  /* ═══════════════════════════════════════════════
     PART 3: IPO ALLOCATION CONTROLLER
     ═══════════════════════════════════════════════ */

  /**
   * Get IPO Allocations
   */
  getIpoAllocationRecords = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { status, branchId, search } = req.query;

      const records = await this.settlementService.getIpoAllocationRecords(requesterId, {
        status: status as string,
        branchId: branchId as string,
        search: search as string,
      });

      res.status(HttpStatus.OK).json(records);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve IPO Allocations';
      res.status(this.getErrorStatus(error)).json({ message });
    }
  };

  /**
   * Create an IPO Allocation
   */
  createIpoAllocationRecord = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const record = await this.settlementService.createIpoAllocationRecord(requesterId, req.body);

      // Audit Log
      logAudit(req, 'INSERT', 'settlement_ipo_allocation', record.id!, null, record);

      res.status(HttpStatus.CREATED).json(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create IPO Allocation';
      res.status(this.getErrorStatus(error)).json({ message });
    }
  };

  /**
   * Update an IPO Allocation
   */
  updateIpoAllocationRecord = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const id = req.params.id as string;

      // Get old record for audit logging
      const allRecords = await this.settlementService.getIpoAllocationRecords(requesterId, {});
      const oldRecord = allRecords.find(r => r.id === id);

      const record = await this.settlementService.updateIpoAllocationRecord(requesterId, id, req.body);

      // Audit Log
      logAudit(req, 'UPDATE', 'settlement_ipo_allocation', id, oldRecord || null, record);

      res.status(HttpStatus.OK).json(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update IPO Allocation';
      res.status(this.getErrorStatus(error)).json({ message });
    }
  };

  /* ═══════════════════════════════════════════════
     PART 4: CORPORATE ACTIONS CONTROLLER
     ═══════════════════════════════════════════════ */

  /**
   * Get Corporate Actions
   */
  getCorporateActionRecords = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { eligible, branchId, search } = req.query;

      const records = await this.settlementService.getCorporateActionRecords(requesterId, {
        eligible: eligible as string,
        branchId: branchId as string,
        search: search as string,
      });

      res.status(HttpStatus.OK).json(records);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve Corporate Actions';
      res.status(this.getErrorStatus(error)).json({ message });
    }
  };

  /**
   * Create a Corporate Action record
   */
  createCorporateActionRecord = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const record = await this.settlementService.createCorporateActionRecord(requesterId, req.body);

      // Audit Log
      logAudit(req, 'INSERT', 'settlement_corporate_actions', record.id!, null, record);

      res.status(HttpStatus.CREATED).json(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create Corporate Action record';
      res.status(this.getErrorStatus(error)).json({ message });
    }
  };

  /**
   * Update a Corporate Action record
   */
  updateCorporateActionRecord = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const id = req.params.id as string;

      // Get old record for audit logging
      const allRecords = await this.settlementService.getCorporateActionRecords(requesterId, {});
      const oldRecord = allRecords.find(r => r.id === id);

      const record = await this.settlementService.updateCorporateActionRecord(requesterId, id, req.body);

      // Audit Log
      logAudit(req, 'UPDATE', 'settlement_corporate_actions', id, oldRecord || null, record);

      res.status(HttpStatus.OK).json(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update Corporate Action record';
      res.status(this.getErrorStatus(error)).json({ message });
    }
  };
}
