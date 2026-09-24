import React, { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';
import { Download, FileBarChart, Filter, Printer, RefreshCw, Search, TrendingUp, Users, Wallet } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { privilegeService } from '../../services/privilege.service';
import type { PrivilegeAccount } from '../../types/privilege.types';
import { currencyAmount, privilegePortfolioMetrics, sumCurrency } from '../../utils/privilegeMetrics';

type Filters = {
  search: string; from: string; to: string; branch: string; rm: string; dealer: string;
  scheme: string; trading: string; location: string; occupation: string; minAum: string; maxAum: string;
};

const EMPTY_FILTERS: Filters = { search: '', from: '', to: '', branch: '', rm: '', dealer: '', scheme: '', trading: '', location: '', occupation: '', minAum: '', maxAum: '' };
const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const pdfMoney = (value: number) => `Rs. ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const normalize = (value: unknown) => String(value || '').trim().toLocaleLowerCase();
const displayName = (value: string) => value === value.toLocaleLowerCase()
  ? value.replace(/\b\p{L}/gu, letter => letter.toLocaleUpperCase())
  : value;
const unique = (accounts: PrivilegeAccount[], key: keyof PrivilegeAccount) => {
  const values = new Map<string, string>();
  accounts.forEach(account => {
    const raw = String(account[key] || '').trim();
    if (raw && !values.has(normalize(raw))) values.set(normalize(raw), displayName(raw));
  });
  return [...values.values()].sort((a, b) => a.localeCompare(b));
};
const ranking = (accounts: PrivilegeAccount[], key: keyof PrivilegeAccount, metric: 'clients' | 'aum') => {
  const groups = new Map<string, { name: string; count: number; aum: number; utilised: number }>();
  accounts.forEach(account => {
    const rawName = String(account[key] || '').trim() || 'Not assigned';
    const groupKey = normalize(rawName);
    const current = groups.get(groupKey) || { name: displayName(rawName), count: 0, aum: 0, utilised: 0 };
    current.count += 1;
    current.aum = sumCurrency([current.aum, account.aum]);
    current.utilised = sumCurrency([current.utilised, account.utilised]);
    groups.set(groupKey, current);
  });
  return [...groups.values()].sort((a, b) => metric === 'aum' ? b.aum - a.aum || b.count - a.count : b.count - a.count || b.aum - a.aum);
};

const PrivilegeReportsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<PrivilegeAccount[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [resultMetric, setResultMetric] = useState<'clients' | 'aum'>('clients');

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
      && (!filters.branch || normalize(a.branch) === normalize(filters.branch)) && (!filters.rm || normalize(a.rm) === normalize(filters.rm))
      && (!filters.dealer || normalize(a.dealer) === normalize(filters.dealer)) && (!filters.scheme || normalize(a.scheme) === normalize(filters.scheme))
      && (!filters.location || normalize(a.location) === normalize(filters.location)) && (!filters.occupation || normalize(a.occupation) === normalize(filters.occupation))
      && (!filters.trading || String(a.trading_started) === filters.trading)
      && (!filters.minAum || Number(a.aum) >= Number(filters.minAum))
      && (!filters.maxAum || Number(a.aum) <= Number(filters.maxAum));
  }), [accounts, filters]);

  const { totalAUM: totalAum, totalUtilised: totalUsed } = privilegePortfolioMetrics(filtered);
  const rmRanking = useMemo(() => ranking(filtered, 'rm', resultMetric), [filtered, resultMetric]);
  const dealerRanking = useMemo(() => ranking(filtered, 'dealer', resultMetric), [filtered, resultMetric]);
  const branchRanking = useMemo(() => ranking(filtered, 'branch', resultMetric), [filtered, resultMetric]);
  const schemeRanking = useMemo(() => ranking(filtered, 'scheme', resultMetric), [filtered, resultMetric]);
  const branchAnalysis = useMemo(() => ranking(filtered, 'branch', 'clients').sort((a, b) => a.name.localeCompare(b.name)), [filtered]);
  const set = (key: keyof Filters, value: string) => setFilters(previous => ({ ...previous, [key]: value }));

  const downloadPdf = () => {
    if (!filtered.length) return toast.error('No clients match the selected filters.');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFillColor(13, 148, 136); doc.rect(0, 0, 297, 5, 'F');
    doc.setTextColor(25, 35, 50); doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.text('Privilege Premium Report', 12, 16);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(90, 100, 115); doc.setFontSize(8); doc.text(`Generated: ${new Date().toLocaleString('en-IN')}  |  Ranking: ${resultMetric === 'clients' ? 'Number of clients' : 'Total AUM'}`, 12, 22);
    autoTable(doc, { startY: 27, head: [['FILTERED CLIENTS', 'TOTAL AUM', 'FUNDS UTILISED', 'TOP RM']], body: [[filtered.length, pdfMoney(totalAum), pdfMoney(totalUsed), rmRanking[0]?.name || 'N/A']], theme: 'grid', styles: { halign: 'center', fontSize: 9, cellPadding: 3 }, headStyles: { fillColor: [15, 118, 110] } });
    autoTable(doc, { startY: (doc as any).lastAutoTable.finalY + 6, head: [['RM', 'Clients', 'AUM', 'Utilised']], body: rmRanking.map(x => [x.name, x.count, pdfMoney(x.aum), pdfMoney(x.utilised)]), theme: 'striped', styles: { fontSize: 7, cellPadding: 2 }, headStyles: { fillColor: [30, 41, 59] }, tableWidth: 130 });
    autoTable(doc, { startY: (doc as any).lastAutoTable.finalY + 7, head: [['Sl', 'Code', 'Client', 'Date', 'Mobile', 'Scheme', 'RM', 'Dealer', 'Branch', 'Location', 'Occupation', 'Trading', 'AUM', 'Utilised', 'Returns', 'Stocks']], body: filtered.map(a => [a.sl_no, a.code, a.name, a.account_date, a.mobile_no, a.scheme, a.rm, a.dealer, a.branch, a.location, a.occupation, a.trading_started ? 'Yes' : 'No', pdfMoney(a.aum), pdfMoney(a.utilised), a.returns, a.stocks]), theme: 'striped', margin: { left: 8, right: 8 }, styles: { fontSize: 5.2, cellPadding: 1.25, overflow: 'linebreak', valign: 'middle' }, headStyles: { fillColor: [13, 148, 136], halign: 'center' }, horizontalPageBreak: true, horizontalPageBreakRepeat: [0, 1, 2], didDrawPage: data => { doc.setFontSize(7); doc.setTextColor(110); doc.text(`MIS Portal · Privilege Report · Page ${data.pageNumber}`, 148.5, 205, { align: 'center' }); } });
    autoTable(doc, { startY: (doc as any).lastAutoTable.finalY + 7, head: [['Branch', 'Accounts', 'AUM', 'Funds Utilised', 'Available', 'Utilisation']], body: branchAnalysis.map(x => [x.name, x.count, pdfMoney(x.aum), pdfMoney(x.utilised), pdfMoney(currencyAmount(x.aum - x.utilised)), `${x.aum ? (x.utilised / x.aum * 100).toFixed(1) : '0.0'}%`]), theme: 'grid', styles: { fontSize: 7, cellPadding: 2 }, headStyles: { fillColor: [30, 41, 59] } });
    doc.save(`privilege-detailed-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success(`PDF generated with ${filtered.length} clients`);
  };

  const RankCard = ({ title, rows }: { title: string; rows: ReturnType<typeof ranking> }) => (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
      <div className="p-4 border-b border-[var(--border)]"><h2 className="font-bold text-[var(--text-primary)]">{title}</h2><p className="text-xs text-[var(--text-muted)]">Ranked by {resultMetric === 'clients' ? 'number of filtered clients' : 'total filtered AUM'}</p></div>
      <div className="max-h-64 overflow-auto divide-y divide-[var(--border)]">
        {rows.map((row, index) => <div key={row.name} className="p-3 flex items-center gap-3"><span className="relative block w-8 h-8 shrink-0 rounded-full bg-[var(--accent-bg)] text-[var(--accent)]"><span className="absolute inset-0 flex items-center justify-center text-center text-xs font-black leading-none tabular-nums">{index + 1}</span></span><div className="min-w-0 flex-1"><div className="text-sm font-semibold text-[var(--text-primary)] truncate">{row.name}</div><div className="text-xs text-[var(--text-muted)]">{row.count} client{row.count === 1 ? '' : 's'} · AUM {money(row.aum)}</div></div><span className="text-base font-black text-[var(--accent)] whitespace-nowrap">{resultMetric === 'clients' ? row.count : money(row.aum)}</span></div>)}
        {!rows.length && <div className="p-6 text-center text-xs text-[var(--text-muted)]">No matching data</div>}
      </div>

    </div>
  );

  return <DashboardLayout>
    <style>{`.print-only{display:none} @page{size:A4 landscape;margin:10mm} @media print{body,html,#root,main{background:#fff!important;color:#111!important;margin:0!important;padding:0!important}.screen-report,aside,header{display:none!important}.print-only{display:block!important;font-family:Arial,sans-serif;color:#111;background:#fff}.print-title{border-bottom:2px solid #111;padding-bottom:3mm;margin-bottom:4mm}.print-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin-bottom:5mm}.print-summary>div{border:1px solid #999;padding:3mm}.print-label{font-size:7pt;text-transform:uppercase;color:#555}.print-value{font-size:13pt;font-weight:700;margin-top:1mm}.print-section{margin-top:5mm;break-inside:auto}.print-section.page{break-before:page}.print-section h2{font-size:11pt;margin:0 0 2mm}.print-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7pt}.print-table th{background:#eee!important;font-weight:700;text-align:left}.print-table th,.print-table td{border:1px solid #aaa;padding:1.5mm;vertical-align:top;overflow-wrap:anywhere}.print-table tr{break-inside:avoid}.print-meta{font-size:7pt;color:#555;margin-top:1mm}`}</style>
    <div className="report-page max-w-[1700px] mx-auto p-4 sm:p-6 space-y-5">
      <div className="screen-report space-y-5">
      <div className="report-header rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 flex flex-wrap items-center gap-4">
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

      <div className="report-actions rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-[var(--text-primary)]">Show report results by</h2><p className="text-xs text-[var(--text-muted)]">Choose how rankings and top performers are calculated.</p></div><div className="inline-flex rounded-xl bg-[var(--bg-base)] border border-[var(--border)] p-1"><button onClick={() => setResultMetric('clients')} className={`px-5 py-2 rounded-lg text-sm font-bold ${resultMetric === 'clients' ? 'bg-[var(--accent)] text-slate-950' : 'text-[var(--text-secondary)]'}`}>Number of Clients</button><button onClick={() => setResultMetric('aum')} className={`px-5 py-2 rounded-lg text-sm font-bold ${resultMetric === 'aum' ? 'bg-[var(--accent)] text-slate-950' : 'text-[var(--text-secondary)]'}`}>Total AUM</button></div></div>

      <div className="report-kpis grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{[[Users,'Filtered Clients',filtered.length],[Wallet,'Total AUM',money(totalAum)],[TrendingUp,'Funds Utilised',money(totalUsed)],[FileBarChart,'Top RM',rmRanking[0]?.name || '—']].map(([Icon,label,value]: any) => <div key={label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5"><Icon className="w-5 h-5 text-[var(--accent)] mb-3"/><div className="text-xs uppercase font-bold text-[var(--text-muted)]">{label}</div><div className="text-xl font-black text-[var(--text-primary)] mt-1 truncate">{value}</div></div>)}</div>
      <div className="report-rankings grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4"><RankCard title="RM Client Ranking" rows={rmRanking}/><RankCard title="Dealer Client Ranking" rows={dealerRanking}/><RankCard title="Branch Client Ranking" rows={branchRanking}/><RankCard title="Scheme Popularity" rows={schemeRanking}/></div>

      <div className="report-detail">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden"><div className="p-4 border-b border-[var(--border)]"><h2 className="font-bold text-[var(--text-primary)]">Detailed Filtered Client Report</h2><p className="text-xs text-[var(--text-muted)]">{filtered.length} of {accounts.length} clients</p></div><div className="report-table overflow-auto max-h-[65vh]"><table className="w-full min-w-[1700px] text-xs"><thead className="sticky top-0 bg-[var(--table-header-bg)] text-[var(--text-muted)] uppercase"><tr>{['Sl','Code','Client','Date','Mobile','Scheme','Introducer','RM','Dealer','Branch','Location','Occupation','Trading','AUM','Utilised','Returns','Stocks','Remarks'].map(h => <th key={h} className="p-3 text-left whitespace-nowrap">{h}</th>)}</tr></thead><tbody className="divide-y divide-[var(--border)]">{filtered.map(a => <tr key={a.code} className="hover:bg-[var(--bg-hover)]">{[a.sl_no,a.code,a.name,a.account_date,a.mobile_no,a.scheme,a.introducer,a.rm,a.dealer,a.branch,a.location,a.occupation,a.trading_started?'Yes':'No',money(a.aum),money(a.utilised),a.returns,a.stocks,a.remarks].map((v,i) => <td key={i} className="p-3 whitespace-nowrap max-w-56 truncate" title={String(v || '')}>{String(v ?? '—') || '—'}</td>)}</tr>)}</tbody></table>{!loading && !filtered.length && <div className="p-12 text-center text-[var(--text-muted)]">No clients match these filters.</div>}</div></div>
      </div>

      <div className="report-branches rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]"><h2 className="text-lg font-bold text-[var(--text-primary)]">Branch-wise Analysis</h2><p className="text-sm text-[var(--text-muted)] mt-0.5">Separate performance for each branch using the currently filtered report data.</p></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-[var(--table-header-bg)] text-xs uppercase tracking-wider text-[var(--text-muted)]"><tr><th className="px-6 py-3 text-left">Branch</th><th className="px-6 py-3 text-right">Accounts</th><th className="px-6 py-3 text-right">AUM</th><th className="px-6 py-3 text-right">Funds Utilised</th><th className="px-6 py-3 text-right">Available</th><th className="px-6 py-3 text-right">Utilisation</th><th className="report-actions px-6 py-3 text-right">View</th></tr></thead>
            <tbody className="divide-y divide-[var(--border)]">{branchAnalysis.map(branch => {
              const available = currencyAmount(branch.aum - branch.utilised);
              const utilisation = branch.aum > 0 ? branch.utilised / branch.aum * 100 : 0;
              return <tr key={normalize(branch.name)} className="hover:bg-[var(--bg-hover)]"><td className="px-6 py-3 font-semibold text-[var(--text-primary)]">{branch.name}</td><td className="px-6 py-3 text-right text-[var(--text-secondary)] tabular-nums">{branch.count}</td><td className="px-6 py-3 text-right font-semibold text-[var(--text-primary)]">{money(branch.aum)}</td><td className="px-6 py-3 text-right text-[var(--text-primary)]">{money(branch.utilised)}</td><td className="px-6 py-3 text-right text-[var(--text-secondary)]">{money(available)}</td><td className="px-6 py-3 text-right font-semibold text-[var(--accent)]">{utilisation.toFixed(1)}%</td><td className="report-actions px-6 py-3 text-right"><button type="button" onClick={() => { set('branch', branch.name); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-bg)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-slate-950 transition">Open</button></td></tr>;
            })}</tbody>
          </table>
          {!loading && !branchAnalysis.length && <div className="p-10 text-center text-sm text-[var(--text-muted)]">No branch data matches the selected filters.</div>}
        </div>
      </div>
      </div>

      <section className="print-only">
        <div className="print-title"><h1 className="text-2xl font-bold">Privilege Premium Report</h1><div className="print-meta">MIS Portal · Generated {new Date().toLocaleString('en-IN')} · Ranked by {resultMetric === 'clients' ? 'number of clients' : 'total AUM'}</div></div>
        <div className="print-summary"><div><div className="print-label">Filtered clients</div><div className="print-value">{filtered.length}</div></div><div><div className="print-label">Total AUM</div><div className="print-value">{money(totalAum)}</div></div><div><div className="print-label">Funds utilised</div><div className="print-value">{money(totalUsed)}</div></div><div><div className="print-label">Top RM</div><div className="print-value">{rmRanking[0]?.name || '—'}</div></div></div>
        <div className="print-section"><h2>RM Performance Summary</h2><table className="print-table"><thead><tr><th>Rank</th><th>RM</th><th>Clients</th><th>AUM</th><th>Funds Utilised</th></tr></thead><tbody>{rmRanking.map((row,index)=><tr key={row.name}><td>{index+1}</td><td>{row.name}</td><td>{row.count}</td><td>{money(row.aum)}</td><td>{money(row.utilised)}</td></tr>)}</tbody></table></div>
        <div className="print-section page"><h2>Detailed Client Report ({filtered.length} clients)</h2><table className="print-table"><thead><tr>{['Sl','Code','Client','Date','Mobile','Scheme','RM','Dealer','Branch','Trading','AUM','Utilised'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{filtered.map(a=><tr key={a.code}>{[a.sl_no,a.code,a.name,a.account_date,a.mobile_no,a.scheme,a.rm,a.dealer,a.branch,a.trading_started?'Yes':'No',money(a.aum),money(a.utilised)].map((v,i)=><td key={i}>{v || '—'}</td>)}</tr>)}</tbody></table></div>
        <div className="print-section page"><h2>Branch-wise Analysis</h2><table className="print-table"><thead><tr><th>Branch</th><th>Accounts</th><th>AUM</th><th>Funds Utilised</th><th>Available</th><th>Utilisation</th></tr></thead><tbody>{branchAnalysis.map(row=><tr key={row.name}><td>{row.name}</td><td>{row.count}</td><td>{money(row.aum)}</td><td>{money(row.utilised)}</td><td>{money(currencyAmount(row.aum-row.utilised))}</td><td>{row.aum?(row.utilised/row.aum*100).toFixed(1):'0.0'}%</td></tr>)}</tbody></table></div>
      </section>
    </div>
  </DashboardLayout>;
};

export default PrivilegeReportsPage;
