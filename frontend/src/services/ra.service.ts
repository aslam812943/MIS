import api from './api';
import type {
  RAClient,
  RATestimonial,
  RAPackage,
  RADashboardStats,
  RAPackageStat,
  RAPeriodicReport
} from '../types/ra.types';

export const raService = {
  // ── Package Catalog ───────────────────────────
  getPackages: async (activeOnly = false): Promise<RAPackage[]> => {
    const response = await api.get('/admin/ra/packages', {
      params: activeOnly ? { active: 'true' } : {}
    });
    return response.data;
  },

  createPackage: async (data: Partial<RAPackage>): Promise<RAPackage> => {
    const response = await api.post('/admin/ra/packages', data);
    return response.data.package || response.data;
  },

  updatePackage: async (id: string, data: Partial<RAPackage>): Promise<RAPackage> => {
    const response = await api.put(`/admin/ra/packages/${id}`, data);
    return response.data.package || response.data;
  },

  deletePackage: async (id: string): Promise<void> => {
    await api.delete(`/admin/ra/packages/${id}`);
  },

  // ── Dashboard & Analytics ─────────────────────
  getDashboardStats: async (branchId?: string): Promise<RADashboardStats> => {
    const response = await api.get('/admin/ra/dashboard', {
      params: branchId ? { branchId } : {}
    });
    return response.data;
  },

  // ── Clients Management ────────────────────────
  getClients: async (params?: {
    search?: string;
    branchId?: string;
    package?: string;
    kraStatus?: string;
  }): Promise<RAClient[]> => {
    const response = await api.get('/admin/ra/clients', { params });
    return response.data;
  },

  getClientById: async (id: string): Promise<RAClient> => {
    const response = await api.get(`/admin/ra/clients/${id}`);
    return response.data;
  },

  createClient: async (data: Partial<RAClient>): Promise<RAClient> => {
    const response = await api.post('/admin/ra/clients', data);
    return response.data.client || response.data;
  },

  updateClient: async (id: string, data: Partial<RAClient>): Promise<RAClient> => {
    const response = await api.put(`/admin/ra/clients/${id}`, data);
    return response.data.client || response.data;
  },

  deleteClient: async (id: string): Promise<void> => {
    await api.delete(`/admin/ra/clients/${id}`);
  },

  // ── Package Performance Report ────────────────
  getPackageReport: async (branchId?: string): Promise<Record<string, RAPackageStat>> => {
    const response = await api.get('/admin/ra/packages/report', {
      params: branchId ? { branchId } : {}
    });
    return response.data;
  },

  // ── Payments Ledger ───────────────────────────
  getPayments: async (search?: string, branchId?: string): Promise<any[]> => {
    const response = await api.get('/admin/ra/payments', {
      params: { search, branchId }
    });
    return response.data;
  },

  // ── Renewals & Expired ────────────────────────
  getRenewals: async (days = 30, branchId?: string): Promise<any[]> => {
    const response = await api.get('/admin/ra/renewals', {
      params: { days, branchId }
    });
    return response.data;
  },

  getExpired: async (branchId?: string): Promise<any[]> => {
    const response = await api.get('/admin/ra/expired', {
      params: branchId ? { branchId } : {}
    });
    return response.data;
  },

  // ── KYC / Compliance ──────────────────────────
  getKycReport: async (branchId?: string): Promise<any> => {
    const response = await api.get('/admin/ra/kyc', {
      params: branchId ? { branchId } : {}
    });
    return response.data;
  },

  // ── Testimonials Hub ──────────────────────────
  getTestimonials: async (params?: {
    search?: string;
    branchId?: string;
    clientId?: string;
    featured?: boolean;
  }): Promise<RATestimonial[]> => {
    const response = await api.get('/admin/ra/testimonials', { params });
    return response.data;
  },

  createTestimonial: async (data: Partial<RATestimonial>): Promise<RATestimonial> => {
    const response = await api.post('/admin/ra/testimonials', data);
    return response.data.testimonial || response.data;
  },

  updateTestimonial: async (id: string, data: Partial<RATestimonial>): Promise<RATestimonial> => {
    const response = await api.put(`/admin/ra/testimonials/${id}`, data);
    return response.data.testimonial || response.data;
  },

  deleteTestimonial: async (id: string): Promise<void> => {
    await api.delete(`/admin/ra/testimonials/${id}`);
  },

  // ── Periodic Reports (Weekly / Monthly) ───────
  getPeriodicReport: async (params: {
    periodType: 'weekly' | 'monthly' | 'custom';
    startDate: string;
    endDate: string;
    branchId?: string;
  }): Promise<RAPeriodicReport> => {
    const response = await api.get('/admin/ra/reports/periodic', { params });
    return response.data;
  }
};
