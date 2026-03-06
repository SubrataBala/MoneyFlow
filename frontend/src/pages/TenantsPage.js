import { useState, useEffect, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtINR   = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = (v) => '₹' + Number(v || 0).toLocaleString('en-IN');
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

/**
 * Land Unit Conversion:
 *   0.20 = 1 unit
 *   finalUnits = floor(value) + round(decimal / 0.20)
 */
function convertLandMeasurementToUnits(landValue) {
    const landStr = String(landValue || '0');
    const parts = landStr.split('.');
    const integerPart = parseInt(parts[0], 10) || 0;
    const decimalStr = parts[1] || '0';
    const decimalPart = parseInt(decimalStr, 10) || 0;
    return (integerPart * 20) + decimalPart;
}

function fmtLand(v) { return Number(v || 0).toFixed(2); }

// ─────────────────────────────────────────────
// REUSABLE UI
// ─────────────────────────────────────────────
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

function SectionTitle({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700', color: 'var(--text)', margin: 0 }}>
        <span style={{ width: '4px', height: '16px', borderRadius: '99px', background: '#f59e0b', display: 'inline-block' }} />
        {children}
      </h2>
      {action}
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

function Select({ children, style = {}, ...props }) {
  return (
    <select style={{
      width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border)',
      borderRadius: '10px', padding: '12px', fontSize: '15px', fontWeight: '600',
      color: 'var(--text)', outline: 'none', boxSizing: 'border-box', appearance: 'none', fontFamily: 'inherit', ...style
    }} {...props}>
      {children}
    </select>
  );
}

function BtnPrimary({ children, style = {}, ...props }) {
  return (
    <button style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', color: 'white',
      fontWeight: '700', padding: '14px 16px', borderRadius: '12px', fontSize: '15px',
      cursor: 'pointer', width: '100%', fontFamily: 'inherit', ...style
    }} {...props}>
      {children}
    </button>
  );
}

function BtnSecondary({ children, style = {}, ...props }) {
  return (
    <button style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
      background: 'var(--surface2)', border: '1.5px solid var(--border)', color: 'var(--text)',
      fontWeight: '700', padding: '10px 14px', borderRadius: '10px', fontSize: '13px',
      cursor: 'pointer', fontFamily: 'inherit', ...style
    }} {...props}>
      {children}
    </button>
  );
}

function BtnDanger({ children, style = {}, ...props }) {
  return (
    <button style={{
      background: '#fee2e2', color: '#ef4444', fontWeight: '700', padding: '6px 10px',
      borderRadius: '8px', fontSize: '12px', cursor: 'pointer', border: 'none', fontFamily: 'inherit', ...style
    }} {...props}>
      {children}
    </button>
  );
}

