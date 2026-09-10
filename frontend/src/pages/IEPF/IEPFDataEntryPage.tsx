import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { iepfService } from '../../services/iepf.service';
import { orgService } from '../../services/org.service';
import ConfirmModal from '../../components/common/ConfirmModal';
import ViewDetailsModal from '../../components/common/ViewDetailsModal';
import CsvImportGuide from '../../components/common/CsvImportGuide';
import { validateCsvHeaders, containsSampleSentinel, type CsvHeaderValidation } from '../../utils/csvBulkImportHelpers';
import { INITIAL_CONFIRM_STATE, type ConfirmDialogState } from '../../types/confirm.types';

// Columns a bulk-import CSV must contain — mirrors createClaim's accepted
// fields (investor_name/pan_number/claim_date are required server-side;
// the rest are optional but still validated the same way a manual entry is).
const IEPF_BULK_FIELDS = [
  { key: 'investor_name', label: 'Investor Name' },
  { key: 'pan_number', label: 'PAN Number' },
  { key: 'claim_type', label: 'Claim Type (Dividend/Shares/Both)' },
  { key: 'claim_date', label: 'Claim Date (YYYY-MM-DD)' },
  { key: 'amount', label: 'Amount' },
  { key: 'num_shares', label: 'Number of Shares' },
  { key: 'client_id', label: 'Client ID (optional)' },
];

// Plain-English explanation shown next to the claim form, written for
// operations staff (not developers) — why this page exists and what each
// field means.
const IEPF_HELP = {
  why: 'When a company doesn\'t pay out dividends or transfer shares to an investor for 7 straight years, that unclaimed money and those shares are legally handed over to the government\'s Investor Education and Protection Fund (IEPF). The investor doesn\'t lose it — but getting it back means filing a formal claim with the company/RTA. This page is where we log and manage every client\'s claim through that process, from filing to final resolution.',
  fields: [
    { label: 'Claim Number', note: 'Auto-generated once the claim is submitted — a unique reference for this case, used in all future correspondence about it.' },
    { label: 'Investor Name', note: 'The investor\'s full legal name, exactly matching what\'s on record with the company/RTA and their PAN. A mismatch here can get the claim rejected.' },
    { label: 'PAN Card Number', note: 'The investor\'s PAN — used to verify identity and match against the company\'s and RTA\'s existing records.' },
    { label: 'Claim Type', note: 'Dividend Recovery, Shares Transfer, or Both — what the investor is actually reclaiming from IEPF.' },
    { label: 'Claim Date', note: 'When this claim was formally logged.' },
    { label: 'Amount', note: 'The dividend amount being reclaimed (shown only for Dividend or Both claim types).' },
    { label: 'Number of Shares', note: 'How many shares are being reclaimed (shown only for Shares or Both claim types).' },
    { label: 'Status', note: 'New = just logged. Under Verification = being checked. Documents Pending = something\'s missing from the investor. Approved / Rejected = decision made. Closed = fully resolved.' },
    { label: 'Expected Closure Date', note: 'A realistic estimate of when this claim should be resolved — helps set the right expectation with the investor.' },
    { label: 'Branch Office', note: 'Which branch is handling this claim.' },
    { label: 'Pending Reasons', note: 'Only shown when Status is Documents Pending — tick exactly what\'s missing (PAN mismatch, Aadhaar, signature, bank details, legal documents) so the investor knows precisely what to send in.' },
    { label: 'Closed Date / Amount Released / Shares Released / Resolution Remarks', note: 'Only shown when Status is Closed — the final outcome: when it closed, what was actually released, and notes on how it was resolved. This is the permanent record of the case.' },
  ],
  remember: 'Never mark a claim Closed without filling in Resolution Remarks and the actual Amount/Shares Released — this is the final record of what the investor received, and it\'s what gets checked if the claim is ever disputed later.',
};

const INITIAL_FORM_STATE = {
  claim_number: '',
  investor_name: '',
  pan_number: '',
  claim_type: 'Dividend',
  amount: 0,
  num_shares: 0,
  claim_date: format(new Date(), 'yyyy-MM-dd'),
  status: 'New',
  expected_closure_date: '',
  pending_reasons: [] as string[],
  closed_date: format(new Date(), 'yyyy-MM-dd'),
  resolution_remarks: '',
  amount_released: 0,
  shares_released: 0,
  branch_id: '',
};

