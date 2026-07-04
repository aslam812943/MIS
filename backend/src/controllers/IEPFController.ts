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
        msg.includes('format')
      ) {
        return 400; // Bad Request
      }
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
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
      const message = error instanceof Error ? error.message : 'Failed to retrieve claims';
      res.status(this.getErrorStatus(error)).json({ message });
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
      const message = error instanceof Error ? error.message : 'Failed to create claim';
      res.status(this.getErrorStatus(error)).json({ message });
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
      const message = error instanceof Error ? error.message : 'Failed to update claim';
      res.status(this.getErrorStatus(error)).json({ message });
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
      const message = error instanceof Error ? error.message : 'Failed to retrieve dashboard metrics';
      res.status(this.getErrorStatus(error)).json({ message });
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
      const message = error instanceof Error ? error.message : 'Failed to retrieve department staff';
      res.status(this.getErrorStatus(error)).json({ message });
    }
  };
}
