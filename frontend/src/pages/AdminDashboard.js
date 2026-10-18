import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { getTodayDate, formatCurrency } from '../utils/helpers';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const isOwnerActive = (activeStatus) => activeStatus === true || activeStatus === 'true' || activeStatus === 1 || activeStatus === '1';

// ─── REUSABLE MODERN MODAL SHELL ─────────────────────────────────────────────
function ModernModal({ title, subtitle, icon, onClose, children }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
        boxSizing: 'border-box',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: '20px',
          padding: '24px',
          width: '100%',
          maxWidth: '480px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid var(--border)',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {icon && (
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                {icon}
              </div>
            )}
            <div>
              <h3 style={{ margin: 0, fontWeight: '800', fontSize: '18px', color: 'var(--text)', lineHeight: 1.2 }}>{title}</h3>
              {subtitle && <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--surface2)',
              border: 'none',
              borderRadius: '10px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: '16px',
              fontWeight: '700',
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── MODAL ACTIONS ────────────────────────────────────────────────────────────
function ModalActions({ onClose, onSave, isLoading, saveText = 'Save Changes' }) {
  return (
    <div style={{ display: 'flex', gap: '10px', marginTop: '22px' }}>
      <button
        type="button"
        onClick={onClose}
        style={{
          flex: 1,
          padding: '12px',
          background: 'var(--surface2)',
          border: '1.5px solid var(--border)',
          borderRadius: '12px',
          fontWeight: '700',
          cursor: 'pointer',
          color: 'var(--text)',
          fontFamily: 'inherit',
          fontSize: '14px',
        }}
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={isLoading}
        style={{
          flex: 1,
          padding: '12px',
          background: 'var(--gradient-primary, linear-gradient(135deg, #6366f1, #8b5cf6))',
          border: 'none',
          borderRadius: '12px',
          color: 'white',
          fontWeight: '700',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.7 : 1,
          fontFamily: 'inherit',
          fontSize: '14px',
          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
        }}
      >
        {isLoading ? '⏳ Saving...' : `✓ ${saveText}`}
      </button>
    </div>
  );
}

const modalInputStyle = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: '10px',
  border: '1.5px solid var(--border)',
  background: 'var(--surface2)',
  color: 'var(--text)',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 0.2s',
};

const modalLabelStyle = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '12px',
  fontWeight: '700',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

