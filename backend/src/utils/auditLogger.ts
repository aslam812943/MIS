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

interface AuthEventUser {
  id: string;
  email: string;
  role: string;
}

/**
 * Best-effort client IP resolution — prefers the first hop in
 * X-Forwarded-For (set by a reverse proxy/load balancer) and falls back to
 * Express's own req.ip.
 */
function getClientIp(req: any): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0]?.trim() || 'Unknown';
  return req.ip || req.connection?.remoteAddress || 'Unknown';
}

/**
 * Logs a successful login as an 'auth_sessions' audit row. Unlike logAudit(),
 * this doesn't depend on requireAuth having populated req.user — login is
 * the moment that identity is established, so the caller passes it in
 * directly from the freshly-authenticated user.
 */
export const logLoginEvent = (req: any, user: AuthEventUser): void => {
  try {
    const client = supabaseAdmin || supabase;
    client.from('audit_logs').insert([
      {
        table_name: 'auth_sessions',
        record_id: user.id,
        action: 'LOGIN',
        old_data: null,
        new_data: {
          ip: getClientIp(req),
          user_agent: req.headers?.['user-agent'] || 'Unknown'
        },
        user_id: user.id,
        user_email: user.email,
        user_role: user.role
      }
    ]).then(({ error }: { error: any }) => {
      if (error) {
        console.error(`[AUDIT LOG FAILURE] Failed to write login audit log: ${error.message}`);
      }
    });
  } catch (err) {
    console.warn('[AUDIT LOG WARNING] Gracefully caught login logging exception:', err);
  }
};

/**
 * Logs a logout as an 'auth_sessions' audit row, including how long the
 * session lasted. Session duration is approximated as the time since this
 * user's most recent LOGIN row — the JWT is stateless (no server-side
 * session id), so this is the only signal available. If the browser is
 * closed instead of using the Sign Out button, no LOGOUT row is written and
 * the session simply has no matching logout — visible in the log as a LOGIN
 * with nothing paired to it.
 */
export const logLogoutEvent = async (req: any, user: AuthEventUser): Promise<void> => {
  try {
    const client = supabaseAdmin || supabase;

    const { data: lastLogin } = await client
      .from('audit_logs')
      .select('created_at')
      .eq('user_id', user.id)
      .eq('action', 'LOGIN')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const durationSeconds = lastLogin?.created_at
      ? Math.max(0, Math.round((Date.now() - new Date(lastLogin.created_at).getTime()) / 1000))
      : null;

    client.from('audit_logs').insert([
      {
        table_name: 'auth_sessions',
        record_id: user.id,
        action: 'LOGOUT',
        old_data: null,
        new_data: {
          ip: getClientIp(req),
          user_agent: req.headers?.['user-agent'] || 'Unknown',
          duration_seconds: durationSeconds
        },
        user_id: user.id,
        user_email: user.email,
        user_role: user.role
      }
    ]).then(({ error }: { error: any }) => {
      if (error) {
        console.error(`[AUDIT LOG FAILURE] Failed to write logout audit log: ${error.message}`);
      }
    });
  } catch (err) {
    console.warn('[AUDIT LOG WARNING] Gracefully caught logout logging exception:', err);
  }
};
