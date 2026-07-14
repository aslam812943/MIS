import type { Branch, Department, Module, ModuleField } from '../models/org.model.js';
import type { IBranchRepository, IDepartmentRepository, IModuleRepository } from '../repositories/interfaces/IOrgRepository.js';
import { supabaseAdmin } from '../config/supabase.js';

const MAX_NAME_LENGTH = 255;

// Every table whose branch_id column is defined ON DELETE CASCADE against
// branches(id) — deleting a branch without checking these first would let
// Postgres silently and permanently wipe every one of that branch's records
// across every department in one call. Kept as an explicit list (rather than
// querying information_schema at runtime) so it's easy to audit and extend
// when a new department table is added.
const BRANCH_DEPENDENT_TABLES = [
  'data_entries',
  'finance_pnl_summary', 'finance_compliance_renewals', 'finance_exchange_reporting',
  'finance_fund_movement', 'finance_client_requests', 'finance_referral_commission',
  'finance_cash_bank_position', 'finance_recurring_payables',
  'kyc_new_account', 'kyc_ucc_allotment', 'kyc_registry_updation', 'kyc_ap_sharing',
  'kyc_demise_reporting', 'kyc_ap_code_exchange', 'kyc_onboarding_communication',
  'kyc_modification_requests', 'kyc_reactivation_requests', 'kyc_account_closure',
  'kyc_exchange_compliance',
  'dp_new_account', 'dp_ucc_updation', 'dp_modification', 'dp_demat_execution',
  'dp_transfers_transmissions', 'dp_demat_rejection', 'dp_closure_execution',
  'dp_dis_slip_upload', 'dp_back_office_update', 'dp_eod_backup', 'dp_amc_charges',
  'dp_monthly_statements', 'dp_audit_compliance', 'dp_client_queries',
  'it_audits', 'it_audit_findings', 'it_vendors', 'it_assets', 'it_diagrams',
  'it_cybersecurity_compliance', 'it_tickets', 'it_incidents', 'it_projects',
  'settlement_payin_payout', 'settlement_client_requests', 'settlement_ipo_allocation',
  'settlement_corporate_actions',
  'iepf_claims',
];

/**
 * Service to manage organizational entities like Branches, Departments, and Modules.
 */
export class OrgService {
  constructor(
    private branchRepository: IBranchRepository,
    private departmentRepository: IDepartmentRepository,
    private moduleRepository: IModuleRepository
  ) {}

  /**
   * Blocks deleting a branch while any user or any department's records
   * still reference it — every one of those foreign keys cascades, so an
   * unchecked delete would permanently destroy that data with no warning.
   */
  private async assertBranchHasNoDependents(branchId: string): Promise<void> {
    if (!supabaseAdmin) throw new Error('Supabase admin client not configured.');

    const { count: profileCount } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId);
    if (profileCount && profileCount > 0) {
      throw new Error(`Cannot delete this branch: ${profileCount} user${profileCount === 1 ? ' is' : 's are'} still assigned to it. Reassign or remove them first.`);
    }

    const results = await Promise.all(
      BRANCH_DEPENDENT_TABLES.map(async (table) => {
        const { count } = await supabaseAdmin!
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('branch_id', branchId);
        return { table, count: count || 0 };
      })
    );

