import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { franchiseService } from '../../services/franchise.service';
import type { FranchiseBootstrap, FranchiseSale } from '../../services/franchise.service';

export default function FranchiseSaleDialog({ data, onSaved, onClose }: {
  data: FranchiseBootstrap; onSaved: (sales: FranchiseSale[]) => void; onClose: () => void;
}) {
  const [branch, setBranch] = useState(data.directory[0]?.id || '');
  const [customer, setCustomer] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [issues, setIssues] = useState<Record<string, string>>({});
  const selected = data.products.filter(product => Object.hasOwn(amounts, product));
  const total = selected.reduce((sum, product) => sum + Math.round((Number(amounts[product]) || 0) * 100), 0) / 100;
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
      if (event.key === 'Tab') {
        const controls = Array.from(document.querySelectorAll<HTMLElement>('.fr-sale-dialog button:not(:disabled), .fr-sale-dialog input:not(:disabled), .fr-sale-dialog select:not(:disabled)'));
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', keyboard); };
  }, [saving, onClose]);

  return createPortal(<div className="fr-sale-overlay"><section className="fr-panel fr-sale-dialog" role="dialog" aria-modal="true" aria-labelledby="fr-sale-title">
    <div className="fr-panel-head"><h2 id="fr-sale-title">Add product sales</h2><button className="mis-btn mis-btn-secondary" aria-label="Close" disabled={saving} onClick={onClose}><X size={18}/></button></div>
    <form className="fr-form" onSubmit={async event => {
      event.preventDefault();
      if (saving || !selected.length) return;
      if (!customer.trim()) { toast.error('Enter the customer name.'); return; }
      setSaving(true); setIssues({});
      try {
        const result = await franchiseService.bulkCreateSales(selected.map(product => ({ franchise_id: branch, customer_name: customer.trim(), sale_date: date, product, amount: Number(amounts[product]) })));
        onSaved(result.sales);
        if (result.failed.length) {
          const failures = new Map(result.failed.map(failure => [selected[failure.row - 2], failure.error]));
          // Keep only unsuccessful products selected so retrying cannot repeat confirmed sales.
          setAmounts(Object.fromEntries(selected.filter(product => failures.has(product)).map(product => [product, amounts[product]])));
          setIssues(Object.fromEntries(failures));
          toast.error(`${result.inserted} saved; ${result.failed.length} products need review.`);
        } else { toast.success(`${result.inserted} product sales saved.`); onClose(); }
      } catch (error: any) { toast.error(error.response?.data?.message || 'Save was not confirmed. Check sales history before retrying.'); }
      finally { setSaving(false); }
    }}><fieldset disabled={saving} className="fr-sale-fields"><div className="fr-form-grid">
      <div className="fr-form-group"><label htmlFor="sale-branch">Franchise branch</label><select id="sale-branch" required value={branch} onChange={event => setBranch(event.target.value)}>{data.directory.map(row => <option key={row.id} value={row.id}>{row.location} · {row.name}</option>)}</select></div>
      <div className="fr-form-group"><label htmlFor="sale-name">Customer name</label><input id="sale-name" autoFocus required maxLength={255} value={customer} onChange={event => setCustomer(event.target.value)}/></div>
      <div className="fr-form-group"><label htmlFor="sale-date">Sale date</label><input id="sale-date" required type="date" value={date} onChange={event => setDate(event.target.value)}/></div>
    </div>
    <fieldset className="fr-product-choices"><legend>Products purchased</legend><p>Select each product and enter its amount.</p><div className="fr-product-choice-grid">{data.products.map((product, index) => {
      const checked = Object.hasOwn(amounts, product);
      return <div key={product} className={`fr-product-choice${checked ? ' selected' : ''}`}>
        <label className="fr-product-check"><input type="checkbox" checked={checked} onChange={event => {
          const enabled = event.target.checked;
          setAmounts(previous => { const next = { ...previous }; if (enabled) next[product] = ''; else delete next[product]; return next; });
          setIssues(previous => { const next = { ...previous }; delete next[product]; return next; });
        }}/><span>{product}</span></label>
        {checked && <div className="fr-form-group"><label htmlFor={`sale-amount-${index}`}>Amount for {product} (₹)</label><input id={`sale-amount-${index}`} required type="number" min="0" max="999999999999.99" step="0.01" placeholder="Enter amount" value={amounts[product]} onChange={event => setAmounts(previous => ({ ...previous, [product]: event.target.value }))}/></div>}
        {issues[product] && <p role="alert" className="fr-report-error">{issues[product]}</p>}
      </div>;
    })}</div></fieldset>
    <div className="fr-sale-total" aria-live="polite">{selected.length} products selected · Total: <strong>₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></div>
    <div className="fr-toolbar"><button type="button" className="mis-btn mis-btn-secondary" onClick={onClose}>Cancel</button><button type="submit" disabled={!selected.length || !branch} className="mis-btn mis-btn-primary">{saving ? <><Loader2 size={16} className="animate-spin"/>Saving {selected.length} products…</> : 'Save product sales'}</button></div>
    </fieldset></form>
  </section></div>, document.body);
}
