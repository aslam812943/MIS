import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import axios from 'axios';
import DashboardLayout from '../../components/layout/DashboardLayout';
import ConfirmModal from '../../components/common/ConfirmModal';
import { INITIAL_CONFIRM_STATE, type ConfirmDialogState } from '../../types/confirm.types';
import { authService } from '../../services/auth.service';
import {
  taskService,
  type Task,
  type TaskRemark,
  type AssignableUser,
  type TaskView,
  type TaskPriority,
  type TaskStatus,
} from '../../services/task.service';

const PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High', 'Urgent'];
const STATUSES: TaskStatus[] = ['Not Started', 'In Progress', 'Blocked', 'Completed', 'Cancelled'];

// Mirrors TaskService's ORG_WIDE_MANAGEMENT_ROLES/SCOPED_MANAGEMENT_ROLES —
// only used here to decide whether to show the "Team" tab at all; the
// server is the actual source of truth and re-checks this on every request.
const TEAM_VIEW_ROLES = ['admin', 'ceo', 'managing_director', 'director', 'executive', 'hod', 'regional_manager'];

const priorityBadgeClass = (p: string) => {
  if (p === 'Urgent') return 'mis-badge mis-badge-danger';
  if (p === 'High') return 'mis-badge mis-badge-warning';
  if (p === 'Low') return 'mis-badge mis-badge-neutral';
  return 'mis-badge mis-badge-info';
};

const statusBadgeClass = (s: string) => {
  if (s === 'Completed') return 'mis-badge mis-badge-success';
  if (s === 'Blocked') return 'mis-badge mis-badge-warning';
  if (s === 'Cancelled') return 'mis-badge mis-badge-danger';
  if (s === 'In Progress') return 'mis-badge mis-badge-info';
  return 'mis-badge mis-badge-neutral';
};

const isOverdue = (task: Task) =>
  !!task.due_date && !['Completed', 'Cancelled'].includes(task.status) && new Date(task.due_date) < new Date(new Date().toDateString());

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const errMsg = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error) && error.response?.data?.message) return error.response.data.message;
  if (error instanceof Error) return error.message;
  return fallback;
};

const INITIAL_CREATE_FORM = {
  title: '',
  description: '',
  assigned_to: '',
  priority: 'Medium' as TaskPriority,
  due_date: '',
};

/**
 * Cross-department Task Management — visible to every role. Create/assign
 * tasks to any active user, track status, and keep a running remarks
 * history per task. Server-side authorization (TaskService.ts) is the real
 * gate; the role checks here only decide what's worth showing.
 */
