import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { settlementService } from '../../services/settlement.service';
import { orgService } from '../../services/org.service';
import { authService } from '../../services/auth.service';
import ConfirmModal from '../../components/common/ConfirmModal';
import ViewDetailsModal from '../../components/common/ViewDetailsModal';
import { INITIAL_CONFIRM_STATE, type ConfirmDialogState } from '../../types/confirm.types';

interface SheetHelpConfig {
  why: string;
  fields: { label: string; note: string }[];
  remember: string;
}

// Plain-English explanations shown next to each data entry form, written for
// operations staff (not developers) — what this sheet is for and why each
// field matters. Keeps the same wording style across every department.
const SHEET_HELP: Record<string, SheetHelpConfig> = {
  payin_payout: {
    why: 'Every trade a client makes must settle — shares and funds actually change hands on the exchange\'s settlement date. This sheet tracks that daily pay-in/pay-out obligation per client so a shortage is caught before it becomes an exchange penalty.',
    fields: [
      { label: 'Settlement Date', note: 'The exchange settlement date this obligation is for (usually the trade date plus one working day).' },
      { label: 'Client Name', note: 'Selected via the KYC-verified client search so it always matches a real, verified client instead of a typed name that could be wrong.' },
      { label: 'Stock Symbol', note: 'Which security this settlement obligation is for.' },
      { label: 'Buy / Sell', note: 'Buy = the client needs to pay in funds and will receive shares. Sell = the client needs to deliver shares and will receive funds.' },
      { label: 'Quantity', note: 'How many shares are due to be delivered or received.' },
      { label: 'Status', note: 'Completed = settled in full. Pending = still outstanding. Shortage = the client could not deliver/receive the full quantity.' },
      { label: 'Shortage Quantity', note: 'How many shares are short — must be 0 when status is Completed, and greater than 0 when status is Shortage.' },
    ],
    remember: 'A Shortage that isn\'t resolved before the exchange\'s auction deadline can trigger a real penalty — treat Shortage status as urgent, not routine.',
  },
  client_requests: {
    why: 'Clients raise settlement-related service requests — demat transfers, pledge releases, account closures, bank detail updates — that need to be tracked to resolution instead of handled informally and forgotten.',
    fields: [
      { label: 'Request ID (Ticket #)', note: 'Auto-generated when you save (e.g. REQ-2026-0001) — no need to type one, this guarantees it\'s always unique.' },
      { label: 'Client Name', note: 'Selected via the KYC-verified client search so it always matches a real, verified client.' },
      { label: 'Request Type', note: 'What kind of request this is — Demat Transfer, Pledge Release, Account Closure, Bank Detail Update, Rematerialization, or Other.' },
      { label: 'Date Received', note: 'When the client actually made the request — this drives the "days pending" shown in the list, so keep it accurate.' },
      { label: 'Status', note: 'Received / In Process = being worked. Completed = done. Pending = stuck, needs attention.' },
      { label: 'Remarks / Action Logs', note: 'Notes on how this request is being handled.' },
    ],
    remember: 'Always use the KYC-verified client search — a mismatched client name on a Demat Transfer or Bank Detail Update request can send the wrong client\'s information to the wrong place.',
  },
  ipo_allocation: {
    why: 'When a client applies for an IPO, what they actually get allotted by the registrar often differs from what they applied for. This sheet tracks that outcome so refunds and client communication after the IPO closes are accurate.',
    fields: [
      { label: 'Application Number', note: 'The client\'s unique IPO application reference — must be unique in the system, so double-check it before saving.' },
      { label: 'Client Name', note: 'Selected via the KYC-verified client search.' },
      { label: 'IPO Name', note: 'Which IPO this application is for.' },
      { label: 'Category', note: 'Retail, HNI, QIB, or Employee — this determines which allotment rules apply.' },
      { label: 'Applied Qty', note: 'How many shares the client applied for.' },
      { label: 'Status', note: 'Applied = submitted, awaiting allotment. Allotted = got the full quantity. Partially Allotted = got some but not all. Refunded = got no shares, application money refunded.' },
      { label: 'Allotted Qty', note: 'How many shares were actually allotted — automatically 0 for Applied/Refunded, equal to Applied Qty for Allotted, and strictly between 0 and Applied Qty for Partially Allotted.' },
    ],
    remember: 'Allotted Qty must follow the status rules exactly — getting Allotted vs Partially Allotted wrong misstates exactly what the client is owed in refund.',
  },
  corporate_actions: {
    why: 'When a company declares a dividend, bonus, split, or rights issue, only shareholders who held the stock on the exact Record Date qualify. This sheet tracks each client\'s eligibility and entitlement so they actually receive what they\'re owed.',
    fields: [
      { label: 'Client Name', note: 'Selected via the KYC-verified client search.' },
      { label: 'Stock Symbol', note: 'Which security this corporate action applies to.' },
      { label: 'Corporate Action', note: 'Dividend, Bonus, Stock Split, or Rights Issue.' },
      { label: 'Record Date', note: 'The date used to determine eligibility — the client must have held the shares on this exact date to qualify, not today\'s date.' },
      { label: 'Quantity Held', note: 'How many shares the client held as of the Record Date.' },
      { label: 'Eligible?', note: 'Yes = the client qualifies for this action. No = they don\'t (e.g. bought the shares after the Record Date) — Entitlement is automatically 0 when Not Eligible.' },
      { label: 'Entitlement Amt/Qty', note: 'What the client is actually owed — a cash amount for Dividends, or additional shares for Bonus/Stock Split/Rights Issue.' },
    ],
    remember: 'Record Date is what determines eligibility, not today\'s date — always double-check the client actually held shares on that exact date before marking them Eligible.',
  },
};

const INITIAL_PAYIN_STATE = {
  settlement_date: format(new Date(), 'yyyy-MM-dd'),
  client_id: '',
  client_name: '',
  stock_symbol: '',
  buy_sell: 'Buy' as 'Buy' | 'Sell',
  quantity: 0,
  shortage_qty: 0,
  status: 'Pending' as 'Completed' | 'Pending' | 'Shortage',
  branch_id: '',
};

const INITIAL_CLIENT_STATE = {
  request_id: '',
  client_name: '',
  request_type: 'Demat Transfer' as 'Demat Transfer' | 'Pledge Release' | 'Account Closure' | 'Bank Detail Update' | 'Rematerialization' | 'Other',
  date_received: format(new Date(), 'yyyy-MM-dd'),
  status: 'Received' as 'Received' | 'In Process' | 'Pending' | 'Completed',
  remarks: '',
  branch_id: '',
};

const INITIAL_IPO_STATE = {
  application_no: '',
  client_id: '',
  client_name: '',
  ipo_name: '',
  category: 'Retail' as 'Retail' | 'HNI' | 'QIB' | 'Employee',
  applied_qty: 0,
  allotted_qty: 0,
  status: 'Applied' as 'Applied' | 'Allotted' | 'Refunded' | 'Partially Allotted',
  branch_id: '',
};

