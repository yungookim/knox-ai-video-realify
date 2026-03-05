export type JobStatus =
  | 'created'
  | 'queued'
  | 'processing'
  | 'encoding'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'canceled';

export type GrainLevel = 'off' | 'low' | 'med';
export type AmbienceType = 'off' | 'room' | 'coffee' | 'street';
export type AmbienceLevel = 'low' | 'med';
export type PresetId = 'ugc-light' | 'ugc-medium';

export interface JobParams {
  preset_id: PresetId;
  grain: GrainLevel;
  ambience_type: AmbienceType;
  ambience_level: AmbienceLevel;
  compression_enabled: boolean;
}

export interface ResolvedParams {
  preset_id: PresetId;
  preset_version: number;
  grain_strength: number;
  grain_temporal: boolean;
  ambience_type: AmbienceType;
  ambience_gain_db: number;
  compression_enabled: boolean;
  compression_bitrate_target: number;
  scale_policy: 'portrait-1080h' | 'landscape-1920w';
  fps_policy: 'keep' | 'cap-60';
  audio_peak_limit: number;
}

export interface Job {
  job_id: string;
  created_at: string;
  status: JobStatus;
  progress: number;
  input_video_uri: string;
  output_video_uri: string | null;
  log_uri: string | null;
  preset_id: PresetId;
  preset_version: number;
  params_resolved: ResolvedParams;
  error_code: string | null;
  error_message: string | null;
  cleaned_input_at: string | null;
  cleaned_output_at: string | null;
  cleaned_log_at: string | null;
  output_resolution: string | null;
  output_file_size: number | null;
  output_duration: number | null;
}

export interface ProbeResult {
  duration: number;
  width: number;
  height: number;
  videoCodec: string;
  audioCodec: string | null;
  hasAudio: boolean;
  fps: number;
}
