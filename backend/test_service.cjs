const { dealerCalculationService } = require('./dist/services/DealerCalculationService.js');

async function test() {
  console.log('Testing getDebitLatest...');
  const deb = await dealerCalculationService.getDebitLatest('admin', true);
  console.log('Debit latest count:', Object.keys(deb).length);

  console.log('Testing getHolidays...');
  const hols = await dealerCalculationService.getHolidays();
  console.log('Holidays count:', hols.length);

  console.log('Testing getMisSummary...');
  const mis = await dealerCalculationService.getMisSummary('admin', true);
  console.log('MIS summary rows count:', mis.rows?.length, 'latestDate:', mis.latestDate);

  console.log('Testing getReportsDealers...');
  const rep = await dealerCalculationService.getReportsDealers('month', undefined, undefined, undefined, undefined, 'admin', true);
  console.log('Reports count:', rep.rows?.length, 'monthComparison:', rep.monthComparison);

  console.log('ALL TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

test().catch(e => {
  console.error('TEST FAILED:', e);
  process.exit(1);
});
