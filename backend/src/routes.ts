import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { Queue } from 'bullmq';
import { config } from './config';
import db from './db';
import { inputPath } from './storage';
import { resolveParams } from './presets';
import { probeVideo } from './probe';
import { JobParams, Job, PresetId, GrainLevel, AmbienceType, AmbienceLevel } from './types';

const router = Router();

const queue = new Queue('video-processing', {
  connection: { host: config.redisHost, port: config.redisPort },
});

// Multer for file uploads
const upload = multer({
  dest: path.join(config.storageBase, 'tmp'),
  limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.mp4', '.mov'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('INVALID_FORMAT: Only MP4 and MOV files are supported'));
    }
  },
});

// POST /api/jobs - Upload video and create processing job
router.post('/api/jobs', upload.single('video'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      console.warn('[upload] No video file in request');
      res.status(400).json({ error: 'No video file provided' });
      return;
    }

    const jobId = uuidv4();
    const ext = path.extname(req.file.originalname).toLowerCase();

    console.log(`[upload] jobId=${jobId} file="${req.file.originalname}" size=${req.file.size} ext=${ext}`);

    // Parse params from body
    const presetId: PresetId = req.body.preset_id === 'ugc-medium' ? 'ugc-medium' : 'ugc-light';
    const grain: GrainLevel = ['off', 'low', 'med'].includes(req.body.grain) ? req.body.grain : 'low';
    const ambienceType: AmbienceType = ['off', 'room', 'coffee', 'street'].includes(req.body.ambience_type)
      ? req.body.ambience_type
      : 'room';
    const ambienceLevel: AmbienceLevel = ['low', 'med'].includes(req.body.ambience_level)
      ? req.body.ambience_level
      : 'low';
    const compressionEnabled = req.body.compression_enabled !== 'false' && req.body.compression_enabled !== false;

    // Move file to proper storage path
    const destPath = inputPath(jobId, ext);
    fs.renameSync(req.file.path, destPath);

    // Probe and validate
    console.log(`[upload] jobId=${jobId} probing file: ${destPath}`);
    let probe;
    try {
      probe = await probeVideo(destPath);
      console.log(`[upload] jobId=${jobId} probe result: ${probe.width}x${probe.height} ${probe.videoCodec} ${probe.duration}s hasAudio=${probe.hasAudio}`);
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`[upload] jobId=${jobId} probe failed:`, error.message, error.stack);
      // Clean up uploaded file
      try { fs.unlinkSync(destPath); } catch { /* ignore */ }
      if (error.message === 'NO_VIDEO_STREAM') {
        res.status(400).json({ error: 'NO_VIDEO_STREAM', message: 'File does not contain a video stream' });
        return;
      }
      res.status(400).json({ error: 'INVALID_FORMAT', message: `Could not read video file: ${error.message}` });
      return;
    }

    if (probe.duration > config.maxDurationSeconds) {
      console.warn(`[upload] jobId=${jobId} duration ${probe.duration}s exceeds max ${config.maxDurationSeconds}s`);
      try { fs.unlinkSync(destPath); } catch { /* ignore */ }
      res.status(400).json({
        error: 'DURATION_LIMIT_EXCEEDED',
        message: `Max 2 minutes. Your video is ${Math.round(probe.duration)} seconds.`,
      });
      return;
    }

    const validCodecs = ['h264', 'hevc', 'h265'];
    if (!validCodecs.includes(probe.videoCodec)) {
      console.warn(`[upload] jobId=${jobId} unsupported codec: ${probe.videoCodec}`);
      try { fs.unlinkSync(destPath); } catch { /* ignore */ }
      res.status(400).json({
        error: 'INVALID_FORMAT',
        message: `Unsupported video codec: ${probe.videoCodec}. Supported: H.264, H.265`,
      });
      return;
    }

    // Resolve params
    const resolved = resolveParams(presetId, grain, ambienceType, ambienceLevel, compressionEnabled);

    // Create job in DB
    console.log(`[upload] jobId=${jobId} inserting into DB, preset=${presetId} grain=${grain} ambience=${ambienceType}/${ambienceLevel} compression=${compressionEnabled}`);
    db.prepare(`
      INSERT INTO jobs (job_id, status, progress, input_video_uri, preset_id, preset_version, params_resolved)
      VALUES (?, 'queued', 0, ?, ?, ?, ?)
    `).run(jobId, destPath, resolved.preset_id, resolved.preset_version, JSON.stringify(resolved));

    // Queue the job
    console.log(`[upload] jobId=${jobId} adding to queue`);
    await queue.add('process', { jobId }, { jobId });

    console.log(`[upload] jobId=${jobId} created successfully`);
    res.status(201).json({ job_id: jobId });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error creating job:', error);
    if (error.message.startsWith('INVALID_FORMAT')) {
      res.status(400).json({ error: 'INVALID_FORMAT', message: error.message });
      return;
    }
    res.status(500).json({ error: 'INTERNAL', message: 'Failed to create job' });
  }
});

// GET /api/jobs/:jobId - Get job status
router.get('/api/jobs/:jobId', (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM jobs WHERE job_id = ?').get(req.params.jobId) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Job not found' });
    return;
  }

  const job: Partial<Job> = {
    job_id: row.job_id as string,
    created_at: row.created_at as string,
    status: row.status as Job['status'],
    progress: row.progress as number,
    preset_id: row.preset_id as PresetId,
    error_code: (row.error_code as string) || null,
    error_message: (row.error_message as string) || null,
    output_resolution: (row.output_resolution as string) || null,
    output_file_size: (row.output_file_size as number) || null,
    output_duration: (row.output_duration as number) || null,
  };

  res.json(job);
});

// GET /api/jobs/:jobId/download - Download output
router.get('/api/jobs/:jobId/download', (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM jobs WHERE job_id = ?').get(req.params.jobId) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Job not found' });
    return;
  }

  if (row.status !== 'completed' || !row.output_video_uri) {
    res.status(400).json({ error: 'NOT_READY', message: 'Job output is not ready' });
    return;
  }

  const filePath = row.output_video_uri as string;
  if (!fs.existsSync(filePath)) {
    res.status(410).json({ error: 'FILE_GONE', message: 'Output file has been cleaned up' });
    return;
  }

  res.download(filePath, `realify-${row.job_id}.mp4`);
});

export default router;
