import { type Request, type Response } from 'express';
import { TaskService } from '../services/TaskService.js';
import { HttpStatus } from '../utils/httpStatus.js';
import { logAudit } from '../utils/auditLogger.js';

/**
 * Handles task creation from outside the app entirely — an n8n workflow
 * relaying a Telegram/WhatsApp message, sitting behind requireExternalApiKey
 * rather than a browser session. Every request must resolve to a real,
 * pre-registered MIS user via external_task_senders before anything is
 * created; there is no "system" fallback identity.
 */
export class ExternalTaskController {
  constructor(private taskService: TaskService) {}

  private getErrorStatus(error: unknown): number {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('unrecognized sender')) return HttpStatus.FORBIDDEN;
      if (
        msg.includes('required') ||
        msg.includes('invalid') ||
        msg.includes('cannot') ||
        msg.includes('not found') ||
        msg.includes('empty')
      ) {
        return HttpStatus.BAD_REQUEST;
      }
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private respondError(res: Response, error: unknown, fallbackMessage: string): void {
    const status = this.getErrorStatus(error);
    const rawMessage = error instanceof Error ? error.message : fallbackMessage;
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error('[ExternalTaskController]', rawMessage);
      res.status(status).json({ message: fallbackMessage });
      return;
    }
    res.status(status).json({ message: rawMessage });
  }

  /**
   * Lets the n8n workflow fetch the real, current user list so Claude can
   * resolve "IT" or "the HOD" against actual accounts instead of guessing.
   */
  getAssignableUsers = async (_req: Request, res: Response): Promise<void> => {
    try {
      const users = await this.taskService.getAssignableUsers();
      res.status(HttpStatus.OK).json(users);
    } catch (error) {
      this.respondError(res, error, 'Failed to retrieve assignable users.');
    }
  };

  /**
   * Creates a task on behalf of a registered external sender.
   * Body: { channel, external_id, assignee_id, title, description, due_date?, priority? }
   */
  createTask = async (req: Request, res: Response): Promise<void> => {
    try {
      const { channel, external_id, assignee_id, title, description, due_date, priority } = req.body;

      if (!channel || !external_id) {
        res.status(HttpStatus.BAD_REQUEST).json({ message: 'channel and external_id are required.' });
        return;
      }

      const sender = await this.taskService.resolveSenderProfileId(String(channel), String(external_id));
      // logAudit reads req.user.id/email/role, which requireExternalApiKey
      // never sets (there's no session here) — attribute the audit entry to
      // the resolved real sender instead of silently skipping/failing it.
      (req as any).user = { id: sender.profileId, email: sender.email, role: sender.role };

      const task = await this.taskService.createTask(
        { title, description, assigned_to: assignee_id, due_date, priority },
        sender.profileId
      );

      await this.taskService.addSourceRemark(task.id, `Created via ${channel} by ${sender.name}.`);

      logAudit(req, 'INSERT', 'tasks', task.id, null, task);

      res.status(HttpStatus.CREATED).json({
        task,
        created_by: sender.name,
      });
    } catch (error) {
      this.respondError(res, error, 'Failed to create task.');
    }
  };
}
