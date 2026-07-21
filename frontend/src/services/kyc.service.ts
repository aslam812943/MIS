import api from './api';

export const kycService = {
  /**
   * Fetches KYC dashboard aggregated metrics.
   */
  getDashboardData: async (branchId?: string, startDate?: string, endDate?: string) => {
    const response = await api.get('/admin/kyc/dashboard', {
      params: { branchId, startDate, endDate }
    });
    return response.data;
  },

  /**
   * Uploads supporting documents (Death Certificate / Modification Documents)
   */
  uploadDocument: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/admin/kyc/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data; // returns { fileUrl }
  },

  // 1. New Account Opening Verification
  getNewAccounts: async (filters: { status?: string; branchId?: string; search?: string } = {}) => {
    const response = await api.get('/admin/kyc/new-accounts', { params: filters });
    return response.data;
  },
  createNewAccount: async (recordData: any) => {
    const response = await api.post('/admin/kyc/new-accounts', recordData);
    return response.data;
  },
  updateNewAccount: async (id: string, recordData: any) => {
    const response = await api.patch(`/admin/kyc/new-accounts/${id}`, recordData);
    return response.data;
  },

  // 2. UCC Allotment
  getUCCAllotments: async (filters: { status?: string; branchId?: string; search?: string } = {}) => {
    const response = await api.get('/admin/kyc/ucc-allotments', { params: filters });
    return response.data;
  },
  createUCCAllotment: async (recordData: any) => {
    const response = await api.post('/admin/kyc/ucc-allotments', recordData);
    return response.data;
  },
  updateUCCAllotment: async (id: string, recordData: any) => {
    const response = await api.patch(`/admin/kyc/ucc-allotments/${id}`, recordData);
    return response.data;
  },

  // 3. CKYC / KRA Updation
  getRegistryUpdates: async (filters: { status?: string; branchId?: string; search?: string } = {}) => {
    const response = await api.get('/admin/kyc/registry-updates', { params: filters });
    return response.data;
  },
  createRegistryUpdate: async (recordData: any) => {
    const response = await api.post('/admin/kyc/registry-updates', recordData);
    return response.data;
  },
  updateRegistryUpdate: async (id: string, recordData: any) => {
    const response = await api.patch(`/admin/kyc/registry-updates/${id}`, recordData);
    return response.data;
  },

  // 4. AP / Remisier Sharing Updation
  getAPSharings: async (filters: { status?: string; branchId?: string; search?: string } = {}) => {
    const response = await api.get('/admin/kyc/ap-sharings', { params: filters });
    return response.data;
  },
  createAPSharing: async (recordData: any) => {
    const response = await api.post('/admin/kyc/ap-sharings', recordData);
    return response.data;
  },
  updateAPSharing: async (id: string, recordData: any) => {
    const response = await api.patch(`/admin/kyc/ap-sharings/${id}`, recordData);
    return response.data;
  },

  // 5. Demise Reporting
  getDemiseReports: async (filters: { status?: string; branchId?: string; search?: string } = {}) => {
    const response = await api.get('/admin/kyc/demise-reports', { params: filters });
    return response.data;
  },
  createDemiseReport: async (recordData: any) => {
    const response = await api.post('/admin/kyc/demise-reports', recordData);
    return response.data;
  },
  updateDemiseReport: async (id: string, recordData: any) => {
    const response = await api.patch(`/admin/kyc/demise-reports/${id}`, recordData);
    return response.data;
  },

  // 6. AP Code Updation to Exchange
  getAPCodes: async (filters: { status?: string; branchId?: string; search?: string } = {}) => {
    const response = await api.get('/admin/kyc/ap-codes', { params: filters });
    return response.data;
  },
  createAPCode: async (recordData: any) => {
    const response = await api.post('/admin/kyc/ap-codes', recordData);
    return response.data;
  },
  updateAPCode: async (id: string, recordData: any) => {
    const response = await api.patch(`/admin/kyc/ap-codes/${id}`, recordData);
    return response.data;
  },

  // 7. Client Onboarding Communication
  getCommunications: async (filters: { status?: string; branchId?: string; search?: string } = {}) => {
    const response = await api.get('/admin/kyc/communications', { params: filters });
    return response.data;
  },
  createCommunication: async (recordData: any) => {
    const response = await api.post('/admin/kyc/communications', recordData);
    return response.data;
  },
  updateCommunication: async (id: string, recordData: any) => {
    const response = await api.patch(`/admin/kyc/communications/${id}`, recordData);
    return response.data;
  },

  // 8. Modification Requests
  getModifications: async (filters: { status?: string; branchId?: string; search?: string } = {}) => {
    const response = await api.get('/admin/kyc/modifications', { params: filters });
    return response.data;
  },
  createModification: async (recordData: any) => {
    const response = await api.post('/admin/kyc/modifications', recordData);
    return response.data;
  },
  updateModification: async (id: string, recordData: any) => {
    const response = await api.patch(`/admin/kyc/modifications/${id}`, recordData);
    return response.data;
  },

  // 9. Reactivation
  getReactivations: async (filters: { status?: string; branchId?: string; search?: string } = {}) => {
    const response = await api.get('/admin/kyc/reactivations', { params: filters });
    return response.data;
  },
  createReactivation: async (recordData: any) => {
    const response = await api.post('/admin/kyc/reactivations', recordData);
    return response.data;
  },
  updateReactivation: async (id: string, recordData: any) => {
    const response = await api.patch(`/admin/kyc/reactivations/${id}`, recordData);
    return response.data;
  },

  // 10. Account Closure / UCC Closure
  getClosures: async (filters: { status?: string; branchId?: string; search?: string } = {}) => {
    const response = await api.get('/admin/kyc/closures', { params: filters });
    return response.data;
  },
  createClosure: async (recordData: any) => {
    const response = await api.post('/admin/kyc/closures', recordData);
    return response.data;
  },
  updateClosure: async (id: string, recordData: any) => {
    const response = await api.patch(`/admin/kyc/closures/${id}`, recordData);
    return response.data;
  },

  // 11. Exchange Compliance Status
  getCompliances: async (filters: { status?: string; branchId?: string; search?: string } = {}) => {
    const response = await api.get('/admin/kyc/compliance', { params: filters });
    return response.data;
  },
  createCompliance: async (recordData: any) => {
    const response = await api.post('/admin/kyc/compliance', recordData);
    return response.data;
  },
  updateCompliance: async (id: string, recordData: any) => {
    const response = await api.patch(`/admin/kyc/compliance/${id}`, recordData);
    return response.data;
  },

  /**
   * Deletes an entry from any KYC sheet. `sheet` is the URL slug used by the
   * matching get / create / update calls above (e.g. 'new-accounts').
   */
  deleteEntry: async (sheet: string, id: string) => {
    const response = await api.delete(`/admin/kyc/${sheet}/${id}`);
    return response.data;
  },

  bulkImport: async (sheet: string, records: any[]) => {
    const response = await api.post(`/admin/kyc/bulk/${sheet}`, { records });
    return response.data;
  },

  bulkUpdate: async (sheet: string, ids: string[], updates: any) => {
    const response = await api.patch(`/admin/kyc/bulk/${sheet}`, { ids, updates });
    return response.data;
  }
};

export default kycService;
