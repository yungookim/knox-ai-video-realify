import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  return v ? parseInt(v, 10) : fallback;
}

function envStr(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const config = {
  port: envInt('PORT', 3000),
  nodeEnv: envStr('NODE_ENV', 'development'),
  storageDriver: envStr('STORAGE_DRIVER', 'local'),
  storageBase: path.resolve(envStr('STORAGE_BASE', './media')),
  redisHost: envStr('REDIS_HOST', '127.0.0.1'),
  redisPort: envInt('REDIS_PORT', 6379),
  maxFileSizeMb: envInt('MAX_FILE_SIZE_MB', 500),
  maxDurationSeconds: envInt('MAX_DURATION_SECONDS', 120),
  retentionDaysInput: envInt('RETENTION_DAYS_INPUT', 7),
  retentionDaysOutput: envInt('RETENTION_DAYS_OUTPUT', 14),
  retentionDaysLogs: envInt('RETENTION_DAYS_LOGS', 14),
  cleanupIntervalHours: envInt('CLEANUP_INTERVAL_HOURS', 24),
};
