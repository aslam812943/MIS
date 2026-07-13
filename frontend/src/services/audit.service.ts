import api from './api';

export interface AuditLog {
  id: string;
  table_name: string;
  record_id?: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT';
  old_data?: any;
  new_data?: any;
  user_id?: string;
  user_email: string;
  user_role?: string;
  created_at: string;
}

export interface GetLogsParams {
  tableName?: string;
  action?: string;
  userEmail?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export const auditService = {
  /**
   * Fetch paginated and filtered system audit history logs.
   */
  async getLogs(params: GetLogsParams): Promise<{ logs: AuditLog[]; total: number }> {
    const response = await api.get('/admin/audit-logs', { params });
    return response.data;
  }
};
