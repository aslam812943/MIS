import { supabase, supabaseAdmin } from '../config/supabase.js';

const SCRUBBED_PROPERTIES = ['password', 'token', 'otp'];

/**
 * Recursively scrubs sensitive parameters (like passwords, keys, and OTPs)
 * from JSON logging payloads to maintain security compliance.
 */
function scrubSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  // Create a deep copy to prevent mutating the original objects
  const scrubbed = JSON.parse(JSON.stringify(obj));
  
  for (const key of Object.keys(scrubbed)) {
    if (SCRUBBED_PROPERTIES.includes(key.toLowerCase())) {
      scrubbed[key] = '[SCRUBBED_FOR_SECURITY]';
    } else if (typeof scrubbed[key] === 'object') {
      scrubbed[key] = scrubSensitiveData(scrubbed[key]);
    }
  }
  return scrubbed;
}

/**
 * Centralized utility to log system activity asynchronously.
 * If the log operation fails, it will output a console warning but will NOT
 * interrupt or throw in the parent Express request pipeline.
 */
export const logAudit = async (
  req: any,
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  tableName: string,
  recordId: string | undefined,
  oldData: any,
  newData: any
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) return; // Skip logging if there is no authenticated actor

    const cleanOld = oldData ? scrubSensitiveData(oldData) : null;
    const cleanNew = newData ? scrubSensitiveData(newData) : null;

    const client = supabaseAdmin || supabase;

    // Trigger asynchronously so the client request isn't blocked by writing logs
    client.from('audit_logs').insert([
      {
        table_name: tableName,
        record_id: recordId,
        action,
        old_data: cleanOld,
        new_data: cleanNew,
        user_id: user.id,
        user_email: user.email,
        user_role: user.role
      }
    ]).then(({ error }) => {
      if (error) {
        console.error(`[AUDIT LOG FAILURE] Failed to write database audit log: ${error.message}`);
      }
    });
  } catch (err) {
    console.warn('[AUDIT LOG WARNING] Gracefully caught audit logging utility exception:', err);
  }
};
