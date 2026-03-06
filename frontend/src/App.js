import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AttendancePage from './pages/AttendancePage';
import WagesPage from './pages/WagesPage';
import DailySummaryPage from './pages/DailySummaryPage';
import ReportsPage from './pages/ReportsPage';
import AdminDashboard from './pages/AdminDashboard';
import FertilizerPage from './pages/FertilizerPage';
import TenantsPage from './pages/TenantsPage';
import HarvestingPage from './pages/HarvestingPage';

const queryClient = new QueryClient();

const ProtectedRoute = ({ requiredRole }) => {
  const { user, token } = useAuth();
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // If user data is corrupted or missing a role, force a re-login to get fresh data. This prevents infinite loops.
  if (!user.role) {
    return <Navigate to="/login" replace />;
  }

  // If a role is required and it doesn't match the user's role, redirect to their correct home page.
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }
  // The Layout now wraps the Outlet, providing a consistent frame for all protected child routes.
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};


function AppRoutes() {
  const { user, token } = useAuth();
  const homePath = token ? (user?.role === 'admin' ? '/admin' : '/dashboard') : '/login';

  return (
    <Routes>
      {/* Public login route. If logged in, redirect to the appropriate home page. */}
      <Route path="/login" element={!token ? <LoginPage /> : <Navigate to={homePath} />} />

      {/* Owner-specific routes grouped under a single protected layout route */}
      <Route element={<ProtectedRoute requiredRole="owner" />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/wages" element={<WagesPage />} />
        <Route path="/daily-summary" element={<DailySummaryPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/fertilizer" element={<FertilizerPage />} />
        <Route path="/tenants" element={<TenantsPage />} />
        <Route path="/harvesting" element={<HarvestingPage />} />
      </Route>

      {/* Admin-specific routes */}
      <Route element={<ProtectedRoute requiredRole="admin" />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/tenants" element={<TenantsPage />} />
      </Route>

      {/* Root and wildcard routes for redirection */}
      <Route path="/" element={<Navigate to={homePath} />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Toaster position="top-center" toastOptions={{ style: { fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: '600', borderRadius: '12px', background: 'var(--surface)', color: 'var(--text)' } }} />
          <AppRoutes />
        </BrowserRouter>
      </QueryClientProvider>
    </AuthProvider>
  );
}
