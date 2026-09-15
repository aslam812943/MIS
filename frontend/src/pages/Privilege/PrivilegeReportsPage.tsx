import React, { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';
import { Download, FileBarChart, Filter, Printer, RefreshCw, Search, TrendingUp, Users, Wallet } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { privilegeService } from '../../services/privilege.service';
import type { PrivilegeAccount } from '../../types/privilege.types';

type Filters = {
  search: string; from: string; to: string; branch: string; rm: string; dealer: string;
  scheme: string; trading: string; location: string; occupation: string; minAum: string; maxAum: string;
};

const EMPTY_FILTERS: Filters = { search: '', from: '', to: '', branch: '', rm: '', dealer: '', scheme: '', trading: '', location: '', occupation: '', minAum: '', maxAum: '' };
const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const unique = (accounts: PrivilegeAccount[], key: keyof PrivilegeAccount) => [...new Set(accounts.map(a => String(a[key] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
const ranking = (accounts: PrivilegeAccount[], key: keyof PrivilegeAccount) => {
  const groups = new Map<string, { count: number; aum: number; utilised: number }>();
  accounts.forEach(account => {
    const name = String(account[key] || '').trim() || 'Not assigned';
    const current = groups.get(name) || { count: 0, aum: 0, utilised: 0 };
    current.count += 1; current.aum += Number(account.aum || 0); current.utilised += Number(account.utilised || 0);
    groups.set(name, current);
  });
  return [...groups.entries()].map(([name, values]) => ({ name, ...values })).sort((a, b) => b.count - a.count || b.aum - a.aum);
};

const PrivilegeReportsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<PrivilegeAccount[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { setLoading(true); setAccounts(await privilegeService.getAccounts()); }
    catch (error: any) { toast.error(error?.response?.data?.error || 'Unable to load Privilege report data.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const options = useMemo(() => ({
    branch: unique(accounts, 'branch'), rm: unique(accounts, 'rm'), dealer: unique(accounts, 'dealer'),
    scheme: unique(accounts, 'scheme'), location: unique(accounts, 'location'), occupation: unique(accounts, 'occupation')
  }), [accounts]);

  const filtered = useMemo(() => accounts.filter(a => {
    const searchText = [a.code, a.name, a.mobile_no, a.contact, a.stocks, a.remarks, a.introducer].join(' ').toLowerCase();
    return (!filters.search || searchText.includes(filters.search.toLowerCase()))
      && (!filters.from || a.account_date >= filters.from) && (!filters.to || a.account_date <= filters.to)
      && (!filters.branch || a.branch === filters.branch) && (!filters.rm || a.rm === filters.rm)
      && (!filters.dealer || a.dealer === filters.dealer) && (!filters.scheme || a.scheme === filters.scheme)
      && (!filters.location || a.location === filters.location) && (!filters.occupation || a.occupation === filters.occupation)
      && (!filters.trading || String(a.trading_started) === filters.trading)
      && (!filters.minAum || Number(a.aum) >= Number(filters.minAum))
      && (!filters.maxAum || Number(a.aum) <= Number(filters.maxAum));
  }), [accounts, filters]);

  const totalAum = filtered.reduce((sum, a) => sum + Number(a.aum || 0), 0);
  const totalUsed = filtered.reduce((sum, a) => sum + Number(a.utilised || 0), 0);
  const rmRanking = useMemo(() => ranking(filtered, 'rm'), [filtered]);
  const dealerRanking = useMemo(() => ranking(filtered, 'dealer'), [filtered]);
  const branchRanking = useMemo(() => ranking(filtered, 'branch'), [filtered]);
  const schemeRanking = useMemo(() => ranking(filtered, 'scheme'), [filtered]);
  const set = (key: keyof Filters, value: string) => setFilters(previous => ({ ...previous, [key]: value }));

  const downloadPdf = () => {
    if (!filtered.length) return toast.error('No clients match the selected filters.');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(17); doc.text('Privilege Detailed Client Report', 12, 13);
    doc.setFontSize(9); doc.text(`Generated ${new Date().toLocaleString('en-IN')} | Clients: ${filtered.length} | AUM: ${money(totalAum)} | Utilised: ${money(totalUsed)}`, 12, 20);
    autoTable(doc, { startY: 26, head: [['RM', 'Clients', 'AUM', 'Utilised']], body: rmRanking.map(x => [x.name, x.count, money(x.aum), money(x.utilised)]), theme: 'grid', styles: { fontSize: 7 }, tableWidth: 125 });
    autoTable(doc, { startY: (doc as any).lastAutoTable.finalY + 7, head: [['Sl', 'Code', 'Client', 'Date', 'Mobile', 'Scheme', 'RM', 'Dealer', 'Branch', 'Location', 'Occupation', 'Trading', 'AUM', 'Utilised', 'Returns', 'Stocks']], body: filtered.map(a => [a.sl_no, a.code, a.name, a.account_date, a.mobile_no, a.scheme, a.rm, a.dealer, a.branch, a.location, a.occupation, a.trading_started ? 'Yes' : 'No', money(a.aum), money(a.utilised), a.returns, a.stocks]), theme: 'striped', styles: { fontSize: 5.5, cellPadding: 1.2 }, headStyles: { fillColor: [13, 148, 136] } });
    doc.save(`privilege-detailed-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success(`PDF generated with ${filtered.length} clients`);
  };

  const RankCard = ({ title, rows }: { title: string; rows: ReturnType<typeof ranking> }) => (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
      <div className="p-4 border-b border-[var(--border)]"><h2 className="font-bold text-[var(--text-primary)]">{title}</h2><p className="text-xs text-[var(--text-muted)]">Ranked by number of filtered clients</p></div>
      <div className="max-h-64 overflow-auto divide-y divide-[var(--border)]">
        {rows.map((row, index) => <div key={row.name} className="p-3 flex items-center gap-3"><span className="relative block w-8 h-8 shrink-0 rounded-full bg-[var(--accent-bg)] text-[var(--accent)]"><span className="absolute inset-0 flex items-center justify-center text-center text-xs font-black leading-none tabular-nums">{index + 1}</span></span><div className="min-w-0 flex-1"><div className="text-sm font-semibold text-[var(--text-primary)] truncate">{row.name}</div><div className="text-xs text-[var(--text-muted)]">AUM {money(row.aum)}</div></div><span className="text-lg font-black text-[var(--accent)]">{row.count}</span></div>)}
        {!rows.length && <div className="p-6 text-center text-xs text-[var(--text-muted)]">No matching data</div>}
      </div>
    </div>
  );

  return <DashboardLayout>
    <style>{`@media print { aside, header, .report-actions, .report-filters { display:none!important } main { margin:0!important } .report-page { padding:0!important } .report-table { overflow:visible!important } }`}</style>
    <div className="report-page max-w-[1700px] mx-auto p-4 sm:p-6 space-y-5">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 flex flex-wrap items-center gap-4">
        <div className="p-3 rounded-xl bg-[var(--accent-bg)] text-[var(--accent)]"><FileBarChart className="w-6 h-6" /></div>
        <div className="mr-auto"><h1 className="text-2xl font-black text-[var(--text-primary)]">Privilege Premium Reports</h1><p className="text-sm text-[var(--text-muted)]">Detailed client analysis, performance rankings and export</p></div>
        <div className="report-actions flex gap-2"><button onClick={load} disabled={loading} className="px-4 py-2 rounded-xl border border-[var(--border)] font-semibold text-sm flex gap-2"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button><button onClick={() => window.print()} className="px-4 py-2 rounded-xl border border-[var(--border)] font-semibold text-sm flex gap-2"><Printer className="w-4 h-4" />Print</button><button onClick={downloadPdf} className="px-4 py-2 rounded-xl bg-[var(--accent)] text-slate-950 font-semibold text-sm flex gap-2"><Download className="w-4 h-4" />Download PDF</button></div>
      </div>

      <div className="report-filters rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <div className="flex items-center justify-between mb-4"><div><h2 className="font-bold text-[var(--text-primary)] flex gap-2"><Filter className="w-4 h-4 text-[var(--accent)]" />Premium Filters</h2><p className="text-xs text-[var(--text-muted)]">Combine any number of filters</p></div><button onClick={() => setFilters(EMPTY_FILTERS)} className="text-xs font-bold text-[var(--accent)]">Clear all</button></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          <label className="relative xl:col-span-2"><Search className="absolute left-3 top-3 w-4 h-4 text-[var(--text-muted)]"/><input value={filters.search} onChange={e => set('search', e.target.value)} placeholder="Client, code, mobile, stock…" className="w-full pl-9 px-3 py-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-sm"/></label>
          <input type="date" title="From date" value={filters.from} onChange={e => set('from', e.target.value)} className="px-3 py-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-sm"/><input type="date" title="To date" value={filters.to} onChange={e => set('to', e.target.value)} className="px-3 py-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-sm"/>
          {(['branch','rm','dealer','scheme','location','occupation'] as const).map(key => <select key={key} value={filters[key]} onChange={e => set(key, e.target.value)} className="px-3 py-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-sm"><option value="">All {key === 'rm' ? 'RMs' : key[0].toUpperCase()+key.slice(1)}</option>{options[key].map(value => <option key={value}>{value}</option>)}</select>)}
          <select value={filters.trading} onChange={e => set('trading', e.target.value)} className="px-3 py-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-sm"><option value="">All trading statuses</option><option value="true">Trading started</option><option value="false">Trading not started</option></select>
          <input type="number" min="0" value={filters.minAum} onChange={e => set('minAum', e.target.value)} placeholder="Minimum AUM" className="px-3 py-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-sm"/><input type="number" min="0" value={filters.maxAum} onChange={e => set('maxAum', e.target.value)} placeholder="Maximum AUM" className="px-3 py-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-sm"/>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{[[Users,'Filtered Clients',filtered.length],[Wallet,'Total AUM',money(totalAum)],[TrendingUp,'Funds Utilised',money(totalUsed)],[FileBarChart,'Top RM',rmRanking[0]?.name || '—']].map(([Icon,label,value]: any) => <div key={label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5"><Icon className="w-5 h-5 text-[var(--accent)] mb-3"/><div className="text-xs uppercase font-bold text-[var(--text-muted)]">{label}</div><div className="text-xl font-black text-[var(--text-primary)] mt-1 truncate">{value}</div></div>)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4"><RankCard title="RM Client Ranking" rows={rmRanking}/><RankCard title="Dealer Client Ranking" rows={dealerRanking}/><RankCard title="Branch Client Ranking" rows={branchRanking}/><RankCard title="Scheme Popularity" rows={schemeRanking}/></div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden"><div className="p-4 border-b border-[var(--border)]"><h2 className="font-bold text-[var(--text-primary)]">Detailed Filtered Client Report</h2><p className="text-xs text-[var(--text-muted)]">{filtered.length} of {accounts.length} clients</p></div><div className="report-table overflow-auto max-h-[65vh]"><table className="w-full min-w-[1700px] text-xs"><thead className="sticky top-0 bg-[var(--table-header-bg)] text-[var(--text-muted)] uppercase"><tr>{['Sl','Code','Client','Date','Mobile','Scheme','Introducer','RM','Dealer','Branch','Location','Occupation','Trading','AUM','Utilised','Returns','Stocks','Remarks'].map(h => <th key={h} className="p-3 text-left whitespace-nowrap">{h}</th>)}</tr></thead><tbody className="divide-y divide-[var(--border)]">{filtered.map(a => <tr key={a.code} className="hover:bg-[var(--bg-hover)]">{[a.sl_no,a.code,a.name,a.account_date,a.mobile_no,a.scheme,a.introducer,a.rm,a.dealer,a.branch,a.location,a.occupation,a.trading_started?'Yes':'No',money(a.aum),money(a.utilised),a.returns,a.stocks,a.remarks].map((v,i) => <td key={i} className="p-3 whitespace-nowrap max-w-56 truncate" title={String(v || '')}>{String(v ?? '—') || '—'}</td>)}</tr>)}</tbody></table>{!loading && !filtered.length && <div className="p-12 text-center text-[var(--text-muted)]">No clients match these filters.</div>}</div></div>
    </div>
  </DashboardLayout>;
};

export default PrivilegeReportsPage;
