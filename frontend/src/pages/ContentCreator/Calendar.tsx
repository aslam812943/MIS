import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { socialMediaService, type SocialMediaPost, type CreatorProfile } from '../../services/socialMedia.service';
import { authService } from '../../services/auth.service';
import toast from 'react-hot-toast';

const PLATFORMS = ['Instagram', 'YouTube', 'TikTok', 'Facebook', 'LinkedIn', 'X'] as const;
const CONTENT_TYPES = ['Reel', 'Short', 'Post', 'Story', 'Video'] as const;

const Calendar: React.FC = () => {
  const user = authService.getCurrentUser();
  const isLeadershipOrHOD = ['admin', 'ceo', 'managing_director', 'director', 'executive', 'social_media_manager', 'hod', 'regional_manager'].includes(user?.role || '');

  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [filterCreator, setFilterCreator] = useState<string>('all');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPost, setSelectedPost] = useState<Partial<SocialMediaPost> | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);

  const fetchScheduledPosts = async (creatorId: string = filterCreator) => {
    try {
      setLoading(true);
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59).toISOString();
      
      const [data, creatorsData] = await Promise.all([
        socialMediaService.getScheduledPosts(startOfMonth, endOfMonth, creatorId),
        isLeadershipOrHOD ? socialMediaService.getCreators().catch(() => []) : Promise.resolve([])
      ]);

      setPosts(data);
      if (isLeadershipOrHOD && creatorsData.length > 0) {
        setCreators(creatorsData);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load scheduled items.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduledPosts(filterCreator);
  }, [currentDate, filterCreator]);

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

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleOpenDayModal = (date: Date) => {
    setSelectedPost({
      title: '',
      platform: 'Instagram',
      content_type: 'Reel',
      status: 'Scheduled',
      scheduled_at: new Date(date.setHours(9, 0, 0, 0)).toISOString().slice(0, 16),
      creator_id: isLeadershipOrHOD && filterCreator !== 'all' ? filterCreator : user?.id
    });
    setShowModal(true);
  };

  const handleOpenPostModal = (post: SocialMediaPost, e: React.MouseEvent) => {
    e.stopPropagation();
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
        toast.success('Scheduled post updated!');
      } else {
        await socialMediaService.createPost(payload);
        toast.success('New post scheduled!');
      }
      setShowModal(false);
      setSelectedPost(null);
      fetchScheduledPosts(filterCreator);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save schedule.');
    }
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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                Schedule <span className="mis-page-title-accent">Calendar</span>
              </h1>
              {isLeadershipOrHOD && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {user?.role === 'hod' ? 'HOD Calendar' : 'Team Calendar'}
                </span>
              )}
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Plan, review, and visually schedule content publication across platforms.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Creator filter for HOD */}
            {isLeadershipOrHOD && (
              <select
                value={filterCreator}
                onChange={(e) => setFilterCreator(e.target.value)}
                className="mis-input py-2 px-3 text-sm rounded-lg font-medium"
                style={{ width: 'auto' }}
              >
                <option value="all">All Creators</option>
                {creators.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            )}

            {/* Month Switcher Controls */}
            <div className="flex items-center gap-2 bg-slate-900/60 p-1 rounded-xl border border-slate-700/50">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-slate-700/50 rounded-lg text-slate-300 transition"
              >
                &larr;
              </button>
              <span className="text-sm font-bold px-2 text-white min-w-[120px] text-center">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-slate-700/50 rounded-lg text-slate-300 transition"
              >
                &rarr;
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="w-full flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--accent)' }} />
          </div>
        ) : (
          /* Calendar Grid Shell */
          <div className="glass rounded-[var(--radius-xl)] p-4 border border-slate-700/40">
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-2">
              {calendarCells.map((cell, idx) => {
                const dateStr = cell.date.toISOString().slice(0, 10);
                const dayPosts = posts.filter(p => p.scheduled_at && p.scheduled_at.startsWith(dateStr));
                const isToday = new Date().toDateString() === cell.date.toDateString();

                return (
                  <div
                    key={idx}
                    onClick={() => cell.monthOffset === 0 && handleOpenDayModal(cell.date)}
                    className={`min-h-[110px] p-2 rounded-xl border flex flex-col justify-between transition ${
                      cell.monthOffset !== 0
                        ? 'opacity-25 bg-slate-950/20 border-slate-800/30'
                        : isToday
                        ? 'bg-indigo-950/20 border-indigo-500/40 cursor-pointer hover:border-indigo-400'
                        : 'bg-slate-900/30 border-slate-800/50 cursor-pointer hover:border-slate-600'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-xs font-bold ${isToday ? 'text-indigo-400' : 'text-slate-400'}`}>
                        {cell.day}
                      </span>
                      {dayPosts.length > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-400">
                          {dayPosts.length}
                        </span>
                      )}
                    </div>

                    {/* Scheduled Items Preview */}
                    <div className="space-y-1 overflow-y-auto max-h-[80px]">
                      {dayPosts.map(post => (
                        <div
                          key={post.id}
                          onClick={(e) => handleOpenPostModal(post, e)}
                          className="p-1 rounded bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-[11px] font-medium text-slate-200 truncate flex items-center gap-1 shadow-sm"
                          title={`${post.title} (${post.creator_name || 'Creator'})`}
                        >
                          <span className="shrink-0">{getPlatformIcon(post.platform)}</span>
                          <span className="truncate">{post.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal for Creating & Editing Scheduled Items */}
        {showModal && selectedPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="glass w-full max-w-lg rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/40">
                <h3 className="text-md font-bold text-white">
                  {selectedPost.id ? 'Edit Scheduled Item' : 'Schedule New Post'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-white font-bold text-lg"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSavePost} className="p-5 space-y-4 overflow-y-auto flex-1">
                {/* Assigned Creator for HOD/Management */}
                {isLeadershipOrHOD && creators.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Assigned Creator
                    </label>
                    <select
                      value={selectedPost.creator_id || user?.id || ''}
                      onChange={(e) => setSelectedPost({ ...selectedPost, creator_id: e.target.value })}
                      className="mis-input w-full py-2 px-3 rounded-lg text-sm"
                    >
                      {creators.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.full_name} ({c.role === 'hod' ? 'HOD' : 'Creator'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Post Title / Concept <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={selectedPost.title || ''}
                    onChange={(e) => setSelectedPost({ ...selectedPost, title: e.target.value })}
                    placeholder="e.g. Weekly Market Wrap-Up"
                    className="mis-input w-full py-2 px-3 rounded-lg text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Platform</label>
                    <select
                      value={selectedPost.platform || 'Instagram'}
                      onChange={(e) => setSelectedPost({ ...selectedPost, platform: e.target.value as any })}
                      className="mis-input w-full py-2 px-3 rounded-lg text-sm"
                    >
                      {PLATFORMS.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Content Type</label>
                    <select
                      value={selectedPost.content_type || 'Reel'}
                      onChange={(e) => setSelectedPost({ ...selectedPost, content_type: e.target.value as any })}
                      className="mis-input w-full py-2 px-3 rounded-lg text-sm"
                    >
                      {CONTENT_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Schedule Date & Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={selectedPost.scheduled_at || ''}
                      onChange={(e) => setSelectedPost({ ...selectedPost, scheduled_at: e.target.value })}
                      className="mis-input w-full py-2 px-3 rounded-lg text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Status</label>
                    <select
                      value={selectedPost.status || 'Scheduled'}
                      onChange={(e) => setSelectedPost({ ...selectedPost, status: e.target.value as any })}
                      className="mis-input w-full py-2 px-3 rounded-lg text-sm"
                    >
                      <option value="Idea">Idea</option>
                      <option value="Scripting">Scripting</option>
                      <option value="Filming">Filming</option>
                      <option value="Editing">Editing</option>
                      <option value="Scheduled">Scheduled</option>
                      <option value="Published">Published</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Caption / Hashtags</label>
                  <textarea
                    rows={3}
                    value={selectedPost.caption || ''}
                    onChange={(e) => setSelectedPost({ ...selectedPost, caption: e.target.value })}
                    placeholder="Caption text, hashtags..."
                    className="mis-input w-full py-2 px-3 rounded-lg text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-700/50">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="mis-btn py-1.5 px-3 text-xs rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="mis-btn mis-btn-primary py-1.5 px-4 text-xs font-semibold rounded-lg shadow-md"
                  >
                    Save Schedule
                  </button>
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
