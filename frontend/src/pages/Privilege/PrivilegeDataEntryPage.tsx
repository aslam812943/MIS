import React, { useState, useEffect, useMemo } from 'react';
import { authService } from '../../services/auth.service';
import { privilegeService } from '../../services/privilege.service';
import type { PrivilegeAccount, PrivilegeUpload } from '../../types/privilege.types';
import DashboardLayout from '../../components/layout/DashboardLayout';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
  Search,
  Plus,
  FileUp,
  Download,
  ArrowUpRight,
  Eye,
  RefreshCw,
  X,
  FileText,
  ArrowDownToLine,
  Users,
  LayoutDashboard,
  Trash2,
  Building2,
  TrendingUp,
  Coins,
  Percent,
  Briefcase,
  Phone,
  MapPin,
  Upload
} from 'lucide-react';
import './Privilege.css';

const getRequestErrorMessage = (error: any, fallback: string): string => {
  const serverMessage = error?.response?.data?.error || error?.response?.data?.message;
  if (typeof serverMessage === 'string' && serverMessage.trim()) return serverMessage;
  if (!error?.response) return 'Unable to connect to the server. Check your connection and try again.';
  if (error.response.status === 403) return 'You do not have permission to perform this action.';
  if (error.response.status >= 500) return 'The server could not complete the request. Please try again, or contact an administrator if it continues.';
  return fallback;
};

