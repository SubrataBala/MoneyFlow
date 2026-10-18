import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, getTodayDate } from '../utils/helpers';
import toast from 'react-hot-toast';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const escapeCSV = (value) => {
  const str = String(value ?? '').replace(/"/g, '""');
  return `"${str}"`;
};

const getFirstDayOfMonth = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};

const getLast30DaysDate = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
};

export default function ReportsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Admin owner switcher state
  const [adminOwners, setAdminOwners] = useState([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState('');

  // Date filter state (default to this month)
  const [startDate, setStartDate] = useState(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [activePreset, setActivePreset] = useState('month');

  // Report data state
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  // Tab & search filters
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'wages' | 'daily'
  const [labourSearch, setLabourSearch] = useState('');
  const [dailySearch, setDailySearch] = useState('');

  // Fetch admin owners if admin
  useEffect(() => {
    if (!isAdmin) return;
    api.get('/admin/owners')
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : [];
        setAdminOwners(list);
        if (list.length > 0 && !selectedOwnerId) {
          setSelectedOwnerId(list[0].id);
        }
      })
      .catch(err => console.error('Failed to load admin owners', err));
  }, [isAdmin]);

  const applyPreset = (preset) => {
    setActivePreset(preset);
    const today = getTodayDate();
    if (preset === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === '30d') {
      setStartDate(getLast30DaysDate());
      setEndDate(today);
    } else if (preset === 'month') {
      setStartDate(getFirstDayOfMonth());
      setEndDate(today);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      let wageQuery = [];
      let dailyQuery = [];

      if (startDate && endDate) {
        wageQuery.push(`startDate=${startDate}&endDate=${endDate}`);
        dailyQuery.push(`startDate=${startDate}&endDate=${endDate}`);
      }

      if (isAdmin && selectedOwnerId) {
        wageQuery.push(`ownerId=${selectedOwnerId}`);
        dailyQuery.push(`ownerId=${selectedOwnerId}`);
      }

      const wageUrl = `/labour/wages${wageQuery.length ? '?' + wageQuery.join('&') : ''}`;
      const dailyUrl = `/daily-worker${dailyQuery.length ? '?' + dailyQuery.join('&') : ''}`;

      const [wageRes, dailyRes] = await Promise.all([
        api.get(wageUrl),
        api.get(dailyUrl)
      ]);

      setReport({
        wages: Array.isArray(wageRes.data) ? wageRes.data : [],
        daily: Array.isArray(dailyRes.data) ? dailyRes.data : []
      });
      toast.success('Report generated successfully!');
    } catch (e) {
      console.error(e);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  // Auto fetch on first mount or when admin changes owner
  useEffect(() => {
    if (isAdmin && !selectedOwnerId && adminOwners.length > 0) return;
    fetchReport();
  }, [selectedOwnerId]);

  // Derived calculations
  const totalWage = useMemo(() => report?.wages.reduce((s, w) => s + parseFloat(w.totalWage || 0), 0) || 0, [report]);
  const totalPaid = useMemo(() => report?.wages.reduce((s, w) => s + parseFloat(w.totalPaid || 0), 0) || 0, [report]);
  const totalRem = useMemo(() => report?.wages.reduce((s, w) => s + parseFloat(w.remaining || 0), 0) || 0, [report]);
  const totalPresentDays = useMemo(() => report?.wages.reduce((s, w) => s + (parseInt(w.presentDays, 10) || 0), 0) || 0, [report]);

  const dailyTotalWage = useMemo(() => report?.daily.reduce((s, d) => s + parseFloat(d.totalWage || 0), 0) || 0, [report]);
  const dailyTotalPaid = useMemo(() => report?.daily.reduce((s, d) => s + parseFloat(d.totalPaid || 0), 0) || 0, [report]);
  const dailyTotalRem = useMemo(() => report?.daily.reduce((s, d) => s + parseFloat(d.remaining || 0), 0) || 0, [report]);
  const totalDailyWorkers = useMemo(() => report?.daily.reduce((s, d) => s + (parseFloat(d.totalWorkers) || 0), 0) || 0, [report]);

  const grandTotalWage = totalWage + dailyTotalWage;
  const grandTotalPaid = totalPaid + dailyTotalPaid;
  const grandTotalRem = totalRem + dailyTotalRem;

  const dateRangeLabel = startDate && endDate
    ? `${formatDate(startDate)} to ${formatDate(endDate)}`
    : 'All Recorded Dates';

  const downloadBlob = (content, filename, type = 'text/csv;charset=utf-8;') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ==========================================
  // 1. SEPARATE DOWNLOAD: NORMAL LABOUR
  // ==========================================
  const exportNormalLabourCSV = () => {
    if (!report || !report.wages.length) {
      toast.error('No normal labour records to export');
      return;
    }
    let csv = `Subh Ent. - Normal Labour Wages Report (${dateRangeLabel})\n`;
    csv += `Generated On: ${formatDate(getTodayDate())}\n\n`;
    csv += 'Labour Name,Present Days,Total Wage (INR),Total Paid (INR),Remaining Due (INR),Status\n';

    report.wages.forEach(w => {
      const status = parseFloat(w.remaining || 0) > 0 ? 'Pending' : 'Cleared';
      csv += `${escapeCSV(w.labour?.name)},${w.presentDays || 0},${w.totalWage || 0},${w.totalPaid || 0},${w.remaining || 0},${escapeCSV(status)}\n`;
    });

    csv += `\nTotal,${totalPresentDays},${totalWage},${totalPaid},${totalRem},\n`;

    const fileSuffix = startDate && endDate ? `${startDate}_to_${endDate}` : 'all_dates';
    downloadBlob(csv, `normal_labour_wages_${fileSuffix}.csv`);
    toast.success('Normal Labour CSV downloaded!');
  };

  const exportNormalLabourPDF = () => {
    if (!report || !report.wages.length) {
      toast.error('No normal labour records to export');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow pop-ups to export the PDF.');
      return;
    }

    const rows = report.wages.map((w, idx) => `
      <tr>
        <td style="text-align: center; width: 36px; color: #6b7280;">${idx + 1}</td>
        <td><strong>${escapeHtml(w.labour?.name)}</strong></td>
        <td class="num">${w.presentDays || 0}</td>
        <td class="num">${formatCurrency(w.totalWage)}</td>
        <td class="num" style="color: #059669;">${formatCurrency(w.totalPaid)}</td>
        <td class="num" style="color: ${parseFloat(w.remaining || 0) > 0 ? '#dc2626' : '#059669'}; font-weight: 700;">
          ${formatCurrency(w.remaining)}
        </td>
      </tr>
    `).join('');

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Subh Ent. - Normal Labour Wages Report</title>
          <style>
            @page { size: A4; margin: 12mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #111827; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 11px; line-height: 1.35; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 14px; }
            .company { margin: 0; font-size: 24px; font-weight: 800; color: #065f46; }
            .subtitle { margin: 4px 0 0; font-size: 13px; color: #374151; font-weight: 700; }
            .date-box { text-align: right; font-size: 11px; color: #4b5563; }
            .date-box strong { display: block; color: #111827; font-size: 12px; margin-bottom: 3px; }
            .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
            .summary-card { border: 1px solid #d1d5db; padding: 10px; border-radius: 8px; background: #f9fafb; text-align: center; }
            .label { margin: 0 0 4px; color: #6b7280; font-size: 10px; font-weight: 700; text-transform: uppercase; }
            .value { margin: 0; font-size: 15px; font-weight: 800; color: #111827; }
            table { width: 100%; border-collapse: collapse; page-break-inside: auto; margin-top: 10px; }
            tr { page-break-inside: avoid; }
            th, td { border: 1px solid #d1d5db; padding: 7px 9px; vertical-align: middle; }
            th { background: #ecfdf5; color: #065f46; font-size: 10px; text-transform: uppercase; font-weight: 800; text-align: left; }
            .num { text-align: right; white-space: nowrap; }
            .totals-row td { font-weight: 800; background: #f3f4f6; font-size: 12px; }
            .footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 10px; text-align: center; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="company">Subh Ent.</h1>
              <p class="subtitle">👷 Normal Labour Wages & Details Report</p>
            </div>
            <div class="date-box">
              <strong>Period</strong>
              ${escapeHtml(dateRangeLabel)}<br />
              Generated: ${formatDate(getTodayDate())}
            </div>
          </div>

          <div class="summary-grid">
            <div class="summary-card">
              <p class="label">Total Labourers</p>
              <p class="value">${report.wages.length}</p>
            </div>
            <div class="summary-card">
              <p class="label">Total Wage</p>
              <p class="value">${formatCurrency(totalWage)}</p>
            </div>
            <div class="summary-card">
              <p class="label">Total Paid</p>
              <p class="value" style="color: #059669;">${formatCurrency(totalPaid)}</p>
            </div>
            <div class="summary-card">
              <p class="label">Total Remaining Due</p>
              <p class="value" style="color: #dc2626;">${formatCurrency(totalRem)}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="text-align: center; width: 36px;">#</th>
                <th>Labour Name</th>
                <th class="num">Present Days</th>
                <th class="num">Total Wage</th>
                <th class="num">Total Paid</th>
                <th class="num">Remaining Due</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
              <tr class="totals-row">
                <td colspan="2">TOTAL (${report.wages.length} Workers)</td>
                <td class="num">${totalPresentDays}</td>
                <td class="num">${formatCurrency(totalWage)}</td>
                <td class="num" style="color: #059669;">${formatCurrency(totalPaid)}</td>
                <td class="num" style="color: #dc2626;">${formatCurrency(totalRem)}</td>
              </tr>
            </tbody>
          </table>

          <div class="footer">Subh Ent. Management System • Developed by Subrata Bala</div>
          <script>
            window.onload = () => { window.focus(); window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    toast.success('Normal Labour PDF is ready to print/save.');
  };

  // ==========================================
  // 2. SEPARATE DOWNLOAD: DAILY WORKER DATA
  // ==========================================
  const exportDailyWorkerCSV = () => {
    if (!report || !report.daily.length) {
      toast.error('No daily worker records to export');
      return;
    }
    let csv = `Subh Ent. - Daily Worker Summary & Groups Report (${dateRangeLabel})\n`;
    csv += `Generated On: ${formatDate(getTodayDate())}\n\n`;
    csv += 'Date,Group Name,Worker Count,Daily Rate (INR),Total Wage (INR),Total Paid (INR),Remaining Due (INR)\n';

    report.daily.forEach(d => {
      if (Array.isArray(d.groups) && d.groups.length > 0) {
        d.groups.forEach(g => {
          const gWorkers = g.workerCount !== undefined ? g.workerCount : (g.totalWorkers || 0);
          const gRate = g.dailyRate !== undefined ? g.dailyRate : (g.dailyAmount || 0);
          const gWage = g.totalWage !== undefined ? g.totalWage : (gWorkers * gRate);
          const gPaid = g.totalPaid || 0;
          const gRem = g.remaining !== undefined ? g.remaining : Math.max(0, gWage - gPaid);

          csv += `${formatDate(d.date)},${escapeCSV(g.name || 'Group')},${gWorkers},${gRate},${gWage},${gPaid},${gRem}\n`;
        });
      } else {
        csv += `${formatDate(d.date)},"General",${d.totalWorkers || 0},${d.dailyAmount || 0},${d.totalWage || 0},${d.totalPaid || 0},${d.remaining || 0}\n`;
      }
    });

    csv += `\nTotal,,${totalDailyWorkers},,${dailyTotalWage},${dailyTotalPaid},${dailyTotalRem}\n`;

    const fileSuffix = startDate && endDate ? `${startDate}_to_${endDate}` : 'all_dates';
    downloadBlob(csv, `daily_worker_summary_${fileSuffix}.csv`);
    toast.success('Daily Worker CSV downloaded!');
  };

  const exportDailyWorkerPDF = () => {
    if (!report || !report.daily.length) {
      toast.error('No daily worker records to export');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow pop-ups to export the PDF.');
      return;
    }

    const rows = report.daily.map(d => {
      let groupDetails = 'General';
      if (Array.isArray(d.groups) && d.groups.length > 0) {
        groupDetails = d.groups.map(g => {
          const count = g.workerCount !== undefined ? g.workerCount : (g.totalWorkers || 0);
          const rate = g.dailyRate !== undefined ? g.dailyRate : (g.dailyAmount || 0);
          return `${escapeHtml(g.name || 'Group')} (${count}w @ ₹${rate})`;
        }).join('<br/>');
      }

      return `
        <tr>
          <td><strong>${formatDate(d.date)}</strong></td>
          <td style="font-size: 10px; color: #374151;">${groupDetails}</td>
          <td class="num">${d.totalWorkers || 0}</td>
          <td class="num">${formatCurrency(d.dailyAmount)}</td>
          <td class="num">${formatCurrency(d.totalWage)}</td>
          <td class="num" style="color: #059669;">${formatCurrency(d.totalPaid)}</td>
          <td class="num" style="color: ${parseFloat(d.remaining || 0) > 0 ? '#dc2626' : '#059669'}; font-weight: 700;">
            ${formatCurrency(d.remaining)}
          </td>
        </tr>
      `;
    }).join('');

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Subh Ent. - Daily Worker Report</title>
          <style>
            @page { size: A4; margin: 12mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #111827; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 11px; line-height: 1.35; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 14px; }
            .company { margin: 0; font-size: 24px; font-weight: 800; color: #0369a1; }
            .subtitle { margin: 4px 0 0; font-size: 13px; color: #374151; font-weight: 700; }
            .date-box { text-align: right; font-size: 11px; color: #4b5563; }
            .date-box strong { display: block; color: #111827; font-size: 12px; margin-bottom: 3px; }
            .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
            .summary-card { border: 1px solid #d1d5db; padding: 10px; border-radius: 8px; background: #f9fafb; text-align: center; }
            .label { margin: 0 0 4px; color: #6b7280; font-size: 10px; font-weight: 700; text-transform: uppercase; }
            .value { margin: 0; font-size: 15px; font-weight: 800; color: #111827; }
            table { width: 100%; border-collapse: collapse; page-break-inside: auto; margin-top: 10px; }
            tr { page-break-inside: avoid; }
            th, td { border: 1px solid #d1d5db; padding: 7px 9px; vertical-align: middle; }
            th { background: #f0f9ff; color: #0369a1; font-size: 10px; text-transform: uppercase; font-weight: 800; text-align: left; }
            .num { text-align: right; white-space: nowrap; }
            .totals-row td { font-weight: 800; background: #f3f4f6; font-size: 12px; }
            .footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 10px; text-align: center; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="company">Subh Ent.</h1>
              <p class="subtitle">🏗️ Daily Worker Summary & Attendance Report</p>
            </div>
            <div class="date-box">
              <strong>Period</strong>
              ${escapeHtml(dateRangeLabel)}<br />
              Generated: ${formatDate(getTodayDate())}
            </div>
          </div>

          <div class="summary-grid">
            <div class="summary-card">
              <p class="label">Total Recorded Days</p>
              <p class="value">${report.daily.length}</p>
            </div>
            <div class="summary-card">
              <p class="label">Total Worker-Days</p>
              <p class="value">${totalDailyWorkers}</p>
            </div>
            <div class="summary-card">
              <p class="label">Total Daily Wage</p>
              <p class="value">${formatCurrency(dailyTotalWage)}</p>
            </div>
            <div class="summary-card">
              <p class="label">Total Remaining Due</p>
              <p class="value" style="color: #dc2626;">${formatCurrency(dailyTotalRem)}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Groups Breakdown</th>
                <th class="num">Workers</th>
                <th class="num">Avg Daily Rate</th>
                <th class="num">Total Wage</th>
                <th class="num">Total Paid</th>
                <th class="num">Remaining Due</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
              <tr class="totals-row">
                <td colspan="2">TOTAL (${report.daily.length} Dates)</td>
                <td class="num">${totalDailyWorkers}</td>
                <td></td>
                <td class="num">${formatCurrency(dailyTotalWage)}</td>
                <td class="num" style="color: #059669;">${formatCurrency(dailyTotalPaid)}</td>
                <td class="num" style="color: #dc2626;">${formatCurrency(dailyTotalRem)}</td>
              </tr>
            </tbody>
          </table>

          <div class="footer">Subh Ent. Management System • Developed by Subrata Bala</div>
          <script>
            window.onload = () => { window.focus(); window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    toast.success('Daily Worker PDF is ready to print/save.');
  };

  // ==========================================
  // 3. COMBINED DOWNLOAD (BOTH)
  // ==========================================
  const exportCombinedCSV = () => {
    if (!report) return;
    let csv = `Subh Ent. - Consolidated Wage and Daily Worker Report (${dateRangeLabel})\n\n`;

    csv += '--- 1. Individual Labour Wages ---\n';
    csv += 'Name,Present Days,Total Wage,Total Paid,Remaining Due\n';
    report.wages.forEach(w => {
      csv += `${escapeCSV(w.labour?.name)},${w.presentDays || 0},${w.totalWage || 0},${w.totalPaid || 0},${w.remaining || 0}\n`;
    });
    csv += `Subtotal,${totalPresentDays},${totalWage},${totalPaid},${totalRem}\n\n`;

    csv += '--- 2. Daily Worker Summary ---\n';
    csv += 'Date,Workers,Daily Rate,Total Wage,Total Paid,Remaining Due\n';
    report.daily.forEach(d => {
      csv += `${formatDate(d.date)},${d.totalWorkers || 0},${d.dailyAmount || 0},${d.totalWage || 0},${d.totalPaid || 0},${d.remaining || 0}\n`;
    });
    csv += `Subtotal,${totalDailyWorkers},,${dailyTotalWage},${dailyTotalPaid},${dailyTotalRem}\n\n`;

    csv += `GRAND TOTAL EXPENSE,,,${grandTotalWage},${grandTotalPaid},${grandTotalRem}\n`;

    const fileSuffix = startDate && endDate ? `${startDate}_to_${endDate}` : 'all_dates';
    downloadBlob(csv, `consolidated_report_${fileSuffix}.csv`);
    toast.success('Consolidated CSV downloaded!');
  };

  const exportCombinedPDF = () => {
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
          <title>Subh Ent. Consolidated Report</title>
          <style>
            @page { size: A4; margin: 12mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #111827; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 11px; line-height: 1.35; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 14px; }
            .company { margin: 0; font-size: 26px; font-weight: 800; }
            .subtitle { margin: 4px 0 0; font-size: 12px; color: #4b5563; font-weight: 700; }
            .date-box { text-align: right; font-size: 11px; color: #374151; }
            .date-box strong { display: block; color: #111827; font-size: 12px; margin-bottom: 3px; }
            .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
            .summary-card { border: 1px solid #d1d5db; padding: 10px; border-radius: 8px; background: #f9fafb; text-align: center; }
            .label { margin: 0 0 4px; color: #6b7280; font-size: 10px; font-weight: 800; text-transform: uppercase; }
            .value { margin: 0; font-size: 16px; font-weight: 800; }
            .section { margin-top: 16px; page-break-inside: avoid; }
            h2 { margin: 0 0 8px; font-size: 13px; border-left: 4px solid #10b981; padding-left: 8px; color: #111827; }
            table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
            tr { page-break-inside: avoid; }
            th, td { border: 1px solid #d1d5db; padding: 6px 8px; vertical-align: middle; }
            th { background: #f3f4f6; color: #111827; font-size: 9px; text-transform: uppercase; text-align: left; }
            .num { text-align: right; white-space: nowrap; }
            .empty { text-align: center; color: #6b7280; padding: 14px; }
            .totals-row td { font-weight: 800; background: #f3f4f6; }
            .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #d1d5db; color: #6b7280; font-size: 10px; text-align: center; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="company">Subh Ent.</h1>
              <p class="subtitle">Complete Wage and Daily Worker Consolidated Report</p>
            </div>
            <div class="date-box">
              <strong>Report Date</strong>
              ${escapeHtml(dateRangeLabel)}<br />
              Generated: ${formatDate(getTodayDate())}
            </div>
          </div>

          <div class="summary-grid">
            <div class="summary-card">
              <p class="label">Total Expense</p>
              <p class="value">${formatCurrency(grandTotalWage)}</p>
            </div>
            <div class="summary-card">
              <p class="label">Total Paid</p>
              <p class="value" style="color: #059669;">${formatCurrency(grandTotalPaid)}</p>
            </div>
            <div class="summary-card">
              <p class="label">Total Remaining</p>
              <p class="value" style="color: #dc2626;">${formatCurrency(grandTotalRem)}</p>
            </div>
          </div>

          <div class="section">
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
                  <td class="num">${totalPresentDays}</td>
                  <td class="num">${formatCurrency(totalWage)}</td>
                  <td class="num">${formatCurrency(totalPaid)}</td>
                  <td class="num">${formatCurrency(totalRem)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="section">
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
                  <td class="num">${totalDailyWorkers}</td>
                  <td></td>
                  <td class="num">${formatCurrency(dailyTotalWage)}</td>
                  <td class="num">${formatCurrency(dailyTotalPaid)}</td>
                  <td class="num">${formatCurrency(dailyTotalRem)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="footer">Subh Ent. Management System • Developed by Subrata Bala</div>
          <script>
            window.onload = () => { window.focus(); window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    toast.success('Combined PDF report is ready to save.');
  };

  // Filtered rows for UI
  const filteredWages = useMemo(() => {
    if (!report?.wages) return [];
    if (!labourSearch.trim()) return report.wages;
    const q = labourSearch.toLowerCase().trim();
    return report.wages.filter(w => w.labour?.name?.toLowerCase().includes(q));
  }, [report, labourSearch]);

  const filteredDaily = useMemo(() => {
    if (!report?.daily) return [];
    if (!dailySearch.trim()) return report.daily;
    const q = dailySearch.toLowerCase().trim();
    return report.daily.filter(d => {
      const dateMatch = formatDate(d.date).toLowerCase().includes(q) || d.date.includes(q);
      const groupMatch = Array.isArray(d.groups) && d.groups.some(g => g.name?.toLowerCase().includes(q));
      return dateMatch || groupMatch;
    });
  }, [report, dailySearch]);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: '800', fontSize: '24px', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📊</span> Reports & Downloads
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            Download Daily Worker data and Normal Labour details separately or combined
          </p>
        </div>

        {/* Admin Owner Switcher if Admin */}
        {isAdmin && (
          <div style={{ background: 'var(--surface2)', padding: '6px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>Owner:</span>
            <select
              value={selectedOwnerId}
              onChange={e => setSelectedOwnerId(e.target.value)}
              style={{
                background: 'var(--surface)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {adminOwners.map(o => (
                <option key={o.id} value={o.id}>{o.name || o.username || `Owner #${o.id}`}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Date Filter & Preset Controls */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '18px', border: '1px solid var(--border)', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        {/* Preset quick buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {[
            { id: 'month', label: '📅 This Month' },
            { id: '30d', label: '📅 Last 30 Days' },
            { id: 'today', label: '📅 Today' },
            { id: 'all', label: '⚡ All Recorded Dates' },
          ].map(p => {
            const isSel = activePreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                style={{
                  padding: '7px 13px',
                  borderRadius: '8px',
                  border: isSel ? '1.5px solid var(--primary, #0ea5e9)' : '1px solid var(--border)',
                  background: isSel ? 'rgba(14, 165, 233, 0.12)' : 'var(--surface2)',
                  color: isSel ? 'var(--primary, #0ea5e9)' : 'var(--text)',
                  fontSize: '12px',
                  fontWeight: isSel ? '700' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setActivePreset('custom'); }}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setActivePreset('custom'); }}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
          <button
            onClick={fetchReport}
            disabled={loading}
            style={{
              padding: '11px 22px',
              background: 'linear-gradient(135deg, #0ea5e9, #10b981)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontWeight: '700',
              fontSize: '14px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              height: '42px',
              boxShadow: '0 2px 6px rgba(14, 165, 233, 0.25)'
            }}
          >
            {loading ? '⏳ Loading...' : '📊 Generate Report'}
          </button>
        </div>
      </div>

      {report && (
        <>
          {/* ======================================================== */}
          {/* DEDICATED SEPARATE DOWNLOAD CENTER                      */}
          {/* ======================================================== */}
          <div style={{ marginBottom: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                📥 Download Reports Separately
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {escapeHtml(dateRangeLabel)}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              {/* Card 1: Normal Labour Details */}
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1.5px solid #10b981', padding: '16px', position: 'relative', overflow: 'hidden', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '20px' }}>👷</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>Normal Labour Details</h3>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>Individual wages, days worked & payments</p>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--surface2)', padding: '8px 10px', borderRadius: '6px', margin: '10px 0 12px', fontSize: '11px' }}>
                  <span><strong>{report.wages.length}</strong> Labourers</span>
                  <span>Due: <strong style={{ color: totalRem > 0 ? '#ef4444' : '#10b981' }}>{formatCurrency(totalRem)}</strong></span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    onClick={exportNormalLabourPDF}
                    style={{
                      padding: '9px 12px',
                      background: '#10b981',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px'
                    }}
                  >
                    <span>📄</span> PDF
                  </button>
                  <button
                    onClick={exportNormalLabourCSV}
                    style={{
                      padding: '9px 12px',
                      background: 'var(--surface2)',
                      border: '1.5px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text)',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px'
                    }}
                  >
                    <span>📊</span> CSV / Excel
                  </button>
                </div>
              </div>

              {/* Card 2: Daily Worker Data */}
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1.5px solid #0284c7', padding: '16px', position: 'relative', overflow: 'hidden', boxShadow: '0 2px 8px rgba(2, 132, 199, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '20px' }}>🏗️</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>Daily Worker Data</h3>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>Groups attendance, daily rates & wage details</p>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--surface2)', padding: '8px 10px', borderRadius: '6px', margin: '10px 0 12px', fontSize: '11px' }}>
                  <span><strong>{report.daily.length}</strong> Dates ({totalDailyWorkers}w)</span>
                  <span>Due: <strong style={{ color: dailyTotalRem > 0 ? '#ef4444' : '#10b981' }}>{formatCurrency(dailyTotalRem)}</strong></span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    onClick={exportDailyWorkerPDF}
                    style={{
                      padding: '9px 12px',
                      background: '#0284c7',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px'
                    }}
                  >
                    <span>📄</span> PDF
                  </button>
                  <button
                    onClick={exportDailyWorkerCSV}
                    style={{
                      padding: '9px 12px',
                      background: 'var(--surface2)',
                      border: '1.5px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text)',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px'
                    }}
                  >
                    <span>📊</span> CSV / Excel
                  </button>
                </div>
              </div>

              {/* Card 3: Combined Report */}
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '16px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '20px' }}>📑</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>Combined Report</h3>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>Consolidated summary across all labour types</p>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--surface2)', padding: '8px 10px', borderRadius: '6px', margin: '10px 0 12px', fontSize: '11px' }}>
                  <span>Total Exp: <strong>{formatCurrency(grandTotalWage)}</strong></span>
                  <span>Net Due: <strong style={{ color: grandTotalRem > 0 ? '#ef4444' : '#10b981' }}>{formatCurrency(grandTotalRem)}</strong></span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    onClick={exportCombinedPDF}
                    style={{
                      padding: '9px 12px',
                      background: 'var(--surface2)',
                      border: '1.5px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text)',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px'
                    }}
                  >
                    <span>📄</span> All PDF
                  </button>
                  <button
                    onClick={exportCombinedCSV}
                    style={{
                      padding: '9px 12px',
                      background: 'var(--surface2)',
                      border: '1.5px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text)',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px'
                    }}
                  >
                    <span>📊</span> All CSV
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Grand Totals KPI Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            {[
              { label: 'Total Expense', value: formatCurrency(grandTotalWage), color: 'var(--text)', icon: '💰' },
              { label: 'Total Paid', value: formatCurrency(grandTotalPaid), color: '#10b981', icon: '✅' },
              { label: 'Total Remaining Due', value: formatCurrency(grandTotalRem), color: '#ef4444', icon: '⏳' }
            ].map(({ label, value, color, icon }) => (
              <div key={label} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '16px 18px', border: '1px solid var(--border)', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>{label}</p>
                  <span style={{ fontSize: '16px' }}>{icon}</span>
                </div>
                <p style={{ margin: 0, fontWeight: '800', fontSize: '22px', color }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Tab View Switcher */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
            {[
              { id: 'all', label: `📋 All Data (${report.wages.length + report.daily.length})` },
              { id: 'wages', label: `👷 Normal Labour (${report.wages.length})` },
              { id: 'daily', label: `🏗️ Daily Workers (${report.daily.length})` },
            ].map(t => {
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: isActive ? 'var(--primary, #0ea5e9)' : 'var(--surface2)',
                    color: isActive ? '#ffffff' : 'var(--text)',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* ======================================================== */}
          {/* SECTION 1: NORMAL LABOUR WAGES TABLE                     */}
          {/* ======================================================== */}
          {(activeTab === 'all' || activeTab === 'wages') && (
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: '22px' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>👷</span>
                  <div>
                    <span style={{ fontWeight: '800', fontSize: '14px' }}>Individual Labour Wages</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>({report.wages.length} labourers)</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Search labour..."
                    value={labourSearch}
                    onChange={e => setLabourSearch(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                  />
                  <button
                    onClick={exportNormalLabourPDF}
                    title="Download Normal Labour PDF"
                    style={{ padding: '6px 10px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    📄 PDF
                  </button>
                  <button
                    onClick={exportNormalLabourCSV}
                    title="Download Normal Labour CSV"
                    style={{ padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    📊 CSV
                  </button>
                </div>
              </div>

              {filteredWages.map(w => {
                const isDue = parseFloat(w.remaining || 0) > 0;
                return (
                  <div key={w.labour.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.15s ease' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: '700', fontSize: '14px' }}>{w.labour.name}</p>
                      <div style={{ display: 'flex', gap: '10px', margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                        <span>📅 {w.presentDays || 0} days</span>
                        <span>• Paid: {formatCurrency(w.totalPaid)}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontWeight: '800', fontSize: '14px', color: 'var(--text)' }}>{formatCurrency(w.totalWage)}</p>
                      <span style={{ display: 'inline-block', marginTop: '2px', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', background: isDue ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)', color: isDue ? '#ef4444' : '#10b981' }}>
                        {isDue ? `Due: ${formatCurrency(w.remaining)}` : 'Cleared'}
                      </span>
                    </div>
                  </div>
                );
              })}

              {filteredWages.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No individual labour records found for this period.
                </div>
              )}

              {/* Table Subtotal Footer */}
              {report.wages.length > 0 && (
                <div style={{ padding: '12px 16px', background: 'var(--surface2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: '700' }}>
                  <span>Total Labour Wage: {formatCurrency(totalWage)}</span>
                  <span style={{ color: totalRem > 0 ? '#ef4444' : '#10b981' }}>Total Due: {formatCurrency(totalRem)}</span>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* SECTION 2: DAILY WORKER SUMMARY TABLE                    */}
          {/* ======================================================== */}
          {(activeTab === 'all' || activeTab === 'daily') && (
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🏗️</span>
                  <div>
                    <span style={{ fontWeight: '800', fontSize: '14px' }}>Daily Worker Summary</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>({report.daily.length} dates recorded)</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Search date or group..."
                    value={dailySearch}
                    onChange={e => setDailySearch(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                  />
                  <button
                    onClick={exportDailyWorkerPDF}
                    title="Download Daily Worker PDF"
                    style={{ padding: '6px 10px', background: '#0284c7', color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    📄 PDF
                  </button>
                  <button
                    onClick={exportDailyWorkerCSV}
                    title="Download Daily Worker CSV"
                    style={{ padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    📊 CSV
                  </button>
                </div>
              </div>

              {filteredDaily.map(d => {
                const isDue = parseFloat(d.remaining || 0) > 0;
                return (
                  <div key={d.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div>
                        <span style={{ fontWeight: '800', fontSize: '14px' }}>{formatDate(d.date)}</span>
                        <span style={{ marginLeft: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                          👥 {d.totalWorkers || 0} Workers @ avg {formatCurrency(d.dailyAmount)}/day
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: '800', fontSize: '14px' }}>{formatCurrency(d.totalWage)}</span>
                        <div style={{ marginTop: '2px' }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', background: isDue ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)', color: isDue ? '#ef4444' : '#10b981' }}>
                            {isDue ? `Due: ${formatCurrency(d.remaining)}` : 'Cleared'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Group Badges if recorded with groups */}
                    {Array.isArray(d.groups) && d.groups.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                        {d.groups.map((g, idx) => {
                          const gCount = g.workerCount !== undefined ? g.workerCount : (g.totalWorkers || 0);
                          const gRate = g.dailyRate !== undefined ? g.dailyRate : (g.dailyAmount || 0);
                          return (
                            <span key={idx} style={{ background: 'var(--surface2)', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', color: 'var(--text)', border: '1px solid var(--border)' }}>
                              🏷️ <strong>{g.name || `Group ${idx + 1}`}</strong>: {gCount} workers @ ₹{gRate}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredDaily.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No daily worker records found for this period.
                </div>
              )}

              {/* Daily Worker Subtotal Footer */}
              {report.daily.length > 0 && (
                <div style={{ padding: '12px 16px', background: 'var(--surface2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: '700' }}>
                  <span>Total Daily Wage: {formatCurrency(dailyTotalWage)}</span>
                  <span style={{ color: dailyTotalRem > 0 ? '#ef4444' : '#10b981' }}>Total Due: {formatCurrency(dailyTotalRem)}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '24px 0 10px', fontSize: '12px', color: 'var(--text-muted)', opacity: 0.65 }}>
        Subh Ent. Management System • Developed by Subrata Bala
      </div>
    </div>
  );
}
