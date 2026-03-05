import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.resolve(__dirname, '../../data.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    job_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'created',
    progress INTEGER NOT NULL DEFAULT 0,
    input_video_uri TEXT NOT NULL,
    output_video_uri TEXT,
    log_uri TEXT,
    preset_id TEXT NOT NULL,
    preset_version INTEGER NOT NULL,
    params_resolved TEXT NOT NULL,
    error_code TEXT,
    error_message TEXT,
    cleaned_input_at TEXT,
    cleaned_output_at TEXT,
    cleaned_log_at TEXT,
    output_resolution TEXT,
    output_file_size INTEGER,
    output_duration REAL
  );
`);

export default db;
