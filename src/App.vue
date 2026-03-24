<template>
  <div v-if="panelVisible" class="cfbed-mask" @click.self="panelVisible = false">
    <div class="cfbed-shell" :data-theme="resolvedThemeMode">
      <aside class="cfbed-sidebar">
        <div class="brand-card">
          <div class="cfbed-title">CloudFlare ImgBed</div>
          <div class="header-copy__desc">聚合当前笔记中的图片，并快速迁移到你的 CloudFlare ImgBed。</div>
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
            <SyButton class="action-btn" @click="handleRefreshImages">刷新扫描</SyButton>
            <SyButton class="action-btn" :disabled="imageUploading || replacePreviewActive" @click="uploadSelectedByScope('all')">上传所选</SyButton>
            <SyButton class="action-btn" @click="retryFailedImages">失败重试</SyButton>
            <SyButton class="action-btn" @click="buildReplacePreview">替换预览</SyButton>
            <template v-if="replacePreviewActive">
              <SyButton class="action-btn" :disabled="!replacePreviewImages.length" @click="confirmReplaceUploadedLinks">确认替换</SyButton>
              <SyButton class="action-btn" @click="cancelReplacePreview">取消替换</SyButton>
            </template>
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
              <button
                class="theme-switch"
                :title="themeButtonTitle"
                @click="cycleThemeMode"
              >
                <span class="theme-switch__icon" aria-hidden="true">{{ themeModeIcon }}</span>
                <span class="theme-switch__text">{{ themeModeLabel }}</span>
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
                :images="displayImages"
                :selected-count="selectedCount"
                :non-own-count="nonOwnCount"
                :filters="filters"
                :replace-preview-active="replacePreviewActive"
                @toggle-select="toggleSelectVisible"
                @toggle-filter="toggleImageFilter"
                @retry="retryImage"
                @cancel="cancelImageUpload"
                @confirm-replace="confirmSingleReplace"
                @cancel-replace="cancelSingleReplace"
                @retry-failed="retryFailedImages"
                @upload-scope="uploadSelectedByScope"
              />
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import SyButton from '@/components/SiyuanTheme/SyButton.vue'
import SySelect from '@/components/SiyuanTheme/SySelect.vue'
import SettingsPanel from '@/components/cfbed/SettingsPanel.vue'
import UploadPanel from '@/components/cfbed/UploadPanel.vue'
import ImagePanel from '@/components/cfbed/ImagePanel.vue'
import MiscPanel from '@/components/cfbed/MiscPanel.vue'
import TaskCenter from '@/components/cfbed/TaskCenter.vue'
import { pushErrMsg } from '@/api'
import { useCfBedSettings } from '@/composables/useCfBedSettings'
import { useImageScanner } from '@/composables/useImageScanner'
import { useUploader } from '@/composables/useUploader'
import { useUploadResults } from '@/composables/useUploadResults'
import '@/styles/cfbed-shared.scss'
import '@/styles/cfbed-app.scss'

const panelVisible = ref(false)
const activeTab = ref<'images' | 'settings' | 'upload' | 'misc'>('images')
const systemPrefersDark = ref(window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? true)

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
  replacePreviewActive,
  replacePreviewImages,
  uploadMappings,
  addMapping,
  clearMappings,
  removeMapping,
  findSuccessfulMapping,
  buildReplacePreview,
  hideReplacePreview,
  excludeImageFromReplacePreview,
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
const displayImages = computed(() => replacePreviewActive.value ? replacePreviewImages.value : filteredImages.value)
const resolvedThemeMode = computed(() => settings.value.themeMode === 'auto'
  ? (systemPrefersDark.value ? 'dark' : 'light')
  : settings.value.themeMode)
const themeModeIcon = computed(() => {
  if (settings.value.themeMode === 'auto')
    return '◐'
  return resolvedThemeMode.value === 'dark' ? '☾' : '☀'
})
const themeModeLabel = computed(() => {
  if (settings.value.themeMode === 'auto')
    return '自动'
  return resolvedThemeMode.value === 'dark' ? '暗色' : '亮色'
})
const themeButtonTitle = computed(() => `主题：${themeModeLabel.value}（点击切换）`)

let mediaQuery: MediaQueryList | null = null

function handleThemeMediaChange(event: MediaQueryListEvent) {
  systemPrefersDark.value = event.matches
}

function updateActiveConfig(value: string) {
  settings.value.activeConfigId = value
  persistSettings()
}

function toggleAutoReplace() {
  settings.value.autoReplace = !settings.value.autoReplace
  persistSettings()
}

function cycleThemeMode() {
  const order: Array<'auto' | 'light' | 'dark'> = ['auto', 'light', 'dark']
  const currentIndex = order.indexOf(settings.value.themeMode)
  settings.value.themeMode = order[(currentIndex + 1) % order.length]
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

async function handleRefreshImages() {
  await refreshImages()
}

async function confirmReplaceUploadedLinks() {
  if (!replacePreviewImages.value.length) {
    cancelReplacePreview()
    return
  }

  await replaceUploadedLinks(replacePreviewImages.value)
  hideReplacePreview()
  await handleRefreshImages()
}

async function confirmSingleReplace(item: typeof filteredImages.value[number]) {
  await replaceUploadedLinks([item])
  excludeImageFromReplacePreview(item.id)

  if (!replacePreviewImages.value.length)
    hideReplacePreview()

  await handleRefreshImages()
}

function cancelSingleReplace(item: typeof filteredImages.value[number]) {
  excludeImageFromReplacePreview(item.id)
  if (!replacePreviewImages.value.length)
    hideReplacePreview()
}

function cancelReplacePreview() {
  hideReplacePreview()
}

onMounted(() => {
  mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)') ?? null
  if (mediaQuery) {
    systemPrefersDark.value = mediaQuery.matches
    if (typeof mediaQuery.addEventListener === 'function')
      mediaQuery.addEventListener('change', handleThemeMediaChange)
    else
      mediaQuery.addListener(handleThemeMediaChange)
  }

  ;(window as any)._sy_plugin_sample = {
    togglePanel(force?: boolean) {
      panelVisible.value = typeof force === 'boolean' ? force : !panelVisible.value
      if (panelVisible.value) {
        activeTab.value = 'images'
        handleRefreshImages()
      }
    },
    openSetting() {
      panelVisible.value = true
      activeTab.value = 'settings'
      handleRefreshImages()
    },
  }
})

onBeforeUnmount(() => {
  if (mediaQuery) {
    if (typeof mediaQuery.removeEventListener === 'function')
      mediaQuery.removeEventListener('change', handleThemeMediaChange)
    else
      mediaQuery.removeListener(handleThemeMediaChange)
  }
})
</script>
