<template>
  <div class="queue-item">
    <div class="queue-item__head">
      <div>
        <div class="queue-item__name">{{ item.name }}</div>
        <div class="minor-text">{{ formatSize(item.size) }}</div>
      </div>
      <span class="status-pill" :class="`status-pill--${item.status}`">{{ item.message || uploadStatusLabel(item.status) }}</span>
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
        {{ t('common.retry', '重试') }}
      </button>
      <button
        v-if="item.status === 'queued' || item.status === 'preparing' || item.status === 'uploading'"
        class="ui-btn ui-btn--danger"
        @click="$emit('cancel', item.id)"
      >
        {{ t('common.cancel', '取消') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { QueueUploadItem } from '@/types/plugin'
import { useI18n } from '@/utils/i18n'

defineProps<{
  item: QueueUploadItem
}>()

defineEmits<{
  (e: 'retry', id: string): void
  (e: 'cancel', id: string): void
}>()

const { t, uploadStatusLabel } = useI18n()

function formatSize(size: number) {
  if (size < 1024)
    return `${size} B`
  if (size < 1024 * 1024)
    return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}
</script>
