import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../components/layout/DashboardLayout';
import ViewDetailsModal from '../../components/common/ViewDetailsModal';
import CsvImportGuide from '../../components/common/CsvImportGuide';
import { validateCsvHeaders, containsSampleSentinel, type CsvHeaderValidation } from '../../utils/csvBulkImportHelpers';
import { financeService } from '../../services/finance.service';
import { orgService } from '../../services/org.service';
import { authService } from '../../services/auth.service';

// Sheets whose "status" column uses a different field name (batch actions target this field)
const STATUS_FIELD_MAP: { [key: string]: string } = {
  'referral-commission': 'payment_status',
  'cash-bank-position': 'bank_reconciliation_status'
};

interface SheetHelpConfig {
  why: string;
  fields: { label: string; note: string }[];
  remember: string;
}

// Plain-English explanations shown next to each data entry form, written for
// operations staff (not developers) — what this sheet is for and why each
// field matters. Keeps the same wording style across every department.
const SHEET_HELP: Record<string, SheetHelpConfig> = {
  'pnl-summary': {
    why: 'This is the day-by-day record of how the firm is actually performing financially. Each day\'s entry rolls up automatically into the monthly Profit & Loss, revenue trend, and margin figures — it\'s the core financial performance tracker for the whole firm.',
    fields: [
      { label: 'Date', note: 'The day this entry covers — enter one row per day, don\'t wait until month-end to add everything up by hand.' },
      { label: 'Cash / F&O / Commodity Brokerage Revenue', note: 'Revenue earned that day from each trading segment, kept separate since each is tracked and reported differently.' },
      { label: 'DP & Other Income', note: 'Any non-brokerage income for the day, e.g. DP charges, AMC fees.' },
      { label: 'Operating Expense', note: 'The day\'s operating costs.' },
      { label: 'Cash Flow through Bank', note: 'Net cash that actually moved through the bank that day.' },
      { label: 'Remarks', note: 'Any notes on an unusual entry, e.g. a one-off adjustment.' },
    ],
    remember: 'Enter one row per day — the dashboard automatically totals every day into the monthly P&L, revenue trend, and margin numbers. Don\'t wait until month-end to add it all up by hand.',
  },
  'compliance-renewals': {
    why: 'The firm has ongoing statutory and contractual obligations — taxes, insurance, licenses, deposits — that must be renewed or filed on time. This sheet tracks every one of them so a missed deadline never happens by accident; missing a TDS or GST filing carries real financial penalties.',
    fields: [
      { label: 'Renewal / Filing Type', note: 'What this is — a tax filing, insurance renewal, license fee, deposit renewal, etc.' },
      { label: 'Item Name / Description', note: 'What exactly is being renewed or filed.' },
      { label: 'Reference No.', note: 'The policy/challan/FD number for this item — needed to trace it later if there\'s a dispute.' },
      { label: 'Amount', note: 'The amount due or paid.' },
      { label: 'Due Date', note: 'The actual statutory or contractual deadline — this is what drives the compliance dashboard\'s alerts.' },
      { label: 'Last Paid / Renewed Date', note: 'When this was last actioned.' },
      { label: 'Frequency', note: 'How often this recurs — one-time, monthly, quarterly, etc.' },
      { label: 'Alert Lead Time (Days)', note: 'How many days before the Due Date the dashboard should start warning.' },
      { label: 'Status', note: 'Pending / Paid / Renewed / Filed = on track. Overdue = the deadline has passed unactioned — needs immediate attention.' },
      { label: 'Remarks', note: 'Any notes on this item.' },
    ],
    remember: 'Set the Due Date and Alert Lead Time accurately — this is exactly what drives the compliance dashboard\'s early-warning alerts. A missed statutory filing means a real penalty, not just a delay.',
  },
  'exchange-reporting': {
    why: 'SEBI and the exchanges require the firm to submit periodic reports — segregation reports, holdings statements, settlement reports — on a fixed schedule. This sheet tracks that every submission actually went out on time.',
    fields: [
      { label: 'Submission Type', note: 'Which regulatory report this is.' },
      { label: 'Exchange', note: 'Which exchange this report goes to (NSE, BSE, MCX, or All).' },
      { label: 'Period Date', note: 'Which day or period this report actually covers.' },
      { label: 'Due Date', note: 'The exchange\'s deadline for this submission.' },
      { label: 'Submitted Date', note: 'When it was actually sent.' },
      { label: 'Status', note: 'Pending / Submitted On-Time = fine. Submitted Late / Not Submitted = a compliance gap that needs explaining.' },
      { label: 'Remarks', note: 'Any notes, e.g. reason for a late submission.' },
    ],
    remember: 'These are regulatory submissions with hard deadlines — mark the Submitted Date the same day it\'s actually sent, not in advance.',
  },
  'fund-movement': {
    why: 'Every day, client money moves in and out of the firm\'s bank account through payins and payouts. This sheet tracks the daily totals so fund movement can be reconciled against the bank statement and any mismatch is caught early.',
    fields: [
      { label: 'Date', note: 'The day this entry covers.' },
      { label: 'Total Payin Amount / Count', note: 'How much client money came in that day, and how many separate transactions made up that total.' },
      { label: 'Total Payout Amount / Count', note: 'How much went out that day, and how many transactions.' },
      { label: 'Remarks', note: 'Any notes on unusual fund movement that day.' },
    ],
    remember: 'Payin/Payout totals should match the bank statement for that day — a mismatch here usually means a reconciliation issue that needs investigating, not just a typo.',
  },
  'client-requests': {
    why: 'Clients raise general requests and brokerage revision requests that need to be tracked to resolution — this sheet is the ticket log so nothing gets handled informally and forgotten.',
    fields: [
      { label: 'Request Date', note: 'When the client actually made the request.' },
      { label: 'Request Type', note: 'A General Client Request, or a Brokerage Revision Request (asking for a different brokerage rate).' },
      { label: 'Client Name / ID', note: 'Who made the request.' },
      { label: 'Description', note: 'What they\'re actually asking for, in enough detail that whoever handles it doesn\'t need to ask again.' },
      { label: 'Status', note: 'Pending = received. In Process = being worked. Approved / Rejected = decision made. Completed = fully actioned.' },
      { label: 'Resolved Date', note: 'When the request was actually closed out.' },
      { label: 'Remarks', note: 'Any notes on how it was handled.' },
    ],
    remember: 'Always fill in Resolved Date when closing a request — this is what the dashboard uses to measure how quickly client requests are actually being handled.',
  },
  'referral-commission': {
    why: 'Referrers who introduce clients earn a commission based on that client\'s trading. This sheet tracks what\'s owed each month and whether it was actually paid, so payouts are accurate and on time.',
    fields: [
      { label: 'Referrer Name', note: 'Who introduced the client and is owed commission.' },
      { label: 'Period (Month)', note: 'Which billing month this commission covers.' },
      { label: 'Commission Amount', note: 'How much is owed for this period.' },
      { label: 'Statement Generated?', note: 'Tick only once the commission statement has actually been generated for the referrer.' },
      { label: 'Statement Date / Payment Date', note: 'When the statement was issued, and when payment was actually made.' },
      { label: 'Payment Status', note: 'Pending = not yet paid. Paid = payment sent. On Hold = payment deliberately withheld (e.g. a dispute).' },
      { label: 'Remarks', note: 'Any notes on this commission period.' },
    ],
    remember: 'Don\'t mark Payment Status as Paid until the payment has actually gone out — this is the figure the referrer will expect to match their bank credit.',
  },
  'cash-bank-position': {
    why: 'The firm\'s cash and bank balances must be tracked and reconciled daily — this is a core financial control, and for NRI client transactions it also feeds the mandatory PIS (Portfolio Investment Scheme) reporting.',
    fields: [
      { label: 'Date', note: 'The day this position is for.' },
      { label: 'Cash in Hand', note: 'Physical cash held that day.' },
      { label: 'Cash at Bank', note: 'The bank balance that day.' },
      { label: 'Bank Name', note: 'Which bank account this position refers to.' },
      { label: 'Bank Reconciliation Status', note: 'Reconciled = the bank statement matches our books. Pending = not yet checked. Discrepancy Found = numbers don\'t match — must be investigated before it can be marked Reconciled.' },
      { label: 'PIS Reporting Done?', note: 'Tick only once that day\'s Portfolio Investment Scheme reporting (for NRI client transactions) has actually been filed, where applicable.' },
      { label: 'PIS Reporting Date', note: 'When that filing was made.' },
      { label: 'Remarks', note: 'Any notes on this day\'s position.' },
    ],
    remember: 'Never mark Bank Reconciliation Status as Reconciled until the numbers actually match the bank statement — this is a core financial control, not a formality to tick off.',
  },
  'recurring-payables': {
    why: 'The firm has recurring bills and EMIs — rent, utilities, loan payments — that repeat on a schedule. This sheet tracks each one so nothing is missed, duplicated, or paid late.',
    fields: [
      { label: 'Payable Type', note: 'What kind of bill this is — EMI, mobile, internet, rent, or another utility.' },
      { label: 'Description', note: 'A specific description of this payable.' },
      { label: 'Amount', note: 'How much is due.' },
      { label: 'Due Date', note: 'When it must be paid.' },
      { label: 'Paid Date', note: 'When it was actually paid.' },
      { label: 'Status', note: 'Pending = not yet paid. Paid = settled. Overdue = past due date, unpaid.' },
      { label: 'Remarks', note: 'Any notes on this payable.' },
    ],
    remember: 'Keep Status current — a bill sitting as Pending past its Due Date should be caught here before it turns into a late fee or a service disruption.',
  },
};

