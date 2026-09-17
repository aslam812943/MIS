import { supabaseAdmin } from '../config/supabase.js';
import { buildFranchiseDashboard } from '../utils/franchiseDashboard.js';
import { randomBytes, randomUUID } from 'node:crypto';
import { EmailService } from './EmailService.js';

export class FranchiseError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type FranchiseAccess = {
  userId: string; external: boolean; ids: string[] | null;
  canManage: boolean; canManageUsers: boolean; canWrite: boolean;
  canSubmitFinance: boolean; canApproveSales: boolean; canApproveFinance: boolean;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEADERS = ['admin', 'ceo', 'managing_director', 'director', 'executive'];
const INTERNAL = ['employee', 'hod', 'regional_manager'];
const TABLES = { sales: 'sales', earnings: 'franchise_earnings', expenses: 'franchise_expenses', payments: 'franchise_payments' } as const;
type Kind = keyof typeof TABLES;

export function textField(value: unknown, label: string, required = true, max = 255): string | null {
  if (value === undefined || value === null || value === '') {
    if (required) throw new FranchiseError(`${label} is required.`);
    return null;
  }
  if (typeof value !== 'string') throw new FranchiseError(`Invalid ${label}.`);
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if ((!clean && required) || clean.length > max) throw new FranchiseError(`Enter ${label} (maximum ${max} characters).`);
  return clean || null;
}
export function idField(value: unknown, label = 'ID'): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new FranchiseError(`Invalid ${label}.`);
  return value;
}
export function dateField(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new FranchiseError(`Enter a valid ${label}.`);
  }
  return value;
}
export function numberField(value: unknown, label: string, positive = false): number {
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '' || (typeof value === 'string' && !/^\d+(\.\d{1,2})?$/.test(value))) throw new FranchiseError(`Enter a valid ${label} (up to two decimal places).`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n >= 1e12 || (positive && n <= 0) || Math.abs(n * 100 - Math.round(n * 100)) > 0.0001) throw new FranchiseError(`Invalid ${label}.`);
  return n;
}
function choice(value: unknown, values: string[], label: string): string {
  if (typeof value !== 'string' || !values.includes(value)) throw new FranchiseError(`Invalid ${label}.`);
  return value;
}
function booleanField(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new FranchiseError(`Invalid ${label}.`);
  return value;
}

