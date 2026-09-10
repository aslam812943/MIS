import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../components/layout/DashboardLayout';
import CountdownBadge from '../../components/common/CountdownBadge';
import ViewDetailsModal from '../../components/common/ViewDetailsModal';
import CsvImportGuide from '../../components/common/CsvImportGuide';
import { validateCsvHeaders, containsSampleSentinel, type CsvHeaderValidation } from '../../utils/csvBulkImportHelpers';
import { itService } from '../../services/it.service';
import { orgService } from '../../services/org.service';
import { authService } from '../../services/auth.service';

const STANDARD_FIELD_OPTIONS: Record<string, Record<string, string[]>> = {
  'audits': {
    'audit_type': ['Internal', 'CERT-In Empanelled External', 'SEBI-Mandated Cyber Audit', 'VAPT']
  },
  'audit-schedule': {
    'audit_type': ['System Audit', 'Cybersecurity Audit', 'VAPT']
  },
  'diagrams': {
    'type': ['Network Topology', 'Server Architecture', 'Data Center Layout']
  },
  'vendors': {
    'category': ['Hardware', 'Software', 'Network & ISP', 'Cloud', 'Security', 'AMC Service']
  },
  'assets': {
    'asset_type': ['Desktop', 'Laptop', 'Server', 'Printer', 'Network Device', 'Software License']
  },
  'audit-findings': {
    'domain': ['Governance', 'Infrastructure', 'Data Security', 'Network Security', 'Access Control', 'Incident Management']
  },
  'cybersecurity-compliance': {
    'compliance_domain': ['Governance', 'Infrastructure', 'Data Security', 'Network Security', 'Access Control', 'Incident Management']
  }
};

interface SheetHelpConfig {
  why: string;
  fields: { label: string; note: string }[];
  remember: string;
}

interface FormFieldConfig {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  // Server-generated reference numbers (PO/ticket/incident numbers) are
  // rendered disabled with an "Auto-generated on save" placeholder instead
  // of a normal editable input — see getFormFields()'s fallback renderer.
  readOnly?: boolean;
  options?: any[];
}

