import React, { useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { socialMediaService } from '../../services/socialMedia.service';
import toast from 'react-hot-toast';

interface UploadedAsset {
  name: string;
  url: string;
  type: string;
  size: string;
  uploadedAt: Date;
}

const AssetLibrary: React.FC = () => {
  const [assets, setAssets] = useState<UploadedAsset[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    // Safety check: 50MB limit
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size exceeds the 50MB limit.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const url = await socialMediaService.uploadAsset(file, (progress) => {
        setUploadProgress(progress);
      });

      const newAsset: UploadedAsset = {
        name: file.name,
        url: url,
        type: file.type,
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        uploadedAt: new Date()
      };

      setAssets(prev => [newAsset, ...prev]);
      toast.success('Asset uploaded successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload file to storage.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Public media URL copied to clipboard!');
  };

  return (
    <DashboardLayout>
      <div className="w-full space-y-6 mis-animate-in">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
              Media <span className="mis-page-title-accent">Asset Library</span>
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Upload and manage video reels, shorts, and images. Click any card to copy its direct URL.
            </p>
          </div>
          
          <div className="relative overflow-hidden shrink-0">
            <label className="mis-btn mis-btn-primary py-2.5 px-4 text-sm font-semibold rounded-lg shadow-md cursor-pointer block">
              + Upload Media File
              <input
                type="file"
                className="hidden"
                accept="video/mp4,video/quicktime,image/*"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
          </div>
        </div>

        {/* Uploading Progress Indicator */}
        {uploading && (
          <div className="glass rounded-xl p-4 border border-sky-500/20 space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span style={{ color: 'var(--text-primary)' }}>Uploading media file...</span>
              <span style={{ color: 'var(--accent)' }}>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div 
                className="h-2 rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Assets Grid */}
        {assets.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center border border-dashed border-slate-700/40">
            <span className="text-4xl block mb-3">📦</span>
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>No media files uploaded</h3>
            <p className="text-sm max-w-sm mx-auto mt-1" style={{ color: 'var(--text-secondary)' }}>
              Upload your MP4 video reels, YouTube shorts, or Instagram images to store them and link them to your scheduler cards.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {assets.map((asset, idx) => (
              <div
                key={idx}
                onClick={() => copyToClipboard(asset.url)}
                className="glass rounded-xl overflow-hidden border border-[var(--border-light)] hover:shadow-xl hover:-translate-y-0.5 transition duration-200 cursor-pointer group flex flex-col h-[280px]"
              >
                {/* Media Preview Window */}
                <div className="flex-1 w-full bg-slate-950 flex items-center justify-center overflow-hidden border-b border-[var(--border-light)] relative">
                  {asset.type.startsWith('video/') ? (
                    <video
                      src={asset.url}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                      onMouseOver={e => e.currentTarget.play()}
                      onMouseOut={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                    />
                  ) : (
                    <img
                      src={asset.url}
                      alt={asset.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  )}
                  
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-200">
                    <span className="bg-slate-900/90 text-white text-xs px-3 py-1.5 rounded-full font-semibold border border-slate-700/50">
                      Copy Public URL
                    </span>
                  </div>

                  {/* Video length/tag badge */}
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/75 text-[9px] font-bold text-white tracking-wider uppercase">
                    {asset.type.startsWith('video/') ? 'Video' : 'Image'}
                  </span>
                </div>

                {/* File Metadata */}
                <div className="p-3.5 space-y-1 bg-slate-900/30 shrink-0">
                  <h4 className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }} title={asset.name}>
                    {asset.name}
                  </h4>
                  <div className="flex justify-between items-center text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                    <span>{asset.size}</span>
                    <span>{asset.uploadedAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AssetLibrary;
