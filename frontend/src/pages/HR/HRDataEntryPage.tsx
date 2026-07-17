import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { hrService } from '../../services/hr.service';
import { orgService } from '../../services/org.service';

interface SheetHelpConfig {
  why: string;
  fields: { label: string; note: string }[];
  remember: string;
}

// Plain-English explanations shown next to each entry form — same style
// and, largely, the same wording the business owner used when specifying
// these fields, so it reads as company policy rather than developer notes.
const SHEET_HELP: Record<string, SheetHelpConfig> = {
  'open-positions': {
    why: 'Tracks every role the company is hiring for, so management can see hiring pace and unfilled headcount at a glance.',
    fields: [
      { label: 'Position Title', note: 'What role is open.' },
      { label: 'Department / Branch', note: 'Where the role sits.' },
      { label: 'Number of Openings', note: 'Sometimes more than one person is needed for the same role.' },
      { label: 'Date Opened', note: "Start of the hiring clock — lets you measure \"how long has this been open.\"" },
      { label: 'Priority', note: 'Urgent / Normal / Low — helps recruiters triage when juggling multiple roles.' },
      { label: 'Job Description', note: "Upload or text — what's actually being advertised." },
      { label: 'Requested By', note: 'Which department head raised the requisition.' },
      { label: 'Status', note: 'Open / On Hold / Closed / Filled.' },
    ],
    remember: 'Keep Status current — a stale "Open" position that was actually filled weeks ago hides real hiring pace from management.',
  },
  'candidates': {
    why: "A recruitment pipeline is only useful if you can answer \"how many candidates are stuck at which stage, and for how long\" — a flat list of applicants with no stage tracking can't answer that, and that's usually the actual reason a hiring process feels slow without anyone being able to say why.",
    fields: [
      { label: 'Candidate Name, Mobile, Email', note: 'Contact identity.' },
      { label: 'Applied For', note: 'Which open position this application is against.' },
      { label: 'Source', note: 'Referral / Job Portal / Walk-in / LinkedIn — tells you which hiring channels actually work.' },
      { label: 'Resume', note: 'The core document.' },
      { label: 'Stage', note: 'Applied / Screening / Interview Scheduled / Interviewed / Offer Extended / Offer Accepted / Joined / Rejected.' },
      { label: 'Interviewer(s)', note: 'Who evaluated them.' },
      { label: 'Feedback/Notes', note: 'Interview outcome notes.' },
      { label: 'Expected Salary, Offered Salary', note: 'For negotiation tracking.' },
      { label: 'Rejection Reason', note: 'Useful for spotting patterns — too many candidates failing the same stage may mean the job description doesn\'t match reality.' },
      { label: 'Joining Date', note: 'If hired, the date they actually start. Setting Stage to "Joined" automatically creates their Employee Master login — no separate step needed.' },
    ],
    remember: 'Setting a candidate to "Joined" auto-creates their real employee login (welcome email included) — only do this once they\'ve genuinely started, not when an offer is merely accepted.',
  },
  'policies': {
    why: 'Policies change over time, and when they do, you need to know exactly which version was in effect on any given date — especially if a policy is ever the center of a dispute (e.g. a disciplinary action or a harassment complaint) and someone asks "which policy applied when this happened?"',
    fields: [
      { label: 'Policy Name', note: 'e.g. "Leave Policy," "Code of Conduct," "POSH Policy."' },
      { label: 'Category', note: 'Leave / Conduct / Safety / IT Usage / Compliance / Other — for filtering.' },
      { label: 'Version Number', note: 'Policies get revised — version control prevents confusion about which is current.' },
      { label: 'Effective Date', note: 'When this version takes legal effect.' },
      { label: 'Superseded Date', note: 'When (if ever) this version stopped being current — leave blank while active.' },
      { label: 'PDF File', note: 'The actual policy document.' },
      { label: 'Applicable To', note: 'All Employees / Specific Department / Specific Role — not every policy applies to everyone.' },
      { label: 'Acknowledgement Required', note: 'Some policies (especially POSH) legally need proof the employee read and agreed to them.' },
      { label: 'Status', note: 'Active / Superseded / Draft.' },
    ],
    remember: 'When you revise a policy, upload the new version as a NEW row (bump the Version Number) and set the old row\'s Superseded Date — never overwrite history, since disputes may need to know exactly which version applied on a given date.',
  },
  'documents': {
    why: 'The official documents tied to each employee — offer letter, appointment letter, ID proofs, educational certificates, bank details proof, signed contracts, performance review records, and exit documents.',
    fields: [
      { label: 'Employee', note: 'Whose document this is.' },
      { label: 'Document Type', note: 'Offer Letter / Appointment Letter / PAN / Aadhaar / Educational Certificate / Bank Proof / Performance Review / Exit Document / Other.' },
      { label: 'Document Number/Reference', note: 'e.g. the actual PAN or certificate number, where relevant.' },
      { label: 'Upload Date', note: 'When it was added.' },
      { label: 'Expiry Date', note: 'If applicable (e.g. a passport or work visa) — most HR documents won\'t have one.' },
      { label: 'File', note: 'The document itself.' },
      { label: 'Confidentiality Level', note: 'Standard / Confidential — a label for now, marking which records are more sensitive.' },
    ],
    remember: 'This is a record store, not a shared drive — every upload should be tied to exactly one employee and one document type, so "does HR have this employee\'s PAN on file?" is always a quick lookup, not a search.',
  },
};

