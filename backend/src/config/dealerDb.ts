import pg from 'pg';
import dns from 'dns';
import dotenv from 'dotenv';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // fallback for older node environments
}

dotenv.config();

const dealerDbUrl = process.env.DEALER_DATABASE_URL;

if (!dealerDbUrl) {
  throw new Error('DEALER_DATABASE_URL is required to load Dealer Calculation data.');
}

export const dealerPool = new pg.Pool({
  connectionString: dealerDbUrl,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  lookup: (hostname: string, options: any, callback: any) => {
    return dns.lookup(hostname, { ...options, family: 4 }, callback);
  },
} as any);

dealerPool.on('error', (err: Error) => {
  console.error('Unexpected error on idle dealer PostgreSQL client', err);
});
