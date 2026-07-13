import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AdminPanelPage from './pages/AdminPanelPage';
import ProfilePage from './pages/ProfilePage';
import DataEntryPage from './pages/DataEntry/DataEntryPage';
import VerifyEntriesPage from './pages/DataEntry/VerifyEntriesPage';
import IEPFDataEntryPage from './pages/IEPF/IEPFDataEntryPage';
import IEPFDashboardPage from './pages/IEPF/IEPFDashboardPage';
import SettlementsDataEntryPage from './pages/Settlements/SettlementsDataEntryPage';
import SettlementsDashboardPage from './pages/Settlements/SettlementsDashboardPage';
import KYCDataEntryPage from './pages/KYC/KYCDataEntryPage';
import KYCDashboardPage from './pages/KYC/KYCDashboardPage';
import DPDataEntryPage from './pages/DP/DPDataEntryPage';
import DPDashboardPage from './pages/DP/DPDashboardPage';
import ITDataEntryPage from './pages/IT/ITDataEntryPage';
import ITDashboardPage from './pages/IT/ITDashboardPage';
import FinanceDataEntryPage from './pages/Finance/FinanceDataEntryPage';
import FinanceDashboardPage from './pages/Finance/FinanceDashboardPage';
import ProtectedRoute from './components/auth/ProtectedRoute';

import { ROUTES } from './constants/routes';
import AppToaster from './components/common/AppToaster';

/**
 * Main Application component that handles routing and global layouts.
 */
function App() {
  return (
    <Router>
      <AppToaster />
      <Routes>
        {/* Authentication Routes */}
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        
        {/* Protected Admin Routes */}
        <Route 
          path={ROUTES.DASHBOARD} 
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } 
        />

        <Route 
          path={ROUTES.ADMIN_PANEL} 
          element={
            <ProtectedRoute>
              <AdminPanelPage />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path={ROUTES.PROFILE} 
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path={ROUTES.DATA_ENTRY} 
          element={
            <ProtectedRoute>
              <DataEntryPage />
            </ProtectedRoute>
          } 
        />

        <Route 
          path={ROUTES.VERIFY_ENTRIES} 
          element={
            <ProtectedRoute>
              <VerifyEntriesPage />
            </ProtectedRoute>
          } 
        />

        <Route 
          path={ROUTES.IEPF_DATA_ENTRY} 
          element={
            <ProtectedRoute>
              <IEPFDataEntryPage />
            </ProtectedRoute>
          } 
        />

        <Route 
          path={ROUTES.IEPF_DASHBOARD} 
          element={
            <ProtectedRoute>
              <IEPFDashboardPage />
            </ProtectedRoute>
          } 
        />

        <Route 
          path={ROUTES.SETTLEMENTS_DATA_ENTRY} 
          element={
            <ProtectedRoute>
              <SettlementsDataEntryPage />
            </ProtectedRoute>
          } 
        />

        <Route 
          path={ROUTES.SETTLEMENTS_DASHBOARD} 
          element={
            <ProtectedRoute>
              <SettlementsDashboardPage />
            </ProtectedRoute>
          } 
        />

        <Route 
          path={ROUTES.KYC_DATA_ENTRY} 
          element={
            <ProtectedRoute>
              <KYCDataEntryPage />
            </ProtectedRoute>
          } 
        />

        <Route 
          path={ROUTES.KYC_DASHBOARD} 
          element={
            <ProtectedRoute>
              <KYCDashboardPage />
            </ProtectedRoute>
          } 
        />

        <Route 
          path={ROUTES.DP_DATA_ENTRY} 
          element={
            <ProtectedRoute>
              <DPDataEntryPage />
            </ProtectedRoute>
          } 
        />

        <Route 
          path={ROUTES.DP_DASHBOARD} 
          element={
            <ProtectedRoute>
              <DPDashboardPage />
            </ProtectedRoute>
          } 
        />

        <Route 
          path={ROUTES.IT_DATA_ENTRY} 
          element={
            <ProtectedRoute>
              <ITDataEntryPage />
            </ProtectedRoute>
          } 
        />

        <Route
          path={ROUTES.IT_DASHBOARD}
          element={
            <ProtectedRoute>
              <ITDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.FINANCE_DATA_ENTRY}
          element={
            <ProtectedRoute>
              <FinanceDataEntryPage />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.FINANCE_DASHBOARD}
          element={
            <ProtectedRoute>
              <FinanceDashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Default Redirect */}
        <Route path={ROUTES.ROOT} element={<Navigate to={ROUTES.LOGIN} replace />} />
      </Routes>
    </Router>
  );
}

export default App;
