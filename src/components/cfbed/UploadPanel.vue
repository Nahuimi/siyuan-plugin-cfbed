<template>
  <section class="section-card glass-card upload-panel-section">
    <div class="section-head upload-panel-head">
      <div>
        <div class="section-title">上传图片</div>
        <div class="section-desc">拖拽或选择图片后加入队列，支持并发上传、失败重试与日志追踪。</div>
      </div>

      <div class="toolbar-row wrap">
        <span class="summary-badge">总数 {{ summary.total }}</span>
        <span class="summary-badge">成功 {{ summary.success }}</span>
        <span class="summary-badge">失败 {{ summary.error }}</span>
        <span class="summary-badge">运行中 {{ summary.uploading }}</span>
      </div>
    </div>

    <div class="upload-panel-grid">
      <div
        class="upload-dropzone upload-dropzone--hero"
        :class="{ 'upload-dropzone--dragging': isDragging }"
        @dragenter.prevent="$emit('drag-state', true)"
        @dragover.prevent
        @dragleave.prevent="$emit('drag-state', false)"
        @drop.prevent="$emit('drop', $event)"
      >
        <div class="upload-dropzone__icon">📤</div>
        <div class="upload-dropzone__title">拖拽图片到此处上传</div>
        <div class="minor-text">支持 png / jpg / gif / webp 等图片文件</div>

        <label class="upload-input-trigger">
          <input type="file" accept="image/*" multiple @change="$emit('files-change', $event)">
          <span>选择图片</span>
        </label>
      </div>

      <div class="upload-control-card">
        <label class="field upload-control-card__field">
          <span class="field-card__label">并发数</span>
          <input
            class="sy-input"
            type="number"
            min="1"
            max="10"
            :value="uploadConcurrency"
            @input="$emit('update:concurrency', Number(($event.target as HTMLInputElement).value))"
          >
        </label>

        <div class="upload-control-card__actions">
          <SyButton class="ui-btn ui-btn--primary" :disabled="queueUploading" @click="$emit('upload')">
            {{ queueUploading ? '上传中...' : '开始上传' }}
          </SyButton>
          <SyButton class="header-btn" @click="$emit('retry-failed')">重试失败项</SyButton>
          <SyButton class="header-btn" :disabled="hasRunningTask" @click="$emit('clear')">清空队列</SyButton>
          <SyButton class="ui-btn ui-btn--danger" :disabled="!hasRunningTask" @click="$emit('cancel-all')">取消全部</SyButton>
        </div>
      </div>
    </div>

    <div v-if="uploadQueue.length" class="queue-list">
      <UploadQueueItem
        v-for="item in uploadQueue"
        :key="item.id"
        :item="item"
        @retry="$emit('retry-item', $event)"
        @cancel="$emit('cancel-item', $event)"
      />
    </div>

    <div v-else class="empty-state empty-state--premium">
      <div class="empty-state__icon">🗂️</div>
      <div class="empty-state__title">队列为空</div>
      <div class="minor-text">把本地图片拖进来，或者点击“选择图片”。</div>
    </div>

    <div class="log-panel">
      <div class="section-head log-panel__head">
        <div>
          <div class="section-title">上传日志</div>
          <div class="section-desc">查看上传过程中的状态变化、成功记录与失败原因。</div>
        </div>
      </div>

      <LogFilterBar
        :model-value="logFilter"
        @update:modelValue="$emit('update:log-filter', $event)"
      />

      <div v-if="uploadLogs.length" class="log-list log-list--rich">
        <div
          v-for="log in uploadLogs"
          :key="log.id"
          class="log-item"
          :class="`log-item--${log.type}`"
        >
          <span class="log-item__time">{{ log.time }}</span>
          <span class="log-item__type">{{ log.type }}</span>
          <span class="log-item__message">{{ log.message }}</span>
        </div>
      </div>

      <div v-else class="minor-text">暂无日志记录</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import SyButton from '@/components/SiyuanTheme/SyButton.vue'
import LogFilterBar from './LogFilterBar.vue'
import UploadQueueItem from './UploadQueueItem.vue'
import type { UploadLogFilter } from '@/types/plugin'
import type { QueueUploadItem } from './UploadQueueItem.vue'

type UploadLogItem = {
  id: string
  type: 'info' | 'success' | 'error'
  time: string
  message: string
}

defineProps<{
  isDragging: boolean
  uploadQueue: QueueUploadItem[]
  uploadLogs: UploadLogItem[]
  uploadConcurrency: number
  hasRunningTask: boolean
  queueUploading: boolean
  summary: {
    total: number
    success: number
    error: number
    uploading: number
  }
  logFilter: UploadLogFilter
}>()

defineEmits<{
  (e: 'drag-state', value: boolean): void
  (e: 'drop', event: DragEvent): void
  (e: 'files-change', event: Event): void
  (e: 'upload'): void
  (e: 'clear'): void
  (e: 'cancel-all'): void
  (e: 'retry-failed'): void
  (e: 'retry-item', id: string): void
  (e: 'cancel-item', id: string): void
  (e: 'update:concurrency', value: number): void
  (e: 'update:log-filter', value: UploadLogFilter): void
}>()
</script>
