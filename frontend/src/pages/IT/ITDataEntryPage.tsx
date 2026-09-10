import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../components/layout/DashboardLayout';
import CountdownBadge from '../../components/common/CountdownBadge';
import ViewDetailsModal from '../../components/common/ViewDetailsModal';
import ConfirmModal from '../../components/common/ConfirmModal';
import { INITIAL_CONFIRM_STATE, type ConfirmDialogState } from '../../types/confirm.types';
import CsvImportGuide from '../../components/common/CsvImportGuide';
import { validateCsvHeaders, containsSampleSentinel, type CsvHeaderValidation } from '../../utils/csvBulkImportHelpers';
import { itService } from '../../services/it.service';
import { orgService } from '../../services/org.service';
import { authService } from '../../services/auth.service';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
    remember: 'Log the PO here with its PO number immediately after generating it, so there is a permanent audit trail in MIS.',
  },
};

export interface POItem {
  id: string;
  description: string;
  hsnSac: string;
  qty: number;
  unit: string;
  rate: number;
  gstRate: number;
}

function numberToWordsIndian(num: number): string {
  if (isNaN(num) || num === 0) return 'Rupees Zero Only';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n: number): string => {
    let str = '';
    if (n > 99) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)] + ' ' + a[n % 10] + ' ';
    } else if (n > 0) {
      str += a[n] + ' ';
    }
    return str.trim();
  };

  const whole = Math.floor(Math.abs(num));
  const fraction = Math.round((Math.abs(num) - whole) * 100);

  const crore = Math.floor(whole / 10000000);
  const lakh = Math.floor((whole % 10000000) / 100000);
  const thousand = Math.floor((whole % 100000) / 1000);
  const hundred = whole % 1000;

  let res = '';
  if (crore > 0) res += inWords(crore) + ' Crore ';
  if (lakh > 0) res += inWords(lakh) + ' Lakh ';
  if (thousand > 0) res += inWords(thousand) + ' Thousand ';
  if (hundred > 0) res += inWords(hundred) + ' ';

  res = res.trim();
  if (!res) res = 'Zero';

  let out = 'Rupees ' + res;
  if (fraction > 0) {
    out += ' and ' + inWords(fraction) + ' Paise';
  }
  out += ' Only';
  return out;
}

