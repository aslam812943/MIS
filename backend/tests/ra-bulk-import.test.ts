import assert from 'node:assert/strict';
import { RAService } from '../src/services/RAService.ts';
import { supabaseAdmin } from '../src/config/supabase.ts';

assert.ok(supabaseAdmin);
const originalFrom = supabaseAdmin.from;
const existing = [{client_name: 'Existing Client', package: 'Basic', pan: 'ABCDE1234F'}];
const writes: Record<string, any>[] = [];
const service = new RAService();
(service as any).verifyAccess = async () => ({authorized:true,role:'admin'});
let insertRequests = 0;
let accessChecks = 0;
(service as any).verifyAccess = async () => {accessChecks++;return {authorized:true,role:'admin'};};
(supabaseAdmin as any).from = (table: string) => {
  if (table === 'ra_packages') return {select: async () => ({data:[{name:'Basic',duration_days:30},{name:'Elite',duration_days:90}],error:null})};
  if (table === 'branches') return {select: async () => ({data:[],error:null})};
  assert.equal(table, 'ra_clients');
  const query = {
    insert: async (input: Record<string, any> | Record<string, any>[]) => {
      insertRequests++;
      const rows = Array.isArray(input) ? input : [input];
      if (rows.some(row => row.package === 'INVALID')) return {error:{code:'23503',message:'Invalid package'}};
      if (rows.some(row => row.package === 'NETWORK')) return {error:{code:'',message:'fetch failed'}};
      writes.push(...rows);
      return {error:null};
    },
    select: () => query,
    order: () => query,
    range: async () => ({data:existing,error:null})
  };
  return query;
};
try {
  const rows = [
    {client_name:'Existing Client',package:'Basic',pan:'abcde1234f'},
    {client_name:'New Client',package:'Elite',sw_code:'SW-NEW',amount:'₹25,000.50',coverage_start_date:'15/09/2026',coverage_end_date:'15/10/2026'},
    {client_name:'New Client Again',package:'Elite',sw_code:'sw-new',amount:'25000.50'},
    {client_name:'Bad Amount',package:'Basic',amount:'invalid'},
  ];
  const preview = await service.bulkCreateClients(rows,'test-admin',true);
  assert.equal(preview.inserted,0);
  assert.deepEqual(preview.failed.map(f => f.row),[2,4,5]);
  assert.equal(writes.length,0);
  const result = await service.bulkCreateClients(rows,'test-admin');
  assert.equal(result.inserted,1);
  assert.deepEqual(result.failed.map(f => f.row),[2,4,5]);
  assert.match(result.failed[0]!.error,/already exists/);
  assert.match(result.failed[1]!.error,/matches row 3/);
  assert.match(result.failed[2]!.error,/Amount/);
  assert.equal(writes.length,1);
  assert.equal(writes[0]!.amount,25000.50);
  assert.equal(writes[0]!.subscription_start_date,'2026-09-15');
  // Re-uploading an imported client is detected from the database index.
  existing.push({client_name:'New Client',package:'Elite',pan:'',sw_code:'SW-NEW'} as any);
  const retry = await service.bulkCreateClients([rows[1]],'test-admin');
  assert.equal(retry.inserted,0);
  assert.match(retry.failed[0]!.error,/already exists/);
  assert.equal(writes.length,1);
  const selectedAlternate = await service.bulkCreateClients([{client_name:'Alternate',package:'Basic',sw_code:'SW-OTHER'}],'test-admin',true);
  assert.equal(selectedAlternate.failed.length,0);
  assert.equal(writes.length,1);
  const before = insertRequests;
  const checksBefore = accessChecks;
  const fast = await service.bulkCreateClients(Array.from({length:70},(_,i)=>({client_name:`Batch Client ${i}`,package:'Basic',sw_code:`SW-BATCH-${i}`})), 'test-admin');
  assert.equal(fast.inserted,70);
  assert.equal(insertRequests - before,1);
  assert.equal(accessChecks - checksBefore,1);
  const partial = await service.bulkCreateClients([{client_name:'Valid',package:'Basic',sw_code:'SW-VALID'},{client_name:'Invalid',package:'INVALID',sw_code:'SW-INVALID'}],'test-admin');
  assert.equal(partial.inserted,1);
  assert.equal(partial.failed[0]!.row,3);
  const beforeNetwork = insertRequests;
  const interrupted = await service.bulkCreateClients([{client_name:'Network',package:'NETWORK'}],'test-admin');
  assert.equal(interrupted.inserted,0);
  assert.equal(insertRequests - beforeNetwork,1);
  assert.match(interrupted.failed[0]!.error,/not confirmed/);
  const calculated = await service.bulkCreateClients([{client_name:'Calculated End',package:'basic',sw_code:'SW-CALC',subscription_start_date:'2026-01-31'}],'test-admin');
  assert.equal(calculated.inserted,1);
  assert.equal(writes.at(-1)!.subscription_end_date,'2026-03-02');
  const explicit = await service.bulkCreateClients([{client_name:'Explicit End',package:'Basic',sw_code:'SW-EXPLICIT',subscription_start_date:'2026-01-31',subscription_end_date:'2026-04-01'}],'test-admin');
  assert.equal(explicit.inserted,1);
  assert.equal(writes.at(-1)!.subscription_end_date,'2026-04-01');
  console.log('RA bulk import duplicate and amount checks passed. No database writes performed.');
} finally {
  supabaseAdmin.from = originalFrom;
}
