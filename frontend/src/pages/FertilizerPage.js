import { useState, useEffect, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const FERT_TYPES = ['Urea', 'DAP', 'Gromor', 'Phosphate', 'Vitamins', 'Others'];
const UNITS      = ['kg', 'bag', 'litre', 'ton', 'packet'];
const FERT_COLORS = ['#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#eab308'];

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtINR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = (v) => '₹' + Number(v || 0).toLocaleString('en-IN');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const d30ago = () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); };

// ─────────────────────────────────────────────
// SMALL REUSABLE COMPONENTS
// ─────────────────────────────────────────────
function SectionTitle({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '17px', fontWeight: '700', color: 'var(--text)', margin: 0 }}>
        <span style={{ width: '4px', height: '16px', borderRadius: '99px', backgroundColor: '#10b981', display: 'inline-block' }} />
        {children}
      </h2>
      {action}
    </div>
  );
}

function Card({ children, style = {} }) {
  const cardStyle = {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    padding: '16px',
    boxShadow: 'var(--shadow)',
    marginBottom: '12px',
    ...style
  };
  return (
    <div style={cardStyle}>
      {children}
    </div>
  );
}

function Label({ children }) {
  const labelStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '6px'
  };
  return <label style={labelStyle}>{children}</label>;
}

function Input({ style = {}, ...props }) {
  const inputStyle = {
    width: '100%',
    background: 'var(--surface2)',
    border: '1.5px solid var(--border)',
    borderRadius: '10px',
    padding: '12px',
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text)',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
    ...style
  };
  return (
    <input
      style={inputStyle}
      {...props}
    />
  );
}

function Select({ children, style = {}, ...props }) {
  const selectStyle = {
    width: '100%',
    background: 'var(--surface2)',
    border: '1.5px solid var(--border)',
    borderRadius: '10px',
    padding: '12px',
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text)',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
    appearance: 'none',
    ...style
  };
  return (
    <select
      style={selectStyle}
      {...props}
    >
      {children}
    </select>
  );
}

function BtnPrimary({ children, style = {}, ...props }) {
  const btnStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    background: 'linear-gradient(135deg, #0ea5e9, #10b981)',
    border: 'none',
    color: 'white',
    fontWeight: '700',
    padding: '12px 16px',
    borderRadius: '12px',
    fontSize: '15px',
    transition: 'all 0.2s',
    cursor: 'pointer',
    width: '100%',
    ...style
  };
  return (
    <button
      style={btnStyle}
      {...props}
    >
      {children}
    </button>
  );
}

function BtnSecondary({ children, style = {}, ...props }) {
  const btnStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    background: 'var(--surface2)',
    border: '1.5px solid var(--border)',
    color: 'var(--text)',
    fontWeight: '700',
    padding: '10px 16px',
    borderRadius: '12px',
    fontSize: '15px',
    transition: 'all 0.2s',
    cursor: 'pointer',
    ...style
  };
  return (
    <button
      style={btnStyle}
      {...props}
    >
      {children}
    </button>
  );
}

function BtnDanger({ children, style = {}, ...props }) {
  const btnStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    background: '#fee2e2',
    color: '#ef4444',
    fontWeight: '700',
    padding: '6px 10px',
    borderRadius: '8px',
    fontSize: '13px',
    transition: 'all 0.2s',
    cursor: 'pointer',
    border: 'none',
    ...style
  };
  return (
    <button
      style={btnStyle}
      {...props}
    >
      {children}
    </button>
  );
}

function Empty({ icon, text, hint }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: '37px', marginBottom: '12px' }}>{icon}</div>
      <p style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>{text}</p>
      {hint && <p style={{ fontSize: '13px', marginTop: '4px', margin: 0 }}>{hint}</p>}
    </div>
  );
}

function ProgressBar({ pct }) {
  return (
    <div style={{ marginTop: '8px', height: '6px', background: 'var(--surface2)', borderRadius: '99px', overflow: 'hidden' }}>
      <div style={{ height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: '99px', transition: 'width 0.5s', width: `${pct}%` }} />
    </div>
  );
}

function PulseDot() {
  return <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '99px' }} />;
}

