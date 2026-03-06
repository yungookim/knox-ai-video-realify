<script setup lang="ts">
import { ref } from 'vue';
import UploadForm from './components/UploadForm.vue';
import JobProgress from './components/JobProgress.vue';
import JobResult from './components/JobResult.vue';
import { createJob, getJobStatus, type JobStatus } from './api';

const step = ref<'upload' | 'processing' | 'done' | 'error'>('upload');
const jobId = ref('');
const jobStatus = ref<JobStatus | null>(null);
const errorMessage = ref('');
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function handleSubmit(file: File, params: {
  preset_id: string;
  grain: string;
  ambience_type: string;
  ambience_level: string;
  compression_enabled: boolean;
}) {
  try {
    errorMessage.value = '';
    const result = await createJob(file, params);
    jobId.value = result.job_id;
    step.value = 'processing';
    startPolling();
  } catch (err: unknown) {
    errorMessage.value = (err as Error).message;
    step.value = 'error';
  }
}

function startPolling() {
  pollTimer = setInterval(async () => {
    try {
      const status = await getJobStatus(jobId.value);
      jobStatus.value = status;

      if (status.status === 'completed') {
        stopPolling();
        step.value = 'done';
      } else if (status.status === 'failed') {
        stopPolling();
        errorMessage.value = status.error_message || 'Processing failed';
        step.value = 'error';
      }
    } catch {
      // Ignore transient poll errors
    }
  }, 1500);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function reset() {
  stopPolling();
  step.value = 'upload';
  jobId.value = '';
  jobStatus.value = null;
  errorMessage.value = '';
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <header class="border-b border-gray-800 px-6 py-4">
      <div class="max-w-2xl mx-auto flex items-center justify-between">
        <h1 class="text-xl font-bold tracking-tight">
          <span class="text-white">Realify</span>
          <span class="text-gray-500 text-sm font-normal ml-2">UGC Video Post-Processor</span>
        </h1>
        <a href="https://github.com/yungookim/knox-ai-video-realify" target="_blank" rel="noopener" class="text-gray-500 hover:text-white transition-colors">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
        </a>
      </div>
    </header>

    <main class="flex-1 px-6 py-10">
      <div class="max-w-2xl mx-auto">
        <p class="text-gray-500 text-sm mb-8">Upload AI-generated videos to make them feel more like natural UGC content by applying subtle film grain, ambient audio beds, 1080p export, and optional social-like compression. Inspired by <a href="https://x.com/dygk_0x1/status/2029665030430453872" target="_blank" rel="noopener" class="text-gray-400 underline hover:text-white">this post</a>.</p>

        <UploadForm
          v-if="step === 'upload'"
          @submit="handleSubmit"
        />

        <JobProgress
          v-if="step === 'processing' && jobStatus"
          :status="jobStatus"
        />
        <div v-if="step === 'processing' && !jobStatus" class="text-center py-20">
          <div class="inline-block w-8 h-8 border-2 border-white border-t-transparent animate-spin"></div>
          <p class="mt-4 text-gray-400">Submitting job...</p>
        </div>

        <JobResult
          v-if="step === 'done' && jobStatus"
          :status="jobStatus"
          :job-id="jobId"
          @reset="reset"
        />

        <div v-if="step === 'error'" class="text-center py-20">
          <div class="bg-gray-900 border border-gray-600 p-6 max-w-md mx-auto">
            <p class="text-white font-medium">Error</p>
            <p class="text-gray-400 mt-2 text-sm">{{ errorMessage }}</p>
            <button
              @click="reset"
              class="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    </main>

    <footer class="border-t border-gray-800 px-6 py-4 text-center text-gray-600 text-xs">
      Supported: MP4, MOV (H.264 / H.265) &middot; Max 2 minutes &middot; Max 500MB
    </footer>
  </div>
</template>
