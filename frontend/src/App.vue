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
          <span class="text-indigo-400">Realify</span>
          <span class="text-gray-500 text-sm font-normal ml-2">UGC Video Post-Processor</span>
        </h1>
      </div>
    </header>

    <main class="flex-1 px-6 py-10">
      <div class="max-w-2xl mx-auto">
        <UploadForm
          v-if="step === 'upload'"
          @submit="handleSubmit"
        />

        <JobProgress
          v-if="step === 'processing' && jobStatus"
          :status="jobStatus"
        />
        <div v-if="step === 'processing' && !jobStatus" class="text-center py-20">
          <div class="inline-block w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
          <p class="mt-4 text-gray-400">Submitting job...</p>
        </div>

        <JobResult
          v-if="step === 'done' && jobStatus"
          :status="jobStatus"
          :job-id="jobId"
          @reset="reset"
        />

        <div v-if="step === 'error'" class="text-center py-20">
          <div class="bg-red-900/30 border border-red-700 rounded-lg p-6 max-w-md mx-auto">
            <p class="text-red-300 font-medium">Error</p>
            <p class="text-red-400 mt-2 text-sm">{{ errorMessage }}</p>
            <button
              @click="reset"
              class="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
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
