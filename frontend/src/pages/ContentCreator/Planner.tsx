import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { socialMediaService, type SocialMediaPost } from '../../services/socialMedia.service';
import toast from 'react-hot-toast';

const COLUMNS: Array<{ key: SocialMediaPost['status']; label: string; icon: string }> = [
  { key: 'Idea', label: 'Ideas / Concepts', icon: '💡' },
  { key: 'Scripting', label: 'Script Writing', icon: '✍️' },
  { key: 'Filming', label: 'Production / Filming', icon: '🎥' },
  { key: 'Editing', label: 'Editing & Review', icon: '✂️' },
  { key: 'Scheduled', label: 'Scheduled Posts', icon: '📅' },
  { key: 'Published', label: 'Published Content', icon: '🚀' }
];

const PLATFORMS = ['Instagram', 'YouTube', 'TikTok', 'Facebook', 'LinkedIn', 'X'] as const;
const CONTENT_TYPES = ['Reel', 'Short', 'Post', 'Story', 'Video'] as const;

const Planner: React.FC = () => {
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [editingPost, setEditingPost] = useState<Partial<SocialMediaPost> | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [filterPlatform, setFilterPlatform] = useState<string>('all');

  const fetchPosts = async () => {
    try {
      const data = await socialMediaService.getPosts();
      setPosts(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch content pipeline.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleOpenCreateModal = (status: SocialMediaPost['status'] = 'Idea') => {
    setEditingPost({
      title: '',
      caption: '',
      platform: 'Instagram',
      content_type: 'Reel',
      status: status,
      script: '',
      scheduled_at: ''
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (post: SocialMediaPost) => {
    setEditingPost({
      ...post,
      scheduled_at: post.scheduled_at ? new Date(post.scheduled_at).toISOString().slice(0, 16) : ''
    });
    setShowModal(true);
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost || !editingPost.title) return;

    try {
      const payload = {
        ...editingPost,
        scheduled_at: editingPost.scheduled_at ? new Date(editingPost.scheduled_at).toISOString() : undefined
      };

      if (editingPost.id) {
        await socialMediaService.updatePost(editingPost.id, payload);
        toast.success('Post updated successfully!');
      } else {
        await socialMediaService.createPost(payload);
        toast.success('New content concept created!');
      }
      setShowModal(false);
      setEditingPost(null);
      fetchPosts();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save content card.');
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this content item?')) return;
    try {
      await socialMediaService.deletePost(id);
      toast.success('Content item deleted.');
      setShowModal(false);
      setEditingPost(null);
      fetchPosts();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete content.');
    }
  };

  const movePostStatus = async (post: SocialMediaPost, nextStatus: SocialMediaPost['status']) => {
    try {
      await socialMediaService.updatePost(post.id, { status: nextStatus });
      toast.success(`Moved to ${nextStatus}`);
      fetchPosts();
    } catch (err) {
      console.error(err);
      toast.error('Failed to change status.');
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

  const getPlatformClass = (platform: string) => {
    switch (platform) {
      case 'Instagram': return 'border-t-pink-500';
      case 'YouTube': return 'border-t-red-600';
      case 'TikTok': return 'border-t-cyan-400';
      case 'Facebook': return 'border-t-blue-600';
      case 'LinkedIn': return 'border-t-indigo-500';
      case 'X': return 'border-t-neutral-400';
      default: return 'border-t-slate-500';
    }
  };

  const filteredPosts = posts.filter(p => filterPlatform === 'all' || p.platform === filterPlatform);

  return (
    <DashboardLayout>
      <div className="w-full space-y-6 mis-animate-in">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
              Content <span className="mis-page-title-accent">Planner</span>
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Manage your production pipeline and move draft items through scripts and editing.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Platform filter */}
            <select
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
              className="mis-input py-2 px-3 text-sm rounded-lg"
              style={{ width: 'auto' }}
            >
              <option value="all">All Platforms</option>
              {PLATFORMS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button
              onClick={() => handleOpenCreateModal('Idea')}
              className="mis-btn mis-btn-primary py-2 px-4 text-sm font-semibold rounded-lg shadow-md"
            >
              + Add Content Idea
            </button>
          </div>
        </div>

        {loading ? (
          <div className="w-full flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--accent)' }} />
          </div>
        ) : (
          /* Kanban Board Scrollable Shell */
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-[1200px] h-[calc(100vh-230px)] items-start">
              {COLUMNS.map((col) => {
                const columnPosts = filteredPosts.filter(p => p.status === col.key);
                return (
                  <div key={col.key} className="flex-1 min-w-[280px] max-w-[320px] h-full flex flex-col glass rounded-[var(--radius-xl)] p-3 border border-slate-700/30">
                    {/* Column Header */}
                    <div className="flex justify-between items-center mb-3 pb-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-md">{col.icon}</span>
                        <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{col.label}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-semibold">{columnPosts.length}</span>
                      </div>
                      <button
                        onClick={() => handleOpenCreateModal(col.key)}
                        className="text-slate-400 hover:text-white text-md font-bold"
                        title="Add post to this column"
                      >
                        +
                      </button>
                    </div>

                    {/* Column Cards Container */}
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                      {columnPosts.length === 0 ? (
                        <div className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)' }}>
                          No posts here.
                        </div>
                      ) : (
                        columnPosts.map(post => (
                          <div
                            key={post.id}
                            onClick={() => handleOpenEditModal(post)}
                            className={`glass rounded-lg p-3.5 border-t-4 border border-[var(--border-light)] hover:-translate-y-0.5 hover:shadow-lg transition duration-200 cursor-pointer ${getPlatformClass(post.platform)}`}
                          >
                            <div className="flex justify-between items-start gap-2 mb-2">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                                {post.content_type}
                              </span>
                              <span className="text-xs">{getPlatformIcon(post.platform)} {post.platform}</span>
                            </div>
                            <h4 className="text-sm font-bold line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                              {post.title}
                            </h4>
                            {post.caption && (
                              <p className="text-xs line-clamp-2 mt-1" style={{ color: 'var(--text-secondary)' }}>
                                {post.caption}
                              </p>
                            )}

                            {/* Card Footer Actions */}
                            <div className="flex justify-between items-center mt-3 pt-2 border-t" style={{ borderColor: 'var(--border-light)', fontSize: '0.75rem' }}>
                              <span style={{ color: 'var(--text-muted)' }}>
                                {post.scheduled_at 
                                  ? new Date(post.scheduled_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                                  : 'Draft'
                                }
                              </span>
                              
                              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                {col.key !== 'Idea' && (
                                  <button 
                                    onClick={() => {
                                      const idx = COLUMNS.findIndex(c => c.key === col.key);
                                      if (idx > 0) movePostStatus(post, COLUMNS[idx-1].key);
                                    }}
                                    className="p-1 hover:bg-slate-700/50 rounded"
                                    title="Move Back"
                                  >
                                    &larr;
                                  </button>
                                )}
                                {col.key !== 'Published' && (
                                  <button 
                                    onClick={() => {
                                      const idx = COLUMNS.findIndex(c => c.key === col.key);
                                      if (idx < COLUMNS.length - 1) movePostStatus(post, COLUMNS[idx+1].key);
                                    }}
                                    className="p-1 hover:bg-slate-700/50 rounded"
                                    title="Move Forward"
                                  >
                                    &rarr;
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal for Creating & Editing Posts */}
        {showModal && editingPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="glass w-full max-w-lg rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl flex flex-col">
              {/* Modal Header */}
              <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-light)' }}>
                <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {editingPost.id ? 'Edit Content Details' : 'New Content Pipeline Idea'}
                </h3>
                <button
                  onClick={() => { setShowModal(false); setEditingPost(null); }}
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
                      value={editingPost.title || ''}
                      onChange={e => setEditingPost({ ...editingPost, title: e.target.value })}
                      placeholder="e.g., A Day in the Life of a Developer"
                      required
                    />
                  </div>

                  <div className="mis-field">
                    <label className="mis-label">Platform</label>
                    <select
                      className="mis-input"
                      value={editingPost.platform}
                      onChange={e => setEditingPost({ ...editingPost, platform: e.target.value as any })}
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
                      value={editingPost.content_type}
                      onChange={e => setEditingPost({ ...editingPost, content_type: e.target.value as any })}
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
                      value={editingPost.status}
                      onChange={e => setEditingPost({ ...editingPost, status: e.target.value as any })}
                    >
                      {COLUMNS.map(c => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mis-field">
                    <label className="mis-label">Scheduled Publish Date & Time</label>
                    <input
                      type="datetime-local"
                      className="mis-input"
                      value={editingPost.scheduled_at || ''}
                      onChange={e => setEditingPost({ ...editingPost, scheduled_at: e.target.value })}
                    />
                  </div>
                </div>

                <div className="mis-field">
                  <label className="mis-label">Script & Talking Notes</label>
                  <textarea
                    rows={4}
                    className="mis-input py-2 font-mono text-xs"
                    value={editingPost.script || ''}
                    onChange={e => setEditingPost({ ...editingPost, script: e.target.value })}
                    placeholder="Hook: Start with a question...&#10;Body: Show step 1, 2, 3...&#10;Call to Action: Follow for more!"
                  />
                </div>

                <div className="mis-field">
                  <label className="mis-label">Description / Social Caption & Hashtags</label>
                  <textarea
                    rows={3}
                    className="mis-input py-2"
                    value={editingPost.caption || ''}
                    onChange={e => setEditingPost({ ...editingPost, caption: e.target.value })}
                    placeholder="Write a catchy caption... #creator #devlife"
                  />
                </div>

                <div className="mis-field">
                  <label className="mis-label">Media File URL / Asset Path</label>
                  <input
                    type="text"
                    className="mis-input"
                    value={editingPost.media_url || ''}
                    onChange={e => setEditingPost({ ...editingPost, media_url: e.target.value })}
                    placeholder="Paste URL or upload in the Asset Library"
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center pt-4 border-t" style={{ borderColor: 'var(--border-light)' }}>
                  {editingPost.id ? (
                    <button
                      type="button"
                      onClick={() => handleDeletePost(editingPost.id!)}
                      className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600/10 text-red-500 hover:bg-red-600/20 transition"
                    >
                      Delete Item
                    </button>
                  ) : <div />}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowModal(false); setEditingPost(null); }}
                      className="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="mis-btn mis-btn-primary px-4 py-2 text-sm font-semibold rounded-lg shadow"
                    >
                      {editingPost.id ? 'Save Changes' : 'Create Card'}
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

export default Planner;
