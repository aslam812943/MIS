import pg from 'pg';

const connectionString = 'postgresql://postgres.ghkahwtmwnddwbnqeidl:q6FNW12pcjUt2nQc@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';
const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT count(*) FROM 
