import { supabaseAdmin } from "../config/supabase.js";
import { EmailService } from "./EmailService.js";

export class FranchiseError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export type FranchiseAccess = {
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

export const FRANCHISE_PRODUCTS = [
  "Trading & demat account",
  "SW Global",
  "Privilege customer",
  "Mutual fund",
  "Child mutual",
  "Child demat",
  "Unlisted shares",
  "IEPF",
  "Course"
];

const LEADERS = ["admin", "ceo", "managing_director", "director", "executive"];
const INTERNAL = ["employee", "hod", "regional_manager"];

export function textField(value: unknown, label: string, required = true, max = 255): string | null {
  if (value === undefined || value === null || value === "") {
    if (required) throw new FranchiseError(`${label} is required.`);
    return null;
  }
  if (typeof value !== "string") throw new FranchiseError(`Invalid ${label}.`);
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if ((!clean && required) || clean.length > max) {
    throw new FranchiseError(`Enter ${label} (maximum ${max} characters).`);
  }
  return clean || null;
}

export function dateField(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)
  ) {
    throw new FranchiseError(`Enter a valid ${label} (YYYY-MM-DD).`);
  }
  return value;
}

export class FranchiseService {
  constructor(
    private db = supabaseAdmin,
    private mailer = new EmailService()
  ) {}

  private client() {
    if (!this.db) throw new FranchiseError("Franchise database service is not configured.", 503);
    return this.db;
  }

  private check<T>(result: { error: any; data: T }, operation = "complete the franchise request"): T {
    if (result.error) {
      const e = result.error;
      if (e.code === "23505") {
        throw new FranchiseError("This record, email or name already exists.", 409);
      }
      if (e.code === "P0001" || e.code === "23514" || e.code === "23503") {
        throw new FranchiseError(e.message);
      }
      if (e.code === '42P10') {
        throw new FranchiseError('The franchise login unique key is missing. Run backend/database_franchise_login_mapping_fix.sql in Supabase SQL Editor, then retry login setup.', 503);
      }
      if (['42P01', '42703', 'PGRST204', 'PGRST205'].includes(e.code)) {
        throw new FranchiseError('Franchise database setup is incomplete. Run the complete backend/database_franchise.sql file in Supabase SQL Editor, then refresh this page.', 503);
      }
      if (e.code === 'PGRST116') {
        throw new FranchiseError('The franchise lookup did not return exactly one record. Check for missing records or conflicting franchise login mappings.', 409);
      }
      if (e.code === '42501') {
        throw new FranchiseError('The backend cannot access franchise records. Check the Supabase service-role configuration and franchise database permissions.', 503);
      }
      console.error("[Franchise database]", e.code, e.message);
      throw new FranchiseError(`Could not ${operation}${e.code ? ` (database error ${e.code})` : ''}. Check the backend database connection and server log.`, 500);
    }
    return result.data;
  }

  async access(userId: string, sessionRole?: string): Promise<FranchiseAccess> {
    const db = this.client();
    const p = this.check(
      await db
        .from("profiles")
        .select("id,role,status,department_id,departments(name)")
        .eq("id", userId)
        .maybeSingle()
    );
    if (!p || p.status !== "active") {
      throw new FranchiseError("Access denied: active account required.", 403);
    }

    const external = ["franchise_owner", "franchise_staff"].includes(p.role);
    const department = (p.departments as any)?.name?.trim().toUpperCase() || null;
    const franchiseTeam = !external && INTERNAL.includes(p.role) && department === "FRANCHISE";
    const admin = p.role === "admin";
    const leadership = LEADERS.includes(p.role);

    let ids: string[] | null = null;
    if (external) {
      const member = this.check(
        await db
          .from("franchise_users")
          .select("franchise_id,membership_role,status,franchises(status)")
          .eq("user_id", userId)
          .eq("status", "active")
      );
      const active = (member || []).filter(m => (m.franchises as any)?.status === 'Active' && m.membership_role === (p.role === 'franchise_owner' ? 'owner' : 'staff'));
      if (!active.length) {
        throw new FranchiseError("Access denied: your franchise or account is inactive.", 403);
      }
      ids = active.map(m => m.franchise_id);
    } else if (!leadership && !franchiseTeam && department !== "FINANCE") {
      throw new FranchiseError("Access denied: Franchise access required.", 403);
    }

    return {
      userId,
      role: p.role,
      department,
      external,
      ids,
      canManage: admin || franchiseTeam || leadership,
      canManageUsers: admin,
      canCreatePlans: admin || leadership,
      canWrite: external || admin || franchiseTeam || leadership,
      canViewOverview: true
    };
  }

