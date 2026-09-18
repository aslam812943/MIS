import api from './api';

export interface FranchiseRecord {
  id: string;
  code?: string;
  location: string;
  name: string;
  phone: string;
  email: string;
  plan: string;
  office: 'Yes' | 'No';
  has_office?: boolean;
  sqft: string;
  office_sqft?: number | null;
  registered: string;
  registered_on?: string;
  sales: string[]; // Products configured during franchise setup.
  saleProducts?: string[]; // One entry per actual saved sale.
  saleCount?: number;
  saleRevenue?: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PlanRecord {
  id: string;
  name: string;
  description?: string | null;
  joining_fee?: number;
  recurring_fee?: number;
  billing_frequency?: 'None' | 'Monthly' | 'Yearly';
  active: boolean;
  franchisesCount?: number;
  created_at?: string;
}

export interface OverviewKPIs {
  totalFranchises: number;
  withOffice: number;
  productsSold: number;
  productTypesSold: number;
  saleRevenue?: number;
}

export interface ProductSalesMixItem {
  product: string;
  count: number;
  percentage: number;
}

export interface OfficeFootprintItem {
  id: string;
  location: string;
  name: string;
  sqft: number;
}

export interface FranchiseOverview {
  kpis: OverviewKPIs;
  productSalesMix: ProductSalesMixItem[];
  officeFootprint: OfficeFootprintItem[];
  directoryPreview: FranchiseRecord[];
  totalFranchises: number;
  products: string[];
}

export interface ProductSummaryItem {
  product: string;
  sold: number;
  franchises: string;
}

export interface ProductsSummaryResponse {
  totalSales: number;
  summary: ProductSummaryItem[];
  products: string[];
}

export interface FranchiseBootstrap {
  access: {
    userId: string;
    role: string;
    department: string | null;
    external: boolean;
    ids: string[] | null;
    canManage: boolean;
    canManageUsers: boolean;
    canCreatePlans: boolean;
    canWrite: boolean;
    canViewOverview: boolean;
  };
  overview: FranchiseOverview;
  directory: FranchiseRecord[];
  plans: PlanRecord[];
  products: string[];
}

export interface FranchiseSale {
  id: string;
  franchise_id: string;
  product: string;
  customer_name: string;
  amount: number;
  sale_date: string;
}

export const franchiseService = {
  bulkCreateSales: async (rows: Record<string, unknown>[]) => (await api.post<{inserted:number;failed:Array<{row:number;error:string}>;sales:FranchiseSale[]}>('/franchise/sales/bulk',{rows})).data,
  getSales: async () => (await api.get<FranchiseSale[]>('/franchise/sales')).data,
  createSale: async (data: Omit<FranchiseSale, 'id'>) => (await api.post<FranchiseSale>('/franchise/sales',data)).data,
  bootstrap: async () => (await api.get<FranchiseBootstrap>('/franchise/bootstrap')).data,
  getOverview: async () => (await api.get<FranchiseOverview>('/franchise/overview')).data,
  getDirectory: async (q?: string) => (await api.get<FranchiseRecord[]>('/franchise/directory', { params: { q } })).data,
  getProductsSummary: async () => (await api.get<ProductsSummaryResponse>('/franchise/products-summary')).data,
  getPlans: async () => (await api.get<PlanRecord[]>('/franchise/plans')).data,
  createPlan: async (data: Partial<PlanRecord>) => (await api.post<PlanRecord>('/franchise/plans', data)).data,
  updatePlan: async (id: string, data: Partial<PlanRecord>) => (await api.patch<PlanRecord>(`/franchise/plans/${id}`, data)).data,
  deletePlan: async (id: string) => (await api.delete<{ success: boolean; message: string }>(`/franchise/plans/${id}`)).data,
  createFranchise: async (data: Partial<FranchiseRecord>) => (await api.post<{ success: boolean; franchise: FranchiseRecord; emailSent: boolean }>('/franchise/franchises', data)).data,
  updateFranchise: async (id: string, data: Partial<FranchiseRecord>) => (await api.patch<FranchiseRecord>(`/franchise/franchises/${id}`, data)).data,
  deleteFranchise: async (id: string) => (await api.delete<{ success: boolean; message: string }>(`/franchise/franchises/${id}`)).data,
  enableRoleLogins: async (id: string) => (await api.post<{ success: boolean; email: string }>(`/franchise/franchises/${id}/enable-logins`)).data,
  resendCredentials: async (id: string) => (await api.post<{ success: boolean; email: string; sent: boolean }>(`/franchise/franchises/${id}/send-credentials`)).data,
};