export const PrivilegeDataEntryPage: React.FC = () => {
  const currentUser = authService.getCurrentUser();
  const [tab, setTab] = useState<'Accounts' | 'Uploads'>('Accounts');
  const [accounts, setAccounts] = useState<PrivilegeAccount[]>([]);
  const [files, setFiles] = useState<PrivilegeUpload[]>([]);
  const [query, setQuery] = useState('');
  const [modalAccount, setModalAccount] = useState<Partial<PrivilegeAccount> | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadKind, setUploadKind] = useState<string>('Accounts CSV');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  // Custom Delete Confirmation state (Replaces default browser window.confirm)
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'account' | 'upload';
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Determine if user can edit (Employees & Admins can add/edit/delete; HOD is strictly view-only)
  const isHOD = currentUser?.role === 'hod';
  const canEdit = !isHOD;

  const fetchData = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      const [accData, uploadsData] = await Promise.all([
        privilegeService.getAccounts(),
        privilegeService.getUploads()
      ]);
      setAccounts(accData);
      setFiles(uploadsData);
      if (showToast) toast.success('Privilege records refreshed');
    } catch (err: any) {
      console.error('Error fetching privilege data:', err);
      toast.error(getRequestErrorMessage(err, 'Failed to load privilege data.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredAccounts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q) ||
        (a.mobile_no || '').toLowerCase().includes(q) ||
        (a.scheme || '').toLowerCase().includes(q) ||
        (a.rm || '').toLowerCase().includes(q) ||
        (a.dealer || '').toLowerCase().includes(q) ||
        (a.branch || '').toLowerCase().includes(q) ||
        a.location.toLowerCase().includes(q) ||
        a.stocks.toLowerCase().includes(q) ||
        a.occupation.toLowerCase().includes(q)
    );
  }, [accounts, query]);

  const formatMoney = (n: number) => {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
    return `₹${n.toLocaleString('en-IN')}`;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalAccount) return;

    if (!canEdit) {
      toast.error('HOD has view-only access. Privilege records cannot be modified.');
      return;
    }

    const requiredFields: Array<[keyof PrivilegeAccount, string]> = [
      ['name', 'Client name'], ['account_date', 'Date'],
      ['mobile_no', 'Mobile number'], ['aum', 'AUM'], ['utilised', 'Funds utilised']
    ];
    const missing = requiredFields.find(([key]) => modalAccount[key] === undefined || modalAccount[key] === null || String(modalAccount[key]).trim() === '');
    if (missing) {
      toast.error(`${missing[1]} is required.`);
      return;
    }
    if (!/^\+?[0-9]{10,15}$/.test(String(modalAccount.mobile_no).replace(/[\s-]/g, ''))) {
      toast.error('Mobile number must contain 10 to 15 digits.');
      return;
    }
    if ((modalAccount.utilised || 0) > (modalAccount.aum || 0)) {
      toast.error('Funds utilised cannot be greater than AUM.');
      return;
    }

    try {
      setIsBusy(true);
      const res = await privilegeService.saveAccount(modalAccount);
      toast.success(res.message || 'Account saved successfully');
      setModalAccount(null);
      await fetchData();
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error(getRequestErrorMessage(err, 'Failed to save account. Check the entered details and try again.'));
    } finally {
      setIsBusy(false);
    }
  };

  // Custom Delete Execution Handler
  const executeDelete = async () => {
    if (!confirmDelete || isDeleting) return;

    if (!canEdit) {
      toast.error('HOD has view-only access. Deletion is restricted.');
      setConfirmDelete(null);
      return;
    }

    try {
      setIsDeleting(true);
      if (confirmDelete.type === 'account') {
        await privilegeService.deleteAccount(confirmDelete.id);
        setAccounts((prev) => prev.filter((a) => a.code !== confirmDelete.id));
        toast.success(`Account "${confirmDelete.name}" deleted successfully`);
        if (modalAccount && modalAccount.code === confirmDelete.id) {
          setModalAccount(null);
        }
      } else if (confirmDelete.type === 'upload') {
        await privilegeService.deleteUpload(confirmDelete.id);
        setFiles((prev) => prev.filter((f) => f.id !== confirmDelete.id));
        toast.success(`File "${confirmDelete.name}" deleted successfully`);
      }
      setConfirmDelete(null);
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error(getRequestErrorMessage(err, 'Failed to delete the record. Please try again.'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    if (!canEdit) {
      toast.error('HOD has view-only access. File upload is restricted.');
      return;
    }

    try {
      setIsBusy(true);

      if (uploadKind === 'Accounts CSV') {
        const text = await selectedFile.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          throw new Error('CSV must contain header row and at least 1 record.');
        }

        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const expected = ['name', 'account_date', 'mobile_no', 'aum', 'utilised'];
        const missing = expected.filter((col) => !headers.includes(col));
        if (missing.length > 0) {
          throw new Error(`CSV missing mandatory columns: ${missing.join(', ')}`);
        }

        const rows: Partial<PrivilegeAccount>[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
          if (cols.length < headers.length) continue;

          const rowObj: any = {};
          headers.forEach((h, idx) => {
            rowObj[h] = cols[idx];
          });

          rows.push({
            name: rowObj.name,
            account_date: rowObj.account_date,
            mobile_no: rowObj.mobile_no,
            scheme: rowObj.scheme,
            introducer: rowObj.introducer,
            rm: rowObj.rm,
            dealer: rowObj.dealer,
            branch: rowObj.branch,
            trading_started: ['yes', 'true', '1', 'started'].includes(String(rowObj.trading_started).toLowerCase()),
            remarks: rowObj.remarks || '',
            location: rowObj.location,
            occupation: rowObj.occupation,
            contact: rowObj.contact,
            aum: parseFloat(rowObj.aum) || 0,
            utilised: parseFloat(rowObj.utilised) || 0,
            returns: parseFloat(rowObj.returns) || 0,
            stocks: rowObj.stocks
          });
        }

        const res = await privilegeService.bulkImportAccounts(rows);
        toast.success(res.message || `Imported ${res.saved} accounts successfully`);
      } else {
        const res = await privilegeService.uploadFile(selectedFile, uploadKind);
        toast.success(res.message || 'File uploaded successfully');
      }

      setIsUploadOpen(false);
      setSelectedFile(null);
      await fetchData();
    } catch (err: any) {
      console.error('Upload error:', err);
      const message = err instanceof Error && !('response' in err) ? err.message : getRequestErrorMessage(err, 'Upload failed. Check the file and try again.');
      toast.error(message);
    } finally {
      setIsBusy(false);
    }
  };

  const downloadCSVTemplate = () => {
    const csvContent =
      'name,account_date,mobile_no,scheme,introducer,rm,dealer,branch,trading_started,remarks,location,occupation,contact,aum,utilised,returns,stocks\n' +
      'Arjun Mehta,2026-09-14,9876543210,Privilege,Direct,Rahul,Neha,Mumbai,Yes,Priority client,Mumbai,Business owner,9876543210,8500000,6300000,12.8,"HDFCBANK, RELIANCE, INFY"';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'privilege_accounts_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded CSV template');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fadeIn">
        {/* Top Header Card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-card)] p-6 rounded-2xl border border-[var(--border)] shadow-sm">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--accent-bg)] text-[var(--accent)] border border-[var(--border-accent)] mb-2">
              <Building2 className="w-3.5 h-3.5" />
              <span>Privilege Account Directory</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              Privilege Accounts
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              {canEdit
                ? 'Manage client accounts, trade limits, and file records with real-time sync.'
                : 'View assigned high-net-worth accounts, allocations, and compliance uploads.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/privilege/dashboard"
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition shadow-sm"
            >
              <LayoutDashboard className="w-4 h-4 text-[var(--accent)]" />
              <span>Dashboard</span>
            </Link>

            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              title="Refresh Accounts"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {canEdit && (
              <>
                <button
                  onClick={() => {
                    setIsUploadOpen(true);
                    setSelectedFile(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition shadow-sm"
                >
                  <FileUp className="w-4 h-4 text-[var(--accent)]" />
                  <span>Upload details</span>
                </button>
                <button
                  onClick={() => setModalAccount({})}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)] transition shadow-sm hover:shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add account</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tab & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--bg-card)] p-3.5 sm:p-4 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="inline-flex items-center p-1 bg-[var(--bg-base)] rounded-xl border border-[var(--border)] w-fit">
            <button
              onClick={() => {
                setTab('Accounts');
                setQuery('');
              }}
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                tab === 'Accounts'
                  ? 'bg-[var(--bg-card)] text-[var(--accent)] font-semibold shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Accounts</span>
              <span className="px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--accent-bg)] text-[var(--accent)]">
                {accounts.length}
              </span>
            </button>
            <button
              onClick={() => {
                setTab('Uploads');
                setQuery('');
              }}
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                tab === 'Uploads'
                  ? 'bg-[var(--bg-card)] text-[var(--accent)] font-semibold shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <FileUp className="w-4 h-4" />
              <span>Uploads</span>
              <span className="px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--accent-bg)] text-[var(--accent)]">
                {files.length}
              </span>
            </button>
          </div>

          {tab === 'Accounts' && (
            <div className="relative flex items-center w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3.5 text-[var(--text-muted)]" />
              <input
                placeholder="Search name, code, location or stock..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition"
              />
            </div>
          )}
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-12 text-center animate-pulse">
            <Users className="w-10 h-10 mx-auto text-[var(--text-muted)] opacity-30 mb-4" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700/60 rounded w-48 mx-auto mb-2.5"></div>
            <div className="h-3 bg-slate-200 dark:bg-slate-700/40 rounded w-64 mx-auto"></div>
          </div>
        ) : (
          <>
            {/* ── Tab: Accounts ── */}
            {tab === 'Accounts' && (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left text-sm text-[var(--text-secondary)] min-w-[1600px]">
                    <thead className="bg-[var(--table-header-bg)] text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)]">
                      <tr>
                        <th className="py-3.5 px-4">Sl No</th>
                        <th className="py-3.5 px-4">Client Code</th>
                        <th className="py-3.5 px-4 min-w-[180px]">Client Name</th>
                        <th className="py-3.5 px-4">Date</th>
                        <th className="py-3.5 px-4">Mobile No</th>
                        <th className="py-3.5 px-4">Scheme</th>
                        <th className="py-3.5 px-4">Introducer</th>
                        <th className="py-3.5 px-4">RM</th>
                        <th className="py-3.5 px-4">Dealer</th>
                        <th className="py-3.5 px-4">Branch</th>
                        <th className="py-3.5 px-4">Trading Started</th>
                        <th className="py-3.5 px-4 min-w-[180px]">Remarks</th>
                        <th className="py-3.5 px-6 text-right w-24">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]/60">
                      {filteredAccounts.map((a) => {
                        const clientInitials = a.name
                          .split(' ')
                          .map((s) => s[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase();
                        return (
                          <tr
                            key={a.code}
                            onClick={() => setModalAccount(a)}
                            className="hover:bg-[var(--bg-hover)] transition cursor-pointer"
                          >
                            <td className="py-4 px-4 tabular-nums">{a.sl_no || '—'}</td>
                            <td className="py-4 px-4 font-mono">{a.code}</td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500/20 to-emerald-500/20 text-[var(--accent)] font-bold text-xs flex items-center justify-center border border-[var(--border-accent)] flex-shrink-0">
                                  {clientInitials}
                                </div>
                                <div>
                                  <div className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] transition">
                                    {a.name}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">{a.account_date ? new Date(`${a.account_date}T00:00:00`).toLocaleDateString('en-IN') : '—'}</td>
                            <td className="py-4 px-4">{a.mobile_no || '—'}</td>
                            <td className="py-4 px-4">{a.scheme || '—'}</td>
                            <td className="py-4 px-4">{a.introducer || '—'}</td>
                            <td className="py-4 px-4">{a.rm || '—'}</td>
                            <td className="py-4 px-4">{a.dealer || '—'}</td>
                            <td className="py-4 px-4">{a.branch || '—'}</td>
                            <td className="py-4 px-4"><span className={`px-2 py-1 rounded-md text-xs font-semibold ${a.trading_started ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>{a.trading_started ? 'Yes' : 'No'}</span></td>
                            <td className="py-4 px-4 max-w-[240px] truncate" title={a.remarks || ''}>{a.remarks || '—'}</td>
                            <td className="py-4 px-6 text-right">
                              <div
                                className="flex items-center justify-end gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => setModalAccount(a)}
                                  aria-label={canEdit ? `Edit ${a.name}` : `View ${a.name}`}
                                  title={canEdit ? `Edit ${a.name}` : `View ${a.name}`}
                                  className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-base)] transition"
                                >
                                  {canEdit ? <ArrowUpRight className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setConfirmDelete({
                                        type: 'account',
                                        id: a.code,
                                        name: `${a.name} (${a.code})`
                                      })
                                    }
                                    aria-label={`Delete ${a.name}`}
                                    title={`Delete ${a.name}`}
                                    className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-rose-500 hover:bg-rose-500/10 transition"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {filteredAccounts.length === 0 && (
                    <div className="text-center py-16">
                      <Users className="w-12 h-12 mx-auto text-[var(--text-muted)] mb-3 opacity-40" />
                      <h3 className="text-base font-semibold text-[var(--text-primary)]">
                        {query ? 'No matching accounts found' : 'No privilege accounts found'}
                      </h3>
                      <p className="text-xs text-[var(--text-muted)] mt-1 mb-5">
                        {query
                          ? 'Try searching with a different name, client code or location.'
                          : canEdit
                          ? 'Add accounts manually or upload a bulk CSV spreadsheet.'
                          : 'Client accounts will appear here once entered by executives.'}
                      </p>
                      {!query && canEdit && (
                        <button
                          onClick={() => setModalAccount({})}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)] transition shadow-sm"
                        >
                          <Plus className="w-4 h-4" /> Add account
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-card)] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                  <span>Showing {filteredAccounts.length} of {accounts.length} accounts</span>
                  <span>All values in INR (₹)</span>
                </div>
              </div>
            )}

            {/* ── Tab: Uploads ── */}
            {tab === 'Uploads' && (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[var(--border)]">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">Uploaded Files & Records</h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      CSV, Excel spreadsheets and PDF account statements (up to 10 MB per file).
                    </p>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => { setIsUploadOpen(true); setSelectedFile(null); }}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)] transition shadow-sm w-full sm:w-auto"
                    >
                      <Upload className="w-4 h-4" /> Upload new file
                    </button>
                  )}
                </div>

                {files.length > 0 ? (
                  <div className="divide-y divide-[var(--border)]">
                    {files.map((f) => (
                      <div key={f.id} className="flex items-center justify-between py-4 gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="p-2.5 rounded-xl bg-[var(--accent-bg)] text-[var(--accent)] border border-[var(--border-accent)] flex-shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-[var(--text-primary)] truncate">{f.name}</div>
                            <div className="text-xs text-[var(--text-muted)] mt-0.5">
                              {f.kind} · {new Date(f.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <a
                            href={privilegeService.getViewUrl(f.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </a>
                          <a
                            href={privilegeService.getDownloadUrl(f.id)}
                            download
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition"
                          >
                            <ArrowDownToLine className="w-3.5 h-3.5" /> Download
                          </a>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDelete({
                                  type: 'upload',
                                  id: f.id,
                                  name: f.name
                                })
                              }
                              title={`Delete ${f.name}`}
                              aria-label={`Delete ${f.name}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-500 hover:bg-rose-500/15 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <FileText className="w-12 h-12 mx-auto text-[var(--text-muted)] mb-3 opacity-40" />
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">No uploaded files yet</h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1 mb-5">
                      {canEdit
                        ? 'Upload statement PDFs, account spreadsheets or bulk CSV files.'
                        : 'Uploaded logs and compliance files will appear here.'}
                    </p>
                    {canEdit && (
                      <button
                        onClick={() => { setIsUploadOpen(true); setSelectedFile(null); }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)] transition shadow-sm"
                      >
                        <FileUp className="w-4 h-4" /> Upload details
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Modal: View / Edit / Add Account ── */}
        {modalAccount && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fadeIn"
            onClick={() => !isBusy && setModalAccount(null)}
          >
            <div
              className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                    {!canEdit ? 'View Client Account' : modalAccount.code ? 'Edit Account' : 'New Account'}
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mt-0.5">
                    {modalAccount.name || (modalAccount.code ? 'Account Details' : 'Add Privilege Account')}
                  </h2>
                </div>
                <button
                  disabled={isBusy}
                  onClick={() => setModalAccount(null)}
                  className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              {!canEdit ? (
                /* HOD Read-Only View */
                <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      ['Sl No', modalAccount.sl_no], ['Date', modalAccount.account_date],
                      ['Mobile No', modalAccount.mobile_no], ['Scheme', modalAccount.scheme],
                      ['Introducer', modalAccount.introducer], ['RM', modalAccount.rm],
                      ['Dealer', modalAccount.dealer], ['Branch', modalAccount.branch],
                      ['Trading Started', modalAccount.trading_started ? 'Yes' : 'No'],
                      ['Remarks', modalAccount.remarks || '—']
                    ].map(([label, value]) => (
                      <div key={String(label)} className="p-3.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border)]">
                        <div className="text-xs text-[var(--text-muted)] mb-1">{label}</div>
                        <div className="font-medium text-sm text-[var(--text-primary)]">{value ?? '—'}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border)]">
                      <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mb-1">
                        <Building2 className="w-3.5 h-3.5 text-[var(--accent)]" /> Client Code
                      </div>
                      <div className="font-mono font-bold text-sm text-[var(--text-primary)]">{modalAccount.code || '—'}</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border)]">
                      <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mb-1">
                        <Users className="w-3.5 h-3.5 text-[var(--accent)]" /> Client Full Name
                      </div>
                      <div className="font-bold text-sm text-[var(--text-primary)]">{modalAccount.name || '—'}</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border)]">
                      <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mb-1">
                        <MapPin className="w-3.5 h-3.5 text-[var(--accent)]" /> Location
                      </div>
                      <div className="font-medium text-sm text-[var(--text-primary)]">{modalAccount.location || '—'}</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border)]">
                      <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mb-1">
                        <Briefcase className="w-3.5 h-3.5 text-[var(--accent)]" /> Occupation
                      </div>
                      <div className="font-medium text-sm text-[var(--text-primary)]">{modalAccount.occupation || '—'}</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border)]">
                      <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mb-1">
                        <Phone className="w-3.5 h-3.5 text-[var(--accent)]" /> Contact
                      </div>
                      <div className="font-medium text-sm text-[var(--text-primary)]">{modalAccount.contact || '—'}</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border)]">
                      <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mb-1">
                        <Percent className="w-3.5 h-3.5 text-[var(--accent)]" /> Annual Return
                      </div>
                      <div className={`font-bold text-sm ${(modalAccount.returns || 0) < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {(modalAccount.returns || 0) > 0 ? '+' : ''}
                        {(modalAccount.returns || 0).toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border)]">
                      <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mb-1">
                        <Coins className="w-3.5 h-3.5 text-[var(--accent)]" /> Total AUM
                      </div>
                      <div className="font-bold text-base text-[var(--text-primary)]">
                        {formatMoney(modalAccount.aum || 0)}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border)]">
                      <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mb-1">
                        <TrendingUp className="w-3.5 h-3.5 text-[var(--accent)]" /> Funds Utilised
                      </div>
                      <div className="font-bold text-base text-[var(--text-primary)]">
                        {formatMoney(modalAccount.utilised || 0)}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border)]">
                    <div className="text-xs text-[var(--text-muted)] mb-1.5">Stocks In Trade</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(modalAccount.stocks || '')
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .map((stk) => (
                          <span
                            key={stk}
                            className="px-2.5 py-1 text-xs font-mono font-semibold rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)]"
                          >
                            {stk}
                          </span>
                        ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-500/10 border border-slate-500/20 text-xs text-[var(--text-muted)] flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
                    <span>HOD Mode: You have read-only access to privilege account details.</span>
                  </div>

                  <div className="px-5 sm:px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-base)]/50 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setModalAccount(null)}
                      className="px-5 py-2 text-sm font-semibold rounded-xl bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)] transition shadow-sm"
                    >
                      Close View
                    </button>
                  </div>
                </div>
              ) : (
                /* Employee / Admin Editable Form */
                <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
                  <div className="p-5 sm:px-6 py-5 space-y-4 overflow-y-auto flex-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Sl No <span className="font-normal text-[var(--text-muted)]">(automatic)</span></label>
                        <input readOnly value={modalAccount.sl_no ?? 'Generated when saved'} className="w-full px-3.5 py-2 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-muted)] cursor-not-allowed" />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Date <span className="text-rose-500">*</span></label>
                        <input type="date" required value={modalAccount.account_date || ''} onChange={(e) => setModalAccount({ ...modalAccount, account_date: e.target.value })} className="w-full px-3.5 py-2 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition" />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                          Client Code <span className="font-normal text-[var(--text-muted)]">(automatic)</span>
                        </label>
                        <input
                          readOnly
                          value={modalAccount.code || ''}
                          placeholder="Generated when saved (e.g. PA1007)"
                          className="w-full px-3.5 py-2 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-muted)] cursor-not-allowed uppercase font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                          Client Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          required
                          value={modalAccount.name || ''}
                          onChange={(e) => setModalAccount({ ...modalAccount, name: e.target.value })}
                          placeholder="Full legal name"
                          className="w-full px-3.5 py-2 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Mobile No <span className="text-rose-500">*</span></label>
                        <input type="tel" required inputMode="tel" value={modalAccount.mobile_no || ''} onChange={(e) => setModalAccount({ ...modalAccount, mobile_no: e.target.value })} placeholder="10 to 15 digit mobile number" className="w-full px-3.5 py-2 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition" />
                      </div>

                      {([
                        ['scheme', 'Scheme', 'e.g. Privilege'], ['introducer', 'Introducer', 'Introducer name'],
                        ['rm', 'RM', 'Relationship manager'], ['dealer', 'Dealer', 'Dealer name'],
                        ['branch', 'Branch', 'Branch name']
                      ] as const).map(([key, label, placeholder]) => (
                        <div key={key}>
                          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">{label} <span className="font-normal text-[var(--text-muted)]">(optional)</span></label>
                          <input value={modalAccount[key] || ''} onChange={(e) => setModalAccount({ ...modalAccount, [key]: e.target.value })} placeholder={placeholder} className="w-full px-3.5 py-2 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition" />
                        </div>
                      ))}

                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Trading Started <span className="font-normal text-[var(--text-muted)]">(optional)</span></label>
                        <select value={modalAccount.trading_started ? 'yes' : 'no'} onChange={(e) => setModalAccount({ ...modalAccount, trading_started: e.target.value === 'yes' })} className="w-full px-3.5 py-2 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition">
                          <option value="no">No</option><option value="yes">Yes</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                          Location <span className="font-normal text-[var(--text-muted)]">(optional)</span>
                        </label>
                        <input
                          value={modalAccount.location || ''}
                          onChange={(e) => setModalAccount({ ...modalAccount, location: e.target.value })}
                          placeholder="City / Region"
                          className="w-full px-3.5 py-2 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                          Occupation <span className="font-normal text-[var(--text-muted)]">(optional)</span>
                        </label>
                        <input
                          value={modalAccount.occupation || ''}
                          onChange={(e) => setModalAccount({ ...modalAccount, occupation: e.target.value })}
                          placeholder="e.g. Business owner, Doctor"
                          className="w-full px-3.5 py-2 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                          Contact Info <span className="font-normal text-[var(--text-muted)]">(optional)</span>
                        </label>
                        <input
                          value={modalAccount.contact || ''}
                          onChange={(e) => setModalAccount({ ...modalAccount, contact: e.target.value })}
                          placeholder="Phone number or note"
                          className="w-full px-3.5 py-2 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                          AUM (₹) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          required
                          min="0"
                          step="1000"
                          value={modalAccount.aum ?? ''}
                          onChange={(e) => setModalAccount({ ...modalAccount, aum: parseFloat(e.target.value) || 0 })}
                          placeholder="e.g. 5000000"
                          className="w-full px-3.5 py-2 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition tabular-nums"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                          Funds Utilised (₹) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          required
                          min="0"
                          step="1000"
                          value={modalAccount.utilised ?? ''}
                          onChange={(e) => setModalAccount({ ...modalAccount, utilised: parseFloat(e.target.value) || 0 })}
                          placeholder="e.g. 3500000"
                          className="w-full px-3.5 py-2 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition tabular-nums"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                          Return (%) <span className="font-normal text-[var(--text-muted)]">(optional)</span>
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={modalAccount.returns ?? ''}
                          onChange={(e) => setModalAccount({ ...modalAccount, returns: parseFloat(e.target.value) || 0 })}
                          placeholder="e.g. 12.5"
                          className="w-full px-3.5 py-2 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition tabular-nums"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Remarks</label>
                      <textarea rows={3} maxLength={1000} value={modalAccount.remarks || ''} onChange={(e) => setModalAccount({ ...modalAccount, remarks: e.target.value })} placeholder="Optional remarks" className="w-full px-3.5 py-2 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition resize-y" />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Stocks In Trade (comma separated) <span className="font-normal text-[var(--text-muted)]">(optional)</span>
                      </label>
                      <input
                        value={modalAccount.stocks || ''}
                        onChange={(e) => setModalAccount({ ...modalAccount, stocks: e.target.value.toUpperCase() })}
                        placeholder="e.g. HDFCBANK, RELIANCE, TCS"
                        className="w-full px-3.5 py-2 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition uppercase font-mono"
                      />
                    </div>
                  </div>

                  {/* Modal Footer for Employee */}
                  <div className="px-5 sm:px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-base)]/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {modalAccount.code && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setConfirmDelete({
                              type: 'account',
                              id: modalAccount.code!,
                              name: `${modalAccount.name || modalAccount.code} (${modalAccount.code})`
                            });
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 transition border border-rose-500/20"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Account</span>
                        </button>
                      )}
                      <span className="text-xs text-[var(--text-muted)]">Amounts in INR (₹)</span>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setModalAccount(null)}
                        className="px-4 py-2 text-sm font-medium rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition flex-1 sm:flex-initial"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isBusy}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)] transition shadow-sm disabled:opacity-50 flex-1 sm:flex-initial"
                      >
                        {isBusy ? 'Saving…' : 'Save Account'}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ── Modal: Upload Details (Employee/Admin only) ── */}
        {isUploadOpen && canEdit && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fadeIn"
            onClick={() => !isBusy && setIsUploadOpen(false)}
          >
            <div
              className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                    File Upload
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mt-0.5">Upload Details</h2>
                </div>
                <button
                  disabled={isBusy}
                  onClick={() => setIsUploadOpen(false)}
                  className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Upload Body */}
              <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    Upload Type
                  </label>
                  <select
                    value={uploadKind}
                    onChange={(e) => {
                      setUploadKind(e.target.value);
                      setSelectedFile(null);
                    }}
                    className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition"
                  >
                    <option value="Accounts CSV">Accounts CSV (Bulk Import)</option>
                    <option value="Trade log">Trade Log</option>
                    <option value="Account documents">Account Documents</option>
                  </select>
                </div>

                {uploadKind === 'Accounts CSV' ? (
                  <div className="p-3 rounded-xl bg-[var(--accent-bg)] border border-[var(--border-accent)] text-xs text-[var(--text-secondary)] space-y-1.5">
                    <p>
                      Import up to 500 client accounts at once. Existing client codes will be updated.
                    </p>
                    <button
                      type="button"
                      onClick={downloadCSVTemplate}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
                    >
                      <Download className="w-3.5 h-3.5" /> Download CSV template
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-muted)]">
                    Store original trade logs and customer documents securely. Files are accessible to assigned privilege personnel.
                  </p>
                )}

                {/* Dropzone */}
                <label className="border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)] rounded-2xl p-6 sm:p-8 bg-[var(--bg-base)]/50 hover:bg-[var(--accent-bg)]/10 transition flex flex-col items-center justify-center gap-3 cursor-pointer text-center group">
                  <div className="p-3 rounded-full bg-[var(--bg-card)] border border-[var(--border)] group-hover:scale-105 transition">
                    <FileUp className="w-6 h-6 text-[var(--accent)]" />
                  </div>
                  <div>
                    <strong className="block text-sm font-semibold text-[var(--text-primary)] break-all">
                      {selectedFile ? selectedFile.name : 'Choose a file to upload'}
                    </strong>
                    <span className="text-xs text-[var(--text-muted)] mt-1 block">
                      {uploadKind === 'Accounts CSV' ? 'CSV with template headers' : 'CSV, XLSX or PDF'} · Max 10 MB
                    </span>
                  </div>
                  <input
                    key={uploadKind}
                    type="file"
                    className="hidden"
                    accept={uploadKind === 'Accounts CSV' ? '.csv' : '.csv,.xlsx,.xls,.pdf'}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f && f.size > 10 * 1024 * 1024) {
                        toast.error('File size must be under 10 MB.');
                        return;
                      }
                      setSelectedFile(f || null);
                    }}
                  />
                </label>
              </div>

              {/* Modal Footer */}
              <div className="px-5 sm:px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-base)]/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-[var(--text-muted)]">Encrypted & Audit Logged</span>
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setIsUploadOpen(false)}
                    className="px-4 py-2 text-sm font-medium rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition flex-1 sm:flex-initial"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!selectedFile || isBusy}
                    onClick={handleUpload}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)] transition shadow-sm disabled:opacity-50 flex-1 sm:flex-initial"
                  >
                    {isBusy ? 'Uploading…' : 'Upload'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Custom Confirmation Modal (Never uses browser default confirm) ── */}
        {confirmDelete && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
            onClick={() => !isDeleting && setConfirmDelete(null)}
          >
            <div
              className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-md w-full p-6 text-center overflow-hidden transform transition-all animate-scaleIn"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Warning Icon Badge */}
              <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shadow-inner">
                <Trash2 className="w-7 h-7 stroke-[2.2]" />
              </div>

              {/* Title & Description */}
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                {confirmDelete.type === 'account' ? 'Delete Client Account' : 'Delete Uploaded File'}
              </h3>

              <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">
                Are you sure you want to permanently delete{' '}
                <span className="font-semibold text-[var(--text-primary)] break-all">
                  "{confirmDelete.name}"
                </span>
                ?
              </p>

              <div className="mt-3 p-3 rounded-xl bg-rose-500/5 border border-rose-500/15 text-xs text-rose-600 dark:text-rose-400">
                This action cannot be undone and will permanently remove this record from the MIS portal.
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={executeDelete}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition shadow-sm disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Deleting…</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Yes, Delete</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PrivilegeDataEntryPage;
