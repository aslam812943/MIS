import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { socialMediaService, type SocialMediaPost } from '../../services/socialMedia.service';
import toast from 'react-hot-toast';

const PLATFORMS = ['Instagram', 'YouTube', 'TikTok', 'Facebook', 'LinkedIn', 'X'] as const;
const CONTENT_TYPES = ['Reel', 'Short', 'Post', 'Story', 'Video'] as const;

const Calendar: React.FC = () => {
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPost, setSelectedPost] = useState<Partial<SocialMediaPost> | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);

  const fetchScheduledPosts = async () => {
    try {
      setLoading(true);
      // Fetch posts for the current month
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const data = await socialMediaService.getScheduledPosts(startOfMonth, endOfMonth);
      setPosts(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load scheduled items.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduledPosts();
  }, [currentDate]);

  // Calendar calculations
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDayIndex = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());

  const prevMonthDays = firstDayIndex;
  const calendarCells = [];

  // Previous month padding cells
  const prevMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);
  const prevMonthTotalDays = getDaysInMonth(prevMonthDate.getFullYear(), prevMonthDate.getMonth());
  for (let i = prevMonthTotalDays - prevMonthDays + 1; i <= prevMonthTotalDays; i++) {
    calendarCells.push({ day: i, monthOffset: -1, date: new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), i) });
  }

  // Current month cells
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push({ day: i, monthOffset: 0, date: new Date(currentDate.getFullYear(), currentDate.getMonth(), i) });
  }

  // Next month padding cells
  const remainingCells = 42 - calendarCells.length;
  const nextMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1);
  for (let i = 1; i <= remainingCells; i++) {
    calendarCells.push({ day: i, monthOffset: 1, date: new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), i) });
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    const offset = direction === 'prev' ? -1 : 1;
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const handleOpenCreateModal = (date: Date) => {
    // Set scheduled time to 12:00 PM of that date
    const targetDate = new Date(date);
    targetDate.setHours(12, 0, 0, 0);
    
    setSelectedPost({
      title: '',
      caption: '',
      platform: 'Instagram',
      content_type: 'Reel',
      status: 'Scheduled',
      script: '',
      scheduled_at: targetDate.toISOString().slice(0, 16)
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (post: SocialMediaPost) => {
    setSelectedPost({
      ...post,
      scheduled_at: post.scheduled_at ? new Date(post.scheduled_at).toISOString().slice(0, 16) : ''
    });
    setShowModal(true);
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPost || !selectedPost.title) return;

    try {
      const payload = {
        ...selectedPost,
        scheduled_at: selectedPost.scheduled_at ? new Date(selectedPost.scheduled_at).toISOString() : undefined
      };

      if (selectedPost.id) {
        await socialMediaService.updatePost(selectedPost.id, payload);
        toast.success('Post updated!');
      } else {
        await socialMediaService.createPost(payload);
        toast.success('Post scheduled successfully!');
      }
      setShowModal(false);
      setSelectedPost(null);
      fetchScheduledPosts();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save post.');
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!window.confirm('Delete this scheduled post?')) return;
    try {
      await socialMediaService.deletePost(id);
      toast.success('Post removed.');
      setShowModal(false);
      setSelectedPost(null);
      fetchScheduledPosts();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete post.');
    }
  };

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

  const getPlatformBadgeClass = (platform: string) => {
    switch (platform) {
      case 'Instagram': return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
      case 'YouTube': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'TikTok': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'Facebook': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'LinkedIn': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'X': return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <DashboardLayout>
      <div className="w-full space-y-6 mis-animate-in">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
              Schedule <span className="mis-page-title-accent">Calendar</span>
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Plan, drag, and view scheduled release slots chronologically.
            </p>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/50 rounded-lg p-1">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-1 px-3 text-sm rounded hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              &larr;
            </button>
            <span className="font-bold text-sm px-3" style={{ color: 'var(--text-primary)' }}>
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </span>
            <button
              onClick={() => navigateMonth('next')}
              className="p-1 px-3 text-sm rounded hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              &rarr;
            </button>
          </div>
        </div>

        {loading ? (
          <div className="w-full flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--accent)' }} />
          </div>
        ) : (
          <div className="glass rounded-2xl overflow-hidden border border-slate-700/30">
            {/* Weekday Titles */}
            <div className="grid grid-cols-7 text-center bg-slate-900/60 border-b border-slate-800 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            {/* Calendar Cells Grid */}
            <div className="grid grid-cols-7 grid-rows-6 h-[720px] bg-slate-900/10 divide-x divide-y divide-slate-800/40">
              {calendarCells.map((cell, idx) => {
                // Filter posts scheduled on this date
                const dayPosts = posts.filter(p => {
                  if (!p.scheduled_at) return false;
                  const d = new Date(p.scheduled_at);
                  return d.getDate() === cell.date.getDate() &&
                         d.getMonth() === cell.date.getMonth() &&
                         d.getFullYear() === cell.date.getFullYear();
                });

                const isCurrentMonth = cell.monthOffset === 0;
                const isToday = new Date().toDateString() === cell.date.toDateString();

                return (
                  <div
                    key={idx}
                    onClick={() => handleOpenCreateModal(cell.date)}
                    className={`p-2 flex flex-col h-full overflow-hidden transition relative cursor-pointer hover:bg-slate-800/20 ${
                      isCurrentMonth ? '' : 'opacity-30'
                    } ${
                      isToday ? 'bg-sky-500/5' : ''
                    }`}
                  >
                    {/* Day Number */}
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                        isToday ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-400'
                      }`}>
                        {cell.day}
                      </span>
                    </div>

                    {/* Day Scheduled Posts List */}
                    <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
                      {dayPosts.map(post => (
                        <div
                          key={post.id}
                          onClick={(e) => { e.stopPropagation(); handleOpenEditModal(post); }}
                          className={`p-1.5 rounded border text-[10px] font-semibold flex items-center gap-1.5 shadow-sm truncate hover:scale-[1.02] transition ${getPlatformBadgeClass(post.platform)}`}
                          title={`${post.title} (${post.content_type}) - ${post.scheduled_at ? new Date(post.scheduled_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}`}
                        >
                          <span>{getPlatformIcon(post.platform)}</span>
                          <span className="truncate flex-1 text-left">{post.title}</span>
                          <span className="opacity-70 font-mono scale-90 shrink-0">
                            {post.scheduled_at ? new Date(post.scheduled_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}) : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal for Creating & Editing Posts */}
        {showModal && selectedPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="glass w-full max-w-lg rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl flex flex-col">
              {/* Modal Header */}
              <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-light)' }}>
                <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {selectedPost.id ? 'Edit Scheduled Post' : 'Schedule Content'}
                </h3>
                <button
                  onClick={() => { setShowModal(false); setSelectedPost(null); }}
                  className="text-slate-400 hover:text-white text-lg font-bold"
                >
                  &times;
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSavePost} className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
                <div className="grid grid-cols-2 gap-4">
                  <div className="mis-field col-span-2">
                    <label className="mis-label">Content Title *</label>
                    <input
                      type="text"
                      className="mis-input"
                      value={selectedPost.title || ''}
                      onChange={e => setSelectedPost({ ...selectedPost, title: e.target.value })}
                      placeholder="e.g., Creative Reel Idea"
                      required
                    />
                  </div>

                  <div className="mis-field">
                    <label className="mis-label">Platform</label>
                    <select
                      className="mis-input"
                      value={selectedPost.platform}
                      onChange={e => setSelectedPost({ ...selectedPost, platform: e.target.value as any })}
                    >
                      {PLATFORMS.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mis-field">
                    <label className="mis-label">Content Type</label>
                    <select
                      className="mis-input"
                      value={selectedPost.content_type}
                      onChange={e => setSelectedPost({ ...selectedPost, content_type: e.target.value as any })}
                    >
                      {CONTENT_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mis-field">
                    <label className="mis-label">Pipeline Status</label>
                    <select
                      className="mis-input"
                      value={selectedPost.status}
                      onChange={e => setSelectedPost({ ...selectedPost, status: e.target.value as any })}
                    >
                      <option value="Idea">Idea</option>
                      <option value="Scripting">Scripting</option>
                      <option value="Filming">Filming</option>
                      <option value="Editing">Editing</option>
                      <option value="Scheduled">Scheduled</option>
                      <option value="Published">Published</option>
                    </select>
                  </div>

                  <div className="mis-field">
                    <label className="mis-label">Scheduled Publish Date & Time *</label>
                    <input
                      type="datetime-local"
                      className="mis-input"
                      value={selectedPost.scheduled_at || ''}
                      onChange={e => setSelectedPost({ ...selectedPost, scheduled_at: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="mis-field">
                  <label className="mis-label">Script / Hook Details</label>
                  <textarea
                    rows={3}
                    className="mis-input py-2 font-mono text-xs"
                    value={selectedPost.script || ''}
                    onChange={e => setSelectedPost({ ...selectedPost, script: e.target.value })}
                  />
                </div>

                <div className="mis-field">
                  <label className="mis-label">Description / Caption</label>
                  <textarea
                    rows={3}
                    className="mis-input py-2"
                    value={selectedPost.caption || ''}
                    onChange={e => setSelectedPost({ ...selectedPost, caption: e.target.value })}
                  />
                </div>

                <div className="mis-field">
                  <label className="mis-label">Media File URL</label>
                  <input
                    type="text"
                    className="mis-input"
                    value={selectedPost.media_url || ''}
                    onChange={e => setSelectedPost({ ...selectedPost, media_url: e.target.value })}
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center pt-4 border-t" style={{ borderColor: 'var(--border-light)' }}>
                  {selectedPost.id ? (
                    <button
                      type="button"
                      onClick={() => handleDeletePost(selectedPost.id!)}
                      className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600/10 text-red-500 hover:bg-red-600/20 transition"
                    >
                      Remove Post
                    </button>
                  ) : <div />}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowModal(false); setSelectedPost(null); }}
                      className="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="mis-btn mis-btn-primary px-4 py-2 text-sm font-semibold rounded-lg shadow"
                    >
                      {selectedPost.id ? 'Save Changes' : 'Schedule'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Calendar;
