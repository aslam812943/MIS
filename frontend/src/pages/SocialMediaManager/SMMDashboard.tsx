import React, { useEffect, useState, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { socialMediaService, type SocialMediaAnalyticsRecord } from '../../services/socialMedia.service';
import { useTheme } from '../../context/ThemeContext';
import toast from 'react-hot-toast';

Chart.register(...registerables);

const SMMDashboard: React.FC = () => {
  const { theme } = useTheme();
  const [analytics, setAnalytics] = useState<SocialMediaAnalyticsRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const end = new Date().toISOString().split('T')[0];
      const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Last 30 days
      const data = await socialMediaService.getAnalytics(start, end);
      setAnalytics(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load social analytics. Make sure SQL tables exist.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  // Aggregate metrics
  const getAggregates = () => {
    let gained = 0;
    let lost = 0;
    let likes = 0;
    let impressions = 0;

    const filtered = analytics.filter(r => selectedPlatform === 'all' || r.platform === selectedPlatform);

    filtered.forEach(r => {
      gained += r.followers_gained;
      lost += r.followers_lost;
      likes += r.likes_count;
      impressions += r.impressions_count;
    });

    const net = gained - lost;
    const engagement = impressions > 0 ? ((likes / impressions) * 100).toFixed(2) + '%' : '0%';

    return { gained, lost, net, likes, impressions, engagement };
  };

  const metrics = getAggregates();

  // Render Follower Growth Chart
  useEffect(() => {
    if (loading || analytics.length === 0 || !canvasRef.current) return;

    const rafId = requestAnimationFrame(() => {
      const isDark = theme === 'dark';
      const tickColor = isDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(17, 24, 39, 0.65)';
      const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(17, 24, 39, 0.08)';
      const legendColor = isDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(17, 24, 39, 0.75)';

      // Filter and Group Analytics
      const filtered = analytics.filter(r => selectedPlatform === 'all' || r.platform === selectedPlatform);

      // Group by Date for unique labels
      const dateMap = new Map<string, { gained: number; lost: number; net: number }>();
      filtered.forEach(r => {
        const existing = dateMap.get(r.date) || { gained: 0, lost: 0, net: 0 };
        existing.gained += r.followers_gained;
        existing.lost += r.followers_lost;
        existing.net += (r.followers_gained - r.followers_lost);
        dateMap.set(r.date, existing);
      });

      // Sort dates chronologically
      const sortedDates = Array.from(dateMap.keys()).sort();
      let labels = sortedDates;
      let gainedData = sortedDates.map(d => dateMap.get(d)!.gained);
      let lostData = sortedDates.map(d => dateMap.get(d)!.lost);
      let netData = sortedDates.map(d => dateMap.get(d)!.net);

      // Apply timeframe reduction
      if (timeframe === 'weekly') {
        // Simple mock grouping into 4 weekly chunks
        labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
        const chunk = Math.ceil(sortedDates.length / 4);
        gainedData = [];
        lostData = [];
        netData = [];
        for (let i = 0; i < 4; i++) {
          let gSum = 0, lSum = 0;
          for (let j = i * chunk; j < Math.min((i + 1) * chunk, sortedDates.length); j++) {
            const val = dateMap.get(sortedDates[j]);
            if (val) {
              gSum += val.gained;
              lSum += val.lost;
            }
          }
          gainedData.push(gSum);
          lostData.push(lSum);
          netData.push(gSum - lSum);
        }
      } else if (timeframe === 'monthly') {
        // Group into monthly total
        labels = ['This Month'];
        gainedData = [gainedData.reduce((a, b) => a + b, 0)];
        lostData = [lostData.reduce((a, b) => a + b, 0)];
        netData = [netData.reduce((a, b) => a + b, 0)];
      }

      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        chartInstance.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [
              {
                label: 'Followers Gained',
                data: gainedData,
                borderColor: '#10b981', // Emerald
                backgroundColor: 'rgba(16, 185, 129, 0.05)',
                tension: 0.3,
                fill: true,
                borderWidth: 2
              },
              {
                label: 'Followers Lost',
                data: lostData,
                borderColor: '#ef4444', // Red
                backgroundColor: 'rgba(239, 68, 68, 0.05)',
                tension: 0.3,
                fill: true,
                borderWidth: 2
              },
              {
                label: 'Net Growth',
                data: netData,
                borderColor: '#3b82f6', // Blue
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.3,
                fill: false,
                borderWidth: 3,
                borderDash: [5, 5]
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                labels: { color: legendColor, font: { family: 'inherit', size: 12 } }
              }
            },
            scales: {
              x: {
                grid: { color: gridColor },
                ticks: { color: tickColor, font: { family: 'inherit' } }
              },
              y: {
                grid: { color: gridColor },
                ticks: { color: tickColor, font: { family: 'inherit' } }
              }
            }
          }
        });
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [analytics, timeframe, selectedPlatform, theme, loading]);

  return (
    <DashboardLayout>
      <div className="w-full space-y-6 mis-animate-in">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
              Social Media <span className="mis-page-title-accent">Analytics</span>
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Track followers, likes, comments, and engagement curves.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Platform Select */}
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="mis-input py-2 px-3 text-sm rounded-lg"
              style={{ width: 'auto' }}
            >
              <option value="all">All Platforms</option>
              <option value="Instagram">Instagram</option>
              <option value="YouTube">YouTube</option>
              <option value="TikTok">TikTok</option>
            </select>

            {/* Timeframe Select */}
            <div className="flex bg-slate-900 border border-slate-700/50 rounded-lg p-0.5">
              {(['daily', 'weekly', 'monthly'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTimeframe(t)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md capitalize transition ${
                    timeframe === t ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="w-full flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--accent)' }} />
          </div>
        ) : analytics.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center border border-slate-700/40">
            <span className="text-4xl block mb-3">📊</span>
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>No Analytics Found</h3>
            <p className="text-sm max-w-sm mx-auto mt-1" style={{ color: 'var(--text-secondary)' }}>
              Please execute the migrations in `database_social_media.sql` to initialize the tables, and seed data using `seed-analytics.ts`.
            </p>
          </div>
        ) : (
          <>
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="glass rounded-[var(--radius-xl)] p-5 border border-slate-700/20">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Followers Gained</span>
                <span className="text-3xl font-black block mt-2 text-emerald-400">+{metrics.gained}</span>
              </div>
              <div className="glass rounded-[var(--radius-xl)] p-5 border border-slate-700/20">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Followers Lost</span>
                <span className="text-3xl font-black block mt-2 text-red-400">-{metrics.lost}</span>
              </div>
              <div className="glass rounded-[var(--radius-xl)] p-5 border border-slate-700/20">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Net Growth</span>
                <span className={`text-3xl font-black block mt-2 ${metrics.net >= 0 ? 'text-sky-400' : 'text-rose-400'}`}>
                  {metrics.net >= 0 ? '+' : ''}{metrics.net}
                </span>
              </div>
              <div className="glass rounded-[var(--radius-xl)] p-5 border border-slate-700/20">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Engagement Rate</span>
                <span className="text-3xl font-black block mt-2 text-purple-400">{metrics.engagement}</span>
              </div>
            </div>

            {/* Line Chart Workspace */}
            <div className="glass rounded-2xl p-5 border border-slate-700/20">
              <h3 className="text-md font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Follower Trend Curve</h3>
              <div className="h-[420px] w-full relative">
                <canvas ref={canvasRef} />
              </div>
            </div>

            {/* Extra summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass rounded-[var(--radius-xl)] p-5 space-y-2">
                <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Total Reach / Impressions</h4>
                <p className="text-4xl font-black" style={{ color: 'var(--text-primary)' }}>
                  {metrics.impressions.toLocaleString('en-IN')}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Aggregated counts across selected social platform streams.
                </p>
              </div>

              <div className="glass rounded-[var(--radius-xl)] p-5 space-y-2">
                <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Engagement Likes Summary</h4>
                <p className="text-4xl font-black" style={{ color: 'var(--text-primary)' }}>
                  {metrics.likes.toLocaleString('en-IN')}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Aggregated reactions, retweets, likes, and platform hearts.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SMMDashboard;
