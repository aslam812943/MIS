import { supabaseAdmin } from '../config/supabase.js';

export interface PayInPayOutRecord {
  id?: string;
  settlement_date: string;
  client_id: string;
  client_name: string;
  stock_symbol: string;
  buy_sell: 'Buy' | 'Sell';
  quantity: number;
  shortage_qty: number;
  status: 'Completed' | 'Pending' | 'Shortage';
  branch_id?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  branches?: { name: string };
  profiles?: { full_name: string; email: string };
}

export interface ClientRequestRecord {
  id?: string;
  request_id: string;
  client_name: string;
  request_type: 'Demat Transfer' | 'Pledge Release' | 'Account Closure' | 'Bank Detail Update' | 'Rematerialization' | 'Other';
  date_received: string;
  status: 'Received' | 'In Process' | 'Pending' | 'Completed';
  remarks?: string;
  days_pending?: number;
  branch_id?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  branches?: { name: string };
  profiles?: { full_name: string; email: string };
}

export interface IpoAllocationRecord {
  id?: string;
  application_no: string;
  client_id: string;
  client_name: string;
  ipo_name: string;
  category: 'Retail' | 'HNI' | 'QIB' | 'Employee';
  applied_qty: number;
  allotted_qty: number;
  status: 'Applied' | 'Allotted' | 'Refunded' | 'Partially Allotted';
  branch_id?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  branches?: { name: string };
  profiles?: { full_name: string; email: string };
}

export interface CorporateActionRecord {
  id?: string;
  client_id: string;
  client_name: string;
  stock_symbol: string;
  corporate_action: 'Dividend' | 'Bonus' | 'Stock Split' | 'Rights Issue';
  record_date: string;
  quantity: number;
  eligible: 'Yes' | 'No';
  entitlement_amt_qty: number;
  branch_id?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  branches?: { name: string };
  profiles?: { full_name: string; email: string };
}

export class SettlementService {
  /**
   * Helper method to verify if a user is authorized to perform Settlements actions.
   * Authorized roles: admin, management (ceo, managing_director, director, executive), and anyone in Settlements dept.
   */
  async verifyAccess(userId: string): Promise<{ authorized: boolean; role?: string; branchId?: string; departmentId?: string }> {
    const client = supabaseAdmin;
    if (!client) return { authorized: false };

    const { data: profile, error } = await client
      .from('profiles')
      .select('role, branch_id, department_id, departments(name)')
      .eq('id', userId)
      .single();

    if (error || !profile) return { authorized: false };

    const role = profile.role;
    const branchId = profile.branch_id;
    const departmentId = profile.department_id;
    const departmentName = (profile.departments as any)?.name || '';

    const isAuthorized = 
      role === 'admin' || 
      ['ceo', 'managing_director', 'director', 'executive'].includes(role) ||
      departmentName.toUpperCase() === 'SETTLEMENTS';

    return {
      authorized: isAuthorized,
      role,
      branchId,
      departmentId
    };
  }

  /* ═══════════════════════════════════════════════
     PART 5: DASHBOARD AGGREGATIONS
     ═══════════════════════════════════════════════ */

