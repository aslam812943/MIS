import { swGlobalService } from '../services/SWGlobalService.js';

async function test() {
  try {
    const stats = await swGlobalService.getDashboardStats();
    console.log('✅ SW Global Dashboard Stats retrieved:');
    console.log('Total accounts:', stats.totalAccounts);
    console.log('Total clients:', stats.totalClients);
    console.log('Active accounts:', stats.activeAccounts);
    console.log('Pending accounts:', stats.pendingAccounts);
    console.log('Conversion rate:', stats.conversionRate + '%');
    console.log('Events count:', stats.totalEvents);
  } catch (err) {
    console.error('Test error:', err.message);
  }
}

test();
