import bcrypt from 'bcryptjs';
import { dealerPool } from '../config/dealerDb.js';

const normCode = (c: string) => String(c || '').trim().toUpperCase().replace(/\s+/g, '');

function isoDate(y: number, m0: number, d: number) {
  return `${y}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function getWeekStart(latestDate: string): string {
  const parts = latestDate.split('-').map(Number);
  const y = parts[0] ?? 2026;
  const m0 = (parts[1] ?? 1) - 1;
  const d = parts[2] ?? 1;
  const dt = new Date(y, m0, d);
  const dow = dt.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = (dow === 0 ? -6 : 1) - dow;
  const mon = new Date(dt);
  mon.setDate(dt.getDate() + diff);
  return isoDate(mon.getFullYear(), mon.getMonth(), mon.getDate());
}

function tradingDaysInMonth(year: number, month0: number, holidaySet: Set<string>, throughDay?: number): number {
  const daysInMonth = throughDay ?? new Date(year, month0 + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month0, d).getDay();
    if (dow === 0 || dow === 6) continue;
    if (holidaySet.has(isoDate(year, month0, d))) continue;
    count++;
  }
  return count;
}

function caseInsensitiveGet(obj: Record<string, any> | null | undefined, key: string): any {
  if (!obj) return undefined;
  const matchKey = Object.keys(obj).find((k) => k.toLowerCase() === key.toLowerCase());
  return matchKey ? obj[matchKey] : undefined;
}

function buildPersonSummary(
  name: string,
  aggByPerson: Record<string, any>,
  mappedByPerson: Record<string, number>,
  tradingDays: number,
  tradingDaysSoFar: number,
  dealerSalary: Record<string, any>,
  incentiveMultiplier: number
) {
  const agg = aggByPerson[name.toLowerCase()];
  const clientsMapped = Number(caseInsensitiveGet(mappedByPerson, name)) || 0;
  const mtdRevenue = agg?.mtd || 0;
  const rawSalary = Number(caseInsensitiveGet(dealerSalary, name));
  const hasSalary = !isNaN(rawSalary) && rawSalary > 0;
  const multiplier = hasSalary ? mtdRevenue / rawSalary : null;
  const eligible = Boolean(hasSalary && multiplier !== null && multiplier >= incentiveMultiplier);
  const target = hasSalary ? rawSalary * incentiveMultiplier : 0;
  const dailyTarget = tradingDays > 0 ? target / tradingDays : 0;
  const dailyAchieved = tradingDaysSoFar > 0 ? mtdRevenue / tradingDaysSoFar : 0;
  const dailyShortfall = hasSalary ? Math.max(0, dailyTarget - dailyAchieved) : null;
  const shortfall = hasSalary && target > mtdRevenue ? target - mtdRevenue : 0;
  const daysRemaining = Math.max(0, tradingDays - tradingDaysSoFar);
  const requiredPace = daysRemaining > 0 && target > mtdRevenue ? (target - mtdRevenue) / daysRemaining : 0;

  return {
    dealer: name,
    name,
    target,
    dailyTarget,
    tradingDaysInMonth: tradingDays,
    tradingDaysSoFar,
    mtdRevenue,
    dailyAvgAchieved: dailyAchieved,
    dailyAchieved,
    dailyShortfall: dailyShortfall || 0,
    requiredDailyPace: requiredPace,
    remainingShortfall: shortfall,
    requiredPace,
    shortfall,
    yesterdayRevenue: agg?.yesterday || 0,
    clientsMapped,
    totalClients: clientsMapped,
    tradedClientsCount: agg?.tradedCount || 0,
    tradedClients: agg?.tradedClients || [],
    dormantClientsCount: agg?.dormantCount || 0,
    dormantClients: agg?.dormantClients || [],
    salary: hasSalary ? rawSalary : null,
    monthlySalary: hasSalary ? rawSalary : null,
    incentiveMultiplier,
    multiplier: multiplier || 0,
    incentiveEligible: eligible,
    isEligible: eligible,
  };
}

export interface DealerUser {
  id: string;
  username: string;
  role: 'ADMIN' | 'VIEWER';
  mustChangePassword?: boolean;
}

export class DealerCalculationService {
  async authenticateUser(rawUsername: string, rawPassword: string): Promise<DealerUser | null> {
    const username = String(rawUsername || '').trim().toLowerCase();
    const password = String(rawPassword || '');
    if (!username || !password) return null;

    const res = await dealerPool.query('SELECT id, username, "passwordHash", role, "mustChangePassword" FROM "User" WHERE lower(username) = $1', [username]);
    if (!res.rows.length) return null;

    const row = res.rows[0];
    if (!row) return null;
    const valid = await bcrypt.compare(password, row.passwordHash);
    if (!valid) return null;

    return {
      id: row.id,
      username: row.username,
      role: row.role as 'ADMIN' | 'VIEWER',
      mustChangePassword: row.mustChangePassword,
    };
  }

  async changePassword(userId: string, newPassword: string): Promise<boolean> {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const res = await dealerPool.query('UPDATE "User" SET "passwordHash" = $1, "mustChangePassword" = false WHERE id = $2', [passwordHash, userId]);
    return (res.rowCount ?? 0) > 0;
  }

  async getUsers(): Promise<Array<{ id: string; username: string; role: string; mustChangePassword: boolean }>> {
    const res = await dealerPool.query('SELECT id, username, role, "mustChangePassword" FROM "User" ORDER BY username ASC');
    return res.rows;
  }

  async createUser(rawUsername: string, rawPassword: string, role: string = 'VIEWER', _actor?: { id: string; username: string }): Promise<{ id: string; username: string; role: string }> {
    const username = String(rawUsername || '').trim().toLowerCase();
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const id = 'usr_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
    await dealerPool.query(
      'INSERT INTO "User" (id, username, "passwordHash", role, "mustChangePassword", "createdAt") VALUES ($1, $2, $3, $4, false, NOW())',
      [id, username, passwordHash, role.toUpperCase()]
    );
    return { id, username, role: role.toUpperCase() };
  }

  async deleteUser(id: string, _actor?: { id: string; username: string }): Promise<boolean> {
    const res = await dealerPool.query('DELETE FROM "User" WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async resolveViewerScope(username: string) {
    const res = await dealerPool.query('SELECT code, "codeNorm", dealer, rm FROM "MasterClient" WHERE lower(dealer) = lower($1) OR lower(rm) = lower($1)', [username]);
    return {
      username,
      clientCount: res.rows.length,
      allowedCodes: res.rows.map((r: any) => r.code),
    };
  }

  async getDailyClient(code: string) {
    const codeNorm = normCode(code);
    const res = await dealerPool.query(
      `SELECT dr.date, dr.code, dr.name, dr."netBrok", dr.source, m.dealer, m.rm, m.branch
        FROM "DailyRecord" dr
        LEFT JOIN "MasterClient" m ON m."codeNorm" = dr."codeNorm"
        WHERE dr."codeNorm" = $1
        ORDER BY dr.date DESC`,
      [codeNorm]
    );
    return res.rows;
  }

  async getMasterClients(username?: string, isAdmin?: boolean) {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    if (!isAdmin && username) {
      params.push(username.trim().toLowerCase());
      conditions.push(`(lower(dealer) = $${params.length} OR lower(rm) = $${params.length})`);
    }
    const res = await dealerPool.query(`SELECT code, "codeNorm", name, rm, dealer, branch, "createdAt", "updatedAt" FROM "MasterClient" WHERE ${conditions.join(' AND ')} ORDER BY code ASC`, params);
    return res.rows;
  }

  async replaceMasterClients(records: Array<{ code: string; name?: string; rm?: string; dealer?: string; branch?: string }>, _actor?: { id: string; username: string }) {
    const client = await dealerPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM "MasterClient"');
      for (const r of records) {
        const code = String(r.code || '').trim();
        if (!code) continue;
        const codeNorm = normCode(code);
        await client.query(
          `INSERT INTO "MasterClient" (code, "codeNorm", name, rm, dealer, branch, "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [code, codeNorm, r.name || '', r.rm || '', r.dealer || '', r.branch || '']
        );
      }
      await client.query('COMMIT');
      return { ok: true, count: records.length };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async bulkUploadMasterClients(payload: { fileName: string; records: Array<{ code: string; name?: string; rm?: string; dealer?: string; branch?: string }> }, actor: { id: string; username: string }) {
    const client = await dealerPool.connect();
    try {
      await client.query('BEGIN');
      const uploadId = 'cu_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
      const changes: any[] = [];
      let createdCount = 0;
      let updatedCount = 0;

      for (const r of payload.records) {
        const code = String(r.code || '').trim();
        if (!code) continue;
        const codeNorm = normCode(code);
        const existingRes = await client.query('SELECT name, rm, dealer, branch FROM "MasterClient" WHERE code = $1', [code]);
        if (existingRes.rows.length > 0) {
          const prev = existingRes.rows[0];
          changes.push({ code, existed: true, prev });
          await client.query(
            `UPDATE "MasterClient" SET name = $1, rm = $2, dealer = $3, branch = $4, "updatedAt" = NOW() WHERE code = $5`,
            [r.name || prev.name || '', r.rm || prev.rm || '', r.dealer || prev.dealer || '', r.branch || prev.branch || '', code]
          );
          updatedCount++;
        } else {
          changes.push({ code, existed: false });
          await client.query(
            `INSERT INTO "MasterClient" (code, "codeNorm", name, rm, dealer, branch, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
            [code, codeNorm, r.name || '', r.rm || '', r.dealer || '', r.branch || '']
          );
          createdCount++;
        }
      }

      await client.query(
        `INSERT INTO "ClientUpload" (id, "createdAt", "fileName", "userId", username, "createdCount", "updatedCount", changes)
          VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7)`,
        [uploadId, payload.fileName, actor.id, actor.username, createdCount, updatedCount, JSON.stringify(changes)]
      );

      await client.query('COMMIT');
      return { ok: true, uploadId, createdCount, updatedCount };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async rollbackClientUpload(uploadId: string, _actor?: { id: string; username: string }) {
    const res = await dealerPool.query('SELECT changes FROM "ClientUpload" WHERE id = $1', [uploadId]);
    if (!res.rows.length) throw new Error('Upload record not found');
    const changes = res.rows[0].changes;
    if (!Array.isArray(changes)) throw new Error('Invalid changes data');

    const client = await dealerPool.connect();
    try {
      await client.query('BEGIN');
      for (const item of changes) {
        if (!item.existed) {
          await client.query('DELETE FROM "MasterClient" WHERE code = $1', [item.code]);
        } else if (item.prev) {
          await client.query(
            `UPDATE "MasterClient" SET name = $1, rm = $2, dealer = $3, branch = $4, "updatedAt" = NOW() WHERE code = $5`,
            [item.prev.name || '', item.prev.rm || '', item.prev.dealer || '', item.prev.branch || '', item.code]
          );
        }
      }
      await client.query('DELETE FROM "ClientUpload" WHERE id = $1', [uploadId]);
      await client.query('COMMIT');
      return { ok: true, undoneCount: changes.length };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getRecentClientUploads(limit: number = 20) {
    const res = await dealerPool.query('SELECT id, "createdAt", "fileName", username, "createdCount", "updatedCount" FROM "ClientUpload" ORDER BY "createdAt" DESC LIMIT $1', [limit]);
    return res.rows;
  }

  async getClientAddedDates() {
    const res = await dealerPool.query(`
      SELECT to_char("createdAt", 'YYYY-MM-DD') AS date, COUNT(*)::int AS count
      FROM "MasterClient"
      GROUP BY to_char("createdAt", 'YYYY-MM-DD')
      ORDER BY date DESC
    `);
    return res.rows;
  }

  async getClientsAddedOnDate(dateStr: string) {
    const res = await dealerPool.query(
      `SELECT code, name, rm, dealer, branch, "createdAt"
        FROM "MasterClient"
        WHERE to_char("createdAt", 'YYYY-MM-DD') = $1
        ORDER BY code ASC`,
      [dateStr]
    );
    return res.rows;
  }

  async getDealers(_username?: string, _isAdmin?: boolean) {
    const res = await dealerPool.query(`
      SELECT name FROM "Dealer"
      UNION
      SELECT dealer AS name FROM "MasterClient" WHERE dealer <> ''
      ORDER BY name ASC
    `);
    return res.rows.map((r: any) => r.name);
  }

  async replaceDealers(names: string[], _actor?: { id: string; username: string }) {
    const client = await dealerPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM "Dealer"');
      for (const name of names) {
        const n = String(name || '').trim();
        if (!n) continue;
        await client.query('INSERT INTO "Dealer" (name, "createdAt") VALUES ($1, NOW()) ON CONFLICT (name) DO NOTHING', [n]);
      }
      await client.query('COMMIT');
      return { ok: true, count: names.length };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getRms(_username?: string, _isAdmin?: boolean) {
    const res = await dealerPool.query(`
      SELECT name FROM "Rm"
      UNION
      SELECT rm AS name FROM "MasterClient" WHERE rm <> ''
      ORDER BY name ASC
    `);
    return res.rows.map((r: any) => r.name);
  }

  async replaceRms(names: string[], _actor?: { id: string; username: string }) {
    const client = await dealerPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM "Rm"');
      for (const name of names) {
        const n = String(name || '').trim();
        if (!n) continue;
        await client.query('INSERT INTO "Rm" (name, "createdAt") VALUES ($1, NOW()) ON CONFLICT (name) DO NOTHING', [n]);
      }
      await client.query('COMMIT');
      return { ok: true, count: names.length };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getTargets(_username?: string, _isAdmin?: boolean) {
    const res = await dealerPool.query('SELECT "monthly", "dealerMonthly", "kotakSharePct", "rmSplitPct", "dealerSalary", "incentiveMultiplier" FROM "Targets" WHERE id = 1');
    if (res.rows.length) return res.rows[0];
    return {
      monthly: 0,
      dealerMonthly: {},
      kotakSharePct: 85,
      rmSplitPct: 50,
      dealerSalary: {},
      incentiveMultiplier: 10,
    };
  }

  async updateTargets(targets: {
    monthly?: number;
    dealerMonthly?: Record<string, number>;
    kotakSharePct?: number;
    rmSplitPct?: number;
    dealerSalary?: Record<string, number>;
    incentiveMultiplier?: number;
  }, _actor?: { id: string; username: string }) {
    const res = await dealerPool.query(
      `INSERT INTO "Targets" (id, monthly, "dealerMonthly", "kotakSharePct", "rmSplitPct", "dealerSalary", "incentiveMultiplier")
        VALUES (1, $1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          monthly = EXCLUDED.monthly,
          "dealerMonthly" = EXCLUDED."dealerMonthly",
          "kotakSharePct" = EXCLUDED."kotakSharePct",
          "rmSplitPct" = EXCLUDED."rmSplitPct",
          "dealerSalary" = EXCLUDED."dealerSalary",
          "incentiveMultiplier" = EXCLUDED."incentiveMultiplier"
        RETURNING *`,
      [
        Number(targets.monthly) || 0,
        JSON.stringify(targets.dealerMonthly || {}),
        Number(targets.kotakSharePct) || 85,
        Number(targets.rmSplitPct) || 50,
        JSON.stringify(targets.dealerSalary || {}),
        Number(targets.incentiveMultiplier) || 10,
      ]
    );
    return res.rows[0];
  }

  async getDaily(from?: string, to?: string, username?: string, isAdmin?: boolean) {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    if (from) { params.push(from); conditions.push('dr.date >= $' + params.length); }
    if (to) { params.push(to); conditions.push('dr.date <= $' + params.length); }
    if (!isAdmin && username) {
      params.push(username.trim().toLowerCase());
      conditions.push(`(lower(m.dealer) = $${params.length} OR lower(m.rm) = $${params.length})`);
    }
    const query = `
      SELECT dr.id, dr.date, dr.code, dr."codeNorm", dr.name, dr."netBrok", dr.source,
             m.dealer, m.rm, m.branch
      FROM "DailyRecord" dr
      LEFT JOIN "MasterClient" m ON m."codeNorm" = dr."codeNorm"
      WHERE ${conditions.join(' AND ')}
      ORDER BY dr.date DESC, dr."netBrok" DESC
      LIMIT 10000
    `;
    const res = await dealerPool.query(query, params);
    return res.rows;
  }

  async getDailyDates() {
    const res = await dealerPool.query(`
      SELECT date, COUNT(*)::int AS count, array_agg(DISTINCT source) AS sources
      FROM "DailyRecord"
      GROUP BY date
      ORDER BY date DESC
    `);
    return res.rows;
  }

  async getDailyByDate(date: string, source?: string, username?: string, isAdmin?: boolean) {
    const conditions: string[] = ['dr.date = $1'];
    const params: any[] = [date];
    if (source) {
      params.push(source);
      conditions.push('dr.source = $' + params.length);
    }
    if (!isAdmin && username) {
      params.push(username.trim().toLowerCase());
      conditions.push(`(lower(m.dealer) = $${params.length} OR lower(m.rm) = $${params.length})`);
    }

    const query = `
      SELECT dr.id, dr.date, dr.code, dr."codeNorm", dr.name, dr."netBrok", dr.source,
             m.dealer, m.rm, m.branch
      FROM "DailyRecord" dr
      LEFT JOIN "MasterClient" m ON m."codeNorm" = dr."codeNorm"
      WHERE ${conditions.join(' AND ')}
      ORDER BY dr."netBrok" DESC
    `;
    const res = await dealerPool.query(query, params);
    return res.rows;
  }

  async upsertDailyRecords(date: string, records: Array<{ code: string; name?: string; netBrok: number; source?: string }>, _actor: { id: string; username: string }) {
    const client = await dealerPool.connect();
    try {
      await client.query('BEGIN');
      const sources = Array.from(new Set(records.map((r) => r.source || 'SW')));
      for (const src of sources) {
        await client.query('DELETE FROM "DailyRecord" WHERE date = $1 AND source = $2', [date, src]);
      }
      for (const r of records) {
        const code = String(r.code || '').trim();
        if (!code) continue;
        const codeNorm = normCode(code);
        const id = 'dr_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
        await client.query(
          `INSERT INTO "DailyRecord" (id, date, code, "codeNorm", name, "netBrok", source)
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, date, code, codeNorm, r.name || '', Number(r.netBrok) || 0, r.source || 'SW']
        );
      }
      await client.query('COMMIT');
      return { ok: true, count: records.length };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async deleteDailyRecords(date: string, source?: string, _actor?: { id: string; username: string }) {
    const conditions = ['date = $1'];
    const params = [date];
    if (source) {
      params.push(source);
      conditions.push('source = $2');
    }
    const res = await dealerPool.query(`DELETE FROM "DailyRecord" WHERE ${conditions.join(' AND ')}`, params);
    return { ok: true, deletedCount: res.rowCount };
  }

  async getMissingFinder(date?: string, username?: string, isAdmin?: boolean) {
    let targetDate = date;
    if (!targetDate) {
      const latestRes = await dealerPool.query('SELECT date FROM "DailyRecord" ORDER BY date DESC LIMIT 1');
      if (!latestRes.rows.length) return [];
      targetDate = latestRes.rows[0].date;
    }

    const conditions = ['dr.date = $1', "(m.dealer IS NULL OR m.dealer = '' OR m.rm IS NULL OR m.rm = '')"];
    const params: any[] = [targetDate];
    if (!isAdmin && username) {
      params.push(username.trim().toLowerCase());
      conditions.push(`(lower(m.dealer) = $${params.length} OR lower(m.rm) = $${params.length})`);
    }

    const query = `
      SELECT dr.code, dr."codeNorm", max(dr.name) AS name, sum(dr."netBrok")::float8 AS "netBrok", count(*)::int AS count
      FROM "DailyRecord" dr
      LEFT JOIN "MasterClient" m ON m."codeNorm" = dr."codeNorm"
      WHERE ${conditions.join(' AND ')}
      GROUP BY dr.code, dr."codeNorm"
      ORDER BY "netBrok" DESC
    `;
    const res = await dealerPool.query(query, params);
    return res.rows;
  }

  async getDebit(from?: string, to?: string, username?: string, isAdmin?: boolean) {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    if (from) { params.push(from); conditions.push('date >= $' + params.length); }
    if (to) { params.push(to); conditions.push('date <= $' + params.length); }
    if (!isAdmin && username) {
      params.push(username.trim().toLowerCase());
      conditions.push(`code IN (SELECT code FROM "MasterClient" WHERE lower(dealer) = $${params.length} OR lower(rm) = $${params.length})`);
    }
    const res = await dealerPool.query(`SELECT id, date, code, name, debit FROM "DebitRecord" WHERE ${conditions.join(' AND ')} ORDER BY date DESC LIMIT 5000`, params);
    return res.rows;
  }

  async getDebitDates() {
    const res = await dealerPool.query('SELECT date, COUNT(*)::int AS count FROM "DebitRecord" GROUP BY date ORDER BY date DESC');
    return res.rows;
  }

  async getDebitByDate(date: string, username?: string, isAdmin?: boolean) {
    const conditions: string[] = ['date = $1'];
    const params: any[] = [date];
    if (!isAdmin && username) {
      params.push(username.trim().toLowerCase());
      conditions.push(`code IN (SELECT code FROM "MasterClient" WHERE lower(dealer) = $${params.length} OR lower(rm) = $${params.length})`);
    }
    const res = await dealerPool.query(`SELECT id, date, code, name, debit FROM "DebitRecord" WHERE ${conditions.join(' AND ')} ORDER BY debit DESC`, params);
    return res.rows;
  }

  async upsertDebitRecords(date: string, records: Array<{ code: string; name?: string; debit: number }>, _actor: { id: string; username: string }) {
    const client = await dealerPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM "DebitRecord" WHERE date = $1', [date]);
      for (const r of records) {
        const code = String(r.code || '').trim();
        if (!code) continue;
        const id = 'dbt_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
        await client.query(
          `INSERT INTO "DebitRecord" (id, date, code, name, debit)
            VALUES ($1, $2, $3, $4, $5)`,
          [id, date, code, r.name || '', Number(r.debit) || 0]
        );
      }
      await client.query('COMMIT');
      return { ok: true, count: records.length };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async deleteDebitRecords(date: string, _actor?: { id: string; username: string }) {
    const client = await dealerPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM "DebitRecord" WHERE date = $1', [date]);
      await client.query('COMMIT');
      return { ok: true };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getDebitLatest(username?: string, isAdmin?: boolean) {
    let allowedCodes: Set<string> | null = null;
    if (!isAdmin && username) {
      const clients = await dealerPool.query('SELECT code FROM "MasterClient" WHERE lower(dealer) = $1 OR lower(rm) = $1', [username.trim().toLowerCase()]);
      allowedCodes = new Set(clients.rows.map((r: any) => normCode(r.code)));
    }
    const res = await dealerPool.query(`
      SELECT DISTINCT ON (code) code, name, debit, date
      FROM "DebitRecord"
      ORDER BY code, date DESC
    `);
    const result: Record<string, { name: string; debit: number; date: string }> = {};
    for (const r of res.rows) {
      if (allowedCodes && !allowedCodes.has(normCode(r.code))) continue;
      result[r.code] = { name: r.name, debit: r.debit, date: r.date };
    }
    return result;
  }

  async getDashboardSummary(period: string = 'month', username: string, isAdmin: boolean) {
    let allowedCodesSql = '';
    const params: any[] = [];
    if (!isAdmin) {
      const clients = await dealerPool.query('SELECT "codeNorm" FROM "MasterClient" WHERE lower(dealer) = lower($1) OR lower(rm) = lower($1)', [username]);
      const allowedCodeNorms = clients.rows.map((r: any) => r.codeNorm).filter(Boolean);
      if (!allowedCodeNorms.length) return { hasData: false };
      params.push(allowedCodeNorms);
      allowedCodesSql = `AND dr."codeNorm" = ANY($${params.length})`;
    }

    const latestRes = await dealerPool.query(`SELECT date FROM "DailyRecord" dr WHERE 1=1 ${allowedCodesSql} ORDER BY date DESC LIMIT 1`, params);
    if (!latestRes.rows.length) return { hasData: false };
    const latestDate = latestRes.rows[0]!.date;

    const prevRes = await dealerPool.query(`SELECT date FROM "DailyRecord" dr WHERE date < $1 ${allowedCodesSql} ORDER BY date DESC LIMIT 1`, [latestDate, ...params.slice(0)]);
    const prevDate = prevRes.rows[0]?.date ?? null;

    const last30Res = await dealerPool.query(`SELECT DISTINCT date FROM "DailyRecord" dr WHERE 1=1 ${allowedCodesSql} ORDER BY date DESC LIMIT 30`, params);
    const last30Dates = last30Res.rows.map((r: any) => r.date).sort();

    const [y, m0] = latestDate.split('-').map(Number).map((n: number, i: number) => (i === 1 ? n - 1 : n));
    const wStart = getWeekStart(latestDate);
    const mStart = isoDate(y, m0, 1);
    const qStart = isoDate(y, Math.floor(m0 / 3) * 3, 1);
    const yStart = isoDate(y, 0, 1);

    const targetsRes = await dealerPool.query('SELECT "kotakSharePct", "rmSplitPct", monthly FROM "Targets" WHERE id = 1');
    const targetRow = targetsRes.rows[0];
    const kotakSharePct = Number(targetRow?.kotakSharePct) || 85;
    const rmSplitPct = Number(targetRow?.rmSplitPct) || 50;
    const monthlyTarget = Number(targetRow?.monthly) || 0;

    const netExpr = isAdmin
      ? `"netRaw"`
      : `(CASE
          WHEN lower(dealer) = lower('${username.replace(/'/g, "''")}') THEN "netRaw" * "dealerPct" / 100.0
          WHEN lower(rm) = lower('${username.replace(/'/g, "''")}') THEN "netRaw" * "rmPct" / 100.0
          ELSE 0
        END)`;

    const basePerRecordSql = (dateCond: string) => `
      SELECT
        dr.date,
        dr.code,
        dr.name,
        COALESCE(NULLIF(m.dealer, ''), 'Unmapped') AS dealer,
        COALESCE(m.rm, '') AS rm,
        (CASE WHEN dr.source = 'KOTAK' THEN dr."netBrok" * (${kotakSharePct}::float8 / 100.0) ELSE dr."netBrok" END) AS "netRaw",
        (CASE
          WHEN COALESCE(m.dealer, '') = '' THEN 0
          WHEN COALESCE(m.rm, '') = '' THEN 100
          WHEN lower(m.dealer) = lower(m.rm) THEN 100
          ELSE 100 - ${rmSplitPct}::float8
        END) AS "dealerPct",
        (CASE
          WHEN COALESCE(m.rm, '') = '' THEN 0
          WHEN COALESCE(m.dealer, '') = '' THEN 100
          WHEN lower(m.dealer) = lower(m.rm) THEN 0
          ELSE ${rmSplitPct}::float8
        END) AS "rmPct"
      FROM "DailyRecord" dr
      LEFT JOIN "MasterClient" m ON m."codeNorm" = dr."codeNorm"
      WHERE ${dateCond} ${allowedCodesSql}
    `;

    const periodCond = {
      day: `dr.date = '${latestDate}'`,
      week: `dr.date >= '${wStart}' AND dr.date <= '${latestDate}'`,
      month: `dr.date >= '${mStart}' AND dr.date <= '${latestDate}'`,
      quarter: `dr.date >= '${qStart}' AND dr.date <= '${latestDate}'`,
      year: `dr.date >= '${yStart}' AND dr.date <= '${latestDate}'`,
    }[period] || `dr.date >= '${mStart}' AND dr.date <= '${latestDate}'`;

    const kpiRes = await dealerPool.query(
      `SELECT
        COALESCE(SUM(net) FILTER (WHERE date = '${latestDate}'), 0)::float8 AS today,
        COALESCE(SUM(net) FILTER (WHERE date = '${prevDate ?? ''}'), 0)::float8 AS yesterday,
        COALESCE(SUM(net) FILTER (WHERE date >= '${mStart}'), 0)::float8 AS mtd,
        COALESCE(SUM(net) FILTER (WHERE date >= '${qStart}'), 0)::float8 AS qtd,
        COALESCE(SUM(net) FILTER (WHERE date >= '${yStart}'), 0)::float8 AS ytd
      FROM (
        SELECT date, ${netExpr} AS net
        FROM (${basePerRecordSql(`dr.date >= '${yStart}' AND dr.date <= '${latestDate}'`)}) x
      ) y`,
      params
    );

    const dealerRowsRes = await dealerPool.query(
      `SELECT dealer, COALESCE(SUM("netRaw" * "dealerPct" / 100.0), 0)::float8 AS value
      FROM (${basePerRecordSql(periodCond)}) x
      GROUP BY dealer
      ORDER BY value DESC`,
      params
    );

    const topClientsRes = await dealerPool.query(
      `SELECT code, max(name) AS name, SUM("netRaw")::float8 AS value
      FROM (${basePerRecordSql(periodCond)}) x
      GROUP BY code
      ORDER BY value DESC
      LIMIT 10`,
      params
    );

    const trendRes = await dealerPool.query(
      `SELECT date, COALESCE(SUM(${netExpr}), 0)::float8 AS value
      FROM (${basePerRecordSql(`dr.date >= '${last30Dates[0] ?? latestDate}' AND dr.date <= '${latestDate}'`)}) x
      GROUP BY date
      ORDER BY date ASC`,
      params
    );

    const kpi = kpiRes.rows[0] || {};
    const kpiData = {
        today: kpi.today || 0,
        yesterday: prevDate ? kpi.yesterday : null,
        mtd: kpi.mtd || 0,
        qtd: kpi.qtd || 0,
        ytd: kpi.ytd || 0,
        monthlyTarget,
        target: monthlyTarget,
        periodSelected: period,
      };
    return {
      hasData: true,
      latestDate,
      prevDate,
      period,
      kpi: kpiData,
      kpis: kpiData,
      dealerRows: dealerRowsRes.rows.map((r: any) => ({ dealer: r.dealer, value: Math.round(Number(r.value) || 0) })),
      topClients: topClientsRes.rows.map((r: any) => ({ code: r.code, name: r.name, value: Number(r.value) || 0 })),
      trend: last30Dates.map((d: string) => {
        const row = trendRes.rows.find((r: any) => r.date === d);
        return { date: d, value: Math.round(Number(row?.value) || 0) };
      }),
    };
  }

  async getMisSummary(username: string, isAdmin: boolean) {
    const [dateRows, targetsRow, mappedCounts, holidays] = await Promise.all([
      dealerPool.query('SELECT DISTINCT date FROM "DailyRecord" ORDER BY date DESC LIMIT 2'),
      dealerPool.query('SELECT "monthly", "dealerMonthly", "kotakSharePct", "rmSplitPct", "dealerSalary", "incentiveMultiplier" FROM "Targets" WHERE id = 1'),
      dealerPool.query(`
        SELECT person, COUNT(*)::int AS cnt FROM (
          SELECT dealer AS person FROM "MasterClient" WHERE dealer <> ''
          UNION ALL
          SELECT rm AS person FROM "MasterClient" WHERE rm <> '' AND lower(rm) <> lower(dealer)
        ) t GROUP BY person
      `),
      dealerPool.query('SELECT date FROM "TradingHoliday"'),
    ]);

    if (!dateRows.rows.length) return { hasData: false };

    const latestDate = dateRows.rows[0]?.date || new Date().toISOString().slice(0, 10);
    const prevDate = dateRows.rows[1]?.date ?? null;

    const [y, m0] = latestDate.split('-').map(Number).map((n: number, i: number) => (i === 1 ? n - 1 : n));
    const mStart = isoDate(y, m0, 1);
    const prevM0 = m0 === 0 ? 11 : m0 - 1;
    const prevY = m0 === 0 ? y - 1 : y;
    const prevMonthStart = isoDate(prevY, prevM0, 1);

    const targetRow = targetsRow.rows[0];
    const kotakSharePct = Number(targetRow?.kotakSharePct) || 85;
    const rmSplitPct = Number(targetRow?.rmSplitPct) || 50;
    const dealerSalary = targetRow?.dealerSalary || {};
    const incentiveMultiplier = Number(targetRow?.incentiveMultiplier) || 10;

    const mappedByPerson: Record<string, number> = {};
    for (const r of mappedCounts.rows) {
      mappedByPerson[r.person] = r.cnt;
    }

    const holidaySet = new Set(holidays.rows.map((h: any) => h.date));
    const tradingDays = tradingDaysInMonth(y, m0, holidaySet);
    const latestDay = Number(latestDate.split('-')[2]);
    const tradingDaysSoFar = tradingDaysInMonth(y, m0, holidaySet, latestDay);

    const personRowsRes = await dealerPool.query(`
      WITH records AS (
        SELECT dr.date, dr."codeNorm" AS "codeNorm", dr.code, dr.name,
               COALESCE(NULLIF(m.dealer, ''), '') AS dealer,
               COALESCE(NULLIF(m.rm, ''), '') AS rm,
               (CASE WHEN dr.source = 'KOTAK' THEN dr."netBrok" * (${kotakSharePct}::float8 / 100.0) ELSE dr."netBrok" END) AS "netRaw",
               (CASE WHEN dr.date >= '${mStart}' THEN 'current' ELSE 'previous' END) AS period
        FROM "DailyRecord" dr
        LEFT JOIN "MasterClient" m ON m."codeNorm" = dr."codeNorm"
        WHERE dr.date >= '${prevMonthStart}' AND dr.date <= '${latestDate}'
      ),
      split AS (
        SELECT *,
          (CASE WHEN dealer = '' THEN 0 WHEN rm = '' THEN 100 WHEN lower(dealer) = lower(rm) THEN 100 ELSE 100 - ${rmSplitPct}::float8 END) AS "dealerPct",
          (CASE WHEN rm = '' THEN 0 WHEN dealer = '' THEN 100 WHEN lower(dealer) = lower(rm) THEN 0 ELSE ${rmSplitPct}::float8 END) AS "rmPct"
        FROM records
      ),
      person_rows AS (
        SELECT dealer AS person, date, period, "codeNorm", code, name, "netRaw" * "dealerPct" / 100.0 AS amt, 'dealer' AS role FROM split WHERE dealer <> ''
        UNION ALL
        SELECT rm AS person, date, period, "codeNorm", code, name, "netRaw" * "rmPct" / 100.0 AS amt, 'rm' AS role FROM split WHERE rm <> '' AND lower(rm) <> lower(dealer)
      ),
      per_client AS (
        SELECT person, period, "codeNorm", MAX(code) AS code, MAX(name) AS name, role, SUM(amt) AS client_amt
        FROM person_rows
        GROUP BY person, period, "codeNorm", role
      )
      SELECT pr.person,
             COALESCE(SUM(pr.amt) FILTER (WHERE pr.period = 'current'), 0)::float8 AS mtd,
             COALESCE(SUM(pr.amt) FILTER (WHERE pr.period = 'current' AND pr.date = '${prevDate ?? ''}'), 0)::float8 AS yesterday,
             (
               SELECT COUNT(*) FROM per_client pc WHERE pc.person = pr.person AND pc.period = 'current' AND pc.client_amt <> 0
             )::int AS "tradedCount",
             (
               SELECT jsonb_agg(jsonb_build_object('code', pc.code, 'name', pc.name, 'role', pc.role, 'netBrokerage', ROUND(pc.client_amt::numeric, 2)) ORDER BY pc.code)
               FROM per_client pc WHERE pc.person = pr.person AND pc.period = 'current' AND pc.client_amt <> 0
             ) AS "tradedClients",
             (
               SELECT COUNT(*) FROM per_client pcPrev
               WHERE pcPrev.person = pr.person AND pcPrev.period = 'previous' AND pcPrev.client_amt <> 0
                 AND NOT EXISTS (
                   SELECT 1 FROM per_client pcCurr
                   WHERE pcCurr.person = pcPrev.person AND pcCurr."codeNorm" = pcPrev."codeNorm"
                     AND pcCurr.period = 'current' AND pcCurr.client_amt <> 0
                 )
             )::int AS "dormantCount",
             (
               SELECT jsonb_agg(jsonb_build_object('code', pcPrev.code, 'name', pcPrev.name, 'role', pcPrev.role, 'lastMonthNetBrokerage', ROUND(pcPrev.client_amt::numeric, 2)) ORDER BY pcPrev.client_amt DESC)
               FROM per_client pcPrev
               WHERE pcPrev.person = pr.person AND pcPrev.period = 'previous' AND pcPrev.client_amt <> 0
                 AND NOT EXISTS (
                   SELECT 1 FROM per_client pcCurr
                   WHERE pcCurr.person = pcPrev.person AND pcCurr."codeNorm" = pcPrev."codeNorm"
                     AND pcCurr.period = 'current' AND pcCurr.client_amt <> 0
                 )
             ) AS "dormantClients"
      FROM person_rows pr
      GROUP BY pr.person
    `);

    const aggByPerson: Record<string, any> = {};
    for (const r of personRowsRes.rows) {
      aggByPerson[r.person.toLowerCase()] = r;
    }

    const dealerNameRows = await dealerPool.query(`
      SELECT name FROM "Dealer"
      UNION
      SELECT dealer AS name FROM "MasterClient" WHERE dealer <> ''
    `);
    let dealerNames = dealerNameRows.rows.map((r: any) => r.name);
    if (!isAdmin && username) {
      dealerNames = dealerNames.filter((d: string) => d.toLowerCase() === username.toLowerCase());
    }

    const rows = dealerNames
      .map((name: string) => buildPersonSummary(name, aggByPerson, mappedByPerson, tradingDays, tradingDaysSoFar, dealerSalary, incentiveMultiplier))
      .sort((a: any, b: any) => b.mtdRevenue - a.mtdRevenue);

    return { latestDate, prevDate, prevMonthStart, rows };
  }

  async getReportsDealers(period?: string, from?: string, to?: string, dealerFilter?: string, rmFilter?: string, username?: string, isAdmin?: boolean) {
    const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
    if (from && !ISO_DATE.test(from)) from = undefined;
    if (to && !ISO_DATE.test(to)) to = undefined;

    const latestRes = await dealerPool.query('SELECT date FROM "DailyRecord" ORDER BY date DESC LIMIT 1');
    const latestDate = latestRes.rows[0]?.date || new Date().toISOString().slice(0, 10);
    const [y, m0] = latestDate.split('-').map(Number).map((n: number, i: number) => (i === 1 ? n - 1 : n));

    if (!from && !to && period && period !== 'all') {
      if (period === 'week') from = getWeekStart(latestDate);
      else if (period === 'month') from = isoDate(y, m0, 1);
      else if (period === 'quarter') from = isoDate(y, Math.floor(m0 / 3) * 3, 1);
      else if (period === 'year') from = isoDate(y, 0, 1);
      to = latestDate;
    }

    const targetsRes = await dealerPool.query('SELECT "kotakSharePct", "rmSplitPct", "dealerSalary", "incentiveMultiplier" FROM "Targets" WHERE id = 1');
    const targetRow = targetsRes.rows[0];
    const kotakSharePct = Number(targetRow?.kotakSharePct) || 85;
    const rmSplitPct = Number(targetRow?.rmSplitPct) || 50;

    const showMonthComparison = !!(from && to && from.split('-')[2] === '01');
    let prevMonthStart: string | null = null;
    if (showMonthComparison && from) {
      const parts = from.split('-').map(Number);
      const fy = parts[0] ?? 2026;
      const fm0 = (parts[1] ?? 1) - 1;
      const prevM0 = fm0 === 0 ? 11 : fm0 - 1;
      const prevY = fm0 === 0 ? fy - 1 : fy;
      prevMonthStart = isoDate(prevY, prevM0, 1);
    }

    const regDealersRes = await dealerPool.query('SELECT name FROM "Dealer"');
    const registryDealers = regDealersRes.rows.map((r: any) => r.name);

    const mappedRes = await dealerPool.query('SELECT dealer, COUNT(*)::int as count FROM "MasterClient" WHERE dealer <> \'\' GROUP BY dealer');
    const mappedByDealer: Record<string, number> = {};
    mappedRes.rows.forEach((r: any) => { mappedByDealer[r.dealer] = r.count; });

    const dateConditions: string[] = [];
    const params: any[] = [];
    if (from) { params.push(from); dateConditions.push(`dr.date >= $${params.length}`); }
    if (to) { params.push(to); dateConditions.push(`dr.date <= $${params.length}`); }
    const dateCondSql = dateConditions.length ? `AND ${dateConditions.join(' AND ')}` : '';

    const tradedQuery = `
      WITH per_client AS (
        SELECT m.dealer AS dealer, dr."codeNorm" AS "codeNorm", m.rm AS rm,
               SUM(CASE WHEN dr.source = 'KOTAK' THEN dr."netBrok" * (${kotakSharePct}::float8 / 100.0) ELSE dr."netBrok" END) AS client_amt,
               SUM(CASE WHEN dr.source = 'SW' THEN dr."netBrok" ELSE 0 END) AS sw_gross,
               SUM(CASE WHEN dr.source = 'KOTAK' THEN dr."netBrok" ELSE 0 END) AS kotak_gross
        FROM "DailyRecord" dr
        JOIN "MasterClient" m ON m."codeNorm" = dr."codeNorm"
        WHERE m.dealer <> '' ${dateCondSql}
        GROUP BY m.dealer, dr."codeNorm", m.rm
      )
      SELECT
        dealer,
        COUNT(*) FILTER (WHERE client_amt <> 0)::int AS "tradedClients",
        COALESCE(SUM(sw_gross), 0)::float8 AS "swGross",
        COALESCE(SUM(kotak_gross), 0)::float8 AS "kotakGross",
        COALESCE(SUM(client_amt), 0)::float8 AS "totalBrokerage",
        COALESCE(SUM(
          client_amt * (CASE
              WHEN COALESCE(rm, '') = '' THEN 100
              WHEN lower(dealer) = lower(rm) THEN 100
              ELSE 100 - ${rmSplitPct}::float8
            END) / 100.0
        ), 0)::float8 AS "netBrokerage"
      FROM per_client
      GROUP BY dealer
    `;
    const tradedRes = await dealerPool.query(tradedQuery, params);
    const tradedByDealer: Record<string, any> = {};
    tradedRes.rows.forEach((r: any) => { tradedByDealer[r.dealer] = r; });

    let comparisonByDealer: Record<string, any> = {};
    if (showMonthComparison && prevMonthStart && from && to) {
      const cmpParams = [from, prevMonthStart, to];
      const cmpQuery = `
        WITH records AS (
          SELECT dr.date, dr."codeNorm" AS "codeNorm", dr.code, dr.name, m.dealer AS dealer, m.rm AS rm,
                 (CASE WHEN dr.source = 'KOTAK' THEN dr."netBrok" * (${kotakSharePct}::float8 / 100.0) ELSE dr."netBrok" END) AS "netRaw",
                 (CASE WHEN dr.date >= $1 THEN 'current' ELSE 'previous' END) AS period
          FROM "DailyRecord" dr
          JOIN "MasterClient" m ON m."codeNorm" = dr."codeNorm"
          WHERE m.dealer <> '' AND dr.date >= $2 AND dr.date <= $3
        ),
        per_client AS (
          SELECT dealer, period, "codeNorm", MAX(code) AS code, MAX(name) AS name, rm,
                 SUM("netRaw") AS client_amt
          FROM records
          GROUP BY dealer, period, "codeNorm", rm
        )
        SELECT dealer,
               (SELECT COUNT(*) FROM per_client pc WHERE pc.dealer = base.dealer AND pc.period = 'previous' AND pc.client_amt <> 0)::int AS "prevTradedClients",
               (SELECT COALESCE(SUM(pc.client_amt), 0) FROM per_client pc WHERE pc.dealer = base.dealer AND pc.period = 'previous')::float8 AS "prevTotalBrokerage",
               (
                 SELECT COALESCE(SUM(pc.client_amt * (CASE WHEN COALESCE(pc.rm, '') = '' THEN 100 WHEN lower(pc.dealer) = lower(pc.rm) THEN 100 ELSE 100 - ${rmSplitPct}::float8 END) / 100.0), 0)
                 FROM per_client pc WHERE pc.dealer = base.dealer AND pc.period = 'previous'
               )::float8 AS "prevNetBrokerage",
               (
                 SELECT COUNT(*) FROM per_client pcPrev
                 WHERE pcPrev.dealer = base.dealer AND pcPrev.period = 'previous' AND pcPrev.client_amt <> 0
                   AND NOT EXISTS (
                     SELECT 1 FROM per_client pcCurr
                     WHERE pcCurr.dealer = pcPrev.dealer AND pcCurr."codeNorm" = pcPrev."codeNorm"
                       AND pcCurr.period = 'current' AND pcCurr.client_amt <> 0
                   )
               )::int AS "dormantCount",
               (
                 SELECT jsonb_agg(jsonb_build_object('code', pcPrev.code, 'name', pcPrev.name, 'lastMonthNetBrokerage', ROUND(pcPrev.client_amt::numeric, 2)) ORDER BY pcPrev.client_amt DESC)
                 FROM per_client pcPrev
                 WHERE pcPrev.dealer = base.dealer AND pcPrev.period = 'previous' AND pcPrev.client_amt <> 0
                   AND NOT EXISTS (
                     SELECT 1 FROM per_client pcCurr
                     WHERE pcCurr.dealer = pcPrev.dealer AND pcCurr."codeNorm" = pcPrev."codeNorm"
                       AND pcCurr.period = 'current' AND pcCurr.client_amt <> 0
                   )
               ) AS "dormantClients"
        FROM (SELECT DISTINCT dealer FROM per_client) base
      `;
      const cmpRes = await dealerPool.query(cmpQuery, cmpParams);
      cmpRes.rows.forEach((r: any) => { comparisonByDealer[r.dealer] = r; });
    }

    const allDealersSet = new Set([
      ...registryDealers,
      ...Object.keys(mappedByDealer),
      ...Object.keys(tradedByDealer),
    ]);
    let dealerNames = Array.from(allDealersSet);
    if (!isAdmin && username) {
      dealerNames = dealerNames.filter((d: string) => d.toLowerCase() === username.toLowerCase());
    } else if (dealerFilter) {
      dealerNames = dealerNames.filter((d: string) => d.toLowerCase() === dealerFilter.toLowerCase());
    }

    const rows = dealerNames.map((dealer: string) => {
      const cmp = comparisonByDealer[dealer];
      const tr = tradedByDealer[dealer];
      return {
        dealer,
        clientsMapped: mappedByDealer[dealer] || 0,
        tradedClients: tr?.tradedClients || 0,
        swGross: tr?.swGross || 0,
        kotakGross: tr?.kotakGross || 0,
        totalBrokerage: tr?.totalBrokerage || 0,
        netBrokerage: tr?.netBrokerage || 0,
        netRevenue: tr?.netBrokerage || 0,
        ...(showMonthComparison ? {
          prevTradedClients: cmp?.prevTradedClients || 0,
          prevTotalBrokerage: cmp?.prevTotalBrokerage || 0,
          prevNetBrokerage: cmp?.prevNetBrokerage || 0,
          dormantClientsCount: cmp?.dormantCount || 0,
          dormantClients: cmp?.dormantClients || [],
        } : {}),
      };
    }).sort((a: any, b: any) => (b.totalBrokerage || 0) - (a.totalBrokerage || 0));

    return { from: from || null, to: to || null, monthComparison: showMonthComparison, rows };
  }

  async getRmsSummary(period?: string, from?: string, to?: string, rmFilter?: string, username?: string, isAdmin?: boolean) {
    const targetsRes = await dealerPool.query('SELECT "kotakSharePct", "rmSplitPct" FROM "Targets" WHERE id = 1');
    const targetRow = targetsRes.rows[0];
    const kotakSharePct = Number(targetRow?.kotakSharePct) || 85;
    const rmSplitPct = Number(targetRow?.rmSplitPct) || 50;

    let periodFilterSql = '';
    if (period && period !== 'all') {
      const dateRes = await dealerPool.query('SELECT DISTINCT date FROM "DailyRecord" ORDER BY date DESC LIMIT 1');
      const latestDate = dateRes.rows[0]?.date || new Date().toISOString().slice(0, 10);
      const [y, m0] = latestDate.split('-').map(Number).map((n: number, i: number) => (i === 1 ? n - 1 : n));
      const wStart = getWeekStart(latestDate);
      const mStart = isoDate(y, m0, 1);
      const qStart = isoDate(y, Math.floor(m0 / 3) * 3, 1);
      const yStart = isoDate(y, 0, 1);
      if (period === 'week') periodFilterSql = `AND dr.date >= '${wStart}'`;
      else if (period === 'month') periodFilterSql = `AND dr.date >= '${mStart}'`;
      else if (period === 'quarter') periodFilterSql = `AND dr.date >= '${qStart}'`;
      else if (period === 'year') periodFilterSql = `AND dr.date >= '${yStart}'`;
    }

    const conditions = ["m.rm <> ''"];
    const params: any[] = [];
    if (from) { params.push(from); conditions.push(`dr.date >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`dr.date <= $${params.length}`); }

    if (!isAdmin && username) {
      params.push(username);
      conditions.push(`lower(m.rm) = lower($${params.length})`);
    } else if (rmFilter) {
      params.push(rmFilter);
      conditions.push(`lower(m.rm) = lower($${params.length})`);
    }

    const query = `
      SELECT
        m.rm AS rm,
        COUNT(DISTINCT dr.code)::int AS "tradedClients",
        COALESCE(SUM(
          (CASE WHEN dr.source = 'KOTAK' THEN dr."netBrok" * (${kotakSharePct}::float8 / 100.0) ELSE dr."netBrok" END)
          * (CASE
              WHEN COALESCE(m.rm, '') = '' THEN 0
              WHEN COALESCE(m.dealer, '') = '' THEN 100
              WHEN lower(m.dealer) = lower(m.rm) THEN 0
              ELSE ${rmSplitPct}::float8
            END) / 100.0
        ), 0)::float8 AS "netBrokerage",
        COALESCE(SUM(
          (CASE WHEN dr.source = 'KOTAK' THEN dr."netBrok" * (${kotakSharePct}::float8 / 100.0) ELSE dr."netBrok" END)
          * (CASE
              WHEN COALESCE(m.rm, '') = '' THEN 0
              WHEN COALESCE(m.dealer, '') = '' THEN 100
              WHEN lower(m.dealer) = lower(m.rm) THEN 0
              ELSE ${rmSplitPct}::float8
            END) / 100.0
        ), 0)::float8 AS "netRevenue"
      FROM "DailyRecord" dr
      JOIN "MasterClient" m ON m."codeNorm" = dr."codeNorm"
      WHERE ${conditions.join(' AND ')} ${periodFilterSql}
      GROUP BY m.rm
      ORDER BY "netBrokerage" DESC
    `;

    const res = await dealerPool.query(query, params);
    return { rows: res.rows };
  }

  async getBrokerageByClient(period?: string, from?: string, to?: string, dealerFilter?: string, rmFilter?: string, username?: string, isAdmin?: boolean) {
    const targetsRes = await dealerPool.query('SELECT "kotakSharePct" FROM "Targets" WHERE id = 1');
    const targetRow = targetsRes.rows[0];
    const kotakSharePct = Number(targetRow?.kotakSharePct) || 85;

    let periodFilterSql = '';
    if (period && period !== 'all') {
      const dateRes = await dealerPool.query('SELECT DISTINCT date FROM "DailyRecord" ORDER BY date DESC LIMIT 1');
      const latestDate = dateRes.rows[0]?.date || new Date().toISOString().slice(0, 10);
      const [y, m0] = latestDate.split('-').map(Number).map((n: number, i: number) => (i === 1 ? n - 1 : n));
      const wStart = getWeekStart(latestDate);
      const mStart = isoDate(y, m0, 1);
      const qStart = isoDate(y, Math.floor(m0 / 3) * 3, 1);
      const yStart = isoDate(y, 0, 1);
      if (period === 'week') periodFilterSql = `AND dr.date >= '${wStart}'`;
      else if (period === 'month') periodFilterSql = `AND dr.date >= '${mStart}'`;
      else if (period === 'quarter') periodFilterSql = `AND dr.date >= '${qStart}'`;
      else if (period === 'year') periodFilterSql = `AND dr.date >= '${yStart}'`;
    }

    const conditions = ['1=1'];
    const params: any[] = [];
    if (from) { params.push(from); conditions.push(`dr.date >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`dr.date <= $${params.length}`); }

    if (!isAdmin && username) {
      params.push(username);
      conditions.push(`(lower(m.dealer) = lower($${params.length}) OR lower(m.rm) = lower($${params.length}))`);
    } else {
      if (dealerFilter) { params.push(dealerFilter); conditions.push(`lower(m.dealer) = lower($${params.length})`); }
      if (rmFilter) { params.push(rmFilter); conditions.push(`lower(m.rm) = lower($${params.length})`); }
    }

    const query = `
      SELECT
        dr."codeNorm" AS code,
        MAX(dr.name) AS name,
        COALESCE(NULLIF(m.dealer, ''), 'Unmapped') AS dealer,
        COALESCE(m.rm, '') AS rm,
        SUM(CASE WHEN dr.source = 'KOTAK' THEN dr."netBrok" * (${kotakSharePct}::float8 / 100.0) ELSE dr."netBrok" END)::float8 AS value,
        SUM(dr."netBrok")::float8 AS "totalBrok"
      FROM "DailyRecord" dr
      LEFT JOIN "MasterClient" m ON m."codeNorm" = dr."codeNorm"
      WHERE ${conditions.join(' AND ')} ${periodFilterSql}
      GROUP BY dr."codeNorm", COALESCE(NULLIF(m.dealer, ''), 'Unmapped'), COALESCE(m.rm, '')
      ORDER BY value DESC
    `;

    const res = await dealerPool.query(query, params);
    return { rows: res.rows };
  }

  async getTasks(dealer: string, month: string) {
    const res = await dealerPool.query(
      `SELECT id, dealer, month, slot, text, done
        FROM "DealerTask"
        WHERE lower(dealer) = lower($1) AND month = $2
        ORDER BY slot ASC`,
      [dealer, month]
    );
    return res.rows;
  }

  async upsertTask(dealer: string, month: string, slot: number, text: string, done: boolean) {
    const id = `tsk_${dealer}_${month}_${slot}`;
    await dealerPool.query(
      `INSERT INTO "DealerTask" (id, dealer, month, slot, text, done)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (dealer, month, slot) DO UPDATE SET
          text = EXCLUDED.text,
          done = EXCLUDED.done`,
      [id, dealer, month, slot, text, done]
    );
    return { ok: true };
  }

  async getHolidays() {
    const res = await dealerPool.query('SELECT date, name FROM "TradingHoliday" ORDER BY date ASC');
    return res.rows;
  }

  async replaceHolidays(holidays: Array<{ date: string; name: string }>) {
    const client = await dealerPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM "TradingHoliday"');
      for (const h of holidays) {
        if (!h.date) continue;
        await client.query('INSERT INTO "TradingHoliday" (date, name) VALUES ($1, $2) ON CONFLICT (date) DO UPDATE SET name = EXCLUDED.name', [h.date, h.name || '']);
      }
      await client.query('COMMIT');
      return { ok: true };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export const dealerCalculationService = new DealerCalculationService();
