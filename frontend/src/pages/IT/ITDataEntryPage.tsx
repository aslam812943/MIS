import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { itService } from '../../services/it.service';
import { orgService } from '../../services/org.service';
import { authService } from '../../services/auth.service';



const ITDataEntryPage: React.FC = () => {
  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const hasMultiBranchAccess = isAdmin || ['ceo', 'managing_director', 'director', 'executive', 'hod'].includes(currentUser?.role || '');


  // Active sheet tab
  const [sheetTab, setSheetTab] = useState('audits');
  const [activeTab, setActiveTab] = useState<'list' | 'register'>('list');

  // UI state
  const [entries, setEntries] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [auditsList, setAuditsList] = useState<any[]>([]);
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
  const [formData, setFormData] = useState<any>({});

  // CSV Import state
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [csvMappings, setCsvMappings] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchBranches();
    fetchVendors();
    fetchAudits();
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

    // 2. Email Address Format Validation
    for (const f of getFormFields()) {
      if (f.type === 'email') {
        const val = formData[f.name];
        if (val && typeof val === 'string' && val.trim() !== '') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(val)) {
            toast.error(`Please provide a valid email address for ${f.label}.`);
            return false;
          }
        }
      }
    }

    // 3. Alphanumeric IDs format check
    if (formData.ticket_number && !/^[A-Z0-9-]+$/i.test(formData.ticket_number)) {
      toast.error('Ticket number must be alphanumeric.');
      return false;
    }
    if (formData.incident_number && !/^[A-Z0-9-]+$/i.test(formData.incident_number)) {
      toast.error('Incident number must be alphanumeric.');
      return false;
    }
    if (formData.asset_id && !/^[A-Z0-9-]+$/i.test(formData.asset_id)) {
      toast.error('Asset ID must be alphanumeric.');
      return false;
    }

    // 4. Positive number limits
    const numFields = ['purchase_value', 'useful_life_years', 'contract_value', 'notification_lead_time_days', 'sla_target_hours'];
    for (const f of numFields) {
      if (formData[f] !== undefined && formData[f] !== null && formData[f] !== '') {
        if (isNaN(Number(formData[f])) || Number(formData[f]) < 0) {
          toast.error(`${f.replace(/_/g, ' ').toUpperCase()} must be a positive number.`);
          return false;
        }
      }
    }

    // 5. Calendar date assertions
    const dateFields = [
      'scheduled_date', 'start_date', 'end_date', 'submission_deadline', 'actual_submission_date',
      'implementation_target_date', 'actual_implementation_date', 'amc_last_paid_date', 'amc_due_date',
      'purchase_date', 'warranty_start_date', 'warranty_end_date', 'last_assessed_date', 'next_review_date',
      'opened_date', 'closed_date', 'discovered_date', 'resolved_date', 'target_end_date', 'actual_end_date'
    ];
    for (const f of dateFields) {
      if (formData[f] && isNaN(Date.parse(formData[f]))) {
        toast.error(`Please provide a valid date for ${f.replace(/_/g, ' ').toUpperCase()}.`);
        return false;
      }
    }

    // 6. Chronological Date Assertions
    if (formData.start_date && formData.end_date && new Date(formData.end_date) < new Date(formData.start_date)) {
      toast.error('End date cannot be before start date.');
      return false;
    }
    if (formData.warranty_start_date && formData.warranty_end_date && new Date(formData.warranty_end_date) < new Date(formData.warranty_start_date)) {
      toast.error('Warranty end date cannot be before warranty start date.');
      return false;
    }
    if (formData.opened_date && formData.closed_date && new Date(formData.closed_date) < new Date(formData.opened_date)) {
      toast.error('Close date cannot be before open date.');
      return false;
    }
    if (formData.discovered_date && formData.resolved_date && new Date(formData.resolved_date) < new Date(formData.discovered_date)) {
      toast.error('Resolution date cannot be before discovery date.');
      return false;
    }
    if (formData.start_date && formData.target_end_date && new Date(formData.target_end_date) < new Date(formData.start_date)) {
      toast.error('Target end date cannot be before start date.');
      return false;
    }
    if (formData.start_date && formData.actual_end_date && new Date(formData.actual_end_date) < new Date(formData.start_date)) {
      toast.error('Actual end date cannot be before start date.');
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
        await itService.updateEntry(sheetTab, editingId, formData);
        toast.success('Record updated successfully.');
      } else {
        await itService.createEntry(sheetTab, formData);
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
      await itService.deleteEntry(sheetTab, id);
      toast.success('Record deleted.');
      fetchEntries();
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

  // CSV Import mapping logic
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;


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
      await itService.bulkImport(sheetTab, mappedRecords);
      toast.success('Successfully imported CSV rows.');
      setCsvModalOpen(false);

      setCsvRows([]);
      fetchEntries();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'CSV Import failed.');
    }
  };

  // Real-time straight-line depreciation display helper for assets tab
  const getEstimatedDepreciation = () => {
    if (sheetTab !== 'assets') return null;
    const value = Number(formData.purchase_value || 0);
    const life = Number(formData.useful_life_years || 0);
    const pDateStr = formData.purchase_date;

    if (value <= 0 || life <= 0 || !pDateStr) return null;

    const purchaseDate = new Date(pDateStr);
    const today = new Date();
    let yearsElapsed = (today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (yearsElapsed < 0) yearsElapsed = 0;
    if (yearsElapsed > life) yearsElapsed = life;

    const annualDepr = value / life;
    const bookValue = value - (yearsElapsed * annualDepr);

    return {
      bookValue: bookValue.toFixed(2),
      yearsElapsed: yearsElapsed.toFixed(1),
      isExpired: yearsElapsed >= life
    };
  };

  const deprEst = getEstimatedDepreciation();

  const getFormFields = () => {
    switch (sheetTab) {
      case 'audits':
        return [
          { name: 'audit_name', label: 'Audit Name/Cycle', type: 'text', required: true },
          { name: 'audit_type', label: 'Audit Type', type: 'select', options: ['Internal', 'CERT-In Empanelled External', 'SEBI-Mandated Cyber Audit', 'VAPT'], required: true },
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
          { name: 'domain', label: 'Compliance Domain', type: 'select', options: ['Governance', 'Infrastructure', 'Data Security', 'Network Security', 'Access Control', 'Incident Management'], required: true },
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
          { name: 'category', label: 'Category', type: 'select', options: ['Hardware', 'Software', 'Network & ISP', 'Cloud', 'Security', 'AMC Service'], required: true },
          { name: 'poc_name', label: 'POC Name', type: 'text', required: true },
          { name: 'poc_email', label: 'POC Email', type: 'email', required: true },
          { name: 'poc_phone', label: 'POC Phone', type: 'text', required: true },
          { name: 'other_members', label: 'Backup Contacts', type: 'text' },
          { name: 'remarks', label: 'Escalation/Remarks', type: 'textarea' },
          { name: 'amc_last_paid_date', label: 'AMC Last Paid Date', type: 'date' },
          { name: 'amc_due_date', label: 'AMC Due Date', type: 'date', required: true },
          { name: 'notification_lead_time_days', label: 'Lead Time (Days)', type: 'number', required: true },
          { name: 'contract_value', label: 'Contract Value (INR)', type: 'number', required: true },
          { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Under Renewal', 'Expired', 'Terminated'], required: true }
        ];
      case 'assets':
        return [
          { name: 'asset_id', label: 'Asset Barcode / ID', type: 'text', required: true },
          { name: 'asset_type', label: 'Asset Type', type: 'select', options: ['Desktop', 'Laptop', 'Server', 'Printer', 'Network Device', 'Software License'], required: true },
          { name: 'make_model', label: 'Make / Model', type: 'text', required: true },
          { name: 'serial_number', label: 'Serial Number', type: 'text', required: true },
          { name: 'purchase_date', label: 'Purchase Date', type: 'date', required: true },
          { name: 'purchase_value', label: 'Purchase Value (INR)', type: 'number', required: true },
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
          { name: 'type', label: 'Topology Type', type: 'select', options: ['Network Topology', 'Server Architecture', 'Data Center Layout'], required: true },
          { name: 'version', label: 'Version Number', type: 'text', required: true },
          { name: 'file_url', label: 'Upload Diagram File', type: 'file', required: true },
          { name: 'description', label: 'Revision Notes', type: 'textarea' }
        ];
      case 'cybersecurity-compliance':
        return [
          { name: 'compliance_domain', label: 'Domain', type: 'select', options: ['Governance', 'Infrastructure', 'Data Security', 'Network Security', 'Access Control', 'Incident Management'], required: true },
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
          { name: 'ticket_number', label: 'Ticket Reference Number', type: 'text', required: true },
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
          { name: 'incident_number', label: 'Incident Code', type: 'text', required: true },
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
      default:
        return [];
    }
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

        {/* 9 Sheet Tab Bar */}
        <div className="mis-module-tabs flex-wrap mb-4">
          {[
            { id: 'audits', label: 'Audits' },
            { id: 'audit-findings', label: 'Audit Findings' },
            { id: 'vendors', label: 'Vendors' },
            { id: 'assets', label: 'Assets' },
            { id: 'diagrams', label: 'Topology Diagrams' },
            { id: 'cybersecurity-compliance', label: 'Compliance Control' },
            { id: 'tickets', label: 'Support Tickets' },
            { id: 'incidents', label: 'Incidents & RCA' },
            { id: 'projects', label: 'Projects' }
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
                        {['Active', 'Compliant', 'Non-Compliant', 'Resolved', 'Mitigated', 'Closed', 'Implemented', 'Expired', 'In Progress'].map(st => (
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
                        <td>{new Date(row.created_at).toLocaleDateString()}</td>
                        <td className="text-right space-x-2">
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
          
          /* Data Entry Form Card */
          <div className="mis-card p-6 max-w-2xl mx-auto">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-1.5 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              📋 {editingId ? '✏️ Modify Record Row' : '➕ Create New Record Row'}
            </h2>
            
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
                        <label htmlFor={f.name} className="text-xs font-semibold text-slate-300">
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

                {/* Straight-line Depreciation Preview Block */}
                {sheetTab === 'assets' && deprEst && (
                  <div className="md:col-span-2 p-4 rounded border border-indigo-500/20 bg-indigo-900/10 mt-2">
                    <h4 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                      Live Depreciation Estimate
                    </h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="block text-[10px] text-gray-400">Years Elapsed:</span>
                        <span className="text-white font-bold">{deprEst.yearsElapsed} Years</span>
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
        )}

      </div>

      {/* CSV Batch Upload Modal */}
      {csvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-4xl p-6 rounded-lg bg-gray-900 border border-gray-800 shadow-2xl text-left">
            <h3 className="text-lg font-bold text-white mb-4">Bulk Import CSV Records</h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Select CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-900/50 file:text-indigo-300 hover:file:bg-indigo-900"
                  onChange={handleCsvFileUpload}
                />
              </div>

              {csvHeaders.length > 0 && (
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
                disabled={csvRows.length === 0}
                onClick={handleImportCsv}
              >
                Execute Import ({csvRows.length} Rows)
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default ITDataEntryPage;
