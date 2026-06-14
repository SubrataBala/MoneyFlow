import React, { useState } from 'react';
import api from '../utils/api';
import { formatCurrency, formatDate, getTodayDate } from '../utils/helpers';
import toast from 'react-hot-toast';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

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

  const exportPDF = () => {
    if (!report) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow pop-ups to export the PDF.');
      return;
    }

    const wageRows = report.wages.length
      ? report.wages.map(w => `
          <tr>
            <td>${escapeHtml(w.labour?.name)}</td>
            <td class="num">${w.presentDays || 0}</td>
            <td class="num">${formatCurrency(w.totalWage)}</td>
            <td class="num">${formatCurrency(w.totalPaid)}</td>
            <td class="num">${formatCurrency(w.remaining)}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="5" class="empty">No individual wage entries for this period.</td></tr>';

    const dailyRows = report.daily.length
      ? report.daily.map(d => `
          <tr>
            <td>${formatDate(d.date)}</td>
            <td class="num">${d.totalWorkers || 0}</td>
            <td class="num">${formatCurrency(d.dailyAmount)}</td>
            <td class="num">${formatCurrency(d.totalWage)}</td>
            <td class="num">${formatCurrency(d.totalPaid)}</td>
            <td class="num">${formatCurrency(d.remaining)}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="6" class="empty">No daily summary entries for this period.</td></tr>';

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Subh Ent. Report ${startDate} to ${endDate}</title>
          <style>
            @page { size: A4; margin: 14mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              color: #111827;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 11px;
              line-height: 1.35;
            }
            .report {
              width: 100%;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 24px;
              border-bottom: 2px solid #111827;
              padding-bottom: 12px;
              margin-bottom: 14px;
            }
            .company {
              margin: 0;
              font-size: 26px;
              font-weight: 800;
              letter-spacing: 0;
            }
            .subtitle {
              margin: 4px 0 0;
              font-size: 12px;
              color: #4b5563;
              font-weight: 700;
            }
            .date-box {
              text-align: right;
              font-size: 11px;
              color: #374151;
              white-space: nowrap;
            }
            .date-box strong {
              display: block;
              color: #111827;
              font-size: 12px;
              margin-bottom: 3px;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 8px;
              margin-bottom: 14px;
            }
            .summary-card {
              border: 1px solid #d1d5db;
              padding: 9px;
              border-radius: 6px;
              background: #f9fafb;
            }
            .label {
              margin: 0 0 4px;
              color: #6b7280;
              font-size: 9px;
              font-weight: 800;
              text-transform: uppercase;
            }
            .value {
              margin: 0;
              font-size: 14px;
              font-weight: 800;
            }
            .section {
              margin-top: 14px;
              page-break-inside: avoid;
            }
            h2 {
              margin: 0 0 8px;
              font-size: 14px;
              border-left: 4px solid #10b981;
              padding-left: 8px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              page-break-inside: auto;
            }
            tr { page-break-inside: avoid; page-break-after: auto; }
            th, td {
              border: 1px solid #d1d5db;
              padding: 6px 7px;
              vertical-align: middle;
            }
            th {
              background: #ecfdf5;
              color: #064e3b;
              font-size: 9px;
              text-transform: uppercase;
              text-align: left;
            }
            .num {
              text-align: right;
              white-space: nowrap;
            }
            .empty {
              text-align: center;
              color: #6b7280;
              padding: 14px;
            }
            .totals-row td {
              font-weight: 800;
              background: #f3f4f6;
            }
            .footer {
              margin-top: 18px;
              padding-top: 8px;
              border-top: 1px solid #d1d5db;
              color: #6b7280;
              font-size: 10px;
              text-align: center;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <main class="report">
            <header class="header">
              <div>
                <h1 class="company">Subh Ent.</h1>
                <p class="subtitle">Wage and Daily Worker Report</p>
              </div>
              <div class="date-box">
                <strong>Report Date</strong>
                ${formatDate(startDate)} to ${formatDate(endDate)}<br />
                Generated: ${formatDate(getTodayDate())}
              </div>
            </header>

            <section class="summary-grid">
              <div class="summary-card">
                <p class="label">Total Expense</p>
                <p class="value">${formatCurrency(grandTotalWage)}</p>
              </div>
              <div class="summary-card">
                <p class="label">Total Paid</p>
                <p class="value">${formatCurrency(grandTotalPaid)}</p>
              </div>
              <div class="summary-card">
                <p class="label">Total Remaining</p>
                <p class="value">${formatCurrency(grandTotalRem)}</p>
              </div>
            </section>

            <section class="section">
              <h2>Individual Labour Wages</h2>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th class="num">Present Days</th>
                    <th class="num">Total Wage</th>
                    <th class="num">Total Paid</th>
                    <th class="num">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  ${wageRows}
                  <tr class="totals-row">
                    <td>Total</td>
                    <td></td>
                    <td class="num">${formatCurrency(totalWage)}</td>
                    <td class="num">${formatCurrency(totalPaid)}</td>
                    <td class="num">${formatCurrency(totalRem)}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section class="section">
              <h2>Daily Worker Summary</h2>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th class="num">Workers</th>
                    <th class="num">Daily Rate</th>
                    <th class="num">Total Wage</th>
                    <th class="num">Total Paid</th>
                    <th class="num">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  ${dailyRows}
                  <tr class="totals-row">
                    <td>Total</td>
                    <td></td>
                    <td></td>
                    <td class="num">${formatCurrency(dailyTotalWage)}</td>
                    <td class="num">${formatCurrency(dailyTotalPaid)}</td>
                    <td class="num">${formatCurrency(dailyTotalRem)}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <footer class="footer">Developed by Subrata Bala</footer>
          </main>
          <script>
            window.onload = () => {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    toast.success('PDF report is ready to save.');
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

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginBottom: '16px' }}>
            <button onClick={exportPDF} style={{ width: '100%', padding: '14px', background: '#10b981', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '700', fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' }}>
              📄 Export PDF
            </button>
            <button onClick={exportCSV} style={{ width: '100%', padding: '14px', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: '12px', color: 'var(--text)', fontWeight: '700', fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' }}>
              CSV
            </button>
          </div>

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
