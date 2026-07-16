import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { requireAdminOrHR } from '../middlewares/requireAdminOrHR.js';
import { HttpStatus } from '../utils/httpStatus.js';
import { OrgController } from '../controllers/OrgController.js';
import { OrgService } from '../services/OrgService.js';
import { 
  SupabaseBranchRepository, 
  SupabaseDepartmentRepository, 
  SupabaseModuleRepository 
} from '../repositories/SupabaseOrgRepository.js';
import { SupabaseUserRepository } from '../repositories/SupabaseUserRepository.js';
import { UserService } from '../services/UserService.js';
import { UserController } from '../controllers/UserController.js';
import { EmailService } from '../services/EmailService.js';
import { SupabaseDataEntryRepository } from '../repositories/SupabaseDataEntryRepository.js';
import { DataEntryService } from '../services/DataEntryService.js';
import { DataEntryController } from '../controllers/DataEntryController.js';
import { AuditController } from '../controllers/AuditController.js';
import { IEPFService } from '../services/IEPFService.js';
import { IEPFController } from '../controllers/IEPFController.js';
import { SettlementService } from '../services/SettlementService.js';
import { SettlementController } from '../controllers/SettlementController.js';
import { KYCService } from '../services/KYCService.js';
import { KYCController } from '../controllers/KYCController.js';
import { DPService } from '../services/DPService.js';
import { DPController } from '../controllers/DPController.js';
import { ITService } from '../services/ITService.js';
import { ITController } from '../controllers/ITController.js';
import { FinanceService } from '../services/FinanceService.js';
import { FinanceController } from '../controllers/FinanceController.js';
import { NotificationService } from '../services/NotificationService.js';
import { NotificationController } from '../controllers/NotificationController.js';
import multer from 'multer';

const router = Router();

// Dependency Injection for Organizational features
const branchRepository = new SupabaseBranchRepository();
const departmentRepository = new SupabaseDepartmentRepository();
const moduleRepository = new SupabaseModuleRepository();
const userRepository = new SupabaseUserRepository();

const orgService = new OrgService(branchRepository, departmentRepository, moduleRepository);
const orgController = new OrgController(orgService);

const emailService = new EmailService();
const userService = new UserService(userRepository, emailService);
const userController = new UserController(userService);

const dataEntryRepository = new SupabaseDataEntryRepository();
const dataEntryService = new DataEntryService(dataEntryRepository, userRepository);
const dataEntryController = new DataEntryController(dataEntryService);

const auditController = new AuditController();

const iepfService = new IEPFService();
const iepfController = new IEPFController(iepfService);

const settlementService = new SettlementService();
const settlementController = new SettlementController(settlementService);

const kycService = new KYCService();
const kycController = new KYCController(kycService);
const kycUpload = multer({ storage: multer.memoryStorage() });

const dpService = new DPService();
const dpController = new DPController(dpService);

const itService = new ITService();
const itController = new ITController(itService);
const financeService = new FinanceService();
const financeController = new FinanceController(financeService);

export const notificationService = new NotificationService(emailService);
const notificationController = new NotificationController(notificationService);

/**

 * Dashboard endpoints
 */
