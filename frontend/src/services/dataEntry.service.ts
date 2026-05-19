import api from './api';

export interface DataEntryPayload {
  module_id: string;
  entry_date: string;
  data: Record<string, any>;
  user_id?: string;
}

export const dataEntryService = {
  /**
   * Fetches the data entry for a specific date, module, and branch.
   */
  getEntry: async (date: string, moduleId: string) => {
    const response = await api.get('/admin/data-entries', {
      params: { date, moduleId },
    });
    return response.data;
  },

  /**
   * Saves or updates a data entry.
   */
  saveEntry: async (payload: DataEntryPayload) => {
    const response = await api.post('/admin/data-entries', payload);
    return response.data;
  },

  /**
   * Fetches all entries submitted within the HOD's department for a selected date.
   */
  getDepartmentEntries: async (date: string) => {
    const response = await api.get('/admin/department-entries', {
      params: { date },
    });
    return response.data;
  },

  /**
   * Verifies a specific data entry.
   */
  verifyEntry: async (id: string) => {
    const response = await api.post(`/admin/data-entries/${id}/verify`);
    return response.data;
  },
};
