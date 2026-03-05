import { PresetId, GrainLevel, AmbienceType, AmbienceLevel, ResolvedParams } from './types';

const PRESET_VERSION = 1;

interface PresetBase {
  grain_strength_map: Record<GrainLevel, number>;
  ambience_gain_map: Record<AmbienceLevel, number>;
  compression_bitrate_target: number;
  audio_peak_limit: number;
}

const presetDefs: Record<PresetId, PresetBase> = {
  'ugc-light': {
    grain_strength_map: { off: 0, low: 3, med: 6 },
    ambience_gain_map: { low: -28, med: -22 },
    compression_bitrate_target: 4_000_000,
    audio_peak_limit: -1.0,
  },
  'ugc-medium': {
    grain_strength_map: { off: 0, low: 5, med: 10 },
    ambience_gain_map: { low: -24, med: -18 },
    compression_bitrate_target: 2_500_000,
    audio_peak_limit: -1.0,
  },
};

export function resolveParams(
  presetId: PresetId,
  grain: GrainLevel,
  ambienceType: AmbienceType,
  ambienceLevel: AmbienceLevel,
  compressionEnabled: boolean
): ResolvedParams {
  const base = presetDefs[presetId];
  return {
    preset_id: presetId,
    preset_version: PRESET_VERSION,
    grain_strength: base.grain_strength_map[grain],
    grain_temporal: true,
    ambience_type: ambienceType,
    ambience_gain_db: ambienceType === 'off' ? -Infinity : base.ambience_gain_map[ambienceLevel],
    compression_enabled: compressionEnabled,
    compression_bitrate_target: base.compression_bitrate_target,
    scale_policy: 'portrait-1080h', // resolved at processing time based on actual dimensions
    fps_policy: 'keep',
    audio_peak_limit: base.audio_peak_limit,
  };
}
