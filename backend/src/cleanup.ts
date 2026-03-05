import db from './db';
import { config } from './config';
import { deleteJobDir } from './storage';

type CleanupKind = 'input' | 'output' | 'log';

interface CleanupConfig {
  kind: CleanupKind;
  storageKind: 'in' | 'out' | 'log';
  retentionDays: number;
  cleanedField: string;
}

const cleanupConfigs: CleanupConfig[] = [
  { kind: 'input', storageKind: 'in', retentionDays: config.retentionDaysInput, cleanedField: 'cleaned_input_at' },
  { kind: 'output', storageKind: 'out', retentionDays: config.retentionDaysOutput, cleanedField: 'cleaned_output_at' },
  { kind: 'log', storageKind: 'log', retentionDays: config.retentionDaysLogs, cleanedField: 'cleaned_log_at' },
];

function runCleanup(): void {
  console.log('Starting cleanup...');

  for (const cfg of cleanupConfigs) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - cfg.retentionDays);
    const cutoffStr = cutoff.toISOString();

    const rows = db.prepare(`
      SELECT job_id, created_at FROM jobs
      WHERE created_at < ?
        AND ${cfg.cleanedField} IS NULL
        AND status IN ('completed', 'failed', 'canceled')
    `).all(cutoffStr) as Array<{ job_id: string; created_at: string }>;

    for (const row of rows) {
      const createdAt = new Date(row.created_at);
      deleteJobDir(cfg.storageKind, row.job_id, createdAt);
      db.prepare(`UPDATE jobs SET ${cfg.cleanedField} = datetime('now') WHERE job_id = ?`).run(row.job_id);
      console.log(`Cleaned ${cfg.kind} for job ${row.job_id}`);
    }

    console.log(`${cfg.kind}: cleaned ${rows.length} jobs (retention: ${cfg.retentionDays} days)`);
  }

  console.log('Cleanup complete.');
}

runCleanup();
