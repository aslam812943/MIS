import type { IDataEntryRepository } from '../repositories/interfaces/IDataEntryRepository.js';
import type { IUserRepository } from '../repositories/interfaces/IUserRepository.js';
import type { DataEntry } from '../models/dataEntry.model.js';

export class DataEntryService {
  constructor(
    private dataEntryRepository: IDataEntryRepository,
    private userRepository: IUserRepository
  ) {}

  async getEntry(date: string, moduleId: string, userId: string): Promise<DataEntry | null> {
    if (!date || !moduleId || !userId) {
      throw new Error('Date, Module ID, and User ID are required.');
    }
    return await this.dataEntryRepository.findByDateAndModule(date, moduleId, userId);
  }

  async saveEntry(entry: Partial<DataEntry>, requesterId: string, requesterRole: string): Promise<DataEntry> {
    if (!entry.entry_date || !entry.module_id || !entry.user_id) {
      throw new Error('Date, Module ID, and User ID are required to save an entry.');
    }

    const requesterProfile = await this.userRepository.findById(requesterId);
    if (!requesterProfile) {
      throw new Error('Requester profile not found.');
    }

    if (requesterRole === 'hod') {
      // HOD is saving/verifying data for an employee in their department
      const employeeProfile = await this.userRepository.findById(entry.user_id);
      if (!employeeProfile) {
        throw new Error('Target employee profile not found.');
      }

      if (employeeProfile.department_id !== requesterProfile.department_id) {
        throw new Error('Unauthorized: You can only save or edit entries for employees within your department.');
      }

      if (!employeeProfile.branch_id) {
        throw new Error('Target employee is not assigned to a branch.');
      }

      entry.branch_id = employeeProfile.branch_id;
      if (employeeProfile.department_id) {
        entry.department_id = employeeProfile.department_id;
      }
      entry.status = 'verified';
      entry.verified_by = requesterProfile.id;
      entry.verified_at = new Date().toISOString();
    } else {
      // Standard employee submission
      // Force the employee to only write their own data
      entry.user_id = requesterId;

      const employeeProfile = await this.userRepository.findById(entry.user_id);
      if (!employeeProfile) {
        throw new Error('Employee profile not found.');
      }

      if (!employeeProfile.branch_id) {
        throw new Error('User is not assigned to any branch. Cannot save data entries.');
      }

      // Check if entry already exists and is verified (locked)
      const existing = await this.dataEntryRepository.findByDateAndModule(
        entry.entry_date,
        entry.module_id,
        entry.user_id
      );
      if (existing && existing.status === 'verified') {
        throw new Error('Locked: This entry has already been verified by the department head and cannot be modified.');
      }

      entry.branch_id = employeeProfile.branch_id;
      if (employeeProfile.department_id) {
        entry.department_id = employeeProfile.department_id;
      }
      entry.status = 'pending';
    }

    // Security check 2: Verify target user is allowed to access this module
    const userProfile = await this.userRepository.findById(entry.user_id);
    const allowedModules = userProfile?.allowed_modules || [];
    if (userProfile?.role !== 'admin' && !allowedModules.includes(entry.module_id)) {
      throw new Error('Unauthorized: This user does not have permission to submit data for this module.');
    }

    return await this.dataEntryRepository.upsert(entry);
  }

  async getDepartmentEntries(userId: string, date: string): Promise<any[]> {
    if (!userId || !date) {
      throw new Error('User ID and Date are required.');
    }

    const userProfile = await this.userRepository.findById(userId);
    if (!userProfile) {
      throw new Error('HOD profile not found.');
    }

    if (!userProfile.department_id) {
      throw new Error('HOD is not assigned to any department.');
    }

    return await this.dataEntryRepository.findByDepartment(userProfile.department_id, date);
  }

  async verifyEntry(id: string, verifiedBy: string): Promise<DataEntry> {
    if (!id || !verifiedBy) {
      throw new Error('Entry ID and Verifier ID are required.');
    }
    
    // Fetch HOD Profile
    const client = await this.userRepository.findById(verifiedBy);
    if (!client) {
      throw new Error('Verifier profile not found.');
    }

    if (!client.department_id) {
      throw new Error('Verifier is not assigned to any department.');
    }

    // Fetch Target Entry
    const entry = await this.dataEntryRepository.findById(id);
    if (!entry) {
      throw new Error('Target data entry not found.');
    }

    // Enforce Department boundary to prevent IDOR cross-department approval
    if (entry.department_id !== client.department_id) {
      throw new Error('Unauthorized: You can only verify data entries belonging to your department.');
    }

    return await this.dataEntryRepository.verify(id, verifiedBy);
  }

  /**
   * Helper method to retrieve data entries for auditing/history.
   */
  async getEntryById(id: string): Promise<DataEntry | null> {
    return this.dataEntryRepository.findById(id);
  }
}
