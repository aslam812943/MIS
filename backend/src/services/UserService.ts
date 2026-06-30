import { supabaseAdmin } from '../config/supabase.js';
import type { IUserRepository } from '../repositories/interfaces/IUserRepository.js';
import type { EmailService } from './EmailService.js';
import { type User, UserRole } from '../models/user.model.js';

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

    // SECURITY: Prevent non-admin users from creating Admin accounts
    if (userData.role === 'admin' && (!requestingUser || requestingUser.role !== 'admin')) {
      throw new Error('Access denied. Only administrators can create administrator accounts.');
    }

    const { email, role, full_name, branch_id, department_id, allowed_modules, password } = userData;

    if (!email || !role || !password) {
      throw new Error('Email, role, and password are required.');
    }

    // SANITIZATION: Trim whitespace
    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedName = full_name?.trim();

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
      throw new Error(`Auth creation failed: ${authError.message}`);
    }

    const authUser = authData.user;

    try {
      // 2. Create profile in 'profiles' table
      const profile = await this.userRepository.create({
        id: authUser.id,
        email: sanitizedEmail,
        role: role as UserRole,
        full_name: sanitizedName,
        phone_number: userData.phone_number,
        branch_id,
        department_id,
        allowed_modules,
        status: 'active',
        employee_id: employeeId,
        joining_date: userData.joining_date,
      });

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
   * @param id User ID to delete.
   */
  async deleteUser(id: string): Promise<void> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for user deletion.');
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

    // SECURITY: Prevent non-admin users from modifying Admin profiles
    if (targetUser.role === 'admin' && (!requestingUser || requestingUser.role !== 'admin')) {
      throw new Error("Access denied. You cannot modify an administrator's profile.");
    }

    // SECURITY: Prevent non-admin users from elevating roles to admin or demoting roles
    if (userData.role && userData.role !== targetUser.role && (!requestingUser || requestingUser.role !== 'admin')) {
      throw new Error('Access denied. Only administrators can modify user roles.');
    }

    // 1. If email is being updated, update in Supabase Auth
    if (userData.email) {
      const sanitizedEmail = userData.email.trim().toLowerCase();
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        email: sanitizedEmail,
        email_confirm: true
      });
      if (authError) throw new Error(`Auth email update failed: ${authError.message}`);
      userData.email = sanitizedEmail;
    }

    if (userData.full_name) {
      userData.full_name = userData.full_name.trim();
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
    if (userData.allowed_modules && userData.allowed_modules.length > 0) {
      const { data: validModules } = await supabaseAdmin.from('modules').select('id').in('id', userData.allowed_modules);
      if (!validModules || validModules.length !== userData.allowed_modules.length) {
        throw new Error('One or more selected modules are invalid.');
      }
    }

    // 2. Update profile in database
    return this.userRepository.update(id, userData);
  }

  /**
   * Blocks or unblocks a user.
   */
  async updateUserStatus(id: string, status: 'active' | 'blocked' | 'resigned', requestingUser?: any): Promise<User> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for status updates.');
    }

    const targetUser = await this.getUserById(id);
    if (!targetUser) {
      throw new Error('User not found.');
    }

    // SECURITY: Prevent non-admin users from suspending or resigning admins
    if (targetUser.role === 'admin' && (!requestingUser || requestingUser.role !== 'admin')) {
      throw new Error("Access denied. You cannot modify an administrator's status.");
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

    // 4. Branch breakdown
    const branchBreakdown: Record<string, number> = {};
    activeEmployeesAtEnd.forEach(u => {
      const bName = u.branch_name || 'Unassigned';
      branchBreakdown[bName] = (branchBreakdown[bName] || 0) + 1;
    });

    // 5. Department breakdown
    const deptBreakdown: Record<string, number> = {};
    activeEmployeesAtEnd.forEach(u => {
      const dName = u.department_name || 'Unassigned';
      deptBreakdown[dName] = (deptBreakdown[dName] || 0) + 1;
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
