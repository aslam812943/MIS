import { Router, type Request, type Response } from 'express';
import { FranchiseService, FranchiseError, type FranchiseAccess } from '../services/FranchiseService.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { logAudit } from '../utils/auditLogger.js';

const router = Router();
const service = new FranchiseService();
router.use(requireAuth);
type Operation = (a: FranchiseAccess, req: Request) => Promise<any>;
function handle(operation: Operation, table?: string | ((req: Request) => string)) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const a = await service.access((req as any).user.id,(req as any).user.role);
      const tableName = typeof table === 'function' ? table(req) : table;
      const update = req.method === 'PATCH' || req.method === 'DELETE' || req.path.endsWith('/decide');
      const old = tableName && update && req.params.id ? await service.auditRecord(a, tableName, String(req.params.id)) : null;
      const data = await operation(a, req);
      if (tableName) await logAudit(req, req.method === 'DELETE' ? 'DELETE' : update ? 'UPDATE' : 'INSERT', tableName, data?.id, old, data);
      res.status(req.method === 'POST' && !req.path.endsWith('/decide') ? 201 : 200).json(data);
    } catch (error) {
      if (!(error instanceof FranchiseError)) console.error('[Franchise request]', error);
      res.status(error instanceof FranchiseError ? error.status : 500).json({ message: error instanceof FranchiseError ? error.message : 'Could not complete the franchise request.' });
    }
  };
}
const param = (req: Request, key: string) => String(req.params[key] || '');
router.get('/bootstrap', handle(a => service.bootstrap(a)));
router.get('/dashboard', handle((a, req) => service.dashboard(a, req.query)));
router.post('/franchises', handle((a, req) => service.register(a, req.body), 'franchises'));
router.post('/franchises/import', handle((a,req)=>service.bulkRegister(a,req.body)));
router.post('/franchises/:id/send-credentials',handle((a,req)=>service.resendCredentials(a,param(req,'id')),'franchises'));
router.patch('/franchises/:id', handle((a, req) => service.updateFranchise(a, param(req, 'id'), req.body), 'franchises'));
router.post('/plans', handle((a, req) => service.configure(a, 'plans', req.body), 'franchise_plans'));
router.post('/rules', handle((a, req) => service.configure(a, 'rules', req.body), 'franchise_commission_rules'));
router.post('/plan-assignments', handle((a, req) => service.configure(a, 'plan-assignments', req.body), 'franchise_plan_assignments'));
router.patch('/catalog/:kind/:id', handle((a, req) => service.toggleCatalog(a, param(req, 'kind'), param(req, 'id'), req.body), req => req.params.kind === 'plans' ? 'franchise_plans' : 'franchise_products'));
router.post('/memberships', handle((a, req) => service.membership(a, req.body), req => req.body.membership_role === 'manager' ? 'franchise_manager_assignments' : 'franchise_users'));
router.patch('/memberships/:id', handle((a, req) => service.updateMembership(a, param(req, 'id'), req.body), 'franchise_users'));
router.patch('/managers/:id', handle((a, req) => service.updateManager(a, param(req, 'id'), req.body), 'franchise_manager_assignments'));
router.post('/logins', handle((a, req) => service.createLogin(a, req.body), 'franchise_users'));
router.delete('/records/sales/:id', handle((a, req) => service.removeSale(a, param(req, 'id')), 'sales'));
router.get('/records/:kind', handle((a, req) => service.records(a, param(req, 'kind'), typeof req.query.franchiseId === 'string' ? req.query.franchiseId : undefined)));
const recordTable = (req: Request) => req.params.kind === 'sales' ? 'sales' : `franchise_${param(req, 'kind')}`;
router.post('/records/:kind', handle((a, req) => service.createRecord(a, param(req, 'kind'), req.body), recordTable));
router.patch('/records/:kind/:id', handle((a, req) => service.updateRecord(a, param(req, 'kind'), param(req, 'id'), req.body), recordTable));
router.post('/records/:kind/:id/decide', handle((a, req) => service.decide(a, param(req, 'kind'), param(req, 'id'), req.body), recordTable));
export default router;