// Plain-English explanations shown next to each data entry form, written for
// operations staff (not developers) — what this sheet is for and why each
// field matters. Keeps the same wording style across every department.
const SHEET_HELP: Record<string, SheetHelpConfig> = {
  'audits': {
    why: 'SEBI requires the firm to run periodic cybersecurity audits — internal, external, or technical (VAPT). This sheet tracks every audit cycle from scheduling through to submission, so a regulatory deadline never gets missed by accident.',
    fields: [
      { label: 'Audit Name/Cycle', note: 'A clear name identifying this audit round (e.g. "SEBI Cyber Audit FY2025-26").' },
      { label: 'Audit Type', note: 'Internal = our own review. CERT-In Empanelled External / SEBI-Mandated Cyber Audit = a regulator-driven audit by an approved external auditor. VAPT = a technical Vulnerability Assessment & Penetration Test.' },
      { label: 'TOR Document File', note: 'The Terms of Reference — the signed/approved document defining exactly what this audit will cover.' },
      { label: 'Auditor Name/Firm', note: 'Who is actually conducting the audit.' },
      { label: 'Scheduled / Start / End Date', note: 'When the audit is planned, and when it actually started and finished.' },
      { label: 'Submission Deadline', note: 'The regulatory deadline for submitting the audit report. This is the date that actually matters — missing it is a compliance breach, not just a delay.' },
      { label: 'Actual Submission Date', note: 'When the report was actually sent in.' },
      { label: 'Status', note: 'Scheduled = planned. In Progress = underway. Report Received = auditor delivered results. Submitted = sent to the regulator. Overdue = past the submission deadline — needs urgent attention.' },
    ],
    remember: 'The Submission Deadline is a regulatory date, not an internal target — treat any audit approaching Overdue as urgent, not routine.',
  },
  'audit-findings': {
    why: 'Every audit turns up findings — gaps that need fixing. This sheet tracks each one to actual closure with an owner and a deadline, because "was last audit\'s findings fixed?" is exactly what the next audit checks first.',
    fields: [
      { label: 'Linked Audit', note: 'Which audit cycle this finding came from — always link it, a finding with no audit context can\'t be traced back to what triggered it.' },
      { label: 'Finding ID', note: 'The reference code the auditor gave this specific finding.' },
      { label: 'Finding Description', note: 'Exactly what the auditor found wrong — copy their wording precisely, don\'t paraphrase.' },
      { label: 'Compliance Domain', note: 'Which area this falls under — Governance, Infrastructure, Data Security, Network Security, Access Control, or Incident Management.' },
      { label: 'Severity', note: 'Critical/High/Medium/Low — how serious this gap is. Critical findings should always be fixed first.' },
      { label: 'Recommended Action', note: 'What the auditor recommended doing to close this gap.' },
      { label: 'Responsible Person', note: 'Who actually owns fixing this.' },
      { label: 'Target Date / Actual Implementation Date', note: 'The deadline for fixing it, and when it was actually fixed.' },
      { label: 'Status', note: 'Open = not started. In Progress = being worked. Implemented = fix applied. Closed = fully verified. Overdue = past target date, still unresolved.' },
      { label: 'Alert Lead Time (Days)', note: 'How many days before the target date the system should start warning that this finding is coming due.' },
    ],
    remember: 'Never leave a Critical finding sitting as Open past its target date — this is precisely what a regulator checks first on the next audit cycle.',
  },
  'vendors': {
    why: 'Every hardware, software, network, cloud, and security vendor the firm depends on is tracked here — who they are and who to call. Their actual AMC (Annual Maintenance Contract) renewal dates live in the separate "AMC Contracts" sheet, since one vendor can cover more than one AMC item (e.g. both server maintenance and a software licence).',
    fields: [
      { label: 'Vendor Name', note: 'The company\'s official name — each vendor should only be entered once.' },
      { label: 'Category', note: 'Hardware, Software, Network & ISP, Cloud, Security, or AMC Service — what kind of vendor this is.' },
      { label: 'POC Name / Email / Phone', note: 'The vendor\'s point of contact — who to actually call when something breaks.' },
      { label: 'Backup Contacts', note: 'A secondary contact in case the main POC is unreachable.' },
      { label: 'Escalation/Remarks', note: 'How to escalate issues with this vendor, or any other useful context.' },
      { label: 'Status', note: 'Active = currently supporting us. Under Renewal = renewal in progress. Expired = contract lapsed. Terminated = relationship ended.' },
    ],
    remember: 'This sheet is just the vendor directory now — go to "AMC Contracts" to record what they cover and when it renews.',
  },
  'amc-contracts': {
    why: 'A silently lapsed AMC (Annual Maintenance Contract) means a critical vendor support agreement — server maintenance, software support, network support — just stopped, often discovered only when something breaks and the vendor says "you\'re not covered anymore." This sheet gives every AMC item its own renewal countdown so that can\'t happen quietly.',
    fields: [
      { label: 'Vendor Name', note: 'Which vendor from the Vendors sheet this AMC is with.' },
      { label: 'Item Covered', note: 'What this specific AMC actually covers — a server, a software product, network equipment, etc. One vendor can have several of these.' },
      { label: 'AMC Start Date', note: 'When this AMC period began.' },
      { label: 'AMC Renewal Date', note: 'When it needs to be renewed — the date the days-to-go countdown on the dashboard is calculated against.' },
      { label: 'Last Paid Date', note: 'Payment history/proof for this AMC.' },
      { label: 'AMC Amount', note: 'For budget tracking.' },
      { label: 'Notification Lead Time (Days)', note: 'How many days before the Renewal Date the alert should start firing — some AMCs need 60 days\' notice to negotiate renewal terms, others can be handled in a week.' },
      { label: 'Status', note: 'Active = currently in force. Renewal Due = approaching renewal. Renewed = just renewed for the next term. Lapsed = expired without renewal.' },
    ],
    remember: 'Set the Renewal Date and Lead Time correctly — an expired AMC on a critical vendor means no support if something breaks, with no warning at all. Apply the same green/amber/red countdown discipline here as on the Audit Schedule.',
  },
  'assets': {
    why: 'Every piece of IT hardware and software licence the firm owns is tracked here — not just what it is, but its full lifecycle: cost, depreciation, warranty, and whether it\'s due for replacement.',
    fields: [
      { label: 'Asset Barcode / ID', note: 'The unique tag physically on this asset — must be unique, this is how it\'s tracked and located.' },
      { label: 'Asset Type', note: 'Desktop, Laptop, Server, Printer, Network Device, Software License, or pick "Other" to enter a custom type manually.' },
      { label: 'Make / Model / Serial Number', note: 'Exactly as printed on the device — needed for warranty claims and insurance. If you are not sure or if no serial number exists (e.g. for software licences or accessories), you can enter or click "+ NIL".' },
      { label: 'Purchase Date / Purchase Value', note: 'When it was bought and for how much — entered once, never edited afterwards. Current Value is never typed in; it\'s always recalculated live from these two fields.' },
      { label: 'Depreciation Rate (% per year)', note: 'Defaults to 15% — the standard Written Down Value (WDV/reducing-balance) rate under the Companies Act for computers and office equipment. Each year, this % is deducted from last year\'s REMAINING value, not the original price (e.g. ₹60,000 → ₹51,000 → ₹43,350 ...). Change it only if finance specifies a different rate for a particular asset category.' },
      { label: 'Vendor Support Contract', note: 'Which vendor supports this asset, if any — link it so AMC coverage is traceable back to a vendor record.' },
      { label: 'Assigned To / Physical Location', note: 'Who currently has it, and where it physically is.' },
      { label: 'Useful Life (Years)', note: 'How many years this asset is expected to stay usable — this is what drives the automatic "due for upgrade" flag once that time has passed (separate from depreciation, which never fully reaches zero under WDV).' },
      { label: 'Warranty Start / End', note: 'The manufacturer/vendor warranty period.' },
      { label: 'Under vendor AMC support?', note: 'Tick only if this specific asset is actively covered by a vendor AMC.' },
      { label: 'Criticality', note: 'Critical = business stops without it (e.g. a trading server). Non-Critical = inconvenient but not business-stopping if it fails.' },
      { label: 'Status', note: 'Active = in use. Under Repair = temporarily out. Retired = no longer used but not disposed. Disposed = physically gone.' },
    ],
    remember: 'Purchase Date and Useful Life directly drive the automatic book value and "due for upgrade" numbers shown in the list — get them wrong and every downstream number is wrong too.',
  },
  'diagrams': {
    why: 'Network topology, server architecture, and data center layout diagrams are what regulators, auditors, and whoever is responding to an incident at 2am actually rely on to understand our infrastructure quickly. An outdated diagram is worse than no diagram.',
    fields: [
      { label: 'Diagram Name', note: 'A clear, searchable name for this diagram.' },
      { label: 'Topology Type', note: 'Network Topology, Server Architecture, or Data Center Layout.' },
      { label: 'Version Number', note: 'Increment this every time the diagram changes.' },
      { label: 'Upload Diagram File', note: 'The actual diagram file.' },
      { label: 'Revision Notes', note: 'What changed since the last version — helps anyone reviewing history understand why it was updated.' },
    ],
    remember: 'Always bump the Version Number and upload a fresh file when the infrastructure changes — an outdated diagram can actively mislead someone during a live incident.',
  },
  'cybersecurity-compliance': {
    why: 'SEBI\'s Cybersecurity and Cyber Resilience Framework (CSCRF) requires specific controls across governance, infrastructure, data security, network security, access control, and incident management. This sheet tracks each control and its review cycle so nothing silently lapses.',
    fields: [
      { label: 'Domain', note: 'Which CSCRF area this control belongs to — Governance, Infrastructure, Data Security, Network Security, Access Control, or Incident Management.' },
      { label: 'Control Requirement Description', note: 'What this control actually requires us to do or have in place.' },
      { label: 'CSCRF / ISO Reference Clause', note: 'The exact regulatory/framework clause this maps to — needed when an auditor asks which requirement this satisfies.' },
      { label: 'Last Assessed Date', note: 'When this control was last checked.' },
      { label: 'Assessment Status', note: 'Compliant = in place and working. Non-Compliant = it isn\'t. Due for Review = the review window has come around again. In Remediation = actively being fixed.' },
      { label: 'Evidence Document File', note: 'Proof this control is actually in place (screenshot, policy doc, config export) — "we did it" without evidence doesn\'t satisfy an audit.' },
      { label: 'Responsible Officer', note: 'Who owns this control.' },
      { label: 'Next Review Date', note: 'When this control must be checked again — SEBI requires periodic re-assessment, not a one-time tick.' },
    ],
    remember: 'Never mark a control Compliant without an actual Evidence Document attached — "trust me" doesn\'t hold up in a SEBI inspection.',
  },
  'tickets': {
    why: 'Every day-to-day IT problem a staff member raises is logged here and tracked against a service standard (SLA), so issues get resolved on a known timeline instead of being handled informally and forgotten.',
    fields: [
      { label: 'Ticket Reference Number', note: 'Auto-generated when you save (e.g. TKT-2026-0001) — no need to type one, this guarantees it\'s always unique.' },
      { label: 'Requester (User/Branch)', note: 'Who raised the issue and from where.' },
      { label: 'Issue Description', note: 'What\'s actually wrong, with enough detail that whoever picks it up doesn\'t have to ask again.' },
      { label: 'Assigned Executive', note: 'Who is handling this ticket.' },
      { label: 'Date Opened / Date Closed', note: 'When it was raised, and when it was fully resolved.' },
      { label: 'Ticket Status', note: 'Open = new. In Progress = being worked. Resolved = fixed, pending confirmation. Closed = fully done.' },
      { label: 'SLA Target (Hours)', note: 'How many hours this type of issue should be resolved within, per our internal service standard.' },
      { label: 'Met SLA Guidelines?', note: 'Tick only if it was actually resolved within the SLA target hours — this feeds the SLA Compliance % shown on the dashboard, so keep it honest.' },
    ],
    remember: 'Only tick "Met SLA Guidelines" if it\'s actually true — this number feeds directly into the SLA Compliance % that management sees on the dashboard.',
  },
  'incidents': {
    why: 'A real security or system incident is far more serious than a helpdesk ticket — it needs a root cause, a fix, and honest severity classification, because Critical incidents may carry a regulatory notification obligation to SEBI/CERT-In within a fixed time window.',
    fields: [
      { label: 'Incident Code', note: 'Auto-generated when you save (e.g. INC-2026-0001) — no need to type one, this guarantees it\'s always unique.' },
      { label: 'Incident Title', note: 'A short, clear name for what happened.' },
      { label: 'Event Description', note: 'What actually happened, stated as factually as possible.' },
      { label: 'Severity Rating', note: 'Critical/High/Medium/Low — classify accurately, not conservatively. Under-rating a serious incident can mean missing a mandatory regulatory notification window.' },
      { label: 'Root Cause Analysis (RCA)', note: 'Why it actually happened, not just what happened — this is what stops it recurring.' },
      { label: 'Remediation Steps Taken', note: 'What was actually done to fix it and prevent a repeat.' },
      { label: 'Incident State', note: 'Identified = just discovered. Investigating = root cause being worked out. Mitigated = immediate risk contained. Resolved = fully closed out.' },
      { label: 'Discovery Date / Resolution Date', note: 'When it was found, and when it was fully resolved.' },
    ],
    remember: 'Classify severity honestly, not conservatively — under-rating a Critical incident can mean missing a mandatory SEBI/CERT-In notification window.',
  },
  'projects': {
    why: 'New IT deployments, upgrades, and migrations are tracked here from planning through completion, so infrastructure work has visible ownership and status instead of happening informally in the background.',
    fields: [
      { label: 'Project Name / Description', note: 'A clear name for this initiative, and what it\'s actually trying to achieve.' },
      { label: 'Start Date / Target End Date / Actual End Date', note: 'When it began, when it was supposed to finish, and when it actually did.' },
      { label: 'Status', note: 'Planning = not started yet. In Progress = underway. On Hold = paused. Completed = finished. Cancelled = called off.' },
    ],
    remember: 'Keep Status current as the project actually progresses — a stale "Planning" status on work that\'s really underway hides real progress from anyone checking in.',
  },
  'audit-schedule': {
    why: 'The firm runs three recurring compliance audits — System Audit, Cybersecurity Audit, and VAPT — each on its own cycle. This sheet tracks each type once, computes when it\'s next due from the recurrence you set, and drives the days-to-go countdown on the dashboard so a regulatory deadline never gets missed by accident. This is HO-only — there is no branch to pick, one countdown per audit type for the whole company.',
    fields: [
      { label: 'Audit Type', note: 'System Audit, Cybersecurity Audit, or VAPT — each has its own cadence and often its own external agency.' },
      { label: 'Recurrence (Every X Months)', note: 'How often this audit repeats — e.g. 12 for an annual audit. Combined with Last Filing Date, this is what makes Next Due Date and Days to Go self-updating instead of something someone has to re-schedule by hand.' },
      { label: 'Last Filing Date', note: 'The date this audit cycle\'s report was actually filed/submitted. Update this every time you file — the system recalculates Next Due Date automatically the moment you save.' },
      { label: 'Auditor / Agency Name', note: 'Who conducted this audit.' },
      { label: 'Report Upload', note: 'PDF of the filed report, for your own records.' },
      { label: 'Status', note: 'Upcoming = not yet due. Filed = this cycle\'s report has been submitted. Overdue = past the computed due date.' },
      { label: 'Ad-hoc run?', note: 'VAPT in particular is often triggered by a major system change, not just the calendar — tick this and describe the triggering event to log an extra run alongside the yearly default, without disturbing the regular cycle.' },
    ],
    remember: 'Next Due Date and Days to Go are computed, not typed in — they always equal Last Filing Date + Recurrence. The dashboard countdown turns green (>30 days), amber (30 days to due), or red (overdue) off this same number.',
  },
  'servers': {
    why: 'A server isn\'t just "an asset with a value" — its configuration is operationally critical information IT staff need to reference constantly (what OS, how much RAM, what it\'s actually used for). This sheet is kept separate from the general Asset register for that reason, and links back to it for value/depreciation/warranty instead of duplicating that data.',
    fields: [
      { label: 'Server Name', note: 'The internal identifier used day to day, e.g. "DP-DB-01".' },
      { label: 'Linked Asset ID', note: 'Connects back to the general Asset register so this server\'s purchase value, depreciation, and warranty are tracked once, not twice.' },
      { label: 'Role / Purpose', note: 'What this server actually does — e.g. Trading Database, Backup Server, File Server, Domain Controller.' },
      { label: 'Physical or Virtual', note: 'Some "servers" today are virtual machines on shared hardware, not a physical box.' },
      { label: 'OS / CPU / RAM / Storage', note: 'Core specs, needed for upgrade planning and troubleshooting.' },
      { label: 'IP Address', note: 'Network reference.' },
      { label: 'Location / Rack', note: 'Physical location, or hosting provider if cloud-based.' },
      { label: 'Assigned Admin', note: 'Who\'s responsible for this specific server.' },
      { label: 'Last Configuration Update Date', note: 'When specs/settings last changed — important for audit trails and troubleshooting.' },
      { label: 'Linked Network Diagram', note: 'Which diagram shows this server\'s connections.' },
    ],
    remember: 'Update Last Configuration Update Date every time you actually change something on this server — this is exactly what an auditor or an incident responder checks first.',
  },
  'team-duties': {
    why: 'HR\'s Employee Master tells you who works here. This sheet tells you what each IT person is actually responsible for — who owns backups, who owns the firewall, who\'s the escalation contact for a specific vendor. During an incident or an audit, "who\'s responsible for this" needs to be answerable in seconds, not by asking around.',
    fields: [
      { label: 'Employee Name', note: 'Picked from the IT department roster — name/contact details link back to HR\'s Employee Master, not duplicated here.' },
      { label: 'Designation', note: 'Role title.' },
      { label: 'Duties / Responsibilities', note: 'The specific areas they own — e.g. "Server maintenance, backup verification," "Network & firewall," "Vendor coordination."' },
      { label: 'On-Call / Escalation Priority', note: 'If something breaks at 11pm, who gets called first (1), second (2), third (3), and so on.' },
      { label: 'Reporting To', note: 'Internal accountability structure. Picked from the IT roster — leave blank if this person\'s manager sits outside the IT department.' },
    ],
    remember: 'Keep this current the moment responsibilities change — a stale duties sheet is exactly what makes "who owns this?" take an hour instead of ten seconds during a live incident.',
  },
  'software': {
    why: 'A laptop is used by one person and sits in one place. A software licence might be used by an entire department, tied to a specific business function, and its real compliance risk is less about physical depreciation and more about whether the licence/AMC is still valid — an expired software licence is a bigger operational risk than an old laptop.',
    fields: [
      { label: 'Software Name', note: 'Identity of the product.' },
      { label: 'Purchase Date', note: 'Start of the licence/AMC clock.' },
      { label: 'For (Purpose)', note: 'What business function it serves — e.g. "Trading terminal," "Antivirus," "Accounting."' },
      { label: 'Used By', note: 'Department or specific employees using it.' },
      { label: 'AMC / Renewal Date', note: 'When the licence or support needs renewing — feeds the same days-to-go countdown pattern as Audits and AMC Contracts.' },
      { label: 'PO Number / PO PDF Upload', note: 'Reference to the purchase order that bought it, and the actual document.' },
      { label: 'Vendor', note: 'Links back to the Vendors sheet.' },
      { label: 'Number of Licenses / Seats', note: 'For tracking usage vs. what\'s paid for.' },
      { label: 'Status', note: 'Active = currently valid. Expiring Soon = renewal window approaching. Expired = lapsed.' },
    ],
    remember: 'An expired software licence on something business-critical (a trading terminal, antivirus) is a bigger operational risk than an old laptop — treat the renewal countdown here with the same urgency as AMC and audit dates.',
  },
  'purchase-orders': {
    why: 'The PO Generator tab lets you build and print a purchase order, but that external tool has no memory of its own — it doesn\'t save anything anywhere. This sheet is the actual record: log every PO you generate here so there\'s a real, searchable history feeding the dashboard, instead of POs existing only as printed paper or a local download.',
    fields: [
      { label: 'PO Number', note: 'Auto-generated when you save (e.g. PO-2026-0001) — write this number onto the PO document you generated, so the two stay linked.' },
      { label: 'Vendor', note: 'Which vendor this PO was raised for — links back to the Vendors sheet.' },
      { label: 'Item Description', note: 'What was ordered — matches the line items on the generated PO.' },
      { label: 'Amount (INR)', note: 'The total PO value, GST included — this is what feeds the "Total PO Value" dashboard figure.' },
      { label: 'PO Date', note: 'The date printed on the PO.' },
      { label: 'Status', note: 'Raised = generated and sent. Approved = vendor/internal sign-off done. Fulfilled = goods/services received. Cancelled = called off.' },
    ],
    remember: 'Log the PO here right after generating it — this sheet is the only place PO data exists for reporting, since the generator tool itself doesn\'t store anything.',
  },
};

