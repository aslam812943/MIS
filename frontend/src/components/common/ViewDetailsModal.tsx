import React from 'react';

interface ViewDetailsModalProps {
  record: Record<string, any> | null;
  onClose: () => void;
  title?: string;
  /** Field keys to hide (e.g. internal join objects already shown elsewhere). */
  excludeKeys?: string[];
}

const humanizeKey = (key: string): string =>
  key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());

// Foreign-key columns Supabase queries across the app join alongside a
// nested object (e.g. `branch_id` + `branches: {name}`, `created_by` +
// `profiles: {full_name, email}`) — shown raw, that's a UUID next to a JSON
// blob. Map each known id column to a friendly label and to the naming
// hints its joined object typically uses, so the pair collapses into one
// readable line instead of two confusing ones.
const ID_FIELD_LABELS: Record<string, string> = {
  branch_id: 'Branch',
  department_id: 'Department',
  module_id: 'Module',
  vendor_id: 'Vendor',
  position_id: 'Position',
  linked_asset_id: 'Linked Asset',
  linked_diagram_id: 'Linked Diagram',
  profile_id: 'Profile',
  created_profile_id: 'Created Profile',
  reporting_to: 'Reporting To',
  user_id: 'User',
  created_by: 'Created By',
  updated_by: 'Updated By',
  verified_by: 'Verified By',
};

const ID_FIELD_OBJECT_HINTS: Record<string, string[]> = {
  branch_id: ['branch'],
  department_id: ['department'],
  module_id: ['module'],
  vendor_id: ['vendor'],
  position_id: ['position'],
  linked_asset_id: ['asset'],
  linked_diagram_id: ['diagram'],
  profile_id: ['profile'],
  created_profile_id: ['profile'],
  reporting_to: ['profile', 'manager', 'reportingto'],
  user_id: ['profile', 'user'],
  created_by: ['profile', 'creator', 'createdby'],
  updated_by: ['profile', 'updater', 'updatedby'],
  verified_by: ['profile', 'verifier', 'verifiedby'],
};

const normalize = (key: string) => key.toLowerCase().replace(/_/g, '');

const isPlainObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Turn a joined object ({name}, {full_name,email}, ...) into one readable string. */
const friendlyObjectText = (obj: Record<string, any>): string => {
  if (obj.full_name && obj.email) return `${obj.full_name} (${obj.email})`;
  if (obj.full_name) return String(obj.full_name);
  if (obj.name) return String(obj.name);
  if (obj.email) return String(obj.email);
  if (obj.title) return String(obj.title);
  const parts = Object.entries(obj).map(([k, v]) => `${humanizeKey(k)}: ${v}`);
  return parts.length > 0 ? parts.join(', ') : '—';
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
  return String(value);
};

/**
 * Resolves raw `*_id` columns against their joined object (when present)
 * into a single friendly [label, value] pair, and leaves everything else
 * as-is. Returns the final ordered list of entries to render.
 */
const resolveEntries = (record: Record<string, any>, hidden: Set<string>): [string, React.ReactNode][] => {
  const keys = Object.keys(record).filter((k) => !hidden.has(k));
  const consumed = new Set<string>();
  const idToMatchedObjectKey = new Map<string, string>();

  for (const idKey of keys) {
    if (!(idKey in ID_FIELD_LABELS) || consumed.has(idKey)) continue;
    const hints = ID_FIELD_OBJECT_HINTS[idKey] || [];
    const matchKey = keys.find(
      (k) =>
        k !== idKey &&
        !consumed.has(k) &&
        isPlainObject(record[k]) &&
        hints.some((h) => normalize(k).includes(h))
    );
    if (matchKey) {
      idToMatchedObjectKey.set(idKey, matchKey);
      consumed.add(idKey);
      consumed.add(matchKey);
    }
  }

  const result: [string, React.ReactNode][] = [];
  for (const key of keys) {
    if (idToMatchedObjectKey.has(key)) {
      const objKey = idToMatchedObjectKey.get(key)!;
      result.push([ID_FIELD_LABELS[key], friendlyObjectText(record[objKey])]);
      continue;
    }
    if (consumed.has(key)) continue; // the joined object half of an already-resolved pair
    result.push([humanizeKey(key), formatValue(record[key])]);
  }
  return result;
};

/**
 * Generic read-only "View Full Details" modal — shared across every
 * department's data entry table so each one doesn't need its own bespoke
 * read-only form. Renders every field on the record as a label/value pair;
 * the Edit modal remains the only place values can be changed.
 */
const ViewDetailsModal: React.FC<ViewDetailsModalProps> = ({ record, onClose, title, excludeKeys }) => {
  if (!record) return null;

  const hidden = new Set(excludeKeys || []);
  const entries = resolveEntries(record, hidden);

  return (
    <div className="mis-modal-backdrop" onClick={onClose}>
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
            {entries.map(([label, value], index) => (
              <div key={`${label}-${index}`} className="mis-card p-3">
                <span className="mis-label">{label}</span>
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
          <button type="button" onClick={onClose} className="mis-btn mis-btn-ghost flex-1 justify-center">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewDetailsModal;