const POGeneratorComponent: React.FC<{
  vendors?: Array<{ id: string; vendor_name: string; [key: string]: any }>;
  onSaveToMIS?: (poRecord: {
    po_number: string;
    vendor_id?: string;
    vendor_name?: string;
    amount: number;
    po_date: string;
    item_description: string;
    status: string;
    terms?: string;
  }) => Promise<void>;
  onViewList?: () => void;
}> = ({
  vendors = [],
  onSaveToMIS,
  onViewList
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [editorTab, setEditorTab] = useState<'details' | 'items' | 'terms' | 'settings'>('details');

  // Metadata
  const [poNumber, setPoNumber] = useState<string>(`SSL/IT/${new Date().getFullYear()}-${(new Date().getFullYear() + 1).toString().slice(-2)}/${Math.floor(100 + Math.random() * 900)}`);
  const [poDate, setPoDate] = useState<string>(todayStr);
  const [quotationRef, setQuotationRef] = useState<string>('QTN-2026-09');
  const [quotationDate, setQuotationDate] = useState<string>(todayStr);
  const [paymentTerms, setPaymentTerms] = useState<string>('30 Days after Delivery & Invoice');
  const [deliveryTimeline, setDeliveryTimeline] = useState<string>('Within 7-10 Business Days');
  const [subject, setSubject] = useState<string>('Purchase Order for IT Infrastructure Hardware & Support Services');

  // Company / Buyer Info
  const [companyName] = useState<string>('SHAREWEALTH SECURITIES LTD.');
  const [companyAddress] = useState<string>('Sharewealth House, 4th Floor, ST Stand Road, Thrissur - 680001, Kerala');
  const [companyGstin] = useState<string>('32AABCS8800M1ZF');
  const [companyPan] = useState<string>('AABCS8800M');
  const [companyCin] = useState<string>('U67120KL2005PLC018045');
  const [companyContact] = useState<string>('Email: it@sharewealthindia.com | Phone: +91 487 242 0400');

  // Vendor / Supplier Info
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [vendorName, setVendorName] = useState<string>('Synapsewave Innovations Private Limited');
  const [vendorAddress, setVendorAddress] = useState<string>('Door No. 12/450, Cyber Valley, InfoPark, Kochi - 682042, Kerala');
  const [vendorGstin, setVendorGstin] = useState<string>('32AAAAA0000A1Z5');
  const [vendorState, setVendorState] = useState<string>('Kerala (32)');
  const [vendorContact, setVendorContact] = useState<string>('contact@synapsewave.in | +91 98470 12345');

  // Consignee / Delivery (Ship To) Info
  const [shipToName, setShipToName] = useState<string>('Sharewealth Securities Ltd. (IT Dept)');
  const [shipToAddress, setShipToAddress] = useState<string>('Sharewealth House, Main Server Room, Thrissur - 680001, Kerala');
  const [shipToContact, setShipToContact] = useState<string>('Attn: IT Infrastructure Team | Phone: +91 487 242 0400');

  // Settings
  const [gstType, setGstType] = useState<'intra' | 'inter'>('intra');
  const [letterheadMarginMm, setLetterheadMarginMm] = useState<number>(0);
  const [notes, setNotes] = useState<string>(
    '1. Invoice must quote this Purchase Order number and include valid GSTIN.\n2. Goods must be delivered in original sealed packaging with manufacturer warranty certificates.\n3. Payment will be released via NEFT/RTGS after physical verification, installation, and inspection.\n4. All disputes are subject to Thrissur jurisdiction only.'
  );

  // Signatory
  const [signatoryName, setSignatoryName] = useState<string>('Authorized Signatory');
  const [signatoryDesignation, setSignatoryDesignation] = useState<string>('Head of Information Technology');
  const [signatureImage, setSignatureImage] = useState<string | null>(null);

  // Line Items
  const [items, setItems] = useState<POItem[]>([
    {
      id: '1',
      description: 'APC Smart-UPS 3kVA On-Line 230V with Rail Kit & SNMP Network Card (3 Yrs Warranty)',
      hsnSac: '85044090',
      qty: 1,
      unit: 'Nos',
      rate: 45000,
      gstRate: 18
    },
    {
      id: '2',
      description: 'Cisco Catalyst 24-Port Gigabit Managed Layer-3 Switch (WS-C2960X-24TD-L)',
      hsnSac: '85176290',
      qty: 2,
      unit: 'Nos',
      rate: 32500,
      gstRate: 18
    }
  ]);

  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [poConfirmModal, setPoConfirmModal] = useState<ConfirmDialogState>(INITIAL_CONFIRM_STATE);
  const [savingToMis, setSavingToMis] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const handleVendorSelect = (vId: string) => {
    setSelectedVendorId(vId);
    if (!vId) return;
    const found = vendors.find(v => String(v.id) === String(vId));
    if (found) {
      setVendorName(found.vendor_name || '');
      const addr = [found.address, found.branch, found.city, found.state].filter(Boolean).join(', ');
      if (addr) setVendorAddress(addr);
      if (found.gstin || found.gst_number) setVendorGstin(found.gstin || found.gst_number);
      if (found.state) setVendorState(found.state);
      const contact = [found.contact_person, found.phone, found.email].filter(Boolean).join(' | ');
      if (contact) setVendorContact(contact);
    }
  };

  const handleAddItem = () => {
    const newItem: POItem = {
      id: Date.now().toString(),
      description: '',
      hsnSac: '',
      qty: 1,
      unit: 'Nos',
      rate: 0,
      gstRate: 18
    };
    setItems([...items, newItem]);
  };

  const handleUpdateItem = (id: string, field: keyof POItem, value: any) => {
    setItems(items.map(item => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      toast.error('Purchase Order must have at least one line item.');
      return;
    }
    setItems(items.filter(item => item.id !== id));
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    items.forEach(item => {
      const taxable = (Number(item.qty) || 0) * (Number(item.rate) || 0);
      subtotal += taxable;
      const gst = (taxable * (Number(item.gstRate) || 0)) / 100;
      if (gstType === 'intra') {
        totalCgst += gst / 2;
        totalSgst += gst / 2;
      } else {
        totalIgst += gst;
      }
    });

    const totalTax = gstType === 'intra' ? (totalCgst + totalSgst) : totalIgst;
    const rawGrandTotal = subtotal + totalTax;
    const roundedGrandTotal = Math.round(rawGrandTotal);
    const roundOff = Number((roundedGrandTotal - rawGrandTotal).toFixed(2));

    return {
      subtotal,
      totalCgst,
      totalSgst,
      totalIgst,
      totalTax,
      roundOff,
      grandTotal: roundedGrandTotal
    };
  };

  const totals = calculateTotals();

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Signature image should be less than 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setSignatureImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleNewPO = () => {
    setPoConfirmModal({
      isOpen: true,
      title: 'Reset Purchase Order',
      message: 'Are you sure you want to reset this Purchase Order and create a new one? Any unsaved changes will be lost.',
      confirmLabel: 'Reset PO',
      cancelLabel: 'Cancel',
      isDanger: false,
      onConfirm: () => {
        setPoConfirmModal(INITIAL_CONFIRM_STATE);
        setPoNumber(`SSL/IT/${new Date().getFullYear()}-${(new Date().getFullYear() + 1).toString().slice(-2)}/${Math.floor(100 + Math.random() * 900)}`);
        setPoDate(new Date().toISOString().split('T')[0]);
        setQuotationRef('');
        setQuotationDate('');
        setSelectedVendorId('');
        setVendorName('');
        setVendorAddress('');
        setVendorGstin('');
        setVendorContact('');
        setItems([{
          id: Date.now().toString(),
          description: '',
          hsnSac: '',
          qty: 1,
          unit: 'Nos',
          rate: 0,
          gstRate: 18
        }]);
        setSignatureImage(null);
        toast.success('Ready for new Purchase Order.');
      }
    });
  };

  // --- PERFECT A4 PDF GENERATION (Semantic Table capture, Zero input artifacts) ---
  const handleGeneratePdf = async () => {
    if (!sheetRef.current) {
      toast.error('PO Document element not found.');
      return;
    }

    setGeneratingPdf(true);
    const loadingToast = toast.loading('Generating high-resolution aligned PDF...');

    try {
      await new Promise(r => setTimeout(r, 150));

      const element = sheetRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: 900,
        onclone: (clonedDoc) => {
          // Remove external stylesheets containing Tailwind v4 oklch rules
          const existingStyles = clonedDoc.querySelectorAll('style, link[rel="stylesheet"]');
          existingStyles.forEach(s => s.remove());

          // Inject standalone, print-perfect CSS
          const customStyle = clonedDoc.createElement('style');
          customStyle.textContent = `
            * {
              box-sizing: border-box !important;
              font-family: Arial, Helvetica, sans-serif !important;
            }
            body {
              background-color: #ffffff !important;
              color: #0f172a !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            table {
              border-collapse: collapse !important;
            }
            th, td {
              box-sizing: border-box !important;
            }
            .no-print {
              display: none !important;
            }
          `;
          clonedDoc.head.appendChild(customStyle);
        }
      });

      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Canvas render failed: blank dimensions.');
      }

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 8;
      const printWidth = pageWidth - (margin * 2);
      const printHeight = (canvas.height * printWidth) / canvas.width;

      if (printHeight <= (pageHeight - (margin * 2))) {
        pdf.addImage(imgData, 'PNG', margin, margin, printWidth, printHeight);
      } else {
        let heightLeft = printHeight;
        let position = margin;

        pdf.addImage(imgData, 'PNG', margin, position, printWidth, printHeight);
        heightLeft -= (pageHeight - (margin * 2));

        while (heightLeft > 0) {
          position = heightLeft - printHeight + margin;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', margin, position, printWidth, printHeight);
          heightLeft -= (pageHeight - (margin * 2));
        }
      }

      const cleanFilename = (poNumber || 'Purchase_Order').replace(/[^a-zA-Z0-9_-]/g, '_') + '.pdf';
      pdf.save(cleanFilename);

      toast.dismiss(loadingToast);
      toast.success('PDF downloaded successfully!');
    } catch (err: any) {
      console.error('PDF Generation Error:', err);
      toast.dismiss(loadingToast);
      toast.error('Failed to generate PDF: ' + (err.message || 'Unknown error'));
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportWord = () => {
    if (!sheetRef.current) return;
    const content = sheetRef.current.innerHTML;
    const fullHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><title>${poNumber}</title><meta charset='utf-8'><style>
        body { font-family: Arial, sans-serif; font-size: 10pt; color: #111; }
        table { border-collapse: collapse; width: 100%; margin: 8px 0; }
        th, td { border: 1px solid #999; padding: 6px 8px; font-size: 9.5pt; }
        th { background-color: #f2f2f2; font-weight: bold; }
      </style></head>
      <body>${content}</body></html>
    `;
    const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(poNumber || 'Purchase_Order').replace(/[^a-zA-Z0-9_-]/g, '_')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Word document downloaded.');
  };

  const handleSaveRecord = async () => {
    if (!onSaveToMIS) {
      toast.error('Save handler not connected.');
      return;
    }
    if (!vendorName && !selectedVendorId) {
      toast.error('Please enter or select a Vendor Name.');
      return;
    }
    if (totals.grandTotal <= 0) {
      toast.error('Total Amount must be greater than 0.');
      return;
    }

    setSavingToMis(true);
    try {
      const summaryItems = items.map(i => `${i.description} (Qty: ${i.qty})`).join('; ');
      await onSaveToMIS({
        po_number: poNumber,
        vendor_id: selectedVendorId || undefined,
        vendor_name: vendorName,
        amount: totals.grandTotal,
        po_date: poDate,
        item_description: summaryItems || subject,
        status: 'Raised',
        terms: notes
      });
      toast.success(`Purchase Order ${poNumber} logged to MIS database!`);
    } catch (err: any) {
      console.error('Error saving PO to MIS:', err);
      toast.error(err?.response?.data?.message || 'Failed to save PO to database.');
    } finally {
      setSavingToMis(false);
    }
  };

  return (
    <div className="po-generator-container space-y-6">
      {/* ════════════════════════════════════════════════════════════
          PRINT CSS (Only prints pristine PO sheet with deep bold contrast)
          ════════════════════════════════════════════════════════════ */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #po-document-sheet, #po-document-sheet * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #po-document-sheet {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 6mm !important;
            box-shadow: none !important;
            border: none !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* ════════════════════════════════════════════════════════════
          TOP ACTION TOOLBAR (No print)
          ════════════════════════════════════════════════════════════ */}
      <div className="no-print mis-card p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <span>🧾</span> Purchase Order Maker & PDF Generator
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Edit your PO details in the builder below. The live sheet preview updates instantly and exports to high-resolution, perfectly aligned A4 PDF.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleNewPO}
              className="mis-btn mis-btn-ghost mis-btn-sm"
            >
              ➕ New PO
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="mis-btn mis-btn-ghost mis-btn-sm"
            >
              🖨️ Print
            </button>
            <button
              type="button"
              onClick={handleExportWord}
              className="mis-btn mis-btn-ghost mis-btn-sm"
            >
              📄 Word (.doc)
            </button>
            <button
              type="button"
              onClick={handleGeneratePdf}
              disabled={generatingPdf}
              className="mis-btn mis-btn-sm font-bold text-white shadow-md transition-all hover:opacity-95 disabled:opacity-50 flex items-center gap-1.5"
              style={{ background: '#059669' }}
            >
              {generatingPdf ? '⏳ Generating...' : '📥 Download PDF'}
            </button>
            {onSaveToMIS && (
              <button
                type="button"
                onClick={handleSaveRecord}
                disabled={savingToMis}
                className="mis-btn mis-btn-primary mis-btn-sm font-bold flex items-center gap-1.5"
              >
                {savingToMis ? 'Saving...' : '💾 Save to MIS'}
              </button>
            )}
            {onViewList && (
              <button
                type="button"
                onClick={onViewList}
                className="mis-btn mis-btn-ghost mis-btn-sm ml-auto lg:ml-2"
              >
                📋 View Orders
              </button>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════
            INTERACTIVE PO BUILDER TABS
            ════════════════════════════════════════════════════════════ */}
        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
          {/* Sub tabs */}
          <div className="mis-tabs mb-4">
            <button
              type="button"
              onClick={() => setEditorTab('details')}
              className={`mis-tab ${editorTab === 'details' ? 'active' : ''}`}
            >
              📝 1. PO & Vendor Details
            </button>
            <button
              type="button"
              onClick={() => setEditorTab('items')}
              className={`mis-tab ${editorTab === 'items' ? 'active' : ''}`}
            >
              📦 2. Line Items ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setEditorTab('terms')}
              className={`mis-tab ${editorTab === 'terms' ? 'active' : ''}`}
            >
              ✍️ 3. Terms & Signature
            </button>
            <button
              type="button"
              onClick={() => setEditorTab('settings')}
              className={`mis-tab ${editorTab === 'settings' ? 'active' : ''}`}
            >
              ⚙️ 4. GST & Letterhead
            </button>
          </div>

          {/* TAB 1: PO & VENDOR DETAILS */}
          {editorTab === 'details' && (
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 p-4 rounded-xl border"
              style={{ background: 'var(--panel-inset-soft)', borderColor: 'var(--border)' }}
            >
              <div>
                <label className="text-[11px] font-bold block mb-1" style={{ color: 'var(--text-secondary)' }}>PO Number *</label>
                <input
                  type="text"
                  value={poNumber}
                  onChange={e => setPoNumber(e.target.value)}
                  className="mis-input text-xs w-full font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold block mb-1" style={{ color: 'var(--text-secondary)' }}>PO Date *</label>
                <input
                  type="date"
                  value={poDate}
                  onChange={e => setPoDate(e.target.value)}
                  className="mis-input text-xs w-full"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold block mb-1" style={{ color: 'var(--text-secondary)' }}>Quotation Ref</label>
                <input
                  type="text"
                  placeholder="e.g. QTN-2026-09"
                  value={quotationRef}
                  onChange={e => setQuotationRef(e.target.value)}
                  className="mis-input text-xs w-full"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold block mb-1" style={{ color: 'var(--text-secondary)' }}>Quotation Date</label>
                <input
                  type="date"
                  value={quotationDate}
                  onChange={e => setQuotationDate(e.target.value)}
                  className="mis-input text-xs w-full"
                />
              </div>

              {/* Vendor Section */}
              <div className="md:col-span-2 pt-3 border-t space-y-2.5" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold" style={{ color: 'var(--text-accent)' }}>🏢 Vendor / Supplier Information</span>
                  <select
                    value={selectedVendorId}
                    onChange={e => handleVendorSelect(e.target.value)}
                    className="mis-select text-xs py-1 max-w-[200px]"
                  >
                    <option value="">-- Quick Autofill --</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.vendor_name}</option>
                    ))}
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Vendor Name *"
                  value={vendorName}
                  onChange={e => setVendorName(e.target.value)}
                  className="mis-input text-xs w-full font-bold"
                />
                <textarea
                  rows={2}
                  placeholder="Vendor Street Address, City, PIN"
                  value={vendorAddress}
                  onChange={e => setVendorAddress(e.target.value)}
                  className="mis-input text-xs w-full"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Vendor GSTIN (e.g. 32AAAAA0000A1Z5)"
                    value={vendorGstin}
                    onChange={e => setVendorGstin(e.target.value)}
                    className="mis-input text-xs font-mono"
                  />
                  <input
                    type="text"
                    placeholder="State & Code (e.g. Kerala (32))"
                    value={vendorState}
                    onChange={e => setVendorState(e.target.value)}
                    className="mis-input text-xs"
                  />
                </div>
              </div>

              {/* Delivery Section */}
              <div className="md:col-span-2 pt-3 border-t space-y-2.5" style={{ borderColor: 'var(--border)' }}>
                <span className="text-xs font-bold block" style={{ color: 'var(--text-accent)' }}>🚚 Delivery / Consignee Information</span>
                <input
                  type="text"
                  placeholder="Consignee Name"
                  value={shipToName}
                  onChange={e => setShipToName(e.target.value)}
                  className="mis-input text-xs w-full font-bold"
                />
                <textarea
                  rows={2}
                  placeholder="Delivery Address"
                  value={shipToAddress}
                  onChange={e => setShipToAddress(e.target.value)}
                  className="mis-input text-xs w-full"
                />
                <input
                  type="text"
                  placeholder="Delivery Instructions / Attention (e.g. Attn: IT Infrastructure Team | Phone: +91 487 242 0400)"
                  value={shipToContact}
                  onChange={e => setShipToContact(e.target.value)}
                  className="mis-input text-xs w-full"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Payment Terms (e.g. 30 Days)"
                    value={paymentTerms}
                    onChange={e => setPaymentTerms(e.target.value)}
                    className="mis-input text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Delivery Timeline (e.g. 7-10 Days)"
                    value={deliveryTimeline}
                    onChange={e => setDeliveryTimeline(e.target.value)}
                    className="mis-input text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LINE ITEMS BUILDER */}
          {editorTab === 'items' && (
            <div
              className="space-y-3.5 p-4 rounded-xl border"
              style={{ background: 'var(--panel-inset-soft)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                  Manage Line Items ({items.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="mis-btn mis-btn-sm font-bold text-white shadow-sm flex items-center gap-1"
                  style={{ background: '#059669' }}
                >
                  ➕ Add New Item Row
                </button>
              </div>

              <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <th className="p-2 text-center w-8">#</th>
                      <th className="p-2 text-left min-w-[200px]">Item Description & Specs *</th>
                      <th className="p-2 text-center w-24">HSN/SAC</th>
                      <th className="p-2 text-center w-16">Qty</th>
                      <th className="p-2 text-center w-20">Unit</th>
                      <th className="p-2 text-right w-28">Rate (₹)</th>
                      <th className="p-2 text-center w-20">GST %</th>
                      <th className="p-2 text-right w-24">Total (₹)</th>
                      <th className="p-2 text-center w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const itemTaxable = (Number(item.qty) || 0) * (Number(item.rate) || 0);
                      const itemGst = (itemTaxable * (Number(item.gstRate) || 0)) / 100;
                      const itemTotal = itemTaxable + itemGst;

                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="p-2 text-center font-bold" style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td className="p-2">
                            <input
                              type="text"
                              placeholder="Description & specs..."
                              value={item.description}
                              onChange={e => handleUpdateItem(item.id, 'description', e.target.value)}
                              className="mis-input text-xs w-full font-medium"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              placeholder="8504"
                              value={item.hsnSac}
                              onChange={e => handleUpdateItem(item.id, 'hsnSac', e.target.value)}
                              className="mis-input text-xs font-mono text-center"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min={1}
                              value={item.qty}
                              onChange={e => handleUpdateItem(item.id, 'qty', Math.max(1, Number(e.target.value)))}
                              className="mis-input text-xs text-center font-bold"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={item.unit}
                              onChange={e => handleUpdateItem(item.id, 'unit', e.target.value)}
                              className="mis-select text-xs py-1"
                            >
                              <option value="Nos">Nos</option>
                              <option value="Pcs">Pcs</option>
                              <option value="Lic">Lic</option>
                              <option value="Months">Months</option>
                              <option value="Years">Years</option>
                              <option value="Set">Set</option>
                              <option value="Mtr">Mtr</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={item.rate}
                              onChange={e => handleUpdateItem(item.id, 'rate', Number(e.target.value))}
                              className="mis-input text-xs font-mono font-bold text-right"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={item.gstRate}
                              onChange={e => handleUpdateItem(item.id, 'gstRate', Number(e.target.value))}
                              className="mis-select text-xs py-1 font-bold"
                            >
                              <option value={0}>0%</option>
                              <option value={5}>5%</option>
                              <option value={12}>12%</option>
                              <option value={18}>18%</option>
                              <option value={28}>28%</option>
                            </select>
                          </td>
                          <td className="p-2 text-right font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                            ₹{itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="mis-btn-icon text-red-500 hover:text-red-400 font-bold p-1 rounded transition-colors"
                              title="Delete Item"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap justify-between items-center pt-2 text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                <span>Subtotal: <strong style={{ color: 'var(--text-primary)' }}>₹{totals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                <span>Tax: <strong style={{ color: 'var(--text-primary)' }}>₹{totals.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                <span className="text-sm" style={{ color: 'var(--text-accent)' }}>
                  Grand Total: <strong>₹{totals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: TERMS & SIGNATURE */}
          {editorTab === 'terms' && (
            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border"
              style={{ background: 'var(--panel-inset-soft)', borderColor: 'var(--border)' }}
            >
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold block mb-1" style={{ color: 'var(--text-secondary)' }}>Subject Line</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="mis-input text-xs w-full font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold block mb-1" style={{ color: 'var(--text-secondary)' }}>Terms & Conditions</label>
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="mis-input text-xs w-full"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-bold block mb-1" style={{ color: 'var(--text-secondary)' }}>Signatory Information</label>
                <input
                  type="text"
                  placeholder="Signatory Name"
                  value={signatoryName}
                  onChange={e => setSignatoryName(e.target.value)}
                  className="mis-input text-xs w-full font-bold"
                />
                <input
                  type="text"
                  placeholder="Designation"
                  value={signatoryDesignation}
                  onChange={e => setSignatoryDesignation(e.target.value)}
                  className="mis-input text-xs w-full"
                />
                <div className="flex items-center gap-3 pt-2">
                  <label
                    className="cursor-pointer text-xs font-bold text-white px-3 py-1.5 rounded-lg shadow-sm hover:opacity-95 transition-opacity inline-block"
                    style={{ background: 'var(--accent)' }}
                  >
                    Upload Signature Image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSignatureUpload}
                      className="hidden"
                    />
                  </label>
                  {signatureImage && (
                    <button
                      type="button"
                      onClick={() => setSignatureImage(null)}
                      className="text-xs font-bold text-red-500 hover:underline"
                    >
                      Remove Signature
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SETTINGS */}
          {editorTab === 'settings' && (
            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border"
              style={{ background: 'var(--panel-inset-soft)', borderColor: 'var(--border)' }}
            >
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>GST Tax Mode:</label>
                <div className="flex items-center gap-1 p-1 rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setGstType('intra')}
                    className="flex-1 py-1.5 px-2 text-xs font-bold rounded-md transition-all"
                    style={{
                      background: gstType === 'intra' ? 'var(--accent)' : 'transparent',
                      color: gstType === 'intra' ? '#ffffff' : 'var(--text-secondary)'
                    }}
                  >
                    Intra-state (CGST + SGST)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGstType('inter')}
                    className="flex-1 py-1.5 px-2 text-xs font-bold rounded-md transition-all"
                    style={{
                      background: gstType === 'inter' ? 'var(--accent)' : 'transparent',
                      color: gstType === 'inter' ? '#ffffff' : 'var(--text-secondary)'
                    }}
                  >
                    Inter-state (IGST)
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <label className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Letterhead Top Blank Spacing:</label>
                  <span className="text-xs font-mono font-bold" style={{ color: 'var(--text-accent)' }}>{letterheadMarginMm} mm</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={60}
                    step={2}
                    value={letterheadMarginMm}
                    onChange={e => setLetterheadMarginMm(Number(e.target.value))}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setLetterheadMarginMm(0)}
                    className="text-[10px] px-2 py-0.5 border rounded-md"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
                  >
                    Reset
                  </button>
                </div>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {letterheadMarginMm === 0 ? 'Includes full Sharewealth company header.' : 'Leaves blank top spacing for pre-printed letterhead paper.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          LIVE DOCUMENT PREVIEW & PDF CAPTURE SHEET
          Built with 100% pure semantic HTML tables and explicit hex styles
          ════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col items-center overflow-x-auto py-3">
        <div className="no-print mb-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
          <span>📄</span> Live Document Preview (Matches Exported PDF Exactly)
        </div>

        <div
          id="po-document-sheet"
          ref={sheetRef}
          style={{
            width: '800px',
            minHeight: '1080px',
            backgroundColor: '#ffffff',
            color: '#000000',
            fontFamily: 'Arial, Helvetica, sans-serif',
            padding: '32px',
            border: '1.5px solid #000000',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            boxSizing: 'border-box'
          }}
        >
          {/* Top Letterhead Spacer if configured */}
          {letterheadMarginMm > 0 && (
            <div
              style={{
                height: `${letterheadMarginMm * 3.78}px`,
                width: '100%',
                borderBottom: '2px dashed #000000',
                marginBottom: '20px',
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: '900',
                color: '#000000',
                lineHeight: `${letterheadMarginMm * 3.78}px`
              }}
            >
              ↑ Letterhead Area — {letterheadMarginMm} mm blank space reserved for pre-printed letterhead
            </div>
          )}

          {/* Company Header Table (Shown when Letterhead Spacing is 0) */}
          {letterheadMarginMm === 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', borderBottom: '2.5px solid #000000', paddingBottom: '12px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '60px', verticalAlign: 'top', border: 'none', padding: '0 12px 12px 0' }}>
                    <div style={{ width: '48px', height: '48px', backgroundColor: '#000000', color: '#ffffff', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '26px', lineHeight: '48px', textAlign: 'center' }}>
                      S
                    </div>
                  </td>
                  <td style={{ verticalAlign: 'top', border: 'none', padding: '0 0 12px 0' }}>
                    <div style={{ fontSize: '19px', fontWeight: '900', color: '#000000', letterSpacing: '-0.3px', textTransform: 'uppercase' }}>
                      {companyName}
                    </div>
                    <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#000000', marginTop: '2px', lineHeight: '1.4' }}>
                      {companyAddress}
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#000000', marginTop: '4px', fontFamily: 'monospace' }}>
                      <strong>GSTIN:</strong> {companyGstin} &nbsp;|&nbsp; <strong>PAN:</strong> {companyPan} &nbsp;|&nbsp; <strong>CIN:</strong> {companyCin}
                    </div>
                    <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#000000', marginTop: '2px' }}>
                      {companyContact}
                    </div>
                  </td>
                  <td style={{ verticalAlign: 'top', textAlign: 'right', border: 'none', padding: '0 0 12px 12px', width: '220px' }}>
                    <div style={{ display: 'inline-block', backgroundColor: '#000000', color: '#ffffff', fontWeight: '900', fontSize: '14px', letterSpacing: '1px', padding: '6px 14px', borderRadius: '4px', textTransform: 'uppercase' }}>
                      PURCHASE ORDER
                    </div>
                    <div style={{ fontSize: '10px', color: '#000000', marginTop: '5px', fontWeight: '900', letterSpacing: '0.5px' }}>
                      ORIGINAL FOR RECIPIENT
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {letterheadMarginMm > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', borderBottom: '2.5px solid #000000', paddingBottom: '8px' }}>
              <tbody>
                <tr>
                  <td style={{ border: 'none', padding: '0 0 8px 0', fontSize: '18px', fontWeight: '900', color: '#000000', textTransform: 'uppercase' }}>
                    PURCHASE ORDER
                  </td>
                  <td style={{ border: 'none', padding: '0 0 8px 0', textAlign: 'right', fontSize: '11px', color: '#000000', fontWeight: '900' }}>
                    ORIGINAL COPY
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {/* PO Metadata Bar Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', backgroundColor: '#f8fafc', border: '1.5px solid #000000' }}>
            <tbody>
              <tr>
                <td style={{ width: '25%', padding: '7px 10px', borderRight: '1.5px solid #000000' }}>
                  <div style={{ fontSize: '9.5px', fontWeight: '900', color: '#000000', textTransform: 'uppercase' }}>PO NUMBER:</div>
                  <div style={{ fontSize: '12.5px', fontWeight: '900', color: '#000000', fontFamily: 'monospace', marginTop: '2px' }}>{poNumber}</div>
                </td>
                <td style={{ width: '25%', padding: '7px 10px', borderRight: '1.5px solid #000000' }}>
                  <div style={{ fontSize: '9.5px', fontWeight: '900', color: '#000000', textTransform: 'uppercase' }}>PO DATE:</div>
                  <div style={{ fontSize: '12px', fontWeight: '900', color: '#000000', marginTop: '2px' }}>{poDate}</div>
                </td>
                <td style={{ width: '25%', padding: '7px 10px', borderRight: '1.5px solid #000000' }}>
                  <div style={{ fontSize: '9.5px', fontWeight: '900', color: '#000000', textTransform: 'uppercase' }}>QUOTATION REF:</div>
                  <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#000000', marginTop: '2px' }}>{quotationRef || '—'}</div>
                </td>
                <td style={{ width: '25%', padding: '7px 10px' }}>
                  <div style={{ fontSize: '9.5px', fontWeight: '900', color: '#000000', textTransform: 'uppercase' }}>QUOTATION DATE:</div>
                  <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#000000', marginTop: '2px' }}>{quotationDate || '—'}</div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Vendor & Delivery Boxes Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
            <tbody>
              <tr>
                {/* Vendor Box */}
                <td style={{ width: '50%', verticalAlign: 'top', border: '1.5px solid #000000', padding: '10px 12px', backgroundColor: '#ffffff', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #000000', paddingBottom: '4px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: '900', color: '#000000', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      VENDOR / SUPPLIER DETAILS
                    </span>
                    <span style={{ fontSize: '9.5px', fontWeight: '900', backgroundColor: '#000000', color: '#ffffff', padding: '1px 6px', borderRadius: '3px' }}>
                      TO
                    </span>
                  </div>
                  <div style={{ fontSize: '12.5px', fontWeight: '900', color: '#000000' }}>
                    {vendorName || '—'}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#000000', marginTop: '3px', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>
                    {vendorAddress || '—'}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#000000', marginTop: '5px', fontFamily: 'monospace' }}>
                    <strong>GSTIN:</strong> {vendorGstin || '—'} &nbsp;|&nbsp; <strong>State:</strong> {vendorState || '—'}
                  </div>
                  {vendorContact && (
                    <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#000000', marginTop: '3px' }}>
                      <strong>Contact:</strong> {vendorContact}
                    </div>
                  )}
                </td>

                <td style={{ width: '12px', border: 'none' }}></td>

                {/* Delivery Box */}
                <td style={{ width: '50%', verticalAlign: 'top', border: '1.5px solid #000000', padding: '10px 12px', backgroundColor: '#ffffff', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #000000', paddingBottom: '4px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: '900', color: '#000000', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      DELIVERY / SHIP TO
                    </span>
                    <span style={{ fontSize: '9.5px', fontWeight: '900', backgroundColor: '#000000', color: '#ffffff', padding: '1px 6px', borderRadius: '3px' }}>
                      DESTINATION
                    </span>
                  </div>
                  <div style={{ fontSize: '12.5px', fontWeight: '900', color: '#000000' }}>
                    {shipToName}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#000000', marginTop: '3px', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>
                    {shipToAddress}
                  </div>
                  <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#000000', marginTop: '5px' }}>
                    <strong>Instructions:</strong> {shipToContact}
                  </div>
                  <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#000000', marginTop: '3px' }}>
                    <strong>Payment Terms:</strong> {paymentTerms} &nbsp;|&nbsp; <strong>Timeline:</strong> {deliveryTimeline}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Subject Line Bar */}
          {subject && (
            <div style={{ backgroundColor: '#f8fafc', borderLeft: '5px solid #000000', borderTop: '1px solid #000000', borderRight: '1px solid #000000', borderBottom: '1px solid #000000', padding: '7px 10px', marginBottom: '16px', fontSize: '12px', fontWeight: '800', color: '#000000' }}>
              <strong>SUBJECT:</strong> {subject}
            </div>
          )}

          {/* Line Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', border: '1.5px solid #000000' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #000000' }}>
                <th style={{ width: '35px', padding: '7px 4px', textAlign: 'center', fontSize: '11px', fontWeight: '900', color: '#000000', borderRight: '1.5px solid #000000' }}>#</th>
                <th style={{ padding: '7px 8px', textAlign: 'left', fontSize: '11px', fontWeight: '900', color: '#000000', borderRight: '1.5px solid #000000' }}>ITEM DESCRIPTION & SPECIFICATIONS</th>
                <th style={{ width: '70px', padding: '7px 4px', textAlign: 'center', fontSize: '11px', fontWeight: '900', color: '#000000', borderRight: '1.5px solid #000000' }}>HSN/SAC</th>
                <th style={{ width: '45px', padding: '7px 4px', textAlign: 'center', fontSize: '11px', fontWeight: '900', color: '#000000', borderRight: '1.5px solid #000000' }}>QTY</th>
                <th style={{ width: '50px', padding: '7px 4px', textAlign: 'center', fontSize: '11px', fontWeight: '900', color: '#000000', borderRight: '1.5px solid #000000' }}>UNIT</th>
                <th style={{ width: '90px', padding: '7px 8px', textAlign: 'right', fontSize: '11px', fontWeight: '900', color: '#000000', borderRight: '1.5px solid #000000' }}>RATE (₹)</th>
                <th style={{ width: '50px', padding: '7px 4px', textAlign: 'center', fontSize: '11px', fontWeight: '900', color: '#000000', borderRight: '1.5px solid #000000' }}>GST %</th>
                <th style={{ width: '80px', padding: '7px 8px', textAlign: 'right', fontSize: '11px', fontWeight: '900', color: '#000000', borderRight: '1.5px solid #000000' }}>TAX (₹)</th>
                <th style={{ width: '95px', padding: '7px 8px', textAlign: 'right', fontSize: '11px', fontWeight: '900', color: '#000000' }}>TOTAL (₹)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const itemTaxable = (Number(item.qty) || 0) * (Number(item.rate) || 0);
                const itemGst = (itemTaxable * (Number(item.gstRate) || 0)) / 100;
                const itemTotal = itemTaxable + itemGst;

                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #000000' }}>
                    <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: '11.5px', color: '#000000', fontWeight: '900', borderRight: '1.5px solid #000000' }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '6px 8px', fontSize: '11.5px', fontWeight: '700', color: '#000000', borderRight: '1.5px solid #000000', lineHeight: '1.4' }}>
                      {item.description || '—'}
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: '11px', fontFamily: 'monospace', fontWeight: '800', color: '#000000', borderRight: '1.5px solid #000000' }}>
                      {item.hsnSac || '—'}
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: '12px', fontWeight: '900', color: '#000000', borderRight: '1.5px solid #000000' }}>
                      {item.qty}
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: '11.5px', fontWeight: '800', color: '#000000', borderRight: '1.5px solid #000000' }}>
                      {item.unit}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '11.5px', fontFamily: 'monospace', fontWeight: '800', color: '#000000', borderRight: '1.5px solid #000000' }}>
                      ₹{Number(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: '11.5px', fontWeight: '900', color: '#000000', borderRight: '1.5px solid #000000' }}>
                      {item.gstRate}%
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '11.5px', fontFamily: 'monospace', fontWeight: '800', color: '#000000', borderRight: '1.5px solid #000000' }}>
                      ₹{itemGst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '12px', fontFamily: 'monospace', fontWeight: '900', color: '#000000' }}>
                      ₹{itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals & Amount in Words Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
            <tbody>
              <tr>
                {/* Left: Amount in Words */}
                <td style={{ width: '55%', verticalAlign: 'top', border: '1.5px solid #000000', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '4px' }}>
                  <div style={{ fontSize: '9.5px', fontWeight: '900', color: '#000000', textTransform: 'uppercase', marginBottom: '4px' }}>
                    AMOUNT IN WORDS (INR):
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: '900', color: '#000000', lineHeight: '1.4' }}>
                    {numberToWordsIndian(totals.grandTotal)}
                  </div>
                  <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1.5px solid #000000', fontSize: '10px', fontWeight: '800', color: '#000000' }}>
                    <strong>Billing Entity:</strong> {companyName} &nbsp;|&nbsp; <strong>GSTIN:</strong> {companyGstin}
                  </div>
                </td>

                <td style={{ width: '12px', border: 'none' }}></td>

                {/* Right: Calculations Breakdown */}
                <td style={{ width: '45%', verticalAlign: 'top', padding: '0', border: '1.5px solid #000000', borderRadius: '4px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #000000' }}>
                        <td style={{ padding: '5px 8px', fontWeight: '800', color: '#000000', border: 'none' }}>Taxable Subtotal:</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '900', color: '#000000', border: 'none' }}>
                          ₹{totals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                      {gstType === 'intra' ? (
                        <>
                          <tr style={{ borderBottom: '1px solid #000000' }}>
                            <td style={{ padding: '4px 8px', fontWeight: '800', color: '#000000', border: 'none' }}>CGST (Central Tax):</td>
                            <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '900', color: '#000000', border: 'none' }}>
                              ₹{totals.totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #000000' }}>
                            <td style={{ padding: '4px 8px', fontWeight: '800', color: '#000000', border: 'none' }}>SGST (State Tax):</td>
                            <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '900', color: '#000000', border: 'none' }}>
                              ₹{totals.totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </>
                      ) : (
                        <tr style={{ borderBottom: '1px solid #000000' }}>
                          <td style={{ padding: '4px 8px', fontWeight: '800', color: '#000000', border: 'none' }}>IGST (Integrated Tax):</td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '900', color: '#000000', border: 'none' }}>
                            ₹{totals.totalIgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      )}
                      {totals.roundOff !== 0 && (
                        <tr style={{ borderBottom: '1px solid #000000' }}>
                          <td style={{ padding: '4px 8px', fontWeight: '800', color: '#000000', border: 'none' }}>Round Off:</td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '900', color: '#000000', border: 'none' }}>
                            {totals.roundOff > 0 ? `+₹${totals.roundOff.toFixed(2)}` : `-₹${Math.abs(totals.roundOff).toFixed(2)}`}
                          </td>
                        </tr>
                      )}
                      <tr style={{ backgroundColor: '#000000', color: '#ffffff' }}>
                        <td style={{ padding: '6px 8px', fontWeight: '900', fontSize: '12px', textTransform: 'uppercase', border: 'none' }}>GRAND TOTAL:</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '900', fontSize: '13.5px', border: 'none' }}>
                          ₹{totals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Terms & Conditions and Authorized Signatory Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '2px solid #000000', paddingTop: '10px' }}>
            <tbody>
              <tr>
                {/* Terms */}
                <td style={{ width: '60%', verticalAlign: 'top', border: 'none', padding: '8px 12px 0 0' }}>
                  <div style={{ fontSize: '10px', fontWeight: '900', color: '#000000', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                    TERMS & CONDITIONS:
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#000000', lineHeight: '1.45', whiteSpace: 'pre-wrap' }}>
                    {notes}
                  </div>
                </td>

                {/* Signatory */}
                <td style={{ width: '40%', verticalAlign: 'top', border: '1.5px solid #000000', padding: '10px', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '4px' }}>
                  <div style={{ fontSize: '9.5px', fontWeight: '900', color: '#000000', textTransform: 'uppercase' }}>
                    For {companyName}
                  </div>
                  <div style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px 0' }}>
                    {signatureImage ? (
                      <img src={signatureImage} alt="Signature" style={{ maxHeight: '44px', maxWidth: '140px', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ width: '120px', borderBottom: '2px dashed #000000', height: '30px' }}></div>
                    )}
                  </div>
                  <div style={{ fontSize: '11.5px', fontWeight: '900', color: '#000000' }}>
                    {signatoryName}
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: '800', color: '#000000', marginTop: '1px' }}>
                    {signatoryDesignation}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Footer Notice */}
          <div style={{ marginTop: '20px', paddingTop: '8px', borderTop: '1.5px solid #000000', textAlign: 'center', fontSize: '9px', fontWeight: '800', color: '#000000', fontFamily: 'monospace' }}>
            This is a computer-generated Purchase Order issued by Sharewealth Securities Ltd. IT Department.
          </div>
        </div>
        <ConfirmModal
          isOpen={poConfirmModal.isOpen}
          title={poConfirmModal.title}
          message={poConfirmModal.message}
          confirmLabel={poConfirmModal.confirmLabel}
          cancelLabel={poConfirmModal.cancelLabel}
          isDanger={poConfirmModal.isDanger}
          loading={poConfirmModal.loading}
          onConfirm={poConfirmModal.onConfirm}
          onCancel={() => setPoConfirmModal(INITIAL_CONFIRM_STATE)}
        />
      </div>
    </div>
  );
};

const getITStatusBadgeClass = (status: string): string => {
  const s = String(status || '').toLowerCase().trim();
  if (['active', 'compliant', 'resolved', 'implemented', 'filed', 'approved', 'fulfilled', 'completed', 'renewed'].includes(s)) {
    return 'mis-badge mis-badge-success';
  }
  if (['in progress', 'under renewal', 'renewal due', 'expiring soon', 'planning', 'investigating', 'due for review', 'in remediation', 'scheduled', 'report received', 'raised', 'under repair', 'upcoming'].includes(s)) {
    return 'mis-badge mis-badge-warning';
  }
  if (['open', 'identified'].includes(s)) {
    return 'mis-badge mis-badge-info';
  }
  if (['critical', 'non-compliant', 'expired', 'lapsed', 'overdue', 'terminated', 'disposed', 'cancelled', 'closed', 'retired', 'on hold'].includes(s)) {
    return 'mis-badge mis-badge-danger';
  }
  return 'mis-badge mis-badge-neutral';
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

  // Search, Branch & Status filters
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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
  const [confirmModal, setConfirmModal] = useState<ConfirmDialogState>(INITIAL_CONFIRM_STATE);

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

  // Clean form state and filters when tab changes
  useEffect(() => {
    setActiveTab(pendingActiveTabRef.current || 'list');
    pendingActiveTabRef.current = null;
    setEditingId(null);
    setFormData({});
    setSelectedIds([]);
    setStatusFilter('');
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

  const handleDelete = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete IT Record',
      message: 'Are you sure you want to delete this record? This action cannot be undone.',
      confirmLabel: 'Delete Record',
      cancelLabel: 'Cancel',
      isDanger: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          await itService.deleteEntry(sheetTab, id);
          toast.success('Record deleted.');
          fetchEntries();
          if (sheetTab === 'assets') fetchAssets();
          if (sheetTab === 'audits') fetchAudits();
          if (sheetTab === 'vendors') fetchVendors();
          if (sheetTab === 'diagrams') fetchDiagrams();
          setConfirmModal(INITIAL_CONFIRM_STATE);
        } catch (err: any) {
          toast.error(err.response?.data?.message || 'Delete operation failed.');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      }
    });
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

  const activeFormFields = getFormFields();
  const hasStatusColumn = activeFormFields.some(f => f.name === 'status') || entries.some(e => e.status !== undefined);
  const displayedFields = activeFormFields.filter(f => f.name !== 'status').slice(0, 5);

  const currentSheetStatuses = useMemo(() => {
    const statuses = new Set<string>();
    const statusField = activeFormFields.find(f => f.name === 'status');
    if (statusField && statusField.options) {
      statusField.options.forEach((opt: any) => {
        if (typeof opt === 'string') statuses.add(opt);
        else if (opt && opt.value) statuses.add(opt.value);
      });
    }
    if (Array.isArray(entries)) {
      entries.forEach((row: any) => {
        if (row?.status && typeof row.status === 'string' && row.status.trim()) {
          statuses.add(row.status.trim());
        }
      });
    }
    return Array.from(statuses);
  }, [sheetTab, activeFormFields, entries]);

  const filteredEntries = useMemo(() => {
    if (!Array.isArray(entries)) return [];
    if (!statusFilter) return entries;
    return entries.filter((row: any) => {
      if (!row || !row.status) return false;
      return String(row.status).toLowerCase() === statusFilter.toLowerCase();
    });
  }, [entries, statusFilter]);

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

        {/* PO Generator — Native High-Resolution GST-Compliant Purchase Order Maker & Exporter */}
        {sheetTab === 'po-generator' ? (
          <POGeneratorComponent
            vendors={vendors}
            onSaveToMIS={async (poRecord) => {
              await itService.createEntry('purchase-orders', poRecord);
              fetchEntries();
            }}
            onViewList={() => {
              pendingActiveTabRef.current = 'list';
              setSheetTab('purchase-orders');
            }}
          />
        ) : activeTab === 'list' ? (
          <div className="mis-card p-5">
            
            {/* Search and Filters toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mb-5">
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto flex-1">
                <input
                  type="text"
                  placeholder="Search records..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="mis-input text-xs w-full sm:w-60"
                />

                {currentSheetStatuses.length > 0 && (
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="mis-select text-xs w-full sm:w-44"
                  >
                    <option value="">All Statuses</option>
                    {currentSheetStatuses.map((st: string) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                )}

                {hasMultiBranchAccess && !['audit-schedule', 'team-duties'].includes(sheetTab) && (
                  <select
                    value={branchFilter}
                    onChange={e => setBranchFilter(e.target.value)}
                    className="mis-select text-xs w-full sm:w-44"
                  >
                    <option value="">All Branches</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                )}

                {(statusFilter || searchTerm || branchFilter) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('');
                      setBranchFilter('');
                    }}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors px-2 py-1"
                  >
                    ✕ Clear
                  </button>
                )}
              </div>

              <div className="text-xs text-slate-400 self-end sm:self-center font-medium shrink-0">
                Showing <strong>{filteredEntries.length}</strong> of <strong>{entries.length}</strong> records
              </div>
            </div>

            {loading ? (
              <div className="text-center py-10 text-gray-400">Loading department records...</div>
            ) : filteredEntries.length === 0 ? (
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
                          checked={selectedIds.length === filteredEntries.length && filteredEntries.length > 0}
                          onChange={() => {
                            if (selectedIds.length === filteredEntries.length) setSelectedIds([]);
                            else setSelectedIds(filteredEntries.map((e: any) => e.id));
                          }}
                        />
                      </th>
                      {displayedFields.map(f => (
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
                      {hasStatusColumn && (
                        <th>Status</th>
                      )}
                      <th>Date Added</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((row: any) => (
                      <tr key={row.id}>
                        <td className="text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(row.id)}
                            onChange={() => toggleSelectRow(row.id)}
                          />
                        </td>
                        {displayedFields.map(f => {
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
                                <span className="px-2 py-0.5 text-xs rounded bg-red-900/50 text-red-300 border border-red-500/30 font-semibold">
                                  Yes (Upgrade)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-xs rounded bg-green-900/50 text-green-300 border border-green-500/30 font-semibold">
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
                        {hasStatusColumn && (
                          <td>
                            {row.status ? (
                              <span className={getITStatusBadgeClass(row.status)}>
                                {row.status}
                              </span>
                            ) : (
                              <span className="text-slate-500 font-medium text-xs">—</span>
                            )}
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

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        cancelLabel={confirmModal.cancelLabel}
        isDanger={confirmModal.isDanger}
        loading={confirmModal.loading}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(INITIAL_CONFIRM_STATE)}
      />

      <ViewDetailsModal record={viewingRecord} onClose={() => setViewingRecord(null)} title="IT Record Details" />
    </DashboardLayout>
  );
};

export default ITDataEntryPage;
