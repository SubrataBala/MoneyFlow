import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS_OWNER = [
  { to: '/dashboard', icon: '🏠', label: 'Home' },
  { to: '/attendance', icon: '📅', label: 'Attendance' },
  { to: '/wages', icon: '💰', label: 'Wages' },
  { to: '/daily-summary', icon: '🏗️', label: 'Daily' },
  { to: '/reports', icon: '📋', label: 'Reports' },
];

const NAV_ITEMS_OWNER_SIDEBAR = [
  { to: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { to: '/attendance', icon: '📅', label: 'Attendance' },
  { to: '/wages', icon: '💰', label: 'Wages' },
  { to: '/daily-summary', icon: '🏗️', label: 'Daily Summary' },
  { to: '/reports', icon: '📋', label: 'Reports' },
  { to: '/fertilizer', icon: '🌿', label: 'Fertilizer' },
  { to: '/harvesting', icon: '🚜', label: 'Diesel' },
  { to: '/tenants', icon: '👨‍🌾', label: 'Land Tenants' },
];

const NAV_ITEMS_ADMIN = [
  { to: '/admin', icon: '🏠', label: 'Home' },
  { to: '/daily-summary', icon: '🏗️', label: 'Daily' },
];

const NAV_ITEMS_ADMIN_SIDEBAR = [
  { to: '/admin', icon: '🏠', label: 'Dashboard' },
  { to: '/daily-summary', icon: '🏗️', label: 'Daily Summary' },
];

export default function Layout({ children }) {
  const { user, logout, darkMode, toggleDarkMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdmin = user?.role === 'admin';
  const bottomItems = isAdmin ? NAV_ITEMS_ADMIN : NAV_ITEMS_OWNER;
  const sidebarItems = isAdmin ? NAV_ITEMS_ADMIN_SIDEBAR : NAV_ITEMS_OWNER_SIDEBAR;

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // Get current page title for topbar
  const currentItem = sidebarItems.find(i => i.to === location.pathname);
  const pageTitle = currentItem ? currentItem.label : 'MoneyFlow';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Close sidebar when route changes on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Lock body scroll when sidebar open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const userInitial = (user?.name || user?.username || 'U').charAt(0).toUpperCase();

  return (
    <div className="app-shell">
      {/* ======== SIDEBAR ======== */}
      <aside className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <img src="/logo.png" alt="Logo" className="sidebar-logo-img" style={{ borderRadius: '50%', objectFit: 'cover' }} />
          <div>
            <div className="sidebar-logo-text">Subh Ent.</div>
            <div className="sidebar-logo-sub">Management System</div>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="sidebar-nav">
          <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 14px 8px' }}>
            Navigation
          </div>
          {sidebarItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin' || item.to === '/dashboard'}
              className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}
            >
              <span className="sidebar-nav-icon">
                <span>{item.icon}</span>
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          {/* User Info */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            background: 'var(--surface2)', borderRadius: 'var(--radius)',
            padding: '12px', marginBottom: '8px'
          }}>
            <div className="avatar" style={{ width: '36px', height: '36px', fontSize: '14px', borderRadius: '4px' }}>
              {userInitial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name || user?.username || user?.email}
              </div>
              <span style={{
                fontSize: '10px', fontWeight: '700', padding: '1px 7px', borderRadius: '3px',
                background: isAdmin ? '#fef3c7' : 'var(--accent-glow)',
                color: isAdmin ? '#92400e' : 'var(--accent-dark)',
              }}>
                {user?.role?.toUpperCase()}
              </span>
            </div>
          </div>

          <button
            onClick={toggleDarkMode}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              width: '100%', padding: '10px 14px', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', background: 'var(--surface2)',
              color: 'var(--text-secondary)', fontWeight: '600', fontSize: '13px',
              cursor: 'pointer', fontFamily: 'inherit'
            }}
          >
            <span>{darkMode ? '☀️' : '🌙'}</span>
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>

          <button
            onClick={handleLogout}
            className="btn btn-danger btn-block"
            style={{ padding: '10px 14px', fontSize: '13px', borderRadius: 'var(--radius)' }}
          >
            🚪 Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ======== MAIN CONTENT ======== */}
      <div className="app-content">
        {/* Top Bar */}
        <header className="app-topbar">
          {/* Left side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarOpen(s => !s)}
              style={{
                display: 'none',
                width: '38px', height: '38px', borderRadius: '4px',
                border: '1px solid var(--border)', background: 'var(--surface2)',
                cursor: 'pointer', fontSize: '18px', alignItems: 'center', justifyContent: 'center',
              }}
              className="mobile-menu-btn"
              id="mobile-menu-btn"
            >
              {sidebarOpen ? '✕' : '☰'}
            </button>
            {location.pathname !== '/daily-summary' && (
              <div>
                <h1 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text)' }}>
                  {pageTitle}
                </h1>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, marginTop: '1px' }}>
                  {today}
                </p>
              </div>
            )}
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Dark mode toggle (desktop) */}
            <button
              onClick={toggleDarkMode}
              className="btn btn-ghost btn-sm"
              style={{ width: '38px', height: '38px', padding: '0', borderRadius: '4px', fontSize: '17px' }}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>

            {/* User badge (desktop) */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: '4px', padding: '6px 12px 6px 8px',
            }}>
              <div className="avatar" style={{ width: '28px', height: '28px', fontSize: '12px', borderRadius: '4px' }}>
                {userInitial}
              </div>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                {user?.name || user?.username || user?.email?.split('@')[0]}
              </span>
            </div>

            {/* Logout */}
            <button onClick={handleLogout} className="btn btn-danger btn-sm">
              Exit
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="app-main">
          {children}
        </main>
      </div>

      {/* ======== BOTTOM NAV (Mobile) ======== */}
      <nav className="app-bottomnav">
        {bottomItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/admin' || item.to === '/dashboard'}
            className={({ isActive }) => `bottomnav-item${isActive ? ' active' : ''}`}
          >
            <span className="bottomnav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Inline style for mobile menu btn visibility */}
      <style>{`
        @media (max-width: 768px) {
          #mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
