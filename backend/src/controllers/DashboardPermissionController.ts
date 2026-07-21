import { type Request, type Response } from 'express';
import { DashboardPermissionService } from '../services/DashboardPermissionService.js';
import { HttpStatus } from '../utils/httpStatus.js';
import { logAudit } from '../utils/auditLogger.js';

export class DashboardPermissionController {
  constructor(private permissionService: DashboardPermissionService) {}

  private respondError(res: Response, error: unknown, fallbackMessage: string): void {
    const rawMessage = error instanceof Error ? error.message : fallbackMessage;
    const status = rawMessage.includes('not found') ? HttpStatus.NOT_FOUND
      : rawMessage.includes('Invalid') || rawMessage.includes('Too many') ? HttpStatus.BAD_REQUEST
      : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error('[DashboardPermissionController]', rawMessage);
      res.status(status).json({ message: fallbackMessage });
      return;
    }
    res.status(status).json({ message: rawMessage });
  }

  getMyHiddenWidgets = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const result = await this.permissionService.getMyHiddenWidgets(userId);
      res.status(HttpStatus.OK).json(result);
    } catch (error) {
      this.respondError(res, error, 'Failed to load dashboard permissions.');
    }
  };

  getPositions = async (req: Request, res: Response): Promise<void> => {
    try {
      const positions = await this.permissionService.getPositions();
      res.status(HttpStatus.OK).json(positions);
    } catch (error) {
      this.respondError(res, error, 'Failed to load positions.');
    }
  };

  getPositionPermissions = async (req: Request, res: Response): Promise<void> => {
    try {
      const { role } = req.params;
      const departmentId = req.params.departmentId === 'none' ? null : (req.params.departmentId as string);
      const permissions = await this.permissionService.getPositionPermissions(role as string, departmentId);
      res.status(HttpStatus.OK).json(permissions);
    } catch (error) {
      this.respondError(res, error, 'Failed to load position permissions.');
    }
  };

  savePositionPermissions = async (req: Request, res: Response): Promise<void> => {
    try {
      const adminUserId = (req as any).user.id;
      const { role } = req.params;
      const departmentId = req.params.departmentId === 'none' ? null : (req.params.departmentId as string);
      const updates = req.body?.updates;

      if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
        res.status(HttpStatus.BAD_REQUEST).json({ message: 'Invalid request body.' });
        return;
      }

      await this.permissionService.savePositionPermissions(adminUserId, role as string, departmentId, updates);

      logAudit(req, 'UPDATE', 'dashboard_widget_permissions', `${role}::${departmentId ?? 'none'}`, null, updates);

      res.status(HttpStatus.OK).json({ message: 'Dashboard permissions saved.' });
    } catch (error) {
      this.respondError(res, error, 'Failed to save position permissions.');
    }
  };
}
