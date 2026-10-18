import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../utils/api';
import { formatCurrency, formatDate, getTodayDate } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function DailySummaryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // ─── TOP SECTION TAB: 'attendance' or 'groups' ───
  const [activeTab, setActiveTab] = useState('attendance');

  const [date, setDate] = useState(getTodayDate());
  const [totalPaid, setTotalPaid] = useState('');

  // ─── PERMANENT STORED GROUPS STATE ───
  const [storedGroups, setStoredGroups] = useState([]);
  const [loadingStoredGroups, setLoadingStoredGroups] = useState(false);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null); // { id, name, defaultDailyRate }
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupRate, setNewGroupRate] = useState('400');

  // ─── ADMIN OWNER SCOPING (STRICT ISOLATION) ───
  const [managedOwners, setManagedOwners] = useState([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState(null);
  const [loadingOwners, setLoadingOwners] = useState(false);

  // ─── ACTIVE NEW GROUPS CURRENTLY BEING ENTERED (NOT YET SUBMITTED) ───
  const [activeNewGroups, setActiveNewGroups] = useState([]);

  // ─── ADMIN EDITING AN ALREADY SUBMITTED GROUP ───
  const [adminEditingGroup, setAdminEditingGroup] = useState(null);

  // ─── PAYMENT DATE RANGE & HISTORY SEARCH STATE ───
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [paymentForm, setPaymentForm] = useState({ amount: '', paymentMethod: 'Cash', notes: '' });

  const [records, setRecords] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [expandedRecordId, setExpandedRecordId] = useState(null);
  const [selectedPayGroup, setSelectedPayGroup] = useState('');

  // Find existing record for current date
  const existingRecord = useMemo(() => {
    return records.find(r => r.date === date) || null;
  }, [records, date]);

  // Groups already submitted for the current date
  const submittedGroups = useMemo(() => {
    return (existingRecord && Array.isArray(existingRecord.groups)) ? existingRecord.groups : [];
  }, [existingRecord]);

  // Stored groups that have NOT yet submitted attendance for this date
  const unsubmittedStoredGroups = useMemo(() => {
    return storedGroups.filter(
      sg => !submittedGroups.some(eg => eg.name && eg.name.trim().toLowerCase() === sg.name.trim().toLowerCase()) &&
            !activeNewGroups.some(ag => ag.name && ag.name.trim().toLowerCase() === sg.name.trim().toLowerCase())
    );
  }, [storedGroups, submittedGroups, activeNewGroups]);

  // If Admin, fetch only the owners created by this specific admin
  useEffect(() => {
    if (!isAdmin) return;
    setLoadingOwners(true);
    api.get('/admin/owners')
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : [];
        setManagedOwners(list);
        if (list.length > 0) {
          setSelectedOwnerId(list[0].id);
        }
      })
      .catch(err => {
        console.error('Failed to load managed owners for admin', err);
      })
      .finally(() => {
        setLoadingOwners(false);
      });
  }, [isAdmin]);

  // When owner selection changes (Admin mode), reset active entries & pay target
  useEffect(() => {
    setActiveNewGroups([]);
    setSelectedPayGroup('');
  }, [selectedOwnerId]);

  // When logged-in user changes (switching owner accounts), completely reset all page state
  useEffect(() => {
    setStoredGroups([]);
    setRecords([]);
    setPayments([]);
    setActiveNewGroups([]);
    setSelectedPayGroup('');
    setTotalPaid('');
  }, [user?.id]);

  // When date changes, reset active new entries
  useEffect(() => {
    setActiveNewGroups([]);
    if (existingRecord) {
      setTotalPaid(existingRecord.totalPaid || '');
    } else {
      setTotalPaid('');
    }
  }, [date, existingRecord]);

  // ─── COMPUTED TOTALS FOR ATTENDANCE ───
  const computed = useMemo(() => {
    let totalWorkers = 0;
    let totalWage = 0;

    // Add already submitted groups
    submittedGroups.forEach(g => {
      const rate = parseFloat(g.dailyRate !== undefined ? g.dailyRate : (g.dailyAmount || 0));
      const count = parseFloat(g.workerCount !== undefined ? g.workerCount : (g.totalWorkers || (Array.isArray(g.members) ? g.members.filter(m => m.attendance === 'present').length : 0))) || 0;
      totalWorkers += count;
      totalWage += (g.totalWage !== undefined ? parseFloat(g.totalWage) : (count * rate));
    });

    // Add active new groups being entered right now
    activeNewGroups.forEach(g => {
      const rate = parseFloat(g.dailyRate) || 0;
      const count = parseFloat(g.workerCount) || 0;
      totalWorkers += count;
      totalWage += (count * rate);
    });

    const paid = parseFloat(totalPaid) || (existingRecord ? parseFloat(existingRecord.totalPaid || 0) : 0);
    return {
      totalWorkers,
      avgRate: totalWorkers > 0 ? (totalWage / totalWorkers) : 0,
      totalWage,
      totalPaid: paid,
      remaining: Math.max(0, totalWage - paid),
    };
  }, [submittedGroups, activeNewGroups, totalPaid, existingRecord]);

  // Filter records for payment calculation by selected date range (or all if empty)
  const paymentRecords = useMemo(() => {
    if (!startDate && !endDate) return records;
    return records.filter(r => {
      if (startDate && r.date < startDate) return false;
      if (endDate && r.date > endDate) return false;
      return true;
    });
  }, [records, startDate, endDate]);

  const rangeTotals = useMemo(() => ({
    totalWage: paymentRecords.reduce((s, r) => s + parseFloat(r.totalWage || 0), 0),
    totalPaid: paymentRecords.reduce((s, r) => s + parseFloat(r.totalPaid || 0), 0),
    totalDue: paymentRecords.reduce((s, r) => s + parseFloat(r.remaining || 0), 0),
  }), [paymentRecords]);

  // Aggregate stats per distinct work group across active date range
  const rangeGroups = useMemo(() => {
    const map = new Map();
    paymentRecords.forEach(r => {
      if (Array.isArray(r.groups)) {
        r.groups.forEach(g => {
          const name = (g.name || '').trim();
          if (!name) return;
          const key = name.toLowerCase();
          const count = parseFloat(g.workerCount !== undefined ? g.workerCount : (Array.isArray(g.members) ? g.members.filter(m => m.attendance === 'present').length : g.totalWorkers)) || 0;
          const rate = parseFloat(g.dailyRate !== undefined ? g.dailyRate : (g.dailyAmount || 0));
          const wage = parseFloat(g.totalWage !== undefined ? g.totalWage : (count * rate));
          const paid = parseFloat(g.totalPaid || 0);
          const due = g.remaining !== undefined ? Math.max(parseFloat(g.remaining || 0), 0) : Math.max(wage - paid, 0);

          if (!map.has(key)) {
            map.set(key, { name, totalWage: 0, totalPaid: 0, totalDue: 0, daysCount: 0 });
          }
          const item = map.get(key);
          item.totalWage += wage;
          item.totalPaid += paid;
          item.totalDue += due;
          item.daysCount += 1;
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.totalDue - a.totalDue);
  }, [paymentRecords]);

  // Filter all history records in real-time by search query
  const filteredHistoryRecords = useMemo(() => {
    if (!historySearch.trim()) return records;
    const q = historySearch.toLowerCase().trim();
    return records.filter(r => {
      const dStr = (r.date || '').toLowerCase();
      const formattedDStr = formatDate(r.date).toLowerCase();
      const groupNames = Array.isArray(r.groups) ? r.groups.map(g => (g.name || '').toLowerCase()).join(' ') : '';
      return dStr.includes(q) || formattedDStr.includes(q) || groupNames.includes(q);
    });
  }, [records, historySearch]);

  // Ensure default selected payment group is set to the first group with dues or first stored group
  useEffect(() => {
    if (!selectedPayGroup) {
      if (rangeGroups.length > 0) {
        const withDue = rangeGroups.find(g => g.totalDue > 0);
        setSelectedPayGroup(withDue ? withDue.name : rangeGroups[0].name);
      } else if (storedGroups.length > 0) {
        setSelectedPayGroup(storedGroups[0].name);
      }
    }
  }, [rangeGroups, storedGroups, selectedPayGroup]);

  // Target pay statistics for the selected group
  const activePayTarget = useMemo(() => {
    if (!selectedPayGroup) {
      return { name: 'Select a Group', totalWage: 0, totalPaid: 0, totalDue: 0 };
    }
    const found = rangeGroups.find(g => g.name.toLowerCase() === selectedPayGroup.toLowerCase());
    return found || {
      name: selectedPayGroup,
      totalWage: 0,
      totalPaid: 0,
      totalDue: 0,
    };
  }, [selectedPayGroup, rangeGroups]);

  // ─── FETCH STORED GROUPS ────────────────────────────────────────────────────
  const fetchStoredGroups = useCallback(async () => {
    if (isAdmin && !selectedOwnerId) return;
    setLoadingStoredGroups(true);
    try {
      const url = isAdmin && selectedOwnerId ? `/daily-worker/groups?ownerId=${selectedOwnerId}` : '/daily-worker/groups';
      const res = await api.get(url);
      if (Array.isArray(res.data)) {
        setStoredGroups(res.data);
      }
    } catch (e) {
      console.error('Failed to load stored groups', e);
    } finally {
      setLoadingStoredGroups(false);
    }
  }, [isAdmin, selectedOwnerId]);

  useEffect(() => {
    if (!isAdmin || selectedOwnerId) {
      fetchStoredGroups();
    }
  }, [fetchStoredGroups, isAdmin, selectedOwnerId]);

  // ─── FETCH ALL HISTORY & PAYMENTS ──────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    if (isAdmin && !selectedOwnerId) return;
    setLoading(true);
    try {
      const ownerParam = (isAdmin && selectedOwnerId) ? `?ownerId=${selectedOwnerId}` : '';
      const [recordsRes, paymentsRes] = await Promise.all([
        api.get(`/daily-worker${ownerParam}`),
        api.get(`/daily-worker/payments${ownerParam}`)
      ]);
      setRecords(recordsRes.data);
      setPayments(paymentsRes.data);
    } catch (e) {
      toast.error('Failed to load daily worker history');
    }
    setLoading(false);
  }, [isAdmin, selectedOwnerId]);

  useEffect(() => {
    if (!isAdmin || selectedOwnerId) {
      fetchRecords();
    }
  }, [fetchRecords, isAdmin, selectedOwnerId]);

  // ─── STORED GROUP CRUD ACTIONS ──────────────────────────────────────────────
  const handleCreateStoredGroup = async (e) => {
    if (e) e.preventDefault();
    const name = newGroupName.trim();
    if (!name) return toast.error('Enter a group name');
    const rate = parseFloat(newGroupRate) || 400;

    try {
      const res = await api.post('/daily-worker/groups', {
        name,
        defaultDailyRate: rate,
        ...(isAdmin && selectedOwnerId ? { ownerId: selectedOwnerId } : {})
      });
      const created = res.data;
      setStoredGroups(prev => [...prev, created]);
      setNewGroupName('');
      setNewGroupRate('400');
      setShowAddGroupModal(false);
      toast.success(`Group "${name}" created successfully!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create group');
    }
  };

  // Only Admin can update
  const handleUpdateStoredGroup = async (e) => {
    if (e) e.preventDefault();
    if (!isAdmin) {
      return toast.error('Only an Admin can edit or update created groups.');
    }
    if (!editingGroup) return;
    const name = (editingGroup.name || '').trim();
    if (!name) return toast.error('Enter group name');
    const rate = parseFloat(editingGroup.defaultDailyRate) || 400;

    try {
      const res = await api.put(`/daily-worker/groups/${editingGroup.id}`, {
        name,
        defaultDailyRate: rate
      });
      setStoredGroups(prev => prev.map(g => g.id === editingGroup.id ? res.data : g));
      setEditingGroup(null);
      toast.success(`Group "${name}" updated!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update group');
    }
  };

  // Only Admin can delete
  const deletePermanentGroup = async (storedId, name) => {
    if (!isAdmin) {
      return toast.error('Only an Admin can delete created groups.');
    }
    if (!window.confirm(`Permanently delete group "${name}"? It will be removed from stored groups.`)) return;
    try {
      await api.delete(`/daily-worker/groups/${storedId}`);
      setStoredGroups(prev => prev.filter(g => g.id !== storedId));
      toast.success(`Group "${name}" deleted`);
    } catch (e) {
      toast.error('Failed to delete group');
    }
  };

  // ─── DAILY ATTENDANCE GROUP SELECTION & ENTRY ──────────────────────────────
  const handleSelectGroupForToday = (storedGroupId) => {
    if (!storedGroupId) return;

    const sg = storedGroups.find(g => String(g.id) === String(storedGroupId));
    if (!sg) return;

    // Check if already in submitted groups
    const alreadySubmitted = submittedGroups.some(eg => eg.name && eg.name.trim().toLowerCase() === sg.name.trim().toLowerCase());
    if (alreadySubmitted) {
      return toast.error(`Group "${sg.name}" has already submitted attendance for today (Blocked).`);
    }

    // Check if already in active new groups
    if (activeNewGroups.some(ag => ag.storedId === sg.id || ag.name.toLowerCase() === sg.name.toLowerCase())) {
      return toast('Group is already selected below.', { icon: 'ℹ️' });
    }

    setActiveNewGroups(prev => [
      ...prev,
      {
        id: `grp-${sg.id}-${Date.now()}`,
        storedId: sg.id,
        name: sg.name,
        dailyRate: parseFloat(sg.defaultDailyRate) || 400,
        workerCount: ''
      }
    ]);
  };

  const removeActiveNewGroup = (groupId) => {
    setActiveNewGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const updateActiveNewGroup = (groupId, field, value) => {
    setActiveNewGroups(prev => prev.map(g => g.id === groupId ? { ...g, [field]: value } : g));
  };

  // ─── SUBMIT ATTENDANCE FOR ACTIVE GROUP(S) ──────────────────────────────────
  const handleSubmitAttendance = async (groupToSubmit = null) => {
    const groupsSubmitting = groupToSubmit ? [groupToSubmit] : activeNewGroups;

    if (groupsSubmitting.length === 0) {
      return toast.error('Please select a group and enter worker attendance');
    }

    // Validate that worker count > 0
    for (const g of groupsSubmitting) {
      const count = parseFloat(g.workerCount) || 0;
      if (count <= 0) {
        return toast.error(`Please enter workers present for ${g.name}`);
      }
    }

    setSaving(true);
    try {
      // Build combined payload: all previously submitted groups + new groups
      const allGroupsPayload = [
        ...submittedGroups.map(eg => ({
          id: eg.id,
          name: eg.name,
          dailyRate: parseFloat(eg.dailyRate !== undefined ? eg.dailyRate : (eg.dailyAmount || 0)),
          workerCount: parseFloat(eg.workerCount !== undefined ? eg.workerCount : (eg.totalWorkers || 0)),
          totalPaid: parseFloat(eg.totalPaid || 0)
        })),
        ...groupsSubmitting.map(g => ({
          id: g.id,
          name: g.name.trim(),
          dailyRate: parseFloat(g.dailyRate) || 0,
          workerCount: parseFloat(g.workerCount) || 0,
        }))
      ];

      await api.post('/daily-worker', {
        date,
        totalPaid: parseFloat(totalPaid) || (existingRecord ? parseFloat(existingRecord.totalPaid || 0) : 0),
        groups: allGroupsPayload,
        ...(isAdmin && selectedOwnerId ? { ownerId: selectedOwnerId } : {})
      });

      const submittedNames = groupsSubmitting.map(g => g.name).join(', ');
      toast.success(`Attendance for ${submittedNames} submitted and blocked!`);

      // Remove the submitted groups from activeNewGroups
      const submittingIds = new Set(groupsSubmitting.map(g => g.id));
      setActiveNewGroups(prev => prev.filter(g => !submittingIds.has(g.id)));

      // Refresh records so the new group moves to submittedGroups
      await fetchRecords();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit attendance');
    }
    setSaving(false);
  };

  // ─── ADMIN EDIT SUBMITTED GROUP ─────────────────────────────────────────────
  const handleAdminUpdateSubmittedGroup = async (e) => {
    if (e) e.preventDefault();
    if (!isAdmin) return;
    if (!adminEditingGroup) return;

    setSaving(true);
    try {
      const updatedGroups = submittedGroups.map(g => {
        if (g.id === adminEditingGroup.id || g.name === adminEditingGroup.name) {
          return {
            ...g,
            workerCount: parseFloat(adminEditingGroup.workerCount) || 0,
            dailyRate: parseFloat(adminEditingGroup.dailyRate) || 0
          };
        }
        return g;
      });

      await api.post('/daily-worker', {
        date,
        totalPaid: parseFloat(totalPaid) || (existingRecord ? parseFloat(existingRecord.totalPaid || 0) : 0),
        groups: updatedGroups,
        ...(isAdmin && selectedOwnerId ? { ownerId: selectedOwnerId } : {})
      });

      toast.success(`Group "${adminEditingGroup.name}" updated by Admin!`);
      setAdminEditingGroup(null);
      await fetchRecords();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Admin update failed');
    }
    setSaving(false);
  };

  // ─── RECORD PAYMENT FOR SELECTED GROUP ──────────────────────────────────────
  const handlePayment = async (e) => {
    e.preventDefault();
    const amount = parseFloat(paymentForm.amount);
    if (startDate && endDate && startDate > endDate) return toast.error('From date cannot be after To date');
    if (!selectedPayGroup) return toast.error('Please select a group to proceed payment');
    if (!amount || amount <= 0) return toast.error('Enter a valid payment amount');
    if (activePayTarget.totalDue <= 0) return toast.error(`No due amount for group "${activePayTarget.name}" in this date range`);
    if (amount > activePayTarget.totalDue) return toast.error(`Payment cannot be greater than remaining due for "${activePayTarget.name}" (${formatCurrency(activePayTarget.totalDue)})`);

    setPaying(true);
    try {
      await api.post('/daily-worker/payment', {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        amount,
        date: getTodayDate(),
        paymentMethod: paymentForm.paymentMethod || 'Cash',
        notes: paymentForm.notes || '',
        groupName: selectedPayGroup,
        ...(isAdmin && selectedOwnerId ? { ownerId: selectedOwnerId } : {})
      });
      toast.success(`Payment of ${formatCurrency(amount)} recorded for ${selectedPayGroup}!`);
      setPaymentForm({ amount: '', paymentMethod: 'Cash', notes: '' });
      fetchRecords();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Payment failed');
    }
    setPaying(false);
  };

  return (
    <div className="daily-worker-page" style={{ maxWidth: '1000px', margin: '0 auto', boxSizing: 'border-box' }}>
      {/* ── CRISP SCOPED STYLING WITH 4px BORDER RADIUS FOR WHOLE PAGE ── */}
      <style>{`
        .daily-worker-page,
        .daily-worker-page .card,
        .daily-worker-page .stat-card,
        .daily-worker-page .modal-box,
        .daily-worker-page table,
        .daily-worker-page th,
        .daily-worker-page td,
        .daily-worker-page input,
        .daily-worker-page select,
        .daily-worker-page textarea,
        .daily-worker-page button,
        .daily-worker-page .badge,
        .daily-worker-page .tab-btn,
        .daily-worker-page .segment-btn {
          border-radius: 4px !important;
        }
      `}</style>

      {/* ── PAGE HEADER ── */}
      <div className="page-header" style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 className="page-title" style={{ margin: 0, fontSize: '22px', fontWeight: '900' }}>
                Daily Worker Section
              </h2>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              Manage daily labour attendance, created work groups, and group-wise payments
            </p>
          </div>
          {isAdmin && (
            <span style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', padding: '3px 7px', borderRadius: '3px', fontSize: '11px', fontWeight: '800' }}>
              🛡️ Admin Mode
            </span>
          )}
        </div>
      </div>

      {/* ── ADMIN OWNER SELECTOR (STRICT ISOLATION) ── */}
      {isAdmin && (
        <div style={{
          background: 'var(--surface)',
          border: '1.5px solid var(--primary)',
          borderRadius: '4px',
          padding: '10px 14px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🛡️</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text)' }}>
                Admin Mode: Managing Created Owner
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Only groups and attendance belonging to owners created by your admin account are accessible here.
              </div>
            </div>
          </div>

          {loadingOwners ? (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading owners…</span>
          ) : managedOwners.length === 0 ? (
            <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: '700' }}>
              ⚠️ No owners found under your admin account. Please create an owner first.
            </span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                Select Owner:
              </label>
              <select
                value={selectedOwnerId || ''}
                onChange={e => setSelectedOwnerId(Number(e.target.value))}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {managedOwners.map(o => (
                  <option key={o.id} value={o.id}>
                    👤 {o.name || o.username} (ID: #{o.id})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ── 2 BUTTONS AT THE TOP (TABS) ── */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '16px',
        background: 'var(--surface2)',
        padding: '3px',
        borderRadius: '4px',
        border: '1px solid var(--border)',
        width: 'fit-content'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          style={{
            padding: '7px 16px',
            borderRadius: '4px',
            border: 'none',
            background: activeTab === 'attendance' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'attendance' ? 'white' : 'var(--text)',
            fontWeight: '800',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            boxShadow: activeTab === 'attendance' ? '0 1px 4px rgba(99, 102, 241, 0.3)' : 'none'
          }}
        >
          <span>📅</span> Daily Attendance
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('groups')}
          style={{
            padding: '7px 16px',
            borderRadius: '4px',
            border: 'none',
            background: activeTab === 'groups' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'groups' ? 'white' : 'var(--text)',
            fontWeight: '800',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            boxShadow: activeTab === 'groups' ? '0 1px 4px rgba(99, 102, 241, 0.3)' : 'none'
          }}
        >
          <span>👥</span> Groups Created
          <span style={{
            background: activeTab === 'groups' ? 'rgba(255,255,255,0.25)' : 'var(--surface)',
            color: activeTab === 'groups' ? 'white' : 'var(--primary)',
            padding: '1px 6px',
            borderRadius: '3px',
            fontSize: '11px',
            fontWeight: '800',
            border: activeTab === 'groups' ? 'none' : '1px solid var(--border)'
          }}>
            {storedGroups.length}
          </span>
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          VIEW 1: GROUPS CREATED TAB
          ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'groups' && (
        <div className="card" style={{ padding: '18px', marginBottom: '18px', borderRadius: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '18px' }}>👥</span>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: 'var(--text)' }}>
                  Groups Created ({storedGroups.length})
                </h3>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                Owners can create groups. <strong>Once created, only an Admin can edit or delete them.</strong>
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowAddGroupModal(prev => !prev);
                setEditingGroup(null);
              }}
              style={{
                padding: '7px 12px',
                background: 'var(--primary)',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                fontWeight: '800',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 1px 4px rgba(99, 102, 241, 0.25)'
              }}
            >
              <span>+</span> Create New Group
            </button>
          </div>

          {/* Create Group Form */}
          {showAddGroupModal && (
            <form onSubmit={handleCreateStoredGroup} style={{
              background: 'var(--surface2)',
              borderRadius: '4px',
              padding: '12px',
              border: '1.5px solid var(--primary)',
              marginBottom: '14px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: '800', fontSize: '12px', color: 'var(--primary)' }}>
                  ➕ Create New Group
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddGroupModal(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', fontWeight: '800' }}
                >
                  ✕
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Group Name (e.g. Group 1, Cutting Team, Harvest Group)"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: '180px',
                    padding: '7px 10px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    fontFamily: 'inherit'
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>Default Rate ₹:</label>
                  <input
                    type="number"
                    value={newGroupRate}
                    onChange={e => setNewGroupRate(e.target.value)}
                    placeholder="400"
                    style={{
                      width: '75px',
                      padding: '7px 8px',
                      borderRadius: '4px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      fontSize: '13px',
                      fontWeight: '700'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  style={{
                    padding: '7px 14px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontWeight: '800',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  ✓ Save Group
                </button>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                ℹ️ Once saved, this group cannot be modified or deleted by the owner (only Admin can edit/delete).
              </p>
            </form>
          )}

          {/* Admin Edit Group Form */}
          {editingGroup && isAdmin && (
            <form onSubmit={handleUpdateStoredGroup} style={{
              background: 'var(--surface2)',
              borderRadius: '4px',
              padding: '12px',
              border: '1.5px solid var(--warning)',
              marginBottom: '14px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: '800', fontSize: '12px', color: 'var(--warning)' }}>
                  ✏️ Admin Edit Group: {editingGroup.name}
                </span>
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', fontWeight: '800' }}
                >
                  ✕
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  value={editingGroup.name}
                  onChange={e => setEditingGroup(g => ({ ...g, name: e.target.value }))}
                  style={{
                    flex: 1,
                    minWidth: '180px',
                    padding: '7px 10px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    fontFamily: 'inherit'
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>Rate ₹:</label>
                  <input
                    type="number"
                    value={editingGroup.defaultDailyRate}
                    onChange={e => setEditingGroup(g => ({ ...g, defaultDailyRate: e.target.value }))}
                    style={{
                      width: '75px',
                      padding: '7px 8px',
                      borderRadius: '4px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      fontSize: '13px',
                      fontWeight: '700'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  style={{
                    padding: '7px 14px',
                    background: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontWeight: '800',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Update
                </button>
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  style={{
                    padding: '7px 11px',
                    background: 'var(--surface)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Created Groups List Cards */}
          {loadingStoredGroups ? (
            <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Loading created groups…
            </div>
          ) : storedGroups.length === 0 ? (
            <div style={{
              background: 'var(--surface2)',
              borderRadius: '4px',
              padding: '20px 14px',
              textAlign: 'center',
              border: '1.5px dashed var(--border)'
            }}>
              <span style={{ fontSize: '24px', display: 'block', marginBottom: '6px' }}>👥</span>
              <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '800', color: 'var(--text)' }}>
                No Groups Created Yet
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                Click <strong>"+ Create New Group"</strong> above to create your permanent work groups.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px' }}>
              {storedGroups.map(sg => {
                return (
                  <div
                    key={sg.id}
                    style={{
                      background: 'var(--surface2)',
                      borderRadius: '4px',
                      padding: '12px',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '8px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '16px' }}>👥</span>
                          <div>
                            <span style={{ fontWeight: '800', fontSize: '14px', color: 'var(--text)' }}>
                              {sg.name}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '1px' }}>
                              Default Rate: <strong style={{ color: 'var(--primary)' }}>{formatCurrency(sg.defaultDailyRate)}</strong> / day
                            </span>
                          </div>
                        </div>

                        {isAdmin ? (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingGroup({ id: sg.id, name: sg.name, defaultDailyRate: sg.defaultDailyRate });
                                setShowAddGroupModal(false);
                              }}
                              title="Edit group (Admin)"
                              style={{
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: '3px',
                                padding: '3px 6px',
                                cursor: 'pointer',
                                fontSize: '11px'
                              }}
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={() => deletePermanentGroup(sg.id, sg.name)}
                              title="Delete group (Admin)"
                              style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: 'none',
                                borderRadius: '3px',
                                padding: '3px 6px',
                                cursor: 'pointer',
                                color: '#ef4444',
                                fontSize: '11px'
                              }}
                            >
                              🗑️
                            </button>
                          </div>
                        ) : (
                          <span style={{
                            fontSize: '10px',
                            background: 'rgba(99, 102, 241, 0.1)',
                            color: 'var(--primary)',
                            padding: '2px 5px',
                            borderRadius: '2px',
                            fontWeight: '800'
                          }}>
                            🔒 Created
                          </span>
                        )}
                      </div>

                      {!isAdmin && (
                        <p style={{ margin: '5px 0 0', fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          🔒 Only Admin can edit or delete this group.
                        </p>
                      )}
                    </div>

                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectGroupForToday(sg.id);
                          setActiveTab('attendance');
                        }}
                        style={{
                          width: '100%',
                          padding: '6px',
                          background: 'var(--surface)',
                          border: '1px solid var(--primary)',
                          borderRadius: '4px',
                          color: 'var(--primary)',
                          fontSize: '11px',
                          fontWeight: '800',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        <span>👉</span> Enter Attendance for this Group
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          VIEW 2: DAILY ATTENDANCE & PAYMENTS TAB
          ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'attendance' && (
        <>
          {/* ── DAILY ATTENDANCE CARD ── */}
          <div className="card" style={{ padding: '18px', marginBottom: '18px', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '900', color: 'var(--text)' }}>
                  📅 Daily Labour Attendance
                </h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <div>
                  <label style={labelStyle}>Attendance Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setDate(getTodayDate())}
                  style={{
                    marginTop: '15px',
                    padding: '7px 11px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: date === getTodayDate() ? 'var(--primary)' : 'var(--surface2)',
                    color: date === getTodayDate() ? 'white' : 'var(--text)',
                    cursor: 'pointer',
                    fontWeight: '700',
                    fontSize: '12px',
                    fontFamily: 'inherit',
                  }}
                >
                  Today
                </button>
              </div>
            </div>

            {/* ── 1. PREVIOUSLY SUBMITTED GROUPS FOR THIS DATE (BLOCKED) ── */}
            {submittedGroups.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14px' }}>🔒</span>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Submitted Groups for {formatDate(date)} ({submittedGroups.length}) — Blocked
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {submittedGroups.map(sg => {
                    const count = parseFloat(sg.workerCount !== undefined ? sg.workerCount : (sg.totalWorkers || (Array.isArray(sg.members) ? sg.members.filter(m => m.attendance === 'present').length : 0))) || 0;
                    const rate = parseFloat(sg.dailyRate !== undefined ? sg.dailyRate : (sg.dailyAmount || 0));
                    const wage = parseFloat(sg.totalWage !== undefined ? sg.totalWage : (count * rate));

                    return (
                      <div
                        key={sg.id || sg.name}
                        style={{
                          background: 'rgba(16, 185, 129, 0.05)',
                          borderRadius: '4px',
                          padding: '10px 12px',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '15px' }}>👥</span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ fontWeight: '800', fontSize: '13px', color: 'var(--text)' }}>
                                {sg.name}
                              </span>
                              <span style={{
                                fontSize: '10px',
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: '#10b981',
                                padding: '1px 5px',
                                borderRadius: '2px',
                                fontWeight: '800'
                              }}>
                                🔒 Submitted & Blocked
                              </span>
                            </div>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '1px' }}>
                              Attendance locked. Owner cannot edit this group.
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text)', display: 'block' }}>
                              {count} workers @ {formatCurrency(rate)}
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: '900', color: 'var(--primary)' }}>
                              Wage: {formatCurrency(wage)}
                            </span>
                          </div>

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setAdminEditingGroup({ id: sg.id, name: sg.name, workerCount: count, dailyRate: rate })}
                              style={{
                                padding: '4px 8px',
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: '3px',
                                fontSize: '11px',
                                fontWeight: '800',
                                cursor: 'pointer'
                              }}
                            >
                              ✏️ Admin Edit
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── ADMIN EDIT MODAL FOR A SUBMITTED GROUP ── */}
            {adminEditingGroup && isAdmin && (
              <form onSubmit={handleAdminUpdateSubmittedGroup} style={{
                background: 'var(--surface2)',
                borderRadius: '4px',
                padding: '12px',
                border: '1.5px solid var(--warning)',
                marginBottom: '16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '800', fontSize: '12px', color: 'var(--warning)' }}>
                    ✏️ Admin Edit: {adminEditingGroup.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAdminEditingGroup(null)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', fontWeight: '800' }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>Workers Present:</label>
                    <input
                      type="number"
                      value={adminEditingGroup.workerCount}
                      onChange={e => setAdminEditingGroup(g => ({ ...g, workerCount: e.target.value }))}
                      style={{
                        width: '75px',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        fontSize: '12px',
                        fontWeight: '700'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>Rate ₹:</label>
                    <input
                      type="number"
                      value={adminEditingGroup.dailyRate}
                      onChange={e => setAdminEditingGroup(g => ({ ...g, dailyRate: e.target.value }))}
                      style={{
                        width: '75px',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        fontSize: '12px',
                        fontWeight: '700'
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      padding: '7px 14px',
                      background: 'var(--primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontWeight: '800',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            )}

            {/* ── 2. SELECT AND ENTER ATTENDANCE FOR A NEW GROUP ── */}
            <div style={{
              background: 'var(--surface2)',
              borderRadius: '4px',
              padding: '14px',
              border: '1px solid var(--border)',
              marginBottom: '16px'
            }}>
              <div style={{ marginBottom: '8px' }}>
                <label style={{ ...labelStyle, marginBottom: '0', color: 'var(--primary)' }}>
                  {submittedGroups.length > 0 ? '👉 Select Another Group to Enter Attendance' : '👉 Select Work Group to Enter Attendance'}
                </label>
              </div>

              {storedGroups.length === 0 ? (
                <div style={{
                  background: 'var(--surface2)',
                  borderRadius: '4px',
                  padding: '12px 14px',
                  textAlign: 'center',
                  border: '1.5px dashed var(--border)'
                }}>
                  <p style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '700' }}>
                    No created work groups found for this owner.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('groups')}
                    style={{
                      padding: '7px 14px',
                      background: 'var(--primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontWeight: '800',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    👥 Go to "Groups Created" tab to create your group
                  </button>
                </div>
              ) : unsubmittedStoredGroups.length === 0 && activeNewGroups.length === 0 ? (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  borderRadius: '4px',
                  padding: '10px',
                  textAlign: 'center',
                  border: '1px solid rgba(16, 185, 129, 0.25)'
                }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#10b981', fontWeight: '800' }}>
                    ✓ All created groups have submitted attendance for {formatDate(date)}!
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    defaultValue=""
                    onChange={e => {
                      if (e.target.value) {
                        handleSelectGroupForToday(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    style={{
                      ...inputStyle,
                      flex: 1,
                      minWidth: '200px',
                      background: 'var(--surface)',
                      fontWeight: '700'
                    }}
                  >
                    <option value="" disabled>➕ Click to select a group to enter attendance…</option>
                    {unsubmittedStoredGroups.map(sg => (
                      <option key={sg.id} value={sg.id}>
                        👥 {sg.name} — Rate: {formatCurrency(sg.defaultDailyRate)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* ── 3. ACTIVE NEW GROUPS ENTRY SECTION ── */}
            {activeNewGroups.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                  Enter Attendance for Selected Group ({activeNewGroups.length})
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeNewGroups.map(group => {
                    const groupWorkers = parseFloat(group.workerCount) || 0;
                    const groupRate = parseFloat(group.dailyRate) || 0;
                    const groupSubtotal = groupWorkers * groupRate;

                    return (
                      <div
                        key={group.id}
                        style={{
                          background: 'var(--surface2)',
                          borderRadius: '4px',
                          padding: '12px',
                          border: '1.5px solid var(--primary)',
                        }}
                      >
                        {/* Group Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '15px' }}>👥</span>
                            <span style={{ fontWeight: '800', fontSize: '13px', color: 'var(--text)' }}>
                              {group.name}
                            </span>
                            <span style={{ fontSize: '9px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '2px 5px', borderRadius: '2px', fontWeight: '700' }}>
                              New Entry
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>Rate ₹:</label>
                              <input
                                type="number"
                                value={group.dailyRate}
                                onChange={e => updateActiveNewGroup(group.id, 'dailyRate', e.target.value)}
                                placeholder="400"
                                style={{
                                  background: 'var(--surface)',
                                  border: '1px solid var(--border)',
                                  borderRadius: '4px',
                                  padding: '4px 6px',
                                  fontWeight: '800',
                                  fontSize: '12px',
                                  color: 'var(--text)',
                                  width: '70px',
                                }}
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => removeActiveNewGroup(group.id)}
                              title="Cancel entry"
                              style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: 'none',
                                borderRadius: '3px',
                                padding: '4px 6px',
                                color: '#ef4444',
                                cursor: 'pointer',
                                fontWeight: '700',
                                fontSize: '11px',
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        {/* Workers Count Counter */}
                        <div style={{
                          background: 'var(--surface)',
                          borderRadius: '4px',
                          padding: '8px 12px',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '8px',
                          marginBottom: '8px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text)' }}>
                              Workers Present:
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  const cur = parseFloat(group.workerCount) || 0;
                                  updateActiveNewGroup(group.id, 'workerCount', Math.max(0, cur - 1));
                                }}
                                style={{
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '4px',
                                  border: '1px solid var(--border)',
                                  background: 'var(--surface2)',
                                  color: 'var(--text)',
                                  fontWeight: '900',
                                  fontSize: '14px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={group.workerCount}
                                onChange={e => updateActiveNewGroup(group.id, 'workerCount', e.target.value)}
                                placeholder="0"
                                style={{
                                  width: '70px',
                                  padding: '5px 6px',
                                  borderRadius: '4px',
                                  border: '1px solid var(--border)',
                                  background: 'var(--surface2)',
                                  color: 'var(--text)',
                                  fontWeight: '800',
                                  fontSize: '13px',
                                  textAlign: 'center'
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const cur = parseFloat(group.workerCount) || 0;
                                  updateActiveNewGroup(group.id, 'workerCount', cur + 1);
                                }}
                                style={{
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '4px',
                                  border: '1px solid var(--border)',
                                  background: 'var(--surface2)',
                                  color: 'var(--text)',
                                  fontWeight: '900',
                                  fontSize: '14px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                              {groupWorkers} workers × {formatCurrency(groupRate)}
                            </span>
                            <span style={{ fontSize: '12px', fontWeight: '900', color: groupSubtotal > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                              Subtotal: {formatCurrency(groupSubtotal)}
                            </span>
                          </div>
                        </div>

                        {/* Submit Button for this group */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleSubmitAttendance(group)}
                            disabled={saving || (parseFloat(group.workerCount) || 0) <= 0}
                            style={{
                              padding: '7px 14px',
                              background: '#10b981',
                              border: 'none',
                              borderRadius: '4px',
                              color: 'white',
                              fontWeight: '800',
                              fontSize: '11px',
                              cursor: (saving || (parseFloat(group.workerCount) || 0) <= 0) ? 'not-allowed' : 'pointer',
                              opacity: (saving || (parseFloat(group.workerCount) || 0) <= 0) ? 0.6 : 1,
                              boxShadow: '0 1px 4px rgba(16, 185, 129, 0.25)'
                            }}
                          >
                            {saving ? '⏳ Submitting…' : `💾 Submit Attendance for ${group.name}`}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── 4. SUMMARY BOX FOR THE DAY ── */}
            <div style={{ background: 'var(--surface2)', borderRadius: '4px', padding: '12px', marginBottom: '14px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '600' }}>
                  Total Daily Workers:
                </span>
                <span style={{ fontWeight: '800', fontSize: '12px', color: 'var(--primary)' }}>
                  {computed.totalWorkers} workers
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '600' }}>
                  Total Daily Wage:
                </span>
                <span style={{ fontWeight: '800', fontSize: '13px', color: 'var(--text)' }}>
                  {formatCurrency(computed.totalWage)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '5px', borderTop: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700' }}>
                  Remaining Due:
                </span>
                <span style={{ fontWeight: '900', fontSize: '14px', color: computed.remaining > 0 ? '#ef4444' : '#10b981' }}>
                  {formatCurrency(computed.remaining)}
                </span>
              </div>
            </div>
          </div>

          {/* ── GROUP PAYMENT SECTION ── */}
          <div className="card" style={{ padding: '18px', marginBottom: '18px', borderRadius: '4px' }}>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '16px' }}>💳</span>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>
                  Group Payment Section
                </h3>
              </div>
            </div>

            {/* Date Range Selection & Quick Presets */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '8px' }}>
              <div>
                <label style={labelStyle}>From Date (Optional)</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>To Date (Optional)</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
              </div>
            </div>

            {/* Quick Presets */}
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '14px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>Presets:</span>
              <button
                type="button"
                onClick={() => { setStartDate(''); setEndDate(''); }}
                style={{
                  background: (!startDate && !endDate) ? 'var(--primary)' : 'var(--surface2)',
                  color: (!startDate && !endDate) ? 'white' : 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: '3px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                ⚡ All Dates
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                  setStartDate(firstDay);
                  setEndDate(getTodayDate());
                }}
                style={{
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: '3px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                📅 This Month
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 30);
                  setStartDate(d.toISOString().split('T')[0]);
                  setEndDate(getTodayDate());
                }}
                style={{
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: '3px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                📅 Last 30 Days
              </button>
              <button
                type="button"
                onClick={() => {
                  const today = getTodayDate();
                  setStartDate(today);
                  setEndDate(today);
                }}
                style={{
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: '3px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                📅 Today Only
              </button>
            </div>

            {/* Step 1: Select Work Group */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ ...labelStyle, color: 'var(--primary)', marginBottom: '5px' }}>
                👉 Step 1: Select Work Group to Pay
              </label>

              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {storedGroups.map(sg => {
                  const rg = rangeGroups.find(r => r.name.toLowerCase() === sg.name.toLowerCase());
                  const due = rg ? rg.totalDue : 0;
                  const isSelected = selectedPayGroup.toLowerCase() === sg.name.toLowerCase();

                  return (
                    <button
                      key={sg.id}
                      type="button"
                      onClick={() => {
                        setSelectedPayGroup(sg.name);
                        setPaymentForm(f => ({ ...f, amount: '' }));
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '4px',
                        border: '1.5px solid',
                        borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                        background: isSelected ? 'var(--primary)' : 'var(--surface2)',
                        color: isSelected ? 'white' : 'var(--text)',
                        fontWeight: '800',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>👥 {sg.name}</span>
                      <span style={{
                        fontSize: '9px',
                        background: isSelected ? 'rgba(255,255,255,0.25)' : (due > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)'),
                        color: isSelected ? 'white' : (due > 0 ? '#ef4444' : '#10b981'),
                        padding: '1px 4px',
                        borderRadius: '2px',
                      }}>
                        {due > 0 ? `Due: ${formatCurrency(due)}` : 'Cleared'}
                      </span>
                    </button>
                  );
                })}

                {rangeGroups
                  .filter(rg => !storedGroups.some(sg => sg.name.toLowerCase() === rg.name.toLowerCase()))
                  .map(rg => {
                    const isSelected = selectedPayGroup.toLowerCase() === rg.name.toLowerCase();
                    return (
                      <button
                        key={rg.name}
                        type="button"
                        onClick={() => {
                          setSelectedPayGroup(rg.name);
                          setPaymentForm(f => ({ ...f, amount: '' }));
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '4px',
                          border: '1.5px solid',
                          borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                          background: isSelected ? 'var(--primary)' : 'var(--surface2)',
                          color: isSelected ? 'white' : 'var(--text)',
                          fontWeight: '800',
                          fontSize: '11px',
                          cursor: 'pointer',
                        }}
                      >
                        👥 {rg.name} ({formatCurrency(rg.totalDue)})
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Target Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '14px' }}>
              {[
                { label: `${activePayTarget.name} Wage`, value: formatCurrency(activePayTarget.totalWage), color: 'var(--text)' },
                { label: `${activePayTarget.name} Paid`, value: formatCurrency(activePayTarget.totalPaid), color: '#10b981' },
                { label: `${activePayTarget.name} Due`, value: formatCurrency(activePayTarget.totalDue), color: activePayTarget.totalDue > 0 ? '#ef4444' : '#10b981' }
              ].map(c => (
                <div key={c.label} style={{ background: 'var(--surface2)', borderRadius: '4px', padding: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 2px', fontSize: '9px', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase' }}>{c.label}</p>
                  <p style={{ margin: 0, fontWeight: '900', fontSize: '12px', color: c.color }}>{c.value}</p>
                </div>
              ))}
            </div>

            {/* Proceed Payment Form */}
            {activePayTarget.totalDue > 0 ? (
              <form onSubmit={handlePayment} style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text)' }}>
                      👉 Step 2: Proceed Payment for <strong>{activePayTarget.name}</strong>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPaymentForm(f => ({ ...f, amount: activePayTarget.totalDue }))}
                    style={{
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#10b981',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontWeight: '800',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    ⚡ Fill Full Due ({formatCurrency(activePayTarget.totalDue)})
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px', marginBottom: '10px' }}>
                  <div>
                    <label style={labelStyle}>Payment Amount ₹</label>
                    <input
                      type="number"
                      value={paymentForm.amount}
                      onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="0"
                      max={activePayTarget.totalDue || undefined}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Method</label>
                    <select
                      value={paymentForm.paymentMethod}
                      onChange={e => setPaymentForm(f => ({ ...f, paymentMethod: e.target.value }))}
                      style={inputStyle}
                    >
                      {['Cash', 'Bank', 'UPI'].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Notes</label>
                    <input
                      type="text"
                      value={paymentForm.notes}
                      onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder={`Paid to ${activePayTarget.name} workers`}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={paying}
                  style={{
                    width: '100%',
                    padding: '9px',
                    background: '#10b981',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: paying ? 'not-allowed' : 'pointer',
                    boxShadow: '0 1px 4px rgba(16, 185, 129, 0.25)'
                  }}
                >
                  {paying ? '⏳ Processing Payment…' : `✓ Proceed ${formatCurrency(parseFloat(paymentForm.amount) || activePayTarget.totalDue)} Payment for ${activePayTarget.name}`}
                </button>
              </form>
            ) : (
              <div style={{
                background: 'rgba(16, 185, 129, 0.08)',
                borderRadius: '4px',
                padding: '8px',
                textAlign: 'center',
                border: '1px solid rgba(16, 185, 129, 0.2)'
              }}>
                <p style={{ margin: 0, fontSize: '11px', color: '#10b981', fontWeight: '800' }}>
                  ✓ All dues for group "{activePayTarget.name}" in this date range are completely cleared!
                </p>
              </div>
            )}
          </div>

          {/* ── DAILY SUMMARIES HISTORY LIST ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontWeight: '800', fontSize: '15px' }}>
              Daily Worker History ({filteredHistoryRecords.length}{filteredHistoryRecords.length !== records.length ? ` of ${records.length}` : ''})
            </h3>
            <button
              type="button"
              onClick={fetchRecords}
              disabled={loading}
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                color: 'var(--primary)'
              }}
            >
              🔄 Refresh
            </button>
          </div>

          {/* Search history input */}
          <div style={{ marginBottom: '10px' }}>
            <input
              type="text"
              placeholder="🔍 Search history by date (e.g. 2026-10-20, Oct 20) or group name…"
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              style={inputStyle}
            />
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ width: '20px', height: '20px', margin: '0 auto 6px' }} />
              Loading daily history…
            </div>
          ) : filteredHistoryRecords.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px', borderRadius: '4px' }}>
              {records.length === 0 ? 'No recorded daily worker history found.' : 'No records match your search.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '18px' }}>
              {filteredHistoryRecords.map(r => {
                const hasGroups = Array.isArray(r.groups) && r.groups.length > 0;
                const isExpanded = expandedRecordId === r.id;

                return (
                  <div key={r.id} className="card" style={{ padding: '12px', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '15px' }}>📅</span>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <p style={{ margin: 0, fontWeight: '800', fontSize: '13px', color: 'var(--text)' }}>
                              {formatDate(r.date)}
                            </p>
                            <span style={{ fontSize: '9px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '1px 4px', borderRadius: '2px', fontWeight: '800' }}>
                              🔒 Recorded
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '5px', marginTop: '1px', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '700' }}>
                              {r.totalWorkers} workers
                            </span>
                            {hasGroups && (
                              <button
                                type="button"
                                onClick={() => setExpandedRecordId(isExpanded ? null : r.id)}
                                style={{
                                  background: 'var(--surface2)',
                                  border: '1px solid var(--border)',
                                  borderRadius: '3px',
                                  padding: '1px 5px',
                                  fontSize: '10px',
                                  fontWeight: '800',
                                  color: 'var(--primary)',
                                  cursor: 'pointer',
                                }}
                              >
                                👥 {r.groups.length} Groups {isExpanded ? '▲' : '▼'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontWeight: '800', fontSize: '13px', color: 'var(--text)' }}>
                          {formatCurrency(r.totalWage)}
                        </p>
                        <p style={{ margin: '1px 0 0', fontSize: '10px', color: 'var(--text-muted)' }}>
                          Paid: <span style={{ color: '#10b981', fontWeight: '700' }}>{formatCurrency(r.totalPaid)}</span> | Due: <span style={{ color: r.remaining > 0 ? '#ef4444' : '#10b981', fontWeight: '700' }}>{formatCurrency(r.remaining)}</span>
                        </p>
                      </div>
                    </div>

                    {/* Group Breakdown */}
                    {hasGroups && isExpanded && (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)', animation: 'fadeIn 0.2s ease-out' }}>
                        <h5 style={{ margin: '0 0 5px', fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Group Breakdown for {formatDate(r.date)}
                        </h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {r.groups.map((g, idx) => {
                            const gRate = parseFloat(g.dailyRate || g.dailyAmount) || 0;
                            const gPresent = parseFloat(g.workerCount !== undefined ? g.workerCount : (Array.isArray(g.members) ? g.members.filter(m => m.attendance === 'present').length : g.totalWorkers)) || 0;
                            const gWage = parseFloat(g.totalWage !== undefined ? g.totalWage : (gPresent * gRate));
                            const gPaid = parseFloat(g.totalPaid || 0);
                            const gDue = g.remaining !== undefined ? Math.max(parseFloat(g.remaining || 0), 0) : Math.max(gWage - gPaid, 0);

                            return (
                              <div key={g.id || idx} style={{ background: 'var(--surface2)', borderRadius: '4px', padding: '6px 8px', border: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: '800', fontSize: '11px', color: 'var(--text)' }}>
                                      👥 {g.name}
                                    </span>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                      ({gPresent} workers @ {formatCurrency(gRate)}) = {formatCurrency(gWage)}
                                    </span>
                                  </div>

                                  <div>
                                    {gDue <= 0 ? (
                                      <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '2px', fontWeight: '800', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                                        ✓ Cleared ({formatCurrency(gWage)})
                                      </span>
                                    ) : gPaid > 0 ? (
                                      <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '2px', fontWeight: '800', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                                        Paid: {formatCurrency(gPaid)} | Due: {formatCurrency(gDue)}
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '2px', fontWeight: '800', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                                        Due: {formatCurrency(gDue)} (Unpaid)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── PAYMENT HISTORY LIST ── */}
          {payments.length > 0 && (
            <div style={{ marginBottom: '18px' }}>
              <h3 style={{ margin: '0 0 8px', fontWeight: '800', fontSize: '15px' }}>
                Payments Made ({payments.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {payments.map(p => (
                  <div key={p.id} className="card" style={{ padding: '10px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                        <span style={{ margin: 0, fontWeight: '800', fontSize: '13px', color: '#10b981' }}>
                          {formatCurrency(p.amount)}
                        </span>
                        {p.groupName ? (
                          <span style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', padding: '1px 5px', borderRadius: '2px', fontSize: '9px', fontWeight: '800' }}>
                            👥 {p.groupName}
                          </span>
                        ) : (
                          <span style={{ background: 'var(--surface2)', color: 'var(--text-muted)', padding: '1px 5px', borderRadius: '2px', fontSize: '9px', fontWeight: '700' }}>
                            🌐 General Payment
                          </span>
                        )}
                        <span style={{ fontSize: '9px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '1px 4px', borderRadius: '2px', fontWeight: '800' }}>
                          🔒 Locked
                        </span>
                      </div>
                      <p style={{ margin: '1px 0 0', fontSize: '10px', color: 'var(--text-muted)' }}>
                        Range: {formatDate(p.startDate)} → {formatDate(p.endDate)} | Paid on: {formatDate(p.paymentDate)} ({p.paymentMethod || 'Cash'})
                      </p>
                    </div>
                    {p.notes && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        "{p.notes}"
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ textAlign: 'center', padding: '12px 0 16px', fontSize: '11px', color: 'var(--text-faint)' }}>
        Developed by Subrata Bala
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  marginBottom: '4px',
  fontSize: '11px',
  fontWeight: '700',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em'
};

const inputStyle = {
  width: '100%',
  padding: '7px 9px',
  borderRadius: '4px',
  border: '1.5px solid var(--border)',
  background: 'var(--surface2)',
  color: 'var(--text)',
  fontSize: '13px',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  outline: 'none',
};
