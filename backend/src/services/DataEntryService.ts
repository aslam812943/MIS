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

  async saveEntry(entry: Partial<DataEntry>): Promise<DataEntry> {
    if (!entry.entry_date || !entry.module_id || !entry.user_id) {
      throw new Error('Date, Module ID, and User ID are required to save an entry.');
    }

    // Security check 1: Fetch user to prevent IDOR and spoofing branch_id
    const userProfile = await this.userRepository.findById(entry.user_id);
    if (!userProfile) {
      throw new Error('User profile not found.');
    }

    if (!userProfile.branch_id) {
      throw new Error('User is not assigned to any branch. Cannot save data entries.');
    }

    // Forcefully set branch_id from the authenticated user's profile
    entry.branch_id = userProfile.branch_id;

    // Security check 2: Verify user is allowed to access this module
    const allowedModules = userProfile.allowed_modules || [];
    if (userProfile.role !== 'admin' && !allowedModules.includes(entry.module_id)) {
      throw new Error('Unauthorized: You do not have permission to submit data for this module.');
    }

    return await this.dataEntryRepository.upsert(entry);
  }
}