function ProgressBar({ pct }) {
  return (
    <div style={{ marginTop: '8px', height: '6px', background: 'var(--surface2)', borderRadius: '99px', overflow: 'hidden' }}>
      <div style={{ height: '100%', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)', borderRadius: '99px', transition: 'width 0.5s', width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

function PulseDot() {
  return <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: '#f59e0b', borderRadius: '99px' }} />;
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

// ─── MODAL (bottom sheet) ─────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// TABS CONFIG
// ─────────────────────────────────────────────
const TABS = [
  { id: 'summary',  icon: '📊', label: 'Summary'  },
  { id: 'owners',   icon: '👨‍🌾', label: 'Owners'   },
  { id: 'lands',    icon: '🌾', label: 'Lands'    },
  { id: 'payments', icon: '💰', label: 'Payments' },
  { id: 'details',  icon: '📋', label: 'Details'  },
];

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function TenantsPage() {
  const [tab, setTab] = useState('summary');
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['tenantsData'],
    queryFn: async () => {
      const [oRes, lRes, pRes] = await Promise.all([
        api.get('/tenants/owners'),
        api.get('/tenants/lands'),
        api.get('/tenants/payments'),
      ]);
      return { owners: oRes.data, lands: lRes.data, payments: pRes.data };
    },
    initialData: { owners: [], lands: [], payments: [] }
  });

  const onRefresh = () => queryClient.invalidateQueries({ queryKey: ['tenantsData'] });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'sans-serif' }}>
      <Toaster position="top-center" toastOptions={{ duration: 2500, style: { borderRadius: '12px', fontWeight: 700, fontSize: '13px' } }} />

      {/* ── STICKY HEADER ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'linear-gradient(135deg, #78350f 0%, #b45309 50%, #f59e0b 100%)',
        boxShadow: '0 4px 20px rgba(120,53,15,0.35)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', flexShrink: 0 }}>
              🌾
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', lineHeight: 1 }}>Land Tenant</p>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#fde68a', fontWeight: '500' }}>Farming Management System</p>
            </div>
          </div>
        </div>

        {/* Top Tab Buttons */}
        <div style={{ display: 'flex', gap: '4px', padding: '0 8px', overflowX: 'auto' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px',
                fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap',
                transition: 'all 0.2s', border: 'none', outline: 'none', cursor: 'pointer',
                background: tab === t.id ? 'var(--bg)' : 'transparent',
                color: tab === t.id ? '#f59e0b' : '#fde68a',
                fontFamily: 'inherit',
              }}
            >
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── PAGE CONTENT ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading
          ? <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)', fontSize: '14px', fontWeight: '600' }}>🌾 Loading...</div>
          : isError
          ? <div style={{ textAlign: 'center', padding: '80px 0', color: '#ef4444', fontSize: '14px', fontWeight: '600' }}>Error loading data.</div>
          : (
            <>
              {tab === 'summary'  && <SummaryPage  data={data} setTab={setTab} />}
              {tab === 'owners'   && <OwnersPage   data={data} onRefresh={onRefresh} user={user} />}
              {tab === 'lands'    && <LandsPage    data={data} onRefresh={onRefresh} user={user} />}
              {tab === 'payments' && <PaymentsPage data={data} onRefresh={onRefresh} user={user} />}
              {tab === 'details'  && <DetailsPage  data={data} />}
            </>
          )
        }
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
function SummaryPage({ data, setTab }) {
  const { owners, lands, payments } = data;
  const today = todayStr();

  const totalUnits       = lands.reduce((s, l) => s + parseInt(l.convertedUnits || 0), 0);
  const totalAmount      = lands.reduce((s, l) => s + parseFloat(l.totalAmount || 0), 0);
  const totalPaid        = payments.reduce((s, p) => s + parseFloat(p.amountPaid || 0), 0);
  const totalRemaining   = totalAmount - totalPaid;

  const totalInt = Math.floor(totalUnits / 20);
  const totalDec = String(totalUnits % 20).padStart(2, '0');

  const todayPayments    = payments.filter(p => p.date === today);
  const todayPaid        = todayPayments.reduce((s, p) => s + parseFloat(p.amountPaid || 0), 0);

  // Per-owner balances for quick view
  const ownerBalances = owners.map(o => {
    const oLands    = lands.filter(l => l.landOwnerId === o.id);
    const oPays     = payments.filter(p => p.landOwnerId === o.id);
    const amt       = oLands.reduce((s, l) => s + parseFloat(l.totalAmount || 0), 0);
    const paid      = oPays.reduce((s, p) => s + parseFloat(p.amountPaid || 0), 0);
    const units     = oLands.reduce((s, l) => s + parseInt(l.converted_units || 0), 0);
    return { ...o, amt, paid, remaining: amt - paid, units, plots: oLands.length };
  }).filter(o => o.amt > 0).sort((a, b) => b.remaining - a.remaining);

  return (
    <div style={{ padding: '16px' }}>

      {/* Hero total card */}
      <div style={{
        background: 'linear-gradient(135deg, #78350f, #b45309, #f59e0b)',
        borderRadius: 'var(--radius)', padding: '20px', color: 'white', marginBottom: '16px',
        boxShadow: '0 8px 24px rgba(120,53,15,0.25)'
      }}>
        <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: '700', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Land Payable</p>
        <p style={{ margin: '0 0 16px', fontSize: '38px', fontWeight: '900', lineHeight: 1 }}>{fmtShort(totalAmount)}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: '12px', padding: '12px' }}>
            <p style={{ margin: '0 0 4px', fontSize: '10px', opacity: 0.8, fontWeight: '700', textTransform: 'uppercase' }}>Paid</p>
            <p style={{ margin: 0, fontSize: '22px', fontWeight: '900' }}>{fmtShort(totalPaid)}</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: '12px', padding: '12px' }}>
            <p style={{ margin: '0 0 4px', fontSize: '10px', opacity: 0.8, fontWeight: '700', textTransform: 'uppercase' }}>Remaining</p>
            <p style={{ margin: 0, fontSize: '22px', fontWeight: '900' }}>{fmtShort(totalRemaining)}</p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        {[
          { icon: '👨‍🌾', label: 'Owners',  value: owners.length,               color: '#b45309' },
          { icon: '🗺️',  label: 'Plots',   value: lands.length,                color: '#0ea5e9' },
          { icon: '📐',  label: 'Land',    value: (
            <span>
              {totalInt}
              <span style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>.{totalDec}</span>
            </span>
          ),   color: '#a855f7' },
          { icon: '🔢',  label: 'Units',   value: totalUnits,                  color: '#10b981' },
        ].map(s => (
          <Card key={s.label} style={{ marginBottom: 0, textAlign: 'center', padding: '12px 8px' }}>
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>{s.icon}</div>
            <p style={{ margin: '0 0 2px', fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: s.color }}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Today */}
      <Card style={{ border: '1px solid #fde68a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <PulseDot />
          <span style={{ fontSize: '14px', fontWeight: '700' }}>Today — {fmtDate(today)}</span>
        </div>
        {todayPayments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <p style={{ fontSize: '24px', margin: '0 0 4px' }}>🌱</p>
            <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', margin: '0 0 8px' }}>No payments today</p>
            <button onClick={() => setTab('payments')} style={{ fontSize: '12px', fontWeight: '700', color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>+ Record Payment →</button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>{todayPayments.length} payment{todayPayments.length !== 1 ? 's' : ''}</span>
              <span style={{ fontSize: '14px', fontWeight: '800', color: '#10b981' }}>{fmtShort(todayPaid)}</span>
            </div>
            {todayPayments.slice(0, 3).map(p => {
              const owner = owners.find(o => o.id === p.landOwnerId);
              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface2)', borderRadius: '10px', padding: '8px 12px', marginBottom: '6px' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: '700', fontSize: '13px' }}>{owner?.name || '—'}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>{p.payment_method}</p>
                  </div>
                  <p style={{ margin: 0, fontWeight: '900', fontSize: '14px', color: '#10b981' }}>{fmtShort(p.amountPaid)}</p>
                </div>
              );
            })}
            {todayPayments.length > 3 && <p style={{ textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#f59e0b', margin: 0 }}>+{todayPayments.length - 3} more</p>}
          </div>
        )}
      </Card>

      {/* Owner Balances */}
      {ownerBalances.length > 0 && (
        <div>
          <SectionTitle action={<button onClick={() => setTab('details')} style={{ fontSize: '12px', fontWeight: '700', color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>View All →</button>}>
            Owner Balances
          </SectionTitle>
          {ownerBalances.map(o => {
            const pct = o.amt > 0 ? (o.paid / o.amt) * 100 : 0;
            return (
              <div key={o.id} style={{ background: 'var(--surface)', borderRadius: '14px', border: '1px solid var(--border)', padding: '14px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text)', margin: '0 0 2px' }}>{o.name}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                      {o.village && `📍 ${o.village} · `}{o.plots} plot{o.plots !== 1 ? 's' : ''} · {o.units} units
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '15px', fontWeight: '900', margin: 0, color: o.remaining > 0 ? '#ef4444' : '#10b981' }}>{fmtShort(o.remaining)}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>remaining</p>
                  </div>
                </div>
                <ProgressBar pct={pct} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                  <span>Total: {fmtShort(o.amt)}</span>
                  <span style={{ color: '#f59e0b' }}>Paid: {fmtShort(o.paid)} · {pct.toFixed(0)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {owners.length === 0 && <Empty icon="🌾" text="No data yet" hint="Start by adding land owners in the Owners tab" />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// OWNERS PAGE
// ═══════════════════════════════════════════════════════════
function OwnersPage({ data, onRefresh, user }) {
  const { owners, lands, payments } = data;
  const [showForm, setShowForm]   = useState(false);
  const [editOwner, setEditOwner] = useState(null);
  const [search, setSearch]       = useState('');
  const [filterVillage, setFV]    = useState('');
  const [form, setForm]           = useState({ name: '', village: '', phone: '', notes: '' });

  const villages = [...new Set(owners.map(o => o.village).filter(Boolean))];

  const openAdd  = () => { setForm({ name: '', village: '', phone: '', notes: '' }); setEditOwner(null); setShowForm(true); };
  const openEdit = (o) => { setForm({ name: o.name, village: o.village || '', phone: o.phone || '', notes: o.notes || '' }); setEditOwner(o); setShowForm(true); };

  const mutation = useMutation({
    mutationFn: (ownerData) => editOwner
      ? api.put(`/tenants/owners/${editOwner.id}`, ownerData)
      : api.post('/tenants/owners', ownerData),
    onSuccess: () => {
      toast.success(editOwner ? 'Owner updated!' : 'Owner added!');
      setShowForm(false);
      onRefresh();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Save failed'),
  });

  const handleSave = () => {
    if (!form.name.trim()) return toast.error('Owner name is required');
    mutation.mutate(form);
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/tenants/owners/${id}`),
    onSuccess: () => { toast.success('Deleted'); onRefresh(); },
    onError: () => toast.error('Delete failed'),
  });

  const handleDelete = (id) => {
    if (window.confirm('Delete this owner? All associated land and payment records will also be removed.')) {
      deleteMutation.mutate(id);
    }
  };

  const filtered = owners.filter(o => {
    const ms = o.name.toLowerCase().includes(search.toLowerCase()) || (o.village || '').toLowerCase().includes(search.toLowerCase());
    return ms && (!filterVillage || o.village === filterVillage);
  });

  return (
    <div style={{ padding: '16px' }}>
      {/* Search + Add */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <Input placeholder="🔍 Search owners..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
        {user.role === 'owner' && (
          <button onClick={openAdd} style={{ padding: '14px 22px', background: 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '700', fontSize: '15px', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>+ Add Owner</button>
        )}
      </div>

      {/* Village filter chips */}
      {villages.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
          {['', ...villages].map(v => (
            <button key={v || '__all'} onClick={() => setFV(v)}
              style={{ whiteSpace: 'nowrap', padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '12px', fontFamily: 'inherit', background: filterVillage === v ? '#f59e0b' : 'var(--surface2)', color: filterVillage === v ? 'white' : 'var(--text-muted)' }}>
              {v ? `📍 ${v}` : 'All'}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0
        ? <Empty icon="👨‍🌾" text="No owners found" hint="Tap + Add to register a land owner" />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map(o => {
              const oLands = lands.filter(l => l.landOwnerId === o.id);
              const oPays  = payments.filter(p => p.landOwnerId === o.id);
              const amt    = oLands.reduce((s, l) => s + parseFloat(l.totalAmount || 0), 0);
              const paid   = oPays.reduce((s, p) => s + parseFloat(p.amountPaid || 0), 0);
              return (
                <Card key={o.id} style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg,#f59e0b,#d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '900', fontSize: '18px', flexShrink: 0 }}>
                        {o.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p style={{ margin: '0 0 2px', fontWeight: '800', fontSize: '16px' }}>{o.name}</p>
                        {o.village && <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>📍 {o.village}</p>}
                        {o.phone   && <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>📞 {o.phone}</p>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <BtnSecondary style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => openEdit(o)}>✏️</BtnSecondary>
                      {user.role === 'admin' && (
                        <BtnDanger onClick={() => handleDelete(o.id)} disabled={deleteMutation.isLoading}>🗑️</BtnDanger>
                      )}
                    </div>
                  </div>
                  {amt > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '12px' }}>
                      {[['Plots', oLands.length, 'var(--text)'], ['Total', fmtShort(amt), '#b45309'], ['Due', fmtShort(amt - paid), amt - paid > 0 ? '#ef4444' : '#10b981']].map(([l, v, c]) => (
                        <div key={l} style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                          <p style={{ margin: '0 0 2px', fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{l}</p>
                          <p style={{ margin: 0, fontWeight: '900', fontSize: '13px', color: c }}>{v}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {o.notes && <p style={{ margin: '10px 0 0', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>"{o.notes}"</p>}
                </Card>
              );
            })}
          </div>
        )}

      {showForm && (
        <Modal title={editOwner ? '✏️ Edit Owner' : '👨‍🌾 Add Land Owner'} onClose={() => setShowForm(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div><Label>Owner Name *</Label><Input placeholder="Ram Das" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Village / Location</Label><Input placeholder="Village name" value={form.village} onChange={e => setForm(f => ({ ...f, village: e.target.value }))} /></div>
            <div><Label>Phone Number</Label><Input placeholder="Optional" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div><Label>Notes</Label><Input placeholder="Optional notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <BtnPrimary onClick={handleSave} disabled={mutation.isLoading}>{mutation.isLoading ? '⏳ Saving...' : (editOwner ? '💾 Update Owner' : '+ Add Owner')}</BtnPrimary>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// LANDS PAGE
// ═══════════════════════════════════════════════════════════
function LandsPage({ data, onRefresh, user }) {
  const { owners, lands } = data;
  const [showForm, setShowForm]   = useState(false);
  const [editLand, setEditLand]   = useState(null);
  const [filterOwner, setFOwner]  = useState('');
  const [form, setForm] = useState({
    landOwnerId: '',
    total_land_price: '',
    items: [{ id: Date.now(), land_measurement: '', notes: '' }],
  });

  const openAdd = () => {
    setForm({
      landOwnerId: owners.length > 0 ? owners[0].id : '',
      total_land_price: '',
      items: [{ id: Date.now(), land_measurement: '', notes: '' }],
    });
    setEditLand(null);
    setShowForm(true);
  };

  const openEdit = (l) => {
    setForm({
      landOwnerId: l.landOwnerId,
      total_land_price: parseFloat(l.pricePerUnit || 0) * 20,
      items: [{ id: l.id, land_measurement: l.landMeasurement, notes: l.notes || '' }],
    });
    setEditLand(l);
    setShowForm(true);
  };

  const handleItemChange = (itemId, field, value) => {
    setForm(f => ({ ...f, items: f.items.map(item => item.id === itemId ? { ...item, [field]: value } : item) }));
  };

  const addLandItem = () => {
    setForm(f => ({ ...f, items: [...f.items, { id: Date.now(), land_measurement: '', notes: '' }] }));
  };

  const removeLandItem = (itemId) => {
    setForm(f => ({ ...f, items: f.items.filter(item => item.id !== itemId) }));
  };

  const singleMutation = useMutation({
    mutationFn: (landData) => api.put(`/tenants/lands/${editLand.id}`, landData.payload),
    onSuccess: () => {
      toast.success('Land record updated!');
      setShowForm(false);
      onRefresh();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Save failed'),
  });

  const bulkMutation = useMutation({
    mutationFn: (bulkData) => api.post('/tenants/lands/bulk', bulkData),
    onSuccess: () => {
      toast.success(`${form.items.length} land record(s) added!`);
      setShowForm(false);
      onRefresh();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Bulk save failed'),
  });

  const handleSave = () => {
    if (!form.landOwnerId) return toast.error('Select a land owner');
    if (!form.total_land_price || parseFloat(form.total_land_price) <= 0) return toast.error('Total Land Price is required.');

    const unitPrice = parseFloat(form.total_land_price) / 20;

    if (editLand) {
      const item = form.items[0];
      if (!item.land_measurement) return toast.error('Land measurement is required.');
      const convertedUnits = convertLandMeasurementToUnits(item.land_measurement);
      const totalAmount = convertedUnits * unitPrice;
      const payload = {
        land_owner_id: form.landOwnerId,
        land_measurement: item.land_measurement,
        price_per_unit: unitPrice,
        notes: item.notes,
        converted_units: convertedUnits,
        total_amount: totalAmount,
      };
      singleMutation.mutate({ payload });
    } else {
      if (form.items.length === 0) return toast.error('Add at least one land record.');
      const landsToCreate = [];
      for (const item of form.items) {
        if (!item.land_measurement) return toast.error('All records must have a measurement.');
        const convertedUnits = convertLandMeasurementToUnits(item.land_measurement);
        const totalAmount = convertedUnits * unitPrice;
        landsToCreate.push({
          land_measurement: item.land_measurement,
          price_per_unit: unitPrice,
          notes: item.notes,
          converted_units: convertedUnits,
          total_amount: totalAmount,
        });
      }
      const payload = { land_owner_id: form.landOwnerId, lands: landsToCreate };
      bulkMutation.mutate(payload);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/tenants/lands/${id}`),
    onSuccess: () => { toast.success('Deleted'); onRefresh(); },
    onError: () => toast.error('Delete failed'),
  });

  const handleDelete = (id) => {
    if (window.confirm('Delete this land record?')) {
      deleteMutation.mutate(id);
    }
  };

  const filtered = filterOwner ? lands.filter(l => String(l.landOwnerId) === String(filterOwner)) : lands;
  const filteredTotal = filtered.reduce((s, l) => s + parseFloat(l.totalAmount || 0), 0);
  const filteredUnits = filtered.reduce((s, l) => s + parseInt(l.convertedUnits || 0), 0);

  return (
    <div style={{ padding: '16px' }}>
      {/* Filter + Add */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <Select value={filterOwner} onChange={e => setFOwner(e.target.value)} style={{ flex: 1 }}>
          <option value="">All Owners</option>
          {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </Select>
        {user.role === 'owner' && (
          <button onClick={openAdd} disabled={owners.length === 0}
            style={{ padding: '14px 20px', background: owners.length === 0 ? 'var(--surface2)' : 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', borderRadius: '12px', color: owners.length === 0 ? 'var(--text-muted)' : 'white', fontWeight: '700', fontSize: '15px', cursor: owners.length === 0 ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
            + Add Land
          </button>
        )}
      </div>

      {/* Totals bar */}
      {filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
          {[['Plots', filtered.length, 'var(--text)'], ['Units', filteredUnits, '#f59e0b'], ['Total', fmtShort(filteredTotal), '#10b981']].map(([l, v, c]) => (
            <div key={l} style={{ background: 'var(--surface)', borderRadius: '10px', padding: '10px', border: '1px solid var(--border)', textAlign: 'center' }}>
              <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{l}</p>
              <p style={{ margin: 0, fontWeight: '900', fontSize: '16px', color: c }}>{v}</p>
            </div>
          ))}
        </div>
      )}

      {owners.length === 0 && (
        <Card style={{ textAlign: 'center', padding: '24px' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>⚠️ Add land owners first before adding land records.</p>
        </Card>
      )}

      {filtered.length === 0 && owners.length > 0
        ? <Empty icon="🌾" text="No land records" hint="Tap + Add to record a land plot" />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(l => {
              const owner = owners.find(o => o.id === l.landOwnerId);
              return (
                <Card key={l.id} style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <p style={{ margin: '0 0 2px', fontWeight: '800', fontSize: '15px' }}>{owner?.name || '—'}</p>
                      {owner?.village && <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>📍 {owner.village}</p>}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <BtnSecondary style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => openEdit(l)}>✏️</BtnSecondary>
                      {user.role === 'admin' && (
                        <BtnDanger onClick={() => handleDelete(l.id)} disabled={deleteMutation.isLoading}>🗑️</BtnDanger>
                      )}
                    </div>
                  </div>

                  {/* Land + Units big display */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ background: 'var(--surface2)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Measurement</p>
                      <p style={{ margin: 0, fontWeight: '900', fontSize: '24px', color: '#b45309' }}>{fmtLand(l.landMeasurement)}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '18px' }}>→</span>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)' }}>0.20=1</span>
                    </div>
                    <div style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.15),rgba(217,119,6,0.15))', border: '1.5px solid rgba(245,158,11,0.4)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Units</p>
                      <p style={{ margin: 0, fontWeight: '900', fontSize: '24px', color: '#f59e0b' }}>{l.convertedUnits}</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>₹{Number(l.pricePerUnit || 0).toLocaleString('en-IN')} × {l.convertedUnits} units</span>
                    <span style={{ fontWeight: '900', fontSize: '20px', color: '#10b981' }}>{fmtShort(l.totalAmount)}</span>
                  </div>

                  {l.notes && <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>"{l.notes}"</p>}
                </Card>
              );
            })}
          </div>
        )}

      {showForm && (
        <Modal title={editLand ? '✏️ Edit Land Record' : '🌾 Add Land Records'} onClose={() => setShowForm(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <Label>Land Owner *</Label>
              <Select value={form.landOwnerId} onChange={e => setForm(f => ({ ...f, landOwnerId: e.target.value }))} disabled={!!editLand}>
                <option value="">— Select Owner —</option>
                {owners.map(o => <option key={o.id} value={o.id}>{o.name}{o.village ? ` (${o.village})` : ''}</option>)}
              </Select>
            </div>
            <div>
              <Label>Total Land Price (e.g., 3500)</Label>
              <Input type="number" min="0" placeholder="3500" value={form.total_land_price} onChange={e => setForm(f => ({ ...f, total_land_price: e.target.value }))} />
            </div>

            {form.total_land_price > 0 && (
                <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '10px', textAlign: 'center', border: '1px solid var(--border)' }}>
                    <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)' }}>CALCULATED UNIT PRICE (PRICE / 20)</p>
                    <p style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#b45309' }}>{fmtShort(parseFloat(form.total_land_price) / 20)}</p>
                </div>
            )}

            {form.items.map((item, index) => {
              const unitPrice = parseFloat(form.total_land_price || 0) / 20;
              const convertedUnits = convertLandMeasurementToUnits(item.land_measurement);
              const finalAmount = convertedUnits * unitPrice;
              return (
                <Card key={item.id} style={{ background: 'var(--surface2)', border: '1px dashed var(--border)', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <Label>Land #{index + 1}</Label>
                    {form.items.length > 1 && !editLand && (
                      <BtnDanger onClick={() => removeLandItem(item.id)} style={{ padding: '4px 8px', fontSize: '11px' }}>✕ Remove</BtnDanger>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <Label>Land Measurement (e.g. 1.25)</Label>
                      <Input type="number" step="0.01" min="0" placeholder="1.25" value={item.land_measurement} onChange={e => handleItemChange(item.id, 'land_measurement', e.target.value)} />
                    </div>
                    {item.land_measurement && (
                      <div style={{ background: 'var(--surface)', borderRadius: '10px', padding: '10px', display: 'flex', justifyContent: 'space-around', alignItems: 'center', border: '1px solid var(--border)' }}>
                        <div style={{ textAlign: 'center' }}><p style={{ margin: 0, fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)' }}>ENTERED</p><p style={{ margin: '2px 0 0', fontWeight: '800', fontSize: '18px', color: '#b45309' }}>{fmtLand(item.land_measurement)}</p></div>
                        <span style={{ fontSize: '18px' }}>→</span>
                        <div style={{ textAlign: 'center' }}><p style={{ margin: 0, fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)' }}>CONVERTED UNITS</p><p style={{ margin: '2px 0 0', fontWeight: '800', fontSize: '22px', color: '#f59e0b' }}>{convertedUnits}</p></div>
                      </div>
                    )}
                    {finalAmount > 0 && (
                      <div style={{ background: 'var(--surface)', borderRadius: '10px', padding: '10px', textAlign: 'center', border: '1px solid var(--border)' }}>
                        <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)' }}>FINAL AMOUNT</p>
                        <p style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#10b981' }}>{fmtShort(finalAmount)}</p>
                      </div>
                    )}
                    <div><Label>Notes</Label><Input placeholder="Optional" value={item.notes} onChange={e => handleItemChange(item.id, 'notes', e.target.value)} /></div>
                  </div>
                </Card>
              );
            })}

            {!editLand && (
              <BtnSecondary onClick={addLandItem} style={{ width: '100%' }}>+ Add More Land</BtnSecondary>
            )}

            <BtnPrimary onClick={handleSave} disabled={singleMutation.isLoading || bulkMutation.isLoading}>
              {singleMutation.isLoading || bulkMutation.isLoading ? '⏳ Saving...' : (editLand ? '💾 Update Record' : `💾 Save ${form.items.length} Record(s)`)}
            </BtnPrimary>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PAYMENTS PAGE
// ═══════════════════════════════════════════════════════════
function PaymentsPage({ data, onRefresh, user }) {
  const { owners, lands, payments } = data;
  const [showForm, setShowForm]   = useState(false);
  const [editPayment, setEditPayment] = useState(null);
  const [filterOwner, setFOwner]  = useState('');
  const [form, setForm]           = useState({ landOwnerId: '', date: todayStr(), amount_paid: '', payment_method: 'Cash', notes: '' });
  const METHODS = ['Cash', 'UPI', 'Bank Transfer'];
  const methodColor = { Cash: '#10b981', UPI: '#0ea5e9', 'Bank Transfer': '#a855f7' };

  const ownerSummaries = owners.map(o => {
    const oL   = lands.filter(l => l.landOwnerId === o.id);
    const oP   = payments.filter(p => p.landOwnerId === o.id);
    const amt  = oL.reduce((s, l) => s + parseFloat(l.totalAmount || 0), 0);
    const paid = oP.reduce((s, p) => s + parseFloat(p.amountPaid || 0), 0);
    return { ...o, amt, paid, remaining: amt - paid };
  }).filter(o => o.amt > 0);

  const openAdd = () => {
    setForm({ landOwnerId: ownerSummaries[0]?.id || '', date: todayStr(), amount_paid: '', payment_method: 'Cash', notes: '' });
    setEditPayment(null);
    setShowForm(true);
  };

  const openEdit = (p) => {
    setForm({
      landOwnerId: p.landOwnerId,
      date: p.date,
      amount_paid: p.amountPaid,
      payment_method: p.payment_method,
      notes: p.notes || ''
    });
    setEditPayment(p);
    setShowForm(true);
  };

  const mutation = useMutation({
    mutationFn: (paymentData) => editPayment
      ? api.put(`/tenants/payments/${editPayment.id}`, paymentData.payload)
      : api.post('/tenants/payments', paymentData.payload),
    onSuccess: () => {
      toast.success(editPayment ? 'Payment updated!' : 'Payment recorded!');
      setShowForm(false);
      setEditPayment(null);
      onRefresh();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Save failed'),
  });

  const handleSave = () => {
    if (!form.landOwnerId)                               return toast.error('Select a land owner');
    if (!form.amount_paid || parseFloat(form.amount_paid) <= 0) return toast.error('Enter valid amount');
    if (!form.date)                                        return toast.error('Select a date');
    // Construct a clean payload for the API, mapping frontend's camelCase to backend's expected snake_case.
    const payload = {
      land_owner_id: form.landOwnerId,
      date: form.date,
      amount_paid: form.amount_paid,
      payment_method: form.payment_method,
      notes: form.notes,
    };
    mutation.mutate({ payload });
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/tenants/payments/${id}`),
    onSuccess: () => { toast.success('Deleted'); onRefresh(); },
    onError: () => toast.error('Delete failed'),
  });

  const handleDelete = (id) => {
    if (window.confirm('Delete this payment?')) {
      deleteMutation.mutate(id);
    }
  };

  const filteredPayments = filterOwner ? payments.filter(p => String(p.landOwnerId) === String(filterOwner)) : payments;

  return (
    <div style={{ padding: '16px' }}>
      {/* Filter + Add */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <Select value={filterOwner} onChange={e => setFOwner(e.target.value)} style={{ flex: 1 }}>
          <option value="">All Owners</option>
          {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </Select>
        {user.role === 'owner' && (
          <button onClick={openAdd} disabled={ownerSummaries.length === 0}
            style={{ padding: '12px 18px', background: ownerSummaries.length === 0 ? 'var(--surface2)' : 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', borderRadius: '12px', color: ownerSummaries.length === 0 ? 'var(--text-muted)' : 'white', fontWeight: '700', fontSize: '14px', cursor: ownerSummaries.length === 0 ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
            + Pay
          </button>
        )}
      </div>

      {/* Owner balance cards */}
      {ownerSummaries.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <SectionTitle>💰 Outstanding Balances</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {ownerSummaries.map(o => {
              const pct = o.amt > 0 ? Math.min(100, (o.paid / o.amt) * 100) : 0;
              return (
                <div key={o.id} style={{ background: 'var(--surface)', borderRadius: '14px', border: '1px solid var(--border)', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div>
                      <p style={{ margin: '0 0 2px', fontWeight: '800', fontSize: '14px' }}>{o.name}</p>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>Total: {fmtShort(o.amt)} · Paid: {fmtShort(o.paid)}</p>
                    </div>
                    <p style={{ margin: 0, fontWeight: '900', fontSize: '16px', color: o.remaining > 0 ? '#ef4444' : '#10b981' }}>
                      {o.remaining > 0 ? fmtShort(o.remaining) : '✅ Clear'}
                    </p>
                  </div>
                  <ProgressBar pct={pct} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <SectionTitle>📋 Payment History</SectionTitle>

      {filteredPayments.length === 0
        ? <Empty icon="💸" text="No payments recorded" hint="Tap + Pay to record a payment" />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[...filteredPayments].sort((a, b) => b.date.localeCompare(a.date) || new Date(b.createdAt) - new Date(a.createdAt)).map(p => {
              const owner  = owners.find(o => o.id === p.landOwnerId);
              const mColor = methodColor[p.payment_method] || '#888';
              return (
                <Card key={p.id} style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ margin: '0 0 4px', fontWeight: '800', fontSize: '15px' }}>{owner?.name || '—'}</p>
                      <p style={{ margin: '0 0 6px', fontSize: '12px', color: 'var(--text-muted)' }}>📅 {fmtDate(p.date)}</p>
                      <span style={{ display: 'inline-block', background: `${mColor}22`, color: mColor, fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '6px' }}>{p.payment_method}</span>
                      {p.notes && <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>"{p.notes}"</p>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: '0 0 10px', fontWeight: '900', fontSize: '22px', color: '#10b981' }}>{fmtShort(p.amountPaid)}</p>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <BtnSecondary style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => openEdit(p)}>✏️</BtnSecondary>
                        {user.role === 'admin' && (
                          <BtnDanger onClick={() => handleDelete(p.id)} disabled={deleteMutation.isLoading}>🗑️</BtnDanger>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      {showForm && (
        <Modal title={editPayment ? '✏️ Edit Payment' : '💰 Record Payment'} onClose={() => setShowForm(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <Label>Land Owner *</Label>
              <Select value={form.landOwnerId} onChange={e => setForm(f => ({ ...f, landOwnerId: e.target.value }))}>
                <option value="">— Select Owner —</option>
                {ownerSummaries.map(o => <option key={o.id} value={o.id}>{o.name} — Due: {fmtShort(o.remaining)}</option>)}
              </Select>
            </div>

            {form.landOwnerId && (() => {
              const os = ownerSummaries.find(o => String(o.id) === String(form.landOwnerId));
              return os && os.remaining > 0 ? (
                <div style={{ background: '#fee2e2', borderRadius: '10px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#ef4444' }}>Remaining Balance</span>
                  <span style={{ fontSize: '18px', fontWeight: '900', color: '#ef4444' }}>{fmtShort(os.remaining)}</span>
                </div>
              ) : null;
            })()}

            <div><Label>Payment Date</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><Label>Amount Paid (₹) *</Label><Input type="number" min="1" placeholder="0" value={form.amount_paid} onChange={e => setForm(f => ({ ...f, amount_paid: e.target.value }))} /></div>

            <div>
              <Label>Payment Method</Label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {METHODS.map(m => (
                  <button key={m} onClick={() => setForm(f => ({ ...f, payment_method: m }))}
                    style={{ padding: '10px 6px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '12px', fontFamily: 'inherit', background: form.payment_method === m ? '#f59e0b' : 'var(--surface2)', color: form.payment_method === m ? 'white' : 'var(--text-muted)' }}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div><Label>Notes</Label><Input placeholder="Optional" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <BtnPrimary onClick={handleSave} disabled={mutation.isLoading}>
              {mutation.isLoading ? '⏳ Saving...' : (editPayment ? '💾 Update Payment' : '💾 Record Payment')}
            </BtnPrimary>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DETAILS PAGE (per-owner full breakdown)
// ═══════════════════════════════════════════════════════════
function DetailsPage({ data }) {
  const { owners, lands, payments } = data;
  const [selectedId, setSelectedId] = useState(null);

  if (selectedId) {
    const owner    = owners.find(o => o.id === selectedId);
    const oLands   = lands.filter(l => l.landOwnerId === selectedId);
    const oPays    = payments.filter(p => p.landOwnerId === selectedId);
    const totalM   = oLands.reduce((s, l) => s + parseFloat(l.landMeasurement || 0), 0);
    const totalU   = oLands.reduce((s, l) => s + parseInt(l.convertedUnits || 0), 0);
    const totalAmt = oLands.reduce((s, l) => s + parseFloat(l.totalAmount || 0), 0);
    const totalP   = oPays.reduce((s, p) => s + parseFloat(p.amountPaid || 0), 0);
    const rem      = totalAmt - totalP;
    const pct      = totalAmt > 0 ? Math.min(100, (totalP / totalAmt) * 100) : 0;

    return (
      <div style={{ padding: '16px' }}>
        <button onClick={() => setSelectedId(null)} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 16px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '16px', fontSize: '14px' }}>← Back</button>

        {/* Owner hero */}
        <div style={{ background: 'linear-gradient(135deg,#78350f,#b45309,#f59e0b)', borderRadius: 'var(--radius)', padding: '20px', color: 'white', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '24px' }}>
              {owner?.name[0]?.toUpperCase()}
            </div>
            <div>
              <p style={{ margin: '0 0 2px', fontWeight: '900', fontSize: '20px' }}>{owner?.name}</p>
              {owner?.village && <p style={{ margin: 0, fontSize: '13px', opacity: 0.8 }}>📍 {owner.village}</p>}
              {owner?.phone   && <p style={{ margin: '2px 0 0', fontSize: '13px', opacity: 0.8 }}>📞 {owner.phone}</p>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[['Total Land', fmtLand(totalM)], ['Total Units', `${totalU} units`], ['Total Amount', fmtShort(totalAmt)], ['Remaining', fmtShort(rem)]].map(([l, v]) => (
              <div key={l} style={{ background: 'rgba(255,255,255,0.18)', borderRadius: '10px', padding: '10px' }}>
                <p style={{ margin: '0 0 2px', fontSize: '10px', opacity: 0.8, fontWeight: '700', textTransform: 'uppercase' }}>{l}</p>
                <p style={{ margin: 0, fontWeight: '900', fontSize: '16px' }}>{v}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>
              <span>Payment Progress</span><span>{pct.toFixed(0)}%</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: '99px', background: 'white', width: `${pct}%`, transition: 'width 0.5s' }} />
            </div>
          </div>
        </div>

        {/* Land Records */}
        {oLands.length > 0 && (
          <>
            <SectionTitle>🌾 Land Records ({oLands.length})</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {oLands.map(l => (
                <div key={l.id} style={{ background: 'var(--surface2)', borderRadius: '12px', padding: '12px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontWeight: '900', fontSize: '22px', color: '#b45309' }}>{fmtLand(l.landMeasurement)}</span>
                      <span style={{ fontSize: '16px', color: 'var(--text-muted)' }}>→</span>
                      <div style={{ background: 'rgba(245,158,11,0.15)', border: '1.5px solid rgba(245,158,11,0.4)', borderRadius: '8px', padding: '4px 12px' }}>
                        <span style={{ fontWeight: '900', fontSize: '18px', color: '#f59e0b' }}>{l.convertedUnits}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '4px' }}>units</span>
                      </div>
                    </div>
                    <span style={{ fontWeight: '900', fontSize: '16px', color: '#10b981' }}>{fmtShort(l.totalAmount)}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>₹{Number(l.pricePerUnit || 0).toLocaleString('en-IN')} per unit{l.notes ? ` · "${l.notes}"` : ''}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Payment History */}
        {oPays.length > 0 && (
          <>
            <SectionTitle>💸 Payment History ({oPays.length})</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[...oPays].sort((a, b) => b.date.localeCompare(a.date)).map(p => (
                <div key={p.id} style={{ background: 'var(--surface2)', borderRadius: '12px', padding: '12px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: '0 0 2px', fontWeight: '700', fontSize: '13px' }}>{fmtDate(p.date)}</p>
                    <span style={{ fontSize: '11px', fontWeight: '700', background: '#dcfce7', color: '#10b981', padding: '2px 8px', borderRadius: '6px' }}>{p.payment_method}</span>
                    {p.notes && <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>{p.notes}</p>}
                  </div>
                  <span style={{ fontWeight: '900', fontSize: '20px', color: '#10b981' }}>{fmtShort(p.amountPaid)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // Owner list
  return (
    <div style={{ padding: '16px' }}>
      <SectionTitle>📋 Owner-wise Details</SectionTitle>
      {owners.length === 0
        ? <Empty icon="📋" text="No owners yet" hint="Add land owners to view their details here" />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {owners.map(o => {
              const oL   = lands.filter(l => l.landOwnerId === o.id);
              const oP   = payments.filter(p => p.landOwnerId === o.id);
              const totalM = oL.reduce((s, l) => s + parseFloat(l.landMeasurement || 0), 0);
              const totalU = oL.reduce((s, l) => s + parseInt(l.convertedUnits || 0), 0);
              const amt  = oL.reduce((s, l) => s + parseFloat(l.totalAmount || 0), 0);
              const paid = oP.reduce((s, p) => s + parseFloat(p.amountPaid || 0), 0);
              const rem  = amt - paid;
              const pct  = amt > 0 ? Math.min(100, (paid / amt) * 100) : 0;

              return (
                <div key={o.id} onClick={() => setSelectedId(o.id)}
                  style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '16px', cursor: 'pointer', boxShadow: 'var(--shadow)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg,#f59e0b,#d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '900', fontSize: '18px', flexShrink: 0 }}>
                        {o.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p style={{ margin: '0 0 2px', fontWeight: '800', fontSize: '15px' }}>{o.name}</p>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                          {o.village && `📍 ${o.village} · `}{oL.length} plot{oL.length !== 1 ? 's' : ''} · {totalU} units · {fmtLand(totalM)}
                        </p>
                      </div>
                    </div>
                    <span style={{ fontSize: '16px', color: 'var(--text-muted)' }}>›</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '10px' }}>
                    {[['Total', fmtShort(amt), 'var(--text)'], ['Paid', fmtShort(paid), '#10b981'], ['Due', fmtShort(rem), rem > 0 ? '#ef4444' : '#10b981']].map(([l, v, c]) => (
                      <div key={l} style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                        <p style={{ margin: '0 0 2px', fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{l}</p>
                        <p style={{ margin: 0, fontWeight: '900', fontSize: '13px', color: c }}>{v}</p>
                      </div>
                    ))}
                  </div>

                  <ProgressBar pct={pct} />
                  <p style={{ margin: '4px 0 0', fontSize: '10px', color: 'var(--text-muted)', textAlign: 'right' }}>{pct.toFixed(0)}% paid</p>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}