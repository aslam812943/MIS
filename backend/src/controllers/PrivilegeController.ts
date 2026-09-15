import type { Request, Response } from 'express';
import { privilegeService } from '../services/PrivilegeService.js';
import { HttpStatus } from '../utils/httpStatus.js';
import { logAudit } from '../utils/auditLogger.js';
import fs from 'fs';

const privilegeManagementRoles = new Set(['hod', 'ceo', 'admin']);
const normalizeRole = (role: unknown) => String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
const canViewAllPrivilegeRecords = (user: any) => privilegeManagementRoles.has(normalizeRole(user?.role));

export class PrivilegeController {
  async getFormOptions(req: Request, res: Response): Promise<void> {
    try {
      res.status(HttpStatus.OK).json(await privilegeService.getFormOptions());
    } catch (error: any) {
      console.error('Error fetching privilege form options:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: error.message || 'Unable to load form suggestions.' });
    }
  }

  /**
   * GET /api/admin/privilege/dashboard
   */
  async getDashboardStats(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const canViewAllBranches = canViewAllPrivilegeRecords(user);
      const ownerId = canViewAllBranches ? undefined : user?.id;
      const branchId = canViewAllBranches
        ? (req.query.branchId ? String(req.query.branchId) : undefined)
        : user?.branch_id;
      const stats = await privilegeService.getDashboardStats(ownerId, branchId);
      res.status(HttpStatus.OK).json(stats);
    } catch (error: any) {
      console.error('Error fetching privilege dashboard stats:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: error.message || 'Failed to fetch dashboard stats' });
    }
  }

  /**
   * GET /api/admin/privilege/accounts
   */
  async getAccounts(req: Request, res: Response): Promise<void> {
    try {
      const search = req.query.search ? String(req.query.search) : undefined;
      const user = (req as any).user;
      const canViewAllBranches = canViewAllPrivilegeRecords(user);
      const ownerId = canViewAllBranches ? undefined : user?.id;
      const branchId = canViewAllBranches
        ? (req.query.branchId ? String(req.query.branchId) : undefined)
        : user?.branch_id;
      const accounts = await privilegeService.getAccounts(ownerId, search, branchId);
      res.status(HttpStatus.OK).json(accounts);
    } catch (error: any) {
      console.error('Error fetching privilege accounts:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: error.message || 'Failed to fetch accounts' });
    }
  }

  /**
   * POST /api/admin/privilege/accounts
   */
  async saveAccount(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const branchId = (req as any).user?.branch_id;
      const account = await privilegeService.saveAccount(req.body, userId, branchId);

      // Audit Log
      logAudit(req, 'INSERT', 'privilege_accounts', account.code, null, account);

      res.status(HttpStatus.OK).json({
        message: 'Account saved successfully',
        account
      });
    } catch (error: any) {
      console.error('Error saving privilege account:', error);
      res.status(HttpStatus.BAD_REQUEST).json({ error: error.message || 'Failed to save account' });
    }
  }

  /**
   * POST /api/admin/privilege/accounts/bulk
   */
  async bulkImport(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const userId = user?.id;
      // Management imports may assign each row from its CSV branch column.
      // Other users remain locked to their assigned branch.
      const branchId = canViewAllPrivilegeRecords(user) ? undefined : user?.branch_id;
      const rows = Array.isArray(req.body) ? req.body : req.body.accounts;
      const result = await privilegeService.bulkImportAccounts(rows, userId, branchId);

      // Audit Log
      logAudit(req, 'INSERT', 'privilege_accounts', 'bulk-import', null, { count: result.count });

      res.status(HttpStatus.OK).json({
        message: `Successfully imported ${result.count} accounts`,
        saved: result.count
      });
    } catch (error: any) {
      console.error('Error bulk importing privilege accounts:', error);
      res.status(HttpStatus.BAD_REQUEST).json({ error: error.message || 'Failed to bulk import accounts' });
    }
  }

  /**
   * GET /api/admin/privilege/uploads
   */
  async getUploads(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const files = await privilegeService.getUploads(canViewAllPrivilegeRecords(user) ? undefined : user?.id);
      res.status(HttpStatus.OK).json(files);
    } catch (error: any) {
      console.error('Error fetching privilege uploads:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: error.message || 'Failed to fetch uploads' });
    }
  }

  /**
   * POST /api/admin/privilege/uploads
   */
  async uploadFile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const file = req.file;
      const kind = String(req.body.kind || 'Account documents');

      if (!file) {
        res.status(HttpStatus.BAD_REQUEST).json({ error: 'No file uploaded' });
        return;
      }

