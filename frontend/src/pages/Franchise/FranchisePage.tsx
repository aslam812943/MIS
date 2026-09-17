import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Building2, BadgeCheck, UserPlus, FileCheck2, Files, Clock3 } from 'lucide-react';
import { Chart, registerables } from 'chart.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { ROUTES } from '../../constants/routes';
import { franchiseService, type FranchiseBootstrap, type FranchiseDashboard, type FranchiseFilters, type FranchiseKind, type FranchiseRow } from '../../services/franchise.service';
import { useTheme } from '../../context/ThemeContext';
import {parseFranchiseCsv,franchiseCsvFields,parseSalesCsv,salesCsvFields} from '../../utils/franchiseCsv';
import './franchise.css';

Chart.register(...registerables);
const today = () => new Date().toISOString().slice(0, 10);
const currency = (value: unknown) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
const errorText = (e: any) => e.response?.data?.message || e.message || 'Unable to complete this action.';
type Tab = 'franchises' | FranchiseKind | 'configuration' | 'access' | 'workflow';
type Option = { value: string; label: string };
type Field = { name: string; label: string; type?: string; options?: Option[]; required?: boolean; help?: string; min?: string; max?: string; hidden?: boolean; readOnly?: boolean };
type Dialog = { title: string; path: string; fields: Field[]; initial: FranchiseRow; edit?: boolean; decision?: { kind: FranchiseKind; id: string } };
const options = (rows: FranchiseRow[], label = 'name'): Option[] => rows.map(x => ({ value: x.id, label: x[label] || x.id }));
const select = (name: string, label: string, choices: Option[], required = true): Field => ({ name, label, type: 'select', options: choices, required });
const choices = (values: string[]) => values.map(x => ({ value: x, label: x }));

