import api from './api';

export const dpService = {
  /**
   * Fetches DP dashboard aggregated metrics.
   */
  getDashboardData: async (branchId?: string, startDate?: string, endDate?: string) => {
    const response = await api.get('/admin/dp/dashboard', {
      params: { branchId, startDate, endDate }
    });
    return response.data;
  },

  /**
   * Fetches verified clients list from KYC database.
   */
  getVerifiedClients: async () => {
    const response = await api.get('/admin/dp/clients');
    return response.data;
  },

  /**
   * Fetches entries for a specific DP department sheet.
   */
  getEntries: async (
    sheet: string,
    filters: { branchId?: string; search?: string; startDate?: string; endDate?: string } = {}
  ) => {
    const response = await api.get(`/admin/dp/${sheet}`, {
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
   * Creates an entry in a DP department sheet.
   */
  createEntry: async (sheet: string, recordData: any) => {
    const response = await api.post(`/admin/dp/${sheet}`, recordData);
    return response.data;
  },

  /**
   * Updates an entry in a DP department sheet.
   */
  updateEntry: async (sheet: string, id: string, recordData: any) => {
    const response = await api.patch(`/admin/dp/${sheet}/${id}`, recordData);
    return response.data;
  },

  /**
   * Deletes an entry from a DP department sheet.
   */
  deleteEntry: async (sheet: string, id: string) => {
    const response = await api.delete(`/admin/dp/${sheet}/${id}`);
    return response.data;
  },

  /**
   * Bulk imports records via CSV mapping.
   */
  bulkImport: async (sheet: string, records: any[]) => {
    const response = await api.post(`/admin/dp/bulk/${sheet}`, { records });
    return response.data;
  },

  /**
   * Batch updates status or checkmarks of selected records.
   */
  bulkUpdate: async (sheet: string, ids: string[], updates: any) => {
    const response = await api.patch(`/admin/dp/bulk/${sheet}`, { ids, updates });
    return response.data;
  }
};
