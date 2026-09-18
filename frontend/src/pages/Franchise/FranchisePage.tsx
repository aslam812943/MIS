import FranchiseSalesPortal from './FranchiseSalesPortal';
import FranchiseSalesChart from './FranchiseSalesChart';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useState, useEffect, useMemo, type FormEvent } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import {
  franchiseService,
  type FranchiseRecord,
  type FranchiseBootstrap,
  type PlanRecord
} from '../../services/franchise.service';
import { toast } from 'react-hot-toast';
import './franchise.css';

const DEFAULT_PRODUCTS = [
  'Trading & demat account',
  'SW Global',
  'Privilege customer',
  'Mutual fund',
  'Child mutual',
  'Child demat',
  'Unlisted shares',
  'IEPF',
  'Course'
];

type TabType = 'Overview' | 'Franchises' | 'Products' | 'Plans';

interface FranchisePageProps {
  dashboardView?: boolean;
  portalView?: 'dashboard' | 'sales' | 'reports';
}

export default function FranchisePage({ dashboardView = false, portalView }: FranchisePageProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabType>(dashboardView ? 'Overview' : 'Franchises');
  useEffect(() => {
    setTab(dashboardView ? 'Overview' : 'Franchises');
  }, [dashboardView]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loginBusy, setLoginBusy] = useState<Record<string, 'setup' | 'email'>>({});
  const [loginErrors, setLoginErrors] = useState<Record<string, string>>({});
  const [data, setData] = useState<FranchiseBootstrap | null>(null);
  const [query, setQuery] = useState('');
  const [planQuery, setPlanQuery] = useState('');

  // Modals state
  const [franchiseModalOpen, setFranchiseModalOpen] = useState(false);
  const [editingFranchise, setEditingFranchise] = useState<FranchiseRecord | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanRecord | null>(null);
  const [deletingFranchise, setDeletingFranchise] = useState<FranchiseRecord | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<PlanRecord | null>(null);

  // Franchise Form state
  const [formData, setFormData] = useState({
    location: '',
    name: '',
    phone: '',
    email: '',
    plan: 'Starter',
    office: 'Yes',
    sqft: '750',
    registered: new Date().toISOString().slice(0, 10),
    sales: [] as string[]
  });

  // Plan Form state
  const [planFormData, setPlanFormData] = useState({
    name: '',
    joining_fee: '0',
    recurring_fee: '0',
    billing_frequency: 'None' as 'None' | 'Monthly' | 'Yearly',
    description: '',
    active: true
  });

  const loadData = async () => {
    try {
      const res = await franchiseService.bootstrap();
      setData(res);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to load franchise data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const refresh = () => { void loadData(); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const openAddFranchise = () => {
    const defaultPlan = data?.plans?.[0]?.name || 'Starter';
    setEditingFranchise(null);
    setFormData({
      location: '',
      name: '',
      phone: '',
      email: '',
      plan: defaultPlan,
      office: 'Yes',
      sqft: '750',
      registered: new Date().toISOString().slice(0, 10),
      sales: ['Trading & demat account']
    });
    setFranchiseModalOpen(true);
  };

  const openEditFranchise = (f: FranchiseRecord) => {
    setEditingFranchise(f);
    setFormData({
      location: f.location || '',
      name: f.name || '',
      phone: f.phone || '',
      email: f.email || '',
      plan: f.plan || 'Starter',
      office: f.office || 'No',
      sqft: f.sqft || '',
      registered: f.registered || new Date().toISOString().slice(0, 10),
      sales: Array.isArray(f.sales) ? [...f.sales] : []
    });
    setFranchiseModalOpen(true);
  };

  const openCreatePlan = () => {
    setEditingPlan(null);
    setPlanFormData({
      name: '',
      joining_fee: '0',
      recurring_fee: '0',
      billing_frequency: 'None',
      description: '',
      active: true
    });
    setPlanModalOpen(true);
  };

  const openEditPlan = (p: PlanRecord) => {
    setEditingPlan(p);
    setPlanFormData({
      name: p.name || '',
      joining_fee: String(p.joining_fee ?? 0),
      recurring_fee: String(p.recurring_fee ?? 0),
      billing_frequency: p.billing_frequency || 'None',
      description: p.description || '',
      active: p.active !== false
    });
    setPlanModalOpen(true);
  };

  const handleSaveFranchise = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!formData.location.trim() || !formData.name.trim() || !formData.phone.trim() || !formData.email.trim()) {
      toast.error('Please fill in all required fields.');
      return;
    }

    if (formData.office === 'Yes' && (!formData.sqft || Number(formData.sqft) <= 0)) {
      toast.error('Please enter the office area in sq ft.');
      return;
    }

    setSaving(true);
    try {
      if (editingFranchise) {
        await franchiseService.updateFranchise(editingFranchise.id, formData as any);
        toast.success('Franchise record updated successfully.');
      } else {
        const res = await franchiseService.createFranchise(formData as any);
        if (res.emailSent) {
          toast.success(`Franchise created. Employee and HOD logins are ready; both passwords were emailed to ${formData.email}.`);
        } else {
          toast.success('Franchise created. Employee and HOD logins are ready.');
          toast.error('The login email was not delivered. Check email settings and use Email Login to retry.');
        }
      }
      setFranchiseModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Could not save franchise.');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePlan = async (e: FormEvent) => {
    e.preventDefault();
    if (saving || !planFormData.name.trim()) return;

    setSaving(true);
    try {
      const payload = {
        name: planFormData.name.trim(),
        joining_fee: Number(planFormData.joining_fee || 0),
        recurring_fee: Number(planFormData.recurring_fee || 0),
        billing_frequency: planFormData.billing_frequency,
        description: planFormData.description.trim() || undefined,
        active: planFormData.active
      };

      if (editingPlan) {
        await franchiseService.updatePlan(editingPlan.id, payload);
        toast.success(`Plan "${payload.name}" updated successfully.`);
      } else {
        const created = await franchiseService.createPlan(payload);
        toast.success(`Plan "${created.name}" created successfully.`);
        setFormData(prev => ({ ...prev, plan: created.name }));
      }
      setPlanModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Could not save plan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFranchise = async () => {
    if (!deletingFranchise || saving) return;
    setSaving(true);
    try {
      await franchiseService.deleteFranchise(deletingFranchise.id);
      toast.success('Franchise record removed.');
      setDeletingFranchise(null);
      await loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Could not delete franchise.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!deletingPlan || saving) return;
    setSaving(true);
    try {
      await franchiseService.deletePlan(deletingPlan.id);
      toast.success(`Plan "${deletingPlan.name}" removed.`);
      setDeletingPlan(null);
      await loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Could not delete plan.');
    } finally {
      setSaving(false);
    }
  };

  const handleLoginAction = async (f: FranchiseRecord, action: 'setup' | 'email') => {
    if (loginBusy[f.id]) return;
    setLoginBusy(previous => ({ ...previous, [f.id]: action }));
    setLoginErrors(previous => { const next = { ...previous }; delete next[f.id]; return next; });
    try {
      if (action === 'setup') {
        await franchiseService.enableRoleLogins(f.id);
        toast.success(`${f.location}: Employee and HOD logins are ready.`);
      } else {
        const res = await franchiseService.resendCredentials(f.id);
        if (res.sent) toast.success(`Login instructions sent to ${res.email}`);
        else toast.error(`${f.location}: logins reset, but email was not delivered. Check mail settings.`);
      }
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Could not manage logins.';
      setLoginErrors(previous => ({ ...previous, [f.id]: message }));
      toast.error(`${f.location}: ${message}`);
    } finally {
      setLoginBusy(previous => { const next = { ...previous }; delete next[f.id]; return next; });
    }
  };

  const toggleProductSale = (prod: string) => {
    setFormData(prev => {
      const exists = prev.sales.includes(prod);
      return {
        ...prev,
        sales: exists ? prev.sales.filter(p => p !== prod) : [...prev.sales, prod]
      };
    });
  };

  const initials = (name: string) => {
    return (name || '')
      .split(' ')
      .map(x => x[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const filteredDirectory = useMemo(() => {
    if (!data?.directory) return [];
    if (!query.trim()) return data.directory;
    const term = query.trim().toLowerCase();
    return data.directory.filter(
      f =>
        f.name.toLowerCase().includes(term) ||
        f.location.toLowerCase().includes(term) ||
        f.plan.toLowerCase().includes(term) ||
        f.email.toLowerCase().includes(term) ||
        f.phone.toLowerCase().includes(term)
    );
  }, [data?.directory, query]);

  const filteredPlans = useMemo(() => {
    if (!data?.plans) return [];
    if (!planQuery.trim()) return data.plans;
    const term = planQuery.trim().toLowerCase();
    return data.plans.filter(
      p =>
        p.name.toLowerCase().includes(term) ||
        (p.description || '').toLowerCase().includes(term) ||
        (p.billing_frequency || '').toLowerCase().includes(term)
    );
  }, [data?.plans, planQuery]);

  const selectedPlanDetails = useMemo(() => {
    return data?.plans?.find(p => p.name.toLowerCase() === formData.plan.toLowerCase());
  }, [data?.plans, formData.plan]);

  const canManage = data?.access?.canManage ?? true;
  const canAddFranchise = Boolean(data?.access.canManage && data.access.role !== 'ceo');
  const canCreatePlans = data?.access?.canCreatePlans ?? true;

  const overviewCharts = useMemo(() => {
    const registrations = new Map<string, number>();
    const plans = new Map<string, number>();
    for (const franchise of data?.directory || []) {
      const date = franchise.registered_on || franchise.registered;
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const month = date.slice(0, 7);
        registrations.set(month, (registrations.get(month) || 0) + 1);
      }
      const plan = franchise.plan || 'Unassigned';
      plans.set(plan, (plans.get(plan) || 0) + 1);
    }
    return {
      products: (data?.overview.productSalesMix || []).map(item => ({ label: item.product, amount: item.count })),
      offices: (data?.overview.officeFootprint || []).map(item => ({ label: `${item.location} · ${item.name}`, amount: item.sqft })),
      registrations: [...registrations].sort(([a], [b]) => a.localeCompare(b)).map(([label, amount]) => ({ label, amount })),
      plans: [...plans].map(([label, amount]) => ({ label, amount })),
    };
  }, [data]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="fr-container">
          <div className="fr-empty">Loading franchise management system…</div>
        </div>
      </DashboardLayout>
    );
  }

  const overview = data?.overview;
  const kpis = overview?.kpis || { totalFranchises: 0, withOffice: 0, productsSold: 0, productTypesSold: 0 };
  const productsSummary = DEFAULT_PRODUCTS.map(p => {
    const sellers = (data?.directory || []).filter(f => (f.saleProducts || []).includes(p));
    return {
      product: p,
      sold: sellers.reduce((sum, f) => sum + (f.saleProducts || []).filter(product => product === p).length, 0),
      franchises: sellers.map(f => f.location).join(', ') || '—'
    };
  });

  if (data && (data.access.external || portalView)) return <FranchiseSalesPortal data={data} view={portalView || (dashboardView ? 'dashboard' : 'sales')} />;

  const maxJoiningFee = Math.max(0, ...(data?.plans || []).map(p => Number(p.joining_fee || 0)));

  return (
    <DashboardLayout>
      <div className="fr-container">
        <div className="fr-toolbar" style={{ justifyContent: 'flex-end', marginBottom: 12 }}><button className="mis-btn mis-btn-secondary" onClick={() => void loadData()}>Refresh sales data</button></div>
        {/* Navigation Tabs */}
        {!dashboardView && <div className="fr-nav-tabs" role="tablist">
          <button
            className={`fr-tab-btn ${tab === 'Franchises' ? 'active' : ''}`}
            onClick={() => setTab('Franchises')}
            role="tab"
            aria-selected={tab === 'Franchises'}
          >
            <span>◉</span> Franchises{' '}
            <b className="fr-tab-badge">{data?.directory?.length || 0}</b>
          </button>
          <button
            className={`fr-tab-btn ${tab === 'Products' ? 'active' : ''}`}
            onClick={() => setTab('Products')}
            role="tab"
            aria-selected={tab === 'Products'}
          >
            <span>▦</span> Products
          </button>
          <button
            className={`fr-tab-btn ${tab === 'Plans' ? 'active' : ''}`}
            onClick={() => setTab('Plans')}
            role="tab"
            aria-selected={tab === 'Plans'}
          >
            <span>☷</span> Plans{' '}
            <b className="fr-tab-badge">{data?.plans?.length || 0}</b>
          </button>
        </div>}

        {/* 1. OVERVIEW TAB */}
        {tab === 'Overview' && (
          <div>
            <div className="fr-header">
              <div>
                <div className="fr-eyebrow">FRANCHISE MANAGEMENT</div>
                <h1 className="fr-title">Franchise overview</h1>
                <p className="fr-subtitle">Sales, office footprint and product distribution at a glance.</p>
              </div>
              <div className="fr-header-actions">
                {canAddFranchise && (
                  <button className="mis-btn mis-btn-primary" onClick={openAddFranchise}>
                    ＋ Add franchise
                  </button>
                )}
              </div>
            </div>

            {/* 4 Metric Cards */}
            <div className="fr-metrics-grid">
              <div className="fr-metric-card blue">
                <div className="fr-metric-card-head">
                  <span>Total franchises</span>
                  <span>●</span>
                </div>
                <strong>{kpis.totalFranchises}</strong>
                <small>All registered franchise locations</small>
              </div>

              <div className="fr-metric-card">
                <div className="fr-metric-card-head">
                  <span>With office</span>
                  <span>●</span>
                </div>
                <strong>{kpis.withOffice}</strong>
                <small>Franchises with a physical office</small>
              </div>

              <div className="fr-metric-card dark">
                <div className="fr-metric-card-head">
                  <span>Products sold</span>
                  <span>●</span>
                </div>
                <strong>{kpis.productsSold}</strong>
                <small>Product sales recorded across franchises</small>
              </div>

              <div className="fr-metric-card blue">
                <div className="fr-metric-card-head">
                  <span>Product types sold</span>
                  <span>●</span>
                </div>
                <strong>{kpis.productTypesSold}</strong>
                <small>Distinct products with sales</small>
              </div>
            </div>

            <div className="fr-charts-grid">
              <FranchiseSalesChart title="Product sales mix" rows={overviewCharts.products} type="doughnut" valueLabel="Products sold" integer emptyMessage="No product sales recorded." />
              <FranchiseSalesChart title="Office footprint" rows={overviewCharts.offices} valueLabel="Office area (sq ft)" emptyMessage="No office details recorded." />
              <FranchiseSalesChart title="Monthly franchise registrations" rows={overviewCharts.registrations} type="bar" valueLabel="Franchises registered" integer emptyMessage="No registration dates recorded." />
              <FranchiseSalesChart title="Franchises by plan" rows={overviewCharts.plans} type="doughnut" valueLabel="Franchises" integer emptyMessage="No franchises registered." />
            </div>

            <section className="fr-panel mb-6"><div className="fr-panel-head"><h2>Total sales revenue</h2><p>₹{Number(kpis.saleRevenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} from {kpis.productsSold} saved product sales</p></div></section>

            {/* Top 4 Directory Preview */}
            <section className="fr-table-section">
              <div className="fr-table-toolbar">
                <div>
                  <h2 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 700 }}>
                    Franchise directory <span className="fr-count-badge">{data?.directory?.length || 0}</span>
                  </h2>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Location, plan, office details and product sales.
                  </p>
                </div>
                {canAddFranchise && (
                  <button className="mis-btn mis-btn-primary" onClick={openAddFranchise}>
                    ＋ Add franchise
                  </button>
                )}
              </div>

              <div className="fr-table-wrap">
                <table className="fr-table">
                  <thead>
                    <tr>
                      <th>FRANCHISE</th>
                      <th>LOCATION</th>
                      <th>PLAN</th>
                      <th>OFFICE</th>
                      <th>REGISTERED ON</th>
                      <th>PRODUCT SALES / REVENUE</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(overview?.directoryPreview || []).map(f => (
                      <tr key={f.id}>
                        <td>
                          <div className="fr-person">
                            <span className="fr-initials">{initials(f.name)}</span>
                            <div className="fr-person-info">
                              <strong>{f.name}</strong>
                              <small>{f.phone || f.email}</small>
                            </div>
                          </div>
                        </td>
                        <td>{f.location}</td>
                        <td>
                          <span className="fr-tag">{f.plan}</span>
                        </td>
                        <td>
                          <span className={`fr-office-tag ${f.office === 'Yes' ? 'yes' : 'no'}`}>
                            {f.office}
                            {f.office === 'Yes' ? ` · ${f.sqft} sq ft` : ''}
                          </span>
                        </td>
                        <td>{f.registered}</td>
                        <td>
                          <div className="fr-products-sold-summary">
                            <span className="fr-count-badge">{f.saleCount || 0}</span>
                            <small>₹{Number(f.saleRevenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</small>
                            <small style={{ color: 'var(--text-secondary)' }}>{[...new Set(f.saleProducts || [])].join(', ') || 'None'}</small>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="mis-btn mis-btn-secondary" onClick={() => openEditFranchise(f)}>
                              View / Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!overview?.directoryPreview?.length && (
                      <tr>
                        <td colSpan={7} className="fr-empty">
                          No franchise records available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="fr-table-foot">
                <span>{overview?.directoryPreview?.length || 0} preview franchises shown</span>
                <button
                  className="hover:underline text-xs font-semibold"
                  style={{ background: 'none', border: 'none', color: '#2474a6', cursor: 'pointer' }}
                  onClick={() => navigate(ROUTES.FRANCHISE_MANAGE)}
                >
                  View full directory →
                </button>
              </div>
            </section>
          </div>
        )}

        {/* 2. FRANCHISES DIRECTORY TAB */}
        {tab === 'Franchises' && (
          <div>
            <div className="fr-header">
              <div>
                <div className="fr-eyebrow">FRANCHISE MANAGEMENT</div>
                <h1 className="fr-title">Franchise directory</h1>
                <p className="fr-subtitle">Manage plans and office details; view actual customer sales.</p>
              </div>
              <div className="fr-header-actions">
                {canCreatePlans && (
                  <button className="mis-btn mis-btn-secondary" onClick={openCreatePlan}>
                    ＋ Create Plan
                  </button>
                )}
                {canAddFranchise && (
                  <button className="mis-btn mis-btn-primary" onClick={openAddFranchise}>
                    ＋ Add franchise
                  </button>
                )}
              </div>
            </div>

            <section className="fr-table-section">
              <div className="fr-table-toolbar">
                <div className="fr-search-box">
                  <span>⌕</span>
                  <input
                    placeholder="Search name, location or plan"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                  />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Total franchises: <b>{filteredDirectory.length}</b>
                </div>
              </div>

              <div className="fr-table-wrap">
                <table className="fr-table">
                  <thead>
                    <tr>
                      <th>FRANCHISE</th>
                      <th>LOCATION</th>
                      <th>PLAN</th>
                      <th>OFFICE</th>
                      <th>REGISTERED ON</th>
                      <th>PRODUCT SALES / REVENUE</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDirectory.map(f => (
                      <tr key={f.id}>
                        <td>
                          <div className="fr-person">
                            <span className="fr-initials">{initials(f.name)}</span>
                            <div className="fr-person-info">
                              <strong>{f.name}</strong>
                              <small>{f.phone || f.email}</small>
                            </div>
                          </div>
                        </td>
                        <td>{f.location}</td>
                        <td>
                          <span className="fr-tag">{f.plan}</span>
                        </td>
                        <td>
                          <span className={`fr-office-tag ${f.office === 'Yes' ? 'yes' : 'no'}`}>
                            {f.office}
                            {f.office === 'Yes' ? ` · ${f.sqft} sq ft` : ''}
                          </span>
                        </td>
                        <td>{f.registered}</td>
                        <td>
                          <div className="fr-products-sold-summary">
                            <span className="fr-count-badge">{f.saleCount || 0}</span>
                            <small>₹{Number(f.saleRevenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</small>
                            <small style={{ color: 'var(--text-secondary)', maxWidth: '280px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {[...new Set(f.saleProducts || [])].join(', ') || 'None'}
                            </small>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              className="mis-btn mis-btn-secondary"
                              onClick={() => openEditFranchise(f)}
                            >
                              Edit
                            </button>
                            {canManage && <>
                              <button className="mis-btn mis-btn-secondary" disabled={Boolean(loginBusy[f.id])} title="Create or reset Employee and HOD franchise logins" onClick={() => handleLoginAction(f, 'setup')}>
                                {loginBusy[f.id] === 'setup' ? <><span className="fr-login-spinner" aria-hidden="true"/>Setting up…</> : 'Set up logins'}
                              </button>
                              <button className="mis-btn mis-btn-secondary" disabled={Boolean(loginBusy[f.id])} title="Reset passwords and email login instructions" onClick={() => handleLoginAction(f, 'email')}>
                                {loginBusy[f.id] === 'email' ? <><span className="fr-login-spinner" aria-hidden="true"/>Sending…</> : 'Email Login'}
                              </button>
                            </>}
                            {data?.access?.canManageUsers && (
                              <button
                                className="mis-btn mis-btn-danger"
                                style={{ color: 'var(--danger-text)' }}
                                onClick={() => setDeletingFranchise(f)}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                          {loginErrors[f.id] && <p className="fr-row-login-error" role="alert">{loginErrors[f.id]}</p>}
                        </td>
                      </tr>
                    ))}
                    {!filteredDirectory.length && (
                      <tr>
                        <td colSpan={7} className="fr-empty">
                          No franchise records match your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="fr-table-foot">
                <span>{filteredDirectory.length} franchises shown</span>
                <span>Counts and revenue come from saved customer sales.</span>
              </div>
            </section>
          </div>
        )}

        {/* 3. PRODUCTS TAB */}
        {tab === 'Products' && (
          <div>
            <div className="fr-header">
              <div>
                <div className="fr-eyebrow">FRANCHISE MANAGEMENT</div>
                <h1 className="fr-title">Products sold</h1>
                <p className="fr-subtitle">See what each franchise has sold and the total count by product.</p>
              </div>
            </div>

            {/* Metrics */}
            <div className="fr-metrics-grid">
              <div className="fr-metric-card dark">
                <div className="fr-metric-card-head">
                  <span>Total products sold</span>
                  <span>●</span>
                </div>
                <strong>{kpis.productsSold}</strong>
                <small>All franchise sales recorded</small>
              </div>

              <div className="fr-metric-card blue">
                <div className="fr-metric-card-head">
                  <span>Trading & demat</span>
                  <span>●</span>
                </div>
                <strong>
                  {productsSummary.find(p => p.product === 'Trading & demat account')?.sold || 0}
                </strong>
                <small>Franchises selling Trading & demat</small>
              </div>

              <div className="fr-metric-card">
                <div className="fr-metric-card-head">
                  <span>Mutual fund</span>
                  <span>●</span>
                </div>
                <strong>{productsSummary.find(p => p.product === 'Mutual fund')?.sold || 0}</strong>
                <small>Franchises selling Mutual funds</small>
              </div>

              <div className="fr-metric-card blue">
                <div className="fr-metric-card-head">
                  <span>Course</span>
                  <span>●</span>
                </div>
                <strong>{productsSummary.find(p => p.product === 'Course')?.sold || 0}</strong>
                <small>Franchises selling Courses</small>
              </div>
            </div>

            {/* Summary Table */}
            <section className="fr-table-section">
              <div className="fr-panel-head">
                <h2>Product sale summary</h2>
                <p>A product sale is linked to the franchise that sold it.</p>
              </div>

              <div className="fr-table-wrap">
                <table className="fr-table">
                  <thead>
                    <tr>
                      <th>PRODUCT</th>
                      <th>SOLD</th>
                      <th>FRANCHISES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productsSummary.map(item => (
                      <tr key={item.product}>
                        <td>
                          <strong>{item.product}</strong>
                        </td>
                        <td>
                          <span className="fr-count-badge">{item.sold}</span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{item.franchises}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="fr-table-foot">
                <span>{kpis.productsSold} total product sales</span>
                <span>All listed products are available for sale.</span>
              </div>
            </section>
          </div>
        )}

        {/* 4. PLANS TAB */}
        {tab === 'Plans' && (
          <div>
            <div className="fr-header">
              <div>
                <div className="fr-eyebrow">FRANCHISE MANAGEMENT</div>
                <h1 className="fr-title">Franchise plans</h1>
                <p className="fr-subtitle">Manage franchise membership tiers, joining fees, recurring charges and billing cycles.</p>
              </div>
              <div className="fr-header-actions">
                {canCreatePlans && (
                  <button className="mis-btn mis-btn-primary" onClick={openCreatePlan}>
                    ＋ Create Plan
                  </button>
                )}
              </div>
            </div>

            {/* Plans Metrics */}
            <div className="fr-metrics-grid">
              <div className="fr-metric-card blue">
                <div className="fr-metric-card-head">
                  <span>Total plans</span>
                  <span>●</span>
                </div>
                <strong>{data?.plans?.length || 0}</strong>
                <small>Configured membership tiers</small>
              </div>

              <div className="fr-metric-card">
                <div className="fr-metric-card-head">
                  <span>Active plans</span>
                  <span>●</span>
                </div>
                <strong>{(data?.plans || []).filter(p => p.active !== false).length}</strong>
                <small>Available in registration form</small>
              </div>

              <div className="fr-metric-card dark">
                <div className="fr-metric-card-head">
                  <span>Enrolled franchises</span>
                  <span>●</span>
                </div>
                <strong>{data?.directory?.length || 0}</strong>
                <small>Franchises under active plans</small>
              </div>

              <div className="fr-metric-card blue">
                <div className="fr-metric-card-head">
                  <span>Highest tier fee</span>
                  <span>●</span>
                </div>
                <strong>₹{maxJoiningFee.toLocaleString('en-IN')}</strong>
                <small>Maximum joining fee</small>
              </div>
            </div>

            <section className="fr-table-section">
              <div className="fr-table-toolbar">
                <div className="fr-search-box">
                  <span>⌕</span>
                  <input
                    placeholder="Search plan name or description"
                    value={planQuery}
                    onChange={e => setPlanQuery(e.target.value)}
                  />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Plans: <b>{filteredPlans.length}</b>
                </div>
              </div>

              <div className="fr-table-wrap">
                <table className="fr-table">
                  <thead>
                    <tr>
                      <th>PLAN NAME</th>
                      <th>DESCRIPTION</th>
                      <th>JOINING FEE</th>
                      <th>RECURRING FEE</th>
                      <th>BILLING CYCLE</th>
                      <th>ENROLLED</th>
                      <th>STATUS</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlans.map(p => (
                      <tr key={p.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="fr-tag gold" style={{ fontWeight: 700 }}>
                              {p.name}
                            </span>
                          </div>
                        </td>
                        <td style={{ maxWidth: '280px', whiteSpace: 'normal', color: 'var(--text-secondary)' }}>
                          {p.description || '—'}
                        </td>
                        <td>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            ₹{Number(p.joining_fee || 0).toLocaleString('en-IN')}
                          </strong>
                        </td>
                        <td>
                          {Number(p.recurring_fee || 0) > 0 ? (
                            <span>₹{Number(p.recurring_fee).toLocaleString('en-IN')}</span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>None</span>
                          )}
                        </td>
                        <td>
                          <span className="fr-tag dark">{p.billing_frequency || 'None'}</span>
                        </td>
                        <td>
                          <span className="fr-count-badge">{p.franchisesCount || 0}</span>
                        </td>
                        <td>
                          <span className={`fr-office-tag ${p.active !== false ? 'yes' : 'no'}`}>
                            {p.active !== false ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {canCreatePlans && (
                              <button
                                className="mis-btn mis-btn-secondary"
                                onClick={() => openEditPlan(p)}
                              >
                                Edit
                              </button>
                            )}
                            {canCreatePlans && (
                              <button
                                className="mis-btn mis-btn-danger"
                                style={{ color: 'var(--danger-text)' }}
                                onClick={() => setDeletingPlan(p)}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!filteredPlans.length && (
                      <tr>
                        <td colSpan={8} className="fr-empty">
                          No plans found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="fr-table-foot">
                <span>{filteredPlans.length} plans shown</span>
                <span>All active plans are selectable in the franchise registration form.</span>
              </div>
            </section>
          </div>
        )}

        {/* ADD / EDIT FRANCHISE MODAL */}
        {franchiseModalOpen && (
          <div className="fr-modal-overlay">
            <div className="fr-modal-dialog">
              <div className="fr-modal-head">
                <div>
                  <div className="fr-eyebrow">FRANCHISE MANAGEMENT</div>
                  <h2>{editingFranchise ? 'Edit franchise' : 'Add franchise'}</h2>
                </div>
                <button
                  type="button"
                  className="fr-close-btn"
                  onClick={() => setFranchiseModalOpen(false)}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSaveFranchise} className="fr-form">
                <div className="fr-form-grid">
                  <div className="fr-form-group">
                    <label>Franchise location *</label>
                    <input
                      required
                      placeholder="e.g. Mumbai"
                      value={formData.location}
                      onChange={e => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>

                  <div className="fr-form-group">
                    <label>Name (Owner / Contact Person) *</label>
                    <input
                      required
                      placeholder="e.g. Aarav Shah"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="fr-form-group">
                    <label>Phone *</label>
                    <input
                      required
                      placeholder="e.g. 9876543210"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>

                  <div className="fr-form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. aarav@example.com"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div className="fr-form-group">
                    <label>Plan *</label>
                    <div className="fr-plan-row">
                      <select
                        value={formData.plan}
                        onChange={e => setFormData({ ...formData, plan: e.target.value })}
                      >
                        {(data?.plans || []).map(p => (
                          <option key={p.id} value={p.name}>
                            {p.name} {Number(p.joining_fee || 0) > 0 ? `(₹${Number(p.joining_fee).toLocaleString('en-IN')})` : ''}
                          </option>
                        ))}
                      </select>
                      {canCreatePlans && (
                        <button
                          type="button"
                          className="mis-btn mis-btn-secondary"
                          style={{ padding: '8px 12px', fontSize: '12px' }}
                          onClick={openCreatePlan}
                        >
                          ＋ New
                        </button>
                      )}
                    </div>
                    {selectedPlanDetails && (
                      <small style={{ color: '#2474a6', marginTop: '2px', fontSize: '11px' }}>
                        Joining Fee: ₹{Number(selectedPlanDetails.joining_fee || 0).toLocaleString('en-IN')}
                        {Number(selectedPlanDetails.recurring_fee || 0) > 0
                          ? ` · Recurring: ₹${Number(selectedPlanDetails.recurring_fee).toLocaleString('en-IN')} / ${selectedPlanDetails.billing_frequency}`
                          : ''}
                      </small>
                    )}
                  </div>

                  <div className="fr-form-group">
                    <label>Has office?</label>
                    <select
                      value={formData.office}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          office: e.target.value,
                          sqft: e.target.value === 'No' ? '' : formData.sqft || '750'
                        })
                      }
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>

                  <div className="fr-form-group">
                    <label>Office area (sq ft)</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 750"
                      disabled={formData.office === 'No'}
                      value={formData.sqft}
                      onChange={e => setFormData({ ...formData, sqft: e.target.value })}
                    />
                  </div>

                  <div className="fr-form-group">
                    <label>Registered on *</label>
                    <input
                      type="date"
                      required
                      value={formData.registered}
                      onChange={e => setFormData({ ...formData, registered: e.target.value })}
                    />
                  </div>

                  <div className="fr-form-group full-width">
                    <label style={{ marginBottom: '8px' }}>AVAILABLE PRODUCTS</label>
                    <div className="fr-products-grid">
                      {DEFAULT_PRODUCTS.map(p => (
                        <label key={p} className="fr-product-checkbox">
                          <input
                            type="checkbox"
                            checked={formData.sales.includes(p)}
                            onChange={() => toggleProductSale(p)}
                          />
                          <span>{p}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="fr-modal-foot">
                  <small>
                    {!editingFranchise
                      ? 'Credentials (password123) will be sent to the franchise email.'
                      : 'Changes will be saved immediately to the system.'}
                  </small>
                  <div className="fr-modal-actions">
                    <button
                      type="button"
                      className="mis-btn mis-btn-secondary"
                      onClick={() => setFranchiseModalOpen(false)}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="mis-btn mis-btn-primary" disabled={saving}>
                      {saving ? 'Saving…' : 'Save franchise'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CREATE / EDIT PLAN MODAL */}
        {planModalOpen && (
          <div className="fr-modal-overlay">
            <div className="fr-modal-dialog" style={{ width: '540px' }}>
              <div className="fr-modal-head">
                <div>
                  <div className="fr-eyebrow">PLAN MANAGEMENT</div>
                  <h2>{editingPlan ? 'Edit Franchise Plan' : 'Create New Plan'}</h2>
                </div>
                <button
                  type="button"
                  className="fr-close-btn"
                  onClick={() => setPlanModalOpen(false)}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSavePlan} className="fr-form">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
                  <div className="fr-form-group">
                    <label>Plan Name *</label>
                    <input
                      required
                      placeholder="e.g. Starter, Growth, Premier, Enterprise"
                      value={planFormData.name}
                      onChange={e => setPlanFormData({ ...planFormData, name: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div className="fr-form-group">
                      <label>Joining Fee (₹) *</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g. 50000"
                        value={planFormData.joining_fee}
                        onChange={e => setPlanFormData({ ...planFormData, joining_fee: e.target.value })}
                      />
                      <small style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>One-time joining fee</small>
                    </div>

                    <div className="fr-form-group">
                      <label>Recurring Fee (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g. 5000"
                        value={planFormData.recurring_fee}
                        onChange={e => setPlanFormData({ ...planFormData, recurring_fee: e.target.value })}
                      />
                      <small style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Periodic royalty/fee</small>
                    </div>
                  </div>

                  <div className="fr-form-group">
                    <label>Billing Frequency</label>
                    <select
                      value={planFormData.billing_frequency}
                      onChange={e => setPlanFormData({ ...planFormData, billing_frequency: e.target.value as any })}
                    >
                      <option value="None">None (No recurring fee)</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </div>

                  <div className="fr-form-group">
                    <label>Description (Optional)</label>
                    <textarea
                      rows={3}
                      placeholder="Brief summary of what this plan includes"
                      value={planFormData.description}
                      onChange={e => setPlanFormData({ ...planFormData, description: e.target.value })}
                    />
                  </div>

                  <label className="fr-product-checkbox" style={{ marginTop: '4px' }}>
                    <input
                      type="checkbox"
                      checked={planFormData.active}
                      onChange={e => setPlanFormData({ ...planFormData, active: e.target.checked })}
                    />
                    <span>Active Plan (Available for selection in franchise form)</span>
                  </label>
                </div>

                <div className="fr-modal-foot">
                  <small>This plan will immediately appear in the franchise form.</small>
                  <div className="fr-modal-actions">
                    <button
                      type="button"
                      className="mis-btn mis-btn-secondary"
                      onClick={() => setPlanModalOpen(false)}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="mis-btn mis-btn-primary" disabled={saving}>
                      {saving ? 'Saving…' : editingPlan ? 'Save Changes' : 'Create Plan'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DELETE FRANCHISE CONFIRMATION MODAL */}
        {deletingFranchise && (
          <div className="fr-modal-overlay">
            <div className="fr-modal-dialog" style={{ width: '480px' }}>
              <div className="fr-modal-head">
                <h2>Delete franchise?</h2>
                <button
                  type="button"
                  className="fr-close-btn"
                  onClick={() => setDeletingFranchise(null)}
                >
                  ×
                </button>
              </div>
              <div style={{ padding: '20px 28px' }}>
                <p style={{ margin: '0 0 12px', fontSize: '14px', color: 'var(--text-primary)' }}>
                  Are you sure you want to permanently delete <strong>{deletingFranchise.name}</strong> ({deletingFranchise.location})?
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                  This will remove the franchise record and its linked user access.
                </p>
              </div>
              <div className="fr-modal-foot">
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className="mis-btn mis-btn-secondary"
                    onClick={() => setDeletingFranchise(null)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="mis-btn mis-btn-danger"
                    style={{ background: '#ef4444', color: '#fff', border: 'none' }}
                    onClick={handleDeleteFranchise}
                    disabled={saving}
                  >
                    {saving ? 'Deleting…' : 'Confirm Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DELETE PLAN CONFIRMATION MODAL */}
        {deletingPlan && (
          <div className="fr-modal-overlay">
            <div className="fr-modal-dialog" style={{ width: '480px' }}>
              <div className="fr-modal-head">
                <h2>Delete plan?</h2>
                <button
                  type="button"
                  className="fr-close-btn"
                  onClick={() => setDeletingPlan(null)}
                >
                  ×
                </button>
              </div>
              <div style={{ padding: '20px 28px' }}>
                <p style={{ margin: '0 0 12px', fontSize: '14px', color: 'var(--text-primary)' }}>
                  Are you sure you want to delete the plan <strong>{deletingPlan.name}</strong>?
                </p>
                {Number(deletingPlan.franchisesCount || 0) > 0 && (
                  <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#ef4444', fontWeight: 600 }}>
                    Warning: {deletingPlan.franchisesCount} franchise(s) are currently assigned to this plan.
                  </p>
                )}
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                  This action will remove the plan configuration from the database.
                </p>
              </div>
              <div className="fr-modal-foot">
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className="mis-btn mis-btn-secondary"
                    onClick={() => setDeletingPlan(null)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="mis-btn mis-btn-danger"
                    style={{ background: '#ef4444', color: '#fff', border: 'none' }}
                    onClick={handleDeletePlan}
                    disabled={saving}
                  >
                    {saving ? 'Deleting…' : 'Confirm Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
