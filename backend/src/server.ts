import app from './app.js';
import dotenv from 'dotenv';
import { supabase, supabaseAdmin } from './config/supabase.js';

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
    }
  } catch (err) {
    console.error('❌ Initialization failed:', err);
  }
});
