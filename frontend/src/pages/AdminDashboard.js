import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { getTodayDate, formatCurrency } from '../utils/helpers';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const isOwnerActive = (activeStatus) => activeStatus === true || activeStatus === 'true' || activeStatus === 1 || activeStatus === '1';

export default function AdminDashboard() {
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', username: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminForm, setAdminForm] = useState({ name: '', email: '' });

  const [resetPwd, setResetPwd] = useState({});
  // State for the currently active management panel
  const [ownerSearch, setOwnerSearch] = useState('');
  const [activeOwner, setActiveOwner] = useState(null); // e.g., { id: 1, view: 'labours' }
  const [attendanceDate, setAttendanceDate] = useState(getTodayDate());
  const [labourSearch, setLabourSearch] = useState('');
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

  const fetchOwners = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/owners');
      setOwners(data);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => {
    fetchOwners();
  }, []);

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
      setActiveOwner(null); // Close if already open
    } else {
      // Open to the default 'labours' view and reset search
      setActiveOwner({ id: ownerId, view: 'labours' });
      setLabourSearch('');
    }
  };

  const setManageView = (view) => {
    setActiveOwner(prev => ({ ...prev, view }));
  };

  const handleDateChange = (date) => {
    setAttendanceDate(date);
    // No need to manually refetch; useQuery will do it automatically
    // because `attendanceDate` is in the queryKey.
  };

  const createOwner = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/admin/owners', form);
      toast.success('Owner created!');
      setForm({ name: '', username: '', password: '' });
      setShowForm(false);
      fetchOwners();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
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
    createAdminMutation.mutate(adminForm);
  };

  const toggleStatus = async (id) => {
    try {
      const { data } = await api.put(`/admin/owners/${id}/toggle-status`);
      toast.success(data.message);
      fetchOwners();
    } catch (e) { toast.error('Failed'); }
  };

  const handleResetPwd = async (id) => {
    const pwd = resetPwd[id];
    if (!pwd) return toast.error('Enter new password');
    try {
      await api.put(`/admin/owners/${id}/reset-password`, { password: pwd });
      toast.success('Password reset!');
      setResetPwd(p => ({ ...p, [id]: '' }));
    } catch (e) { toast.error('Failed'); }
  };

  const deleteOwner = async (id) => {
    if (!window.confirm('This will permanently delete the owner and ALL their associated data (labours, tenants, purchases, etc.). This action cannot be undone. Are you sure?')) return;
    try {
      const res = await api.delete(`/admin/owners/${id}`);
      toast.success(res.data.message || 'Owner and all data deleted.');
      fetchOwners();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to delete owner');
    }
  };

  const deactivateLabourMutation = useMutation({
    mutationFn: (id) => api.delete(`/labour/${id}`),
    onSuccess: () => {
      toast.success('Labour deactivated');
      // Invalidate the query to refetch the labour list for the active owner
      queryClient.invalidateQueries({ queryKey: ['adminLabours', activeOwner.id] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to deactivate labour'),
  });

  const deleteLabour = (id) => {
    if (!window.confirm('Deactivate this labour? They will be hidden from view but their data will be preserved.')) return;
    deactivateLabourMutation.mutate(id);
  };

  const reactivateLabourMutation = useMutation({
    mutationFn: (id) => api.put(`/labour/${id}/reactivate`),
    onSuccess: () => {
      toast.success('Labour reactivated');
      queryClient.invalidateQueries({ queryKey: ['adminLabours', activeOwner.id] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to reactivate labour'),
  });

  const permanentDeleteLabourMutation = useMutation({
    mutationFn: (id) => api.delete(`/labour/${id}/permanent`),
    onSuccess: () => {
      toast.success('Labour permanently deleted');
      queryClient.invalidateQueries({ queryKey: ['adminLabours', activeOwner.id] });
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
      queryClient.invalidateQueries({ queryKey: ['adminLabours', activeOwner.id, attendanceDate] });
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
      queryClient.invalidateQueries({ queryKey: ['adminLabours', activeOwner.id, attendanceDate] });
      setEditingLabour(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update labour'),
  });

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


  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: '800', fontSize: '22px' }}>Admin Panel</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>{owners.length} owners registered</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowForm(f => !f)} style={{ padding: '10px 18px', background: 'linear-gradient(135deg, #0ea5e9, #10b981)', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px' }}>
            {showForm ? '✕ Cancel' : '+ New Owner'}
          </button>
          <button onClick={() => setShowAdminForm(f => !f)} style={{ padding: '10px 18px', background: 'linear-gradient(135deg, #8b5cf6, #c026d3)', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px' }}>
            {showAdminForm ? '✕ Cancel' : '+ New Admin'}
          </button>
        </div>
      </div>

      {/* Create Admin Form */}
      {showAdminForm && (
        <form onSubmit={handleCreateAdmin} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '20px', border: '1px solid var(--border)', marginBottom: '20px', boxShadow: 'var(--shadow)' }}>
          <h3 style={{ margin: '0 0 16px', fontWeight: '700' }}>Add Admin Gmail</h3>
          {[['name', 'Full Name', 'text'], ['email', 'Gmail Address', 'email']].map(([field, label, type]) => (
            <div key={field} style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</label>
              <input type={type} value={adminForm[field]} onChange={e => setAdminForm(f => ({ ...f, [field]: e.target.value }))} required
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '15px', boxSizing: 'border-box' }} />
            </div>
          ))}
          <button type="submit" disabled={createAdminMutation.isPending} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #8b5cf6, #c026d3)', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', fontSize: '15px' }}>
            {createAdminMutation.isPending ? '⏳ Saving...' : '✓ Add Gmail Admin'}
          </button>
        </form>
      )}

      {/* Create Owner Form */}
      {showForm && (
        <form onSubmit={createOwner} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '20px', border: '1px solid var(--border)', marginBottom: '20px', boxShadow: 'var(--shadow)' }}>
          <h3 style={{ margin: '0 0 16px', fontWeight: '700' }}>Create Owner Account</h3>
          {[['name', 'Full Name', 'text'], ['username', 'Username', 'text'], ['password', 'Password', 'password']].map(([field, label, type]) => (
            <div key={field} style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</label>
              <input type={type} value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} required
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '15px', boxSizing: 'border-box' }} />
            </div>
          ))}
          <button type="submit" disabled={creating} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #0ea5e9, #10b981)', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', fontSize: '15px' }}>
            {creating ? '⏳ Creating...' : '✓ Create Owner'}
          </button>
        </form>
      )}

      {/* Search Bar for Owners */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="🔍 Search owners by name or username..."
          value={ownerSearch}
          onChange={e => setOwnerSearch(e.target.value)}
          style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '15px', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
      </div>

      {/* Owners List */}
      {loading ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {owners.filter(o => o.name.toLowerCase().includes(ownerSearch.toLowerCase()) || o.username.toLowerCase().includes(ownerSearch.toLowerCase())).length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>{ownerSearch ? 'No owners match your search.' : 'No owners yet. Create one above.'}</div>
          )}
          {owners.filter(o => o.name.toLowerCase().includes(ownerSearch.toLowerCase()) || o.username.toLowerCase().includes(ownerSearch.toLowerCase())).map(owner => {
            const ownerActive = isOwnerActive(owner.activeStatus);
            return (
            <div key={owner.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: ownerActive ? 'linear-gradient(135deg, #0ea5e9, #10b981)' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '17px' }}>
                    {(owner.name || owner.username)[0].toUpperCase()}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: '700' }}>{owner.name}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>{owner.username}</p>
                  </div>
                </div>
                <span style={{ background: ownerActive ? '#dcfce7' : '#fee2e2', color: ownerActive ? '#166534' : '#991b1b', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '99px' }}>
                  {ownerActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <button onClick={() => toggleStatus(owner.id)}
                  style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', fontFamily: 'inherit', background: ownerActive ? '#fee2e2' : '#dcfce7', color: ownerActive ? '#991b1b' : '#166534' }}>
                  {ownerActive ? '🔒 Deactivate' : '🔓 Activate'}
                </button>
                <button
                  onClick={() => deleteOwner(owner.id)}
                  disabled={ownerActive}
                  title={ownerActive ? 'Deactivate owner before deleting' : 'Permanently delete owner'}
                  style={{
                    padding: '10px 14px', background: '#fee2e2', border: 'none', borderRadius: '10px',
                    fontSize: '14px',
                    cursor: ownerActive ? 'not-allowed' : 'pointer',
                    opacity: ownerActive ? 0.5 : 1,
                  }}
                >🗑️</button>
                <button onClick={() => handleManageToggle(owner.id)}
                  style={{ flex: 1, padding: '10px', border: '1.5px solid var(--border)', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', fontFamily: 'inherit', background: 'var(--surface2)', color: 'var(--text)' }}>
                  {activeOwner?.id === owner.id ? '▼ Close Management' : '▶ Manage'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="password" value={resetPwd[owner.id] || ''} onChange={e => setResetPwd(p => ({ ...p, [owner.id]: e.target.value }))} placeholder="New password..."
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '14px' }} />
                <button onClick={() => handleResetPwd(owner.id)}
                  style={{ padding: '10px 14px', background: '#fef3c7', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '700', fontFamily: 'inherit' }}>
                  🔑 Reset
                </button>
              </div>

              {/* NEW: Tabbed Management Panel */}
              {activeOwner?.id === owner.id && (
                <div style={{ marginTop: '16px', background: 'var(--surface2)', borderRadius: '14px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 8px', overflowX: 'auto', gap: '4px' }}>
                    {['labours', 'daily', 'tenants', 'fertilizer', 'diesel'].map(view => (
                      <button
                        key={view}
                        style={activeOwner.view === view ? activeTabButtonStyle : tabButtonStyle}
                        onClick={() => setManageView(view)}
                      >
                        {view.charAt(0).toUpperCase() + view.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div style={{ padding: '16px' }}>
                    {activeOwner.view === 'labours' && (
                      <div>
                        <h4 style={{ margin: '0 0 12px', fontSize: '15px' }}>Manage Attendance for {owner.name}</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                          <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>Select Date</label>
                            <input type="date" value={attendanceDate} onChange={e => handleDateChange(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>Search Labour</label>
                            <input type="text" placeholder="Search by name..." value={labourSearch} onChange={e => setLabourSearch(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                          </div>
                        </div>
                        {loadingLabours ? <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>Loading Labours...</div> : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {(() => {
                              const filteredLabours = labours.filter(l => l.name.toLowerCase().includes(labourSearch.toLowerCase()));
                              if (filteredLabours.length === 0) return <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>No labours found.</div>;
                              return filteredLabours.map(labour => (
                                <div key={labour.id} style={{ background: 'var(--surface)', borderRadius: '10px', padding: '12px 14px', border: `1.5px solid ${labour.attendance === 'present' && labour.isActive ? '#86efac' : 'var(--border)'}` }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                      <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', textDecoration: labour.isActive ? 'none' : 'line-through' }}>{labour.name}</p>
                                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: labour.isActive ? '#10b981' : '#ef4444', fontWeight: '700' }}>{labour.isActive ? 'Active' : 'Inactive'}</p>
                                    </div>
                                    <div>
                                      {labour.isActive ? (
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                          <button onClick={() => setEditingLabour(labour)} style={{ padding: '6px 10px', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text)', fontWeight: '700', fontSize: '12px' }}>Edit</button>
                                          <button onClick={() => deleteLabour(labour.id)} disabled={deactivateLabourMutation.isPending} style={{ padding: '6px 10px', background: '#fee2e2', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#991b1b', fontWeight: '700', fontSize: '12px' }}>Deactivate</button>
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                          <button onClick={() => setEditingLabour(labour)} style={{ padding: '6px 10px', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text)', fontWeight: '700', fontSize: '12px' }}>Edit</button>
                                          <button onClick={() => handleReactivate(labour.id)} disabled={reactivateLabourMutation.isPending} style={{ padding: '6px 10px', background: '#dcfce7', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#166534', fontWeight: '700', fontSize: '12px' }}>Activate</button>
                                          <button onClick={() => handlePermanentDelete(labour.id)} disabled={permanentDeleteLabourMutation.isPending} style={{ padding: '6px 10px', background: '#fee2e2', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#991b1b', fontWeight: '700', fontSize: '12px' }}>Delete</button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {labour.isActive && (
                                    <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                                      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                        {['present', 'absent'].map(status => (
                                          <button key={status} onClick={() => handleAttendanceChange(labour, 'attendance', status)} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '12px', fontFamily: 'inherit', background: labour.attendance === status ? (status === 'present' ? '#10b981' : '#ef4444') : 'var(--surface)', color: labour.attendance === status ? 'white' : 'var(--text-muted)' }}>
                                            {status === 'present' ? '✅ Present' : '❌ Absent'}
                                          </button>
                                        ))}
                                      </div>
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <div>
                                          <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Wage ₹</label>
                                          <input type="number" defaultValue={labour.dailyWage} onBlur={e => handleAttendanceChange(labour, 'dailyWage', e.target.value)} placeholder="0" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '14px', boxSizing: 'border-box' }} />
                                        </div>
                                        <div>
                                          <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Paid ₹</label>
                                          <input type="number" defaultValue={labour.amountPaidToday} onBlur={e => handleAttendanceChange(labour, 'amountPaidToday', e.target.value)} placeholder="0" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '14px', boxSizing: 'border-box' }} />
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
                    {activeOwner.view === 'daily' && (
                      <DailySummaryManager
                        owner={owner}
                        dailySummaryData={dailySummaryData}
                        loading={loadingDailySummary}
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
      <div style={{ textAlign: 'center', padding: '20px 0 10px', fontSize: '12px', color: 'var(--text-muted)', opacity: 0.6 }}>
        Developed by Subrata Bala
      </div>
    </div>
  );
}

const tabButtonStyle = {
  padding: '10px 14px',
  border: 'none',
  borderBottom: '3px solid transparent',
  background: 'transparent',
  cursor: 'pointer',
  fontWeight: '700',
  fontSize: '13px',
  fontFamily: 'inherit',
  color: 'var(--text-muted)',
  flexShrink: 0,
  whiteSpace: 'nowrap',
};

const activeTabButtonStyle = {
  ...tabButtonStyle,
  color: 'var(--primary, #0ea5e9)',
  borderBottom: '3px solid var(--primary, #0ea5e9)',
};

const modalStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' };
const modalContentStyle = { background: 'var(--surface)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow)' };
const modalInputStyle = { width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', boxSizing: 'border-box' };
const modalLabelStyle = { display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '700' };

function ModalActions({ onClose, onSave, isLoading }) {
  return (
    <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
      <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
      <button onClick={onSave} disabled={isLoading} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #0ea5e9, #10b981)', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '700', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1 }}>
        {isLoading ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

function LabourEditModal({ labour, onClose, onSave, isLoading }) {
  const [form, setForm] = useState({ name: labour.name, isActive: !!labour.isActive });

  const handleSave = () => {
    if (!form.name.trim()) return toast.error('Labour name is required');
    onSave(labour.id, { ...form, name: form.name.trim() });
  };

  return (
    <div style={modalStyle}>
      <div style={modalContentStyle}>
        <h3 style={{ margin: '0 0 16px', fontWeight: '800' }}>Edit Labour</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div><label style={modalLabelStyle}>Name</label><input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={modalInputStyle} /></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '13px' }}>
            <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
            Active labour
          </label>
        </div>
        <ModalActions onClose={onClose} onSave={handleSave} isLoading={isLoading} />
      </div>
    </div>
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
    <div style={modalStyle}>
      <div style={modalContentStyle}>
        <h3 style={{ margin: '0 0 16px', fontWeight: '800' }}>Edit Land Owner</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div><label style={modalLabelStyle}>Name</label><input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={modalInputStyle} /></div>
          <div><label style={modalLabelStyle}>Village</label><input type="text" value={form.village} onChange={e => setForm(f => ({ ...f, village: e.target.value }))} style={modalInputStyle} /></div>
          <div><label style={modalLabelStyle}>Phone</label><input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={modalInputStyle} /></div>
          <div><label style={modalLabelStyle}>Notes</label><input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={modalInputStyle} /></div>
        </div>
        <ModalActions onClose={onClose} onSave={handleSave} isLoading={isLoading} />
      </div>
    </div>
  );
}

function ShopkeeperEditModal({ shopkeeper, onClose, onSave, isLoading }) {
  const [form, setForm] = useState({
    name: shopkeeper.name || '',
    phone: shopkeeper.phone || '',
    address: shopkeeper.address || '',
  });

  const handleSave = () => {
    if (!form.name.trim()) return toast.error('Shopkeeper name is required');
    onSave(shopkeeper.id, { ...form, name: form.name.trim() });
  };

  return (
    <div style={modalStyle}>
      <div style={modalContentStyle}>
        <h3 style={{ margin: '0 0 16px', fontWeight: '800' }}>Edit Shopkeeper</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div><label style={modalLabelStyle}>Name</label><input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={modalInputStyle} /></div>
          <div><label style={modalLabelStyle}>Phone</label><input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={modalInputStyle} /></div>
          <div><label style={modalLabelStyle}>Address</label><input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={modalInputStyle} /></div>
        </div>
        <ModalActions onClose={onClose} onSave={handleSave} isLoading={isLoading} />
      </div>
    </div>
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
    onSave(pump.id, { ...form, name: form.name.trim() });
  };

  return (
    <div style={modalStyle}>
      <div style={modalContentStyle}>
        <h3 style={{ margin: '0 0 16px', fontWeight: '800' }}>Edit Diesel Pump</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div><label style={modalLabelStyle}>Pump Name</label><input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={modalInputStyle} /></div>
          <div><label style={modalLabelStyle}>Owner Name</label><input type="text" value={form.owner_name} onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))} style={modalInputStyle} /></div>
          <div><label style={modalLabelStyle}>Contact Number</label><input type="text" value={form.contact_number} onChange={e => setForm(f => ({ ...f, contact_number: e.target.value }))} style={modalInputStyle} /></div>
          <div><label style={modalLabelStyle}>Address</label><input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={modalInputStyle} /></div>
        </div>
        <ModalActions onClose={onClose} onSave={handleSave} isLoading={isLoading} />
      </div>
    </div>
  );
}

function DailySummaryManager({ owner, dailySummaryData, loading, onEdit, onDelete, onAddPayment, isAddingPayment, onEditPayment, onDeletePayment }) {
  const [search, setSearch] = useState('');
  const [paymentForm, setPaymentForm] = useState({
    startDate: getTodayDate(),
    endDate: getTodayDate(),
    paymentDate: getTodayDate(),
    amount: '',
    paymentMethod: 'Cash',
    notes: '',
  });

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>Loading Daily Summaries...</div>;
  }

  const records = Array.isArray(dailySummaryData) ? dailySummaryData : (dailySummaryData?.records || []);
  const payments = Array.isArray(dailySummaryData) ? [] : (dailySummaryData?.payments || []);
  const filteredData = records.filter(d => d.date.includes(search));
  const filteredPayments = payments.filter(p => p.startDate.includes(search) || p.endDate.includes(search) || p.paymentDate.includes(search));

  const rangeRecords = records.filter(record => paymentForm.startDate && paymentForm.endDate && record.date >= paymentForm.startDate && record.date <= paymentForm.endDate);
  const rangeDue = rangeRecords.reduce((sum, record) => sum + Math.max(parseFloat(record.remaining || 0), 0), 0);
  const paymentAmount = parseFloat(paymentForm.amount) || 0;

  const searchBarStyle = {
    width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid var(--border)',
    background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit',
    boxSizing: 'border-box', marginBottom: '12px'
  };

  const fieldStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '10px' };
  const handleAddPayment = (e) => {
    e.preventDefault();
    if (!paymentForm.startDate || !paymentForm.endDate) return toast.error('Select a payment date range');
    if (paymentForm.startDate > paymentForm.endDate) return toast.error('From date cannot be after To date');
    if (!paymentAmount || paymentAmount <= 0) return toast.error('Enter a valid payment amount');
    if (rangeDue <= 0) return toast.error('No due amount in this date range');
    if (paymentAmount > rangeDue) return toast.error('Payment cannot be greater than selected range due');

    onAddPayment({ ownerId: owner.id, ...paymentForm, amount: paymentAmount });
    setPaymentForm(f => ({ ...f, amount: '', notes: '' }));
  };

  return (
    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
      <h4 style={{ margin: '0 0 12px', fontSize: '15px' }}>Daily Worker Management for {owner.name}</h4>

      <form onSubmit={handleAddPayment} style={{ background: 'var(--surface)', borderRadius: '10px', padding: '12px', border: '1px solid var(--border)', marginBottom: '14px' }}>
        <h5 style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--text-muted)' }}>Add Date Range Payment</h5>
        <div style={fieldStyle}>
          <div><label style={modalLabelStyle}>From</label><input type="date" value={paymentForm.startDate} onChange={e => setPaymentForm(f => ({ ...f, startDate: e.target.value }))} style={modalInputStyle} /></div>
          <div><label style={modalLabelStyle}>To</label><input type="date" value={paymentForm.endDate} onChange={e => setPaymentForm(f => ({ ...f, endDate: e.target.value }))} style={modalInputStyle} /></div>
          <div><label style={modalLabelStyle}>Paid On</label><input type="date" value={paymentForm.paymentDate} onChange={e => setPaymentForm(f => ({ ...f, paymentDate: e.target.value }))} style={modalInputStyle} /></div>
        </div>
        <div style={fieldStyle}>
          <div><label style={modalLabelStyle}>Amount</label><input type="number" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} max={rangeDue || undefined} placeholder="0" style={modalInputStyle} /></div>
          <div>
            <label style={modalLabelStyle}>Method</label>
            <select value={paymentForm.paymentMethod} onChange={e => setPaymentForm(f => ({ ...f, paymentMethod: e.target.value }))} style={modalInputStyle}>
              {['Cash', 'Bank', 'UPI'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div><label style={modalLabelStyle}>Notes</label><input type="text" value={paymentForm.notes} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" style={modalInputStyle} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Selected range due: <b style={{ color: rangeDue > 0 ? '#ef4444' : '#10b981' }}>{formatCurrency(rangeDue)}</b></span>
          <button type="submit" disabled={isAddingPayment} style={{ padding: '9px 12px', background: '#10b981', border: 'none', borderRadius: '8px', cursor: isAddingPayment ? 'not-allowed' : 'pointer', color: 'white', fontWeight: '700', fontSize: '12px', opacity: isAddingPayment ? 0.7 : 1 }}>
            {isAddingPayment ? 'Adding...' : 'Add Payment'}
          </button>
        </div>
      </form>

      <input type="text" placeholder="Search by date (YYYY-MM-DD)..." value={search} onChange={e => setSearch(e.target.value)} style={searchBarStyle} />

      <h5 style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text-muted)' }}>Summaries ({filteredData.length})</h5>
      {filteredData.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No records found.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredData.map(record => (
            <div key={record.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', borderRadius: '8px', padding: '10px 12px' }}>
              <div>
                <p style={{ margin: 0, fontWeight: '700', fontSize: '14px' }}>{fmtDate(record.date)}</p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                  {record.totalWorkers} workers, Wage: {formatCurrency(record.totalWage)}, Paid: {formatCurrency(record.totalPaid)}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => onEdit(record)} style={{ padding: '6px 10px', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text)', fontWeight: '700', fontSize: '12px' }}>Edit</button>
                <button onClick={() => onDelete(record.id)} style={{ padding: '6px 10px', background: '#fee2e2', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#991b1b', fontWeight: '700', fontSize: '12px' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h5 style={{ margin: '16px 0 8px', fontSize: '13px', color: 'var(--text-muted)' }}>Payments ({filteredPayments.length})</h5>
      {filteredPayments.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>No payments found.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredPayments.map(payment => (
            <div key={payment.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', borderRadius: '8px', padding: '10px 12px' }}>
              <div>
                <p style={{ margin: 0, fontWeight: '700', fontSize: '14px' }}>{formatCurrency(payment.amount)}</p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                  {fmtDate(payment.startDate)} - {fmtDate(payment.endDate)} · Paid on {fmtDate(payment.paymentDate)} · {payment.paymentMethod || 'Cash'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => onEditPayment(payment)} style={{ padding: '6px 10px', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text)', fontWeight: '700', fontSize: '12px' }}>Edit</button>
                <button onClick={() => onDeletePayment(payment.id)} style={{ padding: '6px 10px', background: '#fee2e2', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#991b1b', fontWeight: '700', fontSize: '12px' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DailySummaryEditModal({ summary, onClose, onSave, isLoading }) {
  const [form, setForm] = useState({
    date: summary.date,
    totalWorkers: summary.totalWorkers,
    dailyAmount: summary.dailyAmount,
    totalPaid: summary.totalPaid,
  });

  const handleSave = () => {
    onSave(summary.id, form);
  };

  const modalStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const contentStyle = { background: 'var(--surface)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow)' };
  const inputStyle = { width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' };
  const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '700' };

  return (
    <div style={modalStyle}>
      <div style={contentStyle}>
        <h3 style={{ margin: '0 0 16px', fontWeight: '800' }}>Edit Daily Summary</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div><label style={labelStyle}>Date</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>Total Workers</label><input type="number" value={form.totalWorkers} onChange={e => setForm(f => ({ ...f, totalWorkers: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>Daily Rate</label><input type="number" value={form.dailyAmount} onChange={e => setForm(f => ({ ...f, dailyAmount: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>Total Paid</label><input type="number" value={form.totalPaid} onChange={e => setForm(f => ({ ...f, totalPaid: e.target.value }))} style={inputStyle} /></div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={isLoading} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #0ea5e9, #10b981)', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '700', cursor: 'pointer' }}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DailyPaymentEditModal({ payment, onClose, onSave, isLoading }) {
  const [form, setForm] = useState({
    startDate: payment.startDate,
    endDate: payment.endDate,
    paymentDate: payment.paymentDate,
    amount: payment.amount,
    paymentMethod: payment.paymentMethod || 'Cash',
    notes: payment.notes || '',
  });

  const handleSave = () => {
    const amount = parseFloat(form.amount);
    if (!form.startDate || !form.endDate || !form.paymentDate) return toast.error('Fill all dates');
    if (form.startDate > form.endDate) return toast.error('From date cannot be after To date');
    if (!amount || amount <= 0) return toast.error('Enter a valid payment amount');
    onSave(payment.id, { ...form, amount });
  };

  return (
    <div style={modalStyle}>
      <div style={modalContentStyle}>
        <h3 style={{ margin: '0 0 16px', fontWeight: '800' }}>Edit Daily Worker Payment</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div><label style={modalLabelStyle}>From</label><input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={modalInputStyle} /></div>
          <div><label style={modalLabelStyle}>To</label><input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} style={modalInputStyle} /></div>
          <div><label style={modalLabelStyle}>Paid On</label><input type="date" value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} style={modalInputStyle} /></div>
          <div><label style={modalLabelStyle}>Amount</label><input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={modalInputStyle} /></div>
          <div>
            <label style={modalLabelStyle}>Payment Method</label>
            <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))} style={modalInputStyle}>
              {['Cash', 'Bank', 'UPI'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div><label style={modalLabelStyle}>Notes</label><input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={modalInputStyle} /></div>
        </div>
        <ModalActions onClose={onClose} onSave={handleSave} isLoading={isLoading} />
      </div>
    </div>
  );
}

function DieselManager({ owner, dieselData, loading, onEditPump, onDeletePump, onEditPurchase, onDeletePurchase, onEditPayment, onDeletePayment }) {
  const [pumpSearch, setPumpSearch] = useState('');
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>Loading Diesel Data...</div>;
  }

  if (!dieselData) {
    return <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>No diesel data found for {owner.name}.</div>;
  }

  const { pumps, purchases, payments } = dieselData;

  const filteredPumps = pumps.filter(p => p.name.toLowerCase().includes(pumpSearch.toLowerCase()));
  const filteredPurchases = purchases.filter(p => {
    const pump = pumps.find(pump => pump.id === p.petrol_pump_id);
    return pump?.name.toLowerCase().includes(purchaseSearch.toLowerCase()) || (p.slip_number && p.slip_number.includes(purchaseSearch));
  });
  const filteredPayments = payments.filter(p => {
    const pump = pumps.find(pump => pump.id === p.petrol_pump_id);
    return pump?.name.toLowerCase().includes(paymentSearch.toLowerCase());
  });

  const searchBarStyle = {
    width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid var(--border)',
    background: 'var(--surface2)', color: 'var(--text)', fontFamily: 'inherit',
    boxSizing: 'border-box', marginBottom: '12px'
  };

  return (
    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
      <h4 style={{ margin: '0 0 12px', fontSize: '15px' }}>Diesel Management for {owner.name}</h4>

      {/* Pumps List */}
      <div style={{ marginBottom: '16px' }}>
        <h5 style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text-muted)' }}>Pumps ({filteredPumps.length})</h5>
        <input type="text" placeholder="Search pumps..." value={pumpSearch} onChange={e => setPumpSearch(e.target.value)} style={searchBarStyle} />
        {filteredPumps.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No pumps found.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredPumps.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'var(--surface)', borderRadius: '8px', padding: '12px' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '14px' }}>{p.name}</p>
                  {p.owner_name && <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>👤 {p.owner_name}</p>}
                  {p.contact_number && <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>📞 {p.contact_number}</p>}
                  {p.address && <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>📍 {p.address}</p>}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0, marginLeft: '10px' }}>
                  <button onClick={() => onEditPump(p)} style={{ padding: '6px 10px', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text)', fontWeight: '700', fontSize: '12px' }}>Edit</button>
                  <button onClick={() => onDeletePump(p.id)} style={{ padding: '6px 10px', background: '#fee2e2', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#991b1b', fontWeight: '700', fontSize: '12px' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Purchases List */}
      <div style={{ marginBottom: '16px' }}>
        <h5 style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text-muted)' }}>Purchases ({filteredPurchases.length})</h5>
        <input type="text" placeholder="Search by pump or slip..." value={purchaseSearch} onChange={e => setPurchaseSearch(e.target.value)} style={searchBarStyle} />
        {filteredPurchases.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No purchases found.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredPurchases.map(p => {
              const pump = pumps.find(pump => pump.id === p.petrol_pump_id);
              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', borderRadius: '8px', padding: '10px 12px' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: '700', fontSize: '14px' }}>{formatCurrency(p.amount)}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>From {pump?.name || 'Unknown'} on {fmtDate(p.date)}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => onEditPurchase(p)} style={{ padding: '6px 10px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text)', fontWeight: '700', fontSize: '12px' }}>Edit</button>
                    <button onClick={() => onDeletePurchase(p.id)} style={{ padding: '6px 10px', background: '#fee2e2', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#991b1b', fontWeight: '700', fontSize: '12px' }}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payments List */}
      <div>
        <h5 style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text-muted)' }}>Payments ({filteredPayments.length})</h5>
        <input type="text" placeholder="Search by pump name..." value={paymentSearch} onChange={e => setPaymentSearch(e.target.value)} style={searchBarStyle} />
        {filteredPayments.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No payments found.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredPayments.map(p => {
              const pump = pumps.find(pump => pump.id === p.petrol_pump_id);
              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', borderRadius: '8px', padding: '10px 12px' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: '700', fontSize: '14px' }}>{formatCurrency(p.amount)}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>To {pump?.name || 'Unknown'} on {fmtDate(p.payment_date)}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => onEditPayment(p)} style={{ padding: '6px 10px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text)', fontWeight: '700', fontSize: '12px' }}>Edit</button>
                    <button onClick={() => onDeletePayment(p.id)} style={{ padding: '6px 10px', background: '#fee2e2', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#991b1b', fontWeight: '700', fontSize: '12px' }}>Delete</button>
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

function DieselPurchaseEditModal({ purchase, pumps, onClose, onSave, isLoading }) {
  const [form, setForm] = useState({
    petrol_pump_id: purchase.petrol_pump_id,
    date: purchase.date,
    slip_number: purchase.slip_number,
    amount: purchase.amount,
    notes: purchase.notes || '',
  });

  const handleSave = () => {
    onSave(purchase.id, form);
  };

  const modalStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const contentStyle = { background: 'var(--surface)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow)' };
  const inputStyle = { width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' };
  const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '700' };

  return (
    <div style={modalStyle}>
      <div style={contentStyle}>
        <h3 style={{ margin: '0 0 16px', fontWeight: '800' }}>Edit Diesel Purchase</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Pump</label>
            <select value={form.petrol_pump_id} onChange={e => setForm(f => ({ ...f, petrol_pump_id: e.target.value }))} style={inputStyle}>
              {pumps.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div><label style={labelStyle}>Date</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>Slip Number</label><input type="text" value={form.slip_number} onChange={e => setForm(f => ({ ...f, slip_number: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>Amount</label><input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>Notes</label><input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={inputStyle} /></div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={isLoading} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #0ea5e9, #10b981)', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '700', cursor: 'pointer' }}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DieselPaymentEditModal({ payment, pumps, onClose, onSave, isLoading }) {
  const [form, setForm] = useState({
    petrol_pump_id: payment.petrol_pump_id,
    payment_date: payment.payment_date,
    amount: payment.amount,
    payment_method: payment.payment_method,
    notes: payment.notes || '',
  });

  const handleSave = () => {
    onSave(payment.id, form);
  };

  const modalStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const contentStyle = { background: 'var(--surface)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow)' };
  const inputStyle = { width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' };
  const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '700' };

  return (
    <div style={modalStyle}>
      <div style={contentStyle}>
        <h3 style={{ margin: '0 0 16px', fontWeight: '800' }}>Edit Diesel Payment</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Pump</label>
            <select value={form.petrol_pump_id} onChange={e => setForm(f => ({ ...f, petrol_pump_id: e.target.value }))} style={inputStyle}>
              {pumps.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div><label style={labelStyle}>Payment Date</label><input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>Amount</label><input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={inputStyle} /></div>
          <div>
            <label style={labelStyle}>Payment Method</label>
            <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} style={inputStyle}>
              {['Cash', 'Bank', 'UPI'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div><label style={labelStyle}>Notes</label><input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={inputStyle} /></div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={isLoading} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #0ea5e9, #10b981)', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '700', cursor: 'pointer' }}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FertilizerManager({ owner, fertilizerData, loading, onEditShopkeeper, onDeleteShopkeeper, onEditPurchase, onDeletePurchase, onEditPayment, onDeletePayment }) {
  const [search, setSearch] = useState('');

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>Loading Fertilizer Data...</div>;
  }

  if (!fertilizerData || !fertilizerData.shopkeepers || fertilizerData.shopkeepers.length === 0) {
    return <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>No fertilizer data found for {owner.name}.</div>;
  }

  const { shopkeepers, purchases, payments } = fertilizerData;

  const filteredShopkeepers = shopkeepers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const searchBarStyle = {
    width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid var(--border)',
    background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit',
    boxSizing: 'border-box', marginBottom: '12px'
  };

  return (
    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
      <h4 style={{ margin: '0 0 12px', fontSize: '15px' }}>Fertilizer Management for {owner.name}</h4>
      <input type="text" placeholder="Search by shopkeeper name..." value={search} onChange={e => setSearch(e.target.value)} style={searchBarStyle} />

      {filteredShopkeepers.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No shopkeepers found.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredShopkeepers.map(shop => {
            const shopPurchases = purchases.filter(p => p.FertilizerShopkeeperId === shop.id);
            const shopPayments = payments.filter(p => p.FertilizerShopkeeperId === shop.id);
            return (
              <div key={shop.id} style={{ background: 'var(--surface)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border)' }}>
                {/* Shopkeeper Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: '700', fontSize: '16px' }}>{shop.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{shop.address || 'No address'}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => onEditShopkeeper(shop)} style={{ padding: '6px 10px', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text)', fontWeight: '700', fontSize: '12px' }}>Edit Shop</button>
                    <button onClick={() => onDeleteShopkeeper(shop.id)} style={{ padding: '6px 10px', background: '#fee2e2', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#991b1b', fontWeight: '700', fontSize: '12px' }}>Delete Shop</button>
                  </div>
                </div>

                {/* Purchases for this shop */}
                <div style={{ marginTop: '12px' }}>
                  <h6 style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text-muted)' }}>Purchases ({shopPurchases.length})</h6>
                  {shopPurchases.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No purchases.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {shopPurchases.map(p => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface2)', borderRadius: '8px', padding: '10px 12px' }}>
                          <div>
                            <p style={{ margin: 0, fontWeight: '700', fontSize: '14px' }}>{formatCurrency(p.total_amount)}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>On {fmtDate(p.date)}</p>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => onEditPurchase(p)} style={{ padding: '6px 10px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text)', fontWeight: '700', fontSize: '12px' }}>Edit</button>
                            <button onClick={() => onDeletePurchase(p.id)} style={{ padding: '6px 10px', background: '#fee2e2', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#991b1b', fontWeight: '700', fontSize: '12px' }}>Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payments for this shop */}
                <div style={{ marginTop: '12px' }}>
                  <h6 style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text-muted)' }}>Payments ({shopPayments.length})</h6>
                  {shopPayments.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No payments.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {shopPayments.map(p => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface2)', borderRadius: '8px', padding: '10px 12px' }}>
                          <div>
                            <p style={{ margin: 0, fontWeight: '700', fontSize: '14px' }}>{formatCurrency(p.amount_paid)}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>On {fmtDate(p.date)}</p>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => onEditPayment(p)} style={{ padding: '6px 10px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text)', fontWeight: '700', fontSize: '12px' }}>Edit</button>
                            <button onClick={() => onDeletePayment(p.id)} style={{ padding: '6px 10px', background: '#fee2e2', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#991b1b', fontWeight: '700', fontSize: '12px' }}>Delete</button>
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

// Modal component for editing payments
function PaymentEditModal({ payment, shopkeepers, onClose, onSave, isLoading }) {
  const [form, setForm] = useState({
    shopkeeper_id: payment.FertilizerShopkeeperId,
    date: payment.date,
    amount_paid: payment.amount_paid,
    notes: payment.notes || '',
  });

  const handleSave = () => {
    onSave(payment.id, form);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow)' }}>
        <h3 style={{ margin: '0 0 16px', fontWeight: '800' }}>Edit Payment</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '700' }}>Shopkeeper</label>
            <select value={form.shopkeeper_id} onChange={e => setForm(f => ({ ...f, shopkeeper_id: e.target.value }))} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid var(--border)' }}>
              {shopkeepers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '700' }}>Date</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid var(--border)' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '700' }}>Amount Paid</label>
            <input type="number" value={form.amount_paid} onChange={e => setForm(f => ({ ...f, amount_paid: e.target.value }))} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid var(--border)' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '700' }}>Notes</label>
            <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid var(--border)' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={isLoading} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #0ea5e9, #10b981)', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '700', cursor: 'pointer' }}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal component for editing purchases
function PurchaseEditModal({ purchase, shopkeepers, onClose, onSave, isLoading }) {
  const [form, setForm] = useState({
    shopkeeper_id: purchase.FertilizerShopkeeperId,
    date: purchase.date,
    notes: purchase.notes || '',
  });
  const [items, setItems] = useState(purchase.items.map(item => ({
    id: item.id,
    name: item.item_name,
    quantity: item.quantity,
    rate: item.rate,
  })));

  const totalAmount = items.reduce((sum, item) => sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0)), 0);

  const handleItemChange = (id, field, value) => {
    setItems(currentItems => currentItems.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleSave = () => {
    const payload = {
      ...form,
      total_amount: totalAmount,
      items: JSON.stringify(items),
    };
    onSave(purchase.id, payload);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '520px', boxShadow: 'var(--shadow)', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 16px', fontWeight: '800' }}>Edit Purchase</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '700' }}>Shopkeeper</label>
            <select value={form.shopkeeper_id} onChange={e => setForm(f => ({ ...f, shopkeeper_id: e.target.value }))} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid var(--border)' }}>
              {shopkeepers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '700' }}>Date</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid var(--border)' }} />
          </div>
          <h4 style={{ margin: '8px 0 0', fontSize: '13px', fontWeight: '700' }}>Items</h4>
          {items.map(item => (
            <div key={item.id} style={{ background: 'var(--surface2)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <input type="text" value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} placeholder="Item Name" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1.5px solid var(--border)', marginBottom: '8px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input type="number" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', e.target.value)} placeholder="Quantity" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1.5px solid var(--border)' }} />
                <input type="number" value={item.rate} onChange={e => handleItemChange(item.id, 'rate', e.target.value)} placeholder="Rate" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1.5px solid var(--border)' }} />
              </div>
            </div>
          ))}
          <p style={{ fontWeight: '800', fontSize: '16px', textAlign: 'right' }}>Total: {formatCurrency(totalAmount)}</p>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '700' }}>Notes</label>
            <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid var(--border)' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={isLoading} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #0ea5e9, #10b981)', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '700', cursor: 'pointer' }}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LandRecordEditModal({ record, landOwners, onClose, onSave, isLoading }) {
  const convertLandMeasurementToUnits = (landValue) => {
    const landStr = String(landValue || '0');
    const parts = landStr.split('.');
    const integerPart = parseInt(parts[0], 10) || 0;
    const decimalStr = parts[1] || '0';
    const decimalPart = parseInt(decimalStr, 10) || 0;
    return (integerPart * 20) + decimalPart;
  };

  const [form, setForm] = useState({
    landOwnerId: record.landOwnerId,
    landMeasurement: record.landMeasurement,
    total_land_price: (parseFloat(record.pricePerUnit) || 0) * 20,
    notes: record.notes || '',
  });

  const handleSave = () => {
    const unitPrice = (parseFloat(form.total_land_price) || 0) / 20;
    const convertedUnits = convertLandMeasurementToUnits(form.landMeasurement);
    const totalAmount = convertedUnits * unitPrice;
    onSave(record.id, {
      landOwnerId: form.landOwnerId,
      landMeasurement: form.landMeasurement,
      pricePerUnit: unitPrice,
      notes: form.notes,
      convertedUnits,
      totalAmount,
    });
  };

  const modalStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const contentStyle = { background: 'var(--surface)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow)' };
  const inputStyle = { width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' };
  const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '700' };
  const calculatedBoxStyle = { background: 'var(--surface2)', borderRadius: '10px', padding: '10px', textAlign: 'center', border: '1px solid var(--border)' };

  return (
    <div style={modalStyle}>
      <div style={contentStyle}>
        <h3 style={{ margin: '0 0 16px', fontWeight: '800' }}>Edit Land Record</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div><label style={labelStyle}>Land Owner</label><select value={form.landOwnerId} onChange={e => setForm(f => ({ ...f, landOwnerId: e.target.value }))} style={inputStyle}>{landOwners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
          <div>
            <label style={labelStyle}>Total Land Price (for 20 units)</label>
            <input type="number" value={form.total_land_price} onChange={e => setForm(f => ({ ...f, total_land_price: e.target.value }))} style={inputStyle} />
          </div>
          {form.total_land_price > 0 && (
            <div style={calculatedBoxStyle}>
              <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)' }}>CALCULATED PRICE PER UNIT</p>
              <p style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#b45309' }}>{formatCurrency((parseFloat(form.total_land_price) || 0) / 20)}</p>
            </div>
          )}
          <div><label style={labelStyle}>Land Measurement</label><input type="number" step="0.01" value={form.landMeasurement} onChange={e => setForm(f => ({ ...f, landMeasurement: e.target.value }))} style={inputStyle} /></div>
          {form.landMeasurement > 0 && (
            <div style={calculatedBoxStyle}>
              <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)' }}>CONVERTED UNITS</p>
              <p style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#f59e0b' }}>{convertLandMeasurementToUnits(form.landMeasurement)}</p>
            </div>
          )}
          {form.landMeasurement > 0 && form.total_land_price > 0 && (
            <div style={calculatedBoxStyle}>
              <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)' }}>FINAL AMOUNT</p>
              <p style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#10b981' }}>{formatCurrency(convertLandMeasurementToUnits(form.landMeasurement) * ((parseFloat(form.total_land_price) || 0) / 20))}</p>
            </div>
          )}
          <div><label style={labelStyle}>Notes</label><input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={inputStyle} /></div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={isLoading} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #0ea5e9, #10b981)', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '700', cursor: 'pointer' }}>{isLoading ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}

function LandPaymentEditModal({ payment, landOwners, onClose, onSave, isLoading }) {
  const [form, setForm] = useState({
    landOwnerId: payment.landOwnerId,
    date: payment.date,
    amountPaid: payment.amountPaid,
    paymentMethod: payment.paymentMethod,
    notes: payment.notes || '',
  });

  const handleSave = () => {
    onSave(payment.id, form);
  };

  const modalStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const contentStyle = { background: 'var(--surface)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow)' };
  const inputStyle = { width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' };
  const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '700' };

  return (
    <div style={modalStyle}>
      <div style={contentStyle}>
        <h3 style={{ margin: '0 0 16px', fontWeight: '800' }}>Edit Land Payment</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div><label style={labelStyle}>Land Owner</label><select value={form.landOwnerId} onChange={e => setForm(f => ({ ...f, landOwnerId: e.target.value }))} style={inputStyle}>{landOwners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
          <div><label style={labelStyle}>Date</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>Amount Paid</label><input type="number" value={form.amountPaid} onChange={e => setForm(f => ({ ...f, amountPaid: e.target.value }))} style={inputStyle} /></div>
          <div>
            <label style={labelStyle}>Payment Method</label>
            <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))} style={inputStyle}>
              {['Cash', 'UPI', 'Bank Transfer'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div><label style={labelStyle}>Notes</label><input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={inputStyle} /></div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={isLoading} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #0ea5e9, #10b981)', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '700', cursor: 'pointer' }}>{isLoading ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}

function TenantManager({ owner, tenantData, loading, onEditLandOwner, onDeleteLandOwner, onEditLandRecord, onDeleteLandRecord, onEditLandPayment, onDeletePayment }) {
  const [search, setSearch] = useState('');

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>Loading Tenant Data...</div>;
  }

  if (!tenantData || !tenantData.owners || tenantData.owners.length === 0) {
    return <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>No tenant data found for {owner.name}.</div>;
  }

  const { owners: landOwners, lands: landRecords, payments: landPayments } = tenantData;

  const filteredLandOwners = landOwners.filter(lo =>
    lo.name.toLowerCase().includes(search.toLowerCase()) || (lo.village || '').toLowerCase().includes(search.toLowerCase())
  );

  const searchBarStyle = {
    width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid var(--border)',
    background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit',
    boxSizing: 'border-box', marginBottom: '12px'
  };

  return (
    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
      <h4 style={{ margin: '0 0 12px', fontSize: '15px' }}>Tenant Management for {owner.name}</h4>
      <input type="text" placeholder="Search by land owner name or village..." value={search} onChange={e => setSearch(e.target.value)} style={searchBarStyle} />

      {filteredLandOwners.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No land owners found.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredLandOwners.map(landOwner => {
            const ownerRecords = landRecords.filter(lr => lr.landOwnerId === landOwner.id);
            const ownerPayments = landPayments.filter(p => p.landOwnerId === landOwner.id);
            return (
              <div key={landOwner.id} style={{ background: 'var(--surface)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border)' }}>
                {/* Land Owner Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: '700', fontSize: '16px' }}>{landOwner.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{landOwner.village || 'No village'}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => onEditLandOwner(landOwner)} style={{ padding: '6px 10px', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text)', fontWeight: '700', fontSize: '12px' }}>Edit Owner</button>
                    <button onClick={() => onDeleteLandOwner(landOwner.id)} style={{ padding: '6px 10px', background: '#fee2e2', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#991b1b', fontWeight: '700', fontSize: '12px' }}>Delete Owner</button>
                  </div>
                </div>

                {/* Land Records for this owner */}
                <div style={{ marginTop: '12px' }}>
                  <h6 style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text-muted)' }}>Land Records ({ownerRecords.length})</h6>
                  {ownerRecords.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No records.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {ownerRecords.map(lr => (
                        <div key={lr.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface2)', borderRadius: '8px', padding: '10px 12px' }}>
                          <div>
                            <p style={{ margin: 0, fontWeight: '700', fontSize: '14px' }}>{formatCurrency(lr.totalAmount)}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>{lr.landMeasurement} land ({lr.convertedUnits} units)</p>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => onEditLandRecord(lr)} style={{ padding: '6px 10px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text)', fontWeight: '700', fontSize: '12px' }}>Edit</button>
                            <button onClick={() => onDeleteLandRecord(lr.id)} style={{ padding: '6px 10px', background: '#fee2e2', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#991b1b', fontWeight: '700', fontSize: '12px' }}>Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payments for this owner */}
                <div style={{ marginTop: '12px' }}>
                  <h6 style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text-muted)' }}>Payments ({ownerPayments.length})</h6>
                  {ownerPayments.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No payments.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {ownerPayments.map(p => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface2)', borderRadius: '8px', padding: '10px 12px' }}>
                          <div>
                            <p style={{ margin: 0, fontWeight: '700', fontSize: '14px' }}>{formatCurrency(p.amountPaid)}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>On {fmtDate(p.date)}</p>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => onEditLandPayment(p)} style={{ padding: '6px 10px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text)', fontWeight: '700', fontSize: '12px' }}>Edit</button>
                            <button onClick={() => onDeletePayment(p.id)} style={{ padding: '6px 10px', background: '#fee2e2', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#991b1b', fontWeight: '700', fontSize: '12px' }}>Delete</button>
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
