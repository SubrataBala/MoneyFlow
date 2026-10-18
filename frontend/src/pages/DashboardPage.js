import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatCurrency, getTodayDate } from '../utils/helpers';

// ─── Stat Card ─────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, color, sub, gradient }) => (
  <div className="stat-card animate-fadeUp" style={gradient ? {
    background: gradient, border: 'none', color: 'white'
  } : {}}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <p style={{
          margin: '0 0 6px', fontSize: '11px', fontWeight: '700',
          textTransform: 'uppercase', letterSpacing: '0.07em',
          color: gradient ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)'
        }}>
          {label}
        </p>
        <p style={{
          margin: 0, fontSize: '28px', fontWeight: '900',
          color: gradient ? 'white' : (color || 'var(--text)'),
          lineHeight: 1
        }}>
          {value}
        </p>
        {sub && (
          <p style={{
            margin: '5px 0 0', fontSize: '12px',
            color: gradient ? 'rgba(255,255,255,0.65)' : 'var(--text-muted)'
          }}>
            {sub}
          </p>
        )}
      </div>
      <div style={{
        width: '48px', height: '48px', borderRadius: '14px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '24px', flexShrink: 0,
        background: gradient ? 'rgba(255,255,255,0.2)' : 'var(--surface2)',
      }}>
        {icon}
      </div>
    </div>
  </div>
);

// ─── Feature Card ───────────────────────────────────────────────────────────
const FeatureCard = ({ to, icon, label, color }) => (
  <Link to={to} className="feature-card animate-fadeUp">
    <div style={{
      width: '52px', height: '52px', borderRadius: '14px',
      background: color || 'var(--gradient-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '24px', margin: '0 auto 12px',
      boxShadow: '0 4px 12px rgba(99,102,241,0.25)'
    }}>
      {icon}
    </div>
    <p style={{
      margin: 0, fontWeight: '700', color: 'var(--text)',
      fontSize: '12px', lineHeight: '1.4'
    }}>
      {label}
    </p>
  </Link>
);

