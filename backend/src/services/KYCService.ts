import { supabaseAdmin } from '../config/supabase.js';

export class KYCService {
  /**
   * Helper method to verify if a user is authorized to perform KYC actions.
   * - Data entry is open to KYC staff and Admins.
   * - Dashboard is restricted to HOD of KYC, Admins, and Management (CEO, Managing Director, Director, Executive).
   */
  async verifyAccess(userId: string, requiresDashboard = false): Promise<{ authorized: boolean; role?: string; branchId?: string; departmentId?: string }> {
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

    const isAdminOrMgmt = role === 'admin' || ['ceo', 'managing_director', 'director', 'executive'].includes(role);
    const isKYCDept = departmentName.toUpperCase() === 'KYC';

    let isAuthorized = false;
    if (requiresDashboard) {
      // Dashboard requires Admin/Mgmt or KYC HOD
      isAuthorized = isAdminOrMgmt || (isKYCDept && role === 'hod');
    } else {
      // Data entry requires Admin/Mgmt or KYC Staff (HOD, Employee, etc.)
      isAuthorized = isAdminOrMgmt || isKYCDept;
    }

    return {
      authorized: isAuthorized,
      role,
      branchId,
      departmentId
    };
  }

  // ═══════════════════════════════════════════════
  // VALIDATORS
  // ═══════════════════════════════════════════════

