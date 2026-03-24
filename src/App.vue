<template>
  <div v-if="panelVisible" class="cfbed-mask" @click.self="panelVisible = false">
    <div class="cfbed-shell">
      <aside class="cfbed-sidebar">
        <div class="brand-card">
          <div class="cfbed-title">CloudFlare ImgBed</div>
          <div class="header-copy__desc">聚合当前笔记及其子笔记中的图片，并快速迁移到你的 CloudFlare ImgBed。</div>
        </div>

        <div class="sidebar-card scope-card">
          <div class="sidebar-card__title">当前范围</div>
          <div class="cfbed-subtitle scope-card__value">{{ currentDocTitle || '未定位到当前笔记' }}</div>
        </div>

        <div class="stat-grid">
          <div class="stat-card stat-card--blue">
            <div class="stat-card__label">图片总数</div>
            <div class="stat-card__value">{{ filteredImages.length }}</div>
          </div>
          <div class="stat-card stat-card--purple">
            <div class="stat-card__label">已选图片</div>
            <div class="stat-card__value">{{ selectedCount }}</div>
          </div>
          <div class="stat-card stat-card--orange">
            <div class="stat-card__label">待迁移</div>
            <div class="stat-card__value">{{ nonOwnCount }}</div>
          </div>
        </div>

        <div class="sidebar-card">
          <div class="sidebar-card__title">操作面板</div>
          <div class="sidebar-actions">
            <SyButton class="action-btn" @click="refreshImages">刷新扫描</SyButton>
            <SyButton class="action-btn" :disabled="imageUploading" @click="uploadSelectedByScope('all')">上传所选</SyButton>
            <SyButton class="action-btn" @click="retryFailedImages">失败重试</SyButton>
            <SyButton class="action-btn" @click="buildReplacePreview">替换预览</SyButton>
            <SyButton class="action-btn ui-btn--danger" @click="panelVisible = false">关闭面板</SyButton>
          </div>
        </div>
      </aside>

      <div class="cfbed-panel">
        <div class="cfbed-body" :class="{ 'cfbed-body--images': activeTab === 'images', 'cfbed-body--settings': activeTab === 'settings' }">
          <div class="tab-bar glass-card">
            <div class="tab-bar__tabs">
              <button class="tab-pill" :class="{ 'tab-pill--active': activeTab === 'images' }" @click="activeTab = 'images'">图片列表</button>
              <button class="tab-pill" :class="{ 'tab-pill--active': activeTab === 'settings' }" @click="activeTab = 'settings'">图床配置</button>
              <button class="tab-pill" :class="{ 'tab-pill--active': activeTab === 'upload' }" @click="activeTab = 'upload'">上传图片</button>
              <button class="tab-pill" :class="{ 'tab-pill--active': activeTab === 'misc' }" @click="activeTab = 'misc'">杂项</button>
            </div>

            <div class="tab-bar__actions">
              <SySelect
                class="tab-bar__select"
                :model-value="settings.activeConfigId"
                :options="configOptions"
                @update:modelValue="updateActiveConfig"
              />
              <button
                class="toggle-chip tab-bar__toggle"
                :class="{ 'toggle-chip--active': settings.autoReplace }"
                @click="toggleAutoReplace"
              >
                {{ settings.autoReplace ? '自动替换：已开启' : '自动替换：未开启' }}
              </button>
            </div>
          </div>

          <template v-if="activeTab === 'settings'">
            <div class="content-stack content-stack--settings">
              <SettingsPanel
                :settings="settings"
                :config-options="configOptions"
                @add-config="addConfig"
                @remove-config="handleRemoveConfig"
                @change="persistSettings"
              />
            </div>
          </template>

          <UploadPanel
            v-else-if="activeTab === 'upload'"
            :is-dragging="isDragging"
            :upload-queue="uploadQueue"
            :upload-logs="filteredUploadLogs"
            :upload-concurrency="uploadConcurrency"
            :has-running-task="hasRunningTask"
            :queue-uploading="queueUploading"
            :summary="queueSummary"
            :log-filter="uploadLogFilter"
            @drag-state="isDragging = $event"
            @drop="handleDrop"
            @files-change="handleFileInputChange"
            @upload="uploadQueuedFiles"
            @clear="clearUploadQueue"
            @cancel-all="cancelAllUploads"
            @retry-failed="retryFailedQueueItems"
            @retry-item="retryQueueItem"
            @cancel-item="cancelQueueUpload"
            @update:log-filter="uploadLogFilter = $event"
            @update:concurrency="uploadConcurrency = Math.max(1, Math.min(10, $event || 1))"
          />

          <MiscPanel
            v-else-if="activeTab === 'misc'"
            :items="uploadMappings"
            @clear="clearMappings"
            @remove="removeMapping"
          />

          <template v-else>
            <TaskCenter :summary="taskSummary" />

            <div class="content-stack content-stack--images">
              <ImagePanel
                :images="filteredImages"
                :selected-count="selectedCount"
                :non-own-count="nonOwnCount"
                :filters="filters"
                @toggle-select="toggleSelectVisible"
                @toggle-filter="toggleImageFilter"
                @retry="retryImage"
                @cancel="cancelImageUpload"
                @retry-failed="retryFailedImages"
                @upload-scope="uploadSelectedByScope"
              />
            </div>
          </template>
        </div>
      </div>
    </div>

    <ReplacePreviewDialog
      :visible="replacePreviewVisible"
      :items="replacePreviewItems"
      @close="replacePreviewVisible = false"
      @confirm="confirmReplaceUploadedLinks"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import SyButton from '@/components/SiyuanTheme/SyButton.vue'
