import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

const LoginPage = () => {
  const [form, setForm] = useState({ username: '', password: '', role: 'owner' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      // Save the user's session information using the AuthContext.
      login(data.user, data.token);
      toast.success(`Welcome back, ${data.user.name || data.user.username}!`);

      // After a successful login, navigate the user to the correct dashboard.
      if (data.user.role === 'admin') {
        navigate('/admin'); // Redirect to the admin dashboard
      } else {
        navigate('/dashboard'); // Redirect to the owner dashboard
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '24px'
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '20px'
          }}>
            <img src="/logo.png" alt="Subh Etp. Logo" style={{ width: '100%', height: 'auto', borderRadius: '50%' }} />
          </div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: 'var(--text)' }}>Subh Ent.</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '15px' }}>Transaction Management System</p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--radius)',
          padding: '32px', boxShadow: 'var(--shadow)', border: '1px solid var(--border)'
        }}>
          <h2 style={{ margin: '0 0 24px', fontWeight: '700', fontSize: '20px' }}>Sign In</h2>

          {/* Role Toggle */}
          <div style={{
            display: 'flex', background: 'var(--surface2)', borderRadius: '12px',
            padding: '4px', marginBottom: '24px', border: '1px solid var(--border)'
          }}>
            {['owner', 'admin'].map(r => (
              <button key={r} onClick={() => setForm(f => ({ ...f, role: r }))}
                style={{
                  flex: 1, padding: '10px', border: 'none', borderRadius: '10px', cursor: 'pointer',
                  fontWeight: '600', fontSize: '14px', fontFamily: 'inherit',
                  background: form.role === r ? 'linear-gradient(135deg, #0ea5e9, #0284c7)' : 'transparent',
                  color: form.role === r ? 'white' : 'var(--text-muted)',
                  transition: 'all 0.2s'
                }}>
                {r === 'owner' ? '👷 Owner' : '🔐 Admin'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {['username', 'password'].map(field => (
              <div key={field} style={{ marginBottom: '16px' }}>
                <label htmlFor={field} style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {field}
                </label>
                <input
                  type={field === 'password' ? 'password' : 'text'}
                  id={field}
                  value={form[field]}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  placeholder={field === 'username' ? 'Enter username' : 'Enter password'}
                  required
                  style={{
                    width: '100%', padding: '14px 16px', borderRadius: '12px',
                    border: '1.5px solid var(--border)', background: 'var(--surface2)',
                    color: 'var(--text)', fontSize: '16px', fontFamily: 'inherit', outline: 'none'
                  }}
                />
              </div>
            ))}

            <button type="submit" disabled={loading}
              style={{
                width: '100%', padding: '16px', marginTop: '8px',
                background: 'linear-gradient(135deg, #0ea5e9, #10b981)',
                border: 'none', borderRadius: '12px', color: 'white',
                fontSize: '16px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1, fontFamily: 'inherit',
                boxShadow: '0 4px 16px rgba(14,165,233,0.35)'
              }}>
              {loading ? '⏳ Signing in...' : '→ Sign In'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', padding: '30px 0 10px', fontSize: '12px', color: 'var(--text-muted)', opacity: 0.6 }}>
          Developed by Subrata Bala
        </div>
      </div>
    </div>
  );
};

export default LoginPage;


