import type { Request, Response } from 'express';
import { swGlobalService } from '../services/SWGlobalService.js';
import { logAudit } from '../utils/auditLogger.js';
import { HttpStatus } from '../utils/httpStatus.js';
import fs from 'fs';

const managementRoles = new Set(['hod', 'ceo', 'managing_director', 'director', 'executive', 'admin']);
const normalizeRole = (role: unknown) => String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
const canViewAllSWGlobalRecords = (user: any) => managementRoles.has(normalizeRole(user?.role));

export class SWGlobalController {
  async getAccountReport(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const canViewAll = canViewAllSWGlobalRecords(user);
      const ownEntriesOnly = !canViewAll;
      if (!canViewAll && !ownEntriesOnly && !user?.branch_id) {
        res.status(403).json({ error: 'A branch assignment is required to generate reports.' });
        return;
      }
      const from = req.query.from ? String(req.query.from) : undefined;
      const to = req.query.to ? String(req.query.to) : undefined;
      for (const date of [from, to]) {
        if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) {
          throw new Error('Enter a valid report date.');
        }
      }
      if (!!from !== !!to || (from && to && from > to)) throw new Error('Enter a valid start and end date.');
      const branchId = canViewAll ? (req.query.branchId ? String(req.query.branchId) : undefined) : (ownEntriesOnly ? undefined : user.branch_id);
      res.json(await swGlobalService.getAccountReport(from, to, branchId, ownEntriesOnly ? user.id : undefined));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  async getDashboardStats(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const canViewAll = canViewAllSWGlobalRecords(user);
      const ownEntriesOnly = !canViewAll;
      const branchId = canViewAll
        ? (req.query.branchId ? String(req.query.branchId) : undefined)
        : (ownEntriesOnly ? undefined : user?.branch_id);
      const stats = await swGlobalService.getDashboardStats(branchId, ownEntriesOnly ? user?.id : undefined);
      res.status(HttpStatus.OK).json(stats);
    } catch (err: any) {
      console.error('Error in getDashboardStats (SW Global):', err);
      res.status(HttpStatus.BAD_REQUEST).json({ error: err.message });
    }
  }

  async getAccounts(req: Request, res: Response): Promise<void> {
    try {
      const search = req.query.search ? String(req.query.search) : undefined;
      const status = req.query.status ? String(req.query.status) : undefined;
      const user = (req as any).user;
      const canViewAll = canViewAllSWGlobalRecords(user);
      const ownEntriesOnly = !canViewAll;
      const branchId = canViewAll
        ? (req.query.branchId ? String(req.query.branchId) : undefined)
        : (ownEntriesOnly ? undefined : user?.branch_id);
      const accounts = await swGlobalService.getAccounts(search, status, branchId, ownEntriesOnly ? user?.id : undefined);
      res.status(HttpStatus.OK).json(accounts);
    } catch (err: any) {
      console.error('Error in getAccounts (SW Global):', err);
      res.status(HttpStatus.BAD_REQUEST).json({ error: err.message });
    }
  }

  async saveAccount(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const canChooseBranch = canViewAllSWGlobalRecords(user);
      const branchId = canChooseBranch ? (req.body.branch_id || user?.branch_id) : user?.branch_id;
      if (!branchId && canChooseBranch) {
        res.status(HttpStatus.BAD_REQUEST).json({ error: 'Please select a branch for this account.' });
        return;
      }
      const saved = await swGlobalService.saveAccount(req.body, user?.id, branchId);

      await logAudit(
        req,
        req.body.id ? 'UPDATE' : 'INSERT',
        'sw_global_accounts',
        saved.id,
        null,
        saved
      );

      res.status(HttpStatus.OK).json(saved);
    } catch (err: any) {
      console.error('Error in saveAccount (SW Global):', err);
      res.status(HttpStatus.BAD_REQUEST).json({ error: err.message });
    }
  }

  async deleteAccount(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id || '');
      await swGlobalService.deleteAccount(id);

      await logAudit(
        req,
        'DELETE',
        'sw_global_accounts',
        id,
        { id },
        null
      );

      res.status(HttpStatus.OK).json({ success: true, message: 'Account deleted successfully.' });
    } catch (err: any) {
      console.error('Error in deleteAccount (SW Global):', err);
      res.status(HttpStatus.BAD_REQUEST).json({ error: err.message });
    }
  }

  async bulkImportAccounts(req: Request, res: Response): Promise<void> {
    try {
      const rows = Array.isArray(req.body.rows) ? req.body.rows : (Array.isArray(req.body) ? req.body : []);
      const user = (req as any).user;
      const canChooseBranch = canViewAllSWGlobalRecords(user);
      const result = await swGlobalService.bulkImportAccounts(rows, user?.id, canChooseBranch ? undefined : user?.branch_id, !canChooseBranch);

      await logAudit(
        req,
        'INSERT',
        'sw_global_accounts',
        undefined,
        null,
        { bulkCount: result.count }
      );

      res.status(HttpStatus.OK).json(result);
    } catch (err: any) {
      console.error('Error in bulkImportAccounts (SW Global):', err);
      res.status(HttpStatus.BAD_REQUEST).json({ error: err.message });
    }
  }

  async getEvents(req: Request, res: Response): Promise<void> {
    try {
      const search = req.query.search ? String(req.query.search) : undefined;
      const user = (req as any).user;
      const events = await swGlobalService.getEvents(search, canViewAllSWGlobalRecords(user) ? undefined : user?.id);
      res.status(HttpStatus.OK).json(events);
    } catch (err: any) {
      console.error('Error in getEvents (SW Global):', err);
      res.status(HttpStatus.BAD_REQUEST).json({ error: err.message });
    }
  }

  async saveEvent(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const saved = await swGlobalService.saveEvent(req.body, user?.id);

      await logAudit(
        req,
        req.body.id ? 'UPDATE' : 'INSERT',
        'sw_global_events',
        saved.id,
        null,
        saved
      );

      res.status(HttpStatus.OK).json(saved);
    } catch (err: any) {
      console.error('Error in saveEvent (SW Global):', err);
      res.status(HttpStatus.BAD_REQUEST).json({ error: err.message });
    }
  }

  async deleteEvent(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id || '');
      await swGlobalService.deleteEvent(id);

      await logAudit(
        req,
        'DELETE',
        'sw_global_events',
        id,
        { id },
        null
      );

      res.status(HttpStatus.OK).json({ success: true, message: 'Event deleted successfully.' });
    } catch (err: any) {
      console.error('Error in deleteEvent (SW Global):', err);
      res.status(HttpStatus.BAD_REQUEST).json({ error: err.message });
    }
  }

  async getLeads(req: Request, res: Response): Promise<void> {
    try {
      const eventId = req.query.eventId ? String(req.query.eventId) : undefined;
      const stage = req.query.stage ? String(req.query.stage) : undefined;
      const search = req.query.search ? String(req.query.search) : undefined;
      const user = (req as any).user;
      const leads = await swGlobalService.getLeads(eventId, stage, search, canViewAllSWGlobalRecords(user) ? undefined : user?.id);
      res.status(HttpStatus.OK).json(leads);
    } catch (err: any) {
      console.error('Error in getLeads (SW Global):', err);
      res.status(HttpStatus.BAD_REQUEST).json({ error: err.message });
    }
  }

  async saveLead(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const saved = await swGlobalService.saveLead(req.body, user?.id);

      await logAudit(
        req,
        req.body.id ? 'UPDATE' : 'INSERT',
        'sw_global_leads',
        saved.id,
        null,
        saved
      );

      res.status(HttpStatus.OK).json(saved);
    } catch (err: any) {
      console.error('Error in saveLead (SW Global):', err);
      res.status(HttpStatus.BAD_REQUEST).json({ error: err.message });
    }
  }

  async deleteLead(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id || '');
      await swGlobalService.deleteLead(id);

      await logAudit(
        req,
        'DELETE',
        'sw_global_leads',
        id,
        { id },
        null
      );

      res.status(HttpStatus.OK).json({ success: true, message: 'Lead deleted successfully.' });
    } catch (err: any) {
      console.error('Error in deleteLead (SW Global):', err);
      res.status(HttpStatus.BAD_REQUEST).json({ error: err.message });
    }
  }

  async convertLead(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const branchId = user?.branch_id;
      const result = await swGlobalService.convertLead(req.body, user?.id, branchId);

      await logAudit(
        req,
        'UPDATE',
        'sw_global_leads',
        result.leadId,
        null,
        { action: 'CONVERT_LEAD_TO_ACCOUNT', ...result }
      );

      res.status(HttpStatus.OK).json(result);
    } catch (err: any) {
      console.error('Error in convertLead (SW Global):', err);
      res.status(HttpStatus.BAD_REQUEST).json({ error: err.message });
    }
  }

  async bulkImportLeads(req: Request, res: Response): Promise<void> {
    try {
      const rows = Array.isArray(req.body.rows) ? req.body.rows : (Array.isArray(req.body) ? req.body : []);
      const user = (req as any).user;
      const result = await swGlobalService.bulkImportLeads(rows, user?.id);

      await logAudit(
        req,
        'INSERT',
        'sw_global_leads',
        undefined,
        null,
        { bulkCount: result.count }
      );

      res.status(HttpStatus.OK).json(result);
    } catch (err: any) {
      console.error('Error in bulkImportLeads (SW Global):', err);
      res.status(HttpStatus.BAD_REQUEST).json({ error: err.message });
    }
  }

  async getUploads(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const uploads = await swGlobalService.getUploads(canViewAllSWGlobalRecords(user) ? undefined : user?.id);
      res.status(HttpStatus.OK).json(uploads);
    } catch (err: any) {
      console.error('Error in getUploads (SW Global):', err);
      res.status(HttpStatus.BAD_REQUEST).json({ error: err.message });
    }
  }

  async uploadFile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(HttpStatus.BAD_REQUEST).json({ error: 'No file provided.' });
        return;
      }
      const user = (req as any).user;
      const kind = req.body.kind || 'Account documents';
      const upload = await swGlobalService.saveUpload(req.file, kind, user?.id);

      await logAudit(
        req,
        'INSERT',
        'sw_global_uploads',
        upload.id,
        null,
        upload
      );

      res.status(HttpStatus.OK).json(upload);
    } catch (err: any) {
      console.error('Error in uploadFile (SW Global):', err);
      res.status(HttpStatus.BAD_REQUEST).json({ error: err.message });
    }
  }

  async downloadFile(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id || '');
      const record = await swGlobalService.getUploadRecord(id);
      if (!record || !record.file_path || !fs.existsSync(record.file_path)) {
        res.status(HttpStatus.NOT_FOUND).json({ error: 'File not found on disk.' });
        return;
      }
      res.download(record.file_path, record.name);
    } catch (err: any) {
      console.error('Error in downloadFile (SW Global):', err);
      res.status(HttpStatus.BAD_REQUEST).json({ error: err.message });
    }
  }

  async deleteUpload(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id || '');
      await swGlobalService.deleteUpload(id);

      await logAudit(
        req,
        'DELETE',
        'sw_global_uploads',
        id,
        { id },
        null
      );

      res.status(HttpStatus.OK).json({ success: true, message: 'Upload record deleted.' });
    } catch (err: any) {
      console.error('Error in deleteUpload (SW Global):', err);
      res.status(HttpStatus.BAD_REQUEST).json({ error: err.message });
    }
  }
}

export const swGlobalController = new SWGlobalController();
