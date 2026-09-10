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
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);

const IconBell = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
);

const IconTask = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="16" rx="2"/>
    <path d="M3 10h18"/>
    <path d="M8 3v4M16 3v4"/>
    <path d="M8 15l2 2 4-4"/>
  </svg>
);

/* ── Nav Item ─────────────────────────────────────────────── */
interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  onClick?: () => void;
}
const NavItem: React.FC<NavItemProps> = ({ to, icon, label, badge, onClick }) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) =>
      `mis-nav-item${isActive ? ' active' : ''}`
    }
  >
    {icon}
    <span className="flex-1 min-w-0">{label}</span>
    {badge && <span className="mis-nav-badge">{badge}</span>}
  </NavLink>
);

let savedNavScrollTop = 0;

/* ── Sidebar Component ────────────────────────────────────── */
const Sidebar: React.FC = () => {
  const { sidebarOpen, setSidebarOpen } = useLayout();
  const navRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (navRef.current) {
      navRef.current.scrollTop = savedNavScrollTop;
    }
  }, []);

  const handleNavScroll = () => {
    if (navRef.current) {
      savedNavScrollTop = navRef.current.scrollTop;
    }
  };

  const { theme, toggleTheme } = useTheme();
  const user = authService.getCurrentUser();

  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const fetchUnread = () => {
      notificationService.getUnreadCount()
        .then((count) => { if (!cancelled) setUnreadCount(count); })
        .catch(() => { /* silent */ });
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const [openTaskCount, setOpenTaskCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const fetchOpenTasks = () => {
      taskService.getTasks('mine')
        .then((tasks) => {
          if (cancelled) return;
          const open = tasks.filter((t) => !['Completed', 'Cancelled'].includes(t.status)).length;
          setOpenTaskCount(open);
        })
        .catch(() => { /* silent */ });
    };
    fetchOpenTasks();
    const interval = setInterval(fetchOpenTasks, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const role = user?.role || '';
  const isAdmin = role === 'admin';
  const isLeadership = ['ceo', 'managing_director', 'director', 'executive'].includes(role);
  const isHOD = role === 'hod';
  const isEmployee = role === 'employee';
  const isHR = role === 'hr';
  const isCreatorDept = user?.department_name?.toUpperCase() === 'CONTENT CREATION' || user?.department_name?.toUpperCase() === 'CONTENT CREATOR';
  const isCreator = role === 'content_creator' || (isCreatorDept && (isHOD || isEmployee));
  const isSMM = role === 'social_media_manager';

  // SMM & Content Creation navigation visible to staff, HOD, and executive management (CEO/MD/Director)
  const showSMM = isSMM || isLeadership;
  const showCreator = isCreator || isSMM || isLeadership;

  // HR Dashboard and Administration visibility
  const showHRDashboard = isAdmin || isHR || isLeadership;
  
  // Department specific visibility
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

  const isSalesUser = user?.department_name?.toUpperCase() === 'SALES';
  const showSalesDashboard = isAdmin || isLeadership || (isSalesUser && (isHOD || isEmployee));

  const isSettlementsUser = user?.department_name?.toUpperCase() === 'SETTLEMENTS';
  const showSettlementsDashboard = isAdmin || isLeadership || (isSettlementsUser && (isHOD || isEmployee));

  const hasDedicatedDeptEntry = isIEPFUser || isSettlementsUser || isKYCUser || isDPUser || isITUser || isFinanceUser || isSalesUser || isCreatorDept || isCreator;

  const closeOnMobile = () => setSidebarOpen(false);

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <aside className={`mis-sidebar${sidebarOpen ? ' open' : ''}`}>
      {/* Header */}
      <div className="mis-sidebar-header">
        <div className="mis-sidebar-logo">
          <div className="mis-logo-icon">M</div>
          <div className="mis-logo-text">
            <span className="mis-logo-name">MIS Portal</span>
            <span className="mis-logo-sub">Management System</span>
          </div>
        </div>
        <button
          className="mis-sidebar-close"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        >
          <IconClose />
        </button>
      </div>

      {/* Navigation */}
      <nav className="mis-sidebar-nav" ref={navRef} onScroll={handleNavScroll}>
        <span className="mis-sidebar-section-label">Main</span>

        {!isEmployee && (
          <NavItem
            to={ROUTES.DASHBOARD}
            icon={<IconDashboard />}
            label="Executive Dashboard"
            onClick={closeOnMobile}
          />
        )}

        <NavItem
          to={ROUTES.NOTIFICATIONS}
          icon={<IconBell />}
          label="Notifications"
          badge={unreadCount > 0 ? String(unreadCount) : undefined}
          onClick={closeOnMobile}
        />

        <NavItem
          to={ROUTES.TASKS}
          icon={<IconTask />}
          label="Tasks"
          badge={openTaskCount > 0 ? String(openTaskCount) : undefined}
          onClick={closeOnMobile}
        />

        {(isEmployee || isHOD) && !hasDedicatedDeptEntry && (
          <NavItem
            to={ROUTES.DATA_ENTRY}
            icon={<IconDataEntry />}
            label="Data Entry"
            onClick={closeOnMobile}
          />
        )}

        {/* Social Media Management Navigation */}
        {showSMM && (
          <>
            <span className="mis-sidebar-section-label">Social Media Management</span>
            <NavItem
              to={ROUTES.SMM_DASHBOARD}
              icon={<IconDashboard />}
              label="Analytics Dashboard"
              onClick={closeOnMobile}
            />
            <NavItem
              to={ROUTES.SMM_APPROVALS}
              icon={<IconVerify />}
              label="Approvals Queue"
              onClick={closeOnMobile}
            />
            <NavItem
              to={ROUTES.SMM_CAMPAIGNS}
              icon={<IconIEPFDashboard />}
              label="Campaigns & Briefs"
              onClick={closeOnMobile}
            />
          </>
        )}

        {/* Content Creation Navigation */}
        {showCreator && (
          <>
            <span className="mis-sidebar-section-label">Content Creation</span>
            <NavItem
              to={ROUTES.CREATOR_DASHBOARD}
              icon={<IconDashboard />}
              label="Creator Dashboard"
              onClick={closeOnMobile}
            />
            <NavItem
              to={ROUTES.CREATOR_PLANNER}
              icon={<IconDataEntry />}
              label="Content Planner"
              onClick={closeOnMobile}
            />
            <NavItem
              to={ROUTES.CREATOR_CALENDAR}
              icon={<IconTask />}
              label="Schedule Calendar"
              onClick={closeOnMobile}
            />
            <NavItem
              to={ROUTES.CREATOR_ASSETS}
              icon={<IconIEPFEntry />}
              label="Asset Library"
              onClick={closeOnMobile}
            />
          </>
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
            <span className="mis-sidebar-section-label">Settlements Department</span>
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
            {!isSettlementsUser && <span className="mis-sidebar-section-label">Settlements Department</span>}
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
