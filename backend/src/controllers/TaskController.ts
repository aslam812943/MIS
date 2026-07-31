import { type Request, type Response } from 'express';
import { TaskService } from '../services/TaskService.js';
import { HttpStatus } from '../utils/httpStatus.js';
import { logAudit } from '../utils/auditLogger.js';

export class TaskController {
  constructor(private taskService: TaskService) {}

  private getErrorStatus(error: unknown): number {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('unauthorized') || msg.includes('not authorized')) {
        return HttpStatus.FORBIDDEN;
      }
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
      console.error('[TaskController]', rawMessage);
      res.status(status).json({ message: fallbackMessage });
      return;
    }
    res.status(status).json({ message: rawMessage });
  }

  getAssignableUsers = async (_req: Request, res: Response): Promise<void> => {
    try {
      const users = await this.taskService.getAssignableUsers();
      res.status(HttpStatus.OK).json(users);
    } catch (error) {
      this.respondError(res, error, 'Failed to load assignable users.');
    }
  };

  createTask = async (req: Request, res: Response): Promise<void> => {
    try {
      const creatorId = (req as any).user.id;
      const task = await this.taskService.createTask(req.body, creatorId);
      logAudit(req, 'INSERT', 'tasks', task.id, null, task);
      res.status(HttpStatus.CREATED).json(task);
    } catch (error) {
      this.respondError(res, error, 'Failed to create task.');
    }
  };

  getTasks = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const view = (req.query.view as string) || 'mine';
      if (!['mine', 'assigned_by_me', 'team'].includes(view)) {
        res.status(HttpStatus.BAD_REQUEST).json({ message: 'Invalid view parameter.' });
        return;
      }
      const status = req.query.status as string | undefined;
      const tasks = await this.taskService.getTasks(requesterId, view as any, status);
      res.status(HttpStatus.OK).json(tasks);
    } catch (error) {
      this.respondError(res, error, 'Failed to load tasks.');
    }
  };

  getTaskDetail = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const id = req.params.id as string;
      const result = await this.taskService.getTaskWithRemarks(id, requesterId);
      res.status(HttpStatus.OK).json(result);
    } catch (error) {
      this.respondError(res, error, 'Failed to load task.');
    }
  };

  updateTask = async (req: Request, res: Response): Promise<void> => {
    try {
      const updaterId = (req as any).user.id;
      const id = req.params.id as string;
      const task = await this.taskService.updateTask(id, req.body, updaterId);
      logAudit(req, 'UPDATE', 'tasks', id, null, task);
      res.status(HttpStatus.OK).json(task);
    } catch (error) {
      this.respondError(res, error, 'Failed to update task.');
    }
  };

  deleteTask = async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = (req as any).user.id;
      const id = req.params.id as string;
      await this.taskService.deleteTask(id, requesterId);
      logAudit(req, 'DELETE', 'tasks', id, null, null);
      res.status(HttpStatus.OK).json({ message: 'Task deleted successfully.' });
    } catch (error) {
      this.respondError(res, error, 'Failed to delete task.');
    }
  };

  addRemark = async (req: Request, res: Response): Promise<void> => {
    try {
      const authorId = (req as any).user.id;
      const id = req.params.id as string;
      const remark = await this.taskService.addRemark(id, req.body.remark_text, authorId);
      res.status(HttpStatus.CREATED).json(remark);
    } catch (error) {
      this.respondError(res, error, 'Failed to add remark.');
    }
  };
}
