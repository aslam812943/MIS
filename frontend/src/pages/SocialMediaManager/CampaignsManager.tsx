import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { createPortal } from 'react-dom';
import { socialMediaService, type SocialMediaCampaign, type SocialMediaPost } from '../../services/socialMedia.service';
import toast from 'react-hot-toast';
import { FolderKanban, Plus, Send } from 'lucide-react';

const PLATFORMS = ['Instagram', 'YouTube', 'TikTok', 'Facebook', 'LinkedIn', 'X'] as const;
const CONTENT_TYPES = ['Reel', 'Short', 'Post', 'Story', 'Video'] as const;

const CampaignsManager: React.FC = () => {
  const [campaigns, setCampaigns] = useState<SocialMediaCampaign[]>([]);
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Modals state
  const [showCampaignModal, setShowCampaignModal] = useState<boolean>(false);
  const [showBriefModal, setShowBriefModal] = useState<boolean>(false);
  
  // Forms state
  const [newCampaign, setNewCampaign] = useState({ title: '', description: '' });
  const [newBrief, setNewBrief] = useState({
    title: '',
    platform: 'Instagram' as any,
    content_type: 'Reel' as any,
    caption: '',
    script: '',
    campaign_id: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cList, pList] = await Promise.all([
        socialMediaService.getCampaigns(),
        socialMediaService.getPosts()
      ]);
      setCampaigns(cList);
      setPosts(pList);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load campaigns data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaign.title) return;

    try {
      await socialMediaService.createCampaign(newCampaign);
      toast.success('Campaign created successfully!');
      setShowCampaignModal(false);
      setNewCampaign({ title: '', description: '' });
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to create campaign.');
    }
  };

  const handleCreateBrief = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrief.title || !newBrief.campaign_id) {
      toast.error('Please specify a title and select a campaign.');
      return;
    }

    try {
      // Dispatch brief as a post in "Idea" status linked to campaign_id
      await socialMediaService.createPost({
        ...newBrief,
        status: 'Idea'
      });
      toast.success('Brief successfully dispatched to Creator Planner!');
      setShowBriefModal(false);
      setNewBrief({
        title: '',
        platform: 'Instagram',
        content_type: 'Reel',
        caption: '',
        script: '',
        campaign_id: ''
      });
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to dispatch brief.');
    }
  };

  const getCampaignPosts = (campaignId: string) => {
    return posts.filter(p => p.campaign_id === campaignId);
  };

  const openBriefForCampaign = (campaignId: string) => {
    setNewBrief(prev => ({ ...prev, campaign_id: campaignId }));
    setShowBriefModal(true);
  };

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col items-start justify-between gap-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm sm:flex-row sm:items-center sm:p-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
              Campaigns & <span className="mis-page-title-accent">Briefs</span>
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Create marketing campaigns and assign content briefs straight to creator pipeline boards.
            </p>
          </div>
          
          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto">
            <button
              onClick={() => setShowCampaignModal(true)}
              className="w-full px-4 py-2 text-sm font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition sm:w-auto"
            >
              <span className="inline-flex items-center justify-center gap-2"><Plus size={16} /> Create Campaign</span>
            </button>
            <button
              onClick={() => {
                if (campaigns.length === 0) {
                  toast.error('Please create a campaign first.');
                  return;
                }
                openBriefForCampaign(campaigns[0].id);
              }}
              className="mis-btn mis-btn-primary w-full py-2 px-4 text-sm font-semibold rounded-lg shadow-md sm:w-auto"
            >
              <span className="inline-flex items-center justify-center gap-2"><Send size={15} /> Dispatch Brief</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="w-full flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--accent)' }} />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="glass rounded-2xl border border-slate-700/40 p-6 text-center sm:p-12">
            <span className="text-4xl block mb-3">📁</span>
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>No Campaigns Active</h3>
            <p className="text-sm max-w-sm mx-auto mt-1" style={{ color: 'var(--text-secondary)' }}>
              Create a campaign (e.g. Summer Sale, Product Review Series) to begin dispatching task briefs to your content creators.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((camp) => {
              const campPosts = getCampaignPosts(camp.id);
              const ideas = campPosts.filter(p => p.status === 'Idea').length;
              const scheduled = campPosts.filter(p => p.status === 'Scheduled').length;
              const published = campPosts.filter(p => p.status === 'Published').length;
              const total = campPosts.length;
              const completion = total > 0 ? Math.round((published / total) * 100) : 0;

              return (
                <article key={camp.id} className="group flex min-w-0 flex-col justify-between gap-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--accent)]/40 hover:shadow-lg">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <span className="inline-flex rounded-xl bg-[var(--accent)]/10 p-2.5 text-[var(--accent)]"><FolderKanban size={19} /></span>
                      <span className="rounded-full border border-[var(--border)] bg-[var(--bg-base)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{total} briefs</span>
                    </div>
                    <div>
                      <h3 className="break-words text-base font-bold text-[var(--text-primary)]">{camp.title}</h3>
                      <p className="mt-1 min-h-10 text-xs leading-5 text-[var(--text-secondary)] line-clamp-2">
                      {camp.description || 'No description provided.'}
                      </p>
                    </div>
                  </div>

                  {/* Campaign Post Breakdown Metrics */}
                  <div className="grid grid-cols-1 gap-3 rounded-lg border border-[var(--border-light)] bg-slate-950/20 p-3 text-xs sm:grid-cols-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>Briefs (Ideas)</span>
                      <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{ideas}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>Scheduled</span>
                      <span className="font-bold text-sm text-sky-400">{scheduled}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>Published</span>
                      <span className="font-bold text-sm text-emerald-400">{published}</span>
                    </div>
                  </div>

                  <div className="space-y-3 border-t border-[var(--border)] pt-4">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                      <span>Publishing progress</span><span>{completion}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-base)]">
                      <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${completion}%` }} />
                    </div>
                    <button onClick={() => openBriefForCampaign(camp.id)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-3 py-2 text-xs font-bold text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-slate-950">
                      <Send size={14} /> Add brief to campaign
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Modal for Creating Campaign */}
        {showCampaignModal && createPortal(
          <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm animate-fade-in sm:items-center sm:p-6">
            <div className="glass my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700/50 shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
              <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-light)' }}>
                <h3 className="text-md font-bold" style={{ color: 'var(--text-primary)' }}>Create Marketing Campaign</h3>
                <button onClick={() => setShowCampaignModal(false)} className="text-slate-400 hover:text-white text-lg font-bold">&times;</button>
              </div>

              <form onSubmit={handleCreateCampaign} className="space-y-4 overflow-y-auto p-4 sm:p-5">
                <div className="mis-field">
                  <label className="mis-label">Campaign Title *</label>
                  <input
                    type="text"
                    className="mis-input"
                    value={newCampaign.title}
                    onChange={e => setNewCampaign({ ...newCampaign, title: e.target.value })}
                    placeholder="e.g., Summer Brand Launch 2026"
                    required
                  />
                </div>

                <div className="mis-field">
                  <label className="mis-label">Description / Campaign Goals</label>
                  <textarea
                    rows={3}
                    className="mis-input py-2"
                    value={newCampaign.description}
                    onChange={e => setNewCampaign({ ...newCampaign, description: e.target.value })}
                    placeholder="Explain the scope and targets for this campaign..."
                  />
                </div>

                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCampaignModal(false)}
                    className="w-full px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition sm:w-auto"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="mis-btn mis-btn-primary w-full px-4 py-2 text-xs font-semibold rounded-lg shadow sm:w-auto">
                    Create Campaign
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* Modal for Dispatching Brief */}
        {showBriefModal && createPortal(
          <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm animate-fade-in sm:items-center sm:p-6">
            <div className="glass my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700/50 shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
              <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-light)' }}>
                <h3 className="text-md font-bold" style={{ color: 'var(--text-primary)' }}>Dispatch Content Brief</h3>
                <button onClick={() => setShowBriefModal(false)} className="text-slate-400 hover:text-white text-lg font-bold">&times;</button>
              </div>

              <form onSubmit={handleCreateBrief} className="space-y-4 overflow-y-auto p-4 sm:p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="mis-field sm:col-span-2">
                    <label className="mis-label">Brief Title *</label>
                    <input
                      type="text"
                      className="mis-input"
                      value={newBrief.title}
                      onChange={e => setNewBrief({ ...newBrief, title: e.target.value })}
                      placeholder="e.g., Create a Reel explaining Vite v8 features"
                      required
                    />
                  </div>

                  <div className="mis-field sm:col-span-2">
                    <label className="mis-label">Linked Campaign *</label>
                    <select
                      className="mis-input"
                      value={newBrief.campaign_id}
                      onChange={e => setNewBrief({ ...newBrief, campaign_id: e.target.value })}
                      required
                    >
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mis-field">
                    <label className="mis-label">Target Platform</label>
                    <select
                      className="mis-input"
                      value={newBrief.platform}
                      onChange={e => setNewBrief({ ...newBrief, platform: e.target.value as any })}
                    >
                      {PLATFORMS.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mis-field">
                    <label className="mis-label">Content Format</label>
                    <select
                      className="mis-input"
                      value={newBrief.content_type}
                      onChange={e => setNewBrief({ ...newBrief, content_type: e.target.value as any })}
                    >
                      {CONTENT_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mis-field">
                  <label className="mis-label">Brief Instructions / Direction</label>
                  <textarea
                    rows={3}
                    className="mis-input py-2 font-mono text-xs"
                    value={newBrief.script}
                    onChange={e => setNewBrief({ ...newBrief, script: e.target.value })}
                    placeholder="Provide notes for hooks, speaking points, or visual themes..."
                  />
                </div>

                <div className="mis-field">
                  <label className="mis-label">Suggested Caption & Hashtags</label>
                  <textarea
                    rows={2}
                    className="mis-input py-2"
                    value={newBrief.caption}
                    onChange={e => setNewBrief({ ...newBrief, caption: e.target.value })}
                    placeholder="Suggest copy options for the final caption..."
                  />
                </div>

                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setShowBriefModal(false)}
                    className="w-full px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition sm:w-auto"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="mis-btn mis-btn-primary w-full px-4 py-2 text-xs font-semibold rounded-lg shadow sm:w-auto">
                    Dispatch to Planner
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
      </div>
    </DashboardLayout>
  );
};

export default CampaignsManager;