const HRDataEntryPage: React.FC = () => {
  const [sheetTab, setSheetTab] = useState('open-positions');
  const [activeTab, setActiveTab] = useState<'list' | 'register'>('list');

  const [entries, setEntries] = useState<any[]>([]);
  const [openPositions, setOpenPositions] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});

  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [csvMappings, setCsvMappings] = useState<{ [key: string]: string }>({});
  const [csvImportErrors, setCsvImportErrors] = useState<{ row: number; error: string }[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);

  const [uploadingField, setUploadingField] = useState<string | null>(null);

  useEffect(() => {
    fetchOpenPositions();
    fetchEmployees();
    fetchDepartments();
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [sheetTab, searchTerm]);

  useEffect(() => {
    setActiveTab('list');
    setEditingId(null);
    setFormData({});
  }, [sheetTab]);

  const fetchOpenPositions = async () => {
    try {
      const data = await hrService.getOpenPositionsDropdown();
      setOpenPositions(data || []);
    } catch (err) {
      console.error('Failed to load open positions', err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const data = await orgService.getUsers();
      setEmployees(data || []);
    } catch (err) {
      console.error('Failed to load employees', err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const data = await orgService.getDepartments();
      setDepartments(data || []);
    } catch (err) {
      console.error('Failed to load departments', err);
    }
  };

  const fetchBranches = async () => {
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
      const data = await hrService.getEntries(sheetTab, { search: searchTerm || undefined });
      setEntries(data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to fetch entries.');
    } finally {
      setLoading(false);
    }
  };

  const getFormFields = (): any[] => {
    switch (sheetTab) {
      case 'open-positions':
        return [
          { name: 'position_title', label: 'Position Title', type: 'text', required: true },
          { name: 'department_id', label: 'Department', type: 'select', options: departments.map((d: any) => ({ value: d.id, label: d.name })) },
          { name: 'branch_id', label: 'Branch', type: 'select', options: branches.map((b: any) => ({ value: b.id, label: b.name })) },
          { name: 'number_of_openings', label: 'Number of Openings', type: 'number', required: true },
          { name: 'date_opened', label: 'Date Opened', type: 'date', required: true },
          { name: 'priority', label: 'Priority', type: 'select', options: ['Urgent', 'Normal', 'Low'], required: true },
          { name: 'job_description', label: 'Job Description', type: 'textarea' },
          { name: 'job_description_url', label: 'Job Description Upload', type: 'file' },
          { name: 'requested_by', label: 'Requested By', type: 'text' },
          { name: 'status', label: 'Status', type: 'select', options: ['Open', 'On Hold', 'Closed', 'Filled'], required: true },
        ];
      case 'candidates':
        return [
          { name: 'candidate_name', label: 'Candidate Name', type: 'text', required: true },
          { name: 'mobile', label: 'Mobile', type: 'text' },
          { name: 'email', label: 'Email', type: 'email' },
          {
            name: 'position_id', label: 'Applied For', type: 'select',
            options: openPositions.map(p => ({ value: p.id, label: p.position_title })), required: false
          },
          { name: 'source', label: 'Source', type: 'select', options: ['Referral', 'Job Portal', 'Walk-in', 'LinkedIn', 'Other'] },
          { name: 'resume_url', label: 'Resume', type: 'file' },
          {
            name: 'stage', label: 'Stage', type: 'select', required: true,
            options: ['Applied', 'Screening', 'Interview Scheduled', 'Interviewed', 'Offer Extended', 'Offer Accepted', 'Joined', 'Rejected']
          },
          { name: 'interviewers', label: 'Interviewer(s)', type: 'text' },
          { name: 'feedback_notes', label: 'Feedback/Notes', type: 'textarea' },
          { name: 'expected_salary', label: 'Expected Salary', type: 'number' },
          { name: 'offered_salary', label: 'Offered Salary', type: 'number' },
          { name: 'rejection_reason', label: 'Rejection Reason', type: 'textarea' },
          { name: 'joining_date', label: 'Joining Date', type: 'date' },
        ];
      case 'policies':
        return [
          { name: 'policy_name', label: 'Policy Name', type: 'text', required: true },
          { name: 'category', label: 'Category', type: 'select', options: ['Leave', 'Conduct', 'Safety', 'IT Usage', 'Compliance', 'Other'] },
          { name: 'version_number', label: 'Version Number', type: 'text', required: true },
          { name: 'effective_date', label: 'Effective Date', type: 'date', required: true },
          { name: 'superseded_date', label: 'Superseded Date', type: 'date' },
          { name: 'pdf_url', label: 'PDF File', type: 'file', required: true },
          { name: 'applicable_to', label: 'Applicable To', type: 'select', options: ['All Employees', 'Specific Department', 'Specific Role'], required: true },
          { name: 'applicable_to_detail', label: 'Applicable To (Detail)', type: 'text' },
          { name: 'acknowledgement_required', label: 'Acknowledgement Required', type: 'checkbox' },
          { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Superseded', 'Draft'], required: true },
        ];
      case 'documents':
        return [
          {
            name: 'employee_id', label: 'Employee', type: 'select', required: true,
            options: employees.map((e: any) => ({ value: e.id, label: `${e.full_name || e.email}${e.employee_id ? ` (${e.employee_id})` : ''}` }))
          },
          {
            name: 'document_type', label: 'Document Type', type: 'select', required: true,
            options: ['Offer Letter', 'Appointment Letter', 'PAN', 'Aadhaar', 'Educational Certificate', 'Bank Proof', 'Performance Review', 'Exit Document', 'Other']
          },
          { name: 'document_reference', label: 'Document Number/Reference', type: 'text' },
          { name: 'upload_date', label: 'Upload Date', type: 'date', required: true },
          { name: 'expiry_date', label: 'Expiry Date', type: 'date' },
          { name: 'file_url', label: 'File', type: 'file', required: true },
          { name: 'confidentiality_level', label: 'Confidentiality Level', type: 'select', options: ['Standard', 'Confidential'] },
        ];
      default:
        return [];
    }
  };

  const renderHelpPanel = () => {
    const help = SHEET_HELP[sheetTab];
    if (!help) return null;
    return (
      <div className="mis-card p-5">
        <h3 className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>💡 Why this sheet exists</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>{help.why}</p>
        <h3 className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>📖 What each field means</h3>
        <div className="space-y-3 mb-4">
          {help.fields.map(f => (
            <div key={f.label}>
              <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{f.label}</div>
              <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{f.note}</div>
            </div>
          ))}
        </div>
        <div className="text-[11px] p-2.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
          ⚠️ {help.remember}
        </div>
      </div>
    );
  };

  const validateForm = (): boolean => {
    for (const f of getFormFields()) {
      if (f.required) {
        const val = formData[f.name];
        if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
          toast.error(`${f.label} is required.`);
          return false;
        }
      }
    }
    if (formData.email && typeof formData.email === 'string' && formData.email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast.error('Please provide a valid email address.');
        return false;
      }
    }
    if (formData.mobile && !/^\d{10}$/.test(String(formData.mobile).trim())) {
      toast.error('Mobile must be exactly 10 digits.');
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
        const result = await hrService.updateEntry(sheetTab, editingId, formData);
        if (result?.accountWarning) {
          toast.error(result.accountWarning, { duration: 8000 });
        } else if (sheetTab === 'candidates' && formData.stage === 'Joined' && result?.created_profile_id) {
          toast.success('Candidate updated — employee login created and welcome email sent.');
        } else {
          toast.success('Record updated successfully.');
        }
      } else {
        await hrService.createEntry(sheetTab, formData);
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
    if (!window.confirm('Delete this record? This cannot be undone.')) return;
    try {
      await hrService.deleteEntry(sheetTab, id);
      toast.success('Record deleted.');
      fetchEntries();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Delete failed.');
    }
  };

  const handleFileUpload = async (fieldName: string, file: File) => {
    setUploadingField(fieldName);
    try {
      const { fileUrl } = await hrService.uploadDocument(file);
      setFormData((prev: any) => ({ ...prev, [fieldName]: fileUrl }));
      toast.success('File uploaded.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'File upload failed.');
    } finally {
      setUploadingField(null);
    }
  };

  const normalizeDateString = (raw: any): any => {
    const val = String(raw ?? '').trim();
    if (!val) return raw;
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
    let m = val.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (m) { const [, y, mo, d] = m; return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`; }
    m = val.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (m) { const [, d, mo, y] = m; return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`; }
    return val;
  };

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
        headers.forEach((h, index) => { rowObj[h] = values[index] || ''; });
        return rowObj;
      });
      setCsvRows(parsedRows);

      const initialMap: any = {};
      getFormFields().forEach(field => {
        const matched = headers.find(h => h.toLowerCase() === field.name.toLowerCase());
        if (matched) initialMap[field.name] = matched;
      });
      setCsvMappings(initialMap);
    };
    reader.readAsText(file);
  };

  const handleImportCsv = async () => {
    if (csvRows.length === 0) return;
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
      const result = await hrService.bulkImport(sheetTab, mappedRecords);
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
      if (insertedCount > 0) fetchEntries();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'CSV Import failed.');
    } finally {
      setCsvImporting(false);
    }
  };

  const renderFieldValue = (row: any, field: any) => {
    const val = row[field.name];
    if (field.name === 'position_id') return row.hr_open_positions?.position_title || '—';
    if (field.name === 'employee_id' && sheetTab === 'documents') return row.profiles?.full_name || row.profiles?.employee_id || '—';
    if (field.name === 'department_id') return departments.find(d => d.id === val)?.name || '—';
    if (field.name === 'branch_id') return branches.find(b => b.id === val)?.name || '—';
    if (field.type === 'file') return val ? <a href={val} target="_blank" rel="noopener noreferrer" className="underline">View</a> : '—';
    if (field.type === 'checkbox') return val ? 'Yes' : 'No';
    if (val === undefined || val === null || val === '') return '—';
    return String(val);
  };

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-7xl mx-auto space-y-8">

        <header className="mis-page-header-row mb-6">
          <div className="mis-page-header" style={{ marginBottom: 0 }}>
            <h1 className="mis-page-title">HR Department Portal</h1>
            <p className="mis-page-desc">
              Recruitment pipeline, HR policy repository, and employee document management.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => { setCsvModalOpen(true); setCsvHeaders([]); setCsvRows([]); setCsvImportErrors([]); }}
              className="px-3.5 py-1.5 border rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 h-[34px]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              📤 Bulk Import CSV
            </button>
            <div className="mis-tabs">
              <button type="button" onClick={() => setActiveTab('register')} className={`mis-tab ${activeTab === 'register' ? 'active' : ''}`}>
                {editingId ? '✏️ Edit Record' : 'Create Entry'}
              </button>
              <button type="button" onClick={() => setActiveTab('list')} className={`mis-tab ${activeTab === 'list' ? 'active' : ''}`}>
                Search & View database
              </button>
            </div>
          </div>
        </header>

        <div className="mis-module-tabs flex-wrap mb-4">
          {[
            { id: 'open-positions', label: 'Open Positions' },
            { id: 'candidates', label: 'Candidates' },
            { id: 'policies', label: 'Policy Repository' },
            { id: 'documents', label: 'Documents' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setSheetTab(tab.id)} className={`mis-module-tab ${sheetTab === tab.id ? 'active' : ''}`}>
              📄 {tab.label.toUpperCase()}
            </button>
          ))}
        </div>

        {activeTab === 'list' ? (
          <div className="mis-card p-5">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-5">
              <input
                type="text"
                placeholder="Search records..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="mis-input text-sm w-full sm:w-72"
              />
            </div>

            {loading ? (
              <div className="mis-empty py-12">Loading…</div>
            ) : entries.length === 0 ? (
              <div className="mis-empty py-12">No records found matching filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="mis-table w-full text-xs">
                  <thead>
                    <tr>
                      {getFormFields().map(f => <th key={f.name}>{f.label}</th>)}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(row => (
                      <tr key={row.id}>
                        {getFormFields().map(f => (
                          <td key={f.name}>{renderFieldValue(row, f)}</td>
                        ))}
                        <td className="whitespace-nowrap">
                          <button onClick={() => handleEdit(row)} className="text-xs font-semibold mr-3 hover:underline" style={{ color: 'var(--text-accent)' }}>Edit</button>
                          <button onClick={() => handleDelete(row.id)} className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <form onSubmit={handleSubmit} className="mis-card p-5 lg:col-span-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {getFormFields().map(f => (
                  <div key={f.name} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                    <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>
                      {f.label} {f.required && <span className="text-red-400">*</span>}
                    </label>
                    {f.type === 'select' ? (
                      <select
                        value={formData[f.name] || ''}
                        onChange={e => setFormData({ ...formData, [f.name]: e.target.value })}
                        className="mis-select text-xs w-full"
                      >
                        <option value="">Select…</option>
                        {f.options.map((opt: any) => {
                          const value = typeof opt === 'string' ? opt : opt.value;
                          const label = typeof opt === 'string' ? opt : opt.label;
                          return <option key={value} value={value}>{label}</option>;
                        })}
                      </select>
                    ) : f.type === 'textarea' ? (
                      <textarea
                        value={formData[f.name] || ''}
                        onChange={e => setFormData({ ...formData, [f.name]: e.target.value })}
                        className="mis-input text-xs w-full"
                        rows={3}
                      />
                    ) : f.type === 'checkbox' ? (
                      <input
                        type="checkbox"
                        checked={!!formData[f.name]}
                        onChange={e => setFormData({ ...formData, [f.name]: e.target.checked })}
                        className="w-4 h-4"
                      />
                    ) : f.type === 'file' ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={e => e.target.files?.[0] && handleFileUpload(f.name, e.target.files[0])}
                          className="text-xs"
                        />
                        {uploadingField === f.name && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Uploading…</span>}
                        {formData[f.name] && <a href={formData[f.name]} target="_blank" rel="noopener noreferrer" className="text-xs underline">View</a>}
                      </div>
                    ) : (
                      <input
                        type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : 'text'}
                        value={formData[f.name] ?? ''}
                        onChange={e => setFormData({ ...formData, [f.name]: e.target.value })}
                        className="mis-input text-xs w-full"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <button type="button" onClick={() => setActiveTab('list')} className="px-4 py-2 border rounded-lg text-xs font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50" style={{ background: 'var(--text-accent)', color: 'white' }}>
                  {submitting ? 'Saving…' : '💾 Save Record'}
                </button>
              </div>
            </form>

            {renderHelpPanel()}
          </div>
        )}

        {csvModalOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="mis-card p-6 max-w-3xl w-full max-h-[85vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Bulk Import CSV Records</h3>

              <div className="mb-4">
                <label className="text-xs font-semibold block mb-2" style={{ color: 'var(--text-secondary)' }}>Select CSV File</label>
                <input type="file" accept=".csv" onChange={handleCsvFileUpload} className="text-xs" />
              </div>

              {csvHeaders.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Map CSV Columns to Database Fields</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[250px] overflow-y-auto p-2 border rounded" style={{ borderColor: 'var(--border)' }}>
                    {getFormFields().map(f => (
                      <div key={f.name} className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{f.label}{f.required && <span className="text-red-400"> *</span>}</span>
                        <select
                          className="mis-select text-xs max-w-[180px]"
                          value={csvMappings[f.name] || ''}
                          onChange={e => setCsvMappings({ ...csvMappings, [f.name]: e.target.value })}
                        >
                          <option value="">(Ignore Column)</option>
                          {csvHeaders.map(ch => <option key={ch} value={ch}>{ch}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {csvImportErrors.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-red-400 mb-2">{csvImportErrors.length} Row{csvImportErrors.length === 1 ? '' : 's'} Failed</h4>
                  <div className="max-h-[180px] overflow-y-auto border border-red-900/40 rounded bg-red-950/20 divide-y divide-red-900/30">
                    {csvImportErrors.map(fe => (
                      <div key={fe.row} className="px-3 py-2 text-xs">
                        <span className="font-semibold text-red-300">Row {fe.row}:</span> <span className="text-red-200">{fe.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <button
                  onClick={() => { setCsvModalOpen(false); setCsvHeaders([]); setCsvRows([]); setCsvImportErrors([]); }}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  Close
                </button>
                <button
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
                  disabled={csvRows.length === 0 || csvImporting}
                  onClick={handleImportCsv}
                >
                  {csvImporting ? 'Importing...' : `Execute Import (${csvRows.length} Rows)`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default HRDataEntryPage;
