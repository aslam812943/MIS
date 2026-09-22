import { supabase, supabaseAdmin } from '../config/supabase.js';
import type { IAuthService, AuthResponse } from './interfaces/IAuthService.js';
import type { IUserRepository } from '../repositories/interfaces/IUserRepository.js';
import { EmailService } from './EmailService.js';
import { UserRole } from '../models/user.model.js';

/**
 * Service to handle authentication and password reset business logic.
 */
export class AuthService implements IAuthService {
  private async matchesLoginRole(profile: { id: string; role: string }, selectedRole: string): Promise<boolean> {
    if (profile.role === selectedRole) return true;
    if (selectedRole === 'dealer_calculation' && profile.role === 'dealer_calculation') return true;
    if (['hod', 'employee'].includes(selectedRole) && ['franchise_owner', 'franchise_staff'].includes(profile.role)) return true;
    if (selectedRole !== 'franchise_staff' || profile.role !== 'franchise_owner' || !supabaseAdmin) return false;
    const { data, error } = await supabaseAdmin.from('franchise_users').select('shared_access,status').eq('user_id', profile.id).maybeSingle();
    return !error && data?.shared_access === true && data.status === 'active';
  }

  private async resolveLoginIdentity(email: string, role: string): Promise<{ email: string; role: string }> {
    const membership = ['hod', 'franchise_owner'].includes(role) ? 'owner' : ['employee', 'franchise_staff'].includes(role) ? 'staff' : null;
    if (!membership || !supabaseAdmin) return { email, role };
    const { data, error } = await supabaseAdmin.from('franchise_users').select('user_id,status')
      .eq('login_email', email.trim().toLowerCase()).eq('membership_role', membership);
    if (error) throw new Error('Could not verify franchise login. Apply the updated franchise migration.');
    if (!data?.length) return { email, role };
    const active = data.filter((member) => member.status === 'active');
    const users = [...new Set(active.map((member) => member.user_id))];
    if (users.length !== 1) throw new Error('Access denied: franchise login is disabled or has conflicting role mappings.');
    const profile = await this.userRepository.findById(users[0]!);
    const effectiveRole = membership === 'owner' ? 'franchise_owner' : 'franchise_staff';
    if (!profile || profile.role !== effectiveRole) throw new Error('Invalid login credentials');
    return { email: profile.email, role: effectiveRole };
  }

  private async resolveLoginEmail(email: string, role: string): Promise<string> {
    return (await this.resolveLoginIdentity(email, role)).email;
  }

  constructor(
    private userRepository: IUserRepository,
    private emailService: EmailService
  ) {}

