import React, { useState, useEffect, useMemo, useRef } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { swGlobalService } from '../../services/swGlobal.service';
import type {
  SWGlobalDashboardStats,
  SWGlobalAccount,
  SWGlobalEvent,
  SWGlobalLead
} from '../../types/swGlobal.types';
import {
  Users,
  Globe,
  Clock,
  Target,
  Calendar,
  Search,
  ArrowUpRight,
  Eye,
  RefreshCw,
  X,
  ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import toast from 'react-hot-toast';
import './SWGlobal.css';
import SWGlobalReports from './SWGlobalReports';
import { authService } from '../../services/auth.service';
import { orgService, type Branch } from '../../services/org.service';

export const SWGlobalDashboardPage: React.FC = () => {
  const currentUser = authService.getCurrentUser();
  const currentRole = String(currentUser?.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const readOnly = ['admin', 'ceo'].includes(currentRole);
  const canViewAllBranches = ['hod', 'ceo', 'managing_director', 'director', 'executive', 'admin'].includes(currentRole);
  const [stats, setStats] = useState<SWGlobalDashboardStats | null>(null);
  const [accounts, setAccounts] = useState<SWGlobalAccount[]>([]);
  const [events, setEvents] = useState<SWGlobalEvent[]>([]);
  const [leads, setLeads] = useState<SWGlobalLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const fetchSequence = useRef(0);

  // Tab for detail registers
  const [activeTab, setActiveTab] = useState<'events' | 'accounts' | 'leads'>('events');

  // Filters & Search
  const [accountSearch, setAccountSearch] = useState('');
  const [accountStatusFilter, setAccountStatusFilter] = useState('All');
  const [eventSearch, setEventSearch] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [leadStageFilter, setLeadStageFilter] = useState('All');
  const [leadEventFilter, setLeadEventFilter] = useState<string>('All');

  // Modals for inspection
  const [selectedAccount, setSelectedAccount] = useState<SWGlobalAccount | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SWGlobalEvent | null>(null);
  const [selectedLead, setSelectedLead] = useState<SWGlobalLead | null>(null);

  const fetchData = async (showToast = false) => {
    const sequence = ++fetchSequence.current;
    const selectedBranchId = branchId;
    try {
      if (showToast) setRefreshing(true);
      const [statsData, accountsData, eventsData, leadsData] = await Promise.all([
        swGlobalService.getDashboardStats(selectedBranchId || undefined),
        swGlobalService.getAccounts(undefined, undefined, selectedBranchId || undefined),
        swGlobalService.getEvents(),
        swGlobalService.getLeads()
      ]);
      if (sequence !== fetchSequence.current) return;
      setStats(statsData);
      setAccounts(accountsData);
      setEvents(eventsData);
      setLeads(leadsData);
      if (showToast) toast.success('SW Global dashboard updated');
    } catch (err: any) {
      if (sequence !== fetchSequence.current) return;
      console.error('Error fetching SW Global dashboard data:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to load dashboard data.');
    } finally {
      if (sequence === fetchSequence.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [branchId]);

  useEffect(() => {
    if (canViewAllBranches) {
      orgService.getBranches().then(setBranches).catch(() => toast.error('Could not load branches.'));
    }
  }, [canViewAllBranches]);

  const filteredAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
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
  }, [accounts, accountSearch, accountStatusFilter]);

  const filteredEvents = useMemo(() => {
    const q = eventSearch.trim().toLowerCase();
    return events.filter((e) => !q || e.title.toLowerCase().includes(q) || e.type.toLowerCase().includes(q));
  }, [events, eventSearch]);

  const filteredLeads = useMemo(() => {
    const q = leadSearch.trim().toLowerCase();
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
  }, [leads, leadSearch, leadStageFilter, leadEventFilter]);

  const getInitials = (name: string) => {
    return (name || 'U')
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const formatDate = (d?: string | null) => {
    if (!d) return 'Not set';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Ring gradient computation for Account Progress
  const totalAcc = stats?.totalAccounts || 0;
  const activePct = totalAcc > 0 ? ((stats?.activeAccounts || 0) / totalAcc) * 100 : 0;
  const pendingPct = totalAcc > 0 ? ((stats?.pendingAccounts || 0) / totalAcc) * 100 : 0;
  const ringStyle = {
    background: totalAcc > 0
      ? `conic-gradient(#10b981 0% ${activePct}%, #f59e0b ${activePct}% ${activePct + pendingPct}%, #94a3b8 ${activePct + pendingPct}% 100%)`
      : 'var(--border)'
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
              <span className="text-[var(--accent)] font-bold">{canViewAllBranches ? 'Executive & HOD Analytics' : 'My Performance'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight flex items-center gap-3">
              SW Global Account Workspace
              <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 font-bold">
                Live Portfolio
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              {canViewAllBranches
                ? 'Consolidated accounts, pipeline conversion, webinar performance, and pending follow-ups.'
                : 'Your accounts, leads, events, conversion performance, and pending follow-ups.'}
            </p>
          </div>

          <div className="flex w-full flex-col items-stretch gap-2.5 sm:w-auto sm:flex-row sm:items-center">
            {canViewAllBranches && <select
              value={branchId}
              onChange={e => setBranchId(e.target.value)}
              aria-label="Filter dashboard by branch"
              className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] outline-none sm:w-auto"
            >
              <option value="">All Branches</option>
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>}
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition shadow-sm"
              title="Refresh records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>

            {!readOnly && <Link
              to={ROUTES.SW_GLOBAL_DATA_ENTRY}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)] transition shadow-sm"
            >
              Data Entry Workspace
              <ArrowUpRight className="w-4 h-4" />
            </Link>}
          </div>
        </div>

        <SWGlobalReports
          branches={canViewAllBranches ? branches : []}
          initialBranchId={branchId}
          onBranchChange={setBranchId}
        />

        {/* Loading State */}
        {loading && (
          <div className="py-16 text-center">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-[var(--accent)] mb-3" />
            <p className="text-sm font-semibold text-[var(--text-secondary)]">Loading SW Global portfolio...</p>
          </div>
        )}

        {!loading && stats && (
          <>
            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Total Accounts */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-sm hover:border-[var(--accent)]/40 transition">
                <div className="flex items-center justify-between text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  <span>Total Accounts</span>
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] mt-2">
                  {stats.totalAccounts}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  {stats.activeAccounts} active accounts
                </div>
              </div>

              {/* Total Clients */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-sm hover:border-[var(--accent)]/40 transition">
                <div className="flex items-center justify-between text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  <span>Unique Clients</span>
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                    <Globe className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] mt-2">
                  {stats.totalClients}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-1 font-medium">
                  Distinct client codes
                </div>
              </div>

              {/* Pending Applications */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-card)] border border-amber-500/30 bg-amber-500/5 shadow-sm hover:border-amber-500 transition">
                <div className="flex items-center justify-between text-xs font-bold text-amber-500 uppercase tracking-wider">
                  <span>Pending Attention</span>
                  <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-amber-500 mt-2">
                  {stats.pendingAccounts}
                </div>
                <div className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                  Awaiting documentation / steps
                </div>
              </div>

              {/* Event Conversion Ratio */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-sm hover:border-[var(--accent)]/40 transition">
                <div className="flex items-center justify-between text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  <span>Lead Conversion</span>
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                    <Target className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-500 mt-2">
                  {stats.conversionRate.toFixed(1)}%
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-1 font-medium">
                  {stats.convertedLeads} converted of {stats.totalLeads} leads
                </div>
              </div>

              {/* Conducted Events */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-sm hover:border-[var(--accent)]/40 transition">
                <div className="flex items-center justify-between text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  <span>Events & Webinars</span>
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
                    <Calendar className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] mt-2">
                  {stats.conductedEvents}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-1 font-medium">
                  {stats.totalEvents} total ({stats.plannedEvents} planned)
                </div>
              </div>
            </div>

            {/* Overview Visual Section: Account Progress & Event Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Account Progress Ring Chart */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                  <div>
                    <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                      Account Status Breakdown
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Distribution across active, pending, and closed portfolios.
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-[var(--bg-hover)] text-[var(--text-muted)] font-semibold">
                    {stats.totalAccounts} total
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-around gap-6 pt-6">
                  {/* Conic Ring */}
                  <div className="sw-ring-progress" style={ringStyle}>
                    <div className="sw-ring-progress-inner">
                      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Total</span>
                      <strong className="text-xl font-black text-[var(--text-primary)]">{stats.totalAccounts}</strong>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="space-y-3 w-full sm:w-auto">
                    <div className="flex items-center justify-between gap-6 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                        <span className="font-semibold text-[var(--text-primary)]">Active</span>
                      </div>
                      <div className="font-bold text-[var(--text-primary)]">
                        {stats.activeAccounts} <span className="text-[var(--text-muted)] font-normal">({totalAcc ? Math.round((stats.activeAccounts / totalAcc) * 100) : 0}%)</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-6 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                        <span className="font-semibold text-[var(--text-primary)]">Pending</span>
                      </div>
                      <div className="font-bold text-amber-500">
                        {stats.pendingAccounts} <span className="text-[var(--text-muted)] font-normal">({totalAcc ? Math.round((stats.pendingAccounts / totalAcc) * 100) : 0}%)</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-6 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-slate-400"></span>
                        <span className="font-semibold text-[var(--text-primary)]">Closed</span>
                      </div>
                      <div className="font-bold text-[var(--text-primary)]">
                        {stats.closedAccounts} <span className="text-[var(--text-muted)] font-normal">({totalAcc ? Math.round((stats.closedAccounts / totalAcc) * 100) : 0}%)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Event Performance Bars */}
              <div className="lg:col-span-2 p-5 sm:p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                    <div>
                      <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                        Top Event Conversion Performance
                      </h2>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        Conversions generated by webinars and investor meets.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('events')}
                      className="text-xs text-[var(--accent)] font-bold hover:underline inline-flex items-center gap-1"
                    >
                      View All Events <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="mt-4 space-y-3.5">
                    {stats.eventPerformance.slice(0, 4).map((ev) => (
                      <div
                        key={ev.id}
                        className="p-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] hover:border-[var(--accent)]/50 transition cursor-pointer"
                        onClick={() => {
                          setActiveTab('leads');
                          setLeadEventFilter(ev.id);
                        }}
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <div className="font-bold text-[var(--text-primary)] truncate max-w-[65%]">
                            {ev.title} <span className="text-[var(--text-muted)] font-normal">({ev.type})</span>
                          </div>
                          <div className="font-semibold text-[var(--text-secondary)]">
                            {ev.converted_count} / {ev.leads_count} leads converted
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-[var(--border)] rounded-full h-2 overflow-hidden flex items-center">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, ev.conversion_ratio)}%` }}
                          ></div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] mt-1">
                          <span>{formatDate(ev.date)} · Status: {ev.status}</span>
                          <span className="font-bold text-emerald-500">{ev.conversion_ratio}% conversion</span>
                        </div>
                      </div>
                    ))}

                    {stats.eventPerformance.length === 0 && (
                      <p className="text-xs text-[var(--text-muted)] text-center py-6">
                        No events recorded yet. Add an event to begin tracking conversion rates.
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)] flex items-center justify-between">
                  <span>Click any event bar to drill down into its pipeline leads.</span>
                  <span>Conversion = (Converted Leads ÷ Event Leads) × 100</span>
                </div>
              </div>
            </div>

            {/* Pending Attention Section */}
            {stats.pendingAttention.length > 0 && (
              <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-card)] border border-amber-500/30 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                        Pending Applications Queue ({stats.pendingAccounts})
                      </h2>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        High-priority applications requiring follow-up or outstanding verification steps.
                      </p>
                    </div>
                  </div>

                  {!readOnly && <Link
                    to={ROUTES.SW_GLOBAL_DATA_ENTRY}
                    className="text-xs font-bold text-amber-500 hover:underline inline-flex items-center gap-1"
                  >
                    Resolve in Data Entry <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>}
                </div>

                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                        <th className="pb-2.5">Client</th>
                        <th className="pb-2.5">Account No</th>
                        <th className="pb-2.5">Location</th>
                        <th className="pb-2.5">Pending Reason</th>
                        <th className="pb-2.5">Next Follow-up</th>
                        <th className="pb-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {stats.pendingAttention.map((acc) => (
                        <tr key={acc.id} className="hover:bg-[var(--bg-hover)]/50 transition">
                          <td className="py-3 font-semibold text-[var(--text-primary)]">
                            <div className="flex items-center gap-2">
                              <div className="sw-avatar">{getInitials(acc.name)}</div>
                              <div>
                                <div className="font-bold">{acc.name}</div>
                                <div className="text-[11px] text-[var(--text-muted)]">{acc.client_code}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 font-mono font-medium text-[var(--text-primary)]">{acc.account_no}</td>
                          <td className="py-3 text-[var(--text-secondary)]">{acc.location}</td>
                          <td className="py-3 text-amber-500 font-semibold">{acc.pending_reason || 'Pending verification'}</td>
                          <td className="py-3 text-[var(--text-secondary)]">{formatDate(acc.followup)}</td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => setSelectedAccount(acc)}
                              className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-card)] text-[var(--text-primary)] transition"
                              title="View details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Department Registers Tabs */}
            <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-sm overflow-hidden">
              {/* Tab Selector */}
              <div className="flex items-center gap-2 p-3 border-b border-[var(--border)] bg-[var(--bg-base)]/50">
                <button
                  onClick={() => setActiveTab('events')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    activeTab === 'events'
                      ? 'bg-[var(--accent)] text-slate-950 shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  Events Register ({events.length})
                </button>
                <button
                  onClick={() => setActiveTab('accounts')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    activeTab === 'accounts'
                      ? 'bg-[var(--accent)] text-slate-950 shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  All Client Accounts ({accounts.length})
                </button>
                <button
                  onClick={() => setActiveTab('leads')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    activeTab === 'leads'
                      ? 'bg-[var(--accent)] text-slate-950 shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  Lead Pipeline ({leads.length})
                </button>
              </div>

              {/* Tab 1: Events */}
              {activeTab === 'events' && (
                <div className="p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="relative w-full sm:w-80">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                      <input
                        type="text"
                        placeholder="Search event title or type..."
                        value={eventSearch}
                        onChange={(e) => setEventSearch(e.target.value)}
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
                          <th className="pb-2.5">Conversion %</th>
                          <th className="pb-2.5 text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {filteredEvents.map((e) => (
                          <tr key={e.id} className="hover:bg-[var(--bg-hover)]/50 transition">
                            <td className="py-3 font-bold text-[var(--text-primary)]">
                              <button
                                onClick={() => {
                                  setActiveTab('leads');
                                  setLeadEventFilter(e.id);
                                }}
                                className="hover:text-[var(--accent)] transition text-left"
                              >
                                {e.title}
                              </button>
                            </td>
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
                              <button
                                onClick={() => setSelectedEvent(e)}
                                className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-card)] text-[var(--text-primary)] transition"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 2: Accounts */}
              {activeTab === 'accounts' && (
                <div className="p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                      <div className="relative w-full sm:w-72">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                        <input
                          type="text"
                          placeholder="Search client, code or account..."
                          value={accountSearch}
                          onChange={(e) => setAccountSearch(e.target.value)}
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

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                          <th className="pb-2.5">Client</th>
                          <th className="pb-2.5">Account No</th>
                          <th className="pb-2.5">Location</th>
                          <th className="pb-2.5">Occupation</th>
                          <th className="pb-2.5">Contact</th>
                          <th className="pb-2.5">Status</th>
                          <th className="pb-2.5 text-right">Details</th>
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
                            <td className="py-3 font-mono font-medium text-[var(--text-primary)]">{a.account_no}</td>
                            <td className="py-3 text-[var(--text-secondary)]">{a.location}</td>
                            <td className="py-3 text-[var(--text-secondary)]">{a.occupation}</td>
                            <td className="py-3 text-[var(--text-secondary)]">{a.contact}</td>
                            <td className="py-3">
                              <span className={`sw-tag ${a.status.toLowerCase()}`}>{a.status}</span>
                            </td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() => setSelectedAccount(a)}
                                className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-card)] text-[var(--text-primary)] transition"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 3: Leads */}
              {activeTab === 'leads' && (
                <div className="p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                      <div className="relative w-full sm:w-64">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                        <input
                          type="text"
                          placeholder="Search lead or contact..."
                          value={leadSearch}
                          onChange={(e) => setLeadSearch(e.target.value)}
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

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                          <th className="pb-2.5">Lead Name</th>
                          <th className="pb-2.5">Event Source</th>
                          <th className="pb-2.5">Location</th>
                          <th className="pb-2.5">Contact</th>
                          <th className="pb-2.5">Stage</th>
                          <th className="pb-2.5">Follow-up</th>
                          <th className="pb-2.5 text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {filteredLeads.map((l) => (
                          <tr key={l.id} className="hover:bg-[var(--bg-hover)]/50 transition">
                            <td className="py-3 font-bold text-[var(--text-primary)]">{l.name}</td>
                            <td className="py-3 text-[var(--text-secondary)]">{l.event_title || 'Direct Event'}</td>
                            <td className="py-3 text-[var(--text-secondary)]">{l.location}</td>
                            <td className="py-3 text-[var(--text-secondary)]">{l.contact}</td>
                            <td className="py-3">
                              <span className={`sw-tag ${l.stage.toLowerCase().replace(' ', '-')}`}>
                                {l.stage}
                              </span>
                            </td>
                            <td className="py-3 text-[var(--text-secondary)]">{formatDate(l.followup)}</td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() => setSelectedLead(l)}
                                className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-card)] text-[var(--text-primary)] transition"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Modal: View Account Details */}
        {selectedAccount && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
              <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                    SW Global Account
                  </span>
                  <h3 className="text-base font-bold text-[var(--text-primary)] mt-0.5">
                    {selectedAccount.name} ({selectedAccount.account_no})
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedAccount(null)}
                  className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[var(--text-muted)] font-semibold">Client Code</label>
                    <div className="font-bold text-[var(--text-primary)] mt-0.5">{selectedAccount.client_code}</div>
                  </div>
                  <div>
                    <label className="text-[var(--text-muted)] font-semibold">Account Number</label>
                    <div className="font-mono font-bold text-[var(--text-primary)] mt-0.5">{selectedAccount.account_no}</div>
                  </div>
                  <div>
                    <label className="text-[var(--text-muted)] font-semibold">Status</label>
                    <div className="mt-0.5">
                      <span className={`sw-tag ${selectedAccount.status.toLowerCase()}`}>{selectedAccount.status}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[var(--text-muted)] font-semibold">Location</label>
                    <div className="font-medium text-[var(--text-primary)] mt-0.5">{selectedAccount.location}</div>
                  </div>
                  <div>
                    <label className="text-[var(--text-muted)] font-semibold">Occupation</label>
                    <div className="font-medium text-[var(--text-primary)] mt-0.5">{selectedAccount.occupation}</div>
                  </div>
                  <div>
                    <label className="text-[var(--text-muted)] font-semibold">Contact / Phone</label>
                    <div className="font-medium text-[var(--text-primary)] mt-0.5">{selectedAccount.contact}</div>
                  </div>
                  {selectedAccount.email && (
                    <div className="col-span-2">
                      <label className="text-[var(--text-muted)] font-semibold">Email</label>
                      <div className="font-medium text-[var(--text-primary)] mt-0.5">{selectedAccount.email}</div>
                    </div>
                  )}
                  {selectedAccount.status === 'Pending' && (
                    <div className="col-span-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                      <label className="text-amber-500 font-bold block mb-1">Pending Reason & Next Step</label>
                      <div className="text-amber-600 dark:text-amber-400 font-medium">
                        {selectedAccount.pending_reason || 'Pending verification'}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-1">
                        Follow-up scheduled: {formatDate(selectedAccount.followup)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-base)]/50 flex justify-end">
                <button
                  onClick={() => setSelectedAccount(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: View Event Details */}
        {selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
              <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                    Event Details
                  </span>
                  <h3 className="text-base font-bold text-[var(--text-primary)] mt-0.5">{selectedEvent.title}</h3>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[var(--text-muted)] font-semibold">Event Type</label>
                    <div className="font-bold text-[var(--text-primary)] mt-0.5">{selectedEvent.type}</div>
                  </div>
                  <div>
                    <label className="text-[var(--text-muted)] font-semibold">Event Date</label>
                    <div className="font-medium text-[var(--text-primary)] mt-0.5">{formatDate(selectedEvent.date)}</div>
                  </div>
                  <div>
                    <label className="text-[var(--text-muted)] font-semibold">Status</label>
                    <div className="mt-0.5">
                      <span className={`sw-tag ${selectedEvent.status.toLowerCase()}`}>{selectedEvent.status}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[var(--text-muted)] font-semibold">Conversion Ratio</label>
                    <div className="font-bold text-emerald-500 mt-0.5">
                      {selectedEvent.conversion_ratio !== undefined ? `${selectedEvent.conversion_ratio}%` : '0%'}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[var(--text-muted)] font-semibold">Notes / Description</label>
                    <div className="font-medium text-[var(--text-secondary)] mt-0.5 p-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border)]">
                      {selectedEvent.notes || 'No notes entered.'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-base)]/50 flex justify-end">
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: View Lead Details */}
        {selectedLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
              <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                    Lead Opportunity
                  </span>
                  <h3 className="text-base font-bold text-[var(--text-primary)] mt-0.5">{selectedLead.name}</h3>
                </div>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[var(--text-muted)] font-semibold">Source Event</label>
                    <div className="font-bold text-[var(--text-primary)] mt-0.5">{selectedLead.event_title || 'Event'}</div>
                  </div>
                  <div>
                    <label className="text-[var(--text-muted)] font-semibold">Pipeline Stage</label>
                    <div className="mt-0.5">
                      <span className={`sw-tag ${selectedLead.stage.toLowerCase().replace(' ', '-')}`}>
                        {selectedLead.stage}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[var(--text-muted)] font-semibold">Location</label>
                    <div className="font-medium text-[var(--text-primary)] mt-0.5">{selectedLead.location}</div>
                  </div>
                  <div>
                    <label className="text-[var(--text-muted)] font-semibold">Contact / Phone</label>
                    <div className="font-medium text-[var(--text-primary)] mt-0.5">{selectedLead.contact}</div>
                  </div>
                  <div>
                    <label className="text-[var(--text-muted)] font-semibold">Next Follow-up</label>
                    <div className="font-medium text-[var(--text-primary)] mt-0.5">{formatDate(selectedLead.followup)}</div>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[var(--text-muted)] font-semibold">Notes</label>
                    <div className="font-medium text-[var(--text-secondary)] mt-0.5 p-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border)]">
                      {selectedLead.notes || 'No follow-up notes.'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-base)]/50 flex justify-end">
                <button
                  onClick={() => setSelectedLead(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SWGlobalDashboardPage;
