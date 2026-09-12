import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { authService } from '../../services/auth.service';
import { notificationService } from '../../services/notification.service';
import { taskService } from '../../services/task.service';
import { useLayout } from './LayoutContext';
import { useTheme } from '../../context/ThemeContext';

/* ── SVG Icon Components ─────────────────────────────────── */
const IconDashboard = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/>
    <rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="14" y="14" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/>
  </svg>
);

const IconDataEntry = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
);

const IconVerify = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4"/>
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
  </svg>
);

const IconShield = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const IconUser = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
);

const IconLogout = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const IconSun = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
  </svg>
);

const IconMoon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
  </svg>
);

const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const IconIEPFEntry = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

const IconIEPFDashboard = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.21 15.89A10 10 0 118 2.83"/>
    <path d="M22 12A10 10 0 0012 2v10z"/>
  </svg>
);

const IconTask = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4"/>
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
  </svg>
);

const IconRA = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
  </svg>
);

const IconStar = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const IconReport = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

/* ── Nav Item Component ───────────────────────────────────── */
interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  count?: number;
  onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, badge, count, onClick }) => (
  <NavLink
    to={to}
    className={({ isActive }) => `mis-nav-item${isActive ? ' active' : ''}`}
    onClick={onClick}
  >
    <span className="mis-nav-icon">{icon}</span>
    <span className="mis-nav-label">{label}</span>
    {badge && <span className="mis-nav-badge">{badge}</span>}
    {count !== undefined && count > 0 && <span className="mis-nav-count">{count}</span>}
  </NavLink>
);

