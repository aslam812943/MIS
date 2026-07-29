import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../components/layout/DashboardLayout';
import ViewDetailsModal from '../../components/common/ViewDetailsModal';
import CsvImportGuide from '../../components/common/CsvImportGuide';
import { containsSampleSentinel } from '../../utils/csvBulkImportHelpers';
import { kycService } from '../../services/kyc.service';
import { orgService } from '../../services/org.service';
import { authService } from '../../services/auth.service';

type SheetType = 
  | 'new_account'
  | 'ucc_allotment'
  | 'registry_updation'
  | 'ap_sharing'
  | 'demise_reporting'
  | 'ap_code_exchange'
  | 'onboarding_communication'
  | 'modification_requests'
  | 'reactivation'
  | 'account_closure'
  | 'exchange_compliance';

const INITIAL_NEW_ACCOUNT = {
  applicant_name: '',
  pan: '',
  aadhaar_number: '',
  mobile_number: '',
  email: '',
  address: '',
  date_of_birth: '',
  pan_copy: false,
  aadhaar_copy: false,
  bank_proof: false,
  photograph: false,
  signature: false,
  verified_by: '',
  verification_date: '',
  status: 'Pending',
  remarks: '',
  branch_id: '',
};

const INITIAL_UCC_ALLOTMENT = {
  client_name: '',
  pan: '',
  exchange: 'NSE',
  segment: 'Cash',
  ucc_code: '',
  upload_date: '',
  confirmation_date: '',
  status: 'Pending',
  branch_id: '',
};

const INITIAL_REGISTRY_UPDATION = {
  client_name: '',
  pan: '',
  registry: 'CKYC',
  upload_date: '',
  status: 'Pending',
  rejection_reason: '',
  branch_id: '',
};

const INITIAL_AP_SHARING = {
  ap_name: '',
  ap_code: '',
  client_name: '',
  sharing_percentage: 0,
  effective_date: '',
  status: 'Active',
  branch_id: '',
};

const INITIAL_DEMISE = {
  client_name: '',
  pan: '',
  date_of_demise: '',
  reported_date: '',
  death_certificate_url: '',
  status: 'Reported',
  remarks: '',
  branch_id: '',
};

const INITIAL_AP_CODE = {
  ap_name: '',
  ap_code: '',
  exchange: 'NSE',
  upload_date: '',
  status: 'Pending',
  branch_id: '',
};

const INITIAL_COMMUNICATION = {
  client_name: '',
  mode: 'Letter',
  sent_date: '',
  status: 'Sent',
  remarks: '',
  branch_id: '',
};

const INITIAL_MODIFICATION = {
  client_name: '',
  pan: '',
  modification_type: 'Address',
  old_value: '',
  new_value: '',
  supporting_document_url: '',
  request_date: '',
  processed_date: '',
  status: 'Pending',
  branch_id: '',
};

const INITIAL_REACTIVATION = {
  client_name: '',
  pan: '',
  reason: '',
  request_date: '',
  processed_date: '',
  status: 'Pending',
  branch_id: '',
};

const INITIAL_CLOSURE = {
  client_name: '',
  pan: '',
  reason: '',
  request_date: '',
  closure_date: '',
  status: 'Pending',
  branch_id: '',
};

const INITIAL_COMPLIANCE = {
  client_name: '',
  pan: '',
  compliance_item: 'PAN-Aadhaar Linkage',
  status: 'Due',
  due_date: '',
  branch_id: '',
};

interface FieldConfig {
  key: string;
  label: string;
  required: boolean;
}

const SHEET_FIELDS: Record<SheetType, FieldConfig[]> = {
  new_account: [
    { key: 'applicant_name', label: 'Applicant Name', required: true },
    { key: 'pan', label: 'PAN Card Number', required: true },
    { key: 'aadhaar_number', label: 'Aadhaar Number', required: true },
    { key: 'mobile_number', label: 'Mobile Number', required: true },
    { key: 'email', label: 'Email', required: true },
    { key: 'address', label: 'Address', required: true },
    { key: 'date_of_birth', label: 'Date of Birth (YYYY-MM-DD)', required: true },
    { key: 'verified_by', label: 'Verified By', required: false },
    { key: 'verification_date', label: 'Verification Date (YYYY-MM-DD)', required: false },
    { key: 'status', label: 'Status (Pending/Verified/Rejected)', required: false },
    { key: 'remarks', label: 'Remarks', required: false },
  ],
  ucc_allotment: [
    { key: 'client_name', label: 'Client Name', required: true },
    { key: 'pan', label: 'PAN Card Number', required: true },
    { key: 'exchange', label: 'Exchange (NSE/BSE)', required: true },
    { key: 'segment', label: 'Segment (Cash/F&O/Currency/Commodity)', required: true },
    { key: 'ucc_code', label: 'UCC Code', required: false },
    { key: 'upload_date', label: 'Upload Date (YYYY-MM-DD)', required: false },
    { key: 'confirmation_date', label: 'Confirmation Date (YYYY-MM-DD)', required: false },
    { key: 'status', label: 'Status (Pending/Uploaded/Confirmed/Rejected)', required: false },
  ],
  registry_updation: [
    { key: 'client_name', label: 'Client Name', required: true },
    { key: 'pan', label: 'PAN Card Number', required: true },
    { key: 'registry', label: 'Registry (CKYC/KRA)', required: true },
    { key: 'upload_date', label: 'Upload Date (YYYY-MM-DD)', required: false },
    { key: 'status', label: 'Status (Pending/Verified/Rejected)', required: false },
    { key: 'rejection_reason', label: 'Rejection Reason', required: false },
  ],
  ap_sharing: [
    { key: 'ap_name', label: 'AP Name', required: true },
    { key: 'ap_code', label: 'AP Code', required: true },
    { key: 'client_name', label: 'Client Name', required: true },
    { key: 'sharing_percentage', label: 'Sharing Percentage (%)', required: true },
    { key: 'effective_date', label: 'Effective Date (YYYY-MM-DD)', required: true },
    { key: 'status', label: 'Status (Active/Revised/Terminated)', required: false },
  ],
  demise_reporting: [
    { key: 'client_name', label: 'Client Name', required: true },
    { key: 'pan', label: 'PAN Card Number', required: true },
    { key: 'date_of_demise', label: 'Date of Demise (YYYY-MM-DD)', required: true },
    { key: 'reported_date', label: 'Reported Date (YYYY-MM-DD)', required: true },
    { key: 'status', label: 'Status (Reported/Forwarded to DP/Closed)', required: false },
    { key: 'remarks', label: 'Remarks', required: false },
  ],
  ap_code_exchange: [
    { key: 'ap_name', label: 'AP Name', required: true },
    { key: 'ap_code', label: 'AP Code', required: true },
    { key: 'exchange', label: 'Exchange (NSE/BSE)', required: true },
    { key: 'upload_date', label: 'Upload Date (YYYY-MM-DD)', required: true },
    { key: 'status', label: 'Status (Pending/Confirmed)', required: false },
  ],
  onboarding_communication: [
    { key: 'client_name', label: 'Client Name', required: true },
    { key: 'mode', label: 'Mode (Letter/SMS/Call/Email)', required: true },
    { key: 'sent_date', label: 'Sent Date (YYYY-MM-DD)', required: true },
    { key: 'status', label: 'Status (Sent/Failed/Not Reachable)', required: false },
    { key: 'remarks', label: 'Remarks', required: false },
  ],
  modification_requests: [
    { key: 'client_name', label: 'Client Name', required: true },
    { key: 'pan', label: 'PAN Card Number', required: true },
    { key: 'modification_type', label: 'Modification Type', required: true },
    { key: 'old_value', label: 'Old Value', required: false },
    { key: 'new_value', label: 'New Value', required: false },
    { key: 'request_date', label: 'Request Date (YYYY-MM-DD)', required: true },
    { key: 'processed_date', label: 'Processed Date (YYYY-MM-DD)', required: false },
    { key: 'status', label: 'Status (Pending/Processed/Rejected)', required: false },
  ],
  reactivation: [
    { key: 'client_name', label: 'Client Name', required: true },
    { key: 'pan', label: 'PAN Card Number', required: true },
    { key: 'reason', label: 'Reason', required: true },
    { key: 'request_date', label: 'Request Date (YYYY-MM-DD)', required: true },
    { key: 'processed_date', label: 'Processed Date (YYYY-MM-DD)', required: false },
    { key: 'status', label: 'Status (Pending/Processed/Rejected)', required: false },
  ],
  account_closure: [
    { key: 'client_name', label: 'Client Name', required: true },
    { key: 'pan', label: 'PAN Card Number', required: true },
    { key: 'reason', label: 'Reason', required: true },
    { key: 'request_date', label: 'Request Date (YYYY-MM-DD)', required: true },
    { key: 'closure_date', label: 'Closure Date (YYYY-MM-DD)', required: false },
    { key: 'status', label: 'Status (Pending/Processed/Rejected)', required: false },
  ],
  exchange_compliance: [
    { key: 'client_name', label: 'Client Name', required: true },
    { key: 'pan', label: 'PAN Card Number', required: true },
    { key: 'compliance_item', label: 'Compliance Item', required: true },
    { key: 'due_date', label: 'Due Date (YYYY-MM-DD)', required: false },
    { key: 'status', label: 'Status (Compliant/Non-Compliant/Due)', required: false },
  ],
};

interface SheetHelpConfig {
  why: string;
  fields: { label: string; note: string }[];
  remember: string;
}

