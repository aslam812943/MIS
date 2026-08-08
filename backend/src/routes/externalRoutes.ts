import { Router } from 'express';
import { requireExternalApiKey } from '../middlewares/requireExternalApiKey.js';
import { TaskService } from '../services/TaskService.js';
import { NotificationService } from '../services/NotificationService.js';
import { EmailService } from '../services/EmailService.js';
import { ExternalTaskController } from '../controllers/ExternalTaskController.js';

/**
 * Routes reachable from outside the app entirely (an n8n workflow relaying
 * a Telegram/WhatsApp message) — deliberately kept in their own file, on
 * their own path, gated by their own middleware (requireExternalApiKey, a
 * shared secret), so this surface can never inherit or leak into the
 * cookie-session-authenticated routes in protectedRoutes.ts, or vice versa.
 */
const router = Router();

const notificationService = new NotificationService(new EmailService());
const taskService = new TaskService(notificationService);
const externalTaskController = new ExternalTaskController(taskService);

router.get('/tasks/assignable-users', requireExternalApiKey, externalTaskController.getAssignableUsers);
router.post('/tasks', requireExternalApiKey, externalTaskController.createTask);

export default router;
