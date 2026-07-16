import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import DashboardLayout from '../../components/layout/DashboardLayout';
import TrendDelta from '../../components/common/TrendDelta';
import PeriodFilter from '../../components/common/PeriodFilter';
import { orgService } from '../../services/org.service';
import { authService } from '../../services/auth.service';
import { ROUTES } from '../../constants/routes';
import { COMPARISON_CONFIGS } from '../../config/comparisonMetrics';
import type { DateRange } from '../../utils/periodRange';
import { previousMonthStr } from '../../utils/periodRange';

const DASHBOARD_ROUTES: Record<string, string> = {
  it: ROUTES.IT_DASHBOARD,
  finance: ROUTES.FINANCE_DASHBOARD,
  kyc: ROUTES.KYC_DASHBOARD,
  dp: ROUTES.DP_DASHBOARD,
  settlements: ROUTES.SETTLEMENTS_DASHBOARD,
  iepf: ROUTES.IEPF_DASHBOARD,
};

const ComparisonPage: React.FC = () => {
  const { dept } = useParams<{ dept: string }>();
  const config = dept ? COMPARISON_CONFIGS[dept] : undefined;

  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const hasMultiBranchAccess = isAdmin || ['ceo', 'managing_director', 'director', 'executive', 'hod'].includes(currentUser?.role || '');
  const userBranchId = currentUser?.branch_id || '';

  const [branches, setBranches] = useState<any[]>([]);
  const [branchFilter, setBranchFilter] = useState('');

  const [rangeA, setRangeA] = useState<DateRange | null>(null);
  const [rangeB, setRangeB] = useState<DateRange | null>(null);
  const [dataA, setDataA] = useState<any>(null);
  const [dataB, setDataB] = useState<any>(null);
  const [loadingA, setLoadingA] = useState(true);
  const [loadingB, setLoadingB] = useState(true);

  useEffect(() => {
    if (!hasMultiBranchAccess) return;
    orgService.getBranches().then(setBranches).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const branchIdParam = hasMultiBranchAccess ? (branchFilter || undefined) : userBranchId;

  useEffect(() => {
    if (!config || !rangeA) return;
    setLoadingA(true);
    config.fetch(branchIdParam, rangeA.start, rangeA.end)
      .then(setDataA)
      .catch(() => toast.error('Failed to load Period A data.'))
      .finally(() => setLoadingA(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, rangeA, branchIdParam]);

  useEffect(() => {
    if (!config || !rangeB) return;
    setLoadingB(true);
    config.fetch(branchIdParam, rangeB.start, rangeB.end)
      .then(setDataB)
      .catch(() => toast.error('Failed to load Period B data.'))
      .finally(() => setLoadingB(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, rangeB, branchIdParam]);

  if (!config) {
    return (
      <DashboardLayout>
        <div className="mis-page mis-animate-in max-w-5xl mx-auto">
          <div className="mis-empty py-20">Unknown department for comparison.</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-6xl mx-auto space-y-8">

        <header
          className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 p-6 border rounded-xl shadow-xs text-left"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="text-center lg:text-left w-full lg:w-auto">
            <h1 className="text-2.5xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {config.icon} {config.title} — Comparison
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Pick a period on each side to compare any two months, quarters, years, or custom ranges against each other.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-center lg:self-auto">
            {hasMultiBranchAccess && (
              <select
                className="mis-select w-44 text-xs cursor-pointer"
                value={branchFilter}
                onChange={e => setBranchFilter(e.target.value)}
              >
                <option value="">All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            <Link
              to={DASHBOARD_ROUTES[dept as string] || ROUTES.DASHBOARD}
              className="px-3 py-1.5 border rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              ← Back to Dashboard
            </Link>
          </div>
        </header>

        {/* Two independent period pickers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="mis-card p-5">
            <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Period A</h3>
            <PeriodFilter initialMonth={previousMonthStr()} onChange={p => setRangeA(p.current)} />
          </div>
          <div className="mis-card p-5">
            <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Period B</h3>
            <PeriodFilter onChange={p => setRangeB(p.current)} />
          </div>
        </div>

        {/* Comparison table */}
        <div className="mis-card p-5">
          <h3 className="text-sm font-bold mb-4 border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
            Metric Comparison
          </h3>

          {loadingA || loadingB ? (
            <div className="text-center py-16 text-sm" style={{ color: 'var(--text-secondary)' }}>Loading comparison…</div>
          ) : !dataA || !dataB ? (
            <div className="text-center py-16 text-sm" style={{ color: 'var(--text-secondary)' }}>No data available for one or both periods.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="mis-table w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left">Metric</th>
                    <th className="text-right">Period A</th>
                    <th className="text-right">Period B</th>
                    <th className="text-right">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {config.metrics.map(metric => {
                    const valA = Number(metric.get(dataA) ?? 0);
                    const valB = Number(metric.get(dataB) ?? 0);
                    const format = metric.format || ((n: number) => String(n));
                    return (
                      <tr key={metric.label}>
                        <td className="font-semibold" style={{ color: 'var(--text-primary)' }}>{metric.label}</td>
                        <td className="text-right">{format(valA)}</td>
                        <td className="text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{format(valB)}</td>
                        <td className="text-right">
                          <TrendDelta current={valB} previous={valA} isPercentagePoint={metric.isPercentagePoint} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
};

export default ComparisonPage;
