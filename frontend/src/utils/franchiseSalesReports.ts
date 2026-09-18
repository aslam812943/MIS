import type { FranchiseSale } from '../services/franchise.service';
export type SalesPeriod = 'all' | 'week' | 'month' | 'year' | 'custom';
export function periodRange(period: SalesPeriod, anchor: string): { start: string; end: string } {
  if (period === 'all' || period === 'custom') return { start: '', end: '' };
  const date = new Date(`${anchor}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return { start: '', end: '' };
  let start = new Date(date), end = new Date(date);
  if (period === 'week') { start.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7); end = new Date(start); end.setUTCDate(start.getUTCDate() + 6); }
  if (period === 'month') { start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)); end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)); }
  if (period === 'year') { start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1)); end = new Date(Date.UTC(date.getUTCFullYear(), 11, 31)); }
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
export function filterSales(sales: FranchiseSale[], filters: { branch: string; product: string; start: string; end: string; search: string }) {
  return sales.filter(s => (!filters.branch || s.franchise_id === filters.branch) && (!filters.product || s.product === filters.product) && (!filters.start || s.sale_date >= filters.start) && (!filters.end || s.sale_date <= filters.end) && (!filters.search || s.customer_name.toLowerCase().includes(filters.search.trim().toLowerCase()))).sort((a,b) => b.sale_date.localeCompare(a.sale_date));
}
export function summarizeSales(sales: FranchiseSale[], key: (sale: FranchiseSale) => string) {
  const groups = new Map<string, { label: string; count: number; cents: number }>();
  for (const sale of sales) { const label = key(sale); const group = groups.get(label) || { label, count: 0, cents: 0 }; group.count++; group.cents += Math.round(Number(sale.amount) * 100); groups.set(label, group); }
  return [...groups.values()].map(g => ({ label: g.label, count: g.count, amount: g.cents / 100 }));
}
export const salesTotal = (sales: FranchiseSale[]) => sales.reduce((sum, sale) => sum + Math.round(Number(sale.amount) * 100), 0) / 100;
