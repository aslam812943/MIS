import type { Branch, Department, Module } from '../../models/org.model.js';

/**
 * Interface for Branch repository operations.
 */
export interface IBranchRepository {
  findAll(): Promise<Branch[]>;
  findById(id: string): Promise<Branch | null>;
  findByName(name: string): Promise<Branch | null>;
  create(branch: Partial<Branch>): Promise<Branch>;
  update(id: string, branch: Partial<Branch>): Promise<Branch>;
  delete(id: string): Promise<void>;
}

/**
 * Interface for Department repository operations.
 */
export interface IDepartmentRepository {
  findAll(): Promise<Department[]>;
  findById(id: string): Promise<Department | null>;
  findByName(name: string): Promise<Department | null>;
  create(department: Partial<Department>): Promise<Department>;
  update(id: string, department: Partial<Department>): Promise<Department>;
  delete(id: string): Promise<void>;
}

/**
 * Interface for Module repository operations.
 */
export interface IModuleRepository {
  findAll(): Promise<Module[]>;
  findById(id: string): Promise<Module | null>;
  findByName(name: string): Promise<Module | null>;
  create(module: Partial<Module>): Promise<Module>;
  update(id: string, module: Partial<Module>): Promise<Module>;
  delete(id: string): Promise<void>;
}
