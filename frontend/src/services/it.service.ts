import api from './api';

export const itService = {
  /**
   * Fetches IT dashboard aggregated metrics.
   */
  getDashboardData: async (branchId?: string, startDate?: string, endDate?: string) => {
    const response = await api.get('/admin/it/dashboard', {
      params: { branchId, startDate, endDate }
    });
    return response.data;
  },

  /**
   * Fetches vendors list for dropdown selection.
   */
  getVendorsDropdown: async () => {
    const response = await api.get('/admin/it/dropdown/vendors');
    return response.data;
  },

  /**
   * Fetches entries for a specific IT department sheet.
   */
  getEntries: async (
    sheet: string,
    filters: { branchId?: string; search?: string; startDate?: string; endDate?: string } = {}
  ) => {
    const response = await api.get(`/admin/it/${sheet}`, {
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
   * Creates an entry in an IT department sheet.
   */
  createEntry: async (sheet: string, recordData: any) => {
    const response = await api.post(`/admin/it/${sheet}`, recordData);
    return response.data;
  },

  /**
   * Updates an entry in an IT department sheet.
   */
  updateEntry: async (sheet: string, id: string, recordData: any) => {
    const response = await api.patch(`/admin/it/${sheet}/${id}`, recordData);
    return response.data;
  },

  /**
   * Deletes an entry from an IT department sheet.
   */
  deleteEntry: async (sheet: string, id: string) => {
    const response = await api.delete(`/admin/it/${sheet}/${id}`);
    return response.data;
  },

  /**
   * Bulk imports records via CSV mapping.
   */
  bulkImport: async (sheet: string, records: any[]) => {
    const response = await api.post(`/admin/it/bulk/${sheet}`, { records });
    return response.data;
  },

  /**
   * Batch updates status or checkmarks of selected records.
   */
  bulkUpdate: async (sheet: string, ids: string[], updates: any) => {
    const response = await api.patch(`/admin/it/bulk/${sheet}`, { ids, updates });
    return response.data;
  },

  /**
   * Uploads supporting documents/diagrams/evidence to storage
   */
  uploadDocument: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/admin/kyc/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }
};
