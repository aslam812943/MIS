import { supabaseAdmin } from '../config/supabase.js';

// Only 'admin' fully bypasses this system — always sees every widget on
// every dashboard, and is excluded from the configurable positions list
// (admin is the one doing the configuring). Every other role, including the
// org-wide roles (ceo/managing_director/director/executive) and hr, is now
// configurable: org-wide roles have `department_id: null` on their profile
// already (see AdminPanelPage's DEPARTMENT_OPTIONAL_ROLES), which the
// `.is('department_id', null)` branches below already handle correctly —
// no special-casing needed beyond removing them from this bypass list.
const ALWAYS_BYPASS_ROLES = ['admin'];

// Every role defaults to "visible unless admin explicitly hides it" (opt-out)
// EXCEPT 'employee', which defaults to "hidden unless admin explicitly shows
// it" (opt-in) — a plain employee's dashboard starts empty and admin turns
// on only the specific widgets they should see, whereas HOD/management
// positions keep the original safe-rollout default of seeing everything
// until admin actively restricts something.
const defaultVisibleFor = (role: string): boolean => role !== 'employee';

export interface Position {
  role: string;
  department_id: string | null;
  department_name: string | null;
  user_count: number;
}

export class DashboardPermissionService {
  /**
   * Resolves the CALLING user's own role/department fresh from the database
   * (never trusts a client-supplied role/department) and returns the
   * explicit per-widget overrides for their position plus which default
   * applies to anything NOT explicitly overridden. `defaultVisible: true`
   * with an empty `overrides` map (returned for 'admin') means "show
   * everything".
   */
  async getMyHiddenWidgets(userId: string): Promise<{ defaultVisible: boolean; overrides: { [widgetKey: string]: boolean } }> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client not configured.');

    const { data: profile, error } = await client
      .from('profiles')
      .select('role, department_id')
      .eq('id', userId)
      .single();

    if (error || !profile) throw new Error('Profile not found.');

    if (ALWAYS_BYPASS_ROLES.includes(profile.role)) {
      return { defaultVisible: true, overrides: {} };
    }

    let query = client.from('dashboard_widget_permissions').select('widget_key, visible').eq('role', profile.role);
    query = profile.department_id ? query.eq('department_id', profile.department_id) : query.is('department_id', null);

    const { data: rows, error: permError } = await query;
    if (permError) throw new Error(`Failed to load dashboard permissions: ${permError.message}`);

    const overrides: { [widgetKey: string]: boolean } = {};
    for (const row of rows || []) {
      overrides[row.widget_key] = row.visible;
    }

    return { defaultVisible: defaultVisibleFor(profile.role), overrides };
  }

  /**
   * Admin-only: every real (role, department) combination currently held by
   * at least one non-admin user, so admin only ever configures positions
   * that actually exist. Org-wide roles (ceo/md/director/executive) and hr
   * naturally come back with `department_id: null`.
   */
  async getPositions(): Promise<Position[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client not configured.');

    const { data: profiles, error } = await client
      .from('profiles')
      .select('role, department_id, departments(name)')
      .not('role', 'in', `(${ALWAYS_BYPASS_ROLES.join(',')})`);

    if (error) throw new Error(`Failed to load positions: ${error.message}`);

    const grouped = new Map<string, Position>();
    for (const p of profiles || []) {
      const departmentId = (p as any).department_id ?? null;
      const departmentName = (p as any).departments?.name ?? null;
      const key = `${p.role}::${departmentId ?? 'none'}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.user_count += 1;
      } else {
        grouped.set(key, {
          role: p.role,
          department_id: departmentId,
          department_name: departmentName,
          user_count: 1,
        });
      }
    }

    return Array.from(grouped.values()).sort((a, b) => {
      const deptCompare = (a.department_name || '').localeCompare(b.department_name || '');
      return deptCompare !== 0 ? deptCompare : a.role.localeCompare(b.role);
    });
  }

  /**
   * Admin-only: current explicit overrides for one position. Widgets with no
   * stored row fall back to that role's default (visible for everyone
   * except 'employee') — the caller applies that default, this only returns
   * what's explicitly been set.
   */
  async getPositionPermissions(role: string, departmentId: string | null): Promise<{ [widgetKey: string]: boolean }> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client not configured.');

    let query = client.from('dashboard_widget_permissions').select('widget_key, visible').eq('role', role);
    query = departmentId ? query.eq('department_id', departmentId) : query.is('department_id', null);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load permissions: ${error.message}`);

    const result: { [widgetKey: string]: boolean } = {};
    for (const row of data || []) {
      result[row.widget_key] = row.visible;
    }
    return result;
  }

  /**
   * Admin-only: saves the full checklist for one position in one call. A
   * widget being set back to its role's default (visible for most roles,
   * hidden for 'employee') is deleted rather than stored, so the table only
   * ever holds actual overrides and the default behavior stays obvious from
   * an empty table.
   */
  async savePositionPermissions(
    adminUserId: string,
    role: string,
    departmentId: string | null,
    updates: { [widgetKey: string]: boolean }
  ): Promise<void> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client not configured.');

    if (ALWAYS_BYPASS_ROLES.includes(role)) {
      throw new Error('Invalid role: this role always sees every widget and cannot be restricted.');
    }

    const widgetKeys = Object.keys(updates);
    if (widgetKeys.length === 0) return;
    if (widgetKeys.length > 300) throw new Error('Too many widgets in a single request.');

    const roleDefault = defaultVisibleFor(role);
    const toStore = widgetKeys.filter((k) => updates[k] !== roleDefault);

    // Delete-then-insert rather than upsert-on-conflict: Postgres UNIQUE
    // constraints treat two NULL department_id values as distinct (never
    // conflicting), so ON CONFLICT would silently fail to match existing
    // rows for org-wide roles (ceo/md/director/executive) and hr — all of
    // which always have department_id NULL — and insert duplicates instead
    // of updating. An explicit filtered delete has no such NULL ambiguity.
    let deleteQuery = client
      .from('dashboard_widget_permissions')
      .delete()
      .eq('role', role)
      .in('widget_key', widgetKeys);
    deleteQuery = departmentId ? deleteQuery.eq('department_id', departmentId) : deleteQuery.is('department_id', null);
    const { error: deleteError } = await deleteQuery;
    if (deleteError) throw new Error(`Failed to update permissions: ${deleteError.message}`);

    if (toStore.length > 0) {
      const rows = toStore.map((widget_key) => ({
        role,
        department_id: departmentId,
        widget_key,
        visible: updates[widget_key],
        updated_by: adminUserId,
        updated_at: new Date().toISOString(),
      }));
      const { error: insertError } = await client.from('dashboard_widget_permissions').insert(rows);
      if (insertError) throw new Error(`Failed to update permissions: ${insertError.message}`);
    }
  }
}
