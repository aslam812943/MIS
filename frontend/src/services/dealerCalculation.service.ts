import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BASE = `${API_URL}/dealer-calculation`;

export interface MasterClient {
  code: string;
  name?: string;
  rm?: string;
  dealer?: string;
  branch?: string;
  createdAt?: string;
  updatedAt?: string;
  codeNorm?: string;
}

export interface TargetsData {
  id?: number;
  monthly?: number;
  dealerMonthly?: Record<string, number>;
  kotakSharePct?: number;
  rmSplitPct?: number;
  dealerSalary?: Record<string, number>;
  incentiveMultiplier?: number;
}

export interface DashboardSummary {
  hasData: boolean;
  latestDate?: string;
  prevDate?: string;
  period?: string;
  kpi?: {
    today: number;
    yesterday: number | null;
    mtd: number;
    qtd: number;
    ytd: number;
    monthlyTarget: number;
  };
  dealerRows?: Array<{ dealer: string; value: number }>;
  topClients?: Array<{ code: string; name: string; value: number }>;
  trend?: Array<{ date: string; value: number }>;
}

export interface MisPersonSummary {
  dealer: string;
  target: number;
  dailyTarget: number;
  tradingDaysInMonth: number;
  tradingDaysSoFar: number;
  mtdRevenue: number;
  dailyAvgAchieved: number;
  dailyShortfall: number | null;
  yesterdayRevenue: number;
  clientsMapped: number;
  tradedClientsCount: number;
  tradedClients: Array<{ code: string; name: string; role: string; netBrokerage: number }>;
  dormantClientsCount: number;
  dormantClients: Array<{ code: string; name: string; role: string; lastMonthNetBrokerage: number }>;
  salary: number | null;
  incentiveMultiplier: number;
  multiplier: number | null;
  incentiveEligible: boolean;
}

export interface MisSummaryResponse {
  latestDate?: string;
  prevDate?: string;
  prevMonthStart?: string;
  rows?: MisPersonSummary[];
  dealer?: string;
  target?: number;
  dailyTarget?: number;
  tradingDaysInMonth?: number;
  tradingDaysSoFar?: number;
  mtdRevenue?: number;
  dailyAvgAchieved?: number;
  dailyShortfall?: number | null;
  yesterdayRevenue?: number;
  clientsMapped?: number;
  tradedClientsCount?: number;
  tradedClients?: Array<{ code: string; name: string; role: string; netBrokerage: number }>;
  dormantClientsCount?: number;
  dormantClients?: Array<{ code: string; name: string; role: string; lastMonthNetBrokerage: number }>;
  salary?: number | null;
  incentiveMultiplier?: number;
  multiplier?: number | null;
  incentiveEligible?: boolean;
}

