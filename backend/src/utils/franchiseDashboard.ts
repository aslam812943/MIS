type Row = Record<string, any>;
type Filters = { start: string; end: string; franchiseId?: string; state?: string; city?: string; planId?: string; status?: string; productId?: string };
const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export function buildFranchiseDashboard(input: { franchises: Row[]; products: Row[]; sales: Row[]; earnings: Row[]; expenses: Row[]; payments: Row[]; external: boolean; filters: Filters }) {
  const { filters: f, external } = input;
  const during = (date: string) => date >= f.start && date <= f.end;
  const franchises = input.franchises.filter(x => (!f.franchiseId || x.id === f.franchiseId) && (!f.state || x.state === f.state) && (!f.city || x.city === f.city) && (!f.planId || x.plan_id === f.planId) && (!f.status || x.status === f.status));
  const ids = new Set(franchises.map(x => x.id));
  const owned = (x: Row) => ids.has(x.franchise_id);
  const product = (x: Row) => !f.productId || x.product_id === f.productId;
  const sales = input.sales.filter(x => owned(x) && product(x) && x.status === 'Completed' && during(x.completed_date));
  const enteredSales=input.sales.filter(x=>owned(x)&&product(x)&&during(x.completed_date || x.sale_date));
  const earnings = input.earnings.filter(x => owned(x) && product(x) && x.status === 'Approved');
  const periodEarnings = earnings.filter(x => during(x.recognition_date));
  const earningIds = new Set(earnings.map(x => x.id));
  const payments = input.payments.filter(x => owned(x) && earningIds.has(x.earning_id) && x.status === 'Verified');
  // Operating expenses have no product attribution. A product filter shows
  // product contribution only; whole-franchise expenses are not arbitrarily allocated.
  const expenses = f.productId ? [] : input.expenses.filter(x => owned(x) && x.status === 'Approved' && during(x.expense_date));
  const sum = (rows: Row[], field: string) => money(rows.reduce((total, x) => total + Number(x[field] || 0), 0));
  const revenueField = external ? 'franchise_amount' : 'company_revenue';
  const breakdown = franchises.map(x => {
    const e = periodEarnings.filter(y => y.franchise_id === x.id);
    const costs = expenses.filter(y => y.franchise_id === x.id && y.owner === (external ? 'Franchise' : 'Company'));
    const revenue = sum(e, revenueField), commission = external ? 0 : sum(e, 'franchise_amount');
    const operatingCosts = sum(costs, 'amount');
    return { id: x.id, code: x.code, name: x.name, city: x.city, plan: x.plan_name, orders: sales.filter(y => y.franchise_id === x.id).length,
      revenue, ...(external ? {} : { commission }), costs: operatingCosts, profit: money(revenue - commission - operatingCosts) };
  });
  const productBreakdown = input.products.filter(productRow => !f.productId || productRow.id === f.productId).map(x => ({ id: x.id, name: x.name,
    orders: sales.filter(y => y.product_id === x.id).length, revenue: sum(periodEarnings.filter(y => y.product_id === x.id), revenueField) }));
  const maxOrders = Math.max(0, ...productBreakdown.map(x => x.orders)), maxRevenue = Math.max(0, ...productBreakdown.map(x => x.revenue));
  const monthly: Record<string, { month: string; orders: number; revenue: number }> = {};
  const bucket = (date: string) => monthly[date.slice(0, 7)] ||= { month: date.slice(0, 7), orders: 0, revenue: 0 };
  for (const s of sales) bucket(s.completed_date).orders++;
  for (const e of periodEarnings) bucket(e.recognition_date).revenue = money(bucket(e.recognition_date).revenue + Number(e[revenueField]));
  const outstanding = money(sum(earnings, 'franchise_amount') - sum(payments.filter(x => x.direction === 'Payout'), 'amount'));
  return { filters: f, perspective: external ? 'Franchise' : 'Company', profitBasis: f.productId ? 'Product contribution (operating expenses excluded)' : 'Estimated operating profit (approved recorded costs only)',
    kpis: { totalFranchises: franchises.length, activeFranchises: franchises.filter(x => x.status === 'Active').length,
      newFranchises: franchises.filter(x => during(x.registered_on)).length, completedOrders: sales.length, revenue: sum(breakdown, 'revenue'), profit: sum(breakdown, 'profit'),
      totalOrders:enteredSales.length,pendingOrders:enteredSales.filter(x=>x.status==='Pending').length,
      outstandingPayouts: Math.max(0, outstanding), periodPayouts: sum(payments.filter(x => x.direction === 'Payout' && during(x.payment_date)), 'amount'),
      ...(external ? {} : { periodReceipts: sum(payments.filter(x => x.direction === 'Receipt' && during(x.payment_date)), 'amount') }),
      topProductsByOrders: maxOrders > 0 ? productBreakdown.filter(x => x.orders === maxOrders).map(x => x.name) : [],
      topProductsByRevenue: maxRevenue > 0 ? productBreakdown.filter(x => x.revenue === maxRevenue).map(x => x.name) : [] },
    recentSales:enteredSales.sort((a,b)=>(b.created_at || b.completed_date || b.sale_date || '').localeCompare(a.created_at || a.completed_date || a.sale_date || '')).slice(0,20).map(x=>({id:x.id,
      franchise:franchises.find(y=>y.id===x.franchise_id)?.name,customer:x.client_name,product:x.product_type,date:x.completed_date || x.sale_date,
      quantity:x.units,transactionAmount:x.sale_value,status:x.status})),
    franchises: breakdown, products: productBreakdown, monthly: Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month)) };
}