// Plain-English explanations shown next to each data entry form, written for
// operations staff (not developers) — what this sheet is for and why each
// field matters. Keep the language simple: this is read by branch employees.
const SHEET_HELP: Record<SheetType, SheetHelpConfig> = {
  new_account: {
    why: 'This is where a brand-new client\'s identity documents are captured and checked before they are allowed to trade. Every other sheet in KYC links back to the PAN entered here, so getting this record right the first time matters more than any other sheet.',
    fields: [
      { label: 'Applicant Name', note: 'The client\'s full legal name, exactly as printed on their PAN card. Do not use nicknames or short forms.' },
      { label: 'PAN Card Number', note: 'The client\'s permanent 10-character Income Tax ID (e.g. ABCDE1234F). This is the client\'s unique identity across the whole KYC system — it can only be onboarded once.' },
      { label: 'Aadhaar Number', note: 'The client\'s 12-digit Aadhaar number, used to confirm identity and address as required by SEBI KYC rules.' },
      { label: 'Mobile Number', note: 'The client\'s own active 10-digit mobile number, used for OTPs and account alerts. Must belong to the client, not a relative or the branch.' },
      { label: 'Email', note: 'The client\'s email address, used for statements, contract notes, and account alerts.' },
      { label: 'Date of Birth', note: 'Confirms the client is an adult and matches the DOB on their PAN/Aadhaar.' },
      { label: 'Address', note: 'The client\'s current residential address, as shown on their KYC proof.' },
      { label: 'Documents Checklist', note: 'Tick a box only after you have actually seen and safely filed that document. This checklist is your proof that due diligence was really done.' },
      { label: 'Verified By / Verification Date', note: 'Who checked and approved this client, and when — needed for the audit trail.' },
      { label: 'Verification Status', note: 'Pending = still being checked. Verified = approved, client can move on to UCC Allotment. Rejected = documents failed the check.' },
      { label: 'Remarks', note: 'Any internal notes, e.g. a document that is still missing or a follow-up that is needed.' },
    ],
    remember: 'A client\'s PAN can only be onboarded once. If they already exist, use "View Sheet Grid" to search for them instead of creating a duplicate row — the system will now block a second entry with the same PAN.',
  },
  ucc_allotment: {
    why: 'Once a client is verified, their details must be sent to the stock exchange (NSE/BSE) to get a Unique Client Code (UCC). Without a confirmed UCC, the client cannot legally place a single trade.',
    fields: [
      { label: 'Client Name / PAN', note: 'Pick the client using "Link Onboarded Client Profile" above instead of typing — this guarantees it matches an already-verified client and can\'t be mistyped.' },
      { label: 'Exchange', note: 'Which exchange (NSE or BSE) this UCC request is going to.' },
      { label: 'Segment', note: 'Which market the client wants to trade in — Cash, F&O, Currency, or Commodity. Each segment needs its own UCC mapping.' },
      { label: 'UCC Code', note: 'The Unique Client Code the exchange sends back once it accepts the request — proof the client can now trade.' },
      { label: 'Upload Date / Confirmation Date', note: 'When we submitted the request, and when the exchange confirmed it.' },
      { label: 'Status', note: 'Pending = not yet sent. Uploaded = sent, awaiting exchange reply. Confirmed = client can trade. Rejected = exchange sent it back, check why.' },
    ],
    remember: 'Always use the client-linking dropdown rather than free typing — a mismatched name/PAN here can register the UCC against the wrong client.',
  },
  registry_updation: {
    why: 'SEBI requires every client\'s KYC to also be registered with a central registry (CKYC) or a KYC Registration Agency (KRA), so any other bank or broker in India can verify the same client without collecting the same documents all over again.',
    fields: [
      { label: 'Client Name / PAN', note: 'Use the client-linking dropdown so this always matches the correct verified client.' },
      { label: 'Registry', note: 'CKYC is the government Central KYC registry; KRA is a private KYC Registration Agency. Choose whichever this submission is going to.' },
      { label: 'Upload Date', note: 'The date we submitted the client\'s KYC data to this registry.' },
      { label: 'Status', note: 'Pending / Verified / Rejected — did the registry accept the data as submitted.' },
      { label: 'Rejection Reason', note: 'If rejected, write exactly what the registry flagged as wrong, so it can be corrected and resubmitted.' },
    ],
    remember: 'Always fill in the Rejection Reason when status is Rejected — without it, nobody else knows what needs fixing before resubmission.',
  },
  ap_sharing: {
    why: 'Some clients are brought in by an Authorised Person (AP) / sub-broker / remisier, who earns a share of the brokerage on that client\'s trades. This sheet records who introduced the client and what percentage they are owed, so commission payouts are correct.',
    fields: [
      { label: 'AP Name / AP Code', note: 'The Authorised Person who introduced this client. AP Code is their unique exchange-registered ID.' },
      { label: 'Client Name', note: 'The client this sharing arrangement applies to.' },
      { label: 'Sharing Percentage (%)', note: 'What percentage of brokerage on this client\'s trades goes to the AP. Take this figure from the signed AP agreement — never estimate it.' },
      { label: 'Effective Date', note: 'The date this sharing percentage starts applying.' },
      { label: 'Status', note: 'Active = currently in effect. Revised = the percentage was changed. Terminated = the arrangement has ended.' },
    ],
    remember: 'Double-check the percentage against the signed AP agreement before saving — a wrong number here means a wrong commission payout later.',
  },
  demise_reporting: {
    why: 'If a client passes away, their account must be frozen and the shares formally transferred to their legal heir. This sheet is the official record that starts that process — mistakes here have real legal and family consequences, so accuracy matters more than speed.',
    fields: [
      { label: 'Client Name / PAN', note: 'The deceased client\'s details, linked from their onboarding record.' },
      { label: 'Date of Demise', note: 'The actual date the client passed away, exactly as shown on the death certificate — not the date we found out.' },
      { label: 'Reported Date', note: 'The date this was reported to us / entered into this system.' },
      { label: 'Death Certificate', note: 'Upload a clear scan or photo of the official death certificate — this is the legal proof required before any transmission action can begin.' },
      { label: 'Status', note: 'Reported = logged here. Forwarded to DP = sent to the DP team to freeze holdings and start transmission. Closed = transmission fully completed.' },
      { label: 'Remarks', note: 'Any notes for the DP / back-office team handling the transmission.' },
    ],
    remember: 'This is a sensitive, legally important record. Always attach the death certificate before moving the status to "Forwarded to DP".',
  },
  ap_code_exchange: {
    why: 'Just like a client needs a UCC, an Authorised Person\'s own code must be registered and kept up to date with the exchange, so their activity and commissions are tracked correctly under SEBI rules.',
    fields: [
      { label: 'AP Name / AP Code', note: 'The Authorised Person\'s name and their exchange-registered code.' },
      { label: 'Exchange', note: 'NSE or BSE — which exchange this code is being registered or updated with.' },
      { label: 'Upload Date', note: 'When the code details were submitted to the exchange.' },
      { label: 'Status', note: 'Pending = submitted, awaiting exchange confirmation. Confirmed = the exchange has accepted and registered the code.' },
    ],
    remember: 'Keep this in sync with the AP\'s actual exchange registration — an unconfirmed code can mean the AP\'s trades aren\'t being tracked correctly.',
  },
  onboarding_communication: {
    why: 'SEBI requires the firm to keep proof that we actually contacted every new client after onboarding — a welcome letter, SMS, call, or email. This sheet is that proof, not just a courtesy record.',
    fields: [
      { label: 'Client Name', note: 'Which client this communication was sent to.' },
      { label: 'Communication Mode', note: 'How we reached them — Letter, SMS, Call, or Email.' },
      { label: 'Sent Date', note: 'When the communication was sent.' },
      { label: 'Status', note: 'Sent = delivered successfully. Failed = delivery failed (bad number/address). Not Reachable = client could not be contacted — needs follow-up.' },
      { label: 'Remarks', note: 'Any notes, e.g. the client asked for a callback, or the number on file is wrong.' },
    ],
    remember: 'If status is Failed or Not Reachable, note it and try an alternate contact method — we need to show a genuine attempt was made to reach every client.',
  },
  modification_requests: {
    why: 'Clients sometimes need to update sensitive details on file — address, mobile, email, bank, nomination, or signature. Because these are identity fields, every change must be logged with proof, so there\'s a clear trail if it\'s ever questioned later.',
    fields: [
      { label: 'Client Name / PAN', note: 'The client asking for the change.' },
      { label: 'Modification Type', note: 'What is being changed — Address, Mobile, Email, Bank Details, Nomination, Signature, or Other.' },
      { label: 'Old Value / New Value', note: 'Write exactly what was on file before, and exactly what it\'s being changed to. This is the audit trail if the change is ever disputed.' },
      { label: 'Supporting Document', note: 'Upload the client\'s signed request or proof for the new detail (e.g. new address proof).' },
      { label: 'Request Date / Processed Date', note: 'When the client asked for the change, and when it was actually made in our records.' },
      { label: 'Status', note: 'Pending = received, not yet actioned. Processed = change completed. Rejected = could not be processed (e.g. proof was insufficient).' },
    ],
    remember: 'Always fill in both Old Value and New Value and attach proof — this is what protects the firm if a client later disputes a change to their details.',
  },
  reactivation: {
    why: 'An account that has gone dormant or inactive needs a formal request and approval before it can trade again — SEBI treats inactive accounts differently. This sheet is that formal request and its outcome.',
    fields: [
      { label: 'Client Name / PAN', note: 'The client whose dormant account needs reactivating.' },
      { label: 'Reason for Reactivation', note: 'Why the account went inactive and why it should be reopened now. This is required for the approval trail.' },
      { label: 'Request Date / Processed Date', note: 'When the client asked to reactivate, and when it was actually completed.' },
      { label: 'Status', note: 'Pending = under review. Processed = account is active again. Rejected = reactivation was not approved.' },
    ],
    remember: 'A clear Reason is required every time — this is exactly what gets checked if a reactivation is ever audited.',
  },
  account_closure: {
    why: 'When a client wants to stop trading with us, their account/UCC must be formally closed. This protects the client (no further charges or liability) and the firm (a clear record of exactly when responsibility ended).',
    fields: [
      { label: 'Client Name / PAN', note: 'The client closing their account.' },
      { label: 'Reason for Closure', note: 'Why the client wants to close (e.g. moving to another broker, no longer trading). Keep this on file in case of a future dispute.' },
      { label: 'Request Date / Closure Date', note: 'When the client asked to close, and when the account/UCC was actually closed.' },
      { label: 'Status', note: 'Pending = request received. Processed = account fully closed. Rejected = closure could not proceed (e.g. pending dues or holdings).' },
    ],
    remember: 'Make sure the client has no pending dues or unsettled holdings before marking a closure as Processed.',
  },
  exchange_compliance: {
    why: 'SEBI and the exchanges run mandatory periodic checks — PAN-Aadhaar linking, annual KYC refresh, nomination opt-in — that every client must complete by a deadline. This sheet tracks who\'s done, who isn\'t, and who\'s coming due, so nothing slips through.',
    fields: [
      { label: 'Client Name / PAN', note: 'The client this compliance check applies to.' },
      { label: 'Compliance Item', note: 'Which mandatory check this is — PAN-Aadhaar Linkage, Annual KYC Refresh, Nomination Opt-in/Opt-out, or another exchange mandate.' },
      { label: 'Due Date', note: 'The deadline SEBI/the exchange has set for this to be completed.' },
      { label: 'Status', note: 'Compliant = done. Non-Compliant = deadline passed and it\'s still not done (account may get restricted). Due = deadline is still coming up.' },
    ],
    remember: 'Check this sheet regularly — once a Due Date passes with no action, the exchange can restrict that client\'s trading account.',
  },
};

const getBackendSheetName = (tab: SheetType): string => {
  const map: Record<SheetType, string> = {
    new_account: 'new-accounts',
    ucc_allotment: 'ucc-allotments',
    registry_updation: 'registry-updates',
    ap_sharing: 'ap-sharings',
    demise_reporting: 'demise-reports',
    ap_code_exchange: 'ap-codes',
    onboarding_communication: 'communications',
    modification_requests: 'modifications',
    reactivation: 'reactivations',
    account_closure: 'closures',
    exchange_compliance: 'compliance',
  };
  return map[tab];
};

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
};

