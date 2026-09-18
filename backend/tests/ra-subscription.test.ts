import assert from 'node:assert/strict';
import { fillRaSubscriptionEndDate } from '../src/utils/raImport.ts';
import { calculateRaEndDate, fillRaCsvEndDates } from '../../frontend/src/utils/raSubscription.ts';
const cases: Array<[string,number,string]> = [
  ['2026-01-31',30,'2026-03-02'],
  ['2026-09-15',90,'2026-12-14'],
  ['2026-01-01',356,'2026-12-23'],
  ['2026-01-01',365,'2027-01-01'],
  ['2024-02-28',1,'2024-02-29'],
  ['2024-02-29',365,'2025-02-28'],
];
for (const [start,days,end] of cases) {
  assert.equal(calculateRaEndDate(start,days),end);
  assert.equal(fillRaSubscriptionEndDate({package:'basic',subscription_start_date:start},[{name:'Basic',duration_days:days}]).subscription_end_date,end);
}
assert.equal(calculateRaEndDate('31/01/2026',30),'2026-03-02');
assert.equal(calculateRaEndDate('2026-02-30',30),'');
assert.equal(calculateRaEndDate('2026-01-01',0),'');
const explicit = {package:'Unknown',subscription_start_date:'2026-01-01',subscription_end_date:'2026-09-15'};
assert.deepEqual(fillRaSubscriptionEndDate(explicit,[]),explicit);
assert.deepEqual(fillRaCsvEndDates([explicit],[]),[explicit]);
assert.deepEqual(fillRaSubscriptionEndDate({package:'Basic'},[]),{package:'Basic'});
assert.throws(()=>fillRaSubscriptionEndDate({package:'Unknown',subscription_start_date:'2026-01-01'},[]),/valid duration/);
const preview = fillRaCsvEndDates([{package:' Basic ',subscription_start_date:'15/09/2026'}],[{name:'Basic',duration_days:30}]);
assert.equal(preview[0]!.subscription_end_date,'2026-10-15');
console.log('RA subscription durations, explicit end dates, leap years, month boundaries, and CSV preview checks passed.');
