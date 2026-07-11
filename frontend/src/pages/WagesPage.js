import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';
import { formatCurrency, getTodayDate } from '../utils/helpers';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────
// REUSABLE UI (borrowed from other pages for consistency)
// ─────────────────────────────────────────────
const fmtShort = (v) => '₹' + Number(v || 0).toLocaleString('en-IN');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '520px', padding: '20px 20px max(20px,env(safe-area-inset-bottom))', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 style={{ margin: 0, fontWeight: '800', fontSize: '18px' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'var(--surface2)', border: 'none', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontWeight: '700', color: 'var(--text)', fontFamily: 'inherit', fontSize: '14px' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Label({ children }) {
  return (
    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
      {children}
    </label>
  );
}

function Input({ style = {}, ...props }) {
  return (
    <input style={{
      width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)',
      borderRadius: '10px', padding: '12px', fontSize: '15px', fontWeight: '600',
      color: 'var(--text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', ...style
    }} {...props} />
  );
}

function BtnPrimary({ children, style = {}, ...props }) {
  return (
    <button style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      background: 'linear-gradient(135deg, #0ea5e9, #10b981)', border: 'none', color: 'white',
      fontWeight: '700', padding: '14px 16px', borderRadius: '12px', fontSize: '15px',
      cursor: 'pointer', width: '100%', fontFamily: 'inherit', ...style
    }} {...props}>
      {children}
    </button>
  );
}

function Card({ children, style = {} }) {
    return (
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
        padding: '16px', boxShadow: 'var(--shadow)', ...style
      }}>
        {children}
      </div>
    );
}

function Empty({ icon, text, hint }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: '38px', marginBottom: '12px' }}>{icon}</div>
      <p style={{ fontWeight: '700', margin: '0 0 4px', fontSize: '14px' }}>{text}</p>
      {hint && <p style={{ fontSize: '12px', margin: 0 }}>{hint}</p>}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700', color: 'var(--text)', margin: 0 }}>
        <span style={{ width: '4px', height: '16px', borderRadius: '99px', background: '#10b981', display: 'inline-block' }} />
        {children}
      </h2>
    </div>
  );
}

