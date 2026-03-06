<script setup lang="ts">
import { computed } from 'vue';
import type { JobStatus } from '../api';
import { getDownloadUrl } from '../api';

const props = defineProps<{ status: JobStatus; jobId: string }>();
const emit = defineEmits<{ reset: [] }>();

const downloadUrl = computed(() => getDownloadUrl(props.jobId));

const fileSizeFormatted = computed(() => {
  if (!props.status.output_file_size) return '-';
  const mb = props.status.output_file_size / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
});

const durationFormatted = computed(() => {
  if (!props.status.output_duration) return '-';
  const s = Math.round(props.status.output_duration);
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
});
</script>

<template>
  <div class="text-center py-12">
    <svg class="w-14 h-14 mx-auto text-white mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>

    <h2 class="text-xl font-semibold text-gray-100 mb-2">Processing Complete</h2>
    <p class="text-gray-500 text-sm mb-8">Your video has been processed and is ready to download.</p>

    <!-- Output details -->
    <div class="bg-gray-900 border border-gray-800 p-6 max-w-sm mx-auto mb-8">
      <div class="grid grid-cols-3 gap-4 text-center">
        <div>
          <p class="text-gray-500 text-xs uppercase tracking-wide">Resolution</p>
          <p class="text-gray-200 font-medium mt-1">{{ status.output_resolution || '-' }}</p>
        </div>
        <div>
          <p class="text-gray-500 text-xs uppercase tracking-wide">Size</p>
          <p class="text-gray-200 font-medium mt-1">{{ fileSizeFormatted }}</p>
        </div>
        <div>
          <p class="text-gray-500 text-xs uppercase tracking-wide">Duration</p>
          <p class="text-gray-200 font-medium mt-1">{{ durationFormatted }}</p>
        </div>
      </div>
    </div>

    <div class="flex gap-3 justify-center">
      <a
        :href="downloadUrl"
        class="px-6 py-3 bg-white hover:bg-gray-200 text-black font-medium transition-colors inline-block"
      >
        Download MP4
      </a>
      <button
        @click="emit('reset')"
        class="px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 font-medium transition-colors"
      >
        Process Another
      </button>
    </div>
  </div>
</template>
