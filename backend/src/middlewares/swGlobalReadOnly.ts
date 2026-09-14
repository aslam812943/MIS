import type { Request, Response, NextFunction } from 'express';

export function swGlobalReadOnly(req: Request, res: Response, next: NextFunction): void {
  const role = (req as any).user?.role;
  if (['admin', 'ceo'].includes(role) && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    res.status(403).json({ error: 'SW Global is read-only for Admin and CEO accounts.' });
    return;
  }
  next();
}
