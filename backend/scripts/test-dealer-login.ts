import { AuthService } from '../src/services/AuthService.js';
import { SupabaseUserRepository } from '../src/repositories/SupabaseUserRepository.js';
import { EmailService } from '../src/services/EmailService.js';
import { DealerCalculationService } from '../src/services/DealerCalculationService.js';

async function main() {
  console.log('Testing Dealer Calculation Login...');
  const userRepo = new SupabaseUserRepository();
  const emailService = new EmailService();
  const authService = new AuthService(userRepo, emailService);

  const result = await authService.login('admin', 'CFbT&zSvfHSPpSbF', 'dealer_calculation');
  console.log('LOGIN SUCCESS! User:', result.user);

  console.log('Testing DealerCalculationService queries...');
  const dealerService = new DealerCalculationService();
  const dashboardData = await dealerService.getDashboardSummary('month', 'admin', true);
  console.log('Dashboard KPI:', dashboardData.kpi);
  console.log('Top Dealers count:', dashboardData.dealerRows?.length);
  console.log('Top Clients count:', dashboardData.topClients?.length);

  const misData = await dealerService.getMisSummary('admin', true);
  console.log('MIS Dealers count:', misData.rows?.length);
  console.log('Latest Date:', misData.latestDate);

  const clients = await dealerService.getMasterClients('admin', true);
  console.log('Master Clients total count:', clients.length);
}

main().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
