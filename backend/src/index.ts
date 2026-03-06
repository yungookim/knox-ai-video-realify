import express from 'express';
import cors from 'cors';
import path from 'path';
import { execSync } from 'child_process';
import { config } from './config';
import routes from './routes';
import { startWorker } from './worker';
import { ensureDir } from './storage';

// Check for ffmpeg/ffprobe at startup
for (const bin of ['ffmpeg', 'ffprobe']) {
  try {
    execSync(`which ${bin}`, { stdio: 'pipe' });
    console.log(`[startup] ${bin} found`);
  } catch {
    console.error(`[startup] ERROR: "${bin}" not found in PATH. Install ffmpeg: https://ffmpeg.org/download.html`);
    console.error(`[startup] On macOS: brew install ffmpeg`);
    console.error(`[startup] On Ubuntu: sudo apt install ffmpeg`);
    process.exit(1);
  }
}

const app = express();

app.use(cors());
app.use(express.json());

// Ensure storage directories exist
ensureDir(path.join(config.storageBase, 'tmp'));

// Serve frontend in production
if (config.nodeEnv === 'production') {
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
}

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[http] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// API routes
app.use(routes);

// Catch-all for SPA in production
if (config.nodeEnv === 'production') {
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Error handling for multer and other middleware errors
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[error] Middleware error: ${err.message}`);
  if (err.message.startsWith('INVALID_FORMAT')) {
    res.status(400).json({ error: 'INVALID_FORMAT', message: err.message });
    return;
  }
  if (err.message.includes('File too large')) {
    console.warn(`[error] File too large (max ${config.maxFileSizeMb}MB)`);
    res.status(400).json({ error: 'FILE_TOO_LARGE', message: `Max file size is ${config.maxFileSizeMb}MB` });
    return;
  }
  console.error('[error] Unhandled error stack:', err.stack);
  res.status(500).json({ error: 'INTERNAL', message: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});

// Start worker in same process for v1
startWorker();
