import api from './api';

export type FranchiseRow = Record<string, any>;
export type FranchiseKind = 'sales' | 'earnings' | 'expenses' | 'payments';
export interface FranchiseBootstrap {
  access: { external: boolean; canManage: boolean; canManageUsers: boolean; canWrite: boolean; canEnterSales: boolean; canSubmitFinance: boolean; canApproveSales: boolean; canApproveFinance: boolean; userId: string };
  franchises: FranchiseRow[]; products: FranchiseRow[]; plans: FranchiseRow[];
  planAssignments: FranchiseRow[]; rules: FranchiseRow[]; users: FranchiseRow[]; memberships: FranchiseRow[]; managers: FranchiseRow[]; branches: FranchiseRow[];
}
export interface FranchiseFilters { startDate: string; endDate: string; franchiseId: string; state: string; city: string; planId: string; status: string; productId: string }
export interface FranchiseDashboard {
  perspective: string; profitBasis: string;
  kpis: { totalFranchises: number; activeFranchises: number; newFranchises: number; completedOrders: number; revenue: number; profit: number;
    totalOrders:number;pendingOrders:number;
    outstandingPayouts: number; periodPayouts: number; periodReceipts?: number; topProductsByOrders: string[]; topProductsByRevenue: string[] };
  franchises: FranchiseRow[]; products: FranchiseRow[]; monthly: FranchiseRow[]; recentSales:FranchiseRow[];
}
export const franchiseService = {
  bootstrap: async () => (await api.get<FranchiseBootstrap>('/franchise/bootstrap')).data,
  dashboard: async (filters: FranchiseFilters) => (await api.get<FranchiseDashboard>('/franchise/dashboard', { params: filters })).data,
  records: async (kind: FranchiseKind) => (await api.get<FranchiseRow[]>(`/franchise/records/${kind}`)).data,
  save: async (path: string, body: FranchiseRow, edit = false) => (await api.request({ method: edit ? 'PATCH' : 'POST', url: `/franchise/${path}`, data: body })).data,
  removeSale: async (id: string) => (await api.delete(`/franchise/records/sales/${id}`)).data,
  decide: async (kind: FranchiseKind, id: string, body: FranchiseRow) => (await api.post(`/franchise/records/${kind}/${id}/decide`, body)).data,
};
