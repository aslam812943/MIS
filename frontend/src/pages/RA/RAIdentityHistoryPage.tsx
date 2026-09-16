import DashboardLayout from '../../components/layout/DashboardLayout';
import { authService } from '../../services/auth.service';
import RAIdentityAccessPanel from './RAIdentityAccessPanel';
import { ShieldCheck } from 'lucide-react';

export default function RAIdentityHistoryPage() {
  const role = authService.getCurrentUser()?.role;
  return <DashboardLayout><div className="max-w-[1600px] mx-auto p-4 sm:p-6 space-y-5"><div className="flex items-center gap-4 p-5 sm:p-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]"><div className="p-3 rounded-xl bg-[var(--accent-bg)] text-[var(--accent)]"><ShieldCheck className="w-7 h-7"/></div><div><h1 className="text-xl sm:text-2xl font-bold">Identity Request History</h1><p className="text-sm text-[var(--text-muted)] mt-1">{role==='hod'?'All employee requests, admin decisions and identity-save history.':role==='admin'?'Review requests and track all approval history.':'Your requests, admin decisions and approved identity access.'}</p></div><span className="ml-auto hidden sm:inline-flex px-3 py-1.5 rounded-full border border-[var(--border)] text-xs font-semibold capitalize">{role} workspace</span></div><RAIdentityAccessPanel defaultOpen/></div></DashboardLayout>;
}
