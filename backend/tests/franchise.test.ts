import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFranchiseDashboard } from '../src/utils/franchiseDashboard.js';
import { isFranchiseApiPathAllowed } from '../src/utils/franchiseAccess.js';

// Injected in-memory queries; never connect to the configured Supabase project.
process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.SUPABASE_ANON_KEY = 'local-test-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
const { FranchiseService, dateField, numberField } = await import('../src/services/FranchiseService.js');
const userId = '00000000-0000-0000-0000-000000000001';
const franchiseId = '00000000-0000-0000-0000-000000000002';
const otherId = '00000000-0000-0000-0000-000000000003';
type Row = Record<string, any>;
class Query {
  predicates: ((row: Row) => boolean)[] = [];
  bounds: [number, number] | undefined;
  singular = false;
  constructor(private rows: Row[]) {}
  select() { return this; }
  eq(key: string, value: any) { this.predicates.push(r => r[key] === value); return this; }
  in(key: string, values: any[]) { this.predicates.push(r => values.includes(r[key])); return this; }
  not(key: string, _operator: string, value: any) { this.predicates.push(r => r[key] !== value && r[key] !== undefined); return this; }
  order() { return this; }
  range(start: number, end: number) { this.bounds = [start, end]; return this; }
  maybeSingle() { this.singular = true; return this; }
  then(resolve: any, reject: any) {
    let rows = this.rows.filter(r => this.predicates.every(p => p(r)));
    if (this.bounds) rows = rows.slice(this.bounds[0], this.bounds[1] + 1);
    return Promise.resolve({ data: this.singular ? rows[0] || null : rows, error: null }).then(resolve, reject);
  }
}
function fake(rows: Record<string, Row[]>) { return { from: (table: string) => new Query(rows[table] || []) } as any; }
function externalDB(overrides: Record<string, Row[]> = {}) {
  return fake({ profiles: [{ id: userId, role: 'franchise_owner', status: 'active' }],
    franchise_users: [{ id: 'membership', user_id: userId, franchise_id: franchiseId, membership_role: 'owner', status: 'active', franchises: { status: 'Active' } }],
    franchises: [{ id: franchiseId, status: 'Active' }, { id: otherId, status: 'Active' }], ...overrides });
}

test('franchise API boundary blocks internal APIs while allowing profile and own notifications', () => {
  for (const path of ['/api/admin/tasks', '/api/admin/tasks/assignable-users', '/api/admin/users', '/api/admin/sales', '/api/social-media/posts', '/api/admin/branches', '/api/franchise-other', '/api/admin/users?redirect=/api/franchise']) {
    assert.equal(isFranchiseApiPathAllowed(path), false, path);
  }
  for (const path of ['/api/franchise/bootstrap', '/api/franchise/dashboard?state=Kerala', '/api/auth/me', '/api/auth/profile', '/api/auth/change-password', '/api/admin/notifications/unread-count']) {
    assert.equal(isFranchiseApiPathAllowed(path), true, path);
  }
});

