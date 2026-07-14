import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import DashboardLayout from '../components/layout/DashboardLayout';
import { notificationService, type AppNotification } from '../services/notification.service';
import { authService } from '../services/auth.service';

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Full-page list of deadline/aging notifications raised by the daily
 * notification scan (AMC renewals, compliance dues, aging tickets, etc).
 */
const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const isAdmin = user?.role === 'admin';

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [runningCheck, setRunningCheck] = useState(false);

  const fetchNotifications = async () => {
    try {
      const data = await notificationService.getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleOpen = async (n: AppNotification) => {
    if (!n.is_read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      try {
        await notificationService.markAsRead(n.id);
      } catch (err) {
        console.error(err);
      }
    }
    if (n.link) navigate(n.link);
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((x) => ({ ...x, is_read: true })));
      toast.success('All notifications marked as read.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to mark notifications as read.');
    }
  };

  const handleRunCheck = async () => {
    setRunningCheck(true);
    try {
      const result = await notificationService.runCheck();
      toast.success(`Scan complete: ${result.notificationsCreated} new notification${result.notificationsCreated === 1 ? '' : 's'} created.`);
      fetchNotifications();
    } catch (err) {
      console.error(err);
      toast.error('Failed to run notification check.');
    } finally {
      setRunningCheck(false);
    }
  };

  const visibleNotifications = filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-4xl mx-auto">
        <header className="mis-page-header">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="mis-page-title mis-page-title-accent">Notifications</h1>
              <p className="mis-page-desc">Due dates, renewals, and aging items flagged across every department.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isAdmin && (
                <button
                  type="button"
                  className="mis-btn mis-btn-ghost mis-btn-sm text-xs"
                  onClick={handleRunCheck}
                  disabled={runningCheck}
                >
                  {runningCheck ? 'Scanning...' : '🔄 Run Check Now'}
                </button>
              )}
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="mis-btn mis-btn-primary mis-btn-sm text-xs"
                  onClick={handleMarkAllRead}
                >
                  Mark all as read
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="mis-tabs mb-5">
          <button
            type="button"
            className={`mis-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            className={`mis-tab ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {loading ? (
          <div className="mis-empty py-20">Loading notifications...</div>
        ) : visibleNotifications.length === 0 ? (
          <div className="mis-empty py-20">
            {filter === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleNotifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleOpen(n)}
                className="mis-card w-full text-left p-4 flex flex-col gap-1.5 transition-all hover:opacity-90"
                style={{
                  borderLeft: `3px solid ${n.is_read ? 'var(--border)' : 'var(--accent)'}`,
                  opacity: n.is_read ? 0.75 : 1,
                }}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="mis-badge mis-badge-info">{n.department}</span>
                  {n.type === 'overdue' ? (
                    <span
                      className="mis-badge"
                      style={{
                        color: 'var(--badge-danger-text)',
                        background: 'var(--badge-danger-bg)',
                        borderColor: 'var(--badge-danger-border)',
                      }}
                    >
                      Overdue
                    </span>
                  ) : (
                    <span className="mis-badge mis-badge-warning">Due Soon</span>
                  )}
                  {!n.is_read && <span className="mis-badge mis-badge-neutral">New</span>}
                  <span className="text-xs ml-auto" style={{ color: 'var(--text-secondary)' }}>
                    {formatRelativeTime(n.created_at)}
                  </span>
                </div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{n.title}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{n.message}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default NotificationsPage;
