import assert from 'node:assert/strict';
import { uploadRaClientsInBatches } from '../../frontend/src/utils/raImportProgress.ts';
import type { RAImportProgress } from '../../frontend/src/utils/raImportProgress.ts';
const rows = Array.from({length:250},(_,index)=>({client_name:`Client ${index}`}));
const updates: RAImportProgress[] = [];
const sizes: number[] = [];
const result = await uploadRaClientsInBatches(rows,async batch => {
  sizes.push(batch.length);
  // No rows are marked saved before this request resolves.
  assert.equal(updates.at(-1)!.saved, sizes.slice(0,-1).reduce((a,b)=>a+b,0));
  return {inserted:batch.length,failed:[]};
},progress=>updates.push(progress));
assert.deepEqual(sizes,[100,100,50]);
assert.deepEqual(updates.map(p=>p.saved),[0,100,200,250]);
assert.equal(result.inserted,250);
let call = 0;
const failures = await uploadRaClientsInBatches(rows,async batch => {
  call++;
  if (call === 2) return {inserted:99,failed:[{row:3,error:'Duplicate: matches row 2'}]};
  return {inserted:batch.length,failed:[]};
},()=>{});
assert.equal(failures.inserted,249);
assert.equal(failures.failed[0]!.row,103);
assert.match(failures.failed[0]!.error,/matches row 102/);
call = 0;
const interrupted = await uploadRaClientsInBatches(rows,async batch => {
  call++;
  if (call === 2) throw new Error('Disconnected');
  return {inserted:batch.length,failed:[]};
},()=>{});
assert.equal(call,2);
assert.equal(interrupted.inserted,100);
assert.equal(interrupted.failed.length,150);
assert.match(interrupted.failed[0]!.error,/not confirmed/);
assert.match(interrupted.failed.at(-1)!.error,/Not sent/);
console.log('RA import confirmed progress, row mapping, and interruption checks passed.');

let smallRequests = 0;
const small = await uploadRaClientsInBatches(rows.slice(0,76),async batch => {smallRequests++;return {inserted:batch.length,failed:[]};},()=>{});
assert.equal(smallRequests,1);
assert.equal(small.inserted,76);