  parseFranchiseRow(row: any): any {
    if (!row) return null;
    let extra: Record<string, any> = {};
    if (row.remarks) {
      try {
        extra = JSON.parse(row.remarks);
      } catch {
        extra = {};
      }
    }
    const location = extra.location || row.city || row.state || row.name || "";
    const name = row.owner_name || row.name || "";
    const plan = extra.plan || "Starter";
    const sales = Array.isArray(extra.sales) ? extra.sales : [];
    const hasOffice = Boolean(row.has_office);
    const office = hasOffice ? "Yes" : "No";
    const sqft = hasOffice && row.office_sqft ? String(row.office_sqft) : "";
    const registered = row.registered_on ? String(row.registered_on).slice(0, 10) : "";

    return {
      id: row.id,
      code: row.code,
      location,
      name,
      phone: row.phone || "",
      email: row.email || "",
      plan,
      office,
      has_office: hasOffice,
      sqft,
      office_sqft: row.office_sqft,
      registered,
      registered_on: registered,
      sales,
      status: row.status || "Active",
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  async getPlans(a: FranchiseAccess, snapshot?: any[]) {
    const db = this.client();
    const result = await db.from("franchise_plans").select("*").order("name");
    const plans = this.check(result) || [];
    if (!plans.length) {
      const defaults = [
        { name: "Starter", joining_fee: 0, recurring_fee: 0, billing_frequency: "None" },
        { name: "Growth", joining_fee: 25000, recurring_fee: 0, billing_frequency: "None" },
        { name: "Premier", joining_fee: 50000, recurring_fee: 0, billing_frequency: "None" }
      ];
      for (const d of defaults) {
        await db.from("franchise_plans").insert({ ...d, active: true });
      }
      const re = await db.from("franchise_plans").select("*").order("name");
      return this.check(re) || [];
    }

    // Get franchise counts per plan
    const directory = snapshot || await this.getDirectory(a);
    return plans.map((p: any) => ({
      ...p,
      franchisesCount: directory.filter((f: any) => f.plan?.toLowerCase() === p.name?.toLowerCase()).length
    }));
  }

  async createPlan(a: FranchiseAccess, body: any) {
    if (!a.canCreatePlans) {
      throw new FranchiseError("Only administrators can create new plans.", 403);
    }
    const name = textField(body.name, "Plan name", true, 120)!;
    const description = textField(body.description, "Description", false, 500);
    const joining_fee = Number(body.joining_fee || 0);
    const recurring_fee = Number(body.recurring_fee || 0);
    const billing_frequency = body.billing_frequency && ["None", "Monthly", "Yearly"].includes(body.billing_frequency)
      ? body.billing_frequency
      : "None";

    const db = this.client();
    const res = await db
      .from("franchise_plans")
      .insert({
        name,
        description,
        joining_fee,
        recurring_fee,
        billing_frequency,
        active: body.active !== false
      })
      .select()
      .single();
    return this.check(res);
  }

  async updatePlan(a: FranchiseAccess, id: string, body: any) {
    if (!a.canCreatePlans) {
      throw new FranchiseError("Only administrators can edit plans.", 403);
    }
    const name = textField(body.name, "Plan name", true, 120)!;
    const description = textField(body.description, "Description", false, 500);
    const joining_fee = Number(body.joining_fee || 0);
    const recurring_fee = Number(body.recurring_fee || 0);
    const billing_frequency = body.billing_frequency && ["None", "Monthly", "Yearly"].includes(body.billing_frequency)
      ? body.billing_frequency
      : "None";

    const db = this.client();
    const res = await db
      .from("franchise_plans")
      .update({
        name,
        description,
        joining_fee,
        recurring_fee,
        billing_frequency,
        active: body.active !== false
      })
      .eq("id", id)
      .select()
      .single();
    return this.check(res);
  }

  async deletePlan(a: FranchiseAccess, id: string) {
    if (!a.canCreatePlans) {
      throw new FranchiseError("Only administrators can delete plans.", 403);
    }
    const db = this.client();
    const res = await db.from("franchise_plans").delete().eq("id", id);
    this.check(res);
    return { success: true, message: "Plan deleted successfully." };
  }

  async getDirectory(a: FranchiseAccess, query?: string) {
    const db = this.client();
    let q = db.from("franchises").select("*").order("created_at", { ascending: false });
    if (a.ids !== null) {
      q = q.in("id", a.ids.length ? a.ids : ["00000000-0000-0000-0000-000000000000"]);
    }
    const rows = this.check(await q) || [];
    const sales = await this.getSales(a);
    const byBranch = new Map<string, { products: string[]; cents: number }>();
    for (const sale of sales) {
      const group = byBranch.get(sale.franchise_id) || { products: [], cents: 0 };
      group.products.push(sale.product);
      group.cents += Math.round(Number(sale.amount) * 100);
      byBranch.set(sale.franchise_id, group);
    }
    let list = rows.map((r: any) => {
      const actual = byBranch.get(r.id);
      return { ...this.parseFranchiseRow(r), saleProducts: actual?.products || [], saleCount: actual?.products.length || 0, saleRevenue: (actual?.cents || 0) / 100 };
    });
    if (query && query.trim()) {
      const term = query.trim().toLowerCase();
      list = list.filter((f: any) =>
        f.name.toLowerCase().includes(term) ||
        f.location.toLowerCase().includes(term) ||
        f.plan.toLowerCase().includes(term) ||
        f.email.toLowerCase().includes(term) ||
        f.phone.toLowerCase().includes(term)
      );
    }
    return list;
  }

  async getOverview(a: FranchiseAccess, snapshot?: any[]) {
    const directory = snapshot || await this.getDirectory(a);
    const allSales = directory.flatMap((f: any) => f.saleProducts || []);
    const withOfficeList = directory.filter((f: any) => f.office === "Yes" && Number(f.sqft) > 0);

    const kpis = {
      totalFranchises: directory.length,
      withOffice: withOfficeList.length,
      productsSold: allSales.length,
      productTypesSold: new Set(allSales).size,
      saleRevenue: directory.reduce((sum: number, f: any) => sum + Math.round(f.saleRevenue * 100), 0) / 100
    };

    const countByProduct: Record<string, number> = {};
    for (const p of FRANCHISE_PRODUCTS) {
      countByProduct[p] = allSales.filter((x: string) => x === p).length;
    }

    const productSalesMix = Object.entries(countByProduct)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([product, count]) => ({
        product,
        count,
        percentage: allSales.length ? Math.round((count / allSales.length) * 100) : 0
      }));

    const officeFootprint = withOfficeList
      .map((f: any) => ({
        id: f.id,
        location: f.location,
        name: f.name,
        sqft: Number(f.sqft) || 0
      }))
      .sort((a: any, b: any) => b.sqft - a.sqft);

    return {
      kpis,
      productSalesMix,
      officeFootprint,
      directoryPreview: directory.slice(0, 4),
      totalFranchises: directory.length,
      products: FRANCHISE_PRODUCTS
    };
  }

  async getProductsSummary(a: FranchiseAccess) {
    const directory = await this.getDirectory(a);
    const totalSales = directory.flatMap((f: any) => f.saleProducts || []).length;

    const summary = FRANCHISE_PRODUCTS.map(product => {
      const sellers = directory.filter((f: any) => (f.saleProducts || []).includes(product));
      return {
        product,
        sold: sellers.reduce((sum: number, f: any) => sum + f.saleProducts.filter((p: string) => p === product).length, 0),
        franchises: sellers.map((f: any) => f.location).join(", ") || "—"
      };
    });

    return {
      totalSales,
      summary,
      products: FRANCHISE_PRODUCTS
    };
  }

  async bootstrap(a: FranchiseAccess) {
    // All cards and directory rows share one confirmed sales snapshot.
    const directory = await this.getDirectory(a);
    const [overview, plans] = await Promise.all([
      this.getOverview(a, directory),
      this.getPlans(a, directory)
    ]);

    return {
      access: a,
      overview,
      directory,
      plans,
      products: FRANCHISE_PRODUCTS
    };
  }

  async register(a: FranchiseAccess, body: any) {
    if (!a.canWrite || a.role === "ceo") {
      throw new FranchiseError("Access denied: you do not have permission to add franchises.", 403);
    }

    const location = textField(body.location, "Franchise location", true, 120)!;
    const name = textField(body.name, "Name", true, 255)!;
    const phone = textField(body.phone, "Phone", true, 50)!;
    const email = textField(body.email, "Email", true, 255)!.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new FranchiseError("Enter a valid email address.");
    }

    const plan = textField(body.plan || "Starter", "Plan", true, 120)!;
    const hasOffice = body.office === "Yes" || body.has_office === true;
    let sqftNum: number | null = null;
    if (hasOffice) {
      const sqftVal = body.sqft || body.office_sqft;
      if (!sqftVal || Number(sqftVal) <= 0) {
        throw new FranchiseError("Enter the office area in sq ft.");
      }
      sqftNum = Number(sqftVal);
    }

    const registered = body.registered || body.registered_on || new Date().toISOString().slice(0, 10);
    dateField(registered, "Registered on");

    const rawSales = Array.isArray(body.sales) ? body.sales : [];
    const sales = rawSales.filter((p: string) => FRANCHISE_PRODUCTS.includes(p));

    const db = this.client();

    const existingFranchise = await db.from("franchises").select("id").eq("email", email).eq("city", location).maybeSingle();
    if (existingFranchise.data) {
      throw new FranchiseError(`A franchise at ${location} with email ${email} already exists.`, 409);
    }

    const remarksPayload = JSON.stringify({
      location,
      plan,
      sales
    });

    const franchiseData = {
      name,
      owner_name: name,
      city: location,
      state: location,
      phone,
      email,
      has_office: hasOffice,
      office_sqft: sqftNum,
      registered_on: registered,
      status: body.status || "Active",
      remarks: remarksPayload,
      created_by: a.userId
    };

    const ins = await db.from("franchises").insert(franchiseData).select().single();
    const createdFranchise = this.check(ins);

    await this.provisionLogins(createdFranchise);
    let emailSent = false;
    try {
      await this.mailer.sendFranchiseCredentials(email, name, `${name} (${location})`);
      emailSent = true;
    } catch { emailSent = false; }

    const parsed = this.parseFranchiseRow(createdFranchise);
    return {
      success: true,
      franchise: parsed,
      emailSent
    };
  }

