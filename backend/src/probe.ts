import ffmpeg from 'fluent-ffmpeg';
import { ProbeResult } from './types';

export function probeVideo(filePath: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);

      const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
      const audioStream = metadata.streams.find((s) => s.codec_type === 'audio');

      if (!videoStream) {
        return reject(new Error('NO_VIDEO_STREAM'));
      }

      const duration = metadata.format.duration || 0;
      const videoCodec = (videoStream.codec_name || '').toLowerCase();

      resolve({
        duration,
        width: videoStream.width || 0,
        height: videoStream.height || 0,
        videoCodec,
        audioCodec: audioStream ? (audioStream.codec_name || null) : null,
        hasAudio: !!audioStream,
        fps: parseFloat(String(videoStream.r_frame_rate || '30').split('/')[0]) /
             parseFloat(String(videoStream.r_frame_rate || '30').split('/')[1] || '1'),
      });
    });
  });
}
