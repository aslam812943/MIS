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
        msg.includes('must be an integer') ||
        msg.includes('not found')
      ) {
        return 400; // Bad Request
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
      console.error('[SettlementController]', rawMessage);
      res.status(status).json({ message: fallbackMessage });
      return;
    }

    res.status(status).json({ message: rawMessage });
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
      const { branchId, startDate, endDate } = req.query;

      const stats = await this.settlementService.getDashboardStats(
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
      this.respondError(res, error, 'Failed to retrieve records.');
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
      this.respondError(res, error, 'Failed to create record.');
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
      this.respondError(res, error, 'Failed to update record.');
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
      this.respondError(res, error, 'Failed to retrieve Client Requests.');
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
      this.respondError(res, error, 'Failed to create Client Request.');
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
      this.respondError(res, error, 'Failed to update Client Request.');
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
      this.respondError(res, error, 'Failed to retrieve IPO Allocations.');
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
      this.respondError(res, error, 'Failed to create IPO Allocation.');
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
      this.respondError(res, error, 'Failed to update IPO Allocation.');
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
      this.respondError(res, error, 'Failed to retrieve Corporate Actions.');
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
      this.respondError(res, error, 'Failed to create Corporate Action record.');
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
      this.respondError(res, error, 'Failed to update Corporate Action record.');
    }
  };

  private static AUDIT_TABLE_MAPPING: { [key: string]: string } = {
    'payin-payout': 'settlement_payin_payout',
    'client-requests': 'settlement_client_requests',
    'ipo-allocation': 'settlement_ipo_allocation',
    'corporate-actions': 'settlement_corporate_actions',
  };

  deleteEntry = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { sheet, id } = req.params;

      await this.settlementService.deleteEntry(requesterId, sheet as string, id as string);

      logAudit(req, 'DELETE', SettlementController.AUDIT_TABLE_MAPPING[sheet as string] || 'settlement_unknown', id as string, null, null);

      res.status(HttpStatus.NO_CONTENT).send();
    } catch (error) {
      this.respondError(res, error, 'Failed to delete entry.');
    }
  };

  /**
   * Fetch KYC-verified clients for the entry-form lookup dropdown.
   */
  getVerifiedClients = async (req: Request, res: Response): Promise<void> => {
    try {
      const clients = await this.settlementService.getVerifiedClients();
      res.status(HttpStatus.OK).json(clients);
    } catch (error) {
      this.respondError(res, error, 'Failed to retrieve verified clients.');
    }
  };
}
