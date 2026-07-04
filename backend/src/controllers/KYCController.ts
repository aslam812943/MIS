import { type Request, type Response } from 'express';
import { KYCService } from '../services/KYCService.js';
import { HttpStatus } from '../utils/httpStatus.js';
import { logAudit } from '../utils/auditLogger.js';

export class KYCController {
  constructor(private kycService: KYCService) {}

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
        msg.includes('percentage')
      ) {
        return HttpStatus.BAD_REQUEST;
      }
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  /**
   * Upload supporting files
   */
  uploadDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(HttpStatus.BAD_REQUEST).json({ message: 'No file uploaded.' });
        return;
      }

      // Backend security check: limit file size to 5MB
      if (req.file.size > 5 * 1024 * 1024) {
        res.status(HttpStatus.BAD_REQUEST).json({ message: 'File size exceeds maximum limit of 5MB.' });
        return;
      }

      // Backend security check: only allow safe document formats (PDF, PNG, JPEG)
      const allowedMimes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      const allowedExts = ['pdf', 'png', 'jpg', 'jpeg'];
      const fileExt = (req.file.originalname.split('.').pop() || '').toLowerCase();

      if (!allowedMimes.includes(req.file.mimetype) || !allowedExts.includes(fileExt)) {
        res.status(HttpStatus.BAD_REQUEST).json({ message: 'Unsupported file format. Only PDF, PNG, and JPEG are allowed.' });
        return;
      }

      const fileUrl = await this.kycService.uploadDocument(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      res.status(HttpStatus.OK).json({ fileUrl });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload document';
      res.status(this.getErrorStatus(error)).json({ message });
    }
  };

  /**
   * Get dashboard stats
   */
  getDashboardStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { branchId, startDate, endDate } = req.query;

      const stats = await this.kycService.getDashboardStats(
        requesterId,
        branchId as string,
        startDate as string,
        endDate as string
      );
      res.status(HttpStatus.OK).json(stats);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve stats';
      res.status(this.getErrorStatus(error)).json({ message });
    }
  };

  // ═══════════════════════════════════════════════
  // 1. NEW ACCOUNT OPENING VERIFICATION
  // ═══════════════════════════════════════════════

  getNewAccounts = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { status, branchId, search } = req.query;
      const data = await this.kycService.getNewAccounts(requesterId, {
        status: status as string,
        branchId: branchId as string,
        search: search as string
      });
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error retrieving records' });
    }
  };

  createNewAccount = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const record = await this.kycService.createNewAccount(requesterId, req.body);
      logAudit(req, 'INSERT', 'kyc_new_account', record.id, null, record);
      res.status(HttpStatus.CREATED).json(record);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error creating record' });
    }
  };

  updateNewAccount = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const id = req.params.id as string;
      const record = await this.kycService.updateNewAccount(requesterId, id, req.body);
      logAudit(req, 'UPDATE', 'kyc_new_account', id, null, record);
      res.status(HttpStatus.OK).json(record);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error updating record' });
    }
  };

  // ═══════════════════════════════════════════════
  // 2. UCC ALLOTMENT (NSE/BSE)
  // ═══════════════════════════════════════════════

  getUCCAllotments = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { status, branchId, search } = req.query;
      const data = await this.kycService.getUCCAllotments(requesterId, {
        status: status as string,
        branchId: branchId as string,
        search: search as string
      });
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  createUCCAllotment = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const record = await this.kycService.createUCCAllotment(requesterId, req.body);
      logAudit(req, 'INSERT', 'kyc_ucc_allotment', record.id, null, record);
      res.status(HttpStatus.CREATED).json(record);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  updateUCCAllotment = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const id = req.params.id as string;
      const record = await this.kycService.updateUCCAllotment(requesterId, id, req.body);
      logAudit(req, 'UPDATE', 'kyc_ucc_allotment', id, null, record);
      res.status(HttpStatus.OK).json(record);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  // ═══════════════════════════════════════════════
  // 3. CKYC / KRA UPDATION
  // ═══════════════════════════════════════════════

  getRegistryUpdates = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { status, branchId, search } = req.query;
      const data = await this.kycService.getRegistryUpdates(requesterId, {
        status: status as string,
        branchId: branchId as string,
        search: search as string
      });
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  createRegistryUpdate = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const record = await this.kycService.createRegistryUpdate(requesterId, req.body);
      logAudit(req, 'INSERT', 'kyc_registry_updation', record.id, null, record);
      res.status(HttpStatus.CREATED).json(record);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  updateRegistryUpdate = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const id = req.params.id as string;
      const record = await this.kycService.updateRegistryUpdate(requesterId, id, req.body);
      logAudit(req, 'UPDATE', 'kyc_registry_updation', id, null, record);
      res.status(HttpStatus.OK).json(record);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  // ═══════════════════════════════════════════════
  // 4. AP / REMISIER SHARING UPDATION
  // ═══════════════════════════════════════════════

  getAPSharings = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { status, branchId, search } = req.query;
      const data = await this.kycService.getAPSharings(requesterId, {
        status: status as string,
        branchId: branchId as string,
        search: search as string
      });
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  createAPSharing = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const record = await this.kycService.createAPSharing(requesterId, req.body);
      logAudit(req, 'INSERT', 'kyc_ap_sharing', record.id, null, record);
      res.status(HttpStatus.CREATED).json(record);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  updateAPSharing = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const id = req.params.id as string;
      const record = await this.kycService.updateAPSharing(requesterId, id, req.body);
      logAudit(req, 'UPDATE', 'kyc_ap_sharing', id, null, record);
      res.status(HttpStatus.OK).json(record);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  // ═══════════════════════════════════════════════
  // 5. DEMISE REPORTING
  // ═══════════════════════════════════════════════

  getDemiseReports = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { status, branchId, search } = req.query;
      const data = await this.kycService.getDemiseReports(requesterId, {
        status: status as string,
        branchId: branchId as string,
        search: search as string
      });
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  createDemiseReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const record = await this.kycService.createDemiseReport(requesterId, req.body);
      logAudit(req, 'INSERT', 'kyc_demise_reporting', record.id, null, record);
      res.status(HttpStatus.CREATED).json(record);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  updateDemiseReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const id = req.params.id as string;
      const record = await this.kycService.updateDemiseReport(requesterId, id, req.body);
      logAudit(req, 'UPDATE', 'kyc_demise_reporting', id, null, record);
      res.status(HttpStatus.OK).json(record);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  // ═══════════════════════════════════════════════
  // 6. AP CODE UPDATION TO EXCHANGE
  // ═══════════════════════════════════════════════

  getAPCodes = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { status, branchId, search } = req.query;
      const data = await this.kycService.getAPCodes(requesterId, {
        status: status as string,
        branchId: branchId as string,
        search: search as string
      });
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  createAPCode = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const record = await this.kycService.createAPCode(requesterId, req.body);
      logAudit(req, 'INSERT', 'kyc_ap_code_exchange', record.id, null, record);
      res.status(HttpStatus.CREATED).json(record);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  updateAPCode = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const id = req.params.id as string;
      const record = await this.kycService.updateAPCode(requesterId, id, req.body);
      logAudit(req, 'UPDATE', 'kyc_ap_code_exchange', id, null, record);
      res.status(HttpStatus.OK).json(record);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  // ═══════════════════════════════════════════════
  // 7. CLIENT ONBOARDING COMMUNICATION
  // ═══════════════════════════════════════════════

  getCommunications = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { status, branchId, search } = req.query;
      const data = await this.kycService.getCommunications(requesterId, {
        status: status as string,
        branchId: branchId as string,
        search: search as string
      });
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  createCommunication = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const record = await this.kycService.createCommunication(requesterId, req.body);
      logAudit(req, 'INSERT', 'kyc_onboarding_communication', record.id, null, record);
      res.status(HttpStatus.CREATED).json(record);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  updateCommunication = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const id = req.params.id as string;
      const record = await this.kycService.updateCommunication(requesterId, id, req.body);
      logAudit(req, 'UPDATE', 'kyc_onboarding_communication', id, null, record);
      res.status(HttpStatus.OK).json(record);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  // ═══════════════════════════════════════════════
  // 8. MODIFICATION REQUESTS
  // ═══════════════════════════════════════════════

  getModifications = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { status, branchId, search } = req.query;
      const data = await this.kycService.getModifications(requesterId, {
        status: status as string,
        branchId: branchId as string,
        search: search as string
      });
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  createModification = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const record = await this.kycService.createModification(requesterId, req.body);
      logAudit(req, 'INSERT', 'kyc_modification_requests', record.id, null, record);
      res.status(HttpStatus.CREATED).json(record);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  updateModification = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const id = req.params.id as string;
      const record = await this.kycService.updateModification(requesterId, id, req.body);
      logAudit(req, 'UPDATE', 'kyc_modification_requests', id, null, record);
      res.status(HttpStatus.OK).json(record);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  // ═══════════════════════════════════════════════
  // 9. REACTIVATION
  // ═══════════════════════════════════════════════

  getReactivations = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { status, branchId, search } = req.query;
      const data = await this.kycService.getReactivations(requesterId, {
        status: status as string,
        branchId: branchId as string,
        search: search as string
      });
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  createReactivation = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const record = await this.kycService.createReactivation(requesterId, req.body);
      logAudit(req, 'INSERT', 'kyc_reactivation_requests', record.id, null, record);
      res.status(HttpStatus.CREATED).json(record);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  updateReactivation = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const id = req.params.id as string;
      const record = await this.kycService.updateReactivation(requesterId, id, req.body);
      logAudit(req, 'UPDATE', 'kyc_reactivation_requests', id, null, record);
      res.status(HttpStatus.OK).json(record);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  // ═══════════════════════════════════════════════
  // 10. ACCOUNT CLOSURE / UCC CLOSURE
  // ═══════════════════════════════════════════════

  getClosures = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { status, branchId, search } = req.query;
      const data = await this.kycService.getClosures(requesterId, {
        status: status as string,
        branchId: branchId as string,
        search: search as string
      });
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  createClosure = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const record = await this.kycService.createClosure(requesterId, req.body);
      logAudit(req, 'INSERT', 'kyc_account_closure', record.id, null, record);
      res.status(HttpStatus.CREATED).json(record);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  updateClosure = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const id = req.params.id as string;
      const record = await this.kycService.updateClosure(requesterId, id, req.body);
      logAudit(req, 'UPDATE', 'kyc_account_closure', id, null, record);
      res.status(HttpStatus.OK).json(record);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  // ═══════════════════════════════════════════════
  // 11. EXCHANGE COMPLIANCE STATUS
  // ═══════════════════════════════════════════════

  getCompliances = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const { status, branchId, search } = req.query;
      const data = await this.kycService.getCompliances(requesterId, {
        status: status as string,
        branchId: branchId as string,
        search: search as string
      });
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  createCompliance = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const record = await this.kycService.createCompliance(requesterId, req.body);
      logAudit(req, 'INSERT', 'kyc_exchange_compliance', record.id, null, record);
      res.status(HttpStatus.CREATED).json(record);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  updateCompliance = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const id = req.params.id as string;
      const record = await this.kycService.updateCompliance(requesterId, id, req.body);
      logAudit(req, 'UPDATE', 'kyc_exchange_compliance', id, null, record);
      res.status(HttpStatus.OK).json(record);
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error' });
    }
  };

  bulkImport = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const sheet = req.params.sheet as string;
      const { records } = req.body;

      const data = await this.kycService.bulkImport(requesterId, sheet, records);

      const tableNameMap: { [key: string]: string } = {
        'new-accounts': 'kyc_new_account',
        'ucc-allotments': 'kyc_ucc_allotment',
        'registry-updates': 'kyc_registry_updation',
        'ap-sharings': 'kyc_ap_sharing',
        'demise-reports': 'kyc_demise_reporting',
        'ap-codes': 'kyc_ap_code_exchange',
        'communications': 'kyc_onboarding_communication',
        'modifications': 'kyc_modification_requests',
        'reactivations': 'kyc_reactivation_requests',
        'closures': 'kyc_account_closure',
        'compliance': 'kyc_exchange_compliance',
      };

      const table = tableNameMap[sheet] || 'kyc_bulk_import';
      logAudit(req, 'INSERT', table, undefined, undefined, { imported_rows: records.length });

      res.status(HttpStatus.CREATED).json({ message: `Successfully imported ${records.length} records.`, count: records.length, data });
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error during bulk import' });
    }
  };

  bulkUpdate = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const sheet = req.params.sheet as string;
      const { ids, updates } = req.body;

      const data = await this.kycService.bulkUpdate(requesterId, sheet, ids, updates);

      const tableNameMap: { [key: string]: string } = {
        'new-accounts': 'kyc_new_account',
        'ucc-allotments': 'kyc_ucc_allotment',
        'registry-updates': 'kyc_registry_updation',
        'ap-sharings': 'kyc_ap_sharing',
        'demise-reports': 'kyc_demise_reporting',
        'ap-codes': 'kyc_ap_code_exchange',
        'communications': 'kyc_onboarding_communication',
        'modifications': 'kyc_modification_requests',
        'reactivations': 'kyc_reactivation_requests',
        'closures': 'kyc_account_closure',
        'compliance': 'kyc_exchange_compliance',
      };

      const table = tableNameMap[sheet] || 'kyc_bulk_update';
      logAudit(req, 'UPDATE', table, undefined, undefined, { updated_rows: ids.length, updates });

      res.status(HttpStatus.OK).json({ message: `Successfully updated ${ids.length} records.`, count: ids.length, data });
    } catch (error) {
      res.status(this.getErrorStatus(error)).json({ message: error instanceof Error ? error.message : 'Error during bulk update' });
    }
  };
}
