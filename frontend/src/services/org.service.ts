import api from './api';



/**
 * Interface for Branch data.
 */
export interface Branch {
  id: string;
  name: string;
  created_at: string;
}

/**
 * Interface for Department data.
 */
export interface Department {
  id: string;
  name: string;
  created_at: string;
}

/**
 * Represents a field within a module.
 */
export interface ModuleField {
  name: string;
  type: 'text' | 'number' | 'date';
}

/**
 * Interface for Module data.
 */
export interface Module {
  id: string;
  name: string;
  fields?: ModuleField[];
  created_at: string;
}

/**
 * Service to handle organizational API calls (Branches, Departments, and Modules).
 */
export const orgService = {
  /**
   * Fetches all branches.
   */
  async getBranches(): Promise<Branch[]> {
    const response = await api.get('/admin/branches');
    return response.data;
  },

  /**
   * Adds a new branch.
   */
  async addBranch(name: string): Promise<Branch> {
    const response = await api.post('/admin/branches', { name });
    return response.data;
  },

  /**
   * Fetches all departments.
   */
  async getDepartments(): Promise<Department[]> {
    const response = await api.get('/admin/departments');
    return response.data;
  },

  /**
   * Adds a new department.
   */
  async addDepartment(name: string): Promise<Department> {
    const response = await api.post('/admin/departments', { name });
    return response.data;
  },

  /**
   * Fetches all modules.
   */
  async getModules(): Promise<Module[]> {
    const response = await api.get('/admin/modules');
    return response.data;
  },

  /**
   * Adds a new module.
   */
  async addModule(name: string, fields?: ModuleField[]): Promise<Module> {
    const response = await api.post('/admin/modules', { name, fields });
    return response.data;
  },

  /**
   * Updates a branch.
   */
  async updateBranch(id: string, name: string): Promise<Branch> {
    const response = await api.patch(`/admin/branches/${id}`, { name });
    return response.data;
  },

  /**
   * Deletes a branch.
   */
  async deleteBranch(id: string): Promise<void> {
    await api.delete(`/admin/branches/${id}`);
  },

  /**
   * Updates a department.
   */
  async updateDepartment(id: string, name: string): Promise<Department> {
    const response = await api.patch(`/admin/departments/${id}`, { name });
    return response.data;
  },

  /**
   * Deletes a department.
   */
  async deleteDepartment(id: string): Promise<void> {
    await api.delete(`/admin/departments/${id}`);
  },

  /**
   * Updates a module.
   */
  async updateModule(id: string, name: string, fields?: ModuleField[]): Promise<Module> {
    const response = await api.patch(`/admin/modules/${id}`, { name, fields });
    return response.data;
  },

  /**
   * Deletes a module.
   */
  async deleteModule(id: string): Promise<void> {
    await api.delete(`/admin/modules/${id}`);
  }
};
