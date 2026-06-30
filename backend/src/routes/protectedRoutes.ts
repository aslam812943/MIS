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

/**
 * Audit Log endpoints
 */
router.get('/audit-logs', requireAuth, requireAdmin, auditController.getAuditLogs);

export default router;