  async updateFranchise(a: FranchiseAccess, id: string, body: any) {
    if (!a.canWrite) {
      throw new FranchiseError("Access denied: you do not have permission to edit franchises.", 403);
    }

    const db = this.client();
    const existing = this.check(await db.from("franchises").select("*").eq("id", id).maybeSingle());
    if (!existing) {
      throw new FranchiseError("Franchise not found.", 404);
    }

    if (a.ids !== null && !a.ids.includes(id)) {
      throw new FranchiseError("Access denied: you can only edit your own franchise.", 403);
    }

    const location = textField(body.location || existing.city, "Franchise location", true, 120)!;
    const name = textField(body.name || existing.owner_name, "Name", true, 255)!;
    const phone = textField(body.phone || existing.phone, "Phone", true, 50)!;
    const email = textField(body.email || existing.email, "Email", true, 255)!.toLowerCase();

    const plan = textField(body.plan || "Starter", "Plan", true, 120)!;
    const hasOffice = body.office === "Yes" || body.has_office === true;
    let sqftNum: number | null = null;
    if (hasOffice) {
      const sqftVal = body.sqft || body.office_sqft;
      if (!sqftVal || Number(sqftVal) <= 0) {
        throw new FranchiseError("Enter the office area in sq ft.");
      }
      sqftNum = Number(sqftVal);
    }

    const registered = body.registered || body.registered_on || existing.registered_on;
    const rawSales = Array.isArray(body.sales) ? body.sales : [];
    const sales = rawSales.filter((p: string) => FRANCHISE_PRODUCTS.includes(p));

    const remarksPayload = JSON.stringify({
      location,
      plan,
      sales
    });

    const updateData = {
      name,
      owner_name: name,
      city: location,
      state: location,
      phone,
      email,
      has_office: hasOffice,
      office_sqft: sqftNum,
      registered_on: registered,
      remarks: remarksPayload,
      updated_at: new Date().toISOString()
    };

    const updated = this.check(
      await db.from("franchises").update(updateData).eq("id", id).select().single()
    );

    return this.parseFranchiseRow(updated);
  }

