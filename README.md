# Realify - UGC Video Post-Processor

A web app that processes uploaded videos to feel more like native UGC content by applying subtle film grain, ambient audio beds, 1080p export, and optional social-like compression.

## Prerequisites

- **Node.js** >= 18
- **FFmpeg** (with libx264, libmp3lame)
- **Redis** (for job queue)
- **Docker** (optional, for Redis)

## Quick Start

```bash
# 1. Start Redis (using Docker)
docker compose up -d

# 2. Install dependencies
npm install

# 3. Generate ambience audio files
./scripts/generate-ambience.sh

# 4. Copy environment config
cp .env.example .env

# 5. Start dev server (backend + frontend)
npm run dev
```

The frontend runs at `http://localhost:5173` and proxies API requests to the backend on port 3000.

## Architecture

```
frontend/     Vue 3 + TypeScript + Tailwind CSS (Vite)
backend/      Express + TypeScript + BullMQ worker
ambience/     Generated ambient audio files (room tone, coffee shop, street)
```

### Processing Pipeline

1. **Upload & Validate** - accepts MP4/MOV (H.264/H.265), max 2 min, max 500MB
2. **Probe** - ffprobe extracts metadata
3. **Video Filters** - scale to 1080p, apply grain (temporal noise)
4. **Audio Mix** - layer ambience bed under original audio with HPF + limiter
5. **Compression Pass** - optional re-encode mimicking social platform compression
6. **Output** - MP4 (H.264 + AAC), compatible with iOS Safari, Android Chrome, desktop

### Presets

| Preset | Grain | Compression Target |
|--------|-------|--------------------|
| UGC Light | Subtle (3-6) | 4 Mbps |
| UGC Medium | Moderate (5-10) | 2.5 Mbps |

### Storage

Files are stored in date-partitioned directories:
```
media/in/YYYY/MM/DD/{jobId}/source.mp4
media/out/YYYY/MM/DD/{jobId}/final.mp4
media/log/YYYY/MM/DD/{jobId}/ffmpeg.txt
```

### Cleanup

Run `npm run cleanup` to remove expired files based on retention settings in `.env`.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/jobs` | Upload video + create processing job |
| GET | `/api/jobs/:id` | Get job status and progress |
| GET | `/api/jobs/:id/download` | Download processed output |

## Production Build

```bash
npm run build
NODE_ENV=production npm start
```
