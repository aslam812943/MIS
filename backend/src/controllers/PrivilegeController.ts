import type { Request, Response } from 'express';
import { privilegeService } from '../services/PrivilegeService.js';
import { HttpStatus } from '../utils/httpStatus.js';
import { logAudit } from '../utils/auditLogger.js';
import fs from 'fs';

export class PrivilegeController {
  /**
   * GET /api/admin/privilege/dashboard
   */
  async getDashboardStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const branchId = req.query.branchId ? String(req.query.branchId) : undefined;
      const stats = await privilegeService.getDashboardStats(userId, branchId);
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
      const userId = (req as any).user?.id;
      const search = req.query.search ? String(req.query.search) : undefined;
      const branchId = req.query.branchId ? String(req.query.branchId) : undefined;
      const accounts = await privilegeService.getAccounts(userId, search, branchId);
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
      if ((req as any).user?.role === 'hod') {
        res.status(HttpStatus.FORBIDDEN).json({ error: 'HOD has view-only access. Accounts can only be created or modified by executives.' });
        return;
      }
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
      if ((req as any).user?.role === 'hod') {
        res.status(HttpStatus.FORBIDDEN).json({ error: 'HOD has view-only access. Bulk import is restricted to executives.' });
        return;
      }
      const userId = (req as any).user?.id;
      const branchId = (req as any).user?.branch_id;
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
      const userId = (req as any).user?.id;
      const files = await privilegeService.getUploads(userId);
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
      if ((req as any).user?.role === 'hod') {
        res.status(HttpStatus.FORBIDDEN).json({ error: 'HOD has view-only access. File uploads are restricted to executives.' });
        return;
      }
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
      const record = await privilegeService.getUploadRecord(id);

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
      if ((req as any).user?.role === 'hod') {
        res.status(HttpStatus.FORBIDDEN).json({ error: 'HOD has view-only access. Account deletion is restricted.' });
        return;
      }
      const code = String(req.params.code || '').trim();
      if (!code) {
        res.status(HttpStatus.BAD_REQUEST).json({ error: 'Account code is required.' });
        return;
      }

      await privilegeService.deleteAccount(code);

      // Audit Log
      logAudit(req, 'DELETE', 'privilege_accounts', code, { code }, null);

      res.status(HttpStatus.OK).json({ message: 'Account deleted successfully', code });
    } catch (error: any) {
      console.error('Error deleting privilege account:', error);
      res.status(HttpStatus.BAD_REQUEST).json({ error: error.message || 'Failed to delete account' });
    }
  }

  /**
   * DELETE /api/admin/privilege/uploads/:id
   */
  async deleteUpload(req: Request, res: Response): Promise<void> {
    try {
      if ((req as any).user?.role === 'hod') {
        res.status(HttpStatus.FORBIDDEN).json({ error: 'HOD has view-only access. Upload deletion is restricted.' });
        return;
      }
      const id = String(req.params.id || '').trim();
      if (!id) {
        res.status(HttpStatus.BAD_REQUEST).json({ error: 'Upload ID is required.' });
        return;
      }

      await privilegeService.deleteUpload(id);

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
