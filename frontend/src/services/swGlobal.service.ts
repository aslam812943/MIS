import api from './api';
import type {
  SWGlobalAccountReport,
  SWGlobalAccount,
  SWGlobalEvent,
  SWGlobalLead,
  SWGlobalUpload,
  SWGlobalDashboardStats
} from '../types/swGlobal.types';

export const swGlobalService = {
  getAccountReport: async (from?: string, to?: string, branchId?: string): Promise<SWGlobalAccountReport> => {
    const res = await api.get('/admin/sw-global/report', { params: { from, to, branchId } });
    return res.data;
  },
  getDashboardStats: async (branchId?: string): Promise<SWGlobalDashboardStats> => {
    const res = await api.get('/admin/sw-global/dashboard', {
      params: branchId ? { branchId } : {}
    });
    return res.data;
  },

  getAccounts: async (search?: string, status?: string, branchId?: string): Promise<SWGlobalAccount[]> => {
    const res = await api.get('/admin/sw-global/accounts', {
      params: { search, status, branchId }
    });
    return res.data;
  },

  saveAccount: async (account: Partial<SWGlobalAccount>): Promise<SWGlobalAccount> => {
    const res = await api.post('/admin/sw-global/accounts', account);
    return res.data;
  },

  deleteAccount: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete(`/admin/sw-global/accounts/${encodeURIComponent(id)}`);
    return res.data;
  },

  bulkImportAccounts: async (rows: Partial<SWGlobalAccount>[]): Promise<{ count: number; message: string }> => {
    const res = await api.post('/admin/sw-global/accounts/bulk', { rows });
    return res.data;
  },

  getEvents: async (search?: string): Promise<SWGlobalEvent[]> => {
    const res = await api.get('/admin/sw-global/events', {
      params: { search }
    });
    return res.data;
  },

  saveEvent: async (event: Partial<SWGlobalEvent>): Promise<SWGlobalEvent> => {
    const res = await api.post('/admin/sw-global/events', event);
    return res.data;
  },

  deleteEvent: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete(`/admin/sw-global/events/${encodeURIComponent(id)}`);
    return res.data;
  },

  getLeads: async (eventId?: string, stage?: string, search?: string): Promise<SWGlobalLead[]> => {
    const res = await api.get('/admin/sw-global/leads', {
      params: { eventId, stage, search }
    });
    return res.data;
  },

  saveLead: async (lead: Partial<SWGlobalLead>): Promise<SWGlobalLead> => {
    const res = await api.post('/admin/sw-global/leads', lead);
    return res.data;
  },

  deleteLead: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete(`/admin/sw-global/leads/${encodeURIComponent(id)}`);
    return res.data;
  },

  convertLead: async (payload: {
    lead_id: string;
    account_no: string;
    client_code: string;
    occupation?: string;
    email?: string;
  }): Promise<{ accountId: string; accountNo: string; clientCode: string; leadId: string; message: string }> => {
    const res = await api.post('/admin/sw-global/leads/convert', payload);
    return res.data;
  },

  bulkImportLeads: async (rows: Partial<SWGlobalLead>[]): Promise<{ count: number; message: string }> => {
    const res = await api.post('/admin/sw-global/leads/bulk', { rows });
    return res.data;
  },

  getUploads: async (): Promise<SWGlobalUpload[]> => {
    const res = await api.get('/admin/sw-global/uploads');
    return res.data;
  },

  uploadFile: async (file: File, kind: string): Promise<SWGlobalUpload> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('kind', kind);
    const res = await api.post('/admin/sw-global/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  deleteUpload: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete(`/admin/sw-global/uploads/${encodeURIComponent(id)}`);
    return res.data;
  },

  getDownloadUrl: (id: string): string => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    return `${baseUrl}/admin/sw-global/uploads/${id}/download`;
  },

  getViewUrl: (id: string): string => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    return `${baseUrl}/admin/sw-global/uploads/${encodeURIComponent(id)}/download?inline=true`;
  }
};
