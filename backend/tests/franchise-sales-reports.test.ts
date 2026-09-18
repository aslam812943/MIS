import assert from 'node:assert/strict';
import { periodRange, filterSales, salesTotal, summarizeSales } from '../../frontend/src/utils/franchiseSalesReports';
assert.deepEqual(periodRange('week','2026-01-01'),{start:'2025-12-29',end:'2026-01-04'});
assert.deepEqual(periodRange('month','2024-02-10'),{start:'2024-02-01',end:'2024-02-29'});
assert.deepEqual(periodRange('year','2026-09-18'),{start:'2026-01-01',end:'2026-12-31'});
const rows=[
 {id:'1',franchise_id:'a',product:'Course',customer_name:'Alice',sale_date:'2026-09-01',amount:0.1},
 {id:'2',franchise_id:'a',product:'Course',customer_name:'Alice',sale_date:'2026-09-30',amount:0.2},
 {id:'3',franchise_id:'b',product:'Other',customer_name:'Bob',sale_date:'2026-10-01',amount:99},
];
const filtered=filterSales(rows,{branch:'a',product:'Course',search:'ALICE',...periodRange('month','2026-09-18')});
assert.deepEqual(filtered.map(r=>r.id),['2','1']);assert.equal(salesTotal(filtered),0.3);
assert.deepEqual(summarizeSales(filtered,r=>r.product),[{label:'Course',count:2,amount:0.3}]);
assert.equal(filterSales(rows,{branch:'',product:'',start:'2026-10-01',end:'2026-10-01',search:''}).length,1);
console.log('Franchise reporting: period boundaries, combined filters, totals and summaries passed.');