router.get('/dashboard-data', requireAuth, (req, res) => {
  res.status(HttpStatus.OK).json({
    message: 'Access granted to protected dashboard data!',
    data: {
      stats: { users: 10, reports: 42 },
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * Branch management endpoints
 */
router.get('/branches', requireAuth, orgController.getBranches);
router.post('/branches', requireAuth, requireAdmin, orgController.addBranch);
router.patch('/branches/:id', requireAuth, requireAdmin, orgController.updateBranch);
router.delete('/branches/:id', requireAuth, requireAdmin, orgController.deleteBranch);

/**
 * Department management endpoints
 */
router.get('/departments', requireAuth, orgController.getDepartments);
router.post('/departments', requireAuth, requireAdmin, orgController.addDepartment);
router.patch('/departments/:id', requireAuth, requireAdmin, orgController.updateDepartment);
router.delete('/departments/:id', requireAuth, requireAdmin, orgController.deleteDepartment);

/**
 * Module management endpoints
 */
router.get('/modules', requireAuth, orgController.getModules);
router.post('/modules', requireAuth, requireAdmin, orgController.addModule);
router.patch('/modules/:id', requireAuth, requireAdmin, orgController.updateModule);
router.delete('/modules/:id', requireAuth, requireAdmin, orgController.deleteModule);

/**
 * User management endpoints
 */
router.get('/users/hr-dashboard', requireAuth, requireAdminOrHR, userController.getHRDashboardData);
router.get('/users', requireAuth, requireAdminOrHR, userController.getUsers);
router.post('/users', requireAuth, requireAdminOrHR, userController.createUser);
router.patch('/users/:id', requireAuth, requireAdminOrHR, userController.updateUser);
router.patch('/users/:id/status', requireAuth, requireAdminOrHR, userController.updateStatus);
router.delete('/users/:id', requireAuth, requireAdmin, userController.deleteUser);

/**
 * Data entry endpoints
 */
router.get('/data-entries', requireAuth, dataEntryController.getEntry);
router.post('/data-entries', requireAuth, dataEntryController.saveEntry);
router.get('/department-entries', requireAuth, dataEntryController.getDepartmentEntries);
router.post('/data-entries/:id/verify', requireAuth, dataEntryController.verifyEntry);

/**
 * IEPF Department endpoints
 */
router.get('/iepf/claims', requireAuth, iepfController.getClaims);
router.post('/iepf/claims', requireAuth, iepfController.createClaim);
router.patch('/iepf/claims/:id', requireAuth, iepfController.updateClaim);
router.get('/iepf/dashboard', requireAuth, iepfController.getDashboardData);
router.get('/iepf/staff', requireAuth, iepfController.getIEPFStaff);
router.get('/iepf/investors', requireAuth, iepfController.getVerifiedInvestors);

/**
 * Settlements Department endpoints
 */
router.get('/settlements/payin-payout', requireAuth, settlementController.getPayInPayOutRecords);
router.post('/settlements/payin-payout', requireAuth, settlementController.createPayInPayOutRecord);
router.patch('/settlements/payin-payout/:id', requireAuth, settlementController.updatePayInPayOutRecord);
router.get('/settlements/client-requests', requireAuth, settlementController.getClientRequestRecords);
router.post('/settlements/client-requests', requireAuth, settlementController.createClientRequestRecord);
router.patch('/settlements/client-requests/:id', requireAuth, settlementController.updateClientRequestRecord);
router.get('/settlements/ipo-allocation', requireAuth, settlementController.getIpoAllocationRecords);
router.post('/settlements/ipo-allocation', requireAuth, settlementController.createIpoAllocationRecord);
router.patch('/settlements/ipo-allocation/:id', requireAuth, settlementController.updateIpoAllocationRecord);
router.get('/settlements/corporate-actions', requireAuth, settlementController.getCorporateActionRecords);
router.post('/settlements/corporate-actions', requireAuth, settlementController.createCorporateActionRecord);
router.patch('/settlements/corporate-actions/:id', requireAuth, settlementController.updateCorporateActionRecord);
router.get('/settlements/dashboard', requireAuth, settlementController.getDashboardStats);
router.get('/settlements/clients', requireAuth, settlementController.getVerifiedClients);

/**
 * KYC Department endpoints
 */
router.post('/kyc/upload', requireAuth, kycUpload.single('file'), kycController.uploadDocument);
router.get('/kyc/dashboard', requireAuth, kycController.getDashboardStats);
router.post('/kyc/bulk/:sheet', requireAuth, kycController.bulkImport);
router.patch('/kyc/bulk/:sheet', requireAuth, kycController.bulkUpdate);

router.get('/kyc/new-accounts', requireAuth, kycController.getNewAccounts);
router.post('/kyc/new-accounts', requireAuth, kycController.createNewAccount);
router.patch('/kyc/new-accounts/:id', requireAuth, kycController.updateNewAccount);

router.get('/kyc/ucc-allotments', requireAuth, kycController.getUCCAllotments);
router.post('/kyc/ucc-allotments', requireAuth, kycController.createUCCAllotment);
router.patch('/kyc/ucc-allotments/:id', requireAuth, kycController.updateUCCAllotment);

router.get('/kyc/registry-updates', requireAuth, kycController.getRegistryUpdates);
router.post('/kyc/registry-updates', requireAuth, kycController.createRegistryUpdate);
router.patch('/kyc/registry-updates/:id', requireAuth, kycController.updateRegistryUpdate);

router.get('/kyc/ap-sharings', requireAuth, kycController.getAPSharings);
router.post('/kyc/ap-sharings', requireAuth, kycController.createAPSharing);
router.patch('/kyc/ap-sharings/:id', requireAuth, kycController.updateAPSharing);

router.get('/kyc/demise-reports', requireAuth, kycController.getDemiseReports);
router.post('/kyc/demise-reports', requireAuth, kycController.createDemiseReport);
router.patch('/kyc/demise-reports/:id', requireAuth, kycController.updateDemiseReport);

router.get('/kyc/ap-codes', requireAuth, kycController.getAPCodes);
router.post('/kyc/ap-codes', requireAuth, kycController.createAPCode);
router.patch('/kyc/ap-codes/:id', requireAuth, kycController.updateAPCode);

router.get('/kyc/communications', requireAuth, kycController.getCommunications);
router.post('/kyc/communications', requireAuth, kycController.createCommunication);
router.patch('/kyc/communications/:id', requireAuth, kycController.updateCommunication);

router.get('/kyc/modifications', requireAuth, kycController.getModifications);
router.post('/kyc/modifications', requireAuth, kycController.createModification);
router.patch('/kyc/modifications/:id', requireAuth, kycController.updateModification);

router.get('/kyc/reactivations', requireAuth, kycController.getReactivations);
router.post('/kyc/reactivations', requireAuth, kycController.createReactivation);
router.patch('/kyc/reactivations/:id', requireAuth, kycController.updateReactivation);

router.get('/kyc/closures', requireAuth, kycController.getClosures);
router.post('/kyc/closures', requireAuth, kycController.createClosure);
router.patch('/kyc/closures/:id', requireAuth, kycController.updateClosure);

router.get('/kyc/compliance', requireAuth, kycController.getCompliances);
router.post('/kyc/compliance', requireAuth, kycController.createCompliance);
router.patch('/kyc/compliance/:id', requireAuth, kycController.updateCompliance);

/**
 * DP Department endpoints
 */
router.get('/dp/dashboard', requireAuth, dpController.getDashboardStats);
router.get('/dp/clients', requireAuth, dpController.getVerifiedClients);
router.get('/dp/bulk/:sheet', requireAuth, dpController.bulkImport);
router.patch('/dp/bulk/:sheet', requireAuth, dpController.bulkUpdate);
router.get('/dp/:sheet', requireAuth, dpController.getEntries);
router.post('/dp/:sheet', requireAuth, dpController.createEntry);
router.patch('/dp/:sheet/:id', requireAuth, dpController.updateEntry);
router.delete('/dp/:sheet/:id', requireAuth, dpController.deleteEntry);

/**
 * IT Department endpoints
 */
router.get('/it/dashboard', requireAuth, itController.getDashboardStats);
router.get('/it/dropdown/vendors', requireAuth, itController.getVendorsDropdown);
router.get('/it/dropdown/staff', requireAuth, itController.getITStaffDropdown);
router.post('/it/upload', requireAuth, kycUpload.single('file'), itController.uploadDocument);
router.post('/it/bulk/:sheet', requireAuth, itController.bulkImport);
router.patch('/it/bulk/:sheet', requireAuth, itController.bulkUpdate);
router.get('/it/:sheet', requireAuth, itController.getEntries);
router.post('/it/:sheet', requireAuth, itController.createEntry);
router.patch('/it/:sheet/:id', requireAuth, itController.updateEntry);
router.delete('/it/:sheet/:id', requireAuth, itController.deleteEntry);

/**
 * Finance Department endpoints
 */
router.get('/finance/dashboard', requireAuth, financeController.getDashboardStats);
router.post('/finance/bulk/:sheet', requireAuth, financeController.bulkImport);
router.patch('/finance/bulk/:sheet', requireAuth, financeController.bulkUpdate);
router.get('/finance/:sheet', requireAuth, financeController.getEntries);
router.post('/finance/:sheet', requireAuth, financeController.createEntry);
router.patch('/finance/:sheet/:id', requireAuth, financeController.updateEntry);
router.delete('/finance/:sheet/:id', requireAuth, financeController.deleteEntry);

/**
 * Audit Log endpoints
 */
router.get('/audit-logs', requireAuth, requireAdmin, auditController.getAuditLogs);

/**
 * Notification endpoints
 */
router.get('/notifications', requireAuth, notificationController.getMyNotifications);
router.get('/notifications/unread-count', requireAuth, notificationController.getUnreadCount);
router.patch('/notifications/:id/read', requireAuth, notificationController.markAsRead);
router.post('/notifications/mark-all-read', requireAuth, notificationController.markAllAsRead);
router.post('/notifications/run-check', requireAuth, requireAdmin, notificationController.runCheck);

export default router;
