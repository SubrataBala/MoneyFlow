import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS_OWNER = [
  { to: '/dashboard', icon: '🏠', label: 'Home' },
  { to: '/attendance', icon: '📅', label: 'Attendance' },
  { to: '/wages', icon: '💰', label: 'Wages' },
  { to: '/daily-summary', icon: '🏗️', label: 'Daily' },
  { to: '/reports', icon: '📋', label: 'Reports' },
];

const NAV_ITEMS_ADMIN = [
  { to: '/admin', icon: '🏠', label: 'Home' },
  { to: '/admin/owners', icon: '👷', label: 'Owners' },
];

export default function Layout({ children }) {
  const { user, logout, darkMode, toggleDarkMode } = useAuth();
  const navigate = useNavigate();
  const items = user?.role === 'admin' ? NAV_ITEMS_ADMIN : NAV_ITEMS_OWNER;
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', maxWidth: '480px', margin: '0 auto', position: 'relative' }}>
      {/* Header */}
      <header style={{
        background: 'var(--surface)', padding: '16px 20px', position: 'sticky', top: 0, zIndex: 100,
        borderBottom: '1px solid var(--border)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src="/logo.png" alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
              <span style={{ fontWeight: '800', fontSize: '17px', color: 'var(--text)' }}>Subh Ent.</span>
              <span style={{ background: user?.role === 'admin' ? '#fef3c7' : '#dcfce7', color: user?.role === 'admin' ? '#92400e' : '#166534', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '99px' }}>
                {user?.role?.toUpperCase()}
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>{today}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={toggleDarkMode} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', width: '38px', height: '38px', cursor: 'pointer', fontSize: '18px' }}>
              {darkMode ? '☀️' : '🌙'}
            </button>
            <button onClick={handleLogout} style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '10px', height: '38px', padding: '0 16px', cursor: 'pointer', fontSize: '14px', fontWeight: '700', fontFamily: 'inherit' }}>
              Exit
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, padding: '20px 16px 100px', overflowY: 'auto' }}>
        {children}
      </main>

      {/* Bottom Nav */}
      <nav style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '480px', background: 'var(--surface)',
        borderTop: '1px solid var(--border)', padding: '8px 12px',
        display: 'flex', justifyContent: 'space-around',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.1)', zIndex: 100
      }}>
        {items.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/admin'}
            style={({ isActive }) => ({
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
              padding: '8px 12px', borderRadius: '12px', textDecoration: 'none', minWidth: '56px',
              background: isActive ? 'linear-gradient(135deg, rgba(14,165,233,0.15), rgba(16,185,129,0.15))' : 'transparent',
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
              transition: 'all 0.2s'
            })}>
            <span style={{ fontSize: '22px' }}>{item.icon}</span>
            <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.03em' }}>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
