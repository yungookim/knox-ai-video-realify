import { Worker, Job as BullJob } from 'bullmq';
import { config } from './config';
import db from './db';
import { probeVideo } from './probe';
import { outputPath, logPath } from './storage';
import { ResolvedParams, ProbeResult } from './types';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const AMBIENCE_DIR = path.resolve(__dirname, '../../ambience');

function updateJob(jobId: string, fields: Record<string, unknown>): void {
  const sets = Object.keys(fields)
    .map((k) => `${k} = @${k}`)
    .join(', ');
  const stmt = db.prepare(`UPDATE jobs SET ${sets} WHERE job_id = @job_id`);
  stmt.run({ ...fields, job_id: jobId });
}

function getAmbiencePath(type: string): string | null {
  const map: Record<string, string> = {
    room: 'room-tone.mp3',
    coffee: 'coffee-shop.mp3',
    street: 'street.mp3',
  };
  const filename = map[type];
  if (!filename) return null;
  const p = path.join(AMBIENCE_DIR, filename);
  return fs.existsSync(p) ? p : null;
}

function buildFfmpegArgs(
  inputFile: string,
  outputFile: string,
  params: ResolvedParams,
  probe: ProbeResult,
  logFile: string
): string[] {
  const args: string[] = ['-y', '-i', inputFile];

  // Determine scale
  let scaleFilter: string;
  if (probe.height >= probe.width) {
    // Portrait or square: target height 1080
    scaleFilter = 'scale=-2:1080';
  } else {
    // Landscape: target width 1920
    scaleFilter = 'scale=1920:-2';
  }

  // Build video filter chain
  const videoFilters: string[] = [scaleFilter];

  if (params.grain_strength > 0) {
    // Use noise filter for grain
    const strength = params.grain_strength;
    const temporal = params.grain_temporal ? ':t=1' : '';
    videoFilters.push(`noise=alls=${strength}:allf=t${temporal}`);
  }

  // Ambience mixing
  const ambiencePath = params.ambience_type !== 'off' ? getAmbiencePath(params.ambience_type) : null;

  if (ambiencePath && probe.hasAudio) {
    args.push('-stream_loop', '-1', '-i', ambiencePath);

    // Complex filter for audio mixing
    const ambienceGain = isFinite(params.ambience_gain_db) ? params.ambience_gain_db : -30;
    const audioFilter = [
      `[1:a]atrim=0:${probe.duration},asetpts=PTS-STARTPTS,highpass=f=200,volume=${ambienceGain}dB[amb]`,
      `[0:a][amb]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=${Math.pow(10, params.audio_peak_limit / 20).toFixed(4)}[aout]`,
    ].join(';');

    args.push('-filter_complex', `${videoFilters.join(',')};${audioFilter}`);
    args.push('-map', '0:v');
    args.push('-map', '[aout]');
  } else if (ambiencePath && !probe.hasAudio) {
    // No original audio, add ambience as main audio
    args.push('-stream_loop', '-1', '-i', ambiencePath);
    const ambienceGain = isFinite(params.ambience_gain_db) ? params.ambience_gain_db : -30;
    const audioFilter = `[1:a]atrim=0:${probe.duration},asetpts=PTS-STARTPTS,highpass=f=200,volume=${ambienceGain}dB,alimiter=limit=${Math.pow(10, params.audio_peak_limit / 20).toFixed(4)}[aout]`;

    args.push('-filter_complex', `${videoFilters.join(',')};${audioFilter}`);
    args.push('-map', '0:v');
    args.push('-map', '[aout]');
  } else {
    // No ambience
    args.push('-vf', videoFilters.join(','));
    if (probe.hasAudio) {
      args.push('-af', `alimiter=limit=${Math.pow(10, params.audio_peak_limit / 20).toFixed(4)}`);
    }
  }

  // Output codec settings
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '20');
  args.push('-c:a', 'aac', '-b:a', '192k');
  args.push('-movflags', '+faststart');
  args.push('-t', String(probe.duration));

  if (!probe.hasAudio && !ambiencePath) {
    args.push('-an');
  }

  args.push(outputFile);

  return args;
}

