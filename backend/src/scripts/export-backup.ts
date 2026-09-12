import { supabaseAdmin } from '../config/supabase';
import * as fs from 'fs';
import * as path from 'path';

const KNOWN_TABLES = [
  'profiles',
  'branches',
  'departments',
  'modules',
  'user_allowed_modules',
  'data_entries',
  'data_entry_audits',
  'tasks',
  'notifications',
  'iepf_claims',
  'it_assets',
  'it_asset_inventory',
  'it_amc_contracts',
  'it_audits',
  'it_audit_findings',
  'it_audit_schedule',
  'hr_documents',
  'hr_open_positions',
  'hr_policies',
  'hr_employees',
  'sales_records',
  'sales_targets',
  'settlements_records',
  'kyc_records',
  'dp_records',
  'ra_clients',
  'ra_packages',
  'ra_testimonials',
  'social_media_posts',
  'social_media_campaigns',
  'social_media_analytics',
  'audit_logs'
];

async function exportFullBackup() {
  console.log('=====================================================');
  console.log('📦 STARTING FULL SUPABASE DATABASE BACKUP EXPORT');
  console.log('=====================================================\n');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDirName = `MIS_Database_Backup_${timestamp}`;
  const backupDirPath = path.join(process.cwd(), 'backups', backupDirName);

  if (!fs.existsSync(backupDirPath)) {
    fs.mkdirSync(backupDirPath, { recursive: true });
  }

  const jsonDir = path.join(backupDirPath, 'json');
  fs.mkdirSync(jsonDir, { recursive: true });

  const summary: { table: string; rowCount: number; status: string }[] = [];
  let fullSqlDump = `-- MIS Portal Full Database Backup\n-- Exported At: ${new Date().toISOString()}\n-- Project: riucsbxolrkitdzmqdjg.supabase.co\n\n`;

  for (const tableName of KNOWN_TABLES) {
    try {
      const { data, error } = await supabaseAdmin
        .from(tableName)
        .select('*');

      if (error) {
        if (error.message.includes('does not exist') || error.message.includes('schema cache')) {
          // Table doesn't exist yet in project
          continue;
        }
        console.warn(`⚠️ Warning fetching ${tableName}: ${error.message}`);
        summary.push({ table: tableName, rowCount: 0, status: `Error: ${error.message}` });
        continue;
      }

      const rows = data || [];
      summary.push({ table: tableName, rowCount: rows.length, status: 'SUCCESS' });

      // 1. Save JSON dump
      const jsonFilePath = path.join(jsonDir, `${tableName}.json`);
      fs.writeFileSync(jsonFilePath, JSON.stringify(rows, null, 2), 'utf8');

      // 2. Generate SQL Insert Statements
      if (rows.length > 0) {
        fullSqlDump += `-- ==========================================\n`;
        fullSqlDump += `-- Table: ${tableName} (${rows.length} rows)\n`;
        fullSqlDump += `-- ==========================================\n`;

        for (const row of rows) {
          const keys = Object.keys(row);
          const escapedValues = keys.map(k => {
            const val = row[k];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number' || typeof val === 'boolean') return val;
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
            return `'${String(val).replace(/'/g, "''")}'`;
          });

          fullSqlDump += `INSERT INTO public.${tableName} (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${escapedValues.join(', ')}) ON CONFLICT DO NOTHING;\n`;
        }
        fullSqlDump += `\n`;
      }

      console.log(`✅ Exported table [${tableName}]: ${rows.length} rows`);
    } catch (err: any) {
      console.warn(`Error on table ${tableName}: ${err.message}`);
    }
  }

  // Write full SQL dump file
  const sqlDumpPath = path.join(backupDirPath, 'full_database_dump.sql');
  fs.writeFileSync(sqlDumpPath, fullSqlDump, 'utf8');

  // Write Summary Manifest
  const manifest = {
    exportDate: new Date().toISOString(),
    projectUrl: 'https://riucsbxolrkitdzmqdjg.supabase.co',
    totalTables: summary.length,
    totalRows: summary.reduce((sum, s) => sum + s.rowCount, 0),
    tables: summary
  };

  const manifestPath = path.join(backupDirPath, 'backup_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log('\n=====================================================');
  console.log('🎉 FULL DATABASE BACKUP EXPORT COMPLETED SUCCESSFULLY!');
  console.log('=====================================================');
  console.log(`📁 Backup Directory: ${backupDirPath}`);
  console.log(`📄 SQL Dump:         ${sqlDumpPath}`);
  console.log(`📊 Total Tables:     ${manifest.totalTables}`);
  console.log(`🔢 Total Rows:       ${manifest.totalRows}`);
  console.log('=====================================================\n');
}

exportFullBackup().catch(err => {
  console.error('❌ Backup failed:', err);
  process.exit(1);
});