  private validatePAN(pan: string | undefined): string {
    if (!pan) throw new Error('PAN is required.');
    const trimmed = pan.trim().toUpperCase();
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(trimmed)) {
      throw new Error('Invalid PAN format. Must be 10 characters (e.g. ABCDE1234F).');
    }
    return trimmed;
  }

  private validateAadhaar(aadhaar: string | undefined): string {
    if (!aadhaar) throw new Error('Aadhaar Number is required.');
    const trimmed = aadhaar.trim();
    const aadhaarRegex = /^\d{12}$/;
    if (!aadhaarRegex.test(trimmed)) {
      throw new Error('Invalid Aadhaar number. Must be exactly 12 digits.');
    }
    return trimmed;
  }

  private validateMobile(mobile: string | undefined): string {
    if (!mobile) throw new Error('Mobile Number is required.');
    const trimmed = mobile.trim();
    const mobileRegex = /^\d{10}$/;
    if (!mobileRegex.test(trimmed)) {
      throw new Error('Invalid Mobile number. Must be exactly 10 digits.');
    }
    return trimmed;
  }

  private validateEmail(email: string | undefined): string {
    if (!email) throw new Error('Email is required.');
    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      throw new Error('Invalid Email address format.');
    }
    return trimmed;
  }

  private validatePercentage(percentage: any): number {
    const num = Number(percentage);
    if (isNaN(num) || num < 0 || num > 100) {
      throw new Error('Sharing percentage must be a number between 0 and 100.');
    }
    return num;
  }

  private validateRequiredString(value: string | undefined, fieldName: string, maxLen = 255): string {
    if (!value || !value.trim()) {
      throw new Error(`${fieldName} is required.`);
    }
    const trimmed = value.trim();
    if (trimmed.length > maxLen) {
      throw new Error(`${fieldName} cannot exceed ${maxLen} characters.`);
    }
    return trimmed;
  }

  private validateDate(dateStr: string | undefined, fieldName: string): string {
    if (!dateStr) throw new Error(`${fieldName} is required.`);
    const parsed = Date.parse(dateStr);
    if (isNaN(parsed)) {
      throw new Error(`Invalid date format for ${fieldName}.`);
    }
    return dateStr;
  }

  // ═══════════════════════════════════════════════
  // FILE UPLOAD UTILITY
  // ═══════════════════════════════════════════════

  async uploadDocument(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<string> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not initialized.');

    const fileExt = fileName.split('.').pop();
    const cleanFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `documents/${cleanFileName}`;

    const { error: uploadError } = await client.storage
      .from('kyc-documents')
      .upload(filePath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload document: ${uploadError.message}`);
    }

    const { data: urlData } = client.storage
      .from('kyc-documents')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  }

  // ═══════════════════════════════════════════════
  // 1. NEW ACCOUNT OPENING VERIFICATION
  // ═══════════════════════════════════════════════

  async getNewAccounts(requesterId: string, filters: { status?: string; branchId?: string; search?: string }): Promise<any[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client not configured.');

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized: Access denied.');

    let query = client.from('kyc_new_account').select('*, branches(name), profiles:created_by(full_name, email)').order('created_at', { ascending: false });

    if (access.role === 'employee' || access.role === 'hod') {
      if (access.branchId) query = query.eq('branch_id', access.branchId);
    }
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.branchId) query = query.eq('branch_id', filters.branchId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let result = data || [];
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter((r: any) =>
        r.applicant_name.toLowerCase().includes(s) ||
        r.pan.toLowerCase().includes(s) ||
        r.aadhaar_number.toLowerCase().includes(s)
      );
    }
    return result;
  }

  async createNewAccount(requesterId: string, recordData: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client not configured.');

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized: Access denied.');

    const applicant_name = this.validateRequiredString(recordData.applicant_name, 'Applicant Name');
    const pan = this.validatePAN(recordData.pan);
    const aadhaar_number = this.validateAadhaar(recordData.aadhaar_number);
    const mobile_number = this.validateMobile(recordData.mobile_number);
    const email = this.validateEmail(recordData.email);
    const address = this.validateRequiredString(recordData.address, 'Address', 1000);
    const date_of_birth = this.validateDate(recordData.date_of_birth, 'Date of Birth');

    const branch_id = recordData.branch_id || access.branchId;
    if (!branch_id) throw new Error('Branch assignment is required.');

    if ((access.role === 'employee' || access.role === 'hod') && access.branchId && branch_id !== access.branchId) {
      throw new Error('Unauthorized branch access.');
    }

    const insertData = {
      applicant_name, pan, aadhaar_number, mobile_number, email, address, date_of_birth,
      pan_copy: !!recordData.pan_copy,
      aadhaar_copy: !!recordData.aadhaar_copy,
      bank_proof: !!recordData.bank_proof,
      photograph: !!recordData.photograph,
      signature: !!recordData.signature,
      verified_by: recordData.verified_by ? String(recordData.verified_by).trim() : null,
      verification_date: recordData.verification_date ? this.validateDate(recordData.verification_date, 'Verification Date') : null,
      status: recordData.status || 'Pending',
      remarks: recordData.remarks ? String(recordData.remarks).trim() : null,
      branch_id,
      created_by: requesterId
    };

    const { data, error } = await client.from('kyc_new_account').insert(insertData).select('*, branches(name), profiles:created_by(full_name, email)').single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updateNewAccount(requesterId: string, id: string, recordData: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client not configured.');

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized: Access denied.');

    const { data: existing, error: fetchErr } = await client.from('kyc_new_account').select('branch_id').eq('id', id).single();
    if (fetchErr || !existing) throw new Error('Record not found.');

    if ((access.role === 'employee' || access.role === 'hod') && access.branchId && existing.branch_id !== access.branchId) {
      throw new Error('Unauthorized branch access.');
    }

    const updatedData: any = {};
    if (recordData.applicant_name !== undefined) updatedData.applicant_name = this.validateRequiredString(recordData.applicant_name, 'Applicant Name');
    if (recordData.pan !== undefined) updatedData.pan = this.validatePAN(recordData.pan);
    if (recordData.aadhaar_number !== undefined) updatedData.aadhaar_number = this.validateAadhaar(recordData.aadhaar_number);
    if (recordData.mobile_number !== undefined) updatedData.mobile_number = this.validateMobile(recordData.mobile_number);
    if (recordData.email !== undefined) updatedData.email = this.validateEmail(recordData.email);
    if (recordData.address !== undefined) updatedData.address = this.validateRequiredString(recordData.address, 'Address', 1000);
    if (recordData.date_of_birth !== undefined) updatedData.date_of_birth = this.validateDate(recordData.date_of_birth, 'Date of Birth');
    if (recordData.pan_copy !== undefined) updatedData.pan_copy = !!recordData.pan_copy;
    if (recordData.aadhaar_copy !== undefined) updatedData.aadhaar_copy = !!recordData.aadhaar_copy;
    if (recordData.bank_proof !== undefined) updatedData.bank_proof = !!recordData.bank_proof;
    if (recordData.photograph !== undefined) updatedData.photograph = !!recordData.photograph;
    if (recordData.signature !== undefined) updatedData.signature = !!recordData.signature;
    if (recordData.verified_by !== undefined) updatedData.verified_by = recordData.verified_by ? String(recordData.verified_by).trim() : null;
    if (recordData.verification_date !== undefined) updatedData.verification_date = recordData.verification_date ? this.validateDate(recordData.verification_date, 'Verification Date') : null;
    if (recordData.status !== undefined) updatedData.status = recordData.status;
    if (recordData.remarks !== undefined) updatedData.remarks = recordData.remarks ? String(recordData.remarks).trim() : null;

    if (recordData.branch_id !== undefined) {
      if ((access.role === 'employee' || access.role === 'hod') && access.branchId && recordData.branch_id !== access.branchId) {
        throw new Error('Unauthorized branch access.');
      }
      updatedData.branch_id = recordData.branch_id;
    }

    const { data, error } = await client.from('kyc_new_account').update(updatedData).eq('id', id).select('*, branches(name), profiles:created_by(full_name, email)').single();
    if (error) throw new Error(error.message);
    return data;
  }

  // ═══════════════════════════════════════════════
  // 2. UCC ALLOTMENT (NSE/BSE)
  // ═══════════════════════════════════════════════

  async getUCCAllotments(requesterId: string, filters: { status?: string; branchId?: string; search?: string }): Promise<any[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    let query = client.from('kyc_ucc_allotment').select('*, branches(name), profiles:created_by(full_name, email)').order('created_at', { ascending: false });

    if (access.role === 'employee' || access.role === 'hod') {
      if (access.branchId) query = query.eq('branch_id', access.branchId);
    }
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.branchId) query = query.eq('branch_id', filters.branchId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let result = data || [];
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter((r: any) =>
        r.client_name.toLowerCase().includes(s) ||
        r.pan.toLowerCase().includes(s) ||
        (r.ucc_code && r.ucc_code.toLowerCase().includes(s))
      );
    }
    return result;
  }

  async createUCCAllotment(requesterId: string, recordData: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const client_name = this.validateRequiredString(recordData.client_name, 'Client Name');
    const pan = this.validatePAN(recordData.pan);
    const exchange = this.validateRequiredString(recordData.exchange, 'Exchange');
    if (!['NSE', 'BSE'].includes(exchange)) throw new Error('Exchange must be NSE or BSE.');

    const segment = this.validateRequiredString(recordData.segment, 'Segment');
    if (!['Cash', 'F&O', 'Currency', 'Commodity'].includes(segment)) throw new Error('Invalid segment.');

    const branch_id = recordData.branch_id || access.branchId;
    if (!branch_id) throw new Error('Branch required.');

    const insertData = {
      client_name, pan, exchange, segment,
      ucc_code: recordData.ucc_code ? String(recordData.ucc_code).trim() : null,
      upload_date: recordData.upload_date ? this.validateDate(recordData.upload_date, 'Upload Date') : null,
      confirmation_date: recordData.confirmation_date ? this.validateDate(recordData.confirmation_date, 'Confirmation Date') : null,
      status: recordData.status || 'Pending',
      branch_id,
      created_by: requesterId
    };

    const { data, error } = await client.from('kyc_ucc_allotment').insert(insertData).select('*, branches(name), profiles:created_by(full_name, email)').single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updateUCCAllotment(requesterId: string, id: string, recordData: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const { data: existing, error: fetchErr } = await client.from('kyc_ucc_allotment').select('branch_id').eq('id', id).single();
    if (fetchErr || !existing) throw new Error('Record not found.');
    if ((access.role === 'employee' || access.role === 'hod') && access.branchId && existing.branch_id !== access.branchId) {
      throw new Error('Unauthorized branch access.');
    }

    const updatedData: any = {};
    if (recordData.client_name !== undefined) updatedData.client_name = this.validateRequiredString(recordData.client_name, 'Client Name');
    if (recordData.pan !== undefined) updatedData.pan = this.validatePAN(recordData.pan);
    if (recordData.exchange !== undefined) {
      if (!['NSE', 'BSE'].includes(recordData.exchange)) throw new Error('Exchange must be NSE or BSE.');
      updatedData.exchange = recordData.exchange;
    }
    if (recordData.segment !== undefined) {
      if (!['Cash', 'F&O', 'Currency', 'Commodity'].includes(recordData.segment)) throw new Error('Invalid segment.');
      updatedData.segment = recordData.segment;
    }
    if (recordData.ucc_code !== undefined) updatedData.ucc_code = recordData.ucc_code ? String(recordData.ucc_code).trim() : null;
    if (recordData.upload_date !== undefined) updatedData.upload_date = recordData.upload_date ? this.validateDate(recordData.upload_date, 'Upload Date') : null;
    if (recordData.confirmation_date !== undefined) updatedData.confirmation_date = recordData.confirmation_date ? this.validateDate(recordData.confirmation_date, 'Confirmation Date') : null;
    if (recordData.status !== undefined) updatedData.status = recordData.status;

    if (recordData.branch_id !== undefined) {
      if ((access.role === 'employee' || access.role === 'hod') && access.branchId && recordData.branch_id !== access.branchId) {
        throw new Error('Unauthorized branch access.');
      }
      updatedData.branch_id = recordData.branch_id;
    }

    const { data, error } = await client.from('kyc_ucc_allotment').update(updatedData).eq('id', id).select('*, branches(name), profiles:created_by(full_name, email)').single();
    if (error) throw new Error(error.message);
    return data;
  }

  // ═══════════════════════════════════════════════
  // 3. CKYC / KRA UPDATION
  // ═══════════════════════════════════════════════

  async getRegistryUpdates(requesterId: string, filters: { status?: string; branchId?: string; search?: string }): Promise<any[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    let query = client.from('kyc_registry_updation').select('*, branches(name), profiles:created_by(full_name, email)').order('created_at', { ascending: false });

    if (access.role === 'employee' || access.role === 'hod') {
      if (access.branchId) query = query.eq('branch_id', access.branchId);
    }
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.branchId) query = query.eq('branch_id', filters.branchId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let result = data || [];
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter((r: any) =>
        r.client_name.toLowerCase().includes(s) ||
        r.pan.toLowerCase().includes(s) ||
        r.registry.toLowerCase().includes(s)
      );
    }
    return result;
  }

  async createRegistryUpdate(requesterId: string, recordData: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const client_name = this.validateRequiredString(recordData.client_name, 'Client Name');
    const pan = this.validatePAN(recordData.pan);
    const registry = this.validateRequiredString(recordData.registry, 'Registry');
    if (!['CKYC', 'KRA'].includes(registry)) throw new Error('Registry must be CKYC or KRA.');

    const branch_id = recordData.branch_id || access.branchId;
    if (!branch_id) throw new Error('Branch required.');

    const insertData = {
      client_name, pan, registry,
      upload_date: recordData.upload_date ? this.validateDate(recordData.upload_date, 'Upload Date') : null,
      status: recordData.status || 'Pending',
      rejection_reason: recordData.rejection_reason ? String(recordData.rejection_reason).trim() : null,
      branch_id,
      created_by: requesterId
    };

    const { data, error } = await client.from('kyc_registry_updation').insert(insertData).select('*, branches(name), profiles:created_by(full_name, email)').single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updateRegistryUpdate(requesterId: string, id: string, recordData: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const { data: existing, error: fetchErr } = await client.from('kyc_registry_updation').select('branch_id').eq('id', id).single();
    if (fetchErr || !existing) throw new Error('Record not found.');
    if ((access.role === 'employee' || access.role === 'hod') && access.branchId && existing.branch_id !== access.branchId) {
      throw new Error('Unauthorized branch access.');
    }

    const updatedData: any = {};
    if (recordData.client_name !== undefined) updatedData.client_name = this.validateRequiredString(recordData.client_name, 'Client Name');
    if (recordData.pan !== undefined) updatedData.pan = this.validatePAN(recordData.pan);
    if (recordData.registry !== undefined) {
      if (!['CKYC', 'KRA'].includes(recordData.registry)) throw new Error('Registry must be CKYC or KRA.');
      updatedData.registry = recordData.registry;
    }
    if (recordData.upload_date !== undefined) updatedData.upload_date = recordData.upload_date ? this.validateDate(recordData.upload_date, 'Upload Date') : null;
    if (recordData.status !== undefined) updatedData.status = recordData.status;
    if (recordData.rejection_reason !== undefined) updatedData.rejection_reason = recordData.rejection_reason ? String(recordData.rejection_reason).trim() : null;

    if (recordData.branch_id !== undefined) {
      if ((access.role === 'employee' || access.role === 'hod') && access.branchId && recordData.branch_id !== access.branchId) {
        throw new Error('Unauthorized branch access.');
      }
      updatedData.branch_id = recordData.branch_id;
    }

    const { data, error } = await client.from('kyc_registry_updation').update(updatedData).eq('id', id).select('*, branches(name), profiles:created_by(full_name, email)').single();
    if (error) throw new Error(error.message);
    return data;
  }

  // ═══════════════════════════════════════════════
  // 4. AP / REMISIER SHARING UPDATION
  // ═══════════════════════════════════════════════

  async getAPSharings(requesterId: string, filters: { status?: string; branchId?: string; search?: string }): Promise<any[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    let query = client.from('kyc_ap_sharing').select('*, branches(name), profiles:created_by(full_name, email)').order('created_at', { ascending: false });

    if (access.role === 'employee' || access.role === 'hod') {
      if (access.branchId) query = query.eq('branch_id', access.branchId);
    }
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.branchId) query = query.eq('branch_id', filters.branchId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let result = data || [];
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter((r: any) =>
        r.ap_name.toLowerCase().includes(s) ||
        r.ap_code.toLowerCase().includes(s) ||
        r.client_name.toLowerCase().includes(s)
      );
    }
    return result;
  }

  async createAPSharing(requesterId: string, recordData: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const ap_name = this.validateRequiredString(recordData.ap_name, 'AP Name');
    const ap_code = this.validateRequiredString(recordData.ap_code, 'AP Code');
    const client_name = this.validateRequiredString(recordData.client_name, 'Client Name');
    const sharing_percentage = this.validatePercentage(recordData.sharing_percentage);
    const effective_date = this.validateDate(recordData.effective_date, 'Effective Date');

    const branch_id = recordData.branch_id || access.branchId;
    if (!branch_id) throw new Error('Branch required.');

    const insertData = {
      ap_name, ap_code, client_name, sharing_percentage, effective_date,
      status: recordData.status || 'Active',
      branch_id,
      created_by: requesterId
    };

    const { data, error } = await client.from('kyc_ap_sharing').insert(insertData).select('*, branches(name), profiles:created_by(full_name, email)').single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updateAPSharing(requesterId: string, id: string, recordData: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const { data: existing, error: fetchErr } = await client.from('kyc_ap_sharing').select('branch_id').eq('id', id).single();
    if (fetchErr || !existing) throw new Error('Record not found.');
    if ((access.role === 'employee' || access.role === 'hod') && access.branchId && existing.branch_id !== access.branchId) {
      throw new Error('Unauthorized branch access.');
    }

    const updatedData: any = {};
    if (recordData.ap_name !== undefined) updatedData.ap_name = this.validateRequiredString(recordData.ap_name, 'AP Name');
    if (recordData.ap_code !== undefined) updatedData.ap_code = this.validateRequiredString(recordData.ap_code, 'AP Code');
    if (recordData.client_name !== undefined) updatedData.client_name = this.validateRequiredString(recordData.client_name, 'Client Name');
    if (recordData.sharing_percentage !== undefined) updatedData.sharing_percentage = this.validatePercentage(recordData.sharing_percentage);
    if (recordData.effective_date !== undefined) updatedData.effective_date = this.validateDate(recordData.effective_date, 'Effective Date');
    if (recordData.status !== undefined) updatedData.status = recordData.status;

    if (recordData.branch_id !== undefined) {
      if ((access.role === 'employee' || access.role === 'hod') && access.branchId && recordData.branch_id !== access.branchId) {
        throw new Error('Unauthorized branch access.');
      }
      updatedData.branch_id = recordData.branch_id;
    }

    const { data, error } = await client.from('kyc_ap_sharing').update(updatedData).eq('id', id).select('*, branches(name), profiles:created_by(full_name, email)').single();
    if (error) throw new Error(error.message);
    return data;
  }

  // ═══════════════════════════════════════════════
  // 5. DEMISE REPORTING
  // ═══════════════════════════════════════════════

  async getDemiseReports(requesterId: string, filters: { status?: string; branchId?: string; search?: string }): Promise<any[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    let query = client.from('kyc_demise_reporting').select('*, branches(name), profiles:created_by(full_name, email)').order('created_at', { ascending: false });

    if (access.role === 'employee' || access.role === 'hod') {
      if (access.branchId) query = query.eq('branch_id', access.branchId);
    }
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.branchId) query = query.eq('branch_id', filters.branchId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let result = data || [];
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter((r: any) =>
        r.client_name.toLowerCase().includes(s) ||
        r.pan.toLowerCase().includes(s)
      );
    }
    return result;
  }

  async createDemiseReport(requesterId: string, recordData: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const client_name = this.validateRequiredString(recordData.client_name, 'Client Name');
    const pan = this.validatePAN(recordData.pan);
    const date_of_demise = this.validateDate(recordData.date_of_demise, 'Date of Demise');
    const reported_date = this.validateDate(recordData.reported_date, 'Reported Date');

    const branch_id = recordData.branch_id || access.branchId;
    if (!branch_id) throw new Error('Branch required.');

    const insertData = {
      client_name, pan, date_of_demise, reported_date,
      death_certificate_url: recordData.death_certificate_url ? String(recordData.death_certificate_url).trim() : null,
      status: recordData.status || 'Reported',
      remarks: recordData.remarks ? String(recordData.remarks).trim() : null,
      branch_id,
      created_by: requesterId
    };

    const { data, error } = await client.from('kyc_demise_reporting').insert(insertData).select('*, branches(name), profiles:created_by(full_name, email)').single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updateDemiseReport(requesterId: string, id: string, recordData: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const { data: existing, error: fetchErr } = await client.from('kyc_demise_reporting').select('branch_id').eq('id', id).single();
    if (fetchErr || !existing) throw new Error('Record not found.');
    if ((access.role === 'employee' || access.role === 'hod') && access.branchId && existing.branch_id !== access.branchId) {
      throw new Error('Unauthorized branch access.');
    }

    const updatedData: any = {};
    if (recordData.client_name !== undefined) updatedData.client_name = this.validateRequiredString(recordData.client_name, 'Client Name');
    if (recordData.pan !== undefined) updatedData.pan = this.validatePAN(recordData.pan);
    if (recordData.date_of_demise !== undefined) updatedData.date_of_demise = this.validateDate(recordData.date_of_demise, 'Date of Demise');
    if (recordData.reported_date !== undefined) updatedData.reported_date = this.validateDate(recordData.reported_date, 'Reported Date');
    if (recordData.death_certificate_url !== undefined) updatedData.death_certificate_url = recordData.death_certificate_url ? String(recordData.death_certificate_url).trim() : null;
    if (recordData.status !== undefined) updatedData.status = recordData.status;
    if (recordData.remarks !== undefined) updatedData.remarks = recordData.remarks ? String(recordData.remarks).trim() : null;

    if (recordData.branch_id !== undefined) {
      if ((access.role === 'employee' || access.role === 'hod') && access.branchId && recordData.branch_id !== access.branchId) {
        throw new Error('Unauthorized branch access.');
      }
      updatedData.branch_id = recordData.branch_id;
    }

    const { data, error } = await client.from('kyc_demise_reporting').update(updatedData).eq('id', id).select('*, branches(name), profiles:created_by(full_name, email)').single();
    if (error) throw new Error(error.message);
    return data;
  }

  // ═══════════════════════════════════════════════
  // 6. AP CODE UPDATION TO EXCHANGE
  // ═══════════════════════════════════════════════

  async getAPCodes(requesterId: string, filters: { status?: string; branchId?: string; search?: string }): Promise<any[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    let query = client.from('kyc_ap_code_exchange').select('*, branches(name), profiles:created_by(full_name, email)').order('created_at', { ascending: false });

    if (access.role === 'employee' || access.role === 'hod') {
      if (access.branchId) query = query.eq('branch_id', access.branchId);
    }
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.branchId) query = query.eq('branch_id', filters.branchId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let result = data || [];
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter((r: any) =>
        r.ap_name.toLowerCase().includes(s) ||
        r.ap_code.toLowerCase().includes(s) ||
        r.exchange.toLowerCase().includes(s)
      );
    }
    return result;
  }

  async createAPCode(requesterId: string, recordData: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const ap_name = this.validateRequiredString(recordData.ap_name, 'AP Name');
    const ap_code = this.validateRequiredString(recordData.ap_code, 'AP Code');
    const exchange = this.validateRequiredString(recordData.exchange, 'Exchange');
    if (!['NSE', 'BSE'].includes(exchange)) throw new Error('Exchange must be NSE or BSE.');
    const upload_date = this.validateDate(recordData.upload_date, 'Upload Date');

    const branch_id = recordData.branch_id || access.branchId;
    if (!branch_id) throw new Error('Branch required.');

    const insertData = {
      ap_name, ap_code, exchange, upload_date,
      status: recordData.status || 'Pending',
      branch_id,
      created_by: requesterId
    };

    const { data, error } = await client.from('kyc_ap_code_exchange').insert(insertData).select('*, branches(name), profiles:created_by(full_name, email)').single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updateAPCode(requesterId: string, id: string, recordData: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const { data: existing, error: fetchErr } = await client.from('kyc_ap_code_exchange').select('branch_id').eq('id', id).single();
    if (fetchErr || !existing) throw new Error('Record not found.');
    if ((access.role === 'employee' || access.role === 'hod') && access.branchId && existing.branch_id !== access.branchId) {
      throw new Error('Unauthorized branch access.');
    }

    const updatedData: any = {};
    if (recordData.ap_name !== undefined) updatedData.ap_name = this.validateRequiredString(recordData.ap_name, 'AP Name');
    if (recordData.ap_code !== undefined) updatedData.ap_code = this.validateRequiredString(recordData.ap_code, 'AP Code');
    if (recordData.exchange !== undefined) {
      if (!['NSE', 'BSE'].includes(recordData.exchange)) throw new Error('Exchange must be NSE or BSE.');
      updatedData.exchange = recordData.exchange;
    }
    if (recordData.upload_date !== undefined) updatedData.upload_date = this.validateDate(recordData.upload_date, 'Upload Date');
    if (recordData.status !== undefined) updatedData.status = recordData.status;

    if (recordData.branch_id !== undefined) {
      if ((access.role === 'employee' || access.role === 'hod') && access.branchId && recordData.branch_id !== access.branchId) {
        throw new Error('Unauthorized branch access.');
      }
      updatedData.branch_id = recordData.branch_id;
    }

    const { data, error } = await client.from('kyc_ap_code_exchange').update(updatedData).eq('id', id).select('*, branches(name), profiles:created_by(full_name, email)').single();
    if (error) throw new Error(error.message);
    return data;
  }

  // ═══════════════════════════════════════════════
  // 7. CLIENT ONBOARDING COMMUNICATION
  // ═══════════════════════════════════════════════

  async getCommunications(requesterId: string, filters: { status?: string; branchId?: string; search?: string }): Promise<any[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    let query = client.from('kyc_onboarding_communication').select('*, branches(name), profiles:created_by(full_name, email)').order('created_at', { ascending: false });

    if (access.role === 'employee' || access.role === 'hod') {
      if (access.branchId) query = query.eq('branch_id', access.branchId);
    }
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.branchId) query = query.eq('branch_id', filters.branchId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let result = data || [];
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter((r: any) =>
        r.client_name.toLowerCase().includes(s) ||
        r.mode.toLowerCase().includes(s)
      );
    }
    return result;
  }

  async createCommunication(requesterId: string, recordData: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const client_name = this.validateRequiredString(recordData.client_name, 'Client Name');
    const mode = this.validateRequiredString(recordData.mode, 'Mode');
    if (!['Letter', 'SMS', 'Call', 'Email'].includes(mode)) throw new Error('Invalid communication mode.');
    const sent_date = this.validateDate(recordData.sent_date, 'Sent Date');

    const branch_id = recordData.branch_id || access.branchId;
    if (!branch_id) throw new Error('Branch required.');

    const insertData = {
      client_name, mode, sent_date,
      status: recordData.status || 'Sent',
      remarks: recordData.remarks ? String(recordData.remarks).trim() : null,
      branch_id,
      created_by: requesterId
    };

    const { data, error } = await client.from('kyc_onboarding_communication').insert(insertData).select('*, branches(name), profiles:created_by(full_name, email)').single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updateCommunication(requesterId: string, id: string, recordData: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const { data: existing, error: fetchErr } = await client.from('kyc_onboarding_communication').select('branch_id').eq('id', id).single();
    if (fetchErr || !existing) throw new Error('Record not found.');
    if ((access.role === 'employee' || access.role === 'hod') && access.branchId && existing.branch_id !== access.branchId) {
      throw new Error('Unauthorized branch access.');
    }

    const updatedData: any = {};
    if (recordData.client_name !== undefined) updatedData.client_name = this.validateRequiredString(recordData.client_name, 'Client Name');
    if (recordData.mode !== undefined) {
      if (!['Letter', 'SMS', 'Call', 'Email'].includes(recordData.mode)) throw new Error('Invalid communication mode.');
      updatedData.mode = recordData.mode;
    }
    if (recordData.sent_date !== undefined) updatedData.sent_date = this.validateDate(recordData.sent_date, 'Sent Date');
    if (recordData.status !== undefined) updatedData.status = recordData.status;
    if (recordData.remarks !== undefined) updatedData.remarks = recordData.remarks ? String(recordData.remarks).trim() : null;

    if (recordData.branch_id !== undefined) {
      if ((access.role === 'employee' || access.role === 'hod') && access.branchId && recordData.branch_id !== access.branchId) {
        throw new Error('Unauthorized branch access.');
      }
      updatedData.branch_id = recordData.branch_id;
    }

    const { data, error } = await client.from('kyc_onboarding_communication').update(updatedData).eq('id', id).select('*, branches(name), profiles:created_by(full_name, email)').single();
    if (error) throw new Error(error.message);
    return data;
  }

  // ═══════════════════════════════════════════════
  // 8. MODIFICATION REQUESTS
  // ═══════════════════════════════════════════════

  async getModifications(requesterId: string, filters: { status?: string; branchId?: string; search?: string }): Promise<any[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    let query = client.from('kyc_modification_requests').select('*, branches(name), profiles:created_by(full_name, email)').order('created_at', { ascending: false });

    if (access.role === 'employee' || access.role === 'hod') {
      if (access.branchId) query = query.eq('branch_id', access.branchId);
    }
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.branchId) query = query.eq('branch_id', filters.branchId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let result = data || [];
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter((r: any) =>
        r.client_name.toLowerCase().includes(s) ||
        r.pan.toLowerCase().includes(s) ||
        r.modification_type.toLowerCase().includes(s)
      );
    }
    return result;
  }

  async createModification(requesterId: string, recordData: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const client_name = this.validateRequiredString(recordData.client_name, 'Client Name');
    const pan = this.validatePAN(recordData.pan);
    const modification_type = this.validateRequiredString(recordData.modification_type, 'Modification Type');
    const allowed = ['Address', 'Mobile', 'Email', 'Bank Details', 'Nomination', 'Signature', 'Other'];
    if (!allowed.includes(modification_type)) throw new Error('Invalid modification type.');
    const request_date = this.validateDate(recordData.request_date, 'Request Date');

    const branch_id = recordData.branch_id || access.branchId;
    if (!branch_id) throw new Error('Branch required.');

    const insertData = {
      client_name, pan, modification_type, request_date,
      old_value: recordData.old_value ? String(recordData.old_value).trim() : null,
      new_value: recordData.new_value ? String(recordData.new_value).trim() : null,
      supporting_document_url: recordData.supporting_document_url ? String(recordData.supporting_document_url).trim() : null,
      processed_date: recordData.processed_date ? this.validateDate(recordData.processed_date, 'Processed Date') : null,
      status: recordData.status || 'Pending',
      branch_id,
      created_by: requesterId
    };

    const { data, error } = await client.from('kyc_modification_requests').insert(insertData).select('*, branches(name), profiles:created_by(full_name, email)').single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updateModification(requesterId: string, id: string, recordData: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const { data: existing, error: fetchErr } = await client.from('kyc_modification_requests').select('branch_id').eq('id', id).single();
    if (fetchErr || !existing) throw new Error('Record not found.');
    if ((access.role === 'employee' || access.role === 'hod') && access.branchId && existing.branch_id !== access.branchId) {
      throw new Error('Unauthorized branch access.');
    }

    const updatedData: any = {};
    if (recordData.client_name !== undefined) updatedData.client_name = this.validateRequiredString(recordData.client_name, 'Client Name');
    if (recordData.pan !== undefined) updatedData.pan = this.validatePAN(recordData.pan);
    if (recordData.modification_type !== undefined) {
      const allowed = ['Address', 'Mobile', 'Email', 'Bank Details', 'Nomination', 'Signature', 'Other'];
      if (!allowed.includes(recordData.modification_type)) throw new Error('Invalid modification type.');
      updatedData.modification_type = recordData.modification_type;
    }
    if (recordData.request_date !== undefined) updatedData.request_date = this.validateDate(recordData.request_date, 'Request Date');
    if (recordData.old_value !== undefined) updatedData.old_value = recordData.old_value ? String(recordData.old_value).trim() : null;
    if (recordData.new_value !== undefined) updatedData.new_value = recordData.new_value ? String(recordData.new_value).trim() : null;
    if (recordData.supporting_document_url !== undefined) updatedData.supporting_document_url = recordData.supporting_document_url ? String(recordData.supporting_document_url).trim() : null;
    if (recordData.processed_date !== undefined) updatedData.processed_date = recordData.processed_date ? this.validateDate(recordData.processed_date, 'Processed Date') : null;
    if (recordData.status !== undefined) updatedData.status = recordData.status;

    if (recordData.branch_id !== undefined) {
      if ((access.role === 'employee' || access.role === 'hod') && access.branchId && recordData.branch_id !== access.branchId) {
        throw new Error('Unauthorized branch access.');
      }
      updatedData.branch_id = recordData.branch_id;
    }

    const { data, error } = await client.from('kyc_modification_requests').update(updatedData).eq('id', id).select('*, branches(name), profiles:created_by(full_name, email)').single();
    if (error) throw new Error(error.message);
    return data;
  }

  // ═══════════════════════════════════════════════
  // 9. REACTIVATION
  // ═══════════════════════════════════════════════

  async getReactivations(requesterId: string, filters: { status?: string; branchId?: string; search?: string }): Promise<any[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    let query = client.from('kyc_reactivation_requests').select('*, branches(name), profiles:created_by(full_name, email)').order('created_at', { ascending: false });

    if (access.role === 'employee' || access.role === 'hod') {
      if (access.branchId) query = query.eq('branch_id', access.branchId);
    }
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.branchId) query = query.eq('branch_id', filters.branchId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let result = data || [];
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter((r: any) =>
        r.client_name.toLowerCase().includes(s) ||
        r.pan.toLowerCase().includes(s)
      );
    }
    return result;
  }

  async createReactivation(requesterId: string, recordData: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const client_name = this.validateRequiredString(recordData.client_name, 'Client Name');
    const pan = this.validatePAN(recordData.pan);
    const reason = this.validateRequiredString(recordData.reason, 'Reason', 500);
    const request_date = this.validateDate(recordData.request_date, 'Request Date');

    const branch_id = recordData.branch_id || access.branchId;
    if (!branch_id) throw new Error('Branch required.');

    const insertData = {
      client_name, pan, reason, request_date,
      processed_date: recordData.processed_date ? this.validateDate(recordData.processed_date, 'Processed Date') : null,
      status: recordData.status || 'Pending',
      branch_id,
      created_by: requesterId
    };

    const { data, error } = await client.from('kyc_reactivation_requests').insert(insertData).select('*, branches(name), profiles:created_by(full_name, email)').single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updateReactivation(requesterId: string, id: string, recordData: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const { data: existing, error: fetchErr } = await client.from('kyc_reactivation_requests').select('branch_id').eq('id', id).single();
    if (fetchErr || !existing) throw new Error('Record not found.');
    if ((access.role === 'employee' || access.role === 'hod') && access.branchId && existing.branch_id !== access.branchId) {
      throw new Error('Unauthorized branch access.');
    }

    const updatedData: any = {};
    if (recordData.client_name !== undefined) updatedData.client_name = this.validateRequiredString(recordData.client_name, 'Client Name');
    if (recordData.pan !== undefined) updatedData.pan = this.validatePAN(recordData.pan);
    if (recordData.reason !== undefined) updatedData.reason = this.validateRequiredString(recordData.reason, 'Reason', 500);
    if (recordData.request_date !== undefined) updatedData.request_date = this.validateDate(recordData.request_date, 'Request Date');
    if (recordData.processed_date !== undefined) updatedData.processed_date = recordData.processed_date ? this.validateDate(recordData.processed_date, 'Processed Date') : null;
    if (recordData.status !== undefined) updatedData.status = recordData.status;

    if (recordData.branch_id !== undefined) {
      if ((access.role === 'employee' || access.role === 'hod') && access.branchId && recordData.branch_id !== access.branchId) {
        throw new Error('Unauthorized branch access.');
      }
      updatedData.branch_id = recordData.branch_id;
    }

    const { data, error } = await client.from('kyc_reactivation_requests').update(updatedData).eq('id', id).select('*, branches(name), profiles:created_by(full_name, email)').single();
    if (error) throw new Error(error.message);
    return data;
  }

  // ═══════════════════════════════════════════════
  // 10. ACCOUNT CLOSURE / UCC CLOSURE
  // ═══════════════════════════════════════════════

  async getClosures(requesterId: string, filters: { status?: string; branchId?: string; search?: string }): Promise<any[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    let query = client.from('kyc_account_closure').select('*, branches(name), profiles:created_by(full_name, email)').order('created_at', { ascending: false });

    if (access.role === 'employee' || access.role === 'hod') {
      if (access.branchId) query = query.eq('branch_id', access.branchId);
    }
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.branchId) query = query.eq('branch_id', filters.branchId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let result = data || [];
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter((r: any) =>
        r.client_name.toLowerCase().includes(s) ||
        r.pan.toLowerCase().includes(s)
      );
    }
    return result;
  }

  async createClosure(requesterId: string, recordData: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const client_name = this.validateRequiredString(recordData.client_name, 'Client Name');
    const pan = this.validatePAN(recordData.pan);
    const reason = this.validateRequiredString(recordData.reason, 'Reason', 500);
    const request_date = this.validateDate(recordData.request_date, 'Request Date');

    const branch_id = recordData.branch_id || access.branchId;
    if (!branch_id) throw new Error('Branch required.');

    const insertData = {
      client_name, pan, reason, request_date,
      closure_date: recordData.closure_date ? this.validateDate(recordData.closure_date, 'Closure Date') : null,
      status: recordData.status || 'Pending',
      branch_id,
      created_by: requesterId
    };

    const { data, error } = await client.from('kyc_account_closure').insert(insertData).select('*, branches(name), profiles:created_by(full_name, email)').single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updateClosure(requesterId: string, id: string, recordData: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const { data: existing, error: fetchErr } = await client.from('kyc_account_closure').select('branch_id').eq('id', id).single();
    if (fetchErr || !existing) throw new Error('Record not found.');
    if ((access.role === 'employee' || access.role === 'hod') && access.branchId && existing.branch_id !== access.branchId) {
      throw new Error('Unauthorized branch access.');
    }

    const updatedData: any = {};
    if (recordData.client_name !== undefined) updatedData.client_name = this.validateRequiredString(recordData.client_name, 'Client Name');
    if (recordData.pan !== undefined) updatedData.pan = this.validatePAN(recordData.pan);
    if (recordData.reason !== undefined) updatedData.reason = this.validateRequiredString(recordData.reason, 'Reason', 500);
    if (recordData.request_date !== undefined) updatedData.request_date = this.validateDate(recordData.request_date, 'Request Date');
    if (recordData.closure_date !== undefined) updatedData.closure_date = recordData.closure_date ? this.validateDate(recordData.closure_date, 'Closure Date') : null;
    if (recordData.status !== undefined) updatedData.status = recordData.status;

    if (recordData.branch_id !== undefined) {
      if ((access.role === 'employee' || access.role === 'hod') && access.branchId && recordData.branch_id !== access.branchId) {
        throw new Error('Unauthorized branch access.');
      }
      updatedData.branch_id = recordData.branch_id;
    }

    const { data, error } = await client.from('kyc_account_closure').update(updatedData).eq('id', id).select('*, branches(name), profiles:created_by(full_name, email)').single();
    if (error) throw new Error(error.message);
    return data;
  }

  // ═══════════════════════════════════════════════
  // 11. EXCHANGE COMPLIANCE STATUS
  // ═══════════════════════════════════════════════

  async getCompliances(requesterId: string, filters: { status?: string; branchId?: string; search?: string }): Promise<any[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    let query = client.from('kyc_exchange_compliance').select('*, branches(name), profiles:created_by(full_name, email)').order('created_at', { ascending: false });

    if (access.role === 'employee' || access.role === 'hod') {
      if (access.branchId) query = query.eq('branch_id', access.branchId);
    }
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.branchId) query = query.eq('branch_id', filters.branchId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let result = data || [];
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter((r: any) =>
        r.client_name.toLowerCase().includes(s) ||
        r.pan.toLowerCase().includes(s) ||
        r.compliance_item.toLowerCase().includes(s)
      );
    }
    return result;
  }

  async createCompliance(requesterId: string, recordData: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const client_name = this.validateRequiredString(recordData.client_name, 'Client Name');
    const pan = this.validatePAN(recordData.pan);
    const compliance_item = this.validateRequiredString(recordData.compliance_item, 'Compliance Item');
    const due_date = recordData.due_date ? this.validateDate(recordData.due_date, 'Due Date') : null;

    const branch_id = recordData.branch_id || access.branchId;
    if (!branch_id) throw new Error('Branch required.');

    const insertData = {
      client_name, pan, compliance_item, due_date,
      status: recordData.status || 'Due',
      branch_id,
      created_by: requesterId
    };

    const { data, error } = await client.from('kyc_exchange_compliance').insert(insertData).select('*, branches(name), profiles:created_by(full_name, email)').single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updateCompliance(requesterId: string, id: string, recordData: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');
    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const { data: existing, error: fetchErr } = await client.from('kyc_exchange_compliance').select('branch_id').eq('id', id).single();
    if (fetchErr || !existing) throw new Error('Record not found.');
    if ((access.role === 'employee' || access.role === 'hod') && access.branchId && existing.branch_id !== access.branchId) {
      throw new Error('Unauthorized branch access.');
    }

    const updatedData: any = {};
    if (recordData.client_name !== undefined) updatedData.client_name = this.validateRequiredString(recordData.client_name, 'Client Name');
    if (recordData.pan !== undefined) updatedData.pan = this.validatePAN(recordData.pan);
    if (recordData.compliance_item !== undefined) updatedData.compliance_item = this.validateRequiredString(recordData.compliance_item, 'Compliance Item');
    if (recordData.due_date !== undefined) updatedData.due_date = recordData.due_date ? this.validateDate(recordData.due_date, 'Due Date') : null;
    if (recordData.status !== undefined) updatedData.status = recordData.status;

    if (recordData.branch_id !== undefined) {
      if ((access.role === 'employee' || access.role === 'hod') && access.branchId && recordData.branch_id !== access.branchId) {
        throw new Error('Unauthorized branch access.');
      }
      updatedData.branch_id = recordData.branch_id;
    }

    const { data, error } = await client.from('kyc_exchange_compliance').update(updatedData).eq('id', id).select('*, branches(name), profiles:created_by(full_name, email)').single();
    if (error) throw new Error(error.message);
    return data;
  }

  // ═══════════════════════════════════════════════
  // DASHBOARD AGGREGATIONS
  // ═══════════════════════════════════════════════

  async getDashboardStats(requesterId: string, branchIdFilter?: string): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not configured.');

    const access = await this.verifyAccess(requesterId, true);
    if (!access.authorized) throw new Error('Unauthorized: Dashboard access denied.');

    let targetBranchId: string | undefined = branchIdFilter;
    if (access.role === 'employee' || access.role === 'hod') {
      targetBranchId = access.branchId || undefined;
    }

    // 1. Fetch data from each sheet to aggregate dashboard stats
    // A. New accounts status breakdown
    let naQuery = client.from('kyc_new_account').select('status, created_at');
    if (targetBranchId) naQuery = naQuery.eq('branch_id', targetBranchId);
    const { data: naData, error: naError } = await naQuery;
    if (naError) throw new Error(naError.message);

    // B. UCC Allotment
    let uccQuery = client.from('kyc_ucc_allotment').select('status');
    if (targetBranchId) uccQuery = uccQuery.eq('branch_id', targetBranchId);
    const { data: uccData, error: uccError } = await uccQuery;
    if (uccError) throw new Error(uccError.message);

    // C. Registry update
    let regQuery = client.from('kyc_registry_updation').select('status');
    if (targetBranchId) regQuery = regQuery.eq('branch_id', targetBranchId);
    const { data: regData, error: regError } = await regQuery;
    if (regError) throw new Error(regError.message);

    // D. Demise reports
    let demiseQuery = client.from('kyc_demise_reporting').select('status');
    if (targetBranchId) demiseQuery = demiseQuery.eq('branch_id', targetBranchId);
    const { data: demiseData, error: demiseError } = await demiseQuery;
    if (demiseError) throw new Error(demiseError.message);

    // E. Modifications
    let modQuery = client.from('kyc_modification_requests').select('status, modification_type');
    if (targetBranchId) modQuery = modQuery.eq('branch_id', targetBranchId);
    const { data: modData, error: modError } = await modQuery;
    if (modError) throw new Error(modError.message);

    // F. Reactivations
    let reactQuery = client.from('kyc_reactivation_requests').select('status');
    if (targetBranchId) reactQuery = reactQuery.eq('branch_id', targetBranchId);
    const { data: reactData, error: reactError } = await reactQuery;
    if (reactError) throw new Error(reactError.message);

    // G. Closures
    let closureQuery = client.from('kyc_account_closure').select('status');
    if (targetBranchId) closureQuery = closureQuery.eq('branch_id', targetBranchId);
    const { data: closureData, error: closureError } = await closureQuery;
    if (closureError) throw new Error(closureError.message);

    // H. Exchange Compliance
    let compQuery = client.from('kyc_exchange_compliance').select('status');
    if (targetBranchId) compQuery = compQuery.eq('branch_id', targetBranchId);
    const { data: compData, error: compError } = await compQuery;
    if (compError) throw new Error(compError.message);

    // Calculations
    const newAccountsStats = { Total: 0, Pending: 0, Verified: 0, Rejected: 0 };
    (naData || []).forEach(r => {
      newAccountsStats.Total++;
      if (r.status === 'Pending') newAccountsStats.Pending++;
      else if (r.status === 'Verified') newAccountsStats.Verified++;
      else if (r.status === 'Rejected') newAccountsStats.Rejected++;
    });

    const uccStats = { Total: 0, Pending: 0, Uploaded: 0, Confirmed: 0, Rejected: 0 };
    (uccData || []).forEach(r => {
      uccStats.Total++;
      if (r.status === 'Pending') uccStats.Pending++;
      else if (r.status === 'Uploaded') uccStats.Uploaded++;
      else if (r.status === 'Confirmed') uccStats.Confirmed++;
      else if (r.status === 'Rejected') uccStats.Rejected++;
    });

    const regStats = { Total: 0, Pending: 0, Verified: 0, Rejected: 0 };
    (regData || []).forEach(r => {
      regStats.Total++;
      if (r.status === 'Pending') regStats.Pending++;
      else if (r.status === 'Verified') regStats.Verified++;
      else if (r.status === 'Rejected') regStats.Rejected++;
    });

    const modificationStats = { Total: 0, Pending: 0, Processed: 0, Rejected: 0 };
    const modificationTypesBreakdown: { [key: string]: number } = {
      Address: 0, Mobile: 0, Email: 0, 'Bank Details': 0, Nomination: 0, Signature: 0, Other: 0
    };
    (modData || []).forEach(r => {
      modificationStats.Total++;
      if (r.status === 'Pending') modificationStats.Pending++;
      else if (r.status === 'Processed') modificationStats.Processed++;
      else if (r.status === 'Rejected') modificationStats.Rejected++;

      if (r.modification_type && modificationTypesBreakdown[r.modification_type] !== undefined) {
        modificationTypesBreakdown[r.modification_type] = (modificationTypesBreakdown[r.modification_type] || 0) + 1;
      }
    });

    const demiseCount = (demiseData || []).length;
    const activeReactivations = (reactData || []).filter(r => r.status === 'Pending').length;
    const closuresCount = (closureData || []).length;

    const complianceStats = { Compliant: 0, 'Non-Compliant': 0, Due: 0 };
    (compData || []).forEach(r => {
      if (r.status in complianceStats) {
        complianceStats[r.status as keyof typeof complianceStats]++;
      }
    });

    // Donut chart status breakdown (aggregating new accounts + registry + modifications)
    const combinedStatus = [
      { status: 'Verified/Processed/Confirmed', count: newAccountsStats.Verified + regStats.Verified + modificationStats.Processed + uccStats.Confirmed },
      { status: 'Pending', count: newAccountsStats.Pending + regStats.Pending + modificationStats.Pending + uccStats.Pending },
      { status: 'Rejected', count: newAccountsStats.Rejected + regStats.Rejected + modificationStats.Rejected + uccStats.Rejected }
    ];

    // Monthly onboarding trend for the last 6 months (based on kyc_new_account created_at)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyCounts = Array(12).fill(0);
    const currentYear = new Date().getFullYear();

    (naData || []).forEach(r => {
      if (r.created_at) {
        const d = new Date(r.created_at);
        if (d.getFullYear() === currentYear) {
          const m = d.getMonth();
          if (m >= 0 && m < 12) {
            monthlyCounts[m]++;
          }
        }
      }
    });

    const monthlyTrend = monthNames.map((name, idx) => ({
      month: name,
      count: monthlyCounts[idx]
    }));

    const requestTypes = Object.keys(modificationTypesBreakdown).map(type => ({
      type,
      count: modificationTypesBreakdown[type]
    }));

    return {
      kpis: {
        totalOnboarded: newAccountsStats.Total,
        pendingVerifications: newAccountsStats.Pending,
        processedModifications: modificationStats.Processed,
        activeReactivations,
        closedAccounts: closuresCount,
        demiseReportsCount: demiseCount
      },
      newAccounts: newAccountsStats,
      uccAllotments: uccStats,
      registryUpdates: regStats,
      modifications: modificationStats,
      compliance: complianceStats,
      charts: {
        statusBreakdown: combinedStatus,
        monthlyTrend,
        requestTypes
      }
    };
  }
}
