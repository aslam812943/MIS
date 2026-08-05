import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { format } from 'date-fns';
import DashboardLayout from '../../components/layout/DashboardLayout';
import ConfirmModal from '../../components/common/ConfirmModal';
import ViewDetailsModal from '../../components/common/ViewDetailsModal';
import { INITIAL_CONFIRM_STATE, type ConfirmDialogState } from '../../types/confirm.types';
import { salesService, PRODUCT_TYPES, SALE_STATUSES, type Sale, type ProductType, type SaleStatus } from '../../services/sales.service';

const SALES_HELP = {
  why: 'Every product sold to a client — trading/demat accounts, mutual funds, unlisted shares, child accounts, IEPF-related services, or SW Global — gets logged here, so the business can see overall sales performance and exactly which products are actually moving.',
  fields: [
    { label: 'Client Name', note: 'The customer this sale was made to.' },
    { label: 'Client Contact', note: '10-digit mobile number, for follow-up.' },
    { label: 'Product Type', note: 'Which product this sale is for — this is what drives the product-wise breakdown on the dashboard.' },
    { label: 'Sale Value', note: 'The value of this sale in rupees — only Completed sales count toward dashboard revenue totals.' },
    { label: 'Units', note: 'Optional — relevant for Mutual Fund/Unlisted Shares, not for account-opening products.' },
    { label: 'Status', note: 'Pending = in progress, not yet counted. Completed = closed and counted in totals. Cancelled = didn\'t go through.' },
  ],
  remember: 'Only mark a sale "Completed" once it has actually gone through — the dashboard\'s revenue totals and product-wise breakdown are built entirely from Completed sales.',
};

const INITIAL_FORM_STATE = {
  client_name: '',
  client_contact: '',
  product_type: 'Trading and Demat' as ProductType,
  sale_value: 0,
  units: '',
  sale_date: format(new Date(), 'yyyy-MM-dd'),
  status: 'Pending' as SaleStatus,
  remarks: '',
};

const statusBadgeClass = (s: string) => {
  if (s === 'Completed') return 'mis-badge mis-badge-success';
  if (s === 'Cancelled') return 'mis-badge mis-badge-danger';
  return 'mis-badge mis-badge-neutral';
};

const errMsg = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error) && error.response?.data?.message) return error.response.data.message;
  if (error instanceof Error) return error.message;
  return fallback;
};

const SalesDataEntryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'register' | 'list'>('register');
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [confirmModal, setConfirmModal] = useState<ConfirmDialogState>(INITIAL_CONFIRM_STATE);

  useEffect(() => {
    if (activeTab === 'list') fetchSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchSales = async () => {
    setFetching(true);
    try {
      const data = await salesService.getSales({ status: statusFilter || undefined, search: searchTerm || undefined });
      setSales(data);
    } catch (err) {
      toast.error(errMsg(err, 'Failed to load sales.'));
    } finally {
      setFetching(false);
    }
  };

  const resetForm = () => {
    setFormData(INITIAL_FORM_STATE);
    setEditingId(null);
  };

  const validate = (): string | null => {
    if (!formData.client_name.trim()) return 'Client Name is required.';
    if (formData.client_contact && !/^\d{10}$/.test(formData.client_contact.trim())) return 'Client contact must be exactly 10 digits.';
    if (!formData.sale_date) return 'Sale Date is required.';
    if (Number(formData.sale_value) < 0) return 'Sale value cannot be negative.';
    if (formData.units && Number(formData.units) < 0) return 'Units cannot be negative.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setLoading(true);
    const toastId = toast.loading(editingId ? 'Updating sale...' : 'Logging sale...');
    try {
      const payload = {
        client_name: formData.client_name.trim(),
        client_contact: formData.client_contact.trim() || undefined,
        product_type: formData.product_type,
        sale_value: Number(formData.sale_value) || 0,
        units: formData.units ? Number(formData.units) : undefined,
        sale_date: formData.sale_date,
        status: formData.status,
        remarks: formData.remarks.trim() || undefined,
      };

      if (editingId) {
        await salesService.updateSale(editingId, payload);
        toast.success('Sale updated.', { id: toastId });
      } else {
        await salesService.createSale(payload);
        toast.success('Sale logged successfully.', { id: toastId });
      }
      resetForm();
      setActiveTab('list');
    } catch (err) {
      toast.error(errMsg(err, 'Failed to save sale.'), { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (sale: Sale) => {
    setEditingId(sale.id);
    setFormData({
      client_name: sale.client_name,
      client_contact: sale.client_contact || '',
      product_type: sale.product_type,
      sale_value: sale.sale_value,
      units: sale.units != null ? String(sale.units) : '',
      sale_date: sale.sale_date,
      status: sale.status,
      remarks: sale.remarks || '',
    });
    setActiveTab('register');
    toast.success('Loaded sale for editing.');
  };

  const handleDelete = (sale: Sale) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Sale Record',
      message: `Permanently delete the sale to "${sale.client_name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      isDanger: true,
      onConfirm: async () => {
        setConfirmModal(INITIAL_CONFIRM_STATE);
        const toastId = toast.loading('Deleting...');
        try {
          await salesService.deleteSale(sale.id);
          toast.success('Sale deleted.', { id: toastId });
          fetchSales();
        } catch (err) {
          toast.error(errMsg(err, 'Delete failed.'), { id: toastId });
        }
      },
    });
  };

  const handleCancelEdit = () => {
    resetForm();
    setActiveTab('list');
  };

  const renderHelpPanel = () => (
    <div className="border rounded-xl p-5 shadow-xs space-y-4 lg:sticky lg:top-4" style={{ background: 'var(--panel-inset-soft)', borderColor: 'var(--border)' }}>
      <div>
        <h3 className="text-sm font-bold flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--text-primary)' }}>💡 Why this page exists</h3>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{SALES_HELP.why}</p>
      </div>
      <hr style={{ borderColor: 'var(--border)' }} />
      <div>
        <h3 className="text-sm font-bold mb-2.5" style={{ color: 'var(--text-primary)' }}>📖 What each field means</h3>
        <div className="space-y-3">
          {SALES_HELP.fields.map((f) => (
            <div key={f.label}>
              <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{f.label}</div>
              <div className="text-[11px] leading-relaxed mt-0.5" style={{ color: 'var(--text-secondary)' }}>{f.note}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="p-3 rounded-lg border-l-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--accent)' }}>
        <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--accent)' }}>⚠️ Remember</div>
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{SALES_HELP.remember}</p>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-5xl mx-auto">
        <header className="mis-page-header-row mb-6">
          <div className="mis-page-header" style={{ marginBottom: 0 }}>
            <h1 className="mis-page-title">Sales</h1>
            <p className="mis-page-desc">Log client sales and track them through to completion.</p>
          </div>
          <div className="mis-tabs">
            <button type="button" className={`mis-tab ${activeTab === 'register' ? 'active' : ''}`} onClick={() => setActiveTab('register')}>
              {editingId ? '✏️ Edit Sale' : 'Log Sale'}
            </button>
            <button type="button" className={`mis-tab ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>
              Search & View database
            </button>
          </div>
        </header>

        {activeTab === 'register' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 mis-card p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="mis-field">
                    <label className="mis-label">Client Name *</label>
                    <input className="mis-input" value={formData.client_name} onChange={(e) => setFormData({ ...formData, client_name: e.target.value })} placeholder="e.g. Ravi Kumar" />
                  </div>
                  <div className="mis-field">
                    <label className="mis-label">Client Contact</label>
                    <input className="mis-input" value={formData.client_contact} onChange={(e) => setFormData({ ...formData, client_contact: e.target.value })} placeholder="10 digit mobile" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="mis-field">
                    <label className="mis-label">Product Type *</label>
                    <select className="mis-select" value={formData.product_type} onChange={(e) => setFormData({ ...formData, product_type: e.target.value as ProductType })}>
                      {PRODUCT_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="mis-field">
                    <label className="mis-label">Sale Date *</label>
                    <input type="date" className="mis-input" value={formData.sale_date} onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="mis-field">
                    <label className="mis-label">Sale Value (₹)</label>
                    <input type="number" min="0" step="0.01" className="mis-input" value={formData.sale_value} onChange={(e) => setFormData({ ...formData, sale_value: Number(e.target.value) })} />
                  </div>
                  <div className="mis-field">
                    <label className="mis-label">Units</label>
                    <input type="number" min="0" step="0.01" className="mis-input" value={formData.units} onChange={(e) => setFormData({ ...formData, units: e.target.value })} placeholder="Optional" />
                  </div>
                </div>

                <div className="mis-field">
                  <label className="mis-label">Status</label>
                  <select className="mis-select" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as SaleStatus })}>
                    {SALE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="mis-field">
                  <label className="mis-label">Remarks</label>
                  <textarea className="mis-input" rows={3} value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} placeholder="Any additional notes" />
                </div>

                <div className="flex gap-3 pt-2">
                  {editingId && (
                    <button type="button" onClick={handleCancelEdit} className="mis-btn mis-btn-ghost flex-1 justify-center">Cancel</button>
                  )}
                  <button type="submit" disabled={loading} className="mis-btn mis-btn-primary flex-[2] justify-center">
                    {loading ? 'Saving...' : editingId ? 'Save Changes' : 'Log Sale'}
                  </button>
                </div>
              </form>
            </div>
            {renderHelpPanel()}
          </div>
        )}

        {activeTab === 'list' && (
          <div className="mis-card overflow-hidden">
            <div className="p-4 flex flex-col sm:flex-row gap-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <input
                className="mis-input flex-1 text-sm"
                placeholder="Search by client name or contact..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchSales()}
              />
              <select className="mis-select text-xs w-full sm:w-40 shrink-0" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); }}>
                <option value="">All Statuses</option>
                {SALE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button type="button" className="mis-btn mis-btn-primary shrink-0" onClick={fetchSales}>Search</button>
            </div>

            <div className="overflow-x-auto">
              <table className="mis-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Product</th>
                    <th>Sale Value</th>
                    <th>Status</th>
                    <th>Sale Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fetching ? (
                    <tr><td colSpan={6} className="mis-empty">Loading sales...</td></tr>
                  ) : sales.length === 0 ? (
                    <tr><td colSpan={6} className="mis-empty">No sales found.</td></tr>
                  ) : (
                    sales.map((s) => (
                      <tr key={s.id}>
                        <td className="font-semibold" style={{ color: 'var(--text-primary)' }}>{s.client_name}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{s.product_type}</td>
                        <td style={{ color: 'var(--text-primary)' }}>₹{Number(s.sale_value).toLocaleString('en-IN')}</td>
                        <td><span className={statusBadgeClass(s.status)}>{s.status}</span></td>
                        <td style={{ color: 'var(--text-secondary)' }}>{new Date(s.sale_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td>
                          <div className="flex gap-2">
                            <button type="button" className="hover:underline text-xs font-bold" style={{ color: 'var(--text-secondary)' }} onClick={() => setViewingRecord(s)}>View</button>
                            <button type="button" className="hover:underline text-xs font-bold" style={{ color: 'var(--accent)' }} onClick={() => handleEdit(s)}>Edit</button>
                            <button type="button" className="hover:underline text-xs font-bold" style={{ color: '#ef4444' }} onClick={() => handleDelete(s)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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
      <ViewDetailsModal record={viewingRecord} onClose={() => setViewingRecord(null)} title="Sale Details" />
    </DashboardLayout>
  );
};

export default SalesDataEntryPage;
