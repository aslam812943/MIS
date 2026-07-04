import api from './api';

export const settlementService = {
  /* ═══════════════════════════════════════════════
     PART 5: DASHBOARD AGGREGATIONS
     ═══════════════════════════════════════════════ */

  /**
   * Fetches dashboard metrics.
   */
  getDashboardData: async (branchId?: string, startDate?: string, endDate?: string) => {
    const response = await api.get('/admin/settlements/dashboard', {
      params: { branchId, startDate, endDate }
    });
    return response.data;
  },

  /* ═══════════════════════════════════════════════
     PART 1: PAY-IN / PAY-OUT SECURITIES
     ═══════════════════════════════════════════════ */

  /**
   * Fetches Pay-in/Pay-out records with optional filters.
   */
  getPayInPayOutRecords: async (filters: { status?: string; branchId?: string; search?: string } = {}) => {
    const response = await api.get('/admin/settlements/payin-payout', {
      params: filters
    });
    return response.data;
  },

  /**
   * Creates a new Pay-in/Pay-out record.
   */
  createPayInPayOutRecord: async (recordData: any) => {
    const response = await api.post('/admin/settlements/payin-payout', recordData);
    return response.data;
  },

  /**
   * Updates an existing Pay-in/Pay-out record.
   */
  updatePayInPayOutRecord: async (id: string, recordData: any) => {
    const response = await api.patch(`/admin/settlements/payin-payout/${id}`, recordData);
    return response.data;
  },

  /* ═══════════════════════════════════════════════
     PART 2: CLIENT SERVICE REQUESTS
     ═══════════════════════════════════════════════ */

  /**
   * Fetches Client Requests with optional filters.
   */
  getClientRequestRecords: async (filters: { status?: string; branchId?: string; search?: string } = {}) => {
    const response = await api.get('/admin/settlements/client-requests', {
      params: filters
    });
    return response.data;
  },

  /**
   * Creates a new Client Request ticket.
   */
  createClientRequestRecord: async (recordData: any) => {
    const response = await api.post('/admin/settlements/client-requests', recordData);
    return response.data;
  },

  /**
   * Updates an existing Client Request ticket.
   */
  updateClientRequestRecord: async (id: string, recordData: any) => {
    const response = await api.patch(`/admin/settlements/client-requests/${id}`, recordData);
    return response.data;
  },

  /* ═══════════════════════════════════════════════
     PART 3: IPO ALLOCATION
     ═══════════════════════════════════════════════ */

  /**
   * Fetches IPO Allocation records with optional filters.
   */
  getIpoAllocationRecords: async (filters: { status?: string; branchId?: string; search?: string } = {}) => {
    const response = await api.get('/admin/settlements/ipo-allocation', {
      params: filters
    });
    return response.data;
  },

  /**
   * Creates a new IPO Allocation record.
   */
  createIpoAllocationRecord: async (recordData: any) => {
    const response = await api.post('/admin/settlements/ipo-allocation', recordData);
    return response.data;
  },

  /**
   * Updates an existing IPO Allocation record.
   */
  updateIpoAllocationRecord: async (id: string, recordData: any) => {
    const response = await api.patch(`/admin/settlements/ipo-allocation/${id}`, recordData);
    return response.data;
  },

  /* ═══════════════════════════════════════════════
     PART 4: CORPORATE ACTIONS ALLOCATION
     ═══════════════════════════════════════════════ */

  /**
   * Fetches Corporate Action records with optional filters.
   */
  getCorporateActionRecords: async (filters: { eligible?: string; branchId?: string; search?: string } = {}) => {
    const response = await api.get('/admin/settlements/corporate-actions', {
      params: filters
    });
    return response.data;
  },

  /**
   * Creates a new Corporate Action record.
   */
  createCorporateActionRecord: async (recordData: any) => {
    const response = await api.post('/admin/settlements/corporate-actions', recordData);
    return response.data;
  },

  /**
   * Updates an existing Corporate Action record.
   */
  updateCorporateActionRecord: async (id: string, recordData: any) => {
    const response = await api.patch(`/admin/settlements/corporate-actions/${id}`, recordData);
    return response.data;
  }
};

export default settlementService;
