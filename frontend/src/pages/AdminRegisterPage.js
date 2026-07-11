import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { startAdminGoogleLogin } from '../utils/supabaseAuth';

const AdminRegisterPage = () => {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignup = async () => {
    setLoading(true);
    try {
      await startAdminGoogleLogin();
    } catch (err) {
      toast.error(err.message || 'Google signup is not configured');
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
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '15px' }}>Admin Account Registration</p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--radius)',
          padding: '32px', boxShadow: 'var(--shadow)', border: '1px solid var(--border)'
        }}>
          <h2 style={{ margin: '0 0 24px', fontWeight: '700', fontSize: '20px' }}>Create Admin Account</h2>

          <button type="button" onClick={handleGoogleSignup} disabled={loading}
            style={{
              width: '100%', padding: '16px', marginTop: '8px',
              background: 'var(--surface2)',
              border: '1.5px solid var(--border)', borderRadius: '12px', color: 'var(--text)',
              fontSize: '16px', fontWeight: '800', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
            }}>
            <span style={{ fontSize: '20px', lineHeight: 1 }}>G</span>
            {loading ? 'Opening Gmail...' : 'Continue with Gmail'}
          </button>
        </div>
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Link to="/login" style={{ fontWeight: '700', color: 'var(--text-muted)', fontSize: '14px' }}>← Back to Login</Link>
        </div>
      </div>
    </div>
  );
};

export default AdminRegisterPage;
