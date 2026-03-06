import { useState, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtINR   = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = (v) => '₹' + Number(v || 0).toLocaleString('en-IN');
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const d30ago   = () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); };

const PAYMENT_METHODS = ['Cash', 'Bank', 'UPI'];

// ─────────────────────────────────────────────
// REUSABLE UI COMPONENTS
// ─────────────────────────────────────────────
function SectionTitle({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: '700', color: 'var(--text)', margin: 0 }}>
        <span style={{ width: '4px', height: '16px', borderRadius: '99px', backgroundColor: '#f59e0b', display: 'inline-block' }} />
        {children}
      </h2>
      {action}
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
      padding: '16px', boxShadow: 'var(--shadow)', marginBottom: '12px', ...style
    }}>
      {children}
    </div>
  );
}

function Label({ children }) {
  return (
    <label style={{
      display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px'
    }}>
      {children}
    </label>
  );
}

function Input({ style = {}, ...props }) {
  return (
    <input style={{
      width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)',
      borderRadius: '10px', padding: '12px', fontSize: '15px', fontWeight: '600',
      color: 'var(--text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
      transition: 'border-color 0.2s', ...style
    }} {...props} />
  );
}

function Select({ children, style = {}, ...props }) {
  return (
    <select style={{
      width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)',
      borderRadius: '10px', padding: '12px', fontSize: '15px', fontWeight: '600',
      color: 'var(--text)', outline: 'none', boxSizing: 'border-box', appearance: 'none',
      fontFamily: 'inherit', transition: 'border-color 0.2s', ...style
    }} {...props}>
      {children}
    </select>
  );
}

function Textarea({ style = {}, ...props }) {
  return (
    <textarea style={{
      width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)',
      borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: '600',
      color: 'var(--text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
      resize: 'vertical', minHeight: '72px', ...style
    }} {...props} />
  );
}

function BtnPrimary({ children, style = {}, ...props }) {
  return (
    <button style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', color: 'white',
      fontWeight: '700', padding: '13px 16px', borderRadius: '12px', fontSize: '14px',
      cursor: 'pointer', width: '100%', fontFamily: 'inherit', transition: 'opacity 0.2s', ...style
    }} {...props}>
      {children}
    </button>
  );
}

function BtnSecondary({ children, style = {}, ...props }) {
  return (
    <button style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      background: 'var(--surface2)', border: '1.5px solid var(--border)', color: 'var(--text)',
      fontWeight: '700', padding: '10px 16px', borderRadius: '12px', fontSize: '13px',
      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', ...style
    }} {...props}>
      {children}
    </button>
  );
}

function BtnDanger({ children, style = {}, ...props }) {
  return (
    <button style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
      background: '#fee2e2', color: '#ef4444', fontWeight: '700', padding: '6px 10px',
      borderRadius: '8px', fontSize: '12px', cursor: 'pointer', border: 'none',
      fontFamily: 'inherit', ...style
    }} {...props}>
      {children}
    </button>
  );
}

function Empty({ icon, text, hint }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: '36px', marginBottom: '12px' }}>{icon}</div>
      <p style={{ fontSize: '14px', fontWeight: '700', margin: 0 }}>{text}</p>
      {hint && <p style={{ fontSize: '12px', marginTop: '4px', margin: 0 }}>{hint}</p>}
    </div>
  );
}

