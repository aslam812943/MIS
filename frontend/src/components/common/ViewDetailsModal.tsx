import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { orgService } from '../../services/org.service';
import { itService } from '../../services/it.service';
import { authService } from '../../services/auth.service';

interface ViewDetailsModalProps {
  record: Record<string, any> | null;
  onClose: () => void;
  title?: string;
  /** Field keys to hide (e.g. internal join objects already shown elsewhere). */
  excludeKeys?: string[];
}

// Global module-level caches so lookups persist across modal opens
let globalBranchesCache: Map<string, string> | null = null;
let globalUsersCache: Map<string, string> | null = null;

const humanizeKey = (key: string): string =>
  key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const ID_FIELD_LABELS: Record<string, string> = {
  branch_id: 'Branch',
  branch: 'Branch',
  department_id: 'Department',
  module_id: 'Module',
  vendor_id: 'Vendor',
  audit_id: 'Linked Audit',
  position_id: 'Position',
  linked_asset_id: 'Linked Asset',
  linked_diagram_id: 'Linked Diagram',
  profile_id: 'Staff Member / Profile',
  created_profile_id: 'Created By',
  reporting_to: 'Reporting To',
  user_id: 'User',
  created_by: 'Created By',
  updated_by: 'Updated By',
  verified_by: 'Verified By',
};

// Keys to ignore/hide by default so raw IDs and nested join blobs don't clutter the modal
const DEFAULT_EXCLUDE_KEYS = new Set([
  'id',
  'branches',
  'profiles',
  'creator',
  'updater',
  'verifier',
  'it_vendors',
  'it_audits',
  'it_assets',
  'it_diagrams',
  'departments',
  'kyc_new_account',
  'reporting_to_profile'
]);

const isPlainObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const friendlyObjectText = (obj: Record<string, any>): string => {
  if (obj.name) return String(obj.name);
  if (obj.full_name && obj.email) return `${obj.full_name} (${obj.email})`;
  if (obj.full_name) return String(obj.full_name);
  if (obj.vendor_name) return String(obj.vendor_name);
  if (obj.audit_name) return String(obj.audit_name);
  if (obj.asset_id) return String(obj.asset_id);
  if (obj.diagram_name) return String(obj.diagram_name);
  if (obj.email) return String(obj.email);
  if (obj.title) return String(obj.title);
  const parts = Object.entries(obj).map(([k, v]) => `${humanizeKey(k)}: ${v}`);
  return parts.length > 0 ? parts.join(', ') : '—';
};

const formatDateValue = (val: string): string => {
  if (!val || typeof val !== 'string') return val;
  // ISO timestamp (e.g. 2026-09-02T04:35:52.481909+00:00)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) {
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      }
    } catch {
      return val;
    }
  }
  // Date-only string (e.g. 2026-08-18)
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    try {
      const parts = val.split('-');
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      }
    } catch {
      return val;
    }
  }
  return val;
};

const formatValue = (value: unknown): React.ReactNode => {
  if (value === null || value === undefined || value === '') {
    return <span className="italic" style={{ color: 'var(--text-muted)' }}>—</span>;
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="italic" style={{ color: 'var(--text-muted)' }}>—</span>;
    return (
      <ul className="flex flex-wrap gap-1.5 list-none p-0 m-0">
        {value.map((v, i) => (
          <li key={i} className="mis-badge mis-badge-info">{isPlainObject(v) ? friendlyObjectText(v) : String(v)}</li>
        ))}
      </ul>
    );
  }
  if (isPlainObject(value)) return friendlyObjectText(value);

  if (typeof value === 'string') {
    return formatDateValue(value);
  }

  return String(value);
};