const TaskManagementPage: React.FC = () => {
  const user = authService.getCurrentUser();
  const showTeamTab = !!user?.role && TEAM_VIEW_ROLES.includes(user.role);

  const [tab, setTab] = useState<TaskView>('mine');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(INITIAL_CREATE_FORM);
  const [creating, setCreating] = useState(false);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ task: Task; remarks: TaskRemark[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newRemark, setNewRemark] = useState('');
  const [submittingRemark, setSubmittingRemark] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<{ title: string; description: string; priority: TaskPriority; due_date: string; assigned_to: string }>({
    title: '', description: '', priority: 'Medium', due_date: '', assigned_to: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const [confirmModal, setConfirmModal] = useState<ConfirmDialogState>(INITIAL_CONFIRM_STATE);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await taskService.getTasks(tab, statusFilter || undefined);
      setTasks(data);
    } catch (error) {
      toast.error(errMsg(error, 'Failed to load tasks.'));
    } finally {
      setLoading(false);
    }
  }, [tab, statusFilter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  useEffect(() => {
    taskService.getAssignableUsers().then(setAssignableUsers).catch(() => {});
  }, []);

  const openCreateModal = () => {
    setCreateForm(INITIAL_CREATE_FORM);
    setIsCreateOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim() || !createForm.description.trim() || !createForm.assigned_to) {
      toast.error('Title, description, and assignee are all required.');
      return;
    }
    setCreating(true);
    const toastId = toast.loading('Creating task...');
    try {
      await taskService.createTask({
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        assigned_to: createForm.assigned_to,
        priority: createForm.priority,
        due_date: createForm.due_date || undefined,
      });
      toast.success('Task created.', { id: toastId });
      setIsCreateOpen(false);
      if (tab === 'assigned_by_me') fetchTasks();
    } catch (error) {
      toast.error(errMsg(error, 'Failed to create task.'), { id: toastId });
    } finally {
      setCreating(false);
    }
  };

  const openDetail = async (taskId: string) => {
    setSelectedTaskId(taskId);
    setDetail(null);
    setEditMode(false);
    setDetailLoading(true);
    // Guard against stale state from a previous task's session — if that
    // one's save/remark request was still in flight when the modal was
    // closed, its "saving"/"submitting" flag would otherwise carry over
    // and lock this task's controls even though nothing is actually saving.
    setSavingEdit(false);
    setSubmittingRemark(false);
    setNewRemark('');
    try {
      const data = await taskService.getTaskDetail(taskId);
      setDetail(data);
      setEditForm({
        title: data.task.title,
        description: data.task.description,
        priority: data.task.priority,
        due_date: data.task.due_date || '',
        assigned_to: data.task.assigned_to || '',
      });
    } catch (error) {
      toast.error(errMsg(error, 'Failed to load task.'));
      setSelectedTaskId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedTaskId(null);
    setDetail(null);
    setEditMode(false);
    setNewRemark('');
    setSavingEdit(false);
    setSubmittingRemark(false);
  };

  const refreshDetail = async (taskId: string) => {
    const data = await taskService.getTaskDetail(taskId);
    setDetail(data);
  };

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!detail) return;
    const toastId = toast.loading('Updating status...');
    try {
      await taskService.updateTask(detail.task.id, { status: newStatus });
      toast.success('Status updated.', { id: toastId });
      await refreshDetail(detail.task.id);
      fetchTasks();
    } catch (error) {
      toast.error(errMsg(error, 'Failed to update status.'), { id: toastId });
    }
  };

  const handleAddRemark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !newRemark.trim()) return;
    setSubmittingRemark(true);
    try {
      await taskService.addRemark(detail.task.id, newRemark.trim());
      setNewRemark('');
      await refreshDetail(detail.task.id);
    } catch (error) {
      toast.error(errMsg(error, 'Failed to add remark.'));
    } finally {
      setSubmittingRemark(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    if (!editForm.title.trim() || !editForm.description.trim()) {
      toast.error('Title and description cannot be empty.');
      return;
    }
    setSavingEdit(true);
    const toastId = toast.loading('Saving changes...');
    try {
      await taskService.updateTask(detail.task.id, {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        priority: editForm.priority,
        due_date: editForm.due_date || null,
        assigned_to: editForm.assigned_to,
      });
      toast.success('Task updated.', { id: toastId });
      setEditMode(false);
      await refreshDetail(detail.task.id);
      fetchTasks();
    } catch (error) {
      toast.error(errMsg(error, 'Failed to save changes.'), { id: toastId });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = () => {
    if (!detail) return;
    setConfirmModal({
      isOpen: true,
      title: 'Delete Task',
      message: `Permanently delete "${detail.task.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      isDanger: true,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        const toastId = toast.loading('Deleting task...');
        try {
          await taskService.deleteTask(detail.task.id);
          toast.success('Task deleted.', { id: toastId });
          closeDetail();
          fetchTasks();
        } catch (error) {
          toast.error(errMsg(error, 'Failed to delete task.'), { id: toastId });
        }
      },
    });
  };

  const isAssignee = !!user && detail?.task.assigned_to === user.id;
  const isCreator = !!user && detail?.task.assigned_by === user.id;
  const isAdmin = user?.role === 'admin';
  const canEditDetails = isCreator || isAdmin;
  const canDelete = isCreator || isAdmin;

  // Mirrors TaskService.isStatusTransitionAllowed(): the assignee owns
  // honest progress reporting and can't be overridden by the creator, who
  // can only cancel a task or reopen one they cancelled. Admin can set
  // anything directly, so gets one unrestricted dropdown instead.
  const isCancelled = detail?.task.status === 'Cancelled';
  const canReportProgress = isAssignee && !isCancelled;
  const canCancelTask = isCreator && !isCancelled;
  const canReopenTask = isCreator && isCancelled;

  const isFormDirty = detail ? (
    editForm.title !== detail.task.title ||
    editForm.description !== detail.task.description ||
    editForm.priority !== detail.task.priority ||
    editForm.due_date !== (detail.task.due_date || '') ||
    editForm.assigned_to !== (detail.task.assigned_to || '')
  ) : false;

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-6xl mx-auto">
        <header className="mis-page-header-row mb-6">
          <div className="mis-page-header" style={{ marginBottom: 0 }}>
            <h1 className="mis-page-title">Tasks</h1>
            <p className="mis-page-desc">Create, assign, and track work across every department.</p>
          </div>
          <button type="button" className="mis-btn mis-btn-primary" onClick={openCreateModal}>
            + Create Task
          </button>
        </header>

        <div className="mis-card overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b" style={{ borderColor: 'var(--border)' }}>
            {/* .mis-tabs has flex-wrap:wrap for other pages' sake, but a
                *wrapping* flex container's natural (fit-content) width is
                defined by spec as just its widest single child — not the
                sum of all children — regardless of how much space is
                actually free. That collapsed this to one tab per line with
                a large empty gap before the filter. Forcing nowrap here
                sidesteps that: with only 3 short labels, it fits on one
                line on any real device without needing to scroll. */}
            <div className="mis-tabs" style={{ flexWrap: 'nowrap' }}>
              <button type="button" className={`mis-tab ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>My Tasks</button>
              <button type="button" className={`mis-tab ${tab === 'assigned_by_me' ? 'active' : ''}`} onClick={() => setTab('assigned_by_me')}>Assigned by Me</button>
              {showTeamTab && (
                <button type="button" className={`mis-tab ${tab === 'team' ? 'active' : ''}`} onClick={() => setTab('team')}>Team</button>
              )}
            </div>
            {/* Full width + stacked below the tabs on mobile; compact and
                right-aligned next to the tabs from sm upward. */}
            <select className="mis-select text-xs w-full sm:w-40 shrink-0" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Desktop/tablet: table. Below sm, a table forces either tiny
              unreadable columns or sideways scrolling — a stacked card list
              reads far better on a phone, so it replaces the table entirely
              rather than just scrolling it. */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="mis-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>{tab === 'assigned_by_me' ? 'Assigned To' : 'Assigned By'}</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="mis-empty">Loading tasks...</td></tr>
                ) : tasks.length === 0 ? (
                  <tr><td colSpan={5} className="mis-empty">No tasks found.</td></tr>
                ) : (
                  tasks.map((t) => (
                    <tr key={t.id} className="cursor-pointer" onClick={() => openDetail(t.id)}>
                      <td className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t.title}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {tab === 'assigned_by_me' ? (t.assignee_name || 'Unassigned') : (t.creator_name || 'Unknown')}
                      </td>
                      <td><span className={priorityBadgeClass(t.priority)}>{t.priority}</span></td>
                      <td><span className={statusBadgeClass(t.status)}>{t.status}</span></td>
                      <td style={{ color: isOverdue(t) ? '#ef4444' : 'var(--text-secondary)' }}>
                        {formatDate(t.due_date)}{isOverdue(t) && ' (Overdue)'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: card list, same data and tap-to-open behaviour as the table. */}
          <div className="sm:hidden">
            {loading ? (
              <div className="mis-empty">Loading tasks...</div>
            ) : tasks.length === 0 ? (
              <div className="mis-empty">No tasks found.</div>
            ) : (
              tasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="w-full text-left p-4 flex flex-col gap-2"
                  style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', font: 'inherit', cursor: 'pointer' }}
                  onClick={() => openDetail(t.id)}
                >
                  <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t.title}</div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {tab === 'assigned_by_me' ? 'Assigned to ' : 'From '}
                    {tab === 'assigned_by_me' ? (t.assignee_name || 'Unassigned') : (t.creator_name || 'Unknown')}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={priorityBadgeClass(t.priority)}>{t.priority}</span>
                    <span className={statusBadgeClass(t.status)}>{t.status}</span>
                    <span className="text-xs ml-auto" style={{ color: isOverdue(t) ? '#ef4444' : 'var(--text-muted)' }}>
                      {formatDate(t.due_date)}{isOverdue(t) && ' (Overdue)'}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Create Task Modal */}
      {isCreateOpen && (
        <div className="mis-modal-backdrop" onClick={() => setIsCreateOpen(false)}>
          <div className="mis-modal max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mis-modal-header">
              <div>
                <h2 className="text-lg font-bold m-0 mb-1" style={{ color: 'var(--text-primary)' }}>Create Task</h2>
                <p className="text-xs m-0" style={{ color: 'var(--text-secondary)' }}>Describe the work and assign it to anyone in the organisation.</p>
              </div>
              <button type="button" className="mis-icon-btn" onClick={() => setIsCreateOpen(false)} aria-label="Close">✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="mis-modal-body space-y-4">
                <div className="mis-field">
                  <label className="mis-label">Title *</label>
                  <input className="mis-input" value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} placeholder="e.g. Reconcile July DP statements" />
                </div>
                <div className="mis-field">
                  <label className="mis-label">Description *</label>
                  <textarea className="mis-input" rows={4} value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} placeholder="Explain exactly what needs to be done." />
                </div>
                <div className="mis-field">
                  <label className="mis-label">Assign To *</label>
                  <select className="mis-select" value={createForm.assigned_to} onChange={(e) => setCreateForm({ ...createForm, assigned_to: e.target.value })}>
                    <option value="">— Select a user —</option>
                    {assignableUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email} ({u.role}{u.department_name ? `, ${u.department_name}` : ''})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="mis-field">
                    <label className="mis-label">Priority</label>
                    <select className="mis-select" value={createForm.priority} onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value as TaskPriority })}>
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="mis-field">
                    <label className="mis-label">Due Date</label>
                    <input type="date" className="mis-input" value={createForm.due_date} onChange={(e) => setCreateForm({ ...createForm, due_date: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="mis-modal-footer">
                <button type="button" className="mis-btn mis-btn-ghost flex-1 justify-center" onClick={() => setIsCreateOpen(false)}>Cancel</button>
                <button type="submit" disabled={creating} className="mis-btn mis-btn-primary flex-[2] justify-center">
                  {creating ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <div className="mis-modal-backdrop" onClick={closeDetail}>
          <div className="mis-modal max-w-2xl" onClick={(e) => e.stopPropagation()}>
            {detailLoading || !detail ? (
              <div className="mis-modal-body">
                <div className="mis-empty py-16">Loading task...</div>
              </div>
            ) : (
              <>
                <div className="mis-modal-header">
                  <div className="min-w-0">
                    {editMode ? (
                      <h2 className="text-lg font-bold m-0" style={{ color: 'var(--text-primary)' }}>Edit Task</h2>
                    ) : (
                      <>
                        <h2 className="text-lg font-bold m-0 mb-1.5 truncate" style={{ color: 'var(--text-primary)' }}>{detail.task.title}</h2>
                        <div className="flex flex-wrap gap-1.5">
                          <span className={priorityBadgeClass(detail.task.priority)}>{detail.task.priority}</span>
                          <span className={statusBadgeClass(detail.task.status)}>{detail.task.status}</span>
                        </div>
                      </>
                    )}
                  </div>
                  <button type="button" className="mis-icon-btn" onClick={closeDetail} aria-label="Close">✕</button>
                </div>

                <div className="mis-modal-body max-h-[65vh] space-y-5">
                  {editMode ? (
                    <form id="edit-task-form" onSubmit={handleSaveEdit} className="space-y-4">
                      <div className="mis-field">
                        <label className="mis-label">Title *</label>
                        <input className="mis-input" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                      </div>
                      <div className="mis-field">
                        <label className="mis-label">Description *</label>
                        <textarea className="mis-input" rows={4} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                      </div>
                      <div className="mis-field">
                        <label className="mis-label">Assigned To</label>
                        <select className="mis-select" value={editForm.assigned_to} onChange={(e) => setEditForm({ ...editForm, assigned_to: e.target.value })}>
                          {assignableUsers.map((u) => (
                            <option key={u.id} value={u.id}>{u.full_name || u.email} ({u.role}{u.department_name ? `, ${u.department_name}` : ''})</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="mis-field">
                          <label className="mis-label">Priority</label>
                          <select className="mis-select" value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as TaskPriority })}>
                            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                        <div className="mis-field">
                          <label className="mis-label">Due Date</label>
                          <input type="date" className="mis-input" value={editForm.due_date} onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })} />
                        </div>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="mis-label">Assigned To</span>
                          <div style={{ color: 'var(--text-primary)' }}>{detail.task.assignee_name || 'Unassigned'}</div>
                        </div>
                        <div>
                          <span className="mis-label">Created By</span>
                          <div style={{ color: 'var(--text-primary)' }}>{detail.task.creator_name || 'Unknown'}</div>
                        </div>
                        <div>
                          <span className="mis-label">Due Date</span>
                          <div style={{ color: isOverdue(detail.task) ? '#ef4444' : 'var(--text-primary)' }}>
                            {formatDate(detail.task.due_date)}{isOverdue(detail.task) && ' (Overdue)'}
                          </div>
                        </div>
                        <div>
                          <span className="mis-label">Created</span>
                          <div style={{ color: 'var(--text-primary)' }}>{formatDate(detail.task.created_at)}</div>
                        </div>
                      </div>

                      <div>
                        <span className="mis-label">Description</span>
                        <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{detail.task.description}</p>
                      </div>

                      {isAdmin && (
                        <div className="mis-field">
                          <label className="mis-label">Update Status (Admin override)</label>
                          <select className="mis-select" value={detail.task.status} onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}>
                            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      )}

                      {!isAdmin && canReportProgress && (
                        <div className="mis-field">
                          <label className="mis-label">Update Your Progress</label>
                          <select className="mis-select" value={detail.task.status} onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}>
                            {(['Not Started', 'In Progress', 'Blocked', 'Completed'] as TaskStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      )}

                      {!isAdmin && canCancelTask && (
                        <div>
                          <button type="button" className="mis-btn mis-btn-ghost mis-btn-sm" style={{ color: '#ef4444' }} onClick={() => handleStatusChange('Cancelled')}>
                            Cancel Task
                          </button>
                          <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                            As the creator, you can cancel this task, but progress (In Progress/Completed) is reported by the assignee.
                          </p>
                        </div>
                      )}

                      {!isAdmin && canReopenTask && (
                        <div>
                          <button type="button" className="mis-btn mis-btn-primary mis-btn-sm" onClick={() => handleStatusChange('Not Started')}>
                            Reopen Task
                          </button>
                          <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                            This task is cancelled. Reopening sets it back to "Not Started".
                          </p>
                        </div>
                      )}

                      <div>
                        <span className="mis-label">Activity & Remarks</span>
                        <div className="mt-2 space-y-2 max-h-56 overflow-y-auto border rounded-lg p-3" style={{ borderColor: 'var(--border)', background: 'var(--panel-inset-soft)' }}>
                          {detail.remarks.length === 0 ? (
                            <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>No activity yet.</p>
                          ) : (
                            detail.remarks.map((r) => (
                              <div key={r.id} className="text-xs">
                                {r.is_system ? (
                                  <span className="italic" style={{ color: 'var(--text-muted)' }}>{r.remark_text} — {formatDate(r.created_at)}</span>
                                ) : (
                                  <div>
                                    <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{r.author_name}</span>{' '}
                                    <span style={{ color: 'var(--text-muted)' }}>· {formatDate(r.created_at)}</span>
                                    <p className="m-0 mt-0.5" style={{ color: 'var(--text-secondary)' }}>{r.remark_text}</p>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                        <form onSubmit={handleAddRemark} className="flex gap-2 mt-2">
                          <input
                            className="mis-input flex-1 text-sm"
                            placeholder="Add a remark..."
                            value={newRemark}
                            onChange={(e) => setNewRemark(e.target.value)}
                          />
                          <button type="submit" disabled={submittingRemark || !newRemark.trim()} className="mis-btn mis-btn-primary mis-btn-sm">
                            {submittingRemark ? '...' : 'Post'}
                          </button>
                        </form>
                      </div>
                    </>
                  )}
                </div>

                <div className="mis-modal-footer flex-wrap">
                  {editMode ? (
                    <>
                      <button type="button" disabled={savingEdit} className="mis-btn mis-btn-ghost flex-1 justify-center" onClick={() => setEditMode(false)}>Cancel</button>
                      <button type="submit" form="edit-task-form" disabled={savingEdit || !isFormDirty} className="mis-btn mis-btn-primary flex-[2] justify-center">
                        {savingEdit ? 'Saving...' : 'Save Changes'}
                      </button>
                    </>
                  ) : (
                    <>
                      {canDelete && (
                        <button type="button" className="mis-btn mis-btn-ghost" style={{ color: '#ef4444' }} onClick={handleDelete}>Delete</button>
                      )}
                      {canEditDetails && (
                        <button type="button" className="mis-btn mis-btn-primary flex-1 justify-center" onClick={() => { toast.dismiss(); setEditMode(true); }}>Edit Details</button>
                      )}
                      <button type="button" className="mis-btn mis-btn-ghost flex-1 justify-center" onClick={closeDetail}>Close</button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        cancelLabel={confirmModal.cancelLabel}
        isDanger={confirmModal.isDanger}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </DashboardLayout>
  );
};

export default TaskManagementPage;