function ProgressBar({ pct, color = '#f59e0b' }) {
  return (
    <div style={{ marginTop: '8px', height: '6px', background: 'var(--surface2)', borderRadius: '99px', overflow: 'hidden' }}>
      <div style={{ height: '100%', background: `linear-gradient(90deg, ${color}, ${color}cc)`, borderRadius: '99px', transition: 'width 0.5s', width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

function PulseDot() {
  return <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: '#f59e0b', borderRadius: '99px' }} />;
}

function Badge({ children, color = '#f59e0b', bg }) {
  return (
    <span style={{
      fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px',
      color: color, background: bg || `${color}20`
    }}>
      {children}
    </span>
  );
}

// Bottom-sheet Modal
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '520px', padding: '20px 20px max(20px, env(safe-area-inset-bottom))', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 style={{ margin: 0, fontWeight: '800', fontSize: '17px', color: 'var(--text)' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'var(--surface2)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontSize: '18px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TABS CONFIG
// ─────────────────────────────────────────────
const TABS = [
  { id: 'summary',  icon: '📊', label: 'Summary'  },
  { id: 'purchase', icon: '⛽', label: 'Purchase' },
  { id: 'payments', icon: '💳', label: 'Payments' },
  { id: 'pumps',    icon: '🏪', label: 'Pumps'    },
  { id: 'ledger',   icon: '📒', label: 'Ledger'   },
  { id: 'reports',  icon: '📋', label: 'Reports'  },
];

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function HarvestingPage() {
  const [tab, setTab] = useState('summary');
  const queryClient   = useQueryClient();
  const { user }      = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dieselData'],
    queryFn: () => api.get('/diesel/data').then(res => res.data),
    initialData: { pumps: [], purchases: [], payments: [] }
  });

  const mut = (apiFn, msg, errMsg) => useMutation({
    mutationFn: apiFn,
    onSuccess: () => { toast.success(msg); queryClient.invalidateQueries({ queryKey: ['dieselData'] }); },
    onError: (e) => toast.error(e.response?.data?.message || errMsg),
  });

  const mutations = {
    addPump:        mut((d) => api.post('/diesel/pumps', d),          'Petrol pump added!',     'Failed to add pump.'),
    updatePump:     mut((d) => api.put(`/diesel/pumps/${d.id}`, d),   'Pump updated!',          'Failed to update pump.'),
    deletePump:     mut((id) => api.delete(`/diesel/pumps/${id}`),    'Pump deleted!',          'Failed to delete pump.'),
    addPurchase:    mut((d) => api.post('/diesel/purchases', d),       'Purchase saved!',        'Failed to save purchase.'),
    updatePurchase: mut((d) => api.put(`/diesel/purchases/${d.id}`, d),'Purchase updated!',      'Failed to update purchase.'),
    deletePurchase: mut((id) => api.delete(`/diesel/purchases/${id}`),'Purchase deleted!',      'Failed to delete purchase.'),
    addPayment:     mut((d) => api.post('/diesel/payments', d),        'Payment recorded!',      'Failed to record payment.'),
    updatePayment:  mut((d) => api.put(`/diesel/payments/${d.id}`, d),'Payment updated!',       'Failed to update payment.'),
    deletePayment:  mut((id) => api.delete(`/diesel/payments/${id}`),'Payment deleted!',       'Failed to delete payment.'),
  };

  const getBalance = useCallback((pumpId, purch = data.purchases, pays = data.payments) => {
    const purchased = purch.filter(p => String(p.petrol_pump_id) === String(pumpId)).reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    const paid      = pays.filter(p => String(p.petrol_pump_id) === String(pumpId)).reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    return { purchased, paid, balance: purchased - paid };
  }, [data]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg)', fontFamily: 'sans-serif' }}>
      <Toaster position="top-center" toastOptions={{ duration: 2500, style: { borderRadius: '12px', fontWeight: 700, fontSize: '13px' } }} />

      {/* ── HEADER ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'linear-gradient(135deg,#78350f 0%,#b45309 55%,#f59e0b 100%)', boxShadow: '0 4px 20px rgba(120,53,15,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(8px)' }}>⛽</div>
            <div>
              <p style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', lineHeight: 1 }}>Diesel Management</p>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#fde68a', fontWeight: '500' }}>Purchase & Payment Tracker</p>
            </div>
          </div>
        </div>

        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: '2px', padding: '0 8px', overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 11px',
              borderTopLeftRadius: '12px', borderTopRightRadius: '12px', fontSize: '12px', fontWeight: '700',
              whiteSpace: 'nowrap', transition: 'all 0.2s', border: 'none', outline: 'none', cursor: 'pointer',
              background: tab === t.id ? 'var(--bg)' : 'transparent',
              color: tab === t.id ? '#f59e0b' : '#fde68a',
            }}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── PAGE CONTENT ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading && <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>Loading data...</div>}
        {isError   && <div style={{ textAlign: 'center', padding: '80px 0', color: '#ef4444' }}>Failed to load data.</div>}
        {!isLoading && !isError && tab === 'summary'  && <SummaryPage  data={data} getBalance={getBalance} setTab={setTab} user={user} />}
        {!isLoading && !isError && tab === 'purchase' && <PurchasePage data={data} mutations={mutations} user={user} />}
        {!isLoading && !isError && tab === 'payments' && <PaymentsPage data={data} getBalance={getBalance} mutations={mutations} user={user} />}
        {!isLoading && !isError && tab === 'pumps'    && <PumpsPage    data={data} getBalance={getBalance} mutations={mutations} user={user} />}
        {!isLoading && !isError && tab === 'ledger'   && <LedgerPage   data={data} getBalance={getBalance} user={user} />}
        {!isLoading && !isError && tab === 'reports'  && <ReportsPage  data={data} getBalance={getBalance} user={user} />}
      </div>
      <div style={{ textAlign: 'center', padding: '10px 0', fontSize: '12px', color: 'var(--text-muted)', opacity: 0.6, background: 'var(--bg)' }}>
        Developed by Subrata Bala
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SUMMARY PAGE
// ═══════════════════════════════════════════════════════════
function SummaryPage({ data, getBalance, setTab, user }) {
  const today          = todayStr();
  const totalPurchased = data.purchases.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const totalPaid      = data.payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const totalBalance   = totalPurchased - totalPaid;

  const todayPurchases = data.purchases.filter(p => p.date === today);
  const todayPayments  = data.payments.filter(p => p.payment_date === today);
  const todayTotal     = todayPurchases.reduce((s, p) => s + parseFloat(p.amount || 0), 0);

  return (
    <div style={{ padding: '16px', paddingBottom: '96px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Hero stats */}
      <div style={{ background: 'linear-gradient(135deg,#78350f,#b45309,#f59e0b)', borderRadius: 'var(--radius)', padding: '20px', color: 'white' }}>
        <p style={{ margin: '0 0 14px', fontWeight: '900', fontSize: '16px', opacity: 0.9 }}>⛽ Overall Summary</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          {[
            ['Purchased', totalPurchased, 'white'],
            ['Paid',      totalPaid,      '#bbf7d0'],
            ['Balance',   totalBalance,   totalBalance > 0 ? '#fde68a' : '#bbf7d0'],
          ].map(([l, v, c]) => (
            <div key={l} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '12px', padding: '12px' }}>
              <p style={{ margin: '0 0 4px', fontSize: '10px', opacity: 0.8, fontWeight: '700', textTransform: 'uppercase' }}>{l}</p>
              <p style={{ margin: 0, fontWeight: '900', fontSize: '15px', color: c }}>{fmtShort(v)}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>
            <span>Payment Progress</span>
            <span>{totalPurchased > 0 ? ((totalPaid / totalPurchased) * 100).toFixed(0) : 0}%</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: '99px', background: 'white', width: `${totalPurchased > 0 ? Math.min(100, (totalPaid / totalPurchased) * 100) : 0}%`, transition: 'width 0.5s' }} />
          </div>
        </div>
      </div>

      {/* Today activity */}
      <Card style={{ border: '1px solid #fef3c7' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <PulseDot />
          <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>Today — {fmtDate(today)}</span>
        </div>
        {todayPurchases.length === 0 && todayPayments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '24px', marginBottom: '4px' }}>⛽</p>
            <p style={{ fontSize: '12px', fontWeight: '700' }}>No activity today</p>
            {user.role === 'admin' && <button onClick={() => setTab('purchase')} style={{ marginTop: '8px', fontSize: '12px', fontWeight: '700', color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer' }}>+ Add Purchase →</button>}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>
              <span>{todayPurchases.length} purchase{todayPurchases.length !== 1 ? 's' : ''}</span>
              <span style={{ color: '#f59e0b' }}>{fmtShort(todayTotal)}</span>
            </div>
            {todayPurchases.slice(0, 3).map(p => {
              const pump = data.pumps.find(pp => String(pp.id) === String(p.petrol_pump_id));
              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface2)', borderRadius: '12px', padding: '8px 12px', marginBottom: '6px' }}>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)', margin: 0 }}>{pump?.name || 'Unknown Pump'}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Slip #{p.slip_number}</p>
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: '900', color: 'var(--text)', margin: 0 }}>{fmtShort(p.amount)}</p>
                </div>
              );
            })}
            {todayPurchases.length > 3 && <p style={{ textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#f59e0b', margin: 0 }}>+{todayPurchases.length - 3} more</p>}
            {todayPayments.length > 0 && (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>
                💳 {todayPayments.length} payment(s) — {fmtShort(todayPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0))}
              </div>
            )}
          </>
        )}
      </Card>

      {/* Pump-wise balances */}
      {data.pumps.length > 0 && (
        <div>
          <SectionTitle action={<button onClick={() => setTab('pumps')} style={{ fontSize: '12px', fontWeight: '700', color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer' }}>View All →</button>}>
            Pump-wise Balance
          </SectionTitle>
          {data.pumps.slice(0, 5).map(pump => {
            const { purchased, paid, balance } = getBalance(pump.id);
            const pct = purchased > 0 ? Math.min(100, (paid / purchased) * 100) : 0;
            return (
              <div key={pump.id} style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '14px 12px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text)', margin: 0 }}>⛽ {pump.name}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Total: {fmtShort(purchased)}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '14px', fontWeight: '900', margin: 0, color: balance > 0 ? '#f59e0b' : '#10b981' }}>{fmtShort(balance)}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>balance</p>
                  </div>
                </div>
                <ProgressBar pct={pct} />
              </div>
            );
          })}
        </div>
      )}

      {data.pumps.length === 0 && (
        <Empty icon="🏪" text="No petrol pumps registered" hint="Go to Pumps tab to add your first pump" />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PURCHASE PAGE
// ═══════════════════════════════════════════════════════════
const defaultPurchaseForm = () => ({ petrol_pump_id: '', date: todayStr(), slip_number: '', amount: '', notes: '' });

function PurchasePage({ data, mutations, user }) {
  const [form, setForm]       = useState(defaultPurchaseForm());
  const [editId, setEditId]   = useState(null);
  const [filterPump, setFP]   = useState('');
  const [search, setSearch]   = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handlePumpSelect = (pumpId) => {
    set('petrol_pump_id', pumpId);
    set('date', todayStr());
  };

  const handleSave = () => {
    if (!form.petrol_pump_id) { toast.error('Select a petrol pump'); return; }
    if (!form.slip_number.trim()) { toast.error('Enter slip number'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter valid amount'); return; }

    const payload = { ...form, amount: parseFloat(form.amount) };
    if (editId) {
      mutations.updatePurchase.mutate({ ...payload, id: editId }, {
        onSuccess: () => { setEditId(null); setForm(defaultPurchaseForm()); }
      });
    } else {
      mutations.addPurchase.mutate(payload, {
        onSuccess: () => setForm(defaultPurchaseForm())
      });
    }
  };

  const handleEdit = (p) => {
    setForm({ petrol_pump_id: String(p.petrol_pump_id), date: p.date, slip_number: p.slip_number, amount: String(p.amount), notes: p.notes || '' });
    setEditId(p.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => { setEditId(null); setForm(defaultPurchaseForm()); };

  let list = [...data.purchases].sort((a, b) => b.date.localeCompare(a.date));
  if (filterPump) list = list.filter(p => String(p.petrol_pump_id) === filterPump);
  if (search)     list = list.filter(p => p.slip_number?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ padding: '16px', paddingBottom: '96px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {user.role === 'owner' && (
        <Card style={{ border: editId ? '1.5px solid #f59e0b' : '1px solid var(--border)' }}>
          <SectionTitle>{editId ? '✏️ Edit Purchase' : '⛽ New Purchase Entry'}</SectionTitle>

          <div style={{ marginBottom: '12px' }}>
            <Label>Petrol Pump *</Label>
            <Select value={form.petrol_pump_id} onChange={e => handlePumpSelect(e.target.value)}>
              <option value="">— Select Pump —</option>
              {data.pumps.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <Label>Date *</Label>
              <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div>
              <Label>Slip Number *</Label>
              <Input type="text" placeholder="e.g. 1023" value={form.slip_number} onChange={e => set('slip_number', e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <Label>Amount (₹) *</Label>
            <Input type="number" placeholder="0.00" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <Label>Notes (optional)</Label>
            <Textarea placeholder="Any remarks..." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          {form.amount > 0 && (
            <div style={{ background: '#fef3c7', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#92400e' }}>Purchase Amount</span>
              <span style={{ fontSize: '18px', fontWeight: '900', color: '#b45309' }}>{fmtINR(form.amount)}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <BtnPrimary onClick={handleSave} disabled={mutations.addPurchase.isPending || mutations.updatePurchase.isPending} style={{ flex: 1 }}>
              {editId ? '✅ Update Purchase' : '💾 Save Purchase'}
            </BtnPrimary>
            {editId && <BtnSecondary onClick={handleCancel} style={{ flex: 1 }}>Cancel</BtnSecondary>}
          </div>
        </Card>
      )}

      {/* Filter & Search */}
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <Label>Filter by Pump</Label>
            <Select value={filterPump} onChange={e => setFP(e.target.value)}>
              <option value="">All Pumps</option>
              {data.pumps.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>Search Slip #</Label>
            <Input type="text" placeholder="Slip number..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </Card>

      {/* Purchase History */}
      <SectionTitle>📋 Purchase History ({list.length})</SectionTitle>

      {list.length === 0
        ? <Empty icon="⛽" text="No purchases found" hint="Add your first diesel purchase above" />
        : list.map(p => {
            const pump = data.pumps.find(pp => String(pp.id) === String(p.petrol_pump_id));
            return (
              <div key={p.id} style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '14px', marginBottom: '8px', boxShadow: 'var(--shadow)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <p style={{ fontWeight: '800', fontSize: '14px', color: 'var(--text)', margin: '0 0 2px' }}>⛽ {pump?.name || 'Unknown'}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>📅 {fmtDate(p.date)} · Slip #{p.slip_number}</p>
                  </div>
                  <p style={{ fontWeight: '900', fontSize: '18px', color: '#b45309', margin: 0 }}>{fmtShort(p.amount)}</p>
                </div>
                {p.notes && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px', fontStyle: 'italic' }}>"{p.notes}"</p>}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {user.role === 'owner' && (
                    <BtnSecondary style={{ flex: 1, padding: '7px', fontSize: '12px' }} onClick={() => handleEdit(p)}>✏️ Edit</BtnSecondary>
                  )}
                  {user.role === 'admin' && (
                    <BtnDanger style={{ flex: 1, padding: '7px' }} onClick={() => { if (window.confirm('Delete this purchase?')) mutations.deletePurchase.mutate(p.id); }}>🗑️ Delete</BtnDanger>
                  )}
                </div>
              </div>
            );
          })
      }
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PAYMENTS PAGE
// ═══════════════════════════════════════════════════════════
const defaultPaymentForm = () => ({ petrol_pump_id: '', payment_date: todayStr(), amount: '', payment_method: 'Cash', notes: '' });

function PaymentsPage({ data, getBalance, mutations, user }) {
  const [form, setForm]     = useState(defaultPaymentForm());
  const [editId, setEditId] = useState(null);
  const [filterPump, setFP] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const balance = form.petrol_pump_id ? getBalance(form.petrol_pump_id) : null;

  const handleSave = () => {
    if (!form.petrol_pump_id) { toast.error('Select a petrol pump'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter valid amount'); return; }

    const payload = { ...form, amount: parseFloat(form.amount) };
    if (editId) {
      mutations.updatePayment.mutate({ ...payload, id: editId }, {
        onSuccess: () => { setEditId(null); setForm(defaultPaymentForm()); }
      });
    } else {
      mutations.addPayment.mutate(payload, {
        onSuccess: () => setForm(defaultPaymentForm())
      });
    }
  };

  const handleEdit = (p) => {
    setForm({ petrol_pump_id: String(p.petrol_pump_id), payment_date: p.payment_date, amount: String(p.amount), payment_method: p.payment_method, notes: p.notes || '' });
    setEditId(p.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  let list = [...data.payments].sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  if (filterPump) list = list.filter(p => String(p.petrol_pump_id) === filterPump);

  const methodColors = { Cash: '#10b981', Bank: '#3b82f6', UPI: '#a855f7' };

  return (
    <div style={{ padding: '16px', paddingBottom: '96px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {user.role === 'owner' && (
        <Card style={{ border: editId ? '1.5px solid #f59e0b' : '1px solid var(--border)' }}>
          <SectionTitle>{editId ? '✏️ Edit Payment' : '💳 Record Payment'}</SectionTitle>

          <div style={{ marginBottom: '12px' }}>
            <Label>Petrol Pump *</Label>
            <Select value={form.petrol_pump_id} onChange={e => set('petrol_pump_id', e.target.value)}>
              <option value="">— Select Pump —</option>
              {data.pumps.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>

          {/* Show balance hint */}
          {balance && (
            <div style={{ background: balance.balance > 0 ? '#fef3c7' : '#d1fae5', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>Outstanding Balance</span>
              <span style={{ fontSize: '14px', fontWeight: '900', color: balance.balance > 0 ? '#b45309' : '#059669' }}>{fmtShort(balance.balance)}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <Label>Payment Date *</Label>
              <Input type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} />
            </div>
            <div>
              <Label>Amount (₹) *</Label>
              <Input type="number" placeholder="0.00" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <Label>Payment Method *</Label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {PAYMENT_METHODS.map(m => (
                <button key={m} onClick={() => set('payment_method', m)} style={{
                  flex: 1, padding: '10px', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                  border: form.payment_method === m ? `2px solid ${methodColors[m]}` : '2px solid var(--border)',
                  background: form.payment_method === m ? `${methodColors[m]}15` : 'var(--surface2)',
                  color: form.payment_method === m ? methodColors[m] : 'var(--text-muted)',
                  fontFamily: 'inherit', transition: 'all 0.2s'
                }}>
                  {m === 'Cash' ? '💵' : m === 'Bank' ? '🏦' : '📱'} {m}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <Label>Notes (optional)</Label>
            <Textarea placeholder="Transaction ref, remarks..." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <BtnPrimary onClick={handleSave} disabled={mutations.addPayment.isPending} style={{ flex: 1 }}>
              {editId ? '✅ Update Payment' : '💾 Record Payment'}
            </BtnPrimary>
            {editId && <BtnSecondary onClick={() => { setEditId(null); setForm(defaultPaymentForm()); }} style={{ flex: 1 }}>Cancel</BtnSecondary>}
          </div>
        </Card>
      )}

      {/* Filter */}
      <Card>
        <Label>Filter by Pump</Label>
        <Select value={filterPump} onChange={e => setFP(e.target.value)}>
          <option value="">All Pumps</option>
          {data.pumps.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </Card>

      {/* Payment History */}
      <SectionTitle>📋 Payment History ({list.length})</SectionTitle>

      {list.length === 0
        ? <Empty icon="💳" text="No payments recorded" hint="Record your first payment above" />
        : list.map(p => {
            const pump = data.pumps.find(pp => String(pp.id) === String(p.petrol_pump_id));
            const mc   = methodColors[p.payment_method] || '#6b7280';
            return (
              <div key={p.id} style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '14px', marginBottom: '8px', boxShadow: 'var(--shadow)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <p style={{ fontWeight: '800', fontSize: '14px', color: 'var(--text)', margin: '0 0 4px' }}>⛽ {pump?.name || 'Unknown'}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>📅 {fmtDate(p.payment_date)}</span>
                      <Badge color={mc}>{p.payment_method}</Badge>
                    </div>
                  </div>
                  <p style={{ fontWeight: '900', fontSize: '18px', color: '#10b981', margin: 0 }}>{fmtShort(p.amount)}</p>
                </div>
                {p.notes && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px', fontStyle: 'italic' }}>"{p.notes}"</p>}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {user.role === 'owner' && (
                    <BtnSecondary style={{ flex: 1, padding: '7px', fontSize: '12px' }} onClick={() => handleEdit(p)}>✏️ Edit</BtnSecondary>
                  )}
                  {user.role === 'admin' && (
                    <BtnDanger style={{ flex: 1, padding: '7px' }} onClick={() => { if (window.confirm('Delete this payment?')) mutations.deletePayment.mutate(p.id); }}>🗑️ Delete</BtnDanger>
                  )}
                </div>
              </div>
            );
          })
      }
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PUMPS PAGE
// ═══════════════════════════════════════════════════════════
const defaultPumpForm = () => ({ name: '', owner_name: '', contact_number: '', address: '' });

function PumpsPage({ data, getBalance, mutations, user }) {
  const [form, setForm]     = useState(defaultPumpForm());
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Enter petrol pump name'); return; }
    if (editId) {
      mutations.updatePump.mutate({ ...form, id: editId }, {
        onSuccess: () => { setEditId(null); setForm(defaultPumpForm()); setShowForm(false); }
      });
    } else {
      mutations.addPump.mutate(form, {
        onSuccess: () => { setForm(defaultPumpForm()); setShowForm(false); }
      });
    }
  };

  const handleEdit = (pump) => {
    setForm({ name: pump.name, owner_name: pump.owner_name || '', contact_number: pump.contact_number || '', address: pump.address || '' });
    setEditId(pump.id);
    setShowForm(true);
  };

  return (
    <div style={{ padding: '16px', paddingBottom: '96px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionTitle>🏪 Petrol Pumps ({data.pumps.length})</SectionTitle>
        {user.role === 'owner' && (
          <BtnSecondary style={{ padding: '8px 14px', fontSize: '13px' }} onClick={() => { setShowForm(s => !s); if (editId) { setEditId(null); setForm(defaultPumpForm()); } }}>
            {showForm ? '✕ Close' : '+ Add Pump'}
          </BtnSecondary>
        )}
      </div>

      {/* Form */}
      {user.role === 'owner' && showForm && (
          <Card style={{ border: editId ? '1.5px solid #f59e0b' : '1px solid var(--border)' }}>
            <SectionTitle>{editId ? '✏️ Edit Pump' : '🏪 New Petrol Pump'}</SectionTitle>

            <div style={{ marginBottom: '12px' }}>
              <Label>Pump Name *</Label>
              <Input type="text" placeholder="e.g. Sharma Petrol Pump" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <Label>Owner Name</Label>
                <Input type="text" placeholder="Optional" value={form.owner_name} onChange={e => set('owner_name', e.target.value)} />
              </div>
              <div>
                <Label>Contact Number</Label>
                <Input type="tel" placeholder="Optional" value={form.contact_number} onChange={e => set('contact_number', e.target.value)} />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <Label>Address</Label>
              <Textarea placeholder="Optional" value={form.address} onChange={e => set('address', e.target.value)} style={{ minHeight: '56px' }} />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <BtnPrimary onClick={handleSave} style={{ flex: 1 }}>
                {editId ? '✅ Update Pump' : '💾 Save Pump'}
              </BtnPrimary>
              <BtnSecondary onClick={() => { setShowForm(false); setEditId(null); setForm(defaultPumpForm()); }} style={{ flex: 1 }}>Cancel</BtnSecondary>
            </div>
          </Card>
        )}

      {/* Pump list */}
      {data.pumps.length === 0
        ? <Empty icon="🏪" text="No petrol pumps yet" hint="Add your first pump above" />
        : data.pumps.map(pump => {
            const { purchased, paid, balance } = getBalance(pump.id);
            const pct = purchased > 0 ? Math.min(100, (paid / purchased) * 100) : 0;
            return (
              <div key={pump.id} style={{ background: 'var(--surface)', borderRadius: '14px', border: '1px solid var(--border)', padding: '16px', marginBottom: '8px', boxShadow: 'var(--shadow)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg,#f59e0b,#d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>⛽</div>
                    <div>
                      <p style={{ fontWeight: '800', fontSize: '15px', color: 'var(--text)', margin: '0 0 2px' }}>{pump.name}</p>
                      {pump.owner_name    && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>👤 {pump.owner_name}</p>}
                      {pump.contact_number && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>📞 {pump.contact_number}</p>}
                      {pump.address       && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>📍 {pump.address}</p>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                  {[['Purchased', fmtShort(purchased), 'var(--text)'], ['Paid', fmtShort(paid), '#10b981'], ['Balance', fmtShort(balance), balance > 0 ? '#f59e0b' : '#10b981']].map(([l, v, c]) => (
                    <div key={l} style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 2px', fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{l}</p>
                      <p style={{ margin: 0, fontWeight: '900', fontSize: '12px', color: c }}>{v}</p>
                    </div>
                  ))}
                </div>

                <ProgressBar pct={pct} />
                <p style={{ margin: '4px 0 10px', fontSize: '10px', color: 'var(--text-muted)', textAlign: 'right' }}>{pct.toFixed(0)}% paid</p>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {user.role === 'owner' && (
                    <BtnSecondary style={{ flex: 1, padding: '7px', fontSize: '12px' }} onClick={() => handleEdit(pump)}>✏️ Edit</BtnSecondary>
                  )}
                  {user.role === 'admin' && (
                    <BtnDanger style={{ flex: 1, padding: '7px' }} onClick={() => { if (window.confirm('Delete this pump? All related records may be affected.')) mutations.deletePump.mutate(pump.id); }}>🗑️ Delete</BtnDanger>
                  )}
                </div>
              </div>
            );
          })
      }
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// LEDGER PAGE
// ═══════════════════════════════════════════════════════════
function LedgerPage({ data, getBalance, user }) {
  const [selectedPump, setSelectedPump] = useState('');

  const pumpPurchases = data.purchases.filter(p => String(p.petrol_pump_id) === selectedPump).sort((a, b) => b.date.localeCompare(a.date));
  const pumpPayments  = data.payments.filter(p => String(p.petrol_pump_id) === selectedPump).sort((a, b) => b.payment_date.localeCompare(a.payment_date));

  const balance  = selectedPump ? getBalance(selectedPump) : null;
  const pump     = data.pumps.find(p => String(p.id) === selectedPump);

  // Combined ledger entries sorted by date
  const ledger = [
    ...pumpPurchases.map(p => ({ type: 'purchase', date: p.date,         amount: parseFloat(p.amount || 0), ref: `Slip #${p.slip_number}`, id: `pur-${p.id}` })),
    ...pumpPayments.map(p  => ({ type: 'payment',  date: p.payment_date, amount: parseFloat(p.amount || 0), ref: p.payment_method, id: `pay-${p.id}` })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div style={{ padding: '16px', paddingBottom: '96px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <SectionTitle>📒 Pump Ledger</SectionTitle>

      <Card>
        <Label>Select Petrol Pump</Label>
        <Select value={selectedPump} onChange={e => setSelectedPump(e.target.value)}>
          <option value="">— Choose a Pump —</option>
          {data.pumps.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </Card>

      {!selectedPump && <Empty icon="📒" text="Select a pump to view ledger" hint="Choose from the dropdown above" />}

      {selectedPump && pump && (
        <>
          {/* Pump hero */}
          <div style={{ background: 'linear-gradient(135deg,#78350f,#b45309,#f59e0b)', borderRadius: 'var(--radius)', padding: '20px', color: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>⛽</div>
              <div>
                <p style={{ margin: 0, fontWeight: '900', fontSize: '18px' }}>{pump.name}</p>
                {pump.owner_name && <p style={{ margin: '2px 0 0', fontSize: '12px', opacity: 0.8 }}>👤 {pump.owner_name}</p>}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              {[
                ['Total Purchased', balance.purchased],
                ['Total Paid',      balance.paid],
                ['Balance Due',     balance.balance],
              ].map(([l, v]) => (
                <div key={l} style={{ background: 'rgba(255,255,255,0.18)', borderRadius: '10px', padding: '10px' }}>
                  <p style={{ margin: '0 0 2px', fontSize: '9px', opacity: 0.8, fontWeight: '700', textTransform: 'uppercase' }}>{l}</p>
                  <p style={{ margin: 0, fontWeight: '900', fontSize: '14px' }}>{fmtShort(v)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Transaction table */}
          <Card>
            <SectionTitle>All Transactions ({ledger.length})</SectionTitle>
            {ledger.length === 0
              ? <Empty icon="📋" text="No transactions" hint="Add purchases or payments for this pump" />
              : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface2)' }}>
                        {['Type', 'Date', 'Ref / Method', 'Amount'].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map((row, i) => (
                        <tr key={row.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)' }}>
                          <td style={{ padding: '10px' }}>
                            <Badge color={row.type === 'purchase' ? '#b45309' : '#10b981'} bg={row.type === 'purchase' ? '#fef3c7' : '#d1fae5'}>
                              {row.type === 'purchase' ? '⛽ Purchase' : '💳 Payment'}
                            </Badge>
                          </td>
                          <td style={{ padding: '10px', fontWeight: '600', color: 'var(--text-muted)', fontSize: '12px' }}>{fmtDate(row.date)}</td>
                          <td style={{ padding: '10px', fontWeight: '700', color: 'var(--text)' }}>{row.ref}</td>
                          <td style={{ padding: '10px', fontWeight: '900', color: row.type === 'purchase' ? '#b45309' : '#10b981', textAlign: 'right' }}>
                            {row.type === 'purchase' ? '+' : '-'}{fmtShort(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--surface2)' }}>
                        <td colSpan={3} style={{ padding: '10px', fontWeight: '800', fontSize: '13px', color: 'var(--text)' }}>Balance Due</td>
                        <td style={{ padding: '10px', fontWeight: '900', fontSize: '16px', color: balance.balance > 0 ? '#b45309' : '#10b981', textAlign: 'right' }}>{fmtShort(balance.balance)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            }
          </Card>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// REPORTS PAGE
// ═══════════════════════════════════════════════════════════
function ReportsPage({ data, getBalance, user }) {
  const [fromDate, setFrom] = useState(d30ago());
  const [toDate,   setTo]   = useState(todayStr());
  const [pumpId,   setPump] = useState('');

  let purch = data.purchases;
  let pays  = data.payments;

  if (fromDate) { purch = purch.filter(p => p.date >= fromDate);         pays = pays.filter(p => p.payment_date >= fromDate); }
  if (toDate)   { purch = purch.filter(p => p.date <= toDate);           pays = pays.filter(p => p.payment_date <= toDate); }
  if (pumpId)   { purch = purch.filter(p => String(p.petrol_pump_id) === pumpId); pays = pays.filter(p => String(p.petrol_pump_id) === pumpId); }

  const totalPurchased = purch.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const totalPaid      = pays.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const totalPending   = totalPurchased - totalPaid;

  // Pump-wise breakdown
  const byPump = {};
  data.pumps.forEach(pp => { byPump[pp.id] = { name: pp.name, purchased: 0, paid: 0 }; });
  purch.forEach(p => { if (byPump[p.petrol_pump_id]) byPump[p.petrol_pump_id].purchased += parseFloat(p.amount || 0); });
  pays.forEach(p  => { if (byPump[p.petrol_pump_id]) byPump[p.petrol_pump_id].paid      += parseFloat(p.amount || 0); });
  const pumpRows = Object.values(byPump).filter(s => s.purchased > 0 || s.paid > 0).sort((a, b) => b.purchased - a.purchased);
  const chartMax = Math.max(...pumpRows.map(s => s.purchased), 1);

  const downloadCSV = (type) => {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    let rows, headers, mapRow;
    if (type === 'purchases') {
      rows    = [...purch].sort((a, b) => b.date.localeCompare(a.date));
      headers = ['Pump Name', 'Date', 'Slip Number', 'Amount', 'Notes'];
      mapRow  = p => { const pp = data.pumps.find(x => String(x.id) === String(p.petrol_pump_id)); return [pp?.name || '', p.date, p.slip_number, p.amount, p.notes || '']; };
    } else {
      rows    = [...pays].sort((a, b) => b.payment_date.localeCompare(a.payment_date));
      headers = ['Pump Name', 'Payment Date', 'Amount', 'Method', 'Notes'];
      mapRow  = p => { const pp = data.pumps.find(x => String(x.id) === String(p.petrol_pump_id)); return [pp?.name || '', p.payment_date, p.amount, p.payment_method, p.notes || '']; };
    }
    const csv  = [headers.map(esc).join(','), ...rows.map(r => mapRow(r).map(esc).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href  = URL.createObjectURL(blob);
    link.download = `diesel_${type}.csv`;
    link.click();
    toast.success('CSV downloaded!');
  };

  return (
    <div style={{ padding: '16px', paddingBottom: '96px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Filters */}
      <Card>
        <SectionTitle>📅 Filter Reports</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div><Label>From</Label><Input type="date" value={fromDate} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={toDate} onChange={e => setTo(e.target.value)} /></div>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <Label>Petrol Pump</Label>
          <Select value={pumpId} onChange={e => setPump(e.target.value)}>
            <option value="">All Pumps</option>
            {data.pumps.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <BtnSecondary style={{ flex: 1, fontSize: '12px', padding: '8px' }} onClick={() => downloadCSV('purchases')}>📥 Purchases CSV</BtnSecondary>
          <BtnSecondary style={{ flex: 1, fontSize: '12px', padding: '8px' }} onClick={() => downloadCSV('payments')}>📥 Payments CSV</BtnSecondary>
        </div>
      </Card>

      {/* Grand totals */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
        {[
          { label: 'Purchased', val: totalPurchased, color: '#b45309' },
          { label: 'Paid',      val: totalPaid,      color: '#10b981' },
          { label: 'Pending',   val: totalPending,   color: '#f59e0b' },
        ].map(({ label, val, color }) => (
          <Card key={label} style={{ marginBottom: 0, textAlign: 'center', padding: '12px' }}>
            <p style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px', margin: '0 0 4px' }}>{label}</p>
            <p style={{ fontSize: '14px', fontWeight: '900', color, margin: 0 }}>{fmtShort(val)}</p>
          </Card>
        ))}
      </div>

      {/* Bar chart */}
      {pumpRows.length > 0 && (
        <Card>
          <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', marginBottom: '8px' }}>Pump-wise Comparison</p>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', fontSize: '12px', fontWeight: '700' }}>
            <span><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#b45309', marginRight: '4px' }} />Purchased</span>
            <span><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#10b981', marginRight: '4px' }} />Paid</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', minHeight: '110px', overflowX: 'auto', paddingTop: '8px' }}>
            {pumpRows.map(s => (
              <div key={s.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: '44px' }}>
                <p style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)', margin: 0 }}>{fmtShort(s.purchased)}</p>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end' }}>
                  <div style={{ width: '16px', borderTopLeftRadius: '3px', borderTopRightRadius: '3px', background: '#b45309', height: `${Math.max(4, (s.purchased / chartMax) * 90)}px` }} />
                  <div style={{ width: '16px', borderTopLeftRadius: '3px', borderTopRightRadius: '3px', background: '#10b981', height: `${Math.max(2, (s.paid / chartMax) * 90)}px` }} />
                </div>
                <p style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '44px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{s.name}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Pump summary table */}
      {pumpRows.length > 0 && (
        <div>
          <SectionTitle>Pump-wise Summary</SectionTitle>
          {pumpRows.map(s => {
            const bal = s.purchased - s.paid;
            const pct = s.purchased > 0 ? Math.min(100, (s.paid / s.purchased) * 100) : 0;
            return (
              <div key={s.name} style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '12px 16px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text)', margin: 0 }}>⛽ {s.name}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Purchased: {fmtShort(s.purchased)} · Paid: {fmtShort(s.paid)}</p>
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: '900', margin: 0, color: bal > 0 ? '#f59e0b' : '#10b981' }}>{fmtShort(bal)} due</p>
                </div>
                <ProgressBar pct={pct} />
              </div>
            );
          })}
        </div>
      )}

      {purch.length === 0 && pays.length === 0 && (
        <Empty icon="📊" text="No data for this filter" hint="Try a wider date range or different pump" />
      )}
    </div>
  );
}