import { supabaseAdmin } from '../config/supabase.js';
import type { Sale, ProductType, SaleStatus } from '../models/sale.model.js';

const PRODUCT_TYPES: ProductType[] = [
  'Trading and Demat', 'Mutual Fund', 'Unlisted Shares',
  'Child Demat', 'Child Mutual Fund', 'IEPF', 'SW Global',
];
const SALE_STATUSES: SaleStatus[] = ['Pending', 'Completed', 'Cancelled'];

export class SalesService {
  /**
   * Strips NUL/control characters, which Postgres rejects outright in text
   * columns. Matches IEPFService/every other department service — never
   * HTML-entity-encodes, since the React frontend renders this as plain
   * text and never uses dangerouslySetInnerHTML.
   */
  private sanitizeText(str: string): string {
    const controlCharPattern = new RegExp('[' + String.fromCharCode(0) + '-' + String.fromCharCode(31) + String.fromCharCode(127) + ']', 'g');
    return str.replace(controlCharPattern, '');
  }

  private validateSalePayload(data: Partial<Sale>): void {
    if (data.product_type !== undefined && !PRODUCT_TYPES.includes(data.product_type)) {
      throw new Error('Invalid product type.');
    }
    if (data.status !== undefined && !SALE_STATUSES.includes(data.status)) {
      throw new Error('Invalid status.');
    }
    if (data.sale_value !== undefined && Number(data.sale_value) < 0) {
      throw new Error('Sale value cannot be negative.');
    }
    if (data.units !== undefined && data.units !== null && Number(data.units) < 0) {
      throw new Error('Units cannot be negative.');
    }
    if (data.client_contact !== undefined && data.client_contact !== null && data.client_contact !== '') {
      if (!/^\d{10}$/.test(data.client_contact.trim())) {
        throw new Error('Client contact must be exactly 10 digits.');
      }
    }
  }

  /**
   * Verifies if the requester has permission to access Sales department
   * data — either org-wide leadership, or a member of the Sales department.
   */
  private async verifyAccess(userId: string): Promise<{ authorized: boolean; branchId?: string; role?: string }> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client is not configured.');

    const { data: profile, error } = await client
      .from('profiles')
      .select('*, departments(name)')
      .eq('id', userId)
      .single();

    if (error || !profile) return { authorized: false };

    const isExecutive = ['admin', 'ceo', 'managing_director', 'director', 'executive'].includes(profile.role);
    const isSalesDept = profile.departments?.name === 'Sales';

    if (!isExecutive && !isSalesDept) return { authorized: false };

