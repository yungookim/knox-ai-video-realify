<script setup lang="ts">
import { ref, computed } from 'vue';

const emit = defineEmits<{
  submit: [file: File, params: {
    preset_id: string;
    grain: string;
    ambience_type: string;
    ambience_level: string;
    compression_enabled: boolean;
  }];
}>();

const file = ref<File | null>(null);
const dragging = ref(false);
const uploading = ref(false);

// Controls
const presetId = ref('ugc-light');
const grain = ref('low');
const ambienceType = ref('room');
const ambienceLevel = ref('low');
const compressionEnabled = ref(true);

const fileName = computed(() => file.value?.name || '');
const fileSize = computed(() => {
  if (!file.value) return '';
  const mb = file.value.size / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
});

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files?.[0]) {
    file.value = input.files[0];
  }
}

function handleDrop(e: DragEvent) {
  dragging.value = false;
  const dropped = e.dataTransfer?.files?.[0];
  if (dropped) {
    const ext = dropped.name.split('.').pop()?.toLowerCase();
    if (ext === 'mp4' || ext === 'mov') {
      file.value = dropped;
    }
  }
}

function submit() {
  if (!file.value || uploading.value) return;
  uploading.value = true;
  emit('submit', file.value, {
    preset_id: presetId.value,
    grain: grain.value,
    ambience_type: ambienceType.value,
    ambience_level: ambienceLevel.value,
    compression_enabled: compressionEnabled.value,
  });
}
</script>

<template>
  <div class="space-y-8">
    <!-- Drop zone -->
    <div
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="handleDrop"
      :class="[
        'border-2 border-dashed p-10 text-center transition-colors cursor-pointer',
        dragging ? 'border-white bg-gray-900' : 'border-gray-700 hover:border-gray-500',
        file ? 'border-gray-400 bg-gray-900/50' : ''
      ]"
      @click="($refs.fileInput as HTMLInputElement)?.click()"
    >
      <input
        ref="fileInput"
        type="file"
        accept=".mp4,.mov"
        class="hidden"
        @change="handleFileSelect"
      />
      <div v-if="!file">
        <svg class="w-12 h-12 mx-auto text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p class="text-gray-300 font-medium">Drop a video here or click to browse</p>
        <p class="text-gray-500 text-sm mt-2">MP4 or MOV &middot; H.264 / H.265 &middot; Max 2 min &middot; Max 500MB</p>
      </div>
      <div v-else>
        <svg class="w-10 h-10 mx-auto text-white mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <p class="text-gray-200 font-medium">{{ fileName }}</p>
        <p class="text-gray-500 text-sm mt-1">{{ fileSize }}</p>
        <p class="text-gray-400 text-xs mt-2">Click to change file</p>
      </div>
    </div>

    <!-- Settings -->
    <div v-if="file" class="bg-gray-900 border border-gray-800 p-6 space-y-6">
      <h2 class="text-lg font-semibold text-gray-200">Settings</h2>

      <!-- Preset -->
      <div>
        <label class="block text-sm font-medium text-gray-400 mb-2">Preset</label>
        <div class="flex gap-3">
          <button
            v-for="p in [{ id: 'ugc-light', label: 'UGC Light' }, { id: 'ugc-medium', label: 'UGC Medium' }]"
            :key="p.id"
            @click="presetId = p.id"
            :class="[
              'flex-1 py-2.5 px-4 text-sm font-medium transition-colors border',
              presetId === p.id
                ? 'bg-white border-white text-black'
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
            ]"
          >
            {{ p.label }}
          </button>
        </div>
      </div>

      <!-- Grain -->
      <div>
        <label class="block text-sm font-medium text-gray-400 mb-2">Grain</label>
        <div class="flex gap-2">
          <button
            v-for="g in [{ id: 'off', label: 'Off' }, { id: 'low', label: 'Low' }, { id: 'med', label: 'Med' }]"
            :key="g.id"
            @click="grain = g.id"
            :class="[
              'flex-1 py-2 px-3 text-sm transition-colors border',
              grain === g.id
                ? 'bg-white border-white text-black'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
            ]"
          >
            {{ g.label }}
          </button>
        </div>
      </div>

      <!-- Ambience -->
      <div>
        <label class="block text-sm font-medium text-gray-400 mb-2">Ambience</label>
        <div class="flex gap-2">
          <button
            v-for="a in [
              { id: 'off', label: 'Off' },
              { id: 'room', label: 'Room tone' },
              { id: 'coffee', label: 'Coffee shop' },
              { id: 'street', label: 'Street' }
            ]"
            :key="a.id"
            @click="ambienceType = a.id"
            :class="[
              'flex-1 py-2 px-3 text-sm transition-colors border',
              ambienceType === a.id
                ? 'bg-white border-white text-black'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
            ]"
          >
            {{ a.label }}
          </button>
        </div>
      </div>

      <!-- Ambience Level -->
      <div v-if="ambienceType !== 'off'">
        <label class="block text-sm font-medium text-gray-400 mb-2">Ambience Level</label>
        <div class="flex gap-2">
          <button
            v-for="l in [{ id: 'low', label: 'Low' }, { id: 'med', label: 'Med' }]"
            :key="l.id"
            @click="ambienceLevel = l.id"
            :class="[
              'flex-1 py-2 px-3 text-sm transition-colors border',
              ambienceLevel === l.id
                ? 'bg-white border-white text-black'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
            ]"
          >
            {{ l.label }}
          </button>
        </div>
      </div>

      <!-- Compression -->
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-gray-400">Compression Pass</p>
          <p class="text-xs text-gray-600 mt-0.5">Mimics social platform compression</p>
        </div>
        <button
          @click="compressionEnabled = !compressionEnabled"
          :class="[
            'relative inline-flex h-6 w-11 items-center transition-colors',
            compressionEnabled ? 'bg-white' : 'bg-gray-700'
          ]"
        >
          <span
            :class="[
              'inline-block h-4 w-4 transform transition-transform',
              compressionEnabled ? 'bg-black' : 'bg-gray-400',
              compressionEnabled ? 'translate-x-6' : 'translate-x-1'
            ]"
          />
        </button>
      </div>

      <!-- Submit -->
      <button
        @click="submit"
        :disabled="uploading"
        class="w-full py-3 px-6 bg-white hover:bg-gray-200 text-black disabled:bg-gray-700 disabled:text-gray-500 font-medium transition-colors"
      >
        {{ uploading ? 'Uploading...' : 'Process Video' }}
      </button>
    </div>
  </div>
</template>