const ViewDetailsModal: React.FC<ViewDetailsModalProps> = ({ record, onClose, title, excludeKeys }) => {
  const [branchesMap, setBranchesMap] = useState<Map<string, string>>(globalBranchesCache || new Map());
  const [usersMap, setUsersMap] = useState<Map<string, string>>(globalUsersCache || new Map());

  const currentUser = authService.getCurrentUser();

  useEffect(() => {
    // Populate current user immediately
    if (currentUser?.id && (!globalUsersCache || !globalUsersCache.has(currentUser.id))) {
      const uMap = new Map(globalUsersCache || []);
      const displayName = currentUser.full_name || currentUser.email || 'Current User';
      uMap.set(currentUser.id, displayName);
      globalUsersCache = uMap;
      setUsersMap(new Map(uMap));
    }

    // Lazy load branches if not in cache
    if (!globalBranchesCache) {
      orgService.getBranches()
        .then((branches) => {
          if (Array.isArray(branches)) {
            const bMap = new Map<string, string>();
            branches.forEach((b) => {
              if (b.id && b.name) bMap.set(b.id, b.name);
            });
            globalBranchesCache = bMap;
            setBranchesMap(bMap);
          }
        })
        .catch(() => {});
    }

    // Lazy load IT staff & profiles if not in cache
    if (!globalUsersCache || globalUsersCache.size <= 1) {
      itService.getITStaffDropdown()
        .then((staff) => {
          if (Array.isArray(staff)) {
            const uMap = new Map(globalUsersCache || []);
            staff.forEach((s) => {
              if (s.id && s.full_name) uMap.set(s.id, s.full_name);
              else if (s.value && s.label) uMap.set(s.value, s.label);
            });
            globalUsersCache = uMap;
            setUsersMap(uMap);
          }
        })
        .catch(() => {});
    }
  }, []);

  if (!record) return null;

  const hidden = new Set([...DEFAULT_EXCLUDE_KEYS, ...(excludeKeys || [])]);
  const keys = Object.keys(record).filter((k) => !hidden.has(k));

  const resolveFieldValue = (key: string, rawVal: any): { label: string; value: React.ReactNode } => {
    // 1. Branch resolution
    if (key === 'branch_id' || key === 'branch') {
      const branchName =
        record.branches?.name ||
        record.branch_name ||
        (branchesMap.has(rawVal) ? branchesMap.get(rawVal) : null);

      return {
        label: 'Branch',
        value: branchName || (rawVal ? `Branch (${rawVal.slice(0, 8)}...)` : '—')
      };
    }

    // 2. Created By resolution
    if (key === 'created_by' || key === 'created_profile_id') {
      const creatorName =
        record.creator?.full_name ||
        record.profiles?.full_name ||
        record.created_by_profile?.full_name ||
        record.created_by_name ||
        (usersMap.has(rawVal) ? usersMap.get(rawVal) : null) ||
        (currentUser && currentUser.id === rawVal ? (currentUser.full_name || currentUser.email) : null);

      return {
        label: 'Created By',
        value: creatorName || (rawVal ? `User (${rawVal.slice(0, 8)}...)` : '—')
      };
    }

    // 3. Updated By resolution
    if (key === 'updated_by') {
      const updaterName =
        record.updater?.full_name ||
        record.updated_by_profile?.full_name ||
        record.updated_by_name ||
        (usersMap.has(rawVal) ? usersMap.get(rawVal) : null) ||
        (currentUser && currentUser.id === rawVal ? (currentUser.full_name || currentUser.email) : null);

      return {
        label: 'Updated By',
        value: updaterName || (rawVal ? `User (${rawVal.slice(0, 8)}...)` : '—')
      };
    }

    // 4. Vendor resolution
    if (key === 'vendor_id') {
      const vendorName = record.it_vendors?.vendor_name || record.vendor_name;
      return {
        label: 'Vendor',
        value: vendorName || formatValue(rawVal)
      };
    }

    // 5. Linked Audit resolution
    if (key === 'audit_id') {
      const auditName = record.it_audits?.audit_name || record.audit_name;
      return {
        label: 'Linked Audit',
        value: auditName || formatValue(rawVal)
      };
    }

    // 6. Linked Asset resolution
    if (key === 'linked_asset_id') {
      const assetName = record.it_assets?.asset_id || record.asset_name;
      return {
        label: 'Linked Asset',
        value: assetName || formatValue(rawVal)
      };
    }

    // 7. Linked Diagram resolution
    if (key === 'linked_diagram_id') {
      const diagramName = record.it_diagrams?.diagram_name || record.diagram_name;
      return {
        label: 'Linked Diagram',
        value: diagramName || formatValue(rawVal)
      };
    }

    // 8. Department resolution
    if (key === 'department_id') {
      const deptName = record.departments?.name || record.department_name;
      return {
        label: 'Department',
        value: deptName || formatValue(rawVal)
      };
    }

    // 9. Position resolution
    if (key === 'position_id') {
      const posName = record.positions?.position_title || record.position_title;
      return {
        label: 'Position',
        value: posName || formatValue(rawVal)
      };
    }

    // Default formatting
    const customLabel = ID_FIELD_LABELS[key] || humanizeKey(key);
    return {
      label: customLabel,
      value: formatValue(rawVal)
    };
  };

  const entries = keys.map((key) => resolveFieldValue(key, record[key]));

  const modalElement = (
    <div className="mis-modal-backdrop" onClick={onClose} role="presentation">
      <div className="mis-modal max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mis-modal-header">
          <div>
            <h2 className="text-lg font-bold m-0 mb-1" style={{ color: 'var(--text-primary)' }}>
              {title || 'Full Details'}
            </h2>
            <p className="text-xs m-0" style={{ color: 'var(--text-secondary)' }}>
              Read-only view of every field on this record.
            </p>
          </div>
          <button type="button" className="mis-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="mis-modal-body max-h-[65vh]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {entries.map(({ label, value }, index) => (
              <div key={`${label}-${index}`} className="mis-card p-3.5">
                <span className="mis-label text-[11px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-secondary)' }}>
                  {label}
                </span>
                <div className="font-semibold text-sm block mt-1 break-words" style={{ color: 'var(--text-primary)' }}>
                  {value}
                </div>
              </div>
            ))}
            {entries.length === 0 && (
              <div className="mis-empty">No fields to display.</div>
            )}
          </div>
        </div>

        <div className="mis-modal-footer">
          <button type="button" onClick={onClose} className="mis-btn mis-btn-ghost flex-1 justify-center font-bold">
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalElement, document.body) : null;
};

export default ViewDetailsModal;
