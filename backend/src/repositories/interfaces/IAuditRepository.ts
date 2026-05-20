import type { AuditLog } from '../../models/audit.model.js';

export interface IAuditRepository {
  findFiltered(filters: {
    tableName?: string;
    action?: string;
    userEmail?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditLog[]; total: number }>;
}
