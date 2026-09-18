import assert from 'node:assert/strict';
import { RAService } from '../src/services/RAService.ts';
import { supabaseAdmin } from '../src/config/supabase.ts';
assert.ok(supabaseAdmin);
const originalFrom = supabaseAdmin.from;
const owner = 'owner';
const id = (n:number) => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
let rows = Array.from({length:76},(_,i)=>({id:id(i),created_by:i===75?'other':owner,kra_updation_status:'Pending'}));
let role = 'employee';
let requests = 0, checks = 0;
const service = new RAService();
(service as any).verifyAccess = async () => {checks++;return {authorized:true,role};};
(supabaseAdmin as any).from = (table:string) => {
  assert.equal(table,'ra_clients');
  let mode = '', ids:string[] = [], scoped:string|undefined, status='';
  const query = {
    delete: () => {mode='delete';return query;},
    update: (payload:any) => {mode='update';status=payload.kra_updation_status;return query;},
    in: (column:string,values:string[]) => {assert.equal(column,'id');ids=values;return query;},
    eq: (column:string,value:string) => {assert.equal(column,'created_by');scoped=value;return query;},
    select: async (columns:string) => {
      requests++;assert.equal(columns,'id');
      const affected = rows.filter(row=>ids.includes(row.id) && (!scoped || row.created_by===scoped));
      if (mode==='delete') rows=rows.filter(row=>!affected.includes(row));
      else affected.forEach(row=>row.kra_updation_status=status);
      return {data:affected.map(row=>({id:row.id})),error:null};
    }
  };
  return query;
};
try {
  const status = await service.bulkClientAction([id(0),id(75)],owner,'Completed');
  assert.deepEqual(status.affected_ids,[id(0)]);
  assert.deepEqual(status.failed_ids,[id(75)]);
  assert.equal(rows[0]!.kra_updation_status,'Completed');
  const result = await service.bulkClientAction(rows.map(row=>row.id),owner);
  assert.equal(result.affected_ids.length,75);
  assert.deepEqual(result.failed_ids,[id(75)]);
  assert.equal(rows.length,1);
  assert.equal(requests,2);
  assert.equal(checks,2);
  role='admin';
  const admin = await service.bulkClientAction([id(75),id(75)],owner);
  assert.deepEqual(admin.affected_ids,[id(75)]);
  assert.equal(rows.length,0);
  await assert.rejects(()=>service.bulkClientAction(['invalid'],owner),/Invalid/);
  await assert.rejects(()=>service.bulkClientAction([id(0)],owner,'Unknown'),/Invalid KRA/);
  console.log('RA bulk deletion count, ownership, admin access, and KRA update checks passed. No database writes performed.');
} finally {supabaseAdmin.from=originalFrom;}
