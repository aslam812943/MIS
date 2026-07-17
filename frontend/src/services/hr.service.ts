import api from './api';

export const hrService = {
  /**
   * Fetches HR recruitment/policy dashboard aggregates (Open Positions,
   * Candidates in Pipeline, Active Policies, Candidates by Stage).
   * Separate from orgService.getHRDashboardData, which owns the
   * employee-headcount KPIs.
   */
  getDashboardData: async (startDate?: string, endDate?: string) => {
    const response = await api.get('/admin/hr/dashboard', { params: { startDate, endDate } });
    return response.data;
  },

  getOpenPositionsDropdown: async () => {
    const response = await api.get('/admin/hr/dropdown/positions');
    return response.data;
  },

  getEntries: async (sheet: string, filters: { search?: string; startDate?: string; endDate?: string } = {}) => {
    const response = await api.get(`/admin/hr/${sheet}`, { params: filters });
    return response.data;
  },

  createEntry: async (sheet: string, recordData: any) => {
    const response = await api.post(`/admin/hr/${sheet}`, recordData);
    return response.data;
  },

  updateEntry: async (sheet: string, id: string, recordData: any) => {
    const response = await api.patch(`/admin/hr/${sheet}/${id}`, recordData);
    return response.data;
  },

  deleteEntry: async (sheet: string, id: string) => {
    const response = await api.delete(`/admin/hr/${sheet}/${id}`);
    return response.data;
  },

  bulkImport: async (sheet: string, records: any[]) => {
    const response = await api.post(`/admin/hr/bulk/${sheet}`, { records });
    return response.data;
  },

  bulkUpdate: async (sheet: string, ids: string[], updates: any) => {
    const response = await api.patch(`/admin/hr/bulk/${sheet}`, { ids, updates });
    return response.data;
  },

  uploadDocument: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/admin/hr/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }
};
