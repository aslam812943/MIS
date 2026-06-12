import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { auditService, type AuditLog } from '../../services/audit.service';
import { orgService } from '../../services/org.service';
import toast from 'react-hot-toast';
import {
  buildAuditLookups,
  EMPTY_AUDIT_LOOKUPS,
  formatFieldLabel,
  isStatusValue,
  resolveDisplayString,
  resolveRecordLabel,
  type AuditLookups,
} from '../../utils/auditDisplay';

/* ─── helpers ─────────────────────────────────────────────── */
const ACTION_STYLES: Record<string, { badgeClass: string; label: string }> = {
  INSERT: { badgeClass: 'mis-badge-success', label: 'Created' },
  UPDATE: { badgeClass: 'mis-badge-warning', label: 'Updated' },
  DELETE: { badgeClass: 'mis-badge', label: 'Deleted' },
};

const TABLE_LABELS: Record<string, string> = {
  branches: 'Branches',
  departments: 'Departments',
  modules: 'Modules',
  profiles: 'Users',
  data_entries: 'Data Entries',
};

const HIDDEN_DIFF_KEYS = new Set(['id', 'created_at', 'updated_at']);

function getDiffEntries(data: Record<string, unknown> | null | undefined) {
  if (!data || typeof data !== 'object') return [];
  return Object.entries(data).filter(([k]) => !HIDDEN_DIFF_KEYS.has(k));
}

function isWideValue(key: string, val: unknown): boolean {
  if (key === 'data' || key === 'allowed_modules') return true;
  if (key.endsWith('_id') || key === 'verified_by') return true;
  if (val === null || val === undefined) return false;
  if (typeof val === 'object') return true;
  const s = String(val);
  return s.length > 32 || s.includes('\n');
}