// ─── Pie Chart ──────────────────────────────────────────────────────────────
function PieChart({ data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <div className="empty-state-title">No data yet</div>
        <div className="empty-state-desc">No payment data available to display chart.</div>
      </div>
    );
  }

  let cumulative = 0;
  const paths = data.map(item => {
    const percentage = item.value / total;
    const startAngle = (cumulative / total) * 360;
    let endAngle = startAngle + percentage * 360;
    cumulative += item.value;

    if (percentage >= 1) {
      endAngle = startAngle + 359.999;
    }

    const getCoords = (angle) => {
      const rad = (angle - 90) * Math.PI / 180;
      return [50 + 45 * Math.cos(rad), 50 + 45 * Math.sin(rad)];
    };

    const [startX, startY] = getCoords(startAngle);
    const [endX, endY] = getCoords(endAngle);
    const largeArcFlag = percentage > 0.5 ? 1 : 0;

    return `M 50,50 L ${startX},${startY} A 45,45 0 ${largeArcFlag},1 ${endX},${endY} Z`;
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
      <svg viewBox="0 0 100 100" width="150" height="150" style={{ flexShrink: 0, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.12))' }}>
        {paths.map((d, i) => (
          <path key={i} d={d} fill={data[i].color} />
        ))}
        {/* Center hole */}
        <circle cx="50" cy="50" r="22" fill="var(--surface)" />
      </svg>
      <div style={{ flex: 1, minWidth: '140px' }}>
        {data.map(item => (
          <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{
              width: '10px', height: '10px', borderRadius: '3px',
              backgroundColor: item.color, flexShrink: 0
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>{item.name}</p>
              <p style={{ margin: '1px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{formatCurrency(item.value)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [daily, setDaily] = useState(null);
  const [loading, setLoading] = useState(true);
  const today = getTodayDate();

  const { data: paymentSummary, isLoading: loadingPayments } = useQuery({
    queryKey: ['paymentSummary'],
    queryFn: () => api.get('/dashboard/summary').then(res => res.data),
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [wageRes, dailyRes] = await Promise.all([
          api.get(`/labour/wages?date=${today}`),
          api.get('/daily-worker/today')
        ]);
        const wages = wageRes.data;
        const presentToday = wages.filter(w => w.presentDays > 0).length;
        const totalWageToday = wages.reduce((s, w) => s + parseFloat(w.totalWage || 0), 0);
        const totalPaidToday = wages.reduce((s, w) => s + parseFloat(w.totalPaid || 0), 0);
        setSummary({ total: wages.length, present: presentToday, totalWage: totalWageToday, totalPaid: totalPaidToday, remaining: totalWageToday - totalPaidToday });
        setDaily(dailyRes.data);
      } catch (e) {}
      setLoading(false);
    };
    fetchData();
  }, [today]);

  const chartData = paymentSummary ? [
    { name: 'Normal Workers', value: paymentSummary.labour, color: '#6366f1' },
    { name: 'Daily Workers', value: paymentSummary.dailyWorkers, color: '#8b5cf6' },
    { name: 'Fertilizer', value: paymentSummary.fertilizer, color: '#10b981' },
    { name: 'Diesel', value: paymentSummary.diesel, color: '#f59e0b' },
    { name: 'Land Tenants', value: paymentSummary.landTenants, color: '#ef4444' },
  ].filter(item => item.value > 0) : [];
  const totalExpense = chartData.reduce((sum, item) => sum + Number(item.value || 0), 0);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px', gap: '16px' }}>
        <div className="spinner" style={{ width: '32px', height: '32px', borderWidth: '3px' }} />
        <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Loading dashboard…</span>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h2 className="page-title">Dashboard</h2>
        <p className="page-subtitle">Today's overview and quick access to all features</p>
      </div>

      {/* Quick Feature Access */}
      <div style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>
          Quick Access
        </h3>
        <div className="dashboard-features">
          <FeatureCard to="/fertilizer" icon="🌿" label="Fertilizer" color="linear-gradient(135deg, #10b981, #059669)" />
          <FeatureCard to="/harvesting" icon="🚜" label="Diesel" color="linear-gradient(135deg, #f59e0b, #d97706)" />
          <FeatureCard to="/tenants" icon="👨‍🌾" label="Tenants" color="linear-gradient(135deg, #6366f1, #8b5cf6)" />
        </div>
      </div>

      {/* Stats Grid */}
      <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>
        Labour Overview
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '28px' }}>
        <StatCard icon="👷" label="Total Labour" value={summary?.total || 0} />
        <StatCard icon="✅" label="Present Today" value={summary?.present || 0} color="var(--accent)" />
        <StatCard icon="💰" label="Total Wage" value={formatCurrency(summary?.totalWage)} gradient="linear-gradient(135deg, #6366f1, #8b5cf6)" />
        <StatCard icon="💳" label="Total Paid" value={formatCurrency(summary?.totalPaid)} gradient="linear-gradient(135deg, #10b981, #059669)" />
        <StatCard icon="⏳" label="Remaining" value={formatCurrency(summary?.remaining)} gradient="linear-gradient(135deg, #ef4444, #dc2626)" />
      </div>

      {/* Daily Summary Banner */}
      {daily && (
        <div style={{
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          borderRadius: 'var(--radius-lg)', padding: '20px 24px',
          color: 'white', marginBottom: '28px',
          boxShadow: 'var(--shadow-primary)'
        }}>
          <h3 style={{ margin: '0 0 16px', fontWeight: '800', fontSize: '16px', color: 'white' }}>
            🏗️ Quick Daily Summary
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {[
              ['Workers', daily.totalWorkers],
              ['Daily Rate', formatCurrency(daily.dailyAmount)],
              ['Total Wage', formatCurrency(daily.totalWage)],
              ['Remaining', formatCurrency(daily.remaining)]
            ].map(([l, v]) => (
              <div key={l} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '12px', padding: '14px', backdropFilter: 'blur(8px)' }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', opacity: 0.8, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l}</p>
                <p style={{ margin: 0, fontWeight: '900', fontSize: '18px' }}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expense Summary Chart */}
      <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            Expense Summary
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-faint)' }}>Total expenses by category</p>
        </div>
      </div>
      <div className="card" style={{ marginBottom: '24px' }}>
        {loadingPayments ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div className="spinner" style={{ width: '28px', height: '28px', margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading chart data…</p>
          </div>
        ) : (
          <>
            <div style={{
              background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
              borderRadius: '12px', padding: '14px 18px',
              marginBottom: '20px', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span style={{ color: '#1e3a8a', fontWeight: '700', fontSize: '13px' }}>Total Expense</span>
              <span style={{ color: '#1d4ed8', fontWeight: '900', fontSize: '24px' }}>{formatCurrency(totalExpense)}</span>
            </div>
            <PieChart data={chartData} />
          </>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: '12px 0', fontSize: '12px', color: 'var(--text-faint)' }}>
        Developed by Subrata Bala
      </div>
    </div>
  );
}