  async deleteFranchise(a: FranchiseAccess, id: string) {
    if (!a.canManageUsers && a.role !== "admin" && a.role !== "hod") {
      throw new FranchiseError("Only administrators and managers can delete franchises.", 403);
    }

    const db = this.client();
    await db.from("franchise_users").delete().eq("franchise_id", id);
    await db.from("franchise_plan_assignments").delete().eq("franchise_id", id);
    const res = await db.from("franchises").delete().eq("id", id);
    this.check(res);
    return { success: true, message: "Franchise deleted successfully." };
  }

  async enableRoleLogins(a: FranchiseAccess, id: string) {
    if (!a.canManage) throw new FranchiseError('Only franchise managers can configure logins.',403);
    if (a.ids && !a.ids.includes(id)) throw new FranchiseError('Access denied.',403);
    const franchise = this.check(await this.client().from('franchises').select('*').eq('id',id).maybeSingle());
    if (!franchise) throw new FranchiseError('Franchise not found.',404);
    await this.provisionLogins(franchise);
    return { success:true, email:franchise.email };
  }

  private async provisionLogins(franchise: any) {
    const db = this.client();
    const publicEmail = String(franchise.email).trim().toLowerCase();
    for (const membership of ['owner', 'staff'] as const) {
      const role = `franchise_${membership}`;
      const password = membership === 'owner' ? 'password1234' : 'password123';
      const links = this.check(await db.from('franchise_users').select('user_id').eq('franchise_id', franchise.id).eq('membership_role', membership), 'load this branch’s login accounts');
      const linkedUsers = [...new Set((links || []).map(link => link.user_id))];
      if (linkedUsers.length > 1) throw new FranchiseError(`This franchise has multiple ${membership} login accounts. Correct its franchise_users mappings before resetting passwords.`, 409);
      let userId = linkedUsers[0];
      if (!userId) {
        const mappings = this.check(await db.from('franchise_users').select('user_id').eq('login_email', publicEmail).eq('membership_role', membership), 'find the existing franchise email mapping');
        const mappedUsers = [...new Set((mappings || []).map(mapping => mapping.user_id))];
        if (mappedUsers.length > 1) throw new FranchiseError('Conflicting franchise login mappings. Correct them before creating another branch.');
        userId = mappedUsers[0];
      }
      let authEmail = `franchise.${franchise.id}.${membership}@mis-login.invalid`;
      // A previous attempt may have created the account before its mapping failed.
      if (!userId) {
        const recovered = this.check(await db.from('profiles').select('id,role,email').eq('email', authEmail).maybeSingle(), 'recover the franchise login account');
        if (recovered) {
          if (recovered.role !== role) throw new FranchiseError('The existing franchise login email belongs to a different account role.', 409);
          userId = recovered.id;
        }
      }
      if (userId) {
        const profile = this.check(await db.from('profiles').select('role,email').eq('id', userId).single(), 'load the franchise login profile');
        if (!profile || profile.role !== role) throw new FranchiseError('This franchise membership points to a different account role. Correct the mapping before resetting credentials.');
        authEmail = profile.email;
        const reset = await db.auth.admin.updateUserById(userId, { password });
        if (reset.error) throw new FranchiseError('Could not reset franchise credentials.', 500);
      } else {
        const created = await db.auth.admin.createUser({email:authEmail,password,email_confirm:true,user_metadata:{full_name:franchise.owner_name,role}});
        if (created.error || !created.data.user) throw new FranchiseError('Could not create franchise login. Use Email Login to retry provisioning.', 500);
        userId = created.data.user.id;
      }
      this.check(await db.from('profiles').upsert({id:userId,email:authEmail,full_name:franchise.owner_name,role,status:'active',branch_id:null,department_id:null,allowed_modules:['franchise']}), 'save the franchise login profile');
      const mapping = {franchise_id:franchise.id,user_id:userId,membership_role:membership,login_email:publicEmail,status:'active'};
      let saved = await db.from('franchise_users').upsert(mapping, {onConflict:'franchise_id,user_id'});
      if (saved.error?.code === '42P10') {
        // Support older tables until the unique-key migration is applied.
        // Never retry other errors: the original write may have succeeded.
        saved = links?.some(link => link.user_id === userId)
          ? await db.from('franchise_users').update(mapping).eq('franchise_id', franchise.id).eq('user_id', userId)
          : await db.from('franchise_users').insert(mapping);
      }
      this.check(saved, 'save this branch’s login mapping');
    }
  }

