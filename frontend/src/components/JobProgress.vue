<script setup lang="ts">
import { computed } from 'vue';
import type { JobStatus } from '../api';

const props = defineProps<{ status: JobStatus }>();

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    created: 'Created',
    queued: 'Queued',
    processing: 'Processing',
    encoding: 'Encoding',
    finalizing: 'Finalizing',
    completed: 'Done',
    failed: 'Failed',
  };
  return map[props.status.status] || props.status.status;
});

const progressText = computed(() => {
  if (props.status.progress <= 5) return 'Analyzing video...';
  if (props.status.progress <= 40) return 'Applying video filters...';
  if (props.status.progress <= 70) return 'Mixing audio...';
  if (props.status.progress <= 95) return 'Encoding output...';
  return 'Finalizing...';
});
</script>

<template>
  <div class="text-center py-16">
    <div class="inline-block w-10 h-10 border-2 border-white border-t-transparent animate-spin mb-6"></div>

    <div class="space-y-4">
      <div>
        <span class="inline-block px-3 py-1 bg-gray-900 border border-gray-600 text-white text-sm font-medium">
          {{ statusLabel }}
        </span>
      </div>

      <p class="text-gray-400 text-sm">{{ progressText }}</p>

      <!-- Progress bar -->
      <div class="max-w-md mx-auto">
        <div class="bg-gray-800 h-2 overflow-hidden">
          <div
            class="bg-white h-full transition-all duration-500 ease-out"
            :style="{ width: `${status.progress}%` }"
          ></div>
        </div>
        <p class="text-gray-600 text-xs mt-2">{{ status.progress }}%</p>
      </div>
    </div>
  </div>
</template>
