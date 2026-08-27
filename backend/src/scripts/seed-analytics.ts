import { supabaseAdmin } from '../config/supabase.js';

async function seedAnalytics() {
  const client = supabaseAdmin;
  if (!client) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY is required to seed the database.');
    return;
  }

  console.log('🏁 Starting Social Media Analytics seeding (30 Days trend)...');

  const platforms = ['Instagram', 'YouTube', 'TikTok'] as const;
  const today = new Date();
  const records: any[] = [];

  for (let i = 29; i >= 0; i--) {
    const currentDate = new Date();
    currentDate.setDate(today.getDate() - i);
    const dateStr = currentDate.toISOString().split('T')[0];

    // Platforms seed data simulation
    platforms.forEach(platform => {
      let baseGained = 0;
      let baseLost = 0;
      let baseLikes = 0;
      let baseComments = 0;
      let baseShares = 0;
      let baseImpressions = 0;

      const angle = (29 - i) * 0.4; // smooth wave for trend charts

      if (platform === 'Instagram') {
        baseGained = 200 + Math.floor(Math.sin(angle) * 60) + Math.floor(Math.random() * 20);
        baseLost = 60 + Math.floor(Math.cos(angle) * 15) + Math.floor(Math.random() * 8);
        baseLikes = 1200 + Math.floor(Math.sin(angle) * 300) + Math.floor(Math.random() * 100);
        baseComments = 80 + Math.floor(Math.random() * 30);
        baseShares = 140 + Math.floor(Math.random() * 40);
        baseImpressions = 15000 + Math.floor(Math.sin(angle) * 3000) + Math.floor(Math.random() * 1000);
      } else if (platform === 'YouTube') {
        baseGained = 450 + Math.floor(Math.sin(angle * 1.2) * 120) + Math.floor(Math.random() * 40);
        baseLost = 100 + Math.floor(Math.cos(angle) * 20) + Math.floor(Math.random() * 12);
        baseLikes = 3200 + Math.floor(Math.sin(angle) * 800) + Math.floor(Math.random() * 200);
        baseComments = 240 + Math.floor(Math.random() * 60);
        baseShares = 380 + Math.floor(Math.random() * 80);
        baseImpressions = 45000 + Math.floor(Math.sin(angle) * 8000) + Math.floor(Math.random() * 2000);
      } else if (platform === 'TikTok') {
        baseGained = 850 + Math.floor(Math.sin(angle * 0.8) * 250) + Math.floor(Math.random() * 80);
        baseLost = 280 + Math.floor(Math.cos(angle * 1.5) * 60) + Math.floor(Math.random() * 30);
        baseLikes = 9500 + Math.floor(Math.sin(angle) * 2500) + Math.floor(Math.random() * 600);
        baseComments = 750 + Math.floor(Math.random() * 150);
        baseShares = 1100 + Math.floor(Math.random() * 250);
        baseImpressions = 85000 + Math.floor(Math.sin(angle) * 15000) + Math.floor(Math.random() * 5000);
      }

      records.push({
        date: dateStr,
        platform,
        followers_gained: baseGained,
        followers_lost: baseLost,
        likes_count: baseLikes,
        comments_count: baseComments,
        shares_count: baseShares,
        impressions_count: baseImpressions
      });
    });
  }

  try {
    // Insert/Upsert simulated analytics in batch
    const { error } = await client
      .from('social_media_analytics')
      .upsert(records, { onConflict: 'date,platform' });

    if (error) {
      throw error;
    }
    console.log('✅ Success! 30 Days of social media analytics seeded.');
  } catch (err: any) {
    console.error('❌ Seeding analytics failed:', err.message);
  }
}

seedAnalytics();
