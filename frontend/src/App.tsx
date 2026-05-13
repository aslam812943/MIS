import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AdminPanelPage from './pages/AdminPanelPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { ROUTES } from './constants/routes';

/**
 * Main Application component that handles routing and global layouts.
 */
function App() {
  return (
    <Router>
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
        
        {/* Default Redirect */}
        <Route path={ROUTES.ROOT} element={<Navigate to={ROUTES.LOGIN} replace />} />
      </Routes>
    </Router>
  );
}

export default App;
