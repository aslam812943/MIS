import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { socialMediaService, type SocialMediaPost } from '../../services/socialMedia.service';
import toast from 'react-hot-toast';

const ApprovalsQueue: React.FC = () => {
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activePost, setActivePost] = useState<SocialMediaPost | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [showRejectForm, setShowRejectForm] = useState<boolean>(false);

  const fetchPendingPosts = async () => {
    try {
      setLoading(true);
      const data = await socialMediaService.getPosts();
      // Filter for posts that are "Needs Review" or "Scheduled" but not yet published
      // We will focus on posts in "Needs Review" or "Scheduled" stages.
      const pending = data.filter(p => ['Needs Review', 'Scheduled'].includes(p.status));
      setPosts(pending);
      if (pending.length > 0) {
        setActivePost(pending[0]);
      } else {
        setActivePost(null);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load pending queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingPosts();
  }, []);

  const handleApprove = async () => {
    if (!activePost) return;
    try {
      await socialMediaService.updatePost(activePost.id, { status: 'Scheduled' });
      toast.success('Post approved and scheduled!');
      fetchPendingPosts();
    } catch (err) {
      console.error(err);
      toast.error('Failed to approve post.');
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePost || !feedback) return;
    try {
      // Revert to Scripting and append feedback to caption or log
      const updatedCaption = `${activePost.caption || ''}\n\n[Feedback SMM]: ${feedback}`;
      await socialMediaService.updatePost(activePost.id, {
        status: 'Scripting',
        caption: updatedCaption
      });
      toast.success('Post sent back to Scripting with feedback.');
      setShowRejectForm(false);
      setFeedback('');
      fetchPendingPosts();
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit revision request.');
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

  const isVideoFile = (url?: string) => {
    if (!url) return false;
    return url.includes('.mp4') || url.includes('.mov') || url.includes('video');
  };

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
            Approvals <span className="mis-page-title-accent">Queue</span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Review content details, captions, scripts, and video reels uploaded by creators.
          </p>
        </div>

        {loading ? (
          <div className="w-full flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--accent)' }} />
          </div>
        ) : posts.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center border border-slate-700/40">
            <span className="text-4xl block mb-3">🎉</span>
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Approvals Queue Clear!</h3>
            <p className="text-sm max-w-sm mx-auto mt-1" style={{ color: 'var(--text-secondary)' }}>
              There are no pending posts requiring manager review at this moment.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-230px)] items-start">
            {/* Left Queue List */}
            <div className="glass rounded-[var(--radius-xl)] p-4 h-full flex flex-col overflow-hidden">
              <h3 className="text-sm font-bold pb-2 border-b mb-3" style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}>
                Pending Review ({posts.length})
              </h3>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {posts.map(post => (
                  <button
                    key={post.id}
                    onClick={() => { setActivePost(post); setShowRejectForm(false); }}
                    className={`w-full text-left p-3 rounded-lg border transition duration-200 block ${
                      activePost?.id === post.id
                        ? 'bg-sky-500/10 border-sky-500/30'
                        : 'border-[var(--border-light)] hover:bg-[rgba(255,255,255,0.02)]'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        {post.content_type}
                      </span>
                      <span className="text-xs">{getPlatformIcon(post.platform)} {post.platform}</span>
                    </div>
                    <h4 className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{post.title}</h4>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                      Creator: {post.creator_name || 'Creator'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Detailed Review Panel */}
            {activePost && (
              <div className="glass rounded-[var(--radius-xl)] p-5 lg:col-span-2 h-full flex flex-col overflow-hidden border border-slate-700/20">
                {/* Panel Scrollable Body */}
                <div className="flex-1 overflow-y-auto space-y-5 pr-2">
                  <div className="flex justify-between items-start border-b pb-3" style={{ borderColor: 'var(--border-light)' }}>
                    <div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        {activePost.content_type}
                      </span>
                      <h2 className="text-lg font-bold mt-1.5" style={{ color: 'var(--text-primary)' }}>{activePost.title}</h2>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        Created by: {activePost.creator_name} | Platform: {getPlatformIcon(activePost.platform)} {activePost.platform}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>Scheduled date</span>
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {activePost.scheduled_at 
                          ? new Date(activePost.scheduled_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                          : 'Not Scheduled'
                        }
                      </span>
                    </div>
                  </div>

                  {/* Media Asset Preview */}
                  {activePost.media_url ? (
                    <div className="w-full bg-slate-950 rounded-xl overflow-hidden aspect-video border border-[var(--border-light)] flex items-center justify-center">
                      {isVideoFile(activePost.media_url) ? (
                        <video 
                          src={activePost.media_url} 
                          controls 
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <img 
                          src={activePost.media_url} 
                          alt={activePost.title} 
                          className="w-full h-full object-contain" 
                        />
                      )}
                    </div>
                  ) : (
                    <div className="w-full py-8 bg-slate-950/20 rounded-xl border border-dashed border-slate-700/40 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
                      No media files uploaded/linked to this card.
                    </div>
                  )}

                  {/* Script Hook Section */}
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Script & Talking Points</h4>
                    <pre className="p-3.5 bg-slate-950/30 rounded-lg text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto border border-[var(--border-light)]" style={{ color: 'var(--text-primary)' }}>
                      {activePost.script || 'No script drafted.'}
                    </pre>
                  </div>

                  {/* Caption Section */}
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Caption & Hashtags</h4>
                    <div className="p-3.5 bg-slate-950/20 rounded-lg text-xs leading-relaxed border border-[var(--border-light)]" style={{ color: 'var(--text-secondary)' }}>
                      {activePost.caption || 'No caption drafted.'}
                    </div>
                  </div>
                </div>

                {/* Reject / Feedback Form Overlay */}
                {showRejectForm && (
                  <form onSubmit={handleReject} className="border-t pt-4 mt-4 space-y-3" style={{ borderColor: 'var(--border-light)' }}>
                    <div className="mis-field">
                      <label className="mis-label">Revision Instructions / Feedback *</label>
                      <textarea
                        rows={2}
                        className="mis-input py-2"
                        value={feedback}
                        onChange={e => setFeedback(e.target.value)}
                        placeholder="Explain what needs to be changed (e.g., Speak louder in the hook, fix text layout)..."
                        required
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowRejectForm(false)}
                        className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-500 transition shadow"
                      >
                        Send Revision Request
                      </button>
                    </div>
                  </form>
                )}

                {/* Actions Footer */}
                {!showRejectForm && (
                  <div className="border-t pt-4 mt-4 flex justify-between items-center" style={{ borderColor: 'var(--border-light)' }}>
                    <button
                      onClick={() => setShowRejectForm(true)}
                      className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600/10 text-red-500 hover:bg-red-600/20 transition"
                    >
                      Request Revisions
                    </button>
                    
                    <button
                      onClick={handleApprove}
                      className="mis-btn mis-btn-primary px-5 py-2 text-sm font-semibold rounded-lg shadow-md"
                    >
                      Approve & Schedule Post
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ApprovalsQueue;
