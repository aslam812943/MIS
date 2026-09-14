const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}) {
  const exports = {};
  const source = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true
  } }).outputText;
  vm.runInNewContext(compiled, { exports, process, console, require: name => imports[name] || {} });
  return exports;
}

test('Admin and CEO can read SW Global but cannot mutate records; HOD can still write', () => {
  const { swGlobalReadOnly } = load('../middlewares/swGlobalReadOnly.ts');
  for (const role of ['admin', 'ceo', 'hod']) {
    for (const method of ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      let allowed = false;
      const res = { code: 200, status(code) { this.code = code; return this; }, json() {} };
      swGlobalReadOnly({ user: { role }, method }, res, () => { allowed = true; });
      const expected = role === 'hod' || ['GET', 'HEAD'].includes(method);
      assert.equal(allowed, expected, `${role} ${method}`);
      assert.equal(res.code, expected ? 200 : 403);
    }
  }
});

test('calendar ranges include leap days and Monday-Sunday weeks across years', () => {
  const { reportDates } = load('../../../frontend/src/pages/SWGlobal/SWGlobalReports.tsx');
  assert.equal(reportDates('week', '2026-01-01').join(','), '2025-12-29,2026-01-04');
  assert.equal(reportDates('month', '2024-02-15').join(','), '2024-02-01,2024-02-29');
  assert.equal(reportDates('year', '2026-09-14').join(','), '2026-01-01,2026-12-31');
});

test('report controller validates dates and limits non-leadership users to their branch', async () => {
  const calls = [];
  const { SWGlobalController } = load('../controllers/SWGlobalController.ts', {
    '../services/SWGlobalService.js': { swGlobalService: { getAccountReport: async (...args) => { calls.push(args); return {}; } } }
  });
  const controller = new SWGlobalController();
  const res = { code: 200, status(code) { this.code = code; return this; }, json(value) { this.body = value; } };
  await controller.getAccountReport({ user: { role: 'employee', branch_id: 'own' }, query: { branchId: 'other' } }, res);
  assert.equal(calls[0][2], 'own');
  await controller.getAccountReport({ user: { role: 'employee' }, query: {} }, res);
  assert.equal(res.code, 403);
  for (const query of [{ from: '2026-02-30', to: '2026-03-01' }, { from: '2026-03-02', to: '2026-03-01' }, { from: '2026-03-01' }]) {
    await controller.getAccountReport({ user: { role: 'hod' }, query }, res);
    assert.equal(res.code, 400);
  }
  assert.equal(calls.length, 1);
  await controller.getAccountReport({ user: { role: 'hod' }, query: { branchId: 'chosen' } }, res);
  assert.equal(calls[1][2], 'chosen');
});

test('report loads every page and applies branch and inclusive end-day filters', async () => {
  const filters = [];
  let page = 0;
  const db = { from() {
    const query = { select() { return this; }, order() { return this; }, range() { return this; },
      eq(...args) { filters.push(['eq', ...args]); return this; },
      gte(...args) { filters.push(['gte', ...args]); return this; },
      lt(...args) { filters.push(['lt', ...args]); return this; },
      then(resolve) { const data = Array.from({ length: page++ === 0 ? 1000 : 1 }, (_, i) => ({ id: `${page}-${i}`, sw_global_clients: { name: 'Client' }, branches: { name: 'Branch' } })); return Promise.resolve({ data }).then(resolve); }
    }; return query;
  } };
  const { SWGlobalService } = load('../services/SWGlobalService.ts', {
    '../config/supabase.js': { supabaseAdmin: db }, fs: { existsSync: () => true }, path
  });
  const result = await new SWGlobalService().getAccountReport('2024-02-01', '2024-02-29', 'branch');
  assert.equal(result.accounts.length, 1001);
  assert.equal(result.accounts[0].branch_name, 'Branch');
  assert.ok(filters.some(f => f.join(',') === 'lt,created_at,2024-03-01T00:00:00.000Z'));
  assert.equal(filters.filter(f => f.join(',') === 'eq,branch_id,branch').length, 2);
});
