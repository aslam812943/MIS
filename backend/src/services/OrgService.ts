import type { Branch, Department, Module, ModuleField } from '../models/org.model.js';
import type { IBranchRepository, IDepartmentRepository, IModuleRepository } from '../repositories/interfaces/IOrgRepository.js';

/**
 * Service to manage organizational entities like Branches, Departments, and Modules.
 */
export class OrgService {
  constructor(
    private branchRepository: IBranchRepository,
    private departmentRepository: IDepartmentRepository,
    private moduleRepository: IModuleRepository
  ) {}

  /**
   * Adds a new branch with validation.
   * 
   * @param name Name of the branch.
   * @returns The created branch.
   * @throws Error if name is empty or already exists.
   */
  async addBranch(name: string): Promise<Branch> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Branch name cannot be empty or just spaces.');
    }

    const existing = await this.branchRepository.findByName(trimmedName);
    if (existing) {
      throw new Error(`A branch with the name "${trimmedName}" already exists.`);
    }

    return this.branchRepository.create({ name: trimmedName });
  }

  /**
   * Retrieves all branches.
   */
  async getAllBranches(): Promise<Branch[]> {
    return this.branchRepository.findAll();
  }

  /**
   * Adds a new department with validation.
   * 
   * @param name Name of the department.
   * @returns The created department.
   * @throws Error if name is empty or already exists.
   */
  async addDepartment(name: string): Promise<Department> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Department name cannot be empty or just spaces.');
    }

    const existing = await this.departmentRepository.findByName(trimmedName);
    if (existing) {
      throw new Error(`A department with the name "${trimmedName}" already exists.`);
    }

    return this.departmentRepository.create({ name: trimmedName });
  }

  /**
   * Retrieves all departments.
   */
  async getAllDepartments(): Promise<Department[]> {
    return this.departmentRepository.findAll();
  }

  /**
   * Adds a new module with validation.
   * 
   * @param name Name of the module.
   * @param fields Custom fields for the module.
   * @returns The created module.
   * @throws Error if name is empty or already exists.
   */
  async addModule(name: string, fields?: ModuleField[]): Promise<Module> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Module name cannot be empty or just spaces.');
    }

    const existing = await this.moduleRepository.findByName(trimmedName);
    if (existing) {
      throw new Error(`A module with the name "${trimmedName}" already exists.`);
    }

    return this.moduleRepository.create({ 
      name: trimmedName, 
      ...(fields ? { fields } : {}) 
    } as any); // Cast to any to bypass exactOptionalPropertyTypes if needed, or better yet, fix the model.
  }

  /**
   * Retrieves all modules.
   */
  async getAllModules(): Promise<Module[]> {
    return this.moduleRepository.findAll();
  }

  /**
   * Updates a branch.
   */
  async updateBranch(id: string, name: string): Promise<Branch> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Branch name cannot be empty.');
    }

    const existing = await this.branchRepository.findByName(trimmedName);
    if (existing && existing.id !== id) {
      throw new Error(`A branch with the name "${trimmedName}" already exists.`);
    }

    return this.branchRepository.update(id, { name: trimmedName });
  }

  /**
   * Deletes a branch.
   */
  async deleteBranch(id: string): Promise<void> {
    return this.branchRepository.delete(id);
  }

  /**
   * Updates a department.
   */
  async updateDepartment(id: string, name: string): Promise<Department> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Department name cannot be empty.');
    }

    const existing = await this.departmentRepository.findByName(trimmedName);
    if (existing && existing.id !== id) {
      throw new Error(`A department with the name "${trimmedName}" already exists.`);
    }

    return this.departmentRepository.update(id, { name: trimmedName });
  }

  /**
   * Deletes a department.
   */
  async deleteDepartment(id: string): Promise<void> {
    return this.departmentRepository.delete(id);
  }

  /**
   * Updates a module.
   */
  async updateModule(id: string, name: string, fields?: ModuleField[]): Promise<Module> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Module name cannot be empty.');
    }

    const existing = await this.moduleRepository.findByName(trimmedName);
    if (existing && existing.id !== id) {
      throw new Error(`A module with the name "${trimmedName}" already exists.`);
    }

    return this.moduleRepository.update(id, { 
      name: trimmedName, 
      ...(fields ? { fields } : {}) 
    } as any);
  }

  /**
   * Deletes a module.
   */
  async deleteModule(id: string): Promise<void> {
    return this.moduleRepository.delete(id);
  }
}
