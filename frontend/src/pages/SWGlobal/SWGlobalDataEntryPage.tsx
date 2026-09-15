import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { swGlobalService } from '../../services/swGlobal.service';
import type {
  SWGlobalAccount,
  SWGlobalEvent,
  SWGlobalLead,
  SWGlobalUpload
} from '../../types/swGlobal.types';
import {
  Users,
  Calendar,
  Target,
  Clock,
  FileUp,
  Search,
  Plus,
  Eye,
  Trash2,
  Edit2,
  RefreshCw,
  X,
  Check,
  CheckCircle2,
  FileText,
  ArrowDownToLine,
  Globe,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import toast from 'react-hot-toast';
import './SWGlobal.css';
import { orgService, type Branch } from '../../services/org.service';
import { authService } from '../../services/auth.service';

type ActiveTab = 'accounts' | 'pending' | 'events' | 'leads' | 'uploads';

const parseCsvRows = (text: string): Record<string, string>[] => {
  const parsed: string[][] = [];
  let row: string[] = [], value = '', quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(value.trim()); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value.trim());
      if (row.some(cell => cell)) parsed.push(row);
      row = []; value = '';
    } else value += char;
  }
  row.push(value.trim());
  if (row.some(cell => cell)) parsed.push(row);
  if (parsed.length < 2) return [];
  const headers = parsed[0].map(header => header.replace(/^\uFEFF/, '').trim().toLowerCase());
  return parsed.slice(1).map(cells => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
};

