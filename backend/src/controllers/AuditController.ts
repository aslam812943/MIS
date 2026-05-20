import type { Request, Response } from 'express';
import { SupabaseAuditRepository } from '../repositories/SupabaseAuditRepository.js';
import { HttpStatus } from '../utils/httpStatus.js';

const auditRepository = new SupabaseAuditRepository();

/**
 * Controller to handle query requests for system audit log logs.
 * Restricted to administrators only.
 */
export class AuditController {
  getAuditLogs = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tableName, action, userEmail, startDate, endDate, limit, offset } = req.query;

      const filters: Record<string, any> = {
        limit: limit ? parseInt(limit as string, 10) : 50,
        offset: offset ? parseInt(offset as string, 10) : 0,
      };
      if (tableName) filters.tableName = tableName as string;
      if (action) filters.action = action as string;
      if (userEmail) filters.userEmail = userEmail as string;
      if (startDate) filters.startDate = startDate as string;
      if (endDate) filters.endDate = endDate as string;

      const result = await auditRepository.findFiltered(filters);
      res.status(HttpStatus.OK).json(result);
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Failed to fetch audit logs';
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message });
    }
  };
}
