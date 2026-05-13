import app from './app.js';
import dotenv from 'dotenv';
import { supabase } from './config/supabase.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Quick Supabase Health Check
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    if (error && error.message !== 'JSON object requested, multiple (or no) rows returned') {
       // We ignore empty table errors, as that still means it's connected
       if (error.code === 'PGRST116') {
         console.log('✅ Supabase connected successfully');
       } else {
         console.log('⚠️  Supabase reachable but check returned:', error.message);
       }
    } else {
       console.log('✅ Supabase connected successfully');
    }
  } catch (err) {
    console.error('❌ Supabase connection check failed:', err);
  }
});
