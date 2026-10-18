import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { clearSupabaseAuthHash, getSupabaseAccessTokenFromUrl, startAdminGoogleLogin } from '../utils/supabaseAuth';

const LoginPage = () => {
  const [form, setForm] = useState({ username: '', password: '', role: 'owner' });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [processingGoogleCallback, setProcessingGoogleCallback] = useState(() => Boolean(getSupabaseAccessTokenFromUrl()));
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const accessToken = getSupabaseAccessTokenFromUrl();
    if (!accessToken) return;

    const completeGoogleLogin = async () => {
      setGoogleLoading(true);
      setProcessingGoogleCallback(true);
      clearSupabaseAuthHash();
      try {
        const { data } = await api.post('/auth/admin/supabase-login', { accessToken });
        login(data.user, data.token);
        toast.success(`Welcome back, ${data.user.name || data.user.email}!`);
        navigate('/admin');
      } catch (err) {
        const errorMsg = err.code === 'ECONNABORTED'
          ? 'Backend server is taking too long to wake up. Please try again in a few seconds.'
          : (err.response?.data?.message || err.message || 'Google login failed');
        toast.error(errorMsg);
        setProcessingGoogleCallback(false);
        navigate('/login', { replace: true });
      } finally {
        setGoogleLoading(false);
      }
    };

    completeGoogleLogin();
  }, [login, navigate]);

  // Pre-warm hosted backend (e.g. Render spin-up) immediately when user opens login page
  useEffect(() => {
    api.get('/health').catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // If server was sleeping (Render free tier), notify user after 2.8s
    const slowTimer = setTimeout(() => {
      toast('Waking up server, please wait a moment...', { id: 'slow-server-notice', icon: '⏳', duration: 15000 });
    }, 2800);

    try {
      const { data } = await api.post('/auth/login', form);
      clearTimeout(slowTimer);
      toast.dismiss('slow-server-notice');

      login(data.user, data.token);
      toast.success(`Welcome back, ${data.user.name || data.user.username}!`);

      if (data.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      clearTimeout(slowTimer);
      toast.dismiss('slow-server-notice');
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      clearTimeout(slowTimer);
      toast.dismiss('slow-server-notice');
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await startAdminGoogleLogin();
    } catch (err) {
      toast.error(err.message || 'Google login is not configured');
    }
  };

  // Processing Google OAuth callback
  if (processingGoogleCallback) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', padding: '24px',
        backgroundImage: 'var(--gradient-mesh)'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }} className="animate-scaleIn">
          <div style={{
            width: '80px', height: '80px', borderRadius: '20px',
            background: 'var(--gradient-primary)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', fontSize: '36px',
            boxShadow: 'var(--shadow-primary)'
          }}>
            🔐
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '12px' }}>
            Signing you in securely…
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, marginBottom: '28px' }}>
            Connecting to your backend server. If the server is waking up, this might take a moment.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <div className="spinner" style={{ width: '32px', height: '32px', borderWidth: '3px' }} />
          </div>
          <button
            type="button"
            onClick={() => {
              setProcessingGoogleCallback(false);
              navigate('/login', { replace: true });
            }}
            className="btn btn-ghost"
          >
            Cancel & Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      {/* ====== LEFT PANEL (Desktop decoration) ====== */}
      <div className="login-left">
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', color: 'white' }}>
          <img
            src="/logo.png"
            alt="Subh Ent."
            style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', marginBottom: '28px', border: '3px solid rgba(255,255,255,0.25)', boxShadow: '0 16px 40px rgba(0,0,0,0.25)' }}
          />
          <h1 style={{ fontSize: '36px', fontWeight: '900', marginBottom: '12px', color: 'white' }}>
            Subh Ent.
          </h1>
          <p style={{ fontSize: '16px', opacity: 0.85, lineHeight: 1.6, maxWidth: '320px', color: 'white' }}>
            Your complete Transaction & Labour Management System
          </p>

          {/* Feature pills */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '40px', textAlign: 'left' }}>
            {[
              { icon: '👷', text: 'Labour & Attendance Tracking' },
              { icon: '💰', text: 'Wages & Payment Management' },
              { icon: '🌿', text: 'Fertilizer & Diesel Records' },
              { icon: '📊', text: 'Reports & Analytics' },
            ].map(f => (
              <div key={f.text} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: 'rgba(255,255,255,0.12)', borderRadius: '12px',
                padding: '12px 16px', backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.2)'
              }}>
                <span style={{ fontSize: '20px' }}>{f.icon}</span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'white' }}>{f.text}</span>
              </div>
            ))}
          </div>

          <p style={{ marginTop: '48px', fontSize: '12px', opacity: 0.5, color: 'white' }}>
            © 2024 Developed by Subrata Bala
          </p>
        </div>
      </div>

      {/* ====== RIGHT PANEL (Login Form) ====== */}
      <div className="login-right">
        <div style={{ width: '100%', maxWidth: '380px' }} className="animate-fadeUp">
          {/* Mobile logo (hidden on desktop) */}
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: 'var(--gradient-primary)', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center',
              marginBottom: '16px', boxShadow: 'var(--shadow-primary)',
              overflow: 'hidden', border: '2px solid var(--border)'
            }}>
              <img src="/logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: '900', marginBottom: '4px' }}>
              Welcome back
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              Sign in to your account to continue
            </p>
          </div>

          {/* Role Toggle */}
          <div className="segment-control" style={{ marginBottom: '24px' }}>
            {[
              { value: 'owner', label: '👷 Owner' },
              { value: 'admin', label: '🔐 Admin' }
            ].map(r => (
              <button
                key={r.value}
                className={`segment-btn${form.role === r.value ? ' active' : ''}`}
                onClick={() => setForm(f => ({ ...f, role: r.value }))}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Card */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius-xl)',
            padding: '28px',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-md)',
          }}>
            {form.role === 'admin' ? (
              /* Admin Google Login */
              <div>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔐</div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>Admin Sign In</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Use your Google account to sign in as Admin
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  style={{
                    width: '100%', padding: '14px 20px',
                    background: 'var(--surface2)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text)',
                    fontSize: '15px', fontWeight: '700',
                    cursor: googleLoading ? 'not-allowed' : 'pointer',
                    opacity: googleLoading ? 0.7 : 1,
                    fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { if (!googleLoading) { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--primary-glow)'; }}}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  {/* Google "G" logo */}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  {googleLoading ? 'Connecting…' : 'Continue with Google'}
                </button>
              </div>
            ) : (
              /* Owner Login Form */
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="username" className="form-label">Username</label>
                  <input
                    type="text"
                    id="username"
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    placeholder="Enter your username"
                    required
                    className="form-input"
                    style={{ minHeight: '46px' }}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="password" className="form-label">Password</label>
                  <input
                    type="password"
                    id="password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Enter your password"
                    required
                    className="form-input"
                    style={{ minHeight: '46px' }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary btn-block btn-lg"
                  style={{ marginTop: '8px', borderRadius: 'var(--radius-md)' }}
                >
                  {loading ? (
                    <>
                      <span className="spinner" style={{ width: '18px', height: '18px', borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                      Signing in…
                    </>
                  ) : (
                    '→ Sign In'
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Footer links */}
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              First-time admin?{' '}
              <Link to="/register-admin" style={{ fontWeight: '700', color: 'var(--primary)', textDecoration: 'none' }}>
                Register with Gmail
              </Link>
            </p>
          </div>

          <div style={{ textAlign: 'center', marginTop: '32px', fontSize: '11px', color: 'var(--text-faint)' }}>
            Developed by Subrata Bala
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
