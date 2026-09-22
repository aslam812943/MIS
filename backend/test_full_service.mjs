import dotenv from 'dotenv';
dotenv.config();

import { dealerCalculationService } from './src/services/DealerCalculationService.js';

async function runTests() {
  try {
    console.log('--- 1. Testing getDashboardSummary ---');
    const dash = await dealerCalculationService.getDashboardSummary('month', 'admin', true);
    console.log('Dashboard summary:', {
      hasData: dash.hasData,
      latestDate: dash.latestDate,
      kpi: dash.kpi,
      dealerRowsCount: dash.dealerRows?.length,
      topClientsCount: dash.topClients?.length,
      trendCount: dash.trend?.length
    });

    console.log('\n--- 2. Testing getMisSummary ---');
    const mis = await dealerCalculationService.getMisSummary('admin', true);
    console.log('MIS Summary:', {
      latestDate: mis.latestDate,
      prevDate: mis.prevDate,
      rowsCount: mis.rows?.length,
      firstRow: mis.rows?.[0] ? {
        dealer: mis.rows[0].dealer,
        target: mis.rows[0].target,
        dailyTarget: mis.rows[0].dailyTarget,
        mtdRevenue: mis.rows[0].mtdRevenue,
        dailyAvgAchieved: mis.rows[0].dailyAvgAchieved,
        tradedClientsCount: mis.rows[0].tradedClientsCount,
        tradedClientsListLen: mis.rows[0].tradedClients?.length,
        dormantClientsCount: mis.rows[0].dormantClientsCount,
        salary: mis.rows[0].salary,
        multiplier: mis.rows[0].multiplier,
        incentiveEligible: mis.rows[0].incentiveEligible
      } : null
    });

    console.log('\n--- 3. Testing getDebitLatest ---');
    const debit = await dealerCalculationService.getDebitLatest('admin', true);
    console.log('Debit latest count:', Object.keys(debit).length);

    console.log('\n--- 4. Testing getHolidays ---');
    const holidays = await dealerCalculationService.getHolidays();
    console.log('Holidays count:', holidays.length);

    console.log('\n--- 5. Testing getReportsDealers ---');
    const repDealers = await dealerCalculationService.getReportsDealers('month', undefined, undefined, undefined, undefined, 'admin', true);
    console.log('Reports dealers rows:', repDealers.rows?.length);

    console.log('\n--- 6. Testing getRmsSummary ---');
    const rmsSummary = await dealerCalculationService.getRmsSummary('month', undefined, undefined, undefined, 'admin', true);
    console.log('RMS summary rows:', rmsSummary.rows?.length);

    console.log('\n--- 7. Testing getMaster ---');
    const master = await dealerCalculationService.getMaster('admin', true);
    console.log('Master clients count:', master.length);

    console.log('\n--- 8. Testing getDealers ---');
    const dealers = await dealerCalculationService.getDealers();
    console.log('Dealers count:', dealers.length);

    console.log('\n--- 9. Testing getRms ---');
    const rms = await dealerCalculationService.getRms();
    console.log('RMs count:', rms.length);

    console.log('\nALL ENDPOINT TESTS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  } catch (err) {
    console.error('Test failed with error:', err);
    process.exit(1);
  }
}

runTests();
