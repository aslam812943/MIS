import React, { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { raService } from '../../services/ra.service';
import { orgService } from '../../services/org.service';
import { authService } from '../../services/auth.service';
import type { RATestimonial, RAClient } from '../../types/ra.types';

export const RATestimonialsPage: React.FC = () => {
  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const isLeadership = ['ceo', 'managing_director', 'director', 'executive'].includes(currentUser?.role || '');
  const isHOD = currentUser?.role === 'hod';
  const hasMultiBranchAccess = isAdmin || isLeadership || isHOD;

  const [testimonials, setTestimonials] = useState<RATestimonial[]>([]);
  const [clients, setClients] = useState<RAClient[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // View & Filters
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [featuredOnly, setFeaturedOnly] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RATestimonial | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    client_id: '',
    client_name: '',
    package_name: '',
    rating: 5,
    feedback_text: '',
    testimonial_date: new Date().toISOString().split('T')[0],
    screenshot_url: '',
    is_featured: true,
    is_verified: true,
    branch_id: currentUser?.branch_id || '',
  });

  // Load branches
  useEffect(() => {
    if (hasMultiBranchAccess) {
      orgService.getBranches().then(setBranches).catch(() => {});
    }
  }, [hasMultiBranchAccess]);

  // Load testimonials and clients list
  const loadData = async () => {
    try {
      setLoading(true);
      const [tData, cData] = await Promise.all([
        raService.getTestimonials({
          branchId: selectedBranch || undefined,
          featured: featuredOnly ? true : undefined,
          search: searchQuery || undefined,
        }),
        raService.getClients({ branchId: selectedBranch || undefined }),
      ]);
      setTestimonials(tData);
      setClients(cData);
    } catch (err: any) {
      console.error('Error loading testimonials:', err);
      toast.error(err.message || 'Failed to load testimonials');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, featuredOnly]);

  // Open Modal for Create
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormData({
      client_id: '',
      client_name: '',
      package_name: '',
      rating: 5,
      feedback_text: '',
      testimonial_date: new Date().toISOString().split('T')[0],
      screenshot_url: '',
      is_featured: true,
      is_verified: true,
      branch_id: currentUser?.branch_id || '',
    });
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEditModal = (item: RATestimonial) => {
    setEditingItem(item);
    setFormData({
      client_id: item.client_id || '',
      client_name: item.client_name,
      package_name: item.package_name || '',
      rating: item.rating,
      feedback_text: item.feedback_text,
      testimonial_date: item.testimonial_date ? item.testimonial_date.split('T')[0] : new Date().toISOString().split('T')[0],
      screenshot_url: item.screenshot_url || '',
      is_featured: Boolean(item.is_featured),
      is_verified: Boolean(item.is_verified),
      branch_id: item.branch_id || currentUser?.branch_id || '',
    });
    setIsModalOpen(true);
  };

  // When a client is selected from dropdown, auto-fill name and package
  const handleSelectClient = (clientId: string) => {
    const selected = clients.find((c) => c.id === clientId);
    if (selected) {
      setFormData((prev) => ({
        ...prev,
        client_id: selected.id,
        client_name: selected.client_name,
        package_name: selected.package,
        branch_id: selected.branch_id || prev.branch_id,
      }));
    } else {
      setFormData((prev) => ({ ...prev, client_id: '' }));
    }
  };

  // Save Testimonial
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_name.trim() || !formData.feedback_text.trim()) {
      toast.error('Client name and feedback content are required');
      return;
    }

    try {
      setSaving(true);
      if (editingItem) {
        await raService.updateTestimonial(editingItem.id, {
          ...formData,
          screenshot_url: formData.screenshot_url || undefined,
        });
        toast.success('Testimonial updated successfully');
      } else {
        await raService.createTestimonial({
          ...formData,
          screenshot_url: formData.screenshot_url || undefined,
        });
        toast.success('Testimonial published to wall');
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error('Save testimonial error:', err);
      toast.error(err.message || 'Failed to save testimonial');
    } finally {
      setSaving(false);
    }
  };

  // Delete Testimonial
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete testimonial from "${name}"?`)) return;
    try {
      await raService.deleteTestimonial(id);
      toast.success('Testimonial deleted');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete testimonial');
    }
  };

  // Toggle Featured Quick Action
  const handleToggleFeatured = async (item: RATestimonial) => {
    try {
      await raService.updateTestimonial(item.id, { is_featured: !item.is_featured });
      toast.success(item.is_featured ? 'Removed from featured' : 'Marked as featured');
      loadData();
    } catch (err: any) {
      toast.error('Failed to update status');
    }
  };

  // Client search filtering
  const filteredTestimonials = useMemo(() => {
    if (!searchQuery.trim()) return testimonials;
    const q = searchQuery.toLowerCase();
    return testimonials.filter(
      (t) =>
        t.client_name.toLowerCase().includes(q) ||
        t.package_name?.toLowerCase().includes(q) ||
        t.feedback_text.toLowerCase().includes(q)
    );
  }, [testimonials, searchQuery]);

  // Overall statistics
  const stats = useMemo(() => {
    const total = testimonials.length;
    const fiveStars = testimonials.filter((t) => t.rating === 5).length;
    const verified = testimonials.filter((t) => t.is_verified).length;
    const featured = testimonials.filter((t) => t.is_featured).length;
    const avg = total > 0 ? (testimonials.reduce((sum, t) => sum + t.rating, 0) / total).toFixed(1) : '5.0';
    return { total, fiveStars, verified, featured, avg };
  }, [testimonials]);

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 pb-16">
        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-card)] p-6 rounded-2xl shadow-sm border border-[var(--border)]">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-600/10 dark:bg-purple-500/20 rounded-xl text-purple-600 dark:text-purple-400">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                  Client Testimonials & Feedback Hub
                </h1>
                <p className="text-sm text-[var(--text-secondary)]">
                  Track client appreciation, WhatsApp proof screenshots, ratings, and testimonials linked to RA subscriptions.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-3">
            {hasMultiBranchAccess && (
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="px-3.5 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)] focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Branches ({branches.length})</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}

            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 shadow transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Add Testimonial
            </button>
          </div>
        </div>

        {/* Metrics Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="p-4 bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border)]">
            <span className="text-xs font-semibold uppercase text-[var(--text-secondary)] block mb-1">
              Average Rating
            </span>
            <div className="text-2xl font-black text-amber-500 flex items-center gap-1.5">
              <span>{stats.avg}</span>
              <span className="text-xl">★</span>
            </div>
          </div>

          <div className="p-4 bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border)]">
            <span className="text-xs font-semibold uppercase text-[var(--text-secondary)] block mb-1">
              Total Reviews
            </span>
            <div className="text-2xl font-bold text-[var(--text-primary)]">
              {stats.total}
            </div>
          </div>

          <div className="p-4 bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border)]">
            <span className="text-xs font-semibold uppercase text-[var(--text-secondary)] block mb-1">
              5-Star Ratings
            </span>
            <div className="text-2xl font-bold text-emerald-400">
              {stats.fiveStars}
            </div>
          </div>

          <div className="p-4 bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border)]">
            <span className="text-xs font-semibold uppercase text-[var(--text-secondary)] block mb-1">
              Verified Reviews
            </span>
            <div className="text-2xl font-bold text-[var(--accent)]">
              {stats.verified}
            </div>
          </div>

          <div className="p-4 bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border)]">
            <span className="text-xs font-semibold uppercase text-[var(--text-secondary)] block mb-1">
              Featured on Wall
            </span>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.featured}
            </div>
          </div>
        </div>

        {/* Filters and View Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-card)] p-4 rounded-2xl shadow-sm border border-[var(--border)]">
          <div className="flex items-center gap-3 flex-wrap flex-1">
            <div className="relative min-w-[240px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search testimonials..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)]"
              />
              <svg className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer ml-2">
              <input
                type="checkbox"
                checked={featuredOnly}
                onChange={(e) => setFeaturedOnly(e.target.checked)}
                className="rounded text-purple-600 focus:ring-purple-500"
              />
              <span>Featured Only</span>
            </label>
          </div>

          <div className="flex items-center rounded-xl bg-[var(--bg-hover-2)] p-1 border border-[var(--border)] dark:border-gray-600">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'cards'
                  ? 'bg-[var(--bg-card)] text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Showcase Wall
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'table'
                  ? 'bg-[var(--bg-card)] text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Data Table
            </button>
          </div>
        </div>

        {/* Content: Showcase Cards vs Table */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-56 bg-gray-200 dark:bg-gray-700/50 rounded-2xl"></div>
            ))}
          </div>
        ) : filteredTestimonials.length === 0 ? (
          <div className="bg-[var(--bg-card)] rounded-2xl p-12 text-center text-[var(--text-secondary)] border border-[var(--border)]">
            <svg className="w-16 h-16 mx-auto text-purple-300 dark:text-purple-800 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">No testimonials found</h3>
            <p className="text-xs mt-1">Start collecting client feedback and appreciation to build social proof.</p>
            <button
              onClick={handleOpenCreateModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-purple-600 text-white hover:bg-purple-700"
            >
              Add First Testimonial
            </button>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTestimonials.map((item) => (
              <div
                key={item.id}
                className="bg-[var(--bg-card)] rounded-2xl p-6 shadow-sm border border-[var(--border)] flex flex-col justify-between hover:shadow-md transition"
              >
                <div>
                  {/* Top line: Stars & Badges */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1 text-amber-400 text-lg">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className={i < item.rating ? 'text-amber-400' : 'text-gray-200 dark:text-gray-700'}>
                          ★
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.is_verified && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Verified
                        </span>
                      )}
                      {item.is_featured && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                          Featured
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Feedback Quote */}
                  <blockquote className="text-[var(--text-primary)] text-sm leading-relaxed mb-4 italic">
                    "{item.feedback_text}"
                  </blockquote>
                </div>

                {/* Bottom author & package info */}
                <div className="pt-4 border-t border-gray-100 dark:border-gray-700/60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs uppercase shadow-sm">
                        {item.client_name.substring(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[var(--text-primary)]">
                          {item.client_name}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)]">
                          {item.package_name || 'RA Advisory'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {item.screenshot_url && (
                        <a
                          href={item.screenshot_url}
                          target="_blank"
                          rel="noreferrer"
                          title="View Screenshot Proof"
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-[var(--bg-hover-2)] dark:hover:bg-emerald-900/30 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </a>
                      )}

                      <button
                        onClick={() => handleToggleFeatured(item)}
                        title={item.is_featured ? 'Remove from featured' : 'Pin to showcase'}
                        className={`p-1.5 rounded-lg transition ${
                          item.is_featured
                            ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/30'
                            : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover-2)]'
                        }`}
                      >
                        ★
                      </button>

                      <button
                        onClick={() => handleOpenEditModal(item)}
                        title="Edit Feedback"
                        className="p-1.5 rounded-lg text-blue-600 hover:bg-[var(--bg-hover-2)] dark:text-blue-400 dark:hover:bg-blue-900/30 transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>

                      {(isAdmin || isHOD) && (
                        <button
                          onClick={() => handleDelete(item.id, item.client_name)}
                          title="Delete Feedback"
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-[var(--bg-hover-2)] dark:hover:bg-rose-900/30 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase bg-[var(--panel-inset-soft)] text-[var(--text-secondary)] border-b border-[var(--border)]">
                  <tr>
                    <th className="py-3 px-4">Client Name</th>
                    <th className="py-3 px-4">Package</th>
                    <th className="py-3 px-4 text-center">Rating</th>
                    <th className="py-3 px-4">Feedback Quote</th>
                    <th className="py-3 px-4 text-center">Badges</th>
                    <th className="py-3 px-4 text-xs text-gray-500">Date Added</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredTestimonials.map((item) => (
                    <tr key={item.id} className="hover:bg-[var(--bg-hover-2)] transition">
                      <td className="py-3 px-4 font-bold text-[var(--text-primary)]">
                        {item.client_name}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-[var(--text-secondary)]">
                        {item.package_name || 'Standard'}
                      </td>
                      <td className="py-3 px-4 text-center text-amber-500 font-bold">
                        {item.rating} ★
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--text-secondary)] max-w-xs truncate">
                        "{item.feedback_text}"
                      </td>
                      <td className="py-3 px-4 text-center space-x-1">
                        {item.is_verified && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                            Verified
                          </span>
                        )}
                        {item.is_featured && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                            Featured
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500">
                        {item.testimonial_date ? new Date(item.testimonial_date).toLocaleDateString('en-IN') : '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1 rounded text-blue-600 hover:bg-[var(--bg-hover-2)]"
                          >
                            Edit
                          </button>
                          {(isAdmin || isHOD) && (
                            <button
                              onClick={() => handleDelete(item.id, item.client_name)}
                              className="p-1 rounded text-rose-600 hover:bg-[var(--bg-hover-2)] ml-1"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal: Add/Edit Testimonial */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-[var(--bg-card)] w-full max-w-lg rounded-2xl shadow-2xl border border-[var(--border)] overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-[var(--border)] bg-[var(--bg-card-2)]">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  {editingItem ? 'Edit Testimonial & Feedback' : 'Add New Client Testimonial'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Select Existing Client (Optional)
                  </label>
                  <select
                    value={formData.client_id}
                    onChange={(e) => handleSelectClient(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)]"
                  >
                    <option value="">-- Choose Client or Enter Name Below --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.client_name} ({c.package})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Client Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.client_name}
                      onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                      placeholder="e.g. Anand Sharma"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Package Name
                    </label>
                    <input
                      type="text"
                      value={formData.package_name}
                      onChange={(e) => setFormData({ ...formData, package_name: e.target.value })}
                      placeholder="e.g. Option Premium"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Rating (1 to 5 Stars)
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFormData({ ...formData, rating: star })}
                        className={`text-2xl transition hover:scale-125 ${
                          star <= formData.rating ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'
                        }`}
                      >
                        ★
                      </button>
                    ))}
                    <span className="text-xs font-bold text-gray-600 dark:text-[var(--text-muted)] ml-2">
                      {formData.rating} Stars
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Client Feedback / Appreciation Quote <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={formData.feedback_text}
                    onChange={(e) => setFormData({ ...formData, feedback_text: e.target.value })}
                    placeholder="Enter what the client said regarding advisory calls..."
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Screenshot Proof URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={formData.screenshot_url}
                    onChange={(e) => setFormData({ ...formData, screenshot_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)]"
                  />
                </div>

                <div className="flex items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_featured}
                      onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Showcase on Wall</span>
                  </label>

                  <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_verified}
                      onChange={(e) => setFormData({ ...formData, is_verified: e.target.checked })}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Verified Review</span>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover-2)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 text-sm font-bold rounded-xl bg-purple-600 text-white hover:bg-purple-700 shadow transition"
                  >
                    {saving ? 'Saving...' : 'Save Feedback'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default RATestimonialsPage;
