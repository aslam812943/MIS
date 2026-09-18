import { Loader2 } from 'lucide-react';
import type { RAImportProgress } from '../../utils/raImportProgress';

type Props = {
  rows: Record<string, string>[];
  rowNumbers: number[];
  errors: string[];
  conflicts: Set<number>;
  selected: Set<number>;
  verified: boolean;
  busy: boolean;
  progress: RAImportProgress | null;
  onSelect: (selected: Set<number>) => void;
  onVerify: (verified: boolean) => void;
  onCancel: () => void;
  onSave: () => void;
};

export default function RACsvPreview({ rows, rowNumbers, errors, conflicts, selected, verified, busy, progress, onSelect, onVerify, onCancel, onSave }: Props) {
  const headers = Object.keys(rows[0] || {});
  const issueCount = errors.filter(Boolean).length;
  const select = (next: Set<number>) => { onSelect(next); onVerify(false); };
  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-5 gap-4" role="dialog" aria-modal="true" aria-label="Verify CSV import">
        <h2 className="text-xl font-bold">Review RA CSV Import</h2>
        <p className="text-sm">{rows.length} rows · {selected.size} selected · {issueCount} with issues. Uncheck rows to skip them. Duplicate clients in this file are identified by their original CSV row number.</p>
        <p className="text-xs text-[var(--text-secondary)]">Matching columns with equal values, or one blank value, are merged. Conflicting column values must be corrected in the CSV or skipped. Missing fees are saved as ₹0; a missing end date is calculated from the start date and plan duration. End dates supplied in your file are preserved.</p>
        {progress && <div role="status" aria-live="polite" className="rounded-xl border border-[var(--border-accent)] bg-[var(--accent-bg)] p-4 space-y-3">
          <div className="flex items-center gap-3">
            {busy && <Loader2 aria-hidden="true" className="w-7 h-7 shrink-0 animate-spin text-[var(--accent)]" />}
            <div><p className="font-bold">{progress.saved} of {progress.total} selected clients saved</p><p className="text-xs text-[var(--text-secondary)]">{progress.processed} processed · {progress.failed} need review{busy ? ' · Saving selected clients…' : ' · Upload finished'}</p></div>
          </div>
          <progress aria-label="Selected clients processed" className="w-full h-2 accent-[var(--accent)]" value={progress.processed} max={progress.total} />
        </div>}
        <div className="flex flex-wrap gap-3">
          <button disabled={busy} onClick={() => select(new Set(rows.flatMap((_, index) => conflicts.has(index) ? [] : [index])))} className="px-3 py-2 border rounded-xl">Select all available rows</button>
          <button disabled={busy} onClick={() => select(new Set([...selected].filter(index => !errors[index])))} className="px-3 py-2 border rounded-xl">Skip rows with issues</button>
          <button disabled={busy} onClick={() => select(new Set())} className="px-3 py-2 border rounded-xl">Clear selection</button>
        </div>
        <div className="overflow-auto max-h-[55vh]">
          <table className="w-full text-xs">
            <thead><tr><th className="p-2">Include</th><th className="p-2">CSV row</th><th className="p-2 text-left">Import check</th>{headers.map(header => <th key={header} className="p-2 text-left whitespace-nowrap">{header}</th>)}</tr></thead>
            <tbody>{rows.map((row, index) => (
              <tr key={rowNumbers[index]} className={`border-t border-[var(--border)] ${!selected.has(index) ? 'opacity-60' : ''}`}>
                <td className="p-2"><input type="checkbox" aria-label={`Include CSV row ${rowNumbers[index]}`} checked={selected.has(index)} disabled={busy || conflicts.has(index)} onChange={event => {const next = new Set(selected); if (event.target.checked) next.add(index); else next.delete(index); select(next);}} /></td>
                <td className="p-2">{rowNumbers[index]}</td>
                <td className={`p-2 min-w-64 ${errors[index] ? 'text-[var(--danger-text)]' : 'text-[var(--badge-success-text)]'}`}>{errors[index] || 'Ready to import'}{!selected.has(index) && <div className="font-semibold mt-1">Skipped</div>}</td>
                {headers.map(header => <td key={header} className="p-2 whitespace-nowrap">{row[header] || '—'}</td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={verified} disabled={busy || !selected.size} onChange={event => onVerify(event.target.checked)} />I reviewed the selected rows and confirm they are ready to save.</label>
        <div className="flex justify-end gap-3">
          <button disabled={busy} onClick={onCancel} className="px-4 py-2 border rounded-xl">Cancel</button>
          <button disabled={!verified || busy || !selected.size} onClick={onSave} className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--btn-primary-color)] disabled:opacity-50 inline-flex items-center gap-2">{busy ? <><Loader2 className="w-4 h-4 animate-spin" />Saved {progress?.saved || 0} / {progress?.total || selected.size}</> : `Save ${selected.size} selected rows`}</button>
        </div>
      </div>
    </div>
  );
}