test('franchise user cannot read or submit activity for a different franchise', async () => {
  const service = new FranchiseService(externalDB());
  const access = await service.access(userId);
  await assert.rejects(service.owned(access, otherId), /Access denied/);
  await assert.rejects(service.createRecord(access, 'sales', { franchise_id: otherId }), /Access denied/);
  assert.equal(access.canApproveSales, false);
  assert.equal(access.canSubmitFinance, false);
  assert.equal(access.canManageUsers, false);
});
test('inactive franchises, disabled memberships, blocked profiles and mismatched roles fail closed', async () => {
  for (const override of [
    { franchise_users: [] },
    { franchise_users: [{ user_id: userId, franchise_id: franchiseId, membership_role: 'owner', status: 'disabled', franchises: { status: 'Active' } }] },
    { franchise_users: [{ user_id: userId, franchise_id: franchiseId, membership_role: 'owner', status: 'active', franchises: { status: 'Suspended' } }] },
    { profiles: [{ id: userId, role: 'franchise_owner', status: 'blocked' }] },
    { profiles: [{ id: userId, role: 'franchise_staff', status: 'active' }] },
  ]) await assert.rejects(new FranchiseService(externalDB(override)).access(userId), /Access denied/);
});
test('franchise role cannot gain company permissions through department assignment', async () => {
  const service = new FranchiseService(externalDB({ profiles: [{ id: userId, role: 'franchise_owner', status: 'active', departments: { name: 'Finance' } }] }));
  assert.equal((await service.access(userId)).canApproveFinance, false);
});
test('franchise users cannot submit revenue, approve records, create logins or edit finalized records', async () => {
  const service = new FranchiseService(externalDB({ sales: [{ id: otherId, franchise_id: franchiseId, status: 'Completed', verified_at: '2026-09-17', created_by: userId }] }));
  const a = await service.access(userId);
  await assert.rejects(service.createRecord(a, 'earnings', { franchise_id: franchiseId }), /Access denied/);
  await assert.rejects(service.decide(a, 'sales', otherId, { action: 'approve' }), /Access denied/);
  await assert.rejects(service.createLogin(a, { franchise_id: franchiseId }), /Access denied/);
  await assert.rejects(service.updateRecord(a, 'sales', otherId, { sale_value: 999 }), /Only pending/);
});
test('login creation removes its new auth account if profile creation fails', async () => {
  const deleted: string[] = [];
  const db = externalDB({ profiles: [{ id: userId, role: 'admin', status: 'active' }] });
  const originalFrom = db.from;
  db.from = (table: string) => {
    const q = originalFrom(table);
    if (table === 'profiles') q.upsert = async () => ({ data: null, error: { code: '23505', message: 'Duplicate profile' } });
    return q;
  };
  db.auth = { admin: {
    createUser: async () => ({ data: { user: { id: otherId } }, error: null }),
    deleteUser: async (id: string) => { deleted.push(id); return { error: null }; },
  } };
  const service = new FranchiseService(db), a = await service.access(userId);
  await assert.rejects(service.createLogin(a, { franchise_id: franchiseId, membership_role: 'owner', full_name: 'Owner', email: 'owner@example.invalid', password: 'valid-password' }), /already exists/);
  assert.deepEqual(deleted, [otherId]);
});
test('company employees see only active manager assignments; HOD and finance capabilities differ', async () => {
  const employee = new FranchiseService(fake({ profiles: [{ id: userId, role: 'employee', status: 'active', departments: { name: 'Franchise' } }],
    franchise_manager_assignments: [{ id: 'a', user_id: userId, franchise_id: franchiseId, status: 'active' }, { id: 'b', user_id: userId, franchise_id: otherId, status: 'disabled' }] }));
  assert.deepEqual((await employee.access(userId)).ids, [franchiseId]);
  const hod = await new FranchiseService(fake({ profiles: [{ id: userId, role: 'hod', status: 'active', departments: { name: 'Franchise' } }] })).access(userId);
  assert.equal(hod.canManage, true); assert.equal(hod.canApproveSales, true); assert.equal(hod.canApproveFinance, false);
  const finance = await new FranchiseService(fake({ profiles: [{ id: userId, role: 'employee', status: 'active', departments: { name: 'Finance' } }] })).access(userId);
  assert.equal(finance.canApproveFinance, true); assert.equal(finance.canManageUsers, false);
});
test('external earning responses hide company revenue, calculation rules and unapproved records', async () => {
  const service = new FranchiseService(externalDB({ franchise_earnings: [
    { id: 'approved', franchise_id: franchiseId, status: 'Approved', franchise_amount: 400, company_revenue: 1000, rule_snapshot: { value: 40 } },
    { id: 'submitted', franchise_id: franchiseId, status: 'Submitted', company_revenue: 999 },
    { id: 'other', franchise_id: otherId, status: 'Approved', franchise_amount: 900 },
  ], franchise_expenses: [{ id: 'company', franchise_id: franchiseId, owner: 'Company' }, { id: 'own', franchise_id: franchiseId, owner: 'Franchise' }],
  franchise_payments: [{ id: 'receipt', franchise_id: franchiseId, direction: 'Receipt' }, { id: 'payout', franchise_id: franchiseId, direction: 'Payout' }] }));
  const a = await service.access(userId), rows = await service.records(a, 'earnings');
  assert.equal(rows.length, 1); assert.equal(rows[0]?.company_revenue, undefined); assert.equal(rows[0]?.rule_snapshot, undefined);
  assert.deepEqual((await service.records(a, 'expenses')).map(x => x.id), ['own']);
  assert.deepEqual((await service.records(a, 'payments')).map(x => x.id), ['payout']);
});
test('lists fetch every page rather than truncating metrics at the database row limit', async () => {
  const sales = Array.from({ length: 1201 }, (_, i) => ({ id: `s-${i}`, franchise_id: franchiseId }));
  const service = new FranchiseService(externalDB({ sales }));
  assert.equal((await service.records(await service.access(userId), 'sales')).length, 1201);
});
test('input validation rejects impossible dates, nonfinite amounts and excess decimals', () => {
  assert.throws(() => dateField('2026-02-30', 'date'));
  assert.throws(() => dateField('2026-13-01', 'date'));
  assert.throws(() => numberField('Infinity', 'amount'));
  assert.throws(() => numberField(-1, 'amount'));
  assert.throws(() => numberField('0.001', 'amount'));
  assert.throws(() => numberField(0, 'amount', true));
  assert.equal(numberField('123.45', 'amount'), 123.45);
});

