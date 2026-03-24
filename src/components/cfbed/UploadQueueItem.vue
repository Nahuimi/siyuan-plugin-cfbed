<template>
  <div class="queue-item">
    <div class="queue-item__head">
      <div>
        <div class="queue-item__name">{{ item.name }}</div>
        <div class="minor-text">{{ formatSize(item.size) }}</div>
      </div>
      <span class="status-pill" :class="`status-pill--${item.status}`">{{ item.message || item.status }}</span>
    </div>

    <div class="progress-bar">
      <div class="progress-bar__inner" :style="{ width: `${item.progress || 0}%` }" />
    </div>

    <div v-if="item.uploadedUrl" class="minor-text">{{ item.uploadedUrl }}</div>

    <div class="toolbar-row wrap">
      <button
        v-if="item.status === 'error' || item.status === 'cancelled'"
        class="header-btn"
        @click="$emit('retry', item.id)"
      >
        重试
      </button>
      <button
        v-if="item.status === 'queued' || item.status === 'preparing' || item.status === 'uploading'"
        class="ui-btn ui-btn--danger"
        @click="$emit('cancel', item.id)"
      >
        取消
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
export type QueueUploadItem = {
  id: string
  file: File
  name: string
  size: number
  status: 'idle' | 'queued' | 'preparing' | 'uploading' | 'success' | 'error' | 'cancelled'
  progress: number
  message: string
  uploadedUrl: string
}

defineProps<{
  item: QueueUploadItem
}>()

defineEmits<{
  (e: 'retry', id: string): void
  (e: 'cancel', id: string): void
}>()

function formatSize(size: number) {
  if (size < 1024)
    return `${size} B`
  if (size < 1024 * 1024)
    return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}
</script>