function formatDiffValue(key: string, val: unknown, lookups: AuditLookups): React.ReactNode {
  if (val === null || val === undefined) {
    return <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>;
  }

  if (typeof val === 'object' && !Array.isArray(val)) {
    const text = resolveDisplayString(key, val, lookups);
    return <pre className="mis-diff-pre">{text}</pre>;
  }

  const text = resolveDisplayString(key, val, lookups);

  if (key === 'status' && isStatusValue(val)) {
    const status = String(val);
    return (
      <span
        className={`mis-badge ${
          status === 'verified' || status === 'active'
            ? 'mis-badge-success'
            : status === 'pending'
              ? 'mis-badge-warning'
              : 'mis-badge-neutral'
        }`}
      >
        {status}
      </span>
    );
  }

  return text;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

/* ─── Diff pane ───────────────────────────────────────────── */
interface DiffPaneProps {
  variant: 'before' | 'after';
  title: string;
  data: Record<string, unknown> | null | undefined;
  lookups: AuditLookups;
}

const DiffPane: React.FC<DiffPaneProps> = ({ variant, title, data, lookups }) => {
  const entries = getDiffEntries(data);
  const paneClass = variant === 'before' ? 'mis-diff-pane--before' : 'mis-diff-pane--after';

  return (
    <div className={`mis-diff-pane ${paneClass}`}>
      <div className="mis-diff-pane-head">{title}</div>
      {entries.length === 0 ? (
        <div className="mis-diff-pane-empty">No data recorded</div>
      ) : (
        <div className="mis-diff-pane-body">
          <div className="mis-diff-fields">
            {entries.map(([key, val]) => (
              <div
                key={key}
                className={`mis-diff-field${isWideValue(key, val) ? ' span-2' : ''}`}
              >
                <span className="mis-diff-field-key">{formatFieldLabel(key)}</span>
                <div
                  className={`mis-diff-field-val${
                    typeof val === 'object' || key === 'data' || isWideValue(key, val) ? ' mono' : ''
                  }`}
                >
                  {formatDiffValue(key, val, lookups)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Diff Modal ──────────────────────────────────────────── */
interface DiffModalProps {
  log: AuditLog;
  lookups: AuditLookups;
  onClose: () => void;
}

const DiffModal: React.FC<DiffModalProps> = ({ log, lookups, onClose }) => {
  const style = ACTION_STYLES[log.action] || ACTION_STYLES.UPDATE;
  const hasBefore = !!log.old_data && getDiffEntries(log.old_data).length > 0;
  const hasAfter = !!log.new_data && getDiffEntries(log.new_data).length > 0;
  const showSplit = hasBefore && hasAfter;

  const deleteBadgeStyle =
    log.action === 'DELETE'
      ? { color: '#f87171', background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }
      : undefined;

  return (
    <div
      className="mis-modal-backdrop mis-modal-backdrop--audit"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        className="mis-modal mis-audit-diff-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-diff-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mis-modal-header">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className={`mis-badge ${style.badgeClass}`}
                style={deleteBadgeStyle}
              >
                {style.label}
              </span>
              <h2 id="audit-diff-title" className="text-base font-bold m-0" style={{ color: 'var(--text-primary)' }}>
                {TABLE_LABELS[log.table_name] || log.table_name}
              </h2>
            </div>
            <div className="mis-audit-diff-meta">
              <span>{formatDate(log.created_at)}</span>
              <span className="sep">·</span>
              <span>
                User: <strong>{log.user_email}</strong>
              </span>
              {log.user_role && (
                <>
                  <span className="sep">·</span>
                  <span className="capitalize">{log.user_role.replace(/_/g, ' ')}</span>
                </>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="mis-icon-btn shrink-0" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="mis-audit-diff-body">
          <p className="mis-audit-diff-label">Data comparison</p>
          <div className={`mis-audit-diff-grid${showSplit ? ' mis-audit-diff-grid--split' : ''}`}>
            {hasBefore && (
              <DiffPane variant="before" title="Before" data={log.old_data} lookups={lookups} />
            )}
            {hasAfter && (
              <DiffPane variant="after" title="After" data={log.new_data} lookups={lookups} />
            )}
            {!hasBefore && !hasAfter && (
              <div className="mis-diff-pane">
                <div className="mis-diff-pane-empty">No field data available for this record.</div>
              </div>
            )}
          </div>
        </div>

        {log.record_id && (
          <div className="mis-audit-diff-footer">
            <span>
              Record: <strong style={{ color: 'var(--text-primary)' }}>
                {resolveRecordLabel(log.table_name, log.record_id, lookups)}
              </strong>
            </span>
            {resolveRecordLabel(log.table_name, log.record_id, lookups) !== log.record_id && (
              <span style={{ opacity: 0.55, marginLeft: '0.75rem' }} title={log.record_id}>
                ({log.record_id.slice(0, 8)}…)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Skeleton Loader ─────────────────────────────────────── */
const SkeletonRow = () => (
  <tr className="border-b border-slate-800/50">
    {[...Array(5)].map((_, i) => (
      <td key={i} className="px-4 py-4">
        <div className="h-4 bg-slate-800 rounded-lg animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
      </td>
    ))}
  </tr>
);

/* ─── Main AuditLogsTab ───────────────────────────────────── */
const AuditLogsTab: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [lookups, setLookups] = useState<AuditLookups>(EMPTY_AUDIT_LOOKUPS);

  // Filters
  const [filterEmail, setFilterEmail] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterTable, setFilterTable] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');

  // Pagination
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetchLogs = useCallback(async (pageIndex = 0) => {
    setLoading(true);
    try {
      const result = await auditService.getLogs({
        userEmail: filterEmail || undefined,
        action: filterAction || undefined,
        tableName: filterTable || undefined,
        startDate: filterStart ? new Date(filterStart).toISOString() : undefined,
        endDate: filterEnd ? new Date(filterEnd + 'T23:59:59').toISOString() : undefined,
        limit: PAGE_SIZE,
        offset: pageIndex * PAGE_SIZE,
      });
      setLogs(result.logs);
      setTotal(result.total);
      setPage(pageIndex);
    } catch {
      toast.error('Failed to fetch audit logs.');
    } finally {
      setLoading(false);
    }
  }, [filterEmail, filterAction, filterTable, filterStart, filterEnd]);

  useEffect(() => {
    fetchLogs(0);
  }, []);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [users, branches, departments, modules] = await Promise.all([
          orgService.getUsers(),
          orgService.getBranches(),
          orgService.getDepartments(),
          orgService.getModules(),
        ]);
        setLookups(buildAuditLookups(users, branches, departments, modules));
      } catch {
        console.warn('Could not load name lookups for audit logs');
      }
    };
    loadLookups();
  }, []);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(0);
  };

  const handleClearFilters = () => {
    setFilterEmail('');
    setFilterAction('');
    setFilterTable('');
    setFilterStart('');
    setFilterEnd('');
    setTimeout(() => fetchLogs(0), 0);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Filter Panel ────────────────────────────────── */}
      <section className="mis-card p-5 sm:p-6">
        <h3 className="mis-label mb-4">Filter Logs</h3>
        <form onSubmit={handleApplyFilters} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="mis-field">
            <label className="mis-label">User Email</label>
            <input
              placeholder="Search by email..."
              className="mis-input text-sm"
              value={filterEmail}
              onChange={e => setFilterEmail(e.target.value)}
            />
          </div>

          <div className="mis-field">
            <label className="mis-label">Action Type</label>
            <select
              className="mis-select text-sm"
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
            >
              <option value="">All Actions</option>
              <option value="INSERT">✅ Created</option>
              <option value="UPDATE">✏️ Updated</option>
              <option value="DELETE">🗑️ Deleted</option>
            </select>
          </div>

          <div className="mis-field">
            <label className="mis-label">Entity</label>
            <select
              className="mis-select text-sm"
              value={filterTable}
              onChange={e => setFilterTable(e.target.value)}
            >
              <option value="">All Entities</option>
              <option value="branches">🏢 Branches</option>
              <option value="departments">🏛️ Departments</option>
              <option value="modules">📦 Modules</option>
              <option value="profiles">👤 Users</option>
              <option value="data_entries">📝 Data Entries</option>
            </select>
          </div>

          <div className="mis-field">
            <label className="mis-label">From Date</label>
            <input
              type="date"
              className="mis-input text-sm"
              value={filterStart}
              onChange={e => setFilterStart(e.target.value)}
            />
          </div>

          <div className="mis-field">
            <label className="mis-label">To Date</label>
            <input
              type="date"
              className="mis-input text-sm"
              value={filterEnd}
              onChange={e => setFilterEnd(e.target.value)}
            />
          </div>

          <div className="flex items-end gap-3">
            <button type="submit" disabled={loading} className="mis-btn mis-btn-primary flex-1 justify-center">
              {loading ? 'Loading...' : 'Apply Filters'}
            </button>
            <button type="button" onClick={handleClearFilters} className="mis-btn mis-btn-ghost">
              Clear
            </button>
          </div>
        </form>
      </section>

      {/* ── Stats Row ───────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Records', value: total, accent: true },
          { label: 'This Page', value: logs.length, accent: false },
          { label: 'Current Page', value: `${page + 1} / ${totalPages || 1}`, accent: false },
          { label: 'Page Size', value: PAGE_SIZE, accent: false },
        ].map(s => (
          <div key={s.label} className="mis-stat-card">
            <div className="mis-stat-label">{s.label}</div>
            <div className={`mis-stat-value ${s.accent ? 'accent' : ''}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <section className="mis-table-wrap">
        <div className="overflow-x-auto">
          <table className="mis-table">
            <thead>
              <tr>
                <th className="px-5 py-4">Action</th>
                <th className="px-5 py-4">Entity</th>
                <th className="px-5 py-4">Performed By</th>
                <th className="px-5 py-4">Role</th>
                <th className="px-5 py-4">Timestamp</th>
                <th className="px-5 py-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading && [...Array(8)].map((_, i) => <SkeletonRow key={i} />)}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-4xl">📭</span>
                      <span className="font-medium">No history records found.</span>
                      <span className="text-xs text-slate-600">Try adjusting your filters or perform some actions first.</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && logs.map(log => {
                const style = ACTION_STYLES[log.action] || ACTION_STYLES.UPDATE;
                const deleteBadgeStyle =
                  log.action === 'DELETE'
                    ? { color: '#f87171', background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }
                    : undefined;
                return (
                  <tr
                    key={log.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td>
                      <span className={`mis-badge ${style.badgeClass}`} style={deleteBadgeStyle}>
                        {style.label}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-primary)' }}>
                      {TABLE_LABELS[log.table_name] || log.table_name}
                    </td>
                    <td>
                      <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>{log.user_email}</span>
                    </td>
                    <td>
                      <span className="mis-badge mis-badge-neutral capitalize">
                        {log.user_role?.replace(/_/g, ' ') || '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {formatDate(log.created_at)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="mis-btn mis-btn-ghost mis-btn-sm"
                        onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}
                      >
                        View diff
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-slate-800 bg-black/20">
            <span className="text-xs text-slate-500">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total} records
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0 || loading}
                onClick={() => fetchLogs(page - 1)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-all"
              >
                ← Prev
              </button>
              {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                const p = page < 3 ? i : page - 2 + i;
                if (p >= totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => fetchLogs(p)}
                    className={`w-8 h-8 text-xs font-bold rounded-lg transition-all ${p === page ? 'mis-module-tab active' : 'mis-btn-ghost'}`}
                    style={p === page ? {} : { background: 'var(--bg-hover-2)', color: 'var(--text-secondary)' }}
                  >
                    {p + 1}
                  </button>
                );
              })}
              <button
                disabled={page >= totalPages - 1 || loading}
                onClick={() => fetchLogs(page + 1)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-all"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Diff Modal (portal — aligns flush with sidebar) ─ */}
      {selectedLog &&
        createPortal(
          <DiffModal
            log={selectedLog}
            lookups={lookups}
            onClose={() => setSelectedLog(null)}
          />,
          document.body
        )}
    </div>
  );
};

export default AuditLogsTab;
