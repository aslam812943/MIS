import type { Branch, Department, Module, User } from '../services/org.service';

export interface AuditLookups {
  users: Map<string, string>;
  branches: Map<string, string>;
  departments: Map<string, string>;
  modules: Map<string, string>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function buildAuditLookups(
  users: User[],
  branches: Branch[],
  departments: Department[],
  modules: Module[]
): AuditLookups {
  return {
    users: new Map(users.map((u) => [u.id, u.full_name?.trim() || u.email])),
    branches: new Map(branches.map((b) => [b.id, b.name])),
    departments: new Map(departments.map((d) => [d.id, d.name])),
    modules: new Map(modules.map((m) => [m.id, m.name])),
  };
}

export const EMPTY_AUDIT_LOOKUPS: AuditLookups = {
  users: new Map(),
  branches: new Map(),
  departments: new Map(),
  modules: new Map(),
};

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Human-readable field labels */
export function formatFieldLabel(key: string): string {
  const labels: Record<string, string> = {
    user_id: 'User',
    branch_id: 'Branch',
    department_id: 'Department',
    module_id: 'Module',
    verified_by: 'Verified by',
    verified_at: 'Verified at',
    entry_date: 'Entry date',
    status: 'Status',
    data: 'Metrics',
    full_name: 'Full name',
    email: 'Email',
    role: 'Role',
    name: 'Name',
    allowed_modules: 'Module access',
    password: 'Password',
    phone_number: 'Phone',
    avatar_url: 'Avatar',
  };
  return labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveByFieldKey(key: string, id: string, lookups: AuditLookups): string | undefined {
  switch (key) {
    case 'user_id':
    case 'verified_by':
      return lookups.users.get(id);
    case 'branch_id':
      return lookups.branches.get(id);
    case 'department_id':
      return lookups.departments.get(id);
    case 'module_id':
      return lookups.modules.get(id);
    default:
      return undefined;
  }
}

function resolveAnyId(id: string, lookups: AuditLookups): string | undefined {
  return (
    lookups.users.get(id) ||
    lookups.branches.get(id) ||
    lookups.departments.get(id) ||
    lookups.modules.get(id)
  );
}

/** Resolve a single field value to a display string */
export function resolveDisplayString(
  key: string,
  val: unknown,
  lookups: AuditLookups
): string {
  if (val === null || val === undefined) return '—';

  if (Array.isArray(val)) {
    if (key === 'allowed_modules') {
      const names = val
        .map((id) => lookups.modules.get(String(id)) || String(id))
        .filter(Boolean);
      return names.length ? names.join(', ') : '—';
    }
    return val.map((v) => resolveDisplayString(key, v, lookups)).join(', ');
  }

  if (typeof val === 'object') {
    return formatDataObject(val as Record<string, unknown>, lookups);
  }

  const text = String(val);

  if (key === 'verified_at' || key === 'entry_date' || key.endsWith('_at') || key.endsWith('_date')) {
    const d = new Date(text);
    if (!Number.isNaN(d.getTime())) {
      if (text.includes('T')) {
        return d.toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }
  }

  if (key.endsWith('_id') || key === 'verified_by') {
    const byKey = resolveByFieldKey(key, text, lookups);
    if (byKey) return byKey;
    if (isUuid(text)) {
      const any = resolveAnyId(text, lookups);
      if (any) return any;
    }
  }

  if (isUuid(text)) {
    const any = resolveAnyId(text, lookups);
    if (any) return any;
  }

  if (key === 'role' && typeof val === 'string') {
    return val.replace(/_/g, ' ');
  }

  return text;
}

/** Format nested metrics / data object with readable values */
export function formatDataObject(
  data: Record<string, unknown>,
  lookups: AuditLookups
): string {
  const lines = Object.entries(data).map(([k, v]) => {
    const label = formatFieldLabel(k);
    const display =
      typeof v === 'object' && v !== null
        ? JSON.stringify(v)
        : resolveDisplayString(k, v, lookups);
    return `${label}: ${display}`;
  });
  return lines.join('\n');
}

export function resolveRecordLabel(
  tableName: string,
  recordId: string,
  lookups: AuditLookups
): string {
  switch (tableName) {
    case 'branches':
      return lookups.branches.get(recordId) || recordId;
    case 'departments':
      return lookups.departments.get(recordId) || recordId;
    case 'modules':
      return lookups.modules.get(recordId) || recordId;
    case 'profiles':
      return lookups.users.get(recordId) || recordId;
    case 'data_entries':
      return 'Data entry';
    default:
      return recordId;
  }
}

export function isStatusValue(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  return ['verified', 'pending', 'blocked', 'active'].includes(val);
}
