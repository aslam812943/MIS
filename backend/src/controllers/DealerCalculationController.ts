import type { Request, Response } from 'express';
import { DealerCalculationService } from '../services/DealerCalculationService.js';

const service = new DealerCalculationService();

function sendDealerError(res: Response, error: unknown, fallback: string) {
  const err = error as { code?: string; message?: string; errors?: Array<{ code?: string }> };
  const transientCodes = new Set(['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'ENETUNREACH', 'EHOSTUNREACH', '57P01', '57P02', '57P03']);
  const transient = transientCodes.has(err?.code || '') || err?.errors?.some(item => transientCodes.has(item.code || ''));
  if (transient) {
    res.status(503).json({ error: 'Dealer database is temporarily unavailable. Please wait a moment and retry.' });
    return;
  }
  console.error(fallback, error);
  res.status(500).json({ error: fallback });
}

function getUserContext(req: Request) {
  const user = (req as any).user;
  const role = user?.role || '';
  const username = user?.login_username || user?.username || user?.email?.split('@')[0] || 'admin';
  const isGlobalAdmin = ['admin', 'ceo', 'managing_director', 'director', 'executive'].includes(role);
  const isDealerAdmin = user?.dealer_role === 'ADMIN' || username.toLowerCase() === 'admin';
  const isAdmin = isGlobalAdmin || isDealerAdmin;
  const userId = user?.id || 'sys_' + Date.now();
  return { user, role, isAdmin, username, userId };
}

export class DealerCalculationController {
  async getDailyClient(req: Request, res: Response) {
    try {
      const { code } = req.params;
      const data = await service.getDailyClient(String(code || ""));
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch client records' });
    }
  }
  async getMaster(req: Request, res: Response) {
    try {
      const { username, isAdmin } = getUserContext(req);
      const data = await service.getMasterClients(username, isAdmin);
      res.json(data);
    } catch (err: any) {
      sendDealerError(res, err, 'Failed to fetch master clients. Please retry.');
    }
  }

  async replaceMaster(req: Request, res: Response) {
    try {
      const { isAdmin, userId, username } = getUserContext(req);
      if (!isAdmin) return res.status(403).json({ error: 'Admin permission required' });
      const records = req.body;
      if (!Array.isArray(records)) return res.status(400).json({ error: 'Array of records expected' });
      const result = await service.replaceMasterClients(records, { id: userId, username });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to replace master clients' });
    }
  }

  async bulkUploadMaster(req: Request, res: Response) {
    try {
      const { isAdmin, userId, username } = getUserContext(req);
      if (!isAdmin) return res.status(403).json({ error: 'Admin permission required' });
      const { fileName, records } = req.body;
      if (!Array.isArray(records)) return res.status(400).json({ error: 'Array of records expected' });
      const result = await service.bulkUploadMasterClients({ fileName: fileName || 'upload.xlsx', records }, { id: userId, username });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to bulk upload master clients' });
    }
  }

  async rollbackMaster(req: Request, res: Response) {
    try {
      const { isAdmin, userId, username } = getUserContext(req);
      if (!isAdmin) return res.status(403).json({ error: 'Admin permission required' });
      const { uploadId } = req.body;
      if (!uploadId) return res.status(400).json({ error: 'uploadId is required' });
      const result = await service.rollbackClientUpload(uploadId, { id: userId, username });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to rollback master upload' });
    }
  }

  async getRecentUploads(req: Request, res: Response) {
    try {
      const { isAdmin } = getUserContext(req);
      if (!isAdmin) return res.status(403).json({ error: 'Admin permission required' });
      const limit = Number(req.query.limit) || 20;
      const data = await service.getRecentClientUploads(limit);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch recent uploads' });
    }
  }

  async getAddedDates(req: Request, res: Response) {
    try {
      const data = await service.getClientAddedDates();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch added dates' });
    }
  }

  async getAddedDateClients(req: Request, res: Response) {
    try {
      const date = req.params.date as string;
      const data = await service.getClientsAddedOnDate(date);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch clients for added date' });
    }
  }

  async getDealers(_req: Request, res: Response) {
    try {
      const data = await service.getDealers();
      res.json(data);
    } catch (err: any) {
      sendDealerError(res, err, 'Failed to fetch dealers. Please retry.');
    }
  }

  async replaceDealers(req: Request, res: Response) {
    try {
      const { isAdmin, userId, username } = getUserContext(req);
      if (!isAdmin) return res.status(403).json({ error: 'Admin permission required' });
      const dealers = req.body;
      if (!Array.isArray(dealers)) return res.status(400).json({ error: 'Array of dealer names expected' });
      const result = await service.replaceDealers(dealers, { id: userId, username });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to replace dealers' });
    }
  }

  async getRms(_req: Request, res: Response) {
    try {
      const data = await service.getRms();
      res.json(data);
    } catch (err: any) {
      sendDealerError(res, err, 'Failed to fetch RMs. Please retry.');
    }
  }

  async replaceRms(req: Request, res: Response) {
    try {
      const { isAdmin, userId, username } = getUserContext(req);
      if (!isAdmin) return res.status(403).json({ error: 'Admin permission required' });
      const rms = req.body;
      if (!Array.isArray(rms)) return res.status(400).json({ error: 'Array of RM names expected' });
      const result = await service.replaceRms(rms, { id: userId, username });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to replace RMs' });
    }
  }

  async getTargets(req: Request, res: Response) {
    try {
      const { username, isAdmin } = getUserContext(req);
      const data = await service.getTargets(username, isAdmin);
      res.json(data);
    } catch (err: any) {
      sendDealerError(res, err, 'Failed to fetch targets. Please retry.');
    }
  }

  async updateTargets(req: Request, res: Response) {
    try {
      const { isAdmin, userId, username } = getUserContext(req);
      if (!isAdmin) return res.status(403).json({ error: 'Admin permission required' });
      const result = await service.updateTargets(req.body, { id: userId, username });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update targets' });
    }
  }

  async getDaily(req: Request, res: Response) {
    try {
      const { username, isAdmin } = getUserContext(req);
      const { from, to } = req.query as { from?: string; to?: string };
      const data = await service.getDaily(from, to, username, isAdmin);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch daily records' });
    }
  }

  async getDailyDates(_req: Request, res: Response) {
    try {
      const data = await service.getDailyDates();
      res.json(data);
    } catch (err: any) {
      sendDealerError(res, err, 'Failed to fetch upload history. Please retry.');
    }
  }

  async getDailyByDate(req: Request, res: Response) {
    try {
      const date = req.params.date as string;
      const { username, isAdmin } = getUserContext(req);
      const source = req.query.source as string | undefined;
      const data = await service.getDailyByDate(date, source, username, isAdmin);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch daily records for date' });
    }
  }

  async upsertDaily(req: Request, res: Response) {
    try {
      const { isAdmin, userId, username } = getUserContext(req);
      if (!isAdmin) return res.status(403).json({ error: 'Admin permission required' });
      const date = req.params.date as string;
      const records = req.body;
      if (!Array.isArray(records)) return res.status(400).json({ error: 'Array of records expected' });
      const result = await service.upsertDailyRecords(date, records, { id: userId, username });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to upsert daily records' });
    }
  }

  async deleteDaily(req: Request, res: Response) {
    try {
      const { isAdmin, userId, username } = getUserContext(req);
      if (!isAdmin) return res.status(403).json({ error: 'Admin permission required' });
      const date = req.params.date as string;
      const source = req.query.source as string | undefined;
      const result = await service.deleteDailyRecords(date, source, { id: userId, username });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete daily records' });
    }
  }

  async getDebit(req: Request, res: Response) {
    try {
      const { username, isAdmin } = getUserContext(req);
      const { from, to } = req.query as { from?: string; to?: string };
      const data = await service.getDebit(from, to, username, isAdmin);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch debit records' });
    }
  }

  async getDebitDates(_req: Request, res: Response) {
    try {
      const data = await service.getDebitDates();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch debit dates' });
    }
  }

  async getDebitByDate(req: Request, res: Response) {
    try {
      const date = req.params.date as string;
      const { username, isAdmin } = getUserContext(req);
      const data = await service.getDebitByDate(date, username, isAdmin);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch debit records for date' });
    }
  }

  async upsertDebit(req: Request, res: Response) {
    try {
      const { isAdmin, userId, username } = getUserContext(req);
      if (!isAdmin) return res.status(403).json({ error: 'Admin permission required' });
      const date = req.params.date as string;
      const records = req.body;
      if (!Array.isArray(records)) return res.status(400).json({ error: 'Array of records expected' });
      const result = await service.upsertDebitRecords(date, records, { id: userId, username });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to upsert debit records' });
    }
  }

  async deleteDebit(req: Request, res: Response) {
    try {
      const { isAdmin, userId, username } = getUserContext(req);
      if (!isAdmin) return res.status(403).json({ error: 'Admin permission required' });
      const date = req.params.date as string;
      const result = await service.deleteDebitRecords(date, { id: userId, username });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete debit records' });
    }
  }

  async getDebitLatest(req: Request, res: Response) {
    try {
      const { username, isAdmin } = getUserContext(req);
      const data = await service.getDebitLatest(username, isAdmin);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch latest debit' });
    }
  }

  async getDashboardSummary(req: Request, res: Response) {
    try {
      const period = (req.query.period as string) || 'month';
      const { username, isAdmin } = getUserContext(req);
      const data = await service.getDashboardSummary(period, username, isAdmin);
      res.json(data);
    } catch (err: any) {
      sendDealerError(res, err, 'Failed to fetch dealer dashboard. Please retry.');
    }
  }

  async getMisSummary(req: Request, res: Response) {
    try {
      const { username, isAdmin } = getUserContext(req);
      const data = await service.getMisSummary(username, isAdmin);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch MIS summary' });
    }
  }

  async getReportsDealers(req: Request, res: Response) {
    try {
      const { period, from, to, dealer, rm } = req.query as { period?: string; from?: string; to?: string; dealer?: string; rm?: string };
      const { username, isAdmin } = getUserContext(req);
      const data = await service.getReportsDealers(period, from, to, dealer, rm, username, isAdmin);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch dealer reports' });
    }
  }

  async getRmsSummary(req: Request, res: Response) {
    try {
      const { period, from, to, rm } = req.query as { period?: string; from?: string; to?: string; rm?: string };
      const { username, isAdmin } = getUserContext(req);
      const data = await service.getRmsSummary(period, from, to, rm, username, isAdmin);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch RM summary' });
    }
  }

  async getBrokerageByClient(req: Request, res: Response) {
    try {
      const { period, from, to, dealer, rm } = req.query as { period?: string; from?: string; to?: string; dealer?: string; rm?: string };
      const { username, isAdmin } = getUserContext(req);
      const data = await service.getBrokerageByClient(period, from, to, dealer, rm, username, isAdmin);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch client brokerage' });
    }
  }

  async getTasks(req: Request, res: Response) {
    try {
      const { dealer, month } = req.query as { dealer?: string; month?: string };
      if (!dealer || !month) return res.status(400).json({ error: 'dealer and month parameters required' });
      const data = await service.getTasks(dealer, month);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch tasks' });
    }
  }

  async upsertTask(req: Request, res: Response) {
    try {
      const { dealer, month, slot, text, done } = req.body;
      if (!dealer || !month || slot === undefined) return res.status(400).json({ error: 'dealer, month, slot required' });
      const result = await service.upsertTask(dealer, month, Number(slot), text || '', Boolean(done));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to upsert task' });
    }
  }

  async getHolidays(_req: Request, res: Response) {
    try {
      const data = await service.getHolidays();
      res.json(data);
    } catch (err: any) {
      sendDealerError(res, err, 'Failed to fetch trading calendar. Please retry.');
    }
  }

  async replaceHolidays(req: Request, res: Response) {
    try {
      const { isAdmin } = getUserContext(req);
      if (!isAdmin) return res.status(403).json({ error: 'Admin permission required' });
      const holidays = req.body;
      if (!Array.isArray(holidays)) return res.status(400).json({ error: 'Array of holidays expected' });
      const result = await service.replaceHolidays(holidays);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to replace holidays' });
    }
  }

  async getUsers(req: Request, res: Response) {
    try {
      const { isAdmin } = getUserContext(req);
      if (!isAdmin) return res.status(403).json({ error: 'Admin permission required' });
      const data = await service.getUsers();
      res.json(data);
    } catch (err: any) {
      sendDealerError(res, err, 'Failed to fetch Dealer Terminal users. Please retry.');
    }
  }

  async createUser(req: Request, res: Response) {
    try {
      const { isAdmin, userId, username } = getUserContext(req);
      if (!isAdmin) return res.status(403).json({ error: 'Admin permission required' });
      const { username: newUsername, password, role } = req.body;
      if (!newUsername || !password) return res.status(400).json({ error: 'Username and password required' });
      const result = await service.createUser(newUsername, password, role || 'VIEWER', { id: userId, username });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create dealer user' });
    }
  }

  async deleteUser(req: Request, res: Response) {
    try {
      const { isAdmin, userId, username } = getUserContext(req);
      if (!isAdmin) return res.status(403).json({ error: 'Admin permission required' });
      const id = req.params.id as string;
      const result = await service.deleteUser(id, { id: userId, username });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete user' });
    }
  }

  async changePassword(req: Request, res: Response) {
    try {
      const { userId } = getUserContext(req);
      const { id, oldPassword, newPassword } = req.body;
      const targetId = id || userId;
      if (!newPassword) return res.status(400).json({ error: 'New password required' });
      const result = await service.changePassword(targetId, newPassword);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to change password' });
    }
  }

  async getViewerScope(req: Request, res: Response) {
    try {
      const { username } = getUserContext(req);
      const scope = await service.resolveViewerScope(username);
      res.json(scope);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to resolve viewer scope' });
    }
  }
}