/* ── Main Sidebar Component ──────────────────────────────── */
export const Sidebar: React.FC = () => {
  const { sidebarOpen, setSidebarOpen } = useLayout();
  const { theme, toggleTheme } = useTheme();
  const user = authService.getCurrentUser();
  const [unreadCount, setUnreadCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const navRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const saved = sessionStorage.getItem('mis_sidebar_scroll');
    if (saved !== null) {
      nav.scrollTop = Number(saved);
    }
    const handleScroll = () => {
      sessionStorage.setItem('mis_sidebar_scroll', String(nav.scrollTop));
    };
    nav.addEventListener('scroll', handleScroll, { passive: true });
    return () => nav.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch initial unread count
  useEffect(() => {
    notificationService.getUnreadCount().then(setUnreadCount).catch(() => {});
  }, []);

  // Fetch initial assigned task count
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const tasks = await taskService.getTasks('mine');
        const pendingCount = tasks.filter(
          (t: any) => t.status !== 'Completed' && t.status !== 'Cancelled'
        ).length;
        setTaskCount(pendingCount);
      } catch (err) {
        console.error('Failed to load initial task count in sidebar:', err);
      }
    };
    if (user?.id) {
      fetchTasks();
    }
  }, [user?.id]);

  const isAdmin = user?.role === 'admin';
  const isLeadership = ['ceo', 'managing_director', 'director', 'executive'].includes(user?.role || '');
  const isHOD = user?.role === 'hod';
  const isHR = user?.role === 'hr' || user?.department_name?.toUpperCase() === 'HR';
  const isEmployee = user?.role === 'employee';

  const isCreatorDept = user?.department_name?.toUpperCase() === 'CREATIVE' || user?.department_name?.toUpperCase() === 'MARKETING';
  const isSMM = user?.role === 'social_media_manager' || (isCreatorDept && (isHOD || isAdmin));
  const isCreator = user?.role === 'content_creator' || isCreatorDept;

  const showHRDashboard = isAdmin || isHR;

  const isIEPFUser = user?.department_name?.toUpperCase() === 'IEPF';
  const showIEPFDashboard = isAdmin || isLeadership || (isIEPFUser && (isHOD || isEmployee));

  const isKYCUser = user?.department_name?.toUpperCase() === 'KYC';
  const showKYCDashboard = isAdmin || isLeadership || (isKYCUser && (isHOD || isEmployee));

  const isDPUser = user?.department_name?.toUpperCase() === 'DP';
  const showDPDashboard = isAdmin || isLeadership || (isDPUser && (isHOD || isEmployee));

  const isITUser = user?.department_name?.toUpperCase() === 'IT';
  const showITDashboard = isAdmin || isLeadership || (isITUser && (isHOD || isEmployee));

  const isFinanceUser = user?.department_name?.toUpperCase() === 'FINANCE';
  const showFinanceDashboard = isAdmin || isLeadership || (isFinanceUser && (isHOD || isEmployee));

  const isRAUser = user?.department_name?.toUpperCase() === 'RA' || user?.department_name?.toUpperCase() === 'RESEARCH ANALYST';
  const showRADashboard = isAdmin || isLeadership || (isRAUser && (isHOD || isEmployee));

  const isSalesUser = user?.department_name?.toUpperCase() === 'SALES';
  const showSalesDashboard = isAdmin || isLeadership || (isSalesUser && (isHOD || isEmployee));

  const isSettlementsUser = user?.department_name?.toUpperCase() === 'SETTLEMENTS';
  const showSettlementsDashboard = isAdmin || isLeadership || (isSettlementsUser && (isHOD || isEmployee));

  const hasDedicatedDeptEntry = isIEPFUser || isSettlementsUser || isKYCUser || isDPUser || isITUser || isFinanceUser || isSalesUser || isCreatorDept || isCreator || isRAUser;

  const closeOnMobile = () => setSidebarOpen(false);

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : (user?.email?.slice(0, 2).toUpperCase() || 'U');

  return (
    <aside className={`mis-sidebar${sidebarOpen ? ' open' : ''}`}>
      {/* Brand Header */}
      <div className="mis-sidebar-header">
        <NavLink to={ROUTES.DASHBOARD} className="mis-sidebar-logo" onClick={closeOnMobile}>
          <div className="mis-logo-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/>
              <polyline points="2 17 12 22 22 17"/>
              <polyline points="2 12 12 17 22 12"/>
            </svg>
          </div>
          <div className="mis-logo-text">
            <span className="mis-logo-name">MIS Portal</span>
            <span className="mis-logo-sub">Management Suite</span>
          </div>
        </NavLink>

        <button
          className="mis-sidebar-close"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        >
          <IconClose />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="mis-sidebar-nav" ref={navRef}>
        <span className="mis-sidebar-section-label">Main</span>

        <NavItem
          to={isRAUser ? ROUTES.RA_DASHBOARD : ROUTES.DASHBOARD}
          icon={<IconDashboard />}
          label="Dashboard"
          onClick={closeOnMobile}
        />

        {/* Generic Data Entry if no dedicated department */}
        {(!hasDedicatedDeptEntry && !isAdmin && !isLeadership) && (
          <NavItem
            to={ROUTES.DATA_ENTRY}
            icon={<IconDataEntry />}
            label="Data Entry"
            onClick={closeOnMobile}
          />
        )}

        {/* Verification Hub */}
        {(!isAdmin && !isLeadership && isHOD) && (
          <NavItem
            to={ROUTES.VERIFY_ENTRIES}
            icon={<IconVerify />}
            label="Verify Entries"
            onClick={closeOnMobile}
          />
        )}

        {/* Tasks Hub */}
        <NavItem
          to={ROUTES.TASKS}
          icon={<IconTask />}
          label="Tasks"
          count={taskCount}
          onClick={closeOnMobile}
        />

        {/* Notifications Hub */}
        <NavItem
          to={ROUTES.NOTIFICATIONS}
          icon={
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          }
          label="Notifications"
          count={unreadCount}
          onClick={closeOnMobile}
        />

        {/* Creator Hub */}
        {isCreator && (
          <>
            <span className="mis-sidebar-section-label">Content Creation</span>
            <NavItem
              to={ROUTES.CREATOR_DASHBOARD}
              icon={<IconDashboard />}
              label="Creator Studio"
              onClick={closeOnMobile}
            />
            <NavItem
              to={ROUTES.CREATOR_PLANNER}
              icon={<IconDataEntry />}
              label="Content Planner"
              onClick={closeOnMobile}
            />
          </>
        )}

        {/* Content Review / Approvals */}
        {isSMM && (
          <NavItem
            to={ROUTES.SMM_APPROVALS}
            icon={<IconVerify />}
            label="Review & Approve"
            onClick={closeOnMobile}
          />
        )}

        {/* Social Media Manager / Lead - Creator Performance */}
        {(isSMM || isAdmin) && (
          <NavItem
            to={ROUTES.SMM_DASHBOARD}
            icon={<IconDashboard />}
            label="SMM Dashboard"
            onClick={closeOnMobile}
          />
        )}

        {/* IEPF Department Navigation */}
        {isIEPFUser && (
          <>
            <span className="mis-sidebar-section-label">IEPF Department</span>
            <NavItem
              to={ROUTES.IEPF_DATA_ENTRY}
              icon={<IconIEPFEntry />}
              label="IEPF Entry"
              onClick={closeOnMobile}
            />
          </>
        )}

        {showIEPFDashboard && (
          <>
            {!isIEPFUser && <span className="mis-sidebar-section-label">IEPF Department</span>}
            <NavItem
              to={ROUTES.IEPF_DASHBOARD}
              icon={<IconIEPFDashboard />}
              label="IEPF Dashboard"
              onClick={closeOnMobile}
            />
          </>
        )}

        {/* Settlements Department Navigation */}
        {isSettlementsUser && (
          <>
            <span className="mis-sidebar-section-label">Settlements Dept</span>
            <NavItem
              to={ROUTES.SETTLEMENTS_DATA_ENTRY}
              icon={<IconIEPFEntry />}
              label="Settlements Entry"
              onClick={closeOnMobile}
            />
          </>
        )}

        {showSettlementsDashboard && (
          <>
            {!isSettlementsUser && <span className="mis-sidebar-section-label">Settlements Dept</span>}
            <NavItem
              to={ROUTES.SETTLEMENTS_DASHBOARD}
              icon={<IconIEPFDashboard />}
              label="Settlements Dashboard"
              onClick={closeOnMobile}
            />
          </>
        )}

        {/* KYC Department Navigation */}
        {isKYCUser && (
          <>
            <span className="mis-sidebar-section-label">KYC Department</span>
            <NavItem
              to={ROUTES.KYC_DATA_ENTRY}
              icon={<IconIEPFEntry />}
              label="KYC Entry"
              onClick={closeOnMobile}
            />
          </>
        )}

        {showKYCDashboard && (
          <>
            {!isKYCUser && <span className="mis-sidebar-section-label">KYC Department</span>}
            <NavItem
              to={ROUTES.KYC_DASHBOARD}
              icon={<IconIEPFDashboard />}
              label="KYC Dashboard"
              onClick={closeOnMobile}
            />
          </>
        )}

        {/* DP Department Navigation */}
        {isDPUser && (
          <>
            <span className="mis-sidebar-section-label">DP Department</span>
            <NavItem
              to={ROUTES.DP_DATA_ENTRY}
              icon={<IconIEPFEntry />}
              label="DP Entry"
              onClick={closeOnMobile}
            />
          </>
        )}

        {showDPDashboard && (
          <>
            {!isDPUser && <span className="mis-sidebar-section-label">DP Department</span>}
            <NavItem
              to={ROUTES.DP_DASHBOARD}
              icon={<IconIEPFDashboard />}
              label="DP Dashboard"
              onClick={closeOnMobile}
            />
          </>
        )}

        {/* IT Department Navigation */}
        {isITUser && (
          <>
            <span className="mis-sidebar-section-label">IT Department</span>
            <NavItem
              to={ROUTES.IT_DATA_ENTRY}
              icon={<IconIEPFEntry />}
              label="IT Entry"
              onClick={closeOnMobile}
            />
          </>
        )}

        {showITDashboard && (
          <>
            {!isITUser && <span className="mis-sidebar-section-label">IT Department</span>}
            <NavItem
              to={ROUTES.IT_DASHBOARD}
              icon={<IconIEPFDashboard />}
              label="IT Dashboard"
              onClick={closeOnMobile}
            />
          </>
        )}

        {/* Finance Department Navigation */}
        {isFinanceUser && (
          <>
            <span className="mis-sidebar-section-label">Finance Department</span>
            <NavItem
              to={ROUTES.FINANCE_DATA_ENTRY}
              icon={<IconIEPFEntry />}
              label="Finance Entry"
              onClick={closeOnMobile}
            />
          </>
        )}

        {showFinanceDashboard && (
          <>
            {!isFinanceUser && <span className="mis-sidebar-section-label">Finance Department</span>}
            <NavItem
              to={ROUTES.FINANCE_DASHBOARD}
              icon={<IconIEPFDashboard />}
              label="Finance Dashboard"
              onClick={closeOnMobile}
            />
          </>
        )}

        {/* Sales Department Navigation */}
        {isSalesUser && (
          <>
            <span className="mis-sidebar-section-label">Sales Department</span>
            <NavItem
              to={ROUTES.SALES_DATA_ENTRY}
              icon={<IconIEPFEntry />}
              label="Sales Entry"
              onClick={closeOnMobile}
            />
          </>
        )}

        {showSalesDashboard && (
          <>
            {!isSalesUser && <span className="mis-sidebar-section-label">Sales Department</span>}
            <NavItem
              to={ROUTES.SALES_DASHBOARD}
              icon={<IconIEPFDashboard />}
              label="Sales Dashboard"
              onClick={closeOnMobile}
            />
          </>
        )}

        {/* Research Analyst (RA) Department Navigation */}
        {isRAUser && (
          <>
            <span className="mis-sidebar-section-label">RA Department</span>
            <NavItem
              to={ROUTES.RA_DATA_ENTRY}
              icon={<IconIEPFEntry />}
              label="RA Data Entry"
              onClick={closeOnMobile}
            />
            <NavItem
              to={ROUTES.RA_TESTIMONIALS}
              icon={<IconStar />}
              label="Testimonials Hub"
              onClick={closeOnMobile}
            />
            <NavItem
              to={ROUTES.RA_REPORTS}
              icon={<IconReport />}
              label="Weekly & Monthly Reports"
              onClick={closeOnMobile}
            />
          </>
        )}

        {showRADashboard && (
          <>
            {!isRAUser && <span className="mis-sidebar-section-label">RA Department</span>}
            <NavItem
              to={ROUTES.RA_DASHBOARD}
              icon={<IconRA />}
              label="RA Dashboard"
              onClick={closeOnMobile}
            />
          </>
        )}

        {/* Administration Navigation */}
        {showHRDashboard && (
          <>
            <span className="mis-sidebar-section-label">Administration</span>
            {isAdmin && (
              <NavItem
                to={ROUTES.ADMIN_PANEL}
                icon={<IconShield />}
                label="Admin Panel"
                badge="ADMIN"
                onClick={closeOnMobile}
              />
            )}
            {(isAdmin || isHR) && (
              <NavItem
                to={ROUTES.HR_DATA_ENTRY}
                icon={<IconIEPFEntry />}
                label="HR Entry"
                onClick={closeOnMobile}
              />
            )}
            {(isAdmin || isHR) && (
              <NavItem
                to={ROUTES.HR_USER_MANAGEMENT}
                icon={<IconUser />}
                label="User Management"
                onClick={closeOnMobile}
              />
            )}
          </>
        )}

        <span className="mis-sidebar-section-label">Account</span>
        <NavItem
          to={ROUTES.PROFILE}
          icon={<IconUser />}
          label="My Profile"
          onClick={closeOnMobile}
        />
      </nav>

      {/* Footer */}
      <div className="mis-sidebar-footer">
        {/* User card */}
        {user && (
          <div className="mis-user-card">
            <div className="mis-user-avatar">{initials}</div>
            <div className="mis-user-info">
              <div className="mis-user-name">{user.full_name || user.email || 'User'}</div>
              <div className="mis-user-role">{user.role || 'Member'}</div>
            </div>
          </div>
        )}

        <button
          type="button"
          className="mis-theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <IconSun /> : <IconMoon />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>

        <button
          className="mis-logout-btn"
          onClick={() => authService.logout()}
        >
          <IconLogout />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
