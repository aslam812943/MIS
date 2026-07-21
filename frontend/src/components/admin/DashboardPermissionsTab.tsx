import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { dashboardPermissionService, type Position } from '../../services/dashboardPermission.service';
import { DASHBOARD_WIDGETS, type DashboardWidget } from '../../config/dashboardWidgets';

const ROLE_LABELS: Record<string, string> = {
  hod: 'HOD',
  regional_manager: 'Regional Manager',
  employee: 'Employee',
  hr: 'HR',
  ceo: 'CEO',
  managing_director: 'Managing Director',
  director: 'Director',
  executive: 'Executive',
};

// These roles aren't tied to one department (their profile's department_id
// is always null, same as 'hr') — they can browse every department's
// dashboard today, so their checklist spans every department's widgets at
// once instead of drilling into a single one.
const ALL_DEPARTMENTS_ROLES = ['ceo', 'managing_director', 'director', 'executive'];

// A plain employee's dashboard starts with nothing visible until admin opts
// specific widgets in; every other role starts fully visible until admin
// restricts something. Mirrors DashboardPermissionService's defaultVisibleFor.
const defaultVisibleForRole = (role: string): boolean => role !== 'employee';

const roleLabel = (p: Position): string => ROLE_LABELS[p.role] || p.role;

const positionLabel = (p: Position): string =>
  p.department_name ? `${p.department_name} — ${roleLabel(p)}` : roleLabel(p);

/** Department-scoped positions (hod/employee/regional_manager) drill down
 * one department at a time; org-wide positions (hr, ceo/md/director/executive)
 * are shown as flat top-level entries since there's nothing to drill into. */
const splitPositions = (positions: Position[]): { departmentGroups: Map<string, Position[]>; orgWide: Position[] } => {
  const departmentGroups = new Map<string, Position[]>();
  const orgWide: Position[] = [];
  for (const p of positions) {
    if (p.department_id === null) {
      orgWide.push(p);
    } else {
      const list = departmentGroups.get(p.department_name || 'Unknown') || [];
      list.push(p);
      departmentGroups.set(p.department_name || 'Unknown', list);
    }
  }
  return { departmentGroups, orgWide };
};

interface WidgetGroup {
  label: string;
  widgets: DashboardWidget[];
}

/** Which widget catalog(s) apply to a position's checklist. Org-wide roles
 * get every department's catalog at once (excluding HR, which those roles
 * don't have dashboard access to); 'hr' gets just the HR catalog; everyone
 * else gets just their own department's catalog. */
const catalogGroupsFor = (p: Position): WidgetGroup[] => {
  if (ALL_DEPARTMENTS_ROLES.includes(p.role)) {
    return Object.entries(DASHBOARD_WIDGETS)
      .filter(([dept]) => dept !== 'HR')
      .map(([dept, widgets]) => ({ label: dept, widgets }));
  }
  if (p.role === 'hr') {
    return [{ label: 'HR', widgets: DASHBOARD_WIDGETS.HR }];
  }
  if (p.department_name && DASHBOARD_WIDGETS[p.department_name]) {
    return [{ label: p.department_name, widgets: DASHBOARD_WIDGETS[p.department_name] }];
  }
  return [];
};

