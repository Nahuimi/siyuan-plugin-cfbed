<template>
  <div v-if="panelVisible" class="cfbed-mask" @click.self="closePanel">
    <div class="cfbed-shell" :data-theme="resolvedThemeMode">
      <PanelHeader
        :current-doc-title="currentDocTitle"
        :filtered-count="filteredImages.length"
        :selected-count="selectedCount"
        :non-own-count="nonOwnCount"
        :replaceable-count="replaceableCount"
        :active-config-id="settings.activeConfigId"
        :auto-replace="settings.autoReplace"
        :theme-button-title="themeButtonTitle"
        :theme-mode-icon="themeModeIcon"
        :theme-mode-label="themeModeLabel"
        :config-options="configOptions"
        @update:active-config="updateActiveConfig"
        @toggle-auto-replace="toggleAutoReplace"
        @cycle-theme="cycleThemeMode"
        @close="closePanel"
      />

      <PanelSidebar
        :current-doc-title="currentDocTitle"
        :image-uploading="imageUploading"
        :replace-preview-active="replacePreviewActive"
        :selected-uploadable-count="selectedUploadableCount"
        :replaceable-count="replaceableCount"
        :replace-preview-images-count="replacePreviewImages.length"
        :own-domains-count="ownDomains.length"
        :auto-replace="settings.autoReplace"
        :theme-mode-label="themeModeLabel"
        :active-config-summary="activeConfigSummary"
        @refresh-images="handleRefreshImages"
        @upload-selected="uploadSelectedByScope('all')"
        @retry-failed="retryFailedImages"
        @build-replace-preview="buildReplacePreview"
        @confirm-replace="confirmReplaceUploadedLinks"
        @cancel-replace="cancelReplacePreview"
      />

      <section class="cfbed-main">
        <div class="tab-bar">
          <div class="tab-bar__tabs">
            <button class="tab-pill" :class="{ 'tab-pill--active': activeTab === 'images' }" @click="activeTab = 'images'">{{ t('panel.tab.images', '图片列表') }}</button>
            <button class="tab-pill" :class="{ 'tab-pill--active': activeTab === 'settings' }" @click="activeTab = 'settings'">{{ t('panel.tab.settings', '图床配置') }}</button>
            <button class="tab-pill" :class="{ 'tab-pill--active': activeTab === 'upload' }" @click="activeTab = 'upload'">{{ t('panel.tab.upload', '上传队列') }}</button>
            <button class="tab-pill" :class="{ 'tab-pill--active': activeTab === 'misc' }" @click="activeTab = 'misc'">{{ t('panel.tab.misc', '迁移记录') }}</button>
          </div>

          <div class="tab-bar__hint">{{ activeTabHint }}</div>
        </div>

        <div class="cfbed-main__body" :class="`cfbed-main__body--${activeTab}`">
          <SettingsPanel
            v-if="activeTab === 'settings'"
            :settings="settings"
            @add-config="addConfig"
            @remove-config="handleRemoveConfig"
            @change="persistSettings"
          />

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
            :summary="mappingSummary"
            @clear="clearMappings"
            @export-json="exportMappingsAsJson"
            @export-csv="exportMappingsAsCsv"
            @remove="removeMapping"
          />

          <template v-else>
            <TaskCenter :summary="taskSummary" />

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
          </template>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import PanelHeader from '@/components/cfbed/PanelHeader.vue'
import PanelSidebar from '@/components/cfbed/PanelSidebar.vue'
import ImagePanel from '@/components/cfbed/ImagePanel.vue'
import MiscPanel from '@/components/cfbed/MiscPanel.vue'
import SettingsPanel from '@/components/cfbed/SettingsPanel.vue'
import TaskCenter from '@/components/cfbed/TaskCenter.vue'
import UploadPanel from '@/components/cfbed/UploadPanel.vue'
import { pushErrMsg } from '@/api/index'
import { useCfBedSettings } from '@/composables/useCfBedSettings'
import { useImageScanner } from '@/composables/useImageScanner'
import { usePanelShell } from '@/composables/usePanelShell'
import { useUploadResults } from '@/composables/useUploadResults'
import { useUploader } from '@/composables/useUploader'
import { useI18n } from '@/utils/i18n'
import { canImageBeReplaced } from '@/utils/replace'
import { setCfBedBridge } from '@/utils/plugin'
import type { PanelTab, ThemeMode } from '@/types/plugin'
import '@/styles/cfbed-shared.scss'
import '@/styles/cfbed-app.scss'

const panelVisible = ref(false)
const activeTab = ref<PanelTab>('images')
const systemPrefersDark = ref(window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? true)
const { t } = useI18n()

const {
  settings,
  configOptions,
  ownDomains,
  persistSettings,
  flushSettings,
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
  mappingSummary,
  addMapping,
  clearMappings,
  removeMapping,
  findSuccessfulMapping,
  buildReplacePreview,
  hideReplacePreview,
  excludeImageFromReplacePreview,
  exportMappingsAsJson,
  exportMappingsAsCsv,
  flushMappings,
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
  settings,
  filteredImages,
  activeConfig,
  refreshImages,
  replaceUploadedLinks,
  patchImage,
  addMapping,
  findSuccessfulMapping,
})

const {
  resolvedThemeMode,
  themeModeIcon,
  themeModeLabel,
  themeButtonTitle,
  activeConfigSummary,
  activeTabHint,
} = usePanelShell({
  settings,
  activeTab,
  replacePreviewActive,
  systemPrefersDark,
})

const filteredUploadLogs = computed(() => filterLogs(uploadLogs.value))
const displayImages = computed(() => replacePreviewActive.value ? replacePreviewImages.value : filteredImages.value)
const replaceableCount = computed(() => filteredImages.value.filter(canImageBeReplaced).length)
const selectedUploadableCount = computed(() =>
  filteredImages.value.filter(item => item.selected && item.sourceType !== 'own').length,
)

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
  const order: ThemeMode[] = ['auto', 'light', 'dark']
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
    pushErrMsg(error?.message || t('panel.error.removeConfigFailed', '删除失败'))
  }
}

async function handleRefreshImages() {
  await refreshImages()
}

function closePanel() {
  panelVisible.value = false
  hideReplacePreview()
}

function shouldRefreshForTab(tab: PanelTab) {
  return !currentDocTitle.value || tab === 'images' || tab === 'settings'
}

async function showPanel(tab: PanelTab) {
  panelVisible.value = true
  activeTab.value = tab
  if (shouldRefreshForTab(tab))
    await handleRefreshImages()
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

  setCfBedBridge({
    togglePanel(force?: boolean) {
      const nextVisible = typeof force === 'boolean' ? force : !panelVisible.value
      if (!nextVisible) {
        closePanel()
        return
      }

      void showPanel(activeTab.value)
    },
    openPanel(tab: PanelTab = activeTab.value) {
      void showPanel(tab)
    },
    openSetting() {
      void showPanel('settings')
    },
  })
})

onBeforeUnmount(() => {
  setCfBedBridge()
  void flushSettings().catch(() => {})
  void flushMappings().catch(() => {})

  if (mediaQuery) {
    if (typeof mediaQuery.removeEventListener === 'function')
      mediaQuery.removeEventListener('change', handleThemeMediaChange)
    else
      mediaQuery.removeListener(handleThemeMediaChange)
  }
})
</script>
