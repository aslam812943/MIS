import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import DataEntryForm from '../../components/DataEntry/DataEntryForm';
import { orgService, type Module } from '../../services/org.service';
import { authService } from '../../services/auth.service';
import { ROUTES } from '../../constants/routes';
import { format } from 'date-fns';

const DataEntryPage: React.FC = () => {
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(true);

  const currentUser = authService.getCurrentUser();
  const deptName = currentUser?.department_name?.toUpperCase() || '';
  const isRA = deptName.includes('RA') || deptName.includes('RESEARCH');

  useEffect(() => {
    const fetchModules = async () => {
      setIsLoading(true);
      try {
        const allModules = await orgService.getModules();

        const user = authService.getCurrentUser();
        let allowed = allModules;
        if (user && user.role !== 'admin') {
          const allowedIds = user.allowed_modules || [];
          allowed = allModules.filter(m => allowedIds.includes(m.id));
        }

        setModules(allowed);
        if (allowed.length > 0) {
          setSelectedModuleId(prev => prev || allowed[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch modules', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchModules();
  }, []);

  const selectedModule = modules.find(m => m.id === selectedModuleId);

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="mis-data-entry-layout">
          {/* Toolbar: title + date in one aligned bar */}
          <div className="mis-data-entry-toolbar">
            <div className="mis-data-entry-toolbar-title">
              <div className="flex items-center gap-2">
                <h1>Data Entry & Operations Hub</h1>
                {isRA && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--accent-bg)] text-[var(--accent)] border border-[var(--accent-bg-2)]">
                    RA Department
                  </span>
                )}
              </div>
              <p>Record daily metrics or navigate directly to your assigned department operations.</p>
            </div>
            <div className="mis-data-entry-date-field mis-field" style={{ margin: 0 }}>
              <label className="mis-label">Entry date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mis-input"
              />
            </div>
          </div>

          {/* Module selector tabs (if generic modules exist) */}
          {modules.length > 0 && (
            <div className="mis-data-entry-modules" role="tablist" aria-label="Data modules">
              {modules.map((module) => (
                <button
                  key={module.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedModuleId === module.id}
                  onClick={() => setSelectedModuleId(module.id)}
                  className={`mis-module-tab ${selectedModuleId === module.id ? 'active' : ''}`}
                >
                  {module.name}
                </button>
              ))}
            </div>
          )}

          {/* Form panel or Empty-state Quick Links Hub */}
          {isLoading ? (
            <div className="mis-loading-center py-20">
              <div className="mis-spinner" />
            </div>
          ) : selectedModule ? (
            <DataEntryForm module={selectedModule} selectedDate={selectedDate} />
          ) : (
            /* Dedicated Quick Links Hub for Sidebar items */
            <div className="space-y-6 pt-2">
              <div className="bg-[var(--bg-card)] p-6 rounded-2xl border border-[var(--border)] shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
                  <div>
                    <h2 className="text-lg font-bold text-[var(--text-primary)]">
                      Quick Access: RA Department Operations
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Direct shortcuts to your daily workflow modules, tracking dashboards, and reports.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={ROUTES.RA_DATA_ENTRY}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)] transition shadow-sm"
                    >
                      + New Client Entry
                    </Link>
                  </div>
                </div>

                {/* Grid of Quick Action Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                  {/* Card 1: RA Data Entry */}
                  <div className="p-5 rounded-2xl bg-[var(--bg-card-2)] border border-[var(--border)] hover:border-[var(--accent)] transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-teal-500/15 text-teal-400 border border-teal-500/25">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-400 border border-teal-500/20">
                          Main Hub
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">
                        RA Operations & Client Entry
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed">
                        Onboard clients, manage 19 regulatory parameters, log transactions, and maintain package catalogs.
                      </p>
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        <Link to="/ra-entry?tab=clients" className="px-2 py-1 text-[11px] font-medium rounded-lg bg-[var(--bg-base)] text-[var(--text-primary)] hover:border-[var(--accent)] border border-[var(--border)]">
                          Clients
                        </Link>
                        <Link to="/ra-entry?tab=packages" className="px-2 py-1 text-[11px] font-medium rounded-lg bg-[var(--bg-base)] text-[var(--text-primary)] hover:border-[var(--accent)] border border-[var(--border)]">
                          Packages
                        </Link>
                        <Link to="/ra-entry?tab=renewals" className="px-2 py-1 text-[11px] font-medium rounded-lg bg-[var(--bg-base)] text-[var(--text-primary)] hover:border-[var(--accent)] border border-[var(--border)]">
                          Renewals
                        </Link>
                        <Link to="/ra-entry?tab=payments" className="px-2 py-1 text-[11px] font-medium rounded-lg bg-[var(--bg-base)] text-[var(--text-primary)] hover:border-[var(--accent)] border border-[var(--border)]">
                          Payments
                        </Link>
                      </div>
                    </div>
                    <Link
                      to={ROUTES.RA_DATA_ENTRY}
                      className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 text-xs font-bold rounded-xl bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)] transition"
                    >
                      Open Data Entry →
                    </Link>
                  </div>

                  {/* Card 2: KYC / KRA Tracking */}
                  <div className="p-5 rounded-2xl bg-[var(--bg-card-2)] border border-[var(--border)] hover:border-cyan-500/40 transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <rect x="2" y="4" width="20" height="16" rx="2" />
                            <circle cx="8" cy="10" r="2" />
                            <line x1="14" y1="9" x2="18" y2="9" />
                            <line x1="14" y1="13" x2="18" y2="13" />
                            <line x1="6" y1="17" x2="18" y2="17" />
                          </svg>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          Compliance
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">
                        KYC / KRA Tracking
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed">
                        Track 6 compliance KPIs: KYC completed/pending, KRA status, and missing CKYC records with instant filters.
                      </p>
                    </div>
                    <Link
                      to="/ra-entry?tab=kyc"
                      className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 text-xs font-bold rounded-xl bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/30 transition"
                    >
                      Open KYC / KRA Tracking →
                    </Link>
                  </div>

                  {/* Card 3: Testimonials Hub */}
                  <div className="p-5 rounded-2xl bg-[var(--bg-card-2)] border border-[var(--border)] hover:border-purple-500/40 transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/25">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          Feedback
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">
                        Testimonials Hub
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed">
                        Capture and verify client feedback, star ratings, and WhatsApp screenshot proof linked directly to client accounts.
                      </p>
                    </div>
                    <Link
                      to={ROUTES.RA_TESTIMONIALS}
                      className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 text-xs font-bold rounded-xl bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30 transition"
                    >
                      Open Testimonials →
                    </Link>
                  </div>

                  {/* Card 4: Weekly & Monthly Reports */}
                  <div className="p-5 rounded-2xl bg-[var(--bg-card-2)] border border-[var(--border)] hover:border-emerald-500/40 transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Export & Print
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">
                        Weekly & Monthly Reports
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed">
                        Generate comprehensive advisory reports with product mix, collections breakdown, renewals forecast, and print/PDF export.
                      </p>
                    </div>
                    <Link
                      to={ROUTES.RA_REPORTS}
                      className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 text-xs font-bold rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 transition"
                    >
                      Generate Reports →
                    </Link>
                  </div>

                  {/* Card 5: RA Analytics Dashboard */}
                  <div className="p-5 rounded-2xl bg-[var(--bg-card-2)] border border-[var(--border)] hover:border-blue-500/40 transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/25">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <line x1="18" y1="20" x2="18" y2="10" />
                            <line x1="12" y1="20" x2="12" y2="4" />
                            <line x1="6" y1="20" x2="6" y2="14" />
                          </svg>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          Analytics
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">
                        RA Analytics Dashboard
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed">
                        View active advisory counts, 12-month revenue trend charts, package distributions, and 30-day renewals watchlist.
                      </p>
                    </div>
                    <Link
                      to={ROUTES.RA_DASHBOARD}
                      className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 text-xs font-bold rounded-xl bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30 transition"
                    >
                      Open Dashboard →
                    </Link>
                  </div>

                  {/* Card 6: Tasks & Priorities */}
                  <div className="p-5 rounded-2xl bg-[var(--bg-card-2)] border border-[var(--border)] hover:border-amber-500/40 transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/25">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Tasks
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">
                        Task Manager & Follow-ups
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed">
                        Stay on top of pending client renewals, KYC fetch reminders, and assigned department operational tasks.
                      </p>
                    </div>
                    <Link
                      to={ROUTES.TASKS}
                      className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 text-xs font-bold rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition"
                    >
                      View Assigned Tasks →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DataEntryPage;
