export interface JobStatus {
  job_id: string;
  created_at: string;
  status: string;
  progress: number;
  preset_id: string;
  error_code: string | null;
  error_message: string | null;
  output_resolution: string | null;
  output_file_size: number | null;
  output_duration: number | null;
}

export async function createJob(
  file: File,
  params: {
    preset_id: string;
    grain: string;
    ambience_type: string;
    ambience_level: string;
    compression_enabled: boolean;
  }
): Promise<{ job_id: string }> {
  const formData = new FormData();
  formData.append('video', file);
  formData.append('preset_id', params.preset_id);
  formData.append('grain', params.grain);
  formData.append('ambience_type', params.ambience_type);
  formData.append('ambience_level', params.ambience_level);
  formData.append('compression_enabled', String(params.compression_enabled));

  console.log('[api] POST /api/jobs', { fileName: file.name, fileSize: file.size, ...params });
  const res = await fetch('/api/jobs', { method: 'POST', body: formData });
  if (!res.ok) {
    const body = await res.json();
    console.error('[api] POST /api/jobs failed:', res.status, body);
    throw new Error(body.message || body.error || 'Upload failed');
  }
  const result = await res.json();
  console.log('[api] Job created:', result.job_id);
  return result;
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const res = await fetch(`/api/jobs/${jobId}`);
  if (!res.ok) {
    console.error(`[api] GET /api/jobs/${jobId} failed:`, res.status);
    throw new Error('Failed to fetch job status');
  }
  return res.json();
}

export function getDownloadUrl(jobId: string): string {
  return `/api/jobs/${jobId}/download`;
}
