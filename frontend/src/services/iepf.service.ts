import api from './api';

export const iepfService = {
  /**
   * Fetches claims with optional filters.
   */
  getClaims: async (filters: { status?: string; branchId?: string; search?: string } = {}) => {
    const response = await api.get('/admin/iepf/claims', {
      params: filters
    });
    return response.data;
  },

  /**
   * Creates a new claim.
   */
  createClaim: async (claimData: any) => {
    const response = await api.post('/admin/iepf/claims', claimData);
    return response.data;
  },

  /**
   * Updates an existing claim.
   */
  updateClaim: async (id: string, claimData: any) => {
    const response = await api.patch(`/admin/iepf/claims/${id}`, claimData);
    return response.data;
  },

  /**
   * Fetches dashboard metrics (KPIs and graphs).
   */
  getDashboardData: async (branchId?: string, startDate?: string, endDate?: string) => {
    const response = await api.get('/admin/iepf/dashboard', {
      params: { branchId, startDate, endDate }
    });
    return response.data;
  },

  /**
   * Fetches IEPF staff members.
   */
  getIEPFStaff: async () => {
    const response = await api.get('/admin/iepf/staff');
    return response.data;
  }
};
