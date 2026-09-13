import api from './api';
import type { PrivilegeAccount, PrivilegeUpload, PrivilegeDashboardStats } from '../types/privilege.types';

export const privilegeService = {
  getDashboardStats: async (branchId?: string): Promise<PrivilegeDashboardStats> => {
    const res = await api.get('/admin/privilege/dashboard', {
      params: branchId ? { branchId } : {}
    });
    return res.data;
  },

  getAccounts: async (search?: string, branchId?: string): Promise<PrivilegeAccount[]> => {
    const res = await api.get('/admin/privilege/accounts', {
      params: { search, branchId }
    });
    return res.data;
  },

  saveAccount: async (account: Partial<PrivilegeAccount>): Promise<{ message: string; account: PrivilegeAccount }> => {
    const res = await api.post('/admin/privilege/accounts', account);
    return res.data;
  },

  deleteAccount: async (code: string): Promise<{ message: string; code: string }> => {
    const res = await api.delete(`/admin/privilege/accounts/${encodeURIComponent(code)}`);
    return res.data;
  },

  bulkImportAccounts: async (accounts: Partial<PrivilegeAccount>[]): Promise<{ message: string; saved: number }> => {
    const res = await api.post('/admin/privilege/accounts/bulk', accounts);
    return res.data;
  },

  getUploads: async (): Promise<PrivilegeUpload[]> => {
    const res = await api.get('/admin/privilege/uploads');
    return res.data;
  },

  uploadFile: async (file: File, kind: string): Promise<{ message: string; saved: boolean; file: PrivilegeUpload }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('kind', kind);
    const res = await api.post('/admin/privilege/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  deleteUpload: async (id: string): Promise<{ message: string; id: string }> => {
    const res = await api.delete(`/admin/privilege/uploads/${encodeURIComponent(id)}`);
    return res.data;
  },

  getDownloadUrl: (id: string): string => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    return `${baseUrl}/admin/privilege/uploads/${id}/download`;
  }
};