export const dealerCalculationService = {
  // Master Clients
  async getMaster(): Promise<MasterClient[]> {
    const res = await axios.get<MasterClient[]>(`${BASE}/master`, { withCredentials: true });
    return res.data;
  },

  async replaceMaster(records: MasterClient[]): Promise<{ ok: boolean; count: number }> {
    const res = await axios.put<{ ok: boolean; count: number }>(`${BASE}/master`, records, { withCredentials: true });
    return res.data;
  },

  async bulkUploadMaster(fileName: string, records: MasterClient[]): Promise<{ ok: boolean; createdCount: number; updatedCount: number }> {
    const res = await axios.post<{ ok: boolean; createdCount: number; updatedCount: number }>(
      `${BASE}/master/bulk`,
      { fileName, records },
      { withCredentials: true }
    );
    return res.data;
  },

  async rollbackMaster(uploadId: string): Promise<{ ok: boolean; message: string }> {
    const res = await axios.post<{ ok: boolean; message: string }>(
      `${BASE}/master/rollback`,
      { uploadId },
      { withCredentials: true }
    );
    return res.data;
  },

  async getRecentUploads(): Promise<any[]> {
    const res = await axios.get<any[]>(`${BASE}/master/recent-uploads`, { withCredentials: true });
    return res.data;
  },

  async getAddedDates(): Promise<string[]> {
    const res = await axios.get<string[]>(`${BASE}/master/added-dates`, { withCredentials: true });
    return res.data;
  },

  async getAddedDateClients(date: string): Promise<MasterClient[]> {
    const res = await axios.get<MasterClient[]>(`${BASE}/master/added-dates/${encodeURIComponent(date)}`, { withCredentials: true });
    return res.data;
  },

  // Dealers & RMs
  async getDealers(): Promise<string[]> {
    const res = await axios.get<string[]>(`${BASE}/dealers`, { withCredentials: true });
    return res.data;
  },

  async replaceDealers(names: string[]): Promise<{ ok: boolean; count: number }> {
    const res = await axios.put<{ ok: boolean; count: number }>(`${BASE}/dealers`, names, { withCredentials: true });
    return res.data;
  },

  async getRms(): Promise<string[]> {
    const res = await axios.get<string[]>(`${BASE}/rms`, { withCredentials: true });
    return res.data;
  },

  async replaceRms(names: string[]): Promise<{ ok: boolean; count: number }> {
    const res = await axios.put<{ ok: boolean; count: number }>(`${BASE}/rms`, names, { withCredentials: true });
    return res.data;
  },

  async getRmsSummary(period?: string, from?: string, to?: string, rm?: string): Promise<{ rows: Array<{ rm: string; netBrokerage: number; tradedClients?: number; netRevenue?: number }> }> {
    const params = new URLSearchParams();
    if (period) params.set('period', period);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (rm) params.set('rm', rm);
    const res = await axios.get<any>(`${BASE}/rms/summary?${params.toString()}`, { withCredentials: true });
    if (Array.isArray(res.data)) return { rows: res.data };
    return res.data;
  },

  // Targets
  async getTargets(): Promise<TargetsData> {
    const res = await axios.get<TargetsData>(`${BASE}/targets`, { withCredentials: true });
    return res.data;
  },

  async updateTargets(data: TargetsData): Promise<any> {
    const res = await axios.put<any>(`${BASE}/targets`, data, { withCredentials: true });
    return res.data;
  },

  // Daily Records
  async getDaily(from?: string, to?: string): Promise<Record<string, Array<{ code: string; name: string; netBrok: number; source: string }>>> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await axios.get(`${BASE}/daily?${params.toString()}`, { withCredentials: true });
    return res.data;
  },

  async getDailyDates(): Promise<Array<{ date: string; count: number; sources: string[] }>> {
    const res = await axios.get(`${BASE}/daily/dates`, { withCredentials: true });
    return res.data;
  },

  async getDailyByDate(date: string, source?: string): Promise<Array<{ code: string; name: string; netBrok: number; source: string }>> {
    const qs = source ? `?source=${encodeURIComponent(source)}` : '';
    const res = await axios.get(`${BASE}/daily/${encodeURIComponent(date)}${qs}`, { withCredentials: true });
    return res.data;
  },

  async getDailyClient(code: string): Promise<Array<{ id: string; date: string; code: string; name: string; netBrok: number; source: string }>> {
    const res = await axios.get(`${BASE}/daily/client/${encodeURIComponent(code)}`, { withCredentials: true });
    return res.data;
  },

  async upsertDaily(date: string, records: Array<{ code: string; name?: string; netBrok: number; source: string }>): Promise<{ ok: boolean; count: number }> {
    const res = await axios.put(`${BASE}/daily/${encodeURIComponent(date)}`, records, { withCredentials: true });
    return res.data;
  },

  async deleteDaily(date: string, source?: string): Promise<{ ok: boolean }> {
    const qs = source ? `?source=${encodeURIComponent(source)}` : '';
    const res = await axios.delete(`${BASE}/daily/${encodeURIComponent(date)}${qs}`, { withCredentials: true });
    return res.data;
  },

  // Debit Records
  async getDebit(from?: string, to?: string): Promise<Record<string, Array<{ code: string; name: string; debit: number }>>> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await axios.get(`${BASE}/debit?${params.toString()}`, { withCredentials: true });
    return res.data;
  },

  async getDebitDates(): Promise<Array<{ date: string; count: number }>> {
    const res = await axios.get(`${BASE}/debit/dates`, { withCredentials: true });
    return res.data;
  },

  async getDebitByDate(date: string): Promise<Array<{ code: string; name: string; debit: number }>> {
    const res = await axios.get(`${BASE}/debit/${encodeURIComponent(date)}`, { withCredentials: true });
    return res.data;
  },

  async upsertDebit(date: string, records: Array<{ code: string; name?: string; debit: number }>): Promise<{ ok: boolean; count: number }> {
    const res = await axios.put(`${BASE}/debit/${encodeURIComponent(date)}`, records, { withCredentials: true });
    return res.data;
  },

  async deleteDebit(date: string): Promise<{ ok: boolean }> {
    const res = await axios.delete(`${BASE}/debit/${encodeURIComponent(date)}`, { withCredentials: true });
    return res.data;
  },

  async getDebitLatest(): Promise<Record<string, { name: string; debit: number; date: string }>> {
    const res = await axios.get(`${BASE}/debit/latest`, { withCredentials: true });
    return res.data;
  },

  // Dashboard & MIS Summaries
  async getDashboardSummary(period: string = 'month'): Promise<DashboardSummary> {
    const res = await axios.get<DashboardSummary>(`${BASE}/dashboard/summary?period=${encodeURIComponent(period)}`, { withCredentials: true });
    return res.data;
  },

  async getMisSummary(): Promise<MisSummaryResponse> {
    const res = await axios.get<MisSummaryResponse>(`${BASE}/mis/summary`, { withCredentials: true });
    return res.data;
  },

  async getReportsDealers(period?: string, from?: string, to?: string, dealer?: string, rm?: string): Promise<{ from: string | null; to: string | null; monthComparison: boolean; rows: any[] }> {
    const params = new URLSearchParams();
    if (period) params.set('period', period);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (dealer) params.set('dealer', dealer);
    if (rm) params.set('rm', rm);
    const res = await axios.get<{ from: string | null; to: string | null; monthComparison: boolean; rows: any[] }>(`${BASE}/reports/dealers?${params.toString()}`, { withCredentials: true });
    return res.data;
  },

  async getBrokerageByClient(period?: string, from?: string, to?: string, dealer?: string, rm?: string): Promise<{ rows: Array<{ code: string; name?: string; dealer?: string; rm?: string; value: number; totalBrok?: number }> }> {
    const params = new URLSearchParams();
    if (period) params.set('period', period);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (dealer) params.set('dealer', dealer);
    if (rm) params.set('rm', rm);
    const res = await axios.get<any>(`${BASE}/brokerage/by-client?${params.toString()}`, { withCredentials: true });
    if (Array.isArray(res.data)) return { rows: res.data };
    return res.data;
  },

  // Tasks
  async getTasks(dealer: string, month: string): Promise<any[]> {
    const res = await axios.get<any[]>(`${BASE}/tasks?dealer=${encodeURIComponent(dealer)}&month=${encodeURIComponent(month)}`, { withCredentials: true });
    return res.data;
  },

  async upsertTask(dealer: string, month: string, slot: number, text: string, done: boolean): Promise<any> {
    const res = await axios.put<any>(`${BASE}/tasks`, { dealer, month, slot, text, done }, { withCredentials: true });
    return res.data;
  },

  // Holidays
  async getHolidays(): Promise<Array<{ date: string; name: string }>> {
    const res = await axios.get<Array<{ date: string; name: string }>>(`${BASE}/holidays`, { withCredentials: true });
    return res.data;
  },

  async replaceHolidays(holidays: Array<{ date: string; name: string }>): Promise<{ ok: boolean; count: number }> {
    const res = await axios.put<{ ok: boolean; count: number }>(`${BASE}/holidays`, holidays, { withCredentials: true });
    return res.data;
  },

  // Users
  async getUsers(): Promise<any[]> {
    const res = await axios.get<any[]>(`${BASE}/users`, { withCredentials: true });
    return res.data;
  },

  async createUser(username: string, password: string, role: string = 'VIEWER'): Promise<any> {
    const res = await axios.post<any>(`${BASE}/users`, { username, password, role }, { withCredentials: true });
    return res.data;
  },

  async deleteUser(id: string): Promise<{ ok: boolean }> {
    const res = await axios.delete<{ ok: boolean }>(`${BASE}/users/${encodeURIComponent(id)}`, { withCredentials: true });
    return res.data;
  },

  async changePassword(newPassword: string, id?: string): Promise<{ ok: boolean }> {
    const res = await axios.put<{ ok: boolean }>(`${BASE}/users/password`, { id, newPassword }, { withCredentials: true });
    return res.data;
  },

  async getViewerScope(): Promise<{ kind: 'dealer' | 'rm'; name: string }> {
    const res = await axios.get<{ kind: 'dealer' | 'rm'; name: string }>(`${BASE}/viewer-scope`, { withCredentials: true });
    return res.data;
  },
};
