import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { HttpStatus } from '../utils/httpStatus.js';
import { OrgController } from '../controllers/OrgController.js';
import { OrgService } from '../services/OrgService.js';
import { 
  SupabaseBranchRepository, 
  SupabaseDepartmentRepository, 
  SupabaseModuleRepository 
} from '../repositories/SupabaseOrgRepository.js';

const router = Router();

// Dependency Injection for Organizational features
const branchRepository = new SupabaseBranchRepository();
const departmentRepository = new SupabaseDepartmentRepository();
const moduleRepository = new SupabaseModuleRepository();
const orgService = new OrgService(branchRepository, departmentRepository, moduleRepository);
const orgController = new OrgController(orgService);

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
router.post('/branches', requireAuth, orgController.addBranch);
router.patch('/branches/:id', requireAuth, orgController.updateBranch);
router.delete('/branches/:id', requireAuth, orgController.deleteBranch);

/**
 * Department management endpoints
 */
router.get('/departments', requireAuth, orgController.getDepartments);
router.post('/departments', requireAuth, orgController.addDepartment);
router.patch('/departments/:id', requireAuth, orgController.updateDepartment);
router.delete('/departments/:id', requireAuth, orgController.deleteDepartment);

/**
 * Module management endpoints
 */
router.get('/modules', requireAuth, orgController.getModules);
router.post('/modules', requireAuth, orgController.addModule);
router.patch('/modules/:id', requireAuth, orgController.updateModule);
router.delete('/modules/:id', requireAuth, orgController.deleteModule);

export default router;