const DashboardPermissionsTab: React.FC = () => {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Position | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<{ [widgetKey: string]: boolean }>({});
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dashboardPermissionService
      .getPositions()
      .then(setPositions)
      .catch(() => toast.error('Failed to load positions.'))
      .finally(() => setLoading(false));
  }, []);

  const selectPosition = async (position: Position) => {
    setSelected(position);
    setChecklistLoading(true);
    try {
      const overrides = await dashboardPermissionService.getPositionPermissions(position.role, position.department_id);
      const roleDefault = defaultVisibleForRole(position.role);
      const groups = catalogGroupsFor(position);
      const next: { [widgetKey: string]: boolean } = {};
      for (const group of groups) {
        for (const widget of group.widgets) {
          next[widget.key] = overrides[widget.key] !== undefined ? overrides[widget.key] : roleDefault;
        }
      }
      setChecklist(next);
    } catch {
      toast.error('Failed to load this position\'s dashboard permissions.');
    } finally {
      setChecklistLoading(false);
    }
  };

  const toggleWidget = (widgetKey: string) => {
    setChecklist(prev => ({ ...prev, [widgetKey]: !prev[widgetKey] }));
  };

  const toggleAll = (visible: boolean) => {
    setChecklist(prev => {
      const next: { [widgetKey: string]: boolean } = {};
      for (const key of Object.keys(prev)) next[key] = visible;
      return next;
    });
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await dashboardPermissionService.savePositionPermissions(selected.role, selected.department_id, checklist);
      toast.success(`Dashboard permissions saved for ${positionLabel(selected)}.`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save permissions.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6" style={{ color: 'var(--text-secondary)' }}>Loading positions...</div>;
  }

  const { departmentGroups, orgWide } = splitPositions(positions);
  const groups = selected ? catalogGroupsFor(selected) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="mis-card p-4 lg:col-span-1">
        <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Positions</h3>
        <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
          Every role currently held by at least one user. HOD, management, and other roles see every widget until admin restricts one;
          <strong> Employee starts with nothing visible</strong> until admin turns specific widgets on.
        </p>
        <div className="space-y-1 max-h-[32rem] overflow-y-auto">
          {positions.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>No configurable positions found.</p>
          )}

          {Array.from(departmentGroups.entries()).map(([groupName, groupPositions]) => {
            const isExpanded = expandedGroup === groupName;
            const totalUsers = groupPositions.reduce((sum, p) => sum + p.user_count, 0);
            return (
              <div key={groupName}>
                <button
                  onClick={() => setExpandedGroup(isExpanded ? null : groupName)}
                  className="w-full flex items-center justify-between text-left px-3 py-2 rounded text-sm font-semibold"
                  style={{ color: 'var(--text-primary)', background: 'var(--bg-secondary, transparent)' }}
                >
                  <span>{groupName}</span>
                  <span className="text-xs opacity-70 flex items-center gap-2">
                    {totalUsers} user{totalUsers === 1 ? '' : 's'}
                    <span style={{ display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▸</span>
                  </span>
                </button>

                {isExpanded && (
                  <div className="pl-3 space-y-1 mb-1">
                    {groupPositions.map(p => {
                      const key = `${p.role}::${p.department_id ?? 'none'}`;
                      const isActive = selected && selected.role === p.role && selected.department_id === p.department_id;
                      return (
                        <button
                          key={key}
                          onClick={() => selectPosition(p)}
                          className="w-full text-left px-3 py-2 rounded text-sm transition-colors"
                          style={{
                            backgroundColor: isActive ? 'var(--accent)' : 'transparent',
                            color: isActive ? '#fff' : 'var(--text-primary)',
                          }}
                        >
                          {roleLabel(p)}
                          <span className="block text-xs opacity-70">{p.user_count} user{p.user_count === 1 ? '' : 's'}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {orgWide.length > 0 && (
            <>
              <div className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                Organization-wide roles
              </div>
              {orgWide.map(p => {
                const key = `${p.role}::none`;
                const isActive = selected && selected.role === p.role && selected.department_id === null;
                const isAllDepts = ALL_DEPARTMENTS_ROLES.includes(p.role);
                return (
                  <button
                    key={key}
                    onClick={() => selectPosition(p)}
                    className="w-full text-left px-3 py-2 rounded text-sm transition-colors"
                    style={{
                      backgroundColor: isActive ? 'var(--accent)' : 'transparent',
                      color: isActive ? '#fff' : 'var(--text-primary)',
                    }}
                  >
                    {roleLabel(p)}
                    <span className="block text-xs opacity-70">
                      {p.user_count} user{p.user_count === 1 ? '' : 's'}{isAllDepts ? ' · all departments' : ''}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      <div className="mis-card p-6 lg:col-span-2">
        {!selected && (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Select a position on the left to view and edit which dashboard widgets it can see.
          </p>
        )}

        {selected && checklistLoading && (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading checklist...</p>
        )}

        {selected && !checklistLoading && groups.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No dashboard widget catalog is defined for this position yet.
          </p>
        )}

        {selected && !checklistLoading && groups.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                {positionLabel(selected)} — Dashboard Widgets
              </h3>
              <div className="space-x-2">
                <button onClick={() => toggleAll(true)} className="mis-btn mis-btn-ghost mis-btn-sm">Select All</button>
                <button onClick={() => toggleAll(false)} className="mis-btn mis-btn-ghost mis-btn-sm">Deselect All</button>
              </div>
            </div>

            <div className="max-h-[36rem] overflow-y-auto pr-1">
              {groups.map(group => {
                const kpis = group.widgets.filter(w => w.type === 'kpi');
                const charts = group.widgets.filter(w => w.type === 'chart');
                return (
                  <div key={group.label} className="mb-6">
                    {groups.length > 1 && (
                      <h4 className="text-sm font-bold mb-2 pb-1 border-b" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
                        {group.label}
                      </h4>
                    )}

                    {kpis.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary)' }}>KPI Cards</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {kpis.map(w => (
                            <label key={w.key} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                              <input type="checkbox" checked={!!checklist[w.key]} onChange={() => toggleWidget(w.key)} />
                              {w.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {charts.length > 0 && (
                      <div className="mb-2">
                        <h5 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary)' }}>Charts</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {charts.map(w => (
                            <label key={w.key} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                              <input type="checkbox" checked={!!checklist[w.key]} onChange={() => toggleWidget(w.key)} />
                              {w.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button onClick={handleSave} disabled={saving} className="mis-btn mis-btn-primary mt-2">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardPermissionsTab;
