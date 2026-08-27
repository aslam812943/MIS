import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { ROUTES } from '../../constants/routes';
import { socialMediaService, type SocialMediaPost } from '../../services/socialMedia.service';
import { authService } from '../../services/auth.service';
import toast from 'react-hot-toast';

const CreatorDashboard: React.FC = () => {
  const user = authService.getCurrentUser();
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [nextPost, setNextPost] = useState<SocialMediaPost | null>(null);
  const [countdown, setCountdown] = useState<string>('--:--:--');

  const fetchDashboardData = async () => {
    try {
      const data = await socialMediaService.getPosts();
      setPosts(data);
      
      // Find the next scheduled post
      const now = new Date();
      const scheduled = data
        .filter(p => p.status === 'Scheduled' && p.scheduled_at && new Date(p.scheduled_at) > now)
        .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
      
      if (scheduled.length > 0) {
        setNextPost(scheduled[0]);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (!nextPost || !nextPost.scheduled_at) return;

    const timer = setInterval(() => {
      const diff = new Date(nextPost.scheduled_at!).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown('Publishing now...');
        clearInterval(timer);
        fetchDashboardData();
      } else {
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setCountdown(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [nextPost]);

  // Aggregate stats
  const getStats = () => {
    const stats = { idea: 0, scripting: 0, editing: 0, scheduled: 0, published: 0 };
    posts.forEach(p => {
      if (p.status === 'Idea') stats.idea++;
      else if (p.status === 'Scripting') stats.scripting++;
      else if (['Filming', 'Editing'].includes(p.status)) stats.editing++;
      else if (p.status === 'Scheduled') stats.scheduled++;
      else if (p.status === 'Published') stats.published++;
    });
    return stats;
  };

  const stats = getStats();

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'Instagram': return '📸';
      case 'YouTube': return '🎥';
      case 'TikTok': return '🎵';
      case 'Facebook': return '📘';
      case 'LinkedIn': return '💼';
      case 'X': return '🐦';
      default: return '🔗';
    }
  };

  return (
    <DashboardLayout>
      <div className="w-full space-y-6 mis-animate-in">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
              Content Creator <span className="mis-page-title-accent">Hub</span>
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Welcome back, {user?.full_name || 'Creator'}. Plan, script, schedule, and review your content workspace.
            </p>
          </div>
          <div className="flex gap-2">
            <Link to={ROUTES.CREATOR_PLANNER} className="mis-btn mis-btn-primary py-2 px-4 text-sm font-semibold rounded-lg shadow-md transition duration-200">
              + New Content Idea
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="w-full flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--accent)' }} />
          </div>
        ) : (
          <>
            {/* Countdown & Next Post Widget */}
            {nextPost && (
              <div className="glass rounded-[var(--radius-xl)] p-5 border border-dashed border-sky-500/30 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
                    Next Scheduled Post
                  </div>
                  <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                    {getPlatformIcon(nextPost.platform)} {nextPost.title} ({nextPost.content_type})
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Scheduled for: {new Date(nextPost.scheduled_at!).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
                <div className="text-center md:text-right shrink-0">
                  <span className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                    Time Remaining
                  </span>
                  <span className="text-3xl font-black font-mono tracking-wider block bg-gradient-to-r from-sky-400 to-indigo-500 bg-clip-text text-transparent">
                    {countdown}
                  </span>
                </div>
              </div>
            )}

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="glass rounded-[var(--radius-xl)] p-4 flex flex-col items-center justify-center text-center">
                <span className="text-2xl mb-1">💡</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Ideas</span>
                <span className="text-2xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>{stats.idea}</span>
              </div>
              <div className="glass rounded-[var(--radius-xl)] p-4 flex flex-col items-center justify-center text-center">
                <span className="text-2xl mb-1">✍️</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Scripting</span>
                <span className="text-2xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>{stats.scripting}</span>
              </div>
              <div className="glass rounded-[var(--radius-xl)] p-4 flex flex-col items-center justify-center text-center">
                <span className="text-2xl mb-1">🎬</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Production</span>
                <span className="text-2xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>{stats.editing}</span>
              </div>
              <div className="glass rounded-[var(--radius-xl)] p-4 flex flex-col items-center justify-center text-center">
                <span className="text-2xl mb-1">📅</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Scheduled</span>
                <span className="text-2xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>{stats.scheduled}</span>
              </div>
              <div className="glass rounded-[var(--radius-xl)] p-4 flex flex-col items-center justify-center text-center col-span-2 md:col-span-1">
                <span className="text-2xl mb-1">🚀</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Published</span>
                <span className="text-2xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>{stats.published}</span>
              </div>
            </div>

            {/* Quick Actions & Recent Posts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quick Launch Panel */}
              <div className="glass rounded-[var(--radius-xl)] p-5 space-y-4">
                <h3 className="text-md font-bold" style={{ color: 'var(--text-primary)' }}>Quick Launch Tools</h3>
                <div className="flex flex-col gap-2">
                  <Link to={ROUTES.CREATOR_PLANNER} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[rgba(255,255,255,0.04)] transition">
                    <span className="text-xl">📋</span>
                    <div>
                      <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Planner Board</h4>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Organize script, editing pipeline</p>
                    </div>
                  </Link>
                  <Link to={ROUTES.CREATOR_CALENDAR} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[rgba(255,255,255,0.04)] transition">
                    <span className="text-xl">📅</span>
                    <div>
                      <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Schedule Calendar</h4>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Plan visual publication schedules</p>
                    </div>
                  </Link>
                  <Link to={ROUTES.CREATOR_ASSETS} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[rgba(255,255,255,0.04)] transition">
                    <span className="text-xl">📦</span>
                    <div>
                      <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Asset Library</h4>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Upload video reels and image files</p>
                    </div>
                  </Link>
                </div>
              </div>

              {/* Recent Active Pipeline */}
              <div className="glass rounded-[var(--radius-xl)] p-5 lg:col-span-2 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-md font-bold" style={{ color: 'var(--text-primary)' }}>Active Pipeline Items</h3>
                  <Link to={ROUTES.CREATOR_PLANNER} className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                    View All Board Items &rarr;
                  </Link>
                </div>
                {posts.filter(p => p.status !== 'Published').length === 0 ? (
                  <div className="text-center py-10" style={{ color: 'var(--text-secondary)' }}>
                    No active items. Create a new idea to start!
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <th className="pb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Platform</th>
                          <th className="pb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Title</th>
                          <th className="pb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Type</th>
                          <th className="pb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Status</th>
                          <th className="pb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Scheduled</th>
                        </tr>
                      </thead>
                      <tbody>
                        {posts
                          .filter(p => p.status !== 'Published')
                          .slice(0, 5)
                          .map(post => (
                            <tr key={post.id} style={{ borderBottom: '1px solid var(--border-light)' }} className="hover:bg-[rgba(255,255,255,0.01)] transition-colors">
                              <td className="py-3 text-sm font-medium">{getPlatformIcon(post.platform)} {post.platform}</td>
                              <td className="py-3 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{post.title}</td>
                              <td className="py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{post.content_type}</td>
                              <td className="py-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold inline-block ${
                                  post.status === 'Idea' ? 'bg-zinc-500/10 text-zinc-400' :
                                  post.status === 'Scripting' ? 'bg-amber-500/10 text-amber-400' :
                                  post.status === 'Scheduled' ? 'bg-sky-500/10 text-sky-400' :
                                  'bg-purple-500/10 text-purple-400'
                                }`}>
                                  {post.status}
                                </span>
                              </td>
                              <td className="py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                                {post.scheduled_at
                                  ? new Date(post.scheduled_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                                  : 'Not Scheduled'
                                }
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CreatorDashboard;