      const uploaded = await privilegeService.saveUpload(file, kind, userId);

      // Audit Log
      logAudit(req, 'INSERT', 'privilege_uploads', uploaded.id, null, uploaded);

      res.status(HttpStatus.OK).json({
        message: 'File uploaded successfully',
        saved: true,
        file: uploaded
      });
    } catch (error: any) {
      console.error('Error uploading privilege file:', error);
      res.status(HttpStatus.BAD_REQUEST).json({ error: error.message || 'Failed to upload file' });
    }
  }

  /**
   * GET /api/admin/privilege/uploads/:id/download
   */
  async downloadFile(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id || '');
      const user = (req as any).user;
      const record = await privilegeService.getUploadRecord(id, canViewAllPrivilegeRecords(user) ? undefined : user?.id);

      if (!record || !record.file_path || !fs.existsSync(record.file_path)) {
        res.status(HttpStatus.NOT_FOUND).json({ error: 'File not found' });
        return;
      }

      res.setHeader('Content-Type', record.mime_type || 'application/octet-stream');
      const disposition = req.query.inline === 'true' ? 'inline' : 'attachment';
      res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(record.name)}`);
      res.setHeader('X-Content-Type-Options', 'nosniff');

      const stream = fs.createReadStream(record.file_path);
      stream.pipe(res);
    } catch (error: any) {
      console.error('Error downloading privilege file:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Failed to download file' });
    }
  }
  /**
   * DELETE /api/admin/privilege/accounts/:code
   */
  async deleteAccount(req: Request, res: Response): Promise<void> {
    try {
      const code = String(req.params.code || '').trim();
      if (!code) {
        res.status(HttpStatus.BAD_REQUEST).json({ error: 'Account code is required.' });
        return;
      }

      const user = (req as any).user;
      await privilegeService.deleteAccount(code, canViewAllPrivilegeRecords(user) ? undefined : user?.id);

      // Audit Log
      logAudit(req, 'DELETE', 'privilege_accounts', code, { code }, null);

      res.status(HttpStatus.OK).json({ message: 'Account deleted successfully', code });
    } catch (error: any) {
      console.error('Error deleting privilege account:', error);
      res.status(HttpStatus.BAD_REQUEST).json({ error: error.message || 'Failed to delete account' });
    }
  }

  async bulkDeleteAccounts(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const codes = Array.isArray(req.body?.codes) ? req.body.codes : [];
      const count = await privilegeService.bulkDeleteAccounts(codes, canViewAllPrivilegeRecords(user) ? undefined : user?.id);
      logAudit(req, 'DELETE', 'privilege_accounts', 'bulk-delete', { codes }, { count });
      res.status(HttpStatus.OK).json({ message: `${count} accounts deleted successfully`, count });
    } catch (error: any) {
      res.status(HttpStatus.BAD_REQUEST).json({ error: error.message || 'Failed to delete selected accounts' });
    }
  }

  async bulkUpdateAccounts(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const codes = Array.isArray(req.body?.codes) ? req.body.codes : [];
      if (typeof req.body?.trading_started !== 'boolean') {
        res.status(HttpStatus.BAD_REQUEST).json({ error: 'Choose a valid trading status.' });
        return;
      }
      const count = await privilegeService.bulkUpdateTradingStatus(codes, req.body.trading_started, canViewAllPrivilegeRecords(user) ? undefined : user?.id);
      logAudit(req, 'UPDATE', 'privilege_accounts', 'bulk-update', null, { codes, trading_started: req.body.trading_started, count });
      res.status(HttpStatus.OK).json({ message: `${count} accounts updated successfully`, count });
    } catch (error: any) {
      res.status(HttpStatus.BAD_REQUEST).json({ error: error.message || 'Failed to update selected accounts' });
    }
  }

  /**
   * DELETE /api/admin/privilege/uploads/:id
   */
  async deleteUpload(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        res.status(HttpStatus.BAD_REQUEST).json({ error: 'Upload ID is required.' });
        return;
      }

      const user = (req as any).user;
      await privilegeService.deleteUpload(id, canViewAllPrivilegeRecords(user) ? undefined : user?.id);

      // Audit Log
      logAudit(req, 'DELETE', 'privilege_uploads', id, { id }, null);

      res.status(HttpStatus.OK).json({ message: 'Upload deleted successfully', id });
    } catch (error: any) {
      console.error('Error deleting privilege upload:', error);
      res.status(HttpStatus.BAD_REQUEST).json({ error: error.message || 'Failed to delete upload' });
    }
  }
}

export const privilegeController = new PrivilegeController();
