import fs from 'fs';
import path from 'path';
import { config } from './config';

type StorageKind = 'in' | 'out' | 'log';

function dateParts(date: Date): { yyyy: string; mm: string; dd: string } {
  return {
    yyyy: date.getFullYear().toString(),
    mm: String(date.getMonth() + 1).padStart(2, '0'),
    dd: String(date.getDate()).padStart(2, '0'),
  };
}

export function jobDir(kind: StorageKind, jobId: string, createdAt?: Date): string {
  const d = createdAt || new Date();
  const { yyyy, mm, dd } = dateParts(d);
  return path.join(config.storageBase, kind, yyyy, mm, dd, jobId);
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function inputPath(jobId: string, ext: string, createdAt?: Date): string {
  const dir = jobDir('in', jobId, createdAt);
  ensureDir(dir);
  return path.join(dir, `source${ext}`);
}

export function outputPath(jobId: string, createdAt?: Date): string {
  const dir = jobDir('out', jobId, createdAt);
  ensureDir(dir);
  return path.join(dir, 'final.mp4');
}

export function logPath(jobId: string, createdAt?: Date): string {
  const dir = jobDir('log', jobId, createdAt);
  ensureDir(dir);
  return path.join(dir, 'ffmpeg.txt');
}

export function deleteJobDir(kind: StorageKind, jobId: string, createdAt: Date): void {
  const dir = jobDir(kind, jobId, createdAt);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Idempotent: ignore if already gone
  }
}
