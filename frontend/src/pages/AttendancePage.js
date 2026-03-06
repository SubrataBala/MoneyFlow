import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { getTodayDate } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function AttendancePage() {
  const [date, setDate] = useState(getTodayDate());
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');
  const [commonWage, setCommonWage] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [editableLabours, setEditableLabours] = useState([]);
  const [mutatingLabourId, setMutatingLabourId] = useState(null);
  const queryClient = useQueryClient();

  // Debounce the search term to avoid firing too many API requests
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300); // Wait 300ms after the user stops typing

    // Cleanup function to clear the timeout if the user types again
    return () => {
      clearTimeout(handler);
    };
  }, [search]);

  const { data: labours = [], isLoading: loading } = useQuery({
    queryKey: ['labours', date, debouncedSearch],
    queryFn: async () => {
      const { data } = await api.get(`/labour?date=${date}&search=${debouncedSearch}`);
      return data; // Data is now pre-processed by the backend
    },
    onError: () => toast.error('Failed to load attendance data.'),
  });

  useEffect(() => {
    // When server data is refetched, we need to merge it with the local state
    // to preserve any unsaved changes (like an applied common wage).
    setEditableLabours(currentLocalState => {
      // If there's no previous local state, just use the fetched data.
      if (currentLocalState.length === 0) {
        return labours;
      }

      const localStateMap = new Map(currentLocalState.map(l => [l.id, l]));

      return labours.map(serverLabour => {
        const localLabour = localStateMap.get(serverLabour.id);
        // If a local version exists and its record is not yet saved on the server,
        // it means the user might have entered data (like a common wage) that we want to keep.
        if (localLabour && !serverLabour.isRecordSaved) {
          return { ...serverLabour, dailyWage: localLabour.dailyWage, amountPaidToday: localLabour.amountPaidToday };
        }
        return serverLabour; // Otherwise, use the fresh data from the server.
      });
    });
  }, [labours]);

  const addLabourMutation = useMutation({
    mutationFn: (name) => api.post('/labour', { name }),
    onSuccess: () => {
      toast.success('Labour added!');
      setNewName('');
      queryClient.invalidateQueries({ queryKey: ['labours'] });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to add labour'),
  });

  const addLabour = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    addLabourMutation.mutate(newName.trim());
  };

  const attendanceMutation = useMutation({
    mutationFn: (labourToUpdate) => api.post('/labour/attendance', {
      labourId: labourToUpdate.id,
      date,
      attendance: labourToUpdate.attendance,
      dailyWage: labourToUpdate.dailyWage || 0,
      amountPaidToday: labourToUpdate.amountPaidToday || 0,
    }),
    onMutate: (variables) => {
      setMutatingLabourId(variables.id);
    },
    onSuccess: () => {
      toast.success('Record updated!');
      queryClient.invalidateQueries({ queryKey: ['labours', date, debouncedSearch] });
    },
    onError: (err) => {
      // Use the specific error message from the backend if available
      toast.error(err.response?.data?.message || 'Failed to update');
    },
    onSettled: () => {
      setMutatingLabourId(null);
    }
  });

  const handleApplyCommonWage = () => {
    const wageValue = parseFloat(commonWage);
    if (isNaN(wageValue) || wageValue < 0) {
      return toast.error('Please enter a valid wage amount.');
    }
    if (editableLabours.length === 0) {
      return toast.error('No labours to apply wage to.');
    }

    // Update the local state for all visible labours. This does not save to the server.
    setEditableLabours(currentLabours =>
      currentLabours.map(l => ({ ...l, dailyWage: wageValue }))
    );
    toast.success(`Common wage of ₹${wageValue} applied. Click 'Update' on each card to save.`);
  };

  // Update local state for a single labourer's input field
  const handleInputChange = (labourId, field, value) => {
    setEditableLabours(currentLabours =>
      currentLabours.map(l =>
        l.id === labourId ? { ...l, [field]: value } : l
      )
    );
  };

  // Save a single labourer's record
  const handleUpdateRecord = (labourId) => {
    const labourToUpdate = editableLabours.find(l => l.id === labourId);
    if (labourToUpdate) {
      attendanceMutation.mutate(labourToUpdate);
    }
  };

  const present = editableLabours.filter(l => l.attendance === 'present').length;

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontWeight: '800', fontSize: '22px' }}>Attendance</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>{present}/{editableLabours.length} present</p>
      </div>

      {/* Date Picker */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '16px', border: '1px solid var(--border)', marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Select Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '16px', fontFamily: 'inherit' }} />
      </div>

      {/* Add Labour */}
      <form onSubmit={addLabour} style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Add new labour..."
          style={{ flex: 1, padding: '14px 16px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '15px', fontFamily: 'inherit' }} disabled={addLabourMutation.isLoading} />
        <button type="submit" style={{ padding: '14px 20px', background: 'linear-gradient(135deg, #0ea5e9, #10b981)', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '700', fontSize: '15px', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
          + Add
        </button>
      </form>

      {/* Common Wage */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <input type="number" value={commonWage} onChange={e => setCommonWage(e.target.value)} placeholder="Set common daily wage..."
          style={{ flex: 1, padding: '14px 16px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '15px', fontFamily: 'inherit' }} />
        <button onClick={handleApplyCommonWage} style={{ padding: '14px 20px', background: '#10b981', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '700', fontSize: '15px', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
          Apply
        </button>
      </div>

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search labour..."
        style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '15px', fontFamily: 'inherit', marginBottom: '16px', boxSizing: 'border-box' }} />

      {/* Labour List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>
      ) : editableLabours.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No labours found. Add one above.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {editableLabours.map(labour => (
            <div key={labour.id} style={{
              background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '16px',
              border: `1.5px solid ${labour.attendance === 'present' ? '#86efac' : 'var(--border)'}`,
              boxShadow: 'var(--shadow)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #0ea5e9, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '16px' }}>
                    {labour.name[0].toUpperCase()}
                  </div>
                  <span style={{ fontWeight: '700', fontSize: '16px' }}>{labour.name}</span>
                </div>
                {labour.isRecordSaved && (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    🔒 Saved
                  </span>
                )}
              </div>

              {/* Attendance Toggle */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                {['present', 'absent'].map(status => (
                  <button key={status} onClick={() => handleInputChange(labour.id, 'attendance', status)}
                    disabled={labour.isRecordSaved}
                    style={{
                      flex: 1, padding: '10px', border: 'none', borderRadius: '10px', cursor: 'pointer',
                      fontWeight: '700', fontSize: '13px', fontFamily: 'inherit', cursor: labour.isRecordSaved ? 'not-allowed' : 'pointer',
                      background: labour.attendance === status
                        ? (status === 'present' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)')
                        : 'var(--surface2)',
                      color: labour.attendance === status ? 'white' : 'var(--text-muted)'
                    }}>
                    {status === 'present' ? '✅ Present' : '❌ Absent'}
                  </button>
                ))}
              </div>

              {/* Wage & Paid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Daily Wage ₹</label>
                  <input type="number" value={labour.dailyWage} onChange={e => handleInputChange(labour.id, 'dailyWage', e.target.value)}
                    placeholder="0"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '15px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Paid Today ₹</label>
                  <input type="number" value={labour.amountPaidToday} onChange={e => handleInputChange(labour.id, 'amountPaidToday', e.target.value)}
                    placeholder="0"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '15px', boxSizing: 'border-box' }} />
                </div>
              </div>

              {/* Update Button */}
              <button onClick={() => handleUpdateRecord(labour.id)}
                disabled={mutatingLabourId === labour.id}
                style={{
                  width: '100%', padding: '12px', marginTop: '12px', background: 'var(--primary)', border: 'none', borderRadius: '10px', color: 'white',
                  fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', opacity: mutatingLabourId === labour.id ? 0.7 : 1
                }}>
                {mutatingLabourId === labour.id ? '⏳ Updating...' : '💾 Update Record'}
              </button>
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