export default function WagesPage() {
  const [wages, setWages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [wageModalLabourId, setWageModalLabourId] = useState(null);

  const fetchWages = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/labour/wages');
      setWages(data);
    } catch (e) {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchWages(); }, [fetchWages]);

  // Filter labours based on the search term
  const filteredWages = wages.filter(w =>
    w.labour.name.toLowerCase().includes(search.toLowerCase())
  );

  // Calculate totals based on the original full list, not the filtered one
  const totalWage = wages.reduce((s, w) => s + parseFloat(w.totalWage || 0), 0);
  const totalPaid = wages.reduce((s, w) => s + parseFloat(w.totalPaid || 0), 0);
  const totalRemaining = wages.reduce((s, w) => s + parseFloat(w.remaining || 0), 0);
  const totalAdvance = wages.reduce((s, w) => s + parseFloat(w.advance || 0), 0);
  return (
    <div>
      {wageModalLabourId && (
        <WageSummaryModal labourId={wageModalLabourId} onClose={() => setWageModalLabourId(null)} />
      )}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontWeight: '800', fontSize: '22px' }}>Wage Summary</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>All-time calculations</p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
        {[
          { label: 'Total Wage', value: formatCurrency(totalWage), color: 'var(--text)' },
          { label: 'Total Paid', value: formatCurrency(totalPaid), color: '#0ea5e9' },
          { label: 'Due', value: formatCurrency(totalRemaining), color: '#ef4444' },
          { label: 'Advance', value: formatCurrency(totalAdvance), color: '#10b981' }
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
              onClick={() => setWageModalLabourId(w.labour.id)}
              style={{
                background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '16px',
                border: `1.5px solid var(--border)`,
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
                  <p style={{ margin: 0, fontWeight: '800', color: parseFloat(w.advance || 0) > 0 ? '#10b981' : '#ef4444' }}>
                    {formatCurrency(parseFloat(w.advance || 0) > 0 ? w.advance : w.remaining)}
                  </p>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                    {parseFloat(w.advance || 0) > 0 ? 'advance' : 'due'}
                  </p>
                </div>
              </div>
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

// ═══════════════════════════════════════════════════════════
// WAGE SUMMARY MODAL
// ═══════════════════════════════════════════════════════════
function WageSummaryModal({ labourId, onClose }) {
  const queryClient = useQueryClient();
  const paymentSubmitLocked = useRef(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', date: getTodayDate(), notes: '' });
  const [showAllWorkRecords, setShowAllWorkRecords] = useState(false);
  const [showAllPaymentHistory, setShowAllPaymentHistory] = useState(false);

  const { data: summary, isLoading, isError } = useQuery({
    queryKey: ['wageSummary', labourId],
    queryFn: () => api.get(`/labour/${labourId}/wages`).then(res => res.data),
    onSuccess: () => {
      // When the modal data loads, also invalidate the main page query
      // to ensure the list reflects the latest totals.
      queryClient.invalidateQueries({ queryKey: ['wages'] });
    }
  });

  const paymentMutation = useMutation({
    mutationFn: (paymentData) => api.post('/labour/payments', paymentData),
    onSuccess: () => {
      toast.success('Payment recorded!');
      setPaymentForm({ amount: '', date: getTodayDate(), notes: '' });
      queryClient.invalidateQueries({ queryKey: ['wageSummary', labourId] });
      queryClient.invalidateQueries({ queryKey: ['wages'] }); // Invalidate main page data too
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to record payment'),
    onSettled: () => {
      paymentSubmitLocked.current = false;
    },
  });

  const handlePay = () => {
    if (paymentSubmitLocked.current || paymentMutation.isPending) {
      return;
    }

    const amount = parseFloat(paymentForm.amount);
    if (!amount || amount <= 0) {
      return toast.error('Please enter a valid payment amount.');
    }
    if (!paymentForm.date) {
      return toast.error('Please select a payment date.');
    }

    paymentSubmitLocked.current = true;
    paymentMutation.mutate({
      labourId,
      amount,
      date: paymentForm.date,
      notes: paymentForm.notes,
      paymentMethod: 'Cash', // Defaulting for now
    });
  };

  const set = (key, val) => setPaymentForm(f => ({ ...f, [key]: val }));
  const workRecords = summary?.records?.filter(r => r.attendance === 'present') || [];
  const visibleWorkRecords = showAllWorkRecords ? workRecords : workRecords.slice(0, 1);
  const hiddenWorkRecordsCount = Math.max(workRecords.length - 1, 0);
  const paymentHistory = summary?.paymentHistory || [];
  const visiblePaymentHistory = showAllPaymentHistory ? paymentHistory : paymentHistory.slice(0, 1);
  const hiddenPaymentHistoryCount = Math.max(paymentHistory.length - 1, 0);
  const exportLabourPDF = () => {
    if (!summary) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow pop-ups to export the PDF.');
      return;
    }

    const allDates = [
      ...workRecords.map(r => r.date),
      ...paymentHistory.map(p => p.date),
    ].filter(Boolean).sort();
    const reportRange = allDates.length
      ? `${fmtDate(allDates[0])} to ${fmtDate(allDates[allDates.length - 1])}`
      : 'All records';

    const workRows = workRecords.length
      ? workRecords.map(record => `
          <tr>
            <td>${fmtDate(record.date)}</td>
            <td>Present</td>
            <td class="num">${formatCurrency(record.dailyWage)}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="3" class="empty">No work records found.</td></tr>';

    const paymentRows = paymentHistory.length
      ? paymentHistory.map(payment => `
          <tr>
            <td>${fmtDate(payment.date)}</td>
            <td>${escapeHtml(payment.paymentMethod || 'Cash')}</td>
            <td>${escapeHtml(payment.notes || '-')}</td>
            <td class="num">${formatCurrency(payment.amount)}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="4" class="empty">No payments recorded.</td></tr>';

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Subh Ent. Labour Report - ${escapeHtml(summary.labour?.name)}</title>
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
              color: #4b5563;
              font-size: 12px;
              font-weight: 700;
            }
            .date-box {
              text-align: right;
              color: #374151;
              white-space: nowrap;
            }
            .date-box strong {
              display: block;
              color: #111827;
              font-size: 12px;
              margin-bottom: 3px;
            }
            .labour-name {
              margin: 0 0 12px;
              padding: 9px 10px;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              background: #f9fafb;
              font-size: 13px;
              font-weight: 800;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
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
              font-size: 13px;
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
              text-align: left;
              text-transform: uppercase;
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
              background: #f3f4f6;
              font-weight: 800;
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
          <main>
            <header class="header">
              <div>
                <h1 class="company">Subh Ent.</h1>
                <p class="subtitle">Labour Wage and Payment Report</p>
              </div>
              <div class="date-box">
                <strong>Report Date Range</strong>
                ${reportRange}<br />
                Generated: ${fmtDate(getTodayDate())}
              </div>
            </header>

            <p class="labour-name">Labour: ${escapeHtml(summary.labour?.name || 'Unknown')}</p>

            <section class="summary-grid">
              <div class="summary-card">
                <p class="label">Total Wage</p>
                <p class="value">${formatCurrency(summary.totalWage)}</p>
              </div>
              <div class="summary-card">
                <p class="label">Total Paid</p>
                <p class="value">${formatCurrency(summary.totalPaid)}</p>
              </div>
              <div class="summary-card">
                <p class="label">Remaining</p>
                <p class="value">${formatCurrency(summary.remaining)}</p>
              </div>
              <div class="summary-card">
                <p class="label">Advance</p>
                <p class="value">${formatCurrency(summary.advance)}</p>
              </div>
            </section>

            <section class="section">
              <h2>Work and Earnings</h2>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th class="num">Daily Wage</th>
                  </tr>
                </thead>
                <tbody>
                  ${workRows}
                  <tr class="totals-row">
                    <td>Total</td>
                    <td>${summary.presentDays || 0} day(s)</td>
                    <td class="num">${formatCurrency(summary.totalWage)}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section class="section">
              <h2>Payment History</h2>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Notes</th>
                    <th class="num">Amount Paid</th>
                  </tr>
                </thead>
                <tbody>
                  ${paymentRows}
                  <tr class="totals-row">
                    <td>Total</td>
                    <td></td>
                    <td></td>
                    <td class="num">${formatCurrency(summary.totalPaid)}</td>
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
    toast.success('Labour PDF report is ready to save.');
  };

  return (
    <Modal title={`Wage Summary for ${summary?.labour?.name || '...'}`} onClose={onClose}>
      {isLoading && <p>Loading summary...</p>}
      {isError && <p style={{ color: '#ef4444' }}>Failed to load summary.</p>}
      {summary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Card style={{ margin: 0, padding: '12px', textAlign: 'center' }}>
              <Label>Total Days Worked</Label>
              <p style={{ margin: 0, fontWeight: '900', fontSize: '20px', color: 'var(--text)' }}>{summary.presentDays || 0}</p>
            </Card>
            <Card style={{ margin: 0, padding: '12px', textAlign: 'center' }}>
              <Label>Total Earned</Label>
              <p style={{ margin: 0, fontWeight: '900', fontSize: '20px', color: 'var(--text)' }}>{fmtShort(summary.totalWage)}</p>
            </Card>
            <Card style={{ margin: 0, padding: '12px', textAlign: 'center' }}>
              <Label>Total Paid</Label>
              <p style={{ margin: 0, fontWeight: '900', fontSize: '20px', color: '#10b981' }}>{fmtShort(summary.totalPaid)}</p>
            </Card>
          </div>
          <BtnPrimary onClick={exportLabourPDF} style={{ background: '#10b981' }}>
            📄 Export PDF
          </BtnPrimary>

          {/* Balance Amount */}
          <div style={{ background: summary.advance > 0 ? '#f0fdf4' : summary.remaining > 0 ? '#fffbeb' : '#f0fdf4', border: `1.5px solid ${summary.advance > 0 ? '#86efac' : summary.remaining > 0 ? '#fcd34d' : '#86efac'}`, borderRadius: '14px', padding: '16px', textAlign: 'center' }}>
            <Label>{summary.advance > 0 ? 'Advance Balance' : 'Remaining Due'}</Label>
            <p style={{ margin: 0, fontWeight: '900', fontSize: '28px', color: summary.advance > 0 ? '#10b981' : summary.remaining > 0 ? '#f59e0b' : '#10b981' }}>
              {fmtShort(summary.advance > 0 ? summary.advance : summary.remaining)}
            </p>
          </div>

          {/* Payment Form */}
          <Card style={{ margin: 0 }}>
            <SectionTitle>Record a Payment</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <Label>Amount to Pay (₹)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={paymentForm.amount}
                  onChange={e => set('amount', e.target.value)}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <Label>Payment Date</Label>
                  <Input type="date" value={paymentForm.date} onChange={e => set('date', e.target.value)} />
                </div>
                <div style={{ alignSelf: 'end' }}>
                  <button onClick={() => set('amount', summary.remaining > 0 ? summary.remaining : '')} disabled={summary.remaining <= 0} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px dashed var(--border)', background: 'var(--surface2)', color: 'var(--text-muted)', fontWeight: '700', cursor: summary.remaining > 0 ? 'pointer' : 'not-allowed', opacity: summary.remaining > 0 ? 1 : 0.6 }}>
                    Pay Full Amount
                  </button>
                </div>
              </div>
              <div>
                <Label>Notes (Optional)</Label>
                <Input placeholder="e.g., Advance payment" value={paymentForm.notes} onChange={e => set('notes', e.target.value)} />
              </div>
              <BtnPrimary onClick={handlePay} disabled={paymentMutation.isPending}>
                {paymentMutation.isPending ? 'Processing...' : '💾 Record Payment'}
              </BtnPrimary>
            </div>
          </Card>

          {/* Work & Earnings */}
          <div>
            <SectionTitle>Work & Earnings</SectionTitle>
            {workRecords.length === 0 ? (
              <Empty icon="📅" text="No work dates recorded yet" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', padding: '4px' }}>
                {visibleWorkRecords.map(record => (
                  <div key={record.id} style={{ background: 'var(--surface2)', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', margin: 0 }}>{fmtDate(record.date)}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                        Worked this date
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '16px', fontWeight: '900', color: 'var(--text)', margin: 0 }}>
                        {fmtShort(record.dailyWage)}
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>earned</p>
                    </div>
                  </div>
                ))}
                {hiddenWorkRecordsCount > 0 && (
                  <button
                    type="button"
                    className={`work-toggle-btn ${showAllWorkRecords ? 'is-open' : ''}`}
                    onClick={() => setShowAllWorkRecords(v => !v)}
                    style={{
                      width: '100%',
                      border: '1.5px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      borderRadius: '12px',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: '13px',
                      fontWeight: '800'
                    }}
                  >
                    <span>{showAllWorkRecords ? 'Show less' : `Show ${hiddenWorkRecordsCount} more work date${hiddenWorkRecordsCount > 1 ? 's' : ''}`}</span>
                    <span className="work-toggle-arrow" aria-hidden="true">
                      <span className="work-toggle-chevron" />
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Payment History */}
          <div>
            <SectionTitle>Payment History</SectionTitle>
            {paymentHistory.length === 0 ? (
              <Empty icon="💸" text="No payments recorded yet" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', padding: '4px' }}>
                {visiblePaymentHistory.map(p => (
                  <div key={p.id} style={{ background: 'var(--surface2)', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', margin: 0 }}>{fmtDate(p.date)}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                        {p.notes}
                      </p>
                    </div>
                    <p style={{ fontSize: '16px', fontWeight: '900', color: '#10b981', margin: 0 }}>
                      {fmtShort(p.amount)}
                    </p>
                  </div>
                ))}
                {hiddenPaymentHistoryCount > 0 && (
                  <button
                    type="button"
                    className={`work-toggle-btn ${showAllPaymentHistory ? 'is-open' : ''}`}
                    onClick={() => setShowAllPaymentHistory(v => !v)}
                    style={{
                      width: '100%',
                      border: '1.5px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      borderRadius: '12px',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: '13px',
                      fontWeight: '800'
                    }}
                  >
                    <span>{showAllPaymentHistory ? 'Show less' : `Show ${hiddenPaymentHistoryCount} more payment${hiddenPaymentHistoryCount > 1 ? 's' : ''}`}</span>
                    <span className="work-toggle-arrow" aria-hidden="true">
                      <span className="work-toggle-chevron" />
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