  async getSales(a: FranchiseAccess) {
    const sales: any[] = [];
    for (let offset = 0; ; offset += 1000) {
      let query = this.client().from('franchise_sales').select('*').order('sale_date',{ascending:false}).order('id').range(offset,offset + 999);
      if (a.ids) query = query.in('franchise_id', a.ids);
      const page = this.check(await query) || [];
      sales.push(...page);
      if (page.length < 1000) return sales;
    }
  }

  private salePayload(a: FranchiseAccess, body: any) {
    if (!a.canWrite) throw new FranchiseError('Sales entry is not allowed.',403);
    const franchiseId = textField(body.franchise_id,'Franchise')!;
    if (a.ids && !a.ids.includes(franchiseId)) throw new FranchiseError('You can add sales only for your assigned branches.',403);
    const product = textField(body.product,'Product')!;
    if (!FRANCHISE_PRODUCTS.includes(product)) throw new FranchiseError('Select a valid product.');
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) throw new FranchiseError('Enter a valid sale amount.');
    const customer = textField(body.customer_name,'Customer name')!;
    const saleDate = dateField(body.sale_date,'Sale date');
    return {franchise_id:franchiseId,product,amount,customer_name:customer,sale_date:saleDate,created_by:a.userId};
  }

  async createSale(a: FranchiseAccess, body: any) {
    return this.check(await this.client().from('franchise_sales').insert(this.salePayload(a,body)).select().single());
  }

  async bulkCreateSales(a: FranchiseAccess, rows: any[]) {
    if (!a.canWrite) throw new FranchiseError('Sales entry is not allowed.',403);
    if (!Array.isArray(rows) || !rows.length || rows.length > 500) throw new FranchiseError('Upload between 1 and 500 sales.');
    const pending: Array<{ row: number; payload: ReturnType<FranchiseService['salePayload']> }> = [];
    const failed: Array<{row:number;error:string}> = [];
    const sales: any[] = [];
    rows.forEach((row,index) => {try {pending.push({row:index+2,payload:this.salePayload(a,row)});}catch(error:any){failed.push({row:index+2,error:error.message});}});
    for (let offset=0;offset<pending.length;offset+=100) {
      const batch=pending.slice(offset,offset+100);
      const result=await this.client().from('franchise_sales').insert(batch.map(item=>item.payload)).select();
      if (!result.error) {sales.push(...(result.data || []));continue;}
      if (/^(22|23)/.test(result.error.code || '')) {
        for(let index=0;index<batch.length;index+=5) {
          const results=await Promise.all(batch.slice(index,index+5).map(async item=>({row:item.row,result:await this.client().from('franchise_sales').insert(item.payload).select().single()})));
          for (const item of results) {if(item.result.error)failed.push({row:item.row,error:'This sale could not be saved. Check its branch and values.'});else sales.push(item.result.data);}
        }
      } else for(const item of batch)failed.push({row:item.row,error:'Save was not confirmed. Check sales history before retrying.'});
    }
    failed.sort((a,b)=>a.row-b.row);
    return {inserted:sales.length,failed,sales};
  }

  async resendCredentials(a: FranchiseAccess, id: string) {
    if (!a.canManage) {
      throw new FranchiseError("Access denied: you do not have permission to reset credentials.", 403);
    }

    const db = this.client();
    const existing = this.check(await db.from("franchises").select("*").eq("id", id).maybeSingle());
    if (!existing) {
      throw new FranchiseError("Franchise not found.", 404);
    }

    const parsed = this.parseFranchiseRow(existing);
    await this.provisionLogins(existing);
    let sent = false;
    try {
      await this.mailer.sendFranchiseCredentials(
        parsed.email,
        parsed.name,
        `${parsed.name} (${parsed.location})`
      );
      sent = true;
    } catch (mailErr) {
      console.warn("[Resend Mail Warning]", mailErr);
      sent = false;
    }

    return {
      success: true,
      email: parsed.email,
      sent
    };
  }
}
