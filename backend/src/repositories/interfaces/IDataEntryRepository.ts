import type { DataEntry } from '../../models/dataEntry.model.js';

export interface IDataEntryRepository {
  findByDateAndModule(date: string, moduleId: string, userId: string): Promise<DataEntry | null>;
  upsert(entry: Partial<DataEntry>): Promise<DataEntry>;
  findByDepartment(departmentId: string, date: string): Promise<any[]>;
  verify(id: string, verifiedBy: string): Promise<DataEntry>;
  findById(id: string): Promise<DataEntry | null>;
}