function exportCSV(filename: string, columns: { key: string; label: string }[], rows: FranchiseRow[]) {
  const cell = (value: unknown) => {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const csv = [columns.map(c => cell(c.label)).join(','), ...rows.map(r => columns.map(c => cell(r[c.key])).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
function exportPDF(title: string, columns: { key: string; label: string; money?: boolean }[], rows: FranchiseRow[], filters: FranchiseFilters) {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(16); doc.text(title, 14, 16);
  doc.setFontSize(9); doc.text(`Period: ${filters.startDate} to ${filters.endDate} | Generated: ${today()}`, 14, 23);
  autoTable(doc, { startY: 30, head: [columns.map(c => c.label)], body: rows.map(row => columns.map(c => c.money ? `INR ${Number(row[c.key] || 0).toFixed(2)}` : String(row[c.key] ?? ''))), styles: { fontSize: 7 }, headStyles: { fillColor: [31, 175, 142] } });
  doc.save(`${title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}

function DataTable({ columns, rows, actions, selection }: { columns: { key: string; label: string; money?: boolean }[]; rows: FranchiseRow[]; actions?: (row: FranchiseRow) => React.ReactNode; selection?: { ids: Set<string>; eligible: (row: FranchiseRow) => boolean; toggle: (id: string) => void; toggleAll: () => void; disabled: boolean } }) {
  return <div className="fr-table-wrap"><table className="fr-table"><thead><tr>{selection && <th><input type="checkbox" aria-label="Select all removable sales in this view" disabled={selection.disabled || !rows.some(selection.eligible)} checked={rows.some(selection.eligible) && rows.filter(selection.eligible).every(row => selection.ids.has(row.id))} onChange={selection.toggleAll} /></th>}{columns.map(c => <th key={c.key}>{c.label}</th>)}{actions && <th>Actions</th>}</tr></thead>
    <tbody>{rows.map((row, i) => <tr key={row.id || i}>{selection && <td>{selection.eligible(row) && <input type="checkbox" aria-label={`Select sale for ${row.client_name}`} disabled={selection.disabled} checked={selection.ids.has(row.id)} onChange={() => selection.toggle(row.id)} />}</td>}{columns.map(c => <td key={c.key}>{c.key === 'status' ? <span className={`fr-status fr-status-${String(row[c.key]).toLowerCase()}`}>{row[c.key]}</span> : c.money ? currency(row[c.key]) : String(row[c.key] ?? '—')}</td>)}{actions && <td><div className="fr-actions">{actions(row)}</div></td>}</tr>)}
      {!rows.length && <tr><td colSpan={columns.length + (actions ? 1 : 0) + (selection ? 1 : 0)} className="fr-empty">No records match this view.</td></tr>}</tbody></table></div>;
}

function FormDialog({ dialog, saving, onClose, onSave, data }: { dialog: Dialog; saving: boolean; onClose: () => void; onSave: (body: FranchiseRow) => void; data: FranchiseBootstrap }) {
  const [body, setBody] = useState<FranchiseRow>(dialog.initial);
  const firstInput = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => { firstInput.current?.querySelector<HTMLInputElement>('input,select,textarea')?.focus(); }, []);
  useEffect(() => {
    const originalOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) closeRef.current();
      if (e.key === 'Tab') {
        const controls = Array.from(firstInput.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)') || []);
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = originalOverflow; document.removeEventListener('keydown', keydown); };
  }, [saving]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = { ...body };
    for (const field of dialog.fields) {
      if (field.type === 'checkbox') result[field.name] = Boolean(body[field.name]);
      if (field.type === 'number' && body[field.name] !== '' && body[field.name] != null) result[field.name] = Number(body[field.name]);
    }
    if ('has_office' in result && !result.has_office) result.office_sqft = null;
    onSave(result);
  };
  return <div className="fr-overlay"><div className="fr-dialog" role="dialog" aria-modal="true" aria-labelledby="fr-dialog-title" ref={firstInput}>
    <div className="fr-heading"><h2 id="fr-dialog-title">{dialog.title}</h2><button type="button" className="mis-btn mis-btn-secondary" disabled={saving} onClick={onClose} aria-label="Close form">Close</button></div>
    <form onSubmit={submit}><div className="fr-form-grid">{dialog.fields.map(field => {
      if (field.hidden || (field.name === 'office_sqft' && !body.has_office) || (['franchise_amount', 'manual_reason'].includes(field.name) && body.use_rule)) return null;
      let fieldOptions = field.options || [];
      if (field.name === 'sale_id') fieldOptions = (field.options || []).filter(x => data.franchises.some(f => f.id === body.franchise_id) && x.value.startsWith(`${body.franchise_id}:`)).map(x => ({ ...x, value: x.value.split(':')[1] }));
      if (field.name === 'earning_id') fieldOptions = (field.options || []).filter(x => x.value.startsWith(`${body.franchise_id}:`)).map(x => ({ ...x, value: x.value.split(':')[1] }));
      const id = `fr-field-${field.name}`;
      return <div className={`mis-field ${field.type === 'textarea' ? 'fr-wide' : ''}`} key={field.name}>
        <label className="mis-label" htmlFor={id}>{field.label}{field.required !== false && field.type !== 'checkbox' ? ' *' : ''}</label>
        {field.type === 'select' ? <select id={id} className="mis-input" value={body[field.name] || ''} required={field.required !== false} disabled={saving || field.readOnly} onChange={e => setBody({ ...body, [field.name]: e.target.value, ...(field.name === 'franchise_id' ? { sale_id: '', earning_id: '' } : {}) })}>
          <option value="">Select…</option>{fieldOptions.map(x => <option value={x.value} key={x.value}>{x.label}</option>)}</select>
          : field.type === 'checkbox' ? <input id={id} type="checkbox" checked={Boolean(body[field.name])} disabled={saving} onChange={e => setBody({ ...body, [field.name]: e.target.checked })} />
          : field.type === 'textarea' ? <textarea id={id} className="mis-input" rows={3} maxLength={2000} disabled={saving} value={body[field.name] || ''} required={field.required !== false} onChange={e => setBody({ ...body, [field.name]: e.target.value })} />
          : <input id={id} className="mis-input" type={field.type || 'text'} value={body[field.name] ?? ''} required={field.required !== false} disabled={saving} readOnly={field.readOnly}
              step={field.type === 'number' ? '0.01' : undefined} min={field.min ?? (field.type === 'number' ? '0' : undefined)} max={field.max} maxLength={field.type === 'password' ? 128 : field.name === 'phone' || field.name === 'client_contact' ? 20 : 255}
              minLength={field.type === 'password' ? 8 : undefined} autoComplete={field.type === 'password' ? 'new-password' : undefined}
              onChange={e => setBody({ ...body, [field.name]: e.target.value })} />}
        {field.help && <small className="fr-muted">{field.help}</small>}
      </div>;
    })}</div><div className="fr-dialog-footer"><button type="button" className="mis-btn mis-btn-secondary" disabled={saving} onClick={onClose}>Cancel</button>
      <button className="mis-btn mis-btn-primary" disabled={saving}>{saving ? 'Saving…' : dialog.path==='franchises' ? 'Submit & email login' : 'Save'}</button></div></form>
  </div></div>;
}

function DashboardCharts({ dashboard }: { dashboard: FranchiseDashboard }) {
  const { theme } = useTheme();
  const productRef = useRef<HTMLCanvasElement>(null), trendRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const color = theme === 'dark' ? '#cbd5e1' : '#334155';
    const common = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color } } }, scales: { x: { ticks: { color } }, y: { beginAtZero: true, ticks: { color } } } };
    const charts: Chart[] = [];
    if (productRef.current) charts.push(new Chart(productRef.current, { type: 'bar', data: { labels: dashboard.products.map(p => p.name), datasets: [{ label: 'Completed orders', data: dashboard.products.map(p => p.orders), backgroundColor: '#06b6d4' }] }, options: common }));
    if (trendRef.current) charts.push(new Chart(trendRef.current, { type: 'line', data: { labels: dashboard.monthly.map(p => p.month), datasets: [{ label: 'Completed sales', data: dashboard.monthly.map(p => p.orders), borderColor: '#10b981', tension: 0.2 }] }, options: common }));
    return () => charts.forEach(chart => chart.destroy());
  }, [dashboard, theme]);
  return <div className="fr-chart-grid"><section className="fr-card"><h2>Products sold</h2><div className="fr-chart"><canvas ref={productRef} role="img" aria-label="Completed orders by product" /></div></section>
    <section className="fr-card"><h2>Monthly sales</h2><div className="fr-chart"><canvas ref={trendRef} role="img" aria-label="Completed sales by month" /></div></section></div>;
}

export default function FranchisePage({ dashboardView = false }: { dashboardView?: boolean }) {
  const [data, setData] = useState<FranchiseBootstrap | null>(null);
  const [dashboardResult, setDashboardResult] = useState<{ value: FranchiseDashboard; key: string; source: FranchiseBootstrap } | null>(null);
  const [records, setRecords] = useState<Record<FranchiseKind, FranchiseRow[]>>({ sales: [], earnings: [], expenses: [], payments: [] });
  const [tab, setTab] = useState<Tab>('franchises');
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const [selectedSales, setSelectedSales] = useState<Set<string>>(new Set());
  const [bulkRemoval, setBulkRemoval] = useState<FranchiseRow[] | null>(null);
  const [bulkRemovalResults, setBulkRemovalResults] = useState<FranchiseRow[]>([]);
  const [saleToRemove, setSaleToRemove] = useState<FranchiseRow | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [filters, setFilters] = useState<FranchiseFilters>(() => ({ startDate: `${today().slice(0, 7)}-01`, endDate: today(), franchiseId: '', state: '', city: '', planId: '', status: '', productId: '' }));
  const dashboard = dashboardResult?.source === data && dashboardResult?.key === JSON.stringify(filters) ? dashboardResult.value : null;
  const [recordStatus, setRecordStatus] = useState(''), [search, setSearch] = useState('');
  const salesCsvInput = useRef<HTMLInputElement>(null);
  const [salesImportResults, setSalesImportResults] = useState<FranchiseRow[]>([]);
  const csvInput=useRef<HTMLInputElement>(null);
  const [csvPreview, setCsvPreview] = useState<{ filename: string; rows: FranchiseRow[]; sales?: boolean } | null>(null);
  const [importResults,setImportResults]=useState<FranchiseRow[]>([]);
  const requestVersion = useRef(0);
  const load = useCallback(() => {
    const version = ++requestVersion.current;
    return franchiseService.bootstrap().then(async bootstrap => {
      const kinds: FranchiseKind[] = ['sales'];
      const values = await Promise.all(kinds.map(k => franchiseService.records(k)));
      if (version !== requestVersion.current) return;
      setError(''); setData(bootstrap); setRecords({ sales: values[0], earnings: [], expenses: [], payments: [] });
      if (bootstrap.access.external) setTab(current => current === 'franchises' ? 'sales' : current);
    }).catch(e => { if (version === requestVersion.current) { setError(errorText(e)); setData(null); setRecords({ sales: [], earnings: [], expenses: [], payments: [] }); } })
      .finally(() => { if (version === requestVersion.current) setLoading(false); });
  }, []);
  const invalidate = useCallback(() => { requestVersion.current++; }, []);
  useEffect(() => { load(); return invalidate; }, [load, invalidate]);
  useEffect(() => {
    if (!dashboardView || !data) return;
    let active = true;
    franchiseService.dashboard(filters).then(value => { if (active) { setDashboardResult({ value, key: JSON.stringify(filters), source: data }); setError(''); } }).catch(e => { if (active) setError(errorText(e)); });
    return () => { active = false; };
  }, [dashboardView, data, filters]);
  const save = async (body: FranchiseRow) => {
    if (!dialog || saving) return;
    setSaving(true);
    try {
      if (dialog.decision) await franchiseService.decide(dialog.decision.kind, dialog.decision.id, body);
      else {
        const result=await franchiseService.save(dialog.path, body, dialog.edit);
        if(result.emailResults?.some((x:FranchiseRow)=>!x.sent))toast.error('Franchise saved, but email delivery failed. Click Send login email to retry.');
        else toast.success(dialog.path==='franchises'&&!dialog.edit?'Franchise created and login email sent.':'Saved successfully.');
      }
      if(dialog.decision)toast.success('Saved successfully.');setDialog(null); setLoading(true); await load();
    } catch (e) { toast.error(errorText(e)); }
    finally { setSaving(false); }
  };
  const openFranchise = (row?: FranchiseRow) => {
    if (!data) return;
    const fields: Field[] = [
      { name: 'name', label: 'Franchise name' }, { name: 'owner_name', label: 'Owner / contact person' },
      { name: 'phone', label: 'Phone', type: 'tel', help: '10–15 digits; country code can start with +.' }, { name: 'email', label: 'Contact email', type: 'email' },
      { name: 'state', label: 'State' }, { name: 'city', label: 'City' }, { name: 'area', label: 'Area / locality', required: false }, { name: 'postal_code', label: 'Postal code', required: false },
      { name: 'address', label: 'Address', type: 'textarea', required: false },
      ...(!row ? [{ name: 'registered_on', label: 'Registered on', type: 'date' }] : []),
      { name: 'has_office', label: 'Has office?', type: 'checkbox', required: false }, { name: 'office_sqft', label: 'Office area (sqft)', type: 'number', min: '0.01' },
      ...(row?[select('status', 'Status', choices(['Draft', 'Active', 'Suspended', 'Closed']))]:[]), select('branch_id', 'Supervising branch', options(data.branches), false),
      { name: 'remarks', label: 'Internal remarks', type: 'textarea', required: false },
    ];
    setDialog({ title: row ? `Edit ${row.name}` : 'Add franchise', path: row ? `franchises/${row.id}` : 'franchises', edit: Boolean(row), fields,
      initial: row || { has_office: false, registered_on: today(), status: 'Active' } });
  };
  const importCSV = async (file?: File) => {
    if (!file || saving) return;
    setSaving(true);
    try {
      if (file.size > 1024 * 1024) throw new Error('CSV must be smaller than 1 MB.');
      const rows = parseFranchiseCsv(await file.text());
      setCsvPreview({ filename: file.name, rows });
    } catch (e) { toast.error(errorText(e)); }
    finally { setSaving(false); if (csvInput.current) csvInput.current.value = ''; }
  };
  const previewSalesCSV = async (file?: File) => {
    if (!file || saving || !data) return;
    setSaving(true);
    try {
      if (file.size > 1024 * 1024) throw new Error('CSV must be smaller than 1 MB.');
      const rows = parseSalesCsv(await file.text()).map((row, index) => {
        const product = data.products.find(p => p.active && [p.name, p.code, p.sale_product_type].some(v => v.toLowerCase() === String(row.product).toLowerCase()));
        if (!product) throw new Error(`Row ${index + 2}: unknown or inactive product ${row.product}.`);
        return { ...row, product_id: product.id };
      });
      setCsvPreview({ filename: file.name, rows, sales: true });
    } catch (e) { toast.error(errorText(e)); }
    finally { setSaving(false); if (salesCsvInput.current) salesCsvInput.current.value = ''; }
  };
  const [salesImportFranchise, setSalesImportFranchise] = useState('');
  const submitCSV = async () => {
    if (!csvPreview || saving) return;
    setSaving(true);
    try {
      if (csvPreview.sales) {
        const franchiseId = salesImportFranchise || (data?.franchises.length === 1 ? data.franchises[0].id : filters.franchiseId);
        const franchise = data?.franchises.find(f => f.id === franchiseId && f.status === 'Active');
        if (!franchise) throw new Error('Select an active franchise for this upload.');
        if (csvPreview.rows.some(row => row.sale_date < franchise.registered_on)) throw new Error('Sale dates cannot precede franchise registration.');
        const results: FranchiseRow[] = [];
        for (const [index, row] of csvPreview.rows.entries()) {
          try { await franchiseService.save('records/sales', { ...row, franchise_id: franchiseId }); results.push({ row: index + 2, result: 'Saved · Completed' }); }
          catch (e) { results.push({ row: index + 2, result: errorText(e) }); }
        }
        setSalesImportResults(results);
        toast.success(`${results.filter(r => r.result === 'Saved · Completed').length} of ${results.length} sales saved. Check row results.`);
        setCsvPreview(null); await load(); return;
      }
      const result = await franchiseService.save('franchises/import', { rows: csvPreview.rows });
      setImportResults(result.results);
      const created = result.results.filter((x: FranchiseRow) => x.success).length;
      toast.success(`${created} of ${csvPreview.rows.length} {csvPreview.sales ? 'sales' : 'franchises'} created. Check row results below.`);
      setCsvPreview(null);
      await load();
    } catch (e) { toast.error(errorText(e)); }
    finally { setSaving(false); }
  };
  const sendLoginEmail=async(row:FranchiseRow)=>{
    if(saving)return;setSaving(true);
    try{const result=await franchiseService.save(`franchises/${row.id}/send-credentials`,{});
      if(!result.emailResults.length||result.emailResults.some((x:FranchiseRow)=>!x.sent))toast.error('Login email could not be sent. Check SMTP settings.');
      else toast.success('Login passwords reset and emails sent.');
    }catch(e){toast.error(errorText(e));}finally{setSaving(false);}
  };
  const removeSale = async () => {
    if (!saleToRemove || saving) return;
    setSaving(true);
    try {
      await franchiseService.removeSale(saleToRemove.id);
      toast.success('Sale removed.'); setSaleToRemove(null); await load();
    } catch (e) { toast.error(errorText(e)); }
    finally { setSaving(false); }
  };
  const removeSelectedSales = async () => {
    if (!bulkRemoval || saving) return;
    setSaving(true);
    const results: FranchiseRow[] = [];
    const removed = new Set<string>();
    try {
      for (const row of bulkRemoval) {
        try { await franchiseService.removeSale(row.id); removed.add(row.id); results.push({ customer: row.client_name, product: row.product_type, result: 'Removed' }); }
        catch (e) { results.push({ customer: row.client_name, product: row.product_type, result: errorText(e) }); }
      }
      setBulkRemovalResults(results);
      setSelectedSales(current => new Set([...current].filter(id => !removed.has(id))));
      setBulkRemoval(null);
      toast.success(`${removed.size} of ${results.length} sales removed. Check results.`);
      await load();
    } finally { setSaving(false); }
  };
  const openRecord = (kind: FranchiseKind, row?: FranchiseRow) => {
    if (!data) return;
    const fields: Field[] = row ? [{ ...select('franchise_id', 'Franchise', options(data.franchises)), readOnly: true }] : [select('franchise_id', 'Franchise', options(data.franchises.filter(f => f.status === 'Active')))];
    const initial: FranchiseRow = { franchise_id: data.franchises.length === 1 ? data.franchises[0].id : filters.franchiseId, sale_date: today(), units: 1, sale_value: 0,
      recognition_date: today(), use_rule: true, company_revenue: 0, franchise_amount: 0, expense_date: today(), owner: 'Franchise', payment_date: today(), direction: 'Payout' };
    if (kind === 'sales') fields.push({ name: 'client_name', label: 'Customer name' }, { name: 'client_contact', label: 'Customer phone', type: 'tel', required: false },
      select('product_id', 'Product', options(data.products.filter(p => p.active || p.id === row?.product_id))), { name: 'sale_date', label: 'Submitted on', type: 'date' }, { name: 'order_reference', label: 'Order / application reference', required: false },
      { name: 'units', label: 'Product quantity', type: 'number', min: '0.01', help: 'Share count, accounts, enrollments, etc. Dashboard sales count each order once.' },
      { name: 'sale_value', label: 'Customer transaction amount (₹)', type: 'number', help: 'Amount paid or invested by the customer.' }, { name: 'remarks', label: 'Product details / remarks', type: 'textarea', required: false });
    if (row && kind === 'sales') fields.push(
      { name: 'status', label: 'Status', readOnly: true, help: 'Sales are recorded directly; no admin approval is required.', required: false },
      { name: 'decision_note', label: 'Decision note', readOnly: true, required: false },
    );
    setDialog({ title: row ? 'Edit sale' : { sales: 'Submit product sale', earnings: 'Submit earning for approval', expenses: 'Submit expense for approval', payments: 'Record verified payment' }[kind],
      path: row ? `records/${kind}/${row.id}` : `records/${kind}`, edit: Boolean(row), fields, initial: { ...initial, ...row } });
  };
  const external = data?.access.external || false;
  const selectedFranchises = (data?.franchises || []).filter(x => (!filters.franchiseId || x.id === filters.franchiseId) && (!filters.state || x.state === filters.state) && (!filters.city || x.city === filters.city) && (!filters.planId || x.plan_id === filters.planId) && (!filters.status || x.status === filters.status));
  const selectedIds = new Set(selectedFranchises.map(x => x.id));
  const franchiseName = (id: string) => data?.franchises.find(f => f.id === id)?.name || id;
  const productName = (id: string) => data?.products.find(p => p.id === id)?.name || id;
  const recordKind = (['sales', 'earnings', 'expenses', 'payments'].includes(tab) ? tab : 'sales') as FranchiseKind;
  const earningProduct = (row: FranchiseRow) => records.earnings.find(e => e.id === row.earning_id)?.product_id;
  const visibleRecords: FranchiseRow[] = records[recordKind].filter(x => {
    const date = recordKind === 'sales' ? x.completed_date || x.sale_date : recordKind === 'earnings' ? x.recognition_date : recordKind === 'expenses' ? x.expense_date : x.payment_date;
    const product = recordKind === 'payments' ? earningProduct(x) : x.product_id;
    return selectedIds.has(x.franchise_id) && date >= filters.startDate && date <= filters.endDate && (!recordStatus || x.status === recordStatus) &&
      (!filters.productId || (recordKind !== 'expenses' && product === filters.productId)) && (!search || JSON.stringify(x).toLowerCase().includes(search.toLowerCase()));
  }).map(x => ({ ...x, franchise_name: franchiseName(x.franchise_id), product_name: productName(x.product_id), date: recordKind === 'sales' ? x.completed_date || x.sale_date : recordKind === 'earnings' ? x.recognition_date : recordKind === 'expenses' ? x.expense_date : x.payment_date })).sort((a, b) => b.date.localeCompare(a.date));
  const recordColumns = [{ key: 'franchise_name', label: 'Franchise' }, { key: 'date', label: recordKind === 'sales' ? 'Completed / submitted' : 'Date' },
    ...(recordKind === 'sales' ? [{ key: 'client_name', label: 'Customer' }, { key: 'product_type', label: 'Product' }, { key: 'order_reference', label: 'Order reference' }, { key: 'units', label: 'Quantity' }, { key: 'sale_value', label: 'Transaction value', money: true }] : []),
    ...(recordKind === 'earnings' ? [{ key: 'reference', label: 'Reference' }, { key: 'product_name', label: 'Product' }, { key: 'earning_type', label: 'Earning type' }, ...(!external ? [{ key: 'company_revenue', label: 'Company revenue', money: true }] : []), { key: 'franchise_amount', label: 'Franchise earnings', money: true }] : []),
    ...(recordKind === 'expenses' ? [{ key: 'owner', label: 'Cost owner' }, { key: 'category', label: 'Category' }, { key: 'description', label: 'Description' }, { key: 'amount', label: 'Amount', money: true }] : []),
    ...(recordKind === 'payments' ? [{ key: 'direction', label: 'Direction' }, { key: 'amount', label: 'Amount', money: true }, { key: 'method', label: 'Method' }, { key: 'reference', label: 'Reference' }, { key: 'status', label: 'Status' }, { key: 'reversal_note', label: 'Reversal reason' }] : [{ key: 'status', label: 'Status' }])];
  const removable = (row: FranchiseRow) => Boolean(data?.access.canEnterSales && (row.created_by === data.access.userId || data.access.canApproveSales));
  const selectedVisibleSales = visibleRecords.filter(row => selectedSales.has(row.id) && removable(row));
  const franchiseColumns = [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Franchise' }, { key: 'owner_name', label: 'Owner' }, { key: 'state', label: 'State' }, { key: 'city', label: 'City' }, { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' }, { key: 'office_display', label: 'Office' }, { key: 'registered_on', label: 'Registered on' }, { key: 'status', label: 'Status' }];
  const franchiseRows = selectedFranchises.filter(x => !search || `${x.name} ${x.owner_name} ${x.code} ${x.email} ${x.phone}`.toLowerCase().includes(search.toLowerCase())).map(x => ({ ...x, office_display: x.has_office ? `${x.office_sqft} sqft` : 'No office' }));
  const performanceColumns = [{ key: 'name', label: 'Franchise' }, { key: 'city', label: 'City' }, { key: 'orders', label: 'Completed sales' }];
  const canAddRecord = Boolean(data && (recordKind === 'sales' ? data.access.canEnterSales : recordKind === 'earnings' ? data.access.canSubmitFinance : recordKind === 'payments' ? data.access.canApproveFinance : data.access.canWrite));
  const canDecide = Boolean(data && (recordKind === 'sales' ? data.access.canApproveSales : data.access.canApproveFinance));
  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'franchises', label: 'Franchises', show: !external }, { id: 'sales', label: 'Product sales', show: true }, { id: 'workflow', label: 'How it works', show: true },
  ];
  const setFilter = (key: keyof FranchiseFilters, value: string) => setFilters(previous => ({ ...previous, [key]: value, ...(key === 'state' ? { city: '' } : {}) }));
  return <DashboardLayout><div className="fr-page">
    <header className="fr-heading"><div><p className="fr-eyebrow">{external ? 'Your franchise' : 'Franchise department'}</p><h1>{dashboardView ? 'Franchise Dashboard' : 'Franchise Management'}</h1>
      <p className="fr-muted">{external ? 'Enter product sales and view your franchise dashboard.' : 'Add franchises, email logins and track staff sales.'}</p></div>
      <div className="fr-actions"><Link className={`mis-btn ${dashboardView ? 'mis-btn-primary' : 'mis-btn-secondary'}`} to={ROUTES.FRANCHISE_DASHBOARD}>Dashboard</Link>
        <Link className={`mis-btn ${!dashboardView ? 'mis-btn-primary' : 'mis-btn-secondary'}`} to={ROUTES.FRANCHISE_MANAGE}>Manage</Link><button className="mis-btn mis-btn-secondary" disabled={loading || saving} onClick={() => { setLoading(true); load(); }}>Refresh</button></div></header>
    {error && <div className="mis-alert mis-alert-error" role="alert">{error}<button className="mis-btn mis-btn-secondary" disabled={loading} onClick={() => { setLoading(true); load(); }}>Retry</button></div>}
    {loading && <p role="status" className="fr-muted">Loading franchise records…</p>}
    {data && <>
      <section className="fr-card fr-filter-grid" aria-label="Report filters">
        <label className="mis-field"><span className="mis-label">From</span><input className="mis-input" type="date" value={filters.startDate} max={filters.endDate} onChange={e => setFilter('startDate', e.target.value)} /></label>
        <label className="mis-field"><span className="mis-label">To</span><input className="mis-input" type="date" value={filters.endDate} min={filters.startDate} onChange={e => setFilter('endDate', e.target.value)} /></label>
        {([{ key: 'franchiseId', label: 'Franchise', values: options(data.franchises) }, { key: 'state', label: 'State', values: choices([...new Set(data.franchises.map(f => f.state))].sort()) },
          { key: 'city', label: 'City', values: choices([...new Set(data.franchises.filter(f => !filters.state || f.state === filters.state).map(f => f.city))].sort()) },
          { key: 'status', label: 'Franchise status', values: choices(['Draft', 'Active', 'Suspended', 'Closed']) }, { key: 'productId', label: 'Product', values: options(data.products) }] as { key: keyof FranchiseFilters; label: string; values: Option[] }[]).map(field =>
            <label className="mis-field" key={field.key}><span className="mis-label">{field.label}</span><select className="mis-input" value={filters[field.key]} onChange={e => setFilter(field.key, e.target.value)}><option value="">All</option>{field.values.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}</select></label>)}
      </section>
      {dashboardView ? dashboard ? <>
        <div className="fr-kpis">{[
          { label: 'Total franchises', value: dashboard.kpis.totalFranchises, detail: 'All registered franchises', tone: 'cyan', Icon: Building2 },
          { label: 'Active franchises', value: dashboard.kpis.activeFranchises, detail: 'Currently active', tone: 'green', Icon: BadgeCheck },
          { label: 'New registrations', value: dashboard.kpis.newFranchises, detail: 'Registered in this period', tone: 'purple', Icon: UserPlus },
          { label: 'Completed sales', value: dashboard.kpis.completedOrders, detail: 'Completed count, this period', tone: 'green', Icon: FileCheck2 },
          { label: 'Sales entered', value: dashboard.kpis.totalOrders, detail: 'All sales, this period', tone: 'cyan', Icon: Files },
          { label: 'Pending sales', value: dashboard.kpis.pendingOrders, detail: 'Not yet counted as completed', tone: 'amber', Icon: Clock3 },
        ].map(({ label, value, detail, tone, Icon }) => <section className={`fr-card fr-kpi fr-kpi-${tone}`} key={label}><div className="fr-kpi-content"><p className="fr-kpi-label">{label}</p><strong>{value}</strong><p className="fr-kpi-detail">{detail}</p></div><span className="fr-kpi-icon" aria-hidden="true"><Icon size={23} strokeWidth={1.8} /></span></section>)}</div>
        <section className="fr-card"><h2>Top product</h2><p>{dashboard.kpis.topProductsByOrders.join(', ') || 'No completed sales in this period'}</p><p className="fr-muted">Ranked by completed sale count. New staff entries appear in Latest sales with their status.</p></section>
        <DashboardCharts dashboard={dashboard} />
        <section className="fr-card"><h2>Latest sales</h2><p className="fr-muted">Click Refresh to see the latest staff sales.</p><DataTable columns={[{key:'franchise',label:'Franchise'},{key:'customer',label:'Customer'},{key:'product',label:'Product'},{key:'date',label:'Date'},{key:'quantity',label:'Quantity'},{key:'transactionAmount',label:'Transaction amount',money:true},{key:'status',label:'Status'}]} rows={dashboard.recentSales}/></section>
        <section className="fr-card"><div className="fr-heading"><h2>Franchise performance</h2><div className="fr-actions"><button className="mis-btn mis-btn-secondary" onClick={() => exportCSV('franchise-performance.csv', performanceColumns, dashboard.franchises)}>Export CSV</button><button className="mis-btn mis-btn-secondary" onClick={() => exportPDF('Franchise performance', performanceColumns, dashboard.franchises, filters)}>Export PDF</button></div></div><DataTable columns={performanceColumns} rows={dashboard.franchises} /></section>
        <section className="fr-card"><h2>Product performance</h2><DataTable columns={[{ key: 'name', label: 'Product' }, { key: 'orders', label: 'Completed orders' }]} rows={dashboard.products} /></section>
      </> : !error && <p role="status">Calculating dashboard…</p> : <>
        <nav className="fr-tabs" aria-label="Franchise sections">{tabs.filter(t => t.show).map(t => <button key={t.id} className={`mis-btn ${tab === t.id ? 'mis-btn-primary' : 'mis-btn-secondary'}`} onClick={() => { setTab(t.id); setRecordStatus(''); setSearch(''); }}>{t.label}</button>)}</nav>
        {tab === 'franchises' && <section className="fr-card"><div className="fr-heading"><h2>Franchise register</h2><div className="fr-actions"><button className="mis-btn mis-btn-secondary" onClick={() => exportCSV('franchises.csv', franchiseColumns, franchiseRows)}>Export CSV</button>{data.access.canManageUsers && <><a className="mis-btn mis-btn-secondary" href="/samples/franchise-sample.csv" download>Sample CSV</a><button className="mis-btn mis-btn-secondary" disabled={saving} onClick={()=>csvInput.current?.click()}>Import CSV</button><input ref={csvInput} type="file" accept=".csv,text/csv" hidden onChange={e=>importCSV(e.target.files?.[0])}/><button className="mis-btn mis-btn-primary" disabled={saving} onClick={() => openFranchise()}>Add franchise</button></>}</div></div>
          <p className="fr-muted">Add manually or import CSV. Submit creates the franchise and emails Owner and Staff passwords to its saved email. Both roles use the saved email with their own password.</p>
          {!!importResults.length&&<DataTable columns={[{key:'row',label:'CSV row'},{key:'result',label:'Result'}]} rows={importResults.map(x=>({...x,result:x.success?`${x.franchise.name}: saved; ${x.franchise.emailResults.every((e:FranchiseRow)=>e.sent)?'login email sent':'email failed — use Send login email'}`:x.message}))}/>}
          <input className="mis-input fr-search" placeholder="Search franchise, owner, phone or email" aria-label="Search franchises" value={search} onChange={e => setSearch(e.target.value)} />
          <DataTable columns={franchiseColumns} rows={franchiseRows} actions={data.access.canManage ? row => <><button className="mis-btn mis-btn-secondary" onClick={() => openFranchise(row)}>Edit</button>{data.access.canManageUsers&&<button className="mis-btn mis-btn-secondary" disabled={saving} onClick={()=>sendLoginEmail(row)}>Send new login email</button>}</> : undefined} /></section>}
        {['sales', 'earnings', 'expenses', 'payments'].includes(tab) && <section className="fr-card"><div className="fr-heading"><h2>{tabs.find(t => t.id === tab)?.label}</h2><div className="fr-actions"><button className="mis-btn mis-btn-secondary" onClick={() => exportCSV(`franchise-${recordKind}.csv`, recordColumns, visibleRecords)}>Export CSV</button><button className="mis-btn mis-btn-secondary" onClick={() => exportPDF(`Franchise ${recordKind}`, recordColumns, visibleRecords, filters)}>Export PDF</button>{recordKind === 'sales' && canAddRecord && <><button className="mis-btn mis-btn-secondary" disabled={saving || !selectedVisibleSales.length} onClick={() => setBulkRemoval(selectedVisibleSales)}>Remove selected ({selectedVisibleSales.length})</button><a className="mis-btn mis-btn-secondary" href="/samples/franchise-sales-sample.csv" download>Sample CSV</a><button className="mis-btn mis-btn-secondary" disabled={saving} onClick={() => { setSalesImportFranchise(data.franchises.length === 1 ? data.franchises[0].id : filters.franchiseId || ''); salesCsvInput.current?.click(); }}>Bulk upload</button><input ref={salesCsvInput} type="file" accept=".csv,text/csv" hidden onChange={e => previewSalesCSV(e.target.files?.[0])} /></>}{canAddRecord && <button className="mis-btn mis-btn-primary" onClick={() => openRecord(recordKind)}>{recordKind === 'payments' ? 'Record payment' : 'Add record'}</button>}</div></div>
          {!!salesImportResults.length && <DataTable columns={[{key: 'row', label: 'CSV row'}, {key: 'result', label: 'Upload result'}]} rows={salesImportResults} />}
          <div className="fr-actions fr-record-filters"><input className="mis-input fr-search" value={search} placeholder="Search records" aria-label="Search records" onChange={e => setSearch(e.target.value)} />
            {recordKind !== 'payments' && <select className="mis-input" aria-label="Record status" value={recordStatus} onChange={e => setRecordStatus(e.target.value)}><option value="">All record statuses</option>{(recordKind === 'sales' ? ['Pending', 'Completed', 'Cancelled'] : ['Submitted', 'Approved', 'Rejected', 'Reversed']).map(s => <option key={s}>{s}</option>)}</select>}</div>
          {recordKind === 'expenses' && filters.productId && <p className="fr-muted">Clear the Product filter to see operating expenses. They apply to the whole franchise.</p>}
          {recordKind === 'earnings' && !external && <p className="fr-muted">Revenue is actual business earnings. Customer investments are recorded separately in Product sales. Only approved earnings count in the dashboard.</p>}
          {recordKind === 'payments' && <p className="fr-muted">Payments settle existing earnings. They do not create additional revenue. Partial payments are supported.</p>}
          {!!bulkRemovalResults.length && <DataTable columns={[{key:'customer',label:'Customer'},{key:'product',label:'Product'},{key:'result',label:'Removal result'}]} rows={bulkRemovalResults} />}
          <DataTable columns={recordColumns} rows={visibleRecords} selection={recordKind === 'sales' && data.access.canEnterSales ? {
            ids: selectedSales, eligible: removable, disabled: saving,
            toggle: id => setSelectedSales(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }),
            toggleAll: () => setSelectedSales(current => { const next = new Set(current); const rows = visibleRecords.filter(removable); const all = rows.every(row => next.has(row.id)); rows.forEach(row => { if (all) next.delete(row.id); else next.add(row.id); }); return next; }),
          } : undefined} actions={canDecide || data.access.canWrite ? row => <>
            {(recordKind === 'sales' ? data.access.canEnterSales : data.access.canWrite) && ['sales', 'expenses'].includes(recordKind) && (row.status === 'Pending' || (recordKind === 'sales' && row.status === 'Completed' && !row.verified_at) || row.status === 'Submitted') && (row.created_by === data.access.userId || canDecide) && <button className="mis-btn mis-btn-secondary" disabled={saving} onClick={() => openRecord(recordKind, row)}>Edit</button>}
            {recordKind === 'sales' && data.access.canEnterSales && (row.created_by === data.access.userId || canDecide) && <button className="mis-btn mis-btn-secondary" disabled={saving} onClick={() => setSaleToRemove(row)}>Remove</button>}
          </> : undefined} /></section>}
        {tab === 'workflow' && <Workflow external={external} />}
      </>}
    </>}
    {bulkRemoval && <div className="fr-overlay"><div className="fr-dialog" role="alertdialog" aria-modal="true" aria-labelledby="bulk-remove-title" aria-describedby="bulk-remove-description" onKeyDown={e => { if (e.key === 'Escape' && !saving) setBulkRemoval(null); }}>
      <h2 id="bulk-remove-title">Remove {bulkRemoval.length} selected sales?</h2>
      <p id="bulk-remove-description">These sales will be permanently removed from the list and dashboard totals. Sales with linked financial records cannot be removed.</p>
      <DataTable columns={[{key:'client_name',label:'Customer'},{key:'product_type',label:'Product'},{key:'sale_value',label:'Amount',money:true}]} rows={bulkRemoval} />
      <div className="fr-dialog-footer"><button autoFocus className="mis-btn mis-btn-secondary" disabled={saving} onClick={() => setBulkRemoval(null)}>Cancel</button><button className="mis-btn mis-btn-primary" disabled={saving} onClick={removeSelectedSales}>{saving ? 'Removing…' : 'Confirm bulk removal'}</button></div>
    </div></div>}
    {saleToRemove && <div className="fr-overlay"><div className="fr-dialog" role="alertdialog" aria-modal="true" aria-labelledby="remove-sale-title" aria-describedby="remove-sale-description" onKeyDown={e => { if (e.key === 'Escape' && !saving) setSaleToRemove(null); }}>
      <h2 id="remove-sale-title">Remove this sale?</h2>
      <p id="remove-sale-description">{saleToRemove.client_name} · {saleToRemove.product_type} · {currency(saleToRemove.sale_value)}. This sale will be permanently removed from the list and dashboard totals.</p>
      <div className="fr-dialog-footer"><button autoFocus className="mis-btn mis-btn-secondary" disabled={saving} onClick={() => setSaleToRemove(null)}>Cancel</button><button className="mis-btn mis-btn-primary" disabled={saving} onClick={removeSale}>{saving ? 'Removing…' : 'Confirm removal'}</button></div>
    </div></div>}
    {csvPreview && <div className="fr-overlay"><div className="fr-dialog fr-csv-preview" role="dialog" aria-modal="true" aria-labelledby="csv-preview-title">
      <div className="fr-heading"><h2 id="csv-preview-title">Preview CSV import</h2><button className="mis-btn mis-btn-secondary" disabled={saving} onClick={() => setCsvPreview(null)}>Close</button></div>
      <p>{csvPreview.filename} · {csvPreview.rows.length} {csvPreview.sales ? 'sales' : 'franchises'}</p>
      <p className="fr-muted">{csvPreview.sales ? 'Review sales before saving. Each saved row appears as Completed in Owner and Admin dashboards. Replace sample details and use dates on or after franchise registration.' : 'Review details before creating franchises and emailing logins. Replace sample contact details first.'}</p>
      {csvPreview.sales && <label className="mis-field"><span className="mis-label">Franchise</span><select className="mis-input" disabled={saving} value={salesImportFranchise} onChange={e => setSalesImportFranchise(e.target.value)}><option value="">Select franchise…</option>{data?.franchises.filter(f => f.status === 'Active').map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>}
      <DataTable columns={(csvPreview.sales ? salesCsvFields : franchiseCsvFields).map(key => ({ key, label: key.replaceAll('_', ' ') }))} rows={csvPreview.rows.map(row => ({ ...row, has_office: row.has_office ? 'Yes' : 'No' }))} />
      <div className="fr-actions"><button className="mis-btn mis-btn-secondary" disabled={saving} onClick={() => setCsvPreview(null)}>Cancel</button><button className="mis-btn mis-btn-primary" disabled={saving} onClick={submitCSV}>{saving ? 'Importing…' : csvPreview.sales ? 'Submit sales' : 'Submit & email logins'}</button></div>
    </div></div>}
    {dialog && data && <FormDialog key={`${dialog.path}-${dialog.title}`} dialog={dialog} saving={saving} data={data} onClose={() => { if (!saving) setDialog(null); }} onSave={save} />}
  </div></DashboardLayout>;
}

function Workflow({ external }: { external: boolean }) {
  return <section className="fr-card fr-workflow"><h2>Simple workflow</h2><ol>
    {!external && <><li><strong>Admin adds a franchise.</strong> Enter its details or import CSV.</li><li><strong>Submit.</strong> The franchise is saved and its Owner and Staff passwords is emailed to the saved email.</li></>}
    <li><strong>Staff signs in.</strong> Select Franchise Staff and use the saved email with the Staff password.</li>
    <li><strong>Submit a sale.</strong> Choose the customer and product. Enter the investment / order amount and application reference.</li>
    <li><strong>Owner reviews the dashboard.</strong> Select Franchise Owner with the saved email and Owner password. New sales and their statuses appear in that franchise's dashboard.</li>
    <li><strong>Admin reviews all franchises.</strong> Filter the dashboard by location or franchise. View staff sales, monthly sales and top products.</li>
  </ol>
    <p className="fr-muted">Owner uses password123 and Staff uses password1234 initially. Both use the saved email. Change each password after signing in.</p>
  </section>;
}