    const withData = results.filter(r => r.count > 0);
    if (withData.length > 0) {
      const summary = withData.map(r => `${r.table} (${r.count})`).join(', ');
      throw new Error(
        `Cannot delete this branch: it still has records in ${withData.length} table(s) — ${summary}. ` +
        `Deleting it would permanently destroy that data. Reassign or archive the branch's records first.`
      );
    }
  }

  /**
   * Blocks deleting a department while any user, or any data_entries row,
   * still references it — both foreign keys cascade.
   */
  private async assertDepartmentHasNoDependents(departmentId: string): Promise<void> {
    if (!supabaseAdmin) throw new Error('Supabase admin client not configured.');

    const { count: profileCount } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('department_id', departmentId);
    if (profileCount && profileCount > 0) {
      throw new Error(`Cannot delete this department: ${profileCount} user${profileCount === 1 ? ' is' : 's are'} still assigned to it. Reassign or remove them first.`);
    }

    const { count: entryCount } = await supabaseAdmin
      .from('data_entries')
      .select('id', { count: 'exact', head: true })
      .eq('department_id', departmentId);
    if (entryCount && entryCount > 0) {
      throw new Error(`Cannot delete this department: ${entryCount} data entr${entryCount === 1 ? 'y is' : 'ies are'} still linked to it.`);
    }
  }

  /**
   * Blocks deleting a module while any data_entries row still references it
   * — the foreign key cascades.
   */
  private async assertModuleHasNoDependents(moduleId: string): Promise<void> {
    if (!supabaseAdmin) throw new Error('Supabase admin client not configured.');

    const { count: entryCount } = await supabaseAdmin
      .from('data_entries')
      .select('id', { count: 'exact', head: true })
      .eq('module_id', moduleId);
    if (entryCount && entryCount > 0) {
      throw new Error(`Cannot delete this module: ${entryCount} data entr${entryCount === 1 ? 'y is' : 'ies are'} still linked to it.`);
    }
  }

  /**
   * Adds a new branch with validation.
   * 
   * @param name Name of the branch.
   * @returns The created branch.
   * @throws Error if name is empty or already exists.
   */
  async addBranch(name: string): Promise<Branch> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Branch name cannot be empty or just spaces.');
    }
    if (trimmedName.length > MAX_NAME_LENGTH) {
      throw new Error(`Branch name cannot exceed ${MAX_NAME_LENGTH} characters.`);
    }

    const existing = await this.branchRepository.findByName(trimmedName);
    if (existing) {
      throw new Error(`A branch with the name "${trimmedName}" already exists.`);
    }

    return this.branchRepository.create({ name: trimmedName });
  }

  /**
   * Retrieves all branches.
   */
  async getAllBranches(): Promise<Branch[]> {
    return this.branchRepository.findAll();
  }

  /**
   * Adds a new department with validation.
   * 
   * @param name Name of the department.
   * @returns The created department.
   * @throws Error if name is empty or already exists.
   */
  async addDepartment(name: string): Promise<Department> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Department name cannot be empty or just spaces.');
    }
    if (trimmedName.length > MAX_NAME_LENGTH) {
      throw new Error(`Department name cannot exceed ${MAX_NAME_LENGTH} characters.`);
    }

    const existing = await this.departmentRepository.findByName(trimmedName);
    if (existing) {
      throw new Error(`A department with the name "${trimmedName}" already exists.`);
    }

    return this.departmentRepository.create({ name: trimmedName });
  }

  /**
   * Retrieves all departments.
   */
  async getAllDepartments(): Promise<Department[]> {
    return this.departmentRepository.findAll();
  }

  /**
   * Adds a new module with validation.
   * 
   * @param name Name of the module.
   * @param fields Custom fields for the module.
   * @returns The created module.
   * @throws Error if name is empty or already exists.
   */
  async addModule(name: string, fields?: ModuleField[]): Promise<Module> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Module name cannot be empty or just spaces.');
    }
    if (trimmedName.length > MAX_NAME_LENGTH) {
      throw new Error(`Module name cannot exceed ${MAX_NAME_LENGTH} characters.`);
    }

    const existing = await this.moduleRepository.findByName(trimmedName);
    if (existing) {
      throw new Error(`A module with the name "${trimmedName}" already exists.`);
    }

    return this.moduleRepository.create({ 
      name: trimmedName, 
      ...(fields ? { fields } : {}) 
    } as any); // Cast to any to bypass exactOptionalPropertyTypes if needed, or better yet, fix the model.
  }

  /**
   * Retrieves all modules.
   */
  async getAllModules(): Promise<Module[]> {
    return this.moduleRepository.findAll();
  }

  /**
   * Updates a branch.
   */
  async updateBranch(id: string, name: string): Promise<Branch> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Branch name cannot be empty.');
    }
    if (trimmedName.length > MAX_NAME_LENGTH) {
      throw new Error(`Branch name cannot exceed ${MAX_NAME_LENGTH} characters.`);
    }

    const existing = await this.branchRepository.findByName(trimmedName);
    if (existing && existing.id !== id) {
      throw new Error(`A branch with the name "${trimmedName}" already exists.`);
    }

    return this.branchRepository.update(id, { name: trimmedName });
  }

  /**
   * Deletes a branch. Refuses if any user or any department's records still
   * reference it — see assertBranchHasNoDependents().
   */
  async deleteBranch(id: string): Promise<void> {
    await this.assertBranchHasNoDependents(id);
    return this.branchRepository.delete(id);
  }

  /**
   * Updates a department.
   */
  async updateDepartment(id: string, name: string): Promise<Department> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Department name cannot be empty.');
    }
    if (trimmedName.length > MAX_NAME_LENGTH) {
      throw new Error(`Department name cannot exceed ${MAX_NAME_LENGTH} characters.`);
    }

    const existing = await this.departmentRepository.findByName(trimmedName);
    if (existing && existing.id !== id) {
      throw new Error(`A department with the name "${trimmedName}" already exists.`);
    }

    return this.departmentRepository.update(id, { name: trimmedName });
  }

  /**
   * Deletes a department. Refuses if any user or data_entries row still
   * references it — see assertDepartmentHasNoDependents().
   */
  async deleteDepartment(id: string): Promise<void> {
    await this.assertDepartmentHasNoDependents(id);
    return this.departmentRepository.delete(id);
  }

  /**
   * Updates a module.
   */
  async updateModule(id: string, name: string, fields?: ModuleField[]): Promise<Module> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Module name cannot be empty.');
    }
    if (trimmedName.length > MAX_NAME_LENGTH) {
      throw new Error(`Module name cannot exceed ${MAX_NAME_LENGTH} characters.`);
    }

    const existing = await this.moduleRepository.findByName(trimmedName);
    if (existing && existing.id !== id) {
      throw new Error(`A module with the name "${trimmedName}" already exists.`);
    }

    return this.moduleRepository.update(id, {
      name: trimmedName,
      ...(fields ? { fields } : {})
    } as any);
  }

  /**
   * Deletes a module. Refuses if any data_entries row still references it —
   * see assertModuleHasNoDependents(). Also strips the module's id out of
   * every profile's `allowed_modules` array first — otherwise a profile
   * that had this module assigned keeps a dangling reference forever, and
   * UserService.updateUser used to hard-reject any future edit to that
   * profile (even unrelated ones, like changing their branch) because of it.
   */
  async deleteModule(id: string): Promise<void> {
    await this.assertModuleHasNoDependents(id);

    if (supabaseAdmin) {
      const { data: affected } = await supabaseAdmin
        .from('profiles')
        .select('id, allowed_modules')
        .contains('allowed_modules', [id]);

      for (const profile of affected || []) {
        const cleaned = (profile.allowed_modules || []).filter((m: string) => m !== id);
        await supabaseAdmin.from('profiles').update({ allowed_modules: cleaned }).eq('id', profile.id);
      }
    }

    return this.moduleRepository.delete(id);
  }

  /**
   * Helper methods to retrieve entities for auditing/history.
   */
  async getBranchById(id: string): Promise<Branch | null> {
    return this.branchRepository.findById(id);
  }

  async getDepartmentById(id: string): Promise<Department | null> {
    return this.departmentRepository.findById(id);
  }

  async getModuleById(id: string): Promise<Module | null> {
    return this.moduleRepository.findById(id);
  }
}
