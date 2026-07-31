import api from './api';

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TaskStatus = 'Not Started' | 'In Progress' | 'Blocked' | 'Completed' | 'Cancelled';
export type TaskView = 'mine' | 'assigned_by_me' | 'team';

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

export interface CreateTaskInput {
  title: string;
  description: string;
  assigned_to: string;
  priority?: TaskPriority;
  due_date?: string;
  department_id?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  due_date?: string | null;
  department_id?: string | null;
  assigned_to?: string;
  status?: TaskStatus;
}

export const taskService = {
  async getAssignableUsers(): Promise<AssignableUser[]> {
    const response = await api.get('/admin/tasks/assignable-users');
    return response.data;
  },

  async getTasks(view: TaskView, status?: string): Promise<Task[]> {
    const response = await api.get('/admin/tasks', { params: { view, status } });
    return response.data;
  },

  async createTask(input: CreateTaskInput): Promise<Task> {
    const response = await api.post('/admin/tasks', input);
    return response.data;
  },

  async getTaskDetail(id: string): Promise<{ task: Task; remarks: TaskRemark[] }> {
    const response = await api.get(`/admin/tasks/${id}`);
    return response.data;
  },

  async updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
    const response = await api.patch(`/admin/tasks/${id}`, input);
    return response.data;
  },

  async deleteTask(id: string): Promise<void> {
    await api.delete(`/admin/tasks/${id}`);
  },

  async addRemark(id: string, remarkText: string): Promise<TaskRemark> {
    const response = await api.post(`/admin/tasks/${id}/remarks`, { remark_text: remarkText });
    return response.data;
  },
};
