import { supabaseAdmin } from '../config/supabase.js';
import type { NotificationService } from './NotificationService.js';
import {
  type Task,
  type TaskRemark,
  type TaskPriority,
  type TaskStatus,
  type AssignableUser,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '../models/task.model.js';

const TITLE_MAX = 255;
const DESCRIPTION_MAX = 5000;
const REMARK_MAX = 2000;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Roles that see every task in the "Team" view, org-wide — the same tier
// that already has cross-department dashboard visibility elsewhere in the app.
const ORG_WIDE_MANAGEMENT_ROLES = ['ceo', 'managing_director', 'director', 'executive'];
// Roles that see a "Team" view scoped to their own branch + department only
// (mirrors NotificationService.resolveRecipients' HOD/regional_manager scoping).
const SCOPED_MANAGEMENT_ROLES = ['hod', 'regional_manager'];

const TASK_SELECT = `
  *,
  assignee:profiles!tasks_assigned_to_fkey(full_name, email),
  creator:profiles!tasks_assigned_by_fkey(full_name, email),
  department:departments(name)
`;

interface RequesterProfile {
  id: string;
  role: string;
  department_id: string | null;
  branch_id: string | null;
}

/**
 * Cross-department task assignment and tracking. Unlike KYC/IT/Finance/etc,
 * this is intentionally NOT scoped to one department — anyone can create a
 * task and assign it to any other existing, active user.
 */
export class TaskService {
  constructor(private notificationService: NotificationService) {}

  private client() {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client is not configured.');
    }
    return supabaseAdmin;
  }

  private stripControlChars(str: string): string {
    const controlCharPattern = new RegExp('[' + String.fromCharCode(0) + '-' + String.fromCharCode(31) + String.fromCharCode(127) + ']', 'g');
    return str.replace(controlCharPattern, '');
  }

  private mapTask(row: any): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      assigned_to: row.assigned_to,
      assigned_by: row.assigned_by,
      department_id: row.department_id,
      priority: row.priority,
      status: row.status,
      due_date: row.due_date,
      completed_at: row.completed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      assignee_name: row.assignee?.full_name ?? null,
      assignee_email: row.assignee?.email ?? null,
      creator_name: row.creator?.full_name ?? null,
      creator_email: row.creator?.email ?? null,
      department_name: row.department?.name ?? null,
    };
  }

  private async getRequesterProfile(userId: string): Promise<RequesterProfile> {
    const { data, error } = await this.client()
      .from('profiles')
      .select('id, role, department_id, branch_id')
      .eq('id', userId)
      .single();
    if (error || !data) {
      throw new Error('Unauthorized: requesting user profile not found.');
    }
    return data;
  }

  private async getRawTask(id: string): Promise<any> {
    const { data, error } = await this.client().from('tasks').select('*').eq('id', id).single();
    if (error || !data) {
      throw new Error('Task not found.');
    }
    return data;
  }

  /**
   * Every read/write path on an existing task funnels through here so
   * authorization is always computed from the row actually fetched from
   * the DB, never from client-supplied claims — the same IDOR-safe pattern
   * IEPFService uses for its branch/creator locks.
   */
  private async computeAccess(task: any, requester: RequesterProfile) {
    const isAssignee = task.assigned_to === requester.id;
    const isCreator = task.assigned_by === requester.id;
    const isAdmin = requester.role === 'admin';
    const isOrgWideMgmt = ORG_WIDE_MANAGEMENT_ROLES.includes(requester.role);

    let isScopedManager = false;
    if (!isAssignee && !isCreator && !isAdmin && !isOrgWideMgmt && SCOPED_MANAGEMENT_ROLES.includes(requester.role) && task.assigned_to) {
      const { data: assignee } = await this.client()
        .from('profiles')
        .select('department_id, branch_id')
        .eq('id', task.assigned_to)
        .maybeSingle();
      if (assignee && assignee.department_id === requester.department_id && assignee.branch_id === requester.branch_id) {
        isScopedManager = true;
      }
    }

    const canView = isAssignee || isCreator || isAdmin || isOrgWideMgmt || isScopedManager;
    // Only the creator or a true admin may change task definition fields or
    // delete it — scoped/org-wide management roles get read-only oversight,
    // not edit rights over tasks they didn't create.
    const canEditDetails = isCreator || isAdmin;
    // Whether this requester can touch status *at all* — the specific value
    // they're allowed to set is enforced separately by
    // isStatusTransitionAllowed(), since assignee vs. creator have very
    // different (non-overlapping, except when self-assigned) permitted
    // transitions.
    const canChangeStatus = isAssignee || isCreator || isAdmin;
    const canDelete = isCreator || isAdmin;

    return { isAssignee, isCreator, isAdmin, isOrgWideMgmt, isScopedManager, canView, canEditDetails, canChangeStatus, canDelete };
  }

  /**
   * The assignee owns honest progress reporting (Not Started/In
   * Progress/Blocked/Completed) — nobody else gets to declare their work
   * done or in progress on their behalf. The creator's only lifecycle power
   * is cancelling a task that's no longer needed, or reopening one they
   * cancelled (back to Not Started) — they never get to skip straight to
   * "Completed" for work they didn't do. Admin overrides both.
   */
  private isStatusTransitionAllowed(
    access: { isAssignee: boolean; isCreator: boolean; isAdmin: boolean },
    currentStatus: TaskStatus,
    newStatus: TaskStatus
  ): boolean {
    if (access.isAdmin) return true;

    const PROGRESS_STATUSES: TaskStatus[] = ['Not Started', 'In Progress', 'Blocked', 'Completed'];
    // A cancelled task must be explicitly reopened by the creator/admin
    // first — the assignee can't skip that by "reporting progress" on a
    // task that's currently cancelled.
    if (access.isAssignee && currentStatus !== 'Cancelled' && PROGRESS_STATUSES.includes(newStatus)) return true;

    if (access.isCreator) {
      if (newStatus === 'Cancelled' && currentStatus !== 'Cancelled') return true;
      if (currentStatus === 'Cancelled' && newStatus === 'Not Started') return true;
    }

    return false;
  }

  private async validateAssignee(userId: string): Promise<{ id: string; full_name: string | null; email: string }> {
    const { data, error } = await this.client()
      .from('profiles')
      .select('id, full_name, email, status')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) {
      throw new Error('Assignee not found.');
    }
    if (data.status !== 'active') {
      throw new Error('Cannot assign a task to a blocked or resigned user.');
    }
    return data;
  }

  private async addSystemRemark(taskId: string, text: string): Promise<void> {
    await this.client().from('task_remarks').insert({
      task_id: taskId,
      author_id: null,
      remark_text: text,
      is_system: true,
    });
  }

  /**
   * Fires an in-app notification for a task event. Failures are logged only
   * — a notification going missing must never fail the underlying task
   * operation that triggered it.
   */
  private async notify(recipientId: string | null, actorId: string, title: string, message: string, taskId: string): Promise<void> {
    if (!recipientId || recipientId === actorId) return; // no self-notifications, no notifying a deleted/unset user
    try {
      await this.notificationService.createTaskEventNotification(recipientId, title, message, taskId);
    } catch (err) {
      console.error('[TaskService] Failed to create notification:', err);
    }
  }

  // ── Assignable users (available to every authenticated caller — task
  // assignment isn't restricted to admin/HR, unlike /users) ──────────────
  async getAssignableUsers(): Promise<AssignableUser[]> {
    const { data, error } = await this.client()
      .from('profiles')
      .select('id, full_name, email, role, departments(name)')
      .eq('status', 'active')
      .order('full_name', { ascending: true });
    if (error) throw new Error(`Failed to load users: ${error.message}`);
    return (data || []).map((u: any) => ({
      id: u.id,
      full_name: u.full_name,
      email: u.email,
      role: u.role,
      department_name: u.departments?.name ?? null,
    }));
  }

  // ── Create ───────────────────────────────────────────────────────────
  async createTask(input: {
    title?: string;
    description?: string;
    assigned_to?: string;
    priority?: string;
    due_date?: string;
    department_id?: string;
  }, creatorId: string): Promise<Task> {
    const title = input.title?.trim();
    const description = input.description?.trim();

    if (!title) throw new Error('Title is required.');
    if (title.length > TITLE_MAX) throw new Error(`Title cannot exceed ${TITLE_MAX} characters.`);
    if (!description) throw new Error('Description is required.');
    if (description.length > DESCRIPTION_MAX) throw new Error(`Description cannot exceed ${DESCRIPTION_MAX} characters.`);
    if (!input.assigned_to) throw new Error('Please assign this task to someone.');

    const assignee = await this.validateAssignee(input.assigned_to);

    let priority: TaskPriority = 'Medium';
    if (input.priority !== undefined) {
      if (!TASK_PRIORITIES.includes(input.priority as TaskPriority)) throw new Error('Invalid priority.');
      priority = input.priority as TaskPriority;
    }

    if (input.due_date !== undefined && input.due_date !== '') {
      if (!DATE_REGEX.test(input.due_date) || isNaN(new Date(input.due_date).getTime())) {
        throw new Error('Invalid due date format (expected YYYY-MM-DD).');
      }
    }

    if (input.department_id) {
      const { data: dept } = await this.client().from('departments').select('id').eq('id', input.department_id).maybeSingle();
      if (!dept) throw new Error('Invalid department.');
    }

    const { data, error } = await this.client()
      .from('tasks')
      .insert({
        title: this.stripControlChars(title),
        description: this.stripControlChars(description),
        assigned_to: input.assigned_to,
        assigned_by: creatorId,
        department_id: input.department_id || null,
        priority,
        status: 'Not Started',
        due_date: input.due_date || null,
      })
      .select(TASK_SELECT)
      .single();

    if (error) throw new Error(`Failed to create task: ${error.message}`);

    await this.addSystemRemark(data.id, `Task created and assigned to ${assignee.full_name || assignee.email}.`);
    await this.notify(
      input.assigned_to,
      creatorId,
      'New task assigned to you',
      `"${title}" was assigned to you.`,
      data.id
    );

    return this.mapTask(data);
  }

  // ── List ─────────────────────────────────────────────────────────────
  async getTasks(requesterId: string, view: 'mine' | 'assigned_by_me' | 'team', statusFilter?: string): Promise<Task[]> {
    const requester = await this.getRequesterProfile(requesterId);

    let query = this.client().from('tasks').select(TASK_SELECT);

    if (view === 'mine') {
      query = query.eq('assigned_to', requesterId);
    } else if (view === 'assigned_by_me') {
      query = query.eq('assigned_by', requesterId);
    } else if (view === 'team') {
      const isAdmin = requester.role === 'admin';
      const isOrgWideMgmt = ORG_WIDE_MANAGEMENT_ROLES.includes(requester.role);
      const isScopedManager = SCOPED_MANAGEMENT_ROLES.includes(requester.role);

      if (!isAdmin && !isOrgWideMgmt && !isScopedManager) {
        throw new Error('Unauthorized: the Team view is only available to management roles.');
      }

      if (isScopedManager) {
        if (!requester.department_id || !requester.branch_id) {
          // No branch/department assigned — nothing to scope the team view to.
          return [];
        }
        query = this.client()
          .from('tasks')
          .select(`
            *,
            assignee:profiles!tasks_assigned_to_fkey!inner(full_name, email, department_id, branch_id),
            creator:profiles!tasks_assigned_by_fkey(full_name, email),
            department:departments(name)
          `)
          .eq('assignee.department_id', requester.department_id)
          .eq('assignee.branch_id', requester.branch_id);
      }
      // isAdmin / isOrgWideMgmt: no filter — see every task.
    } else {
      throw new Error('Invalid view.');
    }

    if (statusFilter && TASK_STATUSES.includes(statusFilter as TaskStatus)) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to load tasks: ${error.message}`);
    return (data || []).map((row) => this.mapTask(row));
  }

  // ── Detail + remarks ─────────────────────────────────────────────────
  async getTaskWithRemarks(id: string, requesterId: string): Promise<{ task: Task; remarks: TaskRemark[] }> {
    const requester = await this.getRequesterProfile(requesterId);
    const raw = await this.getRawTask(id);
    const access = await this.computeAccess(raw, requester);
    if (!access.canView) throw new Error('Unauthorized: you do not have access to this task.');

    const { data: joined, error: joinedErr } = await this.client().from('tasks').select(TASK_SELECT).eq('id', id).single();
    if (joinedErr || !joined) throw new Error('Task not found.');

    const { data: remarkRows, error: remarksErr } = await this.client()
      .from('task_remarks')
      .select('*, author:profiles!task_remarks_author_id_fkey(full_name)')
      .eq('task_id', id)
      .order('created_at', { ascending: true });
    if (remarksErr) throw new Error(`Failed to load task history: ${remarksErr.message}`);

    const remarks: TaskRemark[] = (remarkRows || []).map((r: any) => ({
      id: r.id,
      task_id: r.task_id,
      author_id: r.author_id,
      remark_text: r.remark_text,
      is_system: r.is_system,
      created_at: r.created_at,
      author_name: r.is_system ? 'System' : (r.author?.full_name ?? 'Deleted user'),
    }));

    return { task: this.mapTask(joined), remarks };
  }

  // ── Update ───────────────────────────────────────────────────────────
  async updateTask(id: string, input: {
    title?: string;
    description?: string;
    priority?: string;
    due_date?: string | null;
    department_id?: string | null;
    assigned_to?: string;
    status?: string;
  }, updaterId: string): Promise<Task> {
    const requester = await this.getRequesterProfile(updaterId);
    const raw = await this.getRawTask(id);
    const access = await this.computeAccess(raw, requester);

    if (!access.canView) throw new Error('Unauthorized: you do not have access to this task.');

    const patch: any = {};
    const detailFieldsRequested = ['title', 'description', 'priority', 'due_date', 'department_id', 'assigned_to'].some(
      (f) => (input as any)[f] !== undefined
    );
    if (detailFieldsRequested && !access.canEditDetails) {
      throw new Error('Only the task creator or an administrator can edit these details.');
    }
    // A cancelled task's definition is frozen for everyone but admin — the
    // creator can still reopen it (a status transition, handled below), but
    // must reopen it before editing its title/description/etc.
    if (detailFieldsRequested && raw.status === 'Cancelled' && !access.isAdmin) {
      throw new Error('This task has been cancelled — reopen it before editing its details.');
    }

    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title) throw new Error('Title cannot be empty.');
      if (title.length > TITLE_MAX) throw new Error(`Title cannot exceed ${TITLE_MAX} characters.`);
      patch.title = this.stripControlChars(title);
    }
    if (input.description !== undefined) {
      const description = input.description.trim();
      if (!description) throw new Error('Description cannot be empty.');
      if (description.length > DESCRIPTION_MAX) throw new Error(`Description cannot exceed ${DESCRIPTION_MAX} characters.`);
      patch.description = this.stripControlChars(description);
    }
    if (input.priority !== undefined) {
      if (!TASK_PRIORITIES.includes(input.priority as TaskPriority)) throw new Error('Invalid priority.');
      patch.priority = input.priority;
    }
    if (input.due_date !== undefined) {
      if (input.due_date === null || input.due_date === '') {
        patch.due_date = null;
      } else {
        if (!DATE_REGEX.test(input.due_date) || isNaN(new Date(input.due_date).getTime())) {
          throw new Error('Invalid due date format (expected YYYY-MM-DD).');
        }
        patch.due_date = input.due_date;
      }
    }
    if (input.department_id !== undefined) {
      if (input.department_id === null || input.department_id === '') {
        patch.department_id = null;
      } else {
        const { data: dept } = await this.client().from('departments').select('id').eq('id', input.department_id).maybeSingle();
        if (!dept) throw new Error('Invalid department.');
        patch.department_id = input.department_id;
      }
    }

    let reassignNotifyUserId: string | null = null;
    let reassignNote: string | null = null;
    if (input.assigned_to !== undefined && input.assigned_to !== raw.assigned_to) {
      const newAssignee = await this.validateAssignee(input.assigned_to);
      patch.assigned_to = input.assigned_to;
      reassignNotifyUserId = input.assigned_to;
      reassignNote = `Reassigned to ${newAssignee.full_name || newAssignee.email} by ${requester.role === 'admin' ? 'an administrator' : 'the task owner'}.`;
    }

    let statusNote: string | null = null;
    let statusNotifyUserId: string | null = null;
    if (input.status !== undefined && input.status !== raw.status) {
      if (!TASK_STATUSES.includes(input.status as TaskStatus)) throw new Error('Invalid status.');
      if (!this.isStatusTransitionAllowed(access, raw.status, input.status as TaskStatus)) {
        throw new Error(
          access.isCreator && !access.isAssignee
            ? 'As the task creator, you can only cancel or reopen this task — progress status is reported by the assignee.'
            : 'You are not authorized to make this status change.'
        );
      }
      patch.status = input.status;
      patch.completed_at = input.status === 'Completed' ? new Date().toISOString() : null;
      statusNote = `Status changed from "${raw.status}" to "${input.status}".`;
      // Notify whichever of assignee/creator did NOT make this change.
      statusNotifyUserId = access.isAssignee ? raw.assigned_by : raw.assigned_to;
    }

    if (Object.keys(patch).length === 0) {
      // Nothing to change — return current state rather than erroring on a no-op.
      return this.mapTask({ ...raw, ...(await this.client().from('tasks').select(TASK_SELECT).eq('id', id).single()).data });
    }

    patch.updated_at = new Date().toISOString();

    const { data, error } = await this.client().from('tasks').update(patch).eq('id', id).select(TASK_SELECT).single();
    if (error) throw new Error(`Failed to update task: ${error.message}`);

    if (reassignNote) {
      await this.addSystemRemark(id, reassignNote);
      await this.notify(reassignNotifyUserId, updaterId, 'Task reassigned to you', `"${raw.title}" was reassigned to you.`, id);
    }
    if (statusNote) {
      await this.addSystemRemark(id, statusNote);
      await this.notify(statusNotifyUserId, updaterId, 'Task status updated', `"${raw.title}" is now "${input.status}".`, id);
    }

    return this.mapTask(data);
  }

  // ── Remarks ──────────────────────────────────────────────────────────
  async addRemark(taskId: string, remarkText: string | undefined, authorId: string): Promise<TaskRemark> {
    const requester = await this.getRequesterProfile(authorId);
    const raw = await this.getRawTask(taskId);
    const access = await this.computeAccess(raw, requester);
    if (!access.canView) throw new Error('Unauthorized: you do not have access to this task.');

    const text = remarkText?.trim();
    if (!text) throw new Error('Remark cannot be empty.');
    if (text.length > REMARK_MAX) throw new Error(`Remark cannot exceed ${REMARK_MAX} characters.`);

    const { data, error } = await this.client()
      .from('task_remarks')
      .insert({ task_id: taskId, author_id: authorId, remark_text: this.stripControlChars(text), is_system: false })
      .select('*, author:profiles!task_remarks_author_id_fkey(full_name)')
      .single();
    if (error) throw new Error(`Failed to add remark: ${error.message}`);

    // Notify both the other party (assignee<->creator), whichever isn't the author.
    const others = [raw.assigned_to, raw.assigned_by].filter((uid) => uid && uid !== authorId);
    for (const uid of new Set(others)) {
      await this.notify(uid, authorId, 'New remark on a task', `${requester.role === 'admin' ? 'An admin' : (data.author?.full_name || 'Someone')} commented on "${raw.title}".`, taskId);
    }

    return {
      id: data.id,
      task_id: data.task_id,
      author_id: data.author_id,
      remark_text: data.remark_text,
      is_system: data.is_system,
      created_at: data.created_at,
      author_name: data.author?.full_name ?? 'Deleted user',
    };
  }

  // ── Delete ───────────────────────────────────────────────────────────
  async deleteTask(id: string, requesterId: string): Promise<void> {
    const requester = await this.getRequesterProfile(requesterId);
    const raw = await this.getRawTask(id);
    const access = await this.computeAccess(raw, requester);
    if (!access.canDelete) throw new Error('Unauthorized: only the task creator or an administrator can delete this task.');

    const { error } = await this.client().from('tasks').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete task: ${error.message}`);
  }
}
