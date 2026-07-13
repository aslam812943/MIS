import { supabaseAdmin } from '../config/supabase.js';
import type { IEPFClaim } from '../models/iepfClaim.model.js';

export class IEPFService {
  
  /**
   * Strips NUL/control characters, which Postgres rejects outright in text
   * columns. Deliberately does NOT HTML-entity-encode the value: the React
   * frontend never uses dangerouslySetInnerHTML for this data, so it already
   * renders stored text safely as plain text. Encoding it here as well used
   * to corrupt ordinary investor names and remarks — e.g. "D'Souza" or
   * "S&P bond transfer" — into literal "D&#39;Souza" strings that were then
   * displayed verbatim (React doesn't decode HTML entities in text nodes).
   */
  private sanitizeText(str: string): string {
    const controlCharPattern = new RegExp('[' + String.fromCharCode(0) + '-' + String.fromCharCode(31) + String.fromCharCode(127) + ']', 'g');
    return str.replace(controlCharPattern, '');
  }

  /**
   * Enforces strict input validation on claims payloads.
   */
  private validateClaimPayload(claimData: Partial<IEPFClaim>): void {
    // 1. PAN Number Validation (Indian PAN: 5 uppercase letters, 4 digits, 1 uppercase letter)
    if (claimData.pan_number !== undefined) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      const cleanPan = claimData.pan_number.trim().toUpperCase();
      if (!panRegex.test(cleanPan)) {
        throw new Error('Invalid PAN format. Must be 5 letters, 4 digits, and 1 letter (e.g. ABCDE1234F).');
      }
    }

    // 2. Numerical Boundary Checks (Prevent negative values)
    if (claimData.amount !== undefined && Number(claimData.amount) < 0) {
      throw new Error('Claim amount cannot be negative.');
    }
    if (claimData.num_shares !== undefined && Number(claimData.num_shares) < 0) {
      throw new Error('Number of shares cannot be negative.');
    }
    if (claimData.amount_released !== undefined && Number(claimData.amount_released) < 0) {
      throw new Error('Amount released cannot be negative.');
    }
    if (claimData.shares_released !== undefined && Number(claimData.shares_released) < 0) {
      throw new Error('Shares released cannot be negative.');
    }

    // 3. Date Integrity Checks
    if (claimData.claim_date && claimData.expected_closure_date) {
      const claimD = new Date(claimData.claim_date);
      const expectedD = new Date(claimData.expected_closure_date);
      if (expectedD < claimD) {
        throw new Error('Expected closure date cannot be prior to the claim date.');
      }
    }