    return { authorized: true, branchId: profile.branch_id, role: profile.role };
  }

  /**
   * Creates a new sale record.
   */
  async createSale(data: Partial<Sale>, creatorId: string): Promise<Sale> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client is not configured.');

    const access = await this.verifyAccess(creatorId);
    if (!access.authorized) throw new Error('Unauthorized: you must belong to the Sales department to log sales.');

    if (!data.client_name || !data.product_type || !data.sale_date) {
      throw new Error('Client name, product type, and sale date are required.');
    }

    this.validateSalePayload(data);

    const saleToInsert: any = {
      client_name: this.sanitizeText(data.client_name.trim()),
      client_contact: data.client_contact ? data.client_contact.trim() : null,
      product_type: data.product_type,
      sale_value: Number(data.sale_value) || 0,
      units: data.units !== undefined && data.units !== null ? Number(data.units) : null,
      sale_date: data.sale_date,
      status: data.status || 'Pending',
      remarks: data.remarks ? this.sanitizeText(data.remarks.trim()) : null,
      created_by: creatorId,
      branch_id: access.branchId || null,
    };

    const { data: inserted, error } = await client
      .from('sales')
      .insert(saleToInsert)
      .select('*, branches(name), profiles:created_by(full_name, email)')
      .single();

    if (error) throw new Error(`Failed to create sale: ${error.message}`);
    return inserted as any;
  }

  /**
   * Updates an existing sale record, with branch/creator/finalized-state locks.
   */
  async updateSale(id: string, data: Partial<Sale>, updaterId: string): Promise<Sale> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client is not configured.');

    const access = await this.verifyAccess(updaterId);
    if (!access.authorized) throw new Error('Unauthorized: you must belong to the Sales department to edit sales.');

    const { data: existing, error: fetchError } = await client.from('sales').select('*').eq('id', id).single();
    if (fetchError || !existing) throw new Error('Sale record not found.');

    const isPrivilegedRole = ['admin', 'ceo', 'managing_director', 'director', 'executive', 'hod'].includes(access.role || '');

    // Employees/HODs are locked to their own branch's records.
    if ((access.role === 'employee' || access.role === 'hod') && existing.branch_id !== access.branchId) {
      throw new Error('Unauthorized: you cannot access or modify sales belonging to other branch offices.');
    }

    // A finalized sale (Completed/Cancelled) is frozen for standard employees —
    // only HOD/admin/executives can correct a closed-out record.
    const isFinalized = ['Completed', 'Cancelled'].includes(existing.status);
    if (isFinalized && !isPrivilegedRole) {
      throw new Error('Locked: finalized sales (Completed/Cancelled) cannot be modified by standard employees.');
    }

    // Standard employees may only edit sales they personally logged.
    if (access.role === 'employee' && existing.created_by !== updaterId) {
      throw new Error('Unauthorized: you can only edit sales that you logged.');
    }

    this.validateSalePayload(data);

    const patch: any = { updated_at: new Date().toISOString() };
    if (data.client_name !== undefined) patch.client_name = this.sanitizeText(data.client_name.trim());
    if (data.client_contact !== undefined) patch.client_contact = data.client_contact ? data.client_contact.trim() : null;
    if (data.product_type !== undefined) patch.product_type = data.product_type;
    if (data.sale_value !== undefined) patch.sale_value = Number(data.sale_value);
    if (data.units !== undefined) patch.units = data.units !== null ? Number(data.units) : null;
    if (data.sale_date !== undefined) patch.sale_date = data.sale_date;
    if (data.status !== undefined) patch.status = data.status;
    if (data.remarks !== undefined) patch.remarks = data.remarks ? this.sanitizeText(data.remarks.trim()) : null;

    const { data: updated, error } = await client
      .from('sales')
      .update(patch)
      .eq('id', id)
      .select('*, branches(name), profiles:created_by(full_name, email)')
      .single();

    if (error) throw new Error(`Failed to update sale: ${error.message}`);
    return updated as any;
  }

  async deleteSale(id: string, requesterId: string): Promise<void> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client is not configured.');

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized: you must belong to the Sales department to delete sales.');

    const { data: existing, error: fetchError } = await client.from('sales').select('branch_id, status, created_by').eq('id', id).single();
    if (fetchError || !existing) throw new Error('Sale record not found.');

    const isPrivilegedRole = ['admin', 'ceo', 'managing_director', 'director', 'executive', 'hod'].includes(access.role || '');

    if ((access.role === 'employee' || access.role === 'hod') && existing.branch_id !== access.branchId) {
      throw new Error('Unauthorized: you cannot access or modify sales belonging to other branch offices.');
    }

    const isFinalized = ['Completed', 'Cancelled'].includes(existing.status);
    if (isFinalized && !isPrivilegedRole) {
      throw new Error('Locked: finalized sales (Completed/Cancelled) cannot be deleted by standard employees.');
    }

    if (access.role === 'employee' && existing.created_by !== requesterId) {
      throw new Error('Unauthorized: you can only delete sales that you logged.');
    }

    const { error } = await client.from('sales').delete().eq('id', id);
    if (error) throw new Error(`Delete failed: ${error.message}`);
  }

  /**
   * Fetches sale records, branch-scoped for employees/HODs.
   */
  async getSales(requesterId: string, filters: { status?: string; productType?: string; branchId?: string; search?: string }): Promise<Sale[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client is not configured.');

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized: Access denied.');

    let query = client
      .from('sales')
      .select('*, branches(name), profiles:created_by(full_name, email)')
      .order('created_at', { ascending: false });

    if (access.role === 'employee' || access.role === 'hod') {
      if (access.branchId) query = query.eq('branch_id', access.branchId);
    }
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.productType) query = query.eq('product_type', filters.productType);
    if (filters.branchId) query = query.eq('branch_id', filters.branchId);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to retrieve sales: ${error.message}`);

    let result = data as any[];
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter((r) =>
        r.client_name.toLowerCase().includes(s) ||
        (r.client_contact && r.client_contact.toLowerCase().includes(s))
      );
    }
    return result;
  }

  /**
   * Dashboard KPIs + product-wise breakdown + trend + branch distribution.
   */
  async getDashboardData(requesterId: string, branchIdFilter?: string, startDate?: string, endDate?: string): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client is not configured.');

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    let query = client.from('sales').select('*, branches(name)');

    let targetBranchId: string | undefined = branchIdFilter;
    if (access.role === 'employee' || access.role === 'hod') {
      if (!access.branchId) throw new Error('Unauthorized: No branch assigned — dashboard unavailable.');
      targetBranchId = access.branchId;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (startDate && !dateRegex.test(startDate)) throw new Error('Invalid start date format (YYYY-MM-DD).');
    if (endDate && !dateRegex.test(endDate)) throw new Error('Invalid end date format (YYYY-MM-DD).');

    if (targetBranchId) query = query.eq('branch_id', targetBranchId);
    if (startDate) query = query.gte('sale_date', startDate);
    if (endDate) query = query.lte('sale_date', endDate);

    const { data: sales, error } = await query;
    if (error || !sales) throw new Error(`Failed to load dashboard metrics: ${error?.message || 'No sales'}`);

    // Only Completed sales count toward revenue KPIs/charts — Pending isn't
    // realized yet, Cancelled never happened.
    const completed = sales.filter((s) => s.status === 'Completed');

    const totalSalesValue = completed.reduce((sum, s) => sum + Number(s.sale_value || 0), 0);
    const totalSalesCount = completed.length;
    const pendingCount = sales.filter((s) => s.status === 'Pending').length;
    const cancelledCount = sales.filter((s) => s.status === 'Cancelled').length;
    const avgSaleValue = totalSalesCount > 0 ? totalSalesValue / totalSalesCount : 0;

    // ── Product-wise breakdown (value + count) ──────────────────────────
    const productMap: { [key: string]: { value: number; count: number } } = {};
    for (const p of PRODUCT_TYPES) productMap[p] = { value: 0, count: 0 };
    completed.forEach((s) => {
      const p = s.product_type as string;
      if (!productMap[p]) productMap[p] = { value: 0, count: 0 };
      productMap[p].value += Number(s.sale_value || 0);
      productMap[p].count += 1;
    });
    const productBreakdown = Object.entries(productMap)
      .map(([product, v]) => ({ product, value: v.value, count: v.count }))
      .filter((p) => p.value > 0 || p.count > 0);

    // ── Monthly trend (current year) ────────────────────────────────────
    const now = new Date();
    const currentYear = now.getFullYear();
    const monthlyTotals = Array(12).fill(0);
    completed.forEach((s) => {
      const d = new Date(s.sale_date);
      if (d.getFullYear() === currentYear) monthlyTotals[d.getMonth()] += Number(s.sale_value || 0);
    });
    const monthsLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrend = monthsLabels.map((label, idx) => ({ month: label, value: monthlyTotals[idx] }));

    // ── Branch distribution (value) ─────────────────────────────────────
    const branchMap: { [key: string]: number } = {};
    completed.forEach((s: any) => {
      const name = s.branches?.name || 'Unassigned';
      branchMap[name] = (branchMap[name] || 0) + Number(s.sale_value || 0);
    });
    const branchDistribution = Object.entries(branchMap).map(([name, value]) => ({ name, value }));

    return {
      kpis: {
        totalSalesValue: Number(totalSalesValue.toFixed(2)),
        totalSalesCount,
        avgSaleValue: Number(avgSaleValue.toFixed(2)),
        pendingCount,
        cancelledCount,
      },
      charts: {
        productBreakdown,
        monthlyTrend,
        branchDistribution,
      },
    };
  }
}
