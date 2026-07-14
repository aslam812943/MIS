import { supabaseAdmin } from '../config/supabase.js';
import type { IUserRepository } from '../repositories/interfaces/IUserRepository.js';
import type { EmailService } from './EmailService.js';
import { type User, UserRole } from '../models/user.model.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10}$/;
const MIN_PASSWORD_LENGTH = 4;
const VALID_ROLES = Object.values(UserRole) as string[];

// Roles that operate org-wide rather than belonging to one branch — the
// same set the Admin Panel frontend treats as not needing a Department.
// Only a full admin may create, edit, or change the status of an account in
// this tier; the /users routes are otherwise reachable by 'hr' too
// (requireAdminOrHR), and HR managing its own peers/leadership accounts
// (including being able to silently set one to 'blocked') would be a
// privilege-escalation-adjacent risk, not a normal HR function.
const LEADERSHIP_ROLES = ['admin', 'ceo', 'managing_director', 'director', 'executive'];

// Fields an HTTP caller may legitimately set on a user profile via
// updateUser(). Everything else (id, created_at, updated_at, or any
// unexpected key) is stripped before the update reaches the database —
// req.body was previously passed straight through to a Supabase
// `.update(body)` call, which sets every key present as a column, including
// ones like `id` that should never be client-writable.
const UPDATABLE_PROFILE_FIELDS: (keyof User)[] = [
  'email', 'role', 'full_name', 'phone_number', 'avatar_url',
  'branch_id', 'department_id', 'allowed_modules', 'status',
  'employee_id', 'joining_date', 'resignation_date',
  'resignation_reason', 'last_working_date',
];

/**
 * Service to manage users in the MIS system.
 */
export class UserService {
  constructor(
    private userRepository: IUserRepository,
    private emailService: EmailService
  ) {}

