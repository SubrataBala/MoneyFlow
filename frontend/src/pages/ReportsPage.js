import React, { useState } from 'react';
import api from '../utils/api';
import { formatCurrency, formatDate, getTodayDate } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function ReportsPage() {
  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const [wageRes, dailyRes] = await Promise.all([
        api.get(`/labour/wages?startDate=${startDate}&endDate=${endDate}`),
        api.get(`/daily-worker?startDate=${startDate}&endDate=${endDate}`)
      ]);
      setReport({ wages: wageRes.data, daily: dailyRes.data });
    } catch (e) { toast.error('Failed to load report'); }
    setLoading(false);
  };

  const exportCSV = () => {
    if (!report) return;
    let csv = 'Individual Labour Wages\n';
    csv += 'Name,Present Days,Total Wage,Total Paid,Remaining\n';
    report.wages.forEach(w => {
      csv += `${w.labour.name},${w.presentDays},${w.totalWage},${w.totalPaid},${w.remaining}\n`;
    });

    csv += '\n\nDaily Worker Summary\n';
    csv += 'Date,Total Workers,Daily Rate,Total Wage,Total Paid,Remaining\n';
    report.daily.forEach(d => {
      csv += `${formatDate(d.date)},${d.totalWorkers},${d.dailyAmount},${d.totalWage},${d.totalPaid},${d.remaining}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `report_${startDate}_${endDate}.csv`; a.click();
    toast.success('CSV downloaded!');
  };

  const totalWage = report?.wages.reduce((s, w) => s + parseFloat(w.totalWage || 0), 0) || 0;
  const totalPaid = report?.wages.reduce((s, w) => s + parseFloat(w.totalPaid || 0), 0) || 0;
  const totalRem = report?.wages.reduce((s, w) => s + parseFloat(w.remaining || 0), 0) || 0;

  const dailyTotalWage = report?.daily.reduce((s, d) => s + parseFloat(d.totalWage || 0), 0) || 0;
  const dailyTotalPaid = report?.daily.reduce((s, d) => s + parseFloat(d.totalPaid || 0), 0) || 0;
  const dailyTotalRem = report?.daily.reduce((s, d) => s + parseFloat(d.remaining || 0), 0) || 0;

  // Grand totals for the entire report period
  const grandTotalWage = totalWage + dailyTotalWage;
  const grandTotalPaid = totalPaid + dailyTotalPaid;
  const grandTotalRem = totalRem + dailyTotalRem;

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontWeight: '800', fontSize: '22px' }}>Reports</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>Export & filter data</p>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '20px', border: '1px solid var(--border)', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          {[['From', startDate, setStartDate], ['To', endDate, setEndDate]].map(([label, val, setter]) => (
            <div key={label}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</label>
              <input type="date" value={val} onChange={e => setter(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          ))}
        </div>
        <button onClick={fetchReport} disabled={loading} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #0ea5e9, #10b981)', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '700', fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' }}>
          {loading ? '⏳ Loading...' : '📊 Generate Report'}
        </button>
      </div>

      {report && (
        <>
          {/* Grand Total Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Total Expense', value: formatCurrency(grandTotalWage), color: 'var(--text)' },
              { label: 'Total Paid', value: formatCurrency(grandTotalPaid), color: '#10b981' },
              { label: 'Total Remaining', value: formatCurrency(grandTotalRem), color: '#ef4444' }
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'var(--surface)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border)', textAlign: 'center', boxShadow: 'var(--shadow)' }}>
                <p style={{ margin: '0 0 6px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>{label}</p>
                <p style={{ margin: 0, fontWeight: '800', fontSize: '20px', color }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Breakdown Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px', marginBottom: '16px', background: 'var(--surface2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            {[
              ['Ind. Wage', formatCurrency(totalWage)],
              ['Ind. Paid', formatCurrency(totalPaid)],
              ['Ind. Due', formatCurrency(totalRem)],
              ['Daily Wage', formatCurrency(dailyTotalWage)],
              ['Daily Paid', formatCurrency(dailyTotalPaid)],
              ['Daily Due', formatCurrency(dailyTotalRem)],
            ].map(([l, v]) => (
              <div key={l} style={{ background: 'var(--surface)', borderRadius: '10px', padding: '10px', border: '1px solid var(--border)', textAlign: 'center' }}>
                <p style={{ margin: '0 0 3px', fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>{l}</p>
                <p style={{ margin: 0, fontWeight: '800', fontSize: '13px' }}>{v}</p>
              </div>
            ))}
          </div>

          <button onClick={exportCSV} style={{ width: '100%', padding: '14px', background: '#10b981', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '700', fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '16px' }}>
            ⬇️ Export CSV
          </button>

          {/* Table */}
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: '700', fontSize: '13px', background: 'var(--surface2)' }}>
              Individual Labour Wages
            </div>
            {report.wages.map(w => (
              <div key={w.labour.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: '600' }}>{w.labour.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{w.presentDays} days</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontWeight: '700', color: '#10b981' }}>{formatCurrency(w.totalWage)}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#ef4444' }}>Due: {formatCurrency(w.remaining)}</p>
                </div>
              </div>
            ))}
            {report.wages.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>No individual wage entries for this period.</div>}
          </div>

          {/* Daily Summary Table */}
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: '700', fontSize: '13px', background: 'var(--surface2)' }}>
              Daily Worker Summary
            </div>
            {report.daily.map(d => (
              <div key={d.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center', gap: '10px' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: '600' }}>{formatDate(d.date)}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{d.totalWorkers} workers</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ margin: 0, fontWeight: '700' }}>{formatCurrency(d.totalWage)}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Wage</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontWeight: '700', color: '#ef4444' }}>{formatCurrency(d.remaining)}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Due</p>
                </div>
              </div>
            ))}
            {report.daily.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>No daily summary entries for this period.</div>}
          </div>
        </>
      )}
      <div style={{ textAlign: 'center', padding: '20px 0 10px', fontSize: '12px', color: 'var(--text-muted)', opacity: 0.6 }}>
        Developed by Subrata Bala
      </div>
    </div>
  );
}