// ─── MAIN ADMIN DASHBOARD ─────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  // Create Owner Modal State
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', username: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);

  // Create Admin Modal State
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminForm, setAdminForm] = useState({ name: '', email: '' });

  // Filters & Search
  const [ownerSearch, setOwnerSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'

  // Password reset inline state
  const [resetPwd, setResetPwd] = useState({});
  const [showResetPwd, setShowResetPwd] = useState({});

  // Active Management Panel
  const [activeOwner, setActiveOwner] = useState(null); // { id, view: 'labours' | 'daily' | 'tenants' | 'fertilizer' | 'diesel' }
  const [attendanceDate, setAttendanceDate] = useState(getTodayDate());
  const [labourSearch, setLabourSearch] = useState('');

  // Modals for editing
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [editingLandRecord, setEditingLandRecord] = useState(null);
  const [editingLandPayment, setEditingLandPayment] = useState(null);
  const [editingDailySummary, setEditingDailySummary] = useState(null);
  const [editingDailyPayment, setEditingDailyPayment] = useState(null);
  const [editingLabour, setEditingLabour] = useState(null);
  const [editingLandOwner, setEditingLandOwner] = useState(null);
  const [editingShopkeeper, setEditingShopkeeper] = useState(null);
  const [editingDieselPump, setEditingDieselPump] = useState(null);
  const [editingDieselPurchase, setEditingDieselPurchase] = useState(null);
  const [editingDieselPayment, setEditingDieselPayment] = useState(null);

  // Fetch Owners List
  const fetchOwners = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/owners');
      setOwners(data);
    } catch (e) {
      toast.error('Failed to load owner accounts');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOwners();
  }, []);

  // Queries for Active Owner data
  const { data: labours = [], isLoading: loadingLabours } = useQuery({
    queryKey: ['adminLabours', activeOwner?.id, attendanceDate],
    queryFn: () => api.get(`/labour?ownerId=${activeOwner.id}&date=${attendanceDate}`).then(res => res.data),
    enabled: !!activeOwner && activeOwner.view === 'labours',
    onError: () => toast.error('Failed to load labours.'),
  });

  const { data: tenantData, isLoading: loadingTenants, refetch: fetchTenantData } = useQuery({
    queryKey: ['adminTenantData', activeOwner?.id],
    queryFn: () => api.get(`/admin/tenants/data?ownerId=${activeOwner.id}`).then(res => res.data),
    enabled: !!activeOwner && activeOwner.view === 'tenants',
    onError: () => toast.error('Failed to load tenant data.'),
  });

  const { data: fertilizerData, isLoading: loadingFertilizer, refetch: fetchFertilizerData } = useQuery({
    queryKey: ['adminFertilizerData', activeOwner?.id],
    queryFn: () => api.get(`/admin/fertilizer/data?ownerId=${activeOwner.id}`).then(res => res.data),
    enabled: !!activeOwner && activeOwner.view === 'fertilizer',
    onError: () => toast.error('Failed to load fertilizer data.'),
  });

  const { data: dieselData, isLoading: loadingDiesel, refetch: fetchDieselData } = useQuery({
    queryKey: ['adminDieselData', activeOwner?.id],
    queryFn: () => api.get(`/admin/diesel/data?ownerId=${activeOwner.id}`).then(res => res.data),
    enabled: !!activeOwner && activeOwner.view === 'diesel',
    onError: () => toast.error('Failed to load diesel data.'),
  });

  const { data: dailySummaryData, isLoading: loadingDailySummary, refetch: fetchDailySummaryData } = useQuery({
    queryKey: ['adminDailySummary', activeOwner?.id],
    queryFn: () => api.get(`/admin/daily-summary/data?ownerId=${activeOwner.id}`).then(res => res.data),
    enabled: !!activeOwner && activeOwner.view === 'daily',
    onError: () => toast.error('Failed to load daily summary data.'),
  });

  const handleManageToggle = (ownerId) => {
    if (activeOwner && activeOwner.id === ownerId) {
      setActiveOwner(null);
    } else {
      setActiveOwner({ id: ownerId, view: 'labours' });
      setLabourSearch('');
    }
  };

  const setManageView = (view) => {
    setActiveOwner(prev => ({ ...prev, view }));
  };

  const handleDateChange = (date) => {
    setAttendanceDate(date);
  };

  const createOwner = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.username.trim() || !form.password.trim()) {
      return toast.error('Please fill in all fields');
    }
    setCreating(true);
    try {
      await api.post('/admin/owners', form);
      toast.success('Owner account created successfully!');
      setForm({ name: '', username: '', password: '' });
      setShowForm(false);
      fetchOwners();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to create owner');
    }
    setCreating(false);
  };

  const createAdminMutation = useMutation({
    mutationFn: (data) => api.post('/admin/admins', data),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Admin created!');
      setShowAdminForm(false);
      setAdminForm({ name: '', email: '' });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to create admin'),
  });

  const handleCreateAdmin = (e) => {
    e.preventDefault();
    if (!adminForm.name.trim() || !adminForm.email.trim()) {
      return toast.error('Please enter name and email');
    }
    createAdminMutation.mutate(adminForm);
  };

  const toggleStatus = async (id) => {
    try {
      const { data } = await api.put(`/admin/owners/${id}/toggle-status`);
      toast.success(data.message || 'Status updated');
      fetchOwners();
    } catch (e) {
      toast.error('Failed to update status');
    }
  };

  const handleResetPwd = async (id) => {
    const pwd = resetPwd[id];
    if (!pwd || !pwd.trim()) return toast.error('Please enter a new password');
    try {
      await api.put(`/admin/owners/${id}/reset-password`, { password: pwd });
      toast.success('Password reset successfully!');
      setResetPwd(p => ({ ...p, [id]: '' }));
      setShowResetPwd(p => ({ ...p, [id]: false }));
    } catch (e) {
      toast.error('Failed to reset password');
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`, { icon: '📋' });
  };

  const deleteOwner = async (id, name) => {
    if (!window.confirm(`⚠️ Permanently delete owner "${name}" and ALL their associated data (labours, tenants, fertilizer, diesel)? This cannot be undone.`)) return;
    try {
      const res = await api.delete(`/admin/owners/${id}`);
      toast.success(res.data.message || 'Owner and all data deleted.');
      fetchOwners();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to delete owner');
    }
  };

  // Labour Mutations
  const deactivateLabourMutation = useMutation({
    mutationFn: (id) => api.delete(`/labour/${id}`),
    onSuccess: () => {
      toast.success('Labour deactivated');
      queryClient.invalidateQueries({ queryKey: ['adminLabours', activeOwner?.id] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to deactivate labour'),
  });

  const deleteLabour = (id) => {
    if (!window.confirm('Deactivate this labour? They will be hidden from view but their history will be kept.')) return;
    deactivateLabourMutation.mutate(id);
  };

  const reactivateLabourMutation = useMutation({
    mutationFn: (id) => api.put(`/labour/${id}/reactivate`),
    onSuccess: () => {
      toast.success('Labour reactivated');
      queryClient.invalidateQueries({ queryKey: ['adminLabours', activeOwner?.id] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to reactivate labour'),
  });

  const permanentDeleteLabourMutation = useMutation({
    mutationFn: (id) => api.delete(`/labour/${id}/permanent`),
    onSuccess: () => {
      toast.success('Labour permanently deleted');
      queryClient.invalidateQueries({ queryKey: ['adminLabours', activeOwner?.id] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete labour'),
  });

  const handleReactivate = (id) => {
    reactivateLabourMutation.mutate(id);
  };

  const handlePermanentDelete = (id) => {
    if (window.confirm('This action is permanent and cannot be undone. Are you sure you want to delete this labourer and all their records?')) {
      permanentDeleteLabourMutation.mutate(id);
    }
  };

  const adminAttendanceMutation = useMutation({
    mutationFn: (variables) => api.put('/labour/attendance/admin', variables),
    onSuccess: () => {
      toast.success('Attendance updated!');
      queryClient.invalidateQueries({ queryKey: ['adminLabours', activeOwner?.id, attendanceDate] });
    },
    onError: () => toast.error('Failed to update attendance.'),
  });

  const handleAttendanceChange = (labour, field, value) => {
    adminAttendanceMutation.mutate({
      labourId: labour.id,
      date: attendanceDate,
      attendance: field === 'attendance' ? value : labour.attendance,
      dailyWage: field === 'dailyWage' ? value : (labour.dailyWage || 0),
      amountPaidToday: field === 'amountPaidToday' ? value : (labour.amountPaidToday || 0)
    });
  };

  const updateLabourMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/labour/${id}`, data),
    onSuccess: () => {
      toast.success('Labour updated!');
      queryClient.invalidateQueries({ queryKey: ['adminLabours', activeOwner?.id, attendanceDate] });
      setEditingLabour(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update labour'),
  });

  // Tenant / Land Owner Mutations
  const deletePaymentMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/tenants/payments/${id}`),
    onSuccess: () => {
      toast.success('Payment deleted');
      fetchTenantData();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete payment'),
  });

  const deleteLandOwnerMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/tenants/owners/${id}`),
    onSuccess: () => {
      toast.success('Land Owner deleted');
      fetchTenantData();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete land owner'),
  });

  const updateLandOwnerMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/admin/tenants/owners/${id}`, data),
    onSuccess: () => {
      toast.success('Land owner updated!');
      fetchTenantData();
      setEditingLandOwner(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update land owner'),
  });

  const deleteLandRecordMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/tenants/lands/${id}`),
    onSuccess: () => {
      toast.success('Land Record deleted');
      fetchTenantData();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete'),
  });

  const updateLandRecordMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/admin/tenants/lands/${id}`, data),
    onSuccess: () => {
      toast.success('Land record updated!');
      fetchTenantData();
      setEditingLandRecord(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update record'),
  });

  const updateLandPaymentMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/admin/tenants/payments/${id}`, data),
    onSuccess: () => {
      toast.success('Land payment updated!');
      fetchTenantData();
      setEditingLandPayment(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update payment'),
  });

  // Fertilizer Mutations
  const deleteFertilizerShopkeeperMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/fertilizer/shopkeepers/${id}`),
    onSuccess: () => {
      toast.success('Shopkeeper deleted');
      fetchFertilizerData();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete shopkeeper'),
  });

  const updateFertilizerShopkeeperMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/admin/fertilizer/shopkeepers/${id}`, data),
    onSuccess: () => {
      toast.success('Shopkeeper updated!');
      fetchFertilizerData();
      setEditingShopkeeper(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update shopkeeper'),
  });

  const deleteFertilizerPurchaseMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/fertilizer/purchases/${id}`),
    onSuccess: () => {
      toast.success('Purchase deleted');
      fetchFertilizerData();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete purchase'),
  });

  const deleteFertilizerPaymentMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/fertilizer/payments/${id}`),
    onSuccess: () => {
      toast.success('Payment deleted');
      fetchFertilizerData();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete payment'),
  });

  const updatePurchaseMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/admin/fertilizer/purchases/${id}`, data),
    onSuccess: () => {
      toast.success('Purchase updated!');
      fetchFertilizerData();
      setEditingPurchase(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update purchase'),
  });

  const updatePaymentMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/admin/fertilizer/payments/${id}`, data),
    onSuccess: () => {
      toast.success('Payment updated!');
      fetchFertilizerData();
      setEditingPayment(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update payment'),
  });

  // Diesel Mutations
  const updateDieselPurchaseMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/admin/diesel/purchases/${id}`, data),
    onSuccess: () => {
      toast.success('Diesel purchase updated!');
      fetchDieselData();
      setEditingDieselPurchase(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update purchase'),
  });

  const updateDieselPaymentMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/admin/diesel/payments/${id}`, data),
    onSuccess: () => {
      toast.success('Diesel payment updated!');
      fetchDieselData();
      setEditingDieselPayment(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update payment'),
  });

  const deleteDieselPumpMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/diesel/pumps/${id}`),
    onSuccess: () => {
      toast.success('Pump deleted');
      fetchDieselData();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete pump'),
  });

  const updateDieselPumpMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/admin/diesel/pumps/${id}`, data),
    onSuccess: () => {
      toast.success('Pump updated!');
      fetchDieselData();
      setEditingDieselPump(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update pump'),
  });

  const deleteDieselPurchaseMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/diesel/purchases/${id}`),
    onSuccess: () => {
      toast.success('Purchase deleted');
      fetchDieselData();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete purchase'),
  });

  const deleteDieselPaymentMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/diesel/payments/${id}`),
    onSuccess: () => {
      toast.success('Payment deleted');
      fetchDieselData();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete payment'),
  });

  // Daily Summary Mutations
  const updateDailySummaryMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/admin/daily-summary/${id}`, data),
    onSuccess: () => {
      toast.success('Daily summary updated!');
      fetchDailySummaryData();
      setEditingDailySummary(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update summary'),
  });

  const deleteDailySummaryMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/daily-summary/${id}`),
    onSuccess: () => {
      toast.success('Daily summary deleted');
      fetchDailySummaryData();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete summary'),
  });

  const createDailyPaymentMutation = useMutation({
    mutationFn: (data) => api.post('/admin/daily-summary/payments', data),
    onSuccess: () => {
      toast.success('Daily worker payment added!');
      fetchDailySummaryData();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to add payment'),
  });

  const updateDailyPaymentMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/admin/daily-summary/payments/${id}`, data),
    onSuccess: () => {
      toast.success('Daily worker payment updated!');
      fetchDailySummaryData();
      setEditingDailyPayment(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update payment'),
  });

  const deleteDailyPaymentMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/daily-summary/payments/${id}`),
    onSuccess: () => {
      toast.success('Daily worker payment deleted');
      fetchDailySummaryData();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete payment'),
  });

  // Filtered Owners Calculation
  const { totalCount, activeCount, inactiveCount, filteredOwners } = useMemo(() => {
    const total = owners.length;
    let active = 0;
    let inactive = 0;

    owners.forEach(o => {
      if (isOwnerActive(o.activeStatus)) active++;
      else inactive++;
    });

    const filtered = owners.filter(o => {
      const matchesSearch = (o.name || '').toLowerCase().includes(ownerSearch.toLowerCase()) ||
                            (o.username || '').toLowerCase().includes(ownerSearch.toLowerCase());
      if (!matchesSearch) return false;

      const isActive = isOwnerActive(o.activeStatus);
      if (statusFilter === 'active') return isActive;
      if (statusFilter === 'inactive') return !isActive;
      return true;
    });

    return { totalCount: total, activeCount: active, inactiveCount: inactive, filteredOwners: filtered };
  }, [owners, ownerSearch, statusFilter]);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', boxSizing: 'border-box' }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 className="page-title" style={{ margin: 0, fontSize: '24px', fontWeight: '900', letterSpacing: '-0.02em' }}>
              Owner Accounts
            </h2>
            <span style={{ background: 'var(--surface2)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: '800' }}>
              Admin Panel
            </span>
          </div>
          <p className="page-subtitle" style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
            Manage business owners, credentials, access status, and branch operations
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowForm(true)}
            style={{
              padding: '10px 18px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontWeight: '700',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '14px',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>+</span> New Owner
          </button>
        </div>
      </div>

      {/* ── SEARCH & FILTER CONTROLS ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        {/* Search bar */}
        <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
          <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', color: 'var(--text-muted)', pointerEvents: 'none' }}>
            🔍
          </span>
          <input
            type="text"
            placeholder="Search owners by name or username..."
            value={ownerSearch}
            onChange={e => setOwnerSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '11px 38px 11px 40px',
              borderRadius: '12px',
              border: '1.5px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: '14px',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
          {ownerSearch && (
            <button
              onClick={() => setOwnerSearch('')}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontWeight: '700',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Filter Chips */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--surface2)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          {[
            { id: 'all', label: `All (${totalCount})` },
            { id: 'active', label: `Active (${activeCount})` },
            { id: 'inactive', label: `Inactive (${inactiveCount})` }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '12px',
                fontWeight: '700',
                transition: 'all 0.2s',
                background: statusFilter === f.id ? 'var(--surface)' : 'transparent',
                color: statusFilter === f.id ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: statusFilter === f.id ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── OWNERS LIST ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ width: '32px', height: '32px', margin: '0 auto 16px' }} />
          <p style={{ fontWeight: '600', fontSize: '14px' }}>Loading owner accounts…</p>
        </div>
      ) : filteredOwners.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>👤</div>
          <h3 style={{ margin: '0 0 6px', fontWeight: '800' }}>
            {ownerSearch || statusFilter !== 'all' ? 'No owners found' : 'No owners registered yet'}
          </h3>
          <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
            {ownerSearch ? 'Try adjusting your search query or status filter.' : 'Click "+ New Owner" above to create the first owner account.'}
          </p>
          {(ownerSearch || statusFilter !== 'all') && (
            <button
              onClick={() => { setOwnerSearch(''); setStatusFilter('all'); }}
              style={{ padding: '8px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', color: 'var(--text)' }}
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredOwners.map(owner => {
            const ownerActive = isOwnerActive(owner.activeStatus);
            const isManageOpen = activeOwner?.id === owner.id;
            const isResetOpen = showResetPwd[owner.id];

            return (
              <div
                key={owner.id}
                className="card"
                style={{
                  padding: '20px',
                  transition: 'all 0.2s ease',
                  border: isManageOpen ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                  boxShadow: isManageOpen ? '0 10px 25px -5px rgba(99, 102, 241, 0.15)' : 'var(--shadow)',
                }}
              >
                {/* Top Row: Info & Badges */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '14px',
                        background: ownerActive ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'linear-gradient(135deg, #94a3b8, #64748b)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: '900',
                        fontSize: '18px',
                        flexShrink: 0,
                        boxShadow: ownerActive ? '0 4px 12px rgba(99, 102, 241, 0.25)' : 'none',
                      }}
                    >
                      {(owner.name || owner.username)[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ margin: 0, fontWeight: '800', fontSize: '17px', color: 'var(--text)' }}>
                          {owner.name}
                        </h3>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          @{owner.username}
                        </span>
                        <button
                          onClick={() => copyToClipboard(owner.username, 'Username')}
                          title="Copy username"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            borderRadius: '4px',
                          }}
                        >
                          📋
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        background: ownerActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        color: ownerActive ? '#10b981' : '#ef4444',
                        fontSize: '12px',
                        fontWeight: '800',
                        padding: '4px 12px',
                        borderRadius: '99px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        border: `1px solid ${ownerActive ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                      }}
                    >
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: ownerActive ? '#10b981' : '#ef4444' }} />
                      {ownerActive ? 'Active Account' : 'Inactive'}
                    </span>
                  </div>
                </div>

                {/* Action Buttons Bar */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => toggleStatus(owner.id)}
                    style={{
                      flex: '1',
                      minWidth: '120px',
                      padding: '9px 14px',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontWeight: '700',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      background: ownerActive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                      color: ownerActive ? '#ef4444' : '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>{ownerActive ? '🔒' : '🔓'}</span>
                    <span>{ownerActive ? 'Deactivate' : 'Activate'}</span>
                  </button>

                  <button
                    onClick={() => setShowResetPwd(p => ({ ...p, [owner.id]: !p[owner.id] }))}
                    style={{
                      padding: '9px 14px',
                      background: 'var(--surface2)',
                      border: '1.5px solid var(--border)',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '700',
                      color: 'var(--text)',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>🔑</span>
                    <span>{isResetOpen ? 'Cancel' : 'Reset Password'}</span>
                  </button>

                  <button
                    onClick={() => deleteOwner(owner.id, owner.name)}
                    disabled={ownerActive}
                    title={ownerActive ? 'Deactivate account first before deleting' : 'Permanently delete owner and all records'}
                    style={{
                      padding: '9px 14px',
                      background: ownerActive ? 'var(--surface2)' : 'rgba(239, 68, 68, 0.1)',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: ownerActive ? 'not-allowed' : 'pointer',
                      color: ownerActive ? 'var(--text-muted)' : '#ef4444',
                      opacity: ownerActive ? 0.45 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>🗑️</span>
                    <span>Delete</span>
                  </button>

                  <button
                    onClick={() => handleManageToggle(owner.id)}
                    style={{
                      flex: '1.5',
                      minWidth: '160px',
                      padding: '9px 16px',
                      border: isManageOpen ? 'none' : '1.5px solid var(--border)',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontWeight: '800',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      background: isManageOpen ? 'var(--gradient-primary, linear-gradient(135deg, #6366f1, #8b5cf6))' : 'var(--surface2)',
                      color: isManageOpen ? 'white' : 'var(--text)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: isManageOpen ? '0 4px 12px rgba(99, 102, 241, 0.3)' : 'none',
                    }}
                  >
                    <span>{isManageOpen ? '▼' : '▶'}</span>
                    <span>{isManageOpen ? 'Close Management' : 'Manage Operations'}</span>
                  </button>
                </div>

                {/* Inline Reset Password Panel */}
                {isResetOpen && (
                  <div style={{ marginTop: '14px', padding: '14px', background: 'var(--surface2)', borderRadius: '12px', border: '1px solid var(--border)', animation: 'fadeIn 0.2s ease-out' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Set New Password for {owner.name} (@{owner.username})
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <input
                        type="password"
                        value={resetPwd[owner.id] || ''}
                        onChange={e => setResetPwd(p => ({ ...p, [owner.id]: e.target.value }))}
                        placeholder="Enter strong new password…"
                        style={{
                          flex: '1',
                          minWidth: '200px',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: '1.5px solid var(--border)',
                          background: 'var(--surface)',
                          color: 'var(--text)',
                          fontFamily: 'inherit',
                          fontSize: '14px',
                          outline: 'none',
                        }}
                      />
                      <button
                        onClick={() => handleResetPwd(owner.id)}
                        style={{
                          padding: '10px 18px',
                          background: 'var(--gradient-primary, linear-gradient(135deg, #6366f1, #8b5cf6))',
                          border: 'none',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '800',
                          color: 'white',
                          fontFamily: 'inherit',
                        }}
                      >
                        ✓ Save Password
                      </button>
                    </div>
                  </div>
                )}

                {/* ── EXPANDED TABBED OPERATIONS PANEL ── */}
                {isManageOpen && (
                  <div style={{ marginTop: '20px', background: 'var(--surface2)', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                    {/* Operation Tabs Navigation */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '6px 8px 0', overflowX: 'auto', gap: '4px', background: 'var(--surface)' }}>
                      {[
                        { id: 'labours', label: 'Labours & Attendance', icon: '👷' },
                        { id: 'daily', label: 'Daily Workers', icon: '🏗️' },
                        { id: 'groups', label: 'Work Groups', icon: '👥' },
                        { id: 'tenants', label: 'Land Tenants', icon: '👨‍🌾' },
                        { id: 'fertilizer', label: 'Fertilizer', icon: '🌿' },
                        { id: 'diesel', label: 'Diesel & Fuel', icon: '🚜' },
                      ].map(tab => {
                        const isActiveTab = activeOwner.view === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setManageView(tab.id)}
                            style={{
                              padding: '10px 14px',
                              border: 'none',
                              borderBottom: isActiveTab ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                              background: 'transparent',
                              cursor: 'pointer',
                              fontWeight: isActiveTab ? '800' : '600',
                              fontSize: '13px',
                              fontFamily: 'inherit',
                              color: isActiveTab ? 'var(--primary)' : 'var(--text-muted)',
                              flexShrink: 0,
                              whiteSpace: 'nowrap',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.2s',
                            }}
                          >
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Operation Tab Content */}
                    <div style={{ padding: '20px' }}>
                      {/* VIEW 1: LABOURS & ATTENDANCE */}
                      {activeOwner.view === 'labours' && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                            <div>
                              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text)' }}>
                                Labour Attendance & Wages
                              </h4>
                              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                                Managing attendance and payments for {owner.name}
                              </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                onClick={() => handleDateChange(getTodayDate())}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '8px',
                                  border: '1px solid var(--border)',
                                  background: attendanceDate === getTodayDate() ? 'var(--primary)' : 'var(--surface)',
                                  color: attendanceDate === getTodayDate() ? 'white' : 'var(--text)',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                }}
                              >
                                Today
                              </button>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                            <div>
                              <label style={modalLabelStyle}>Attendance Date</label>
                              <input
                                type="date"
                                value={attendanceDate}
                                onChange={e => handleDateChange(e.target.value)}
                                style={modalInputStyle}
                              />
                            </div>
                            <div>
                              <label style={modalLabelStyle}>Filter Labours</label>
                              <input
                                type="text"
                                placeholder="Search by name…"
                                value={labourSearch}
                                onChange={e => setLabourSearch(e.target.value)}
                                style={modalInputStyle}
                              />
                            </div>
                          </div>

                          {loadingLabours ? (
                            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                              <div className="spinner" style={{ width: '24px', height: '24px', margin: '0 auto 8px' }} />
                              <span style={{ fontSize: '13px' }}>Loading labours…</span>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {(() => {
                                const filteredLabours = labours.filter(l => (l.name || '').toLowerCase().includes(labourSearch.toLowerCase()));
                                if (filteredLabours.length === 0) {
                                  return (
                                    <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                      No labours found for this date.
                                    </div>
                                  );
                                }
                                return filteredLabours.map(labour => (
                                  <div
                                    key={labour.id}
                                    style={{
                                      background: 'var(--surface)',
                                      borderRadius: '12px',
                                      padding: '14px 16px',
                                      border: `1.5px solid ${labour.attendance === 'present' && labour.isActive ? 'rgba(16, 185, 129, 0.4)' : 'var(--border)'}`,
                                      boxShadow: 'var(--shadow-sm)',
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                      <div>
                                        <p style={{ margin: 0, fontWeight: '800', fontSize: '15px', color: 'var(--text)', textDecoration: labour.isActive ? 'none' : 'line-through' }}>
                                          {labour.name}
                                        </p>
                                        <p style={{ margin: '3px 0 0', fontSize: '11px', color: labour.isActive ? '#10b981' : '#ef4444', fontWeight: '800' }}>
                                          {labour.isActive ? '● Active Labour' : '○ Inactive'}
                                        </p>
                                      </div>
                                      <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                          onClick={() => setEditingLabour(labour)}
                                          style={{ padding: '6px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text)', fontWeight: '700', fontSize: '12px' }}
                                        >
                                          Edit
                                        </button>
                                        {labour.isActive ? (
                                          <button
                                            onClick={() => deleteLabour(labour.id)}
                                            disabled={deactivateLabourMutation.isPending}
                                            style={{ padding: '6px 12px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#ef4444', fontWeight: '700', fontSize: '12px' }}
                                          >
                                            Deactivate
                                          </button>
                                        ) : (
                                          <>
                                            <button
                                              onClick={() => handleReactivate(labour.id)}
                                              disabled={reactivateLabourMutation.isPending}
                                              style={{ padding: '6px 12px', background: 'rgba(16, 185, 129, 0.1)', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#10b981', fontWeight: '700', fontSize: '12px' }}
                                            >
                                              Activate
                                            </button>
                                            <button
                                              onClick={() => handlePermanentDelete(labour.id)}
                                              disabled={permanentDeleteLabourMutation.isPending}
                                              style={{ padding: '6px 12px', background: 'rgba(239, 68, 68, 0.15)', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#ef4444', fontWeight: '700', fontSize: '12px' }}
                                            >
                                              Delete
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    {labour.isActive && (
                                      <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                          {['present', 'absent'].map(status => {
                                            const isSelected = labour.attendance === status;
                                            return (
                                              <button
                                                key={status}
                                                onClick={() => handleAttendanceChange(labour, 'attendance', status)}
                                                style={{
                                                  flex: 1,
                                                  padding: '8px',
                                                  border: 'none',
                                                  borderRadius: '8px',
                                                  cursor: 'pointer',
                                                  fontWeight: '800',
                                                  fontSize: '12px',
                                                  fontFamily: 'inherit',
                                                  background: isSelected ? (status === 'present' ? '#10b981' : '#ef4444') : 'var(--surface2)',
                                                  color: isSelected ? 'white' : 'var(--text-muted)',
                                                }}
                                              >
                                                {status === 'present' ? '✓ Present' : '✕ Absent'}
                                              </button>
                                            );
                                          })}
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                          <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                              Daily Wage (₹)
                                            </label>
                                            <input
                                              type="number"
                                              defaultValue={labour.dailyWage}
                                              onBlur={e => handleAttendanceChange(labour, 'dailyWage', e.target.value)}
                                              placeholder="0"
                                              style={modalInputStyle}
                                            />
                                          </div>
                                          <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                              Paid Today (₹)
                                            </label>
                                            <input
                                              type="number"
                                              defaultValue={labour.amountPaidToday}
                                              onBlur={e => handleAttendanceChange(labour, 'amountPaidToday', e.target.value)}
                                              placeholder="0"
                                              style={modalInputStyle}
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ));
                              })()}
                            </div>
                          )}
                        </div>
                      )}

                      {/* VIEW 2: DAILY SUMMARY */}
                      {activeOwner.view === 'daily' && (
                        <DailySummaryManager
                          owner={owner}
                          dailySummaryData={dailySummaryData}
                          loading={loadingDailySummary}
                          onRefresh={fetchDailySummaryData}
                          onEdit={setEditingDailySummary}
                          onDelete={(id) => deleteDailySummaryMutation.mutate(id)}
                          onAddPayment={(data) => createDailyPaymentMutation.mutate(data)}
                          isAddingPayment={createDailyPaymentMutation.isPending}
                          onEditPayment={setEditingDailyPayment}
                          onDeletePayment={(id) => {
                            if (window.confirm('Delete this daily worker payment and restore the due amount?')) {
                              deleteDailyPaymentMutation.mutate(id);
                            }
                          }}
                        />
                      )}

                      {/* VIEW 2B: WORK GROUPS */}
                      {activeOwner.view === 'groups' && (
                        <WorkGroupsManager owner={owner} />
                      )}

                      {/* VIEW 3: TENANTS & LAND OWNERS */}
                      {activeOwner.view === 'tenants' && (
                        <TenantManager
                          owner={owner}
                          tenantData={tenantData}
                          loading={loadingTenants}
                          onDeleteLandOwner={(id) => deleteLandOwnerMutation.mutate(id)}
                          onEditLandOwner={setEditingLandOwner}
                          onEditLandRecord={setEditingLandRecord}
                          onDeleteLandRecord={(id) => deleteLandRecordMutation.mutate(id)}
                          onDeletePayment={(id) => deletePaymentMutation.mutate(id)}
                          onEditLandPayment={setEditingLandPayment}
                        />
                      )}

                      {/* VIEW 4: FERTILIZER */}
                      {activeOwner.view === 'fertilizer' && (
                        <FertilizerManager
                          owner={owner}
                          fertilizerData={fertilizerData}
                          loading={loadingFertilizer}
                          onDeleteShopkeeper={(id) => deleteFertilizerShopkeeperMutation.mutate(id)}
                          onEditShopkeeper={setEditingShopkeeper}
                          onDeletePurchase={(id) => deleteFertilizerPurchaseMutation.mutate(id)}
                          onDeletePayment={(id) => deleteFertilizerPaymentMutation.mutate(id)}
                          onEditPurchase={setEditingPurchase}
                          onEditPayment={setEditingPayment}
                        />
                      )}

                      {/* VIEW 5: DIESEL */}
                      {activeOwner.view === 'diesel' && (
                        <DieselManager
                          owner={owner}
                          dieselData={dieselData}
                          loading={loadingDiesel}
                          onDeletePump={(id) => deleteDieselPumpMutation.mutate(id)}
                          onEditPump={setEditingDieselPump}
                          onDeletePurchase={(id) => deleteDieselPurchaseMutation.mutate(id)}
                          onEditPurchase={setEditingDieselPurchase}
                          onDeletePayment={(id) => deleteDieselPaymentMutation.mutate(id)}
                          onEditPayment={setEditingDieselPayment}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL: CREATE OWNER ── */}
      {showForm && (
        <ModernModal
          title="Create Owner Account"
          subtitle="Generate new login credentials for a business owner"
          icon="👤"
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={createOwner} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={modalLabelStyle}>Full Name *</label>
              <input
                type="text"
                placeholder="e.g. Subrata Bala"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                style={modalInputStyle}
              />
            </div>
            <div>
              <label style={modalLabelStyle}>Username *</label>
              <input
                type="text"
                placeholder="e.g. subrata_farm"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s+/g, '') }))}
                required
                style={modalInputStyle}
              />
            </div>
            <div>
              <label style={modalLabelStyle}>Password *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showCreatePassword ? 'text' : 'password'}
                  placeholder="Set initial password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  style={{ ...modalInputStyle, paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword(p => !p)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  {showCreatePassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <ModalActions
              onClose={() => setShowForm(false)}
              onSave={createOwner}
              isLoading={creating}
              saveText="Create Account"
            />
          </form>
        </ModernModal>
      )}

      {/* ── ALL 12 EDIT MODALS ── */}
      {editingPurchase && (
        <PurchaseEditModal
          purchase={editingPurchase}
          shopkeepers={fertilizerData?.shopkeepers || []}
          onClose={() => setEditingPurchase(null)}
          onSave={(id, data) => updatePurchaseMutation.mutate({ id, data })}
          isLoading={updatePurchaseMutation.isPending}
        />
      )}

      {editingPayment && (
        <PaymentEditModal
          payment={editingPayment}
          shopkeepers={fertilizerData?.shopkeepers || []}
          onClose={() => setEditingPayment(null)}
          onSave={(id, data) => updatePaymentMutation.mutate({ id, data })}
          isLoading={updatePaymentMutation.isPending}
        />
      )}

      {editingLabour && (
        <LabourEditModal
          labour={editingLabour}
          onClose={() => setEditingLabour(null)}
          onSave={(id, data) => updateLabourMutation.mutate({ id, data })}
          isLoading={updateLabourMutation.isPending}
        />
      )}

      {editingLandOwner && (
        <LandOwnerEditModal
          landOwner={editingLandOwner}
          onClose={() => setEditingLandOwner(null)}
          onSave={(id, data) => updateLandOwnerMutation.mutate({ id, data })}
          isLoading={updateLandOwnerMutation.isPending}
        />
      )}

      {editingShopkeeper && (
        <ShopkeeperEditModal
          shopkeeper={editingShopkeeper}
          onClose={() => setEditingShopkeeper(null)}
          onSave={(id, data) => updateFertilizerShopkeeperMutation.mutate({ id, data })}
          isLoading={updateFertilizerShopkeeperMutation.isPending}
        />
      )}

      {editingLandRecord && (
        <LandRecordEditModal
          record={editingLandRecord}
          landOwners={tenantData?.owners || []}
          onClose={() => setEditingLandRecord(null)}
          onSave={(id, data) => updateLandRecordMutation.mutate({ id, data })}
          isLoading={updateLandRecordMutation.isPending}
        />
      )}

      {editingLandPayment && (
        <LandPaymentEditModal
          payment={editingLandPayment}
          landOwners={tenantData?.owners || []}
          onClose={() => setEditingLandPayment(null)}
          onSave={(id, data) => updateLandPaymentMutation.mutate({ id, data })}
          isLoading={updateLandPaymentMutation.isPending}
        />
      )}

      {editingDailySummary && (
        <DailySummaryEditModal
          summary={editingDailySummary}
          onClose={() => setEditingDailySummary(null)}
          onSave={(id, data) => updateDailySummaryMutation.mutate({ id, data })}
          isLoading={updateDailySummaryMutation.isPending}
        />
      )}

      {editingDailyPayment && (
        <DailyPaymentEditModal
          payment={editingDailyPayment}
          onClose={() => setEditingDailyPayment(null)}
          onSave={(id, data) => updateDailyPaymentMutation.mutate({ id, data })}
          isLoading={updateDailyPaymentMutation.isPending}
        />
      )}

      {editingDieselPump && (
        <DieselPumpEditModal
          pump={editingDieselPump}
          onClose={() => setEditingDieselPump(null)}
          onSave={(id, data) => updateDieselPumpMutation.mutate({ id, data })}
          isLoading={updateDieselPumpMutation.isPending}
        />
      )}

      {editingDieselPurchase && (
        <DieselPurchaseEditModal
          purchase={editingDieselPurchase}
          pumps={dieselData?.pumps || []}
          onClose={() => setEditingDieselPurchase(null)}
          onSave={(id, data) => updateDieselPurchaseMutation.mutate({ id, data })}
          isLoading={updateDieselPurchaseMutation.isPending}
        />
      )}

      {editingDieselPayment && (
        <DieselPaymentEditModal
          payment={editingDieselPayment}
          pumps={dieselData?.pumps || []}
          onClose={() => setEditingDieselPayment(null)}
          onSave={(id, data) => updateDieselPaymentMutation.mutate({ id, data })}
          isLoading={updateDieselPaymentMutation.isPending}
        />
      )}

      <div style={{ textAlign: 'center', padding: '30px 0 16px', fontSize: '12px', color: 'var(--text-faint)' }}>
        Developed by Subrata Bala
      </div>
    </div>
  );
}

// ─── EDIT MODAL COMPONENTS ───────────────────────────────────────────────────

function LabourEditModal({ labour, onClose, onSave, isLoading }) {
  const [form, setForm] = useState({ name: labour.name, isActive: !!labour.isActive });

  const handleSave = () => {
    if (!form.name.trim()) return toast.error('Labour name is required');
    onSave(labour.id, { ...form, name: form.name.trim() });
  };

  return (
    <ModernModal title="Edit Labour" icon="👷" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={modalLabelStyle}>Labour Name *</label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={modalInputStyle} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', color: 'var(--text)' }}>
          <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} style={{ width: '18px', height: '18px' }} />
          Active labour (show in attendance)
        </label>
      </div>
      <ModalActions onClose={onClose} onSave={handleSave} isLoading={isLoading} />
    </ModernModal>
  );
}

function LandOwnerEditModal({ landOwner, onClose, onSave, isLoading }) {
  const [form, setForm] = useState({
    name: landOwner.name || '',
    village: landOwner.village || '',
    phone: landOwner.phone || '',
    notes: landOwner.notes || '',
  });

  const handleSave = () => {
    if (!form.name.trim()) return toast.error('Land owner name is required');
    onSave(landOwner.id, { ...form, name: form.name.trim() });
  };

  return (
    <ModernModal title="Edit Land Owner" icon="👨‍🌾" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={modalLabelStyle}>Owner Name *</label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={modalInputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Village / Location</label>
          <input type="text" value={form.village} onChange={e => setForm(f => ({ ...f, village: e.target.value }))} style={modalInputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Phone Number</label>
          <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={modalInputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Notes</label>
          <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={modalInputStyle} />
        </div>
      </div>
      <ModalActions onClose={onClose} onSave={handleSave} isLoading={isLoading} />
    </ModernModal>
  );
}

function ShopkeeperEditModal({ shopkeeper, onClose, onSave, isLoading }) {
  const [form, setForm] = useState({
    name: shopkeeper.name || '',
    address: shopkeeper.address || '',
  });

  const handleSave = () => {
    if (!form.name.trim()) return toast.error('Shopkeeper name is required');
    onSave(shopkeeper.id, form);
  };

  return (
    <ModernModal title="Edit Shopkeeper" icon="🌿" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={modalLabelStyle}>Shop / Owner Name *</label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={modalInputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Address / Location</label>
          <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={modalInputStyle} />
        </div>
      </div>
      <ModalActions onClose={onClose} onSave={handleSave} isLoading={isLoading} />
    </ModernModal>
  );
}

function DieselPumpEditModal({ pump, onClose, onSave, isLoading }) {
  const [form, setForm] = useState({
    name: pump.name || '',
    owner_name: pump.owner_name || '',
    contact_number: pump.contact_number || '',
    address: pump.address || '',
  });

  const handleSave = () => {
    if (!form.name.trim()) return toast.error('Pump name is required');
    onSave(pump.id, form);
  };

  return (
    <ModernModal title="Edit Diesel Pump" icon="⛽" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={modalLabelStyle}>Pump Name *</label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={modalInputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Owner Name</label>
          <input type="text" value={form.owner_name} onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))} style={modalInputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Contact Number</label>
          <input type="tel" value={form.contact_number} onChange={e => setForm(f => ({ ...f, contact_number: e.target.value }))} style={modalInputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Address</label>
          <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={modalInputStyle} />
        </div>
      </div>
      <ModalActions onClose={onClose} onSave={handleSave} isLoading={isLoading} />
    </ModernModal>
  );
}

function DailySummaryEditModal({ summary, onClose, onSave, isLoading }) {
  const [form, setForm] = useState({
    date: summary.date || '',
    totalWorkers: summary.totalWorkers || 0,
    dailyAmount: summary.dailyAmount || 0,
    groups: summary.groups || [],
  });

  const handleSave = () => {
    onSave(summary.id, form);
  };

  return (
    <ModernModal title="Edit Daily Worker Summary" icon="🏗️" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={modalLabelStyle}>Date</label>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={modalInputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Total Workers</label>
          <input type="number" value={form.totalWorkers} onChange={e => setForm(f => ({ ...f, totalWorkers: Number(e.target.value) }))} style={modalInputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Daily Rate (₹)</label>
          <input type="number" value={form.dailyAmount} onChange={e => setForm(f => ({ ...f, dailyAmount: Number(e.target.value) }))} style={modalInputStyle} />
        </div>

        {Array.isArray(form.groups) && form.groups.length > 0 && (
          <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '10px 12px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Attached Groups ({form.groups.length})
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
              {form.groups.map((g, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ fontWeight: '700' }}>{g.name}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{Array.isArray(g.members) ? `${g.members.filter(m => m.attendance === 'present').length} Present` : `${g.workerCount} Workers`} @ {formatCurrency(g.dailyRate)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <ModalActions onClose={onClose} onSave={handleSave} isLoading={isLoading} />
    </ModernModal>
  );
}

function DailyPaymentEditModal({ payment, onClose, onSave, isLoading }) {
  const [form, setForm] = useState({
    startDate: payment.startDate || '',
    endDate: payment.endDate || '',
    paymentDate: payment.paymentDate || '',
    amount: payment.amount || '',
    paymentMethod: payment.paymentMethod || 'Cash',
    notes: payment.notes || '',
  });

  const handleSave = () => {
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Enter a valid amount');
    onSave(payment.id, form);
  };

  return (
    <ModernModal title="Edit Daily Worker Payment" icon="💳" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={modalLabelStyle}>From Date</label>
            <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={modalInputStyle} />
          </div>
          <div>
            <label style={modalLabelStyle}>To Date</label>
            <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} style={modalInputStyle} />
          </div>
        </div>
        <div>
          <label style={modalLabelStyle}>Paid On</label>
          <input type="date" value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} style={modalInputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Amount Paid (₹)</label>
          <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={modalInputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Payment Method</label>
          <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))} style={modalInputStyle}>
            {['Cash', 'Bank', 'UPI'].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={modalLabelStyle}>Notes</label>
          <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={modalInputStyle} />
        </div>
      </div>
      <ModalActions onClose={onClose} onSave={handleSave} isLoading={isLoading} />
    </ModernModal>
  );
}

function PurchaseEditModal({ purchase, shopkeepers, onClose, onSave, isLoading }) {
  const [form, setForm] = useState({
    shopkeeperId: purchase.FertilizerShopkeeperId || purchase.shopkeeperId,
    total_amount: purchase.total_amount || 0,
    date: purchase.date || '',
    notes: purchase.notes || '',
  });

  const handleSave = () => {
    onSave(purchase.id, form);
  };

  return (
    <ModernModal title="Edit Fertilizer Purchase" icon="🌿" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={modalLabelStyle}>Shopkeeper</label>
          <select value={form.shopkeeperId} onChange={e => setForm(f => ({ ...f, shopkeeperId: e.target.value }))} style={modalInputStyle}>
            {shopkeepers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label style={modalLabelStyle}>Total Amount (₹)</label>
          <input type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} style={modalInputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Date</label>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={modalInputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Notes</label>
          <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={modalInputStyle} />
        </div>
      </div>
      <ModalActions onClose={onClose} onSave={handleSave} isLoading={isLoading} />
    </ModernModal>
  );
}

function PaymentEditModal({ payment, shopkeepers, onClose, onSave, isLoading }) {
  const [form, setForm] = useState({
    shopkeeperId: payment.FertilizerShopkeeperId || payment.shopkeeperId,
    amount_paid: payment.amount_paid || 0,
    date: payment.date || '',
    payment_method: payment.payment_method || 'Cash',
    notes: payment.notes || '',
  });

  const handleSave = () => {
    onSave(payment.id, form);
  };

  return (
    <ModernModal title="Edit Fertilizer Payment" icon="💳" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={modalLabelStyle}>Shopkeeper</label>
          <select value={form.shopkeeperId} onChange={e => setForm(f => ({ ...f, shopkeeperId: e.target.value }))} style={modalInputStyle}>
            {shopkeepers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label style={modalLabelStyle}>Amount Paid (₹)</label>
          <input type="number" value={form.amount_paid} onChange={e => setForm(f => ({ ...f, amount_paid: e.target.value }))} style={modalInputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Date</label>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={modalInputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Payment Method</label>
          <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} style={modalInputStyle}>
            {['Cash', 'Bank', 'UPI'].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={modalLabelStyle}>Notes</label>
          <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={modalInputStyle} />
        </div>
      </div>
      <ModalActions onClose={onClose} onSave={handleSave} isLoading={isLoading} />
    </ModernModal>
  );
}

function DieselPurchaseEditModal({ purchase, pumps, onClose, onSave, isLoading }) {
  const [form, setForm] = useState({
    petrol_pump_id: purchase.petrol_pump_id,
    amount: purchase.amount || 0,
    date: purchase.date || '',
    slip_number: purchase.slip_number || '',
    notes: purchase.notes || '',
  });

  const handleSave = () => {
    onSave(purchase.id, form);
  };

  return (
    <ModernModal title="Edit Diesel Purchase" icon="⛽" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={modalLabelStyle}>Petrol Pump</label>
          <select value={form.petrol_pump_id} onChange={e => setForm(f => ({ ...f, petrol_pump_id: e.target.value }))} style={modalInputStyle}>
            {pumps.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label style={modalLabelStyle}>Amount (₹)</label>
          <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={modalInputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Slip Number</label>
          <input type="text" value={form.slip_number} onChange={e => setForm(f => ({ ...f, slip_number: e.target.value }))} style={modalInputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Date</label>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={modalInputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Notes</label>
          <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={modalInputStyle} />
        </div>
      </div>
      <ModalActions onClose={onClose} onSave={handleSave} isLoading={isLoading} />
    </ModernModal>
  );
}

function DieselPaymentEditModal({ payment, pumps, onClose, onSave, isLoading }) {
  const [form, setForm] = useState({
    petrol_pump_id: payment.petrol_pump_id,
    amount_paid: payment.amount_paid || payment.amount || 0,
    date: payment.date || '',
    payment_method: payment.payment_method || 'Cash',
    notes: payment.notes || '',
  });

  const handleSave = () => {
    onSave(payment.id, form);
  };

  return (
    <ModernModal title="Edit Diesel Payment" icon="💳" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={modalLabelStyle}>Petrol Pump</label>
          <select value={form.petrol_pump_id} onChange={e => setForm(f => ({ ...f, petrol_pump_id: e.target.value }))} style={modalInputStyle}>
            {pumps.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label style={modalLabelStyle}>Amount Paid (₹)</label>
          <input type="number" value={form.amount_paid} onChange={e => setForm(f => ({ ...f, amount_paid: e.target.value }))} style={modalInputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Date</label>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={modalInputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Payment Method</label>
          <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} style={modalInputStyle}>
            {['Cash', 'Bank', 'UPI'].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={modalLabelStyle}>Notes</label>
          <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={modalInputStyle} />
        </div>
      </div>
      <ModalActions onClose={onClose} onSave={handleSave} isLoading={isLoading} />
    </ModernModal>
  );
}

function LandRecordEditModal({ record, landOwners, onClose, onSave, isLoading }) {
  const [form, setForm] = useState({
    landOwnerId: record.landOwnerId,
    landMeasurement: record.landMeasurement || '',
    ratePerUnit: record.ratePerUnit || '',
    notes: record.notes || '',
  });

  const handleSave = () => {
    onSave(record.id, form);
  };

  return (
    <ModernModal title="Edit Land Record" icon="🌾" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={modalLabelStyle}>Land Owner</label>
          <select value={form.landOwnerId} onChange={e => setForm(f => ({ ...f, landOwnerId: e.target.value }))} style={modalInputStyle}>
            {landOwners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <label style={modalLabelStyle}>Land Measurement (e.g. 1.10)</label>
          <input type="text" value={form.landMeasurement} onChange={e => setForm(f => ({ ...f, landMeasurement: e.target.value }))} style={modalInputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Rate Per Unit (₹)</label>
          <input type="number" value={form.ratePerUnit} onChange={e => setForm(f => ({ ...f, ratePerUnit: e.target.value }))} style={modalInputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Notes</label>
          <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={modalInputStyle} />
        </div>
      </div>
      <ModalActions onClose={onClose} onSave={handleSave} isLoading={isLoading} />
    </ModernModal>
  );
}

function LandPaymentEditModal({ payment, landOwners, onClose, onSave, isLoading }) {
  const [form, setForm] = useState({
    landOwnerId: payment.landOwnerId,
    amountPaid: payment.amountPaid || 0,
    date: payment.date || '',
    paymentMethod: payment.paymentMethod || 'Cash',
    notes: payment.notes || '',
  });

  const handleSave = () => {
    onSave(payment.id, form);
  };

  return (
    <ModernModal title="Edit Land Payment" icon="💳" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={modalLabelStyle}>Land Owner</label>
          <select value={form.landOwnerId} onChange={e => setForm(f => ({ ...f, landOwnerId: e.target.value }))} style={modalInputStyle}>
            {landOwners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <label style={modalLabelStyle}>Amount Paid (₹)</label>
          <input type="number" value={form.amountPaid} onChange={e => setForm(f => ({ ...f, amountPaid: e.target.value }))} style={modalInputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Payment Date</label>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={modalInputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Method</label>
          <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))} style={modalInputStyle}>
            {['Cash', 'Bank', 'UPI'].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={modalLabelStyle}>Notes</label>
          <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={modalInputStyle} />
        </div>
      </div>
      <ModalActions onClose={onClose} onSave={handleSave} isLoading={isLoading} />
    </ModernModal>
  );
}

// ─── SUB-MANAGER: WORK GROUPS (ADMIN) ─────────────────────────────────────────
function WorkGroupsManager({ owner }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupRate, setNewGroupRate] = useState('400');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchGroups = useCallback(async () => {
    if (!owner?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/daily-worker/groups?ownerId=${owner.id}`);
      if (Array.isArray(res.data)) {
        setGroups(res.data);
      }
    } catch (err) {
      console.error('Failed to load groups for owner', err);
    } finally {
      setLoading(false);
    }
  }, [owner?.id]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    const name = newGroupName.trim();
    if (!name) return toast.error('Enter group name');
    setIsSubmitting(true);
    try {
      await api.post('/daily-worker/groups', {
        name,
        defaultDailyRate: parseFloat(newGroupRate) || 400,
        ownerId: owner.id
      });
      toast.success(`Group "${name}" created for ${owner.name || 'owner'}!`);
      setNewGroupName('');
      setNewGroupRate('400');
      setShowAddGroup(false);
      fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create group');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateGroup = async (e) => {
    e.preventDefault();
    if (!editingGroup) return;
    const name = (editingGroup.name || '').trim();
    if (!name) return toast.error('Enter group name');
    setIsSubmitting(true);
    try {
      await api.put(`/daily-worker/groups/${editingGroup.id}`, {
        name,
        defaultDailyRate: parseFloat(editingGroup.defaultDailyRate) || 400
      });
      toast.success(`Group "${name}" updated!`);
      setEditingGroup(null);
      fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update group');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGroup = async (group) => {
    if (!window.confirm(`Permanently delete group "${group.name}" for ${owner?.name || 'this owner'}?`)) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/daily-worker/groups/${group.id}`);
      toast.success(`Group "${group.name}" deleted!`);
      fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete group');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ background: 'var(--surface)', borderRadius: '14px', padding: '16px', border: '1px solid var(--border)', marginBottom: '16px', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '18px' }}>👥</span>
            <h5 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>
              Created Work Groups for {owner?.name} ({groups.length})
            </h5>
          </div>
          <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
            Work groups created for daily worker attendance. Only Admin can edit names, rates, or delete groups.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowAddGroup(prev => !prev);
            setEditingGroup(null);
          }}
          style={{
            padding: '6px 12px',
            background: showAddGroup ? 'var(--surface2)' : 'var(--primary)',
            color: showAddGroup ? 'var(--text)' : 'white',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <span>{showAddGroup ? '✕ Cancel' : '+ Create Group'}</span>
        </button>
      </div>

      {/* Create Group Form */}
      {showAddGroup && (
        <form onSubmit={handleCreateGroup} style={{ background: 'var(--surface2)', padding: '12px', borderRadius: '10px', border: '1.5px solid var(--primary)', marginBottom: '14px' }}>
          <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--primary)', display: 'block', marginBottom: '8px' }}>
            ➕ Create New Work Group
          </span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Group Name (e.g. Group 1, Cutting Team)"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              style={{ flex: 1, minWidth: '160px', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>Default Rate ₹:</label>
              <input
                type="number"
                value={newGroupRate}
                onChange={e => setNewGroupRate(e.target.value)}
                placeholder="400"
                style={{ width: '75px', padding: '7px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px', fontWeight: '700' }}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: '7px 14px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
            >
              {isSubmitting ? 'Saving...' : '✓ Save Group'}
            </button>
          </div>
        </form>
      )}

      {/* Edit Group Form */}
      {editingGroup && (
        <form onSubmit={handleUpdateGroup} style={{ background: 'var(--surface2)', padding: '12px', borderRadius: '10px', border: '1.5px solid #f59e0b', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#f59e0b' }}>
              ✏️ Edit Group: {editingGroup.name}
            </span>
            <button type="button" onClick={() => setEditingGroup(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)' }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              value={editingGroup.name}
              onChange={e => setEditingGroup(g => ({ ...g, name: e.target.value }))}
              style={{ flex: 1, minWidth: '160px', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>Default Rate ₹:</label>
              <input
                type="number"
                value={editingGroup.defaultDailyRate}
                onChange={e => setEditingGroup(g => ({ ...g, defaultDailyRate: e.target.value }))}
                style={{ width: '75px', padding: '7px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px', fontWeight: '700' }}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: '7px 14px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
            >
              {isSubmitting ? 'Updating...' : '✓ Update'}
            </button>
            <button
              type="button"
              onClick={() => setEditingGroup(null)}
              style={{ padding: '7px 10px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Groups List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>
          Loading groups…
        </div>
      ) : groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '18px', background: 'var(--surface2)', borderRadius: '8px', border: '1px dashed var(--border)' }}>
          <span style={{ fontSize: '20px', display: 'block', marginBottom: '4px' }}>👥</span>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
            No work groups created for this owner yet. Click <strong>"+ Create Group"</strong> above to create one.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
          {groups.map(g => (
            <div
              key={g.id}
              style={{
                background: 'var(--surface2)',
                borderRadius: '8px',
                padding: '10px 12px',
                border: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <div>
                <span style={{ fontWeight: '800', fontSize: '13px', color: 'var(--text)', display: 'block' }}>
                  {g.name}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Rate: <strong style={{ color: 'var(--primary)' }}>{formatCurrency(g.defaultDailyRate)}</strong> / day
                </span>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setEditingGroup({ id: g.id, name: g.name, defaultDailyRate: g.defaultDailyRate });
                    setShowAddGroup(false);
                  }}
                  title="Edit group (Admin)"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    padding: '4px 7px',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  ✏️
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteGroup(g)}
                  title="Delete group (Admin)"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '4px',
                    padding: '4px 7px',
                    cursor: 'pointer',
                    color: '#ef4444',
                    fontSize: '11px'
                  }}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SUB-MANAGER: DAILY SUMMARY ──────────────────────────────────────────────
function DailySummaryManager({ owner, dailySummaryData, loading, onRefresh, onEdit, onDelete, onAddPayment, isAddingPayment, onEditPayment, onDeletePayment }) {
  const [search, setSearch] = useState('');
  const [paymentForm, setPaymentForm] = useState({
    startDate: getTodayDate(),
    endDate: getTodayDate(),
    paymentDate: getTodayDate(),
    amount: '',
    paymentMethod: 'Cash',
    notes: '',
  });

  const [selectedGroup, setSelectedGroup] = useState('All');

  const records = Array.isArray(dailySummaryData) ? dailySummaryData : (dailySummaryData?.records || []);
  const payments = Array.isArray(dailySummaryData) ? [] : (dailySummaryData?.payments || []);

  const totalWage = records.reduce((s, r) => s + parseFloat(r.totalWage || 0), 0);
  const totalRemaining = records.reduce((s, r) => s + Math.max(parseFloat(r.remaining || 0), 0), 0);
  const totalPaid = totalWage - totalRemaining;

  const filteredData = records.filter(d => (d.date || '').includes(search));
  const filteredPayments = payments.filter(p => (p.startDate || '').includes(search) || (p.endDate || '').includes(search) || (p.paymentDate || '').includes(search));

  const rangeRecords = records.filter(record => paymentForm.startDate && paymentForm.endDate && record.date >= paymentForm.startDate && record.date <= paymentForm.endDate);
  
  const availableGroups = useMemo(() => {
    const map = new Map();
    rangeRecords.forEach(r => {
      if (Array.isArray(r.groups)) {
        r.groups.forEach(g => {
          const name = (g.name || '').trim();
          if (!name) return;
          const key = name.toLowerCase();
          const wage = parseFloat(g.totalWage !== undefined ? g.totalWage : ((parseFloat(g.workerCount) || 0) * (parseFloat(g.dailyRate) || 0)));
          const paid = parseFloat(g.totalPaid || 0);
          const due = g.remaining !== undefined ? Math.max(parseFloat(g.remaining || 0), 0) : Math.max(wage - paid, 0);

          if (!map.has(key)) {
            map.set(key, { name, totalWage: 0, totalPaid: 0, totalDue: 0 });
          }
          const item = map.get(key);
          item.totalWage += wage;
          item.totalPaid += paid;
          item.totalDue += due;
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.totalDue - a.totalDue);
  }, [rangeRecords]);

  const activeGroupDue = useMemo(() => {
    if (selectedGroup === 'All') {
      return rangeRecords.reduce((sum, record) => sum + Math.max(parseFloat(record.remaining || 0), 0), 0);
    }
    const found = availableGroups.find(g => g.name.toLowerCase() === selectedGroup.toLowerCase());
    return found ? found.totalDue : 0;
  }, [selectedGroup, rangeRecords, availableGroups]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ width: '24px', height: '24px', margin: '0 auto 8px' }} />
        <span style={{ fontSize: '13px' }}>Loading Daily Worker Summaries…</span>
      </div>
    );
  }

  const paymentAmount = parseFloat(paymentForm.amount) || 0;

  const handleAddPayment = (e) => {
    e.preventDefault();
    if (!paymentForm.startDate || !paymentForm.endDate) return toast.error('Select a date range');
    if (paymentForm.startDate > paymentForm.endDate) return toast.error('From date cannot be after To date');
    if (!paymentAmount || paymentAmount <= 0) return toast.error('Enter a valid payment amount');
    if (activeGroupDue <= 0) return toast.error(`No due amount in this date range for ${selectedGroup}`);
    if (paymentAmount > activeGroupDue) return toast.error(`Payment cannot be greater than selected range due (${formatCurrency(activeGroupDue)})`);

    onAddPayment({ ownerId: owner.id, ...paymentForm, amount: paymentAmount, groupName: selectedGroup === 'All' ? null : selectedGroup });
    setPaymentForm(f => ({ ...f, amount: '', notes: '' }));
  };

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '16px' }}>
        <div style={{ background: 'var(--surface)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Wage</div>
          <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text)', marginTop: '2px' }}>{formatCurrency(totalWage)}</div>
        </div>
        <div style={{ background: 'var(--surface)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Paid</div>
          <div style={{ fontSize: '18px', fontWeight: '900', color: '#10b981', marginTop: '2px' }}>{formatCurrency(totalPaid)}</div>
        </div>
        <div style={{ background: 'var(--surface)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Remaining Due</div>
          <div style={{ fontSize: '18px', fontWeight: '900', color: totalRemaining > 0 ? '#ef4444' : '#10b981', marginTop: '2px' }}>{formatCurrency(totalRemaining)}</div>
        </div>
      </div>

      {/* ── WORK GROUPS EMBEDDED IN DAILY SUMMARY ── */}
      <WorkGroupsManager owner={owner} />

      {/* Payment Form */}
      <form onSubmit={handleAddPayment} style={{ background: 'var(--surface)', borderRadius: '14px', padding: '16px', border: '1px solid var(--border)', marginBottom: '16px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h5 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: 'var(--text)' }}>
            Record Date Range Payment {selectedGroup !== 'All' && `for ${selectedGroup}`}
          </h5>
          {activeGroupDue > 0 && (
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#ef4444' }}>
              Due in Range: {formatCurrency(activeGroupDue)}
            </span>
          )}
        </div>

        {/* Group Selector */}
        {availableGroups.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <label style={modalLabelStyle}>Target Work Group</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setSelectedGroup('All')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: selectedGroup === 'All' ? 'var(--primary)' : 'var(--surface2)',
                  color: selectedGroup === 'All' ? 'white' : 'var(--text)',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                🌐 All Groups
              </button>
              {availableGroups.map(ag => (
                <button
                  key={ag.name}
                  type="button"
                  onClick={() => setSelectedGroup(ag.name)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: selectedGroup.toLowerCase() === ag.name.toLowerCase() ? 'var(--primary)' : 'var(--surface2)',
                    color: selectedGroup.toLowerCase() === ag.name.toLowerCase() ? 'white' : 'var(--text)',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  👥 {ag.name} ({formatCurrency(ag.totalDue)})
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '10px' }}>
          <div><label style={modalLabelStyle}>From</label><input type="date" value={paymentForm.startDate} onChange={e => setPaymentForm(f => ({ ...f, startDate: e.target.value }))} style={modalInputStyle} /></div>
          <div><label style={modalLabelStyle}>To</label><input type="date" value={paymentForm.endDate} onChange={e => setPaymentForm(f => ({ ...f, endDate: e.target.value }))} style={modalInputStyle} /></div>
          <div><label style={modalLabelStyle}>Paid On</label><input type="date" value={paymentForm.paymentDate} onChange={e => setPaymentForm(f => ({ ...f, paymentDate: e.target.value }))} style={modalInputStyle} /></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '12px' }}>
          <div><label style={modalLabelStyle}>Amount (₹)</label><input type="number" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} max={activeGroupDue || undefined} placeholder="0" style={modalInputStyle} /></div>
          <div>
            <label style={modalLabelStyle}>Method</label>
            <select value={paymentForm.paymentMethod} onChange={e => setPaymentForm(f => ({ ...f, paymentMethod: e.target.value }))} style={modalInputStyle}>
              {['Cash', 'Bank', 'UPI'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div><label style={modalLabelStyle}>Notes</label><input type="text" value={paymentForm.notes} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" style={modalInputStyle} /></div>
        </div>

        <button
          type="submit"
          disabled={isAddingPayment}
          style={{
            padding: '10px 16px',
            background: 'var(--gradient-primary, linear-gradient(135deg, #6366f1, #8b5cf6))',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontWeight: '700',
            fontSize: '13px',
            cursor: isAddingPayment ? 'not-allowed' : 'pointer',
            opacity: isAddingPayment ? 0.7 : 1,
          }}
        >
          {isAddingPayment ? 'Adding…' : `✓ Record Payment (${formatCurrency(paymentAmount || activeGroupDue)})`}
        </button>
      </form>

      {/* Search Input */}
      <input
        type="text"
        placeholder="Filter summaries or payments by date (YYYY-MM-DD)…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ ...modalInputStyle, marginBottom: '14px' }}
      />

      {/* Daily Records List */}
      <h6 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)' }}>
        Daily Summaries ({filteredData.length})
      </h6>
      {filteredData.length === 0 ? (
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>No daily records found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {filteredData.map(d => (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', borderRadius: '10px', padding: '10px 14px', border: '1px solid var(--border)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <p style={{ margin: 0, fontWeight: '800', fontSize: '14px', color: 'var(--text)' }}>{fmtDate(d.date)}</p>
                  {Array.isArray(d.groups) && d.groups.length > 0 && (
                    <span style={{ fontSize: '11px', background: 'var(--surface2)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '6px', fontWeight: '800' }}>
                      👥 {d.groups.length} Groups
                    </span>
                  )}
                </div>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Workers: {d.totalWorkers} | Rate: {formatCurrency(d.dailyAmount)} | Wage: {formatCurrency(d.totalWage)} | <span style={{ color: d.remaining > 0 ? '#ef4444' : '#10b981', fontWeight: '700' }}>Rem: {formatCurrency(d.remaining)}</span>
                </p>
                {Array.isArray(d.groups) && d.groups.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {d.groups.map((g, idx) => (
                      <span key={idx} style={{ fontSize: '10px', background: 'var(--surface2)', padding: '1px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                        {g.name}: {Array.isArray(g.members) && g.members.length > 0 ? `${g.members.filter(m => m.attendance === 'present').length}P` : `${g.workerCount || 0}w`} @ {formatCurrency(g.dailyRate)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => onEdit(d)} style={{ padding: '6px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: 'var(--text)' }}>Edit</button>
                <button onClick={() => { if (window.confirm('Delete daily summary?')) onDelete(d.id); }} style={{ padding: '6px 10px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: '#ef4444' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment History List */}
      <h6 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)' }}>
        Range Payments History ({filteredPayments.length})
      </h6>
      {filteredPayments.length === 0 ? (
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>No payments recorded yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredPayments.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', borderRadius: '10px', padding: '10px 14px', border: '1px solid var(--border)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <p style={{ margin: 0, fontWeight: '800', fontSize: '14px', color: '#10b981' }}>{formatCurrency(p.amount)}</p>
                  {p.groupName ? (
                    <span style={{ fontSize: '10px', background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', padding: '1px 6px', borderRadius: '4px', fontWeight: '800' }}>
                      👥 {p.groupName}
                    </span>
                  ) : (
                    <span style={{ fontSize: '10px', background: 'var(--surface2)', color: 'var(--text-muted)', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                      🌐 All Groups
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                  Range: {fmtDate(p.startDate)} → {fmtDate(p.endDate)} | Paid on: {fmtDate(p.paymentDate)} ({p.paymentMethod})
                </p>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => onEditPayment(p)} style={{ padding: '6px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: 'var(--text)' }}>Edit</button>
                <button onClick={() => onDeletePayment(p.id)} style={{ padding: '6px 10px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: '#ef4444' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SUB-MANAGER: TENANT & LAND OWNER MANAGER ────────────────────────────────
function TenantManager({ owner, tenantData, loading, onEditLandOwner, onDeleteLandOwner, onEditLandRecord, onDeleteLandRecord, onEditLandPayment, onDeletePayment }) {
  const [search, setSearch] = useState('');

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ width: '24px', height: '24px', margin: '0 auto 8px' }} />
        <span style={{ fontSize: '13px' }}>Loading Land Tenant & Owner Data…</span>
      </div>
    );
  }

  if (!tenantData || !tenantData.owners || tenantData.owners.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
        No land owners or tenants found for {owner.name}.
      </div>
    );
  }

  const { owners: landOwners, lands: landRecords, payments: landPayments } = tenantData;

  // Global Tenant KPI calculations (NEW FEATURE)
  const totalLandValue = landRecords.reduce((sum, lr) => sum + parseFloat(lr.totalAmount || 0), 0);
  const totalPaid = landPayments.reduce((sum, p) => sum + parseFloat(p.amountPaid || 0), 0);
  const totalDue = totalLandValue - totalPaid;

  const filteredLandOwners = landOwners.filter(lo =>
    (lo.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (lo.village || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Financial KPI Summary Cards (NEW FEATURE) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '16px' }}>
        <div style={{ background: 'var(--surface)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Land Value</div>
          <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text)', marginTop: '2px' }}>{formatCurrency(totalLandValue)}</div>
        </div>
        <div style={{ background: 'var(--surface)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Amount Paid</div>
          <div style={{ fontSize: '18px', fontWeight: '900', color: '#10b981', marginTop: '2px' }}>{formatCurrency(totalPaid)}</div>
        </div>
        <div style={{ background: 'var(--surface)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Net Due Balance</div>
          <div style={{ fontSize: '18px', fontWeight: '900', color: totalDue > 0 ? '#ef4444' : '#10b981', marginTop: '2px' }}>{formatCurrency(totalDue)}</div>
        </div>
      </div>

      {/* Search Bar */}
      <input
        type="text"
        placeholder="Search land owner by name or village…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ ...modalInputStyle, marginBottom: '14px' }}
      />

      {filteredLandOwners.length === 0 ? (
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No land owners match search.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredLandOwners.map(landOwner => {
            const ownerRecords = landRecords.filter(lr => lr.landOwnerId === landOwner.id);
            const ownerPayments = landPayments.filter(p => p.landOwnerId === landOwner.id);

            const oTotal = ownerRecords.reduce((s, lr) => s + parseFloat(lr.totalAmount || 0), 0);
            const oPaid = ownerPayments.reduce((s, p) => s + parseFloat(p.amountPaid || 0), 0);
            const oDue = oTotal - oPaid;

            return (
              <div key={landOwner.id} style={{ background: 'var(--surface)', borderRadius: '14px', padding: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                {/* Land Owner Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '12px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>👨‍🌾</span>
                      <p style={{ margin: 0, fontWeight: '800', fontSize: '16px', color: 'var(--text)' }}>{landOwner.name}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                      {landOwner.village && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>📍 {landOwner.village}</span>
                      )}
                      {landOwner.phone && (
                        <a href={`tel:${landOwner.phone}`} style={{ fontSize: '12px', color: 'var(--primary)', textDecoration: 'none', fontWeight: '600' }}>
                          📞 {landOwner.phone}
                        </a>
                      )}
                    </div>
                    {landOwner.notes && (
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        "{landOwner.notes}"
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => onEditLandOwner(landOwner)} style={{ padding: '6px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text)', fontWeight: '700', fontSize: '12px' }}>
                      Edit Owner
                    </button>
                    <button onClick={() => { if (window.confirm(`Delete land owner ${landOwner.name}?`)) onDeleteLandOwner(landOwner.id); }} style={{ padding: '6px 12px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#ef4444', fontWeight: '700', fontSize: '12px' }}>
                      Delete
                    </button>
                  </div>
                </div>

                {/* Per-Owner Balance Summary Pill (NEW FEATURE) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '10px', padding: '10px', background: 'var(--surface2)', borderRadius: '10px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Plots</div>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text)', marginTop: '2px' }}>{ownerRecords.length}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total / Paid</div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text)', marginTop: '2px' }}>{formatCurrency(oTotal)} / <span style={{ color: '#10b981' }}>{formatCurrency(oPaid)}</span></div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Balance Due</div>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: oDue > 0 ? '#ef4444' : '#10b981', marginTop: '2px' }}>{formatCurrency(oDue)}</div>
                  </div>
                </div>

                {/* Land Records */}
                <div style={{ marginTop: '14px' }}>
                  <h6 style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Land Records ({ownerRecords.length})
                  </h6>
                  {ownerRecords.length === 0 ? (
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>No records added yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {ownerRecords.map(lr => (
                        <div key={lr.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface2)', borderRadius: '8px', padding: '8px 12px' }}>
                          <div>
                            <p style={{ margin: 0, fontWeight: '800', fontSize: '13px', color: 'var(--text)' }}>{formatCurrency(lr.totalAmount)}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                              Measurement: {lr.landMeasurement} ({lr.convertedUnits || '—'} units)
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => onEditLandRecord(lr)} style={{ padding: '4px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text)', fontWeight: '700', fontSize: '11px' }}>Edit</button>
                            <button onClick={() => { if (window.confirm('Delete land record?')) onDeleteLandRecord(lr.id); }} style={{ padding: '4px 8px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#ef4444', fontWeight: '700', fontSize: '11px' }}>Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Land Payments */}
                <div style={{ marginTop: '12px' }}>
                  <h6 style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Payments Recorded ({ownerPayments.length})
                  </h6>
                  {ownerPayments.length === 0 ? (
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>No payments recorded yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {ownerPayments.map(p => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface2)', borderRadius: '8px', padding: '8px 12px' }}>
                          <div>
                            <p style={{ margin: 0, fontWeight: '800', fontSize: '13px', color: '#10b981' }}>{formatCurrency(p.amountPaid)}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                              Date: {fmtDate(p.date)} {p.paymentMethod && `(${p.paymentMethod})`}
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => onEditLandPayment(p)} style={{ padding: '4px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text)', fontWeight: '700', fontSize: '11px' }}>Edit</button>
                            <button onClick={() => { if (window.confirm('Delete payment?')) onDeletePayment(p.id); }} style={{ padding: '4px 8px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#ef4444', fontWeight: '700', fontSize: '11px' }}>Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SUB-MANAGER: FERTILIZER MANAGER ─────────────────────────────────────────
function FertilizerManager({ owner, fertilizerData, loading, onEditShopkeeper, onDeleteShopkeeper, onEditPurchase, onDeletePurchase, onEditPayment, onDeletePayment }) {
  const [search, setSearch] = useState('');

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ width: '24px', height: '24px', margin: '0 auto 8px' }} />
        <span style={{ fontSize: '13px' }}>Loading Fertilizer Data…</span>
      </div>
    );
  }

  if (!fertilizerData || !fertilizerData.shopkeepers || fertilizerData.shopkeepers.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
        No fertilizer data or shopkeepers found for {owner.name}.
      </div>
    );
  }

  const { shopkeepers, purchases, payments } = fertilizerData;

  // Financial KPI totals (NEW FEATURE)
  const totalPurchased = purchases.reduce((s, p) => s + parseFloat(p.total_amount || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0);
  const totalDue = totalPurchased - totalPaid;

  const filteredShopkeepers = shopkeepers.filter(s =>
    (s.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Financial KPI Summary Cards (NEW FEATURE) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '16px' }}>
        <div style={{ background: 'var(--surface)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Purchases</div>
          <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text)', marginTop: '2px' }}>{formatCurrency(totalPurchased)}</div>
        </div>
        <div style={{ background: 'var(--surface)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Paid</div>
          <div style={{ fontSize: '18px', fontWeight: '900', color: '#10b981', marginTop: '2px' }}>{formatCurrency(totalPaid)}</div>
        </div>
        <div style={{ background: 'var(--surface)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Outstanding Due</div>
          <div style={{ fontSize: '18px', fontWeight: '900', color: totalDue > 0 ? '#ef4444' : '#10b981', marginTop: '2px' }}>{formatCurrency(totalDue)}</div>
        </div>
      </div>

      <input
        type="text"
        placeholder="Search shopkeepers by name…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ ...modalInputStyle, marginBottom: '14px' }}
      />

      {filteredShopkeepers.length === 0 ? (
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No shopkeepers found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredShopkeepers.map(shop => {
            const shopPurchases = purchases.filter(p => p.FertilizerShopkeeperId === shop.id);
            const shopPayments = payments.filter(p => p.FertilizerShopkeeperId === shop.id);
            const sTotal = shopPurchases.reduce((s, p) => s + parseFloat(p.total_amount || 0), 0);
            const sPaid = shopPayments.reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0);
            const sDue = sTotal - sPaid;

            return (
              <div key={shop.id} style={{ background: 'var(--surface)', borderRadius: '14px', padding: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                {/* Shopkeeper Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '12px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>🌿</span>
                      <p style={{ margin: 0, fontWeight: '800', fontSize: '16px', color: 'var(--text)' }}>{shop.name}</p>
                    </div>
                    {shop.address && <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>📍 {shop.address}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => onEditShopkeeper(shop)} style={{ padding: '6px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text)', fontWeight: '700', fontSize: '12px' }}>Edit Shop</button>
                    <button onClick={() => { if (window.confirm(`Delete shop ${shop.name}?`)) onDeleteShopkeeper(shop.id); }} style={{ padding: '6px 12px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#ef4444', fontWeight: '700', fontSize: '12px' }}>Delete</button>
                  </div>
                </div>

                {/* Per-Shop Financial Summary (NEW FEATURE) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '10px', padding: '10px', background: 'var(--surface2)', borderRadius: '10px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Purchases</div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text)', marginTop: '2px' }}>{formatCurrency(sTotal)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Paid</div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#10b981', marginTop: '2px' }}>{formatCurrency(sPaid)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Due</div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: sDue > 0 ? '#ef4444' : '#10b981', marginTop: '2px' }}>{formatCurrency(sDue)}</div>
                  </div>
                </div>

                {/* Purchases list */}
                <div style={{ marginTop: '12px' }}>
                  <h6 style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Purchases ({shopPurchases.length})</h6>
                  {shopPurchases.length === 0 ? <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>No purchases.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {shopPurchases.map(p => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface2)', borderRadius: '8px', padding: '8px 12px' }}>
                          <div>
                            <p style={{ margin: 0, fontWeight: '800', fontSize: '13px' }}>{formatCurrency(p.total_amount)}</p>
                            <p style={{ margin: '1px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>On {fmtDate(p.date)}</p>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => onEditPurchase(p)} style={{ padding: '4px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>Edit</button>
                            <button onClick={() => { if (window.confirm('Delete purchase?')) onDeletePurchase(p.id); }} style={{ padding: '4px 8px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', color: '#ef4444' }}>Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payments list */}
                <div style={{ marginTop: '12px' }}>
                  <h6 style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Payments ({shopPayments.length})</h6>
                  {shopPayments.length === 0 ? <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>No payments.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {shopPayments.map(p => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface2)', borderRadius: '8px', padding: '8px 12px' }}>
                          <div>
                            <p style={{ margin: 0, fontWeight: '800', fontSize: '13px', color: '#10b981' }}>{formatCurrency(p.amount_paid)}</p>
                            <p style={{ margin: '1px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>On {fmtDate(p.date)}</p>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => onEditPayment(p)} style={{ padding: '4px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>Edit</button>
                            <button onClick={() => { if (window.confirm('Delete payment?')) onDeletePayment(p.id); }} style={{ padding: '4px 8px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', color: '#ef4444' }}>Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SUB-MANAGER: DIESEL MANAGER ─────────────────────────────────────────────
function DieselManager({ owner, dieselData, loading, onEditPump, onDeletePump, onEditPurchase, onDeletePurchase, onEditPayment, onDeletePayment }) {
  const [pumpSearch, setPumpSearch] = useState('');
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ width: '24px', height: '24px', margin: '0 auto 8px' }} />
        <span style={{ fontSize: '13px' }}>Loading Diesel Data…</span>
      </div>
    );
  }

  if (!dieselData) {
    return (
      <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
        No diesel data found for {owner.name}.
      </div>
    );
  }

  const { pumps, purchases, payments } = dieselData;

  // Financial KPI totals (NEW FEATURE)
  const totalPurchased = purchases.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + parseFloat(p.amount_paid || p.amountPaid || p.amount || 0), 0);
  const totalDue = totalPurchased - totalPaid;

  const filteredPumps = pumps.filter(p => (p.name || '').toLowerCase().includes(pumpSearch.toLowerCase()));
  const filteredPurchases = purchases.filter(p => {
    const pump = pumps.find(pump => pump.id === p.petrol_pump_id);
    return (pump?.name || '').toLowerCase().includes(purchaseSearch.toLowerCase()) || (p.slip_number && p.slip_number.includes(purchaseSearch));
  });
  const filteredPayments = payments.filter(p => {
    const pump = pumps.find(pump => pump.id === p.petrol_pump_id);
    return (pump?.name || '').toLowerCase().includes(paymentSearch.toLowerCase());
  });

  return (
    <div>
      {/* Financial KPI Summary Cards (NEW FEATURE) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '16px' }}>
        <div style={{ background: 'var(--surface)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Diesel Purchases</div>
          <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text)', marginTop: '2px' }}>{formatCurrency(totalPurchased)}</div>
        </div>
        <div style={{ background: 'var(--surface)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Paid</div>
          <div style={{ fontSize: '18px', fontWeight: '900', color: '#10b981', marginTop: '2px' }}>{formatCurrency(totalPaid)}</div>
        </div>
        <div style={{ background: 'var(--surface)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Net Due Balance</div>
          <div style={{ fontSize: '18px', fontWeight: '900', color: totalDue > 0 ? '#ef4444' : '#10b981', marginTop: '2px' }}>{formatCurrency(totalDue)}</div>
        </div>
      </div>

      {/* Pumps List */}
      <div style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h5 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Registered Petrol Pumps ({filteredPumps.length})
          </h5>
        </div>
        <input type="text" placeholder="Search pumps…" value={pumpSearch} onChange={e => setPumpSearch(e.target.value)} style={{ ...modalInputStyle, marginBottom: '10px' }} />
        {filteredPumps.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No pumps found.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredPumps.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'var(--surface)', borderRadius: '12px', padding: '12px 14px', border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '16px' }}>⛽</span>
                    <p style={{ margin: 0, fontWeight: '800', fontSize: '14px', color: 'var(--text)' }}>{p.name}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '3px', flexWrap: 'wrap' }}>
                    {p.owner_name && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>👤 {p.owner_name}</span>}
                    {p.contact_number && <a href={`tel:${p.contact_number}`} style={{ fontSize: '12px', color: 'var(--primary)', textDecoration: 'none' }}>📞 {p.contact_number}</a>}
                    {p.address && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>📍 {p.address}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => onEditPump(p)} style={{ padding: '6px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>Edit</button>
                  <button onClick={() => { if (window.confirm(`Delete pump ${p.name}?`)) onDeletePump(p.id); }} style={{ padding: '6px 10px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: '#ef4444' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Purchases List */}
      <div style={{ marginBottom: '18px' }}>
        <h5 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Diesel Purchases ({filteredPurchases.length})
        </h5>
        <input type="text" placeholder="Search by pump or slip number…" value={purchaseSearch} onChange={e => setPurchaseSearch(e.target.value)} style={{ ...modalInputStyle, marginBottom: '10px' }} />
        {filteredPurchases.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No purchases found.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredPurchases.map(p => {
              const pump = pumps.find(pump => pump.id === p.petrol_pump_id);
              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', borderRadius: '10px', padding: '10px 12px', border: '1px solid var(--border)' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: '800', fontSize: '14px', color: 'var(--text)' }}>{formatCurrency(p.amount)}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                      Pump: {pump?.name || 'Unknown'} | Date: {fmtDate(p.date)} {p.slip_number && `(Slip: ${p.slip_number})`}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => onEditPurchase(p)} style={{ padding: '4px 8px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>Edit</button>
                    <button onClick={() => { if (window.confirm('Delete purchase?')) onDeletePurchase(p.id); }} style={{ padding: '4px 8px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', color: '#ef4444' }}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payments List */}
      <div>
        <h5 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Diesel Payments ({filteredPayments.length})
        </h5>
        <input type="text" placeholder="Search payments by pump name…" value={paymentSearch} onChange={e => setPaymentSearch(e.target.value)} style={{ ...modalInputStyle, marginBottom: '10px' }} />
        {filteredPayments.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No payments found.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredPayments.map(p => {
              const pump = pumps.find(pump => pump.id === p.petrol_pump_id);
              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', borderRadius: '10px', padding: '10px 12px', border: '1px solid var(--border)' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: '800', fontSize: '14px', color: '#10b981' }}>{formatCurrency(p.amount_paid || p.amountPaid || p.amount)}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                      Pump: {pump?.name || 'Unknown'} | Date: {fmtDate(p.date)} {p.payment_method && `(${p.payment_method})`}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => onEditPayment(p)} style={{ padding: '4px 8px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>Edit</button>
                    <button onClick={() => { if (window.confirm('Delete payment?')) onDeletePayment(p.id); }} style={{ padding: '4px 8px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', color: '#ef4444' }}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