function dataset() {
  return {
    franchises: [{ id: franchiseId, code: 'FR-1', name: 'Partner', state: 'Kerala', city: 'Kochi', status: 'Active', registered_on: '2026-08-01', plan_id: 'plan', plan_name: 'Standard' },
      { id: otherId, name: 'Other', state: 'Tamil Nadu', city: 'Chennai', status: 'Active', registered_on: '2026-09-01' }],
    products: [{ id: 'p1', name: 'Course' }, { id: 'p2', name: 'Unlisted Shares' }],
    sales: [{ id: 's1', franchise_id: franchiseId, product_id: 'p1', status: 'Completed', completed_date: '2026-09-01', sale_value: 100000, units: 1 },
      { id: 's2', franchise_id: franchiseId, product_id: 'p2', status: 'Completed', completed_date: '2026-09-30', units: 500 },
      { id: 'pending', franchise_id: franchiseId, product_id: 'p1', status: 'Pending', sale_date: '2026-09-10' },
      { id: 'outside', franchise_id: franchiseId, product_id: 'p1', status: 'Completed', completed_date: '2026-08-31' }],
    earnings: [{ id: 'e1', franchise_id: franchiseId, product_id: 'p1', status: 'Approved', recognition_date: '2026-09-01', company_revenue: 1000, franchise_amount: 400 },
      { id: 'e2', franchise_id: franchiseId, product_id: 'p2', status: 'Approved', recognition_date: '2026-09-30', company_revenue: 500, franchise_amount: 200 },
      { id: 'prior', franchise_id: franchiseId, product_id: 'p1', status: 'Approved', recognition_date: '2026-08-31', company_revenue: 250, franchise_amount: 100 },
      { id: 'reversed', franchise_id: franchiseId, product_id: 'p1', status: 'Reversed', recognition_date: '2026-09-15', company_revenue: 10000, franchise_amount: 4000 }],
    expenses: [{ id: 'c1', franchise_id: franchiseId, owner: 'Company', status: 'Approved', expense_date: '2026-09-02', amount: 100 },
      { id: 'f1', franchise_id: franchiseId, owner: 'Franchise', status: 'Approved', expense_date: '2026-09-02', amount: 150 },
      { id: 'pending', franchise_id: franchiseId, owner: 'Company', status: 'Submitted', expense_date: '2026-09-02', amount: 999 }],
    payments: [{ id: 'pay1', franchise_id: franchiseId, earning_id: 'e1', status: 'Verified', direction: 'Payout', payment_date: '2026-09-02', amount: 200 },
      { id: 'old-pay', franchise_id: franchiseId, earning_id: 'prior', status: 'Verified', direction: 'Payout', payment_date: '2026-08-31', amount: 50 },
      { id: 'receipt', franchise_id: franchiseId, earning_id: 'e1', status: 'Verified', direction: 'Receipt', payment_date: '2026-09-02', amount: 1000 },
      { id: 'reversed-pay', franchise_id: franchiseId, earning_id: 'e1', status: 'Reversed', direction: 'Payout', payment_date: '2026-09-02', amount: 200 }],
    filters: { start: '2026-09-01', end: '2026-09-30', state: 'Kerala' }, external: false,
  };
}
test('company report counts completed orders, separates investment from revenue, and preserves outstanding balances across periods', () => {
  const d = buildFranchiseDashboard(dataset());
  assert.equal(d.kpis.totalFranchises, 1); assert.equal(d.kpis.newFranchises, 0);
  assert.equal(d.kpis.completedOrders, 2); assert.equal(d.kpis.revenue, 1500); assert.equal(d.kpis.profit, 800);
  assert.equal(d.kpis.outstandingPayouts, 450); assert.equal(d.kpis.periodPayouts, 200); assert.equal(d.kpis.periodReceipts, 1000);
  assert.deepEqual(d.kpis.topProductsByOrders, ['Course', 'Unlisted Shares']);
  assert.deepEqual(d.kpis.topProductsByRevenue, ['Course']);
});
test('franchise report uses franchise earnings and franchise expenses without exposing company totals', () => {
  const d = buildFranchiseDashboard({ ...dataset(), external: true });
  assert.equal(d.kpis.revenue, 600); assert.equal(d.kpis.profit, 450);
  assert.equal('periodReceipts' in d.kpis, false); assert.equal('commission' in d.franchises[0]!, false);
});
test('product report shows contribution before unallocated operating expenses', () => {
  const input = dataset(); input.filters = { ...input.filters, productId: 'p1' } as any;
  const d = buildFranchiseDashboard(input);
  assert.equal(d.kpis.completedOrders, 1); assert.equal(d.kpis.revenue, 1000); assert.equal(d.kpis.profit, 600);
  assert.equal(d.franchises[0]?.costs, 0); assert.match(d.profitBasis, /contribution/);
});

