import React, { useState, useEffect, useCallback } from 'react';
import { auditService, type AuditLog } from '../../services/audit.service';
import toast from 'react-hot-toast';

/* ─── helpers ─────────────────────────────────────────────── */
const ACTION_STYLES: Record<string, { badge: string; dot: string; label: string }> = {
  INSERT: {
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    dot: 'bg-emerald-400',
    label: 'Created',
  },
  UPDATE: {
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-400',
    label: 'Updated',
  },
  DELETE: {
    badge: 'bg-red-500/15 text-red-400 border-red-500/30',
    dot: 'bg-red-400',
    label: 'Deleted',
  },
};

const TABLE_LABELS: Record<string, string> = {
  branches: '🏢 Branches',
  departments: '🏛️ Departments',
  modules: '📦 Modules',
  profiles: '👤 Users',
  data_entries: '📝 Data Entries',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

/* ─── Diff renderer ───────────────────────────────────────── */
interface DiffPaneProps { label: string; data: any; tint: 'red' | 'green' }
const DiffPane: React.FC<DiffPaneProps> = ({ label, data, tint }) => {
  const color = tint === 'red' ? 'border-red-500/30 bg-red-500/5' : 'border-emerald-500/30 bg-emerald-500/5';
  const headColor = tint === 'red' ? 'text-red-400' : 'text-emerald-400';

  if (!data) {
    return (
      <div className={`flex-1 rounded-2xl border ${color} p-5 flex items-center justify-center`}>
        <span className="text-slate-600 italic text-sm">No data</span>
      </div>
    );
  }

  const entries = Object.entries(data).filter(([k]) => !['id', 'created_at', 'updated_at'].includes(k));

  return (
    <div className={`flex-1 rounded-2xl border ${color} overflow-hidden`}>
      <div className={`px-5 py-3 border-b ${tint === 'red' ? 'border-red-500/20' : 'border-emerald-500/20'}`}>
        <span className={`text-xs font-black uppercase tracking-widest ${headColor}`}>{label}</span>
      </div>
      <div className="p-4 space-y-2 max-h-[360px] overflow-y-auto">
        {entries.length === 0 && (
          <span className="text-slate-600 italic text-sm">Empty</span>
        )}
        {entries.map(([key, val]) => (
          <div key={key} className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{key.replace(/_/g, ' ')}</span>
            <span className="text-sm text-slate-200 break-all font-mono bg-black/30 rounded-lg px-3 py-1.5">
              {val === null || val === undefined ? <em className="text-slate-600">null</em> :
               typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Diff Modal ──────────────────────────────────────────── */
interface DiffModalProps { log: AuditLog; onClose: () => void }
const DiffModal: React.FC<DiffModalProps> = ({ log, onClose }) => {
  const style = ACTION_STYLES[log.action] || ACTION_STYLES.UPDATE;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl shadow-black/60 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-7 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-800/60 to-slate-900">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className={`text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${style.badge}`}>
                {style.label}
              </span>
              <span className="text-white font-bold text-lg">
                {TABLE_LABELS[log.table_name] || log.table_name}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>🕒 {formatDate(log.created_at)}</span>
              <span className="w-1 h-1 rounded-full bg-slate-700" />
              <span>👤 <span className="text-indigo-400 font-semibold">{log.user_email}</span></span>
              {log.user_role && (
                <>
                  <span className="w-1 h-1 rounded-full bg-slate-700" />
                  <span className="capitalize text-slate-400">{log.user_role.replace(/_/g, ' ')}</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl transition-all text-lg"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-7 overflow-y-auto flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
            Data Comparison
          </p>
          <div className="flex gap-4">
            <DiffPane label="Before (Old Data)" data={log.old_data} tint="red" />
            <DiffPane label="After (New Data)" data={log.new_data} tint="green" />
          </div>
          {log.record_id && (
            <p className="text-[10px] text-slate-600 mt-4 font-mono">Record ID: {log.record_id}</p>
          )}
        </div>
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

  useEffect(() => { fetchLogs(0); }, []);

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
      <section className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-6">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-5 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          Filter Logs
        </h3>
        <form onSubmit={handleApplyFilters} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">User Email</label>
            <input
              placeholder="Search by email..."
              className="bg-black/30 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              value={filterEmail}
              onChange={e => setFilterEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Action Type</label>
            <select
              className="bg-black/30 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
            >
              <option value="">All Actions</option>
              <option value="INSERT">✅ Created</option>
              <option value="UPDATE">✏️ Updated</option>
              <option value="DELETE">🗑️ Deleted</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Entity</label>
            <select
              className="bg-black/30 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
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

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">From Date</label>
            <input
              type="date"
              className="bg-black/30 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              value={filterStart}
              onChange={e => setFilterStart(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">To Date</label>
            <input
              type="date"
              className="bg-black/30 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              value={filterEnd}
              onChange={e => setFilterEnd(e.target.value)}
            />
          </div>

          <div className="flex items-end gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-indigo-600/20"
            >
              {loading ? '⏳ Loading...' : '🔍 Apply Filters'}
            </button>
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-4 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-300 bg-white/5 hover:bg-white/10 border border-slate-800 rounded-xl transition-all"
            >
              Clear
            </button>
          </div>
        </form>
      </section>

      {/* ── Stats Row ───────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Records', value: total, color: 'indigo' },
          { label: 'This Page', value: logs.length, color: 'purple' },
          { label: 'Current Page', value: `${page + 1} / ${totalPages || 1}`, color: 'slate' },
          { label: 'Page Size', value: PAGE_SIZE, color: 'slate' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">{s.label}</p>
            <p className={`text-2xl font-extrabold ${s.color === 'indigo' ? 'text-indigo-400' : s.color === 'purple' ? 'text-purple-400' : 'text-slate-300'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Logs Table ──────────────────────────────────── */}
      <section className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase tracking-widest font-black">
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
                return (
                  <tr
                    key={log.id}
                    className="group hover:bg-white/[0.03] transition-colors cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-full border ${style.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                        {style.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-300 font-medium">
                      {TABLE_LABELS[log.table_name] || log.table_name}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-indigo-400 font-semibold">{log.user_email}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-1 rounded-md font-bold capitalize">
                        {log.user_role?.replace(/_/g, ' ') || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500 font-mono">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button className="text-xs text-slate-600 group-hover:text-indigo-400 font-bold border border-slate-800 group-hover:border-indigo-500/40 px-3 py-1.5 rounded-lg transition-all">
                        View Diff →
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
                    className={`w-8 h-8 text-xs font-bold rounded-lg transition-all ${p === page ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
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

      {/* ── Diff Modal ──────────────────────────────────── */}
      {selectedLog && <DiffModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </div>
  );
};

export default AuditLogsTab;