const ITDataEntryPage: React.FC = () => {
  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const hasMultiBranchAccess = isAdmin || ['ceo', 'managing_director', 'director', 'executive', 'hod'].includes(currentUser?.role || '');


  // Active sheet tab
  const [sheetTab, setSheetTab] = useState('audits');
  // Lets a caller (e.g. the "View Purchase Orders" shortcut) request landing
  // on the register/form view when it switches sheets, instead of always
  // landing on 'list' — read once by the tab-change effect below, then cleared.
  const pendingActiveTabRef = useRef<'list' | 'register' | null>(null);

  // Quick "log this PO" form shown inline on the PO Generator tab itself —
  // saves directly to the purchase-orders sheet without switching tabs.
  const [poQuickForm, setPoQuickForm] = useState<any>({ status: 'Raised' });
  const [poQuickSubmitting, setPoQuickSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'register'>('list');

  // UI state
  const [entries, setEntries] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [auditsList, setAuditsList] = useState<any[]>([]);
  const [itStaff, setItStaff] = useState<any[]>([]);
  const [assetsList, setAssetsList] = useState<any[]>([]);
  const [diagramsList, setDiagramsList] = useState<any[]>([]);
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
  const [confirmSaveModalOpen, setConfirmSaveModalOpen] = useState(false);

  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [csvMappings, setCsvMappings] = useState<{ [key: string]: string }>({});
  const [csvImportErrors, setCsvImportErrors] = useState<{ row: number; error: string }[]>([]);
  const [csvValidation, setCsvValidation] = useState<CsvHeaderValidation | null>(null);
  const [csvHasSample, setCsvHasSample] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);

  useEffect(() => {
    fetchBranches();
    fetchVendors();
    fetchAudits();
    fetchITStaff();
    fetchAssets();
    fetchDiagrams();
  }, []);

  useEffect(() => {
    // 'po-generator' is a pseudo-sheet (an embedded external tool, not a
    // real backed table) — nothing to fetch, and asking the backend would
    // just 400 with "Invalid sheet mapping."
    if (sheetTab === 'po-generator') return;
    fetchEntries();
  }, [sheetTab, branchFilter, searchTerm]);

  // Clean form state when tab changes
  useEffect(() => {
    setActiveTab(pendingActiveTabRef.current || 'list');
    pendingActiveTabRef.current = null;
    setEditingId(null);
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

  const fetchVendors = async () => {
    try {
      const data = await itService.getVendorsDropdown();
      setVendors(data || []);
    } catch (err) {
      console.error('Failed to load vendors', err);
    }
  };

  const fetchAudits = async () => {
    try {
      const data = await itService.getEntries('audits');
      setAuditsList(data || []);
    } catch (err) {
      console.error('Failed to load audits list', err);
    }
  };

  const fetchITStaff = async () => {
    try {
      const data = await itService.getITStaffDropdown();
      setItStaff(data || []);
    } catch (err) {
      console.error('Failed to load IT staff list', err);
    }
  };

  const fetchAssets = async () => {
    try {
      const data = await itService.getEntries('assets');
      setAssetsList(data || []);
    } catch (err) {
      console.error('Failed to load assets list', err);
    }
  };

  const fetchDiagrams = async () => {
    try {
      const data = await itService.getEntries('diagrams');
      setDiagramsList(data || []);
    } catch (err) {
      console.error('Failed to load diagrams list', err);
    }
  };

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const filters = {
        branchId: branchFilter || undefined,
        search: searchTerm || undefined
      };
      const data = await itService.getEntries(sheetTab, filters);
      setEntries(data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to fetch entries.');
    } finally {
      setLoading(false);
    }
  };

  const getDynamicFieldOptions = (sheet: string, fieldName: string): string[] => {
    const base = STANDARD_FIELD_OPTIONS[sheet]?.[fieldName] || [];
    const optionsSet = new Set<string>(base);

    if (sheetTab === sheet && Array.isArray(entries)) {
      entries.forEach((row: any) => {
        const val = row?.[fieldName];
        if (val && typeof val === 'string' && val.trim() && val !== 'Other') {
          optionsSet.add(val.trim());
        }
      });
    }

    if (sheet === 'assets' && Array.isArray(assetsList)) {
      assetsList.forEach((a: any) => {
        const val = a?.[fieldName];
        if (val && typeof val === 'string' && val.trim() && val !== 'Other') {
          optionsSet.add(val.trim());
        }
      });
    }

    if (sheet === 'audits' && Array.isArray(auditsList)) {
      auditsList.forEach((a: any) => {
        const val = a?.[fieldName];
        if (val && typeof val === 'string' && val.trim() && val !== 'Other') {
          optionsSet.add(val.trim());
        }
      });
    }

    if (sheet === 'vendors' && Array.isArray(vendors)) {
      vendors.forEach((v: any) => {
        const val = v?.[fieldName];
        if (val && typeof val === 'string' && val.trim() && val !== 'Other') {
          optionsSet.add(val.trim());
        }
      });
    }

    if (sheet === 'diagrams' && Array.isArray(diagramsList)) {
      diagramsList.forEach((d: any) => {
        const val = d?.[fieldName];
        if (val && typeof val === 'string' && val.trim() && val !== 'Other') {
          optionsSet.add(val.trim());
        }
      });
    }

    return Array.from(optionsSet);
  };

  const validateForm = (): boolean => {
    const fields = getFormFields();
    for (const f of fields) {
      const isOther = formData[`${f.name}_is_other`] || formData[`${f.name}_select`] === 'Other';
      if (isOther) {
        const customVal = formData[`custom_${f.name}`];
        if (f.required && (!customVal || !customVal.trim())) {
          toast.error(`Please specify a custom ${f.label}.`);
          return false;
        }
        if (customVal && customVal.trim()) {
          formData[f.name] = customVal.trim();
        }
      } else if (f.required) {
        const val = formData[f.name];
        if (val === undefined || val === null || (typeof val === 'string' && !val.trim())) {
          toast.error(`${f.label} is required.`);
          return false;
        }
      }
    }
    return true;
  };

  const handleFormSubmitTrigger = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setConfirmSaveModalOpen(true);
  };

  const handleConfirmSave = async () => {
    setConfirmSaveModalOpen(false);
    setSubmitting(true);
    try {
      const cleanedData = { ...formData };
      Object.keys(cleanedData).forEach(k => {
        if (k.endsWith('_select') || k.endsWith('_is_other') || k.startsWith('custom_')) {
          delete cleanedData[k];
        }
      });

      if (editingId) {
        await itService.updateEntry(sheetTab, editingId, cleanedData);
        toast.success('Record updated successfully.');
      } else {
        await itService.createEntry(sheetTab, cleanedData);
        toast.success('Record created successfully.');
      }
      fetchEntries();
      if (sheetTab === 'assets') fetchAssets();
      if (sheetTab === 'audits') fetchAudits();
      if (sheetTab === 'vendors') fetchVendors();
      if (sheetTab === 'diagrams') fetchDiagrams();
      setActiveTab('list');
      setFormData({});
      setEditingId(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Submit operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickSavePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poQuickForm.item_description || !poQuickForm.amount || !poQuickForm.po_date) {
      toast.error('Item Description, Amount, and PO Date are required.');
      return;
    }
    setPoQuickSubmitting(true);
    try {
      const created = await itService.createEntry('purchase-orders', poQuickForm);
      toast.success(`PO logged as ${created.po_number}.`);
      setPoQuickForm({ status: 'Raised' });
      if (sheetTab === 'purchase-orders') fetchEntries();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to log PO.');
    } finally {
      setPoQuickSubmitting(false);
    }
  };

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    const customConfig = STANDARD_FIELD_OPTIONS[sheetTab];
    const initialForm: any = { ...record };

    if (customConfig) {
      Object.keys(customConfig).forEach(fieldName => {
        const dynamicOpts = getDynamicFieldOptions(sheetTab, fieldName);
        const val = record[fieldName];
        const isOther = val && !dynamicOpts.includes(val);
        initialForm[`${fieldName}_select`] = isOther ? 'Other' : val;
        initialForm[`${fieldName}_is_other`] = isOther;
        initialForm[`custom_${fieldName}`] = isOther ? val : '';
      });
    }

    setFormData(initialForm);
    setActiveTab('register');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      await itService.deleteEntry(sheetTab, id);
      toast.success('Record deleted.');
      fetchEntries();
      if (sheetTab === 'assets') fetchAssets();
      if (sheetTab === 'audits') fetchAudits();
      if (sheetTab === 'vendors') fetchVendors();
      if (sheetTab === 'diagrams') fetchDiagrams();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Delete operation failed.');
    }
  };

  const handleBatchAction = async () => {
    if (!batchStatus || selectedIds.length === 0) return;
    try {
      await itService.bulkUpdate(sheetTab, selectedIds, { status: batchStatus });
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

  // Accepts YYYY-MM-DD, YYYY/MM/DD, DD-MM-YYYY, or DD/MM/YYYY (whatever a
  // CSV/Excel export commonly produces) and normalizes to the YYYY-MM-DD
  // the backend requires. When a "/"-separated date is ambiguous between
  // day-first and month-first (both segments <=12), day-first is assumed
  // to match this app's Indian locale convention used elsewhere (en-IN
  // date formatting) — e.g. "07/05/2026" is read as 7 May, not July 5.
  // Anything that doesn't match a recognized shape is returned unchanged,
  // so it still fails backend validation explicitly instead of being
  // silently coerced into the wrong date.
  const normalizeDateString = (raw: any): any => {
    const val = String(raw ?? '').trim();
    if (!val) return raw;

    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);

    let m = val.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (m) {
      const [, y, mo, d] = m;
      return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    m = val.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (m) {
      const [, d, mo, y] = m;
      return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    return val;
  };

  // CSV Import mapping logic
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvImportErrors([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) return;

      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      setCsvHeaders(headers);

      const parsedRows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const rowObj: any = {};
        headers.forEach((h, index) => {
          rowObj[h] = values[index] || '';
        });
        return rowObj;
      });

      // Reject the whole file if the header row doesn't exactly match the
      // required columns, or if it's the untouched example template.
      const validation = validateCsvHeaders(headers, getFormFields().filter(f => !f.readOnly).map(f => ({ key: f.name, label: f.label })));
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
      getFormFields().filter(f => !f.readOnly).forEach(field => {
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

    const dateFieldNames = new Set(getFormFields().filter(f => f.type === 'date').map(f => f.name));

    const mappedRecords = csvRows.map(row => {
      const record: any = {};
      Object.entries(csvMappings).forEach(([dbCol, csvHeader]) => {
        if (csvHeader) {
          const raw = row[csvHeader];
          record[dbCol] = dateFieldNames.has(dbCol) ? normalizeDateString(raw) : raw;
        }
      });
      return record;
    });

    setCsvImporting(true);
    try {
      const result = await itService.bulkImport(sheetTab, mappedRecords);
      const insertedCount = result.inserted?.length ?? 0;
      const failedRows: { row: number; error: string }[] = result.failed ?? [];

      setCsvImportErrors(failedRows);

      if (failedRows.length === 0) {
        toast.success(`Successfully imported ${insertedCount} row${insertedCount === 1 ? '' : 's'}.`);
        setCsvModalOpen(false);
        setCsvHeaders([]);
        setCsvRows([]);
      } else if (insertedCount > 0) {
        toast.error(`Imported ${insertedCount} row${insertedCount === 1 ? '' : 's'}, ${failedRows.length} failed — see details below.`);
      } else {
        toast.error(`All ${failedRows.length} rows failed — see details below.`);
      }

      if (insertedCount > 0) {
        fetchEntries();
        if (sheetTab === 'assets') fetchAssets();
        if (sheetTab === 'audits') fetchAudits();
        if (sheetTab === 'vendors') fetchVendors();
        if (sheetTab === 'diagrams') fetchDiagrams();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'CSV Import failed.');
    } finally {
      setCsvImporting(false);
    }
  };

  // Real-time Written Down Value (WDV) depreciation preview for the assets
  // tab — mirrors ITService.calculateBookValue exactly: each year the rate
  // is deducted from last year's REMAINING value, not the original price.
  const getEstimatedDepreciation = () => {
    if (sheetTab !== 'assets') return null;
    const value = Number(formData.purchase_value || 0);
    const rate = Number(formData.depreciation_rate ?? 15) / 100;
    const life = Number(formData.useful_life_years || 0);
    const pDateStr = formData.purchase_date;

    if (value <= 0 || !pDateStr) return null;

    const purchaseDate = new Date(pDateStr);
    const today = new Date();
    const daysElapsed = (today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
    const yearsElapsed = Math.max(0, Math.floor(daysElapsed / 365.25));

    const bookValue = value * Math.pow(1 - rate, yearsElapsed);

    return {
      bookValue: bookValue.toFixed(2),
      yearsElapsed: String(yearsElapsed),
      isExpired: life > 0 && yearsElapsed >= life
    };
  };

  const deprEst = getEstimatedDepreciation();

  const getFormFields = (): FormFieldConfig[] => {
    switch (sheetTab) {
      case 'audits':
        return [
          { name: 'audit_name', label: 'Audit Name/Cycle', type: 'text', required: true },
          { name: 'audit_type', label: 'Audit Type', type: 'select', options: [...getDynamicFieldOptions('audits', 'audit_type'), 'Other'], required: true },
          { name: 'tor_document_url', label: 'TOR Document File', type: 'file' },
          { name: 'auditor_name', label: 'Auditor Name/Firm', type: 'text', required: true },
          { name: 'scheduled_date', label: 'Scheduled Date', type: 'date', required: true },
          { name: 'start_date', label: 'Start Date', type: 'date' },
          { name: 'end_date', label: 'End Date', type: 'date' },
          { name: 'submission_deadline', label: 'Submission Deadline', type: 'date', required: true },
          { name: 'actual_submission_date', label: 'Actual Submission Date', type: 'date' },
          { name: 'status', label: 'Status', type: 'select', options: ['Scheduled', 'In Progress', 'Report Received', 'Submitted', 'Overdue'], required: true }
        ];
      case 'audit-findings':
        return [
          {
            name: 'audit_id',
            label: 'Linked Audit',
            type: 'select',
            options: auditsList.map(a => ({ value: a.id, label: a.audit_name })),
            required: true
          },
          { name: 'finding_id', label: 'Finding ID', type: 'text', required: true },
          { name: 'finding_description', label: 'Finding Description', type: 'textarea', required: true },
          { name: 'domain', label: 'Compliance Domain', type: 'select', options: [...getDynamicFieldOptions('audit-findings', 'domain'), 'Other'], required: true },
          { name: 'severity', label: 'Severity', type: 'select', options: ['Critical', 'High', 'Medium', 'Low'], required: true },
          { name: 'recommended_action', label: 'Recommended Action', type: 'textarea', required: true },
          { name: 'responsible_person', label: 'Responsible Person', type: 'text', required: true },
          { name: 'implementation_target_date', label: 'Target Date', type: 'date', required: true },
          { name: 'actual_implementation_date', label: 'Actual Implementation Date', type: 'date' },
          { name: 'status', label: 'Status', type: 'select', options: ['Open', 'In Progress', 'Implemented', 'Closed', 'Overdue'], required: true },
          { name: 'notification_lead_time_days', label: 'Alert Lead Time (Days)', type: 'number', required: true }
        ];
      case 'vendors':
        return [
          { name: 'vendor_name', label: 'Vendor Name', type: 'text', required: true },
          { name: 'category', label: 'Category', type: 'select', options: [...getDynamicFieldOptions('vendors', 'category'), 'Other'], required: true },
          { name: 'poc_name', label: 'POC Name', type: 'text', required: true },
          { name: 'poc_email', label: 'POC Email', type: 'email', required: true },
          { name: 'poc_phone', label: 'POC Phone', type: 'tel', required: true },
          { name: 'other_members', label: 'Backup Contacts', type: 'text' },
          { name: 'remarks', label: 'Escalation/Remarks', type: 'textarea' },
          { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Under Renewal', 'Expired', 'Terminated'], required: true }
        ];
      case 'amc-contracts':
        return [
          {
            name: 'vendor_id',
            label: 'Vendor Name',
            type: 'select',
            options: vendors.map(v => ({ value: v.id, label: v.vendor_name })),
            required: true
          },
          { name: 'item_covered', label: 'Item Covered', type: 'text', required: true },
          { name: 'amc_start_date', label: 'AMC Start Date', type: 'date', required: true },
          { name: 'amc_renewal_date', label: 'AMC Renewal Date', type: 'date', required: true },
          { name: 'last_paid_date', label: 'Last Paid Date', type: 'date' },
          { name: 'amc_amount', label: 'AMC Amount (INR)', type: 'number', required: true },
          { name: 'notification_lead_time_days', label: 'Notification Lead Time (Days)', type: 'number', required: true },
          { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Renewal Due', 'Renewed', 'Lapsed'], required: true }
        ];
      case 'assets':
        return [
          { name: 'asset_id', label: 'Asset Barcode / ID', type: 'text', required: true },
          { name: 'asset_type', label: 'Asset Type', type: 'select', options: [...getDynamicFieldOptions('assets', 'asset_type'), 'Other'], required: true },
          { name: 'make_model', label: 'Make / Model', type: 'text', required: true },
          { name: 'serial_number', label: 'Serial Number', type: 'text', required: true },
          { name: 'purchase_date', label: 'Purchase Date', type: 'date', required: true },
          { name: 'purchase_value', label: 'Purchase Value (INR)', type: 'number', required: true },
          { name: 'depreciation_rate', label: 'Depreciation Rate (% per year)', type: 'number', required: true },
          {
            name: 'vendor_id',
            label: 'Vendor Support Contract',
            type: 'select',
            options: vendors.map(v => ({ value: v.id, label: v.vendor_name })),
            required: false
          },
          { name: 'assigned_to', label: 'Assigned To', type: 'text', required: true },
          { name: 'location', label: 'Physical Location', type: 'text', required: true },
          { name: 'useful_life_years', label: 'Useful Life (Years)', type: 'number', required: true },
          { name: 'warranty_start_date', label: 'Warranty Start', type: 'date' },
          { name: 'warranty_end_date', label: 'Warranty End', type: 'date' },
          { name: 'amc_coverage', label: 'Under vendor AMC support?', type: 'checkbox' },
          { name: 'criticality', label: 'Criticality', type: 'select', options: ['Critical', 'Non-Critical'], required: true },
          { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Under Repair', 'Retired', 'Disposed'], required: true }
        ];
      case 'diagrams':
        return [
          { name: 'diagram_name', label: 'Diagram Name', type: 'text', required: true },
          { name: 'type', label: 'Topology Type', type: 'select', options: [...getDynamicFieldOptions('diagrams', 'type'), 'Other'], required: true },
          { name: 'version', label: 'Version Number', type: 'text', required: true },
          { name: 'file_url', label: 'Upload Diagram File', type: 'file', required: true },
          { name: 'description', label: 'Revision Notes', type: 'textarea' }
        ];
      case 'cybersecurity-compliance':
        return [
          { name: 'compliance_domain', label: 'Domain', type: 'select', options: [...getDynamicFieldOptions('cybersecurity-compliance', 'compliance_domain'), 'Other'], required: true },
          { name: 'control_item', label: 'Control Requirement Description', type: 'textarea', required: true },
          { name: 'framework_reference', label: 'CSCRF / ISO Reference Clause', type: 'text', required: true },
          { name: 'last_assessed_date', label: 'Last Assessed Date', type: 'date' },
          { name: 'status', label: 'Assessment Status', type: 'select', options: ['Compliant', 'Non-Compliant', 'Due for Review', 'In Remediation'], required: true },
          { name: 'evidence_document_url', label: 'Evidence Document File', type: 'file' },
          { name: 'responsible_person', label: 'Responsible Officer', type: 'text', required: true },
          { name: 'next_review_date', label: 'Next Review Date', type: 'date', required: true }
        ];
      case 'tickets':
        return [
          { name: 'ticket_number', label: 'Ticket Reference Number', type: 'text', readOnly: true },
          { name: 'requester_name', label: 'Requester (User/Branch)', type: 'text', required: true },
          { name: 'issue_description', label: 'Issue Description', type: 'textarea', required: true },
          { name: 'assigned_to', label: 'Assigned Executive', type: 'text' },
          { name: 'opened_date', label: 'Date Opened', type: 'date', required: true },
          { name: 'closed_date', label: 'Date Closed', type: 'date' },
          { name: 'status', label: 'Ticket Status', type: 'select', options: ['Open', 'In Progress', 'Resolved', 'Closed'], required: true },
          { name: 'sla_target_hours', label: 'SLA Target (Hours)', type: 'number', required: true },
          { name: 'is_sla_compliant', label: 'Met SLA Guidelines?', type: 'checkbox' }
        ];
      case 'incidents':
        return [
          { name: 'incident_number', label: 'Incident Code', type: 'text', readOnly: true },
          { name: 'incident_name', label: 'Incident Title', type: 'text', required: true },
          { name: 'description', label: 'Event Description', type: 'textarea', required: true },
          { name: 'severity', label: 'Severity Rating', type: 'select', options: ['Critical', 'High', 'Medium', 'Low'], required: true },
          { name: 'root_cause_analysis', label: 'Root Cause Analysis (RCA)', type: 'textarea' },
          { name: 'remediation_action', label: 'Remediation Steps Taken', type: 'textarea' },
          { name: 'status', label: 'Incident State', type: 'select', options: ['Identified', 'Investigating', 'Mitigated', 'Resolved'], required: true },
          { name: 'discovered_date', label: 'Discovery Date', type: 'date', required: true },
          { name: 'resolved_date', label: 'Resolution Date', type: 'date' }
        ];
      case 'projects':
        return [
          { name: 'project_name', label: 'Project Name', type: 'text', required: true },
          { name: 'description', label: 'Project Description', type: 'textarea' },
          { name: 'start_date', label: 'Start Date', type: 'date', required: true },
          { name: 'target_end_date', label: 'Target End Date', type: 'date', required: true },
          { name: 'actual_end_date', label: 'Actual End Date', type: 'date' },
          { name: 'status', label: 'Status', type: 'select', options: ['Planning', 'In Progress', 'On Hold', 'Completed', 'Cancelled'], required: true }
        ];
      case 'audit-schedule':
        return [
          { name: 'audit_type', label: 'Audit Type', type: 'select', options: [...getDynamicFieldOptions('audit-schedule', 'audit_type'), 'Other'], required: true },
          { name: 'recurrence_months', label: 'Recurrence (Every X Months)', type: 'number', required: true },
          { name: 'last_filing_date', label: 'Last Filing Date', type: 'date', required: true },
          { name: 'auditor_name', label: 'Auditor / Agency Name', type: 'text', required: true },
          { name: 'report_upload_url', label: 'Report Upload', type: 'file' },
          { name: 'status', label: 'Status', type: 'select', options: ['Upcoming', 'Filed', 'Overdue'], required: true },
          { name: 'is_ad_hoc', label: 'Ad-hoc run (e.g. VAPT after a major change)?', type: 'checkbox' },
          { name: 'trigger_event_description', label: 'Triggering Event (if ad-hoc)', type: 'textarea' }
        ];
      case 'servers':
        return [
          { name: 'server_name', label: 'Server Name', type: 'text', required: true },
          {
            name: 'linked_asset_id',
            label: 'Linked Asset ID',
            type: 'select',
            options: assetsList.map(a => ({ value: a.id, label: a.asset_id })),
            required: false
          },
          { name: 'role_purpose', label: 'Role / Purpose', type: 'text', required: true },
          { name: 'physical_or_virtual', label: 'Physical or Virtual', type: 'select', options: ['Physical', 'Virtual'], required: true },
          { name: 'os', label: 'Operating System', type: 'text' },
          { name: 'cpu', label: 'CPU', type: 'text' },
          { name: 'ram', label: 'RAM', type: 'text' },
          { name: 'storage', label: 'Storage', type: 'text' },
          { name: 'ip_address', label: 'IP Address', type: 'text' },
          { name: 'location_rack', label: 'Location / Rack', type: 'text' },
          { name: 'assigned_admin', label: 'Assigned Admin', type: 'text' },
          { name: 'last_config_update_date', label: 'Last Configuration Update Date', type: 'date' },
          {
            name: 'linked_diagram_id',
            label: 'Linked Network Diagram',
            type: 'select',
            options: diagramsList.map(d => ({ value: d.id, label: d.diagram_name })),
            required: false
          }
        ];
      case 'team-duties':
        return [
          {
            name: 'profile_id',
            label: 'Employee Name',
            type: 'select',
            options: itStaff.map(p => ({ value: p.id, label: p.full_name })),
            required: true
          },
          { name: 'designation', label: 'Designation', type: 'text', required: true },
          { name: 'duties_responsibilities', label: 'Duties / Responsibilities', type: 'textarea', required: true },
          { name: 'escalation_priority', label: 'On-Call / Escalation Priority', type: 'number', required: true },
          {
            name: 'reporting_to',
            label: 'Reporting To',
            type: 'select',
            options: itStaff.map(p => ({ value: p.id, label: p.full_name })),
            required: false
          }
        ];
      case 'software':
        return [
          { name: 'software_name', label: 'Software Name', type: 'text', required: true },
          { name: 'purchase_date', label: 'Purchase Date', type: 'date', required: true },
          { name: 'purpose_for', label: 'For (Purpose)', type: 'text', required: true },
          { name: 'used_by', label: 'Used By', type: 'text', required: true },
          { name: 'amc_renewal_date', label: 'AMC / Renewal Date', type: 'date' },
          { name: 'po_number', label: 'PO Number', type: 'text' },
          { name: 'po_pdf_url', label: 'PO PDF Upload', type: 'file' },
          {
            name: 'vendor_id',
            label: 'Vendor',
            type: 'select',
            options: vendors.map(v => ({ value: v.id, label: v.vendor_name })),
            required: false
          },
          { name: 'number_of_licenses', label: 'Number of Licenses / Seats', type: 'number', required: true },
          { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Expiring Soon', 'Expired'], required: true }
        ];
      case 'purchase-orders':
        return [
          { name: 'po_number', label: 'PO Number', type: 'text', readOnly: true },
          {
            name: 'vendor_id',
            label: 'Vendor',
            type: 'select',
            options: vendors.map(v => ({ value: v.id, label: v.vendor_name })),
            required: false
          },
          { name: 'item_description', label: 'Item Description', type: 'textarea', required: true },
          { name: 'amount', label: 'Amount (INR)', type: 'number', required: true },
          { name: 'po_date', label: 'PO Date', type: 'date', required: true },
          { name: 'status', label: 'Status', type: 'select', options: ['Raised', 'Approved', 'Fulfilled', 'Cancelled'], required: true }
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
            <h1 className="mis-page-title">IT Department Portal</h1>
            <p className="mis-page-desc">
              Track cybersecurity audits, vulnerabilities, vendor support contracts, software/hardware asset lifecycles, and CSCRF controls.
            </p>
          </div>
          
          {sheetTab !== 'po-generator' && (
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  setCsvModalOpen(true);
                  setCsvHeaders([]);
                  setCsvRows([]);
                  setCsvImportErrors([]);
                  setCsvValidation(null);
                  setCsvHasSample(false);
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
          )}
        </header>

        {/* Sheet Tab Bar */}
        <div className="mis-module-tabs flex-wrap mb-4">
          {[
            { id: 'audit-schedule', label: 'Audit Filing & Countdown' },
            { id: 'audits', label: 'Audits' },
            { id: 'audit-findings', label: 'Audit Findings' },
            { id: 'vendors', label: 'Vendors' },
            { id: 'amc-contracts', label: 'AMC Contracts' },
            { id: 'assets', label: 'Assets' },
            { id: 'diagrams', label: 'Diagrams' },
            { id: 'servers', label: 'Servers & Config' },
            { id: 'cybersecurity-compliance', label: 'Compliance Control' },
            { id: 'tickets', label: 'Support Tickets' },
            { id: 'incidents', label: 'Incidents & RCA' },
            { id: 'projects', label: 'Projects' },
            { id: 'software', label: 'Software Register' },
            { id: 'team-duties', label: 'Team Duties' },
            { id: 'purchase-orders', label: 'Purchase Orders', icon: '🧾' },
            { id: 'po-generator', label: 'PO Generator', icon: '🌐' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSheetTab(tab.id)}
              className={`mis-module-tab ${sheetTab === tab.id ? 'active' : ''}`}
            >
              {tab.icon || '📄'} {tab.label.toUpperCase()}
            </button>
          ))}
        </div>

        {/* PO Generator — external tool embedded inline (no API of its own,
            so nothing here feeds the dashboard; see the Purchase Orders
            sheet for that). Rendered instead of the normal list/register
            content entirely. */}
        {sheetTab === 'po-generator' ? (
          <div className="mis-card p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Build and print your PO below, then log it here so it shows up on the dashboard — this tool doesn't save anything on its own.
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => { pendingActiveTabRef.current = 'list'; setSheetTab('purchase-orders'); }}
                  className="px-3 py-1.5 border rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  📋 View Purchase Orders
                </button>
                <a
                  href="https://po.sharewealthindia.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold whitespace-nowrap hover:underline"
                  style={{ color: 'var(--text-accent)' }}
                >
                  Open in new tab ↗
                </a>
              </div>
            </div>
            <iframe
              src="https://po.sharewealthindia.in/"
              title="PO Generator"
              // Without a sandbox, a framed page has no restrictions at all —
              // notably it could navigate our top-level tab away to another
              // URL (a classic hostile/compromised-iframe move). This grants
              // exactly what the PO tool needs (scripts, its own storage,
              // downloads, popups/print) while withholding top-navigation.
              // Deliberately NOT including allow-popups-to-escape-sandbox:
              // that token would let any popup the tool opens run fully
              // unsandboxed, which could reach back via window.opener.top
              // and navigate this tab anyway — closing that off entirely
              // rather than relying on omitting top-navigation alone.
              sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-modals"
              style={{ width: '100%', height: '80vh', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
            />

            {/* Inline "Save Record" — logs the PO built above without
                switching tabs. Same createEntry('purchase-orders', ...)
                call the Purchase Orders sheet's own form uses. */}
            <form onSubmit={handleQuickSavePo} className="mt-5 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>🧾 Log This PO</h3>
              <p className="text-[10px] mb-3" style={{ color: 'var(--text-secondary)' }}>PO Number is assigned automatically when you save.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <select
                  value={poQuickForm.vendor_id || ''}
                  onChange={e => setPoQuickForm({ ...poQuickForm, vendor_id: e.target.value })}
                  className="mis-select text-xs"
                >
                  <option value="">Vendor (optional)</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.vendor_name}</option>)}
                </select>
                <input
                  type="number"
                  placeholder="Amount (INR) *"
                  value={poQuickForm.amount ?? ''}
                  onChange={e => setPoQuickForm({ ...poQuickForm, amount: e.target.value })}
                  className="mis-input text-xs"
                />
                <input
                  type="date"
                  value={poQuickForm.po_date || ''}
                  onChange={e => setPoQuickForm({ ...poQuickForm, po_date: e.target.value })}
                  className="mis-input text-xs"
                />
                <select
                  value={poQuickForm.status || 'Raised'}
                  onChange={e => setPoQuickForm({ ...poQuickForm, status: e.target.value })}
                  className="mis-select text-xs"
                >
                  {['Raised', 'Approved', 'Fulfilled', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <textarea
                  placeholder="Item Description *"
                  value={poQuickForm.item_description || ''}
                  onChange={e => setPoQuickForm({ ...poQuickForm, item_description: e.target.value })}
                  className="mis-input text-xs sm:col-span-2 lg:col-span-3"
                  rows={2}
                />
              </div>
              <button
                type="submit"
                disabled={poQuickSubmitting}
                className="mt-3 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                style={{ background: 'var(--text-accent)', color: 'white' }}
              >
                {poQuickSubmitting ? 'Saving...' : '💾 Save Record'}
              </button>
            </form>
          </div>
        ) : activeTab === 'list' ? (
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
              {hasMultiBranchAccess && !['audit-schedule', 'team-duties'].includes(sheetTab) && (
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
                {selectedIds.length > 0 && (
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
                        {['Active', 'Compliant', 'Non-Compliant', 'Resolved', 'Mitigated', 'Closed', 'Implemented', 'Expired', 'In Progress', 'Upcoming', 'Filed', 'Overdue', 'Renewal Due', 'Renewed', 'Lapsed', 'Expiring Soon'].map(st => (
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
                      {sheetTab === 'assets' && (
                        <>
                          <th>Current Book Value</th>
                          <th>Upgrade Needed</th>
                        </>
                      )}
                      {(sheetTab === 'audit-schedule' || sheetTab === 'amc-contracts' || sheetTab === 'software') && (
                        <th>Days to Go</th>
                      )}
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
                          if (f.name === 'vendor_id' && row.it_vendors) {
                            val = row.it_vendors.vendor_name;
                          } else if (f.name === 'audit_id' && row.it_audits) {
                            val = row.it_audits.audit_name;
                          } else if (f.name === 'linked_asset_id' && row.it_assets) {
                            val = row.it_assets.asset_id;
                          } else if (f.name === 'linked_diagram_id' && row.it_diagrams) {
                            val = row.it_diagrams.diagram_name;
                          } else if (f.name === 'profile_id' && row.profiles) {
                            val = row.profiles.full_name;
                          } else if (f.name === 'reporting_to' && row.reporting_to_profile) {
                            val = row.reporting_to_profile.full_name;
                          } else if (typeof val === 'boolean') {
                            val = val ? 'Yes' : 'No';
                          }

                          if (f.type === 'file' && val && typeof val === 'string' && val.startsWith('http')) {
                            return (
                              <td key={f.name}>
                                <a
                                  href={val}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-teal-400 hover:underline font-semibold text-xs"
                                >
                                  📄 View File
                                </a>
                              </td>
                            );
                          }

                          return (
                            <td key={f.name} className="truncate max-w-[200px]" title={String(val || '')}>
                              {val !== undefined && val !== null ? String(val) : '-'}
                            </td>
                          );
                        })}
                        {sheetTab === 'assets' && (
                          <>
                            <td className="text-green-400 font-semibold">₹{row.book_value}</td>
                            <td>
                              {row.time_to_upgrade ? (
                                <span className="px-2 py-0.5 text-xs rounded bg-red-900/50 text-red-300 border border-red-500/30">
                                  Yes (Upgrade)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-xs rounded bg-green-900/50 text-green-300 border border-green-500/30">
                                  No
                                </span>
                              )}
                            </td>
                          </>
                        )}
                        {(sheetTab === 'audit-schedule' || sheetTab === 'amc-contracts' || sheetTab === 'software') && (
                          <td>
                            <CountdownBadge dueDate={sheetTab === 'audit-schedule' ? row.next_due_date : row.amc_renewal_date} />
                          </td>
                        )}
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

            <form onSubmit={handleFormSubmitTrigger} noValidate className="space-y-5 text-left">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Dynamically Render Inputs based on active tab fields list */}
                {getFormFields().map(f => {
                  if (f.type === 'select') {
                    const opts = f.options || [];
                    const isCustomCapable = opts.includes('Other') || Boolean(STANDARD_FIELD_OPTIONS[sheetTab] && STANDARD_FIELD_OPTIONS[sheetTab][f.name]);

                    if (isCustomCapable) {
                      const dynamicTypes = getDynamicFieldOptions(sheetTab, f.name);
                      const isOtherSelected = formData[`${f.name}_is_other`] || formData[`${f.name}_select`] === 'Other';
                      const currentVal = formData[f.name];

                      let selectedOption = '';
                      if (formData[`${f.name}_select`] !== undefined) {
                        selectedOption = formData[`${f.name}_select`];
                      } else if (isOtherSelected) {
                        selectedOption = 'Other';
                      } else if (currentVal) {
                        selectedOption = dynamicTypes.includes(currentVal) ? currentVal : 'Other';
                      }

                      const showOtherInput = selectedOption === 'Other' || isOtherSelected;

                      return (
                        <div key={f.name} className="flex flex-col gap-2">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                              {f.label} {f.required && <span className="text-red-500">*</span>}
                            </label>
                            <select
                              className="mis-select w-full"
                              value={selectedOption}
                              onChange={e => {
                                const val = e.target.value;
                                if (val === 'Other') {
                                  setFormData({
                                    ...formData,
                                    [`${f.name}_select`]: 'Other',
                                    [`${f.name}_is_other`]: true,
                                    [f.name]: formData[`custom_${f.name}`] || ''
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    [`${f.name}_select`]: val,
                                    [`${f.name}_is_other`]: false,
                                    [f.name]: val,
                                    [`custom_${f.name}`]: ''
                                  });
                                }
                              }}
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

                          {showOtherInput && (
                            <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-teal-500/20 bg-teal-500/5 animate-fadeIn">
                              <label className="text-xs font-bold uppercase tracking-wider text-teal-400">
                                Specify Custom {f.label} <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                className="mis-input w-full"
                                placeholder={`e.g. Enter custom ${f.label.toLowerCase()}...`}
                                value={formData[`custom_${f.name}`] !== undefined ? formData[`custom_${f.name}`] : (dynamicTypes.includes(formData[f.name]) ? '' : (formData[f.name] || ''))}
                                onChange={e => {
                                  const customVal = e.target.value;
                                  setFormData({
                                    ...formData,
                                    [`custom_${f.name}`]: customVal,
                                    [f.name]: customVal
                                  });
                                }}
                                required
                                maxLength={100}
                              />
                            </div>
                          )}
                        </div>
                      );
                    }

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
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            {f.label} {f.required && <span className="text-red-500">*</span>}
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const current = formData[f.name];
                              setFormData({
                                ...formData,
                                [f.name]: current === 'NIL' ? '' : 'NIL'
                              });
                            }}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-all cursor-pointer ${
                              formData[f.name] === 'NIL'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                                : 'text-slate-400 border border-slate-700/80 hover:text-teal-300 hover:border-teal-500/50 hover:bg-teal-500/10'
                            }`}
                            title="Click to set NIL if no data is available"
                          >
                            {formData[f.name] === 'NIL' ? '✓ NIL' : '+ NIL'}
                          </button>
                        </div>
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

                  if (f.type === 'file') {
                    const currentUrl = formData[f.name];
                    return (
                      <div key={f.name} className="flex flex-col gap-1.5 md:col-span-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          {f.label} {f.required && <span className="text-red-500">*</span>}
                        </label>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                          <input
                            type="file"
                            accept="image/*,application/pdf,.zip,.vsdx,.drawio"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const loadToast = toast.loading('Uploading document...');
                              try {
                                const res = await itService.uploadDocument(file);
                                setFormData((prev: any) => ({ ...prev, [f.name]: res.fileUrl }));
                                toast.success('Document uploaded successfully.', { id: loadToast });
                              } catch (err) {
                                console.error(err);
                                toast.error('Document upload failed.', { id: loadToast });
                              }
                            }}
                            className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-teal-55 file:text-teal-700 dark:file:bg-slate-800 dark:file:text-slate-200 hover:file:bg-teal-100 cursor-pointer"
                          />
                          {currentUrl && (
                            <a
                              href={currentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3.5 py-1.5 border rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                              style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}
                            >
                              📄 View File
                            </a>
                          )}
                        </div>
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

                  if (f.readOnly) {
                    return (
                      <div key={f.name} className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          {f.label}
                        </label>
                        <input
                          type="text"
                          className="mis-input w-full disabled:opacity-75 disabled:cursor-not-allowed font-semibold"
                          value={editingId ? (formData[f.name] || '') : 'Auto-generated on save'}
                          disabled
                        />
                      </div>
                    );
                  }

                  const isTextLike = f.type === 'text' || f.type === 'tel';
                  return (
                    <div key={f.name} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          {f.label} {f.required && <span className="text-red-500">*</span>}
                        </label>
                        {isTextLike && (
                          <button
                            type="button"
                            onClick={() => {
                              const current = formData[f.name];
                              setFormData({
                                ...formData,
                                [f.name]: current === 'NIL' ? '' : 'NIL'
                              });
                            }}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-all cursor-pointer ${
                              formData[f.name] === 'NIL'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                                : 'text-slate-400 border border-slate-700/80 hover:text-teal-300 hover:border-teal-500/50 hover:bg-teal-500/10'
                            }`}
                            title="Click to set NIL if no data is available"
                          >
                            {formData[f.name] === 'NIL' ? '✓ NIL' : '+ NIL'}
                          </button>
                        )}
                      </div>
                      <input
                        type={f.type}
                        className="mis-input w-full"
                        value={formData[f.name] || ''}
                        onChange={e => setFormData({ ...formData, [f.name]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                        required={f.required}
                        min={f.type === 'number' ? 0 : undefined}
                        maxLength={f.type === 'text' ? 255 : undefined}
                      />
                    </div>
                  );
                })}

                {/* Straight-line Depreciation Preview Block */}
                {sheetTab === 'assets' && deprEst && (
                  <div className="md:col-span-2 p-4 rounded border border-indigo-500/20 bg-indigo-900/10 mt-2">
                    <h4 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                      Live Depreciation Estimate (WDV)
                    </h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="block text-[10px] text-gray-400">Years Elapsed:</span>
                        <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{deprEst.yearsElapsed} Years</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-gray-400">Estimated Book Value:</span>
                        <span className="text-green-400 font-bold">₹{deprEst.bookValue}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-gray-400">Useful Life Status:</span>
                        {deprEst.isExpired ? (
                          <span className="text-red-400 font-bold">Expired (Upgrade Needed)</span>
                        ) : (
                          <span className="text-green-400 font-bold">Active</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Branch selector if admin — hidden for HO-only sheets, which have no branch_id column at all */}
                {hasMultiBranchAccess && !editingId && !['audit-schedule', 'team-duties'].includes(sheetTab) && (
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

            {/* Save Confirmation Modal */}
      {confirmSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md p-6 rounded-2xl bg-gray-900 border border-gray-800 shadow-2xl text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {editingId ? 'Confirm Record Update' : 'Confirm Record Submission'}
                </h3>
                <p className="text-xs text-gray-400">Please verify the entered details</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gray-950/70 border border-gray-800/80 mb-5">
              <p className="text-sm text-gray-300 leading-relaxed">
                Are you sure you want to {editingId ? 'update' : 'save'} this record? Please make sure all entered data is accurate and complete before proceeding.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 border border-gray-700 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-gray-800 hover:border-gray-600 transition-colors"
                onClick={() => setConfirmSaveModalOpen(false)}
                disabled={submitting}
              >
                Review Again / Cancel
              </button>
              <button
                type="button"
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-lg shadow-teal-600/30 transition-all flex items-center gap-2"
                onClick={handleConfirmSave}
                disabled={submitting}
              >
                {submitting ? 'Saving...' : editingId ? 'Yes, Update Record' : 'Yes, Save Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Batch Upload Modal */}
      {csvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-4xl p-6 rounded-lg bg-gray-900 border border-gray-800 shadow-2xl text-left">
            <h3 className="text-lg font-bold text-white mb-4">Bulk Import CSV Records</h3>

            <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
              <CsvImportGuide
                fields={getFormFields().filter(f => !f.readOnly).map(f => ({ key: f.name, label: f.label }))}
                templateFilename={`it-${sheetTab}-template.csv`}
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

              {/* Per-row failure report — valid rows still get imported;
                  only the rows below need fixing and re-uploading. */}
              {csvImportErrors.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-400 mb-2">
                    {csvImportErrors.length} Row{csvImportErrors.length === 1 ? '' : 's'} Failed
                  </h4>
                  <div className="max-h-[180px] overflow-y-auto border border-red-900/40 rounded bg-red-950/20 divide-y divide-red-900/30">
                    {csvImportErrors.map(fe => (
                      <div key={fe.row} className="px-3 py-2 text-xs">
                        <span className="font-semibold text-red-300">Row {fe.row}:</span>{' '}
                        <span className="text-red-200">{fe.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-gray-800">
              <button
                type="button"
                className="px-4 py-2 border border-gray-700 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-gray-800 hover:border-gray-600 transition-colors"
                onClick={() => {
                  setCsvModalOpen(false);

                  setCsvHeaders([]);
                  setCsvRows([]);
                  setCsvImportErrors([]);
                }}
              >
                Close
              </button>
              <button
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
                disabled={csvRows.length === 0 || csvImporting || !!csvValidation || csvHasSample}
                onClick={handleImportCsv}
              >
                {csvImporting ? 'Importing...' : `Execute Import (${csvRows.length} Rows)`}
              </button>
            </div>
          </div>
        </div>
      )}

      <ViewDetailsModal record={viewingRecord} onClose={() => setViewingRecord(null)} title="IT Record Details" />
    </DashboardLayout>
  );
};

export default ITDataEntryPage;
