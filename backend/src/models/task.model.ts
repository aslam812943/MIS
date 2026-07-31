export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TaskStatus = 'Not Started' | 'In Progress' | 'Blocked' | 'Completed' | 'Cancelled';

export const TASK_PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High', 'Urgent'];
export const TASK_STATUSES: TaskStatus[] = ['Not Started', 'In Progress', 'Blocked', 'Completed', 'Cancelled'];

export interface Task {
  id: string;
  title: string;
  description: string;
  assigned_to: string | null;
  assigned_by: string | null;
  department_id: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined display fields, populated by the service layer.
  assignee_name?: string | null;
  assignee_email?: string | null;
  creator_name?: string | null;
  creator_email?: string | null;
  department_name?: string | null;
}

export interface TaskRemark {
  id: string;
  task_id: string;
  author_id: string | null;
  remark_text: string;
  is_system: boolean;
  created_at: string;
  author_name?: string | null;
}

export interface AssignableUser {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  department_name: string | null;
}