  /**
   * Authenticates a user with email/username, password, and selected role.
   */
  async login(email: string, password: string, role: string): Promise<AuthResponse> {
    // ── Dedicated Dealer Calculation Login Flow ──
    if (role === 'dealer_calculation') {
      const username = email.trim().toLowerCase();
      const { DealerCalculationService } = await import('./DealerCalculationService.js');
      const dealerService = new DealerCalculationService();
      const dealerUser = await dealerService.authenticateUser(username, password);
      if (!dealerUser) {
        throw new Error('Invalid login credentials');
      }

      // Ensure profile exists in Supabase profiles for live status verification in requireAuth
      let profileUser: any = null;
      if (supabaseAdmin) {
        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .or(`login_username.eq.${username},email.eq.${username}@dealerterminal.invalid`)
          .maybeSingle();

        if (existingProfile) {
          if (existingProfile.status === 'blocked') {
            throw new Error('Access denied: Your account has been suspended. Please contact the administrator.');
          }
          profileUser = existingProfile;
        } else {
          const fakeEmail = `${username}@dealerterminal.invalid`;
          const { data: newAuthUser } = await supabaseAdmin.auth.admin.createUser({
            email: fakeEmail,
            password: 'DealerTerminalAutoAuthSecretPass@2026!',
            email_confirm: true,
            user_metadata: { full_name: dealerUser.username, login_username: username, role: 'dealer_calculation' },
          });

          const userId = newAuthUser?.user?.id || dealerUser.id;
          const { data: newProfile } = await supabaseAdmin
            .from('profiles')
            .upsert({
              id: userId,
              email: fakeEmail,
              login_username: username,
              role: 'dealer_calculation',
              full_name: dealerUser.username,
              status: 'active',
            })
            .select()
            .single();

          profileUser = newProfile || {
            id: userId,
            email: fakeEmail,
            login_username: username,
            role: 'dealer_calculation',
            full_name: dealerUser.username,
            status: 'active',
          };
        }
      }

      return {
        user: {
          id: profileUser?.id || dealerUser.id,
          email: username,
          login_username: username,
          role: UserRole.DEALER_CALCULATION,
          full_name: dealerUser.username,
          dealer_role: dealerUser.role,
        } as any,
        session: { access_token: 'dealer_terminal_session_' + Date.now() },
      };
    }

    const identity = await this.resolveLoginIdentity(email, role);
    role = identity.role;
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: identity.email,
      password,
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message || 'Invalid login credentials');
    }

    const userProfile = await this.userRepository.findById(authData.user.id);

    if (!userProfile) {
      throw new Error('User profile not found in MIS database');
    }

    // Security: Prevent login if account is blocked
    if (userProfile.status === 'blocked') {
      await supabase.auth.signOut();
      throw new Error('Access denied: Your account has been suspended. Please contact the administrator.');
    }

    // Role-Based Access Control: Validate selected role against database role
    if (!await this.matchesLoginRole(userProfile, role)) {
      await supabase.auth.signOut();
      throw new Error('Access denied: Invalid role selection for this account');
    }

    if (['franchise_owner', 'franchise_staff'].includes(userProfile.role)) {
      const { FranchiseService } = await import('./FranchiseService.js');
      try {
        await new FranchiseService().access(userProfile.id, role);
      } catch {
        await supabase.auth.signOut();
        throw new Error('Access denied: Your franchise or login membership is inactive. Contact the administrator.');
      }
    }

    let publicEmail = userProfile.email;
    if (['franchise_owner', 'franchise_staff'].includes(userProfile.role) && supabaseAdmin) {
      const { data, error } = await supabaseAdmin.from('franchise_users').select('login_email').eq('user_id', userProfile.id).limit(1).maybeSingle();
      if (error) throw new Error('Could not load franchise login');
      publicEmail = data?.login_email || publicEmail;
    }

    return {
      user: role === 'franchise_staff' ? { ...userProfile, email: publicEmail, role: UserRole.FRANCHISE_STAFF } : { ...userProfile, email: publicEmail },
      session: authData.session as unknown as Record<string, unknown>,
    };
  }

  /**
   * Requests a password reset OTP.
   */
  async requestPasswordReset(email: string, role: string): Promise<void> {
    const user = await this.userRepository.findByEmail(await this.resolveLoginEmail(email, role));

    if (!user) {
      throw new Error('If an account exists with this email and role, you will receive an OTP.');
    }

    if (!await this.matchesLoginRole(user, role)) {
      throw new Error('If an account exists with this email and role, you will receive an OTP.');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    if (!supabaseAdmin) {
      throw new Error('Auth admin service is not configured');
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        reset_otp: otp,
        reset_otp_expires: expiresAt,
        otp_attempts: 0,
      },
    });

    if (updateError) {
      throw new Error('Failed to generate reset code. Please try again.');
    }

    await this.emailService.sendPasswordResetOTP(user.email, user.full_name || 'User', otp);
  }

  /**
   * Resets the password using the OTP.
   */
  async resetPassword(email: string, otp: string, newPassword: string, role: string): Promise<void> {
    const user = await this.userRepository.findByEmail(await this.resolveLoginEmail(email, role));

    if (!user || !await this.matchesLoginRole(user, role)) {
      throw new Error('Invalid reset request');
    }

    if (!supabaseAdmin) {
      throw new Error('Auth admin service is not configured');
    }

    const { data: authUser, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(user.id);

    if (fetchError || !authUser.user) {
      throw new Error('User not found');
    }

    const metadata = authUser.user.user_metadata;
    const storedOtp = metadata?.reset_otp;
    const expiresAt = metadata?.reset_otp_expires;
    const attempts = metadata?.otp_attempts || 0;

    if (attempts >= 3) {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          reset_otp: null,
          reset_otp_expires: null,
          otp_attempts: 0,
        },
      });
      throw new Error('Too many failed attempts. Please request a new code.');
    }

    if (!storedOtp || storedOtp !== otp) {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...metadata,
          otp_attempts: attempts + 1,
        },
      });
      throw new Error(`Invalid OTP code. ${2 - attempts} attempts remaining.`);
    }

    if (!expiresAt || new Date() > new Date(expiresAt)) {
      throw new Error('OTP has expired');
    }

    await supabaseAdmin.auth.admin.signOut(user.id);

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword,
      user_metadata: {
        reset_otp: null,
        reset_otp_expires: null,
        otp_attempts: 0,
      },
    });

    if (updateError) {
      throw new Error(updateError.message);
    }
  }
}
