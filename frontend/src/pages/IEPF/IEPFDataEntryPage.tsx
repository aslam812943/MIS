import React, { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { format } from 'date-fns';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { iepfService } from '../../services/iepf.service';
import { orgService } from '../../services/org.service';
import ConfirmModal from '../../components/common/ConfirmModal';
import { INITIAL_CONFIRM_STATE, type ConfirmDialogState } from '../../types/confirm.types';

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

const IEPFDataEntryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'register' | 'list'>('register');
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [claims, setClaims] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Search and Filter states
  const [statusFilter, setStatusFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [confirmModal, setConfirmModal] = useState<ConfirmDialogState>(INITIAL_CONFIRM_STATE);

  useEffect(() => {
    fetchMetadata();
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
    setActiveTab('register');
    toast.success('Loaded claim data for editing.');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData(INITIAL_FORM_STATE);
    setActiveTab('list');
  };

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-5xl mx-auto">
        <Toaster position="top-right" />

        {/* ── Header ────────────────────────────────────────── */}
        <header className="mis-page-header-row mb-6">
          <div className="mis-page-header" style={{ marginBottom: 0 }}>
            <h1 className="mis-page-title">IEPF Claims Management</h1>
            <p className="mis-page-desc">
              Log claim files, update status steps, and handle resolutions.
            </p>
          </div>
          
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
        </header>

        {/* ── Form Section ───────────────────────────────────── */}
        {activeTab === 'register' && (
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
                <div className="mis-field">
                  <label className="mis-label">Investor Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Ravi Kumar"
                    className="mis-input"
                    value={formData.investor_name}
                    onChange={(e) => handleInputChange('investor_name', e.target.value)}
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
                            <div className="font-semibold text-white">{claim.claim_number}</div>
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
                                onClick={() => handleEdit(claim)}
                                className="mis-btn mis-btn-ghost mis-btn-sm"
                              >
                                Edit / Resolve
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
    </DashboardLayout>
  );
};

export default IEPFDataEntryPage;
