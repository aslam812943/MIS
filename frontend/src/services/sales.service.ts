import api from './api';

export type ProductType =
  | 'Trading and Demat'
  | 'Mutual Fund'
  | 'Unlisted Shares'
  | 'Child Demat'
  | 'Child Mutual Fund'
  | 'IEPF'
  | 'SW Global';

export type SaleStatus = 'Pending' | 'Completed' | 'Cancelled';

export interface Sale {
  id: string;
  client_name: string;
  client_contact?: string | null;
  product_type: ProductType;
  sale_value: number;
  units?: number | null;
  sale_date: string;
  status: SaleStatus;
  remarks?: string | null;
  branch_id?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  branches?: { name: string };
  profiles?: { full_name: string | null; email: string };
}

export const PRODUCT_TYPES: ProductType[] = [
  'Trading and Demat', 'Mutual Fund', 'Unlisted Shares',
  'Child Demat', 'Child Mutual Fund', 'IEPF', 'SW Global',
];

export const SALE_STATUSES: SaleStatus[] = ['Pending', 'Completed', 'Cancelled'];

export const salesService = {
  getSales: async (filters: { status?: string; productType?: string; branchId?: string; search?: string } = {}) => {
    const response = await api.get('/admin/sales', { params: filters });
    return response.data as Sale[];
  },

  createSale: async (data: Partial<Sale>) => {
    const response = await api.post('/admin/sales', data);
    return response.data as Sale;
  },

  updateSale: async (id: string, data: Partial<Sale>) => {
    const response = await api.patch(`/admin/sales/${id}`, data);
    return response.data as Sale;
  },

  deleteSale: async (id: string) => {
    const response = await api.delete(`/admin/sales/${id}`);
    return response.data;
  },

  getDashboardData: async (branchId?: string, startDate?: string, endDate?: string) => {
    const response = await api.get('/admin/sales/dashboard', { params: { branchId, startDate, endDate } });
    return response.data;
  },
};
