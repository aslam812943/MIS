import type { DataEntry } from '../../models/dataEntry.model.js';

export interface IDataEntryRepository {
  findByDateAndModule(date: string, moduleId: string, userId: string): Promise<DataEntry | null>;
  upsert(entry: Partial<DataEntry>): Promise<DataEntry>;
}