export class FranchiseService {
  constructor(private db = supabaseAdmin, private mailer = new EmailService()) {}
  private client() {
    if (!this.db) throw new FranchiseError('Franchise database service is not configured.', 503);
    return this.db;
  }
  private check(result: { error: any; data: any }) {
    if (result.error) {
      const e = result.error;
      if (e.code === '23505') throw new FranchiseError('This reference, email, membership or effective date already exists.', 409);
      if (e.code === 'P0001' || e.code === '23514' || e.code === '23503') throw new FranchiseError(e.message);
      if (['42P01', '42703', 'PGRST205', 'PGRST202', 'PGRST204'].includes(e.code)) throw new FranchiseError('Franchise setup is required. Run backend/database_franchise.sql in Supabase SQL Editor.', 503);
      console.error('[Franchise database]', e.code, e.message);
      throw new FranchiseError('Could not complete the franchise request.', 500);
    }
    return result.data;
  }
  private async all(factory: () => any): Promise<any[]> {
    const rows: any[] = [];
    for (let offset = 0; ; offset += 500) {
      const page = this.check(await factory().order('id').range(offset, offset + 499)) || [];
      rows.push(...page);
      if (page.length < 500) return rows;
    }
  }
  async access(userId: string, sessionRole?: string): Promise<FranchiseAccess> {
    const db = this.client();
    const p = this.check(await db.from('profiles').select('id,role,status,department_id,departments(name)').eq('id', userId).maybeSingle());
    if (!p || p.status !== 'active') throw new FranchiseError('Access denied: active account required.', 403);
    const external = ['franchise_owner', 'franchise_staff'].includes(p.role);
    const department = (p.departments as any)?.name?.trim().toUpperCase();
    const franchiseTeam = !external && INTERNAL.includes(p.role) && department === 'FRANCHISE';
    const financeTeam = !external && INTERNAL.includes(p.role) && department === 'FINANCE';
    const admin = p.role === 'admin';
    const manager = franchiseTeam && p.role === 'hod';
    let ids: string[] | null = null;
    if (external) {
      const member = this.check(await db.from('franchise_users').select('franchise_id,membership_role,shared_access,franchises(status)').eq('user_id', userId).eq('status', 'active').maybeSingle());
      if (!member || (member.franchises as any)?.status !== 'Active' || member.membership_role !== (p.role === 'franchise_owner' ? 'owner' : 'staff')) throw new FranchiseError('Access denied: your franchise or membership is inactive.', 403);
      ids = [member.franchise_id];
      if (sessionRole && sessionRole !== p.role && !(p.role === 'franchise_owner' && sessionRole === 'franchise_staff' && member.shared_access)) throw new FranchiseError('Access denied: invalid franchise role.',403);
    } else if (!LEADERS.includes(p.role) && !franchiseTeam && !financeTeam) {
      throw new FranchiseError('Access denied: Franchise department access required.', 403);
    } else if (franchiseTeam && !manager) {
      const assignments = await this.all(() => db.from('franchise_manager_assignments').select('id,franchise_id').eq('user_id', userId).eq('status', 'active'));
      ids = assignments.map(a => a.franchise_id);
    }
    return { userId, external, ids, canManage: admin || manager, canManageUsers: admin,
      canWrite: external || admin || franchiseTeam || financeTeam,
      canSubmitFinance: admin || franchiseTeam || financeTeam,
      canApproveSales: admin || manager, canApproveFinance: admin || financeTeam };
  }
  private require(flag: boolean) { if (!flag) throw new FranchiseError('Access denied: you do not have permission for this action.', 403); }
  async owned(a: FranchiseAccess, value: unknown, active = false): Promise<any> {
    const id = idField(value, 'franchise');
    this.require(a.ids === null || a.ids.includes(id));
    const f = this.check(await this.client().from('franchises').select('*').eq('id', id).maybeSingle());
    if (!f) throw new FranchiseError('Franchise not found.', 404);
    if (active && f.status !== 'Active') throw new FranchiseError('Activate this franchise before entering activity.');
    return f;
  }
  private scope(query: any, a: FranchiseAccess, column = 'franchise_id'): any {
    return a.ids === null ? query : query.in(column, a.ids.length ? a.ids : ['00000000-0000-0000-0000-000000000000']);
  }
  async bootstrap(a: FranchiseAccess) {
    const db = this.client();
    const franchises = await this.all(() => this.scope(db.from('franchises').select('*'), a, 'id'));
    const ids = franchises.map(f => f.id);
    const [products, plans, assignments, rules] = await Promise.all([
      this.all(() => db.from('franchise_products').select('*')),
      this.all(() => db.from('franchise_plans').select('*')),
      this.all(() => db.from('franchise_plan_assignments').select('*').in('franchise_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])),
      a.external ? Promise.resolve([]) : this.all(() => db.from('franchise_commission_rules').select('*')),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const decorated = franchises.map(f => {
      const current = assignments.filter(x => x.franchise_id === f.id && x.effective_from <= today).sort((x, y) => y.effective_from.localeCompare(x.effective_from))[0];
      const { remarks, created_by, ...publicFields } = f;
      return { ...(a.external ? publicFields : f), plan_id: current?.plan_id || null, plan_name: plans.find(p => p.id === current?.plan_id)?.name || 'Unassigned' };
    });
    let users: any[] = [], memberships: any[] = [], managers: any[] = [], branches: any[] = [];
    if (a.canManageUsers) {
      users = await this.all(() => db.from('profiles').select('id,email,full_name,role,status,department_id,departments(name)'));
      memberships = await this.all(() => db.from('franchise_users').select('*'));
      managers = await this.all(() => db.from('franchise_manager_assignments').select('*'));
    }
    if (a.canManage) branches = await this.all(() => db.from('branches').select('id,name'));
    return { access: a, franchises: decorated, products, plans, planAssignments: assignments, rules, users, memberships, managers, branches };
  }
  private franchiseData(body: any) {
    const phone = textField(body.phone, 'phone', true, 20)!;
    if (!/^\+?[0-9]{10,15}$/.test(phone)) throw new FranchiseError('Phone must contain 10 to 15 digits, optionally starting with +.');
    const email = textField(body.email, 'email')!.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new FranchiseError('Enter a valid email.');
    const hasOffice = booleanField(body.has_office, 'office selection');
    return { name: textField(body.name, 'franchise name'), owner_name: textField(body.owner_name, 'owner name'), phone, email,
      state: textField(body.state, 'state', true, 120), city: textField(body.city, 'city', true, 120), area: textField(body.area, 'area', false),
      address: textField(body.address, 'address', false, 2000), postal_code: textField(body.postal_code, 'postal code', false, 20),
      has_office: hasOffice, office_sqft: hasOffice ? numberField(body.office_sqft, 'office area', true) : null,
      registered_on: dateField(body.registered_on, 'registration date'), status: choice(body.status, ['Draft', 'Active', 'Suspended', 'Closed'], 'status'),
      branch_id: body.branch_id ? idField(body.branch_id, 'branch') : null, remarks: textField(body.remarks, 'remarks', false, 2000) };
  }
  async register(a: FranchiseAccess, body: any) {
    this.require(a.canManageUsers);
    const data = this.franchiseData({ ...body, status: body.status || 'Active' });
    const db = this.client();
    const staffEmail = body.staff_email ? textField(body.staff_email,'staff email')!.toLowerCase() : data.email;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staffEmail)) throw new FranchiseError('Enter a valid staff email.');
    const people = [
      { email: data.email, login_email: data.email, name: data.owner_name, role: 'owner', shared_access: false },
      { email: staffEmail === data.email ? `franchise-staff-${randomUUID()}@login.invalid` : staffEmail, login_email: staffEmail, name: textField(body.staff_name || `${data.name} staff`, 'staff name'), role: 'staff', shared_access: false },
    ];
    for (const p of people) {
      const existing = this.check(await db.from('profiles').select('id').eq('email',p.email).maybeSingle());
      if (existing) throw new FranchiseError(`A login already exists for ${p.email}. Use a new franchise email.`,409);
    }
    let planId = body.plan_id ? idField(body.plan_id,'plan') : null;
    if (!planId) {
      const planName = textField(body.plan_name || 'Default','plan',true,120)!;
      let plan = this.check(await db.from('franchise_plans').select('id,active').eq('name',planName).maybeSingle());
      if (!plan) {
        const saved = await db.from('franchise_plans').insert({name:planName}).select('id,active').single();
        if (saved.error?.code === '23505') plan=this.check(await db.from('franchise_plans').select('id,active').eq('name',planName).single());
        else plan=this.check(saved);
      }
      if (!plan.active) throw new FranchiseError('Choose an active plan.');
      planId=plan.id;
    }
    const created: { id:string; email:string; name:string|null; role:string; shared_access:boolean; login_email:string; password:string }[]=[];
    let franchiseId: string;
    try {
      for (const p of people) {
        const password = p.role === 'owner' ? 'password123' : 'password1234';
        const result=await db.auth.admin.createUser({email:p.email,password,email_confirm:true});
        if (result.error || !result.data.user) throw new FranchiseError(result.error?.message || 'Could not create franchise login.');
        created.push({...p,id:result.data.user.id,password});
      }
      franchiseId=this.check(await db.rpc('onboard_franchise',{p_data:data,p_plan:planId,p_actor:a.userId,p_users:created.map(({password,...p})=>p)}));
    } catch(error) {
      for (const p of created) {
        const result=await db.auth.admin.deleteUser(p.id);
        if (result.error) console.error('[Franchise onboarding cleanup]',p.id,result.error.message);
      }
      throw error;
    }
    const emailResults: {email:string;sent:boolean}[]=[];
    for (const p of created) {
      try {
        await this.mailer.sendFranchiseCredentials(p.login_email,p.name!,data.name!,p.password,p.shared_access?['Franchise Owner','Franchise Staff']:[p.role==='owner'?'Franchise Owner':'Franchise Staff']);
        emailResults.push({email:p.login_email,sent:true});
      } catch {
        emailResults.push({email:p.login_email,sent:false});
      }
    }
    return {...await this.owned(a,franchiseId),emailResults};
  }
  async bulkRegister(a: FranchiseAccess, body: any) {
    this.require(a.canManageUsers);
    if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length>100) throw new FranchiseError('Import between 1 and 100 franchise rows.');
    // Validate the whole file before creating accounts or sending any mail.
    const emails=new Set<string>();
    for (const row of body.rows) {
      const data=this.franchiseData({...row,status:row.status || 'Active'});
      if (row.plan_name) textField(row.plan_name,'plan',true,120);
      const staff=row.staff_email?textField(row.staff_email,'staff email')!.toLowerCase():data.email;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staff)) throw new FranchiseError('Enter a valid staff email.');
      for (const email of new Set([data.email,staff])) {
        if (emails.has(email)) throw new FranchiseError(`Duplicate login email in CSV: ${email}`);
        emails.add(email);
      }
    }
    const results: any[]=[];
    for (const [index,row] of body.rows.entries()) {
      try { results.push({row:index+2,success:true,franchise:await this.register(a,row)}); }
      catch(error) { results.push({row:index+2,success:false,message:error instanceof FranchiseError?error.message:'Could not create this franchise.'}); }
    }
    return {results};
  }
  async resendCredentials(a:FranchiseAccess,id:string) {
    this.require(a.canManageUsers);
    const f=await this.owned(a,id);
    const members=await this.all(()=>this.client().from('franchise_users').select('*').eq('franchise_id',f.id).eq('status','active'));
    const emailResults:{email:string;sent:boolean}[]=[];
    for (const m of members) {
      const p=this.check(await this.client().from('profiles').select('email,full_name,status').eq('id',m.user_id).maybeSingle());
      if (!p || p.status!=='active') continue;
      const password = m.login_email ? (m.membership_role === 'owner' ? 'password123' : 'password1234') : randomBytes(18).toString('base64url');
      this.check(await this.client().auth.admin.updateUserById(m.user_id,{password}));
      try { await this.mailer.sendFranchiseCredentials(m.login_email || p.email,p.full_name || f.owner_name,f.name,password,m.shared_access?['Franchise Owner','Franchise Staff']:[m.membership_role==='owner'?'Franchise Owner':'Franchise Staff']);emailResults.push({email:m.login_email || p.email,sent:true}); }
      catch {emailResults.push({email:m.login_email || p.email,sent:false});}
    }
    return {id:f.id,emailResults};
  }
  async updateFranchise(a: FranchiseAccess, id: string, body: any) {
    this.require(a.canManage);
    const old = await this.owned(a, id);
    const data = this.franchiseData({ ...old, ...body });
    // Business registration dates are immutable after creation, preserving plan history.
    if (data.registered_on !== old.registered_on) throw new FranchiseError('Registration date cannot be changed after creation.');
    return this.check(await this.client().from('franchises').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select('*').single());
  }
  async configure(a: FranchiseAccess, kind: string, body: any) {
    this.require(a.canManage);
    const db = this.client();
    if (kind === 'plans') {
      const data = { name: textField(body.name, 'plan name', true, 120), description: textField(body.description, 'description', false, 2000),
        joining_fee: numberField(body.joining_fee, 'joining fee'), recurring_fee: numberField(body.recurring_fee, 'recurring fee'),
        billing_frequency: choice(body.billing_frequency, ['None', 'Monthly', 'Yearly'], 'billing frequency'), active: booleanField(body.active, 'active status') };
      if (data.billing_frequency === 'None' && data.recurring_fee !== 0) throw new FranchiseError('Choose a billing frequency for a recurring fee.');
      return this.check(await db.from('franchise_plans').insert(data).select('*').single());
    }
    if (kind === 'plan-assignments') {
      const f = await this.owned(a, body.franchise_id);
      const effective = dateField(body.effective_from, 'effective date');
      if (effective < f.registered_on) throw new FranchiseError('Plan cannot start before franchise registration.');
      const plan = this.check(await db.from('franchise_plans').select('id,active').eq('id', idField(body.plan_id, 'plan')).maybeSingle());
      if (!plan?.active) throw new FranchiseError('Select an active plan.');
      return this.check(await db.from('franchise_plan_assignments').insert({ franchise_id: f.id, plan_id: plan.id, effective_from: effective, created_by: a.userId }).select('*').single());
    }
    if (kind === 'rules') {
      const method = choice(body.method, ['Fixed', 'Percentage'], 'commission method');
      const value = numberField(body.value, 'commission value');
      if (method === 'Percentage' && value > 100) throw new FranchiseError('Percentage cannot exceed 100.');
      return this.check(await db.from('franchise_commission_rules').insert({ plan_id: idField(body.plan_id, 'plan'), product_id: idField(body.product_id, 'product'), method, value,
        effective_from: dateField(body.effective_from, 'effective date') }).select('*').single());
    }
    throw new FranchiseError('Invalid configuration.');
  }
  async toggleCatalog(a: FranchiseAccess, kind: string, id: string, body: any) {
    this.require(a.canManage);
    const table = kind === 'plans' ? 'franchise_plans' : kind === 'products' ? 'franchise_products' : null;
    if (!table) throw new FranchiseError('Invalid catalogue.');
    return this.check(await this.client().from(table).update({ active: booleanField(body.active, 'active status') }).eq('id', idField(id)).select('*').single());
  }
  async membership(a: FranchiseAccess, body: any) {
    this.require(a.canManageUsers);
    const f = await this.owned(a, body.franchise_id);
    const userId = idField(body.user_id, 'user');
    const p = this.check(await this.client().from('profiles').select('role,status,departments(name)').eq('id', userId).maybeSingle());
    const role = choice(body.membership_role, ['owner', 'staff', 'manager'], 'membership role');
    if (role === 'manager') {
      if (!p || !INTERNAL.includes(p.role) || (p.departments as any)?.name?.toUpperCase() !== 'FRANCHISE') throw new FranchiseError('Choose a Franchise department employee or manager.');
      return this.check(await this.client().from('franchise_manager_assignments').insert({ franchise_id: f.id, user_id: userId }).select('*').single());
    }
    if (!p || p.role !== (role === 'owner' ? 'franchise_owner' : 'franchise_staff')) throw new FranchiseError('User role must match the selected franchise membership.');
    return this.check(await this.client().from('franchise_users').insert({ franchise_id: f.id, user_id: userId, membership_role: role }).select('*').single());
  }
  async updateMembership(a: FranchiseAccess, id: string, body: any) {
    this.require(a.canManageUsers);
    return this.check(await this.client().from('franchise_users').update({ status: choice(body.status, ['active', 'disabled'], 'membership status') }).eq('id', idField(id)).select('*').single());
  }
  async updateManager(a: FranchiseAccess, id: string, body: any) {
    this.require(a.canManageUsers);
    return this.check(await this.client().from('franchise_manager_assignments').update({ status: choice(body.status, ['active', 'disabled'], 'assignment status') }).eq('id', idField(id)).select('*').single());
  }
  async updateRecord(a: FranchiseAccess, rawKind: string, id: string, body: any) {
    const kind = this.kind(rawKind);
    this.require(a.canWrite);
    if (!['sales', 'expenses'].includes(kind)) throw new FranchiseError('Earnings and payments cannot be edited. Reject or reverse an unpaid earning and submit a corrected record.');
    const db = this.client();
    const old = this.check(await db.from(TABLES[kind]).select('*').eq('id', idField(id)).maybeSingle());
    if (!old?.franchise_id) throw new FranchiseError('Record not found.', 404);
    await this.owned(a, old.franchise_id, true);
    this.require(old.created_by === a.userId || (kind === 'sales' ? a.canApproveSales : a.canApproveFinance));
    const expected = kind === 'sales' ? old.status : 'Submitted';
    if (old.status !== expected || (kind === 'sales' && ( !['Pending', 'Completed'].includes(old.status) || (old.status === 'Completed' && old.verified_at)))) throw new FranchiseError('Only pending submissions can be edited.', 409);
    const merged = { ...old, ...body };
    let data: Record<string, unknown>;
    if (kind === 'sales') {
      const product = this.check(await db.from('franchise_products').select('*').eq('id', idField(merged.product_id, 'product')).maybeSingle());
      if (!product?.active) throw new FranchiseError('Select an active product.');
      const contact = textField(merged.client_contact, 'customer phone', false, 20);
      if (contact && !/^\+?\d{10,15}$/.test(contact)) throw new FranchiseError('Enter a valid customer phone.');
      data = { client_name: textField(merged.client_name, 'customer name'), client_contact: contact, product_id: product.id, product_type: product.sale_product_type,
        sale_date: dateField(merged.sale_date, 'submission date'), ...(old.status === 'Completed' ? { completed_date: dateField(merged.sale_date, 'sale date') } : {}), sale_value: numberField(merged.sale_value, 'transaction amount'), units: numberField(merged.units, 'quantity', true),
        order_reference: textField(merged.order_reference, 'order reference', false), remarks: textField(merged.remarks, 'remarks', false, 2000), updated_at: new Date().toISOString() };
    } else {
      data = { category: textField(merged.category, 'category', true, 120), description: textField(merged.description, 'description', true, 2000), amount: numberField(merged.amount, 'amount', true),
        expense_date: dateField(merged.expense_date, 'expense date'), allocation_basis: textField(merged.allocation_basis, 'allocation basis', false, 2000) };
      if (/commission|payout/i.test(String(data.category))) throw new FranchiseError('Record commission payouts in Payments.');
    }
    const f = await this.owned(a, old.franchise_id);
    if (String(data.sale_date || data.expense_date) < f.registered_on) throw new FranchiseError('Activity cannot precede franchise registration.');
    // Compare the state in the UPDATE itself, so concurrent approval wins safely.
    const updated = this.check(await db.from(TABLES[kind]).update(data).eq('id', id).eq('status', expected).select('*').maybeSingle());
    if (!updated) throw new FranchiseError('This record was already decided. Refresh and try again.', 409);
    return updated;
  }
  async createLogin(a: FranchiseAccess, body: any) {
    this.require(a.canManageUsers);
    const f = await this.owned(a, body.franchise_id);
    const role = choice(body.membership_role, ['owner', 'staff'], 'membership role');
    const name = textField(body.full_name, 'name')!;
    const email = textField(body.email, 'email')!.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new FranchiseError('Enter a valid email.');
    if (body.password !== undefined && (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128)) throw new FranchiseError('Password must be 8 to 128 characters.');
    const db = this.client();
    const password = body.password || randomBytes(18).toString('base64url');
    const auth = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (auth.error || !auth.data.user) throw new FranchiseError(auth.error?.message || 'Could not create login.');
    const userId = auth.data.user.id;
    let membership;
    try {
      this.check(await db.from('profiles').upsert({ id: userId, email, full_name: name, role: role === 'owner' ? 'franchise_owner' : 'franchise_staff', status: 'active', branch_id: null, department_id: null, allowed_modules: [] }));
      membership = this.check(await db.from('franchise_users').insert({ franchise_id: f.id, user_id: userId, membership_role: role, shared_access: role === 'owner' }).select('*').single());
    } catch (error) {
      const cleanup = await db.auth.admin.deleteUser(userId);
      if (cleanup.error) console.error('[Franchise login cleanup]', userId, cleanup.error.message);
      throw error;
    }
    let sent = true;
    try { await this.mailer.sendFranchiseCredentials(email, name, f.name, password, role === 'owner' ? ['Franchise Owner', 'Franchise Staff'] : ['Franchise Staff']); } catch { sent = false; }
    return { ...membership, emailResults: [{ email, sent }] };
  }
  private kind(value: string): Kind {
    if (!(value in TABLES) || !Object.hasOwn(TABLES, value)) throw new FranchiseError('Invalid record type.');
    return value as Kind;
  }
  async auditRecord(a: FranchiseAccess, table: string, id: string) {
    const allowed = ['franchises', 'franchise_users', 'franchise_manager_assignments', 'franchise_plans', 'franchise_products', ...Object.values(TABLES)];
    if (!allowed.includes(table)) throw new FranchiseError('Invalid audit table.');
    const row = this.check(await this.client().from(table).select('*').eq('id', idField(id)).maybeSingle());
    if (row?.franchise_id) await this.owned(a, row.franchise_id);
    return row;
  }
  async records(a: FranchiseAccess, rawKind: string, franchiseId?: string): Promise<any[]> {
    const kind = this.kind(rawKind);
    if (franchiseId) await this.owned(a, franchiseId);
    const rows = await this.all(() => {
      let q = this.scope(this.client().from(TABLES[kind]).select('*'), a);
      if (kind === 'sales') q = q.not('franchise_id', 'is', null);
      return franchiseId ? q.eq('franchise_id', franchiseId) : q;
    });
    return this.visible(a, kind, rows);
  }
  private visible(a: FranchiseAccess, kind: Kind, rows: any[]): any[] {
    if (!a.external) return rows;
    if (kind === 'expenses') return rows.filter(x => x.owner === 'Franchise');
    if (kind === 'payments') return rows.filter(x => x.direction === 'Payout');
    if (kind === 'earnings') return rows.filter(x => ['Approved', 'Reversed'].includes(x.status)).map(x => ({
      id: x.id, franchise_id: x.franchise_id, sale_id: x.sale_id, product_id: x.product_id, recognition_date: x.recognition_date,
      earning_type: x.earning_type, reference: x.reference, franchise_amount: x.franchise_amount, status: x.status,
    }));
    return rows;
  }
  async createRecord(a: FranchiseAccess, rawKind: string, body: any) {
    const kind = this.kind(rawKind), db = this.client();
    this.require(a.canWrite);
    const f = await this.owned(a, body.franchise_id, true);
    if (kind === 'sales') {
      const product = this.check(await db.from('franchise_products').select('*').eq('id', idField(body.product_id, 'product')).maybeSingle());
      if (!product?.active) throw new FranchiseError('Select an active product.');
      const date = dateField(body.sale_date, 'submission date');
      if (date < f.registered_on) throw new FranchiseError('Sale cannot precede franchise registration.');
      const contact = textField(body.client_contact, 'customer phone', false, 20);
      if (contact && !/^\+?\d{10,15}$/.test(contact)) throw new FranchiseError('Enter a valid customer phone.');
      return this.check(await db.from('sales').insert({ franchise_id: f.id, product_id: product.id, product_type: product.sale_product_type,
        client_name: textField(body.client_name, 'customer name'), client_contact: contact, sale_date: date, status: 'Completed', completed_date: date,
        sale_value: numberField(body.sale_value, 'customer transaction amount'), units: numberField(body.units, 'quantity', true),
        order_reference: textField(body.order_reference, 'order reference', false), remarks: textField(body.remarks, 'remarks', false, 2000), branch_id: f.branch_id, created_by: a.userId }).select('*').single());
    }
    if (kind === 'expenses') {
      const owner = a.external ? 'Franchise' : choice(body.owner, ['Company', 'Franchise'], 'expense owner');
      const category = textField(body.category, 'expense category', true, 120)!;
      if (/commission|payout/i.test(category)) throw new FranchiseError('Commission is already deducted through earnings. Record payouts in Payments.');
      const date = dateField(body.expense_date, 'expense date');
      if (date < f.registered_on) throw new FranchiseError('Expense cannot precede franchise registration.');
      return this.check(await db.from('franchise_expenses').insert({ franchise_id: f.id, owner, category, description: textField(body.description, 'description', true, 2000),
        amount: numberField(body.amount, 'expense amount', true), expense_date: date, allocation_basis: textField(body.allocation_basis, 'allocation basis', false, 2000), created_by: a.userId }).select('*').single());
    }
    this.require(a.canSubmitFinance);
    if (kind === 'earnings') {
      const data = { franchise_id: f.id, sale_id: idField(body.sale_id, 'sale'), recognition_date: dateField(body.recognition_date, 'recognition date'),
        earning_type: textField(body.earning_type, 'earning type', true, 120), reference: textField(body.reference, 'unique earning reference'),
        company_revenue: numberField(body.company_revenue, 'company revenue'), use_rule: booleanField(body.use_rule, 'commission calculation'),
        franchise_amount: body.use_rule ? null : numberField(body.franchise_amount, 'franchise earning'), manual_reason: textField(body.manual_reason, 'manual reason', !body.use_rule, 2000) };
      const id = this.check(await db.rpc('submit_franchise_earning', { p_data: data, p_actor: a.userId }));
      return this.check(await db.from('franchise_earnings').select('*').eq('id', id).single());
    }
    this.require(a.canApproveFinance);
    const data = { franchise_id: f.id, earning_id: idField(body.earning_id, 'earning'), direction: choice(body.direction, ['Receipt', 'Payout'], 'payment direction'),
      amount: numberField(body.amount, 'payment amount', true), payment_date: dateField(body.payment_date, 'payment date'), method: textField(body.method, 'payment method', true, 120), reference: textField(body.reference, 'payment reference') };
    const id = this.check(await db.rpc('record_franchise_payment', { p_data: data, p_actor: a.userId }));
    return this.check(await db.from('franchise_payments').select('*').eq('id', id).single());
  }
  async removeSale(a: FranchiseAccess, id: string) {
    this.require(a.canWrite);
    const db = this.client();
    const old = this.check(await db.from('sales').select('*').eq('id', idField(id)).maybeSingle());
    if (!old?.franchise_id) throw new FranchiseError('Sale not found.', 404);
    await this.owned(a, old.franchise_id, true);
    this.require(old.created_by === a.userId || a.canApproveSales);
    const result = await db.from('sales').delete().eq('id', id).eq('franchise_id', old.franchise_id).select('id').maybeSingle();
    if (result.error?.code === '23503') throw new FranchiseError('This sale has linked financial records and cannot be removed.', 409);
    const removed = this.check(result);
    if (!removed) throw new FranchiseError('Sale already removed. Refresh the list.', 409);
    return { id, removed: true };
  }
  async decide(a: FranchiseAccess, rawKind: string, id: string, body: any) {
    const kind = this.kind(rawKind);
    this.require(kind === 'sales' ? a.canApproveSales : a.canApproveFinance);
    const old = this.check(await this.client().from(TABLES[kind]).select('*').eq('id', idField(id)).maybeSingle());
    if (!old?.franchise_id) throw new FranchiseError('Franchise record not found.', 404);
    await this.owned(a, old.franchise_id);
    const action = choice(body.action, ['approve', 'reject', 'reverse'], 'action');
    const note = textField(body.note, 'decision note', action !== 'approve', 2000);
    if (action !== 'approve' && (!note || note.length < 5)) throw new FranchiseError('Explain the rejection or reversal (at least 5 characters).');
    if (kind === 'payments') {
      if (action !== 'reverse') throw new FranchiseError('Payments can only be reversed with an explanation.');
      this.check(await this.client().rpc('reverse_franchise_payment', { p_id: id, p_actor: a.userId, p_note: note }));
      return this.check(await this.client().from('franchise_payments').select('*').eq('id', id).single());
    }
    this.check(await this.client().rpc('decide_franchise_record', { p_kind: kind, p_id: id, p_actor: a.userId, p_action: action, p_note: note,
      p_date: kind === 'sales' && action === 'approve' ? dateField(body.completed_date, 'completion date') : null }));
    return this.check(await this.client().from(TABLES[kind]).select('*').eq('id', id).single());
  }
  async dashboard(a: FranchiseAccess, filters: Record<string, unknown>) {
    const bootstrap = await this.bootstrap(a);
    const start = dateField(filters.startDate, 'start date'), end = dateField(filters.endDate, 'end date');
    if (start > end) throw new FranchiseError('Start date must be before end date.');
    if (filters.franchiseId) await this.owned(a, filters.franchiseId);
    const [sales, earnings, expenses, payments] = await Promise.all([
      this.records(a, 'sales'), this.records(a, 'earnings'), this.records(a, 'expenses'), this.records(a, 'payments'),
    ]);
    return buildFranchiseDashboard({ franchises: bootstrap.franchises, products: bootstrap.products, sales, earnings, expenses, payments, external: a.external,
      filters: { start, end, franchiseId: typeof filters.franchiseId === 'string' ? filters.franchiseId : '', state: typeof filters.state === 'string' ? filters.state : '',
        city: typeof filters.city === 'string' ? filters.city : '', planId: typeof filters.planId === 'string' ? filters.planId : '', status: typeof filters.status === 'string' ? filters.status : '',
        productId: typeof filters.productId === 'string' ? filters.productId : '' } });
  }
}