    if (claimData.status === 'Closed' && claimData.closed_date && claimData.claim_date) {
      const claimD = new Date(claimData.claim_date);
      const closedD = new Date(claimData.closed_date);
      if (closedD < claimD) {
        throw new Error('Closed date cannot be before the claim date.');
      }
      if (closedD > new Date()) {
        throw new Error('Closed date cannot be in the future.');
      }
    }
  }

  /**
   * Helper to verify if the user belongs to IEPF department or has executive/admin access.
   */
  private async verifyAccess(userId: string): Promise<{ authorized: boolean; branchId?: string; role?: string }> {
    const client = supabaseAdmin;
    if (!client) {
      throw new Error('Supabase admin client is not configured.');
    }

    const { data: profile, error } = await client
      .from('profiles')
      .select('*, departments(name)')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return { authorized: false };
    }

    const isExecutive = ['admin', 'ceo', 'managing_director', 'director', 'executive'].includes(profile.role);
    const isIEPFDept = profile.departments?.name === 'IEPF';

    if (!isExecutive && !isIEPFDept) {
      return { authorized: false };
    }

    return {
      authorized: true,
      branchId: profile.branch_id,
      role: profile.role,
    };
  }

  /**
   * Generates the next sequential claim number (e.g. iepf20260001) for the current year.
   */
  private async generateNextClaimNumber(client: any): Promise<string> {
    const currentYear = new Date().getFullYear();
    const yearPrefix = `iepf${currentYear}`;

    const { data: latestClaim, error } = await client
      .from('iepf_claims')
      .select('claim_number')
      .like('claim_number', `${yearPrefix}%`)
      .order('claim_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to calculate next claim number: ${error.message}`);
    }

    if (!latestClaim) {
      return `${yearPrefix}0001`;
    }

    const numStr = latestClaim.claim_number.substring(yearPrefix.length);
    const nextNum = parseInt(numStr, 10) + 1;
    return yearPrefix + String(nextNum).padStart(4, '0');
  }

  /**
   * Creates a new IEPF claim with strict input validations and role limits.
   */
  async createClaim(claimData: Partial<IEPFClaim>, creatorId: string): Promise<IEPFClaim> {
    const client = supabaseAdmin;
    if (!client) {
      throw new Error('Supabase admin client is not configured.');
    }

    const access = await this.verifyAccess(creatorId);
    if (!access.authorized) {
      throw new Error('Unauthorized: You must belong to the IEPF department to create claims.');
    }

    if (!claimData.investor_name || !claimData.pan_number || !claimData.claim_date) {
      throw new Error('Required fields are missing.');
    }

    // Role-based Status Check: Employees cannot approve/reject/close claims on creation
    const requestedStatus = claimData.status || 'New';
    const isPrivilegedRole = ['admin', 'ceo', 'managing_director', 'director', 'executive', 'hod'].includes(access.role || '');
    if (['Approved', 'Rejected', 'Closed'].includes(requestedStatus) && !isPrivilegedRole) {
      throw new Error(`Unauthorized: Role '${access.role}' cannot assign status '${requestedStatus}' on creation.`);
    }

    // Input sanitization and validations
    this.validateClaimPayload(claimData);

    // Auto-generate next claim number safely on the backend
    const claimNumber = await this.generateNextClaimNumber(client);

    const claimToInsert: any = {
      claim_number: claimNumber,
      investor_name: this.sanitizeText(claimData.investor_name.trim()),
      pan_number: claimData.pan_number.trim().toUpperCase(),
      claim_type: claimData.claim_type,
      amount: Number(claimData.amount) || 0,
      num_shares: Number(claimData.num_shares) || 0,
      claim_date: claimData.claim_date,
      status: requestedStatus,
      created_by: creatorId,
      // Standard employee/HOD must log claims under their own branch
      branch_id: isPrivilegedRole && access.role !== 'hod' ? (claimData.branch_id || access.branchId) : access.branchId,
    };

    if (claimData.client_id) {
      claimToInsert.client_id = this.sanitizeText(claimData.client_id.trim());
    }

    if (claimToInsert.status === 'Documents Pending') {
      claimToInsert.pending_reasons = claimData.pending_reasons || [];
    } else {
      claimToInsert.pending_reasons = [];
    }

    if (claimToInsert.status === 'Closed') {
      claimToInsert.closed_date = claimData.closed_date || new Date().toISOString().split('T')[0];
      claimToInsert.resolution_remarks = this.sanitizeText(claimData.resolution_remarks || '');
      claimToInsert.amount_released = Number(claimData.amount_released) || 0;
      claimToInsert.shares_released = Number(claimData.shares_released) || 0;
    }

    if (claimData.expected_closure_date) {
      claimToInsert.expected_closure_date = claimData.expected_closure_date;
    }

    const { data, error } = await client
      .from('iepf_claims')
      .insert(claimToInsert)
      .select('*, branches(name), profiles:created_by(full_name, email)')
      .single();

    if (error) {
      throw new Error(`Failed to create claim: ${error.message}`);
    }

    return data as any;
  }

  /**
   * Updates an existing claim with branch lock bounds, edit permissions, and lifecycle rules.
   */
  async updateClaim(id: string, claimData: Partial<IEPFClaim>, updaterId: string): Promise<IEPFClaim> {
    const client = supabaseAdmin;
    if (!client) {
      throw new Error('Supabase admin client is not configured.');
    }

    const access = await this.verifyAccess(updaterId);
    if (!access.authorized) {
      throw new Error('Unauthorized: You must belong to the IEPF department to edit claims.');
    }

    const { data: existingClaim, error: fetchError } = await client
      .from('iepf_claims')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingClaim) {
      throw new Error('Claim not found.');
    }

    const isPrivilegedRole = ['admin', 'ceo', 'managing_director', 'director', 'executive', 'hod'].includes(access.role || '');

    // ── SECURITY GATE 1: IDOR & BRANCH BOUNDARIES ────────────────────
    // Non-admin/executives (Employees/HODs) are locked to their own branch files
    if (access.role === 'employee' || access.role === 'hod') {
      if (existingClaim.branch_id !== access.branchId) {
        throw new Error('Unauthorized: You cannot access or modify claims belonging to other branch offices.');
      }
    }

    // ── SECURITY GATE 2: STATE LOCK (FINALIZED RECORDS) ───────────────
    const isFinalized = ['Closed', 'Approved', 'Rejected'].includes(existingClaim.status);
    if (isFinalized && !isPrivilegedRole) {
      throw new Error('Locked: Finalized claims (Closed/Approved/Rejected) cannot be modified by standard employees.');
    }

    // ── SECURITY GATE 3: CREATOR LOCK (FOR EMPLOYEES) ────────────────
    // Standard employees can only edit active claims they originally registered
    if (access.role === 'employee' && existingClaim.created_by !== updaterId) {
      throw new Error('Unauthorized: You can only edit claims that you registered.');
    }

    // ── SECURITY GATE 4: STATUS TRANSITION POLICIES ──────────────────
    // Employees are allowed to update status. Restriction bypassed.

    // Apply validations
    this.validateClaimPayload(claimData);

    const claimToUpdate: any = {
      updated_at: new Date().toISOString()
    };

    // Safely transfer inputs and sanitize text fields
    if (claimData.investor_name !== undefined) claimToUpdate.investor_name = this.sanitizeText(claimData.investor_name.trim());
    if (claimData.pan_number !== undefined) claimToUpdate.pan_number = claimData.pan_number.trim().toUpperCase();
    if (claimData.claim_type !== undefined) claimToUpdate.claim_type = claimData.claim_type;
    if (claimData.amount !== undefined) claimToUpdate.amount = Number(claimData.amount);
    if (claimData.num_shares !== undefined) claimToUpdate.num_shares = Number(claimData.num_shares);
    if (claimData.claim_date !== undefined) claimToUpdate.claim_date = claimData.claim_date;
    if (claimData.expected_closure_date !== undefined) claimToUpdate.expected_closure_date = claimData.expected_closure_date || null;
    if (claimData.status !== undefined) claimToUpdate.status = claimData.status;

    // Standard staff/HOD cannot spoof claim branch
    if (claimData.branch_id !== undefined && isPrivilegedRole && access.role !== 'hod') {
      claimToUpdate.branch_id = claimData.branch_id;
    }

    // Reset conditional properties depending on status
    if (claimToUpdate.status) {
      if (claimToUpdate.status === 'Documents Pending') {
        claimToUpdate.pending_reasons = claimData.pending_reasons || [];
      } else {
        claimToUpdate.pending_reasons = [];
      }

      if (claimToUpdate.status === 'Closed') {
        claimToUpdate.closed_date = claimData.closed_date || new Date().toISOString().split('T')[0];
        claimToUpdate.resolution_remarks = this.sanitizeText(claimData.resolution_remarks || '');
        claimToUpdate.amount_released = Number(claimData.amount_released) || 0;
        claimToUpdate.shares_released = Number(claimData.shares_released) || 0;
      } else {
        claimToUpdate.closed_date = null;
        claimToUpdate.resolution_remarks = null;
        claimToUpdate.amount_released = 0;
        claimToUpdate.shares_released = 0;
      }
    } else {
      // In case status is not modified, evaluate properties dynamically
      if (existingClaim.status === 'Documents Pending' && claimData.pending_reasons !== undefined) {
        claimToUpdate.pending_reasons = claimData.pending_reasons;
      }
      if (existingClaim.status === 'Closed') {
        if (claimData.closed_date !== undefined) claimToUpdate.closed_date = claimData.closed_date;
        if (claimData.resolution_remarks !== undefined) claimToUpdate.resolution_remarks = this.sanitizeText(claimData.resolution_remarks || '');
        if (claimData.amount_released !== undefined) claimToUpdate.amount_released = Number(claimData.amount_released);
        if (claimData.shares_released !== undefined) claimToUpdate.shares_released = Number(claimData.shares_released);
      }
    }

    const { data, error } = await client
      .from('iepf_claims')
      .update(claimToUpdate)
      .eq('id', id)
      .select('*, branches(name), profiles:created_by(full_name, email)')
      .single();

    if (error) {
      throw new Error(`Failed to update claim: ${error.message}`);
    }

    return data as any;
  }

  /**
   * Fetches the list of claims.
   */
  async getClaims(requesterId: string, filters: { status?: string; branchId?: string; search?: string }): Promise<IEPFClaim[]> {
    const client = supabaseAdmin;
    if (!client) {
      throw new Error('Supabase admin client is not configured.');
    }

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) {
      throw new Error('Unauthorized: Access denied.');
    }

    let query = client
      .from('iepf_claims')
      .select('*, branches(name), profiles:created_by(full_name, email)')
      .order('created_at', { ascending: false });

    // Filter by branch if user is branch-locked (employees/HODs)
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
      throw new Error(`Failed to retrieve claims: ${error.message}`);
    }

    let result = data as any[];

    // Apply search filter in-memory for flexible multi-column matching
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(claim => 
        claim.claim_number.toLowerCase().includes(searchLower) ||
        claim.investor_name.toLowerCase().includes(searchLower) ||
        (claim.client_id && claim.client_id.toLowerCase().includes(searchLower)) ||
        claim.pan_number.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }

  async getDashboardData(requesterId: string, branchIdFilter?: string, startDate?: string, endDate?: string): Promise<any> {
    const client = supabaseAdmin;
    if (!client) {
      throw new Error('Supabase admin client is not configured.');
    }

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) {
      throw new Error('Unauthorized.');
    }

    // Load claims based on filters
    let query = client.from('iepf_claims').select('*');
    
    let targetBranchId: string | undefined = branchIdFilter;
    if (access.role === 'employee') {
      targetBranchId = access.branchId || undefined;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (startDate && !dateRegex.test(startDate)) throw new Error('Invalid start date format (YYYY-MM-DD).');
    if (endDate && !dateRegex.test(endDate)) throw new Error('Invalid end date format (YYYY-MM-DD).');

    if (targetBranchId) {
      query = query.eq('branch_id', targetBranchId);
    }
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59.999Z`);
    }

    const { data: claims, error } = await query;
    if (error || !claims) {
      throw new Error(`Failed to load dashboard metrics: ${error?.message || 'No claims'}`);
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    // ── 1. KPI CARD COMPUTATIONS ──────────────────────────────────────
    let activeClaimsCount = 0;
    let closedThisYearCount = 0;
    let pendingClaimsCount = 0;
    let closedThisMonthCount = 0;
    let totalResolutionDays = 0;
    let resolutionCount = 0;

    claims.forEach(claim => {
      const isClosed = claim.status === 'Closed';
      const isRejected = claim.status === 'Rejected';
      const isPending = claim.status === 'Documents Pending';

      // Active Claims: status is not Closed or Rejected
      if (!isClosed && !isRejected) {
        activeClaimsCount++;
      }

      // Pending Claims
      if (isPending) {
        pendingClaimsCount++;
      }

      // Time calculations if closed
      if (isClosed && claim.closed_date) {
        const closedDate = new Date(claim.closed_date);
        const claimDate = new Date(claim.claim_date);
        
        // Year calculation
        if (closedDate.getFullYear() === currentYear) {
          closedThisYearCount++;
        }

        // Month calculation
        if (closedDate.getFullYear() === currentYear && closedDate.getMonth() === currentMonth) {
          closedThisMonthCount++;
        }

        // Resolution Time
        const diffTime = Math.abs(closedDate.getTime() - claimDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        totalResolutionDays += diffDays;
        resolutionCount++;
      }
    });

    const averageResolutionTime = resolutionCount > 0 
      ? Math.round(totalResolutionDays / resolutionCount) 
      : 0;

    // ── 2. DONUT CHART (CLAIM STATUS BREAKDOWN) ─────────────────────────
    const statusCounts = {
      Active: 0,
      Closed: 0,
      Pending: 0,
      Rejected: 0
    };

    claims.forEach(claim => {
      if (claim.status === 'Closed') {
        statusCounts.Closed++;
      } else if (claim.status === 'Rejected') {
        statusCounts.Rejected++;
      } else if (claim.status === 'Documents Pending') {
        statusCounts.Pending++;
      } else {
        statusCounts.Active++;
      }
    });

    // ── 3. LINE CHART (MONTHLY CLAIMS TREND) ───────────────────────────
    const monthlyCounts = Array(12).fill(0);
    claims.forEach(claim => {
      const claimDate = new Date(claim.claim_date);
      if (claimDate.getFullYear() === currentYear) {
        const month = claimDate.getMonth();
        monthlyCounts[month]++;
      }
    });

    const monthsLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrend = monthsLabels.map((label, idx) => ({
      month: label,
      claims: monthlyCounts[idx]
    }));

    // ── 4. BAR CHART (PENDING REASONS BREAKDOWN) ───────────────────────
    const pendingReasonsMap: Record<string, number> = {
      'PAN Mismatch': 0,
      'Aadhaar Missing': 0,
      'Signature Mismatch': 0,
      'Bank Details Missing': 0,
      'Legal Documents Missing': 0,
      'Other': 0
    };

    claims.forEach(claim => {
      if (claim.status === 'Documents Pending' && Array.isArray(claim.pending_reasons)) {
        claim.pending_reasons.forEach((reason: string) => {
          if (reason in pendingReasonsMap) {
            pendingReasonsMap[reason] = (pendingReasonsMap[reason] ?? 0) + 1;
          } else {
            pendingReasonsMap['Other'] = (pendingReasonsMap['Other'] ?? 0) + 1;
          }
        });
      }
    });

    const pendingReasons = Object.entries(pendingReasonsMap).map(([reason, count]) => ({
      reason,
      count
    }));

    return {
      kpis: {
        activeClaims: activeClaimsCount,
        closedThisYear: closedThisYearCount,
        pendingClaims: pendingClaimsCount,
        closedThisMonth: closedThisMonthCount,
        averageResolutionTime,
      },
      charts: {
        statusBreakdown: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
        monthlyTrend,
        pendingReasons
      }
    };
  }

  /**
   * Fetches list of active employees belonging to the IEPF department.
   */
  async getIEPFStaff(): Promise<any[]> {
    const client = supabaseAdmin;
    if (!client) {
      throw new Error('Supabase admin client is not configured.');
    }

    const { data: dept } = await client
      .from('departments')
      .select('id')
      .eq('name', 'IEPF')
      .single();

    if (!dept) return [];

    const { data, error } = await client
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('department_id', dept.id)
      .eq('status', 'active');

    if (error) return [];
    return data;
  }

  /**
   * Fetches KYC-verified investors so a claim can be filled by selecting an
   * existing verified record instead of typing the name/PAN by hand.
   */
  async getVerifiedInvestors(): Promise<any[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not initialized.');

    const { data, error } = await client
      .from('kyc_new_account')
      .select('id, applicant_name, pan, mobile_number, email')
      .eq('status', 'Verified')
      .order('applicant_name', { ascending: true });

    if (error) throw new Error(`Failed to load verified investors: ${error.message}`);
    return data || [];
  }
}
