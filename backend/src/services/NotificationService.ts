import { supabaseAdmin } from '../config/supabase.js';
import { EmailService } from './EmailService.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface Recipient {
  id: string;
  email: string;
  full_name: string | null;
}

interface DueItem {
  department: string;
  type: 'due_soon' | 'overdue';
  title: string;
  message: string;
  link: string;
  sourceTable: string;
  sourceId: string;
  branchId: string | null;
}

interface DueDateScanConfig {
  table: string;
  department: string;
  link: string;
  selectCols: string;
  dueCol: string;
  statusCol: string;
  openStatuses: string[];
  leadCol?: string;
  defaultLeadDays: number;
  label: (row: any) => string;
}

interface AgingScanConfig {
  table: string;
  department: string;
  link: string;
  selectCols: string;
  startCol: string;
  statusCol: string;
  openStatuses: string[];
  thresholdDays: number;
  label: (row: any) => string;
}

/**
 * Scans every department for deadline/aging conditions and raises in-app +
 * email notifications. Each department table was surveyed for its
 * due-date/status/lead-time columns; the two generic scan shapes below
 * (due-date-with-lead-time, and status-pending-too-long) cover every case
 * found, using each table's own `notification_lead_time_days` column where
 * it exists and a sensible fixed default where it doesn't.
 */
export class NotificationService {
  constructor(private emailService: EmailService) {}

