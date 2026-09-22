import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { DealerCalculationController } from '../controllers/DealerCalculationController.js';

const router = Router();
const controller = new DealerCalculationController();

// Apply auth middleware to all dealer calculation routes
router.use(requireAuth);

// Master Clients
router.get('/master', (req, res) => controller.getMaster(req, res));
router.put('/master', (req, res) => controller.replaceMaster(req, res));
router.post('/master/bulk', (req, res) => controller.bulkUploadMaster(req, res));
router.post('/master/rollback', (req, res) => controller.rollbackMaster(req, res));
router.get('/master/recent-uploads', (req, res) => controller.getRecentUploads(req, res));
router.get('/master/added-dates', (req, res) => controller.getAddedDates(req, res));
router.get('/master/added-dates/:date', (req, res) => controller.getAddedDateClients(req, res));

// Dealers & RMs
router.get('/dealers', (req, res) => controller.getDealers(req, res));
router.put('/dealers', (req, res) => controller.replaceDealers(req, res));
router.get('/rms', (req, res) => controller.getRms(req, res));
router.put('/rms', (req, res) => controller.replaceRms(req, res));
router.get('/rms/summary', (req, res) => controller.getRmsSummary(req, res));

// Targets
router.get('/targets', (req, res) => controller.getTargets(req, res));
router.put('/targets', (req, res) => controller.updateTargets(req, res));

// Daily Records
router.get('/daily', (req, res) => controller.getDaily(req, res));
router.get('/daily/client/:code', (req, res) => controller.getDailyClient(req, res));
router.get('/daily/dates', (req, res) => controller.getDailyDates(req, res));
router.get('/daily/:date', (req, res) => controller.getDailyByDate(req, res));
router.put('/daily/:date', (req, res) => controller.upsertDaily(req, res));
router.delete('/daily/:date', (req, res) => controller.deleteDaily(req, res));

// Debit Records
router.get('/debit', (req, res) => controller.getDebit(req, res));
router.get('/debit/dates', (req, res) => controller.getDebitDates(req, res));
router.get('/debit/latest', (req, res) => controller.getDebitLatest(req, res));
router.get('/debit/:date', (req, res) => controller.getDebitByDate(req, res));
router.put('/debit/:date', (req, res) => controller.upsertDebit(req, res));
router.delete('/debit/:date', (req, res) => controller.deleteDebit(req, res));

// Dashboard & MIS Summaries
router.get('/dashboard/summary', (req, res) => controller.getDashboardSummary(req, res));
router.get('/mis/summary', (req, res) => controller.getMisSummary(req, res));
router.get('/reports/dealers', (req, res) => controller.getReportsDealers(req, res));
router.get('/brokerage/by-client', (req, res) => controller.getBrokerageByClient(req, res));

// Tasks
router.get('/tasks', (req, res) => controller.getTasks(req, res));
router.put('/tasks', (req, res) => controller.upsertTask(req, res));

// Holidays
router.get('/holidays', (req, res) => controller.getHolidays(req, res));
router.put('/holidays', (req, res) => controller.replaceHolidays(req, res));

// Users & Viewer Scope
router.get('/users', (req, res) => controller.getUsers(req, res));
router.post('/users', (req, res) => controller.createUser(req, res));
router.delete('/users/:id', (req, res) => controller.deleteUser(req, res));
router.put('/users/password', (req, res) => controller.changePassword(req, res));
router.get('/viewer-scope', (req, res) => controller.getViewerScope(req, res));

export default router;
