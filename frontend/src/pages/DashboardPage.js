import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatCurrency, getTodayDate } from '../utils/helpers';

const StatCard = ({ icon, label, value, color, sub }) => (
  <div style={{
    background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '20px',
    border: '1px solid var(--border)', boxShadow: 'var(--shadow)'
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <p style={{ margin: '0 0 6px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
        <p style={{ margin: 0, fontSize: '26px', fontWeight: '800', color: color || 'var(--text)' }}>{value}</p>
        {sub && <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
      <span style={{ fontSize: '32px' }}>{icon}</span>
    </div>
  </div>
);

const FeatureCard = ({ to, icon, label }) => (
  <Link to={to} style={{
    display: 'block',
    textDecoration: 'none',
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    padding: '20px 16px',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow)',
    textAlign: 'center',
    transition: 'all 0.2s ease-in-out',
    height: '100%'
  }}
  onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
  onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}
  >
    <span style={{ fontSize: '32px' }}>{icon}</span>
    <p style={{ margin: '10px 0 0', fontWeight: '700', color: 'var(--text)', fontSize: '13px', lineHeight: '1.4' }}>{label}</p>
  </Link>
);

function PieChart({ data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) {
    return <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No payment data available to display chart.</div>;
  }

  let cumulative = 0;
  const paths = data.map(item => {
    const percentage = item.value / total;
    const startAngle = (cumulative / total) * 360;
    const endAngle = startAngle + percentage * 360;
    cumulative += item.value;

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
      <svg viewBox="0 0 100 100" width="160" height="160" style={{ flexShrink: 0 }}>
        {paths.map((d, i) => (
          <path key={i} d={d} fill={data[i].color} />
        ))}
      </svg>
      <div style={{ flex: 1 }}>
        {data.map(item => (
          <div key={item.name} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ width: '12px', height: '12px', backgroundColor: item.color, borderRadius: '4px', marginRight: '10px' }}></span>
            <div>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>{item.name}</p>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>{formatCurrency(item.value)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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
    { name: 'Labour Wages', value: paymentSummary.labour, color: '#3b82f6' },
    { name: 'Daily Workers', value: paymentSummary.dailyWorkers, color: '#8b5cf6' },
    { name: 'Fertilizer', value: paymentSummary.fertilizer, color: '#10b981' },
    { name: 'Diesel', value: paymentSummary.diesel, color: '#f59e0b' },
    { name: 'Land Tenants', value: paymentSummary.landTenants, color: '#ef4444' },
  ].filter(item => item.value > 0) : [];

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div>
      {/* New Management Section */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <FeatureCard to="/fertilizer" icon="🌿" label="Fertilizer Management" />
          <FeatureCard to="/harvesting" icon="🚜" label="Diesel Purchasing Management" />
          <FeatureCard to="/tenants" icon="👨‍🌾" label="Land Tenant Management" />
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontWeight: '800', fontSize: '22px' }}>Dashboard</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>Today's overview</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <StatCard icon="👷" label="Total Labour" value={summary?.total || 0} />
        <StatCard icon="✅" label="Present Today" value={summary?.present || 0} color="#10b981" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginBottom: '16px' }}>
        <StatCard icon="💰" label="Total Wage (Individual)" value={formatCurrency(summary?.totalWage)} />
        <StatCard icon="💳" label="Total Paid" value={formatCurrency(summary?.totalPaid)} color="#0ea5e9" />
        <StatCard icon="⏳" label="Remaining Balance" value={formatCurrency(summary?.remaining)} color="#ef4444" />
      </div>

      {daily && (
        <div style={{ background: 'linear-gradient(135deg, #0ea5e9, #10b981)', borderRadius: 'var(--radius)', padding: '20px', color: 'white', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 16px', fontWeight: '800' }}>🏗️ Quick Daily Summary</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              ['Workers', daily.totalWorkers],
              ['Daily Rate', formatCurrency(daily.dailyAmount)],
              ['Total Wage', formatCurrency(daily.totalWage)],
              ['Remaining', formatCurrency(daily.remaining)]
            ].map(([l, v]) => (
              <div key={l} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '12px', padding: '12px' }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', opacity: 0.8, fontWeight: '600', textTransform: 'uppercase' }}>{l}</p>
                <p style={{ margin: 0, fontWeight: '800', fontSize: '18px' }}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expense Summary Pie Chart */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontWeight: '800', fontSize: '22px' }}>Expense Summary</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>Total payments by category</p>
      </div>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', marginBottom: '24px' }}>
        {loadingPayments ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Loading Chart Data...</div>
        ) : (
          <PieChart data={chartData} />
        )}
      </div>
      <div style={{ textAlign: 'center', padding: '20px 0 10px', fontSize: '12px', color: 'var(--text-muted)', opacity: 0.6 }}>
        Developed by Subrata Bala
      </div>
    </div>
  );
}
