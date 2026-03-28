<template>
  <section class="section-card surface-card upload-panel-section">
    <div class="section-head upload-panel-head">
      <div>
        <div class="section-title">{{ t('upload.title', '上传图片') }}</div>
        <div class="section-desc">{{ t('upload.desc', '拖拽或选择图片后加入队列，支持并发上传、失败重试与日志追踪。') }}</div>
      </div>

      <div class="toolbar-row wrap">
        <span class="summary-badge">{{ t('upload.summary.total', '总数 {count}', { count: summary.total }) }}</span>
        <span class="summary-badge">{{ t('upload.summary.success', '成功 {count}', { count: summary.success }) }}</span>
        <span class="summary-badge">{{ t('upload.summary.error', '失败 {count}', { count: summary.error }) }}</span>
        <span class="summary-badge">{{ t('upload.summary.running', '运行中 {count}', { count: summary.uploading }) }}</span>
      </div>
    </div>

    <div class="upload-panel-body">
      <div class="upload-panel-layout">
        <div class="upload-panel-main">
          <div
            class="upload-dropzone"
            :class="{ 'upload-dropzone--dragging': isDragging }"
            @dragenter.prevent="$emit('drag-state', true)"
            @dragover.prevent
            @dragleave.prevent="$emit('drag-state', false)"
            @drop.prevent="$emit('drop', $event)"
          >
            <div class="upload-dropzone__icon">📤</div>
            <div class="upload-dropzone__title">{{ t('upload.dropTitle', '拖拽图片到此处上传') }}</div>
            <div class="minor-text">{{ t('upload.dropDesc', '支持 png / jpg / gif / webp 等图片文件') }}</div>

            <label class="upload-input-trigger">
              <input type="file" accept="image/*" multiple @change="$emit('files-change', $event)">
              <span>{{ t('upload.chooseImages', '选择图片') }}</span>
            </label>
          </div>

          <div class="upload-queue-panel">
            <div class="upload-subhead">
              <div>
                <div class="section-title">{{ t('upload.queue.title', '上传队列') }}</div>
                <div class="section-desc">{{ t('upload.queue.desc', '本地图片进入这里，上传前可以统一查看状态。') }}</div>
              </div>
              <span class="summary-badge">{{ t('upload.queue.count', '队列 {count}', { count: uploadQueue.length }) }}</span>
            </div>

            <div v-if="uploadQueue.length" class="queue-list upload-queue-list">
              <UploadQueueItem
                v-for="item in uploadQueue"
                :key="item.id"
                :item="item"
                @retry="$emit('retry-item', $event)"
                @cancel="$emit('cancel-item', $event)"
              />
            </div>

            <div v-else class="empty-state upload-panel-empty">
              <div class="empty-state__title">{{ t('upload.queue.emptyTitle', '上传队列为空') }}</div>
              <div class="minor-text">{{ t('upload.queue.emptyDesc', '把本地图片拖进来，或者点击“选择图片”。') }}</div>
            </div>
          </div>
        </div>

        <div class="upload-panel-side">
          <div class="upload-control-card upload-control-card--sticky">
            <label class="field upload-control-card__field">
              <span class="field-card__label">{{ t('upload.concurrency', '并发数') }}</span>
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
                {{ queueUploading ? t('upload.uploading', '上传中...') : t('upload.start', '开始上传') }}
              </SyButton>
              <SyButton class="header-btn" @click="$emit('retry-failed')">{{ t('images.retryFailed', '重试失败项') }}</SyButton>
              <SyButton class="header-btn" :disabled="hasRunningTask" @click="$emit('clear')">{{ t('upload.clearQueue', '清空队列') }}</SyButton>
              <SyButton class="ui-btn ui-btn--danger" :disabled="!hasRunningTask" @click="$emit('cancel-all')">{{ t('upload.cancelAll', '取消全部') }}</SyButton>
            </div>
          </div>

          <div class="log-panel upload-log-panel">
            <div class="upload-subhead log-panel__head">
              <div>
                <div class="section-title">{{ t('upload.log.title', '上传日志') }}</div>
                <div class="section-desc">{{ t('upload.log.desc', '查看上传过程中的状态变化、成功记录与失败原因。') }}</div>
              </div>
            </div>

            <div class="log-panel__toolbar">
              <LogFilterBar
                :model-value="logFilter"
                @update:modelValue="$emit('update:log-filter', $event)"
              />

              <div class="log-panel__actions">
                <span class="summary-badge">{{ t('upload.log.count', '日志 {count}', { count: uploadLogs.length }) }}</span>
                <button class="header-btn log-panel__clear" :disabled="!uploadLogs.length" @click="$emit('clear-logs')">
                  {{ t('upload.log.clearAll', '全部删除') }}
                </button>
              </div>
            </div>

            <div v-if="uploadLogs.length" class="log-list log-list--rich upload-log-list">
              <div
                v-for="log in uploadLogs"
                :key="log.id"
                class="log-item"
                :class="`log-item--${log.type}`"
              >
                <div class="log-item__meta">
                  <span class="log-item__type">{{ uploadLogTypeLabel(log.type) }}</span>
                  <span class="log-item__time">{{ log.time }}</span>
                </div>
                <button class="log-item__remove" :title="t('upload.log.remove', '删除日志')" @click="$emit('remove-log', log.id)">
                  <span aria-hidden="true">✕</span>
                </button>
                <span class="log-item__message">{{ log.message }}</span>
              </div>
            </div>

            <div v-else class="empty-state upload-log-empty">
              <div class="empty-state__title">{{ t('upload.log.emptyTitle', '暂无日志记录') }}</div>
              <div class="minor-text">{{ t('upload.log.emptyDesc', '开始上传后，这里会显示进度和错误原因。') }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import SyButton from '@/components/SiyuanTheme/SyButton.vue'
import LogFilterBar from './LogFilterBar.vue'
import UploadQueueItem from './UploadQueueItem.vue'
import type { QueueUploadItem, UploadLogFilter, UploadLogItem } from '@/types/plugin'
import { useI18n } from '@/utils/i18n'

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
  (e: 'remove-log', id: string): void
  (e: 'clear-logs'): void
}>()

const { t, uploadLogTypeLabel } = useI18n()
</script>
