import api from './api';

export interface AppNotification {
  id: string;
  user_id: string;
  department: string;
  type: 'due_soon' | 'overdue';
  title: string;
  message: string;
  link: string | null;
  source_table: string;
  source_id: string;
  is_read: boolean;
  created_at: string;
}

export const notificationService = {
  getNotifications: async (): Promise<AppNotification[]> => {
    const response = await api.get('/admin/notifications');
    return response.data;
  },

  getUnreadCount: async (): Promise<number> => {
    const response = await api.get('/admin/notifications/unread-count');
    return response.data.count;
  },

  markAsRead: async (id: string): Promise<void> => {
    await api.patch(`/admin/notifications/${id}/read`);
  },

  markAllAsRead: async (): Promise<void> => {
    await api.post('/admin/notifications/mark-all-read');
  },

  runCheck: async (): Promise<{ itemsFound: number; notificationsCreated: number; usersEmailed: number }> => {
    const response = await api.post('/admin/notifications/run-check');
    return response.data;
  },
};