function buildCompressionArgs(inputFile: string, outputFile: string, bitrateTarget: number): string[] {
  return [
    '-y', '-i', inputFile,
    '-c:v', 'libx264', '-b:v', String(bitrateTarget),
    '-maxrate', String(Math.round(bitrateTarget * 1.2)),
    '-bufsize', String(Math.round(bitrateTarget * 2)),
    '-preset', 'fast',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    outputFile,
  ];
}

function runFfmpeg(args: string[], logFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    logStream.write(`\n--- ffmpeg ${args.join(' ')}\n`);

    const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });

    proc.stdout?.on('data', (d: Buffer) => logStream.write(d));
    proc.stderr?.on('data', (d: Buffer) => logStream.write(d));

    proc.on('close', (code) => {
      logStream.end();
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });

    proc.on('error', (err) => {
      logStream.end();
      reject(err);
    });
  });
}

async function processJob(jobId: string): Promise<void> {
  const row = db.prepare('SELECT * FROM jobs WHERE job_id = ?').get(jobId) as Record<string, unknown> | undefined;
  if (!row) throw new Error('Job not found');

  const inputFile = row.input_video_uri as string;
  const params: ResolvedParams = JSON.parse(row.params_resolved as string);
  const createdAt = new Date(row.created_at as string);
  const outFile = outputPath(jobId, createdAt);
  const logFile = logPath(jobId, createdAt);

  // Update log_uri
  updateJob(jobId, { log_uri: logFile });

  try {
    // Step 1: Probe (0-5%)
    updateJob(jobId, { status: 'processing', progress: 2 });
    const probe = await probeVideo(inputFile);

    // Validate codec
    const validCodecs = ['h264', 'hevc', 'h265'];
    if (!validCodecs.includes(probe.videoCodec)) {
      throw Object.assign(new Error(`Unsupported video codec: ${probe.videoCodec}`), {
        code: 'INVALID_FORMAT',
      });
    }

    if (probe.duration > config.maxDurationSeconds) {
      throw Object.assign(new Error(`Duration ${probe.duration}s exceeds max ${config.maxDurationSeconds}s`), {
        code: 'DURATION_LIMIT_EXCEEDED',
      });
    }

    updateJob(jobId, { progress: 5 });

    // Step 2: Video filters + audio mix (5-70%)
    const mainOutFile = params.compression_enabled
      ? outFile.replace('.mp4', '.pre-compress.mp4')
      : outFile;

    const ffmpegArgs = buildFfmpegArgs(inputFile, mainOutFile, params, probe, logFile);

    updateJob(jobId, { status: 'encoding', progress: 10 });
    await runFfmpeg(ffmpegArgs, logFile);
    updateJob(jobId, { progress: 70 });

    // Step 3: Compression pass (70-95%)
    if (params.compression_enabled) {
      updateJob(jobId, { progress: 75 });
      const compArgs = buildCompressionArgs(mainOutFile, outFile, params.compression_bitrate_target);
      await runFfmpeg(compArgs, logFile);
      // Clean up pre-compress file
      try { fs.unlinkSync(mainOutFile); } catch { /* ignore */ }
    }

    updateJob(jobId, { status: 'finalizing', progress: 95 });

    // Step 4: Finalize (95-100%)
    const stat = fs.statSync(outFile);
    const outProbe = await probeVideo(outFile);

    updateJob(jobId, {
      status: 'completed',
      progress: 100,
      output_video_uri: outFile,
      output_resolution: `${outProbe.width}x${outProbe.height}`,
      output_file_size: stat.size,
      output_duration: outProbe.duration,
    });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    updateJob(jobId, {
      status: 'failed',
      error_code: error.code || 'ENCODE_FAILED',
      error_message: error.message,
    });
  }
}

export function startWorker(): void {
  const worker = new Worker(
    'video-processing',
    async (job: BullJob) => {
      await processJob(job.data.jobId);
    },
    {
      connection: { host: config.redisHost, port: config.redisPort },
      concurrency: 1,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.data.jobId} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.data.jobId} failed:`, err.message);
  });

  console.log('Worker started, waiting for jobs...');
}