const FinanceDataEntryPage: React.FC = () => {
  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const hasMultiBranchAccess = isAdmin || ['ceo', 'managing_director', 'director', 'executive', 'hod'].includes(currentUser?.role || '');

  // Active sheet tab
  const [sheetTab, setSheetTab] = useState('pnl-summary');
  const [activeTab, setActiveTab] = useState<'list' | 'register'>('list');

  // UI state
  const [entries, setEntries] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Search & Branch filters
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('');

  // Row selection & Batch action
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchStatus, setBatchStatus] = useState('');

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});

  // CSV Import state
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [csvMappings, setCsvMappings] = useState<{ [key: string]: string }>({});
  const [csvValidation, setCsvValidation] = useState<CsvHeaderValidation | null>(null);
  const [csvHasSample, setCsvHasSample] = useState(false);

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [sheetTab, branchFilter, searchTerm]);

  // Clean form state when tab changes
  useEffect(() => {
    setActiveTab('list');
    setEditingId(null);
    setFormData({});
    setSelectedIds([]);
    setBatchStatus('');
  }, [sheetTab]);

  const fetchBranches = async () => {
    if (!hasMultiBranchAccess) return;
    try {
      const data = await orgService.getBranches();
      setBranches(data || []);
    } catch (err) {
      console.error('Failed to load branches', err);
    }
  };

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const filters = {
        branchId: branchFilter || undefined,
        search: searchTerm || undefined
      };
      const data = await financeService.getEntries(sheetTab, filters);
      setEntries(data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to fetch entries.');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    // 1. Required Fields Check
    for (const f of getFormFields()) {
      if (f.required) {
        const val = formData[f.name];
        if (
          val === undefined ||
          val === null ||
          (typeof val === 'string' && val.trim() === '') ||
          (f.type === 'number' && isNaN(Number(val)))
        ) {
          toast.error(`${f.label} is required.`);
          return false;
        }
      }
    }

    // 2. Positive number limits (matches the NUMERIC(15,2) column capacity server-side)
    const MAX_NUMERIC_VALUE = 9999999999999.99;
    const numFields = [
      'cash_brokerage_revenue', 'fno_brokerage_revenue', 'commodity_brokerage_revenue', 'dp_other_income',
      'operating_expense', 'cash_flow_bank', 'amount', 'notification_lead_time_days', 'payin_amount',
      'payin_count', 'payout_amount', 'payout_count', 'commission_amount', 'cash_in_hand', 'cash_at_bank'
    ];
    for (const f of numFields) {
      if (formData[f] !== undefined && formData[f] !== null && formData[f] !== '') {
        const numVal = Number(formData[f]);
        if (isNaN(numVal) || !isFinite(numVal) || numVal < 0) {
          toast.error(`${f.replace(/_/g, ' ').toUpperCase()} must be a positive number.`);
          return false;
        }
        if (numVal > MAX_NUMERIC_VALUE) {
          toast.error(`${f.replace(/_/g, ' ').toUpperCase()} exceeds the maximum allowed value.`);
          return false;
        }
      }
    }

    // 3. Text length limits (matches backend's 255 / 4000 char caps)
    for (const f of getFormFields()) {
      const val = formData[f.name];
      if (typeof val === 'string') {
        const maxLen = f.type === 'textarea' ? 4000 : 255;
        if (val.length > maxLen) {
          toast.error(`${f.label} exceeds the maximum length of ${maxLen} characters.`);
          return false;
        }
      }
    }

    // 4. Calendar date assertions
    const dateFields = [
      'period_month', 'due_date', 'last_paid_date', 'period_date', 'submitted_date',
      'entry_date', 'request_date', 'resolved_date', 'statement_date', 'payment_date',
      'position_date', 'pis_reporting_date', 'paid_date'
    ];
    for (const f of dateFields) {
      if (formData[f] && isNaN(Date.parse(formData[f]))) {
        toast.error(`Please provide a valid date for ${f.replace(/_/g, ' ').toUpperCase()}.`);
        return false;
      }
    }

    // 5. Chronological Date Assertions
    if (formData.request_date && formData.resolved_date && new Date(formData.resolved_date) < new Date(formData.request_date)) {
      toast.error('Resolved date cannot be before request date.');
      return false;
    }
    if (formData.period_date && formData.submitted_date && new Date(formData.submitted_date) < new Date(formData.period_date)) {
      toast.error('Submitted date cannot be before the period date.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      if (editingId) {
        await financeService.updateEntry(sheetTab, editingId, formData);
        toast.success('Record updated successfully.');
      } else {
        await financeService.createEntry(sheetTab, formData);
        toast.success('Record created successfully.');
      }
      fetchEntries();
      setActiveTab('list');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Submit operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    setFormData({ ...record });
    setActiveTab('register');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      await financeService.deleteEntry(sheetTab, id);
      toast.success('Record deleted.');
      fetchEntries();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Delete operation failed.');
    }
  };

  const getStatusFieldName = () => STATUS_FIELD_MAP[sheetTab] || 'status';
  const getStatusFieldOptions = (): any[] => {
    const field = getFormFields().find(f => f.name === getStatusFieldName());
    return field?.options || [];
  };

  const handleBatchAction = async () => {
    if (!batchStatus || selectedIds.length === 0) return;
    try {
      await financeService.bulkUpdate(sheetTab, selectedIds, { [getStatusFieldName()]: batchStatus });
      toast.success(`Batch updated ${selectedIds.length} records.`);
      setSelectedIds([]);
      setBatchStatus('');
      fetchEntries();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Batch update failed.');
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  /**
   * Minimal RFC4180-style CSV parser: handles quoted fields containing
   * commas, escaped "" quotes, and embedded newlines. A plain comma/line
   * split silently shifts values into the wrong columns whenever a text
   * field (e.g. remarks, description) contains a comma — which is common
   * in real Finance free-text data, not an edge case.
   */
  const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (inQuotes) {
        if (char === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        field = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else {
        field += char;
      }
    }

    if (field !== '' || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    return rows;
  };

  // CSV Import mapping logic
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please select a .csv file.');
      e.target.value = '';
      return;
    }
    const MAX_CSV_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_CSV_SIZE) {
      toast.error('CSV file is too large (5MB max).');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const rows = parseCsv(text).filter(r => r.some(cell => cell.trim() !== ''));
      if (rows.length === 0) return;

      const headers = rows[0].map(h => h.trim());
      setCsvHeaders(headers);

      const parsedRows = rows.slice(1).map(values => {
        const rowObj: any = {};
        headers.forEach((h, index) => {
          rowObj[h] = (values[index] || '').trim();
        });
        return rowObj;
      });

      // Reject the whole file if the header row doesn't exactly match the
      // required columns, or if it's the untouched example template.
      const validation = validateCsvHeaders(headers, getFormFields().map(f => ({ key: f.name, label: f.label })));
      const hasSample = containsSampleSentinel(parsedRows.map(r => Object.values(r)));
      setCsvValidation(validation.valid ? null : validation);
      setCsvHasSample(hasSample);

      if (!validation.valid || hasSample) {
        setCsvRows([]);
        setCsvMappings({});
        return;
      }

      setCsvRows(parsedRows);

      // Guess initial mappings
      const initialMap: any = {};
      getFormFields().forEach(field => {
        const matched = headers.find(h => h.toLowerCase() === field.name.toLowerCase() || h.toLowerCase() === field.name.replace(/_/g, '').toLowerCase());
        if (matched) initialMap[field.name] = matched;
      });
      setCsvMappings(initialMap);
    };
    reader.readAsText(file);
  };

  const handleImportCsv = async () => {
    if (csvRows.length === 0) return;
    if (csvValidation || csvHasSample) {
      toast.error(csvHasSample ? "Can't import — this is the example file." : 'Fix the CSV column errors before importing.');
      return;
    }

    const mappedRecords = csvRows.map(row => {
      const record: any = {};
      Object.entries(csvMappings).forEach(([dbCol, csvHeader]) => {
        if (csvHeader) {
          record[dbCol] = row[csvHeader];
        }
      });
      return record;
    });

    try {
      await financeService.bulkImport(sheetTab, mappedRecords);
      toast.success('Successfully imported CSV rows.');
      setCsvModalOpen(false);
      setCsvRows([]);
      fetchEntries();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'CSV Import failed.');
    }
  };

  // Live Net Profit / EBITDA Margin / Cost-to-Income preview for the P&L Summary sheet
  const getPnlPreview = () => {
    if (sheetTab !== 'pnl-summary') return null;
    const cash = Number(formData.cash_brokerage_revenue || 0);
    const fno = Number(formData.fno_brokerage_revenue || 0);
    const commodity = Number(formData.commodity_brokerage_revenue || 0);
    const dpOther = Number(formData.dp_other_income || 0);
    const opex = Number(formData.operating_expense || 0);

    const totalRevenue = cash + fno + commodity + dpOther;
    if (totalRevenue <= 0) return null;

    const netProfit = totalRevenue - opex;
    const ebitdaMargin = (netProfit / totalRevenue) * 100;
    const costToIncome = (opex / totalRevenue) * 100;

    return {
      totalRevenue: totalRevenue.toFixed(2),
      netProfit: netProfit.toFixed(2),
      ebitdaMargin: ebitdaMargin.toFixed(1),
      costToIncome: costToIncome.toFixed(1)
    };
  };

  const pnlPreview = getPnlPreview();

  const getFormFields = () => {
    switch (sheetTab) {
      case 'pnl-summary':
        return [
          { name: 'entry_date', label: 'Date', type: 'date', required: true },
          { name: 'cash_brokerage_revenue', label: 'Cash Brokerage Revenue (INR)', type: 'number', required: true },
          { name: 'fno_brokerage_revenue', label: 'F&O Brokerage Revenue (INR)', type: 'number', required: true },
          { name: 'commodity_brokerage_revenue', label: 'Commodity Brokerage Revenue (INR)', type: 'number', required: true },
          { name: 'dp_other_income', label: 'DP & Other Income (INR)', type: 'number', required: true },
          { name: 'operating_expense', label: 'Operating Expense (INR)', type: 'number', required: true },
          { name: 'cash_flow_bank', label: 'Cash Flow through Bank (INR)', type: 'number' },
          { name: 'remarks', label: 'Remarks', type: 'textarea' }
        ];
      case 'compliance-renewals':
        return [
          { name: 'renewal_type', label: 'Renewal / Filing Type', type: 'select', options: ['Land Tax', 'Insurance', 'TDS Payment', 'TDS Return Filing', 'GST Payment', 'GST Return Filing', 'Fixed Deposit Renewal', 'Exchange Security Deposit Renewal', 'AMC Renewal', 'License/Membership Fee', 'LPC Running', 'Other'], required: true },
          { name: 'item_name', label: 'Item Name / Description', type: 'text', required: true },
          { name: 'reference_no', label: 'Reference No. (Policy/Challan/FD No.)', type: 'text' },
          { name: 'amount', label: 'Amount (INR)', type: 'number' },
          { name: 'due_date', label: 'Due Date', type: 'date', required: true },
          { name: 'last_paid_date', label: 'Last Paid / Renewed Date', type: 'date' },
          { name: 'frequency', label: 'Frequency', type: 'select', options: ['One-time', 'Monthly', 'Quarterly', 'Half-Yearly', 'Annually'], required: true },
          { name: 'notification_lead_time_days', label: 'Alert Lead Time (Days)', type: 'number', required: true },
          { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Paid', 'Renewed', 'Overdue', 'Filed'], required: true },
          { name: 'remarks', label: 'Remarks', type: 'textarea' }
        ];
      case 'exchange-reporting':
        return [
          { name: 'submission_type', label: 'Submission Type', type: 'select', options: ['Daily Segregation Report', 'Holdings Statement', 'Monthly Settlement Report', 'Quarterly Settlement Report', 'Other'], required: true },
          { name: 'exchange', label: 'Exchange', type: 'select', options: ['NSE', 'BSE', 'MCX', 'All'], required: true },
          { name: 'period_date', label: 'Period Date', type: 'date', required: true },
          { name: 'due_date', label: 'Due Date', type: 'date', required: true },
          { name: 'submitted_date', label: 'Submitted Date', type: 'date' },
          { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Submitted On-Time', 'Submitted Late', 'Not Submitted'], required: true },
          { name: 'remarks', label: 'Remarks', type: 'textarea' }
        ];
      case 'fund-movement':
        return [
          { name: 'entry_date', label: 'Date', type: 'date', required: true },
          { name: 'payin_amount', label: 'Total Payin Amount (INR)', type: 'number', required: true },
          { name: 'payin_count', label: 'Total Payin Count', type: 'number', required: true },
          { name: 'payout_amount', label: 'Total Payout Amount (INR)', type: 'number', required: true },
          { name: 'payout_count', label: 'Total Payout Count', type: 'number', required: true },
          { name: 'remarks', label: 'Remarks', type: 'textarea' }
        ];
      case 'client-requests':
        return [
          { name: 'request_date', label: 'Request Date', type: 'date', required: true },
          { name: 'request_type', label: 'Request Type', type: 'select', options: ['General Client Request', 'Brokerage Revision Request'], required: true },
          { name: 'client_name', label: 'Client Name / ID', type: 'text', required: true },
          { name: 'description', label: 'Description', type: 'textarea' },
          { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'In Process', 'Approved', 'Rejected', 'Completed'], required: true },
          { name: 'resolved_date', label: 'Resolved Date', type: 'date' },
          { name: 'remarks', label: 'Remarks', type: 'textarea' }
        ];
      case 'referral-commission':
        return [
          { name: 'referrer_name', label: 'Referrer Name', type: 'text', required: true },
          { name: 'period_month', label: 'Period (Month)', type: 'date', required: true },
          { name: 'commission_amount', label: 'Commission Amount (INR)', type: 'number', required: true },
          { name: 'statement_generated', label: 'Statement Generated?', type: 'checkbox' },
          { name: 'statement_date', label: 'Statement Date', type: 'date' },
          { name: 'payment_date', label: 'Payment Date', type: 'date' },
          { name: 'payment_status', label: 'Payment Status', type: 'select', options: ['Pending', 'Paid', 'On Hold'], required: true },
          { name: 'remarks', label: 'Remarks', type: 'textarea' }
        ];
      case 'cash-bank-position':
        return [
          { name: 'position_date', label: 'Date', type: 'date', required: true },
          { name: 'cash_in_hand', label: 'Cash in Hand (INR)', type: 'number', required: true },
          { name: 'cash_at_bank', label: 'Cash at Bank (INR)', type: 'number', required: true },
          { name: 'bank_name', label: 'Bank Name', type: 'text' },
          { name: 'bank_reconciliation_status', label: 'Bank Reconciliation Status', type: 'select', options: ['Reconciled', 'Pending', 'Discrepancy Found'], required: true },
          { name: 'pis_reporting_done', label: 'PIS Reporting Done?', type: 'checkbox' },
          { name: 'pis_reporting_date', label: 'PIS Reporting Date', type: 'date' },
          { name: 'remarks', label: 'Remarks', type: 'textarea' }
        ];
      case 'recurring-payables':
        return [
          { name: 'payable_type', label: 'Payable Type', type: 'select', options: ['EMI', 'Mobile Bill', 'Internet Bill', 'Rent Payable', 'Rent Receivable', 'Other Utility'], required: true },
          { name: 'description', label: 'Description', type: 'text', required: true },
          { name: 'amount', label: 'Amount (INR)', type: 'number', required: true },
          { name: 'due_date', label: 'Due Date', type: 'date', required: true },
          { name: 'paid_date', label: 'Paid Date', type: 'date' },
          { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Paid', 'Overdue'], required: true },
          { name: 'remarks', label: 'Remarks', type: 'textarea' }
        ];
      default:
        return [];
    }
  };

  // Plain-English "why are we collecting this" panel shown beside the entry
  // form — same content for every employee, sheet by sheet.
  const renderHelpPanel = () => {
    const help = SHEET_HELP[sheetTab];
    if (!help) return null;

    return (
      <div
        className="border rounded-xl p-5 shadow-xs space-y-4 lg:sticky lg:top-4"
        style={{ background: 'var(--panel-inset-soft)', borderColor: 'var(--border)' }}
      >
        <div>
          <h3 className="text-sm font-bold flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--text-primary)' }}>
            💡 Why this sheet exists
          </h3>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {help.why}
          </p>
        </div>

        <hr style={{ borderColor: 'var(--border)' }} />

        <div>
          <h3 className="text-sm font-bold mb-2.5" style={{ color: 'var(--text-primary)' }}>
            📖 What each field means
          </h3>
          <div className="space-y-3">
            {help.fields.map((f) => (
              <div key={f.label}>
                <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{f.label}</div>
                <div className="text-[11px] leading-relaxed mt-0.5" style={{ color: 'var(--text-secondary)' }}>{f.note}</div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="p-3 rounded-lg border-l-4"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--accent)' }}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--accent)' }}>
            ⚠️ Remember
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {help.remember}
          </p>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-7xl mx-auto space-y-8">

        {/* Actions Header */}
        <header className="mis-page-header-row mb-6">
          <div className="mis-page-header" style={{ marginBottom: 0 }}>
            <h1 className="mis-page-title">Finance Department Portal</h1>
            <p className="mis-page-desc">
              Log daily P&L, statutory renewals, exchange submissions, client fund movement, referral commission, cash/bank position, and recurring payables — the dashboard rolls daily entries up into monthly figures automatically.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setCsvHeaders([]);
                setCsvRows([]);
                setCsvMappings({});
                setCsvValidation(null);
                setCsvHasSample(false);
                setCsvModalOpen(true);
              }}
              className="px-3.5 py-1.5 border rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 h-[34px]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              📤 Bulk Import CSV
            </button>
            <div className="mis-tabs">
              <button
                type="button"
                onClick={() => setActiveTab('register')}
                className={`mis-tab ${activeTab === 'register' ? 'active' : ''}`}
              >
                {editingId ? '✏️ Edit Record' : 'Create Entry'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className={`mis-tab ${activeTab === 'list' ? 'active' : ''}`}
              >
                Search & View database
              </button>
            </div>
          </div>
        </header>

        {/* 8 Sheet Tab Bar */}
        <div className="mis-module-tabs flex-wrap mb-4">
          {[
            { id: 'pnl-summary', label: 'P&L Summary' },
            { id: 'compliance-renewals', label: 'Compliance & Renewals' },
            { id: 'exchange-reporting', label: 'Exchange Reporting' },
            { id: 'fund-movement', label: 'Client Fund Movement' },
            { id: 'client-requests', label: 'Client Requests' },
            { id: 'referral-commission', label: 'Referral Commission' },
            { id: 'cash-bank-position', label: 'Cash & Bank Position' },
            { id: 'recurring-payables', label: 'Recurring Payables' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSheetTab(tab.id)}
              className={`mis-module-tab ${sheetTab === tab.id ? 'active' : ''}`}
            >
              📄 {tab.label.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Main Content Area */}
        {activeTab === 'list' ? (
          <div className="mis-card p-5">

            {/* Search and Filters toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-5">
              <input
                type="text"
                placeholder="Search records..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="mis-input text-xs w-full sm:w-64"
              />
              {hasMultiBranchAccess && (
                <select
                  value={branchFilter}
                  onChange={e => setBranchFilter(e.target.value)}
                  className="mis-select text-xs w-full sm:w-48"
                >
                  <option value="">All Branches</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              )}
            </div>

            {loading ? (
              <div className="text-center py-10 text-gray-400">Loading department records...</div>
            ) : entries.length === 0 ? (
              <div className="text-center py-10 text-gray-400">No records found matching filters.</div>
            ) : (
              <div className="mis-table-wrap">

                {/* Batch Action Option */}
                {selectedIds.length > 0 && getStatusFieldOptions().length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 mb-5 border rounded-lg bg-teal-500/10 border-teal-500/20 text-left">
                    <span className="text-xs font-bold text-teal-400">
                      🛠️ Batch Action: {selectedIds.length} rows selected
                    </span>
                    <div className="flex items-center gap-2">
                      <select
                        className="mis-select text-xs py-1"
                        style={{ width: '150px' }}
                        value={batchStatus}
                        onChange={e => setBatchStatus(e.target.value)}
                      >
                        <option value="">Update Status...</option>
                        {getStatusFieldOptions().map((st: string) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleBatchAction}
                        className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition-all"
                      >
                        Apply Status
                      </button>
                    </div>
                  </div>
                )}

                <table className="mis-table w-full text-left">
                  <thead>
                    <tr>
                      <th className="w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === entries.length && entries.length > 0}
                          onChange={() => {
                            if (selectedIds.length === entries.length) setSelectedIds([]);
                            else setSelectedIds(entries.map(e => e.id));
                          }}
                        />
                      </th>
                      {getFormFields().slice(0, 5).map(f => (
                        <th key={f.name}>{f.label}</th>
                      ))}
                      <th>Date Added</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(row => (
                      <tr key={row.id}>
                        <td className="text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(row.id)}
                            onChange={() => toggleSelectRow(row.id)}
                          />
                        </td>
                        {getFormFields().slice(0, 5).map(f => {
                          let val = row[f.name];
                          if (typeof val === 'boolean') {
                            val = val ? 'Yes' : 'No';
                          }
                          return (
                            <td key={f.name} className="truncate max-w-[200px]" title={String(val || '')}>
                              {val !== undefined && val !== null ? String(val) : '-'}
                            </td>
                          );
                        })}
                        <td>{new Date(row.created_at).toLocaleDateString()}</td>
                        <td className="text-right space-x-2">
                          <button
                            className="text-slate-400 hover:text-slate-200 font-medium text-xs"
                            onClick={() => setViewingRecord(row)}
                          >
                            View
                          </button>
                          <button
                            className="text-indigo-400 hover:text-indigo-300 font-medium text-xs"
                            onClick={() => handleEdit(row)}
                          >
                            Edit
                          </button>
                          <button
                            className="text-red-400 hover:text-red-300 font-medium text-xs"
                            onClick={() => handleDelete(row.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (

          /* Data Entry Form Card + plain-English help panel */
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start max-w-6xl mx-auto">
          <div className="mis-card p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-1.5 border-b pb-3" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
              📋 {editingId ? '✏️ Modify Record Row' : '➕ Create New Record Row'}
            </h2>

            {sheetTab === 'pnl-summary' && !editingId && (
              <div className="mb-5 p-3.5 rounded-lg border border-teal-500/25 bg-teal-500/10 text-xs text-teal-300 leading-relaxed">
                💡 Enter <b>one row per day</b> with that day's figures — don't wait until month-end to add everything up by hand.
                The Dashboard automatically totals every day's entry into the monthly P&amp;L, revenue trend, and margin numbers for you.
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-5 text-left">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Dynamically Render Inputs based on active tab fields list */}
                {getFormFields().map(f => {
                  if (f.type === 'select') {
                    const opts = f.options || [];
                    return (
                      <div key={f.name} className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          {f.label} {f.required && <span className="text-red-500">*</span>}
                        </label>
                        <select
                          className="mis-select w-full"
                          value={formData[f.name] || ''}
                          onChange={e => setFormData({ ...formData, [f.name]: e.target.value })}
                          required={f.required}
                        >
                          <option value="">Select option...</option>
                          {opts.map((o: any) => {
                            const val = typeof o === 'string' ? o : o.value;
                            const lbl = typeof o === 'string' ? o : o.label;
                            return (
                              <option key={val} value={val}>{lbl}</option>
                            );
                          })}
                        </select>
                      </div>
                    );
                  }

                  if (f.type === 'textarea') {
                    return (
                      <div key={f.name} className="flex flex-col gap-1.5 md:col-span-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          {f.label} {f.required && <span className="text-red-500">*</span>}
                        </label>
                        <textarea
                          rows={3}
                          className="mis-input w-full"
                          value={formData[f.name] || ''}
                          onChange={e => setFormData({ ...formData, [f.name]: e.target.value })}
                          required={f.required}
                        />
                      </div>
                    );
                  }

                  if (f.type === 'checkbox') {
                    return (
                      <div key={f.name} className="flex items-center gap-2.5 md:col-span-2 py-1.5">
                        <input
                          type="checkbox"
                          id={f.name}
                          className="h-4.5 w-4.5 rounded border-slate-700 bg-slate-800 text-teal-600 focus:ring-teal-500"
                          checked={!!formData[f.name]}
                          onChange={e => setFormData({ ...formData, [f.name]: e.target.checked })}
                        />
                        <label htmlFor={f.name} className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                          {f.label}
                        </label>
                      </div>
                    );
                  }

                  return (
                    <div key={f.name} className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {f.label} {f.required && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type={f.type}
                        className="mis-input w-full"
                        value={formData[f.name] || ''}
                        onChange={e => setFormData({ ...formData, [f.name]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                        required={f.required}
                      />
                    </div>
                  );
                })}

                {/* Live P&L Preview Block */}
                {sheetTab === 'pnl-summary' && pnlPreview && (
                  <div className="md:col-span-2 p-4 rounded border border-indigo-500/20 bg-indigo-900/10 mt-2">
                    <h4 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                      Live Preview — This Day's Entry Only
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="block text-[10px] text-gray-400">Total Revenue:</span>
                        <span className="font-bold" style={{ color: 'var(--text-primary)' }}>₹{pnlPreview.totalRevenue}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-gray-400">Net Profit:</span>
                        <span className="text-green-400 font-bold">₹{pnlPreview.netProfit}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-gray-400">EBITDA Margin:</span>
                        <span className="text-teal-400 font-bold">{pnlPreview.ebitdaMargin}%</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-gray-400">Cost-to-Income:</span>
                        <span className="text-amber-400 font-bold">{pnlPreview.costToIncome}%</span>
                      </div>
                    </div>
                    <p className="text-[10.5px] text-gray-400 mt-3 leading-relaxed">
                      These ratios are for the day you're entering right now, not the whole month. Open the Dashboard and set the date range to a full month to see the added-up monthly figures.
                    </p>
                  </div>
                )}

                {/* Branch selector if admin */}
                {hasMultiBranchAccess && !editingId && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Branch Designation</label>
                    <select
                      className="mis-select w-full"
                      value={formData.branch_id || ''}
                      onChange={e => setFormData({ ...formData, branch_id: e.target.value })}
                    >
                      <option value="">Default Branch</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-800">
                <button
                  type="button"
                  className="px-4 py-2 border rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  onClick={() => setActiveTab('list')}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-all"
                >
                  {submitting ? 'Submitting...' : editingId ? 'Update Record' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>

          {renderHelpPanel()}
          </div>
        )}

      </div>

      {/* CSV Batch Upload Modal */}
      {csvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-4xl p-6 rounded-lg bg-gray-900 border border-gray-800 shadow-2xl text-left">
            <h3 className="text-lg font-bold text-white mb-4">Bulk Import CSV Records</h3>

            <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
              <CsvImportGuide
                fields={getFormFields().map(f => ({ key: f.name, label: f.label }))}
                templateFilename={`finance-${sheetTab}-template.csv`}
                missing={csvValidation?.missing}
                extra={csvValidation?.extra}
                sampleFileDetected={csvHasSample}
              />

              <div>
                <label className="block text-sm text-gray-400 mb-2">Select CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-900/50 file:text-indigo-300 hover:file:bg-indigo-900"
                  onChange={handleCsvFileUpload}
                />
              </div>

              {csvHeaders.length > 0 && !csvValidation && !csvHasSample && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-300 mb-3">Map CSV Columns to Database Fields</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto p-2 bg-gray-950 rounded border border-gray-800">
                    {getFormFields().map(f => (
                      <div key={f.name} className="flex items-center justify-between p-2 rounded bg-gray-900/50">
                        <span className="text-sm font-medium text-gray-300">
                          {f.label} {f.required && <span className="text-red-400">*</span>}
                        </span>
                        <select
                          className="mis-select max-w-[200px]"
                          value={csvMappings[f.name] || ''}
                          onChange={e => setCsvMappings({ ...csvMappings, [f.name]: e.target.value })}
                        >
                          <option value="">(Ignore Column)</option>
                          {csvHeaders.map(ch => (
                            <option key={ch} value={ch}>{ch}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3 Row Preview Grid */}
              {csvRows.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Data Import Preview (First 3 Rows)</h4>
                  <div className="overflow-x-auto max-h-[150px] border border-gray-800 rounded">
                    <table className="mis-table text-xs w-full">
                      <thead>
                        <tr>
                          {Object.keys(csvMappings).map(k => (
                            <th key={k}>{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvRows.slice(0, 3).map((row, i) => (
                          <tr key={i}>
                            {Object.entries(csvMappings).map(([dbCol, csvHeader]) => (
                              <td key={dbCol}>{csvHeader ? row[csvHeader] : '-'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-gray-850">
              <button
                className="px-4 py-2 border rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                onClick={() => {
                  setCsvModalOpen(false);
                  setCsvHeaders([]);
                  setCsvRows([]);
                }}
              >
                Close
              </button>
              <button
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-all"
                disabled={csvRows.length === 0 || !!csvValidation || csvHasSample}
                onClick={handleImportCsv}
              >
                Execute Import ({csvRows.length} Rows)
              </button>
            </div>
          </div>
        </div>
      )}

      <ViewDetailsModal record={viewingRecord} onClose={() => setViewingRecord(null)} title="Finance Record Details" />
    </DashboardLayout>
  );
};

export default FinanceDataEntryPage;
