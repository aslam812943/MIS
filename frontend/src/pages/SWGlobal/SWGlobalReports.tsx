import { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download, CalendarDays, Printer, X, RefreshCw, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { authService } from '../../services/auth.service';
import { swGlobalService } from '../../services/swGlobal.service';
import type { SWGlobalAccountReport } from '../../types/swGlobal.types';
import type { Branch } from '../../services/org.service';

type Period = 'week' | 'month' | 'year' | 'custom' | 'all';

export function reportDates(period: Period, anchor: string): [string, string] {
  const start = new Date(`${anchor}T00:00:00Z`);
  const end = new Date(start);
  if (period === 'week') {
    start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
    end.setTime(start.getTime());
    end.setUTCDate(end.getUTCDate() + 6);
  } else if (period === 'month') {
    start.setUTCDate(1);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
  } else if (period === 'year') {
    start.setUTCMonth(0, 1);
    end.setUTCMonth(11, 31);
  }
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

const control = 'rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]';
const columns = ['#', 'Client Code', 'Client Name', 'Account No', 'Branch', 'Contact', 'Location', 'Status', 'Pending Reason', 'Follow-up'];

const accountCells = (a: SWGlobalAccountReport['accounts'][number], index: number) => [
  String(index + 1),
  a.client_code || '-',
  a.name || '-',
  a.account_no || '-',
  a.branch_name || 'Unassigned',
  a.contact || '-',
  a.location || '-',
  a.status || 'Pending',
  a.pending_reason || (a.status === 'Pending' ? 'Pending verification' : '-'),
  a.followup ? a.followup.slice(0, 10) : (a.created_at ? a.created_at.slice(0, 10) : '-')
];

interface SWGlobalReportsProps {
  branches?: Branch[];
  initialBranchId?: string;
  onBranchChange?: (branchId: string) => void;
}

export default function SWGlobalReports({ branches = [], initialBranchId = '', onBranchChange }: SWGlobalReportsProps) {
  const user = authService.getCurrentUser();
  const normalizedRole = String(user?.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const allBranches = ['hod', 'ceo', 'managing_director', 'director', 'executive', 'admin'].includes(normalizedRole);
  const [period, setPeriod] = useState<Period>('month');
  const [anchor] = useState(new Date().toISOString().slice(0, 10));
  const [from, setFrom] = useState(anchor);
  const [to, setTo] = useState(anchor);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [branchId, setBranchId] = useState(initialBranchId);
  const [report, setReport] = useState<(SWGlobalAccountReport & { branchLabel: string }) | null>(null);

  useEffect(() => {
    let cancelled = false;
    let start: string | undefined, end: string | undefined;
    if (period === 'custom') [start, end] = [from, to];
    else if (period !== 'all') {
      [start, end] = reportDates(period, anchor);
    }
    setReport(null);
    setError('');
    if (period !== 'custom' || (start && end && start <= end)) {
      setBusy(true);
      swGlobalService.getAccountReport(start, end, branchId || undefined).then(data => {
        if (cancelled) return;
        const selectedBranch = branches.find(branch => branch.id === branchId);
        setReport({ ...data, branchLabel: selectedBranch?.name || (allBranches ? 'All branches' : 'My entries') });
      }).catch((err: any) => {
        if (!cancelled) setError(err.response?.data?.error || 'Could not generate report.');
      }).finally(() => { if (!cancelled) setBusy(false); });
    } else {
      setError('Select a valid date range.');
      setBusy(false);
    }
    return () => { cancelled = true; };
  }, [period, anchor, from, to, allBranches, retry, branchId, branches]);

  useEffect(() => setBranchId(initialBranchId), [initialBranchId]);

  const branchRows = report ? Array.from(new Set(report.accounts.map(a => a.branch_id || 'unassigned'))).map(id => {
    const rows = report.accounts.filter(a => (a.branch_id || 'unassigned') === id);
    return [
      rows[0]?.branch_name || 'Unassigned',
      String(rows.length),
      String(new Set(rows.map(a => a.client_code)).size),
      String(rows.filter(a => a.status === 'Active').length),
      String(rows.filter(a => a.status === 'Pending').length),
      String(rows.filter(a => a.status === 'Closed').length),
      rows.length > 0 ? `${Math.round((rows.filter(a => a.status === 'Active').length / rows.length) * 100)}%` : '0%'
    ];
  }) : [];

  const totalAccounts = report?.accounts.length || 0;
  const totalClients = report ? new Set(report.accounts.map(a => a.client_code)).size : 0;
  const activeAccounts = report?.accounts.filter(a => a.status === 'Active').length || 0;
  const pendingAccounts = report?.accounts.filter(a => a.status === 'Pending').length || 0;
  const closedAccounts = report?.accounts.filter(a => a.status === 'Closed').length || 0;

  const branchColumns = ['Branch', 'Accounts', 'Clients', 'Active', 'Pending', 'Closed', 'Active Rate'];

  const formatReportDate = (dStr?: string) => {
    if (!dStr) return 'All Dates';
    const date = new Date(dStr);
    if (isNaN(date.getTime())) return dStr;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const periodLabel = period === 'all'
    ? 'All Time Records'
    : period === 'week'
    ? 'Current Week'
    : period === 'month'
    ? 'Current Month'
    : period === 'year'
    ? 'Current Year'
    : `${formatReportDate(from)} to ${formatReportDate(to)}`;

  // ── High Quality PDF Download with jsPDF and AutoTable ──
  const download = () => {
    if (!report) return;
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = 297;
      const pageHeight = 210;
      const margin = 14;
      const contentWidth = pageWidth - margin * 2; // 269mm

      // Header Banner Background
      doc.setFillColor(15, 23, 42); // slate-900
      doc.roundedRect(margin, 12, contentWidth, 22, 2.5, 2.5, 'F');

      // Title & Subtitle
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text('SW GLOBAL ACCOUNT OPERATIONS REPORT', margin + 6, 20);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text('Management Information System (MIS) · Department Portfolio & Branch Analytics', margin + 6, 27);

      // Top Right Meta in Header Banner
      doc.setFontSize(7.5);
      doc.setTextColor(226, 232, 240); // slate-200
      const metaRight = `${report.branchLabel} | Period: ${periodLabel}`;
      const genTime = `Generated: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
      doc.text(metaRight, pageWidth - margin - 6, 20, { align: 'right' });
      doc.setTextColor(148, 163, 184);
      doc.text(genTime, pageWidth - margin - 6, 27, { align: 'right' });

      // KPI Metric Cards (5 Cards)
      const kpiY = 38;
      const cardHeight = 16;
      const cardCount = 5;
      const cardGap = 3.5;
      const cardWidth = (contentWidth - cardGap * (cardCount - 1)) / cardCount;

      const kpis = [
        { label: 'TOTAL ACCOUNTS', val: String(totalAccounts), sub: 'Registered portfolios', color: [59, 130, 246] }, // blue
        { label: 'UNIQUE CLIENTS', val: String(totalClients), sub: 'Distinct client codes', color: [99, 102, 241] }, // indigo
        { label: 'ACTIVE ACCOUNTS', val: String(activeAccounts), sub: `${totalAccounts ? Math.round((activeAccounts / totalAccounts) * 100) : 0}% active ratio`, color: [16, 185, 129] }, // emerald
        { label: 'PENDING ACTION', val: String(pendingAccounts), sub: 'Requires follow-up', color: [245, 158, 11] }, // amber
        { label: 'CLOSED ACCOUNTS', val: String(closedAccounts), sub: 'Archived records', color: [148, 163, 184] } // slate
      ];

      kpis.forEach((k, i) => {
        const x = margin + i * (cardWidth + cardGap);
        // Card background
        doc.setFillColor(248, 250, 252); // slate-50
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.roundedRect(x, kpiY, cardWidth, cardHeight, 2, 2, 'FD');

        // Top color bar
        doc.setFillColor(k.color[0], k.color[1], k.color[2]);
        doc.roundedRect(x, kpiY, cardWidth, 1.5, 1, 1, 'F');

        // Label
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text(k.label, x + 3.5, kpiY + 6);

        // Value
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(k.val, x + 3.5, kpiY + 11.5);

        // Subtitle
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        doc.text(k.sub, x + 3.5, kpiY + 14.5);
      });

      let currentY = kpiY + cardHeight + 6;

      // Section 1: Branch Summary Table (if multiple rows or available)
      if (branchRows.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.text('Branch Performance Summary', margin, currentY);
        currentY += 2.5;

        autoTable(doc, {
          startY: currentY,
          head: [branchColumns],
          body: branchRows,
          margin: { left: margin, right: margin },
          theme: 'grid',
          headStyles: {
            fillColor: [30, 41, 59], // slate-800
            textColor: [255, 255, 255],
            fontSize: 7.5,
            fontStyle: 'bold',
            halign: 'left',
            cellPadding: 2
          },
          bodyStyles: {
            fontSize: 7.5,
            textColor: [30, 41, 59],
            cellPadding: 2
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252]
          },
          columnStyles: {
            0: { cellWidth: 50, fontStyle: 'bold' },
            1: { cellWidth: 35, halign: 'right' },
            2: { cellWidth: 35, halign: 'right' },
            3: { cellWidth: 35, halign: 'right', textColor: [16, 185, 129] },
            4: { cellWidth: 35, halign: 'right', textColor: [217, 119, 6] },
            5: { cellWidth: 35, halign: 'right', textColor: [100, 116, 139] },
            6: { cellWidth: 44, halign: 'right', fontStyle: 'bold' }
          }
        });

        currentY = (doc as any).lastAutoTable.finalY + 7;
      }

      // Section 2: Detailed Account Registry Table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text(`Account Details Directory (${report.accounts.length} Records)`, margin, currentY);
      currentY += 2.5;

      const accountTableRows = report.accounts.map((a, idx) => accountCells(a, idx));

      autoTable(doc, {
        startY: currentY,
        head: [columns],
        body: accountTableRows.length > 0 ? accountTableRows : [['-', 'No accounts found matching this date and branch selection.', '', '', '', '', '', '', '', '']],
        margin: { left: margin, right: margin },
        theme: 'striped',
        headStyles: {
          fillColor: [15, 23, 42], // slate-900
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: 'bold',
          cellPadding: 2.2
        },
        bodyStyles: {
          fontSize: 7.2,
          textColor: [30, 41, 59],
          cellPadding: 2,
          valign: 'middle'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' }, // #
          1: { cellWidth: 20, fontStyle: 'bold', textColor: [2, 132, 199] }, // Code
          2: { cellWidth: 38, fontStyle: 'bold' }, // Name
          3: { cellWidth: 22, fontStyle: 'bold' }, // Acc No
          4: { cellWidth: 24 }, // Branch
          5: { cellWidth: 24 }, // Contact
          6: { cellWidth: 24 }, // Location
          7: { cellWidth: 18, halign: 'center' }, // Status
          8: { cellWidth: 63 }, // Pending Reason
          9: { cellWidth: 28, halign: 'center' } // Follow-up
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 7) {
            const raw = String(data.cell.raw || '').trim();
            if (raw === 'Active') {
              data.cell.styles.textColor = [16, 185, 129];
              data.cell.styles.fontStyle = 'bold';
            } else if (raw === 'Pending') {
              data.cell.styles.textColor = [217, 119, 6];
              data.cell.styles.fontStyle = 'bold';
            } else if (raw === 'Closed') {
              data.cell.styles.textColor = [100, 116, 139];
            }
          }
        }
      });

      // Page Footers on all pages
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text('Confidential · Management Information System (MIS) · SW Global Department', margin, pageHeight - 6);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
      }

      doc.save(`SW-Global-Report-${report.from || 'all'}-to-${report.to || 'time'}.pdf`);
      toast.success('SW Global PDF report downloaded');
    } catch (err: any) {
      console.error('PDF generation failed:', err);
      toast.error('Failed to generate PDF report.');
    }
  };

  // ── Executive Print Report Template ──
  const print = () => {
    if (!report) return;
    const popup = window.open('', '_blank');
    if (!popup) return toast.error('Allow pop-ups to print the report.');

    const escape = (value: unknown) =>
      String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>SW Global Account Report</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #fff;
      font-size: 11px;
      line-height: 1.4;
      padding: 10px;
    }
    .header-banner {
      background: #0f172a;
      color: #fff;
      border-radius: 8px;
      padding: 14px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    }
    .header-banner h1 {
      font-size: 16px;
      font-weight: 800;
      letter-spacing: 0.3px;
      margin-bottom: 3px;
    }
    .header-banner p {
      font-size: 10px;
      color: #94a3b8;
    }
    .meta-box {
      text-align: right;
      font-size: 10px;
      color: #e2e8f0;
    }
    .meta-box .sub {
      color: #94a3b8;
      font-size: 9px;
      margin-top: 2px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-top: 3px solid #0f172a;
      border-radius: 6px;
      padding: 8px 10px;
    }
    .kpi-card.blue { border-top-color: #3b82f6; }
    .kpi-card.indigo { border-top-color: #6366f1; }
    .kpi-card.emerald { border-top-color: #10b981; }
    .kpi-card.amber { border-top-color: #f59e0b; }
    .kpi-card.slate { border-top-color: #94a3b8; }
    .kpi-card .lbl {
      font-size: 8.5px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .kpi-card .val {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      margin: 2px 0;
    }
    .kpi-card .sub {
      font-size: 8.5px;
      color: #64748b;
    }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      color: #1e293b;
      margin: 12px 0 6px 0;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 9.5px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 5.5px 7px;
      text-align: left;
      vertical-align: middle;
    }
    th {
      background: #0f172a;
      color: #fff;
      font-weight: 700;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    thead {
      display: table-header-group;
    }
    tr {
      break-inside: avoid;
    }
    tr:nth-child(even) {
      background: #f8fafc;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 8.5px;
      font-weight: 700;
      text-align: center;
    }
    .badge-active { background: #dcfce7; color: #15803d; }
    .badge-pending { background: #fef3c7; color: #b45309; }
    .badge-closed { background: #f1f5f9; color: #64748b; }
    .footer-bar {
      margin-top: 14px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 8.5px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="header-banner">
    <div>
      <h1>SW GLOBAL ACCOUNT OPERATIONS REPORT</h1>
      <p>Management Information System (MIS) · Department Portfolio & Branch Analytics</p>
    </div>
    <div class="meta-box">
      <div>${escape(report.branchLabel)} | Period: ${escape(periodLabel)}</div>
      <div class="sub">Generated: ${escape(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }))}, ${escape(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))}</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card blue">
      <div class="lbl">Total Accounts</div>
      <div class="val">${totalAccounts}</div>
      <div class="sub">Registered portfolios</div>
    </div>
    <div class="kpi-card indigo">
      <div class="lbl">Unique Clients</div>
      <div class="val">${totalClients}</div>
      <div class="sub">Distinct client codes</div>
    </div>
    <div class="kpi-card emerald">
      <div class="lbl">Active Accounts</div>
      <div class="val" style="color: #10b981;">${activeAccounts}</div>
      <div class="sub">${totalAccounts ? Math.round((activeAccounts / totalAccounts) * 100) : 0}% active ratio</div>
    </div>
    <div class="kpi-card amber">
      <div class="lbl">Pending Action</div>
      <div class="val" style="color: #f59e0b;">${pendingAccounts}</div>
      <div class="sub">Requires follow-up</div>
    </div>
    <div class="kpi-card slate">
      <div class="lbl">Closed Accounts</div>
      <div class="val" style="color: #64748b;">${closedAccounts}</div>
      <div class="sub">Archived records</div>
    </div>
  </div>

  ${branchRows.length > 0 ? `
    <div class="section-title">Branch Performance Summary</div>
    <table>
      <thead>
        <tr>
          ${branchColumns.map(h => `<th>${escape(h)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${branchRows.map(row => `
          <tr>
            <td style="font-weight: 700;">${escape(row[0])}</td>
            <td style="text-align: right;">${escape(row[1])}</td>
            <td style="text-align: right;">${escape(row[2])}</td>
            <td style="text-align: right; color: #16a34a; font-weight: 700;">${escape(row[3])}</td>
            <td style="text-align: right; color: #d97706; font-weight: 700;">${escape(row[4])}</td>
            <td style="text-align: right; color: #64748b;">${escape(row[5])}</td>
            <td style="text-align: right; font-weight: 700;">${escape(row[6])}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''}

  <div class="section-title">Account Details Directory (${report.accounts.length} Records)</div>
  <table>
    <thead>
      <tr>
        ${columns.map(h => `<th>${escape(h)}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${report.accounts.length > 0 ? report.accounts.map((a, idx) => {
        const status = a.status || 'Pending';
        const badgeClass = status === 'Active' ? 'badge-active' : status === 'Pending' ? 'badge-pending' : 'badge-closed';
        return `
          <tr>
            <td style="text-align: center; color: #64748b;">${idx + 1}</td>
            <td style="font-weight: 700; color: #0284c7;">${escape(a.client_code || '-')}</td>
            <td style="font-weight: 700;">${escape(a.name || '-')}</td>
            <td style="font-weight: 700; font-family: monospace;">${escape(a.account_no || '-')}</td>
            <td>${escape(a.branch_name || 'Unassigned')}</td>
            <td>${escape(a.contact || '-')}</td>
            <td>${escape(a.location || '-')}</td>
            <td style="text-align: center;"><span class="badge ${badgeClass}">${escape(status)}</span></td>
            <td style="color: ${status === 'Pending' ? '#d97706' : '#334155'}; font-size: 9px;">${escape(a.pending_reason || (status === 'Pending' ? 'Pending verification' : '-'))}</td>
            <td style="text-align: center; font-size: 9px;">${escape(a.followup ? a.followup.slice(0, 10) : (a.created_at ? a.created_at.slice(0, 10) : '-'))}</td>
          </tr>
        `;
      }).join('') : `
        <tr><td colspan="${columns.length}" style="text-align: center; padding: 18px; color: #94a3b8;">No accounts found matching this selection.</td></tr>
      `}
    </tbody>
  </table>

  <div class="footer-bar">
    <div>Confidential · Management Information System (MIS) · SW Global Department</div>
    <div>System Generated Report</div>
  </div>

  <script>
    window.onload = () => {
      window.print();
    };
  </script>
</body>
</html>`;

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  };

  return (
    <section className="space-y-3">
      <div className="sw-report-toolbar">
        <div className="sw-report-period">
          <h2><CalendarDays size={17} />Date-wise Analysis & Export</h2>
          <div className="sw-report-segments" role="group" aria-label="Report period">
            {([['week', 'Weekly'], ['month', 'Monthly'], ['year', 'Yearly'], ['all', 'All Dates'], ['custom', 'Custom Date']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={period === value}
                className={period === value ? 'selected' : ''}
                onClick={() => { setPeriod(value); setReport(null); }}
              >
                {label}
              </button>
            ))}
          </div>
          {allBranches && (
            <label className="sw-report-branch">
              <span>Branch</span>
              <select
                value={branchId}
                onChange={e => {
                  const nextBranchId = e.target.value;
                  setBranchId(nextBranchId);
                  onBranchChange?.(nextBranchId);
                  setReport(null);
                }}
                aria-label="Report branch"
              >
                <option value="">All Branches Report</option>
                {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>
          )}
        </div>

        <div className="sw-report-actions">
          <button
            className="sw-report-summary"
            disabled={!report || busy}
            onClick={() => setPreview(!preview)}
            aria-expanded={preview}
            title="View report details"
          >
            {busy ? (
              <span className="flex items-center gap-1.5"><RefreshCw size={13} className="animate-spin" /> Loading...</span>
            ) : error ? (
              'Report unavailable'
            ) : (
              `${report?.branchLabel || 'All branches'} · ${periodLabel} · ${report?.accounts.length ?? 0} records`
            )}
          </button>
          <button
            className="sw-report-download"
            onClick={download}
            disabled={!report || busy}
            title="Export high-resolution PDF document"
          >
            <Download size={15} /> Download PDF
          </button>
          <button
            className="sw-report-print"
            onClick={print}
            disabled={!report || busy}
            title="Print structured report"
          >
            <Printer size={15} /> Print Report
          </button>
        </div>

        {period === 'custom' && (
          <div className="sw-report-dates">
            <label>From <input aria-label="Report start date" className={control} type="date" value={from} onChange={e => { setFrom(e.target.value); setReport(null); }} /></label>
            <label>To <input aria-label="Report end date" className={control} type="date" value={to} min={from} onChange={e => { setTo(e.target.value); setReport(null); }} /></label>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-3 text-xs text-red-500 bg-red-500/10 p-3 rounded-xl border border-red-500/20" role="alert">
          <AlertCircle size={15} />
          <span>{error}</span>
          <button className={control} onClick={() => setRetry(retry + 1)} title="Retry report" aria-label="Retry report">
            <RefreshCw size={13} />
          </button>
        </div>
      )}

      {/* On-screen preview expandable drawer */}
      {report && preview && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-sm space-y-4 animate-fadeIn" aria-live="polite">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider">Report Preview</span>
                <span className="text-xs text-[var(--text-muted)]">·</span>
                <span className="text-xs font-semibold text-[var(--text-primary)]">{periodLabel}</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {totalAccounts} accounts · {totalClients} unique clients · {activeAccounts} active · {pendingAccounts} pending · {closedAccounts} closed
              </p>
            </div>
            <button className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]" onClick={() => setPreview(false)} title="Close preview">
              <X size={15} />
            </button>
          </div>

          {/* KPI Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border)]">
              <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Accounts</span>
              <strong className="text-lg font-black text-[var(--text-primary)]">{totalAccounts}</strong>
            </div>
            <div className="p-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border)]">
              <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Clients</span>
              <strong className="text-lg font-black text-indigo-500">{totalClients}</strong>
            </div>
            <div className="p-3 rounded-xl bg-[var(--bg-base)] border border-emerald-500/20 bg-emerald-500/5">
              <span className="text-[10px] uppercase font-bold text-emerald-600 block">Active</span>
              <strong className="text-lg font-black text-emerald-600">{activeAccounts}</strong>
            </div>
            <div className="p-3 rounded-xl bg-[var(--bg-base)] border border-amber-500/20 bg-amber-500/5">
              <span className="text-[10px] uppercase font-bold text-amber-600 block">Pending</span>
              <strong className="text-lg font-black text-amber-600">{pendingAccounts}</strong>
            </div>
            <div className="p-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border)]">
              <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Closed</span>
              <strong className="text-lg font-black text-[var(--text-secondary)]">{closedAccounts}</strong>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-96 rounded-xl border border-[var(--border)]">
            <table className="w-full text-xs text-left">
              <thead className="bg-[var(--bg-base)] text-[var(--text-muted)] uppercase tracking-wider font-bold border-b border-[var(--border)] sticky top-0">
                <tr>
                  {columns.map(h => (
                    <th key={h} className="p-2.5 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {report.accounts.map((a, i) => (
                  <tr key={a.id} className="hover:bg-[var(--bg-hover)] transition">
                    <td className="p-2.5 text-[var(--text-muted)]">{i + 1}</td>
                    <td className="p-2.5 font-bold text-[var(--accent)]">{a.client_code}</td>
                    <td className="p-2.5 font-semibold text-[var(--text-primary)]">{a.name}</td>
                    <td className="p-2.5 font-mono font-medium text-[var(--text-primary)]">{a.account_no}</td>
                    <td className="p-2.5 text-[var(--text-secondary)]">{a.branch_name || 'Unassigned'}</td>
                    <td className="p-2.5 text-[var(--text-secondary)]">{a.contact}</td>
                    <td className="p-2.5 text-[var(--text-secondary)]">{a.location}</td>
                    <td className="p-2.5"><span className={`sw-tag ${a.status.toLowerCase()}`}>{a.status}</span></td>
                    <td className="p-2.5 text-[var(--text-secondary)]">{a.pending_reason || '-'}</td>
                    <td className="p-2.5 text-[var(--text-muted)]">{a.followup?.slice(0, 10) || a.created_at?.slice(0, 10) || '-'}</td>
                  </tr>
                ))}
                {report.accounts.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="p-8 text-center text-[var(--text-muted)]">
                      No accounts found for this selection.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
