import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { franchiseService } from '../../services/franchise.service';
import type { FranchiseBootstrap, FranchiseSale } from '../../services/franchise.service';
import { parseProductSalesCsv } from '../../utils/franchiseProductSalesCsv';
import { uploadRaClientsInBatches } from '../../utils/raImportProgress';
import type { RAImportProgress } from '../../utils/raImportProgress';

export default function FranchiseSalesUpload({data,onSaved}:{data:FranchiseBootstrap;onSaved:(sales:FranchiseSale[])=>void}) {
  const fileInput=useRef<HTMLInputElement>(null);
  const [branch,setBranch]=useState(data.directory[0]?.id || '');
  const [rows,setRows]=useState<Record<string,string>[] | null>(null);
  const [rowNumbers,setRowNumbers]=useState<number[]>([]);
  const [selected,setSelected]=useState(new Set<number>());
  const [errors,setErrors]=useState<string[]>([]);
  const [verified,setVerified]=useState(false);
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState<RAImportProgress | null>(null);
  const changeSelection=(next:Set<number>)=>{setSelected(next);setVerified(false);};
  const save=async()=>{
    if(!rows || !selected.size || !verified || busy)return;
    setBusy(true);
    const indexes=[...selected].sort((a,b)=>a-b);
    try {
      const result=await uploadRaClientsInBatches(indexes.map(index=>rows[index]!),async batch=>{
        const saved=await franchiseService.bulkCreateSales(batch);onSaved(saved.sales);return saved;
      },setProgress);
      if(result.failed.length) {
        const failures=new Map(result.failed.map(failure=>[indexes[failure.row-2]!,failure.error]));
        const retained=rows.flatMap((_,index)=>!selected.has(index)||failures.has(index)?[index]:[]);
        setRows(retained.map(index=>rows[index]!));setRowNumbers(retained.map(index=>rowNumbers[index]!));
        setErrors(retained.map(index=>failures.get(index)||errors[index]||''));setSelected(new Set());setVerified(false);
        toast.error(`${result.inserted} sales saved; ${result.failed.length} need review.`);
      } else {toast.success(`${result.inserted} sales saved; ${rows.length-indexes.length} skipped.`);setRows(null);}
    } finally {setBusy(false);}
  };
  return <>
    <section className="fr-panel mb-6"><div className="fr-panel-head"><h2>Bulk upload product sales</h2><p>Select the target branch, download the sample, and replace its fictional customer details before uploading. Dates use YYYY-MM-DD. An optional franchise_code column can select another assigned branch per row.</p></div>
      <div className="fr-form flex flex-wrap items-end gap-4"><div className="fr-form-group"><label htmlFor="bulk-sales-branch">Upload branch</label><select id="bulk-sales-branch" disabled={busy} value={branch} onChange={event=>setBranch(event.target.value)}>{data.directory.map(row=><option key={row.id} value={row.id}>{row.location} · {row.code}</option>)}</select></div>
        <a className="mis-btn mis-btn-secondary" href="/samples/franchise-product-sales-sample.csv" download>Download sample CSV</a>
        <button disabled={busy || !branch} className="mis-btn mis-btn-primary" onClick={()=>fileInput.current?.click()}>{busy ? <><Loader2 className="w-4 h-4 animate-spin"/>Reading CSV…</> : 'Bulk upload CSV'}</button>
        <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={async event=>{
          const file=event.target.files?.[0];event.target.value='';if(!file)return;
          if(!file.name.toLowerCase().endsWith('.csv')){toast.error('Select a CSV file.');return;}
          setBusy(true);
          try {const parsed=parseProductSalesCsv(await file.text(),data.directory,data.products,branch);setRows(parsed);setRowNumbers(parsed.map((_,index)=>index+2));setSelected(new Set(parsed.map((_,index)=>index)));setErrors([]);setProgress(null);setVerified(false);}catch(error:any){toast.error(error.message || 'Could not read CSV.');}finally{setBusy(false);}
        }}/>
      </div>
    </section>
    {rows && createPortal(<div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"><div role="dialog" aria-modal="true" aria-label="Review product sales CSV" className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl w-full max-w-6xl max-h-[90dvh] overflow-hidden flex flex-col p-5 gap-4">
      <h2 className="text-xl font-bold">Review product sales CSV</h2><p>{rows.length} rows · {selected.size} selected. Uncheck rows to skip them.</p>
      {progress && <div role="status" aria-live="polite" className="p-3 rounded-xl bg-[var(--accent-bg)]"><div className="flex items-center gap-2">{busy && <Loader2 className="w-6 h-6 animate-spin"/>}<strong>{progress.saved} of {progress.total} selected sales saved</strong></div><p className="text-xs mt-1">{progress.processed} processed · {progress.failed} need review</p><progress className="w-full accent-[var(--accent)]" value={progress.processed} max={progress.total}/></div>}
      <div className="flex flex-wrap gap-2"><button disabled={busy} className="mis-btn mis-btn-secondary" onClick={()=>changeSelection(new Set(rows.map((_,index)=>index)))}>Select all</button><button disabled={busy} className="mis-btn mis-btn-secondary" onClick={()=>changeSelection(new Set([...selected].filter(index=>!errors[index])))}>Skip rows with issues</button></div>
      <div className="overflow-auto min-h-0"><table className="fr-table"><thead><tr><th>Include</th><th>CSV row</th><th>Branch</th><th>Customer</th><th>Product</th><th>Amount</th><th>Date</th><th>Issue</th></tr></thead><tbody>{rows.map((row,index)=><tr key={rowNumbers[index]}><td><input type="checkbox" disabled={busy} aria-label={`Include CSV row ${rowNumbers[index]}`} checked={selected.has(index)} onChange={event=>{const next=new Set(selected);if(event.target.checked)next.add(index);else next.delete(index);changeSelection(next);}}/></td><td>{rowNumbers[index]}</td><td>{data.directory.find(branch=>branch.id===row.franchise_id)?.location}</td><td>{row.customer_name}</td><td>{row.product}</td><td>₹{row.amount}</td><td>{row.sale_date}</td><td className="!text-[var(--danger-text)] whitespace-normal">{errors[index] || '—'}</td></tr>)}</tbody></table></div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={verified} disabled={busy || !selected.size} onChange={event=>setVerified(event.target.checked)}/>I reviewed the selected sales and confirm they are ready to save.</label>
      <div className="flex justify-end gap-3"><button className="mis-btn mis-btn-secondary" disabled={busy} onClick={()=>setRows(null)}>Cancel</button><button className="mis-btn mis-btn-primary" disabled={busy || !verified || !selected.size} onClick={save}>{busy ? <><Loader2 className="w-4 h-4 animate-spin"/>Saving {progress?.saved || 0} / {progress?.total || selected.size}</> : `Save ${selected.size} selected sales`}</button></div>
    </div></div>,document.body)}
  </>;
}
