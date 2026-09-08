import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { ROUTES } from '../../constants/routes';
import { socialMediaService, type SocialMediaPost, type CreatorProfile } from '../../services/socialMedia.service';
import { authService } from '../../services/auth.service';
import toast from 'react-hot-toast';

const CreatorDashboard: React.FC = () => {
  const user = authService.getCurrentUser();
  const isLeadershipOrHOD = ['admin', 'ceo', 'managing_director', 'director', 'executive', 'social_media_manager', 'hod', 'regional_manager'].includes(user?.role || '');

  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [selectedCreator, setSelectedCreator] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [nextPost, setNextPost] = useState<SocialMediaPost | null>(null);
  const [countdown, setCountdown] = useState<string>('--:--:--');

  const fetchDashboardData = async (creatorId: string = selectedCreator) => {
    try {
      setLoading(true);
      const [postsData, creatorsData] = await Promise.all([
        socialMediaService.getPosts(creatorId),
        isLeadershipOrHOD ? socialMediaService.getCreators().catch(() => []) : Promise.resolve([])
      ]);

      setPosts(postsData);
      if (isLeadershipOrHOD && creatorsData.length > 0) {
        setCreators(creatorsData);
      }

      // Find the next scheduled post
      const now = new Date();
      const scheduled = postsData
        .filter(p => p.status === 'Scheduled' && p.scheduled_at && new Date(p.scheduled_at) > now)
        .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());

      if (scheduled.length > 0) {
        setNextPost(scheduled[0]);
      } else {
        setNextPost(null);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(selectedCreator);
  }, [selectedCreator]);

  // Countdown timer effect
  useEffect(() => {
    if (!nextPost || !nextPost.scheduled_at) return;

    const timer = setInterval(() => {
      const diff = new Date(nextPost.scheduled_at!).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown('Publishing now...');
        clearInterval(timer);
        fetchDashboardData(selectedCreator);
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
  }, [nextPost, selectedCreator]);

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

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'Instagram': return '??';
      case 'YouTube': return '??';
      case 'TikTok': return '??';
      case 'Facebook': return '??';
      case 'LinkedIn': return '??';
      case 'X': return '??';
      default: return '??';
    }
  };

  // Group posts by creator for HOD team breakdown
  const getCreatorBreakdown = () => {
    const map = new Map<string, { name: string; count: number; scheduled: number; published: number }>();
    posts.forEach(p => {
      const name = p.creator_name || 'Unassigned';
      const existing = map.get(name) || { name, count: 0, scheduled: 0, published: 0 };
      existing.count++;
      if (p.status === 'Scheduled') existing.scheduled++;
      if (p.status === 'Published') existing.published++;
      map.set(name, existing);
    });
    return Array.from(map.values());
  };

  const stats = getStats();
  const creatorBreakdown = getCreatorBreakdown();

  return (
    <DashboardLayout>
      <div className="w-full space-y-6 mis-animate-in">
        {/* Header with Title & Creator Filter */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black" style={{ color: 'var(--text-primary)' }}>
                Content Creator <span className="mis-page-title-accent">Hub</span>
              </h1>
              {isLeadershipOrHOD && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {user?.role === 'hod' ? 'HOD Oversight' : 'Management View'}
                </span>
              )}
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {isLeadershipOrHOD 
                ? 'Review, track, and monitor content creator production pipelines and schedules.'
                : `Welcome back, ${user?.full_name || 'Creator'}. Plan, script, schedule, and review your content workspace.`
              }
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Creator Filter Dropdown for HOD / Admins */}
            {isLeadershipOrHOD && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Creator:</span>
                <select
                  value={selectedCreator}
                  onChange={(e) => setSelectedCreator(e.target.value)}
                  className="mis-input py-2 px-3 text-sm rounded-lg font-medium"
                  style={{ minWidth: '180px' }}
                >
                  <option value="all">All Creators (Team View)</option>
                  {creators.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.role === 'hod' ? 'HOD' : 'Creator'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Link
              to={ROUTES.CREATOR_PLANNER}
              className="mis-btn mis-btn-primary py-2 px-4 text-sm font-semibold rounded-lg shadow-md transition duration-200"
            >
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
            {/* Countdown Banner if scheduled */}
            {nextPost && (
              <div className="glass rounded-[var(--radius-xl)] p-5 border-l-4 border-l-sky-500 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-sky-950/20 to-transparent">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-sky-500/10 text-sky-400">
                      Next Scheduled Post
                    </span>
                    {nextPost.creator_name && (
                      <span className="text-xs text-slate-400 font-medium">
                        by <span className="text-white font-semibold">{nextPost.creator_name}</span>
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                    {getPlatformIcon(nextPost.platform)} {nextPost.title} ({nextPost.platform})
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Scheduled for {new Date(nextPost.scheduled_at!).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>

                <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-700/50 rounded-xl px-4 py-2 shrink-0">
                  <span className="text-xl">??</span>
                  <div>
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Publishing In</div>
                    <div className="text-xl font-black font-mono text-sky-400">{countdown}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="glass rounded-[var(--radius-xl)] p-4 flex flex-col items-center justify-center text-center">
                <span className="text-2xl mb-1">??</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Ideas</span>
                <span className="text-2xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>{stats.idea}</span>
              </div>
              <div className="glass rounded-[var(--radius-xl)] p-4 flex flex-col items-center justify-center text-center">
                <span className="text-2xl mb-1">??</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Scripting</span>
                <span className="text-2xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>{stats.scripting}</span>
              </div>
              <div className="glass rounded-[var(--radius-xl)] p-4 flex flex-col items-center justify-center text-center">
                <span className="text-2xl mb-1">??</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Production</span>
                <span className="text-2xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>{stats.editing}</span>
              </div>
              <div className="glass rounded-[var(--radius-xl)] p-4 flex flex-col items-center justify-center text-center">
                <span className="text-2xl mb-1">??</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Scheduled</span>
                <span className="text-2xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>{stats.scheduled}</span>
              </div>
              <div className="glass rounded-[var(--radius-xl)] p-4 flex flex-col items-center justify-center text-center col-span-2 md:col-span-1">
                <span className="text-2xl mb-1">??</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Published</span>
                <span className="text-2xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>{stats.published}</span>
              </div>
            </div>

            {/* Quick Actions & Recent Posts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quick Launch Panel & Creator Breakdown */}
              <div className="space-y-6">
                <div className="glass rounded-[var(--radius-xl)] p-5 space-y-4">
                  <h3 className="text-md font-bold" style={{ color: 'var(--text-primary)' }}>Quick Launch Tools</h3>
                  <div className="flex flex-col gap-2">
                    <Link to={ROUTES.CREATOR_PLANNER} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[rgba(255,255,255,0.04)] transition">
                      <span className="text-xl">??</span>
                      <div>
                        <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Planner Board</h4>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Organize script, editing pipeline</p>
                      </div>
                    </Link>
                    <Link to={ROUTES.CREATOR_CALENDAR} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[rgba(255,255,255,0.04)] transition">
                      <span className="text-xl">??</span>
                      <div>
                        <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Schedule Calendar</h4>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Plan visual publication schedules</p>
                      </div>
                    </Link>
                    <Link to={ROUTES.CREATOR_ASSETS} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[rgba(255,255,255,0.04)] transition">
                      <span className="text-xl">??</span>
                      <div>
                        <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Asset Library</h4>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Upload video reels and image files</p>
                      </div>
                    </Link>
                  </div>
                </div>

                {/* Team Breakdown for HOD */}
                {isLeadershipOrHOD && creatorBreakdown.length > 0 && (
                  <div className="glass rounded-[var(--radius-xl)] p-5 space-y-3">
                    <h3 className="text-md font-bold" style={{ color: 'var(--text-primary)' }}>Creator Contributions</h3>
                    <div className="space-y-2">
                      {creatorBreakdown.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/40 border border-slate-800 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-400 font-bold flex items-center justify-center text-[10px]">
                              {item.name.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="font-semibold text-slate-200">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-slate-400">
                            <span>Total: <strong className="text-white">{item.count}</strong></span>
                            <span>Scheduled: <strong className="text-sky-400">{item.scheduled}</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Active Pipeline Table */}
              <div className="glass rounded-[var(--radius-xl)] p-5 lg:col-span-2 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-md font-bold" style={{ color: 'var(--text-primary)' }}>Active Pipeline Items</h3>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {posts.filter(p => p.status !== 'Published').length} active drafts and scheduled posts
                    </p>
                  </div>
                  <Link to={ROUTES.CREATOR_PLANNER} className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                    View All Board Items &rarr;
                  </Link>
                </div>

                {posts.filter(p => p.status !== 'Published').length === 0 ? (
                  <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>
                    <span className="text-3xl block mb-2">??</span>
                    No active items. Create a new idea to start!
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <th className="pb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Platform</th>
                          <th className="pb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Title</th>
                          <th className="pb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Creator</th>
                          <th className="pb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Type</th>
                          <th className="pb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Status</th>
                          <th className="pb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Scheduled</th>
                        </tr>
                      </thead>
                      <tbody>
                        {posts
                          .filter(p => p.status !== 'Published')
                          .slice(0, 8)
                          .map(post => (
                            <tr key={post.id} style={{ borderBottom: '1px solid var(--border-light)' }} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                              <td className="py-3 text-sm font-medium whitespace-nowrap">
                                <span className="mr-1.5">{getPlatformIcon(post.platform)}</span>
                                {post.platform}
                              </td>
                              <td className="py-3 text-sm font-bold max-w-[200px] truncate" style={{ color: 'var(--text-primary)' }} title={post.title}>
                                {post.title}
                              </td>
                              <td className="py-3 text-xs whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/50 text-slate-300 font-medium">
                                  <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 text-[9px] flex items-center justify-center font-bold">
                                    {(post.creator_name || 'U').slice(0, 1).toUpperCase()}
                                  </span>
                                  {post.creator_name || 'Unknown'}
                                </span>
                              </td>
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
                              <td className="py-3 text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
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
