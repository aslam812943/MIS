import api from './api';

export const financeService = {
  /**
   * Fetches Finance dashboard aggregated metrics.
   */
  getDashboardData: async (branchId?: string, startDate?: string, endDate?: string) => {
    const response = await api.get('/admin/finance/dashboard', {
      params: { branchId, startDate, endDate }
    });
    return response.data;
  },

  /**
   * Fetches entries for a specific Finance department sheet.
   */
  getEntries: async (
    sheet: string,
    filters: { branchId?: string; search?: string; startDate?: string; endDate?: string } = {}
  ) => {
    const response = await api.get(`/admin/finance/${sheet}`, {
      params: {
        branchId: filters.branchId,
        search: filters.search,
        startDate: filters.startDate,
        endDate: filters.endDate
      }
    });
    return response.data;
  },

  /**
   * Creates an entry in a Finance department sheet.
   */
  createEntry: async (sheet: string, recordData: any) => {
    const response = await api.post(`/admin/finance/${sheet}`, recordData);
    return response.data;
  },

  /**
   * Updates an entry in a Finance department sheet.
   */
  updateEntry: async (sheet: string, id: string, recordData: any) => {
    const response = await api.patch(`/admin/finance/${sheet}/${id}`, recordData);
    return response.data;
  },

  /**
   * Deletes an entry from a Finance department sheet.
   */
  deleteEntry: async (sheet: string, id: string) => {
    const response = await api.delete(`/admin/finance/${sheet}/${id}`);
    return response.data;
  },

  /**
   * Bulk imports records via CSV mapping.
   */
  bulkImport: async (sheet: string, records: any[]) => {
    const response = await api.post(`/admin/finance/bulk/${sheet}`, { records });
    return response.data;
  },

  /**
   * Batch updates status of selected records.
   */
  bulkUpdate: async (sheet: string, ids: string[], updates: any) => {
    const response = await api.patch(`/admin/finance/bulk/${sheet}`, { ids, updates });
    return response.data;
  }
};
