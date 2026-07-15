import app from './app.js';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { supabase, supabaseAdmin } from './config/supabase.js';
import { notificationService } from './routes/protectedRoutes.js';

dotenv.config();

const client = supabaseAdmin || supabase;
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`🚀 MIS Backend running on port ${PORT}`);

  // Supabase Initialization
  try {
    const { error } = await client.from('profiles').select('id').limit(1);
    if (!error || error.code === 'PGRST116') {
      console.log('✅ Supabase Connection: Active');
      
      const { data: buckets } = await client.storage.listBuckets();
      if (!buckets?.find(b => b.name === 'avatars')) {
        await client.storage.createBucket('avatars', { 
          public: true,
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif'],
          fileSizeLimit: 2 * 1024 * 1024 
        });
        console.log('📦 Storage Bucket avatars: Initialized');
      }
      if (!buckets?.find(b => b.name === 'kyc-documents')) {
        await client.storage.createBucket('kyc-documents', { 
          public: true,
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'],
          fileSizeLimit: 5 * 1024 * 1024 
        });
        console.log('📦 Storage Bucket kyc-documents: Initialized');
      }
      if (!buckets?.find(b => b.name === 'it-documents')) {
        await client.storage.createBucket('it-documents', {
          public: true,
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'],
          fileSizeLimit: 5 * 1024 * 1024
        });
        console.log('📦 Storage Bucket it-documents: Initialized');
      }
    }
  } catch (err) {
    console.error('❌ Initialization failed:', err);
  }

  // Notification scan: once shortly after boot (so a fresh deploy doesn't
  // wait until the next scheduled run), then daily at 08:00 server time.
  runNotificationCheck('startup');
  cron.schedule('0 8 * * *', () => runNotificationCheck('scheduled'));
});

async function runNotificationCheck(trigger: 'startup' | 'scheduled') {
  try {
    const result = await notificationService.runDueItemCheck();
    console.log(`🔔 Notification check (${trigger}): ${result.itemsFound} items found, ${result.notificationsCreated} new notifications, ${result.usersEmailed} users emailed.`);
  } catch (err) {
    console.error(`❌ Notification check (${trigger}) failed:`, err);
  }
}