interface VerifiedInvestor {
  id: string;
  applicant_name: string;
  pan: string;
  mobile_number?: string;
  email?: string;
}

const IEPFDataEntryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'register' | 'list'>('register');
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [claims, setClaims] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState<any>(null);

  // Bulk CSV import
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [csvValidation, setCsvValidation] = useState<CsvHeaderValidation | null>(null);
  const [csvHasSample, setCsvHasSample] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvImportErrors, setCsvImportErrors] = useState<{ row: number; error: string }[]>([]);

  // KYC verified investor lookup
  const [investors, setInvestors] = useState<VerifiedInvestor[]>([]);
  const [investorSearchText, setInvestorSearchText] = useState('');
  const [investorDropdownOpen, setInvestorDropdownOpen] = useState(false);

  // Search and Filter states
  const [statusFilter, setStatusFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [confirmModal, setConfirmModal] = useState<ConfirmDialogState>(INITIAL_CONFIRM_STATE);

  useEffect(() => {
    fetchMetadata();
    fetchInvestors();
  }, []);

  useEffect(() => {
    if (activeTab === 'list') {
      fetchClaims();
    }
  }, [activeTab, statusFilter, branchFilter]);

  const fetchMetadata = async () => {
    try {
      const branchData = await orgService.getBranches();
      setBranches(branchData || []);
    } catch (err) {
      console.error('Failed to load metadata:', err);
      toast.error('Failed to load branches list.');
    }
  };

  const fetchClaims = async () => {
    setFetching(true);
    try {
      const data = await iepfService.getClaims({
        status: statusFilter || undefined,
        branchId: branchFilter || undefined,
        search: searchTerm || undefined,
      });
      setClaims(data || []);
    } catch (err) {
      console.error('Failed to fetch claims:', err);
      toast.error('Failed to retrieve claims database.');
    } finally {
      setFetching(false);
    }
  };

  const handleInputChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const fetchInvestors = async () => {
    try {
      const data = await iepfService.getVerifiedInvestors();
      setInvestors(data || []);
    } catch (err) {
      console.error('Failed to load verified investors:', err);
    }
  };

  const filteredInvestors = investors.filter((inv) =>
    inv.applicant_name.toLowerCase().includes(investorSearchText.toLowerCase()) ||
    inv.pan.toLowerCase().includes(investorSearchText.toLowerCase())
  );

  const handleInvestorSelect = (investor: VerifiedInvestor) => {
    setInvestorSearchText(investor.applicant_name);
    setInvestorDropdownOpen(false);
    setFormData((prev) => ({
      ...prev,
      investor_name: investor.applicant_name,
      pan_number: investor.pan,
    }));
  };

  const handleCheckboxChange = (reason: string, checked: boolean) => {
    let currentReasons = [...formData.pending_reasons];
    if (reason === 'Other') {
      if (checked) {
        if (!currentReasons.some(r => r === 'Other' || r.startsWith('Other:'))) {
          currentReasons.push('Other');
        }
      } else {
        currentReasons = currentReasons.filter(r => r !== 'Other' && !r.startsWith('Other:'));
      }
    } else {
      if (checked) {
        if (!currentReasons.includes(reason)) {
          currentReasons.push(reason);
        }
      } else {
        const idx = currentReasons.indexOf(reason);
        if (idx > -1) {
          currentReasons.splice(idx, 1);
        }
      }
    }
    setFormData((prev) => ({
      ...prev,
      pending_reasons: currentReasons,
    }));
  };

  const getOtherReasonText = () => {
    const otherVal = formData.pending_reasons.find(r => r === 'Other' || r.startsWith('Other:')) || '';
    if (otherVal.startsWith('Other: ')) {
      return otherVal.substring(7); // strip "Other: "
    }
    return '';
  };

  const handleOtherReasonChange = (value: string) => {
    const currentReasons = [...formData.pending_reasons];
    const otherIdx = currentReasons.findIndex(r => r === 'Other' || r.startsWith('Other:'));
    const formattedReason = value.trim() ? `Other: ${value.trim()}` : 'Other';
    
    if (otherIdx > -1) {
      currentReasons[otherIdx] = formattedReason;
    } else {
      currentReasons.push(formattedReason);
    }
    
    setFormData((prev) => ({
      ...prev,
      pending_reasons: currentReasons,
    }));
  };

  const validateForm = () => {
    if (!formData.investor_name.trim()) return 'Investor Name is required.';
    
    // PAN Format validation
    const panClean = formData.pan_number.trim().toUpperCase();
    if (!panClean) return 'PAN Number is required.';
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(panClean)) {
      return 'Invalid PAN format. Must be 5 letters, 4 digits, and 1 letter (e.g. ABCDE1234F).';
    }

    if (!formData.claim_date) return 'Claim Date is required.';
    
    // Numeric boundaries
    if (['Dividend', 'Both'].includes(formData.claim_type) && Number(formData.amount) < 0) {
      return 'Amount cannot be negative.';
    }
    if (['Shares', 'Both'].includes(formData.claim_type) && Number(formData.num_shares) < 0) {
      return 'Number of shares cannot be negative.';
    }

    // Expected closure date integrity
    if (formData.expected_closure_date) {
      const claimD = new Date(formData.claim_date);
      const expectedD = new Date(formData.expected_closure_date);
      if (expectedD < claimD) {
        return 'Expected closure date cannot be prior to the claim date.';
      }
    }

    if (formData.status === 'Documents Pending') {
      if (formData.pending_reasons.length === 0) {
        return 'Please specify at least one pending reason.';
      }
      const hasOther = formData.pending_reasons.some(r => r === 'Other' || r.startsWith('Other:'));
      if (hasOther && !getOtherReasonText().trim()) {
        return 'Please specify the custom "Other" pending reason.';
      }
    }

    if (formData.status === 'Closed') {
      if (!formData.closed_date) return 'Closed Date is required.';
      if (!formData.resolution_remarks?.trim()) return 'Resolution Remarks are required.';

      const claimD = new Date(formData.claim_date);
      const closedD = new Date(formData.closed_date);
      if (closedD < claimD) {
        return 'Closed date cannot be before the claim date.';
      }
      if (closedD > new Date()) {
        return 'Closed date cannot be in the future.';
      }

      if (['Dividend', 'Both'].includes(formData.claim_type) && Number(formData.amount_released) < 0) {
        return 'Amount released cannot be negative.';
      }
      if (['Shares', 'Both'].includes(formData.claim_type) && Number(formData.shares_released) < 0) {
        return 'Shares released cannot be negative.';
      }
    }
    return null;
  };

  const handleSaveClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    const errorMsg = validateForm();
    if (errorMsg) {
      toast.error(errorMsg);
      return;
    }

    setLoading(true);
    const toastId = toast.loading(editingId ? 'Updating claim record...' : 'Registering new claim...');
    try {
      const payload = {
        ...formData,
        amount: Number(formData.amount) || 0,
        num_shares: Number(formData.num_shares) || 0,
        amount_released: formData.status === 'Closed' ? Number(formData.amount_released) || 0 : 0,
        shares_released: formData.status === 'Closed' ? Number(formData.shares_released) || 0 : 0,
        expected_closure_date: formData.expected_closure_date || null,
      };

      if (editingId) {
        await iepfService.updateClaim(editingId, payload);
        toast.success('Claim updated successfully!', { id: toastId });
        setEditingId(null);
        setActiveTab('list');
      } else {
        await iepfService.createClaim(payload);
        toast.success('Claim registered successfully!', { id: toastId });
        setFormData({
          ...INITIAL_FORM_STATE,
          branch_id: formData.branch_id, // preserve branch selection
        });
        setInvestorSearchText('');
      }
    } catch (err: any) {
      console.error(err);
      const message = err.response?.data?.message || err.message || 'Operation failed';
      toast.error(message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (claim: any) => {
    setEditingId(claim.id);
    setFormData({
      claim_number: claim.claim_number,
      investor_name: claim.investor_name,
      pan_number: claim.pan_number,
      claim_type: claim.claim_type,
      amount: claim.amount,
      num_shares: claim.num_shares,
      claim_date: claim.claim_date,
      status: claim.status,
      expected_closure_date: claim.expected_closure_date || '',
      pending_reasons: claim.pending_reasons || [],
      closed_date: claim.closed_date || format(new Date(), 'yyyy-MM-dd'),
      resolution_remarks: claim.resolution_remarks || '',
      amount_released: claim.amount_released || 0,
      shares_released: claim.shares_released || 0,
      branch_id: claim.branch_id || '',
    });
    setInvestorSearchText(claim.investor_name || '');
    setActiveTab('register');
    toast.success('Loaded claim data for editing.');
  };

  const handleDelete = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete IEPF Claim',
      message: 'Are you sure you want to delete this claim? This action cannot be undone.',
      confirmLabel: 'Delete Claim',
      cancelLabel: 'Cancel',
      isDanger: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          await iepfService.deleteClaim(id);
          toast.success('Claim deleted.');
          fetchClaims();
          setConfirmModal(INITIAL_CONFIRM_STATE);
        } catch (err: any) {
          toast.error(err.response?.data?.message || 'Delete operation failed.');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      }
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData(INITIAL_FORM_STATE);
    setInvestorSearchText('');
    setActiveTab('list');
  };

  const openCsvModal = () => {
    setCsvRows([]);
    setCsvValidation(null);
    setCsvHasSample(false);
    setCsvImportErrors([]);
    setCsvModalOpen(true);
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvImportErrors([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) {
        toast.error('The CSV file contains no records.');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const parsedRows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const rowObj: Record<string, string> = {};
        headers.forEach((h, index) => { rowObj[h] = values[index] || ''; });
        return rowObj;
      });

      // Reject the whole file if the header row doesn't exactly match the
      // required columns, or if it's the untouched example template.
      const validation = validateCsvHeaders(headers, IEPF_BULK_FIELDS);
      const hasSample = containsSampleSentinel(parsedRows.map(r => Object.values(r)));
      setCsvValidation(validation.valid ? null : validation);
      setCsvHasSample(hasSample);
      setCsvRows(validation.valid && !hasSample ? parsedRows : []);
    };
    reader.readAsText(file);
  };

  const handleCsvImportSubmit = async () => {
    if (csvRows.length === 0) {
      toast.error('Select a valid CSV file first.');
      return;
    }
    if (csvValidation || csvHasSample) {
      toast.error(csvHasSample ? "Can't import — this is the example file." : 'Fix the CSV column errors before importing.');
      return;
    }

    setCsvImporting(true);
    try {
      const records = csvRows.map(row => ({
        investor_name: row.investor_name,
        pan_number: row.pan_number,
        claim_type: row.claim_type || 'Dividend',
        claim_date: row.claim_date,
        amount: Number(row.amount) || 0,
        num_shares: Number(row.num_shares) || 0,
        client_id: row.client_id || undefined,
      }));

      const result = await iepfService.bulkImportClaims(records);
      const insertedCount = result.inserted?.length ?? 0;
      const failedRows: { row: number; error: string }[] = result.failed ?? [];
      setCsvImportErrors(failedRows);

      if (failedRows.length === 0) {
        toast.success(`Successfully imported ${insertedCount} claim${insertedCount === 1 ? '' : 's'}.`);
        setCsvModalOpen(false);
      } else if (insertedCount > 0) {
        toast.error(`Imported ${insertedCount} claim${insertedCount === 1 ? '' : 's'}, ${failedRows.length} row${failedRows.length === 1 ? '' : 's'} failed — see details below.`);
      } else {
        toast.error('No rows could be imported — see details below.');
      }

      if (insertedCount > 0) fetchClaims();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Bulk import failed.');
    } finally {
      setCsvImporting(false);
    }
  };

  // Plain-English "why are we collecting this" panel shown beside the claim form.
  const renderHelpPanel = () => (
    <div
      className="border rounded-xl p-5 shadow-xs space-y-4 lg:sticky lg:top-4"
      style={{ background: 'var(--panel-inset-soft)', borderColor: 'var(--border)' }}
    >
      <div>
        <h3 className="text-sm font-bold flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--text-primary)' }}>
          💡 Why this page exists
        </h3>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {IEPF_HELP.why}
        </p>
      </div>

      <hr style={{ borderColor: 'var(--border)' }} />

      <div>
        <h3 className="text-sm font-bold mb-2.5" style={{ color: 'var(--text-primary)' }}>
          📖 What each field means
        </h3>
        <div className="space-y-3">
          {IEPF_HELP.fields.map((f) => (
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
          {IEPF_HELP.remember}
        </p>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-5xl mx-auto">

        {/* ── Header ────────────────────────────────────────── */}
        <header className="mis-page-header-row mb-6">
          <div className="mis-page-header" style={{ marginBottom: 0 }}>
            <h1 className="mis-page-title">IEPF Claims Management</h1>
            <p className="mis-page-desc">
              Log claim files, update status steps, and handle resolutions.
            </p>
          </div>
          
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={openCsvModal}
              className="px-3.5 py-1.5 border rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 h-[34px]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              📤 Bulk Import CSV
            </button>
            <div className="mis-tabs">
            <button
              type="button"
              onClick={() => {
                if (editingId) {
                  setConfirmModal({
                    isOpen: true,
                    title: 'Discard Changes',
                    message: 'Are you sure you want to discard your edits and register a new claim?',
                    confirmLabel: 'Discard',
                    cancelLabel: 'Keep Editing',
                    isDanger: true,
                    onConfirm: () => {
                      setEditingId(null);
                      setFormData(INITIAL_FORM_STATE);
                      setInvestorSearchText('');
                      setActiveTab('register');
                      setConfirmModal(INITIAL_CONFIRM_STATE);
                    }
                  });
                } else {
                  setActiveTab('register');
                }
              }}
              className={`mis-tab ${activeTab === 'register' ? 'active' : ''}`}
            >
              {editingId ? '✏️ Edit Claim' : 'Register Claim'}
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

        {/* ── Form Section + plain-English help panel ─────────── */}
        {activeTab === 'register' && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
          <form onSubmit={handleSaveClaim} className="space-y-6">

            {/* SECTION 1: CLAIM INFORMATION */}
            <div className="mis-card p-6 sm:p-8">
              <div className="border-b pb-3 mb-5" style={{ borderColor: 'var(--border)' }}>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Section 1: Claim Information</h2>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Identify investor details and primary claiming metrics.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="mis-field">
                  <label className="mis-label">Claim Number</label>
                  <input
                    type="text"
                    className="mis-input disabled:opacity-75 disabled:bg-gray-800 disabled:cursor-not-allowed font-semibold text-cyan-400"
                    value={editingId ? formData.claim_number : 'Auto-generated on submit (e.g. iepf20260001)'}
                    disabled
                  />
                </div>
                <div className="mis-field relative sm:col-span-2">
                  <label className="mis-label">Search KYC Verified Investor *</label>
                  <input
                    type="text"
                    placeholder="Type investor name or PAN to search..."
                    className="mis-input"
                    value={investorSearchText}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInvestorSearchText(val);
                      setInvestorDropdownOpen(true);
                      // Allow free typing to still land in the form fields if the
                      // investor isn't found in the verified list.
                      handleInputChange('investor_name', val);
                    }}
                    onFocus={() => setInvestorDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setInvestorDropdownOpen(false), 150)}
                  />
                  {investorDropdownOpen && filteredInvestors.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 max-h-56 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-lg">
                      {filteredInvestors.map((inv) => (
                        <div
                          key={inv.id}
                          onMouseDown={() => handleInvestorSelect(inv)}
                          className="px-4 py-2 hover:bg-slate-700 cursor-pointer text-xs flex justify-between items-center text-slate-200"
                        >
                          <span className="font-semibold">{inv.applicant_name}</span>
                          <span className="text-slate-400 text-[10px]">{inv.pan}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[10.5px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Select a KYC verified investor to auto-fill name and PAN, or type a name/PAN manually if not found.
                  </p>
                </div>
                <div className="mis-field">
                  <label className="mis-label">Investor Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Ravi Kumar"
                    className="mis-input"
                    value={formData.investor_name}
                    onChange={(e) => {
                      handleInputChange('investor_name', e.target.value);
                      setInvestorSearchText(e.target.value);
                    }}
                  />
                </div>
                <div className="mis-field">
                  <label className="mis-label">PAN Number *</label>
                  <input
                    type="text"
                    placeholder="10 digit PAN"
                    maxLength={10}
                    className="mis-input uppercase"
                    value={formData.pan_number}
                    onChange={(e) => handleInputChange('pan_number', e.target.value)}
                  />
                </div>
                <div className="mis-field">
                  <label className="mis-label">Claim Type</label>
                  <select
                    className="mis-select"
                    value={formData.claim_type}
                    onChange={(e) => handleInputChange('claim_type', e.target.value)}
                  >
                    <option value="Dividend">Dividend Recovery</option>
                    <option value="Shares">Shares Transfer</option>
                    <option value="Both">Both (Dividend + Shares)</option>
                  </select>
                </div>
                <div className="mis-field">
                  <label className="mis-label">Claim Date *</label>
                  <input
                    type="date"
                    className="mis-input"
                    value={formData.claim_date}
                    onChange={(e) => handleInputChange('claim_date', e.target.value)}
                  />
                </div>
                {['Dividend', 'Both'].includes(formData.claim_type) && (
                  <div className="mis-field">
                    <label className="mis-label">Amount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="₹ Value"
                      className="mis-input"
                      value={formData.amount || ''}
                      onChange={(e) => handleInputChange('amount', e.target.value)}
                    />
                  </div>
                )}
                {['Shares', 'Both'].includes(formData.claim_type) && (
                  <div className="mis-field">
                    <label className="mis-label">Number of Shares</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Qty"
                      className="mis-input"
                      value={formData.num_shares || ''}
                      onChange={(e) => handleInputChange('num_shares', e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 2: STATUS & ASSIGNMENT */}
            <div className="mis-card p-6 sm:p-8">
              <div className="border-b pb-3 mb-5" style={{ borderColor: 'var(--border)' }}>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Section 2: Status & Assignment</h2>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Track progress and assign branch offices.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="mis-field">
                  <label className="mis-label">Status</label>
                  <select
                    className="mis-select"
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                  >
                    <option value="New">New</option>
                    <option value="Under Verification">Under Verification</option>
                    <option value="Documents Pending">Documents Pending (Pending)</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
                <div className="mis-field">
                  <label className="mis-label">Expected Closure Date</label>
                  <input
                    type="date"
                    className="mis-input"
                    value={formData.expected_closure_date}
                    onChange={(e) => handleInputChange('expected_closure_date', e.target.value)}
                  />
                </div>
                <div className="mis-field">
                  <label className="mis-label">Branch Office</label>
                  <select
                    className="mis-select"
                    value={formData.branch_id}
                    onChange={(e) => handleInputChange('branch_id', e.target.value)}
                  >
                    <option value="">— Use default branch —</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION 3: PENDING REASONS (CONDITIONAL) */}
            {formData.status === 'Documents Pending' && (
              <div className="mis-card p-6 sm:p-8 border-l-4 border-yellow-500 mis-animate-in">
                <div className="border-b pb-3 mb-5" style={{ borderColor: 'var(--border)' }}>
                  <h2 className="text-lg font-bold text-yellow-500">Section 3: Pending Reasons</h2>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Identify which documents/validations are causing the file hold.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    'PAN Mismatch',
                    'Aadhaar Missing',
                    'Signature Mismatch',
                    'Bank Details Missing',
                    'Legal Documents Missing',
                    'Other',
                  ].map((reason) => {
                    const isChecked = reason === 'Other'
                      ? formData.pending_reasons.some(r => r === 'Other' || r.startsWith('Other:'))
                      : formData.pending_reasons.includes(reason);
                    return (
                      <label
                        key={reason}
                        className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] border cursor-pointer hover:bg-[var(--bg-hover)] transition-all"
                        style={{
                          borderColor: isChecked ? 'var(--border-accent)' : 'var(--border)',
                          background: isChecked ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-amber-500"
                          checked={isChecked}
                          onChange={(e) => handleCheckboxChange(reason, e.target.checked)}
                        />
                        <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                          {reason}
                        </span>
                      </label>
                    );
                  })}
                </div>

                {formData.pending_reasons.some(r => r === 'Other' || r.startsWith('Other:')) && (
                  <div className="mis-field mt-5 mis-animate-in">
                    <label className="mis-label">Specify Other Pending Reason *</label>
                    <input
                      type="text"
                      placeholder="e.g. Nominee documentation or stamp missing"
                      className="mis-input"
                      value={getOtherReasonText()}
                      onChange={(e) => handleOtherReasonChange(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* SECTION 4: CLOSURE DETAILS (CONDITIONAL) */}
            {formData.status === 'Closed' && (
              <div className="mis-card p-6 sm:p-8 border-l-4 border-emerald-500 mis-animate-in">
                <div className="border-b pb-3 mb-5" style={{ borderColor: 'var(--border)' }}>
                  <h2 className="text-lg font-bold text-emerald-500">Section 4: Closure Details</h2>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Specify resolution metrics achieved upon successful retrieval.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="mis-field">
                    <label className="mis-label">Closed Date *</label>
                    <input
                      type="date"
                      className="mis-input"
                      value={formData.closed_date}
                      onChange={(e) => handleInputChange('closed_date', e.target.value)}
                    />
                  </div>
                  {['Dividend', 'Both'].includes(formData.claim_type) && (
                    <div className="mis-field">
                      <label className="mis-label">Amount Released (₹)</label>
                      <input
                        type="number"
                        min="0"
                        className="mis-input"
                        value={formData.amount_released || ''}
                        onChange={(e) => handleInputChange('amount_released', e.target.value)}
                      />
                    </div>
                  )}
                  {['Shares', 'Both'].includes(formData.claim_type) && (
                    <div className="mis-field">
                      <label className="mis-label">Shares Released</label>
                      <input
                        type="number"
                        min="0"
                        className="mis-input"
                        value={formData.shares_released || ''}
                        onChange={(e) => handleInputChange('shares_released', e.target.value)}
                      />
                    </div>
                  )}
                  <div className="mis-field sm:col-span-2">
                    <label className="mis-label">Resolution Remarks *</label>
                    <textarea
                      placeholder="e.g. Dividend transfer approved by IEPF authority; funds credited to investor bank account."
                      rows={3}
                      className="mis-input py-2"
                      value={formData.resolution_remarks}
                      onChange={(e) => handleInputChange('resolution_remarks', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex justify-end gap-3 pt-3">
              {editingId ? (
                <>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="mis-btn mis-btn-ghost"
                  >
                    Cancel Edit
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="mis-btn mis-btn-primary"
                  >
                    {loading ? 'Updating claim...' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="mis-btn mis-btn-primary px-8"
                >
                  {loading ? 'Submitting...' : 'Register Claim'}
                </button>
              )}
            </div>

          </form>

          {renderHelpPanel()}
          </div>
        )}

        {/* ── List Section ───────────────────────────────────── */}
        {activeTab === 'list' && (
          <div className="space-y-4">
            
            {/* Filter controls */}
            <div className="mis-card p-4 flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[12rem] mis-field mb-0">
                <label className="mis-label" style={{ fontSize: '0.65rem' }}>Search Claims</label>
                <input
                  type="text"
                  placeholder="No, Name, PAN..."
                  className="mis-input py-2"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchClaims()}
                />
              </div>

              <div className="w-[10rem] mis-field mb-0">
                <label className="mis-label" style={{ fontSize: '0.65rem' }}>Status</label>
                <select
                  className="mis-select py-2"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="New">New</option>
                  <option value="Under Verification">Under Verification</option>
                  <option value="Documents Pending">Documents Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              <div className="w-[10rem] mis-field mb-0">
                <label className="mis-label" style={{ fontSize: '0.65rem' }}>Branch</label>
                <select
                  className="mis-select py-2"
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                >
                  <option value="">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={fetchClaims}
                className="mis-btn mis-btn-primary py-2 px-5"
                disabled={fetching}
              >
                Search
              </button>
            </div>

            {/* Claims Table */}
            <div className="mis-table-wrap">
              {fetching ? (
                <div className="mis-loading-center py-16">
                  <div className="mis-spinner" />
                </div>
              ) : claims.length === 0 ? (
                <div className="mis-empty py-16">No IEPF claim records found matching criteria.</div>
              ) : (
                <table className="mis-table">
                  <thead>
                    <tr>
                      <th>Claim ID / Date</th>
                      <th>Investor Name</th>
                      <th>Type / Amount</th>
                      <th>Branch / Creator</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claims.map((claim) => {
                      return (
                        <tr key={claim.id}>
                          <td>
                            <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{claim.claim_number}</div>
                            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                              Date: {claim.claim_date}
                            </div>
                          </td>
                          <td>
                            <div className="font-semibold">{claim.investor_name}</div>
                            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                              PAN: {claim.pan_number}
                            </div>
                          </td>
                          <td>
                            <span className="mis-badge mis-badge-neutral">{claim.claim_type}</span>
                            <div className="font-semibold mt-1" style={{ color: 'var(--text-accent)' }}>
                              {claim.amount > 0 ? `₹${claim.amount.toLocaleString()}` : ''}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                              {claim.num_shares > 0 ? `${claim.num_shares} Shares` : ''}
                            </div>
                          </td>
                          <td>
                            <div className="text-sm font-semibold">{claim.branches?.name || 'Global'}</div>
                            <div className="text-xs text-[#06b6d4]">
                              {claim.profiles?.full_name || claim.profiles?.email || 'System'}
                            </div>
                          </td>
                          <td>
                            {claim.status === 'Closed' && (
                              <span className="mis-badge mis-badge-success">Closed</span>
                            )}
                            {claim.status === 'Documents Pending' && (
                              <span className="mis-badge mis-badge-warning">Pending</span>
                            )}
                            {claim.status === 'Rejected' && (
                              <span className="mis-badge mis-badge-danger">Rejected</span>
                            )}
                            {!['Closed', 'Documents Pending', 'Rejected'].includes(claim.status) && (
                              <span className="mis-badge mis-badge-info">{claim.status}</span>
                            )}

                            {claim.status === 'Documents Pending' && claim.pending_reasons?.length > 0 && (
                              <div className="text-xs mt-1 max-w-[10rem] truncate" title={claim.pending_reasons.join(', ')} style={{ color: '#fbbf24' }}>
                                Reason: {claim.pending_reasons.join(', ')}
                              </div>
                            )}
                          </td>
                          <td>
                            <div className="flex gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() => setViewingRecord(claim)}
                                className="mis-btn mis-btn-ghost mis-btn-sm"
                              >
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEdit(claim)}
                                className="mis-btn mis-btn-ghost mis-btn-sm"
                              >
                                Edit / Resolve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(claim.id)}
                                className="mis-btn mis-btn-ghost mis-btn-sm"
                                style={{ color: '#ef4444' }}
                              >
                                Delete
                              </button>
                            </div>
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

      <ViewDetailsModal record={viewingRecord} onClose={() => setViewingRecord(null)} title="IEPF Claim Details" />

      {/* Bulk Import CSV Modal */}
      {csvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl p-6 rounded-xl border max-h-[85vh] overflow-y-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>📤 Bulk Import Claims</h3>
              <button type="button" className="mis-icon-btn" onClick={() => setCsvModalOpen(false)} aria-label="Close">✕</button>
            </div>

            <div className="space-y-4">
              <CsvImportGuide
                fields={IEPF_BULK_FIELDS}
                templateFilename="iepf-claims-template.csv"
                missing={csvValidation?.missing}
                extra={csvValidation?.extra}
                sampleFileDetected={csvHasSample}
              />

              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-primary)' }}>
                  Select CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvFileChange}
                  className="block w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-teal-600 file:text-white hover:file:bg-teal-700 cursor-pointer"
                  style={{ color: 'var(--text-secondary)' }}
                />
              </div>

              {csvRows.length > 0 && !csvValidation && !csvHasSample && (
                <div>
                  <span className="text-[11px] font-bold uppercase" style={{ color: 'var(--accent)' }}>
                    Preview (First 3 Rows) — {csvRows.length} record{csvRows.length === 1 ? '' : 's'} detected
                  </span>
                  <div className="overflow-x-auto border rounded-lg mt-1" style={{ borderColor: 'var(--border)' }}>
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                          {IEPF_BULK_FIELDS.map(f => (
                            <th key={f.key} className="p-2 font-bold whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{f.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvRows.slice(0, 3).map((row, idx) => (
                          <tr key={idx} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                            {IEPF_BULK_FIELDS.map(f => (
                              <td key={f.key} className="p-2 truncate max-w-[140px]" style={{ color: 'var(--text-primary)' }}>{row[f.key] || '—'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {csvImportErrors.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2" style={{ color: '#ef4444' }}>
                    {csvImportErrors.length} Row{csvImportErrors.length === 1 ? '' : 's'} Failed
                  </h4>
                  <div className="max-h-[160px] overflow-y-auto border rounded-lg divide-y" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)' }}>
                    {csvImportErrors.map(fe => (
                      <div key={fe.row} className="px-3 py-2 text-xs">
                        <span className="font-semibold" style={{ color: '#ef4444' }}>Row {fe.row}:</span>{' '}
                        <span style={{ color: 'var(--text-secondary)' }}>{fe.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <button
                type="button"
                onClick={() => setCsvModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCsvImportSubmit}
                disabled={csvRows.length === 0 || csvImporting || !!csvValidation || csvHasSample}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors"
              >
                {csvImporting ? 'Importing...' : `🚀 Import ${csvRows.length > 0 ? `(${csvRows.length} Rows)` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default IEPFDataEntryPage;