// ─────────────────────────────────────────────
// TABS CONFIG
// ─────────────────────────────────────────────
const TABS = [
  { id: 'summary',  icon: '📊', label: 'Summary'  },
  { id: 'shops',    icon: '🏪', label: 'Shops'    },
  { id: 'purchase', icon: '🛒', label: 'Purchase' },
  { id: 'payments', icon: '💳', label: 'Payments' },
  { id: 'reports',  icon: '📋', label: 'Reports'  },
];

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function FertilizerPage() {
  const [tab, setTab] = useState('summary');
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['fertilizerData'],
    queryFn: () => api.get('/fertilizer/data').then(res => res.data),
    initialData: { shopkeepers: [], purchases: [], payments: [] }
  });

  const createMutation = (apiFn, successMsg, errorMsg) => useMutation({
    mutationFn: apiFn,
    onSuccess: () => {
      toast.success(successMsg);
      queryClient.invalidateQueries({ queryKey: ['fertilizerData'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || errorMsg),
  });

  const mutations = {
    addShopkeeper: createMutation((d) => api.post('/fertilizer/shopkeepers', d), 'Shopkeeper added!', 'Failed to add shopkeeper.'),
    updateShopkeeper: createMutation((d) => api.put(`/fertilizer/shopkeepers/${d.id}`, d), 'Shopkeeper updated!', 'Failed to update shopkeeper.'),
    deleteShopkeeper: createMutation((id) => api.delete(`/fertilizer/shopkeepers/${id}`), 'Shopkeeper deleted!', 'Failed to delete shopkeeper.'),
    addPurchase: createMutation((d) => api.post('/fertilizer/purchases', d), 'Purchase added!', 'Failed to add purchase.'),
    updatePurchase: createMutation((d) => api.put(`/fertilizer/purchases/${d.id}`, d.data), 'Purchase updated!', 'Failed to update purchase.'),
    deletePurchase: createMutation((id) => api.delete(`/fertilizer/purchases/${id}`), 'Purchase deleted!', 'Failed to delete purchase.'),
    addPayment: createMutation((d) => api.post('/fertilizer/payments', d), 'Payment recorded!', 'Failed to record payment.'),
    deletePayment: createMutation((id) => api.delete(`/fertilizer/payments/${id}`), 'Payment deleted!', 'Failed to delete payment.'),
  };

  // Balance helper
  const getBalance = useCallback((shopId, purch = data.purchases, pays = data.payments) => {
    const purchased = purch.filter(p => p.FertilizerShopkeeperId === shopId).reduce((s, p) => s + parseFloat(p.total_amount || 0), 0);
    const paid      = pays.filter(p => p.FertilizerShopkeeperId === shopId).reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0);
    return { purchased, paid, balance: purchased - paid };
  }, [data]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'sans-serif' }}>
      <Toaster position="top-center" toastOptions={{ duration: 2500, style: { borderRadius: '12px', fontWeight: 700, fontSize: '14px' } }} />

      {/* ── HEADER ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'linear-gradient(135deg,#064e3b 0%,#059669 55%,#10b981 100%)', boxShadow: '0 4px 20px rgba(6,78,59,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '25px', background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(8px)' }}>🌿</div>
            <div>
              <p style={{ margin: 0, fontSize: '19px', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', lineHeight: 1 }}>Fertilizer Management</p>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#a7f3d0', fontWeight: '500' }}>Purchase & Payment Management</p>
            </div>
          </div>
        </div>

        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: '4px', padding: '0 8px', overflowX: 'auto' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px',
                borderTopLeftRadius: '12px', borderTopRightRadius: '12px', fontSize: '13px', fontWeight: '700',
                whiteSpace: 'nowrap', transition: 'all 0.2s', border: 'none', outline: 'none', cursor: 'pointer',
                background: tab === t.id ? 'var(--bg)' : 'transparent',
                color: tab === t.id ? '#10b981' : '#d1fae5',
              }}
            >
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── PAGE CONTENT ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading && <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>Loading data...</div>}
        {isError && <div style={{ textAlign: 'center', padding: '80px 0', color: '#ef4444' }}>Failed to load data.</div>}
        {!isLoading && !isError && tab === 'summary'  && <SummaryPage  data={data} getBalance={getBalance} setTab={setTab} />}
        {!isLoading && !isError && tab === 'purchase' && <PurchasePage data={data} mutations={mutations} user={user} />}
        {!isLoading && !isError && tab === 'payments' && <PaymentsPage data={data} getBalance={getBalance} mutations={mutations} user={user} />}
        {!isLoading && !isError && tab === 'shops'    && <ShopsPage    data={data} getBalance={getBalance} mutations={mutations} user={user} />}
        {!isLoading && !isError && tab === 'reports'  && <ReportsPage  data={data} user={user} />}
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
function SummaryPage({ data, getBalance, setTab }) {
  const today = todayStr();
  const totalPurchased = data.purchases.reduce((s, p) => s + parseFloat(p.total_amount), 0);
  const totalPaid      = data.payments.reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0);
  const totalPending   = totalPurchased - totalPaid;

  const todayPurchases = data.purchases.filter(p => p.date === today);
  const todayPayments  = data.payments.filter(p => p.date === today);
  const todayTotal     = todayPurchases.reduce((s, p) => s + parseFloat(p.total_amount || 0), 0);

  // Fertilizer breakdown
  const fertMap = {};
  data.purchases.forEach(p => {
    if (p.items && p.items.length > 0) {
      p.items.forEach(item => {
        fertMap[item.item_name] = (fertMap[item.item_name] || 0) + parseFloat(item.amount || 0);
      });
    }
  });
  const fertItems = Object.entries(fertMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxFert = fertItems[0]?.[1] || 1;

  return (
    <div style={{ padding: '16px', paddingBottom: '96px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Grand total cards */}
      <div style={{ background: 'linear-gradient(135deg,#047857,#10b981)', borderRadius: '16px', padding: '16px', marginBottom: '4px' }}>
        <p style={{ color: '#d1fae5', fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', margin: 0 }}>Total Purchased (All Time)</p>
        <p style={{ color: 'white', fontSize: '31px', fontWeight: '900', margin: 0 }}>{fmtShort(totalPurchased)}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Card style={{ marginBottom: 0 }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', margin: 0 }}>Total Paid</p>
          <p style={{ color: '#10b981', fontWeight: '900', fontSize: '21px', margin: 0 }}>{fmtShort(totalPaid)}</p>
        </Card>
        <div style={{ borderRadius: '16px', border: `1px solid ${totalPending > 0 ? '#fde68a' : '#bbf7d0'}`, padding: '16px', background: `${totalPending > 0 ? 'var(--surface)' : 'var(--surface)'}` }}>
          <p style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', color: 'var(--text-muted)', margin: 0 }}>Pending</p>
          <p style={{ fontWeight: '900', fontSize: '21px', color: `${totalPending > 0 ? '#f59e0b' : '#10b981'}`, margin: 0 }}>{fmtShort(totalPending)}</p>
        </div>
      </div>

      {/* Today activity */}
      <Card style={{ border: '1px solid #d1fae5', background: 'var(--surface)', marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <PulseDot />
          <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)' }}>Today — {fmtDate(today)}</span>
        </div>
        {todayPurchases.length === 0 && todayPayments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '25px', marginBottom: '4px' }}>🌱</p>
            <p style={{ fontSize: '13px', fontWeight: '700' }}>No activity today</p>
            <button onClick={() => setTab('purchase')} style={{ marginTop: '8px', fontSize: '13px', fontWeight: '700', color: '#10b981', background: 'none', border: 'none', cursor: 'pointer' }}>+ Add Purchase →</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>
              <span>{todayPurchases.length} purchase{todayPurchases.length !== 1 ? 's' : ''}</span>
              <span style={{ color: '#10b981' }}>{fmtShort(todayTotal)}</span>
            </div>
            {todayPurchases.slice(0, 3).map(p => {
              const sk = data.shopkeepers.find(s => s.id === p.FertilizerShopkeeperId);
              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface2)', borderRadius: '12px', padding: '8px 12px', marginBottom: '6px' }}>
                  <div>
                    <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', margin: 0 }}>
                      {p.items?.length > 1 ? `${p.items.length} items` : p.items?.[0]?.fertilizer_name || 'Purchase'}
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>{sk?.name}</p>
                  </div>
                  <p style={{ fontSize: '15px', fontWeight: '900', color: 'var(--text)', margin: 0 }}>{fmtShort(p.total_amount)}</p>
                </div>
              );
            })}
            {todayPurchases.length > 3 && <p style={{ textAlign: 'center', fontSize: '13px', fontWeight: '700', color: '#10b981' }}>+{todayPurchases.length - 3} more</p>}
            {todayPayments.length > 0 && (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>
                💳 {todayPayments.length} payment(s) — {fmtShort(todayPayments.reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0))}
              </div>
            )}
          </>
        )}
      </Card>

      {/* Shopkeeper balances */}
      {data.shopkeepers.length > 0 && (
        <div>
          <SectionTitle action={<button onClick={() => setTab('shops')} style={{ fontSize: '13px', fontWeight: '700', color: '#10b981', background: 'none', border: 'none', cursor: 'pointer' }}>View All →</button>}>
            Shopkeeper Balances
          </SectionTitle>
          {data.shopkeepers.slice(0, 4).map(sk => {
            const { purchased, balance } = getBalance(sk.id);
            const pct = purchased > 0 ? Math.min(100, ((purchased - balance) / purchased) * 100) : 0;
            return (
              <div key={sk.id} style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '16px 12px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text)', margin: 0 }}>{sk.name}</p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Total: {fmtShort(purchased)}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '15px', fontWeight: '900', margin: 0, color: balance > 0 ? '#f59e0b' : '#10b981' }}>{fmtShort(balance)}</p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>balance</p>
                  </div>
                </div>
                <ProgressBar pct={pct} />
              </div>
            );
          })}
        </div>
      )}

      {/* By fertilizer horizontal bars */}
      {fertItems.length > 0 && (
        <div>
          <SectionTitle>By Fertilizer</SectionTitle>
          {fertItems.map(([name, amt], i) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)', width: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{name}</p>
              <div style={{ flex: 1, height: '20px', background: 'var(--surface2)', borderRadius: '8px', overflow: 'hidden' }}>
                <div
                  style={{ height: '100%', borderRadius: '8px', display: 'flex', alignItems: 'center', paddingLeft: '8px', fontSize: '11px', fontWeight: '900', color: 'white', minWidth: '30px', transition: 'all 0.5s', width: `${(amt / maxFert * 100).toFixed(0)}%`, background: FERT_COLORS[i % FERT_COLORS.length] }}
                >
                  {fmtShort(amt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PURCHASE PAGE
// ═══════════════════════════════════════════════════════════
const defaultPurchaseForm = () => ({
  shopkeeper_id: '', date: todayStr(), notes: '', slip_filename: '',
});

const defaultPurchaseItem = () => ({
  id: Math.random(), // for react key
  fertilizer_type: '', fertilizer_name: '', quantity: '', unit: 'kg', price_per_unit: '',
});

function PurchasePage({ data, mutations, user }) {
  const [form, setForm]         = useState(defaultPurchaseForm);
  const [items, setItems]       = useState([defaultPurchaseItem()]);
  const [editId, setEditId]     = useState(null);
  const [slipFile, setSlipFile] = useState(null);
  const [filterShop, setFShop]  = useState('');

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const setItem = (id, key, val) => setItems(its => its.map(i => i.id === id ? { ...i, [key]: val } : i));

  const totalAmount = items.reduce((sum, item) => sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.price_per_unit) || 0)), 0);

  const handleSave = () => {
    if (!form.shopkeeper_id) { toast.error('Select a shopkeeper'); return; }
    if (items.length === 0) { toast.error('Add at least one item'); return; }

    for (const item of items) {
      if (!item.fertilizer_type) { toast.error('Select fertilizer type for all items'); return; }
      if (item.fertilizer_type === 'Others' && !item.fertilizer_name.trim()) { toast.error('Enter custom fertilizer name'); return; }
      if (!item.quantity || parseFloat(item.quantity) <= 0) { toast.error('Enter valid quantity for all items'); return; }
      if (!item.price_per_unit || parseFloat(item.price_per_unit) <= 0) { toast.error('Enter valid price for all items'); return; }
    }

    // The backend expects each item to have `name`, `quantity`, and `rate`.
    // This mapping ensures the frontend state is transformed into the correct structure
    // that the backend API requires, resolving the "must have a name" error.
    const processedItems = items.map(item => ({
      name: item.fertilizer_type === 'Others' ? item.fertilizer_name.trim() : item.fertilizer_type,
      quantity: parseFloat(item.quantity) || 0,
      rate: parseFloat(item.price_per_unit) || 0,
    }));

    const formData = new FormData();
    formData.append('shopkeeper_id', form.shopkeeper_id);
    formData.append('date', form.date);
    formData.append('notes', form.notes);
    formData.append('total_amount', totalAmount);
    formData.append('items', JSON.stringify(processedItems));
    if (slipFile) {
      formData.append('slip_image', slipFile);
    }

    if (editId) {
      mutations.updatePurchase.mutate({ id: editId, data: formData });
      setEditId(null);
    } else {
      mutations.addPurchase.mutate(formData);
    }
    setForm(defaultPurchaseForm());
    setItems([defaultPurchaseItem()]);
    setSlipFile(null);
  };

  const handleEdit = (p) => {
    setEditId(p.id);
    setForm({ shopkeeper_id: String(p.FertilizerShopkeeperId), date: p.date, notes: p.notes || '', slip_filename: p.slip_filename });
    setSlipFile(null); // Clear any selected file when starting an edit
    // The backend sends items with `item_name` and `rate`. We must map this
    // to the structure the frontend form expects (`fertilizer_type`, `price_per_unit`, etc.).
    const formItems = p.items.map(backendItem => {
      const isOther = !FERT_TYPES.includes(backendItem.item_name);
      return {
        id: Math.random(),
        fertilizer_type: isOther ? 'Others' : backendItem.item_name,
        fertilizer_name: isOther ? backendItem.item_name : '',
        quantity: backendItem.quantity,
        price_per_unit: backendItem.rate,
      };
    });
    setItems(formItems);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this purchase?')) return;
    mutations.deletePurchase.mutate(id);
  };

  const handleCancel = () => { setEditId(null); setForm(defaultPurchaseForm()); setItems([defaultPurchaseItem()]); setSlipFile(null); };

  // Filtered list
  let purchaseHistory = data.purchases;
  if (filterShop) purchaseHistory = purchaseHistory.filter(p => String(p.FertilizerShopkeeperId) === filterShop);
  purchaseHistory = [...purchaseHistory].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const dayTotal = purchaseHistory.reduce((s, p) => s + parseFloat(p.total_amount || 0), 0);

  return (
    <div style={{ padding: '16px', paddingBottom: '96px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Form Card */}
      <Card>
        <SectionTitle>{editId ? '✏️ Edit Purchase' : '➕ Add Purchase'}</SectionTitle>

        {/* Date + Shopkeeper */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => set('date', e.target.value)} max={todayStr()} /></div>
          <div>
            <Label>Shopkeeper</Label>
            <Select value={form.shopkeeper_id} onChange={e => set('shopkeeper_id', e.target.value)}>
              <option value="">Select...</option>
              {data.shopkeepers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
        </div>

        {/* Items */}
        <Label>Items</Label>
        {items.map((item) => (
          <Card key={item.id} style={{ padding: '12px', marginBottom: '8px', borderStyle: 'dashed' }}>
            {items.length > 1 && <button onClick={() => setItems(its => its.filter(i => i.id !== item.id))} style={{ float: 'right', color: '#ef4444', fontSize: '13px', fontWeight: '700', background: 'none', border: 'none', cursor: 'pointer' }}>✕ Remove</button>}
            <div style={{ marginBottom: '8px' }}>
              <Label>Fertilizer Type</Label>
              <Select value={item.fertilizer_type} onChange={e => setItem(item.id, 'fertilizer_type', e.target.value)}>
                <option value="">Select...</option>
                {FERT_TYPES.map(t => <option key={t}>{t}</option>)}
              </Select>
            </div>
            {item.fertilizer_type === 'Others' && (
              <div style={{ marginBottom: '8px' }}>
                <Label>Fertilizer Name</Label>
                <Input placeholder="Enter name..." value={item.fertilizer_name} onChange={e => setItem(item.id, 'fertilizer_name', e.target.value)} />
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div>
                <Label>Quantity</Label>
                <Input type="number" placeholder="0" value={item.quantity} onChange={e => setItem(item.id, 'quantity', e.target.value)} />
              </div>
              <div>
                <Label>Unit</Label>
                <Select value={item.unit} onChange={e => setItem(item.id, 'unit', e.target.value)}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </Select>
              </div>
            </div>
            <div>
              <Label>Price per {item.unit || 'unit'}</Label>
              <Input type="number" placeholder="0.00" value={item.price_per_unit} onChange={e => setItem(item.id, 'price_per_unit', e.target.value)} />
            </div>
          </Card>
        ))}
        <BtnSecondary onClick={() => setItems(its => [...its, defaultPurchaseItem()])} style={{ width: 'auto', fontSize: '14px', padding: '8px 14px', marginTop: '4px', background: '#dcfce7', color: '#166534', borderColor: '#10b981', fontWeight: '800' }}>
          + Add Item
        </BtnSecondary>

        {/* Live Calculation Box */}
        {totalAmount > 0 && (
          <div style={{ background: 'var(--surface2)', border: '2px solid #a7f3d0', borderRadius: '16px', padding: '16px', marginTop: '12px', marginBottom: '12px' }}>
            <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px', margin: 0 }}>
              Grand Total
            </p>
            <p style={{ fontSize: '24px', fontWeight: '900', color: '#10b981', margin: 0 }}>
              = {fmtINR(totalAmount)}
            </p>
          </div>
        )}

        {/* Notes */}
        <div style={{ marginBottom: '12px' }}>
          <Label>Purchase Notes (optional)</Label>
          <Input placeholder="Any notes..." value={form.notes} onChange={e => set('notes', e.target.value)} style={{ marginBottom: '12px' }} />
        </div>

        {/* Slip Image Upload */}
        <div style={{ marginBottom: '16px' }}>
          <Label>Billing Slip Image (optional)</Label>
          <Input type="file" accept="image/*" onChange={e => setSlipFile(e.target.files[0])} />
          {!slipFile && editId && form.slip_filename && (
            <div style={{ marginTop: '8px', fontSize: '13px', fontWeight: '600' }}>
              <a href={`${api.defaults.baseURL.replace('/api', '')}/uploads/${form.slip_filename}`} target="_blank" rel="noopener noreferrer" style={{ color: '#10b981' }}>
                View Current Slip
              </a>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <BtnPrimary style={{ flex: 1 }} onClick={handleSave}>
            {editId ? '✅ Update Purchase' : '➕ Add Purchase'}
          </BtnPrimary>
          {editId && <BtnSecondary onClick={handleCancel} style={{ padding: '0 16px' }}>✕</BtnSecondary>}
        </div>
      </Card>

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
        <div>
          <Label>Filter Shop</Label>
          <Select value={filterShop} onChange={e => setFShop(e.target.value)}>
            <option value="">All Shops</option>
            {data.shopkeepers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionTitle>Purchase History</SectionTitle>
        {dayTotal > 0 && <p style={{ fontSize: '15px', fontWeight: '900', color: '#10b981', marginTop: '-12px' }}>Total: {fmtShort(dayTotal)}</p>}
      </div>

      {purchaseHistory.length === 0
        ? <Empty icon="🌾" text="No purchases found" hint={filterShop ? "No entries for this shop." : "Select a shop to see history."} />
        : purchaseHistory.map(p => {
            const sk = data.shopkeepers.find(s => s.id === p.FertilizerShopkeeperId);
            return (
              <div key={p.id} style={{ background: 'var(--surface)', borderRadius: '12px', border: `1.5px solid ${editId === p.id ? '#10b981' : 'var(--border)'}`, padding: '16px 12px', marginBottom: '8px', transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  {/* Purchase Details Section */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                      <span style={{ fontWeight: '700', color: 'var(--text)', fontSize: '15px' }}>{sk?.name || 'Unknown'}</span> · {fmtDate(p.date)}
                    </p>

                    <div style={{ marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {p.items?.map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', margin: 0 }}>{item.item_name}</p>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>{item.quantity} units @ {fmtShort(item.rate)}</p>
                          </div>
                          <p style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)', margin: 0 }}>{fmtShort(item.amount)}</p>
                        </div>
                      ))}
                    </div>

                    {p.slip_filename && (
                      <a href={`${api.defaults.baseURL.replace('/api', '')}/uploads/${p.slip_filename}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', fontWeight: '700', color: '#10b981', textDecoration: 'none', marginTop: '8px', display: 'inline-block' }}>
                        📄 View Slip
                      </a>
                    )}
                    {p.notes && <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '6px', margin: 0 }}>"{p.notes}"</p>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '16px', fontWeight: '900', color: 'var(--text)', margin: 0 }}>{fmtShort(p.total_amount)}</p>
                    {user.role === 'admin' && (
                      <div style={{ display: 'flex', gap: '4px', marginTop: '4px', justifyContent: 'flex-end' }}>
                        <BtnSecondary style={{ padding: '4px 8px', fontSize: '13px' }} onClick={() => handleEdit(p)}>✏️</BtnSecondary>
                        <BtnDanger onClick={() => handleDelete(p.id)}>🗑️</BtnDanger>
                      </div>
                    )}
                  </div>
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
function PaymentsPage({ data, getBalance, mutations, user }) {
  const [form, setForm]    = useState({ shopkeeper_id: '', date: todayStr(), amount_paid: '', notes: '' });
  const [filterShop, setFS] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const selectedSk = data.shopkeepers.find(s => String(s.id) === form.shopkeeper_id);
  const skBalance  = selectedSk ? getBalance(selectedSk.id) : null;

  const handleSave = () => {
    if (!form.shopkeeper_id)                                { toast.error('Select a shopkeeper'); return; }
    if (!form.amount_paid || parseFloat(form.amount_paid) <= 0) { toast.error('Enter valid amount'); return; }
    mutations.addPayment.mutate({ ...form, shopkeeper_id: +form.shopkeeper_id, amount_paid: parseFloat(form.amount_paid || 0) });
    setForm(f => ({ ...f, amount_paid: '', notes: '' }));
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this payment?')) return;
    mutations.deletePayment.mutate(id);
  };

  let paymentHistory = data.payments;
  if (filterShop) paymentHistory = paymentHistory.filter(p => String(p.FertilizerShopkeeperId) === filterShop);
  paymentHistory = [...paymentHistory].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const totalPaid = paymentHistory.reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0);

  return (
    <div style={{ padding: '16px', paddingBottom: '96px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Payment Form */}
      <Card>
        <SectionTitle>💳 Record Payment</SectionTitle>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => set('date', e.target.value)} max={todayStr()} /></div>
          <div>
            <Label>Shopkeeper</Label>
            <Select value={form.shopkeeper_id} onChange={e => set('shopkeeper_id', e.target.value)}>
              <option value="">Select...</option>
              {data.shopkeepers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
        </div>

        {/* Balance info */}
        {skBalance && skBalance.balance > 0 && (
          <div style={{ borderRadius: '12px', background: 'var(--surface2)', border: '1px solid #fcd34d', padding: '12px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: '700', color: '#b45309', margin: 0 }}>Current Balance Due</p>
              <p style={{ fontSize: '21px', fontWeight: '900', color: '#f59e0b', margin: 0 }}>{fmtShort(skBalance.balance)}</p>
            </div>
            <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: '700', color: '#f59e0b' }}>
              <p>Purchased: {fmtShort(skBalance.purchased)}</p>
              <p style={{ marginTop: '4px' }}>Paid so far: {fmtShort(skBalance.paid)}</p>
            </div>
          </div>
        )}
        {skBalance && skBalance.balance <= 0 && (
          <div style={{ borderRadius: '12px', background: 'var(--surface2)', border: '1px solid #a7f3d0', padding: '12px', marginBottom: '12px' }}>
            <p style={{ fontSize: '13px', fontWeight: '700', color: '#10b981', margin: 0 }}>✅ No outstanding balance for this shopkeeper</p>
          </div>
        )}

        <div style={{ marginBottom: '12px' }}>
          <Label>Amount Paid (₹)</Label>
          <Input type="number" placeholder="0.00" min="0.01" step="0.01" style={{ fontSize: '20px', fontWeight: '900' }} value={form.amount_paid} onChange={e => set('amount_paid', e.target.value)} />
        </div>
        <div style={{ marginBottom: '12px' }}>
          <Label>Notes (optional)</Label>
          <Input placeholder="Payment notes..." value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
        <BtnPrimary onClick={handleSave}>💳 Record Payment</BtnPrimary>
      </Card>

      {/* Filter */}
      <div>
        <Label>Filter by Shopkeeper</Label>
        <Select value={filterShop} onChange={e => setFS(e.target.value)}>
          <option value="">All Shopkeepers</option>
          {data.shopkeepers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionTitle>Payment History</SectionTitle>
        {totalPaid > 0 && <p style={{ fontSize: '15px', fontWeight: '900', color: '#10b981', marginTop: '-12px' }}>{fmtShort(totalPaid)}</p>}
      </div>

      {paymentHistory.length === 0
        ? <Empty icon="💳" text="No payments yet" />
        : paymentHistory.map(p => {
            const sk = data.shopkeepers.find(s => s.id === p.FertilizerShopkeeperId);
            return (
              <div key={p.id} style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '12px 16px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '19px', flexShrink: 0 }}>💳</div>
                  <div>
                    <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', margin: 0 }}>{sk?.name || 'Unknown'}</p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>{fmtDate(p.date)}{p.notes ? ` · ${p.notes}` : ''}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <p style={{ fontSize: '16px', fontWeight: '900', color: '#10b981', margin: 0 }}>{fmtShort(p.amount_paid)}</p>
                  {user.role === 'admin' && (
                    <BtnDanger onClick={() => handleDelete(p.id)}>🗑️</BtnDanger>
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
// SHOPS PAGE
// ═══════════════════════════════════════════════════════════
const defaultSkForm = () => ({ name: '', phone: '', address: '' });

function ShopsPage({ data, getBalance, mutations, user }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(defaultSkForm());
  const [editId, setEditId]     = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Enter shopkeeper name'); return; }
    if (!editId && data.shopkeepers.some(s => s.name.toLowerCase() === form.name.trim().toLowerCase())) {
      toast.error('Shopkeeper already exists'); return;
    }
    if (editId) {
      mutations.updateShopkeeper.mutate({ id: editId, ...form, name: form.name.trim() });
    } else {
      mutations.addShopkeeper.mutate({ ...form, name: form.name.trim() });
    }
    setEditId(null); setShowForm(false); setForm(defaultSkForm());
  };

  const handleEdit = (sk) => {
    setEditId(sk.id); setForm({ name: sk.name, phone: sk.phone || '', address: sk.address || '' });
    setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this shopkeeper? All related records will be removed.')) return;
    mutations.deleteShopkeeper.mutate(id);
  };

  const handleCancel = () => { setEditId(null); setShowForm(false); setForm(defaultSkForm()); };

  const totalBal = data.shopkeepers.reduce((s, sk) => s + getBalance(sk.id).balance, 0);

  return (
    <div style={{ padding: '16px', paddingBottom: '96px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionTitle>Shopkeepers</SectionTitle>
        <BtnPrimary style={{ padding: '8px 12px', fontSize: '13px', marginTop: '-12px', width: 'auto' }} onClick={() => { setShowForm(s => !s); if (showForm) handleCancel(); }}>
          ➕ Add Shop
        </BtnPrimary>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', marginBottom: '12px' }}>{editId ? 'Edit Shopkeeper' : 'New Shopkeeper'}</p>
          <div style={{ marginBottom: '8px' }}><Label>Name *</Label><Input placeholder="Shopkeeper name" value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <div style={{ marginBottom: '8px' }}><Label>Phone (optional)</Label><Input placeholder="Mobile number" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
          <div style={{ marginBottom: '12px' }}><Label>Address (optional)</Label><Input placeholder="Shop address" value={form.address} onChange={e => set('address', e.target.value)} /></div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <BtnPrimary style={{ flex: 1 }} onClick={handleSave}>✅ {editId ? 'Update' : 'Add Shopkeeper'}</BtnPrimary>
            <BtnSecondary onClick={handleCancel} style={{ padding: '0 16px' }}>✕</BtnSecondary>
          </div>
        </Card>
      )}

      {/* Total balance banner */}
      {data.shopkeepers.length > 0 && (
        <div style={{ borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', border: `1px solid ${totalBal > 0 ? '#fcd34d' : '#a7f3d0'}` }}>
          <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-muted)', margin: 0 }}>Total Outstanding Balance</p>
          <p style={{ fontSize: '21px', fontWeight: '900', margin: 0, color: totalBal > 0 ? '#f59e0b' : '#10b981' }}>{fmtShort(totalBal)}</p>
        </div>
      )}

      {/* List */}
      {data.shopkeepers.length === 0
        ? <Empty icon="🏪" text="No shopkeepers yet" hint="Add your first shopkeeper above" />
        : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{data.shopkeepers.map(sk => {
            const { purchased, paid, balance } = getBalance(sk.id);
            const pct = purchased > 0 ? Math.min(100, (paid / purchased) * 100) : 0;
            return (
              <div key={sk.id} style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontWeight: '700', color: 'var(--text)', margin: 0 }}>{sk.name}</p>
                    {sk.phone && <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>📞 {sk.phone}</p>}
                    {sk.address && <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>📍 {sk.address}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <BtnSecondary style={{ padding: '6px 10px', fontSize: '13px' }} onClick={() => handleEdit(sk)}>✏️ Edit</BtnSecondary>
                    {user.role === 'admin' && (
                      <BtnDanger onClick={() => handleDelete(sk.id)}>🗑️ Delete</BtnDanger>
                    )}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                  {[
                    { label: 'Purchased', val: purchased, cls: 'text-blue-600' },
                    { label: 'Paid',      val: paid,      cls: 'text-emerald-600' },
                    { label: 'Balance',   val: balance,   cls: balance > 0 ? 'text-amber-500' : 'text-emerald-500' },
                  ].map(({ label, val, cls }) => (
                    <div key={label}>
                      <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '2px' }}>{label}</p>
                      <p style={{ fontSize: '15px', fontWeight: '900', color: cls, margin: 0 }}>{fmtShort(val)}</p>
                    </div>
                  ))}
                </div>
                <ProgressBar pct={pct} />
              </div>
            );
          })}</div>
      }
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// REPORTS PAGE
// ═══════════════════════════════════════════════════════════
function ReportsPage({ data }) {
  const [fromDate, setFrom] = useState(d30ago());
  const [toDate, setTo]     = useState(todayStr());
  const [shopId, setShopId] = useState('');

  let purch = data.purchases;
  let pays = data.payments;
  if (fromDate) { purch = purch.filter(p => p.date >= fromDate); pays = pays.filter(p => p.date >= fromDate); }
  if (toDate)   { purch = purch.filter(p => p.date <= toDate);   pays = pays.filter(p => p.date <= toDate); }
  if (shopId)   { purch = purch.filter(p => String(p.FertilizerShopkeeperId) === shopId); pays = pays.filter(p => String(p.FertilizerShopkeeperId) === shopId); }

  const totalPurchased = purch.reduce((s, p) => s + parseFloat(p.total_amount || 0), 0);
  const totalPaid      = pays.reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0);
  const totalPending   = totalPurchased - totalPaid;

  // By shopkeeper
  const byShop = {};
  data.shopkeepers.forEach(sk => { byShop[sk.id] = { name: sk.name, purchased: 0, paid: 0 }; });
  purch.forEach(p => { if (byShop[p.FertilizerShopkeeperId]) byShop[p.FertilizerShopkeeperId].purchased += parseFloat(p.total_amount || 0); });
  pays.forEach(p  => { if (byShop[p.FertilizerShopkeeperId]) byShop[p.FertilizerShopkeeperId].paid += parseFloat(p.amount_paid || 0); });
  const shopRows = Object.values(byShop).filter(s => s.purchased > 0 || s.paid > 0).sort((a, b) => b.purchased - a.purchased);

  // By fertilizer
  const byFert = {};
  purch.forEach(p => {
    if (p.items && p.items.length > 0) {
      p.items.forEach(item => {
        if (!byFert[item.item_name]) byFert[item.item_name] = { total: 0 };
        byFert[item.item_name].total += parseFloat(item.amount || 0);
      });
    }
  });
  const fertRows = Object.entries(byFert).sort((a, b) => b[1].total - a[1].total);
  const maxFert  = fertRows[0]?.[1].total || 1;
  const chartMax = Math.max(...shopRows.map(s => s.purchased), 1);

  const exportCSV = (type) => {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    let rows, headers, mapRow;
    if (type === 'purchases') {
      rows    = [...purch].sort((a, b) => b.date.localeCompare(a.date));
      headers = ['Purchase ID', 'Shopkeeper', 'Date', 'Item Name', 'Quantity', 'Rate', 'Amount', 'Purchase Notes', 'Slip Filename'];
      const lines = [headers.map(esc).join(',')];
      rows.forEach(p => {
        const sk = data.shopkeepers.find(s => s.id === p.FertilizerShopkeeperId);
        p.items?.forEach(item => {
          lines.push([p.id, sk?.name || '', p.date, item.item_name, item.quantity, item.rate, item.amount, p.notes || '', p.slip_filename || ''].map(esc).join(','));
        });
      });
      const csv = lines.join('\n');
      downloadFile('fertilizer_purchases.csv', csv);
      return;
    } else {
      rows    = [...pays].sort((a, b) => b.date.localeCompare(a.date));
      headers = ['Shopkeeper','Date','Amount Paid','Notes'];
      mapRow  = p => { const sk = data.shopkeepers.find(s => s.id === p.FertilizerShopkeeperId); return [sk?.name||'',p.date,p.amount_paid,p.notes||'']; };
    }
    const csv = [headers.map(esc).join(','), ...rows.map(r => mapRow(r).map(esc).join(','))].join('\n');
    const a   = document.createElement('a');
    downloadFile(`fertilizer_${type}.csv`, csv);
  };

  const downloadFile = (filename, content) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = filename; link.click();
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
          <Label>Shopkeeper</Label>
          <Select value={shopId} onChange={e => setShopId(e.target.value)}>
            <option value="">All Shopkeepers</option>
            {data.shopkeepers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <BtnSecondary style={{ flex: 1, fontSize: '13px', padding: '8px' }} onClick={() => exportCSV('purchases')}>📥 Purchases CSV</BtnSecondary>
          <BtnSecondary style={{ flex: 1, fontSize: '13px', padding: '8px' }} onClick={() => exportCSV('payments')}>📥 Payments CSV</BtnSecondary>
        </div>
      </Card>

      {/* Grand totals */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
        {[
          { label: 'Purchased', val: totalPurchased, cls: 'text-blue-600' },
          { label: 'Paid',      val: totalPaid,      cls: 'text-emerald-600' },
          { label: 'Pending',   val: totalPending,   cls: 'text-amber-500' },
        ].map(({ label, val, cls }) => (
          <Card key={label} style={{ marginBottom: 0, textAlign: 'center', padding: '12px' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</p>
            <p style={{ fontSize: '15px', fontWeight: '900', color: cls, margin: 0 }}>{fmtShort(val)}</p>
          </Card>
        ))}
      </div>

      {/* Shopkeeper comparison bar chart */}
      {shopRows.length > 0 && (
        <Card>
          <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', marginBottom: '8px' }}>Shopkeeper Comparison</p>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', fontSize: '13px', fontWeight: '700' }}>
            <span><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#3b82f6', marginRight: '4px' }} />Purchased</span>
            <span><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#10b981', marginRight: '4px' }} />Paid</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', minHeight: '110px', paddingTop: '8px', overflowX: 'auto' }}>
            {shopRows.map(s => (
              <div key={s.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: '44px' }}>
                <p style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)' }}>{fmtShort(s.purchased)}</p>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end' }}>
                  <div style={{ width: '16px', borderTopLeftRadius: '3px', borderTopRightRadius: '3px', background: '#3b82f6', transition: 'all 0.2s', height: `${Math.max(4, (s.purchased / chartMax) * 90)}px` }} />
                  <div style={{ width: '16px', borderTopLeftRadius: '3px', borderTopRightRadius: '3px', background: '#10b981', transition: 'all 0.2s', height: `${Math.max(2, (s.paid / chartMax) * 90)}px` }} />
                </div>
                <p style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '44px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* By fertilizer */}
      {fertRows.length > 0 && (
        <Card>
          <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', marginBottom: '12px' }}>By Fertilizer Type</p>
          {fertRows.map(([name, d], i) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)', width: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{name}</p>
              <div style={{ flex: 1, height: '20px', background: 'var(--surface2)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '8px', display: 'flex', alignItems: 'center', paddingLeft: '8px', fontSize: '11px', fontWeight: '900', color: 'white', minWidth: '30px', transition: 'all 0.5s', width: `${(d.total / maxFert * 100).toFixed(0)}%`, background: FERT_COLORS[i % FERT_COLORS.length] }}>
                  {fmtShort(d.total)}
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Shopkeeper breakdown table */}
      {shopRows.length > 0 && (
        <div>
          <SectionTitle>Shopkeeper Summary</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{shopRows.map(s => {
            const bal = s.purchased - s.paid;
            const pct = s.purchased > 0 ? Math.min(100, (s.paid / s.purchased) * 100) : 0;
            return (
              <div key={s.name} style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text)', margin: 0 }}>{s.name}</p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Purchased: {fmtShort(s.purchased)} · Paid: {fmtShort(s.paid)}</p>
                  </div>
                  <p style={{ fontSize: '15px', fontWeight: '900', margin: 0, color: bal > 0 ? '#f59e0b' : '#10b981' }}>{fmtShort(bal)} due</p>
                </div>
                <ProgressBar pct={pct} />
              </div>
            );
          })}</div>
        </div>
      )}

      {purch.length === 0 && pays.length === 0 && (
        <Empty icon="📊" text="No data for this filter" hint="Try a wider date range" />
      )}
    </div>
  );
}