  private client() {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client is not configured.');
    }
    return supabaseAdmin;
  }

  // ── In-app notification CRUD ────────────────────────────────

  async getUserNotifications(userId: string, limit = 50): Promise<any[]> {
    const { data, error } = await this.client()
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return data || [];
  }

  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await this.client()
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw new Error(error.message);
    return count || 0;
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    const { error } = await this.client()
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
  }

  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await this.client()
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw new Error(error.message);
  }

  /**
   * Instant, event-driven notification for a single task action (assigned,
   * reassigned, status changed, remarked on) — separate from the batch
   * due/overdue scan below. dedupe_key is timestamped per call since these
   * are one-off events, not a recurring scan result that needs deduping
   * across repeated runs.
   */
  async createTaskEventNotification(userId: string, title: string, message: string, taskId: string): Promise<void> {
    const dedupeKey = `task:${taskId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const { error } = await this.client().from('notifications').insert({
      user_id: userId,
      department: 'Tasks',
      type: 'task_update',
      title,
      message,
      link: '/tasks',
      source_table: 'tasks',
      source_id: taskId,
      dedupe_key: dedupeKey,
    });
    if (error) throw new Error(error.message);
  }

  // ── Recipient resolution ────────────────────────────────────

  // Department name -> id, resolved lazily and cached for the lifetime of
  // one runDueItemCheck() pass (dozens of items typically share the same
  // handful of departments, so this avoids a repeat lookup per item).
  private departmentIdCache = new Map<string, string | null>();

  private async resolveDepartmentId(departmentName: string): Promise<string | null> {
    if (this.departmentIdCache.has(departmentName)) {
      return this.departmentIdCache.get(departmentName)!;
    }
    const { data } = await this.client()
      .from('departments')
      .select('id')
      .ilike('name', departmentName)
      .maybeSingle();
    const id = data?.id || null;
    this.departmentIdCache.set(departmentName, id);
    return id;
  }

  /**
   * Notifies only the active HOD/Regional Manager of the record's own
   * branch AND department — e.g. an IT due item goes only to that branch's
   * IT HOD, not to every HOD in the branch regardless of department, and
   * not to the employee who happened to create the record.
   *
   * A null branchId means an HO-only, org-wide record (e.g. the recurring
   * IT audit schedule, which deliberately has no branch_id column) — in
   * that case notify every active HOD/regional manager in the department
   * org-wide, rather than dropping the notification entirely.
   */
  private async resolveRecipients(branchId: string | null, department: string): Promise<Recipient[]> {
    const departmentId = await this.resolveDepartmentId(department);
    if (!departmentId) return [];

    let query = this.client()
      .from('profiles')
      .select('id, email, full_name')
      .eq('department_id', departmentId)
      .eq('status', 'active')
      .in('role', ['hod', 'regional_manager']);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data: profiles } = await query;
    return profiles || [];
  }

  // ── Generic scan shapes ──────────────────────────────────────

  private buildDueDateItem(row: any, cfg: DueDateScanConfig): DueItem | null {
    if (!cfg.openStatuses.includes(row[cfg.statusCol])) return null;
    const dueDateStr = row[cfg.dueCol];
    if (!dueDateStr) return null;

    const dueDate = new Date(dueDateStr);
    const today = new Date();
    const leadDays = cfg.leadCol ? Number(row[cfg.leadCol] || cfg.defaultLeadDays) : cfg.defaultLeadDays;
    const alertFrom = new Date(dueDate.getTime() - leadDays * MS_PER_DAY);
    if (today < alertFrom) return null;

    const isOverdue = today > dueDate;
    const daysDiff = Math.max(1, Math.round(Math.abs(dueDate.getTime() - today.getTime()) / MS_PER_DAY));
    const label = cfg.label(row);
    const dueDateFmt = dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    return {
      department: cfg.department,
      type: isOverdue ? 'overdue' : 'due_soon',
      title: `${label} ${isOverdue ? 'is overdue' : 'is due soon'}`,
      message: isOverdue
        ? `${label} was due on ${dueDateFmt} — ${daysDiff} day${daysDiff === 1 ? '' : 's'} overdue.`
        : `${label} is due on ${dueDateFmt} — ${daysDiff} day${daysDiff === 1 ? '' : 's'} remaining.`,
      link: cfg.link,
      sourceTable: cfg.table,
      sourceId: row.id,
      branchId: row.branch_id || null,
    };
  }

  private async scanDueDate(cfg: DueDateScanConfig): Promise<DueItem[]> {
    const { data, error } = await this.client().from(cfg.table).select(cfg.selectCols);
    if (error || !data) return [];
    return data.map((row: any) => this.buildDueDateItem(row, cfg)).filter((x): x is DueItem => x !== null);
  }

  private buildAgingItem(row: any, cfg: AgingScanConfig): DueItem | null {
    if (!cfg.openStatuses.includes(row[cfg.statusCol])) return null;
    const startStr = row[cfg.startCol];
    if (!startStr) return null;

    const startDate = new Date(startStr);
    const today = new Date();
    const ageDays = Math.floor((today.getTime() - startDate.getTime()) / MS_PER_DAY);
    if (ageDays < cfg.thresholdDays) return null;

    const label = cfg.label(row);

    return {
      department: cfg.department,
      type: 'overdue',
      title: `${label} has been pending for ${ageDays} days`,
      message: `${label} is still open after ${ageDays} days (flagged at ${cfg.thresholdDays}+ days) — please review.`,
      link: cfg.link,
      sourceTable: cfg.table,
      sourceId: row.id,
      branchId: row.branch_id || null,
    };
  }

  private async scanAging(cfg: AgingScanConfig): Promise<DueItem[]> {
    const { data, error } = await this.client().from(cfg.table).select(cfg.selectCols);
    if (error || !data) return [];
    return data.map((row: any) => this.buildAgingItem(row, cfg)).filter((x): x is DueItem => x !== null);
  }

  // ── Department scan configuration ───────────────────────────

  private async scanAll(): Promise<DueItem[]> {
    const results = await Promise.all([
      // Finance
      this.scanDueDate({
        table: 'finance_compliance_renewals', department: 'Finance', link: '/finance-entry',
        selectCols: 'id, item_name, due_date, status, notification_lead_time_days, branch_id, created_by',
        dueCol: 'due_date', statusCol: 'status', openStatuses: ['Pending', 'Overdue'],
        leadCol: 'notification_lead_time_days', defaultLeadDays: 15,
        label: (r) => `Compliance renewal "${r.item_name}"`,
      }),
      this.scanDueDate({
        table: 'finance_recurring_payables', department: 'Finance', link: '/finance-entry',
        selectCols: 'id, description, due_date, status, branch_id, created_by',
        dueCol: 'due_date', statusCol: 'status', openStatuses: ['Pending', 'Overdue'],
        defaultLeadDays: 5,
        label: (r) => `Payable "${r.description}"`,
      }),
      this.scanDueDate({
        table: 'finance_exchange_reporting', department: 'Finance', link: '/finance-entry',
        selectCols: 'id, submission_type, exchange, due_date, status, branch_id, created_by',
        dueCol: 'due_date', statusCol: 'status', openStatuses: ['Pending', 'Not Submitted'],
        defaultLeadDays: 3,
        label: (r) => `${r.submission_type} (${r.exchange}) filing`,
      }),
      this.scanAging({
        table: 'finance_client_requests', department: 'Finance', link: '/finance-entry',
        selectCols: 'id, client_name, request_type, request_date, status, branch_id, created_by',
        startCol: 'request_date', statusCol: 'status', openStatuses: ['Pending', 'In Process'],
        thresholdDays: 5,
        label: (r) => `${r.request_type} for ${r.client_name}`,
      }),

      // IT
      this.scanDueDate({
        table: 'it_amc_contracts', department: 'IT', link: '/it-entry',
        selectCols: 'id, item_covered, amc_renewal_date, status, notification_lead_time_days, branch_id, created_by',
        dueCol: 'amc_renewal_date', statusCol: 'status', openStatuses: ['Active', 'Renewal Due', 'Lapsed'],
        leadCol: 'notification_lead_time_days', defaultLeadDays: 30,
        label: (r) => `AMC for "${r.item_covered}"`,
      }),
      this.scanDueDate({
        // HO-only, no branch_id column — resolveRecipients() falls back to
        // notifying every IT HOD org-wide for these (see its null-branchId path).
        table: 'it_audit_schedule', department: 'IT', link: '/it-entry',
        selectCols: 'id, audit_type, next_due_date, status, created_by',
        dueCol: 'next_due_date', statusCol: 'status', openStatuses: ['Upcoming', 'Overdue'],
        defaultLeadDays: 30,
        label: (r) => `${r.audit_type} filing`,
      }),
      this.scanDueDate({
        table: 'it_software', department: 'IT', link: '/it-entry',
        selectCols: 'id, software_name, amc_renewal_date, status, notification_lead_time_days, branch_id, created_by',
        dueCol: 'amc_renewal_date', statusCol: 'status', openStatuses: ['Active', 'Expiring Soon'],
        leadCol: 'notification_lead_time_days', defaultLeadDays: 30,
        label: (r) => `Software license "${r.software_name}"`,
      }),
      this.scanDueDate({
        table: 'it_audit_findings', department: 'IT', link: '/it-entry',
        selectCols: 'id, finding_id, finding_description, implementation_target_date, status, notification_lead_time_days, branch_id, created_by',
        dueCol: 'implementation_target_date', statusCol: 'status', openStatuses: ['Open', 'In Progress', 'Overdue'],
        leadCol: 'notification_lead_time_days', defaultLeadDays: 7,
        label: (r) => `Audit finding ${r.finding_id}`,
      }),
      this.scanDueDate({
        table: 'it_audits', department: 'IT', link: '/it-entry',
        selectCols: 'id, audit_name, submission_deadline, status, branch_id, created_by',
        dueCol: 'submission_deadline', statusCol: 'status', openStatuses: ['Scheduled', 'In Progress', 'Report Received', 'Overdue'],
        defaultLeadDays: 7,
        label: (r) => `Audit "${r.audit_name}" submission`,
      }),
      this.scanDueDate({
        table: 'it_cybersecurity_compliance', department: 'IT', link: '/it-entry',
        selectCols: 'id, control_item, next_review_date, status, branch_id, created_by',
        dueCol: 'next_review_date', statusCol: 'status', openStatuses: ['Due for Review', 'Non-Compliant', 'In Remediation'],
        defaultLeadDays: 14,
        label: (r) => `Cybersecurity control review "${String(r.control_item).slice(0, 60)}"`,
      }),
      this.scanDueDate({
        table: 'it_assets', department: 'IT', link: '/it-entry',
        selectCols: 'id, asset_id, make_model, warranty_end_date, status, branch_id, created_by',
        dueCol: 'warranty_end_date', statusCol: 'status', openStatuses: ['Active', 'Under Repair'],
        defaultLeadDays: 30,
        label: (r) => `Warranty for asset ${r.asset_id} (${r.make_model})`,
      }),

      // KYC
      this.scanDueDate({
        table: 'kyc_exchange_compliance', department: 'KYC', link: '/kyc-entry',
        selectCols: 'id, client_name, compliance_item, due_date, status, branch_id, created_by',
        dueCol: 'due_date', statusCol: 'status', openStatuses: ['Due', 'Non-Compliant'],
        defaultLeadDays: 10,
        label: (r) => `${r.compliance_item} for ${r.client_name}`,
      }),
      this.scanAging({
        table: 'kyc_modification_requests', department: 'KYC', link: '/kyc-entry',
        selectCols: 'id, client_name, modification_type, request_date, status, branch_id, created_by',
        startCol: 'request_date', statusCol: 'status', openStatuses: ['Pending'],
        thresholdDays: 5,
        label: (r) => `${r.modification_type} modification for ${r.client_name}`,
      }),

      // DP
      this.scanAging({
        table: 'dp_client_queries', department: 'DP', link: '/dp-entry',
        selectCols: 'id, query_type, created_at, status, branch_id, created_by',
        startCol: 'created_at', statusCol: 'status', openStatuses: ['Open', 'In Progress'],
        thresholdDays: 5,
        label: (r) => `Client query (${r.query_type})`,
      }),
      this.scanAging({
        table: 'dp_audit_compliance', department: 'DP', link: '/dp-entry',
        selectCols: 'id, finding_description, created_at, status, branch_id, created_by',
        startCol: 'created_at', statusCol: 'status', openStatuses: ['Open', 'Action Pending'],
        thresholdDays: 7,
        label: (r) => `Audit finding "${String(r.finding_description).slice(0, 60)}"`,
      }),
      this.scanAging({
        table: 'dp_modification', department: 'DP', link: '/dp-entry',
        selectCols: 'id, modification_type, request_date, status, branch_id, created_by',
        startCol: 'request_date', statusCol: 'status', openStatuses: ['Pending'],
        thresholdDays: 5,
        label: (r) => `${r.modification_type} modification request`,
      }),

      // Settlements — reuses the exact 2-day threshold already used on the dashboard's overdueCount KPI
      this.scanAging({
        table: 'settlement_client_requests', department: 'Settlements', link: '/settlements-entry',
        selectCols: 'id, client_name, request_type, date_received, status, branch_id, created_by',
        startCol: 'date_received', statusCol: 'status', openStatuses: ['Received', 'In Process', 'Pending'],
        thresholdDays: 2,
        label: (r) => `${r.request_type} request for ${r.client_name}`,
      }),

      // IEPF
      this.scanDueDate({
        table: 'iepf_claims', department: 'IEPF', link: '/iepf-entry',
        selectCols: 'id, claim_number, investor_name, expected_closure_date, status, branch_id, created_by',
        dueCol: 'expected_closure_date', statusCol: 'status', openStatuses: ['New', 'Under Verification', 'Documents Pending'],
        defaultLeadDays: 5,
        label: (r) => `IEPF claim ${r.claim_number} (${r.investor_name})`,
      }),
      this.scanAging({
        table: 'iepf_claims', department: 'IEPF', link: '/iepf-entry',
        selectCols: 'id, claim_number, investor_name, claim_date, status, branch_id, created_by',
        startCol: 'claim_date', statusCol: 'status', openStatuses: ['Documents Pending'],
        thresholdDays: 10,
        label: (r) => `IEPF claim ${r.claim_number} (${r.investor_name}) — documents pending`,
      }),
    ]);

    return results.flat();
  }

  /**
   * Due-date scan for the Tasks module — separate from scanAll() above
   * because its recipient is always the task's own assignee, not "the HOD
   * of a department" (resolveRecipients doesn't apply here).
   */
  private async scanTaskDueItems(): Promise<{ recipient: Recipient; row: any }[]> {
    const { data, error } = await this.client()
      .from('tasks')
      .select('id, title, due_date, status, assigned_to, assignee:profiles!tasks_assigned_to_fkey(email, full_name)')
      .not('assigned_to', 'is', null)
      .not('due_date', 'is', null)
      .in('status', ['Not Started', 'In Progress', 'Blocked']);
    if (error || !data) return [];

    const leadDays = 3;
    const today = new Date();
    const results: { recipient: Recipient; row: any }[] = [];

    for (const task of data as any[]) {
      if (!task.assignee?.email) continue;
      const dueDate = new Date(task.due_date);
      const alertFrom = new Date(dueDate.getTime() - leadDays * MS_PER_DAY);
      if (today < alertFrom) continue;

      const isOverdue = today > dueDate;
      const daysDiff = Math.max(1, Math.round(Math.abs(dueDate.getTime() - today.getTime()) / MS_PER_DAY));
      const dueDateFmt = dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

      results.push({
        recipient: { id: task.assigned_to, email: task.assignee.email, full_name: task.assignee.full_name },
        row: {
          user_id: task.assigned_to,
          department: 'Tasks',
          type: isOverdue ? 'overdue' : 'due_soon',
          title: `Task "${task.title}" ${isOverdue ? 'is overdue' : 'is due soon'}`,
          message: isOverdue
            ? `"${task.title}" was due on ${dueDateFmt} — ${daysDiff} day${daysDiff === 1 ? '' : 's'} overdue.`
            : `"${task.title}" is due on ${dueDateFmt} — ${daysDiff} day${daysDiff === 1 ? '' : 's'} remaining.`,
          link: '/tasks',
          source_table: 'tasks',
          source_id: task.id,
          dedupe_key: `tasks:${task.id}:${isOverdue ? 'overdue' : 'due_soon'}`,
        },
      });
    }
    return results;
  }

  // ── Main entry point ─────────────────────────────────────────

  /**
   * Scans every department for due/overdue items, writes new in-app
   * notifications (deduped so re-running never creates repeats for an
   * already-notified item), and sends one digest email per affected user
   * covering everything new in this run.
   */
  async runDueItemCheck(): Promise<{ itemsFound: number; notificationsCreated: number; usersEmailed: number }> {
    const client = this.client();
    const items = await this.scanAll();
    const taskItems = await this.scanTaskDueItems();

    const rows: any[] = [];
    // recipientId -> { email, name, items[] }, built alongside `rows` so we
    // only email users for notifications actually inserted this run.
    const recipientMeta = new Map<string, Recipient>();
    const rowRecipients: string[] = [];

    for (const item of items) {
      const recipients = await this.resolveRecipients(item.branchId, item.department);
      const dedupeKey = `${item.sourceTable}:${item.sourceId}:${item.type}`;

      for (const recipient of recipients) {
        recipientMeta.set(recipient.id, recipient);
        rows.push({
          user_id: recipient.id,
          department: item.department,
          type: item.type,
          title: item.title,
          message: item.message,
          link: item.link,
          source_table: item.sourceTable,
          source_id: item.sourceId,
          dedupe_key: dedupeKey,
        });
        rowRecipients.push(recipient.id);
      }
    }

    for (const t of taskItems) {
      recipientMeta.set(t.recipient.id, t.recipient);
      rows.push(t.row);
      rowRecipients.push(t.recipient.id);
    }

    if (rows.length === 0) {
      return { itemsFound: items.length + taskItems.length, notificationsCreated: 0, usersEmailed: 0 };
    }

    const { data: inserted, error } = await client
      .from('notifications')
      .upsert(rows, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })
      .select();

    if (error) throw new Error(error.message);

    const newRows = inserted || [];
    const byUser = new Map<string, any[]>();
    for (const row of newRows) {
      if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
      byUser.get(row.user_id)!.push(row);
    }

    let usersEmailed = 0;
    for (const [userId, userRows] of byUser) {
      const recipient = recipientMeta.get(userId);
      if (!recipient?.email) continue;
      try {
        await this.emailService.sendNotificationDigestEmail(
          recipient.email,
          recipient.full_name || 'there',
          userRows.map((r) => ({ department: r.department, type: r.type, title: r.title, message: r.message }))
        );
        usersEmailed++;
      } catch (err) {
        console.error(`[NotificationService] Failed to email ${recipient.email}:`, err);
      }
    }

    return { itemsFound: items.length + taskItems.length, notificationsCreated: newRows.length, usersEmailed };
  }
}