test('shared franchise identity allows Staff selection only when explicitly enabled', async () => {
  const membership = { user_id: userId, franchise_id: franchiseId, membership_role: 'owner', status: 'active', shared_access: true, franchises: { status: 'Active' } };
  const service = new FranchiseService(externalDB({ franchise_users: [membership] }));
  assert.deepEqual((await service.access(userId, 'franchise_staff')).ids, [franchiseId]);
  assert.equal((await service.access(userId, 'franchise_staff')).canManageUsers, false);
  await assert.rejects(new FranchiseService(externalDB({ franchise_users: [{ ...membership, shared_access: false }] })).access(userId, 'franchise_staff'), /invalid franchise role/);
});

test('CSV handles quoted locations and rejects missing office area before import', async () => {
  const { parseFranchiseCsv } = await import('../../frontend/src/utils/franchiseCsv.ts');
  const header = 'name,owner_name,phone,email,state,city,plan_name,has_office,registered_on,address,office_sqft\n';
  const row = 'Branch,Owner,9876543210,owner@example.invalid,Kerala,Kochi,Standard,Yes,2026-09-17,"First floor, Main road",250';
  const result = parseFranchiseCsv(header + row);
  assert.equal(result[0].address, 'First floor, Main road');
  assert.equal(result[0].office_sqft, 250);
  assert.throws(() => parseFranchiseCsv(header + row.replace(',250', ',')), /office/i);
  assert.throws(() => parseFranchiseCsv('name\nBranch'), /Missing CSV column/);
});

test('onboarding sends role-specific credentials to the same contact email and retains saved franchise on mail failure', async () => {
  for (const failMail of [false, true]) {
    let authPassword = ''; let rpcPayload: any; let emails = 0;
    const db = fake({ profiles: [{ id: userId, role: 'admin', status: 'active' }], franchises: [{ id: franchiseId, name: 'Branch', status: 'Active' }] });
    db.auth = { admin: { createUser: async (input: any) => { authPassword = input.password; return { data: { user: { id: otherId } }, error: null }; }, deleteUser: async () => { throw new Error('Unexpected cleanup'); } } };
    db.rpc = async (_name: string, payload: any) => { rpcPayload = payload; return { data: franchiseId, error: null }; };
    const mailer = { sendFranchiseCredentials: async (...args: any[]) => { emails++; assert.equal(args[0], 'owner@example.invalid'); assert.equal(args[3], args[4][0] === 'Franchise Owner' ? 'password123' : 'password1234'); if (failMail) throw new Error('SMTP unavailable'); } } as any;
    const service = new FranchiseService(db, mailer);
    const result = await service.register(await service.access(userId), { name: 'Branch', owner_name: 'Owner', phone: '9876543210', email: 'owner@example.invalid', state: 'Kerala', city: 'Kochi', plan_id: otherId, has_office: false, registered_on: '2026-09-17' });
    assert.equal(emails, 2); assert.equal(authPassword, 'password1234');
    assert.equal(rpcPayload.p_users.length, 2); assert.equal(rpcPayload.p_users[0].shared_access, false); assert.equal(rpcPayload.p_users[1].login_email, 'owner@example.invalid');
    assert.equal(JSON.stringify(rpcPayload).includes(authPassword), false);
    assert.equal(JSON.stringify(result).includes(authPassword), false);
    assert.equal(result.emailResults[0].sent, !failMail);
  }
});

