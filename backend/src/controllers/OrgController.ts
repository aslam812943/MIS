import type { Request, Response } from 'express';
import { OrgService } from '../services/OrgService.js';
import { HttpStatus } from '../utils/httpStatus.js';

/**
 * Controller for organizational management (Branches/Departments/Modules).
 */
export class OrgController {
  constructor(private orgService: OrgService) {}

  /**
   * Adds a new branch.
   */
  addBranch = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name } = req.body;
      const branch = await this.orgService.addBranch(name);
      res.status(HttpStatus.CREATED).json(branch);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to add branch';
      res.status(HttpStatus.BAD_REQUEST).json({ message });
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
      const message = error instanceof Error ? error.message : 'Failed to fetch branches';
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message });
    }
  };

  /**
   * Adds a new department.
   */
  addDepartment = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name } = req.body;
      const department = await this.orgService.addDepartment(name);
      res.status(HttpStatus.CREATED).json(department);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to add department';
      res.status(HttpStatus.BAD_REQUEST).json({ message });
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
      const message = error instanceof Error ? error.message : 'Failed to fetch departments';
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message });
    }
  };

  /**
   * Adds a new module.
   */
  addModule = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name } = req.body;
      const module = await this.orgService.addModule(name);
      res.status(HttpStatus.CREATED).json(module);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to add module';
      res.status(HttpStatus.BAD_REQUEST).json({ message });
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
      const message = error instanceof Error ? error.message : 'Failed to fetch modules';
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message });
    }
  };

  /**
   * Updates a branch.
   */
  updateBranch = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { name } = req.body;
      const branch = await this.orgService.updateBranch(id, name);
      res.status(HttpStatus.OK).json(branch);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update branch';
      res.status(HttpStatus.BAD_REQUEST).json({ message });
    }
  };

  /**
   * Deletes a branch.
   */
  deleteBranch = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      await this.orgService.deleteBranch(id);
      res.status(HttpStatus.NO_CONTENT).send();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete branch';
      res.status(HttpStatus.BAD_REQUEST).json({ message });
    }
  };

  /**
   * Updates a department.
   */
  updateDepartment = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { name } = req.body;
      const department = await this.orgService.updateDepartment(id, name);
      res.status(HttpStatus.OK).json(department);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update department';
      res.status(HttpStatus.BAD_REQUEST).json({ message });
    }
  };

  /**
   * Deletes a department.
   */
  deleteDepartment = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      await this.orgService.deleteDepartment(id);
      res.status(HttpStatus.NO_CONTENT).send();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete department';
      res.status(HttpStatus.BAD_REQUEST).json({ message });
    }
  };

  /**
   * Updates a module.
   */
  updateModule = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { name } = req.body;
      const module = await this.orgService.updateModule(id, name);
      res.status(HttpStatus.OK).json(module);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update module';
      res.status(HttpStatus.BAD_REQUEST).json({ message });
    }
  };

  /**
   * Deletes a module.
   */
  deleteModule = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      await this.orgService.deleteModule(id);
      res.status(HttpStatus.NO_CONTENT).send();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete module';
      res.status(HttpStatus.BAD_REQUEST).json({ message });
    }
  };
}