import SySelect from '@/components/SiyuanTheme/SySelect.vue'
import SettingsPanel from '@/components/cfbed/SettingsPanel.vue'
import UploadPanel from '@/components/cfbed/UploadPanel.vue'
import ImagePanel from '@/components/cfbed/ImagePanel.vue'
import MiscPanel from '@/components/cfbed/MiscPanel.vue'
import TaskCenter from '@/components/cfbed/TaskCenter.vue'
import ReplacePreviewDialog from '@/components/cfbed/ReplacePreviewDialog.vue'
import { pushErrMsg } from '@/api'
import { useCfBedSettings } from '@/composables/useCfBedSettings'
import { useImageScanner } from '@/composables/useImageScanner'
import { useUploader } from '@/composables/useUploader'
import { useUploadResults } from '@/composables/useUploadResults'
import '@/styles/cfbed-shared.scss'
import '@/styles/cfbed-app.scss'

const panelVisible = ref(false)
const activeTab = ref<'images' | 'settings' | 'upload' | 'misc'>('images')

const {
  settings,
  configOptions,
  ownDomains,
  persistSettings,
  addConfig,
  removeConfig,
  activeConfig,
} = useCfBedSettings()

const {
  currentDocTitle,
  filters,
  filteredImages,
  selectedCount,
  nonOwnCount,
  refreshImages,
  toggleSelectVisible,
  patchImage,
  replaceUploadedLinks,
} = useImageScanner(ownDomains, sourceUrl => findSuccessfulMapping(sourceUrl)?.targetUrl)

const {
  uploadLogFilter,
  replacePreviewVisible,
  replacePreviewItems,
  uploadMappings,
  addMapping,
  clearMappings,
  removeMapping,
  findSuccessfulMapping,
  buildReplacePreview,
  filterLogs,
} = useUploadResults({
  filteredImages,
})

const {
  isDragging,
  uploadQueue,
  uploadLogs,
  uploadConcurrency,
  queueUploading,
  imageUploading,
  hasRunningTask,
  queueSummary,
  taskSummary,
  handleDrop,
  handleFileInputChange,
  clearUploadQueue,
  uploadQueuedFiles,
  uploadSelectedByScope,
  retryImage,
  retryFailedImages,
  retryQueueItem,
  retryFailedQueueItems,
  cancelAllUploads,
  cancelImageUpload,
  cancelQueueUpload,
} = useUploader({
  settings: settings.value,
  filteredImages,
  activeConfig,
  refreshImages,
  replaceUploadedLinks,
  patchImage,
  addMapping,
  findSuccessfulMapping,
})

const filteredUploadLogs = computed(() => filterLogs(uploadLogs.value))

function updateActiveConfig(value: string) {
  settings.value.activeConfigId = value
  persistSettings()
}

function toggleAutoReplace() {
  settings.value.autoReplace = !settings.value.autoReplace
  persistSettings()
}

function toggleImageFilter(type: 'local' | 'external' | 'own') {
  filters.value[type] = !filters.value[type]
}

function handleRemoveConfig(id: string) {
  try {
    removeConfig(id)
  }
  catch (error: any) {
    pushErrMsg(error?.message || '删除失败')
  }
}

async function confirmReplaceUploadedLinks() {
  replacePreviewVisible.value = false
  await replaceUploadedLinks()
}

onMounted(() => {
  ;(window as any)._sy_plugin_sample = {
    togglePanel(force?: boolean) {
      panelVisible.value = typeof force === 'boolean' ? force : !panelVisible.value
      if (panelVisible.value) {
        activeTab.value = 'images'
        refreshImages()
      }
    },
    openSetting() {
      panelVisible.value = true
      activeTab.value = 'settings'
      refreshImages()
    },
  }
})
</script>
