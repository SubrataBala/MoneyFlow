import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../utils/api';
import { formatCurrency, formatDate, getTodayDate } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function DailySummaryPage() {
  const [form, setForm] = useState({ date: getTodayDate(), totalWorkers: '', dailyAmount: '', totalPaid: '' });
  const [paymentForm, setPaymentForm] = useState({ amount: '' });
  const [isRecordLocked, setIsRecordLocked] = useState(false);

  // State for history date range filter
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Default to last 30 days
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(getTodayDate());

  const [records, setRecords] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);

  const computed = {
    totalWage: (parseFloat(form.totalWorkers) || 0) * (parseFloat(form.dailyAmount) || 0),
    remaining: ((parseFloat(form.totalWorkers) || 0) * (parseFloat(form.dailyAmount) || 0)) - (parseFloat(form.totalPaid) || 0)
  };
  const rangeTotals = useMemo(() => ({
    totalWage: records.reduce((s, r) => s + parseFloat(r.totalWage || 0), 0),
    totalPaid: records.reduce((s, r) => s + parseFloat(r.totalPaid || 0), 0),
    totalDue: records.reduce((s, r) => s + parseFloat(r.remaining || 0), 0)
  }), [records]);

  const fetchRecords = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const [recordsRes, paymentsRes] = await Promise.all([
        api.get(`/daily-worker?startDate=${startDate}&endDate=${endDate}`),
        api.get(`/daily-worker/payments?startDate=${startDate}&endDate=${endDate}`)
      ]);
      setRecords(recordsRes.data);
      setPayments(paymentsRes.data);
    } catch (e) { toast.error('Failed to load history'); }
    setLoading(false);
  }, [startDate, endDate]);

  // Fetch records on initial component mount. Subsequent fetches are manual via the filter button.
  useEffect(() => {
    fetchRecords();
  }, []);

  // Load existing record for selected date
  useEffect(() => {
    const existing = records.find(r => r.date === form.date);
    if (existing) {
      setForm(f => ({ ...f, totalWorkers: existing.totalWorkers, dailyAmount: existing.dailyAmount, totalPaid: existing.totalPaid }));
      setIsRecordLocked(true);
    } else {
      // If no record exists for the new date, reset the form and unlock it
      setForm(f => ({ ...f, totalWorkers: '', dailyAmount: '', totalPaid: '' }));
      setIsRecordLocked(false);
    }
  }, [form.date, records]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.totalWorkers || !form.dailyAmount) return toast.error('Fill all fields');
    setSaving(true);
    try {
      await api.post('/daily-worker', form);
      toast.success('Saved!');
      fetchRecords();
    } catch (e) { toast.error('Save failed'); }
    setSaving(false);
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    const amount = parseFloat(paymentForm.amount);
    if (!startDate || !endDate) return toast.error('Select a date range');
    if (startDate > endDate) return toast.error('From date cannot be after To date');
    if (!amount || amount <= 0) return toast.error('Enter a valid payment amount');
    if (rangeTotals.totalDue <= 0) return toast.error('No due amount in this date range');
    if (amount > rangeTotals.totalDue) return toast.error('Payment cannot be greater than selected range due');

    setPaying(true);
    try {
      await api.post('/daily-worker/payment', {
        startDate,
        endDate,
        amount,
        date: getTodayDate()
      });
      toast.success('Payment added!');
      setPaymentForm(f => ({ ...f, amount: '' }));
      fetchRecords();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Payment failed');
    }
    setPaying(false);
  };

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontWeight: '800', fontSize: '22px' }}>Daily Worker Summary</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>Quick entry mode</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSave}>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', marginBottom: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Date</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Total Workers</label>
              <input type="number" value={form.totalWorkers} onChange={e => setForm(f => ({ ...f, totalWorkers: e.target.value }))} placeholder="0" style={inputStyle} disabled={isRecordLocked} />
            </div>
            <div>
              <label style={labelStyle}>Daily Rate ₹</label>
              <input type="number" value={form.dailyAmount} onChange={e => setForm(f => ({ ...f, dailyAmount: e.target.value }))} placeholder="0" style={inputStyle} disabled={isRecordLocked} />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Amount Paid Today ₹</label>
            <input type="number" value={form.totalPaid} onChange={e => setForm(f => ({ ...f, totalPaid: e.target.value }))} placeholder="0" style={inputStyle} disabled={isRecordLocked} />
          </div>

          {/* Auto Calc */}
          <div style={{ background: 'var(--surface2)', borderRadius: '12px', padding: '14px', marginBottom: '16px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Total Wage</span>
              <span style={{ fontWeight: '700' }}>{formatCurrency(computed.totalWage)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Remaining</span>
              <span style={{ fontWeight: '800', color: computed.remaining > 0 ? '#ef4444' : '#10b981' }}>{formatCurrency(computed.remaining)}</span>
            </div>
          </div>

          <button type="submit" disabled={saving || isRecordLocked} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #0ea5e9, #10b981)', border: 'none', borderRadius: '12px', color: 'white', fontSize: '16px', fontWeight: '700', cursor: (saving || isRecordLocked) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: (saving || isRecordLocked) ? 0.7 : 1 }}>
            {isRecordLocked ? '🔒 Entry Locked' : (saving ? '⏳ Saving...' : '💾 Save Entry')}
          </button>
        </div>
      </form>

      {/* Date Range Filter */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginBottom: '20px', background: 'var(--surface)', padding: '16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <div>
          <label style={labelStyle}>From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <button type="button" onClick={fetchRecords} disabled={loading} style={{ ...inputStyle, cursor: 'pointer', fontWeight: '700', background: 'var(--surface)', textAlign: 'center' }}>{loading ? '⏳ Loading...' : '🔍 Load Selected Range'}</button>
        </div>
      </div>

      {/* Payment */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontWeight: '800', fontSize: '16px' }}>Payment</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>{formatDate(startDate)} to {formatDate(endDate)}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: '0 0 4px', fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Total Due</p>
            <p style={{ margin: 0, fontWeight: '800', color: rangeTotals.totalDue > 0 ? '#ef4444' : '#10b981' }}>{formatCurrency(rangeTotals.totalDue)}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
          {[
            { label: 'Range Wage', value: formatCurrency(rangeTotals.totalWage), color: 'var(--text)' },
            { label: 'Range Paid', value: formatCurrency(rangeTotals.totalPaid), color: '#10b981' },
            { label: 'Range Due', value: formatCurrency(rangeTotals.totalDue), color: '#ef4444' }
          ].map(c => (
            <div key={c.label} style={{ background: 'var(--surface2)', borderRadius: '12px', padding: '12px', border: '1px solid var(--border)', textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px', fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>{c.label}</p>
              <p style={{ margin: 0, fontWeight: '800', fontSize: '13px', color: c.color }}>{c.value}</p>
            </div>
          ))}
        </div>

        {rangeTotals.totalDue <= 0 ? (
          <div style={{ background: 'var(--surface2)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
            No remaining payment in the selected date range.
          </div>
        ) : (
          <form onSubmit={handlePayment}>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Payment Amount ₹</label>
              <input type="number" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" max={rangeTotals.totalDue || undefined} style={inputStyle} />
            </div>

            <div style={{ background: 'var(--surface2)', borderRadius: '12px', padding: '14px', marginBottom: '12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Selected Range Due</span>
                <span style={{ fontWeight: '700', color: '#ef4444' }}>{formatCurrency(rangeTotals.totalDue)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>After Payment</span>
                <span style={{ fontWeight: '800', color: rangeTotals.totalDue - (parseFloat(paymentForm.amount) || 0) > 0 ? '#ef4444' : '#10b981' }}>{formatCurrency(Math.max(rangeTotals.totalDue - (parseFloat(paymentForm.amount) || 0), 0))}</span>
              </div>
            </div>

            <button type="submit" disabled={paying} style={{ width: '100%', padding: '14px', background: '#10b981', border: 'none', borderRadius: '12px', color: 'white', fontSize: '15px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', opacity: paying ? 0.7 : 1 }}>
              {paying ? '⏳ Adding Payment...' : '₹ Add Payment'}
            </button>
          </form>
        )}
      </div>

      {/* History */}
      <h3 style={{ margin: '0 0 12px', fontWeight: '700', fontSize: '16px' }}>History</h3>

      {loading ? <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Loading...</div> : records.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          No records found for the selected date range.
        </div>
      ) : (
        <>
          {/* History Totals Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            {[
              { label: 'Total Wage', value: formatCurrency(rangeTotals.totalWage), color: 'var(--text)' },
              { label: 'Total Paid', value: formatCurrency(rangeTotals.totalPaid), color: '#10b981' },
              { label: 'Total Due', value: formatCurrency(rangeTotals.totalDue), color: '#ef4444' }
            ].map(c => (
              <div key={c.label} style={{ background: 'var(--surface)', borderRadius: '14px', padding: '14px', border: '1px solid var(--border)', textAlign: 'center' }}>
                <p style={{ margin: '0 0 4px', fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>{c.label}</p>
                <p style={{ margin: 0, fontWeight: '800', fontSize: '14px', color: c.color }}>{c.value}</p>
              </div>
            ))}
          </div>

          <h3 style={{ margin: '0 0 12px', fontWeight: '700', fontSize: '16px' }}>Payment History</h3>
          {payments.length === 0 ? (
            <div style={{ background: 'var(--surface)', borderRadius: '14px', padding: '14px', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginBottom: '16px' }}>
              No payments found for the selected date range.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {payments.map(p => (
                <div key={p.id} style={{ background: 'var(--surface)', borderRadius: '14px', padding: '14px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: '700' }}>{formatDate(p.startDate)} - {formatDate(p.endDate)}</span>
                    <span style={{ fontWeight: '800', color: '#10b981' }}>{formatCurrency(p.amount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)' }}>
                    <span>Paid on {formatDate(p.paymentDate)}</span>
                    <span>{p.paymentMethod || 'Cash'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {records.map(r => (
              <div key={r.id} style={{ background: 'var(--surface)', borderRadius: '14px', padding: '14px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '700' }}>{formatDate(r.date)}</span>
                  <span style={{ fontWeight: '700', color: '#0ea5e9' }}>{r.totalWorkers} workers</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Wage: {formatCurrency(r.totalWage)}</span>
                  <span style={{ color: '#10b981' }}>Paid: {formatCurrency(r.totalPaid)}</span>
                  <span style={{ color: '#ef4444' }}>Due: {formatCurrency(r.remaining)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <div style={{ textAlign: 'center', padding: '20px 0 10px', fontSize: '12px', color: 'var(--text-muted)', opacity: 0.6 }}>
        Developed by Subrata Bala
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '15px', fontFamily: 'inherit', boxSizing: 'border-box' };