export const SWGlobalDataEntryPage: React.FC = () => {
  const currentRole = String(authService.getCurrentUser()?.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const canChooseBranch = ['hod', 'ceo', 'managing_director', 'director', 'executive', 'admin'].includes(currentRole);
  const [tab, setTab] = useState<ActiveTab>('accounts');

  const [accounts, setAccounts] = useState<SWGlobalAccount[]>([]);
  const [events, setEvents] = useState<SWGlobalEvent[]>([]);
  const [leads, setLeads] = useState<SWGlobalLead[]>([]);
  const [uploads, setUploads] = useState<SWGlobalUpload[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  // Search & Filters
  const [accountQuery, setAccountQuery] = useState('');
  const [accountStatusFilter, setAccountStatusFilter] = useState('All');
  const [eventQuery, setEventQuery] = useState('');
  const [leadQuery, setLeadQuery] = useState('');
  const [leadStageFilter, setLeadStageFilter] = useState('All');
  const [leadEventFilter, setLeadEventFilter] = useState('All');

  // Modals
  const [accountModal, setAccountModal] = useState<Partial<SWGlobalAccount> | null>(null);
  const [eventModal, setEventModal] = useState<Partial<SWGlobalEvent> | null>(null);
  const [leadModal, setLeadModal] = useState<Partial<SWGlobalLead> | null>(null);
  const [convertModal, setConvertModal] = useState<SWGlobalLead | null>(null);

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<Record<string, string>[] | null>(null);
  const [uploadKind, setUploadKind] = useState<string>('Accounts CSV');
  const csvTemplates: Record<string, { href: string; headers: string }> = {
    'Accounts CSV': {
      href: '/templates/sw-global-accounts-sample.csv',
      headers: 'name, account_no, location, occupation, contact, email, status, pending_reason, followup, branch_name'
    },
    'Leads CSV': {
      href: '/templates/sw-global-leads-sample.csv',
      headers: 'event_id, name, contact, location, stage, notes, followup'
    },
    'Events CSV': {
      href: '/templates/sw-global-events-sample.csv',
      headers: 'title, type, date, status, notes'
    }
  };
  const selectedCsvTemplate = csvTemplates[uploadKind];

  const previewSelectedCsv = async () => {
    if (!selectedFile) return toast.error('Please choose a CSV file first.');
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) return toast.error('Please choose a CSV file for this import type.');
    try {
      const rows = parseCsvRows(await selectedFile.text());
      if (!rows.length) throw new Error('CSV must contain a header row and at least one record.');
      const requiredByKind: Record<string, string[]> = {
        'Accounts CSV': ['name', 'account_no', 'location', 'occupation', 'contact', 'status'],
        'Leads CSV': ['event_id', 'name', 'contact', 'location', 'stage'],
        'Events CSV': ['title', 'type', 'date', 'status']
      };
      const missing = (requiredByKind[uploadKind] || []).filter(header => !(header in rows[0]));
      if (missing.length) throw new Error(`Missing required headers: ${missing.join(', ')}`);
      setCsvPreview(rows);
      toast.success(`${rows.length} record${rows.length === 1 ? '' : 's'} ready to upload`);
    } catch (error: any) {
      setCsvPreview(null);
      toast.error(error.message || 'Could not preview this CSV.');
    }
  };

  // Custom Delete Confirmation Modal
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'account' | 'event' | 'lead' | 'upload';
    id: string;
    name: string;
  } | null>(null);

  const fetchData = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      const [accData, evData, ldData, upData] = await Promise.all([
        swGlobalService.getAccounts(),
        swGlobalService.getEvents(),
        swGlobalService.getLeads(),
        swGlobalService.getUploads()
      ]);
      setAccounts(accData);
      setEvents(evData);
      setLeads(ldData);
      setUploads(upData);
      if (showToast) toast.success('SW Global records updated');
    } catch (err: any) {
      console.error('Error fetching SW Global data:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to load records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (canChooseBranch) {
      orgService.getBranches().then(setBranches).catch(() => toast.error('Could not load branches.'));
    }
  }, [canChooseBranch]);

  const formatDate = (d?: string | null) => {
    if (!d) return 'Not set';
    const parsedDate = new Date(d.includes('T') ? d : `${d}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) return 'Not available';
    return parsedDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getInitials = (name: string) => {
    return (name || 'U')
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // Filtered lists
  const filteredAccounts = useMemo(() => {
    const q = accountQuery.trim().toLowerCase();
    return accounts.filter((a) => {
      const matchesSearch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.account_no.toLowerCase().includes(q) ||
        a.client_code.toLowerCase().includes(q) ||
        a.location.toLowerCase().includes(q) ||
        (a.pending_reason || '').toLowerCase().includes(q);
      const matchesStatus = accountStatusFilter === 'All' || a.status === accountStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [accounts, accountQuery, accountStatusFilter]);

  const pendingAccounts = useMemo(() => {
    const q = accountQuery.trim().toLowerCase();
    return accounts.filter((a) => {
      if (a.status !== 'Pending') return false;
      return (
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.account_no.toLowerCase().includes(q) ||
        a.client_code.toLowerCase().includes(q) ||
        a.location.toLowerCase().includes(q) ||
        (a.pending_reason || '').toLowerCase().includes(q)
      );
    });
  }, [accounts, accountQuery]);

  const filteredEvents = useMemo(() => {
    const q = eventQuery.trim().toLowerCase();
    return events.filter((e) => !q || e.title.toLowerCase().includes(q) || e.type.toLowerCase().includes(q));
  }, [events, eventQuery]);

  const filteredLeads = useMemo(() => {
    const q = leadQuery.trim().toLowerCase();
    return leads.filter((l) => {
      const matchesSearch =
        !q ||
        l.name.toLowerCase().includes(q) ||
        l.contact.toLowerCase().includes(q) ||
        l.location.toLowerCase().includes(q) ||
        (l.event_title || '').toLowerCase().includes(q);
      const matchesStage = leadStageFilter === 'All' || l.stage === leadStageFilter;
      const matchesEvent = leadEventFilter === 'All' || l.event_id === leadEventFilter;
      return matchesSearch && matchesStage && matchesEvent;
    });
  }, [leads, leadQuery, leadStageFilter, leadEventFilter]);

  // Handlers for Account
  const handleSaveAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsBusy(true);
    const formData = new FormData(e.currentTarget);
    const payload: Partial<SWGlobalAccount> = {
      id: accountModal?.id,
      name: String(formData.get('name') || '').trim(),
      client_code: String(formData.get('client_code') || '').trim().toUpperCase(),
      account_no: String(formData.get('account_no') || '').trim().toUpperCase(),
      location: String(formData.get('location') || '').trim(),
      occupation: String(formData.get('occupation') || '').trim(),
      contact: String(formData.get('contact') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      status: formData.get('status') as any,
      branch_id: String(formData.get('branch_id') || '').trim() || null,
      pending_reason: String(formData.get('pending_reason') || '').trim(),
      followup: formData.get('followup') ? String(formData.get('followup')) : null
    };

    try {
      await swGlobalService.saveAccount(payload);
      toast.success(accountModal?.id ? 'Account updated successfully' : 'New client account created');
      setAccountModal(null);
      await fetchData();
    } catch (err: any) {
      console.error('Error saving account:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to save account.');
    } finally {
      setIsBusy(false);
    }
  };

  // Handlers for Event
  const handleSaveEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsBusy(true);
    const formData = new FormData(e.currentTarget);
    const payload: Partial<SWGlobalEvent> = {
      id: eventModal?.id,
      title: String(formData.get('title') || '').trim(),
      type: formData.get('type') as any,
      date: String(formData.get('date') || '').trim(),
      status: formData.get('status') as any,
      notes: String(formData.get('notes') || '').trim()
    };

    try {
      await swGlobalService.saveEvent(payload);
      toast.success(eventModal?.id ? 'Event updated successfully' : 'New event created');
      setEventModal(null);
      await fetchData();
    } catch (err: any) {
      console.error('Error saving event:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to save event.');
    } finally {
      setIsBusy(false);
    }
  };

  // Handlers for Lead
  const handleSaveLead = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsBusy(true);
    const formData = new FormData(e.currentTarget);
    const payload: Partial<SWGlobalLead> = {
      id: leadModal?.id,
      event_id: String(formData.get('event_id') || '').trim(),
      name: String(formData.get('name') || '').trim(),
      contact: String(formData.get('contact') || '').trim(),
      location: String(formData.get('location') || '').trim(),
      stage: formData.get('stage') as any,
      followup: formData.get('followup') ? String(formData.get('followup')) : null,
      notes: String(formData.get('notes') || '').trim()
    };

    try {
      await swGlobalService.saveLead(payload);
      toast.success(leadModal?.id ? 'Lead updated successfully' : 'New lead added to pipeline');
      setLeadModal(null);
      await fetchData();
    } catch (err: any) {
      console.error('Error saving lead:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to save lead.');
    } finally {
      setIsBusy(false);
    }
  };

  // Handlers for Lead Conversion
  const handleConvertLead = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!convertModal) return;
    setIsBusy(true);
    const formData = new FormData(e.currentTarget);
    const payload = {
      lead_id: convertModal.id,
      account_no: String(formData.get('account_no') || '').trim().toUpperCase(),
      client_code: String(formData.get('client_code') || '').trim().toUpperCase(),
      occupation: String(formData.get('occupation') || '').trim(),
      email: String(formData.get('email') || '').trim()
    };

    try {
      await swGlobalService.convertLead(payload);
      toast.success('Lead converted successfully! Active account created.');
      setConvertModal(null);
      await fetchData();
    } catch (err: any) {
      console.error('Error converting lead:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to convert lead.');
    } finally {
      setIsBusy(false);
    }
  };

  // Deletion execution
  const executeDelete = async () => {
    if (!confirmDelete) return;
    setIsBusy(true);
    try {
      if (confirmDelete.type === 'account') {
        await swGlobalService.deleteAccount(confirmDelete.id);
        toast.success(`Account ${confirmDelete.name} deleted`);
      } else if (confirmDelete.type === 'event') {
        await swGlobalService.deleteEvent(confirmDelete.id);
        toast.success(`Event ${confirmDelete.name} deleted`);
      } else if (confirmDelete.type === 'lead') {
        await swGlobalService.deleteLead(confirmDelete.id);
        toast.success(`Lead ${confirmDelete.name} deleted`);
      } else if (confirmDelete.type === 'upload') {
        await swGlobalService.deleteUpload(confirmDelete.id);
        toast.success(`File ${confirmDelete.name} deleted`);
      }
      setConfirmDelete(null);
      await fetchData();
    } catch (err: any) {
      console.error('Error deleting record:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to delete record.');
    } finally {
      setIsBusy(false);
    }
  };

  // File Upload
  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please select a file to upload.');
      return;
    }

    setIsBusy(true);
    try {
      let importedCount = 0;
      if (uploadKind === 'Accounts CSV') {
        if (!selectedFile.name.toLowerCase().endsWith('.csv')) throw new Error('Accounts bulk import requires a CSV file.');
        const rows = parseCsvRows(await selectedFile.text());
        const requiredHeaders = ['name', 'account_no', 'location', 'occupation', 'contact', 'status'];
        const missing = requiredHeaders.filter(header => !rows.length || !(header in rows[0]));
        if (missing.length) throw new Error(`Missing required headers: ${missing.join(', ')}`);
        const result = await swGlobalService.bulkImportAccounts(rows as Partial<SWGlobalAccount>[]);
        importedCount = result.count;
      }
      await swGlobalService.uploadFile(selectedFile, uploadKind);
      toast.success(importedCount
        ? `${importedCount} accounts imported and file saved successfully`
        : `File "${selectedFile.name}" uploaded successfully`);
      setSelectedFile(null);
      setCsvPreview(null);
      await fetchData();
    } catch (err: any) {
      console.error('Error uploading file:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to upload file.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="sw-global-container space-y-6 px-4 pt-4 sm:px-6 sm:pt-6 pb-12">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
              <span>SW Global Department</span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-[var(--accent)] font-bold">Data Entry & Operations</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
              SW Global Account Workspace
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              Manage client accounts, record event outcomes, advance lead pipeline, and resolve pending cases.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>

            <Link
              to={ROUTES.SW_GLOBAL_DASHBOARD}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition shadow-sm"
            >
              <Globe className="w-4 h-4 text-[var(--accent)]" />
              Executive Dashboard
            </Link>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-3">
          <button
            onClick={() => setTab('accounts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              tab === 'accounts'
                ? 'bg-[var(--accent)] text-slate-950 shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <Users className="w-4 h-4" />
            Client Accounts ({accounts.length})
          </button>

          <button
            onClick={() => setTab('pending')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              tab === 'pending'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-amber-500 hover:bg-[var(--bg-hover)]'
            }`}
          >
            <Clock className="w-4 h-4" />
            Pending Applications ({accounts.filter((a) => a.status === 'Pending').length})
          </button>

          <button
            onClick={() => setTab('events')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              tab === 'events'
                ? 'bg-[var(--accent)] text-slate-950 shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Events & Webinars ({events.length})
          </button>

          <button
            onClick={() => setTab('leads')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              tab === 'leads'
                ? 'bg-[var(--accent)] text-slate-950 shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <Target className="w-4 h-4" />
            Leads Pipeline ({leads.length})
          </button>

          <button
            onClick={() => setTab('uploads')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              tab === 'uploads'
                ? 'bg-[var(--accent)] text-slate-950 shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <FileUp className="w-4 h-4" />
            Uploads & CSV ({uploads.length})
          </button>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="py-16 text-center">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-[var(--accent)] mb-3" />
            <p className="text-sm font-semibold text-[var(--text-secondary)]">Loading workspace records...</p>
          </div>
        )}

        {!loading && (
          <>
            {/* ── TAB 1: CLIENT ACCOUNTS ── */}
            {tab === 'accounts' && (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                      Client Account Directory
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Enter and manage client details. Reusing a client code links multiple accounts to the same client record.
                    </p>
                  </div>

                  <button
                    onClick={() => setAccountModal({ status: 'Active' })}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)] transition shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Add Account
                  </button>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                    <div className="relative w-full sm:w-80">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                      <input
                        type="text"
                        placeholder="Search name, code, account or location..."
                        value={accountQuery}
                        onChange={(e) => setAccountQuery(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                      />
                    </div>

                    <select
                      value={accountStatusFilter}
                      onChange={(e) => setAccountStatusFilter(e.target.value)}
                      className="px-3 py-2 text-xs rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                    >
                      <option value="All">All Statuses</option>
                      <option value="Active">Active</option>
                      <option value="Pending">Pending</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>

                  <span className="text-xs text-[var(--text-muted)]">
                    Showing {filteredAccounts.length} of {accounts.length} accounts
                  </span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                        <th className="pb-2.5">Client Name</th>
                        <th className="min-w-32 pb-2.5">Account No</th>
                        <th className="pb-2.5">Location</th>
                        <th className="pb-2.5">Occupation</th>
                        <th className="pb-2.5">Contact</th>
                        <th className="pb-2.5">Status</th>
                        <th className="pb-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {filteredAccounts.map((a) => (
                        <tr key={a.id} className="hover:bg-[var(--bg-hover)]/50 transition">
                          <td className="py-3 font-semibold text-[var(--text-primary)]">
                            <div className="flex items-center gap-2">
                              <div className="sw-avatar">{getInitials(a.name)}</div>
                              <div>
                                <div className="font-bold">{a.name}</div>
                                <div className="text-[11px] text-[var(--text-muted)]">{a.client_code}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="inline-flex whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-2.5 py-1 font-sans text-[11px] font-bold tracking-wide text-[var(--text-primary)] tabular-nums">
                              {a.account_no}
                            </span>
                          </td>
                          <td className="py-3 text-[var(--text-secondary)]">{a.location}</td>
                          <td className="py-3 text-[var(--text-secondary)]">{a.occupation}</td>
                          <td className="py-3 text-[var(--text-secondary)]">{a.contact}</td>
                          <td className="py-3">
                            <span className={`sw-tag ${a.status.toLowerCase()}`}>{a.status}</span>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setAccountModal(a)}
                                className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-base)] text-[var(--text-primary)] transition"
                                title="Edit account"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setConfirmDelete({ type: 'account', id: a.id, name: `${a.name} (${a.account_no})` })}
                                className="p-1.5 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 transition"
                                title="Delete account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredAccounts.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-[var(--text-muted)]">
                            <Users className="w-8 h-8 mx-auto opacity-30 mb-2" />
                            No accounts found. Click "Add Account" to create your first record.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── TAB 2: PENDING APPLICATIONS ── */}
            {tab === 'pending' && (
              <div className="bg-[var(--bg-card)] border border-amber-500/30 rounded-2xl shadow-sm overflow-hidden p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-amber-500 flex items-center gap-2">
                      <Clock className="w-5 h-5" /> Pending Applications Focus
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Review open cases, update pending reasons, and mark accounts as Active once requirements are complete.
                    </p>
                  </div>

                  <button
                    onClick={() => setAccountModal({ status: 'Pending' })}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 transition shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Add Pending Case
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                        <th className="pb-2.5">Client</th>
                        <th className="min-w-32 pb-2.5">Account No</th>
                        <th className="pb-2.5">Location</th>
                        <th className="pb-2.5">Pending Reason</th>
                        <th className="pb-2.5">Next Follow-up</th>
                        <th className="pb-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {pendingAccounts.map((a) => (
                        <tr key={a.id} className="hover:bg-[var(--bg-hover)]/50 transition">
                          <td className="py-3 font-semibold text-[var(--text-primary)]">
                            <div className="flex items-center gap-2">
                              <div className="sw-avatar">{getInitials(a.name)}</div>
                              <div>
                                <div className="font-bold">{a.name}</div>
                                <div className="text-[11px] text-[var(--text-muted)]">{a.client_code}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="inline-flex whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-2.5 py-1 font-sans text-[11px] font-bold tracking-wide text-[var(--text-primary)] tabular-nums">
                              {a.account_no}
                            </span>
                          </td>
                          <td className="py-3 text-[var(--text-secondary)]">{a.location}</td>
                          <td className="py-3 text-amber-500 font-semibold">{a.pending_reason || 'Pending verification'}</td>
                          <td className="py-3 text-[var(--text-secondary)]">{formatDate(a.followup)}</td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setAccountModal(a)}
                                className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-slate-950 font-bold hover:bg-[var(--accent-hover)] transition flex items-center gap-1 text-[11px]"
                              >
                                <Edit2 className="w-3 h-3" /> Update Status
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {pendingAccounts.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-emerald-500 font-semibold">
                            <CheckCircle2 className="w-8 h-8 mx-auto opacity-50 mb-2" />
                            All pending applications are clear! No open cases requiring follow-up.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── TAB 3: EVENTS & WEBINARS ── */}
            {tab === 'events' && (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                      Events & Webinar Register
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Track webinars, seminars, and client meetings. Lead-to-account conversions are automatically attributed.
                    </p>
                  </div>

                  <button
                    onClick={() => setEventModal({ type: 'Webinar', status: 'Planned' })}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)] transition shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Add Event
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      placeholder="Search event title or type..."
                      value={eventQuery}
                      onChange={(e) => setEventQuery(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                    />
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">
                    Showing {filteredEvents.length} of {events.length} events
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                        <th className="pb-2.5">Event Name</th>
                        <th className="pb-2.5">Type</th>
                        <th className="pb-2.5">Date</th>
                        <th className="pb-2.5">Status</th>
                        <th className="pb-2.5">Total Leads</th>
                        <th className="pb-2.5">Converted</th>
                        <th className="pb-2.5">Conversion Ratio</th>
                        <th className="pb-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {filteredEvents.map((e) => (
                        <tr key={e.id} className="hover:bg-[var(--bg-hover)]/50 transition">
                          <td className="py-3 font-bold text-[var(--text-primary)]">{e.title}</td>
                          <td className="py-3 text-[var(--text-secondary)]">{e.type}</td>
                          <td className="py-3 text-[var(--text-secondary)]">{formatDate(e.date)}</td>
                          <td className="py-3">
                            <span className={`sw-tag ${e.status.toLowerCase()}`}>{e.status}</span>
                          </td>
                          <td className="py-3 font-semibold text-[var(--text-primary)]">{e.leads_count || 0}</td>
                          <td className="py-3 font-semibold text-emerald-500">{e.converted_count || 0}</td>
                          <td className="py-3 font-bold text-[var(--text-primary)]">
                            {e.conversion_ratio !== undefined ? `${e.conversion_ratio}%` : '—'}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setTab('leads');
                                  setLeadEventFilter(e.id);
                                }}
                                className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-[var(--accent)] hover:bg-[var(--bg-base)] text-[11px] font-semibold"
                                title="View event leads"
                              >
                                Leads
                              </button>
                              <button
                                onClick={() => setEventModal(e)}
                                className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-base)] text-[var(--text-primary)] transition"
                                title="Edit event"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setConfirmDelete({ type: 'event', id: e.id, name: e.title })}
                                className="p-1.5 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 transition"
                                title="Delete event"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredEvents.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-[var(--text-muted)]">
                            <Calendar className="w-8 h-8 mx-auto opacity-30 mb-2" />
                            No events planned. Click "Add Event" to create one.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── TAB 4: LEADS PIPELINE ── */}
            {tab === 'leads' && (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                      Lead Pipeline & Opportunities
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Log webinar attendees, manage follow-up stages, and convert qualified leads into active accounts in one click.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      if (events.length === 0) {
                        toast.error('Please create an event before adding leads.');
                        return;
                      }
                      setLeadModal({ stage: 'New', event_id: events[0].id });
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)] transition shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Add Lead
                  </button>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                      <input
                        type="text"
                        placeholder="Search lead or contact..."
                        value={leadQuery}
                        onChange={(e) => setLeadQuery(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                      />
                    </div>

                    <select
                      value={leadStageFilter}
                      onChange={(e) => setLeadStageFilter(e.target.value)}
                      className="px-3 py-2 text-xs rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                    >
                      <option value="All">All Stages</option>
                      <option value="New">New</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Qualified">Qualified</option>
                      <option value="Converted">Converted</option>
                      <option value="Not interested">Not interested</option>
                    </select>

                    <select
                      value={leadEventFilter}
                      onChange={(e) => setLeadEventFilter(e.target.value)}
                      className="px-3 py-2 text-xs rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none max-w-[200px]"
                    >
                      <option value="All">All Events</option>
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <span className="text-xs text-[var(--text-muted)]">
                    Showing {filteredLeads.length} of {leads.length} leads
                  </span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                        <th className="pb-2.5">Lead Name</th>
                        <th className="pb-2.5">Event Source</th>
                        <th className="pb-2.5">Location</th>
                        <th className="pb-2.5">Contact</th>
                        <th className="pb-2.5">Stage</th>
                        <th className="pb-2.5">Next Follow-up</th>
                        <th className="pb-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {filteredLeads.map((l) => (
                        <tr key={l.id} className="hover:bg-[var(--bg-hover)]/50 transition">
                          <td className="py-3 font-bold text-[var(--text-primary)]">{l.name}</td>
                          <td className="py-3 text-[var(--text-secondary)]">{l.event_title || 'Event'}</td>
                          <td className="py-3 text-[var(--text-secondary)]">{l.location}</td>
                          <td className="py-3 text-[var(--text-secondary)]">{l.contact}</td>
                          <td className="py-3">
                            <span className={`sw-tag ${l.stage.toLowerCase().replace(' ', '-')}`}>
                              {l.stage}
                            </span>
                          </td>
                          <td className="py-3 text-[var(--text-secondary)]">{formatDate(l.followup)}</td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {l.stage !== 'Converted' ? (
                                <button
                                  onClick={() => setConvertModal(l)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition flex items-center gap-1 text-[11px]"
                                >
                                  <Sparkles className="w-3 h-3" /> Convert
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500 px-2 py-1 bg-emerald-500/10 rounded-lg">
                                  <Check className="w-3 h-3" /> Converted
                                </span>
                              )}
                              <button
                                onClick={() => setLeadModal(l)}
                                className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-base)] text-[var(--text-primary)] transition"
                                title="Edit lead"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setConfirmDelete({ type: 'lead', id: l.id, name: l.name })}
                                className="p-1.5 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 transition"
                                title="Delete lead"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredLeads.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-[var(--text-muted)]">
                            <Target className="w-8 h-8 mx-auto opacity-30 mb-2" />
                            No leads in this view. Click "Add Lead" to enter prospects.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── TAB 5: UPLOADS & CSV IMPORT ── */}
            {tab === 'uploads' && (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden p-5 sm:p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                      Uploaded Documents & Batch Imports
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Upload account statements, CSV spreadsheets (up to 10 MB per file), and compliance documents.
                    </p>
                  </div>
                </div>

                {/* Upload Form */}
                <form onSubmit={handleFileUpload} className="p-4 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    Upload New Document / CSV
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">File Type</label>
                      <select
                        value={uploadKind}
                        onChange={(e) => { setUploadKind(e.target.value); setSelectedFile(null); setCsvPreview(null); }}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                      >
                        <option value="Accounts CSV">Accounts CSV</option>
                        <option value="Leads CSV">Leads CSV</option>
                        <option value="Events CSV">Events CSV</option>
                        <option value="Account documents">Account documents</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">Choose File</label>
                      <input
                        type="file"
                        onChange={(e) => { setSelectedFile(e.target.files?.[0] || null); setCsvPreview(null); }}
                        accept=".csv,.xlsx,.xls,.pdf"
                        className="w-full px-3 py-1.5 text-xs rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[var(--accent)] file:text-slate-950 hover:file:bg-[var(--accent-hover)]"
                      />
                    </div>
                  </div>

                  {selectedCsvTemplate && (
                    <div className="flex flex-col gap-3 rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--text-primary)]">CSV format and required headers</p>
                        <p className="mt-1 break-words font-mono text-[10px] leading-5 text-[var(--text-muted)]">
                          {selectedCsvTemplate.headers}
                        </p>
                      </div>
                      <a
                        href={selectedCsvTemplate.href}
                        download
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--accent)]/30 bg-[var(--bg-card)] px-3.5 py-2 text-xs font-bold text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-slate-950"
                      >
                        <ArrowDownToLine className="h-4 w-4" /> Download Sample CSV
                      </a>
                    </div>
                  )}

                  {selectedCsvTemplate && selectedFile && !csvPreview && (
                    <button
                      type="button"
                      onClick={previewSelectedCsv}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--accent)] px-4 py-2.5 text-xs font-bold text-[var(--accent)] transition hover:bg-[var(--accent)]/10"
                    >
                      <Eye className="h-4 w-4" /> Preview & Validate CSV
                    </button>
                  )}

                  {csvPreview && (
                    <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                      <div className="bg-[var(--accent)]/10 px-3 py-2 text-xs font-bold text-[var(--accent)]">
                        Preview: {csvPreview.length} record{csvPreview.length === 1 ? '' : 's'} ready
                      </div>
                      <div className="max-h-52 overflow-auto">
                        <table className="w-full text-left text-[11px]">
                          <thead className="sticky top-0 bg-[var(--bg-card)]"><tr>{Object.keys(csvPreview[0] || {}).slice(0, 6).map(header => <th key={header} className="whitespace-nowrap p-2 font-bold uppercase">{header}</th>)}</tr></thead>
                          <tbody>{csvPreview.slice(0, 5).map((row, index) => <tr key={index} className="border-t border-[var(--border)]">{Object.keys(csvPreview[0] || {}).slice(0, 6).map(header => <td key={header} className="whitespace-nowrap p-2 text-[var(--text-secondary)]">{row[header] || '—'}</td>)}</tr>)}</tbody>
                        </table>
                      </div>
                      {csvPreview.length > 5 && <p className="px-3 py-2 text-[10px] text-[var(--text-muted)]">Showing first 5 of {csvPreview.length} records.</p>}
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isBusy || !selectedFile || (!!selectedCsvTemplate && !csvPreview)}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)] disabled:opacity-50 transition"
                    >
                      {isBusy ? 'Uploading...' : csvPreview ? `Upload ${csvPreview.length} Records` : 'Upload File'}
                    </button>
                  </div>
                </form>

                {/* Uploaded Files Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                        <th className="pb-2.5">File Name</th>
                        <th className="pb-2.5">Kind</th>
                        <th className="pb-2.5">Size</th>
                        <th className="pb-2.5">Upload Date</th>
                        <th className="pb-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {uploads.map((u) => (
                        <tr key={u.id} className="hover:bg-[var(--bg-hover)]/50 transition">
                          <td className="py-3 font-semibold text-[var(--text-primary)] flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[var(--accent)] shrink-0" />
                            <span className="truncate max-w-xs">{u.name}</span>
                          </td>
                          <td className="py-3 text-[var(--text-secondary)]">{u.kind}</td>
                          <td className="py-3 text-[var(--text-muted)]">
                            {(u.file_size || 0) < 1024
                              ? `${u.file_size || 0} B`
                              : `${((u.file_size || 0) / 1024).toFixed(1)} KB`}
                          </td>
                          <td className="py-3 text-[var(--text-secondary)]">{formatDate(u.created_at)}</td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <a
                                href={swGlobalService.getViewUrl(u.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-base)] text-[var(--text-primary)] transition"
                                title="View file"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </a>
                              <a
                                href={swGlobalService.getDownloadUrl(u.id)}
                                download
                                className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-base)] text-[var(--text-primary)] transition"
                                title="Download file"
                              >
                                <ArrowDownToLine className="w-3.5 h-3.5" />
                              </a>
                              <button
                                onClick={() => setConfirmDelete({ type: 'upload', id: u.id, name: u.name })}
                                className="p-1.5 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 transition"
                                title="Delete file"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {uploads.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-[var(--text-muted)]">
                            <FileUp className="w-8 h-8 mx-auto opacity-30 mb-2" />
                            No uploaded files recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── MODAL: ADD / EDIT ACCOUNT ── */}
        {accountModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
              <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                    SW Global Account
                  </span>
                  <h3 className="text-base font-bold text-[var(--text-primary)] mt-0.5">
                    {accountModal.id ? 'Edit Client Account' : 'Add Client Account'}
                  </h3>
                </div>
                <button
                  onClick={() => setAccountModal(null)}
                  className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveAccount} className="p-5 space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[var(--text-muted)] font-semibold mb-1">Client Name *</label>
                    <input
                      name="name"
                      defaultValue={accountModal.name || ''}
                      required
                      placeholder="e.g. Arjun Mehta"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[var(--text-muted)] font-semibold mb-1">Client Code *</label>
                    <input
                      name="client_code"
                      defaultValue={accountModal.client_code || ''}
                      readOnly
                      placeholder="Automatic"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] uppercase font-semibold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[var(--text-muted)] font-semibold mb-1">Account Number *</label>
                    <input
                      name="account_no"
                      defaultValue={accountModal.account_no || ''}
                      required
                      placeholder="e.g. SW-001"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] uppercase font-mono font-semibold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[var(--text-muted)] font-semibold mb-1">Account Status *</label>
                    <select
                      name="status"
                      defaultValue={accountModal.status || 'Active'}
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                    >
                      <option value="Active">Active</option>
                      <option value="Pending">Pending</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>

                  {canChooseBranch && <div className="col-span-2">
                    <label className="block text-[var(--text-muted)] font-semibold mb-1">Branch *</label>
                    <select
                      name="branch_id"
                      defaultValue={accountModal.branch_id || ''}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                    >
                      <option value="" disabled>Select branch</option>
                      {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                    </select>
                  </div>}

                  <div>
                    <label className="block text-[var(--text-muted)] font-semibold mb-1">Location *</label>
                    <input
                      name="location"
                      defaultValue={accountModal.location || ''}
                      required
                      placeholder="e.g. Mumbai"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[var(--text-muted)] font-semibold mb-1">Occupation *</label>
                    <input
                      name="occupation"
                      defaultValue={accountModal.occupation || ''}
                      required
                      placeholder="e.g. Consultant"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[var(--text-muted)] font-semibold mb-1">Contact / Phone *</label>
                    <input
                      name="contact"
                      defaultValue={accountModal.contact || ''}
                      required
                      placeholder="e.g. 9820011001"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[var(--text-muted)] font-semibold mb-1">Email (Optional)</label>
                    <input
                      name="email"
                      type="email"
                      defaultValue={accountModal.email || ''}
                      placeholder="e.g. client@example.com"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[var(--text-muted)] font-semibold mb-1">
                      Pending Reason (Required when status is Pending)
                    </label>
                    <input
                      name="pending_reason"
                      defaultValue={accountModal.pending_reason || ''}
                      placeholder="e.g. KYC documents awaited / Signature pending"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[var(--text-muted)] font-semibold mb-1">
                      Next Follow-up Date (Optional)
                    </label>
                    <input
                      name="followup"
                      type="date"
                      defaultValue={accountModal.followup || ''}
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[var(--bg-base)] text-[11px] text-[var(--text-muted)]">
                  <strong>Tip:</strong> Reusing a client code applies updated client details (name, location, occupation, contact) across all accounts under that code.
                </div>

                <div className="pt-3 border-t border-[var(--border)] flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAccountModal(null)}
                    className="px-4 py-2 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isBusy}
                    className="px-4 py-2 rounded-xl bg-[var(--accent)] text-slate-950 font-bold hover:bg-[var(--accent-hover)] transition"
                  >
                    {isBusy ? 'Saving...' : 'Save Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL: ADD / EDIT EVENT ── */}
        {eventModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
              <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                    Event Management
                  </span>
                  <h3 className="text-base font-bold text-[var(--text-primary)] mt-0.5">
                    {eventModal.id ? 'Edit Event / Webinar' : 'Add Event / Webinar'}
                  </h3>
                </div>
                <button
                  onClick={() => setEventModal(null)}
                  className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEvent} className="p-5 space-y-3.5 text-xs">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[var(--text-muted)] font-semibold mb-1">Event Title *</label>
                    <input
                      name="title"
                      defaultValue={eventModal.title || ''}
                      required
                      placeholder="e.g. Global Investing Essentials"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[var(--text-muted)] font-semibold mb-1">Event Type *</label>
                      <select
                        name="type"
                        defaultValue={eventModal.type || 'Webinar'}
                        className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                      >
                        <option value="Webinar">Webinar</option>
                        <option value="Seminar">Seminar</option>
                        <option value="Client meet">Client meet</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[var(--text-muted)] font-semibold mb-1">Event Date *</label>
                      <input
                        name="date"
                        type="date"
                        defaultValue={eventModal.date || ''}
                        required
                        className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[var(--text-muted)] font-semibold mb-1">Status *</label>
                    <select
                      name="status"
                      defaultValue={eventModal.status || 'Planned'}
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                    >
                      <option value="Planned">Planned</option>
                      <option value="Conducted">Conducted</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[var(--text-muted)] font-semibold mb-1">Notes / Highlights</label>
                    <textarea
                      name="notes"
                      defaultValue={eventModal.notes || ''}
                      rows={3}
                      placeholder="Enter event agenda or target audience..."
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--border)] flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEventModal(null)}
                    className="px-4 py-2 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isBusy}
                    className="px-4 py-2 rounded-xl bg-[var(--accent)] text-slate-950 font-bold hover:bg-[var(--accent-hover)] transition"
                  >
                    {isBusy ? 'Saving...' : 'Save Event'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL: ADD / EDIT LEAD ── */}
        {leadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
              <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                    Lead Entry
                  </span>
                  <h3 className="text-base font-bold text-[var(--text-primary)] mt-0.5">
                    {leadModal.id ? 'Edit Lead Prospect' : 'Add Lead Prospect'}
                  </h3>
                </div>
                <button
                  onClick={() => setLeadModal(null)}
                  className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveLead} className="p-5 space-y-3.5 text-xs">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[var(--text-muted)] font-semibold mb-1">Source Event *</label>
                    <select
                      name="event_id"
                      defaultValue={leadModal.event_id || (events[0]?.id || '')}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                    >
                      {events.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.title} ({e.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[var(--text-muted)] font-semibold mb-1">Lead Name *</label>
                      <input
                        name="name"
                        defaultValue={leadModal.name || ''}
                        required
                        placeholder="e.g. Dev Patel"
                        className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[var(--text-muted)] font-semibold mb-1">Contact / Phone *</label>
                      <input
                        name="contact"
                        defaultValue={leadModal.contact || ''}
                        required
                        placeholder="e.g. 9824011006"
                        className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[var(--text-muted)] font-semibold mb-1">Location *</label>
                      <input
                        name="location"
                        defaultValue={leadModal.location || ''}
                        required
                        placeholder="e.g. Ahmedabad"
                        className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[var(--text-muted)] font-semibold mb-1">Stage *</label>
                      <select
                        name="stage"
                        defaultValue={leadModal.stage || 'New'}
                        className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                      >
                        <option value="New">New</option>
                        <option value="Contacted">Contacted</option>
                        <option value="Qualified">Qualified</option>
                        <option value="Not interested">Not interested</option>
                        {leadModal.stage === 'Converted' && <option value="Converted">Converted</option>}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[var(--text-muted)] font-semibold mb-1">Follow-up Date (Optional)</label>
                    <input
                      name="followup"
                      type="date"
                      defaultValue={leadModal.followup || ''}
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[var(--text-muted)] font-semibold mb-1">Notes</label>
                    <textarea
                      name="notes"
                      defaultValue={leadModal.notes || ''}
                      rows={2}
                      placeholder="e.g. Requested account documentation and fee structure"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--border)] flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setLeadModal(null)}
                    className="px-4 py-2 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isBusy}
                    className="px-4 py-2 rounded-xl bg-[var(--accent)] text-slate-950 font-bold hover:bg-[var(--accent-hover)] transition"
                  >
                    {isBusy ? 'Saving...' : 'Save Lead'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL: CONVERT LEAD TO ACTIVE ACCOUNT ── */}
        {convertModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-[var(--bg-card)] border border-emerald-500/40 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
              <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-emerald-500/10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500 text-slate-950 font-bold">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                      Lead Conversion
                    </span>
                    <h3 className="text-base font-bold text-[var(--text-primary)] mt-0.5">
                      Convert {convertModal.name} to Account
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setConvertModal(null)}
                  className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConvertLead} className="p-5 space-y-3.5 text-xs">
                {/* Lead Summary Info */}
                <div className="p-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] space-y-1">
                  <div className="font-bold text-[var(--text-primary)] text-sm">{convertModal.name}</div>
                  <div className="text-[var(--text-secondary)]">
                    Contact: {convertModal.contact} · Location: {convertModal.location}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[var(--text-muted)] font-semibold mb-1">New Account Number *</label>
                      <input
                        name="account_no"
                        required
                        placeholder="e.g. SW-007"
                        className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] uppercase font-mono font-bold outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[var(--text-muted)] font-semibold mb-1">Client Code *</label>
                      <input
                        name="client_code"
                        readOnly
                        placeholder="Automatic"
                        className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] uppercase font-bold outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[var(--text-muted)] font-semibold mb-1">Occupation</label>
                      <input
                        name="occupation"
                        placeholder="e.g. Entrepreneur"
                        className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[var(--text-muted)] font-semibold mb-1">Email (Optional)</label>
                      <input
                        name="email"
                        type="email"
                        placeholder="e.g. client@example.com"
                        className="w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/10 text-[11px] text-emerald-600 dark:text-emerald-400">
                  <strong>Conversion Effect:</strong> This action creates an Active client account and marks this lead as Converted in the pipeline. The event conversion ratio will recalculate automatically.
                </div>

                <div className="pt-3 border-t border-[var(--border)] flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConvertModal(null)}
                    className="px-4 py-2 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isBusy}
                    className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition shadow-sm"
                  >
                    {isBusy ? 'Converting...' : 'Create Account & Convert'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL: CUSTOM DELETE CONFIRMATION ── */}
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-[var(--bg-card)] border border-red-500/30 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-red-500/10 text-red-500">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">Confirm Deletion</h3>
                  <p className="text-xs text-[var(--text-muted)]">This action cannot be undone.</p>
                </div>
              </div>

              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Are you sure you want to delete <strong className="text-[var(--text-primary)]">{confirmDelete.name}</strong>?
              </p>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                >
                  Cancel
                </button>
                <button
                  onClick={executeDelete}
                  disabled={isBusy}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-red-500 text-white hover:bg-red-600 transition"
                >
                  {isBusy ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SWGlobalDataEntryPage;