const INITIAL_CORP_STATE = {
  client_id: '',
  client_name: '',
  stock_symbol: '',
  corporate_action: 'Dividend' as 'Dividend' | 'Bonus' | 'Stock Split' | 'Rights Issue',
  record_date: format(new Date(), 'yyyy-MM-dd'),
  quantity: 0,
  eligible: 'Yes' as 'Yes' | 'No',
  entitlement_amt_qty: 0,
  branch_id: '',
};

interface VerifiedClient {
  id: string;
  applicant_name: string;
  pan: string;
  mobile_number?: string;
  email?: string;
}

const SettlementsDataEntryPage: React.FC = () => {
  // Authentication & Branch Checking
  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const hasMultiBranchAccess = isAdmin || ['ceo', 'managing_director', 'director', 'executive'].includes(currentUser?.role || '');
  const userBranchId = currentUser?.branch_id || '';

  // Sheet Tabs
  const [sheetTab, setSheetTab] = useState<'payin_payout' | 'client_requests' | 'ipo_allocation' | 'corporate_actions'>('payin_payout');
  
  // Sub-tabs
  const [activeTab, setActiveTab] = useState<'list' | 'register'>('list');
  const [formData, setFormData] = useState<any>({
    ...INITIAL_PAYIN_STATE,
    branch_id: userBranchId,
  });
  const [records, setRecords] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState<any>(null);

  // KYC verified client lookup
  const [kycClients, setKycClients] = useState<VerifiedClient[]>([]);
  const [clientSearchText, setClientSearchText] = useState('');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [confirmModal, setConfirmModal] = useState<ConfirmDialogState>(INITIAL_CONFIRM_STATE);

  useEffect(() => {
    fetchBranches();
    fetchKycClients();
  }, []);

  // Adapt state and filters when switching sheet tabs
  useEffect(() => {
    setActiveTab('list');
    setEditingId(null);
    setStatusFilter('');
    setBranchFilter('');
    setSearchTerm('');
    setClientSearchText('');
    setRecords([]); // Clear records immediately to prevent cross-tab render crashes!

    if (sheetTab === 'payin_payout') {
      setFormData({
        ...INITIAL_PAYIN_STATE,
        branch_id: userBranchId,
      });
    } else if (sheetTab === 'client_requests') {
      setFormData({
        ...INITIAL_CLIENT_STATE,
        branch_id: userBranchId,
      });
    } else if (sheetTab === 'ipo_allocation') {
      setFormData({
        ...INITIAL_IPO_STATE,
        branch_id: userBranchId,
      });
    } else if (sheetTab === 'corporate_actions') {
      setFormData({
        ...INITIAL_CORP_STATE,
        branch_id: userBranchId,
      });
    }
  }, [sheetTab]);

  useEffect(() => {
    fetchRecords();
  }, [sheetTab, activeTab, statusFilter, branchFilter]);

  const fetchBranches = async () => {
    try {
      const data = await orgService.getBranches();
      setBranches(data || []);
    } catch (err) {
      console.error('Failed to load branches:', err);
      toast.error('Failed to retrieve branches list.');
    }
  };

  const fetchRecords = async () => {
    setFetching(true);
    try {
      const branchIdParam = hasMultiBranchAccess ? (branchFilter || undefined) : userBranchId;
      
      if (sheetTab === 'payin_payout') {
        const data = await settlementService.getPayInPayOutRecords({
          status: statusFilter || undefined,
          branchId: branchIdParam,
          search: searchTerm || undefined,
        });
        setRecords(data || []);
      } else if (sheetTab === 'client_requests') {
        const data = await settlementService.getClientRequestRecords({
          status: statusFilter || undefined,
          branchId: branchIdParam,
          search: searchTerm || undefined,
        });
        setRecords(data || []);
      } else if (sheetTab === 'ipo_allocation') {
        const data = await settlementService.getIpoAllocationRecords({
          status: statusFilter || undefined,
          branchId: branchIdParam,
          search: searchTerm || undefined,
        });
        setRecords(data || []);
      } else if (sheetTab === 'corporate_actions') {
        const data = await settlementService.getCorporateActionRecords({
          eligible: statusFilter || undefined,
          branchId: branchIdParam,
          search: searchTerm || undefined,
        });
        setRecords(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch records:', err);
      toast.error('Failed to retrieve database.');
    } finally {
      setFetching(false);
    }
  };

  const handleInputChange = (fieldName: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const fetchKycClients = async () => {
    try {
      const data = await settlementService.getVerifiedClients();
      setKycClients(data || []);
    } catch (err) {
      console.error('Failed to load verified clients:', err);
    }
  };

  const filteredKycClients = kycClients.filter((c) =>
    c.applicant_name.toLowerCase().includes(clientSearchText.toLowerCase()) ||
    c.pan.toLowerCase().includes(clientSearchText.toLowerCase())
  );

  const handleKycClientSelect = (client: VerifiedClient) => {
    setClientSearchText(client.applicant_name);
    setClientDropdownOpen(false);
    handleInputChange('client_name', client.applicant_name);
  };

  const renderClientNameField = () => (
    <div className="mis-field relative">
      <label className="mis-label">Client Name</label>
      <input
        type="text"
        value={clientSearchText}
        onChange={(e) => {
          const val = e.target.value;
          setClientSearchText(val);
          setClientDropdownOpen(true);
          // Allow free typing to still land in the form field if the
          // client isn't found in the verified list.
          handleInputChange('client_name', val);
        }}
        onFocus={() => setClientDropdownOpen(true)}
        onBlur={() => setTimeout(() => setClientDropdownOpen(false), 150)}
        placeholder="Search KYC verified client name or PAN..."
        className="mis-input"
        required
      />
      {clientDropdownOpen && filteredKycClients.length > 0 && (
        <div className="absolute z-10 w-full mt-1 max-h-56 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-lg">
          {filteredKycClients.map((c) => (
            <div
              key={c.id}
              onMouseDown={() => handleKycClientSelect(c)}
              className="px-4 py-2 hover:bg-slate-700 cursor-pointer text-xs flex justify-between items-center text-slate-200"
            >
              <span className="font-semibold">{c.applicant_name}</span>
              <span className="text-slate-400 text-[10px]">{c.pan}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const validateForm = () => {
    if (sheetTab === 'payin_payout') {
      if (!formData.settlement_date) return 'Settlement Date is required.';
      if (!formData.client_id?.trim()) return 'Client ID is required.';
      if (!formData.client_name?.trim()) return 'Client Name is required.';
      if (!formData.stock_symbol?.trim()) return 'Stock Symbol is required.';
      if (formData.quantity <= 0) return 'Quantity must be greater than 0.';
      if (formData.status === 'Completed' && formData.shortage_qty > 0) {
        return 'Shortage quantity must be 0 for Completed status.';
      }
      if (formData.status === 'Shortage' && formData.shortage_qty <= 0) {
        return 'Shortage quantity must be greater than 0 for Shortage status.';
      }
    } else if (sheetTab === 'client_requests') {
      // request_id is server-generated on save, never user-entered.
      if (!formData.client_name?.trim()) return 'Client Name is required.';
      if (!formData.request_type) return 'Request Type is required.';
      if (!formData.date_received) return 'Date Received is required.';
    } else if (sheetTab === 'ipo_allocation') {
      if (!formData.application_no?.trim()) return 'Application Number is required.';
      if (!formData.client_id?.trim()) return 'Client ID is required.';
      if (!formData.client_name?.trim()) return 'Client Name is required.';
      if (!formData.ipo_name?.trim()) return 'IPO Name is required.';
      if (formData.applied_qty <= 0) return 'Applied Quantity must be greater than 0.';
      
      // Allotted check rules
      if (formData.status === 'Partially Allotted') {
        if (formData.allotted_qty <= 0 || formData.allotted_qty >= formData.applied_qty) {
          return 'For Partially Allotted, Allotted Quantity must be greater than 0 and less than Applied Quantity.';
        }
      }
    } else if (sheetTab === 'corporate_actions') {
      if (!formData.client_id?.trim()) return 'Client ID is required.';
      if (!formData.client_name?.trim()) return 'Client Name is required.';
      if (!formData.stock_symbol?.trim()) return 'Stock Symbol is required.';
      if (!formData.corporate_action) return 'Corporate Action is required.';
      if (!formData.record_date) return 'Record Date is required.';
      if (formData.quantity < 0) return 'Quantity cannot be negative.';
      
      if (formData.eligible === 'Yes' && formData.entitlement_amt_qty < 0) {
        return 'Entitlement cannot be negative.';
      }
      
      // Integer checks for Bonus or Stock Split
      if (formData.eligible === 'Yes' && ['Bonus', 'Stock Split'].includes(formData.corporate_action)) {
        if (!Number.isInteger(Number(formData.entitlement_amt_qty))) {
          return 'For Bonus or Stock Split actions, Entitlement shares must be an integer.';
        }
      }
    }
    if (!formData.branch_id) return 'Branch Office is required.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errorMsg = validateForm();
    if (errorMsg) {
      toast.error(errorMsg);
      return;
    }

    setLoading(true);
    try {
      if (sheetTab === 'payin_payout') {
        if (editingId) {
          await settlementService.updatePayInPayOutRecord(editingId, formData);
          toast.success('Pay-in/Pay-out record updated.');
        } else {
          await settlementService.createPayInPayOutRecord(formData);
          toast.success('Pay-in/Pay-out record added.');
        }
      } else if (sheetTab === 'client_requests') {
        if (editingId) {
          await settlementService.updateClientRequestRecord(editingId, formData);
          toast.success('Client request ticket updated.');
        } else {
          await settlementService.createClientRequestRecord(formData);
          toast.success('Client request ticket created.');
        }
      } else if (sheetTab === 'ipo_allocation') {
        if (editingId) {
          await settlementService.updateIpoAllocationRecord(editingId, formData);
          toast.success('IPO Allocation record updated.');
        } else {
          await settlementService.createIpoAllocationRecord(formData);
          toast.success('IPO Allocation record added.');
        }
      } else if (sheetTab === 'corporate_actions') {
        if (editingId) {
          await settlementService.updateCorporateActionRecord(editingId, formData);
          toast.success('Corporate action record updated.');
        } else {
          await settlementService.createCorporateActionRecord(formData);
          toast.success('Corporate action record added.');
        }
      }
      
      setEditingId(null);
      setActiveTab('list');
      
      let nextFormState = {};
      if (sheetTab === 'payin_payout') nextFormState = INITIAL_PAYIN_STATE;
      else if (sheetTab === 'client_requests') nextFormState = INITIAL_CLIENT_STATE;
      else if (sheetTab === 'ipo_allocation') nextFormState = INITIAL_IPO_STATE;
      else if (sheetTab === 'corporate_actions') nextFormState = INITIAL_CORP_STATE;

      setFormData({
        ...nextFormState,
        branch_id: userBranchId,
      });
      setClientSearchText('');
      fetchRecords();
    } catch (err: any) {
      console.error('Submit error:', err);
      toast.error(err.message || 'Error saving record.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    if (sheetTab === 'payin_payout') {
      setFormData({
        settlement_date: record.settlement_date,
        client_id: record.client_id,
        client_name: record.client_name,
        stock_symbol: record.stock_symbol,
        buy_sell: record.buy_sell,
        quantity: record.quantity,
        shortage_qty: record.shortage_qty,
        status: record.status,
        branch_id: record.branch_id || userBranchId,
      });
    } else if (sheetTab === 'client_requests') {
      setFormData({
        request_id: record.request_id,
        client_name: record.client_name,
        request_type: record.request_type,
        date_received: record.date_received,
        status: record.status,
        remarks: record.remarks || '',
        branch_id: record.branch_id || userBranchId,
      });
    } else if (sheetTab === 'ipo_allocation') {
      setFormData({
        application_no: record.application_no,
        client_id: record.client_id,
        client_name: record.client_name,
        ipo_name: record.ipo_name,
        category: record.category,
        applied_qty: record.applied_qty,
        allotted_qty: record.allotted_qty,
        status: record.status,
        branch_id: record.branch_id || userBranchId,
      });
    } else if (sheetTab === 'corporate_actions') {
      setFormData({
        client_id: record.client_id,
        client_name: record.client_name,
        stock_symbol: record.stock_symbol,
        corporate_action: record.corporate_action,
        record_date: record.record_date,
        quantity: record.quantity,
        eligible: record.eligible,
        entitlement_amt_qty: record.entitlement_amt_qty,
        branch_id: record.branch_id || userBranchId,
      });
    }
    setClientSearchText(record.client_name || '');
    setActiveTab('register');
  };

  const SETTLEMENTS_SHEET_URL_SLUG: Record<typeof sheetTab, string> = {
    payin_payout: 'payin-payout',
    client_requests: 'client-requests',
    ipo_allocation: 'ipo-allocation',
    corporate_actions: 'corporate-actions',
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      await settlementService.deleteEntry(SETTLEMENTS_SHEET_URL_SLUG[sheetTab], id);
      toast.success('Record deleted.');
      fetchRecords();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Delete operation failed.');
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
      <div className="mis-page mis-animate-in">
        
        {/* Title / Toolbar */}
        <div className="mis-data-entry-toolbar mb-6">
          <div className="mis-data-entry-toolbar-title">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Clearing & Settlements MIS Tracker
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Departmental entry sheets and transaction tracker logs.
            </p>
          </div>
        </div>

        {/* Dynamic Sheets Tab bar */}
        <div className="mis-module-tabs flex-wrap mb-6">
          <button
            type="button"
            onClick={() => setSheetTab('payin_payout')}
            className={`mis-module-tab ${sheetTab === 'payin_payout' ? 'active' : ''}`}
          >
            📊 Pay-in / Pay-out Sheet
          </button>
          <button
            type="button"
            onClick={() => setSheetTab('client_requests')}
            className={`mis-module-tab ${sheetTab === 'client_requests' ? 'active' : ''}`}
          >
            🎫 Client Requests Sheet
          </button>
          <button
            type="button"
            onClick={() => setSheetTab('ipo_allocation')}
            className={`mis-module-tab ${sheetTab === 'ipo_allocation' ? 'active' : ''}`}
          >
            📈 IPO Allocation Sheet
          </button>
          <button
            type="button"
            onClick={() => setSheetTab('corporate_actions')}
            className={`mis-module-tab ${sheetTab === 'corporate_actions' ? 'active' : ''}`}
          >
            📢 Corporate Actions Sheet
          </button>
        </div>

        {/* Form / List Toggle Panel */}
        <div className="flex justify-between items-center mb-6">
          <div className="mis-tabs">
            <button
              type="button"
              onClick={() => {
                setActiveTab('list');
                setEditingId(null);

                let nextFormState = {};
                if (sheetTab === 'payin_payout') nextFormState = INITIAL_PAYIN_STATE;
                else if (sheetTab === 'client_requests') nextFormState = INITIAL_CLIENT_STATE;
                else if (sheetTab === 'ipo_allocation') nextFormState = INITIAL_IPO_STATE;
                else if (sheetTab === 'corporate_actions') nextFormState = INITIAL_CORP_STATE;

                setFormData({
                  ...nextFormState,
                  branch_id: userBranchId,
                });
                setClientSearchText('');
              }}
              className={`mis-tab ${activeTab === 'list' ? 'active' : ''}`}
            >
              📝 View Sheet Grid
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('register')}
              className={`mis-tab ${activeTab === 'register' ? 'active' : ''}`}
            >
              ➕ {editingId ? 'Edit Row' : 'Add New Entry'}
            </button>
          </div>

          {activeTab === 'list' && (
            <button
              onClick={() => setActiveTab('register')}
              className="mis-btn mis-btn-primary text-xs"
            >
              Add Record Row
            </button>
          )}
        </div>

        {/* SHEET 1: PAY-IN / PAY-OUT TRACKER */}
        {sheetTab === 'payin_payout' && (
          <div>
            {activeTab === 'register' ? (
              /* Add/Edit Row Form + plain-English help panel */
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start max-w-6xl mx-auto">
              <div className="mis-card p-6">
                <h2 className="text-lg font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
                  {editingId ? '✏️ Edit Pay-in / Pay-out Row' : '📋 Create New Pay-in / Pay-out Row'}
                </h2>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="mis-field">
                      <label className="mis-label">Settlement Date</label>
                      <input
                        type="date"
                        value={formData.settlement_date}
                        onChange={(e) => handleInputChange('settlement_date', e.target.value)}
                        className="mis-input"
                        required
                      />
                    </div>
                    <div className="mis-field">
                      <label className="mis-label">Client ID</label>
                      <input
                        type="text"
                        value={formData.client_id}
                        onChange={(e) => handleInputChange('client_id', e.target.value)}
                        placeholder="CLIENT-10023"
                        className="mis-input"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderClientNameField()}
                    <div className="mis-field">
                      <label className="mis-label">Stock Symbol</label>
                      <input
                        type="text"
                        value={formData.stock_symbol}
                        onChange={(e) => handleInputChange('stock_symbol', e.target.value.toUpperCase())}
                        placeholder="RELIANCE"
                        className="mis-input"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="mis-field">
                      <label className="mis-label">Buy / Sell</label>
                      <select
                        value={formData.buy_sell}
                        onChange={(e) => handleInputChange('buy_sell', e.target.value as any)}
                        className="mis-select"
                        required
                      >
                        <option value="Buy">Buy</option>
                        <option value="Sell">Sell</option>
                      </select>
                    </div>
                    
                    <div className="mis-field">
                      <label className="mis-label">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.quantity || ''}
                        onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 0)}
                        placeholder="1000"
                        className="mis-input"
                        required
                      />
                    </div>

                    <div className="mis-field">
                      <label className="mis-label">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => {
                          const newStatus = e.target.value as any;
                          handleInputChange('status', newStatus);
                          if (newStatus === 'Completed') {
                            handleInputChange('shortage_qty', 0);
                          }
                        }}
                        className="mis-select"
                        required
                      >
                        <option value="Completed">Completed</option>
                        <option value="Pending">Pending</option>
                        <option value="Shortage">Shortage</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="mis-field">
                      <label className={`mis-label ${formData.status === 'Completed' ? 'opacity-50' : ''}`}>
                        Shortage Quantity
                      </label>
                      <input
                        type="number"
                        min="0"
                        disabled={formData.status === 'Completed'}
                        value={formData.shortage_qty || 0}
                        onChange={(e) => handleInputChange('shortage_qty', parseInt(e.target.value) || 0)}
                        className={`mis-input ${formData.status === 'Completed' ? 'opacity-50 bg-slate-100 dark:bg-slate-900' : ''}`}
                      />
                    </div>

                    <div className="mis-field">
                      <label className="mis-label">Branch Office</label>
                      <select
                        value={formData.branch_id}
                        onChange={(e) => handleInputChange('branch_id', e.target.value)}
                        className="mis-select"
                        required
                        disabled={!hasMultiBranchAccess}
                      >
                        <option value="">-- Choose Branch --</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('list');
                        setEditingId(null);
                        setFormData({
                          ...INITIAL_PAYIN_STATE,
                          branch_id: userBranchId,
                        });
                        setClientSearchText('');
                      }}
                      className="mis-btn mis-btn-ghost text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="mis-btn mis-btn-primary text-sm px-6"
                    >
                      {loading ? 'Saving...' : editingId ? 'Update Row' : 'Add Row'}
                    </button>
                  </div>
                </form>
              </div>

              {renderHelpPanel()}
              </div>
            ) : (
              /* View Sheet Grid Tab */
              <div className="mis-card p-5">
                
                {/* Search & Filter Toolbar */}
                <div className="flex flex-col sm:flex-row gap-4 mb-5">
                  <div className="mis-field m-0 flex-1">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="🔍 Search by Client ID, Name, or Stock..."
                      className="mis-input"
                    />
                  </div>
                  <div className="mis-field m-0 w-full sm:w-48">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="mis-select"
                    >
                      <option value="">All Statuses</option>
                      <option value="Completed">Completed</option>
                      <option value="Pending">Pending</option>
                      <option value="Shortage">Shortage</option>
                    </select>
                  </div>
                  
                  {hasMultiBranchAccess && (
                    <div className="mis-field m-0 w-full sm:w-48">
                      <select
                        value={branchFilter}
                        onChange={(e) => setBranchFilter(e.target.value)}
                        className="mis-select"
                      >
                        <option value="">All Branches</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 mb-4">
                  <button
                    onClick={fetchRecords}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    🔄 Refresh Grid Data
                  </button>
                </div>

                {/* Spreadsheet Table Grid */}
                <div className="mis-table-wrap">
                  {fetching ? (
                    <div className="mis-loading-center py-16">
                      <div className="mis-spinner" />
                    </div>
                  ) : records.length === 0 ? (
                    <div className="mis-empty py-16 text-center">
                      No Pay-in / Pay-out records found matching criteria.
                    </div>
                  ) : (
                    <table className="mis-table">
                      <thead>
                        <tr>
                          <th>Settlement Date</th>
                          <th>Client ID</th>
                          <th>Client Name</th>
                          <th>Stock Symbol</th>
                          <th>Buy / Sell</th>
                          <th>Quantity</th>
                          <th>Shortage Qty</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => {
                          const getRowStyle = (status: string) => {
                            if (status === 'Completed') {
                              return { backgroundColor: 'var(--success-muted-bg)', color: 'var(--success-muted-text)' };
                            }
                            if (status === 'Pending') {
                              return { backgroundColor: 'var(--badge-warning-bg)', color: 'var(--badge-warning-text)' };
                            }
                            if (status === 'Shortage') {
                              return { backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)' };
                            }
                            return undefined;
                          };

                          const getStatusBadge = (status: string) => {
                            if (status === 'Completed') {
                              return <span className="mis-badge mis-badge-success">Completed</span>;
                            }
                            if (status === 'Pending') {
                              return <span className="mis-badge mis-badge-warning">Pending</span>;
                            }
                            return (
                              <span 
                                className="mis-badge"
                                style={{ 
                                  color: 'var(--badge-danger-text)', 
                                  backgroundColor: 'var(--badge-danger-bg)', 
                                  borderColor: 'var(--badge-danger-border)' 
                                }}
                              >
                                Shortage
                              </span>
                            );
                          };

                          return (
                            <tr key={record.id} style={getRowStyle(record.status)}>
                              <td>
                                {record.settlement_date ? format(new Date(record.settlement_date), 'dd-MM-yyyy') : '-'}
                              </td>
                              <td>
                                <span className="font-mono text-xs font-bold">{record.client_id}</span>
                              </td>
                              <td>
                                <span className="font-semibold">{record.client_name}</span>
                              </td>
                              <td>
                                <span className="font-bold">{record.stock_symbol}</span>
                              </td>
                              <td>
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                  record.buy_sell === 'Buy' 
                                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' 
                                    : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                                }`}>
                                  {record.buy_sell}
                                </span>
                              </td>
                              <td>
                                <span className="font-semibold">{record.quantity?.toLocaleString() || 0}</span>
                              </td>
                              <td>
                                {record.shortage_qty > 0 ? (
                                  <span className="font-bold" style={{ color: 'var(--danger-text)' }}>
                                    {record.shortage_qty?.toLocaleString() || 0}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }}>-</span>
                                )}
                              </td>
                              <td>
                                {getStatusBadge(record.status)}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  onClick={() => setViewingRecord(record)}
                                  className="mis-btn mis-btn-ghost mis-btn-sm"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => handleEdit(record)}
                                  className="mis-btn mis-btn-ghost mis-btn-sm"
                                >
                                  Edit Row
                                </button>
                                <button
                                  onClick={() => handleDelete(record.id)}
                                  className="mis-btn mis-btn-ghost mis-btn-sm"
                                  style={{ color: '#ef4444', marginLeft: '0.5rem' }}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SHEET 2: CLIENT SERVICE REQUESTS TRACKER */}
        {sheetTab === 'client_requests' && (
          <div>
            {activeTab === 'register' ? (
              /* Add/Edit Ticket Form + plain-English help panel */
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start max-w-6xl mx-auto">
              <div className="mis-card p-6">
                <h2 className="text-lg font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
                  {editingId ? '✏️ Edit Request Ticket' : '📋 Create New Request Ticket'}
                </h2>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="mis-field">
                      <label className="mis-label">Request ID (Ticket #)</label>
                      <input
                        type="text"
                        className="mis-input disabled:opacity-75 disabled:cursor-not-allowed font-semibold"
                        value={editingId ? formData.request_id : 'Auto-generated on save (e.g. REQ-2026-0001)'}
                        disabled
                      />
                    </div>
                    {renderClientNameField()}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="mis-field">
                      <label className="mis-label">Request Type</label>
                      <select
                        value={formData.request_type}
                        onChange={(e) => handleInputChange('request_type', e.target.value)}
                        className="mis-select"
                        required
                      >
                        <option value="Demat Transfer">Demat Transfer</option>
                        <option value="Pledge Release">Pledge Release</option>
                        <option value="Account Closure">Account Closure</option>
                        <option value="Bank Detail Update">Bank Detail Update</option>
                        <option value="Rematerialization">Rematerialization</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="mis-field">
                      <label className="mis-label">Date Received</label>
                      <input
                        type="date"
                        value={formData.date_received}
                        onChange={(e) => handleInputChange('date_received', e.target.value)}
                        className="mis-input"
                        required
                      />
                    </div>

                    <div className="mis-field">
                      <label className="mis-label">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => handleInputChange('status', e.target.value)}
                        className="mis-select"
                        required
                      >
                        <option value="Received">Received</option>
                        <option value="In Process">In Process</option>
                        <option value="Pending">Pending</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="mis-field">
                      <label className="mis-label">Branch Office</label>
                      <select
                        value={formData.branch_id}
                        onChange={(e) => handleInputChange('branch_id', e.target.value)}
                        className="mis-select"
                        required
                        disabled={!hasMultiBranchAccess}
                      >
                        <option value="">-- Choose Branch --</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mis-field">
                      <label className="mis-label">Remarks / Action Logs</label>
                      <textarea
                        rows={3}
                        value={formData.remarks || ''}
                        onChange={(e) => handleInputChange('remarks', e.target.value)}
                        placeholder="Client requested Account Closure..."
                        className="mis-input"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('list');
                        setEditingId(null);
                        setFormData({
                          ...INITIAL_CLIENT_STATE,
                          branch_id: userBranchId,
                        });
                        setClientSearchText('');
                      }}
                      className="mis-btn mis-btn-ghost text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="mis-btn mis-btn-primary text-sm px-6"
                    >
                      {loading ? 'Saving...' : editingId ? 'Update Ticket' : 'Save Ticket'}
                    </button>
                  </div>
                </form>
              </div>

              {renderHelpPanel()}
              </div>
            ) : (
              /* View Client Requests Sheet Grid */
              <div className="mis-card p-5">
                
                {/* Search & Filter Toolbar */}
                <div className="flex flex-col sm:flex-row gap-4 mb-5">
                  <div className="mis-field m-0 flex-1">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="🔍 Search by Request ID, Client, or Remarks..."
                      className="mis-input"
                    />
                  </div>
                  <div className="mis-field m-0 w-full sm:w-48">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="mis-select"
                    >
                      <option value="">All Statuses</option>
                      <option value="Received">Received</option>
                      <option value="In Process">In Process</option>
                      <option value="Pending">Pending</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                  
                  {hasMultiBranchAccess && (
                    <div className="mis-field m-0 w-full sm:w-48">
                      <select
                        value={branchFilter}
                        onChange={(e) => setBranchFilter(e.target.value)}
                        className="mis-select"
                      >
                        <option value="">All Branches</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 mb-4">
                  <button
                    onClick={fetchRecords}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    🔄 Refresh Grid Data
                  </button>
                </div>

                {/* Client Requests Table Grid */}
                <div className="mis-table-wrap">
                  {fetching ? (
                    <div className="mis-loading-center py-16">
                      <div className="mis-spinner" />
                    </div>
                  ) : records.length === 0 ? (
                    <div className="mis-empty py-16 text-center">
                      No Client Request tickets found matching criteria.
                    </div>
                  ) : (
                    <table className="mis-table">
                      <thead>
                        <tr>
                          <th>Request ID</th>
                          <th>Client Name</th>
                          <th>Request Type</th>
                          <th>Date Received</th>
                          <th>Status</th>
                          <th>Days Pending</th>
                          <th>Remarks</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => {
                          const isOverdue = record.days_pending > 2 && record.status === 'Pending';
                          
                          const getRowStyle = () => {
                            if (isOverdue) {
                              return { backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)' };
                            }
                            return undefined;
                          };

                          const getStatusBadge = (status: string) => {
                            if (status === 'Completed') return <span className="mis-badge mis-badge-success">Completed</span>;
                            if (status === 'In Process') return <span className="mis-badge mis-badge-info">In Process</span>;
                            if (status === 'Received') return <span className="mis-badge mis-badge-neutral">Received</span>;
                            return <span className="mis-badge mis-badge-warning">Pending</span>;
                          };

                          return (
                            <tr key={record.id} style={getRowStyle()}>
                              <td>
                                <span className="font-mono text-xs font-bold">{record.request_id}</span>
                              </td>
                              <td>
                                <span className="font-semibold">{record.client_name}</span>
                              </td>
                              <td>
                                <span className="font-semibold">{record.request_type}</span>
                              </td>
                              <td>
                                {record.date_received ? format(new Date(record.date_received), 'dd-MM-yyyy') : '-'}
                              </td>
                              <td>
                                {getStatusBadge(record.status)}
                              </td>
                              <td>
                                <div className="flex items-center gap-1.5 font-bold">
                                  {record.days_pending} days
                                  {isOverdue && (
                                    <span 
                                      className="px-1.5 py-0.5 rounded text-[10px] font-extrabold animate-pulse uppercase tracking-wider"
                                      style={{ backgroundColor: 'var(--badge-danger-text)', color: '#fff' }}
                                    >
                                      ⚠️ Overdue
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="text-xs max-w-xs truncate" title={record.remarks} style={{ color: 'var(--text-muted)' }}>
                                {record.remarks || 'No remarks'}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  onClick={() => setViewingRecord(record)}
                                  className="mis-btn mis-btn-ghost mis-btn-sm"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => handleEdit(record)}
                                  className="mis-btn mis-btn-ghost mis-btn-sm"
                                >
                                  Edit Row
                                </button>
                                <button
                                  onClick={() => handleDelete(record.id)}
                                  className="mis-btn mis-btn-ghost mis-btn-sm"
                                  style={{ color: '#ef4444', marginLeft: '0.5rem' }}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SHEET 3: IPO ALLOCATION SHEET */}
        {sheetTab === 'ipo_allocation' && (
          <div>
            {activeTab === 'register' ? (
              /* Add/Edit IPO Row Form + plain-English help panel */
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start max-w-6xl mx-auto">
              <div className="mis-card p-6">
                <h2 className="text-lg font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
                  {editingId ? '✏️ Edit IPO Allocation' : '📋 Create New IPO Allocation'}
                </h2>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="mis-field">
                      <label className="mis-label">Application Number</label>
                      <input
                        type="text"
                        value={formData.application_no || ''}
                        onChange={(e) => handleInputChange('application_no', e.target.value)}
                        placeholder="IPO-APP-98312"
                        className="mis-input"
                        required
                      />
                    </div>
                    <div className="mis-field">
                      <label className="mis-label">Client ID</label>
                      <input
                        type="text"
                        value={formData.client_id || ''}
                        onChange={(e) => handleInputChange('client_id', e.target.value)}
                        placeholder="CLIENT-90234"
                        className="mis-input"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderClientNameField()}
                    <div className="mis-field">
                      <label className="mis-label">IPO Name</label>
                      <input
                        type="text"
                        value={formData.ipo_name || ''}
                        onChange={(e) => handleInputChange('ipo_name', e.target.value)}
                        placeholder="Zomato IPO"
                        className="mis-input"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="mis-field">
                      <label className="mis-label">Category</label>
                      <select
                        value={formData.category || 'Retail'}
                        onChange={(e) => handleInputChange('category', e.target.value)}
                        className="mis-select"
                        required
                      >
                        <option value="Retail">Retail</option>
                        <option value="HNI">HNI</option>
                        <option value="QIB">QIB</option>
                        <option value="Employee">Employee</option>
                      </select>
                    </div>

                    <div className="mis-field">
                      <label className="mis-label">Applied Qty</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.applied_qty || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          let newAllotted = formData.allotted_qty;
                          if (formData.status === 'Allotted') {
                            newAllotted = val;
                          }
                          setFormData((prev: any) => ({
                            ...prev,
                            applied_qty: val,
                            allotted_qty: newAllotted
                          }));
                        }}
                        placeholder="150"
                        className="mis-input"
                        required
                      />
                    </div>

                    <div className="mis-field">
                      <label className="mis-label">Status</label>
                      <select
                        value={formData.status || 'Applied'}
                        onChange={(e) => {
                          const nextStatus = e.target.value as any;
                          let nextAllotted = formData.allotted_qty;
                          if (nextStatus === 'Refunded' || nextStatus === 'Applied') {
                            nextAllotted = 0;
                          } else if (nextStatus === 'Allotted') {
                            nextAllotted = formData.applied_qty;
                          }
                          setFormData((prev: any) => ({
                            ...prev,
                            status: nextStatus,
                            allotted_qty: nextAllotted
                          }));
                        }}
                        className="mis-select"
                        required
                      >
                        <option value="Applied">Applied</option>
                        <option value="Allotted">Allotted</option>
                        <option value="Refunded">Refunded</option>
                        <option value="Partially Allotted">Partially Allotted</option>
                      </select>
                    </div>

                    <div className="mis-field">
                      <label className={`mis-label ${formData.status !== 'Partially Allotted' ? 'opacity-50' : ''}`}>
                        Allotted Qty
                      </label>
                      <input
                        type="number"
                        min="0"
                        disabled={formData.status !== 'Partially Allotted'}
                        value={formData.allotted_qty || 0}
                        onChange={(e) => handleInputChange('allotted_qty', parseInt(e.target.value) || 0)}
                        placeholder="150"
                        className={`mis-input ${formData.status !== 'Partially Allotted' ? 'opacity-50 bg-slate-100 dark:bg-slate-900' : ''}`}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="mis-field">
                      <label className="mis-label">Branch Office</label>
                      <select
                        value={formData.branch_id || ''}
                        onChange={(e) => handleInputChange('branch_id', e.target.value)}
                        className="mis-select"
                        required
                        disabled={!hasMultiBranchAccess}
                      >
                        <option value="">-- Choose Branch --</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('list');
                        setEditingId(null);
                        setFormData({
                          ...INITIAL_IPO_STATE,
                          branch_id: userBranchId,
                        });
                        setClientSearchText('');
                      }}
                      className="mis-btn mis-btn-ghost text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="mis-btn mis-btn-primary text-sm px-6"
                    >
                      {loading ? 'Saving...' : editingId ? 'Update Row' : 'Add Row'}
                    </button>
                  </div>
                </form>
              </div>

              {renderHelpPanel()}
              </div>
            ) : (
              /* View IPO Allocations Sheet Grid */
              <div className="mis-card p-5">
                
                {/* Search & Filter Toolbar */}
                <div className="flex flex-col sm:flex-row gap-4 mb-5">
                  <div className="mis-field m-0 flex-1">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="🔍 Search by Application No, Client, or IPO..."
                      className="mis-input"
                    />
                  </div>
                  <div className="mis-field m-0 w-full sm:w-48">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="mis-select"
                    >
                      <option value="">All Statuses</option>
                      <option value="Applied">Applied</option>
                      <option value="Allotted">Allotted</option>
                      <option value="Refunded">Refunded</option>
                      <option value="Partially Allotted">Partially Allotted</option>
                    </select>
                  </div>
                  
                  {hasMultiBranchAccess && (
                    <div className="mis-field m-0 w-full sm:w-48">
                      <select
                        value={branchFilter}
                        onChange={(e) => setBranchFilter(e.target.value)}
                        className="mis-select"
                      >
                        <option value="">All Branches</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 mb-4">
                  <button
                    onClick={fetchRecords}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    🔄 Refresh Grid Data
                  </button>
                </div>

                {/* IPO Allocation Table Grid */}
                <div className="mis-table-wrap">
                  {fetching ? (
                    <div className="mis-loading-center py-16">
                      <div className="mis-spinner" />
                    </div>
                  ) : records.length === 0 ? (
                    <div className="mis-empty py-16 text-center">
                      No IPO Allocation records found matching criteria.
                    </div>
                  ) : (
                    <table className="mis-table">
                      <thead>
                        <tr>
                          <th>Application No</th>
                          <th>Client ID</th>
                          <th>Client Name</th>
                          <th>IPO Name</th>
                          <th>Category</th>
                          <th>Applied Qty</th>
                          <th>Allotted Qty</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => {
                          const getRowStyle = () => {
                            if (record.status === 'Refunded' && record.allotted_qty === 0) {
                              return { backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)' };
                            }
                            if (record.allotted_qty === record.applied_qty && record.applied_qty > 0) {
                              return { backgroundColor: 'var(--success-muted-bg)', color: 'var(--success-muted-text)' };
                            }
                            return undefined;
                          };

                          const getStatusBadge = (status: string) => {
                            if (status === 'Allotted') return <span className="mis-badge mis-badge-success">Allotted</span>;
                            if (status === 'Applied') return <span className="mis-badge mis-badge-neutral">Applied</span>;
                            if (status === 'Partially Allotted') return <span className="mis-badge mis-badge-warning">Partial</span>;
                            return (
                              <span 
                                className="mis-badge"
                                style={{ 
                                  color: 'var(--badge-danger-text)', 
                                  backgroundColor: 'var(--badge-danger-bg)', 
                                  borderColor: 'var(--badge-danger-border)' 
                                }}
                              >
                                Refunded
                              </span>
                            );
                          };

                          return (
                            <tr key={record.id} style={getRowStyle()}>
                              <td>
                                <span className="font-mono text-xs font-bold">{record.application_no}</span>
                              </td>
                              <td>
                                <span className="font-mono text-xs">{record.client_id}</span>
                              </td>
                              <td>
                                <span className="font-semibold">{record.client_name}</span>
                              </td>
                              <td>
                                <span className="font-semibold">{record.ipo_name}</span>
                              </td>
                              <td>
                                <span className="mis-badge mis-badge-neutral">{record.category}</span>
                              </td>
                              <td>
                                {record.applied_qty?.toLocaleString() || 0}
                              </td>
                              <td>
                                <span className="font-bold">{record.allotted_qty?.toLocaleString() || 0}</span>
                              </td>
                              <td>
                                {getStatusBadge(record.status)}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  onClick={() => setViewingRecord(record)}
                                  className="mis-btn mis-btn-ghost mis-btn-sm"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => handleEdit(record)}
                                  className="mis-btn mis-btn-ghost mis-btn-sm"
                                >
                                  Edit Row
                                </button>
                                <button
                                  onClick={() => handleDelete(record.id)}
                                  className="mis-btn mis-btn-ghost mis-btn-sm"
                                  style={{ color: '#ef4444', marginLeft: '0.5rem' }}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SHEET 4: CORPORATE ACTIONS SHEET */}
        {sheetTab === 'corporate_actions' && (
          <div>
            {activeTab === 'register' ? (
              /* Add/Edit Corporate Action Form + plain-English help panel */
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start max-w-6xl mx-auto">
              <div className="mis-card p-6">
                <h2 className="text-lg font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
                  {editingId ? '✏️ Edit Corporate Action' : '📋 Create New Corporate Action'}
                </h2>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="mis-field">
                      <label className="mis-label">Client ID</label>
                      <input
                        type="text"
                        value={formData.client_id || ''}
                        onChange={(e) => handleInputChange('client_id', e.target.value)}
                        placeholder="CLIENT-50931"
                        className="mis-input"
                        required
                      />
                    </div>
                    {renderClientNameField()}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="mis-field">
                      <label className="mis-label">Stock Symbol</label>
                      <input
                        type="text"
                        value={formData.stock_symbol || ''}
                        onChange={(e) => handleInputChange('stock_symbol', e.target.value.toUpperCase())}
                        placeholder="TCS"
                        className="mis-input"
                        required
                      />
                    </div>
                    <div className="mis-field">
                      <label className="mis-label">Corporate Action</label>
                      <select
                        value={formData.corporate_action || 'Dividend'}
                        onChange={(e) => handleInputChange('corporate_action', e.target.value)}
                        className="mis-select"
                        required
                      >
                        <option value="Dividend">Dividend</option>
                        <option value="Bonus">Bonus</option>
                        <option value="Stock Split">Stock Split</option>
                        <option value="Rights Issue">Rights Issue</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="mis-field">
                      <label className="mis-label">Record Date</label>
                      <input
                        type="date"
                        value={formData.record_date || ''}
                        onChange={(e) => handleInputChange('record_date', e.target.value)}
                        className="mis-input"
                        required
                      />
                    </div>

                    <div className="mis-field">
                      <label className="mis-label">Quantity Held</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.quantity || ''}
                        onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 0)}
                        placeholder="500"
                        className="mis-input"
                        required
                      />
                    </div>

                    <div className="mis-field">
                      <label className="mis-label">Eligible?</label>
                      <select
                        value={formData.eligible || 'Yes'}
                        onChange={(e) => {
                          const nextEligible = e.target.value as any;
                          let nextEntitlement = formData.entitlement_amt_qty;
                          if (nextEligible === 'No') {
                            nextEntitlement = 0;
                          }
                          setFormData((prev: any) => ({
                            ...prev,
                            eligible: nextEligible,
                            entitlement_amt_qty: nextEntitlement
                          }));
                        }}
                        className="mis-select"
                        required
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>

                    <div className="mis-field">
                      <label className={`mis-label ${formData.eligible === 'No' ? 'opacity-50' : ''}`}>
                        Entitlement Amt/Qty
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        disabled={formData.eligible === 'No'}
                        value={formData.entitlement_amt_qty}
                        onChange={(e) => handleInputChange('entitlement_amt_qty', parseFloat(e.target.value) || 0)}
                        placeholder="1250"
                        className={`mis-input ${formData.eligible === 'No' ? 'opacity-50 bg-slate-100 dark:bg-slate-900' : ''}`}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="mis-field">
                      <label className="mis-label">Branch Office</label>
                      <select
                        value={formData.branch_id || ''}
                        onChange={(e) => handleInputChange('branch_id', e.target.value)}
                        className="mis-select"
                        required
                        disabled={!hasMultiBranchAccess}
                      >
                        <option value="">-- Choose Branch --</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('list');
                        setEditingId(null);
                        setFormData({
                          ...INITIAL_CORP_STATE,
                          branch_id: userBranchId,
                        });
                        setClientSearchText('');
                      }}
                      className="mis-btn mis-btn-ghost text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="mis-btn mis-btn-primary text-sm px-6"
                    >
                      {loading ? 'Saving...' : editingId ? 'Update Row' : 'Add Row'}
                    </button>
                  </div>
                </form>
              </div>

              {renderHelpPanel()}
              </div>
            ) : (
              /* View Corporate Actions Sheet Grid */
              <div className="mis-card p-5">
                
                {/* Search & Filter Toolbar */}
                <div className="flex flex-col sm:flex-row gap-4 mb-5">
                  <div className="mis-field m-0 flex-1">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="🔍 Search by Client ID, Client Name, or Stock Symbol..."
                      className="mis-input"
                    />
                  </div>
                  <div className="mis-field m-0 w-full sm:w-48">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="mis-select"
                    >
                      <option value="">All Eligibility</option>
                      <option value="Yes">Eligible</option>
                      <option value="No">Not Eligible</option>
                    </select>
                  </div>
                  
                  {hasMultiBranchAccess && (
                    <div className="mis-field m-0 w-full sm:w-48">
                      <select
                        value={branchFilter}
                        onChange={(e) => setBranchFilter(e.target.value)}
                        className="mis-select"
                      >
                        <option value="">All Branches</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 mb-4">
                  <button
                    onClick={fetchRecords}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    🔄 Refresh Grid Data
                  </button>
                </div>

                {/* Corporate Actions Table Grid */}
                <div className="mis-table-wrap">
                  {fetching ? (
                    <div className="mis-loading-center py-16">
                      <div className="mis-spinner" />
                    </div>
                  ) : records.length === 0 ? (
                    <div className="mis-empty py-16 text-center">
                      No Corporate Action records found matching criteria.
                    </div>
                  ) : (
                    <table className="mis-table">
                      <thead>
                        <tr>
                          <th>Client ID</th>
                          <th>Client Name</th>
                          <th>Stock Symbol</th>
                          <th>Corporate Action</th>
                          <th>Record Date</th>
                          <th>Quantity Held</th>
                          <th>Eligible?</th>
                          <th>Entitlement Amt/Qty</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => {
                          const getRowStyle = () => {
                            if (record.eligible === 'No') {
                              return { backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)' };
                            }
                            if (record.eligible === 'Yes') {
                              return { backgroundColor: 'var(--success-muted-bg)', color: 'var(--success-muted-text)' };
                            }
                            return undefined;
                          };

                          const getEligibleBadge = (eligible: string) => {
                            if (eligible === 'Yes') return <span className="mis-badge mis-badge-success">Yes</span>;
                            return (
                              <span 
                                className="mis-badge"
                                style={{ 
                                  color: 'var(--badge-danger-text)', 
                                  backgroundColor: 'var(--badge-danger-bg)', 
                                  borderColor: 'var(--badge-danger-border)' 
                                }}
                              >
                                No
                              </span>
                            );
                          };

                          return (
                            <tr key={record.id} style={getRowStyle()}>
                              <td>
                                <span className="font-mono text-xs font-bold">{record.client_id}</span>
                              </td>
                              <td>
                                <span className="font-semibold">{record.client_name}</span>
                              </td>
                              <td>
                                <span className="font-bold text-teal-700 dark:text-teal-400">{record.stock_symbol}</span>
                              </td>
                              <td>
                                <span className="font-semibold">{record.corporate_action}</span>
                              </td>
                              <td>
                                {record.record_date ? format(new Date(record.record_date), 'dd-MM-yyyy') : '-'}
                              </td>
                              <td>
                                {record.quantity?.toLocaleString() || 0}
                              </td>
                              <td>
                                {getEligibleBadge(record.eligible)}
                              </td>
                              <td>
                                <span className="font-bold">
                                  {record.corporate_action === 'Dividend' ? '₹' : ''}
                                  {record.entitlement_amt_qty?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) || 0}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  onClick={() => setViewingRecord(record)}
                                  className="mis-btn mis-btn-ghost mis-btn-sm"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => handleEdit(record)}
                                  className="mis-btn mis-btn-ghost mis-btn-sm"
                                >
                                  Edit Row
                                </button>
                                <button
                                  onClick={() => handleDelete(record.id)}
                                  className="mis-btn mis-btn-ghost mis-btn-sm"
                                  style={{ color: '#ef4444', marginLeft: '0.5rem' }}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        cancelLabel={confirmModal.cancelLabel}
        isDanger={confirmModal.isDanger}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(INITIAL_CONFIRM_STATE)}
      />

      <ViewDetailsModal record={viewingRecord} onClose={() => setViewingRecord(null)} title="Settlements Record Details" />
    </DashboardLayout>
  );
};

export default SettlementsDataEntryPage;
