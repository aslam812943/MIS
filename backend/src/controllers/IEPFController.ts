import { type Request, type Response } from 'express';
import { IEPFService } from '../services/IEPFService.js';
import { HttpStatus } from '../utils/httpStatus.js';
import { logAudit } from '../utils/auditLogger.js';

export class IEPFController {
  constructor(private iepfService: IEPFService) {}

  /**
   * Helper to map error messages to appropriate HTTP Status Codes.
   */
  private getErrorStatus(error: any): number {
    if (error instanceof Error) {
      const msg = error.message;
      if (msg.includes('Unauthorized') || msg.includes('access denied') || msg.includes('Access denied')) {
        return 403; // Forbidden
      }
      if (
        msg.includes('Invalid') ||
        msg.includes('Required') ||
        msg.includes('Locked') ||
        msg.includes('negative') ||
        msg.includes('date') ||
        msg.includes('format') ||
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
      console.error('[IEPFController]', rawMessage);
      res.status(status).json({ message: fallbackMessage });
      return;
    }

    res.status(status).json({ message: rawMessage });
  }

  /**
   * Fetch all claims.
   */
  getClaims = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { status, branchId, search } = req.query;

      const claims = await this.iepfService.getClaims(requesterId, {
        status: status as string,
        branchId: branchId as string,
        search: search as string,
      });

      res.status(HttpStatus.OK).json(claims);
    } catch (error) {
      this.respondError(res, error, 'Failed to retrieve claims.');
    }
  };

  /**
   * Create a new claim.
   */
  createClaim = async (req: Request, res: Response): Promise<void> => {
    try {
      const creatorId = (req as any).user.id;
      const claim = await this.iepfService.createClaim(req.body, creatorId);

      // Audit Log
      logAudit(req, 'INSERT', 'iepf_claims', claim.id, null, claim);

      res.status(HttpStatus.CREATED).json(claim);
    } catch (error) {
      this.respondError(res, error, 'Failed to create claim.');
    }
  };

  /**
   * Update an existing claim.
   */
  updateClaim = async (req: Request, res: Response): Promise<void> => {
    try {
      const updaterId = (req as any).user.id;
      const id = req.params.id as string;

      // Get current version for audit logs
      const allClaims = await this.iepfService.getClaims(updaterId, {});
      const oldClaim = allClaims.find(c => c.id === id);

      const claim = await this.iepfService.updateClaim(id, req.body, updaterId);

      // Audit Log
      logAudit(req, 'UPDATE', 'iepf_claims', id, oldClaim || null, claim);

      res.status(HttpStatus.OK).json(claim);
    } catch (error) {
      this.respondError(res, error, 'Failed to update claim.');
    }
  };

  /**
   * Delete an existing claim.
   */
  deleteClaim = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const id = req.params.id as string;

      // Get current version for audit logs before it's gone
      const allClaims = await this.iepfService.getClaims(requesterId, {});
      const oldClaim = allClaims.find(c => c.id === id);

      await this.iepfService.deleteClaim(id, requesterId);

      logAudit(req, 'DELETE', 'iepf_claims', id, oldClaim || null, null);

      res.status(HttpStatus.NO_CONTENT).send();
    } catch (error) {
      this.respondError(res, error, 'Failed to delete claim.');
    }
  };

  /**
   * Get HOD dashboard data.
   */
  getDashboardData = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { branchId, startDate, endDate } = req.query;
      const dashboardData = await this.iepfService.getDashboardData(
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

  /**
   * Get active staff in IEPF department.
   */
  getIEPFStaff = async (req: Request, res: Response): Promise<void> => {
    try {
      const staff = await this.iepfService.getIEPFStaff();
      res.status(HttpStatus.OK).json(staff);
    } catch (error) {
      this.respondError(res, error, 'Failed to retrieve department staff.');
    }
  };

  /**
   * Fetch KYC-verified investors for the claim lookup dropdown.
   */
  getVerifiedInvestors = async (req: Request, res: Response): Promise<void> => {
    try {
      const investors = await this.iepfService.getVerifiedInvestors();
      res.status(HttpStatus.OK).json(investors);
    } catch (error) {
      this.respondError(res, error, 'Failed to retrieve verified investors.');
    }
  };
}
