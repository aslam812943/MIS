import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { raService } from '../../services/ra.service';

export default function RAIdentityRequestButton({ ids }: { ids:string[] }) {
  const [selected,setSelected] = useState<string[]|null>(null);
  const [reason,setReason] = useState('');
  const [confirm,setConfirm] = useState(false);
  const [busy,setBusy] = useState(false);
  return <>
    <button type="button" onClick={()=>{setSelected([...ids]);setReason('');setConfirm(false);}} className="px-3 py-2 rounded-xl bg-[var(--accent-bg)] text-[var(--accent)] font-semibold">Request PAN/Aadhaar Access</button>
    {selected && createPortal(<div className="fixed inset-0 z-[220] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"><div role="dialog" aria-modal="true" aria-label="Request identity access" className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 max-w-lg w-full space-y-4"><h2 className="text-lg font-bold">{confirm?'Confirm access request':'Request PAN/Aadhaar Access'}</h2><p className="text-sm">Request admin permission to view and edit identity details for {selected.length} selected client{selected.length===1?'':'s'}.</p>{confirm ? <p className="p-3 rounded-xl bg-[var(--bg-base)] text-sm whitespace-pre-wrap">Reason: {reason}</p> : <label className="block text-sm font-semibold">Reason (required)<textarea autoFocus value={reason} onChange={e=>setReason(e.target.value)} rows={4} placeholder="Explain why you need to view or correct these identity details…" className="mt-2 w-full px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)]"/></label>}<p className="text-xs text-[var(--text-muted)]">Track the decision under Identity Request History in the sidebar. Approval remains available until you save identity changes.</p><div className="flex justify-end gap-3"><button disabled={busy} onClick={()=>{if(confirm)setConfirm(false);else setSelected(null);}} className="px-4 py-2 border border-[var(--border)] rounded-xl">{confirm?'Back':'Cancel'}</button><button disabled={busy || reason.trim().length<5} onClick={async()=>{if(!confirm){setConfirm(true);return;}setBusy(true);try{await raService.requestIdentityAccess(selected,reason.trim());setSelected(null);toast.success('Access requests sent to admin.');}catch(e:any){toast.error(e.response?.data?.error || 'Unable to submit requests.');}finally{setBusy(false);}}} className="px-4 py-2 rounded-xl bg-[var(--accent)] text-slate-950 font-semibold disabled:opacity-50 inline-flex items-center gap-2">{busy && <Loader2 className="w-4 h-4 animate-spin"/>}{busy?'Submitting…':confirm?'Confirm and submit':'Review request'}</button></div></div></div>,document.body)}
  </>;
}