  /**
   * Creates a new user in Supabase Auth and the MIS profiles table.
   * 
   * @param userData Data for the new user.
   * @param password Password for the new user.
   * @returns The created user profile.
   */
  async createUser(userData: Partial<User> & { password?: string }, requestingUser?: any): Promise<User> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for user creation.');
    }

    // SECURITY: Prevent non-admin users from creating leadership-tier accounts
    // (admin/CEO/MD/director/executive) — /users is reachable by HR too
    // (requireAdminOrHR), and HR should not be able to grant org-wide access.
    if (LEADERSHIP_ROLES.includes(userData.role as string) && (!requestingUser || requestingUser.role !== 'admin')) {
      throw new Error('Access denied. Only administrators can create leadership-tier accounts.');
    }

    const { email, role, full_name, branch_id, department_id, allowed_modules, password } = userData;

    if (!email || !role || !password) {
      throw new Error('Email, role, and password are required.');
    }

    // VALIDATION: Email format
    if (!EMAIL_REGEX.test(email.trim())) {
      throw new Error('Invalid email address format.');
    }

    // VALIDATION: Role must be a real, known role — not just cast to the
    // TypeScript type with no runtime check. The DB CHECK constraint would
    // catch an invalid value too, but only after a raw, unfriendly error.
    if (!VALID_ROLES.includes(role)) {
      throw new Error(`Invalid role: ${role}`);
    }

    // VALIDATION: Password strength — Supabase Auth alone doesn't enforce a
    // meaningful minimum, so this app previously accepted any non-empty
    // password (including a single character) for accounts up to and
    // including admin.
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
    }

    // VALIDATION: Phone number format, if provided
    if (userData.phone_number && !PHONE_REGEX.test(userData.phone_number.trim())) {
      throw new Error('Phone number must be exactly 10 digits.');
    }

    // SANITIZATION: Trim whitespace
    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedName = full_name?.trim();

    if (sanitizedName && sanitizedName.length > 255) {
      throw new Error('Full name cannot exceed 255 characters.');
    }

    // Auto-generate employee_id if not provided
    let employeeId = userData.employee_id?.trim();
    if (!employeeId) {
      const allUsers = await this.userRepository.findAll();
      const count = allUsers.length + 1;
      employeeId = `EMP${String(count).padStart(3, '0')}`;
      
      let exists = allUsers.some(u => u.employee_id === employeeId);
      let offset = 1;
      while (exists) {
        employeeId = `EMP${String(count + offset).padStart(3, '0')}`;
        exists = allUsers.some(u => u.employee_id === employeeId);
        offset++;
      }
    }

    // VALIDATION: Check if Branch exists
    if (branch_id) {
      const { data: branch } = await supabaseAdmin.from('branches').select('id').eq('id', branch_id).single();
      if (!branch) throw new Error(`Invalid Branch ID: ${branch_id} does not exist.`);
    }

    // VALIDATION: Check if Department exists
    if (department_id) {
      const { data: dept } = await supabaseAdmin.from('departments').select('id').eq('id', department_id).single();
      if (!dept) throw new Error(`Invalid Department ID: ${department_id} does not exist.`);
    }

    // Org-wide roles (CEO, admin, etc.) submit branch_id/department_id as ''
    // when left unset — the DB columns are UUID, which rejects '' outright
    // ("invalid input syntax for type uuid"), so normalize to null.
    const normalizedBranchId = (branch_id || null) as string | undefined;
    const normalizedDepartmentId = (department_id || null) as string | undefined;

    // VALIDATION: Check if Modules exist
    if (allowed_modules && allowed_modules.length > 0) {
      const { data: validModules } = await supabaseAdmin.from('modules').select('id').in('id', allowed_modules);
      if (!validModules || validModules.length !== allowed_modules.length) {
        throw new Error('One or more selected modules are invalid.');
      }
    }

    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: sanitizedEmail,
      password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.toLowerCase().includes('already been registered') || authError.message.toLowerCase().includes('already registered')) {
        throw new Error(`A user with the email "${sanitizedEmail}" already exists.`);
      }
      throw new Error(`Account creation failed: ${authError.message}`);
    }

    const authUser = authData.user;

    try {
      // 2. Create profile in 'profiles' table. Auto-generated employee_ids
      // are computed by reading the current list and picking the next free
      // number — inherently racy if two create requests overlap (e.g. a
      // double-click, or a retry fired while the first attempt was still in
      // flight), since both can compute the same "next" id before either
      // has actually saved it. Retry with a bumped id specifically on that
      // collision instead of failing the whole signup.
      const MAX_EMPLOYEE_ID_ATTEMPTS = 5;
      let profile;
      for (let attempt = 1; ; attempt++) {
        try {
          profile = await this.userRepository.create({
            id: authUser.id,
            email: sanitizedEmail,
            role: role as UserRole,
            full_name: sanitizedName,
            phone_number: userData.phone_number?.trim(),
            branch_id: normalizedBranchId,
            department_id: normalizedDepartmentId,
            allowed_modules,
            status: 'active',
            employee_id: employeeId,
            joining_date: userData.joining_date,
          });
          break;
        } catch (err) {
          const msg = err instanceof Error ? err.message : '';
          const isEmployeeIdCollision = msg.includes('duplicate key') && msg.includes('employee_id');
          if (!isEmployeeIdCollision || attempt >= MAX_EMPLOYEE_ID_ATTEMPTS) {
            if (isEmployeeIdCollision) {
              throw new Error('Could not generate a unique employee ID right now — please try again.');
            }
            throw err;
          }
          const numPart: number = parseInt(employeeId!.replace(/^EMP/, ''), 10) || 0;
          employeeId = `EMP${String(numPart + 1).padStart(3, '0')}`;
        }
      }

      // 3. Send welcome email
      await this.emailService.sendWelcomeEmail(sanitizedEmail, sanitizedName || sanitizedEmail, password);

      return profile;
    } catch (error) {
      // Cleanup: Delete auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      throw error;
    }
  }

  /**
   * Retrieves all users.
   */
  async getAllUsers(): Promise<User[]> {
    return this.userRepository.findAll();
  }

  /**
   * Deletes a user from both Supabase Auth and the profiles table.
   *
   * The /users/:id DELETE route is admin-only (requireAdmin, unlike the
   * requireAdminOrHR-gated create/update/status routes), so a caller here is
   * always already an admin — but the two checks below still guard against a
   * real footgun: an admin deleting their own account, or deleting the last
   * remaining admin, either of which can lock everyone out of user
   * management with no one left able to undo it.
   *
   * @param id User ID to delete.
   * @param requestingUser The authenticated caller performing the deletion.
   */
  async deleteUser(id: string, requestingUser?: any): Promise<void> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for user deletion.');
    }

    if (requestingUser && requestingUser.id === id) {
      throw new Error('You cannot delete your own account.');
    }

    const targetUser = await this.getUserById(id);
    if (targetUser?.role === 'admin') {
      const allUsers = await this.userRepository.findAll();
      const remainingAdmins = allUsers.filter(u => u.role === 'admin' && u.id !== id);
      if (remainingAdmins.length === 0) {
        throw new Error('Cannot delete the last remaining administrator account.');
      }
    }

    // 1. Delete from auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError) {
      throw new Error(`Auth deletion failed: ${authError.message}`);
    }

    // 2. Delete from profiles table
    await this.userRepository.delete(id);
  }

  /**
   * Updates an existing user's profile and optionally their email/role in Auth.
   */
  async updateUser(id: string, userData: Partial<User>, requestingUser?: any): Promise<User> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for user updates.');
    }

    const targetUser = await this.getUserById(id);
    if (!targetUser) {
      throw new Error('User not found.');
    }

    // SECURITY: Prevent non-admin users from modifying leadership-tier
    // profiles (admin/CEO/MD/director/executive) — HR can reach this
    // endpoint too (requireAdminOrHR), and shouldn't be able to edit or
    // (via updateUserStatus) lock out leadership accounts.
    if (LEADERSHIP_ROLES.includes(targetUser.role as string) && (!requestingUser || requestingUser.role !== 'admin')) {
      throw new Error("Access denied. You cannot modify a leadership-tier account's profile.");
    }

    // SECURITY: Prevent non-admin users from elevating roles to admin or demoting roles
    if (userData.role && userData.role !== targetUser.role && (!requestingUser || requestingUser.role !== 'admin')) {
      throw new Error('Access denied. Only administrators can modify user roles.');
    }
    if (userData.role !== undefined && !VALID_ROLES.includes(userData.role)) {
      throw new Error(`Invalid role: ${userData.role}`);
    }

    // 1. If email is being updated, update in Supabase Auth
    if (userData.email) {
      const sanitizedEmail = userData.email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(sanitizedEmail)) {
        throw new Error('Invalid email address format.');
      }
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        email: sanitizedEmail,
        email_confirm: true
      });
      if (authError) throw new Error(`Auth email update failed: ${authError.message}`);
      userData.email = sanitizedEmail;
    }

    // 1b. If a new password was provided (edit form's "New Password
    // (Optional)" field), apply it to Supabase Auth. `password` isn't a
    // profiles-table column, so it never reaches the DB update below either
    // way — this was previously silently ignored entirely, meaning the
    // field in the UI didn't actually do anything.
    const newPassword = (userData as any).password as string | undefined;
    if (newPassword) {
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
      }
      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        password: newPassword
      });
      if (passwordError) throw new Error(`Auth password update failed: ${passwordError.message}`);
    }

    if (userData.full_name) {
      userData.full_name = userData.full_name.trim();
      if (userData.full_name.length > 255) {
        throw new Error('Full name cannot exceed 255 characters.');
      }
    }

    if (userData.phone_number) {
      userData.phone_number = userData.phone_number.trim();
      if (!PHONE_REGEX.test(userData.phone_number)) {
        throw new Error('Phone number must be exactly 10 digits.');
      }
    }

    // VALIDATION: Re-verify Branch/Dept/Modules if they are being changed
    if (userData.branch_id) {
      const { data: branch } = await supabaseAdmin.from('branches').select('id').eq('id', userData.branch_id).single();
      if (!branch) throw new Error('Invalid Branch ID');
    }
    if (userData.department_id) {
      const { data: dept } = await supabaseAdmin.from('departments').select('id').eq('id', userData.department_id).single();
      if (!dept) throw new Error('Invalid Department ID');
    }

    // Org-wide roles submit branch_id/department_id as '' when cleared —
    // the DB columns are UUID, which rejects '' outright, so normalize to null.
    if (userData.branch_id !== undefined) {
      userData.branch_id = (userData.branch_id || null) as string | undefined;
    }
    if (userData.department_id !== undefined) {
      userData.department_id = (userData.department_id || null) as string | undefined;
    }
    if (userData.allowed_modules && userData.allowed_modules.length > 0) {
      const { data: validModules } = await supabaseAdmin.from('modules').select('id').in('id', userData.allowed_modules);
      const validIds = new Set((validModules || []).map((m: any) => m.id));
      // Silently drop any id that no longer exists (e.g. the module was
      // deleted after being assigned) instead of hard-failing the entire
      // profile update — a stale reference the caller never touched
      // shouldn't block an otherwise-valid edit to unrelated fields like
      // branch or role.
      userData.allowed_modules = userData.allowed_modules.filter((id) => validIds.has(id));
    }

    // 2. Update profile in database. req.body was previously passed through
    // to this call unfiltered — a Supabase `.update(obj)` writes every key
    // present as a column, so an unexpected key like `id` or `created_at`
    // would have been written too. Whitelist to only the fields a profile
    // update is actually meant to change.
    const safeUpdate: Partial<User> = {};
    for (const field of UPDATABLE_PROFILE_FIELDS) {
      if (userData[field] !== undefined) {
        (safeUpdate as any)[field] = userData[field];
      }
    }

    return this.userRepository.update(id, safeUpdate);
  }

  /**
   * Blocks or unblocks a user.
   */
  async updateUserStatus(id: string, status: 'active' | 'blocked' | 'resigned', requestingUser?: any): Promise<User> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for status updates.');
    }

    if (!['active', 'blocked', 'resigned'].includes(status)) {
      throw new Error('Invalid status value.');
    }

    const targetUser = await this.getUserById(id);
    if (!targetUser) {
      throw new Error('User not found.');
    }

    // SECURITY: Prevent non-admin users from suspending or resigning
    // leadership-tier accounts (see LEADERSHIP_ROLES above) — this is what
    // stops an HR account from being able to silently lock out the CEO.
    if (LEADERSHIP_ROLES.includes(targetUser.role as string) && (!requestingUser || requestingUser.role !== 'admin')) {
      throw new Error("Access denied. You cannot modify a leadership-tier account's status.");
    }

    // SECURITY: Prevent an account from blocking/resigning itself — an easy
    // way to accidentally (or maliciously) lock yourself out with no one
    // else able to undo it if you were the only admin.
    if (requestingUser && requestingUser.id === id && status !== 'active') {
      throw new Error('You cannot block or resign your own account.');
    }

    // 1. Update status in Supabase Auth (ban/unban)
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      ban_duration: (status === 'blocked' || status === 'resigned') ? '876000h' : '0s'
    });

    if (authError) {
      throw new Error(`Auth status update failed: ${authError.message}`);
    }

    // 2. Update status in profiles table
    return this.userRepository.update(id, { status });
  }

  /**
   * Helper method to retrieve user profiles for auditing/history.
   */
  async getUserById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  /**
   * Calculates dashboard data for the HR view.
   */
  async getHRDashboardData(filter?: { range?: string; startDate?: string; endDate?: string }): Promise<any> {
    const range = filter?.range || '6m';
    const now = new Date();
    
    let startD: Date;
    let endD: Date;

    if (range === 'this_month') {
      startD = new Date(now.getFullYear(), now.getMonth(), 1);
      endD = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (range === '6m') {
      startD = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      endD = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (range === '1y') {
      startD = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      endD = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (range === 'custom' && filter?.startDate && filter?.endDate) {
      startD = new Date(filter.startDate);
      endD = new Date(filter.endDate);
      if (isNaN(startD.getTime())) startD = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      if (isNaN(endD.getTime())) endD = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else {
      startD = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      endD = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    startD.setHours(0, 0, 0, 0);
    endD.setHours(23, 59, 59, 999);

    const users = await this.userRepository.findAll();

    // 1. Total employees at the end of the range
    const activeEmployeesAtEnd = users.filter(u => {
      const joinD = u.joining_date ? new Date(u.joining_date) : new Date(0);
      if (joinD > endD) return false;
      
      if (u.status === 'resigned' && u.resignation_date) {
        const resignD = new Date(u.resignation_date);
        if (resignD <= endD) {
          return false;
        }
      }
      return true;
    });
    const totalEmployeesCount = activeEmployeesAtEnd.length;

    // 2. New joiners within range
    const newJoinersCount = users.filter(u => {
      if (!u.joining_date) return false;
      const joinD = new Date(u.joining_date);
      return joinD >= startD && joinD <= endD;
    }).length;

    // 3. Resignations within range
    const resignationsCount = users.filter(u => {
      if (u.status !== 'resigned' || !u.resignation_date) return false;
      const resignD = new Date(u.resignation_date);
      return resignD >= startD && resignD <= endD;
    }).length;

    // 4. Branch breakdown — users with no branch assigned (e.g. org-wide
    // roles like admin/CEO) are excluded rather than lumped into an
    // "Unassigned" bucket, which isn't meaningful on a per-branch chart.
    const branchBreakdown: Record<string, number> = {};
    activeEmployeesAtEnd.forEach(u => {
      if (!u.branch_name) return;
      branchBreakdown[u.branch_name] = (branchBreakdown[u.branch_name] || 0) + 1;
    });

    // 5. Department breakdown — same exclusion for no department assigned.
    const deptBreakdown: Record<string, number> = {};
    activeEmployeesAtEnd.forEach(u => {
      if (!u.department_name) return;
      deptBreakdown[u.department_name] = (deptBreakdown[u.department_name] || 0) + 1;
    });

    // 6. Growth Chart
    const growthData: { month: string; count: number }[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const diffTime = Math.abs(endD.getTime() - startD.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 31) {
      const startYear = startD.getFullYear();
      const startMonth = startD.getMonth();
      const lastDay = new Date(startYear, startMonth + 1, 0).getDate();
      
      const intervals = [
        { label: 'Week 1', date: new Date(startYear, startMonth, 7) },
        { label: 'Week 2', date: new Date(startYear, startMonth, 14) },
        { label: 'Week 3', date: new Date(startYear, startMonth, 21) },
        { label: 'Week 4', date: new Date(startYear, startMonth, lastDay) }
      ];

      intervals.forEach(interval => {
        interval.date.setHours(23, 59, 59, 999);
        const countAtPoint = users.filter(u => {
          const joinD = u.joining_date ? new Date(u.joining_date) : new Date(0);
          if (joinD > interval.date) return false;
          
          if (u.status === 'resigned' && u.resignation_date) {
            const resignD = new Date(u.resignation_date);
            if (resignD <= interval.date) {
              return false;
            }
          }
          return true;
        }).length;

        growthData.push({
          month: interval.label,
          count: countAtPoint
        });
      });
    } else {
      const current = new Date(startD.getFullYear(), startD.getMonth(), 1);
      while (current <= endD) {
        const targetYear = current.getFullYear();
        const targetMonth = current.getMonth();
        const monthLabel = `${monthNames[targetMonth]} ${targetYear}`;
        
        const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0);
        lastDayOfTargetMonth.setHours(23, 59, 59, 999);

        const countAtPoint = users.filter(u => {
          const joinD = u.joining_date ? new Date(u.joining_date) : new Date(0);
          if (joinD > lastDayOfTargetMonth) return false;
          
          if (u.status === 'resigned' && u.resignation_date) {
            const resignD = new Date(u.resignation_date);
            if (resignD <= lastDayOfTargetMonth) {
              return false;
            }
          }
          return true;
        }).length;

        growthData.push({
          month: monthLabel,
          count: countAtPoint
        });

        current.setMonth(current.getMonth() + 1);
      }
    }

    return {
      kpis: {
        totalEmployees: totalEmployeesCount,
        newJoiners: newJoinersCount,
        resignations: resignationsCount,
      },
      charts: {
        branchDistribution: Object.entries(branchBreakdown).map(([name, value]) => ({ name, value })),
        departmentDistribution: Object.entries(deptBreakdown).map(([name, value]) => ({ name, value })),
        growth: growthData,
      }
    };
  }
}
