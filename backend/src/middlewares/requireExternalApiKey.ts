import type { Request, Response, NextFunction } from 'express';
import { HttpStatus } from '../utils/httpStatus.js';

/**
 * Gates the /external/* routes — these are called server-to-server by n8n,
 * not from a browser session, so there's no cookie/JWT to check. A single
 * shared secret in the X-API-Key header stands in for that. This is
 * deliberately a *separate* trust mechanism from requireAuth/requireAdmin —
 * a leaked API key only ever reaches the /external surface, never the rest
 * of the app, and vice versa a stolen session cookie can't call these routes.
 */
export const requireExternalApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const expected = process.env.EXTERNAL_TASK_API_KEY;

  if (!expected) {
    // Fail closed: an unconfigured secret must never mean "let everyone in".
    console.error('[requireExternalApiKey] EXTERNAL_TASK_API_KEY is not set — refusing all external task requests.');
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'External task API is not configured.' });
    return;
  }

  const provided = req.header('X-API-Key');
  if (!provided || provided !== expected) {
    res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Invalid or missing API key.' });
    return;
  }

  next();
};