const KYCDataEntryPage: React.FC = () => {
  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const hasMultiBranchAccess = isAdmin || ['ceo', 'managing_director', 'director', 'executive'].includes(currentUser?.role || '');
  const userBranchId = currentUser?.branch_id || '';

  const [sheetTab, setSheetTab] = useState<SheetType>('new_account');
  const [activeTab, setActiveTab] = useState<'list' | 'register'>('list');
  const [formData, setFormData] = useState<any>({ ...INITIAL_NEW_ACCOUNT, branch_id: userBranchId });
  const [records, setRecords] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState<any>(null);

  // Client Selection / Linking UX
  const [onboardedClients, setOnboardedClients] = useState<any[]>([]);
  const [manualClientInput, setManualClientInput] = useState<boolean>(false);

  // CSV Import States
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({});
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [importBranchId, setImportBranchId] = useState('');
  const [importing, setImporting] = useState(false);

  // Bulk Operations Selection States
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [selectedBatchStatus, setSelectedBatchStatus] = useState<string>('');
  const [batchChecklist, setBatchChecklist] = useState({
    pan_copy: false,
    aadhaar_copy: false,
    bank_proof: false,
    photograph: false,
    signature: false,
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchBranches();
    fetchOnboardedClients();
  }, []);

  useEffect(() => {
    setActiveTab('list');
    setEditingId(null);
    setStatusFilter('');
    setBranchFilter('');
    setSearchTerm('');
    setRecords([]);
    setManualClientInput(false);
    setSelectedRowIds([]);
    setSelectedBatchStatus('');
    setBatchChecklist({
      pan_copy: false,
      aadhaar_copy: false,
      bank_proof: false,
      photograph: false,
      signature: false,
    });

    const stateMap: { [key in SheetType]: any } = {
      new_account: INITIAL_NEW_ACCOUNT,
      ucc_allotment: INITIAL_UCC_ALLOTMENT,
      registry_updation: INITIAL_REGISTRY_UPDATION,
      ap_sharing: INITIAL_AP_SHARING,
      demise_reporting: INITIAL_DEMISE,
      ap_code_exchange: INITIAL_AP_CODE,
      onboarding_communication: INITIAL_COMMUNICATION,
      modification_requests: INITIAL_MODIFICATION,
      reactivation: INITIAL_REACTIVATION,
      account_closure: INITIAL_CLOSURE,
      exchange_compliance: INITIAL_COMPLIANCE,
    };

    setFormData({
      ...stateMap[sheetTab],
      branch_id: userBranchId,
    });
  }, [sheetTab]);

  useEffect(() => {
    fetchRecords();
  }, [sheetTab, activeTab, statusFilter, branchFilter]);

  const fetchBranches = async () => {
    try {
      const data = await orgService.getBranches();
      setBranches(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load branches.');
    }
  };

  const fetchOnboardedClients = async () => {
    try {
      // Retrieve clients verified under "1. New Account Onboarding"
      const data = await kycService.getNewAccounts({ status: 'Verified' });
      setOnboardedClients(data || []);
    } catch (err) {
      console.error('Failed to retrieve verified clients:', err);
    }
  };

  const fetchRecords = async () => {
    setFetching(true);
    setSelectedRowIds([]);
    setSelectedBatchStatus('');
    try {
      const branchIdParam = hasMultiBranchAccess ? (branchFilter || undefined) : userBranchId;
      const filters = {
        status: statusFilter || undefined,
        branchId: branchIdParam,
        search: searchTerm || undefined,
      };

      let data: any[] = [];
      switch (sheetTab) {
        case 'new_account':
          data = await kycService.getNewAccounts(filters);
          break;
        case 'ucc_allotment':
          data = await kycService.getUCCAllotments(filters);
          break;
        case 'registry_updation':
          data = await kycService.getRegistryUpdates(filters);
          break;
        case 'ap_sharing':
          data = await kycService.getAPSharings(filters);
          break;
        case 'demise_reporting':
          data = await kycService.getDemiseReports(filters);
          break;
        case 'ap_code_exchange':
          data = await kycService.getAPCodes(filters);
          break;
        case 'onboarding_communication':
          data = await kycService.getCommunications(filters);
          break;
        case 'modification_requests':
          data = await kycService.getModifications(filters);
          break;
        case 'reactivation':
          data = await kycService.getReactivations(filters);
          break;
        case 'account_closure':
          data = await kycService.getClosures(filters);
          break;
        case 'exchange_compliance':
          data = await kycService.getCompliances(filters);
          break;
      }
      setRecords(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to retrieve sheet data.');
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Unsupported file format. Please upload PDF, PNG or JPEG.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be under 5MB.');
      return;
    }

    const loadToast = toast.loading('Uploading document...');
    try {
      const response = await kycService.uploadDocument(file);
      handleInputChange(fieldName, response.fileUrl);
      toast.success('Document uploaded successfully.', { id: loadToast });
    } catch (err) {
      console.error(err);
      toast.error('Document upload failed.', { id: loadToast });
    }
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a valid CSV file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        toast.error('The uploaded file is empty.');
        return;
      }

      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      if (lines.length === 0) {
        toast.error('The CSV file contains no records.');
        return;
      }

      const headers = parseCsvLine(lines[0]);
      const rows = lines.slice(1).map(line => parseCsvLine(line));

      if (rows.length === 0) {
        toast.error('The CSV file contains only header values.');
        return;
      }

      if (rows.length > 500) {
        toast.error('Upload exceeds maximum limit of 500 records.');
        return;
      }

      const initialMapping: Record<string, string> = {};
      const fields = SHEET_FIELDS[sheetTab];

      fields.forEach((field) => {
        const match = headers.find(h => 
          h.toLowerCase() === field.key.toLowerCase() ||
          h.toLowerCase().replace(/_/g, ' ') === field.label.toLowerCase() ||
          field.label.toLowerCase().includes(h.toLowerCase()) ||
          h.toLowerCase().includes(field.key.toLowerCase())
        );
        if (match) {
          initialMapping[field.key] = match;
        } else {
          initialMapping[field.key] = '';
        }
      });

      setCsvHeaders(headers);
      setCsvRows(rows);
      setCsvMapping(initialMapping);
      setImportBranchId('');
      setShowMappingModal(true);
    };

    reader.onerror = () => {
      toast.error('Failed to read CSV file.');
    };

    reader.readAsText(file);
  };

  const handleBulkImportSubmit = async () => {
    if (csvRows.length === 0) {
      toast.error('Select a CSV file first.');
      return;
    }
    const fields = SHEET_FIELDS[sheetTab];
    const missing = fields.filter(f => f.required && !csvMapping[f.key]);
    if (missing.length > 0) {
      toast.error(`Please map all required fields: ${missing.map(f => f.label).join(', ')}`);
      return;
    }

    if (containsSampleSentinel(csvRows)) {
      toast.error("Can't import — this is the example file. Replace the sample row with your real data before uploading.");
      return;
    }

    const selectedBranch = hasMultiBranchAccess ? importBranchId : userBranchId;
    if (hasMultiBranchAccess && !selectedBranch) {
      toast.error('Please select a default Branch Office for the imported records.');
      return;
    }

    setImporting(true);
    const loadToast = toast.loading('Importing bulk records...');

    try {
      const recordsToImport = csvRows.map((row) => {
        const item: Record<string, any> = {};
        
        fields.forEach((field) => {
          const csvColName = csvMapping[field.key];
          if (csvColName) {
            const colIndex = csvHeaders.indexOf(csvColName);
            if (colIndex !== -1) {
              let value: string | boolean = row[colIndex] || '';

              if (['pan_copy', 'aadhaar_copy', 'bank_proof', 'photograph', 'signature'].includes(field.key)) {
                value = ['true', 'yes', '1', 'checked'].includes(value.toLowerCase());
              }
              
              item[field.key] = value;
            }
          }
        });

        if (!item.branch_id) {
          item.branch_id = selectedBranch;
        }

        return item;
      });

      const backendSheet = getBackendSheetName(sheetTab);
      await kycService.bulkImport(backendSheet, recordsToImport);

      toast.success(`Successfully imported ${recordsToImport.length} records.`, { id: loadToast });
      setShowMappingModal(false);
      fetchRecords();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || 'Bulk import failed.', { id: loadToast });
    } finally {
      setImporting(false);
    }
  };

  const GET_SHEET_STATUS_OPTIONS = (tab: SheetType): string[] => {
    switch (tab) {
      case 'new_account':
      case 'registry_updation':
      case 'modification_requests':
      case 'reactivation':
      case 'account_closure':
        return ['Pending', 'Verified', 'Processed', 'Rejected'];
      case 'ucc_allotment':
        return ['Pending', 'Uploaded', 'Confirmed', 'Rejected'];
      case 'ap_sharing':
        return ['Active', 'Revised', 'Terminated'];
      case 'demise_reporting':
        return ['Reported', 'Forwarded to DP', 'Closed'];
      case 'ap_code_exchange':
        return ['Pending', 'Confirmed'];
      case 'onboarding_communication':
        return ['Sent', 'Failed', 'Not Reachable'];
      case 'exchange_compliance':
        return ['Compliant', 'Non-Compliant', 'Due'];
      default:
        return [];
    }
  };

  const handleBulkUpdate = async (updates: any) => {
    if (selectedRowIds.length === 0) return;
    setLoading(true);
    const loadToast = toast.loading(`Updating ${selectedRowIds.length} records...`);
    try {
      const backendSheet = getBackendSheetName(sheetTab);
      await kycService.bulkUpdate(backendSheet, selectedRowIds, updates);
      toast.success('Selected records updated successfully.', { id: loadToast });
      setSelectedRowIds([]);
      setBatchChecklist({
        pan_copy: false,
        aadhaar_copy: false,
        bank_proof: false,
        photograph: false,
        signature: false,
      });
      setSelectedBatchStatus('');
      fetchRecords();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || 'Bulk update failed.', { id: loadToast });
    } finally {
      setLoading(false);
    }
  };

  const renderRowCheckbox = (record: any) => {
    return (
      <td className="w-10 text-center select-none" style={{ borderColor: 'var(--border)' }}>
        <input
          type="checkbox"
          checked={selectedRowIds.includes(record.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedRowIds(prev => [...prev, record.id]);
            } else {
              setSelectedRowIds(prev => prev.filter(id => id !== record.id));
            }
          }}
          className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
        />
      </td>
    );
  };

  const validateForm = () => {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    const adharRegex = /^\d{12}$/;
    const phoneRegex = /^\d{10}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (['new_account', 'ucc_allotment', 'registry_updation', 'demise_reporting', 'modification_requests', 'reactivation', 'account_closure', 'exchange_compliance'].includes(sheetTab)) {
      if (formData.pan && !panRegex.test(formData.pan.toUpperCase())) {
        return 'Invalid PAN card format (Must be 10 characters uppercase alphanumeric, e.g. ABCDE1234F).';
      }
    }

    if (sheetTab === 'new_account') {
      if (!formData.applicant_name?.trim()) return 'Applicant Name is required.';
      if (!formData.pan) return 'PAN is required.';
      if (!formData.aadhaar_number || !adharRegex.test(formData.aadhaar_number)) return 'Aadhaar must be exactly 12 digits.';
      if (!formData.mobile_number || !phoneRegex.test(formData.mobile_number)) return 'Mobile must be exactly 10 digits.';
      if (!formData.email || !emailRegex.test(formData.email)) return 'Invalid Email format.';
      if (!formData.address?.trim()) return 'Address is required.';
      if (!formData.date_of_birth) return 'Date of Birth is required.';
    } else if (sheetTab === 'ucc_allotment') {
      if (!formData.client_name?.trim()) return 'Client Name is required.';
      if (!formData.pan) return 'PAN is required.';
      if (!formData.exchange) return 'Exchange Selection (NSE/BSE) is required.';
      if (!formData.segment) return 'Segment selection is required.';
    } else if (sheetTab === 'registry_updation') {
      if (!formData.client_name?.trim()) return 'Client Name is required.';
      if (!formData.pan) return 'PAN is required.';
    } else if (sheetTab === 'ap_sharing') {
      if (!formData.ap_name?.trim()) return 'AP Name is required.';
      if (!formData.ap_code?.trim()) return 'AP Code is required.';
      if (!formData.client_name?.trim()) return 'Client Name is required.';
      const pct = Number(formData.sharing_percentage);
      if (isNaN(pct) || pct < 0 || pct > 100) return 'Sharing percentage must be between 0 and 100.';
      if (!formData.effective_date) return 'Effective Date is required.';
    } else if (sheetTab === 'demise_reporting') {
      if (!formData.client_name?.trim()) return 'Client Name is required.';
      if (!formData.pan) return 'PAN is required.';
      if (!formData.date_of_demise) return 'Date of Demise is required.';
      if (!formData.reported_date) return 'Reported Date is required.';
    } else if (sheetTab === 'ap_code_exchange') {
      if (!formData.ap_name?.trim()) return 'AP Name is required.';
      if (!formData.ap_code?.trim()) return 'AP Code is required.';
      if (!formData.exchange) return 'Exchange selection is required.';
      if (!formData.upload_date) return 'Upload Date is required.';
    } else if (sheetTab === 'onboarding_communication') {
      if (!formData.client_name?.trim()) return 'Client Name is required.';
      if (!formData.mode) return 'Communication Mode is required.';
      if (!formData.sent_date) return 'Sent Date is required.';
    } else if (sheetTab === 'modification_requests') {
      if (!formData.client_name?.trim()) return 'Client Name is required.';
      if (!formData.pan) return 'PAN is required.';
      if (!formData.modification_type) return 'Modification Type is required.';
      if (!formData.request_date) return 'Request Date is required.';
    } else if (sheetTab === 'reactivation') {
      if (!formData.client_name?.trim()) return 'Client Name is required.';
      if (!formData.pan) return 'PAN is required.';
      if (!formData.reason?.trim()) return 'Reason is required.';
      if (!formData.request_date) return 'Request Date is required.';
    } else if (sheetTab === 'account_closure') {
      if (!formData.client_name?.trim()) return 'Client Name is required.';
      if (!formData.pan) return 'PAN is required.';
      if (!formData.reason?.trim()) return 'Reason is required.';
      if (!formData.request_date) return 'Request Date is required.';
    } else if (sheetTab === 'exchange_compliance') {
      if (!formData.client_name?.trim()) return 'Client Name is required.';
      if (!formData.pan) return 'PAN is required.';
      if (!formData.compliance_item) return 'Compliance Item is required.';
    }

    if (!formData.branch_id) return 'Branch Office assignment is required.';
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
      if (editingId) {
        switch (sheetTab) {
          case 'new_account': await kycService.updateNewAccount(editingId, formData); break;
          case 'ucc_allotment': await kycService.updateUCCAllotment(editingId, formData); break;
          case 'registry_updation': await kycService.updateRegistryUpdate(editingId, formData); break;
          case 'ap_sharing': await kycService.updateAPSharing(editingId, formData); break;
          case 'demise_reporting': await kycService.updateDemiseReport(editingId, formData); break;
          case 'ap_code_exchange': await kycService.updateAPCode(editingId, formData); break;
          case 'onboarding_communication': await kycService.updateCommunication(editingId, formData); break;
          case 'modification_requests': await kycService.updateModification(editingId, formData); break;
          case 'reactivation': await kycService.updateReactivation(editingId, formData); break;
          case 'account_closure': await kycService.updateClosure(editingId, formData); break;
          case 'exchange_compliance': await kycService.updateCompliance(editingId, formData); break;
        }
        toast.success('Record updated successfully.');
      } else {
        switch (sheetTab) {
          case 'new_account': await kycService.createNewAccount(formData); break;
          case 'ucc_allotment': await kycService.createUCCAllotment(formData); break;
          case 'registry_updation': await kycService.createRegistryUpdate(formData); break;
          case 'ap_sharing': await kycService.createAPSharing(formData); break;
          case 'demise_reporting': await kycService.createDemiseReport(formData); break;
          case 'ap_code_exchange': await kycService.createAPCode(formData); break;
          case 'onboarding_communication': await kycService.createCommunication(formData); break;
          case 'modification_requests': await kycService.createModification(formData); break;
          case 'reactivation': await kycService.createReactivation(formData); break;
          case 'account_closure': await kycService.createClosure(formData); break;
          case 'exchange_compliance': await kycService.createCompliance(formData); break;
        }
        toast.success('Record added successfully.');
      }

      setEditingId(null);
      setActiveTab('list');

      const clearMap: { [key in SheetType]: any } = {
        new_account: INITIAL_NEW_ACCOUNT,
        ucc_allotment: INITIAL_UCC_ALLOTMENT,
        registry_updation: INITIAL_REGISTRY_UPDATION,
        ap_sharing: INITIAL_AP_SHARING,
        demise_reporting: INITIAL_DEMISE,
        ap_code_exchange: INITIAL_AP_CODE,
        onboarding_communication: INITIAL_COMMUNICATION,
        modification_requests: INITIAL_MODIFICATION,
        reactivation: INITIAL_REACTIVATION,
        account_closure: INITIAL_CLOSURE,
        exchange_compliance: INITIAL_COMPLIANCE,
      };

      setFormData({
        ...clearMap[sheetTab],
        branch_id: userBranchId,
      });

      fetchRecords();
      fetchOnboardedClients(); // refresh verified clients list
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || 'Error saving record.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    const mapped: any = { ...record };
    delete mapped.id;
    delete mapped.created_at;
    delete mapped.updated_at;
    delete mapped.branches;
    delete mapped.profiles;
    
    // Check if client exists in onboarded clients list
    const clientExists = onboardedClients.some(c => c.applicant_name === mapped.client_name && c.pan === mapped.pan);
    setManualClientInput(!clientExists);

    setFormData(mapped);
    setActiveTab('register');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      await kycService.deleteEntry(getBackendSheetName(sheetTab), id);
      toast.success('Record deleted.');
      fetchRecords();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Delete operation failed.');
    }
  };

  // UX Component: Selector populated with clients onboarded/verified in sheet 1
  const renderClientSelectionBlock = () => {
    if (onboardedClients.length === 0) return null;

    const matchedClient = onboardedClients.find(c => c.applicant_name === formData.client_name && c.pan === formData.pan);
    const selectValue = manualClientInput ? 'manual' : matchedClient?.id || '';

    return (
      <div className="border p-4 rounded-lg mb-6 animate-fade-in" style={{ background: 'var(--panel-inset-soft)', borderColor: 'var(--border)' }}>
        <div className="mis-field m-0">
          <label className="mis-label">Link Onboarded Client Profile</label>
          <select
            value={selectValue}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'manual') {
                setManualClientInput(true);
                handleInputChange('client_name', '');
                handleInputChange('pan', '');
              } else if (val === '') {
                setManualClientInput(false);
                handleInputChange('client_name', '');
                handleInputChange('pan', '');
              } else {
                setManualClientInput(false);
                const client = onboardedClients.find(c => c.id === val);
                if (client) {
                  handleInputChange('client_name', client.applicant_name);
                  handleInputChange('pan', client.pan || '');
                }
              }
            }}
            className="mis-select font-semibold cursor-pointer"
          >
            <option value="">-- Select Client Profile --</option>
            {onboardedClients.map(c => (
              <option key={c.id} value={c.id}>{c.applicant_name} ({c.pan})</option>
            ))}
            <option value="manual">✍️ Type Client Details Manually...</option>
          </select>
          <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-secondary)' }}>
            Linking populated records here automatically loads name & PAN, and maintains consistency across tracker modules.
          </p>
        </div>
      </div>
    );
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

  const renderFormFields = () => {
    // Check if the current name & PAN match a linked verified client
    const isLinkedClient = !manualClientInput && onboardedClients.some(c => c.applicant_name === formData.client_name && c.pan === formData.pan);

    switch (sheetTab) {
      case 'new_account':
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mis-field">
                <label className="mis-label">Applicant Name</label>
                <input type="text" value={formData.applicant_name} onChange={(e) => handleInputChange('applicant_name', e.target.value)} placeholder="Full Name" className="mis-input" required />
              </div>
              <div className="mis-field">
                <label className="mis-label">PAN Card Number</label>
                <input type="text" value={formData.pan} onChange={(e) => handleInputChange('pan', e.target.value.toUpperCase())} placeholder="ABCDE1234F" className="mis-input" maxLength={10} required />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="mis-field">
                <label className="mis-label">Aadhaar Number</label>
                <input type="text" value={formData.aadhaar_number} onChange={(e) => handleInputChange('aadhaar_number', e.target.value)} placeholder="12-digit Number" className="mis-input" maxLength={12} required />
              </div>
              <div className="mis-field">
                <label className="mis-label">Mobile Number</label>
                <input type="text" value={formData.mobile_number} onChange={(e) => handleInputChange('mobile_number', e.target.value)} placeholder="10-digit Mobile" className="mis-input" maxLength={10} required />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="mis-field">
                <label className="mis-label">Email</label>
                <input type="email" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} placeholder="email@domain.com" className="mis-input" required />
              </div>
              <div className="mis-field">
                <label className="mis-label">Date of Birth</label>
                <input type="date" value={formData.date_of_birth} onChange={(e) => handleInputChange('date_of_birth', e.target.value)} className="mis-input" required />
              </div>
            </div>
            <div className="mis-field mt-4">
              <label className="mis-label">Address</label>
              <textarea value={formData.address} onChange={(e) => handleInputChange('address', e.target.value)} placeholder="Resident Address" className="mis-textarea" rows={3} required />
            </div>

            {/* Checklist */}
            <div className="mt-6 border p-4 rounded-lg animate-fade-in" style={{ background: 'var(--panel-inset-soft)', borderColor: 'var(--border)' }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Documents Checklist</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <label className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={formData.pan_copy} onChange={(e) => handleInputChange('pan_copy', e.target.checked)} className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4" />
                  PAN Copy
                </label>
                <label className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={formData.aadhaar_copy} onChange={(e) => handleInputChange('aadhaar_copy', e.target.checked)} className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4" />
                  Aadhaar Copy
                </label>
                <label className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={formData.bank_proof} onChange={(e) => handleInputChange('bank_proof', e.target.checked)} className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4" />
                  Bank Proof
                </label>
                <label className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={formData.photograph} onChange={(e) => handleInputChange('photograph', e.target.checked)} className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4" />
                  Photograph
                </label>
                <label className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={formData.signature} onChange={(e) => handleInputChange('signature', e.target.checked)} className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4" />
                  Signature
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="mis-field">
                <label className="mis-label">Verified By</label>
                <input type="text" value={formData.verified_by || ''} onChange={(e) => handleInputChange('verified_by', e.target.value)} placeholder="Verifier Name" className="mis-input" />
              </div>
              <div className="mis-field">
                <label className="mis-label">Verification Date</label>
                <input type="date" value={formData.verification_date || ''} onChange={(e) => handleInputChange('verification_date', e.target.value)} className="mis-input" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 mt-4">
              <div className="mis-field">
                <label className="mis-label">Verification Status</label>
                <select value={formData.status} onChange={(e) => handleInputChange('status', e.target.value)} className="mis-select">
                  <option value="Pending">Pending</option>
                  <option value="Verified">Verified</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>
            <div className="mis-field mt-4">
              <label className="mis-label">Remarks</label>
              <textarea value={formData.remarks || ''} onChange={(e) => handleInputChange('remarks', e.target.value)} placeholder="Internal comments..." className="mis-textarea" rows={2} />
            </div>
          </>
        );

      case 'ucc_allotment':
        return (
          <>
            {renderClientSelectionBlock()}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mis-field">
                <label className="mis-label">Client Name</label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => handleInputChange('client_name', e.target.value)}
                  placeholder="Full Name"
                  className="mis-input"
                  readOnly={isLinkedClient}
                  style={{ opacity: isLinkedClient ? 0.7 : 1 }}
                  required
                />
              </div>
              <div className="mis-field">
                <label className="mis-label">PAN Card Number</label>
                <input
                  type="text"
                  value={formData.pan}
                  onChange={(e) => handleInputChange('pan', e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  className="mis-input"
                  maxLength={10}
                  readOnly={isLinkedClient}
                  style={{ opacity: isLinkedClient ? 0.7 : 1 }}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="mis-field">
                <label className="mis-label">Exchange</label>
                <select value={formData.exchange} onChange={(e) => handleInputChange('exchange', e.target.value)} className="mis-select">
                  <option value="NSE">NSE</option>
                  <option value="BSE">BSE</option>
                </select>
              </div>
              <div className="mis-field">
                <label className="mis-label">Segment</label>
                <select value={formData.segment} onChange={(e) => handleInputChange('segment', e.target.value)} className="mis-select">
                  <option value="Cash">Cash</option>
                  <option value="F&O">F&O</option>
                  <option value="Currency">Currency</option>
                  <option value="Commodity">Commodity</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="mis-field">
                <label className="mis-label">UCC Code</label>
                <input type="text" value={formData.ucc_code || ''} onChange={(e) => handleInputChange('ucc_code', e.target.value)} placeholder="Trading Code" className="mis-input" />
              </div>
              <div className="mis-field">
                <label className="mis-label">Upload Date</label>
                <input type="date" value={formData.upload_date || ''} onChange={(e) => handleInputChange('upload_date', e.target.value)} className="mis-input" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="mis-field">
                <label className="mis-label">Confirmation Date</label>
                <input type="date" value={formData.confirmation_date || ''} onChange={(e) => handleInputChange('confirmation_date', e.target.value)} className="mis-input" />
              </div>
              <div className="mis-field">
                <label className="mis-label">Status</label>
                <select value={formData.status} onChange={(e) => handleInputChange('status', e.target.value)} className="mis-select">
                  <option value="Pending">Pending</option>
                  <option value="Uploaded">Uploaded</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>
          </>
        );

      case 'registry_updation':
        return (
          <>
            {renderClientSelectionBlock()}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mis-field">
                <label className="mis-label">Client Name</label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => handleInputChange('client_name', e.target.value)}
                  placeholder="Full Name"
                  className="mis-input"
                  readOnly={isLinkedClient}
                  style={{ opacity: isLinkedClient ? 0.7 : 1 }}
                  required
                />
              </div>
              <div className="mis-field">
                <label className="mis-label">PAN Card Number</label>
                <input
                  type="text"
                  value={formData.pan}
                  onChange={(e) => handleInputChange('pan', e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  className="mis-input"
                  maxLength={10}
                  readOnly={isLinkedClient}
                  style={{ opacity: isLinkedClient ? 0.7 : 1 }}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="mis-field">
                <label className="mis-label">Registry</label>
                <select value={formData.registry} onChange={(e) => handleInputChange('registry', e.target.value)} className="mis-select">
                  <option value="CKYC">CKYC</option>
                  <option value="KRA">KRA</option>
                </select>
              </div>
              <div className="mis-field">
                <label className="mis-label">Upload Date</label>
                <input type="date" value={formData.upload_date || ''} onChange={(e) => handleInputChange('upload_date', e.target.value)} className="mis-input" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="mis-field">
                <label className="mis-label">Status</label>
                <select value={formData.status} onChange={(e) => handleInputChange('status', e.target.value)} className="mis-select">
                  <option value="Pending">Pending</option>
                  <option value="Verified">Verified</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              {formData.status === 'Rejected' && (
                <div className="mis-field">
                  <label className="mis-label">Rejection Reason</label>
                  <input type="text" value={formData.rejection_reason || ''} onChange={(e) => handleInputChange('rejection_reason', e.target.value)} placeholder="Why was it rejected?" className="mis-input" required />
                </div>
              )}
            </div>
          </>
        );

      case 'ap_sharing':
        return (
          <>
            {renderClientSelectionBlock()}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mis-field">
                <label className="mis-label">AP Name</label>
                <input type="text" value={formData.ap_name} onChange={(e) => handleInputChange('ap_name', e.target.value)} placeholder="Authorized Person Name" className="mis-input" required />
              </div>
              <div className="mis-field">
                <label className="mis-label">AP Code</label>
                <input type="text" value={formData.ap_code} onChange={(e) => handleInputChange('ap_code', e.target.value)} placeholder="Exchange AP Code" className="mis-input" required />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="mis-field">
                <label className="mis-label">Client Name</label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => handleInputChange('client_name', e.target.value)}
                  placeholder="Onboarded Client Name"
                  className="mis-input"
                  readOnly={isLinkedClient}
                  style={{ opacity: isLinkedClient ? 0.7 : 1 }}
                  required
                />
              </div>
              <div className="mis-field">
                <label className="mis-label">Sharing Percentage (%)</label>
                <input type="number" step="0.01" min="0" max="100" value={formData.sharing_percentage} onChange={(e) => handleInputChange('sharing_percentage', e.target.value)} placeholder="e.g. 50.00" className="mis-input" required />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="mis-field">
                <label className="mis-label">Effective Date</label>
                <input type="date" value={formData.effective_date} onChange={(e) => handleInputChange('effective_date', e.target.value)} className="mis-input" required />
              </div>
              <div className="mis-field">
                <label className="mis-label">Status</label>
                <select value={formData.status} onChange={(e) => handleInputChange('status', e.target.value)} className="mis-select">
                  <option value="Active">Active</option>
                  <option value="Revised">Revised</option>
                  <option value="Terminated">Terminated</option>
                </select>
              </div>
            </div>
          </>
        );

      case 'demise_reporting':
        return (
          <>
            {renderClientSelectionBlock()}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mis-field">
                <label className="mis-label">Client Name</label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => handleInputChange('client_name', e.target.value)}
                  placeholder="Deceased Client Name"
                  className="mis-input"
                  readOnly={isLinkedClient}
                  style={{ opacity: isLinkedClient ? 0.7 : 1 }}
                  required
                />
              </div>
              <div className="mis-field">
                <label className="mis-label">PAN Card Number</label>
                <input
                  type="text"
                  value={formData.pan}
                  onChange={(e) => handleInputChange('pan', e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  className="mis-input"
                  maxLength={10}
                  readOnly={isLinkedClient}
                  style={{ opacity: isLinkedClient ? 0.7 : 1 }}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="mis-field">
                <label className="mis-label">Date of Demise</label>
                <input type="date" value={formData.date_of_demise} onChange={(e) => handleInputChange('date_of_demise', e.target.value)} className="mis-input" required />
              </div>
              <div className="mis-field">
                <label className="mis-label">Reported Date</label>
                <input type="date" value={formData.reported_date} onChange={(e) => handleInputChange('reported_date', e.target.value)} className="mis-input" required />
              </div>
            </div>

            {/* File Upload */}
            <div className="mis-field mt-4">
              <label className="mis-label">Death Certificate (Upload PDF/Image)</label>
              <div className="flex items-center gap-3">
                <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, 'death_certificate_url')} className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-teal-50 dark:file:bg-slate-700 file:text-teal-700 dark:file:text-slate-200 hover:file:bg-teal-100 cursor-pointer" />
                {formData.death_certificate_url && (
                  <a href={formData.death_certificate_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold underline shrink-0" style={{ color: 'var(--accent)' }}>
                    View File
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="mis-field">
                <label className="mis-label">Status</label>
                <select value={formData.status} onChange={(e) => handleInputChange('status', e.target.value)} className="mis-select">
                  <option value="Reported">Reported</option>
                  <option value="Forwarded to DP">Forwarded to DP</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div className="mis-field">
                <label className="mis-label">Remarks</label>
                <input type="text" value={formData.remarks || ''} onChange={(e) => handleInputChange('remarks', e.target.value)} placeholder="Transmission notes..." className="mis-input" />
              </div>
            </div>
          </>
        );

      case 'ap_code_exchange':
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mis-field">
                <label className="mis-label">AP Name</label>
                <input type="text" value={formData.ap_name} onChange={(e) => handleInputChange('ap_name', e.target.value)} placeholder="AP Full Name" className="mis-input" required />
              </div>
              <div className="mis-field">
                <label className="mis-label">AP Code</label>
                <input type="text" value={formData.ap_code} onChange={(e) => handleInputChange('ap_code', e.target.value)} placeholder="AP Code" className="mis-input" required />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="mis-field">
                <label className="mis-label">Exchange</label>
                <select value={formData.exchange} onChange={(e) => handleInputChange('exchange', e.target.value)} className="mis-select">
                  <option value="NSE">NSE</option>
                  <option value="BSE">BSE</option>
                </select>
              </div>
              <div className="mis-field">
                <label className="mis-label">Upload Date</label>
                <input type="date" value={formData.upload_date} onChange={(e) => handleInputChange('upload_date', e.target.value)} className="mis-input" required />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 mt-4">
              <div className="mis-field">
                <label className="mis-label">Status</label>
                <select value={formData.status} onChange={(e) => handleInputChange('status', e.target.value)} className="mis-select">
                  <option value="Pending">Pending</option>
                  <option value="Confirmed">Confirmed</option>
                </select>
              </div>
            </div>
          </>
        );

      case 'onboarding_communication':
        return (
          <>
            {renderClientSelectionBlock()}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mis-field">
                <label className="mis-label">Client Name</label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => handleInputChange('client_name', e.target.value)}
                  placeholder="Client Name"
                  className="mis-input"
                  readOnly={isLinkedClient}
                  style={{ opacity: isLinkedClient ? 0.7 : 1 }}
                  required
                />
              </div>
              <div className="mis-field">
                <label className="mis-label">Communication Mode</label>
                <select value={formData.mode} onChange={(e) => handleInputChange('mode', e.target.value)} className="mis-select">
                  <option value="Letter">Letter</option>
                  <option value="SMS">SMS</option>
                  <option value="Call">Call</option>
                  <option value="Email">Email</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="mis-field">
                <label className="mis-label">Sent Date</label>
                <input type="date" value={formData.sent_date} onChange={(e) => handleInputChange('sent_date', e.target.value)} className="mis-input" required />
              </div>
              <div className="mis-field">
                <label className="mis-label">Status</label>
                <select value={formData.status} onChange={(e) => handleInputChange('status', e.target.value)} className="mis-select">
                  <option value="Sent">Sent</option>
                  <option value="Failed">Failed</option>
                  <option value="Not Reachable">Not Reachable</option>
                </select>
              </div>
            </div>
            <div className="mis-field mt-4">
              <label className="mis-label">Remarks</label>
              <textarea value={formData.remarks || ''} onChange={(e) => handleInputChange('remarks', e.target.value)} placeholder="Communication feedback..." className="mis-textarea" rows={2} />
            </div>
          </>
        );

      case 'modification_requests':
        return (
          <>
            {renderClientSelectionBlock()}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mis-field">
                <label className="mis-label">Client Name</label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => handleInputChange('client_name', e.target.value)}
                  placeholder="Client Name"
                  className="mis-input"
                  readOnly={isLinkedClient}
                  style={{ opacity: isLinkedClient ? 0.7 : 1 }}
                  required
                />
              </div>
              <div className="mis-field">
                <label className="mis-label">PAN Card Number</label>
                <input
                  type="text"
                  value={formData.pan}
                  onChange={(e) => handleInputChange('pan', e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  className="mis-input"
                  maxLength={10}
                  readOnly={isLinkedClient}
                  style={{ opacity: isLinkedClient ? 0.7 : 1 }}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="mis-field">
                <label className="mis-label">Modification Type</label>
                <select value={formData.modification_type} onChange={(e) => handleInputChange('modification_type', e.target.value)} className="mis-select">
                  <option value="Address">Address</option>
                  <option value="Mobile">Mobile</option>
                  <option value="Email">Email</option>
                  <option value="Bank Details">Bank Details</option>
                  <option value="Nomination">Nomination</option>
                  <option value="Signature">Signature</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="mis-field">
                <label className="mis-label">Request Date</label>
                <input type="date" value={formData.request_date} onChange={(e) => handleInputChange('request_date', e.target.value)} className="mis-input" required />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="mis-field">
                <label className="mis-label">Old Value</label>
                <textarea value={formData.old_value || ''} onChange={(e) => handleInputChange('old_value', e.target.value)} placeholder="Previous record state" className="mis-textarea" rows={2} />
              </div>
              <div className="mis-field">
                <label className="mis-label">New Value</label>
                <textarea value={formData.new_value || ''} onChange={(e) => handleInputChange('new_value', e.target.value)} placeholder="Modified state to apply" className="mis-textarea" rows={2} />
              </div>
            </div>

            {/* File Upload */}
            <div className="mis-field mt-4">
              <label className="mis-label">Supporting Document (Upload PDF/Image)</label>
              <div className="flex items-center gap-3">
                <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, 'supporting_document_url')} className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-teal-50 dark:file:bg-slate-700 file:text-teal-700 dark:file:text-slate-200 hover:file:bg-teal-100 cursor-pointer" />
                {formData.supporting_document_url && (
                  <a href={formData.supporting_document_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold underline shrink-0" style={{ color: 'var(--accent)' }}>
                    View File
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="mis-field">
                <label className="mis-label">Processed Date</label>
                <input type="date" value={formData.processed_date || ''} onChange={(e) => handleInputChange('processed_date', e.target.value)} className="mis-input" />
              </div>
              <div className="mis-field">
                <label className="mis-label">Status</label>
                <select value={formData.status} onChange={(e) => handleInputChange('status', e.target.value)} className="mis-select">
                  <option value="Pending">Pending</option>
                  <option value="Processed">Processed</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>
          </>
        );

      case 'reactivation':
        return (
          <>
            {renderClientSelectionBlock()}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mis-field">
                <label className="mis-label">Client Name</label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => handleInputChange('client_name', e.target.value)}
                  placeholder="Client Name"
                  className="mis-input"
                  readOnly={isLinkedClient}
                  style={{ opacity: isLinkedClient ? 0.7 : 1 }}
                  required
                />
              </div>
              <div className="mis-field">
                <label className="mis-label">PAN Card Number</label>
                <input
                  type="text"
                  value={formData.pan}
                  onChange={(e) => handleInputChange('pan', e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  className="mis-input"
                  maxLength={10}
                  readOnly={isLinkedClient}
                  style={{ opacity: isLinkedClient ? 0.7 : 1 }}
                  required
                />
              </div>
            </div>
            <div className="mis-field mt-4">
              <label className="mis-label">Reason for Reactivation</label>
              <textarea value={formData.reason} onChange={(e) => handleInputChange('reason', e.target.value)} placeholder="e.g. Account was suspended/dormant..." className="mis-textarea" rows={2} required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="mis-field">
                <label className="mis-label">Request Date</label>
                <input type="date" value={formData.request_date} onChange={(e) => handleInputChange('request_date', e.target.value)} className="mis-input" required />
              </div>
              <div className="mis-field">
                <label className="mis-label">Processed Date</label>
                <input type="date" value={formData.processed_date || ''} onChange={(e) => handleInputChange('processed_date', e.target.value)} className="mis-input" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 mt-4">
              <div className="mis-field">
                <label className="mis-label">Status</label>
                <select value={formData.status} onChange={(e) => handleInputChange('status', e.target.value)} className="mis-select">
                  <option value="Pending">Pending</option>
                  <option value="Processed">Processed</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>
          </>
        );

      case 'account_closure':
        return (
          <>
            {renderClientSelectionBlock()}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mis-field">
                <label className="mis-label">Client Name</label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => handleInputChange('client_name', e.target.value)}
                  placeholder="Client Name"
                  className="mis-input"
                  readOnly={isLinkedClient}
                  style={{ opacity: isLinkedClient ? 0.7 : 1 }}
                  required
                />
              </div>
              <div className="mis-field">
                <label className="mis-label">PAN Card Number</label>
                <input
                  type="text"
                  value={formData.pan}
                  onChange={(e) => handleInputChange('pan', e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  className="mis-input"
                  maxLength={10}
                  readOnly={isLinkedClient}
                  style={{ opacity: isLinkedClient ? 0.7 : 1 }}
                  required
                />
              </div>
            </div>
            <div className="mis-field mt-4">
              <label className="mis-label">Reason for Closure</label>
              <textarea value={formData.reason} onChange={(e) => handleInputChange('reason', e.target.value)} placeholder="Why is client closing UCC?" className="mis-textarea" rows={2} required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="mis-field">
                <label className="mis-label">Request Date</label>
                <input type="date" value={formData.request_date} onChange={(e) => handleInputChange('request_date', e.target.value)} className="mis-input" required />
              </div>
              <div className="mis-field">
                <label className="mis-label">Closure Date</label>
                <input type="date" value={formData.closure_date || ''} onChange={(e) => handleInputChange('closure_date', e.target.value)} className="mis-input" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 mt-4">
              <div className="mis-field">
                <label className="mis-label">Status</label>
                <select value={formData.status} onChange={(e) => handleInputChange('status', e.target.value)} className="mis-select">
                  <option value="Pending">Pending</option>
                  <option value="Processed">Processed</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>
          </>
        );

      case 'exchange_compliance':
        return (
          <>
            {renderClientSelectionBlock()}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mis-field">
                <label className="mis-label">Client Name</label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => handleInputChange('client_name', e.target.value)}
                  placeholder="Client Name"
                  className="mis-input"
                  readOnly={isLinkedClient}
                  style={{ opacity: isLinkedClient ? 0.7 : 1 }}
                  required
                />
              </div>
              <div className="mis-field">
                <label className="mis-label">PAN Card Number</label>
                <input
                  type="text"
                  value={formData.pan}
                  onChange={(e) => handleInputChange('pan', e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  className="mis-input"
                  maxLength={10}
                  readOnly={isLinkedClient}
                  style={{ opacity: isLinkedClient ? 0.7 : 1 }}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="mis-field">
                <label className="mis-label">Compliance Item</label>
                <select value={formData.compliance_item} onChange={(e) => handleInputChange('compliance_item', e.target.value)} className="mis-select">
                  <option value="PAN-Aadhaar Linkage">PAN-Aadhaar Linkage</option>
                  <option value="Annual KYC Refresh">Annual KYC Refresh</option>
                  <option value="Nomination Opt-in/Opt-out">Nomination Opt-in/Opt-out</option>
                  <option value="Other Exchange Mandate">Other Exchange Mandate</option>
                </select>
              </div>
              <div className="mis-field">
                <label className="mis-label">Due Date</label>
                <input type="date" value={formData.due_date || ''} onChange={(e) => handleInputChange('due_date', e.target.value)} className="mis-input" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 mt-4">
              <div className="mis-field">
                <label className="mis-label">Status</label>
                <select value={formData.status} onChange={(e) => handleInputChange('status', e.target.value)} className="mis-select">
                  <option value="Compliant">Compliant</option>
                  <option value="Non-Compliant">Non-Compliant</option>
                  <option value="Due">Due</option>
                </select>
              </div>
            </div>
          </>
        );
    }
  };

  const renderTableHeader = () => {
    switch (sheetTab) {
      case 'new_account':
        return (
          <>
            <th>Applicant Name</th>
            <th>PAN</th>
            <th>Aadhaar</th>
            <th>Mobile</th>
            <th>DOB</th>
            <th>Checklist Status</th>
            <th>Status</th>
            <th>Verified By</th>
            <th>Branch</th>
            <th>Actions</th>
          </>
        );
      case 'ucc_allotment':
        return (
          <>
            <th>Client Name</th>
            <th>PAN</th>
            <th>Exchange</th>
            <th>Segment</th>
            <th>UCC Code</th>
            <th>Upload Date</th>
            <th>Status</th>
            <th>Branch</th>
            <th>Actions</th>
          </>
        );
      case 'registry_updation':
        return (
          <>
            <th>Client Name</th>
            <th>PAN</th>
            <th>Registry</th>
            <th>Upload Date</th>
            <th>Status</th>
            <th>Rejection Details</th>
            <th>Branch</th>
            <th>Actions</th>
          </>
        );
      case 'ap_sharing':
        return (
          <>
            <th>AP Name</th>
            <th>AP Code</th>
            <th>Client Name</th>
            <th>Sharing %</th>
            <th>Effective Date</th>
            <th>Status</th>
            <th>Branch</th>
            <th>Actions</th>
          </>
        );
      case 'demise_reporting':
        return (
          <>
            <th>Client Name</th>
            <th>PAN</th>
            <th>Demise Date</th>
            <th>Reported Date</th>
            <th>Certificate</th>
            <th>Status</th>
            <th>Branch</th>
            <th>Actions</th>
          </>
        );
      case 'ap_code_exchange':
        return (
          <>
            <th>AP Name</th>
            <th>AP Code</th>
            <th>Exchange</th>
            <th>Upload Date</th>
            <th>Status</th>
            <th>Branch</th>
            <th>Actions</th>
          </>
        );
      case 'onboarding_communication':
        return (
          <>
            <th>Client Name</th>
            <th>Mode</th>
            <th>Sent Date</th>
            <th>Status</th>
            <th>Remarks</th>
            <th>Branch</th>
            <th>Actions</th>
          </>
        );
      case 'modification_requests':
        return (
          <>
            <th>Client Name</th>
            <th>PAN</th>
            <th>Type</th>
            <th>Old / New Values</th>
            <th>Document</th>
            <th>Status</th>
            <th>Branch</th>
            <th>Actions</th>
          </>
        );
      case 'reactivation':
        return (
          <>
            <th>Client Name</th>
            <th>PAN</th>
            <th>Reason</th>
            <th>Request Date</th>
            <th>Processed Date</th>
            <th>Status</th>
            <th>Branch</th>
            <th>Actions</th>
          </>
        );
      case 'account_closure':
        return (
          <>
            <th>Client Name</th>
            <th>PAN</th>
            <th>Reason</th>
            <th>Request Date</th>
            <th>Closure Date</th>
            <th>Status</th>
            <th>Branch</th>
            <th>Actions</th>
          </>
        );
      case 'exchange_compliance':
        return (
          <>
            <th>Client Name</th>
            <th>PAN</th>
            <th>Compliance Item</th>
            <th>Due Date</th>
            <th>Status</th>
            <th>Branch</th>
            <th>Actions</th>
          </>
        );
    }
  };

  const renderTableRow = (record: any) => {
    const branchName = record.branches?.name || 'N/A';

    const getStatusPill = (status: string) => {
      let colorClass = "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300";
      if (['Verified', 'Confirmed', 'Processed', 'Active', 'Compliant', 'Sent'].includes(status)) {
        colorClass = "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
      } else if (['Pending', 'Uploaded', 'Due', 'Reported', 'Forwarded to DP', 'Revised'].includes(status)) {
        colorClass = "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      } else if (['Rejected', 'Terminated', 'Failed', 'Closed', 'Non-Compliant'].includes(status)) {
        colorClass = "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400";
      }
      return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colorClass}`}>{status}</span>;
    };

    switch (sheetTab) {
      case 'new_account':
        const checklistCount = [record.pan_copy, record.aadhaar_copy, record.bank_proof, record.photograph, record.signature].filter(Boolean).length;
        return (
          <tr key={record.id}>{renderRowCheckbox(record)}
            <td className="whitespace-nowrap text-xs font-semibold">{record.applicant_name}</td>
            <td className="whitespace-nowrap text-xs">{record.pan}</td>
            <td className="whitespace-nowrap text-xs">{record.aadhaar_number}</td>
            <td className="whitespace-nowrap text-xs">{record.mobile_number}</td>
            <td className="whitespace-nowrap text-xs">{record.date_of_birth}</td>
            <td className="whitespace-nowrap text-xs">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded border" style={{ background: 'var(--panel-inset-soft)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                📁 {checklistCount}/5 Docs
              </span>
            </td>
            <td className="whitespace-nowrap text-xs">{getStatusPill(record.status)}</td>
            <td className="whitespace-nowrap text-xs font-semibold">{record.verified_by || '-'}</td>
            <td className="whitespace-nowrap text-xs font-semibold">{branchName}</td>
            <td>
              <button onClick={() => setViewingRecord(record)} className="hover:underline text-xs font-bold mr-2" style={{ color: 'var(--text-secondary)' }}>View</button>
              <button onClick={() => handleEdit(record)} className="hover:underline text-xs font-bold mr-2" style={{ color: 'var(--accent)' }}>Edit</button>
              <button onClick={() => handleDelete(record.id)} className="hover:underline text-xs font-bold text-red-400 hover:text-red-300">Delete</button>
            </td>
          </tr>
        );

      case 'ucc_allotment':
        return (
          <tr key={record.id}>{renderRowCheckbox(record)}
            <td className="whitespace-nowrap text-xs font-semibold">{record.client_name}</td>
            <td className="whitespace-nowrap text-xs">{record.pan}</td>
            <td className="whitespace-nowrap text-xs">{record.exchange}</td>
            <td className="whitespace-nowrap text-xs">{record.segment}</td>
            <td className="whitespace-nowrap text-xs font-semibold">{record.ucc_code || '-'}</td>
            <td className="whitespace-nowrap text-xs">{record.upload_date || '-'}</td>
            <td className="whitespace-nowrap text-xs">{getStatusPill(record.status)}</td>
            <td className="whitespace-nowrap text-xs font-semibold">{branchName}</td>
            <td>
              <button onClick={() => setViewingRecord(record)} className="hover:underline text-xs font-bold mr-2" style={{ color: 'var(--text-secondary)' }}>View</button>
              <button onClick={() => handleEdit(record)} className="hover:underline text-xs font-bold mr-2" style={{ color: 'var(--accent)' }}>Edit</button>
              <button onClick={() => handleDelete(record.id)} className="hover:underline text-xs font-bold text-red-400 hover:text-red-300">Delete</button>
            </td>
          </tr>
        );

      case 'registry_updation':
        return (
          <tr key={record.id}>{renderRowCheckbox(record)}
            <td className="whitespace-nowrap text-xs font-semibold">{record.client_name}</td>
            <td className="whitespace-nowrap text-xs">{record.pan}</td>
            <td className="whitespace-nowrap text-xs">{record.registry}</td>
            <td className="whitespace-nowrap text-xs">{record.upload_date || '-'}</td>
            <td className="whitespace-nowrap text-xs">{getStatusPill(record.status)}</td>
            <td className="whitespace-nowrap text-xs">{record.rejection_reason || '-'}</td>
            <td className="whitespace-nowrap text-xs font-semibold">{branchName}</td>
            <td>
              <button onClick={() => setViewingRecord(record)} className="hover:underline text-xs font-bold mr-2" style={{ color: 'var(--text-secondary)' }}>View</button>
              <button onClick={() => handleEdit(record)} className="hover:underline text-xs font-bold mr-2" style={{ color: 'var(--accent)' }}>Edit</button>
              <button onClick={() => handleDelete(record.id)} className="hover:underline text-xs font-bold text-red-400 hover:text-red-300">Delete</button>
            </td>
          </tr>
        );

      case 'ap_sharing':
        return (
          <tr key={record.id}>{renderRowCheckbox(record)}
            <td className="whitespace-nowrap text-xs font-semibold">{record.ap_name}</td>
            <td className="whitespace-nowrap text-xs font-semibold">{record.ap_code}</td>
            <td className="whitespace-nowrap text-xs font-semibold">{record.client_name}</td>
            <td className="whitespace-nowrap text-xs font-semibold">{record.sharing_percentage}%</td>
            <td className="whitespace-nowrap text-xs">{record.effective_date}</td>
            <td className="whitespace-nowrap text-xs">{getStatusPill(record.status)}</td>
            <td className="whitespace-nowrap text-xs font-semibold">{branchName}</td>
            <td>
              <button onClick={() => setViewingRecord(record)} className="hover:underline text-xs font-bold mr-2" style={{ color: 'var(--text-secondary)' }}>View</button>
              <button onClick={() => handleEdit(record)} className="hover:underline text-xs font-bold mr-2" style={{ color: 'var(--accent)' }}>Edit</button>
              <button onClick={() => handleDelete(record.id)} className="hover:underline text-xs font-bold text-red-400 hover:text-red-300">Delete</button>
            </td>
          </tr>
        );

      case 'demise_reporting':
        return (
          <tr key={record.id}>{renderRowCheckbox(record)}
            <td className="whitespace-nowrap text-xs font-semibold">{record.client_name}</td>
            <td className="whitespace-nowrap text-xs">{record.pan}</td>
            <td className="whitespace-nowrap text-xs">{record.date_of_demise}</td>
            <td className="whitespace-nowrap text-xs">{record.reported_date}</td>
            <td className="whitespace-nowrap text-xs">
              {record.death_certificate_url ? (
                <a href={record.death_certificate_url} target="_blank" rel="noopener noreferrer" className="underline font-semibold" style={{ color: 'var(--accent)' }}>
                  📄 View
                </a>
              ) : (
                'No File'
              )}
            </td>
            <td className="whitespace-nowrap text-xs">{getStatusPill(record.status)}</td>
            <td className="whitespace-nowrap text-xs font-semibold">{branchName}</td>
            <td>
              <button onClick={() => setViewingRecord(record)} className="hover:underline text-xs font-bold mr-2" style={{ color: 'var(--text-secondary)' }}>View</button>
              <button onClick={() => handleEdit(record)} className="hover:underline text-xs font-bold mr-2" style={{ color: 'var(--accent)' }}>Edit</button>
              <button onClick={() => handleDelete(record.id)} className="hover:underline text-xs font-bold text-red-400 hover:text-red-300">Delete</button>
            </td>
          </tr>
        );

      case 'ap_code_exchange':
        return (
          <tr key={record.id}>{renderRowCheckbox(record)}
            <td className="whitespace-nowrap text-xs font-semibold">{record.ap_name}</td>
            <td className="whitespace-nowrap text-xs font-semibold">{record.ap_code}</td>
            <td className="whitespace-nowrap text-xs">{record.exchange}</td>
            <td className="whitespace-nowrap text-xs">{record.upload_date}</td>
            <td className="whitespace-nowrap text-xs">{getStatusPill(record.status)}</td>
            <td className="whitespace-nowrap text-xs font-semibold">{branchName}</td>
            <td>
              <button onClick={() => setViewingRecord(record)} className="hover:underline text-xs font-bold mr-2" style={{ color: 'var(--text-secondary)' }}>View</button>
              <button onClick={() => handleEdit(record)} className="hover:underline text-xs font-bold mr-2" style={{ color: 'var(--accent)' }}>Edit</button>
              <button onClick={() => handleDelete(record.id)} className="hover:underline text-xs font-bold text-red-400 hover:text-red-300">Delete</button>
            </td>
          </tr>
        );

      case 'onboarding_communication':
        return (
          <tr key={record.id}>{renderRowCheckbox(record)}
            <td className="whitespace-nowrap text-xs font-semibold">{record.client_name}</td>
            <td className="whitespace-nowrap text-xs">{record.mode}</td>
            <td className="whitespace-nowrap text-xs">{record.sent_date}</td>
            <td className="whitespace-nowrap text-xs">{getStatusPill(record.status)}</td>
            <td className="whitespace-nowrap text-xs">{record.remarks || '-'}</td>
            <td className="whitespace-nowrap text-xs font-semibold">{branchName}</td>
            <td>
              <button onClick={() => setViewingRecord(record)} className="hover:underline text-xs font-bold mr-2" style={{ color: 'var(--text-secondary)' }}>View</button>
              <button onClick={() => handleEdit(record)} className="hover:underline text-xs font-bold mr-2" style={{ color: 'var(--accent)' }}>Edit</button>
              <button onClick={() => handleDelete(record.id)} className="hover:underline text-xs font-bold text-red-400 hover:text-red-300">Delete</button>
            </td>
          </tr>
        );

      case 'modification_requests':
        return (
          <tr key={record.id}>{renderRowCheckbox(record)}
            <td className="whitespace-nowrap text-xs font-semibold">{record.client_name}</td>
            <td className="whitespace-nowrap text-xs">{record.pan}</td>
            <td className="whitespace-nowrap text-xs">{record.modification_type}</td>
            <td className="whitespace-nowrap text-xs">
              <div className="max-w-xs overflow-hidden text-ellipsis">
                <span className="text-rose-600 dark:text-rose-400 line-through mr-1">{record.old_value || 'None'}</span>
                <span>→</span>
                <span className="text-emerald-600 dark:text-emerald-400 ml-1">{record.new_value || 'None'}</span>
              </div>
            </td>
            <td className="whitespace-nowrap text-xs">
              {record.supporting_document_url ? (
                <a href={record.supporting_document_url} target="_blank" rel="noopener noreferrer" className="underline font-semibold" style={{ color: 'var(--accent)' }}>
                  📄 View
                </a>
              ) : (
                'No File'
              )}
            </td>
            <td className="whitespace-nowrap text-xs">{getStatusPill(record.status)}</td>
            <td className="whitespace-nowrap text-xs font-semibold">{branchName}</td>
            <td>
              <button onClick={() => setViewingRecord(record)} className="hover:underline text-xs font-bold mr-2" style={{ color: 'var(--text-secondary)' }}>View</button>
              <button onClick={() => handleEdit(record)} className="hover:underline text-xs font-bold mr-2" style={{ color: 'var(--accent)' }}>Edit</button>
              <button onClick={() => handleDelete(record.id)} className="hover:underline text-xs font-bold text-red-400 hover:text-red-300">Delete</button>
            </td>
          </tr>
        );

      case 'reactivation':
        return (
          <tr key={record.id}>{renderRowCheckbox(record)}
            <td className="whitespace-nowrap text-xs font-semibold">{record.client_name}</td>
            <td className="whitespace-nowrap text-xs">{record.pan}</td>
            <td className="whitespace-nowrap text-xs">
              <div className="max-w-xs overflow-hidden text-ellipsis">{record.reason}</div>
            </td>
            <td className="whitespace-nowrap text-xs">{record.request_date}</td>
            <td className="whitespace-nowrap text-xs">{record.processed_date || '-'}</td>
            <td className="whitespace-nowrap text-xs">{getStatusPill(record.status)}</td>
            <td className="whitespace-nowrap text-xs font-semibold">{branchName}</td>
            <td>
              <button onClick={() => setViewingRecord(record)} className="hover:underline text-xs font-bold mr-2" style={{ color: 'var(--text-secondary)' }}>View</button>
              <button onClick={() => handleEdit(record)} className="hover:underline text-xs font-bold mr-2" style={{ color: 'var(--accent)' }}>Edit</button>
              <button onClick={() => handleDelete(record.id)} className="hover:underline text-xs font-bold text-red-400 hover:text-red-300">Delete</button>
            </td>
          </tr>
        );

      case 'account_closure':
        return (
          <tr key={record.id}>{renderRowCheckbox(record)}
            <td className="whitespace-nowrap text-xs font-semibold">{record.client_name}</td>
            <td className="whitespace-nowrap text-xs">{record.pan}</td>
            <td className="whitespace-nowrap text-xs">
              <div className="max-w-xs overflow-hidden text-ellipsis">{record.reason}</div>
            </td>
            <td className="whitespace-nowrap text-xs">{record.request_date}</td>
            <td className="whitespace-nowrap text-xs">{record.closure_date || '-'}</td>
            <td className="whitespace-nowrap text-xs">{getStatusPill(record.status)}</td>
            <td className="whitespace-nowrap text-xs font-semibold">{branchName}</td>
            <td>
              <button onClick={() => setViewingRecord(record)} className="hover:underline text-xs font-bold mr-2" style={{ color: 'var(--text-secondary)' }}>View</button>
              <button onClick={() => handleEdit(record)} className="hover:underline text-xs font-bold mr-2" style={{ color: 'var(--accent)' }}>Edit</button>
              <button onClick={() => handleDelete(record.id)} className="hover:underline text-xs font-bold text-red-400 hover:text-red-300">Delete</button>
            </td>
          </tr>
        );

      case 'exchange_compliance':
        return (
          <tr key={record.id}>{renderRowCheckbox(record)}
            <td className="whitespace-nowrap text-xs font-semibold">{record.client_name}</td>
            <td className="whitespace-nowrap text-xs">{record.pan}</td>
            <td className="whitespace-nowrap text-xs">{record.compliance_item}</td>
            <td className="whitespace-nowrap text-xs">{record.due_date || '-'}</td>
            <td className="whitespace-nowrap text-xs">{getStatusPill(record.status)}</td>
            <td className="whitespace-nowrap text-xs font-semibold">{branchName}</td>
            <td>
              <button onClick={() => setViewingRecord(record)} className="hover:underline text-xs font-bold mr-2" style={{ color: 'var(--text-secondary)' }}>View</button>
              <button onClick={() => handleEdit(record)} className="hover:underline text-xs font-bold mr-2" style={{ color: 'var(--accent)' }}>Edit</button>
              <button onClick={() => handleDelete(record.id)} className="hover:underline text-xs font-bold text-red-400 hover:text-red-300">Delete</button>
            </td>
          </tr>
        );
    }
  };

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-7xl mx-auto">
        
        {/* Page Header */}
        <div className="mis-data-entry-toolbar mb-6">
          <div className="mis-data-entry-toolbar-title">
            <h1 className="flex items-center gap-2">
              📝 KYC Department MIS Tracker
            </h1>
            <p>
              Select a tracker sheet below to manage records, verify details, and attach supporting documentation.
            </p>
          </div>
          
          <div className="w-full md:w-80 shrink-0">
            <select
              value={sheetTab}
              onChange={(e) => setSheetTab(e.target.value as SheetType)}
              className="mis-select w-full font-semibold cursor-pointer"
            >
              <option value="new_account">1. New Account Onboarding</option>
              <option value="ucc_allotment">2. UCC Allotment (NSE/BSE)</option>
              <option value="registry_updation">3. CKYC / KRA Updation</option>
              <option value="ap_sharing">4. AP / Remisier Sharing</option>
              <option value="demise_reporting">5. Demise Reporting</option>
              <option value="ap_code_exchange">6. AP Code Updation to Exchange</option>
              <option value="onboarding_communication">7. Client Onboarding Comm</option>
              <option value="modification_requests">8. Modification Requests</option>
              <option value="reactivation">9. Reactivation Request</option>
              <option value="account_closure">10. Account Closure / UCC Closure</option>
              <option value="exchange_compliance">11. Exchange Compliance Status</option>
            </select>
          </div>
        </div>

        {/* Tab Selection (List / Add) */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex p-1 rounded-lg" style={{ background: 'var(--panel-inset-soft)' }}>
            <button
              onClick={() => {
                setActiveTab('list');
                setEditingId(null);
              }}
              className="px-4 py-1.5 text-xs font-semibold rounded-md transition-all focus:outline-none"
              style={{
                background: activeTab === 'list' ? 'var(--bg-base)' : 'transparent',
                color: activeTab === 'list' ? 'var(--text-primary)' : 'var(--text-secondary)'
              }}
            >
              📋 View Sheet Grid
            </button>
            <button
              onClick={() => setActiveTab('register')}
              className="px-4 py-1.5 text-xs font-semibold rounded-md transition-all focus:outline-none"
              style={{
                background: activeTab === 'register' ? 'var(--bg-base)' : 'transparent',
                color: activeTab === 'register' ? 'var(--text-primary)' : 'var(--text-secondary)'
              }}
            >
              ➕ {editingId ? 'Edit Row' : 'Add New Entry'}
            </button>
          </div>

          {activeTab === 'list' && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setCsvHeaders([]);
                  setCsvRows([]);
                  setCsvMapping({});
                  setShowMappingModal(true);
                }}
                className="px-3 py-1.5 border rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                📤 Bulk Import CSV
              </button>
              <button
                onClick={() => setActiveTab('register')}
                className="mis-btn mis-btn-primary text-xs flex items-center gap-1 py-1.5"
              >
                ➕ Add Record Row
              </button>
            </div>
          )}
        </div>

        {/* List Tab Grid */}
        {activeTab === 'list' ? (
          <div className="space-y-4">
            
            {/* Batch Operations Bar */}
            {selectedRowIds.length > 0 && (
              <div 
                className="p-4 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in text-left"
                style={{ background: 'var(--panel-inset-soft)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                    🛠️ Batch Edit ({selectedRowIds.length} rows selected)
                  </span>
                  <button
                    onClick={() => setSelectedRowIds([])}
                    className="text-[10px] font-bold hover:underline"
                    style={{ color: 'var(--accent)' }}
                  >
                    Deselect All
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                  {/* Status batch edit */}
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedBatchStatus}
                      onChange={(e) => setSelectedBatchStatus(e.target.value)}
                      className="mis-select text-xs py-1.5 w-40"
                    >
                      <option value="">-- Change Status --</option>
                      {GET_SHEET_STATUS_OPTIONS(sheetTab).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleBulkUpdate({ status: selectedBatchStatus })}
                      disabled={!selectedBatchStatus || loading}
                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      Apply Status
                    </button>
                  </div>

                  {/* Checklist batch edit (Only for new_account) */}
                  {sheetTab === 'new_account' && (
                    <div className="flex flex-wrap items-center gap-3 border-l pl-4" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-[10px] font-bold" style={{ color: 'var(--text-secondary)' }}>Checklist:</span>
                      <div className="flex gap-2.5">
                        <label className="flex items-center gap-1.5 text-[10px] font-bold cursor-pointer select-none" style={{ color: 'var(--text-secondary)' }}>
                          <input
                            type="checkbox"
                            checked={batchChecklist.pan_copy}
                            onChange={(e) => setBatchChecklist(prev => ({ ...prev, pan_copy: e.target.checked }))}
                            className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                          />
                          PAN
                        </label>
                        <label className="flex items-center gap-1.5 text-[10px] font-bold cursor-pointer select-none" style={{ color: 'var(--text-secondary)' }}>
                          <input
                            type="checkbox"
                            checked={batchChecklist.aadhaar_copy}
                            onChange={(e) => setBatchChecklist(prev => ({ ...prev, aadhaar_copy: e.target.checked }))}
                            className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                          />
                          Aadhaar
                        </label>
                        <label className="flex items-center gap-1.5 text-[10px] font-bold cursor-pointer select-none" style={{ color: 'var(--text-secondary)' }}>
                          <input
                            type="checkbox"
                            checked={batchChecklist.bank_proof}
                            onChange={(e) => setBatchChecklist(prev => ({ ...prev, bank_proof: e.target.checked }))}
                            className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                          />
                          Bank Proof
                        </label>
                        <label className="flex items-center gap-1.5 text-[10px] font-bold cursor-pointer select-none" style={{ color: 'var(--text-secondary)' }}>
                          <input
                            type="checkbox"
                            checked={batchChecklist.photograph}
                            onChange={(e) => setBatchChecklist(prev => ({ ...prev, photograph: e.target.checked }))}
                            className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                          />
                          Photo
                        </label>
                        <label className="flex items-center gap-1.5 text-[10px] font-bold cursor-pointer select-none" style={{ color: 'var(--text-secondary)' }}>
                          <input
                            type="checkbox"
                            checked={batchChecklist.signature}
                            onChange={(e) => setBatchChecklist(prev => ({ ...prev, signature: e.target.checked }))}
                            className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                          />
                          Sign
                        </label>
                      </div>
                      <button
                        onClick={() => handleBulkUpdate(batchChecklist)}
                        disabled={loading}
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white text-xs font-bold rounded-lg transition-colors"
                      >
                        Apply Checklist
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Filters block */}
            <div className="flex flex-wrap gap-4 items-center p-4 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search by client name, PAN or registry..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchRecords()}
                  className="mis-input w-full text-xs"
                />
              </div>

              <div className="w-40">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="mis-select w-full text-xs"
                >
                  <option value="">All Statuses</option>
                  {sheetTab === 'new_account' || sheetTab === 'registry_updation' || sheetTab === 'modification_requests' || sheetTab === 'reactivation' || sheetTab === 'account_closure' ? (
                    <>
                      <option value="Pending">Pending</option>
                      <option value="Verified">Verified</option>
                      <option value="Processed">Processed</option>
                      <option value="Rejected">Rejected</option>
                    </>
                  ) : null}
                  {sheetTab === 'ucc_allotment' ? (
                    <>
                      <option value="Pending">Pending</option>
                      <option value="Uploaded">Uploaded</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="Rejected">Rejected</option>
                    </>
                  ) : null}
                  {sheetTab === 'ap_sharing' ? (
                    <>
                      <option value="Active">Active</option>
                      <option value="Revised">Revised</option>
                      <option value="Terminated">Terminated</option>
                    </>
                  ) : null}
                  {sheetTab === 'demise_reporting' ? (
                    <>
                      <option value="Reported">Reported</option>
                      <option value="Forwarded to DP">Forwarded to DP</option>
                      <option value="Closed">Closed</option>
                    </>
                  ) : null}
                  {sheetTab === 'ap_code_exchange' ? (
                    <>
                      <option value="Pending">Pending</option>
                      <option value="Confirmed">Confirmed</option>
                    </>
                  ) : null}
                  {sheetTab === 'onboarding_communication' ? (
                    <>
                      <option value="Sent">Sent</option>
                      <option value="Failed">Failed</option>
                      <option value="Not Reachable">Not Reachable</option>
                    </>
                  ) : null}
                  {sheetTab === 'exchange_compliance' ? (
                    <>
                      <option value="Compliant">Compliant</option>
                      <option value="Non-Compliant">Non-Compliant</option>
                      <option value="Due">Due</option>
                    </>
                  ) : null}
                </select>
              </div>

              {hasMultiBranchAccess && (
                <div className="w-44">
                  <select
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    className="mis-select w-full text-xs"
                  >
                    <option value="">All Branches</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={fetchRecords}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition-colors shrink-0"
              >
                🔍 Filter
              </button>
            </div>

            {/* Table block */}
            <div className="mis-table-wrap shadow-xs">
              {fetching ? (
                <div className="flex flex-col items-center py-16">
                  <div className="mis-spinner" />
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Fetching records...</p>
                </div>
              ) : records.length === 0 ? (
                <div className="text-center py-16 text-slate-500 dark:text-slate-400 text-xs">
                  📭 No records found matching the active filters.
                </div>
              ) : (
                <table className="mis-table">
                  <thead>
                    <tr>
                      <th className="w-10 text-center select-none">
                        <input
                          type="checkbox"
                          checked={records.length > 0 && selectedRowIds.length === records.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRowIds(records.map(r => r.id));
                            } else {
                              setSelectedRowIds([]);
                            }
                          }}
                          className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                        />
                      </th>
                      {renderTableHeader()}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((rec) => renderTableRow(rec))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          /* Register Entry Tab Form + plain-English help panel */
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start max-w-6xl mx-auto">
            <div className="border rounded-xl p-6 shadow-xs" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <h2 className="text-lg font-bold mb-6 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                {editingId ? '✏️ Edit Row Entry' : '📝 Create New Row Entry'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Dynamic inputs */}
                {renderFormFields()}

                <hr className="border-slate-200 dark:border-slate-800 my-6" style={{ borderColor: 'var(--border)' }} />

                {/* Branch Assignment (Locked for non-admin/management) */}
                <div className="mis-field">
                  <label className="mis-label">Branch Office Allocation</label>
                  <select
                    value={formData.branch_id}
                    onChange={(e) => handleInputChange('branch_id', e.target.value)}
                    disabled={!hasMultiBranchAccess}
                    className="mis-select disabled:opacity-50"
                    required
                  >
                    <option value="">-- Choose Branch --</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('list');
                      setEditingId(null);
                    }}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                  >
                    {loading ? 'Saving...' : editingId ? '💾 Save Changes' : '➕ Add Record'}
                  </button>
                </div>
              </form>
            </div>

            {renderHelpPanel()}
          </div>
        )}

        {showMappingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-left">
            <div 
              className="border rounded-2xl w-full max-w-3xl overflow-hidden flex flex-col shadow-xl max-h-[85vh] animate-scale-in"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              {/* Modal Header */}
              <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                    📤 Map CSV Headers & Bulk Import
                  </h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {csvHeaders.length > 0
                      ? `Pair your uploaded CSV columns to our database field definitions. ${csvRows.length} records detected.`
                      : 'Review the required columns below, then select your CSV file to continue.'}
                  </p>
                </div>
                <button 
                  onClick={() => setShowMappingModal(false)}
                  className="text-slate-400 hover:text-slate-200 text-lg focus:outline-none"
                >
                  ✕
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">

                <CsvImportGuide
                  fields={SHEET_FIELDS[sheetTab].map((f) => ({ key: f.key, label: f.label }))}
                  templateFilename={`kyc-${sheetTab}-template.csv`}
                  sampleFileDetected={containsSampleSentinel(csvRows)}
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

                {/* Default Branch Selection for Multi-Branch Users */}
                {csvHeaders.length > 0 && hasMultiBranchAccess && (
                  <div className="p-4 border rounded-xl" style={{ background: 'var(--panel-inset-soft)', borderColor: 'var(--border)' }}>
                    <label className="text-xs font-bold block mb-1.5" style={{ color: 'var(--text-primary)' }}>
                      Select Default Branch Office for Imported Records <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={importBranchId}
                      onChange={(e) => setImportBranchId(e.target.value)}
                      className="mis-select text-xs w-full font-semibold cursor-pointer"
                      required
                    >
                      <option value="">-- Choose Branch --</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                      Since you have management access, please choose which branch office will own these imported records.
                    </p>
                  </div>
                )}

                {/* Mapping Form Grid */}
                {csvHeaders.length > 0 && (
                <>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-primary)' }}>
                    Column Mapping
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {SHEET_FIELDS[sheetTab].map((field) => (
                      <div key={field.key} className="p-3 border rounded-lg flex flex-col justify-between" style={{ background: 'var(--panel-inset-soft)', borderColor: 'var(--border)' }}>
                        <label className="text-xs font-semibold block mb-1.5">
                          <span style={{ color: 'var(--text-primary)' }}>{field.label}</span>
                          {field.required && <span className="text-rose-500 ml-0.5">*</span>}
                        </label>
                        
                        <select
                          value={csvMapping[field.key] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCsvMapping(prev => ({ ...prev, [field.key]: val }));
                          }}
                          className="mis-select text-xs w-full font-medium"
                          required={field.required}
                        >
                          <option value="">-- Do Not Import --</option>
                          {csvHeaders.map((header) => (
                            <option key={header} value={header}>{header}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Data Preview */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-primary)' }}>
                    Preview (First 3 Rows)
                  </h4>
                  <div className="border rounded-lg overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
                    <table className="w-full text-left border-collapse" style={{ background: 'var(--bg-base)' }}>
                      <thead>
                        <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                          {SHEET_FIELDS[sheetTab]
                            .filter(f => csvMapping[f.key])
                            .map(f => (
                              <th key={f.key} className="p-2 text-[10px] font-bold uppercase whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                                {f.label}
                              </th>
                            ))
                          }
                        </tr>
                      </thead>
                      <tbody>
                        {csvRows.slice(0, 3).map((row, idx) => (
                          <tr key={idx} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                            {SHEET_FIELDS[sheetTab]
                              .filter(f => csvMapping[f.key])
                              .map(f => {
                                const colName = csvMapping[f.key];
                                const colIndex = csvHeaders.indexOf(colName);
                                const value = colIndex !== -1 ? row[colIndex] : '';
                                return (
                                  <td key={f.key} className="p-2 text-xs truncate max-w-[120px]" style={{ color: 'var(--text-primary)' }}>
                                    {value || <span className="opacity-40 italic">empty</span>}
                                  </td>
                                );
                              })
                            }
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                </>
                )}

              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setShowMappingModal(false)}
                  className="px-4 py-2 border rounded-lg text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkImportSubmit}
                  disabled={importing || csvRows.length === 0 || containsSampleSentinel(csvRows)}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {importing ? 'Importing...' : '🚀 Start Import'}
                </button>
              </div>
            </div>
          </div>
        )}

        <ViewDetailsModal record={viewingRecord} onClose={() => setViewingRecord(null)} title="KYC Record Details" />
      </div>
    </DashboardLayout>
  );
};

export default KYCDataEntryPage;
