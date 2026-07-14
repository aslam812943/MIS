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

interface SheetHelpConfig {
  why: string;
  fields: { label: string; note: string }[];
  remember: string;
}

// Plain-English explanations shown next to each data entry form, written for
// operations staff (not developers) — what this sheet is for and why each
// field matters. Keeps the same wording style across every department.
const SHEET_HELP: Record<string, SheetHelpConfig> = {
  'new-accounts': {
    why: 'This is where a client\'s already-verified KYC gets turned into an actual Demat (BO) account with CDSL — the account their shares will physically sit in. Without a BO ID here, a client can be fully KYC-verified and still not be able to hold a single share.',
    fields: [
      { label: 'Documents Checklist', note: 'Tick a box only after you have actually checked and uploaded that document to CDSL — this is your proof due diligence was done, not just a formality.' },
      { label: 'Verified By / Verification Date', note: 'Who checked this account opening and when — needed for the audit trail.' },
      { label: 'Uploaded to CDSL Date', note: 'The date the account details were actually sent to CDSL for BO ID generation.' },
      { label: 'BO ID Generated', note: 'The 16-digit Beneficiary Owner ID CDSL issues once it accepts the account — this is what proves the demat account now exists.' },
      { label: 'Status', note: 'Pending = not yet sent. Uploaded = sent, awaiting CDSL. Completed = BO ID received, account is live. Rejected = CDSL sent it back, check why.' },
      { label: 'Remarks', note: 'Any internal notes, e.g. a document that still needs to be re-scanned.' },
    ],
    remember: 'Always link the client from "Search KYC Verified Client" instead of typing details by hand — a demat account can only be opened for a client whose KYC is already Verified.',
  },
  'ucc-updation': {
    why: 'The client\'s Unique Client Code needs to be mapped to their demat account on the DP side too, so the exchange, the depository, and the trading side all agree on which BO ID belongs to which trading segment.',
    fields: [
      { label: 'Exchange Name', note: 'Which exchange (NSE or BSE) this UCC mapping is for.' },
      { label: 'Trading Segment', note: 'Which market the client trades in — Cash, F&O, Currency, or Commodity. Each needs its own confirmation.' },
      { label: 'Upload Date to Exchange', note: 'When this mapping was submitted to the exchange.' },
      { label: 'Exchange Confirmation Date', note: 'When the exchange confirmed it back.' },
      { label: 'Registration Status', note: 'Pending = not yet sent. Uploaded = sent, awaiting reply. Confirmed = mapping is active. Rejected = sent back, needs correction.' },
    ],
    remember: 'Make sure this matches what KYC already allotted for the same client — a mismatched UCC here can misroute the client\'s trades.',
  },
  'modifications': {
    why: 'When a client\'s address, mobile, bank details, or nominee changes, the demat account record held with CDSL must be updated too — it doesn\'t update automatically just because KYC was changed. This sheet is that update, with a paper trail.',
    fields: [
      { label: 'BO ID (Demat Number)', note: 'The demat account this change applies to.' },
      { label: 'Modification Type', note: 'What is being changed — Address, Mobile, Email, Bank Details, Nominee, Signature, or Other.' },
      { label: 'Previous Registered Value / New Requested Value', note: 'Write exactly what was on file before and what it\'s changing to — this is the proof if the change is ever disputed.' },
      { label: 'Request Date / Processed Date', note: 'When the client asked for the change, and when it was actually updated with CDSL.' },
      { label: 'Status', note: 'Pending = received, not yet done. Processed = updated with CDSL. Rejected = could not be processed.' },
    ],
    remember: 'Always fill in both the old and new value — this is what protects the firm if a client later disputes a change to their demat account.',
  },
  'demat-executions': {
    why: 'When a client hands in physical paper share certificates to be converted into electronic (demat) form, this tracks that request all the way through the Registrar & Transfer Agent (RTA) who actually performs the conversion.',
    fields: [
      { label: 'Client BO ID', note: 'The demat account the shares will be credited into.' },
      { label: 'DRF Request Number', note: 'The Dematerialisation Request Form number — the official reference for this conversion request.' },
      { label: 'Share ISIN Code', note: 'The unique 12-character code identifying exactly which security/share is being converted.' },
      { label: 'Company Name / Certificate Number / Folio Number', note: 'The details printed on the physical share certificate being converted — copy these exactly, a mismatch will get the request rejected by the RTA.' },
      { label: 'Shares Quantity', note: 'How many shares are on this certificate.' },
      { label: 'RTA Name', note: 'Which Registrar & Transfer Agent is processing this conversion for that company.' },
      { label: 'Date Sent to RTA', note: 'When the physical certificate and form were sent off.' },
      { label: 'Status', note: 'Sent to RTA = submitted, awaiting action. Confirmed = shares credited electronically. Rejected = RTA sent it back. Resubmitted = corrected and sent again. Closed = fully done.' },
    ],
    remember: 'Double-check the certificate number and folio number before submitting — these are the most common reasons an RTA rejects a demat request.',
  },
  'transfers-transmissions': {
    why: 'This tracks shares actually moving from one demat account to another — either a Transfer (the client chooses to move shares, e.g. a gift) or a Transmission (shares moving because the original holder passed away, following on from KYC\'s Demise Reporting).',
    fields: [
      { label: 'Type', note: 'Transfer = client-initiated movement. Transmission = movement following a death, to the legal heir.' },
      { label: 'Sender BO ID / Receiver BO ID', note: 'The demat account the shares are moving from, and the one they\'re moving to.' },
      { label: 'Share ISIN', note: 'Which security is being moved.' },
      { label: 'Transfer Quantity', note: 'How many shares are being moved.' },
      { label: 'Documents Checklist/Info', note: 'What supporting paperwork was provided (transfer deed, death certificate, succession certificate, etc.).' },
      { label: 'Request Date / Execution Date', note: 'When the request was made, and when the shares actually moved.' },
      { label: 'Status', note: 'Pending = not yet executed. Executed = shares have moved. Rejected = could not be processed.' },
    ],
    remember: 'For a Transmission, never execute without the supporting legal documents (death certificate / succession certificate) attached — this is a legally sensitive action.',
  },
  'demat-rejections': {
    why: 'Sometimes an RTA sends a demat request back instead of accepting it — wrong signature, damaged certificate, name mismatch, etc. This sheet tracks why it was rejected and what was done to fix and resubmit it, so nothing gets silently dropped.',
    fields: [
      { label: 'DRF Number', note: 'The original Dematerialisation Request Form number that was rejected.' },
      { label: 'RTA Rejection Reason', note: 'Write exactly what the RTA said was wrong — this tells you precisely what needs fixing.' },
      { label: 'Rejection Date', note: 'The date the RTA sent the rejection.' },
      { label: 'Corrective Action Taken', note: 'What was actually done to fix the issue (e.g. new signature obtained, certificate re-scanned).' },
      { label: 'Resubmitted to RTA Date', note: 'When the corrected request was sent back.' },
      { label: 'Status', note: 'Pending = not yet fixed and resubmitted. Resolved = corrected and accepted.' },
    ],
    remember: 'Always record the exact rejection reason before marking corrective action — guessing at the fix without it usually leads to a second rejection.',
  },
  'closures': {
    why: 'When a client wants to close their demat account, it has to be confirmed empty first — you cannot close an account that still holds shares or has pending obligations. This sheet is that formal closure record.',
    fields: [
      { label: 'Client BO ID', note: 'The demat account being closed.' },
      { label: 'Closure Reason', note: 'Why the client is closing (e.g. moving to another DP, no longer trading).' },
      { label: 'Holdings Check Status', note: 'Clean = account is empty and safe to close. Pending Obligations = there\'s an unsettled trade. Shares Present = shares still sitting in the account — closure cannot proceed until this is Clean.' },
      { label: 'Request Date / Closure Execution Date', note: 'When the client asked to close, and when the account was actually shut.' },
      { label: 'Status', note: 'Requested = received. Approved = cleared to proceed. Closed = fully shut. Rejected = could not be closed.' },
    ],
    remember: 'Never mark Closed while Holdings Check Status shows anything other than Clean — closing an account with shares or obligations still in it can trap the client\'s holdings.',
  },
  'dis-slips': {
    why: 'A Delivery Instruction Slip is the signed form a client uses to authorise shares leaving their demat account (for a sale or transfer). CDSL requires proof that this slip was received and scanned into CDAS before the instruction is acted on — this sheet is that proof.',
    fields: [
      { label: 'Client BO ID', note: 'The demat account the shares are moving out of.' },
      { label: 'DIS Slip Reference Number', note: 'The unique number printed on the physical DIS slip the client signed.' },
      { label: 'Share ISIN', note: 'Which security is being moved out.' },
      { label: 'Quantity Transferred', note: 'How many shares this slip authorises moving.' },
      { label: 'Execution Date', note: 'The date the instruction was actually carried out.' },
      { label: 'CDAS Scan Upload Status', note: 'Pending = not yet scanned in. Uploaded = successfully scanned into CDSL\'s system. Failed = scan upload failed, needs retrying.' },
      { label: 'Uploaded By / Upload Date to CDAS', note: 'Who did the scan upload, and when.' },
    ],
    remember: 'A DIS instruction should not be treated as complete until the scan shows Uploaded — a missing scan is a compliance gap even if the shares already moved.',
  },
  'back-office-updates': {
    why: 'The DP system needs its trade, holdings, and ledger files run and synced regularly so our records match the exchange and depository. This sheet is the log proving these routine but critical system runs actually happened.',
    fields: [
      { label: 'File Type', note: 'Which file was run — Trade File, Holdings File, Ledger File, or Other.' },
      { label: 'Run Date', note: 'The date this file was processed.' },
      { label: 'Performed By Staff Name', note: 'Who ran it.' },
      { label: 'Execution Status', note: 'Success = ran cleanly. Failed = the run errored and needs to be redone — don\'t leave a Failed run unaddressed.' },
      { label: 'Remarks', note: 'Any notes, e.g. what caused a failure.' },
    ],
    remember: 'A Failed status here means our records may be out of sync with the exchange/depository — flag it to your supervisor immediately, don\'t just log it and move on.',
  },
  'eod-backups': {
    why: 'Every end of day, the DP system\'s data must be backed up — if something goes wrong, this backup is what stops client holdings data from being permanently lost. This is a baseline operational safety requirement, not optional housekeeping.',
    fields: [
      { label: 'Backup Target Date', note: 'Which day\'s data this backup covers.' },
      { label: 'Backup Type', note: 'Full = a complete copy of everything. Incremental = only what changed since the last backup.' },
      { label: 'Backup File Size (KB)', note: 'The size of the backup file — a sudden drop to near-zero usually means the backup didn\'t actually run properly.' },
      { label: 'Verified By Staff Name', note: 'Who checked that the backup completed and is usable.' },
      { label: 'Status', note: 'Success = backup completed. Failed = it didn\'t — this needs immediate follow-up. Verified = someone has confirmed the backup file is good.' },
    ],
    remember: 'Never mark a backup Verified without actually checking the file — an unverified "Success" that turns out to be corrupt is only discovered when it\'s too late, during an actual data-loss event.',
  },
  'amc-charges': {
    why: 'Every demat account is billed an Annual Maintenance Charge for CDSL to keep holding it. This sheet tracks what each client is billed and whether it was actually debited, so nothing is missed or double-charged.',
    fields: [
      { label: 'Client BO ID', note: 'The demat account being billed.' },
      { label: 'Billing Month', note: 'Which billing cycle this charge belongs to (e.g. "July 2026").' },
      { label: 'AMC Charge Amount / GST Amount / Total Debited Amount', note: 'The base charge, the tax on it, and the final total actually debited — keep these consistent, Total should equal AMC + GST.' },
      { label: 'Debit Execution Date', note: 'The date the amount was actually taken from the client.' },
      { label: 'Billing Status', note: 'Pending = not yet billed. Debited = charged successfully. Waived = charge was excused. Failed = the debit attempt failed.' },
    ],
    remember: 'Double-check that Total Debited Amount actually equals AMC + GST before saving — a mismatch here is a billing error the client will notice.',
  },
  'monthly-statements': {
    why: 'SEBI requires every client to receive a periodic statement of their holdings. This sheet tracks that each client\'s monthly statement was actually generated and successfully delivered — not just prepared.',
    fields: [
      { label: 'Client BO ID', note: 'Which client this statement is for.' },
      { label: 'Period', note: 'Which month this statement covers (e.g. "June 2026").' },
      { label: 'Generation Date', note: 'When the statement was produced.' },
      { label: 'Dispatch Method', note: 'How it was sent — Email, Post, or Both.' },
      { label: 'Delivery Status', note: 'Sent = delivered. Bounced = delivery failed (bad email/address) — needs a retry via another method. Pending = not yet sent.' },
    ],
    remember: 'A Bounced statement is a compliance gap, not just an inconvenience — always follow up with an alternate delivery method rather than leaving it Bounced.',
  },
  'audit-compliance': {
    why: 'CDSL and SEBI periodically inspect DP operations, and the firm runs its own internal checks too. This sheet is the official record of every finding raised and whether it was actually fixed — this is exactly what gets reviewed if the firm is ever audited.',
    fields: [
      { label: 'Audit / Inspection Type', note: 'Internal = our own review. CDSL Inspection / SEBI = a regulator-driven audit.' },
      { label: 'Audit Target Period', note: 'Which period this audit covered (e.g. "FY 2025-26").' },
      { label: 'Auditor Name', note: 'Who conducted the audit.' },
      { label: 'Compliance Deviation / Finding', note: 'Exactly what the audit found wrong — be specific, this is a formal record.' },
      { label: 'Remediation Action Taken', note: 'What was actually done to fix the finding.' },
      { label: 'Closure Status', note: 'Open = finding raised, nothing done yet. Action Pending = fix in progress. Closed = fully remediated.' },
      { label: 'Closure Date', note: 'When the finding was actually closed out.' },
    ],
    remember: 'Never mark a finding Closed without a real Remediation Action on file — an unresolved finding marked Closed is worse than an open one if it resurfaces in the next audit.',
  },
  'client-queries': {
    why: 'Clients raise questions and complaints specifically about their demat account — a delayed transfer, an AMC charge dispute, missing documents. This sheet is the ticket log that makes sure every query gets tracked to resolution instead of being handled informally and forgotten.',
    fields: [
      { label: 'Client Complaint / Query Type', note: 'What kind of issue this is — Delayed Transfer, AMC Issue, Account Details, Document Status, or Other.' },
      { label: 'Query Description', note: 'What the client actually asked or complained about, in their own terms.' },
      { label: 'Assigned Executive Name', note: 'Who is responsible for resolving this.' },
      { label: 'Ticket Status', note: 'Open = just logged. In Progress = being worked on. Resolved = done. Escalated = needs a supervisor\'s attention.' },
      { label: 'Resolution Date', note: 'When the query was actually closed out.' },
    ],
    remember: 'If a query has been Open or In Progress for more than a few days with no movement, escalate it — a client complaint about their own holdings should never go quiet.',
  },
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
          /* Data Input Form Card + plain-English help panel */
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start max-w-6xl mx-auto">
          <div className="mis-card p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-1.5 border-b pb-3" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
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
                        <label htmlFor={field.key} className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
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

          {renderHelpPanel()}
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
                            <td className="font-bold" style={{ color: 'var(--text-primary)' }}>
                              {row.kyc_new_account?.applicant_name || 'N/A'}
                            </td>
                            <td className="font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                              {row.kyc_new_account?.pan || 'N/A'}
                            </td>
                          </>
                        )}
                        {getFormFields().map(field => {
                          if (field.type === 'checkbox') return null;
                          const val = row[field.key];
                          if (field.type === 'date' && val) {
                            return <td key={field.key} style={{ color: 'var(--text-secondary)' }}>{new Date(val).toLocaleDateString()}</td>;
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
                          return <td key={field.key} className="truncate max-w-xs" style={{ color: 'var(--text-primary)' }}>{val ?? 'N/A'}</td>;
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
