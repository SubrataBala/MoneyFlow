import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { formatCurrency, formatDate } from '../utils/helpers';

export default function WagesPage() {
  const [wages, setWages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState('');

  const fetchWages = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/labour/wages');
      setWages(data);
    } catch (e) {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchWages(); }, [fetchWages]);

  const fetchDetail = async (labourId) => {
    // If the user clicks the same labourer again, close the detail view.
    if (selected === labourId) {
      setSelected(null);
      setDetail(null);
      return;
    }
    try {
      const { data } = await api.get(`/labour/${labourId}/wages`);
      setDetail(data);
      setSelected(labourId);
    } catch (e) {}
  };

  // Filter labours based on the search term
  const filteredWages = wages.filter(w =>
    w.labour.name.toLowerCase().includes(search.toLowerCase())
  );

  // Calculate totals based on the original full list, not the filtered one
  const totalWage = wages.reduce((s, w) => s + parseFloat(w.totalWage || 0), 0);
  const totalPaid = wages.reduce((s, w) => s + parseFloat(w.totalPaid || 0), 0);
  const totalRemaining = wages.reduce((s, w) => s + parseFloat(w.remaining || 0), 0);
  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontWeight: '800', fontSize: '22px' }}>Wage Summary</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>All-time calculations</p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
        {[
          { label: 'Total Wage', value: formatCurrency(totalWage), color: 'var(--text)' },
          { label: 'Total Paid', value: formatCurrency(totalPaid), color: '#0ea5e9' },
          { label: 'Remaining', value: formatCurrency(totalRemaining), color: '#ef4444' }
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--surface)', borderRadius: '14px', padding: '14px', border: '1px solid var(--border)', textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>{c.label}</p>
            <p style={{ margin: 0, fontWeight: '800', fontSize: '14px', color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Search Input */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Search by name..."
        style={{
          width: '100%', padding: '12px 16px', borderRadius: '12px',
          border: '1.5px solid var(--border)', background: 'var(--surface)',
          color: 'var(--text)', fontSize: '15px', fontFamily: 'inherit',
          marginBottom: '16px', boxSizing: 'border-box'
        }}
      />

      {/* Labour List */}
      {loading ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredWages.map(w => (
            <div key={w.labour.id}
              onClick={() => fetchDetail(w.labour.id)}
              style={{
                background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '16px',
                border: `1.5px solid ${selected === w.labour.id ? 'var(--primary)' : 'var(--border)'}`,
                boxShadow: 'var(--shadow)', cursor: 'pointer'
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #0ea5e9, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800' }}>
                    {w.labour.name[0].toUpperCase()}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: '700' }}>{w.labour.name}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                      {w.presentDays} days present
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontWeight: '800', color: '#ef4444' }}>{formatCurrency(w.remaining)}</p>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>remaining</p>
                </div>
              </div>

              {selected === w.labour.id && detail && detail.labour.id === w.labour.id && (
                <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                    {[
                      ['Total Wage', formatCurrency(detail.totalWage), '#10b981'],
                      ['Paid', formatCurrency(detail.totalPaid), '#0ea5e9'],
                      ['Balance', formatCurrency(detail.remaining), '#ef4444']
                    ].map(([l, v, c]) => (
                      <div key={l} style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                        <p style={{ margin: '0 0 3px', fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>{l}</p>
                        <p style={{ margin: 0, fontWeight: '800', fontSize: '13px', color: c }}>{v}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ maxHeight: '240px', overflowY: 'auto', marginTop: '8px' }}>
                    {/* Header for the records table */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: '8px', padding: '0 4px 8px', borderBottom: '2px solid var(--border)', fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      <span>Date</span>
                      <span>Status</span>
                      <span>Wage</span>
                      <span>Paid</span>
                    </div>
                    {detail.records.map(r => (
                      <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', alignItems: 'center', gap: '8px', padding: '8px 4px', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
                        <span>{formatDate(r.date)}</span>
                        <span style={{ color: r.attendance === 'present' ? '#10b981' : '#ef4444', fontWeight: '600', textTransform: 'capitalize' }}>{r.attendance}</span>
                        <span>{formatCurrency(r.dailyWage)}</span>
                        <span style={{ color: '#0ea5e9' }}>+{formatCurrency(r.amountPaidToday)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{ textAlign: 'center', padding: '20px 0 10px', fontSize: '12px', color: 'var(--text-muted)', opacity: 0.6 }}>
        Developed by Subrata Bala
      </div>
    </div>
  );
}
