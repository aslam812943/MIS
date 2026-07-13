import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { dpService } from '../../services/dp.service';
import { orgService } from '../../services/org.service';
import { authService } from '../../services/auth.service';

interface ClientType {
  id: string;
  applicant_name: string;
  pan: string;
  aadhaar_number: string;
  mobile_number: string;
  email: string;
  date_of_birth: string;
  address: string;
}

const SHEET_TABLE_MAPPING: { [key: string]: string } = {
  'new-accounts': 'dp_new_account',
  'ucc-updation': 'dp_ucc_updation',
  'modifications': 'dp_modification',
  'demat-executions': 'dp_demat_execution',
  'transfers-transmissions': 'dp_transfers_transmissions',
  'demat-rejections': 'dp_demat_rejection',
  'closures': 'dp_closure_execution',
  'dis-slips': 'dp_dis_slip_upload',
  'back-office-updates': 'dp_back_office_update',
  'eod-backups': 'dp_eod_backup',
  'amc-charges': 'dp_amc_charges',
  'monthly-statements': 'dp_monthly_statements',
  'audit-compliance': 'dp_audit_compliance',
  'client-queries': 'dp_client_queries'
};

const DPDataEntryPage: React.FC = () => {
  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const hasMultiBranchAccess = isAdmin || ['ceo', 'managing_director', 'director', 'executive', 'hod'].includes(currentUser?.role || '');
  const userBranchId = currentUser?.branch_id || '';

  // Active sheet tab
  const [sheetTab, setSheetTab] = useState('new-accounts');
  const [activeTab, setActiveTab] = useState<'list' | 'register'>('list');

  // UI state
  const [entries, setEntries] = useState<any[]>([]);
  const [clients, setClients] = useState<ClientType[]>([]);
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
  const [selectedClient, setSelectedClient] = useState<ClientType | null>(null);
  const [clientSearchText, setClientSearchText] = useState('');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});

  // CSV Import state
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [csvMappings, setCsvMappings] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchBranches();
    fetchClients();
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [sheetTab, branchFilter, searchTerm]);

  // Clean form state when tab changes
  useEffect(() => {
    setActiveTab('list');
    setEditingId(null);
    setSelectedClient(null);
    setClientSearchText('');
    setFormData({});
    setSelectedIds([]);
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

  const fetchClients = async () => {
    try {
      const data = await dpService.getVerifiedClients();
      setClients(data || []);
    } catch (err) {
      console.error('Failed to load verified clients', err);
    }
  };

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const filterBranch = hasMultiBranchAccess ? (branchFilter || undefined) : userBranchId;
      const data = await dpService.getEntries(sheetTab, {
        branchId: filterBranch,
        search: searchTerm || undefined
      });
      setEntries(data || []);
    } catch (err) {
      console.error('Failed to fetch entries', err);
      toast.error('Failed to retrieve sheet data.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to check if sheet requires a KYC Client lookup
  const isClientSheet = () => {
    return ![
      'back-office-updates',
      'eod-backups',
      'audit-compliance'
    ].includes(sheetTab);
  };

  // Populate client details from dropdown choice
  const handleClientSelect = (client: ClientType) => {
    setSelectedClient(client);
    setClientSearchText(client.applicant_name);
    setClientDropdownOpen(false);
    setFormData((prev: any) => ({
      ...prev,
      kyc_client_id: client.id
    }));
  };

  const validateForm = (): boolean => {
    // 1. Client check
    if (isClientSheet() && !formData.kyc_client_id) {
      toast.error('Please select a verified client first.');
      return false;
    }

    // 2. BO ID check (exactly 16 digits)
    const boIdFields = ['bo_id', 'from_bo_id', 'to_bo_id', 'bo_id_generated'];
    const boIdRegex = /^\d{16}$/;
    for (const field of boIdFields) {
      const val = formData[field];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        if (!boIdRegex.test(String(val).trim())) {
          toast.error(`${field.replace(/_/g, ' ').toUpperCase()} must be exactly a 16-digit numeric BO ID.`);
          return false;
        }
      }
    }

    // 3. ISIN Code check (starts with 2 characters, total 12 alphanumeric)
    if (formData.isin !== undefined && formData.isin !== null && String(formData.isin).trim() !== '') {
      const isinRegex = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
      if (!isinRegex.test(String(formData.isin).trim().toUpperCase())) {
        toast.error('Invalid ISIN format. Must be a 12-character code starting with 2 letters (e.g. IN1234567890).');
        return false;
      }
    }

    // 4. Positive numbers check
    const numberFields = ['quantity', 'amc_amount', 'gst_amount', 'total_amount', 'file_size_kb'];
    for (const field of numberFields) {
      const val = formData[field];
      if (val !== undefined && val !== null && val !== '') {
        if (isNaN(Number(val)) || Number(val) < 0) {
          toast.error(`${field.replace(/_/g, ' ').toUpperCase()} must be a positive number.`);
          return false;
        }
      }
    }

    // 5. Valid date check
    const dateFields = [
      'verification_date', 'uploaded_to_cdsl_date', 'upload_date', 'confirmation_date',
      'request_date', 'processed_date', 'sent_to_rta_date', 'execution_date',
      'rejection_date', 'resubmission_date', 'closure_date', 'backup_date',
      'debit_date', 'generated_date', 'resolution_date'
    ];
    for (const field of dateFields) {
      const val = formData[field];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        if (isNaN(Date.parse(val))) {
          toast.error(`Please select a valid date for ${field.replace(/_/g, ' ').toUpperCase()}.`);
          return false;
        }
      }
    }

    return true;
  };

  // CRUD actions
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        await dpService.updateEntry(sheetTab, editingId, formData);
        toast.success('Record updated successfully.');
      } else {
        await dpService.createEntry(sheetTab, formData);
        toast.success('Record created successfully.');
      }
      fetchEntries();
      setActiveTab('list');
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (row: any) => {
    setEditingId(row.id);
    if (isClientSheet() && row.kyc_new_account) {
      const cl = row.kyc_new_account;
      setSelectedClient({
        id: row.kyc_client_id,
        applicant_name: cl.applicant_name,
        pan: cl.pan,
        aadhaar_number: cl.aadhaar_number,
        mobile_number: cl.mobile_number,
        email: cl.email,
        date_of_birth: cl.date_of_birth,
        address: cl.address
      });
      setClientSearchText(cl.applicant_name);
    }
    const cleanRow = { ...row };
    delete cleanRow.kyc_new_account;
    setFormData(cleanRow);
    setActiveTab('register');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      await dpService.deleteEntry(sheetTab, id);
      toast.success('Record deleted.');
      fetchEntries();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete record.');
    }
  };

  // Row Selection logic
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(entries.map(e => e.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  };

  const handleBatchStatusApply = async () => {
    if (selectedIds.length === 0 || !batchStatus) return;
    try {
      await dpService.bulkUpdate(sheetTab, selectedIds, { status: batchStatus });
      toast.success(`Batch updated ${selectedIds.length} records successfully.`);
      setSelectedIds([]);
      setBatchStatus('');
      fetchEntries();
    } catch (err) {
      console.error(err);
      toast.error('Failed to apply batch status.');
    }
  };

  // CSV Import handling
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      if (lines.length === 0) return;

      const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
      setCsvHeaders(headers);

      const rowsData = lines.slice(1).map(line => {
        const columns = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            columns.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        columns.push(current.trim());
        return columns.map(col => col.replace(/^"|"$/g, '').trim());
      });

      setCsvRows(rowsData);

      // Auto match mappings
      const initialMappings: { [key: string]: string } = {};
      const fields = getFormFields();
      fields.forEach(field => {
        const match = headers.find(h => h.toLowerCase().replace(/[^a-z0-9]/g, '') === field.key.toLowerCase().replace(/[^a-z0-9]/g, ''));
        if (match) initialMappings[field.key] = match;
      });
      setCsvMappings(initialMappings);
    };
    reader.readAsText(file);
  };

  const handleCsvImportSubmit = async () => {
    if (csvRows.length === 0) {
      toast.error('No rows to import.');
      return;
    }

    try {
      const recordsToImport = csvRows.map(row => {
        const record: any = {};
        Object.entries(csvMappings).forEach(([dbKey, csvHeader]) => {
          const csvIdx = csvHeaders.indexOf(csvHeader);
          if (csvIdx !== -1) {
            let val: any = row[csvIdx];
            // Format validations
            const fields = getFormFields();
            const matchingField = fields.find(f => f.key === dbKey);
            if (matchingField?.type === 'checkbox') {
              val = ['true', 'yes', '1', 'checked'].includes(String(val).toLowerCase());
            } else if (matchingField?.type === 'number') {
              val = val ? Number(val) : 0;
            }
            record[dbKey] = val;
          }
        });
        return record;
      });

      await dpService.bulkImport(sheetTab, recordsToImport);
      toast.success('Successfully imported CSV records!');
      setCsvModalOpen(false);
      fetchEntries();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'CSV Import failed.');
    }
  };

  // Dynamic form configuration based on active sheet tab
  const getFormFields = (): Array<{ key: string; label: string; type: 'text' | 'date' | 'checkbox' | 'select' | 'number'; options?: string[] }> => {
    switch (sheetTab) {
      case 'new-accounts':
        return [
          { key: 'pan_copy', label: 'PAN Card Copy Submitted', type: 'checkbox' },
          { key: 'aadhaar_copy', label: 'Aadhaar Card Copy Submitted', type: 'checkbox' },
          { key: 'bank_proof', label: 'Bank Proof Submitted', type: 'checkbox' },
          { key: 'photograph', label: 'Photograph Attached', type: 'checkbox' },
          { key: 'signature', label: 'Signature Verified', type: 'checkbox' },
          { key: 'verified_by', label: 'Verified By Staff Name', type: 'text' },
          { key: 'verification_date', label: 'Verification Date', type: 'date' },
          { key: 'uploaded_to_cdsl_date', label: 'Uploaded to CDSL Date', type: 'date' },
          { key: 'bo_id_generated', label: 'BO ID Generated (16 digit)', type: 'text' },
          { key: 'status', label: 'Status', type: 'select', options: ['Pending', 'Uploaded', 'Completed', 'Rejected'] },
          { key: 'remarks', label: 'Remarks', type: 'text' }
        ];
      case 'ucc-updation':
        return [
          { key: 'exchange', label: 'Exchange Name', type: 'select', options: ['NSE', 'BSE'] },
          { key: 'segment', label: 'Trading Segment', type: 'select', options: ['Cash', 'F&O', 'Currency', 'Commodity'] },
          { key: 'upload_date', label: 'Upload Date to Exchange', type: 'date' },
          { key: 'confirmation_date', label: 'Exchange Confirmation Date', type: 'date' },
          { key: 'status', label: 'Registration Status', type: 'select', options: ['Pending', 'Uploaded', 'Confirmed', 'Rejected'] }
        ];
      case 'modifications':
        return [
          { key: 'bo_id', label: 'BO ID (Demat Number)', type: 'text' },
          { key: 'modification_type', label: 'Modification Type', type: 'select', options: ['Address', 'Mobile', 'Email', 'Bank Details', 'Nominee', 'Signature', 'Other'] },
          { key: 'old_value', label: 'Previous Registered Value', type: 'text' },
          { key: 'new_value', label: 'New Requested Value', type: 'text' },
          { key: 'request_date', label: 'Request Date', type: 'date' },
          { key: 'processed_date', label: 'Processed Date', type: 'date' },
          { key: 'status', label: 'Status', type: 'select', options: ['Pending', 'Processed', 'Rejected'] }
        ];
      case 'demat-executions':
        return [
          { key: 'bo_id', label: 'Client BO ID', type: 'text' },
          { key: 'drf_number', label: 'DRF Request Number', type: 'text' },
          { key: 'isin', label: 'Share ISIN Code', type: 'text' },
          { key: 'company_name', label: 'Company Name', type: 'text' },
          { key: 'certificate_number', label: 'Certificate Number', type: 'text' },
          { key: 'folio_number', label: 'Folio Number', type: 'text' },
          { key: 'quantity', label: 'Shares Quantity', type: 'number' },
          { key: 'rta_name', label: 'RTA Name', type: 'text' },
          { key: 'sent_to_rta_date', label: 'Date Sent to RTA', type: 'date' },
          { key: 'status', label: 'Status', type: 'select', options: ['Sent to RTA', 'Confirmed', 'Rejected', 'Resubmitted', 'Closed'] }
        ];
      case 'transfers-transmissions':
        return [
          { key: 'type', label: 'Type', type: 'select', options: ['Transfer', 'Transmission'] },
          { key: 'from_bo_id', label: 'Sender BO ID', type: 'text' },
          { key: 'to_bo_id', label: 'Receiver BO ID', type: 'text' },
          { key: 'isin', label: 'Share ISIN', type: 'text' },
          { key: 'quantity', label: 'Transfer Quantity', type: 'number' },
          { key: 'supporting_documents', label: 'Documents Checklist/Info', type: 'text' },
          { key: 'request_date', label: 'Request Date', type: 'date' },
          { key: 'execution_date', label: 'Execution Date', type: 'date' },
          { key: 'status', label: 'Status', type: 'select', options: ['Pending', 'Executed', 'Rejected'] }
        ];
      case 'demat-rejections':
        return [
          { key: 'drf_number', label: 'DRF Number', type: 'text' },
          { key: 'rejection_reason', label: 'RTA Rejection Reason', type: 'text' },
          { key: 'rejection_date', label: 'Rejection Date', type: 'date' },
          { key: 'corrective_action', label: 'Corrective Action Taken', type: 'text' },
          { key: 'resubmission_date', label: 'Resubmitted to RTA Date', type: 'date' },
          { key: 'status', label: 'Status', type: 'select', options: ['Pending', 'Resolved'] }
        ];
      case 'closures':
        return [
          { key: 'bo_id', label: 'Client BO ID', type: 'text' },
          { key: 'reason', label: 'Closure Reason', type: 'text' },
          { key: 'holdings_check_status', label: 'Holdings Check Status', type: 'select', options: ['Clean', 'Pending Obligations', 'Shares Present'] },
          { key: 'request_date', label: 'Request Date', type: 'date' },
          { key: 'closure_date', label: 'Closure Execution Date', type: 'date' },
          { key: 'status', label: 'Status', type: 'select', options: ['Requested', 'Approved', 'Closed', 'Rejected'] }
        ];
      case 'dis-slips':
        return [
          { key: 'bo_id', label: 'Client BO ID', type: 'text' },
          { key: 'dis_slip_number', label: 'DIS Slip Reference Number', type: 'text' },
          { key: 'isin', label: 'Share ISIN', type: 'text' },
          { key: 'quantity', label: 'Quantity Transferred', type: 'number' },
          { key: 'execution_date', label: 'Execution Date', type: 'date' },
          { key: 'scan_upload_status', label: 'CDAS Scan Upload Status', type: 'select', options: ['Pending', 'Uploaded', 'Failed'] },
          { key: 'uploaded_by', label: 'Uploaded By Staff Name', type: 'text' },
          { key: 'upload_date', label: 'Upload Date to CDAS', type: 'date' }
        ];
      case 'back-office-updates':
        return [
          { key: 'file_type', label: 'File Type', type: 'select', options: ['Trade File', 'Holdings File', 'Ledger File', 'Other'] },
          { key: 'run_date', label: 'Run Date', type: 'date' },
          { key: 'performed_by', label: 'Performed By Staff Name', type: 'text' },
          { key: 'status', label: 'Execution Status', type: 'select', options: ['Success', 'Failed'] },
          { key: 'remarks', label: 'Remarks', type: 'text' }
        ];
      case 'eod-backups':
        return [
          { key: 'backup_date', label: 'Backup Target Date', type: 'date' },
          { key: 'backup_type', label: 'Backup Type', type: 'select', options: ['Full', 'Incremental'] },
          { key: 'file_size_kb', label: 'Backup File Size (KB)', type: 'number' },
          { key: 'verified_by', label: 'Verified By Staff Name', type: 'text' },
          { key: 'status', label: 'Status', type: 'select', options: ['Success', 'Failed', 'Verified'] }
        ];
      case 'amc-charges':
        return [
          { key: 'bo_id', label: 'Client BO ID', type: 'text' },
          { key: 'billing_month', label: 'Billing Month (e.g. July 2026)', type: 'text' },
          { key: 'amc_amount', label: 'AMC Charge Amount', type: 'number' },
          { key: 'gst_amount', label: 'GST Amount (18%)', type: 'number' },
          { key: 'total_amount', label: 'Total Debited Amount', type: 'number' },
          { key: 'debit_date', label: 'Debit Execution Date', type: 'date' },
          { key: 'status', label: 'Billing Status', type: 'select', options: ['Pending', 'Debited', 'Waived', 'Failed'] }
        ];
      case 'monthly-statements':
        return [
          { key: 'bo_id', label: 'Client BO ID', type: 'text' },
          { key: 'statement_period', label: 'Period (e.g. June 2026)', type: 'text' },
          { key: 'generated_date', label: 'Generation Date', type: 'date' },
          { key: 'dispatch_mode', label: 'Dispatch Method', type: 'select', options: ['Email', 'Post', 'Both'] },
          { key: 'dispatch_status', label: 'Delivery Status', type: 'select', options: ['Sent', 'Bounced', 'Pending'] }
        ];
      case 'audit-compliance':
        return [
          { key: 'audit_type', label: 'Audit / Inspection Type', type: 'select', options: ['Internal', 'CDSL Inspection', 'SEBI'] },
          { key: 'audit_period', label: 'Audit Target Period (e.g. FY 2025-26)', type: 'text' },
          { key: 'auditor_name', label: 'Auditor Name', type: 'text' },
          { key: 'finding_description', label: 'Compliance Deviation / Finding', type: 'text' },
          { key: 'action_taken', label: 'Remediation Action Taken', type: 'text' },
          { key: 'status', label: 'Closure Status', type: 'select', options: ['Open', 'Action Pending', 'Closed'] },
          { key: 'closure_date', label: 'Closure Date', type: 'date' }
        ];
      case 'client-queries':
        return [
          { key: 'query_type', label: 'Client Complaint / Query Type', type: 'select', options: ['Delayed Transfer', 'AMC Issue', 'Account Details', 'Document Status', 'Other'] },
          { key: 'description', label: 'Query Description', type: 'text' },
          { key: 'assigned_to', label: 'Assigned Executive Name', type: 'text' },
          { key: 'status', label: 'Ticket Status', type: 'select', options: ['Open', 'In Progress', 'Resolved', 'Escalated'] },
          { key: 'resolution_date', label: 'Resolution Date', type: 'date' }
        ];
      default:
        return [];
    }
  };

  const filteredClients = clients.filter(c =>
    c.applicant_name.toLowerCase().includes(clientSearchText.toLowerCase()) ||
    c.pan.toLowerCase().includes(clientSearchText.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-7xl mx-auto space-y-8">
        
        {/* Department Page Header */}
        <header className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2.5xl font-bold tracking-tight flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              📂 DP Department MIS Tracker
            </h1>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Log account creations, UCC allocations, transfers, DIS slip executions, statement runs, and audit remediations.
            </p>
          </div>
          
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setCsvModalOpen(true)}
              className="px-3.5 py-1.5 border rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 h-[34px]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              📤 Bulk Import CSV
            </button>
            <div className="mis-tabs">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className={`mis-tab ${activeTab === 'list' ? 'active' : ''}`}
              >
                📝 View Grid
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('register')}
                className={`mis-tab ${activeTab === 'register' ? 'active' : ''}`}
              >
                ➕ {editingId ? 'Edit' : 'Add Entry'}
              </button>
            </div>
          </div>
        </header>

        {/* 14 Sheet Tab Bar */}
        <div className="mis-module-tabs flex-wrap">
          {Object.keys(SHEET_TABLE_MAPPING).map(key => (
            <button
              key={key}
              type="button"
              onClick={() => setSheetTab(key)}
              className={`mis-module-tab ${sheetTab === key ? 'active' : ''}`}
            >
              📄 {key.replace(/-/g, ' ').toUpperCase()}
            </button>
          ))}
        </div>

        {activeTab === 'register' ? (
          /* Data Input Form Card */
          <div className="mis-card p-6 max-w-2xl mx-auto">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-1.5 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              📋 {editingId ? '✏️ Modify Record Row' : '➕ Create New Record Row'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-5 text-left">
              {/* KYC Client Lookup Dropdown (Only for associated sheets) */}
              {isClientSheet() && (
                <div className="relative space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Search KYC Verified Client *
                  </label>
                  <input
                    type="text"
                    placeholder="Type client name or PAN to search..."
                    value={clientSearchText}
                    onChange={(e) => {
                      setClientSearchText(e.target.value);
                      setClientDropdownOpen(true);
                    }}
                    onFocus={() => setClientDropdownOpen(true)}
                    className="mis-input w-full"
                    disabled={!!editingId}
                  />
                  {clientDropdownOpen && filteredClients.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 max-h-56 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-lg">
                      {filteredClients.map(c => (
                        <div
                          key={c.id}
                          onClick={() => handleClientSelect(c)}
                          className="px-4 py-2 hover:bg-slate-700 cursor-pointer text-xs flex justify-between items-center text-slate-200"
                        >
                          <span className="font-semibold">{c.applicant_name}</span>
                          <span className="text-slate-400 text-[10px]">{c.pan}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Auto-populated read-only client details */}
                  {selectedClient && (
                    <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 grid grid-cols-2 gap-3 text-xs mt-3">
                      <div>
                        <span className="text-slate-500 font-semibold block text-[10px] uppercase">Applicant Name</span>
                        <span className="text-slate-200 font-bold">{selectedClient.applicant_name}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block text-[10px] uppercase">PAN Number</span>
                        <span className="text-slate-200 font-bold">{selectedClient.pan}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block text-[10px] uppercase">Mobile Phone</span>
                        <span className="text-slate-200 font-bold">{selectedClient.mobile_number}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block text-[10px] uppercase">Email Address</span>
                        <span className="text-slate-200 font-bold">{selectedClient.email}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Dynamic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-4">
                {getFormFields().map(field => {
                  if (field.type === 'checkbox') {
                    return (
                      <div key={field.key} className="flex items-center gap-2.5 sm:col-span-2 py-1.5">
                        <input
                          type="checkbox"
                          id={field.key}
                          checked={!!formData[field.key]}
                          onChange={(e) => setFormData((prev: any) => ({ ...prev, [field.key]: e.target.checked }))}
                          className="h-4.5 w-4.5 rounded border-slate-700 bg-slate-800 text-teal-600 focus:ring-teal-500"
                        />
                        <label htmlFor={field.key} className="text-xs font-semibold text-slate-300">
                          {field.label}
                        </label>
                      </div>
                    );
                  }

                  if (field.type === 'select') {
                    return (
                      <div key={field.key} className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          {field.label}
                        </label>
                        <select
                          value={formData[field.key] || ''}
                          onChange={(e) => setFormData((prev: any) => ({ ...prev, [field.key]: e.target.value }))}
                          className="mis-select w-full"
                          required
                        >
                          <option value="">Choose {field.label}</option>
                          {field.options?.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    );
                  }

                  return (
                    <div key={field.key} className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {field.label}
                      </label>
                      <input
                        type={field.type}
                        value={formData[field.key] || ''}
                        onChange={(e) => setFormData((prev: any) => ({ ...prev, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value }))}
                        className="mis-input w-full"
                        required={field.key !== 'remarks' && field.key !== 'action_taken' && field.key !== 'closure_date'}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-6 border-t mt-8" style={{ borderColor: 'var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="mis-btn mis-btn-primary px-5 py-2 font-bold text-xs"
                >
                  {submitting ? 'Saving...' : '💾 Save Record'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Grid View Tab */
          <div className="mis-card p-5">
            {/* Search and Filters toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-5">
              <input
                type="text"
                placeholder="Search by client name or PAN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mis-input text-xs w-full sm:w-64"
              />
              
              {hasMultiBranchAccess && (
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="mis-select text-xs w-full sm:w-48"
                >
                  <option value="">All Branches</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Batch actions toolbar */}
            {selectedIds.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 mb-5 border rounded-lg bg-teal-500/10 border-teal-500/20 text-left">
                <span className="text-xs font-bold text-teal-400">
                  🛠️ Batch Action: {selectedIds.length} rows selected
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={batchStatus}
                    onChange={(e) => setBatchStatus(e.target.value)}
                    className="mis-select text-xs py-1"
                    style={{ width: '150px' }}
                  >
                    <option value="">Update Status...</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Processed">Processed</option>
                    <option value="Closed">Closed</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                  <button
                    onClick={handleBatchStatusApply}
                    className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition-all"
                  >
                    Apply Status
                  </button>
                </div>
              </div>
            )}

            {/* Grid Data Table */}
            {loading ? (
              <div className="py-12 text-xs font-semibold text-slate-500 animate-pulse">
                Loading DP Department records...
              </div>
            ) : entries.length === 0 ? (
              <div className="py-16 text-xs text-slate-400">
                No records found. Click "Add New Entry" to create a row.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="mis-table w-full text-left">
                  <thead>
                    <tr>
                      <th className="w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === entries.length}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-teal-600 focus:ring-teal-500"
                        />
                      </th>
                      {isClientSheet() && (
                        <>
                          <th>Client Name</th>
                          <th>PAN</th>
                        </>
                      )}
                      {getFormFields().map(field => {
                        if (field.type === 'checkbox') return null;
                        return <th key={field.key}>{field.label}</th>;
                      })}
                      <th className="text-right w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(row => (
                      <tr key={row.id} className="hover:bg-slate-900/50">
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(row.id)}
                            onChange={(e) => handleSelectRow(row.id, e.target.checked)}
                            className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-teal-600 focus:ring-teal-500"
                          />
                        </td>
                        {isClientSheet() && (
                          <>
                            <td className="font-bold text-slate-200">
                              {row.kyc_new_account?.applicant_name || 'N/A'}
                            </td>
                            <td className="text-slate-400 font-mono text-[11px]">
                              {row.kyc_new_account?.pan || 'N/A'}
                            </td>
                          </>
                        )}
                        {getFormFields().map(field => {
                          if (field.type === 'checkbox') return null;
                          const val = row[field.key];
                          if (field.type === 'date' && val) {
                            return <td key={field.key} className="text-slate-400">{new Date(val).toLocaleDateString()}</td>;
                          }
                          if (field.key === 'status' || field.key === 'scan_upload_status') {
                            let color = 'bg-slate-800 text-slate-400';
                            if (['Completed', 'Confirmed', 'Success', 'Uploaded', 'Resolved', 'Closed'].includes(val)) {
                              color = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                            } else if (['Pending', 'Requested', 'Uploaded', 'In Process'].includes(val)) {
                              color = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                            } else if (['Rejected', 'Failed', 'Escalated'].includes(val)) {
                              color = 'bg-red-500/10 text-red-400 border border-red-500/20';
                            }
                            return (
                              <td key={field.key}>
                                <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${color}`}>
                                  {val || 'N/A'}
                                </span>
                              </td>
                            );
                          }
                          return <td key={field.key} className="text-slate-300 truncate max-w-xs">{val ?? 'N/A'}</td>;
                        })}
                        <td className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleEdit(row)}
                              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                              title="Edit Row"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDelete(row.id)}
                              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400 transition-colors"
                              title="Delete Row"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* CSV Import Modal */}
        {csvModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-2xl text-left">
              <h3 className="text-lg font-bold text-white mb-4 border-b pb-2.5 border-slate-800">
                📤 Bulk CSV Data Import
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Select CSV File
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvFileChange}
                    className="w-full text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-teal-600 file:text-white hover:file:bg-teal-700"
                  />
                </div>

                {csvHeaders.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 mb-2">Align Database Fields to CSV Headers</h4>
                    <div className="max-h-56 overflow-y-auto border border-slate-800 rounded-lg p-3 bg-slate-950/50 space-y-3">
                      {getFormFields().map(field => (
                        <div key={field.key} className="grid grid-cols-2 items-center gap-4">
                          <span className="text-xs text-slate-300 font-semibold">{field.label}</span>
                          <select
                            value={csvMappings[field.key] || ''}
                            onChange={(e) => setCsvMappings(prev => ({ ...prev, [field.key]: e.target.value }))}
                            className="mis-select text-xs py-1"
                          >
                            <option value="">Skip field</option>
                            {csvHeaders.map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>

                    {/* Pre-import data layout checklist preview */}
                    <div className="mt-4">
                      <span className="text-[11px] font-bold text-teal-400 uppercase">Live CSV Rows Preview</span>
                      <div className="overflow-x-auto border border-slate-800 rounded-lg mt-1 bg-slate-950/20 text-xs">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-slate-800">
                              {csvHeaders.slice(0, 4).map(h => <th key={h} className="p-2 text-slate-500 font-bold">{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {csvRows.slice(0, 3).map((row, idx) => (
                              <tr key={idx} className="border-b border-slate-900 last:border-0">
                                {row.slice(0, 4).map((col, i) => <td key={i} className="p-2 text-slate-300">{col}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
                <button
                  onClick={() => setCsvModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold hover:bg-slate-800 text-slate-400"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCsvImportSubmit}
                  disabled={csvRows.length === 0}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                >
                  🚀 Upload Records
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};

export default DPDataEntryPage;
