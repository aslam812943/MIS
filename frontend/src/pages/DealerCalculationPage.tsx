import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';
import {
  Printer, FileBarChart2, ChevronUp, ChevronDown,   LayoutDashboard, UploadCloud, Users, Target, TrendingUp,
  Calendar, Trash2, Plus, Search, AlertTriangle,
  FileSpreadsheet, Building2, IndianRupee, Pencil, X, Check,
  ReceiptText, Layers, ListChecks, UserCog, Gauge,
  FileSearch, RefreshCw, Download, ChevronRight, Eye
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { authService } from '../services/auth.service';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import { dealerCalculationService } from '../services/dealerCalculation.service';
import type {
  MasterClient,
  TargetsData,
  DashboardSummary,
  MisSummaryResponse
} from '../services/dealerCalculation.service';

/* ── Formatting Helpers ── */
const fmtINR = (n: number | null | undefined) => {
  if (n === null || n === undefined || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
};

const fmtFull = (n: number | null | undefined) => `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const normCode = (c: string) => String(c || '').trim().toUpperCase().replace(/\s+/g, '');
const UNMAPPED = 'Unmapped';

const PALETTE = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#DB2777', '#0D9488', '#C2410C', '#4338CA', '#B91C1C', '#0891B2'];
const dealerColor = (name: string) => {
  let h = 0;
  for (let i = 0; i < String(name).length; i++) h = (h * 31 + String(name).charCodeAt(i)) % PALETTE.length;
  return PALETTE[h];
};

function parseISO(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function monthsInFullCalendarSpan(from?: string | null, to?: string | null): number | null {
  if (!from || !to) return null;
  const f = parseISO(from);
  const t = parseISO(to);
  if (f.getDate() !== 1) return null;
  const lastDay = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  if (t.getDate() !== lastDay) return null;
  const months = (t.getFullYear() - f.getFullYear()) * 12 + (t.getMonth() - f.getMonth()) + 1;
  return months > 0 ? months : null;
}

function splitShares(dealer: string | undefined, rm: string | undefined, rmSharePct: number = 50) {
  const d = String(dealer || '').trim();
  const r = String(rm || '').trim();
  if (d && r) {
    if (d.toLowerCase() === r.toLowerCase()) return { dealerPct: 100, rmPct: 0, samePerson: true };
    const cleanRmPct = Math.max(0, Math.min(100, Number(rmSharePct) || 50));
    return { dealerPct: 100 - cleanRmPct, rmPct: cleanRmPct, samePerson: false };
  }
  if (d && !r) return { dealerPct: 100, rmPct: 0, samePerson: false };
  if (!d && r) return { dealerPct: 0, rmPct: 100, samePerson: false };
  return { dealerPct: 0, rmPct: 0, samePerson: false };
}

function normHeader(h: any) { return String(h || '').trim().toLowerCase(); }
function findCol(headers: string[], ...needles: string[]) {
  const idx = headers.findIndex((h) => needles.some((n) => h.includes(n)));
  return idx >= 0 ? idx : null;
}
function num(v: any) {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  if (!v) return 0;
  const clean = String(v).replace(/,/g, '').trim();
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: 'array' });
}

function downloadCSV(filename: string, headerRow: string[], sampleRows: any[][]) {
  const rows = [headerRow, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sample');
  XLSX.writeFile(wb, filename);
}

type TabType = 'dashboard' | 'mis' | 'clients' | 'dealers' | 'rms' | 'upload' | 'missing' | 'reports' | 'tasks' | 'targets' | 'holidays' | 'users';

const DealerCalculationPage: React.FC = () => {
  const currentUser = authService.getCurrentUser();
  const isAdmin = ['admin', 'ceo', 'managing_director', 'director', 'executive'].includes(currentUser?.role || '') || (currentUser as any)?.dealer_role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [loading, setLoading] = useState(true);
  const [loadWarning, setLoadWarning] = useState('');

  // Core Data States
  const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(null);
  const [misData, setMisData] = useState<MisSummaryResponse | null>(null);
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'quarter' | 'year'>('month');
  const [masterClients, setMasterClients] = useState<MasterClient[]>([]);
  const [dealers, setDealers] = useState<string[]>([]);
  const [rms, setRms] = useState<string[]>([]);
  const [targets, setTargets] = useState<TargetsData>({ monthly: 0, kotakSharePct: 85, rmSplitPct: 50, incentiveMultiplier: 10, dealerSalary: {}, dealerMonthly: {} });
  const [dailyDates, setDailyDates] = useState<Array<{ date: string; count: number; sources: string[] }>>([]);
  const [debitDates, setDebitDates] = useState<Array<{ date: string; count: number }>>([]);
  const [latestDebitByCode, setLatestDebitByCode] = useState<Record<string, { name: string; debit: number; date: string }>>({});
  const [holidays, setHolidays] = useState<Array<{ date: string; name: string }>>([]);
  const [dealerUsers, setDealerUsers] = useState<any[]>([]);

  // Period / Sub-tab States
  const [dealersPeriod, setDealersPeriod] = useState<'week' | 'month' | 'quarter' | 'year' | 'all'>('month');
  const [rmsPeriod, setRmsPeriod] = useState<'week' | 'month' | 'quarter' | 'year' | 'all'>('month');
  const [brokerageByClient, setBrokerageByClient] = useState<Record<string, number>>({});
  const [netBrokerageByRm, setNetBrokerageByRm] = useState<Record<string, number>>({});

  // Client Search & Pagination
  const [clientSearch, setClientSearch] = useState('');
  const [clientDealerFilter, setClientDealerFilter] = useState('');
  const [clientRmFilter, setClientRmFilter] = useState('');
  const [clientBranchFilter, setClientBranchFilter] = useState('');
  const [clientPage, setClientPage] = useState(1);
  const clientsPerPage = 50;

  // Selected Client Transactions Modal
  const [selectedClient, setSelectedClient] = useState<MasterClient | null>(null);
  const [selectedClientRecords, setSelectedClientRecords] = useState<any[]>([]);
  const [loadingClientRecords, setLoadingClientRecords] = useState(false);

  // Missing Finder
  const [missingCodes, setMissingCodes] = useState<Array<{ code: string; name: string; netBrok: number; count: number }>>([]);
  const [missingLoading, setMissingLoading] = useState(false);
  const [missingMapModal, setMissingMapModal] = useState<{ code: string; name: string } | null>(null);
  const [mapDealer, setMapDealer] = useState('');
  const [mapRm, setMapRm] = useState('');
  const [mapBranch, setMapBranch] = useState('');

  // Reports Tab States
  const [reportPeriod, setReportPeriod] = useState<'week' | 'month' | 'quarter' | 'year' | 'all'>('month');
  const [reportUseCustom, setReportUseCustom] = useState(false);
  const [reportCustomFrom, setReportCustomFrom] = useState('');
  const [reportCustomTo, setReportCustomTo] = useState('');
  const [reportRange, setReportRange] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const [reportMonthComparison, setReportMonthComparison] = useState(false);
  const [expandedReportDealer, setExpandedReportDealer] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportView, setReportView] = useState<'dealers' | 'rms' | 'clients'>('dealers');

  // Modals & Forms
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [newClient, setNewClient] = useState({ code: '', name: '', rm: '', dealer: '', branch: '' });
  const [editingClient, setEditingClient] = useState<MasterClient | null>(null);

  // Dealers tab states
  const [dealerSearch, setDealerSearch] = useState('');
  const [newDealerName, setNewDealerName] = useState('');
  const [editingDealer, setEditingDealer] = useState<string | null>(null);
  const [editDealerName, setEditDealerName] = useState('');
  const [dealerBulkOpen, setDealerBulkOpen] = useState(false);
  const [splitSearch, setSplitSearch] = useState('');

  // RMs tab states
  const [rmSearch, setRmSearch] = useState('');
  const [newRmName, setNewRmName] = useState('');
  const [editingRm, setEditingRm] = useState<string | null>(null);
  const [editRmName, setEditRmName] = useState('');
  const [rmBulkOpen, setRmBulkOpen] = useState(false);

  // Users tab modal
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'VIEWER' });

  // Upload Tab States
  const [uploadSource, setUploadSource] = useState<'SW' | 'KOTAK'>('SW');
  const [uploadDate, setUploadDate] = useState(() => new Date().toISOString().split('T')[0] || '');
  const [parsedUploadRecords, setParsedUploadRecords] = useState<any[]>([]);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploading, setUploading] = useState(false);

  // Debit Upload States
  const [debitUploadDate, setDebitUploadDate] = useState(() => new Date().toISOString().split('T')[0] || '');
  const [parsedDebitRecords, setParsedDebitRecords] = useState<any[]>([]);
  const [debitFileName, setDebitFileName] = useState('');
  const [uploadingDebit, setUploadingDebit] = useState(false);

  // Bulk Master Upload
  const [masterBulkOpen, setMasterBulkOpen] = useState(false);

  // Task states
  const [selectedTaskDealer, setSelectedTaskDealer] = useState<string>('');
  const [taskMonth, setTaskMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [tasksList, setTasksList] = useState<any[]>([]);

  // Traded / Dormant Clients Modal in MIS Tab
  const [misTradedModal, setMisTradedModal] = useState<{ dealer: string; clients: any[] } | null>(null);
  const [misDormantModal, setMisDormantModal] = useState<{ dealer: string; clients: any[] } | null>(null);

  // Danger Zone confirmation
  const [wipeConfirm, setWipeConfirm] = useState<{ type: 'clients' | 'dealers' | 'rms'; typed: string } | null>(null);

  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const debitFileInputRef = useRef<HTMLInputElement>(null);
  const dealerBulkFileRef = useRef<HTMLInputElement>(null);
  const rmBulkFileRef = useRef<HTMLInputElement>(null);
  const masterBulkFileRef = useRef<HTMLInputElement>(null);

  // Combined master map for quick O(1) lookups
  const masterByCode = useMemo(() => {
    const map = new Map<string, MasterClient>();
    masterClients.forEach((m) => map.set(normCode(m.code), m));
    return map;
  }, [masterClients]);

  // Union of dealers (Registry + MasterClient) -> 10 Dealers
  const allDealerNames = useMemo(() => {
    const set = new Set(dealers);
    masterClients.forEach((m) => { if (m.dealer) set.add(m.dealer); });
    return Array.from(set).sort();
  }, [dealers, masterClients]);

  // Union of RMs (Registry + MasterClient) -> 21 RMs
  const allRmNames = useMemo(() => {
    const set = new Set(rms);
    masterClients.forEach((m) => { if (m.rm) set.add(m.rm); });
    return Array.from(set).sort();
  }, [rms, masterClients]);

  // Branches list
  const branchesList = useMemo(() => {
    const set = new Set<string>();
    masterClients.forEach((m) => { if (m.branch) set.add(m.branch); });
    return Array.from(set).sort();
  }, [masterClients]);

  // Load Initial Data
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setLoadWarning('');
    try {
      const failures: string[] = [];
      const settle = async <T,>(label: string, request: Promise<T>, apply: (value: T) => void) => {
        try { apply(await request); }
        catch (error: any) { failures.push(`${label}: ${apiErrorMessage(error)}`); }
      };

      await Promise.all([
        settle('Dashboard', dealerCalculationService.getDashboardSummary(period), setDashboardData),
        settle('MIS Summary', dealerCalculationService.getMisSummary(), setMisData),
        settle('Master Clients', dealerCalculationService.getMaster(), setMasterClients),
        settle('Dealers', dealerCalculationService.getDealers(), setDealers),
        settle('RMs', dealerCalculationService.getRms(), setRms),
        settle('Targets', dealerCalculationService.getTargets(), setTargets),
        settle('Daily Dates', dealerCalculationService.getDailyDates(), setDailyDates),
        settle('Debit Dates', dealerCalculationService.getDebitDates(), setDebitDates),
        settle('Latest Debit', dealerCalculationService.getDebitLatest(), setLatestDebitByCode),
        settle('Holidays', dealerCalculationService.getHolidays(), setHolidays),
        settle('Users', dealerCalculationService.getUsers(), setDealerUsers),
      ]);

      if (failures.length > 0) {
        setLoadWarning(`Some data could not be loaded: ${failures.join('; ')}`);
      }
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Reload period-filtered client brokerage for Dealers tab
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await dealerCalculationService.getBrokerageByClient(dealersPeriod);
        if (!cancelled && res?.rows) {
          const map: Record<string, number> = {};
          res.rows.forEach((r) => { map[normCode(r.code)] = Number(r.value) || 0; });
          setBrokerageByClient(map);
        }
      } catch (err) {
        console.error(err);
      }
    })();
    return () => { cancelled = true; };
  }, [dealersPeriod]);

  // Reload period-filtered RM summary for RMs tab
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await dealerCalculationService.getRmsSummary(rmsPeriod);
        if (!cancelled && res?.rows) {
          const map: Record<string, number> = {};
          res.rows.forEach((r) => { map[r.rm] = Number(r.netBrokerage) || 0; });
          setNetBrokerageByRm(map);
        }
      } catch (err) {
        console.error(err);
      }
    })();
    return () => { cancelled = true; };
  }, [rmsPeriod]);

  // Load Tasks when dealer or month changes
  useEffect(() => {
    if (!selectedTaskDealer && allDealerNames.length > 0) {
      setSelectedTaskDealer(allDealerNames[0]);
    }
    if (selectedTaskDealer) {
      dealerCalculationService.getTasks(selectedTaskDealer, taskMonth)
        .then(setTasksList)
        .catch(console.error);
    }
  }, [selectedTaskDealer, taskMonth, allDealerNames]);

  // Open Client Details Modal & Load daily records
  const handleOpenClientTransactions = async (client: MasterClient) => {
    setSelectedClient(client);
    setLoadingClientRecords(true);
    try {
      const records = await dealerCalculationService.getDailyClient(client.code);
      setSelectedClientRecords(records);
    } catch (err: any) {
      toast.error('Failed to load client daily history');
    } finally {
      setLoadingClientRecords(false);
    }
  };

  // Filtered Master Clients
  const filteredClients = useMemo(() => {
    return masterClients.filter((c) => {
      if (clientSearch) {
        const s = clientSearch.toLowerCase();
        const codeMatch = c.code?.toLowerCase().includes(s);
        const nameMatch = c.name?.toLowerCase().includes(s);
        if (!codeMatch && !nameMatch) return false;
      }
      if (clientDealerFilter && c.dealer !== clientDealerFilter) return false;
      if (clientRmFilter && c.rm !== clientRmFilter) return false;
      if (clientBranchFilter && c.branch !== clientBranchFilter) return false;
      return true;
    });
  }, [masterClients, clientSearch, clientDealerFilter, clientRmFilter, clientBranchFilter]);

  const totalClientPages = Math.max(1, Math.ceil(filteredClients.length / clientsPerPage));
  const paginatedClients = useMemo(() => {
    const start = (clientPage - 1) * clientsPerPage;
    return filteredClients.slice(start, start + clientsPerPage);
  }, [filteredClients, clientPage]);

  // Dealers Tab: Computed dealer statistics
  const dealerStatsRows = useMemo(() => {
    const clientCountMap: Record<string, number> = {};
    const totalBrokMap: Record<string, number> = {};
    const netBrokMap: Record<string, number> = {};
    const rmSplitPct = targets.rmSplitPct ?? 50;

    masterClients.forEach((m) => {
      if (!m.dealer) return;
      clientCountMap[m.dealer] = (clientCountMap[m.dealer] || 0) + 1;
      const b = brokerageByClient[normCode(m.code)] || 0;
      totalBrokMap[m.dealer] = (totalBrokMap[m.dealer] || 0) + b;
      const { dealerPct } = splitShares(m.dealer, m.rm, rmSplitPct);
      netBrokMap[m.dealer] = (netBrokMap[m.dealer] || 0) + (b * dealerPct) / 100;
    });

    const incentiveMultiplier = targets.incentiveMultiplier ?? 10;
    return allDealerNames
      .filter((d) => !dealerSearch || d.toLowerCase().includes(dealerSearch.toLowerCase()))
      .map((d) => {
        const salary = targets.dealerSalary?.[d] || 0;
        const target = salary * incentiveMultiplier;
        const net = netBrokMap[d] || 0;
        const pct = target > 0 ? (net / target) * 100 : 0;
        return {
          dealer: d,
          clients: clientCountMap[d] || 0,
          brokerage: totalBrokMap[d] || 0,
          netBrokerage: net,
          salary,
          target,
          achievementPct: pct,
        };
      })
      .sort((a, b) => b.netBrokerage - a.netBrokerage);
  }, [allDealerNames, masterClients, brokerageByClient, targets, dealerSearch]);

  // Dealers Tab: Split Rows Table
  const splitRows = useMemo(() => {
    const rmSplitPct = targets.rmSplitPct ?? 50;
    return masterClients
      .filter((m) => m.dealer || m.rm)
      .map((m) => {
        const b = brokerageByClient[normCode(m.code)] || 0;
        const { dealerPct, rmPct, samePerson } = splitShares(m.dealer, m.rm, rmSplitPct);
        return {
          code: m.code,
          name: m.name,
          dealer: m.dealer || UNMAPPED,
          rm: m.rm || '—',
          brokerage: b,
          dealerShare: (b * dealerPct) / 100,
          rmShare: (b * rmPct) / 100,
          dealerPct,
          rmPct,
          samePerson,
        };
      })
      .filter((r) => {
        if (!splitSearch) return true;
        const s = splitSearch.toLowerCase();
        return (
          r.code.toLowerCase().includes(s) ||
          (r.name && r.name.toLowerCase().includes(s)) ||
          r.dealer.toLowerCase().includes(s) ||
          r.rm.toLowerCase().includes(s)
        );
      })
      .sort((a, b) => b.brokerage - a.brokerage);
  }, [masterClients, brokerageByClient, targets.rmSplitPct, splitSearch]);

  // RMs Tab: Computed RM rows (All 21 RMs!)
  const rmStatsRows = useMemo(() => {
    const clientCountMap: Record<string, number> = {};
    masterClients.forEach((m) => {
      if (m.rm) clientCountMap[m.rm] = (clientCountMap[m.rm] || 0) + 1;
    });

    return allRmNames
      .filter((r) => !rmSearch || r.toLowerCase().includes(rmSearch.toLowerCase()))
      .map((r) => ({
        rm: r,
        clients: clientCountMap[r] || 0,
        netBrokerage: netBrokerageByRm[r] || 0,
      }))
      .sort((a, b) => b.netBrokerage - a.netBrokerage);
  }, [allRmNames, masterClients, netBrokerageByRm, rmSearch]);

  // Handlers for Master Clients
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.code) return;
    try {
      const updated = editingClient
        ? masterClients.map((c) => (c.code === editingClient.code ? { ...c, ...newClient } : c))
        : [...masterClients, { ...newClient }];
      await dealerCalculationService.replaceMaster(updated);
      setMasterClients(updated);
      setShowAddClientModal(false);
      setEditingClient(null);
      setNewClient({ code: '', name: '', rm: '', dealer: '', branch: '' });
      toast.success(editingClient ? 'Client updated' : 'Client created');
    } catch (err: any) {
      toast.error(apiErrorMessage(err));
    }
  };

  const handleDeleteClient = async (code: string) => {
    if (!window.confirm(`Delete client ${code}?`)) return;
    try {
      const updated = masterClients.filter((c) => c.code !== code);
      await dealerCalculationService.replaceMaster(updated);
      setMasterClients(updated);
      toast.success(`Deleted client ${code}`);
    } catch (err: any) {
      toast.error(apiErrorMessage(err));
    }
  };

  // Export Dealer Clients to Excel
  const handleExportDealerClients = (dealerName: string) => {
    const rmSplitPct = targets.rmSplitPct ?? 50;
    const rows = masterClients
      .filter((m) => m.dealer === dealerName)
      .map((m) => {
        const b = brokerageByClient[normCode(m.code)] || 0;
        const { dealerPct, rmPct } = splitShares(m.dealer, m.rm, rmSplitPct);
        return {
          'Client Code': m.code,
          'Client Name': m.name || '',
          'RM': m.rm || '',
          'Branch': m.branch || '',
          'Debit Balance': latestDebitByCode[normCode(m.code)]?.debit || 0,
          'Total Brokerage': Math.round(b * 100) / 100,
          'Dealer Share': Math.round(((b * dealerPct) / 100) * 100) / 100,
          'RM Share': Math.round(((b * rmPct) / 100) * 100) / 100,
        };
      })
      .sort((a, b) => b['Total Brokerage'] - a['Total Brokerage']);

    if (!rows.length) {
      toast.error(`No clients found for ${dealerName}`);
      return;
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, dealerName.slice(0, 31) || 'Clients');
    const safeName = dealerName.replace(/[^a-z0-9]+/gi, '_');
    XLSX.writeFile(wb, `${safeName}_clients_${dealersPeriod}.xlsx`);
    toast.success(`Exported ${rows.length} client(s) for ${dealerName}`);
  };

  // Export All Master Clients
  const handleExportAllClients = () => {
    const rows = masterClients.map((m) => ({
      'Client Code': m.code,
      'Client Name': m.name || '',
      'Dealer': m.dealer || '',
      'RM': m.rm || '',
      'Branch': m.branch || '',
      'Latest Debit': latestDebitByCode[normCode(m.code)]?.debit || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MasterClients');
    XLSX.writeFile(wb, `master_clients_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`Exported ${rows.length} master clients`);
  };

  // Missing Finder Scan
  const handleScanMissing = async () => {
    setMissingLoading(true);
    try {
      const dailyData = await dealerCalculationService.getDaily();
      const codeAgg: Record<string, { code: string; name: string; netBrok: number; count: number }> = {};
      Object.values(dailyData).forEach((records) => {
        records.forEach((r) => {
          const cNorm = normCode(r.code);
          if (!masterByCode.has(cNorm)) {
            if (!codeAgg[cNorm]) {
              codeAgg[cNorm] = { code: r.code, name: r.name || '', netBrok: 0, count: 0 };
            }
            codeAgg[cNorm].netBrok += r.netBrok;
            codeAgg[cNorm].count += 1;
            if (r.name && !codeAgg[cNorm].name) codeAgg[cNorm].name = r.name;
          }
        });
      });
      setMissingCodes(Object.values(codeAgg).sort((a, b) => b.netBrok - a.netBrok));
      toast.success(`Found ${Object.keys(codeAgg).length} unmapped client codes`);
    } catch (err: any) {
      toast.error('Failed to scan missing clients');
    } finally {
      setMissingLoading(false);
    }
  };

  // Quick Map Missing Client
  const handleQuickMapSave = async () => {
    if (!missingMapModal) return;
    try {
      const newEntry: MasterClient = {
        code: missingMapModal.code,
        name: missingMapModal.name,
        dealer: mapDealer,
        rm: mapRm,
        branch: mapBranch,
      };
      const updated = [...masterClients, newEntry];
      await dealerCalculationService.replaceMaster(updated);
      setMasterClients(updated);
      setMissingCodes((prev) => prev.filter((x) => normCode(x.code) !== normCode(missingMapModal.code)));
      setMissingMapModal(null);
      setMapDealer('');
      setMapRm('');
      setMapBranch('');
      toast.success(`Mapped client ${newEntry.code}`);
    } catch (err: any) {
      toast.error(apiErrorMessage(err));
    }
  };

  // Fetch Reports automatically on filter change
  const fetchReportData = useCallback(async () => {
    setReportLoading(true);
    try {
      if (reportView === 'dealers') {
        const res = await dealerCalculationService.getReportsDealers(
          reportUseCustom ? undefined : reportPeriod,
          reportUseCustom ? (reportCustomFrom || undefined) : undefined,
          reportUseCustom ? (reportCustomTo || undefined) : undefined
        );
        if (res && res.rows) {
          setReportData(res.rows);
          setReportRange({ from: res.from, to: res.to });
          setReportMonthComparison(!!res.monthComparison);
        } else if (Array.isArray(res)) {
          setReportData(res);
          setReportMonthComparison(false);
        }
      } else if (reportView === 'rms') {
        const res = await dealerCalculationService.getRmsSummary(
          reportUseCustom ? undefined : reportPeriod,
          reportUseCustom ? (reportCustomFrom || undefined) : undefined,
          reportUseCustom ? (reportCustomTo || undefined) : undefined
        );
        setReportData(res.rows || []);
        setReportMonthComparison(false);
        setReportRange({ from: reportUseCustom ? reportCustomFrom || null : null, to: reportUseCustom ? reportCustomTo || null : null });
      } else {
        const res = await dealerCalculationService.getBrokerageByClient(
          reportUseCustom ? undefined : reportPeriod,
          reportUseCustom ? (reportCustomFrom || undefined) : undefined,
          reportUseCustom ? (reportCustomTo || undefined) : undefined
        );
        setReportData(res.rows || []);
        setReportMonthComparison(false);
        setReportRange({ from: reportUseCustom ? reportCustomFrom || null : null, to: reportUseCustom ? reportCustomTo || null : null });
      }
    } catch (err: any) {
      toast.error('Failed to load report');
    } finally {
      setReportLoading(false);
    }
  }, [reportView, reportPeriod, reportUseCustom, reportCustomFrom, reportCustomTo]);

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReportData();
    }
  }, [activeTab, fetchReportData]);

  const salaryBasisMonths = monthsInFullCalendarSpan(reportRange.from, reportRange.to);
  const isMonthlyView = salaryBasisMonths != null;
  const incentiveMultiplier = targets.incentiveMultiplier ?? 10;

  const incentiveFor = (r: any) => {
    const monthlySalary = targets.dealerSalary?.[r.dealer];
    const hasSalary = monthlySalary != null && monthlySalary > 0;
    const salary = hasSalary ? monthlySalary * (salaryBasisMonths || 1) : null;
    const multiplier = salary ? (r.netBrokerage || r.netRevenue || 0) / salary : null;
    const eligible = multiplier !== null && multiplier >= incentiveMultiplier;
    return { salary, multiplier, eligible };
  };

  const reportTotals = useMemo(() => {
    return reportData.reduce(
      (acc, r) => ({
        clientsMapped: acc.clientsMapped + (Number(r.clientsMapped) || 0),
        tradedClients: acc.tradedClients + (Number(r.tradedClients) || 0),
        swGross: acc.swGross + (Number(r.swGross) || 0),
        kotakGross: acc.kotakGross + (Number(r.kotakGross) || 0),
        totalBrokerage: acc.totalBrokerage + (Number(r.totalBrokerage || (Number(r.swGross) || 0) + (Number(r.kotakGross) || 0) || r.value || r.totalBrok) || 0),
        netBrokerage: acc.netBrokerage + (Number(r.netBrokerage || r.netRevenue || r.value) || 0),
      }),
      { clientsMapped: 0, tradedClients: 0, swGross: 0, kotakGross: 0, totalBrokerage: 0, netBrokerage: 0 }
    );
  }, [reportData]);

  // Export Report to Excel
  const handleExportReportExcel = () => {
    if (!reportData.length) {
      toast.error('Nothing to export');
      return;
    }
    const data = reportData.map((r) => {
      if (reportView === 'dealers') {
        const base: any = {
          'Dealer': r.dealer,
          'Clients Mapped': r.clientsMapped ?? '—',
          'Traded Clients': r.tradedClients,
          'Total Brokerage (₹)': Math.round((r.totalBrokerage || (Number(r.swGross) || 0) + (Number(r.kotakGross) || 0)) * 100) / 100,
          'Net Brokerage (₹)': Math.round((r.netBrokerage || r.netRevenue || 0) * 100) / 100,
        };
        if (isMonthlyView) {
          const inc = incentiveFor(r);
          base['Multiplier'] = inc.multiplier != null ? `${inc.multiplier.toFixed(2)}x` : '—';
          base['Incentive Eligible'] = inc.salary == null ? '—' : inc.eligible ? 'Yes' : 'No';
        }
        return base;
      }
      if (reportView === 'rms') {
        return {
          'RM': r.rm,
          'Traded Clients': r.tradedClients,
          'Net Brokerage (₹)': Math.round((r.netBrokerage || r.netRevenue || 0) * 100) / 100,
        };
      }
      return {
        'Client Code': r.code,
        'Client Name': r.name || '—',
        'Dealer': r.dealer || '—',
        'RM': r.rm || '—',
        'Net Brokerage (₹)': Math.round((r.value || r.netBrok || 0) * 100) / 100,
      };
    });

    if (reportView === 'dealers') {
      data.push({
        'Dealer': 'TOTAL',
        'Clients Mapped': reportTotals.clientsMapped,
        'Traded Clients': reportTotals.tradedClients,
        'Total Brokerage (₹)': Math.round(reportTotals.totalBrokerage * 100) / 100,
        'Net Brokerage (₹)': Math.round(reportTotals.netBrokerage * 100) / 100,
      });
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${reportView}_report`);
    XLSX.writeFile(wb, `${reportView}_report_${reportRange.from || 'all'}_to_${reportRange.to || 'now'}.xlsx`);
    toast.success(`Exported ${reportData.length} records to Excel`);
  };

  const handleExportReportPDF = () => {
    window.print();
  };

  // Wipe Handler for Danger Zone
  const handleExecuteWipe = async () => {
    if (!wipeConfirm || wipeConfirm.typed !== 'DELETE') {
      toast.error('Type DELETE to confirm');
      return;
    }
    try {
      if (wipeConfirm.type === 'clients') {
        await dealerCalculationService.replaceMaster([]);
        setMasterClients([]);
        toast.success('All master clients wiped');
      } else if (wipeConfirm.type === 'dealers') {
        await dealerCalculationService.replaceDealers([]);
        setDealers([]);
        toast.success('All dealers removed');
      } else if (wipeConfirm.type === 'rms') {
        await dealerCalculationService.replaceRms([]);
        setRms([]);
        toast.success('All RMs removed');
      }
      setWipeConfirm(null);
    } catch (err: any) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-16">

        {/* ── HEADER BANNER ── */}
        <div className="bg-[#132038] text-white p-6 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4 border border-slate-700/50">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <IndianRupee size={24} className="text-white" strokeWidth={2.75} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-black tracking-tight text-white m-0">Sharewealth Edge</h1>
                <span className="bg-blue-500/20 text-blue-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-blue-400/30">
                  {isAdmin ? 'ADMIN CONSOLE' : 'VIEWER'}
                </span>
              </div>
              <p className="text-xs text-slate-300 m-0 mt-0.5">
                {dashboardData?.latestDate ? `Live data through ${dashboardData.latestDate}` : 'No data uploaded yet'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadInitialData}
              disabled={loading}
              className="mis-btn bg-white/10 hover:bg-white/20 text-white border-0 text-xs px-3.5 py-2 flex items-center gap-1.5"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh Data
            </button>
          </div>
        </div>

        {loadWarning && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-500 text-xs flex items-center gap-2">
            <AlertTriangle size={15} />
            <span>{loadWarning}</span>
          </div>
        )}

        {/* ── TABS NAVIGATION BAR ── */}
        <div className="flex items-center gap-1.5 p-1.5 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-x-auto scrollbar-none shadow-sm">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'mis', label: 'MIS Performance', icon: Gauge },
            { id: 'clients', label: `Clients (${masterClients.length})`, icon: Users },
            { id: 'dealers', label: `Dealers (${allDealerNames.length})`, icon: Building2 },
            { id: 'rms', label: `RMs (${allRmNames.length})`, icon: Users },
            { id: 'upload', label: 'Upload Files', icon: UploadCloud, adminOnly: true },
            { id: 'missing', label: 'Missing Finder', icon: FileSearch, adminOnly: true },
            { id: 'reports', label: 'Reports', icon: ReceiptText, adminOnly: true },
            { id: 'tasks', label: 'Monthly Tasks', icon: ListChecks },
            { id: 'targets', label: 'Targets & Config', icon: Target, adminOnly: true },
            { id: 'holidays', label: 'Trading Calendar', icon: Calendar, adminOnly: true },
            { id: 'users', label: `Users (${dealerUsers.length})`, icon: UserCog, adminOnly: true },
          ].map((t) => {
            if (t.adminOnly && !isAdmin) return null;
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  active
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover)]'
                }`}
              >
                <Icon size={14} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* ══════════════════════════════════════════════════════════════
            TAB 1: DASHBOARD
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Period selector */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-1 bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border)]">
                {(['day', 'week', 'month', 'quarter', 'year'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                      period === p
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {p === 'day' ? 'Today' : p}
                  </button>
                ))}
              </div>
              <div className="text-xs text-[var(--text-secondary)]">
                Selected Period: <strong className="text-[var(--text-primary)] capitalize">{period === 'day' ? 'Today' : period}</strong>
              </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="mis-card p-5 border-l-4 border-l-blue-500">
                <div className="text-xs font-bold uppercase text-[var(--text-secondary)] flex items-center justify-between">
                  <span>Today ({dashboardData?.latestDate || '—'})</span>
                  <IndianRupee size={15} className="text-blue-500" />
                </div>
                <div className="text-2xl font-black mt-2 text-[var(--text-primary)]">
                  {fmtINR(dashboardData?.kpi?.today)}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-1">
                  Full: {fmtFull(dashboardData?.kpi?.today)}
                </div>
              </div>

              <div className="mis-card p-5 border-l-4 border-l-emerald-500">
                <div className="text-xs font-bold uppercase text-[var(--text-secondary)] flex items-center justify-between">
                  <span>Yesterday (T-1)</span>
                  <TrendingUp size={15} className="text-emerald-500" />
                </div>
                <div className="text-2xl font-black mt-2 text-[var(--text-primary)]">
                  {fmtINR(dashboardData?.kpi?.yesterday)}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-1">
                  Full: {fmtFull(dashboardData?.kpi?.yesterday)}
                </div>
              </div>

              <div className="mis-card p-5 border-l-4 border-l-purple-500">
                <div className="text-xs font-bold uppercase text-[var(--text-secondary)] flex items-center justify-between">
                  <span>Month to Date (MTD)</span>
                  <Layers size={15} className="text-purple-500" />
                </div>
                <div className="text-2xl font-black mt-2 text-[var(--text-primary)]">
                  {fmtINR(dashboardData?.kpi?.mtd)}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-1">
                  Full: {fmtFull(dashboardData?.kpi?.mtd)}
                </div>
              </div>

              <div className="mis-card p-5 border-l-4 border-l-amber-500">
                <div className="text-xs font-bold uppercase text-[var(--text-secondary)] flex items-center justify-between">
                  <span>Year to Date (YTD)</span>
                  <Target size={15} className="text-amber-500" />
                </div>
                <div className="text-2xl font-black mt-2 text-[var(--text-primary)]">
                  {fmtINR(dashboardData?.kpi?.ytd)}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-1">
                  Full: {fmtFull(dashboardData?.kpi?.ytd)}
                </div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Trend Line Chart */}
              <div className="mis-card p-5">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-[var(--text-primary)]">
                  Daily Net Brokerage Trend (Last 30 Uploads)
                </h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboardData?.trend || []}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmtINR(v)} />
                      <RechartsTooltip formatter={(v: any) => [fmtFull(v), 'Net Brokerage']} />
                      <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Dealer-wise Bar Chart */}
              <div className="mis-card p-5">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-[var(--text-primary)]">
                  Brokerage by Dealer ({period === 'day' ? 'Today' : period})
                </h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(dashboardData?.dealerRows || []).slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="dealer" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmtINR(v)} />
                      <RechartsTooltip formatter={(v: any) => [fmtFull(v), 'Net Brokerage']} />
                      <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Top 10 Clients Table */}
            <div className="mis-card p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider mb-3 text-[var(--text-primary)] flex items-center justify-between">
                <span>Top 10 Clients by Brokerage ({period === 'day' ? 'Today' : period})</span>
                <span className="text-xs text-[var(--text-secondary)] font-normal">Click a client to view daily history</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="mis-table w-full text-left text-xs">
                  <thead>
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Client Code</th>
                      <th className="py-2.5 px-3">Client Name</th>
                      <th className="py-2.5 px-3 text-right">Net Brokerage</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dashboardData?.topClients || []).map((c, i) => (
                      <tr
                        key={c.code}
                        onClick={() => {
                          const client = masterByCode.get(normCode(c.code)) || { code: c.code, name: c.name };
                          handleOpenClientTransactions(client);
                        }}
                        className="hover:bg-[var(--hover)] border-b border-[var(--border)] cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-3 font-semibold text-[var(--text-secondary)]">{i + 1}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-500">{c.code}</td>
                        <td className="py-2.5 px-3 font-medium text-[var(--text-primary)]">{c.name || '—'}</td>
                        <td className="py-2.5 px-3 text-right font-black text-[var(--text-primary)]">{fmtFull(c.value)}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button type="button" className="p-1 text-blue-500 hover:bg-blue-500/10 rounded">
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 2: MIS PERFORMANCE
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'mis' && (
          <div className="space-y-6">
            <div className="mis-card p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">Dealer &amp; RM Performance MIS</h3>
                <p className="text-xs text-[var(--text-secondary)] m-0 mt-0.5">
                  Monthly performance, daily pace, and incentive eligibility through {misData?.latestDate || 'latest upload'}.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-3 py-1 rounded-full font-bold">
                  Multiplier Threshold: {targets.incentiveMultiplier || 10}x Salary
                </span>
              </div>
            </div>

            <div className="mis-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="mis-table w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="py-3 px-3">Dealer / RM</th>
                      <th className="py-3 px-3 text-right">Monthly Salary</th>
                      <th className="py-3 px-3 text-right">Target (Salary × Mult)</th>
                      <th className="py-3 px-3 text-right">Daily Target</th>
                      <th className="py-3 px-3 text-right">MTD Revenue</th>
                      <th className="py-3 px-3 text-right">Daily Avg Achieved</th>
                      <th className="py-3 px-3 text-right">Daily Shortfall</th>
                      <th className="py-3 px-3 text-right">Yesterday</th>
                      <th className="py-3 px-3 text-right">Clients</th>
                      <th className="py-3 px-3 text-right">Traded</th>
                      <th className="py-3 px-3 text-right">Dormant</th>
                      <th className="py-3 px-3 text-right">Multiplier</th>
                      <th className="py-3 px-3 text-center">Incentive Eligible</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(misData?.rows || []).map((row) => (
                      <tr key={row.dealer} className="border-b border-[var(--border)] hover:bg-[var(--hover)]">
                        <td className="py-3 px-3 font-bold text-[var(--text-primary)] flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dealerColor(row.dealer) }} />
                          <span>{row.dealer}</span>
                        </td>
                        <td className="py-3 px-3 text-right font-medium">{row.salary ? fmtFull(row.salary) : '—'}</td>
                        <td className="py-3 px-3 text-right font-medium">{row.target ? fmtFull(row.target) : '—'}</td>
                        <td className="py-3 px-3 text-right font-semibold text-blue-600">{fmtFull(row.dailyTarget)}</td>
                        <td className="py-3 px-3 text-right font-black text-[var(--text-primary)]">{fmtFull(row.mtdRevenue)}</td>
                        <td className="py-3 px-3 text-right font-semibold text-emerald-600">{fmtFull(row.dailyAvgAchieved)}</td>
                        <td className="py-3 px-3 text-right font-semibold text-rose-500">
                          {row.dailyShortfall && row.dailyShortfall > 0 ? fmtFull(row.dailyShortfall) : '₹0'}
                        </td>
                        <td className="py-3 px-3 text-right font-medium">{fmtFull(row.yesterdayRevenue)}</td>
                        <td className="py-3 px-3 text-right">{row.clientsMapped}</td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setMisTradedModal({ dealer: row.dealer, clients: row.tradedClients || [] })}
                            className="font-bold text-blue-500 hover:underline"
                          >
                            {row.tradedClientsCount}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setMisDormantModal({ dealer: row.dealer, clients: row.dormantClients || [] })}
                            className="font-bold text-amber-500 hover:underline"
                          >
                            {row.dormantClientsCount}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-right font-bold">
                          {row.multiplier ? `${row.multiplier.toFixed(2)}x` : '—'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {row.incentiveEligible ? (
                            <span className="bg-emerald-500/20 text-emerald-600 px-2.5 py-0.5 rounded-full font-black text-[11px]">
                              YES
                            </span>
                          ) : (
                            <span className="bg-slate-500/10 text-slate-500 px-2 py-0.5 rounded-full font-bold text-[11px]">
                              NO
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 3: CLIENTS DIRECTORY
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'clients' && (
          <div className="space-y-4">
            {/* Action & Filter Bar */}
            <div className="mis-card p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-[var(--text-secondary)]" />
                  <input
                    type="text"
                    placeholder="Search by code or name..."
                    value={clientSearch}
                    onChange={(e) => { setClientSearch(e.target.value); setClientPage(1); }}
                    className="mis-input pl-9 text-xs w-60"
                  />
                </div>

                <select
                  value={clientDealerFilter}
                  onChange={(e) => { setClientDealerFilter(e.target.value); setClientPage(1); }}
                  className="mis-select text-xs w-36"
                >
                  <option value="">All Dealers ({allDealerNames.length})</option>
                  {allDealerNames.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>

                <select
                  value={clientRmFilter}
                  onChange={(e) => { setClientRmFilter(e.target.value); setClientPage(1); }}
                  className="mis-select text-xs w-36"
                >
                  <option value="">All RMs ({allRmNames.length})</option>
                  {allRmNames.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>

                <select
                  value={clientBranchFilter}
                  onChange={(e) => { setClientBranchFilter(e.target.value); setClientPage(1); }}
                  className="mis-select text-xs w-36"
                >
                  <option value="">All Branches</option>
                  {branchesList.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMasterBulkOpen((o) => !o)}
                    className="mis-btn mis-btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
                  >
                    <UploadCloud size={13} /> Bulk Upload
                  </button>
                  <button
                    type="button"
                    onClick={handleExportAllClients}
                    className="mis-btn mis-btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
                  >
                    <Download size={13} /> Export All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingClient(null);
                      setNewClient({ code: '', name: '', rm: '', dealer: '', branch: '' });
                      setShowAddClientModal(true);
                    }}
                    className="mis-btn mis-btn-primary text-xs px-3.5 py-1.5 flex items-center gap-1"
                  >
                    <Plus size={14} /> Add Client
                  </button>
                </div>
              )}
            </div>

            {/* Bulk Master Upload Pane */}
            {isAdmin && masterBulkOpen && (
              <div className="mis-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">Bulk Upload Clients</h4>
                  <button type="button" onClick={() => downloadCSV('clients_sample.csv', ['Client Code', 'Client Name', 'Dealer', 'RM', 'Branch'], [['X001', 'John Doe', 'SAIJO', 'ARUN', 'Kochi']])} className="text-blue-500 hover:underline text-xs font-bold">
                    Download Sample CSV
                  </button>
                </div>
                <div
                  onClick={() => masterBulkFileRef.current?.click()}
                  className="border-2 border-dashed border-[var(--border)] rounded-xl p-5 text-center cursor-pointer hover:border-blue-500 transition-colors bg-[var(--bg-main)]"
                >
                  <FileSpreadsheet size={24} className="mx-auto text-blue-500 mb-2" />
                  <div className="text-xs font-bold text-[var(--text-primary)]">Click to upload Master Clients Excel / CSV</div>
                  <input
                    ref={masterBulkFileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const wb = await readWorkbook(file);
                      const sheet = wb.Sheets[wb.SheetNames[0]];
                      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
                      if (!rows.length) return;
                      const headers = (rows[0] || []).map(normHeader);
                      const codeIdx = findCol(headers, 'code', 'client code', 'party code', 'clientcode', 'ucc');
                      const nameIdx = findCol(headers, 'name', 'client name', 'party name', 'account name');
                      const dealerIdx = findCol(headers, 'dealer');
                      const rmIdx = findCol(headers, 'rm', 'relationship manager');
                      const branchIdx = findCol(headers, 'branch', 'location');

                      const records: MasterClient[] = rows.slice(1).map((r) => ({
                        code: String(r[codeIdx ?? 0] || '').trim(),
                        name: nameIdx !== null ? String(r[nameIdx] || '').trim() : '',
                        dealer: dealerIdx !== null ? String(r[dealerIdx] || '').trim() : '',
                        rm: rmIdx !== null ? String(r[rmIdx] || '').trim() : '',
                        branch: branchIdx !== null ? String(r[branchIdx] || '').trim() : '',
                      })).filter((r) => r.code);

                      if (records.length > 0) {
                        await dealerCalculationService.bulkUploadMaster(file.name, records);
                        toast.success(`Bulk uploaded ${records.length} client records`);
                        setMasterBulkOpen(false);
                        loadInitialData();
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* Clients Table */}
            <div className="mis-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="mis-table w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="py-2.5 px-3">Client Code</th>
                      <th className="py-2.5 px-3">Client Name</th>
                      <th className="py-2.5 px-3">Dealer</th>
                      <th className="py-2.5 px-3">RM</th>
                      <th className="py-2.5 px-3">Branch</th>
                      <th className="py-2.5 px-3 text-right">Debit Balance</th>
                      {isAdmin && <th className="py-2.5 px-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedClients.map((c) => (
                      <tr key={c.code} className="hover:bg-[var(--hover)] border-b border-[var(--border)] transition-colors">
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => handleOpenClientTransactions(c)}
                            className="font-mono font-bold text-blue-500 hover:underline flex items-center gap-1"
                          >
                            <span>{c.code}</span>
                            <ChevronRight size={12} className="opacity-60" />
                          </button>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-[var(--text-primary)]">{c.name || '—'}</td>
                        <td className="py-2.5 px-3">
                          {c.dealer ? (
                            <span
                              className="px-2 py-0.5 rounded text-[11px] font-bold"
                              style={{ background: dealerColor(c.dealer) + '20', color: dealerColor(c.dealer) }}
                            >
                              {c.dealer}
                            </span>
                          ) : (
                            <span className="text-[var(--text-secondary)]">Unmapped</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {c.rm ? (
                            <span
                              className="px-2 py-0.5 rounded text-[11px] font-bold"
                              style={{ background: dealerColor(c.rm) + '15', color: dealerColor(c.rm) }}
                            >
                              {c.rm}
                            </span>
                          ) : (
                            <span className="text-[var(--text-secondary)]">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--text-secondary)]">{c.branch || '—'}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-rose-500">
                          {latestDebitByCode[normCode(c.code)]?.debit
                            ? fmtFull(latestDebitByCode[normCode(c.code)].debit)
                            : '₹0'}
                        </td>
                        {isAdmin && (
                          <td className="py-2.5 px-3 text-right space-x-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingClient(c);
                                setNewClient({ code: c.code, name: c.name || '', rm: c.rm || '', dealer: c.dealer || '', branch: c.branch || '' });
                                setShowAddClientModal(true);
                              }}
                              className="p-1 text-blue-500 hover:bg-blue-500/10 rounded"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteClient(c.code)}
                              className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {!paginatedClients.length && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-xs text-[var(--text-secondary)]">
                          No clients match the specified search or filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Bar */}
              <div className="p-3 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <div>
                  Showing {filteredClients.length > 0 ? (clientPage - 1) * clientsPerPage + 1 : 0} to{' '}
                  {Math.min(clientPage * clientsPerPage, filteredClients.length)} of {filteredClients.length} clients
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={clientPage <= 1}
                    onClick={() => setClientPage((p) => p - 1)}
                    className="mis-btn mis-btn-secondary px-2 py-1 text-xs disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="px-2 font-bold">{clientPage} / {totalClientPages}</span>
                  <button
                    disabled={clientPage >= totalClientPages}
                    onClick={() => setClientPage((p) => p + 1)}
                    className="mis-btn mis-btn-secondary px-2 py-1 text-xs disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            {/* Danger Zone: Wipe Clients */}
            {isAdmin && masterClients.length > 0 && (
              <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 flex items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-xs text-red-600">Wipe Master Clients</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Permanently delete all {masterClients.length} clients. Daily records will become unmapped.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setWipeConfirm({ type: 'clients', typed: '' })}
                  className="mis-btn bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5"
                >
                  Wipe All Clients
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 4: DEALERS REGISTRY & SPLIT TABLE
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'dealers' && (
          <div className="space-y-6">
            {/* Period and Action Controls */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-1 bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border)]">
                {(['week', 'month', 'quarter', 'year', 'all'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setDealersPeriod(p)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                      dealersPeriod === p
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {p === 'all' ? 'All time' : p}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-[var(--text-secondary)]" />
                  <input
                    type="text"
                    placeholder="Search dealer..."
                    value={dealerSearch}
                    onChange={(e) => setDealerSearch(e.target.value)}
                    className="mis-input pl-9 text-xs w-48"
                  />
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDealerBulkOpen((o) => !o)}
                      className="mis-btn mis-btn-secondary text-xs px-3 py-2 flex items-center gap-1"
                    >
                      <UploadCloud size={14} /> Bulk Upload
                    </button>
                    <input
                      type="text"
                      placeholder="New dealer name"
                      value={newDealerName}
                      onChange={(e) => setNewDealerName(e.target.value)}
                      className="mis-input text-xs w-36"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!newDealerName.trim()) return;
                        const updated = [...dealers, newDealerName.trim()];
                        await dealerCalculationService.replaceDealers(updated);
                        setDealers(updated);
                        setNewDealerName('');
                        toast.success(`Added dealer ${newDealerName.trim()}`);
                      }}
                      className="mis-btn bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-2 flex items-center gap-1"
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bulk Upload Dealers */}
            {isAdmin && dealerBulkOpen && (
              <div className="mis-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">Bulk Upload Dealers</h4>
                  <button type="button" onClick={() => downloadCSV('dealers_sample.csv', ['Dealer Name'], [['SIMNA'], ['SAIJO']])} className="text-purple-600 hover:underline text-xs font-bold">
                    Download Sample CSV
                  </button>
                </div>
                <div
                  onClick={() => dealerBulkFileRef.current?.click()}
                  className="border-2 border-dashed border-[var(--border)] rounded-xl p-5 text-center cursor-pointer hover:border-purple-500 transition-colors bg-[var(--bg-main)]"
                >
                  <FileSpreadsheet size={24} className="mx-auto text-purple-600 mb-2" />
                  <div className="text-xs font-bold text-[var(--text-primary)]">Click to upload Dealers Excel / CSV</div>
                  <input
                    ref={dealerBulkFileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const wb = await readWorkbook(file);
                      const sheet = wb.Sheets[wb.SheetNames[0]];
                      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
                      const names = rows.map((r) => String(r[0] || '').trim()).filter(Boolean);
                      const combined = Array.from(new Set([...dealers, ...names]));
                      await dealerCalculationService.replaceDealers(combined);
                      setDealers(combined);
                      setDealerBulkOpen(false);
                      toast.success(`Uploaded ${names.length} dealers`);
                    }}
                  />
                </div>
              </div>
            )}

            {/* Dealer Performance Table */}
            <div className="mis-card p-5 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
                Dealer Performance ({dealersPeriod})
              </h3>
              <div className="overflow-x-auto">
                <table className="mis-table w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="py-2.5 px-3">Dealer</th>
                      <th className="py-2.5 px-3 text-right">Clients</th>
                      <th className="py-2.5 px-3 text-right">Total Brokerage</th>
                      <th className="py-2.5 px-3 text-right">Net Brokerage</th>
                      <th className="py-2.5 px-3">Target Progress</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dealerStatsRows.map((d) => (
                      <tr key={d.dealer} className="hover:bg-[var(--hover)] border-b border-[var(--border)]">
                        <td className="py-2.5 px-3 font-bold text-[var(--text-primary)] flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dealerColor(d.dealer) }} />
                          {editingDealer === d.dealer ? (
                            <div className="flex items-center gap-1">
                              <input
                                value={editDealerName}
                                onChange={(e) => setEditDealerName(e.target.value)}
                                className="mis-input py-0.5 px-1.5 text-xs w-28"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!editDealerName.trim()) return;
                                  const updated = dealers.map((x) => (x === d.dealer ? editDealerName.trim() : x));
                                  await dealerCalculationService.replaceDealers(updated);
                                  setDealers(updated);
                                  setEditingDealer(null);
                                  toast.success('Dealer renamed');
                                }}
                                className="text-emerald-500 hover:text-emerald-600"
                              >
                                <Check size={14} />
                              </button>
                              <button type="button" onClick={() => setEditingDealer(null)} className="text-slate-400">
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <span>{d.dealer}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium">{d.clients}</td>
                        <td className="py-2.5 px-3 text-right font-medium">{fmtFull(d.brokerage)}</td>
                        <td className="py-2.5 px-3 text-right font-black text-purple-600">{fmtFull(d.netBrokerage)}</td>
                        <td className="py-2.5 px-3 w-48">
                          {d.target > 0 ? (
                            <div>
                              <div className="flex justify-between text-[11px] font-bold mb-1">
                                <span>{d.achievementPct.toFixed(1)}%</span>
                                <span className="text-[var(--text-secondary)]">{fmtINR(d.target)}</span>
                              </div>
                              <div className="w-full bg-[var(--bg-main)] h-2 rounded-full overflow-hidden border border-[var(--border)]">
                                <div
                                  className={`h-full rounded-full ${d.achievementPct >= 100 ? 'bg-emerald-500' : 'bg-purple-600'}`}
                                  style={{ width: `${Math.min(100, d.achievementPct)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-[var(--text-secondary)] text-[11px]">No target</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-1">
                          <button
                            type="button"
                            onClick={() => handleExportDealerClients(d.dealer)}
                            className="mis-btn mis-btn-secondary text-[11px] px-2 py-1 inline-flex items-center gap-1"
                          >
                            <Download size={11} /> Export
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => { setEditingDealer(d.dealer); setEditDealerName(d.dealer); }}
                                className="p-1 text-blue-500 hover:bg-blue-500/10 rounded"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (window.confirm(`Remove dealer ${d.dealer}?`)) {
                                    const updated = dealers.filter((x) => x !== d.dealer);
                                    await dealerCalculationService.replaceDealers(updated);
                                    setDealers(updated);
                                    toast.success(`Removed ${d.dealer}`);
                                  }
                                }}
                                className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RM / Dealer Split Table */}
            <div className="mis-card p-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    Client Revenue Split (Dealer vs RM)
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)] m-0">
                    Breakdown of how each client's brokerage divides per RM split ({targets.rmSplitPct ?? 50}%).
                  </p>
                </div>
                <input
                  type="text"
                  placeholder="Filter split table..."
                  value={splitSearch}
                  onChange={(e) => setSplitSearch(e.target.value)}
                  className="mis-input text-xs w-52"
                />
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="mis-table w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[var(--bg-card)] border-b border-[var(--border)]">
                    <tr>
                      <th className="py-2 px-3">Client Code</th>
                      <th className="py-2 px-3">Client Name</th>
                      <th className="py-2 px-3">Dealer</th>
                      <th className="py-2 px-3">RM</th>
                      <th className="py-2 px-3 text-right">Total Brok</th>
                      <th className="py-2 px-3 text-right">Dealer Share</th>
                      <th className="py-2 px-3 text-right">RM Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {splitRows.slice(0, 100).map((r) => (
                      <tr key={r.code} className="border-b border-[var(--border)] hover:bg-[var(--hover)]">
                        <td className="py-2 px-3 font-mono font-bold text-blue-500">{r.code}</td>
                        <td className="py-2 px-3 text-[var(--text-primary)]">{r.name || '—'}</td>
                        <td className="py-2 px-3 font-medium">{r.dealer}</td>
                        <td className="py-2 px-3 text-[var(--text-secondary)]">{r.rm || '—'}</td>
                        <td className="py-2 px-3 text-right font-bold">{fmtFull(r.brokerage)}</td>
                        <td className="py-2 px-3 text-right font-semibold text-purple-600">
                          {fmtFull(r.dealerShare)} ({r.dealerPct}%)
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-pink-600">
                          {fmtFull(r.rmShare)} ({r.rmPct}%)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 5: RELATIONSHIP MANAGERS (RMS) — ALL 21 RMS
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'rms' && (
          <div className="space-y-6">
            {/* Period and Action Controls */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-1 bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border)]">
                {(['week', 'month', 'quarter', 'year', 'all'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setRmsPeriod(p)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                      rmsPeriod === p
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {p === 'all' ? 'All time' : p}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-[var(--text-secondary)]" />
                  <input
                    type="text"
                    placeholder="Search RM..."
                    value={rmSearch}
                    onChange={(e) => setRmSearch(e.target.value)}
                    className="mis-input pl-9 text-xs w-48"
                  />
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setRmBulkOpen((o) => !o)}
                      className="mis-btn mis-btn-secondary text-xs px-3 py-2 flex items-center gap-1"
                    >
                      <UploadCloud size={14} /> Bulk Upload
                    </button>
                    <input
                      type="text"
                      placeholder="New RM name"
                      value={newRmName}
                      onChange={(e) => setNewRmName(e.target.value)}
                      className="mis-input text-xs w-36"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!newRmName.trim()) return;
                        const updated = [...rms, newRmName.trim()];
                        await dealerCalculationService.replaceRms(updated);
                        setRms(updated);
                        setNewRmName('');
                        toast.success(`Added RM ${newRmName.trim()}`);
                      }}
                      className="mis-btn bg-rose-600 hover:bg-rose-700 text-white text-xs px-3 py-2 flex items-center gap-1"
                    >
                      <Plus size={14} /> Add RM
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bulk Upload RMs */}
            {isAdmin && rmBulkOpen && (
              <div className="mis-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">Bulk Upload Relationship Managers</h4>
                  <button type="button" onClick={() => downloadCSV('rms_sample.csv', ['RM Name'], [['ARUN'], ['PRADEEP']])} className="text-rose-600 hover:underline text-xs font-bold">
                    Download Sample CSV
                  </button>
                </div>
                <div
                  onClick={() => rmBulkFileRef.current?.click()}
                  className="border-2 border-dashed border-[var(--border)] rounded-xl p-5 text-center cursor-pointer hover:border-rose-500 transition-colors bg-[var(--bg-main)]"
                >
                  <FileSpreadsheet size={24} className="mx-auto text-rose-600 mb-2" />
                  <div className="text-xs font-bold text-[var(--text-primary)]">Click to upload RMs Excel / CSV</div>
                  <input
                    ref={rmBulkFileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const wb = await readWorkbook(file);
                      const sheet = wb.Sheets[wb.SheetNames[0]];
                      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
                      const names = rows.map((r) => String(r[0] || '').trim()).filter(Boolean);
                      const combined = Array.from(new Set([...rms, ...names]));
                      await dealerCalculationService.replaceRms(combined);
                      setRms(combined);
                      setRmBulkOpen(false);
                      toast.success(`Uploaded ${names.length} RMs`);
                    }}
                  />
                </div>
              </div>
            )}

            {/* RM Performance Table */}
            <div className="mis-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    Relationship Managers Performance ({rmStatsRows.length} Total RMs)
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)] m-0">
                    Net Brokerage is each RM's share of their mapped clients' brokerage ({targets.rmSplitPct ?? 50}%).
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="mis-table w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Relationship Manager</th>
                      <th className="py-2.5 px-3 text-right">Mapped Clients</th>
                      <th className="py-2.5 px-3 text-right">Net Brokerage ({rmsPeriod})</th>
                      {isAdmin && <th className="py-2.5 px-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rmStatsRows.map((r, i) => (
                      <tr key={r.rm} className="hover:bg-[var(--hover)] border-b border-[var(--border)]">
                        <td className="py-2.5 px-3 text-[var(--text-secondary)]">{i + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-[var(--text-primary)] flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dealerColor(r.rm) }} />
                          {editingRm === r.rm ? (
                            <div className="flex items-center gap-1">
                              <input
                                value={editRmName}
                                onChange={(e) => setEditRmName(e.target.value)}
                                className="mis-input py-0.5 px-1.5 text-xs w-28"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!editRmName.trim()) return;
                                  const updated = rms.map((x) => (x === r.rm ? editRmName.trim() : x));
                                  await dealerCalculationService.replaceRms(updated);
                                  setRms(updated);
                                  setEditingRm(null);
                                  toast.success('RM renamed');
                                }}
                                className="text-emerald-500 hover:text-emerald-600"
                              >
                                <Check size={14} />
                              </button>
                              <button type="button" onClick={() => setEditingRm(null)} className="text-slate-400">
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <span>{r.rm}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium">{r.clients}</td>
                        <td className="py-2.5 px-3 text-right font-black text-rose-600">{fmtFull(r.netBrokerage)}</td>
                        {isAdmin && (
                          <td className="py-2.5 px-3 text-right space-x-1">
                            <button
                              type="button"
                              onClick={() => { setEditingRm(r.rm); setEditRmName(r.rm); }}
                              className="p-1 text-blue-500 hover:bg-blue-500/10 rounded"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (window.confirm(`Remove RM ${r.rm}?`)) {
                                  const updated = rms.filter((x) => x !== r.rm);
                                  await dealerCalculationService.replaceRms(updated);
                                  setRms(updated);
                                  toast.success(`Removed RM ${r.rm}`);
                                }
                              }}
                              className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Danger Zone: Remove all RMs */}
            {isAdmin && allRmNames.length > 0 && (
              <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 flex items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-xs text-red-600">Remove all RMs</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Permanently delete all {allRmNames.length} RM(s). Mapped clients will become unassigned.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setWipeConfirm({ type: 'rms', typed: '' })}
                  className="mis-btn bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5"
                >
                  Remove all RMs
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 6: UPLOAD FILES (BROKERAGE & DEBIT)
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'upload' && isAdmin && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Brokerage File Upload Pane */}
              <div className="mis-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    Daily Brokerage Upload (Kotak / TradePlus)
                  </h3>
                  <span className="text-xs text-blue-500 font-bold">Kotak Share: {targets.kotakSharePct ?? 85}%</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mis-label text-xs">Upload Date</label>
                    <input
                      type="date"
                      value={uploadDate}
                      onChange={(e) => setUploadDate(e.target.value)}
                      className="mis-input text-xs"
                    />
                  </div>
                  <div>
                    <label className="mis-label text-xs">Brokerage Source</label>
                    <select
                      value={uploadSource}
                      onChange={(e) => setUploadSource(e.target.value as any)}
                      className="mis-select text-xs"
                    >
                      <option value="SW">TradePlus / Standard (SW 100%)</option>
                      <option value="KOTAK">Kotak (Split 85% / 15%)</option>
                    </select>
                  </div>
                </div>

                <div
                  onClick={() => bulkFileInputRef.current?.click()}
                  className="border-2 border-dashed border-[var(--border)] rounded-xl p-6 text-center cursor-pointer hover:border-blue-500 transition-colors bg-[var(--bg-main)]"
                >
                  <FileSpreadsheet size={28} className="mx-auto text-blue-500 mb-2" />
                  <div className="text-xs font-bold text-[var(--text-primary)]">
                    {uploadFileName || 'Click to select or drop Brokerage Excel / CSV file'}
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)] mt-1">
                    Accepts .xlsx, .xls, .csv with Client Code, Client Name, Net Brokerage
                  </div>
                  <input
                    ref={bulkFileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadFileName(file.name);
                      const wb = await readWorkbook(file);
                      const sheet = wb.Sheets[wb.SheetNames[0]];
                      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
                      if (!rows.length) return;
                      const headers = (rows[0] || []).map(normHeader);
                      const codeIdx = findCol(headers, 'client code', 'clientcode', 'code', 'party_code', 'party code', 'client_id', 'ucc');
                      const nameIdx = findCol(headers, 'client name', 'clientname', 'name', 'party_name', 'party name', 'account name');
                      const brokIdx = findCol(headers, 'net brokerage', 'net brok', 'brokerage', 'net_brok', 'netbrok', 'total brok', 'total_brok');

                      const parsed = rows.slice(1).map((r) => {
                        const code = String(r[codeIdx ?? 0] || '').trim();
                        const name = nameIdx !== null ? String(r[nameIdx] || '').trim() : '';
                        const netBrok = brokIdx !== null ? num(r[brokIdx]) : 0;
                        return { code, name, netBrok, source: uploadSource };
                      }).filter((r) => r.code);

                      setParsedUploadRecords(parsed);
                      toast.success(`Parsed ${parsed.length} client records`);
                    }}
                  />
                </div>

                {parsedUploadRecords.length > 0 && (
                  <div className="p-3 bg-[var(--bg-main)] rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between font-bold">
                      <span>Parsed Records: {parsedUploadRecords.length}</span>
                      <span>Total Gross: {fmtFull(parsedUploadRecords.reduce((s, r) => s + r.netBrok, 0))}</span>
                    </div>
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={async () => {
                        setUploading(true);
                        try {
                          await dealerCalculationService.upsertDaily(uploadDate, parsedUploadRecords);
                          toast.success(`Saved ${parsedUploadRecords.length} records for ${uploadDate}`);
                          setParsedUploadRecords([]);
                          setUploadFileName('');
                          loadInitialData();
                        } catch (err: any) {
                          toast.error(apiErrorMessage(err));
                        } finally {
                          setUploading(false);
                        }
                      }}
                      className="mis-btn mis-btn-primary w-full text-xs py-2"
                    >
                      {uploading ? 'Uploading...' : `Save ${parsedUploadRecords.length} Brokerage Records`}
                    </button>
                  </div>
                )}
              </div>

              {/* Upload History Table */}
              <div className="mis-card p-5 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Uploaded Brokerage Dates ({dailyDates.length})
                </h3>
                <div className="overflow-x-auto max-h-72">
                  <table className="mis-table w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3 text-right">Trades Count</th>
                        <th className="py-2 px-3">Sources</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyDates.map((d) => (
                        <tr key={d.date} className="border-b border-[var(--border)] hover:bg-[var(--hover)]">
                          <td className="py-2 px-3 font-bold font-mono text-[var(--text-primary)]">{d.date}</td>
                          <td className="py-2 px-3 text-right font-medium">{d.count.toLocaleString()}</td>
                          <td className="py-2 px-3 space-x-1">
                            {(d.sources || []).map((s) => (
                              <span key={s} className="bg-blue-500/10 text-blue-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                {s}
                              </span>
                            ))}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={async () => {
                                if (window.confirm(`Delete uploaded records for ${d.date}?`)) {
                                  await dealerCalculationService.deleteDaily(d.date);
                                  toast.success(`Deleted ${d.date}`);
                                  loadInitialData();
                                }
                              }}
                              className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Daily Debit File Upload Pane */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
              <div className="mis-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    Daily Debit Balance Upload
                  </h3>
                </div>

                <div>
                  <label className="mis-label text-xs">Debit Date</label>
                  <input
                    type="date"
                    value={debitUploadDate}
                    onChange={(e) => setDebitUploadDate(e.target.value)}
                    className="mis-input text-xs w-48"
                  />
                </div>

                <div
                  onClick={() => debitFileInputRef.current?.click()}
                  className="border-2 border-dashed border-[var(--border)] rounded-xl p-6 text-center cursor-pointer hover:border-emerald-500 transition-colors bg-[var(--bg-main)]"
                >
                  <FileSpreadsheet size={28} className="mx-auto text-emerald-500 mb-2" />
                  <div className="text-xs font-bold text-[var(--text-primary)]">
                    {debitFileName || 'Click to select or drop Debit Excel / CSV file'}
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)] mt-1">
                    Accepts .xlsx, .xls, .csv with Client Code, Client Name, Debit Amount
                  </div>
                  <input
                    ref={debitFileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setDebitFileName(file.name);
                      const wb = await readWorkbook(file);
                      const sheet = wb.Sheets[wb.SheetNames[0]];
                      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
                      if (!rows.length) return;
                      const headers = (rows[0] || []).map(normHeader);
                      const codeIdx = findCol(headers, 'client code', 'clientcode', 'code', 'party_code', 'party code', 'ucc');
                      const nameIdx = findCol(headers, 'client name', 'clientname', 'name', 'party_name');
                      const debitIdx = findCol(headers, 'debit', 'debit balance', 'balance', 'amount', 'ledger balance');

                      const parsed = rows.slice(1).map((r) => {
                        const code = String(r[codeIdx ?? 0] || '').trim();
                        const name = nameIdx !== null ? String(r[nameIdx] || '').trim() : '';
                        const debit = debitIdx !== null ? num(r[debitIdx]) : 0;
                        return { code, name, debit };
                      }).filter((r) => r.code);

                      setParsedDebitRecords(parsed);
                      toast.success(`Parsed ${parsed.length} debit records`);
                    }}
                  />
                </div>

                {parsedDebitRecords.length > 0 && (
                  <div className="p-3 bg-[var(--bg-main)] rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between font-bold">
                      <span>Parsed Debits: {parsedDebitRecords.length}</span>
                      <span>Total Debit: {fmtFull(parsedDebitRecords.reduce((s, r) => s + r.debit, 0))}</span>
                    </div>
                    <button
                      type="button"
                      disabled={uploadingDebit}
                      onClick={async () => {
                        setUploadingDebit(true);
                        try {
                          await dealerCalculationService.upsertDebit(debitUploadDate, parsedDebitRecords);
                          toast.success(`Saved ${parsedDebitRecords.length} debit records for ${debitUploadDate}`);
                          setParsedDebitRecords([]);
                          setDebitFileName('');
                          loadInitialData();
                        } catch (err: any) {
                          toast.error(apiErrorMessage(err));
                        } finally {
                          setUploadingDebit(false);
                        }
                      }}
                      className="mis-btn bg-emerald-600 hover:bg-emerald-700 text-white w-full text-xs py-2"
                    >
                      {uploadingDebit ? 'Uploading...' : `Save ${parsedDebitRecords.length} Debit Records`}
                    </button>
                  </div>
                )}
              </div>

              {/* Debit History Table */}
              <div className="mis-card p-5 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Uploaded Debit Dates ({debitDates.length})
                </h3>
                <div className="overflow-x-auto max-h-72">
                  <table className="mis-table w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3 text-right">Debit Records</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {debitDates.map((d) => (
                        <tr key={d.date} className="border-b border-[var(--border)] hover:bg-[var(--hover)]">
                          <td className="py-2 px-3 font-bold font-mono text-[var(--text-primary)]">{d.date}</td>
                          <td className="py-2 px-3 text-right font-medium">{d.count.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={async () => {
                                if (window.confirm(`Delete debit records for ${d.date}?`)) {
                                  await dealerCalculationService.deleteDebit(d.date);
                                  toast.success(`Deleted debit records for ${d.date}`);
                                  loadInitialData();
                                }
                              }}
                              className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 7: MISSING FINDER
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'missing' && isAdmin && (
          <div className="space-y-4">
            <div className="mis-card p-5 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">Missing &amp; Unmapped Client Finder</h3>
                <p className="text-xs text-[var(--text-secondary)] m-0 mt-0.5">
                  Scans daily trade logs against Master Clients to find unmapped client codes.
                </p>
              </div>
              <button
                type="button"
                onClick={handleScanMissing}
                disabled={missingLoading}
                className="mis-btn mis-btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
              >
                <RefreshCw size={14} className={missingLoading ? 'animate-spin' : ''} /> Scan for Unmapped Codes
              </button>
            </div>

            <div className="mis-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="mis-table w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Client Code</th>
                      <th className="py-2.5 px-3">Client Name</th>
                      <th className="py-2.5 px-3 text-right">Trade Occurrences</th>
                      <th className="py-2.5 px-3 text-right">Total Net Brokerage</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missingCodes.map((m, i) => (
                      <tr key={m.code} className="hover:bg-[var(--hover)] border-b border-[var(--border)]">
                        <td className="py-2.5 px-3 text-[var(--text-secondary)]">{i + 1}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-500">{m.code}</td>
                        <td className="py-2.5 px-3">{m.name || '—'}</td>
                        <td className="py-2.5 px-3 text-right font-medium">{m.count}</td>
                        <td className="py-2.5 px-3 text-right font-black text-[var(--text-primary)]">{fmtFull(m.netBrok)}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setMissingMapModal({ code: m.code, name: m.name });
                              setMapDealer('');
                              setMapRm('');
                              setMapBranch('');
                            }}
                            className="mis-btn mis-btn-primary text-[11px] px-2.5 py-1"
                          >
                            Quick Map
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!missingCodes.length && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-xs text-[var(--text-secondary)]">
                          {missingLoading ? 'Scanning trade logs...' : 'Click "Scan for Unmapped Codes" to analyze.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 8: REPORTS TAB
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'reports' && isAdmin && (
          <div className="space-y-4">
            <style>{`
              @media print {
                body * { visibility: hidden !important; }
                .dt-report-printable, .dt-report-printable * { visibility: visible !important; }
                .dt-report-printable { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: white !important; color: black !important; }
              }
            `}</style>

            {/* Top Header Row with View Selector and Export buttons */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-black tracking-tight text-[var(--text-primary)] m-0">
                  {reportView === 'dealers' ? 'Dealer report' : reportView === 'rms' ? 'RM report' : 'Client-wise report'}
                </h2>
                <select
                  value={reportView}
                  onChange={(e) => setReportView(e.target.value as any)}
                  className="mis-select py-1 text-xs w-44 font-semibold"
                >
                  <option value="dealers">Dealers Summary</option>
                  <option value="rms">RMs Summary</option>
                  <option value="clients">Client-wise Breakdown</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportReportExcel}
                  className="mis-btn mis-btn-secondary text-xs px-3.5 py-1.5 flex items-center gap-1.5 font-bold shadow-sm"
                >
                  <FileSpreadsheet size={14} className="text-emerald-500" /> Export Excel
                </button>
                <button
                  type="button"
                  onClick={handleExportReportPDF}
                  className="mis-btn mis-btn-secondary text-xs px-3.5 py-1.5 flex items-center gap-1.5 font-bold shadow-sm"
                >
                  <Printer size={14} className="text-blue-500" /> Export PDF
                </button>
              </div>
            </div>

            {/* Filter Card with Week, Month, Quarter, Year, All Time + Custom Range */}
            <div className="mis-card p-3.5 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border)]">
                {(['week', 'month', 'quarter', 'year', 'all'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setReportPeriod(p);
                      setReportUseCustom(false);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                      !reportUseCustom && reportPeriod === p
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {p === 'all' ? 'All time' : p}
                  </button>
                ))}
              </div>

              <div className="h-6 w-px bg-[var(--border)] hidden sm:block" />

              <div className="flex items-center gap-2 flex-nowrap">
                <span className="text-xs font-semibold text-[var(--text-secondary)] whitespace-nowrap">Custom range:</span>
                <input
                  type="date"
                  value={reportCustomFrom}
                  onChange={(e) => {
                    setReportCustomFrom(e.target.value);
                    setReportUseCustom(true);
                  }}
                  className="mis-input py-1 text-xs w-36"
                />
                <span className="text-xs text-[var(--text-secondary)]">to</span>
                <input
                  type="date"
                  value={reportCustomTo}
                  onChange={(e) => {
                    setReportCustomTo(e.target.value);
                    setReportUseCustom(true);
                  }}
                  className="mis-input py-1 text-xs w-36"
                />
                {reportUseCustom && (
                  <button
                    type="button"
                    onClick={() => {
                      setReportUseCustom(false);
                      setReportCustomFrom('');
                      setReportCustomTo('');
                    }}
                    className="text-xs font-bold text-red-500 hover:text-red-400 px-2 py-1 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              </div>
            </div>

            {/* Printable Report Section */}
            <div className="dt-report-printable">
              <div className="mis-card overflow-hidden p-4 space-y-3">
                <div className="flex items-center justify-between gap-3 text-xs text-[var(--text-secondary)] border-b border-[var(--border)] pb-3">
                  <div className="flex items-center gap-2 font-medium">
                    <FileBarChart2 size={15} className="text-blue-500" />
                    <span>
                      Range: <strong className="text-[var(--text-primary)]">{reportRange.from || 'start'} → {reportRange.to || 'today'}</strong>
                    </span>
                  </div>
                  {reportLoading && (
                    <span className="text-blue-500 flex items-center gap-1">
                      <RefreshCw size={12} className="animate-spin" /> Loading report...
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="mis-table w-full text-left text-xs">
                    {reportView === 'dealers' && (
                      <>
                        <thead>
                          <tr className="border-b border-[var(--border)] text-[var(--text-secondary)]">
                            <th className="py-2.5 px-3">Dealer</th>
                            <th className="py-2.5 px-3 text-right">Clients Mapped</th>
                            <th className="py-2.5 px-3 text-right">Traded Clients</th>
                            <th className="py-2.5 px-3 text-right">Total Brokerage</th>
                            <th className="py-2.5 px-3 text-right">Net Brokerage</th>
                            {isMonthlyView && (
                              <>
                                <th className="py-2.5 px-3 text-right">Multiplier</th>
                                <th className="py-2.5 px-3">Incentive</th>
                              </>
                            )}
                            {reportMonthComparison && <th className="py-2.5 px-3 text-right">vs Last Month</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.map((r, i) => {
                            const { salary, multiplier, eligible } = isMonthlyView ? incentiveFor(r) : { salary: null, multiplier: null, eligible: false };
                            const pctChange = reportMonthComparison && r.prevNetBrokerage ? ((r.netBrokerage - r.prevNetBrokerage) / r.prevNetBrokerage) * 100 : null;
                            const isNew = reportMonthComparison && !r.prevNetBrokerage && r.netBrokerage > 0;
                            const isExpanded = expandedReportDealer === r.dealer;

                            return (
                              <React.Fragment key={r.dealer || i}>
                                <tr
                                  onClick={reportMonthComparison ? () => setExpandedReportDealer(isExpanded ? null : r.dealer) : undefined}
                                  className={`border-b border-[var(--border)] hover:bg-[var(--hover)] transition-colors ${
                                    reportMonthComparison ? 'cursor-pointer' : ''
                                  }`}
                                >
                                  <td className="py-2.5 px-3 font-bold text-[var(--accent)] flex items-center gap-2">
                                    <span>{r.dealer}</span>
                                    {reportMonthComparison && (
                                      isExpanded ? <ChevronUp size={13} className="text-[var(--text-secondary)]" /> : <ChevronDown size={13} className="text-[var(--text-secondary)]" />
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-medium">{r.clientsMapped ?? '—'}</td>
                                  <td className="py-2.5 px-3 text-right font-medium">{r.tradedClients ?? 0}</td>
                                  <td className="py-2.5 px-3 text-right font-semibold">
                                    {fmtFull(r.totalBrokerage || (Number(r.swGross) || 0) + (Number(r.kotakGross) || 0))}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-bold text-[var(--text-primary)]">
                                    {fmtFull(r.netBrokerage || r.netRevenue)}
                                  </td>
                                  {isMonthlyView && (
                                    <>
                                      <td className="py-2.5 px-3 text-right font-medium">
                                        {multiplier != null ? `${multiplier.toFixed(2)}x` : '—'}
                                      </td>
                                      <td className="py-2.5 px-3">
                                        {salary == null ? (
                                          <span className="text-[var(--text-secondary)]">—</span>
                                        ) : (
                                          <span
                                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                              eligible
                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                                            }`}
                                          >
                                            {eligible ? 'Eligible' : 'Not eligible'}
                                          </span>
                                        )}
                                      </td>
                                    </>
                                  )}
                                  {reportMonthComparison && (
                                    <td className="py-2.5 px-3 text-right">
                                      {isNew ? (
                                        <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded text-[11px] font-bold">
                                          New
                                        </span>
                                      ) : pctChange == null ? (
                                        <span className="text-[var(--text-secondary)]">—</span>
                                      ) : (
                                        <span
                                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                            pctChange >= 0
                                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                          }`}
                                        >
                                          {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(1)}%
                                        </span>
                                      )}
                                    </td>
                                  )}
                                </tr>

                                {/* Expanded row with Month-over-Month comparisons + Dormant clients list */}
                                {isExpanded && reportMonthComparison && (
                                  <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border)]">
                                    <td colSpan={6 + (isMonthlyView ? 2 : 0)} className="p-4">
                                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
                                        <div className="p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)]">
                                          <div className="text-[10px] text-[var(--text-secondary)] font-bold uppercase">Prev Month Brokerage</div>
                                          <div className="text-xs font-black text-[var(--text-primary)] mt-0.5">{fmtINR(r.prevNetBrokerage)}</div>
                                        </div>
                                        <div className="p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)]">
                                          <div className="text-[10px] text-[var(--text-secondary)] font-bold uppercase">Prev Traded Clients</div>
                                          <div className="text-xs font-black text-purple-400 mt-0.5">{r.prevTradedClients || 0}</div>
                                        </div>
                                        <div className="p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)]">
                                          <div className="text-[10px] text-[var(--text-secondary)] font-bold uppercase">This Traded Clients</div>
                                          <div className="text-xs font-black text-teal-400 mt-0.5">{r.tradedClients || 0}</div>
                                        </div>
                                        <div className="p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)]">
                                          <div className="text-[10px] text-[var(--text-secondary)] font-bold uppercase">Brokerage Change</div>
                                          <div className={`text-xs font-black mt-0.5 ${pctChange && pctChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {isNew ? 'New' : pctChange == null ? '—' : `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}%`}
                                          </div>
                                        </div>
                                        <div className="p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)]">
                                          <div className="text-[10px] text-[var(--text-secondary)] font-bold uppercase">Dormant Clients</div>
                                          <div className={`text-xs font-black mt-0.5 ${r.dormantClientsCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                            {r.dormantClientsCount || 0}
                                          </div>
                                        </div>
                                        <div className="p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)]">
                                          <div className="text-[10px] text-[var(--text-secondary)] font-bold uppercase">Incentive Status</div>
                                          <div className="text-xs font-black text-emerald-400 mt-0.5">
                                            {salary == null ? '—' : eligible ? 'Eligible' : 'Not eligible'}
                                          </div>
                                        </div>
                                      </div>

                                      {r.dormantClientsCount > 0 && r.dormantClients?.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                          <div className="text-xs font-bold text-[var(--text-secondary)]">
                                            Follow-up: traded last month, not yet in this range ({r.dormantClients.length})
                                          </div>
                                          <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--border)]">
                                            <table className="w-full text-left text-xs bg-[var(--bg-card)]">
                                              <thead>
                                                <tr className="border-b border-[var(--border)] text-[var(--text-secondary)] bg-[var(--bg-secondary)]">
                                                  <th className="py-1.5 px-3">Client Code</th>
                                                  <th className="py-1.5 px-3">Client Name</th>
                                                  <th className="py-1.5 px-3 text-right">Last Month Net Brokerage</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {r.dormantClients.map((dc: any, dci: number) => (
                                                  <tr key={dci} className="border-b border-[var(--border)]/50 hover:bg-[var(--hover)]">
                                                    <td className="py-1 px-3 font-mono text-[var(--accent)]">{dc.code}</td>
                                                    <td className="py-1 px-3">{dc.name || '—'}</td>
                                                    <td className="py-1 px-3 text-right font-medium">{fmtFull(dc.lastMonthNetBrokerage)}</td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                          {!reportData.length && (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-xs text-[var(--text-secondary)]">
                                {reportLoading ? 'Loading report data...' : 'No activity found in this period.'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                        {reportData.length > 0 && (
                          <tfoot>
                            <tr className="border-t-2 border-[var(--border)] font-bold text-[var(--text-primary)] bg-[var(--bg-secondary)]">
                              <td className="py-2.5 px-3">TOTAL</td>
                              <td className="py-2.5 px-3 text-right">{reportTotals.clientsMapped}</td>
                              <td className="py-2.5 px-3 text-right">{reportTotals.tradedClients}</td>
                              <td className="py-2.5 px-3 text-right">{fmtFull(reportTotals.totalBrokerage)}</td>
                              <td className="py-2.5 px-3 text-right">{fmtFull(reportTotals.netBrokerage)}</td>
                              {isMonthlyView && (
                                <>
                                  <td></td>
                                  <td></td>
                                </>
                              )}
                              {reportMonthComparison && <td></td>}
                            </tr>
                          </tfoot>
                        )}
                      </>
                    )}

                    {reportView === 'rms' && (
                      <>
                        <thead>
                          <tr className="border-b border-[var(--border)] text-[var(--text-secondary)]">
                            <th className="py-2.5 px-3">#</th>
                            <th className="py-2.5 px-3">RM</th>
                            <th className="py-2.5 px-3 text-right">Traded Clients</th>
                            <th className="py-2.5 px-3 text-right">Net Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.map((r, i) => (
                            <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--hover)]">
                              <td className="py-2.5 px-3 text-[var(--text-secondary)]">{i + 1}</td>
                              <td className="py-2.5 px-3 font-bold text-[var(--accent)]">{r.rm || r.name}</td>
                              <td className="py-2.5 px-3 text-right font-medium">{r.tradedClients ?? 0}</td>
                              <td className="py-2.5 px-3 text-right font-black text-[var(--text-primary)]">
                                {fmtFull(r.netBrokerage || r.netRevenue)}
                              </td>
                            </tr>
                          ))}
                          {!reportData.length && (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-xs text-[var(--text-secondary)]">
                                {reportLoading ? 'Loading report...' : 'No activity found in this period.'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                        {reportData.length > 0 && (
                          <tfoot>
                            <tr className="border-t-2 border-[var(--border)] font-bold text-[var(--text-primary)] bg-[var(--bg-secondary)]">
                              <td className="py-2.5 px-3" colSpan={2}>TOTAL</td>
                              <td className="py-2.5 px-3 text-right">{reportTotals.tradedClients}</td>
                              <td className="py-2.5 px-3 text-right">{fmtFull(reportTotals.netBrokerage)}</td>
                            </tr>
                          </tfoot>
                        )}
                      </>
                    )}

                    {reportView === 'clients' && (
                      <>
                        <thead>
                          <tr className="border-b border-[var(--border)] text-[var(--text-secondary)]">
                            <th className="py-2.5 px-3">#</th>
                            <th className="py-2.5 px-3">Client Code</th>
                            <th className="py-2.5 px-3">Client Name</th>
                            <th className="py-2.5 px-3">Dealer</th>
                            <th className="py-2.5 px-3">RM</th>
                            <th className="py-2.5 px-3 text-right">Net Brokerage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.map((r, i) => (
                            <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--hover)]">
                              <td className="py-2.5 px-3 text-[var(--text-secondary)]">{i + 1}</td>
                              <td className="py-2.5 px-3 font-mono font-bold text-[var(--accent)]">{r.code}</td>
                              <td className="py-2.5 px-3">{r.name || '—'}</td>
                              <td className="py-2.5 px-3 text-[var(--text-secondary)]">{r.dealer || '—'}</td>
                              <td className="py-2.5 px-3 text-[var(--text-secondary)]">{r.rm || '—'}</td>
                              <td className="py-2.5 px-3 text-right font-black text-[var(--text-primary)]">
                                {fmtFull(r.value || r.totalBrok || r.netBrok)}
                              </td>
                            </tr>
                          ))}
                          {!reportData.length && (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-xs text-[var(--text-secondary)]">
                                {reportLoading ? 'Loading report...' : 'No activity found in this period.'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                        {reportData.length > 0 && (
                          <tfoot>
                            <tr className="border-t-2 border-[var(--border)] font-bold text-[var(--text-primary)] bg-[var(--bg-secondary)]">
                              <td className="py-2.5 px-3" colSpan={5}>TOTAL</td>
                              <td className="py-2.5 px-3 text-right">{fmtFull(reportTotals.netBrokerage)}</td>
                            </tr>
                          </tfoot>
                        )}
                      </>
                    )}
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 9: TARGETS & INCENTIVES CONFIG
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'targets' && isAdmin && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Global Settings */}
              <div className="mis-card p-5 space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Global Target Settings
                </h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="mis-label text-xs">Company Monthly Target (₹)</label>
                    <input
                      type="number"
                      value={targets.monthly || 0}
                      onChange={(e) => setTargets({ ...targets, monthly: Number(e.target.value) })}
                      className="mis-input text-xs"
                    />
                  </div>
                  <div>
                    <label className="mis-label text-xs">Kotak Brokerage Share %</label>
                    <input
                      type="number"
                      value={targets.kotakSharePct ?? 85}
                      onChange={(e) => setTargets({ ...targets, kotakSharePct: Number(e.target.value) })}
                      className="mis-input text-xs"
                    />
                  </div>
                  <div>
                    <label className="mis-label text-xs">RM Split Share %</label>
                    <input
                      type="number"
                      value={targets.rmSplitPct ?? 50}
                      onChange={(e) => setTargets({ ...targets, rmSplitPct: Number(e.target.value) })}
                      className="mis-input text-xs"
                    />
                  </div>
                  <div>
                    <label className="mis-label text-xs">Incentive Multiplier (e.g. 3x or 10x)</label>
                    <input
                      type="number"
                      value={targets.incentiveMultiplier ?? 10}
                      onChange={(e) => setTargets({ ...targets, incentiveMultiplier: Number(e.target.value) })}
                      className="mis-input text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await dealerCalculationService.updateTargets(targets);
                      toast.success('Configuration saved');
                    }}
                    className="mis-btn mis-btn-primary w-full text-xs py-2 mt-2"
                  >
                    Save Global Settings
                  </button>
                </div>
              </div>

              {/* Per-Dealer Salary & Target Editor */}
              <div className="mis-card p-5 lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    Per-Dealer Monthly Salary &amp; Targets
                  </h3>
                  <button
                    type="button"
                    onClick={async () => {
                      await dealerCalculationService.updateTargets(targets);
                      toast.success('Dealer targets & salaries saved');
                    }}
                    className="mis-btn mis-btn-primary text-xs px-3 py-1.5"
                  >
                    Save All
                  </button>
                </div>

                <div className="overflow-x-auto max-h-96">
                  <table className="mis-table w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="py-2.5 px-3">Dealer</th>
                        <th className="py-2.5 px-3">Monthly Salary (₹)</th>
                        <th className="py-2.5 px-3">Monthly Target (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allDealerNames.map((d) => (
                        <tr key={d} className="border-b border-[var(--border)] hover:bg-[var(--hover)]">
                          <td className="py-2.5 px-3 font-bold text-[var(--text-primary)] flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dealerColor(d) }} />
                            <span>{d}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              value={targets.dealerSalary?.[d] ?? ''}
                              placeholder="0"
                              onChange={(e) =>
                                setTargets({
                                  ...targets,
                                  dealerSalary: { ...(targets.dealerSalary || {}), [d]: Number(e.target.value) },
                                })
                              }
                              className="mis-input py-1 text-xs w-36"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              value={targets.dealerMonthly?.[d] ?? ''}
                              placeholder="0"
                              onChange={(e) =>
                                setTargets({
                                  ...targets,
                                  dealerMonthly: { ...(targets.dealerMonthly || {}), [d]: Number(e.target.value) },
                                })
                              }
                              className="mis-input py-1 text-xs w-36"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 10: MONTHLY TASKS
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'tasks' && (
          <div className="mis-card p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">Monthly Dealer Task Checklists</h3>
                <p className="text-xs text-[var(--text-secondary)] m-0">5 monthly operational checkpoints per dealer.</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={selectedTaskDealer}
                  onChange={(e) => setSelectedTaskDealer(e.target.value)}
                  className="mis-select text-xs w-44"
                >
                  {allDealerNames.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <input
                  type="month"
                  value={taskMonth}
                  onChange={(e) => setTaskMonth(e.target.value)}
                  className="mis-input py-1 text-xs w-36"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {[1, 2, 3, 4, 5].map((slot) => {
                const task = tasksList.find((t) => t.slot === slot) || { text: '', done: false };
                return (
                  <div key={slot} className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-main)] flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={async (e) => {
                        const done = e.target.checked;
                        await dealerCalculationService.upsertTask(selectedTaskDealer, taskMonth, slot, task.text, done);
                        setTasksList((prev) => {
                          const existing = prev.filter((x) => x.slot !== slot);
                          return [...existing, { ...task, slot, done }];
                        });
                      }}
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      placeholder={`Task #${slot} description...`}
                      value={task.text}
                      onChange={(e) => {
                        const text = e.target.value;
                        setTasksList((prev) => {
                          const existing = prev.filter((x) => x.slot !== slot);
                          return [...existing, { ...task, slot, text }];
                        });
                      }}
                      onBlur={async () => {
                        await dealerCalculationService.upsertTask(selectedTaskDealer, taskMonth, slot, task.text, task.done);
                        toast.success('Task saved');
                      }}
                      className="mis-input text-xs flex-1"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 11: TRADING CALENDAR & HOLIDAYS
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'holidays' && isAdmin && (
          <div className="mis-card p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">NSE / BSE Trading Calendar ({holidays.length})</h3>
                <p className="text-xs text-[var(--text-secondary)] m-0">
                  Trading holidays deducted when calculating daily targets.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {holidays.map((h) => (
                <div key={h.date} className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-main)] flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-[var(--text-primary)] font-mono">{h.date}</div>
                    <div className="text-[11px] text-[var(--text-secondary)]">{h.name || 'NSE/BSE Trading Holiday'}</div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const updated = holidays.filter((x) => x.date !== h.date);
                      await dealerCalculationService.replaceHolidays(updated);
                      setHolidays(updated);
                      toast.success(`Removed holiday ${h.date}`);
                    }}
                    className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 12: TERMINAL USERS & ACCESS
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'users' && isAdmin && (
          <div className="space-y-4">
            <div className="mis-card p-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">Dealer Terminal Users ({dealerUsers.length})</h3>
                <p className="text-xs text-[var(--text-secondary)] m-0">
                  Accounts configured for dealer terminal logins.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUserModal(true)}
                className="mis-btn mis-btn-primary text-xs px-3.5 py-1.5 flex items-center gap-1"
              >
                <Plus size={14} /> Create User
              </button>
            </div>

            <div className="mis-card overflow-hidden">
              <table className="mis-table w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="py-2.5 px-3">Username</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Created Date</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dealerUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-[var(--hover)] border-b border-[var(--border)]">
                      <td className="py-2.5 px-3 font-bold text-blue-500">{u.username}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          u.role === 'ADMIN' ? 'bg-purple-500/20 text-purple-600' : 'bg-blue-500/20 text-blue-600'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {u.username !== 'admin' && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (window.confirm(`Delete user ${u.username}?`)) {
                                await dealerCalculationService.deleteUser(u.id);
                                setDealerUsers(dealerUsers.filter((x) => x.id !== u.id));
                                toast.success(`Deleted user ${u.username}`);
                              }
                            }}
                            className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* ══════════════════════════════════════════════════════════════
          CLIENT TRANSACTIONS HISTORY MODAL (DRILLDOWN)
      ══════════════════════════════════════════════════════════════ */}
      {selectedClient && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="mis-card max-w-2xl w-full p-6 space-y-4 animate-in fade-in max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <div className="text-base font-black text-[var(--text-primary)] flex items-center gap-2">
                  <span className="font-mono text-blue-500">{selectedClient.code}</span>
                  <span>{selectedClient.name || 'Client Details'}</span>
                </div>
                <div className="text-xs text-[var(--text-secondary)] flex items-center gap-3 mt-1">
                  <span>Dealer: <strong>{selectedClient.dealer || 'Unmapped'}</strong></span>
                  <span>RM: <strong>{selectedClient.rm || '—'}</strong></span>
                  <span>Branch: <strong>{selectedClient.branch || '—'}</strong></span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClient(null)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Daily Trade History ({selectedClientRecords.length} records)
              </h4>
              <table className="mis-table w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Source</th>
                    <th className="py-2 px-3 text-right">Net Brokerage</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedClientRecords.map((r, i) => (
                    <tr key={i} className="border-b border-[var(--border)]">
                      <td className="py-2 px-3 font-mono">{r.date}</td>
                      <td className="py-2 px-3">
                        <span className="bg-blue-500/10 text-blue-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          {r.source || 'SW'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-black text-[var(--text-primary)]">{fmtFull(r.netBrok)}</td>
                    </tr>
                  ))}
                  {!selectedClientRecords.length && (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-xs text-[var(--text-secondary)]">
                        {loadingClientRecords ? 'Loading trade history...' : 'No trade history found for this client.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          QUICK MAP MODAL (MISSING FINDER)
      ══════════════════════════════════════════════════════════════ */}
      {missingMapModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="mis-card max-w-md w-full p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">
                Map Client: <span className="font-mono text-amber-500">{missingMapModal.code}</span>
              </h3>
              <button type="button" onClick={() => setMissingMapModal(null)} className="text-[var(--text-secondary)]">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="mis-label text-xs">Assign Dealer</label>
                <select
                  value={mapDealer}
                  onChange={(e) => setMapDealer(e.target.value)}
                  className="mis-select text-xs"
                >
                  <option value="">Select Dealer</option>
                  {allDealerNames.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label className="mis-label text-xs">Assign RM</label>
                <select
                  value={mapRm}
                  onChange={(e) => setMapRm(e.target.value)}
                  className="mis-select text-xs"
                >
                  <option value="">Select RM</option>
                  {allRmNames.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label className="mis-label text-xs">Branch</label>
                <input
                  type="text"
                  placeholder="Branch name"
                  value={mapBranch}
                  onChange={(e) => setMapBranch(e.target.value)}
                  className="mis-input text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMissingMapModal(null)}
                  className="mis-btn mis-btn-secondary text-xs px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleQuickMapSave}
                  className="mis-btn mis-btn-primary text-xs px-4 py-1.5"
                >
                  Save Mapping
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ADD / EDIT CLIENT MODAL
      ══════════════════════════════════════════════════════════════ */}
      {showAddClientModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="mis-card max-w-md w-full p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">
                {editingClient ? 'Edit Master Client' : 'Add New Client'}
              </h3>
              <button type="button" onClick={() => setShowAddClientModal(false)} className="text-[var(--text-secondary)]">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="space-y-3 text-xs">
              <div>
                <label className="mis-label text-xs">Client Code</label>
                <input
                  type="text"
                  required
                  disabled={!!editingClient}
                  value={newClient.code}
                  onChange={(e) => setNewClient({ ...newClient, code: e.target.value })}
                  className="mis-input text-xs"
                />
              </div>

              <div>
                <label className="mis-label text-xs">Client Name</label>
                <input
                  type="text"
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  className="mis-input text-xs"
                />
              </div>

              <div>
                <label className="mis-label text-xs">Dealer</label>
                <select
                  value={newClient.dealer}
                  onChange={(e) => setNewClient({ ...newClient, dealer: e.target.value })}
                  className="mis-select text-xs"
                >
                  <option value="">Unmapped</option>
                  {allDealerNames.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label className="mis-label text-xs">Relationship Manager (RM)</label>
                <select
                  value={newClient.rm}
                  onChange={(e) => setNewClient({ ...newClient, rm: e.target.value })}
                  className="mis-select text-xs"
                >
                  <option value="">None</option>
                  {allRmNames.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label className="mis-label text-xs">Branch</label>
                <input
                  type="text"
                  value={newClient.branch}
                  onChange={(e) => setNewClient({ ...newClient, branch: e.target.value })}
                  className="mis-input text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddClientModal(false)}
                  className="mis-btn mis-btn-secondary text-xs px-3 py-1.5"
                >
                  Cancel
                </button>
                <button type="submit" className="mis-btn mis-btn-primary text-xs px-4 py-1.5">
                  Save Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          CREATE USER MODAL
      ══════════════════════════════════════════════════════════════ */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="mis-card max-w-sm w-full p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Create Terminal User</h3>
              <button type="button" onClick={() => setShowAddUserModal(false)} className="text-[var(--text-secondary)]">
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const created = await dealerCalculationService.createUser(newUser.username, newUser.password, newUser.role);
                  setDealerUsers([...dealerUsers, created]);
                  setShowAddUserModal(false);
                  setNewUser({ username: '', password: '', role: 'VIEWER' });
                  toast.success(`Created user ${created.username}`);
                } catch (err: any) {
                  toast.error(apiErrorMessage(err));
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="mis-label text-xs">Username</label>
                <input
                  type="text"
                  required
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="mis-input text-xs"
                />
              </div>

              <div>
                <label className="mis-label text-xs">Password</label>
                <input
                  type="password"
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="mis-input text-xs"
                />
              </div>

              <div>
                <label className="mis-label text-xs">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="mis-select text-xs"
                >
                  <option value="VIEWER">VIEWER (Dealer/RM Scope)</option>
                  <option value="ADMIN">ADMIN (Full Access)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="mis-btn mis-btn-secondary text-xs px-3 py-1.5"
                >
                  Cancel
                </button>
                <button type="submit" className="mis-btn mis-btn-primary text-xs px-4 py-1.5">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TRADED CLIENTS MODAL (MIS TAB)
      ══════════════════════════════════════════════════════════════ */}
      {misTradedModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="mis-card max-w-lg w-full p-6 space-y-4 animate-in fade-in max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">
                Traded Clients: <span className="text-blue-500">{misTradedModal.dealer}</span> ({misTradedModal.clients.length})
              </h3>
              <button type="button" onClick={() => setMisTradedModal(null)} className="text-[var(--text-secondary)]">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="mis-table w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="py-2 px-3">Code</th>
                    <th className="py-2 px-3">Name</th>
                    <th className="py-2 px-3 text-right">Net Brokerage</th>
                  </tr>
                </thead>
                <tbody>
                  {misTradedModal.clients.map((c, i) => (
                    <tr key={i} className="border-b border-[var(--border)]">
                      <td className="py-2 px-3 font-mono font-bold text-blue-500">{c.code}</td>
                      <td className="py-2 px-3 text-[var(--text-primary)]">{c.name || '—'}</td>
                      <td className="py-2 px-3 text-right font-bold">{fmtFull(c.netBrokerage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          DORMANT CLIENTS MODAL (MIS TAB)
      ══════════════════════════════════════════════════════════════ */}
      {misDormantModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="mis-card max-w-lg w-full p-6 space-y-4 animate-in fade-in max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">
                Dormant Clients (Follow-up): <span className="text-amber-500">{misDormantModal.dealer}</span> ({misDormantModal.clients.length})
              </h3>
              <button type="button" onClick={() => setMisDormantModal(null)} className="text-[var(--text-secondary)]">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="mis-table w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="py-2 px-3">Code</th>
                    <th className="py-2 px-3">Name</th>
                    <th className="py-2 px-3 text-right">Last Month Brokerage</th>
                  </tr>
                </thead>
                <tbody>
                  {misDormantModal.clients.map((c, i) => (
                    <tr key={i} className="border-b border-[var(--border)]">
                      <td className="py-2 px-3 font-mono font-bold text-amber-500">{c.code}</td>
                      <td className="py-2 px-3 text-[var(--text-primary)]">{c.name || '—'}</td>
                      <td className="py-2 px-3 text-right font-bold">{fmtFull(c.lastMonthNetBrokerage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          DANGER ZONE CONFIRMATION MODAL
      ══════════════════════════════════════════════════════════════ */}
      {wipeConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="mis-card max-w-md w-full p-6 space-y-4 border border-red-500/50">
            <div className="flex items-center gap-2 text-red-600 font-bold">
              <AlertTriangle size={18} />
              <span>Confirm Dangerous Action</span>
            </div>
            <div className="text-xs text-[var(--text-secondary)] space-y-2">
              <p>
                Are you sure you want to permanently delete all <strong>{wipeConfirm.type}</strong>?
                This action cannot be undone.
              </p>
              <p>Type <strong>DELETE</strong> below to confirm:</p>
              <input
                type="text"
                value={wipeConfirm.typed}
                onChange={(e) => setWipeConfirm({ ...wipeConfirm, typed: e.target.value })}
                className="mis-input text-xs"
                placeholder="Type DELETE"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setWipeConfirm(null)}
                className="mis-btn mis-btn-secondary text-xs px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={wipeConfirm.typed !== 'DELETE'}
                onClick={handleExecuteWipe}
                className="mis-btn bg-red-600 hover:bg-red-700 text-white text-xs px-4 py-1.5 disabled:opacity-40"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
};

export default DealerCalculationPage;
