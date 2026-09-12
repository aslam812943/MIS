import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { raService } from '../../services/ra.service';
import { orgService } from '../../services/org.service';
import { authService } from '../../services/auth.service';
import type {
  RAClient,
  RAPackage,
  KRAUpdationStatus,
  CalculatedSubscriptionStatus
} from '../../types/ra.types';

// Segments for packages
const PACKAGE_SEGMENTS = [
  'Equity',
  'Futures & Options',
  'Commodity',
  'Currency',
  'Combo / Multi-Asset',
  'HNI Alpha',
  'Other'
];

const KRA_STATUSES: KRAUpdationStatus[] = ['Pending', 'In Progress', 'Completed', 'Updated'];

interface RADataEntryPageProps {
  defaultTab?: 'clients' | 'packages' | 'renewals' | 'payments' | 'kyc';
}

export const RADataEntryPage: React.FC<RADataEntryPageProps> = ({ defaultTab }) => {
  const currentUser = authService.getCurrentUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get('tab') as 'clients' | 'packages' | 'renewals' | 'payments' | 'kyc' | null;

  const initialTab = defaultTab || (queryTab && ['clients', 'packages', 'renewals', 'payments', 'kyc'].includes(queryTab) ? queryTab : 'clients');

  const [activeTab, setActiveTab] = useState<'clients' | 'packages' | 'renewals' | 'payments' | 'kyc'>(initialTab);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    } else if (queryTab && ['clients', 'packages', 'renewals', 'payments', 'kyc'].includes(queryTab)) {
      setActiveTab(queryTab);
    }
  }, [defaultTab, queryTab]);

  const handleTabChange = (tab: 'clients' | 'packages' | 'renewals' | 'payments' | 'kyc') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Multi-branch state
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const hasMultiBranchAccess = ['admin', 'ceo', 'managing_director', 'director', 'executive', 'hod'].includes(
    currentUser?.role || ''
  );

  // Data states
  const [clients, setClients] = useState<RAClient[]>([]);
  const [packagesList, setPackagesList] = useState<RAPackage[]>([]);
  const [packagesStats, setPackagesStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [kraFilter, setKraFilter] = useState<string>('all');
  const [packageFilter, setPackageFilter] = useState<string>('all');
  const [renewalDaysFilter, setRenewalDaysFilter] = useState<number>(30);
  const [kycTabFilter, setKycTabFilter] = useState<'all' | 'kyc_pending' | 'kra_pending' | 'ckyc_missing' | 'kyc_completed'>('all');

  // Modal States - Client
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<RAClient | null>(null);
  const [saving, setSaving] = useState(false);

  // Modal States - Package
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<RAPackage | null>(null);
  const [savingPackage, setSavingPackage] = useState(false);

  // Modal States - Quick Testimonial
  const [isTestimonialModalOpen, setIsTestimonialModalOpen] = useState(false);
  const [selectedClientForTestimonial, setSelectedClientForTestimonial] = useState<RAClient | null>(null);

  // Form State - Client (19 parameters)
  const [formData, setFormData] = useState({
    client_name: '',
    package: '',
    amount: 0,
    payment_date: '',
    mobile_number: '',
    research_date: '',
    email_id: '',
    sw_code: '',
    pan: '',
    aadhaar_no: '',
    reference: '',
    kyc_fetch_date: '',
    kra_modify_date: '',
    kra_reference_number: '',
    kra_updation_status: 'Completed' as KRAUpdationStatus,
    kra_user: '',
    ckyc_number: '',
    remarks: '',
    subscription_start_date: '',
    subscription_end_date: '',
    branch_id: '',
  });

  // Form State - Package
  const [packageFormData, setPackageFormData] = useState({
    name: '',
    description: '',
    segment: 'Equity',
    price: 25000,
    duration_days: 90,
    is_active: true
  });

  // Form State - Testimonial
  const [testimonialForm, setTestimonialForm] = useState({
    rating: 5,
    feedback_text: '',
    screenshot_url: '',
    is_featured: false,
    is_verified: true,
  });

  // Load Branches
  useEffect(() => {
    if (hasMultiBranchAccess) {
      orgService.getBranches().then(setBranches).catch(() => {});
    }
  }, [hasMultiBranchAccess]);

  // Load clients, packages catalog, and package stats
  const loadData = async () => {
    try {
      setLoading(true);
      const [clientData, pkgCatalog, packageData] = await Promise.all([
        raService.getClients({ branchId: selectedBranch || undefined }),
        raService.getPackages(false).catch(() => []),
        raService.getPackageReport(selectedBranch || undefined).catch(() => ({})),
      ]);
      setClients(clientData);
      setPackagesList(pkgCatalog);
      setPackagesStats(packageData);
    } catch (err: any) {
      console.error('Error loading RA data:', err);
      toast.error(err.message || 'Failed to fetch client records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch]);

  // Active packages for dropdown selection
  const activePackages = useMemo(() => {
    return packagesList.filter((p) => p.is_active);
  }, [packagesList]);

  // KYC Stats Calculation
  const kycMetrics = useMemo(() => {
    const total = clients.length;
    const kycCompleted = clients.filter((c) => !!c.kyc_fetch_date).length;
    const kycPending = total - kycCompleted;
    const kraCompleted = clients.filter(
      (c) => c.kra_updation_status === 'Completed' || c.kra_updation_status === 'Updated'
    ).length;
    const kraPending = total - kraCompleted;
    const ckycAvailable = clients.filter((c) => !!c.ckyc_number && c.ckyc_number.trim() !== '').length;
    const ckycMissing = total - ckycAvailable;

    return {
      total,
      kycCompleted,
      kycPending,
      kraCompleted,
      kraPending,
      ckycAvailable,
      ckycMissing,
    };
  }, [clients]);

  // Filtered Clients for KYC Tab
  const kycFilteredClients = useMemo(() => {
    return clients.filter((c) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.client_name?.toLowerCase().includes(q);
        const matchesPAN = c.pan?.toLowerCase().includes(q);
        const matchesMobile = c.mobile_number?.includes(q);
        const matchesCkyc = c.ckyc_number?.toLowerCase().includes(q);
        const matchesKraUser = c.kra_user?.toLowerCase().includes(q);
        if (!matchesName && !matchesPAN && !matchesMobile && !matchesCkyc && !matchesKraUser) return false;
      }

      if (kycTabFilter === 'kyc_pending') {
        return !c.kyc_fetch_date;
      }
      if (kycTabFilter === 'kyc_completed') {
        return !!c.kyc_fetch_date;
      }
      if (kycTabFilter === 'kra_pending') {
        return c.kra_updation_status !== 'Completed' && c.kra_updation_status !== 'Updated';
      }
      if (kycTabFilter === 'ckyc_missing') {
        return !c.ckyc_number || c.ckyc_number.trim() === '';
      }

      return true;
    });
  }, [clients, searchQuery, kycTabFilter]);

  // When package dropdown is changed in client form, auto-fill price & duration
  const handlePackageSelectChange = (packageName: string) => {
    const matched = packagesList.find((p) => p.name === packageName);
    const startStr = formData.subscription_start_date || new Date().toISOString().split('T')[0];
    const durationDays = matched ? matched.duration_days : 90;

    const startDate = new Date(startStr);
    const calculatedEnd = new Date(startDate);
    calculatedEnd.setDate(calculatedEnd.getDate() + durationDays);

    setFormData((prev) => ({
      ...prev,
      package: packageName,
      amount: matched ? matched.price : prev.amount,
      subscription_start_date: startStr,
      subscription_end_date: calculatedEnd.toISOString().split('T')[0]
    }));
  };

  // Open modal for Create Client
  const handleOpenCreateModal = () => {
    setEditingClient(null);
    const todayStr = new Date().toISOString().split('T')[0];
    const firstActivePkg = activePackages[0];
    const defaultDuration = firstActivePkg ? firstActivePkg.duration_days : 90;
    const defaultPrice = firstActivePkg ? firstActivePkg.price : 15000;

    const defaultEnd = new Date();
    defaultEnd.setDate(defaultEnd.getDate() + defaultDuration);

    setFormData({
      client_name: '',
      package: firstActivePkg ? firstActivePkg.name : '',
      amount: defaultPrice,
      payment_date: todayStr,
      mobile_number: '',
      research_date: todayStr,
      email_id: '',
      sw_code: '',
      pan: '',
      aadhaar_no: '',
      reference: '',
      kyc_fetch_date: '',
      kra_modify_date: '',
      kra_reference_number: '',
      kra_updation_status: 'Completed',
      kra_user: currentUser?.full_name || currentUser?.email || '',
      ckyc_number: '',
      remarks: '',
      subscription_start_date: todayStr,
      subscription_end_date: defaultEnd.toISOString().split('T')[0],
      branch_id: currentUser?.branch_id || '',
    });
    setIsClientModalOpen(true);
  };

  // Open modal for Edit Client
  const handleOpenEditModal = (client: RAClient) => {
    setEditingClient(client);
    setFormData({
      client_name: client.client_name,
      package: client.package || '',
      amount: Number(client.amount) || 0,
      payment_date: client.payment_date ? client.payment_date.split('T')[0] : '',
      mobile_number: client.mobile_number || '',
      research_date: client.research_date ? client.research_date.split('T')[0] : '',
      email_id: client.email_id || '',
      sw_code: client.sw_code || '',
      pan: client.pan || '',
      aadhaar_no: client.aadhaar_no || '',
      reference: client.reference || '',
      kyc_fetch_date: client.kyc_fetch_date ? client.kyc_fetch_date.split('T')[0] : '',
      kra_modify_date: client.kra_modify_date ? client.kra_modify_date.split('T')[0] : '',
      kra_reference_number: client.kra_reference_number || '',
      kra_updation_status: (client.kra_updation_status as KRAUpdationStatus) || 'Completed',
      kra_user: client.kra_user || '',
      ckyc_number: client.ckyc_number || '',
      remarks: client.remarks || '',
      subscription_start_date: client.subscription_start_date ? client.subscription_start_date.split('T')[0] : '',
      subscription_end_date: client.subscription_end_date ? client.subscription_end_date.split('T')[0] : '',
      branch_id: client.branch_id || currentUser?.branch_id || '',
    });
    setIsClientModalOpen(true);
  };

  // Save Client Form
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_name.trim()) {
      toast.error('Client name is required');
      return;
    }
    if (!formData.package.trim()) {
      toast.error('Please select an active advisory package');
      return;
    }

    try {
      setSaving(true);
      if (editingClient) {
        await raService.updateClient(editingClient.id, formData);
        toast.success(`Client ${formData.client_name} updated successfully!`);
      } else {
        await raService.createClient(formData);
        toast.success(`Client ${formData.client_name} created successfully!`);
      }
      setIsClientModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error('Failed to save client:', err);
      toast.error(err.message || 'Failed to save client entry');
    } finally {
      setSaving(false);
    }
  };

  // Delete Client
  const handleDeleteClient = async (client: RAClient) => {
    if (!window.confirm(`Are you sure you want to delete client record for "${client.client_name}"?`)) {
      return;
    }
    try {
      await raService.deleteClient(client.id);
      toast.success('Client record removed');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete client');
    }
  };

  // Open Create Package Modal
  const handleOpenCreatePackageModal = () => {
    setEditingPackage(null);
    setPackageFormData({
      name: '',
      description: '',
      segment: 'Equity',
      price: 25000,
      duration_days: 90,
      is_active: true
    });
    setIsPackageModalOpen(true);
  };

  // Open Edit Package Modal
  const handleOpenEditPackageModal = (pkg: RAPackage) => {
    setEditingPackage(pkg);
    setPackageFormData({
      name: pkg.name,
      description: pkg.description || '',
      segment: pkg.segment || 'Equity',
      price: Number(pkg.price) || 0,
      duration_days: Number(pkg.duration_days) || 90,
      is_active: pkg.is_active
    });
    setIsPackageModalOpen(true);
  };

  // Save Package Form
  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!packageFormData.name.trim()) {
      toast.error('Package name is required');
      return;
    }
    if (packageFormData.price < 0) {
      toast.error('Price cannot be negative');
      return;
    }
    if (packageFormData.duration_days <= 0) {
      toast.error('Duration must be at least 1 day');
      return;
    }

    try {
      setSavingPackage(true);
      if (editingPackage) {
        await raService.updatePackage(editingPackage.id, packageFormData);
        toast.success(`Package "${packageFormData.name}" updated!`);
      } else {
        await raService.createPackage(packageFormData);
        toast.success(`Package "${packageFormData.name}" created successfully!`);
      }
      setIsPackageModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error('Failed to save package:', err);
      toast.error(err.message || 'Failed to save package');
    } finally {
      setSavingPackage(false);
    }
  };

  // Toggle Package Active Status
  const handleTogglePackageStatus = async (pkg: RAPackage) => {
    try {
      await raService.updatePackage(pkg.id, { is_active: !pkg.is_active });
      toast.success(`Package "${pkg.name}" is now ${!pkg.is_active ? 'Active' : 'Inactive'}`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  // Delete Package
  const handleDeletePackage = async (pkg: RAPackage) => {
    if (!window.confirm(`Are you sure you want to delete package "${pkg.name}"?`)) {
      return;
    }
    try {
      await raService.deletePackage(pkg.id);
      toast.success(`Package "${pkg.name}" removed`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete package');
    }
  };

  // Open Quick Testimonial Modal
  const handleOpenTestimonialModal = (client: RAClient) => {
    setSelectedClientForTestimonial(client);
    setTestimonialForm({
      rating: 5,
      feedback_text: '',
      screenshot_url: '',
      is_featured: false,
      is_verified: true,
    });
    setIsTestimonialModalOpen(true);
  };

  // Save Quick Testimonial
  const handleSaveTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientForTestimonial) return;
    if (!testimonialForm.feedback_text.trim()) {
      toast.error('Please enter the client feedback/quote');
      return;
    }

    try {
      setSaving(true);
      await raService.createTestimonial({
        client_id: selectedClientForTestimonial.id,
        client_name: selectedClientForTestimonial.client_name,
        package_name: selectedClientForTestimonial.package,
        rating: testimonialForm.rating,
        feedback_text: testimonialForm.feedback_text,
        screenshot_url: testimonialForm.screenshot_url || undefined,
        testimonial_date: new Date().toISOString().split('T')[0],
        is_featured: testimonialForm.is_featured,
        is_verified: testimonialForm.is_verified,
        branch_id: selectedClientForTestimonial.branch_id || undefined,
      });
      toast.success(`Feedback added for ${selectedClientForTestimonial.client_name}!`);
      setIsTestimonialModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save testimonial');
    } finally {
      setSaving(false);
    }
  };

  // Filtered Clients list
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.client_name?.toLowerCase().includes(q);
        const matchesMobile = c.mobile_number?.includes(q);
        const matchesEmail = c.email_id?.toLowerCase().includes(q);
        const matchesPAN = c.pan?.toLowerCase().includes(q);
        const matchesPkg = c.package?.toLowerCase().includes(q);
        const matchesSwCode = c.sw_code?.toLowerCase().includes(q);
        if (!matchesName && !matchesMobile && !matchesEmail && !matchesPAN && !matchesPkg && !matchesSwCode) {
          return false;
        }
      }

      // Status
      if (statusFilter !== 'all') {
        if (c.calculated_status !== statusFilter) return false;
      }

      // KRA
      if (kraFilter !== 'all') {
        if (c.kra_updation_status !== kraFilter) return false;
      }

      // Package
      if (packageFilter !== 'all') {
        if (c.package !== packageFilter) return false;
      }

      return true;
    });
  }, [clients, searchQuery, statusFilter, kraFilter, packageFilter]);

  // Renewals List
  const renewalsClients = useMemo(() => {
    return clients.filter((c) => {
      const days = c.days_left;
      if (days === undefined || days === null) return false;
      if (renewalDaysFilter === -1) {
        return days < 0;
      }
      return days >= 0 && days <= renewalDaysFilter;
    }).sort((a, b) => (a.days_left ?? 999) - (b.days_left ?? 999));
  }, [clients, renewalDaysFilter]);

  // Helper Badge Colors
  const getStatusBadge = (status?: CalculatedSubscriptionStatus) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
      case 'EXPIRING SOON':
        return 'bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse';
      case 'EXPIRED':
        return 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
      default:
        return 'bg-sky-500/15 text-sky-400 border border-sky-500/30';
    }
  };

  const getKRABadge = (kra?: KRAUpdationStatus | null) => {
    switch (kra) {
      case 'Completed':
      case 'Updated':
        return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
      case 'In Progress':
        return 'bg-blue-500/15 text-blue-400 border border-blue-500/30';
      case 'Pending':
        return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
      default:
        return 'bg-gray-500/15 text-gray-400 border border-gray-500/30';
    }
  };

  const formatMoney = (val?: number) => {
    return `₹${Number(val || 0).toLocaleString('en-IN')}`;
  };

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 pb-16">
        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-card)] p-6 rounded-2xl shadow-sm border border-[var(--border)]">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[var(--accent-bg)] rounded-xl text-[var(--accent)] border border-[var(--accent-bg-2)]">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                  RA Operations & Client Data Entry
                </h1>
                <p className="text-sm text-[var(--text-secondary)]">
                  Manage client subscriptions, package catalog, payments, renewals, and compliance (19 parameters).
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-3">
            {hasMultiBranchAccess && (
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="px-3.5 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] outline-none"
              >
                <option value="">All Branches ({branches.length})</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={handleOpenCreatePackageModal}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              + Create Package
            </button>

            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)] shadow transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              New Client Entry
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--border)] space-x-2 overflow-x-auto pb-1">
          <button
            onClick={() => handleTabChange('clients')}
            className={`py-3 px-5 text-sm font-semibold border-b-2 whitespace-nowrap transition flex items-center gap-2 ${
              activeTab === 'clients'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span>Client Directory</span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--accent-bg)] text-[var(--accent)] border border-[var(--accent-bg-2)] font-bold">
              {clients.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('packages')}
            className={`py-3 px-5 text-sm font-semibold border-b-2 whitespace-nowrap transition flex items-center gap-2 ${
              activeTab === 'packages'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span>Package Catalog & Analytics</span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--accent-bg)] text-[var(--accent)] border border-[var(--accent-bg-2)] font-bold">
              {packagesList.length} Packages
            </span>
          </button>

          <button
            onClick={() => handleTabChange('renewals')}
            className={`py-3 px-5 text-sm font-semibold border-b-2 whitespace-nowrap transition flex items-center gap-2 ${
              activeTab === 'renewals'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span>Renewal Tracker</span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold">
              {clients.filter((c) => (c.days_left ?? 999) <= 30 && (c.days_left ?? 999) >= 0).length} Due
            </span>
          </button>

          <button
            onClick={() => handleTabChange('kyc')}
            className={`py-3 px-5 text-sm font-semibold border-b-2 whitespace-nowrap transition flex items-center gap-2 ${
              activeTab === 'kyc'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span>KYC / KRA Tracking</span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 font-bold">
              {kycMetrics.kycPending + kycMetrics.kraPending} Pending
            </span>
          </button>

          <button
            onClick={() => handleTabChange('payments')}
            className={`py-3 px-5 text-sm font-semibold border-b-2 whitespace-nowrap transition flex items-center gap-2 ${
              activeTab === 'payments'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span>Payment Ledger</span>
          </button>
        </div>

        {/* TAB 1: CLIENTS DIRECTORY */}
        {activeTab === 'clients' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-[var(--bg-card)] p-4 rounded-2xl shadow-sm border border-[var(--border)]">
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Search Directory</label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Name, Phone, PAN, SW Code, Package..."
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] outline-none"
                  />
                  <svg className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Package Filter</label>
                <select
                  value={packageFilter}
                  onChange={(e) => setPackageFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] outline-none"
                >
                  <option value="all">All Packages ({packagesList.length})</option>
                  {packagesList.map((pkg) => (
                    <option key={pkg.id} value={pkg.name}>
                      {pkg.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Subscription Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="EXPIRING SOON">EXPIRING SOON (≤30 Days)</option>
                  <option value="EXPIRED">EXPIRED</option>
                  <option value="UPCOMING">UPCOMING</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setKraFilter('all');
                    setPackageFilter('all');
                  }}
                  className="w-full py-2 px-3 text-sm font-medium rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover-2)] hover:text-[var(--text-primary)] transition"
                >
                  Reset Filters
                </button>
              </div>
            </div>

            {/* Clients Table */}
            <div className="bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border)] overflow-hidden">
              {loading ? (
                <div className="p-12 text-center text-[var(--text-secondary)]">Loading client directory...</div>
              ) : filteredClients.length === 0 ? (
                <div className="p-12 text-center text-[var(--text-secondary)]">
                  <svg className="w-12 h-12 mx-auto text-[var(--text-muted)] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <p className="font-semibold text-base">No client records match your filters.</p>
                  <p className="text-xs mt-1">Try resetting the filters or onboard a new client.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase bg-[var(--panel-inset-soft)] text-[var(--text-secondary)] border-b border-[var(--border)]">
                      <tr>
                        <th className="py-3 px-4">Client Details</th>
                        <th className="py-3 px-4">Package</th>
                        <th className="py-3 px-4">Validity Range</th>
                        <th className="py-3 px-4 text-right">Fee Paid</th>
                        <th className="py-3 px-4 text-center">KRA Status</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4">KRA User / Ref</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {filteredClients.map((client) => (
                        <tr key={client.id} className="hover:bg-[var(--bg-hover-2)] transition text-[var(--text-primary)]">
                          {/* Client Info */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-[var(--text-primary)]">
                              {client.client_name}
                            </div>
                            <div className="text-xs font-mono text-[var(--text-secondary)]">
                              {client.mobile_number || '-'} {client.email_id ? `• ${client.email_id}` : ''}
                            </div>
                            {client.pan && (
                              <div className="text-[11px] text-[var(--text-muted)]">
                                PAN: <span className="font-mono">{client.pan}</span> {client.sw_code ? `• SW: ${client.sw_code}` : ''}
                              </div>
                            )}
                          </td>

                          {/* Package Info */}
                          <td className="py-3 px-4">
                            <span className="font-medium text-[var(--text-primary)] block">
                              {client.package}
                            </span>
                          </td>

                          {/* Dates */}
                          <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                            <div>From: {client.subscription_start_date ? new Date(client.subscription_start_date).toLocaleDateString('en-IN') : '-'}</div>
                            <div>To: {client.subscription_end_date ? new Date(client.subscription_end_date).toLocaleDateString('en-IN') : '-'}</div>
                          </td>

                          {/* Financials */}
                          <td className="py-3 px-4 text-right">
                            <div className="font-bold text-emerald-400">
                              {formatMoney(client.amount)}
                            </div>
                          </td>

                          {/* KRA Status */}
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${getKRABadge(client.kra_updation_status)}`}>
                              {client.kra_updation_status || 'Pending'}
                            </span>
                          </td>

                          {/* Subscription Status */}
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${getStatusBadge(client.calculated_status)}`}>
                              {client.calculated_status || 'ACTIVE'}
                            </span>
                          </td>

                          {/* KRA User / Ref */}
                          <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                            <div>{client.kra_user || '-'}</div>
                            {client.kra_reference_number && (
                              <div className="text-[10px] text-[var(--text-muted)] font-mono">Ref: {client.kra_reference_number}</div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenTestimonialModal(client)}
                                title="Add Testimonial / Feedback"
                                className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-500/20 transition"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>

                              <button
                                onClick={() => handleOpenEditModal(client)}
                                title="Edit Client"
                                className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/20 transition"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>

                              <button
                                onClick={() => handleDeleteClient(client)}
                                title="Delete Client"
                                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PACKAGES CATALOG & ANALYTICS */}
        {activeTab === 'packages' && (
          <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[var(--bg-card)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  Configured Advisory Packages ({packagesList.length})
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Only <strong>Active</strong> packages defined here appear in the Client Onboarding dropdown.
                </p>
              </div>
              <button
                onClick={handleOpenCreatePackageModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)] transition shadow"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Create New Package
              </button>
            </div>

            {/* Packages Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {packagesList.map((pkg) => {
                const stat = packagesStats[pkg.name] || { clients: 0, revenue: 0, active: 0 };
                return (
                  <div
                    key={pkg.id}
                    className={`bg-[var(--bg-card)] rounded-2xl p-5 border transition flex flex-col justify-between ${
                      pkg.is_active ? 'border-[var(--border)] hover:border-[var(--accent)]' : 'border-dashed border-gray-600 opacity-70'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-[var(--accent-bg)] text-[var(--accent)] border border-[var(--accent-bg-2)]">
                          {pkg.segment || 'Equity'}
                        </span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            pkg.is_active
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {pkg.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-[var(--text-primary)] mt-3">
                        {pkg.name}
                      </h4>
                      <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mt-1 min-h-[32px]">
                        {pkg.description || 'No description provided.'}
                      </p>

                      <div className="mt-4 pt-3 border-t border-[var(--border)] grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[var(--text-muted)] block text-[10px] uppercase">Base Fee</span>
                          <span className="font-bold text-base text-emerald-400">{formatMoney(pkg.price)}</span>
                        </div>
                        <div>
                          <span className="text-[var(--text-muted)] block text-[10px] uppercase">Validity</span>
                          <span className="font-bold text-base text-[var(--text-primary)]">{pkg.duration_days} Days</span>
                        </div>
                      </div>

                      <div className="mt-3 p-2.5 rounded-xl bg-[var(--panel-inset-soft)] text-xs flex justify-between">
                        <span className="text-[var(--text-secondary)]">Subscribers: <strong className="text-[var(--text-primary)]">{stat.clients || 0}</strong></span>
                        <span className="text-[var(--text-secondary)]">Revenue: <strong className="text-emerald-400">{formatMoney(stat.revenue)}</strong></span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleTogglePackageStatus(pkg)}
                        className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                      >
                        {pkg.is_active ? 'Deactivate' : 'Activate'}
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditPackageModal(pkg)}
                          className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/20 transition"
                          title="Edit Package"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeletePackage(pkg)}
                          className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition"
                          title="Delete Package"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: RENEWAL TRACKER */}
        {activeTab === 'renewals' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--bg-card)] p-4 rounded-2xl border border-[var(--border)] shadow-sm">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">Upcoming & Expired Subscriptions</h3>
                <p className="text-xs text-[var(--text-secondary)]">Follow up with clients before advisory coverage expires.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRenewalDaysFilter(7)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    renewalDaysFilter === 7
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      : 'bg-[var(--panel-inset-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Next 7 Days
                </button>
                <button
                  onClick={() => setRenewalDaysFilter(30)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    renewalDaysFilter === 30
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-[var(--panel-inset-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Next 30 Days
                </button>
                <button
                  onClick={() => setRenewalDaysFilter(-1)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    renewalDaysFilter === -1
                      ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                      : 'bg-[var(--panel-inset-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Already Expired
                </button>
              </div>
            </div>

            <div className="bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase bg-[var(--panel-inset-soft)] text-[var(--text-secondary)] border-b border-[var(--border)]">
                    <tr>
                      <th className="py-3 px-4">Client</th>
                      <th className="py-3 px-4">Package</th>
                      <th className="py-3 px-4">End Date</th>
                      <th className="py-3 px-4">Days Left</th>
                      <th className="py-3 px-4">Contact</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {renewalsClients.map((client) => {
                      const days = client.days_left ?? 0;
                      return (
                        <tr key={client.id} className="hover:bg-[var(--bg-hover-2)] transition text-[var(--text-primary)]">
                          <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">{client.client_name}</td>
                          <td className="py-3 px-4 text-[var(--text-secondary)]">{client.package}</td>
                          <td className="py-3 px-4 font-mono text-xs">{client.subscription_end_date ? new Date(client.subscription_end_date).toLocaleDateString('en-IN') : '-'}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${days < 0 ? 'bg-rose-500/15 text-rose-400' : days <= 7 ? 'bg-rose-500/15 text-rose-400 animate-pulse' : 'bg-amber-500/15 text-amber-400'}`}>
                              {days < 0 ? `Expired (${Math.abs(days)}d ago)` : `${days} Days Left`}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs font-mono text-[var(--text-secondary)]">{client.mobile_number || client.email_id || '-'}</td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleOpenEditModal(client)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)] transition"
                            >
                              Renew Subscription
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: KYC / KRA TRACKING (MATCHING GOOGLE MIS SPEC) */}
        {activeTab === 'kyc' && (
          <div className="space-y-6">
            {/* Top Bar with Title & Refresh */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[var(--bg-card)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span>KYC / KRA</span>
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  KYC, KRA and CKYC tracking across active client advisory accounts
                </p>
              </div>

              <button
                onClick={() => loadData()}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--accent)] transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>

            {/* 6 Metric KPI Cards Matching Google Apps Script */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {/* 1. KYC Completed */}
              <div
                onClick={() => setKycTabFilter('kyc_completed')}
                className={`p-4 rounded-2xl bg-[var(--bg-card)] border cursor-pointer transition-all hover:-translate-y-0.5 ${
                  kycTabFilter === 'kyc_completed' ? 'border-emerald-500 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500' : 'border-[var(--border)]'
                }`}
              >
                <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  KYC Completed
                </div>
                <div className="text-3xl font-extrabold text-emerald-400 mt-1">
                  {kycMetrics.kycCompleted}
                </div>
              </div>

              {/* 2. KYC Pending */}
              <div
                onClick={() => setKycTabFilter('kyc_pending')}
                className={`p-4 rounded-2xl bg-[var(--bg-card)] border cursor-pointer transition-all hover:-translate-y-0.5 ${
                  kycTabFilter === 'kyc_pending' ? 'border-amber-500 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500' : 'border-[var(--border)]'
                }`}
              >
                <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  KYC Pending
                </div>
                <div className="text-3xl font-extrabold text-amber-400 mt-1">
                  {kycMetrics.kycPending}
                </div>
              </div>

              {/* 3. KRA Completed */}
              <div
                onClick={() => setKycTabFilter('all')}
                className={`p-4 rounded-2xl bg-[var(--bg-card)] border cursor-pointer transition-all hover:-translate-y-0.5 ${
                  kycTabFilter === 'all' ? 'border-[var(--accent)] shadow-lg shadow-[var(--accent)]/10 ring-1 ring-[var(--accent)]' : 'border-[var(--border)]'
                }`}
              >
                <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  KRA Completed
                </div>
                <div className="text-3xl font-extrabold text-teal-400 mt-1">
                  {kycMetrics.kraCompleted}
                </div>
              </div>

              {/* 4. KRA Pending */}
              <div
                onClick={() => setKycTabFilter('kra_pending')}
                className={`p-4 rounded-2xl bg-[var(--bg-card)] border cursor-pointer transition-all hover:-translate-y-0.5 ${
                  kycTabFilter === 'kra_pending' ? 'border-rose-500 shadow-lg shadow-rose-500/10 ring-1 ring-rose-500' : 'border-[var(--border)]'
                }`}
              >
                <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  KRA Pending
                </div>
                <div className="text-3xl font-extrabold text-rose-400 mt-1">
                  {kycMetrics.kraPending}
                </div>
              </div>

              {/* 5. CKYC Available */}
              <div
                onClick={() => setKycTabFilter('all')}
                className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] cursor-pointer transition-all hover:-translate-y-0.5"
              >
                <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  CKYC Available
                </div>
                <div className="text-3xl font-extrabold text-sky-400 mt-1">
                  {kycMetrics.ckycAvailable}
                </div>
              </div>

              {/* 6. CKYC Missing */}
              <div
                onClick={() => setKycTabFilter('ckyc_missing')}
                className={`p-4 rounded-2xl bg-[var(--bg-card)] border cursor-pointer transition-all hover:-translate-y-0.5 ${
                  kycTabFilter === 'ckyc_missing' ? 'border-purple-500 shadow-lg shadow-purple-500/10 ring-1 ring-purple-500' : 'border-[var(--border)]'
                }`}
              >
                <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  CKYC Missing
                </div>
                <div className="text-3xl font-extrabold text-purple-400 mt-1">
                  {kycMetrics.ckycMissing}
                </div>
              </div>
            </div>

            {/* Compliance Filter Pills & Search */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[var(--bg-card)] p-4 rounded-2xl border border-[var(--border)]">
              <div className="flex items-center flex-wrap gap-2">
                <button
                  onClick={() => setKycTabFilter('all')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    kycTabFilter === 'all'
                      ? 'bg-[var(--accent)] text-slate-950'
                      : 'bg-[var(--panel-inset-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  All Clients ({clients.length})
                </button>
                <button
                  onClick={() => setKycTabFilter('kyc_pending')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    kycTabFilter === 'kyc_pending'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-[var(--panel-inset-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  KYC Pending ({kycMetrics.kycPending})
                </button>
                <button
                  onClick={() => setKycTabFilter('kra_pending')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    kycTabFilter === 'kra_pending'
                      ? 'bg-rose-500 text-white'
                      : 'bg-[var(--panel-inset-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  KRA Pending ({kycMetrics.kraPending})
                </button>
                <button
                  onClick={() => setKycTabFilter('ckyc_missing')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    kycTabFilter === 'ckyc_missing'
                      ? 'bg-purple-500 text-white'
                      : 'bg-[var(--panel-inset-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  CKYC Missing ({kycMetrics.ckycMissing})
                </button>
                <button
                  onClick={() => setKycTabFilter('kyc_completed')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    kycTabFilter === 'kyc_completed'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-[var(--panel-inset-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  KYC Verified ({kycMetrics.kycCompleted})
                </button>
              </div>

              <div className="w-full sm:w-64">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter name, PAN, mobile..."
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                />
              </div>
            </div>

            {/* Compliance Table */}
            <div className="bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase bg-[var(--panel-inset-soft)] text-[var(--text-secondary)] border-b border-[var(--border)]">
                    <tr>
                      <th className="py-3 px-4">Client Name & PAN</th>
                      <th className="py-3 px-4">KYC Fetch Date</th>
                      <th className="py-3 px-4 text-center">KRA Status</th>
                      <th className="py-3 px-4">KRA Reference Number</th>
                      <th className="py-3 px-4">KRA Verified User</th>
                      <th className="py-3 px-4">CKYC Number</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {kycFilteredClients.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-[var(--text-secondary)] text-sm">
                          No client records matching this compliance filter.
                        </td>
                      </tr>
                    ) : (
                      kycFilteredClients.map((client) => {
                        const isKycDone = !!client.kyc_fetch_date;
                        const isCkycDone = !!client.ckyc_number && client.ckyc_number.trim() !== '';
                        return (
                          <tr key={client.id} className="hover:bg-[var(--bg-hover-2)] transition text-[var(--text-primary)]">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-[var(--text-primary)]">{client.client_name}</div>
                              <div className="text-xs font-mono text-[var(--text-muted)]">
                                PAN: {client.pan || 'MISSING'} {client.mobile_number ? `• ${client.mobile_number}` : ''}
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              {isKycDone ? (
                                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold font-mono">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                  </svg>
                                  {new Date(client.kyc_fetch_date!).toLocaleDateString('en-IN')}
                                </span>
                              ) : (
                                <span className="text-xs text-amber-400 font-semibold">
                                  Pending KYC
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-center">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${getKRABadge(client.kra_updation_status)}`}>
                                {client.kra_updation_status || 'Pending'}
                              </span>
                            </td>

                            <td className="py-3 px-4 font-mono text-xs text-[var(--text-secondary)]">
                              {client.kra_reference_number || '-'}
                            </td>

                            <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                              {client.kra_user || '-'}
                            </td>

                            <td className="py-3 px-4 font-mono text-xs">
                              {isCkycDone ? (
                                <span className="text-sky-400 font-bold">{client.ckyc_number}</span>
                              ) : (
                                <span className="text-[var(--text-muted)] italic">Missing</span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleOpenEditModal(client)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--accent-bg)] text-[var(--accent)] border border-[var(--accent-bg-2)] hover:bg-[var(--accent)] hover:text-slate-950 transition"
                              >
                                Update KYC
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: PAYMENT LEDGER */}
        {activeTab === 'payments' && (
          <div className="bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border)] overflow-hidden">
            <div className="p-4 border-b border-[var(--border)] flex justify-between items-center">
              <h3 className="text-base font-bold text-[var(--text-primary)]">Audited Payment Ledger</h3>
              <span className="text-xs text-[var(--text-secondary)]">Includes Base Fee, 18% GST Breakdown, and Transaction References</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase bg-[var(--panel-inset-soft)] text-[var(--text-secondary)] border-b border-[var(--border)]">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Client Name</th>
                    <th className="py-3 px-4">Package</th>
                    <th className="py-3 px-4 text-right">Base Amount</th>
                    <th className="py-3 px-4 text-right">GST (18%)</th>
                    <th className="py-3 px-4 text-right">Total Paid</th>
                    <th className="py-3 px-4">Ref / SW Code</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {clients.map((c) => {
                    const base = Number(c.amount) || 0;
                    const gst = Math.round(base * 0.18 * 100) / 100;
                    return (
                      <tr key={c.id} className="hover:bg-[var(--bg-hover-2)] transition text-[var(--text-primary)]">
                        <td className="py-3 px-4 font-mono text-xs">{c.payment_date ? new Date(c.payment_date).toLocaleDateString('en-IN') : '-'}</td>
                        <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">{c.client_name}</td>
                        <td className="py-3 px-4 text-[var(--text-secondary)]">{c.package}</td>
                        <td className="py-3 px-4 text-right font-mono text-xs">{formatMoney(base)}</td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-[var(--text-muted)]">{formatMoney(gst)}</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-400">{formatMoney(base + gst)}</td>
                        <td className="py-3 px-4 text-xs font-mono text-[var(--text-secondary)]">{c.sw_code || c.reference || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CLIENT ADD / EDIT MODAL (19 Parameters) ─────── */}
        {isClientModalOpen && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto" style={{ minHeight: '100vh', width: '100vw' }}>
            <div className="relative w-full max-w-4xl bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden my-auto">
              <div className="flex items-center justify-between p-6 border-b border-[var(--border)] bg-[var(--panel-inset-soft)]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[var(--accent-bg)] rounded-xl text-[var(--accent)] border border-[var(--accent-bg-2)]">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">
                      {editingClient ? 'Edit RA Client Record' : 'New Client Advisory Entry'}
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)]">Complete all mandatory client and compliance fields</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsClientModalOpen(false)}
                  className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSaveClient} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                {/* Package & Subscription Row */}
                <div className="p-4 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                    1. Advisory Package Selection
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                        Select Package <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formData.package}
                        onChange={(e) => handlePackageSelectChange(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] font-semibold focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] outline-none"
                      >
                        <option value="" disabled>-- Select Active Package --</option>
                        {activePackages.map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.name} ({formatMoney(p.price)} • {p.duration_days}d)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                        Amount Paid (₹) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                        required
                        min="0"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-emerald-400 font-bold focus:ring-1 focus:ring-[var(--accent)] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Payment Date</label>
                      <input
                        type="date"
                        value={formData.payment_date}
                        onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Coverage Start Date</label>
                      <input
                        type="date"
                        value={formData.subscription_start_date}
                        onChange={(e) => setFormData({ ...formData, subscription_start_date: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Coverage Expiry / End Date</label>
                      <input
                        type="date"
                        value={formData.subscription_end_date}
                        onChange={(e) => setFormData({ ...formData, subscription_end_date: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Client Basic Details */}
                <div className="p-4 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                    2. Client Identity & Contact
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                        Client Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.client_name}
                        onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                        required
                        placeholder="e.g. Rajesh Sharma"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Mobile Number</label>
                      <input
                        type="tel"
                        value={formData.mobile_number}
                        onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                        placeholder="+91 98765 43210"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Email Address</label>
                      <input
                        type="email"
                        value={formData.email_id}
                        onChange={(e) => setFormData({ ...formData, email_id: e.target.value })}
                        placeholder="client@example.com"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">PAN Card Number</label>
                      <input
                        type="text"
                        value={formData.pan}
                        onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                        placeholder="ABCDE1234F"
                        maxLength={10}
                        className="w-full px-3.5 py-2.5 text-sm font-mono uppercase rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Aadhaar (Last 4 / Full)</label>
                      <input
                        type="text"
                        value={formData.aadhaar_no}
                        onChange={(e) => setFormData({ ...formData, aadhaar_no: e.target.value })}
                        placeholder="1234 5678 9012"
                        className="w-full px-3.5 py-2.5 text-sm font-mono rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">SW Code / Lead Tag</label>
                      <input
                        type="text"
                        value={formData.sw_code}
                        onChange={(e) => setFormData({ ...formData, sw_code: e.target.value })}
                        placeholder="SW-9981"
                        className="w-full px-3.5 py-2.5 text-sm font-mono rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Compliance & KRA Row */}
                <div className="p-4 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                    3. Compliance & KYC Verification
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">KRA Updation Status</label>
                      <select
                        value={formData.kra_updation_status}
                        onChange={(e) => setFormData({ ...formData, kra_updation_status: e.target.value as KRAUpdationStatus })}
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                      >
                        {KRA_STATUSES.map((k) => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">KYC Fetch Date</label>
                      <input
                        type="date"
                        value={formData.kyc_fetch_date}
                        onChange={(e) => setFormData({ ...formData, kyc_fetch_date: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">KRA Ref Number</label>
                      <input
                        type="text"
                        value={formData.kra_reference_number}
                        onChange={(e) => setFormData({ ...formData, kra_reference_number: e.target.value })}
                        placeholder="REF-109283"
                        className="w-full px-3.5 py-2.5 text-sm font-mono rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">CKYC Number</label>
                      <input
                        type="text"
                        value={formData.ckyc_number}
                        onChange={(e) => setFormData({ ...formData, ckyc_number: e.target.value })}
                        placeholder="CKYC990022"
                        className="w-full px-3.5 py-2.5 text-sm font-mono rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Remarks & Operational Notes */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Remarks / Analyst Notes</label>
                  <textarea
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    rows={2}
                    placeholder="Advisory scope, target expectations, or custom remarks..."
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                  />
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setIsClientModalOpen(false)}
                    className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover-2)] transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 text-sm font-semibold rounded-xl bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)] transition shadow disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : editingClient ? 'Update Client Record' : 'Save & Onboard Client'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── PACKAGE CREATE / EDIT MODAL ────────────────── */}
        {isPackageModalOpen && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto" style={{ minHeight: '100vh', width: '100vw' }}>
            <div className="relative w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden my-auto">
              <div className="flex items-center justify-between p-6 border-b border-[var(--border)] bg-[var(--panel-inset-soft)]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[var(--accent-bg)] rounded-xl text-[var(--accent)] border border-[var(--accent-bg-2)]">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">
                      {editingPackage ? 'Edit Package' : 'Create New Advisory Package'}
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)]">
                      This package will automatically appear in the Client Onboarding dropdown.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPackageModalOpen(false)}
                  className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSavePackage} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    Package Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={packageFormData.name}
                    onChange={(e) => setPackageFormData({ ...packageFormData, name: e.target.value })}
                    required
                    placeholder="e.g. Diamond Equity Portfolio"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Segment / Asset Class</label>
                    <select
                      value={packageFormData.segment}
                      onChange={(e) => setPackageFormData({ ...packageFormData, segment: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                    >
                      {PACKAGE_SEGMENTS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Base Fee (₹)</label>
                    <input
                      type="number"
                      value={packageFormData.price}
                      onChange={(e) => setPackageFormData({ ...packageFormData, price: Number(e.target.value) })}
                      min="0"
                      required
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-emerald-400 font-bold focus:ring-1 focus:ring-[var(--accent)] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    Default Validity Duration (Days)
                  </label>
                  <input
                    type="number"
                    value={packageFormData.duration_days}
                    onChange={(e) => setPackageFormData({ ...packageFormData, duration_days: Number(e.target.value) })}
                    min="1"
                    required
                    placeholder="e.g. 30, 90, 180, 365"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Description / Highlights</label>
                  <textarea
                    value={packageFormData.description}
                    onChange={(e) => setPackageFormData({ ...packageFormData, description: e.target.value })}
                    rows={2}
                    placeholder="Key recommendations, target alpha, or coverage scope..."
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="package_is_active"
                    checked={packageFormData.is_active}
                    onChange={(e) => setPackageFormData({ ...packageFormData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded text-[var(--accent)] focus:ring-[var(--accent)]"
                  />
                  <label htmlFor="package_is_active" className="text-sm font-semibold text-[var(--text-primary)] cursor-pointer">
                    Active (Include in client onboarding dropdown)
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setIsPackageModalOpen(false)}
                    className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover-2)] transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPackage}
                    className="px-6 py-2.5 text-sm font-semibold rounded-xl bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)] transition shadow disabled:opacity-50"
                  >
                    {savingPackage ? 'Saving...' : editingPackage ? 'Update Package' : 'Create Package'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── QUICK TESTIMONIAL MODAL ──────────────────────── */}
        {isTestimonialModalOpen && selectedClientForTestimonial && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto" style={{ minHeight: '100vh', width: '100vw' }}>
            <div className="relative w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden my-auto">
              <div className="flex items-center justify-between p-6 border-b border-[var(--border)] bg-[var(--panel-inset-soft)]">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">Add Client Testimonial</h2>
                  <p className="text-xs text-[var(--text-secondary)]">Client: <strong className="text-[var(--text-primary)]">{selectedClientForTestimonial.client_name}</strong> ({selectedClientForTestimonial.package})</p>
                </div>
                <button
                  onClick={() => setIsTestimonialModalOpen(false)}
                  className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSaveTestimonial} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Rating (1 to 5 Stars)</label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setTestimonialForm({ ...testimonialForm, rating: star })}
                        className={`text-2xl transition ${star <= testimonialForm.rating ? 'text-amber-400 scale-110' : 'text-gray-600 hover:text-amber-300'}`}
                      >
                        ★
                      </button>
                    ))}
                    <span className="text-xs font-bold text-[var(--text-secondary)] ml-2">
                      {testimonialForm.rating} / 5 Stars
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Client Feedback / Quote *</label>
                  <textarea
                    value={testimonialForm.feedback_text}
                    onChange={(e) => setTestimonialForm({ ...testimonialForm, feedback_text: e.target.value })}
                    required
                    rows={3}
                    placeholder="Enter what the client said about research advisory, target accuracy, or service quality..."
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Screenshot Proof URL (WhatsApp / Email)</label>
                  <input
                    type="url"
                    value={testimonialForm.screenshot_url}
                    onChange={(e) => setTestimonialForm({ ...testimonialForm, screenshot_url: e.target.value })}
                    placeholder="https://imgur.com/..."
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                  />
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={testimonialForm.is_featured}
                      onChange={(e) => setTestimonialForm({ ...testimonialForm, is_featured: e.target.checked })}
                      className="w-4 h-4 rounded text-[var(--accent)] focus:ring-[var(--accent)]"
                    />
                    Featured on Showcase Wall
                  </label>

                  <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={testimonialForm.is_verified}
                      onChange={(e) => setTestimonialForm({ ...testimonialForm, is_verified: e.target.checked })}
                      className="w-4 h-4 rounded text-[var(--accent)] focus:ring-[var(--accent)]"
                    />
                    Verified Client
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setIsTestimonialModalOpen(false)}
                    className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover-2)] transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 text-sm font-semibold rounded-xl bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)] transition shadow disabled:opacity-50"
                  >
                    {saving ? 'Adding...' : 'Add Testimonial'}
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

export default RADataEntryPage;