  /**
   * Aggregates stats across all Settlement sheets
   */
  async getDashboardStats(requesterId: string, branchIdFilter?: string, startDate?: string, endDate?: string): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client not configured.');

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) {
      throw new Error('Unauthorized: Access denied.');
    }

    // Branch locking logic (Only lock standard employees, allow HODs to view other branch stats)
    let targetBranchId: string | undefined = branchIdFilter;
    if (access.role === 'employee') {
      targetBranchId = access.branchId || undefined;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (startDate && !dateRegex.test(startDate)) throw new Error('Invalid start date format (YYYY-MM-DD).');
    if (endDate && !dateRegex.test(endDate)) throw new Error('Invalid end date format (YYYY-MM-DD).');

    // Helper to apply filters to any query
    const applyFilters = <T extends any>(baseQuery: T): T => {
      let q: any = baseQuery;
      if (targetBranchId) q = q.eq('branch_id', targetBranchId);
      if (startDate) q = q.gte('created_at', startDate);
      if (endDate) q = q.lte('created_at', `${endDate}T23:59:59.999Z`);
      return q;
    };

    // 1. Pay-in/Pay-out Stats
    const { data: ppData, error: ppError } = await applyFilters(
      client.from('settlement_payin_payout').select('buy_sell, quantity, shortage_qty, status')
    );
    if (ppError) throw new Error(`Error fetching Pay-in stats: ${ppError.message}`);

    // 2. Client Requests Stats
    const { data: crData, error: crError } = await applyFilters(
      client.from('settlement_client_requests').select('status, date_received, request_type')
    );
    if (crError) throw new Error(`Error fetching Client Request stats: ${crError.message}`);

    // 3. IPO Allocation Stats
    const { data: ipoData, error: ipoError } = await applyFilters(
      client.from('settlement_ipo_allocation').select('status, applied_qty, allotted_qty')
    );
    if (ipoError) throw new Error(`Error fetching IPO stats: ${ipoError.message}`);

    // 4. Corporate Action Stats
    const { data: caData, error: caError } = await applyFilters(
      client.from('settlement_corporate_actions').select('corporate_action, eligible, entitlement_amt_qty')
    );
    if (caError) throw new Error(`Error fetching Corporate Action stats: ${caError.message}`);

    // PP Aggregates
    let totalBuyQty = 0;
    let totalSellQty = 0;
    let totalShortageQty = 0;
    const ppStatusCounts = { Completed: 0, Pending: 0, Shortage: 0 };
    (ppData || []).forEach(r => {
      if (r.buy_sell === 'Buy') totalBuyQty += r.quantity || 0;
      else if (r.buy_sell === 'Sell') totalSellQty += r.quantity || 0;
      totalShortageQty += r.shortage_qty || 0;
      if (r.status in ppStatusCounts) ppStatusCounts[r.status as keyof typeof ppStatusCounts]++;
    });

    // Client Requests Aggregates
    const crStatusCounts = { Received: 0, 'In Process': 0, Pending: 0, Completed: 0 };
    let overdueCount = 0;
    const todayStr = new Date().toISOString().split('T')[0] || '';
    const parts = todayStr.split('-').map(Number);
    const todayUTC = Date.UTC(parts[0] || 0, (parts[1] || 1) - 1, parts[2] || 1);

    // Monthly trends counts
    const currentYear = new Date().getFullYear();
    const monthlyCounts = Array(12).fill(0);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Request type counts
    const requestTypeCounts: { [key: string]: number } = {
      'Demat Transfer': 0,
      'Pledge Release': 0,
      'Account Closure': 0,
      'Bank Detail Update': 0,
      'Rematerialization': 0,
      'Other': 0
    };

    (crData || []).forEach(r => {
      if (r.status in crStatusCounts) crStatusCounts[r.status as keyof typeof crStatusCounts]++;
      
      // Calculate overdue pending (> 2 days)
      if (r.status === 'Pending' && r.date_received) {
        const rParts = r.date_received.split('-').map(Number);
        const receivedUTC = Date.UTC(rParts[0] || 0, (rParts[1] || 1) - 1, rParts[2] || 1);
        const diffTime = todayUTC - receivedUTC;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 2) {
          overdueCount++;
        }
      }

      // Add to monthly count
      if (r.date_received) {
        const date = new Date(r.date_received);
        if (date.getFullYear() === currentYear) {
          const monthIndex = date.getMonth();
          if (monthIndex >= 0 && monthIndex < 12) {
            monthlyCounts[monthIndex]++;
          }
        }
      }

      // Add to request type count
      if (r.request_type && requestTypeCounts[r.request_type] !== undefined) {
        requestTypeCounts[r.request_type] = (requestTypeCounts[r.request_type] || 0) + 1;
      }
    });

    const monthlyTrend = monthNames.map((name, idx) => ({
      month: name,
      count: monthlyCounts[idx]
    }));

    const requestTypeBreakdown = Object.keys(requestTypeCounts).map(type => ({
      type,
      count: requestTypeCounts[type] || 0
    }));

    // IPO Allocations Aggregates
    let totalIpoApplied = 0;
    let totalIpoAllotted = 0;
    const ipoStatusCounts = { Applied: 0, Allotted: 0, Refunded: 0, 'Partially Allotted': 0 };
    (ipoData || []).forEach(r => {
      totalIpoApplied += r.applied_qty || 0;
      totalIpoAllotted += r.allotted_qty || 0;
      if (r.status in ipoStatusCounts) ipoStatusCounts[r.status as keyof typeof ipoStatusCounts]++;
    });

    // Corporate Actions Aggregates
    let totalEntitlementAmt = 0;
    const caEligibleCounts = { Yes: 0, No: 0 };
    const caTypeCounts = { Dividend: 0, Bonus: 0, 'Stock Split': 0, 'Rights Issue': 0 };
    (caData || []).forEach(r => {
      totalEntitlementAmt += Number(r.entitlement_amt_qty) || 0;
      if (r.eligible in caEligibleCounts) caEligibleCounts[r.eligible as keyof typeof caEligibleCounts]++;
      if (r.corporate_action in caTypeCounts) caTypeCounts[r.corporate_action as keyof typeof caTypeCounts]++;
    });

    // Pay-in/Pay-out Status Breakdown
    const payinPayoutStatusBreakdown = Object.keys(ppStatusCounts).map(status => ({
      status,
      count: ppStatusCounts[status as keyof typeof ppStatusCounts]
    }));

    return {
      payinPayout: {
        totalBuyQty,
        totalSellQty,
        totalShortageQty,
        statusCounts: ppStatusCounts,
        totalRecords: (ppData || []).length
      },
      clientRequests: {
        totalRecords: (crData || []).length,
        statusCounts: crStatusCounts,
        overdueCount
      },
      ipoAllocation: {
        totalRecords: (ipoData || []).length,
        totalAppliedQty: totalIpoApplied,
        totalAllottedQty: totalIpoAllotted,
        statusCounts: ipoStatusCounts
      },
      corporateActions: {
        totalRecords: (caData || []).length,
        totalEntitlementAmt,
        eligibleCounts: caEligibleCounts,
        typeCounts: caTypeCounts
      },
      charts: {
        payinPayoutStatus: payinPayoutStatusBreakdown,
        monthlyTrend,
        requestTypes: requestTypeBreakdown
      }
    };
  }

  /* ═══════════════════════════════════════════════
     PART 1: PAY-IN / PAY-OUT TRACKER METHODS
     ═══════════════════════════════════════════════ */

  /**
   * Fetch Pay-in/Pay-out Tracker rows with filters
   */
  async getPayInPayOutRecords(
    requesterId: string, 
    filters: { status?: string; branchId?: string; search?: string }
  ): Promise<PayInPayOutRecord[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client not configured.');

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) {
      throw new Error('Unauthorized: Access to Settlements department is denied.');
    }

    let query = client
      .from('settlement_payin_payout')
      .select('*, branches(name), profiles:created_by(full_name, email)')
      .order('settlement_date', { ascending: false });

    // Branch locking for standard employees
    if (access.role === 'employee' || access.role === 'hod') {
      if (access.branchId) {
        query = query.eq('branch_id', access.branchId);
      }
    }

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.branchId) {
      query = query.eq('branch_id', filters.branchId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to retrieve Pay-in/Pay-out records: ${error.message}`);
    }

    let result = data as any[];

    // In-memory search filter for client/stock match
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(rec => 
        rec.client_id.toLowerCase().includes(searchLower) ||
        rec.client_name.toLowerCase().includes(searchLower) ||
        rec.stock_symbol.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }

  /**
   * Add a new Pay-in/Pay-out record
   */
  async createPayInPayOutRecord(requesterId: string, recordData: Partial<PayInPayOutRecord>): Promise<PayInPayOutRecord> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client not configured.');

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) {
      throw new Error('Unauthorized: Access denied.');
    }

    // Server-side validation
    if (!recordData.settlement_date) throw new Error('Settlement Date is required.');
    
    // String checks & length constraints
    const clientId = recordData.client_id?.trim();
    if (!clientId) throw new Error('Client ID is required.');
    if (clientId.length > 100) throw new Error('Client ID cannot exceed 100 characters.');

    const clientName = recordData.client_name?.trim();
    if (!clientName) throw new Error('Client Name is required.');
    if (clientName.length > 255) throw new Error('Client Name cannot exceed 255 characters.');

    const stockSymbol = recordData.stock_symbol?.trim()?.toUpperCase();
    if (!stockSymbol) throw new Error('Stock Symbol is required.');
    if (stockSymbol.length > 50) throw new Error('Stock Symbol cannot exceed 50 characters.');

    if (!recordData.buy_sell || !['Buy', 'Sell'].includes(recordData.buy_sell)) {
      throw new Error('Direction must be Buy or Sell.');
    }

    // Number validations (Positive integer)
    const qty = Number(recordData.quantity);
    if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
      throw new Error('Quantity must be a positive integer.');
    }

    // Status and shortage validations
    const status = recordData.status || 'Pending';
    if (!['Completed', 'Pending', 'Shortage'].includes(status)) {
      throw new Error('Invalid status value.');
    }

    const shortageQty = Number(recordData.shortage_qty || 0);
    if (isNaN(shortageQty) || shortageQty < 0 || !Number.isInteger(shortageQty)) {
      throw new Error('Shortage quantity must be a non-negative integer.');
    }

    if (status === 'Completed' && shortageQty > 0) {
      throw new Error('Shortage quantity must be 0 if status is Completed.');
    }
    if (status === 'Shortage' && shortageQty <= 0) {
      throw new Error('Shortage quantity must be greater than 0 if status is Shortage.');
    }

    // Branch assignment and verification
    const userBranchId = recordData.branch_id || access.branchId;
    if (!userBranchId) throw new Error('Branch assignment is required.');

    // Security check: Lock non-admins to their own branch
    if (access.role === 'employee' || access.role === 'hod') {
      if (access.branchId && userBranchId !== access.branchId) {
        throw new Error('Unauthorized: You can only add records for your own branch.');
      }
    }

    const insertData = {
      settlement_date: recordData.settlement_date,
      client_id: clientId,
      client_name: clientName,
      stock_symbol: stockSymbol,
      buy_sell: recordData.buy_sell,
      quantity: qty,
      shortage_qty: status === 'Completed' ? 0 : shortageQty,
      status,
      branch_id: userBranchId,
      created_by: requesterId
    };

    const { data, error } = await client
      .from('settlement_payin_payout')
      .insert(insertData)
      .select('*, branches(name), profiles:created_by(full_name, email)')
      .single();

    if (error) {
      throw new Error(`Failed to create Pay-in/Pay-out record: ${error.message}`);
    }

    return data as any;
  }

  /**
   * Update an existing Pay-in/Pay-out record
   */
  async updatePayInPayOutRecord(requesterId: string, id: string, recordData: Partial<PayInPayOutRecord>): Promise<PayInPayOutRecord> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client not configured.');

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) {
      throw new Error('Unauthorized: Access denied.');
    }

    // Check if record exists
    const { data: existing, error: fetchError } = await client
      .from('settlement_payin_payout')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      throw new Error('Record not found.');
    }

    // Verify branch lock for employees/HODs
    if (access.role === 'employee' || access.role === 'hod') {
      if (access.branchId && existing.branch_id !== access.branchId) {
        throw new Error('Unauthorized: Record belongs to a different branch.');
      }
    }

    const updatedData: any = {};
    if (recordData.settlement_date) updatedData.settlement_date = recordData.settlement_date;
    
    if (recordData.client_id !== undefined) {
      const clientId = recordData.client_id.trim();
      if (!clientId) throw new Error('Client ID cannot be empty.');
      if (clientId.length > 100) throw new Error('Client ID cannot exceed 100 characters.');
      updatedData.client_id = clientId;
    }

    if (recordData.client_name !== undefined) {
      const clientName = recordData.client_name.trim();
      if (!clientName) throw new Error('Client Name cannot be empty.');
      if (clientName.length > 255) throw new Error('Client Name cannot exceed 255 characters.');
      updatedData.client_name = clientName;
    }

    if (recordData.stock_symbol !== undefined) {
      const stockSymbol = recordData.stock_symbol.trim().toUpperCase();
      if (!stockSymbol) throw new Error('Stock Symbol cannot be empty.');
      if (stockSymbol.length > 50) throw new Error('Stock Symbol cannot exceed 50 characters.');
      updatedData.stock_symbol = stockSymbol;
    }

    if (recordData.buy_sell) {
      if (!['Buy', 'Sell'].includes(recordData.buy_sell)) throw new Error('Direction must be Buy or Sell.');
      updatedData.buy_sell = recordData.buy_sell;
    }

    if (recordData.quantity !== undefined) {
      const qty = Number(recordData.quantity);
      if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
        throw new Error('Quantity must be a positive integer.');
      }
      updatedData.quantity = qty;
    }

    const currentStatus = recordData.status || existing.status;
    if (recordData.status !== undefined && !['Completed', 'Pending', 'Shortage'].includes(currentStatus)) {
      throw new Error('Invalid status value.');
    }

    const currentShortage = recordData.shortage_qty !== undefined ? Number(recordData.shortage_qty) : existing.shortage_qty;
    if (recordData.shortage_qty !== undefined) {
      if (isNaN(currentShortage) || currentShortage < 0 || !Number.isInteger(currentShortage)) {
        throw new Error('Shortage quantity must be a non-negative integer.');
      }
    }

    if (recordData.status !== undefined || recordData.shortage_qty !== undefined) {
      if (currentStatus === 'Completed' && currentShortage > 0) {
        throw new Error('Shortage quantity must be 0 if status is Completed.');
      }
      if (currentStatus === 'Shortage' && currentShortage <= 0) {
        throw new Error('Shortage quantity must be greater than 0 if status is Shortage.');
      }
      updatedData.status = currentStatus;
      updatedData.shortage_qty = currentStatus === 'Completed' ? 0 : currentShortage;
    }

    // Security check: Lock non-admins to their own branch on updates
    if (recordData.branch_id !== undefined && recordData.branch_id !== existing.branch_id) {
      if (access.role === 'employee' || access.role === 'hod') {
        if (access.branchId && recordData.branch_id !== access.branchId) {
          throw new Error('Unauthorized: You can only move records to your own branch.');
        }
      }
      updatedData.branch_id = recordData.branch_id;
    }

    const { data, error } = await client
      .from('settlement_payin_payout')
      .update(updatedData)
      .eq('id', id)
      .select('*, branches(name), profiles:created_by(full_name, email)')
      .single();

    if (error) {
      throw new Error(`Failed to update record: ${error.message}`);
    }

    return data as any;
  }

  /* ═══════════════════════════════════════════════
     PART 2: CLIENT SERVICE REQUESTS METHODS
     ═══════════════════════════════════════════════ */

  /**
   * Fetch Client Requests rows with filters, calculating days_pending dynamically (Timezone independent)
   */
  async getClientRequestRecords(
    requesterId: string, 
    filters: { status?: string; branchId?: string; search?: string }
  ): Promise<ClientRequestRecord[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client not configured.');

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) {
      throw new Error('Unauthorized: Access to Settlements department is denied.');
    }

    let query = client
      .from('settlement_client_requests')
      .select('*, branches(name), profiles:created_by(full_name, email)')
      .order('date_received', { ascending: false });

    // Branch locking for standard employees
    if (access.role === 'employee' || access.role === 'hod') {
      if (access.branchId) {
        query = query.eq('branch_id', access.branchId);
      }
    }

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.branchId) {
      query = query.eq('branch_id', filters.branchId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to retrieve Client Requests: ${error.message}`);
    }

    // Timezone-safe Days Pending Calculation
    const todayStr = new Date().toISOString().split('T')[0] || '';
    const parts = todayStr.split('-').map(Number);
    const todayY = parts[0] || 0;
    const todayM = parts[1] || 1;
    const todayD = parts[2] || 1;
    const todayUTC = Date.UTC(todayY, todayM - 1, todayD);

    const result = (data as any[]).map(rec => {
      if (rec.date_received) {
        const rParts = rec.date_received.split('-').map(Number);
        const receivedY = rParts[0] || 0;
        const receivedM = rParts[1] || 1;
        const receivedD = rParts[2] || 1;
        const receivedUTC = Date.UTC(receivedY, receivedM - 1, receivedD);
        
        const diffTime = todayUTC - receivedUTC;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        rec.days_pending = diffDays >= 0 ? diffDays : 0;
      } else {
        rec.days_pending = 0;
      }
      return rec;
    });

    // In-memory search filter for Client Name/Request ID/Remarks
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return result.filter(rec => 
        rec.request_id.toLowerCase().includes(searchLower) ||
        rec.client_name.toLowerCase().includes(searchLower) ||
        (rec.remarks && rec.remarks.toLowerCase().includes(searchLower))
      );
    }

    return result;
  }

  /**
   * Create a new Client Request ticket
   */
  /**
   * Generates the next sequential Request ID for the current year (e.g.
   * REQ-2026-0001) — request_id used to be manually typed, which caused
   * typos and outright duplicate-value conflicts under the UNIQUE
   * constraint. Same "read max, increment" pattern as IEPFService's
   * claim_number generator.
   */
  private async generateNextRequestId(client: any): Promise<string> {
    const prefix = `REQ-${new Date().getFullYear()}-`;
    const { data, error } = await client
      .from('settlement_client_requests')
      .select('request_id')
      .like('request_id', `${prefix}%`)
      .order('request_id', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Failed to calculate next Request ID: ${error.message}`);
    if (!data) return `${prefix}0001`;
    const numStr = String(data.request_id).substring(prefix.length);
    const nextNum = (parseInt(numStr, 10) || 0) + 1;
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  }

  async createClientRequestRecord(requesterId: string, recordData: Partial<ClientRequestRecord>): Promise<ClientRequestRecord> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client not configured.');

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) {
      throw new Error('Unauthorized: Access denied.');
    }

    // Server-side validation
    if (!recordData.date_received) throw new Error('Date Received is required.');

    const clientName = recordData.client_name?.trim();
    if (!clientName) throw new Error('Client Name is required.');
    if (clientName.length > 255) throw new Error('Client Name cannot exceed 255 characters.');

    const requestType = recordData.request_type;
    const allowedTypes = ['Demat Transfer', 'Pledge Release', 'Account Closure', 'Bank Detail Update', 'Rematerialization', 'Other'];
    if (!requestType || !allowedTypes.includes(requestType)) {
      throw new Error('Invalid request type selected.');
    }

    const status = recordData.status || 'Received';
    const allowedStatuses = ['Received', 'In Process', 'Pending', 'Completed'];
    if (!allowedStatuses.includes(status)) {
      throw new Error('Invalid status value.');
    }

    const remarks = recordData.remarks?.trim();
    if (remarks && remarks.length > 2000) {
      throw new Error('Remarks cannot exceed 2000 characters.');
    }

    // Branch assignment and locking
    const userBranchId = recordData.branch_id || access.branchId;
    if (!userBranchId) throw new Error('Branch assignment is required.');

    if (access.role === 'employee' || access.role === 'hod') {
      if (access.branchId && userBranchId !== access.branchId) {
        throw new Error('Unauthorized: You can only add tickets for your own branch.');
      }
    }

    const insertData = {
      client_name: clientName,
      request_type: requestType,
      date_received: recordData.date_received,
      status,
      remarks: remarks || null,
      branch_id: userBranchId,
      created_by: requesterId
    };

    let requestId = await this.generateNextRequestId(client);
    const MAX_ATTEMPTS = 5;
    for (let attempt = 1; ; attempt++) {
      const { data, error } = await client
        .from('settlement_client_requests')
        .insert({ ...insertData, request_id: requestId })
        .select('*, branches(name), profiles:created_by(full_name, email)')
        .single();

      if (!error) return data as any;

      const isCollision = error.message.includes('duplicate key') && error.message.includes('request_id');
      if (!isCollision || attempt >= MAX_ATTEMPTS) {
        if (isCollision) throw new Error('Could not generate a unique Request ID right now — please try again.');
        throw new Error(`Failed to create Client Request ticket: ${error.message}`);
      }
      const prefix = `REQ-${new Date().getFullYear()}-`;
      const numStr = requestId.substring(prefix.length);
      requestId = `${prefix}${String((parseInt(numStr, 10) || 0) + 1).padStart(4, '0')}`;
    }
  }

  /**
   * Update an existing Client Request ticket
   */
  async updateClientRequestRecord(requesterId: string, id: string, recordData: Partial<ClientRequestRecord>): Promise<ClientRequestRecord> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client not configured.');

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) {
      throw new Error('Unauthorized: Access denied.');
    }

    // Check if record exists
    const { data: existing, error: fetchError } = await client
      .from('settlement_client_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      throw new Error('Record not found.');
    }

    // Verify branch lock for employees/HODs
    if (access.role === 'employee' || access.role === 'hod') {
      if (access.branchId && existing.branch_id !== access.branchId) {
        throw new Error('Unauthorized: Record belongs to a different branch.');
      }
    }

    const updatedData: any = {};
    if (recordData.date_received) updatedData.date_received = recordData.date_received;

    // request_id is server-generated at creation and immutable thereafter —
    // same as IEPF's claim_number — so no update path for it here.

    if (recordData.client_name !== undefined) {
      const clientName = recordData.client_name.trim();
      if (!clientName) throw new Error('Client Name cannot be empty.');
      if (clientName.length > 255) throw new Error('Client Name cannot exceed 255 characters.');
      updatedData.client_name = clientName;
    }

    if (recordData.request_type) {
      const allowedTypes = ['Demat Transfer', 'Pledge Release', 'Account Closure', 'Bank Detail Update', 'Rematerialization', 'Other'];
      if (!allowedTypes.includes(recordData.request_type)) {
        throw new Error('Invalid request type selected.');
      }
      updatedData.request_type = recordData.request_type;
    }

    if (recordData.status) {
      const allowedStatuses = ['Received', 'In Process', 'Pending', 'Completed'];
      if (!allowedStatuses.includes(recordData.status)) {
        throw new Error('Invalid status value.');
      }
      updatedData.status = recordData.status;
    }

    if (recordData.remarks !== undefined) {
      const remarks = recordData.remarks.trim();
      if (remarks && remarks.length > 2000) {
        throw new Error('Remarks cannot exceed 2000 characters.');
      }
      updatedData.remarks = remarks || null;
    }

    // Security check: Lock non-admins to their own branch on updates
    if (recordData.branch_id !== undefined && recordData.branch_id !== existing.branch_id) {
      if (access.role === 'employee' || access.role === 'hod') {
        if (access.branchId && recordData.branch_id !== access.branchId) {
          throw new Error('Unauthorized: You can only move records to your own branch.');
        }
      }
      updatedData.branch_id = recordData.branch_id;
    }

    const { data, error } = await client
      .from('settlement_client_requests')
      .update(updatedData)
      .eq('id', id)
      .select('*, branches(name), profiles:created_by(full_name, email)')
      .single();

    if (error) {
      throw new Error(`Failed to update Client Request: ${error.message}`);
    }

    return data as any;
  }

  /* ═══════════════════════════════════════════════
     PART 3: IPO ALLOCATION FILE METHODS
     ═══════════════════════════════════════════════ */

  /**
   * Fetch IPO Allocations with optional filters
   */
  async getIpoAllocationRecords(
    requesterId: string, 
    filters: { status?: string; branchId?: string; search?: string }
  ): Promise<IpoAllocationRecord[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client not configured.');

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) {
      throw new Error('Unauthorized: Access to Settlements department is denied.');
    }

    let query = client
      .from('settlement_ipo_allocation')
      .select('*, branches(name), profiles:created_by(full_name, email)')
      .order('created_at', { ascending: false });

    // Branch locking for standard employees
    if (access.role === 'employee' || access.role === 'hod') {
      if (access.branchId) {
        query = query.eq('branch_id', access.branchId);
      }
    }

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.branchId) {
      query = query.eq('branch_id', filters.branchId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to retrieve IPO Allocations: ${error.message}`);
    }

    let result = data as any[];

    // In-memory search filter for Client Name/Application No/IPO Name
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(rec => 
        rec.application_no.toLowerCase().includes(searchLower) ||
        rec.client_id.toLowerCase().includes(searchLower) ||
        rec.client_name.toLowerCase().includes(searchLower) ||
        rec.ipo_name.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }

  /**
   * Add a new IPO Allocation row
   */
  async createIpoAllocationRecord(requesterId: string, recordData: Partial<IpoAllocationRecord>): Promise<IpoAllocationRecord> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client not configured.');

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) {
      throw new Error('Unauthorized: Access denied.');
    }

    // Server-side validation
    const appNo = recordData.application_no?.trim();
    if (!appNo) throw new Error('Application Number is required.');
    if (appNo.length > 100) throw new Error('Application Number cannot exceed 100 characters.');

    const clientId = recordData.client_id?.trim();
    if (!clientId) throw new Error('Client ID is required.');
    if (clientId.length > 100) throw new Error('Client ID cannot exceed 100 characters.');

    const clientName = recordData.client_name?.trim();
    if (!clientName) throw new Error('Client Name is required.');
    if (clientName.length > 255) throw new Error('Client Name cannot exceed 255 characters.');

    const ipoName = recordData.ipo_name?.trim();
    if (!ipoName) throw new Error('IPO Name is required.');
    if (ipoName.length > 255) throw new Error('IPO Name cannot exceed 255 characters.');

    const category = recordData.category;
    const allowedCategories = ['Retail', 'HNI', 'QIB', 'Employee'];
    if (!category || !allowedCategories.includes(category)) {
      throw new Error('Invalid category selected.');
    }

    const appliedQty = Number(recordData.applied_qty);
    if (isNaN(appliedQty) || appliedQty <= 0 || !Number.isInteger(appliedQty)) {
      throw new Error('Applied Quantity must be a positive integer.');
    }

    const status = recordData.status || 'Applied';
    const allowedStatuses = ['Applied', 'Allotted', 'Refunded', 'Partially Allotted'];
    if (!allowedStatuses.includes(status)) {
      throw new Error('Invalid status value.');
    }

    let allottedQty = Number(recordData.allotted_qty || 0);
    if (isNaN(allottedQty) || allottedQty < 0 || !Number.isInteger(allottedQty)) {
      throw new Error('Allotted Quantity must be a non-negative integer.');
    }

    // Rules logic for IPO status vs allotted qty
    if (status === 'Refunded') {
      allottedQty = 0;
    } else if (status === 'Applied') {
      allottedQty = 0;
    } else if (status === 'Allotted') {
      allottedQty = appliedQty;
    } else if (status === 'Partially Allotted') {
      if (allottedQty <= 0 || allottedQty >= appliedQty) {
        throw new Error('For Partially Allotted, Allotted Quantity must be greater than 0 and less than Applied Quantity.');
      }
    }

    // Branch assignment and locking
    const userBranchId = recordData.branch_id || access.branchId;
    if (!userBranchId) throw new Error('Branch assignment is required.');

    if (access.role === 'employee' || access.role === 'hod') {
      if (access.branchId && userBranchId !== access.branchId) {
        throw new Error('Unauthorized: You can only add rows for your own branch.');
      }
    }

    const insertData = {
      application_no: appNo,
      client_id: clientId,
      client_name: clientName,
      ipo_name: ipoName,
      category,
      applied_qty: appliedQty,
      allotted_qty: allottedQty,
      status,
      branch_id: userBranchId,
      created_by: requesterId
    };

    const { data, error } = await client
      .from('settlement_ipo_allocation')
      .insert(insertData)
      .select('*, branches(name), profiles:created_by(full_name, email)')
      .single();

    if (error) {
      if (error.message.includes('unique constraint') || error.message.includes('already exists')) {
        throw new Error('Application Number already exists in the system.');
      }
      throw new Error(`Failed to create IPO Allocation: ${error.message}`);
    }

    return data as any;
  }

  /**
   * Update an existing IPO Allocation row
   */
  async updateIpoAllocationRecord(requesterId: string, id: string, recordData: Partial<IpoAllocationRecord>): Promise<IpoAllocationRecord> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client not configured.');

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) {
      throw new Error('Unauthorized: Access denied.');
    }

    // Check if record exists
    const { data: existing, error: fetchError } = await client
      .from('settlement_ipo_allocation')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      throw new Error('Record not found.');
    }

    // Verify branch lock for employees/HODs
    if (access.role === 'employee' || access.role === 'hod') {
      if (access.branchId && existing.branch_id !== access.branchId) {
        throw new Error('Unauthorized: Record belongs to a different branch.');
      }
    }

    const updatedData: any = {};
    if (recordData.application_no !== undefined) {
      const appNo = recordData.application_no.trim();
      if (!appNo) throw new Error('Application Number cannot be empty.');
      if (appNo.length > 100) throw new Error('Application Number cannot exceed 100 characters.');
      updatedData.application_no = appNo;
    }

    if (recordData.client_id !== undefined) {
      const clientId = recordData.client_id.trim();
      if (!clientId) throw new Error('Client ID cannot be empty.');
      if (clientId.length > 100) throw new Error('Client ID cannot exceed 100 characters.');
      updatedData.client_id = clientId;
    }

    if (recordData.client_name !== undefined) {
      const clientName = recordData.client_name.trim();
      if (!clientName) throw new Error('Client Name cannot be empty.');
      if (clientName.length > 255) throw new Error('Client Name cannot exceed 255 characters.');
      updatedData.client_name = clientName;
    }

    if (recordData.ipo_name !== undefined) {
      const ipoName = recordData.ipo_name.trim();
      if (!ipoName) throw new Error('IPO Name cannot be empty.');
      if (ipoName.length > 255) throw new Error('IPO Name cannot exceed 255 characters.');
      updatedData.ipo_name = ipoName;
    }

    if (recordData.category) {
      const allowedCategories = ['Retail', 'HNI', 'QIB', 'Employee'];
      if (!allowedCategories.includes(recordData.category)) throw new Error('Invalid category selected.');
      updatedData.category = recordData.category;
    }

    const currentApplied = recordData.applied_qty !== undefined ? Number(recordData.applied_qty) : existing.applied_qty;
    if (recordData.applied_qty !== undefined) {
      if (isNaN(currentApplied) || currentApplied <= 0 || !Number.isInteger(currentApplied)) {
        throw new Error('Applied Quantity must be a positive integer.');
      }
      updatedData.applied_qty = currentApplied;
    }

    const currentStatus = recordData.status || existing.status;
    if (recordData.status !== undefined) {
      const allowedStatuses = ['Applied', 'Allotted', 'Refunded', 'Partially Allotted'];
      if (!allowedStatuses.includes(recordData.status)) throw new Error('Invalid status value.');
      updatedData.status = currentStatus;
    }

    let currentAllotted = recordData.allotted_qty !== undefined ? Number(recordData.allotted_qty) : existing.allotted_qty;
    if (recordData.allotted_qty !== undefined) {
      if (isNaN(currentAllotted) || currentAllotted < 0 || !Number.isInteger(currentAllotted)) {
        throw new Error('Allotted Quantity must be a non-negative integer.');
      }
    }

    // Recalculate status rules during updates
    if (recordData.status !== undefined || recordData.allotted_qty !== undefined || recordData.applied_qty !== undefined) {
      if (currentStatus === 'Refunded') {
        currentAllotted = 0;
      } else if (currentStatus === 'Applied') {
        currentAllotted = 0;
      } else if (currentStatus === 'Allotted') {
        currentAllotted = currentApplied;
      } else if (currentStatus === 'Partially Allotted') {
        if (currentAllotted <= 0 || currentAllotted >= currentApplied) {
          throw new Error('For Partially Allotted, Allotted Quantity must be greater than 0 and less than Applied Quantity.');
        }
      }
      updatedData.allotted_qty = currentAllotted;
      updatedData.status = currentStatus;
    }

    // Security check: Lock non-admins to their own branch on updates
    if (recordData.branch_id !== undefined && recordData.branch_id !== existing.branch_id) {
      if (access.role === 'employee' || access.role === 'hod') {
        if (access.branchId && recordData.branch_id !== access.branchId) {
          throw new Error('Unauthorized: You can only move records to your own branch.');
        }
      }
      updatedData.branch_id = recordData.branch_id;
    }

    const { data, error } = await client
      .from('settlement_ipo_allocation')
      .update(updatedData)
      .eq('id', id)
      .select('*, branches(name), profiles:created_by(full_name, email)')
      .single();

    if (error) {
      if (error.message.includes('unique constraint') || error.message.includes('already exists')) {
        throw new Error('Application Number already exists in the system.');
      }
      throw new Error(`Failed to update IPO Allocation: ${error.message}`);
    }

    return data as any;
  }

  /* ═══════════════════════════════════════════════
     PART 4: CORPORATE ACTIONS ALLOCATION METHODS
     ═══════════════════════════════════════════════ */

  /**
   * Fetch Corporate Actions with optional filters
   */
  async getCorporateActionRecords(
    requesterId: string,
    filters: { eligible?: string; branchId?: string; search?: string }
  ): Promise<CorporateActionRecord[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client not configured.');

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) {
      throw new Error('Unauthorized: Access to Settlements department is denied.');
    }

    let query = client
      .from('settlement_corporate_actions')
      .select('*, branches(name), profiles:created_by(full_name, email)')
      .order('record_date', { ascending: false });

    // Branch locking for standard employees
    if (access.role === 'employee' || access.role === 'hod') {
      if (access.branchId) {
        query = query.eq('branch_id', access.branchId);
      }
    }

    // Apply filters
    if (filters.eligible) {
      query = query.eq('eligible', filters.eligible);
    }
    if (filters.branchId) {
      query = query.eq('branch_id', filters.branchId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to retrieve Corporate Actions: ${error.message}`);
    }

    let result = data as any[];

    // In-memory search filter for Client ID/Client Name/Stock Symbol
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(rec => 
        rec.client_id.toLowerCase().includes(searchLower) ||
        rec.client_name.toLowerCase().includes(searchLower) ||
        rec.stock_symbol.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }

  /**
   * Add a new Corporate Action row
   */
  async createCorporateActionRecord(requesterId: string, recordData: Partial<CorporateActionRecord>): Promise<CorporateActionRecord> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client not configured.');

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) {
      throw new Error('Unauthorized: Access denied.');
    }

    // Server-side validations
    const clientId = recordData.client_id?.trim();
    if (!clientId) throw new Error('Client ID is required.');
    if (clientId.length > 100) throw new Error('Client ID cannot exceed 100 characters.');

    const clientName = recordData.client_name?.trim();
    if (!clientName) throw new Error('Client Name is required.');
    if (clientName.length > 255) throw new Error('Client Name cannot exceed 255 characters.');

    const stockSymbol = recordData.stock_symbol?.trim()?.toUpperCase();
    if (!stockSymbol) throw new Error('Stock Symbol is required.');
    if (stockSymbol.length > 50) throw new Error('Stock Symbol cannot exceed 50 characters.');

    const corpAction = recordData.corporate_action;
    const allowedActions = ['Dividend', 'Bonus', 'Stock Split', 'Rights Issue'];
    if (!corpAction || !allowedActions.includes(corpAction)) {
      throw new Error('Invalid corporate action selected.');
    }

    if (!recordData.record_date) throw new Error('Record Date is required.');

    const qty = Number(recordData.quantity);
    if (isNaN(qty) || qty < 0 || !Number.isInteger(qty)) {
      throw new Error('Quantity must be a non-negative integer.');
    }

    const eligible = recordData.eligible;
    if (!eligible || !['Yes', 'No'].includes(eligible)) {
      throw new Error('Eligible field must be Yes or No.');
    }

    let entitlementAmtQty = Number(recordData.entitlement_amt_qty || 0);
    if (isNaN(entitlementAmtQty) || entitlementAmtQty < 0) {
      throw new Error('Entitlement Amount/Quantity must be a non-negative number.');
    }

    // Integrity Rule: If Eligible = No -> Entitlement must be 0
    if (eligible === 'No') {
      entitlementAmtQty = 0;
    } else {
      if (['Bonus', 'Stock Split'].includes(corpAction)) {
        if (!Number.isInteger(entitlementAmtQty)) {
          throw new Error('For Bonus or Stock Split actions, Entitlement Quantity must be an integer.');
        }
      }
    }

    // Branch assignment and locking
    const userBranchId = recordData.branch_id || access.branchId;
    if (!userBranchId) throw new Error('Branch assignment is required.');

    if (access.role === 'employee' || access.role === 'hod') {
      if (access.branchId && userBranchId !== access.branchId) {
        throw new Error('Unauthorized: You can only add rows for your own branch.');
      }
    }

    const insertData = {
      client_id: clientId,
      client_name: clientName,
      stock_symbol: stockSymbol,
      corporate_action: corpAction,
      record_date: recordData.record_date,
      quantity: qty,
      eligible,
      entitlement_amt_qty: entitlementAmtQty,
      branch_id: userBranchId,
      created_by: requesterId
    };

    const { data, error } = await client
      .from('settlement_corporate_actions')
      .insert(insertData)
      .select('*, branches(name), profiles:created_by(full_name, email)')
      .single();

    if (error) {
      throw new Error(`Failed to create Corporate Action record: ${error.message}`);
    }

    return data as any;
  }

  /**
   * Update an existing Corporate Action row
   */
  async updateCorporateActionRecord(requesterId: string, id: string, recordData: Partial<CorporateActionRecord>): Promise<CorporateActionRecord> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client not configured.');

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) {
      throw new Error('Unauthorized: Access denied.');
    }

    // Check if record exists
    const { data: existing, error: fetchError } = await client
      .from('settlement_corporate_actions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      throw new Error('Record not found.');
    }

    // Verify branch lock for employees/HODs
    if (access.role === 'employee' || access.role === 'hod') {
      if (access.branchId && existing.branch_id !== access.branchId) {
        throw new Error('Unauthorized: Record belongs to a different branch.');
      }
    }

    const updatedData: any = {};
    if (recordData.client_id !== undefined) {
      const clientId = recordData.client_id.trim();
      if (!clientId) throw new Error('Client ID cannot be empty.');
      if (clientId.length > 100) throw new Error('Client ID cannot exceed 100 characters.');
      updatedData.client_id = clientId;
    }

    if (recordData.client_name !== undefined) {
      const clientName = recordData.client_name.trim();
      if (!clientName) throw new Error('Client Name cannot be empty.');
      if (clientName.length > 255) throw new Error('Client Name cannot exceed 255 characters.');
      updatedData.client_name = clientName;
    }

    if (recordData.stock_symbol !== undefined) {
      const stockSymbol = recordData.stock_symbol.trim().toUpperCase();
      if (!stockSymbol) throw new Error('Stock Symbol cannot be empty.');
      if (stockSymbol.length > 50) throw new Error('Stock Symbol cannot exceed 50 characters.');
      updatedData.stock_symbol = stockSymbol;
    }

    if (recordData.corporate_action) {
      const allowedActions = ['Dividend', 'Bonus', 'Stock Split', 'Rights Issue'];
      if (!allowedActions.includes(recordData.corporate_action)) throw new Error('Invalid corporate action selected.');
      updatedData.corporate_action = recordData.corporate_action;
    }

    if (recordData.record_date) updatedData.record_date = recordData.record_date;

    const currentQty = recordData.quantity !== undefined ? Number(recordData.quantity) : existing.quantity;
    if (recordData.quantity !== undefined) {
      if (isNaN(currentQty) || currentQty < 0 || !Number.isInteger(currentQty)) {
        throw new Error('Quantity must be a non-negative integer.');
      }
      updatedData.quantity = currentQty;
    }

    const currentEligible = recordData.eligible || existing.eligible;
    if (recordData.eligible !== undefined) {
      if (!['Yes', 'No'].includes(recordData.eligible)) throw new Error('Eligible field must be Yes or No.');
      updatedData.eligible = currentEligible;
    }

    let currentEntitlement = recordData.entitlement_amt_qty !== undefined ? Number(recordData.entitlement_amt_qty) : existing.entitlement_amt_qty;
    if (recordData.entitlement_amt_qty !== undefined) {
      if (isNaN(currentEntitlement) || currentEntitlement < 0) {
        throw new Error('Entitlement must be a non-negative number.');
      }
    }

    const currentAction = recordData.corporate_action || existing.corporate_action;

    if (recordData.eligible !== undefined || recordData.entitlement_amt_qty !== undefined || recordData.corporate_action !== undefined) {
      if (currentEligible === 'No') {
        currentEntitlement = 0;
      } else {
        if (['Bonus', 'Stock Split'].includes(currentAction)) {
          if (!Number.isInteger(currentEntitlement)) {
            throw new Error('For Bonus or Stock Split actions, Entitlement Quantity must be an integer.');
          }
        }
      }
      updatedData.entitlement_amt_qty = currentEntitlement;
      updatedData.eligible = currentEligible;
    }

    // Security check: Lock non-admins to their own branch on updates
    if (recordData.branch_id !== undefined && recordData.branch_id !== existing.branch_id) {
      if (access.role === 'employee' || access.role === 'hod') {
        if (access.branchId && recordData.branch_id !== access.branchId) {
          throw new Error('Unauthorized: You can only move records to your own branch.');
        }
      }
      updatedData.branch_id = recordData.branch_id;
    }

    const { data, error } = await client
      .from('settlement_corporate_actions')
      .update(updatedData)
      .eq('id', id)
      .select('*, branches(name), profiles:created_by(full_name, email)')
      .single();

    if (error) {
      throw new Error(`Failed to update Corporate Action record: ${error.message}`);
    }

    return data as any;
  }

  /**
   * Fetches KYC-verified clients so settlement entries can be filled by
   * selecting an existing verified record instead of typing the name by hand.
   */
  async getVerifiedClients(): Promise<any[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not initialized.');

    const { data, error } = await client
      .from('kyc_new_account')
      .select('id, applicant_name, pan, mobile_number, email')
      .eq('status', 'Verified')
      .order('applicant_name', { ascending: true });

    if (error) throw new Error(`Failed to load verified clients: ${error.message}`);
    return data || [];
  }
}
