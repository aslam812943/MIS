import type { Request, Response } from 'express';
import { OrgService } from '../services/OrgService.js';
import { HttpStatus } from '../utils/httpStatus.js';
import { logAudit } from '../utils/auditLogger.js';

/**
 * Controller for organizational management (Branches/Departments/Modules).
 */
export class OrgController {
  constructor(private orgService: OrgService) {}

  /**
   * OrgService only ever throws deliberate, user-facing validation messages
   * ("cannot be empty", "already exists", "cannot exceed...characters",
   * "Cannot delete this branch/department/module..."). Anything that
   * doesn't match one of those is an unexpected failure — usually a raw
   * Postgres/Supabase error bubbling up through the repository's
   * `throw new Error(error.message)` — which used to be forwarded to the
   * client verbatim. Those are now logged server-side and replaced with a
   * generic message instead of leaking internals.
   */
  private getErrorStatus(error: unknown): number {
    if (error instanceof Error) {
      const msg = error.message;
      if (
        msg.includes('cannot be empty') ||
        msg.includes('already exists') ||
        msg.includes('cannot exceed') ||
        msg.includes('Cannot delete this branch') ||
        msg.includes('Cannot delete this department') ||
        msg.includes('Cannot delete this module')
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
      console.error('[OrgController]', rawMessage);
      res.status(status).json({ message: fallbackMessage });
      return;
    }

    res.status(status).json({ message: rawMessage });
  }

  /**
   * Adds a new branch.
   */
  addBranch = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name } = req.body;
      const branch = await this.orgService.addBranch(name);
      
      // Audit Log
      logAudit(req, 'INSERT', 'branches', branch.id, null, branch);

      res.status(HttpStatus.CREATED).json(branch);
    } catch (error: unknown) {
      this.respondError(res, error, 'Failed to add branch.');
    }
  };

  /**
   * Lists all branches.
   */
  getBranches = async (req: Request, res: Response): Promise<void> => {
    try {
      const branches = await this.orgService.getAllBranches();
      res.status(HttpStatus.OK).json(branches);
    } catch (error: unknown) {
      this.respondError(res, error, 'Failed to fetch branches.');
    }
  };

  /**
   * Adds a new department.
   */
  addDepartment = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name } = req.body;
      const department = await this.orgService.addDepartment(name);

      // Audit Log
      logAudit(req, 'INSERT', 'departments', department.id, null, department);

      res.status(HttpStatus.CREATED).json(department);
    } catch (error: unknown) {
      this.respondError(res, error, 'Failed to add department.');
    }
  };

  /**
   * Lists all departments.
   */
  getDepartments = async (req: Request, res: Response): Promise<void> => {
    try {
      const departments = await this.orgService.getAllDepartments();
      res.status(HttpStatus.OK).json(departments);
    } catch (error: unknown) {
      this.respondError(res, error, 'Failed to fetch departments.');
    }
  };

  /**
   * Adds a new module.
   */
  addModule = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, fields } = req.body;
      const module = await this.orgService.addModule(name, fields);

      // Audit Log
      logAudit(req, 'INSERT', 'modules', module.id, null, module);

      res.status(HttpStatus.CREATED).json(module);
    } catch (error: unknown) {
      this.respondError(res, error, 'Failed to add module.');
    }
  };

  /**
   * Lists all modules.
   */
  getModules = async (req: Request, res: Response): Promise<void> => {
    try {
      const modules = await this.orgService.getAllModules();
      res.status(HttpStatus.OK).json(modules);
    } catch (error: unknown) {
      this.respondError(res, error, 'Failed to fetch modules.');
    }
  };

  /**
   * Updates a branch.
   */
  updateBranch = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { name } = req.body;

      const oldBranch = await this.orgService.getBranchById(id);
      const branch = await this.orgService.updateBranch(id, name);

      // Audit Log
      logAudit(req, 'UPDATE', 'branches', id, oldBranch, branch);

      res.status(HttpStatus.OK).json(branch);
    } catch (error: unknown) {
      this.respondError(res, error, 'Failed to update branch.');
    }
  };

  /**
   * Deletes a branch.
   */
  deleteBranch = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      
      const oldBranch = await this.orgService.getBranchById(id);
      await this.orgService.deleteBranch(id);

      // Audit Log
      logAudit(req, 'DELETE', 'branches', id, oldBranch, null);

      res.status(HttpStatus.NO_CONTENT).send();
    } catch (error: unknown) {
      this.respondError(res, error, 'Failed to delete branch.');
    }
  };

  /**
   * Updates a department.
   */
  updateDepartment = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { name } = req.body;

      const oldDept = await this.orgService.getDepartmentById(id);
      const department = await this.orgService.updateDepartment(id, name);

      // Audit Log
      logAudit(req, 'UPDATE', 'departments', id, oldDept, department);

      res.status(HttpStatus.OK).json(department);
    } catch (error: unknown) {
      this.respondError(res, error, 'Failed to update department.');
    }
  };

  /**
   * Deletes a department.
   */
  deleteDepartment = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      
      const oldDept = await this.orgService.getDepartmentById(id);
      await this.orgService.deleteDepartment(id);

      // Audit Log
      logAudit(req, 'DELETE', 'departments', id, oldDept, null);

      res.status(HttpStatus.NO_CONTENT).send();
    } catch (error: unknown) {
      this.respondError(res, error, 'Failed to delete department.');
    }
  };

  /**
   * Updates a module.
   */
  updateModule = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { name, fields } = req.body;

      const oldModule = await this.orgService.getModuleById(id);
      const module = await this.orgService.updateModule(id, name, fields);

      // Audit Log
      logAudit(req, 'UPDATE', 'modules', id, oldModule, module);

      res.status(HttpStatus.OK).json(module);
    } catch (error: unknown) {
      this.respondError(res, error, 'Failed to update module.');
    }
  };

  /**
   * Deletes a module.
   */
  deleteModule = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;

      const oldModule = await this.orgService.getModuleById(id);
      await this.orgService.deleteModule(id);

      // Audit Log
      logAudit(req, 'DELETE', 'modules', id, oldModule, null);

      res.status(HttpStatus.NO_CONTENT).send();
    } catch (error: unknown) {
      this.respondError(res, error, 'Failed to delete module.');
    }
  };
}
