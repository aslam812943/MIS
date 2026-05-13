import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
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
              <div style={{ padding: '2rem' }}>
                <h1>Admin Dashboard</h1>
                <p>Welcome to the MIS Administrative Portal.</p>
                <button onClick={() => { localStorage.clear(); window.location.href = ROUTES.LOGIN; }}>
                  Logout
                </button>
              </div>
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