test('pending staff sales appear in owner and admin dashboards without counting as earned revenue', () => {
  for (const external of [false, true]) {
    const d = buildFranchiseDashboard({ ...dataset(), external });
    assert.equal(d.kpis.totalOrders, 3);
    assert.equal(d.kpis.pendingOrders, 1);
    assert.equal(d.kpis.completedOrders, 2);
    assert.ok(d.recentSales.some(s => s.id === 'pending' && s.status === 'Pending'));
    assert.equal(d.kpis.revenue, external ? 600 : 1500);
  }
});

test('failed onboarding database transaction removes generated auth identity and sends no email', async () => {
  const deleted: string[] = [];
  const db = fake({ profiles: [{ id: userId, role: 'admin', status: 'active' }] });
  db.auth = { admin: { createUser: async () => ({ data: { user: { id: otherId } }, error: null }), deleteUser: async (id: string) => { deleted.push(id); return { error: null }; } } };
  db.rpc = async () => ({ data: null, error: { message: 'Invalid plan' } });
  const service = new FranchiseService(db, { sendFranchiseCredentials: async () => { assert.fail('Email must follow successful save'); } } as any);
  await assert.rejects(service.register(await service.access(userId), { name: 'Branch', owner_name: 'Owner', phone: '9876543210', email: 'owner@example.invalid', state: 'Kerala', city: 'Kochi', plan_id: otherId, has_office: false, registered_on: '2026-09-17' }));
  assert.deepEqual(deleted, [otherId, otherId]);
});

test('staff sales save directly as Completed with the sale date and no approval metadata', async () => {
  let saved: any;
  const db = externalDB({ franchises: [{ id: franchiseId, status: 'Active', registered_on: '2026-09-01' }], franchise_products: [{ id: otherId, active: true, sale_product_type: 'Course' }] });
  const from = db.from;
  db.from = (table: string) => {
    const q = from(table);
    if (table === 'sales') q.insert = (row: any) => { saved = row; return { select: () => ({ single: async () => ({ data: row, error: null }) }) }; };
    return q;
  };
  const service = new FranchiseService(db);
  await service.createRecord(await service.access(userId), 'sales', { franchise_id: franchiseId, product_id: otherId, client_name: 'Customer', sale_date: '2026-09-17', units: 1, sale_value: 5000 });
  assert.equal(saved.status, 'Completed');
  assert.equal(saved.completed_date, '2026-09-17');
  assert.equal(saved.verified_by, undefined);
});

test('sale removal rejects another franchise and another staff member records', async () => {
  const service = new FranchiseService(externalDB({ sales: [{ id: otherId, franchise_id: otherId, created_by: userId }] }));
  await assert.rejects(service.removeSale(await service.access(userId), otherId), /Access denied/);
  const otherCreator = new FranchiseService(externalDB({ sales: [{ id: otherId, franchise_id: franchiseId, created_by: otherId }] }));
  await assert.rejects(otherCreator.removeSale(await otherCreator.access(userId), otherId), /Access denied/);
});
test('own sale removal succeeds while financial dependencies block removal', async () => {
  for (const linked of [false, true]) {
    const db = externalDB({ sales: [{ id: otherId, franchise_id: franchiseId, created_by: userId }] });
    const from = db.from;
    db.from = (table: string) => {
      const q = from(table);
      q.delete = () => { const result = { eq: () => result, select: () => result, maybeSingle: async () => ({ data: linked ? null : { id: otherId }, error: linked ? { code: '23503' } : null }) }; return result; };
      return q;
    };
    const service = new FranchiseService(db), a = await service.access(userId);
    if (linked) await assert.rejects(service.removeSale(a, otherId), /linked financial/);
    else assert.deepEqual(await service.removeSale(a, otherId), { id: otherId, removed: true });
  }
});
