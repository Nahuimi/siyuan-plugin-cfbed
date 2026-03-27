<template>
  <section class="section-card surface-card misc-panel-section">
    <div class="section-head misc-panel-head">
      <div>
        <div class="section-title">{{ t('mappings.title', '迁移记录') }}</div>
        <div class="section-desc">{{ t('mappings.desc', '记录所有上传过的原始链接与图床链接，支持搜索、复制和导出。') }}</div>
      </div>

      <div class="toolbar-row wrap">
        <span class="summary-badge">{{ t('mappings.shown', '显示 {count}', { count: filteredItems.length }) }}</span>
        <span class="summary-badge">{{ t('common.total', '总数') }} {{ summary.total }}</span>
        <span class="summary-badge">{{ t('common.success', '成功') }} {{ summary.success }}</span>
        <span class="summary-badge">{{ t('common.error', '失败') }} {{ summary.error }}</span>
        <span class="summary-badge">{{ t('common.cancelled', '取消') }} {{ summary.cancelled }}</span>
      </div>
    </div>

    <div class="misc-toolbar">
      <SyInput v-model="keyword" :placeholder="t('mappings.searchPlaceholder', '搜索本地链接 / 上传链接 / 文件名')" />
      <div class="toolbar-row wrap">
        <SyButton class="header-btn" @click="$emit('export-json')">{{ t('mappings.exportJson', '导出 JSON') }}</SyButton>
        <SyButton class="header-btn" @click="$emit('export-csv')">{{ t('mappings.exportCsv', '导出 CSV') }}</SyButton>
        <SyButton class="header-btn" @click="$emit('clear')">{{ t('mappings.clear', '清空记录') }}</SyButton>
      </div>
    </div>

    <div v-if="filteredItems.length" class="mapping-list mapping-list--scrollable misc-mapping-list">
      <div v-for="item in filteredItems" :key="item.id" class="mapping-item misc-mapping-item">
        <div class="mapping-item__head misc-mapping-item__head">
          <div class="misc-mapping-item__meta">
            <span class="tag" :class="`tag--${item.sourceType}`">{{ mappingSourceTypeLabel(item.sourceType) }}</span>
            <span class="status-pill" :class="`status-pill--${item.status}`">{{ uploadStatusLabel(item.status) }}</span>
            <span class="minor-text">{{ item.time }}</span>
          </div>
          <div class="misc-mapping-item__ops">
            <div class="minor-text">{{ item.fileName || item.imageId || t('mappings.recordFallback', '记录项') }}</div>
            <button class="misc-icon-btn" :title="t('mappings.deleteRecord', '删除记录')" @click="$emit('remove', item.id)">
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        </div>

        <div class="misc-link-grid">
          <div class="misc-link-card">
            <div class="mapping-item__label">{{ t('mappings.sourceLink', '本地链接') }}</div>
            <div class="mapping-item__value">{{ item.sourceUrl }}</div>
            <div class="misc-link-card__actions">
              <button class="misc-icon-btn" :title="t('common.copy', '复制')" @click="copyText(item.sourceUrl)">
                <span aria-hidden="true">⧉</span>
              </button>
            </div>
          </div>

          <div class="misc-link-card">
            <div class="mapping-item__label">{{ t('mappings.targetLink', '图床链接') }}</div>
            <div class="mapping-item__value">{{ item.targetUrl || t('common.none', '-') }}</div>
            <div class="misc-link-card__actions">
              <button class="misc-icon-btn" :title="t('common.copy', '复制')" @click="copyText(item.targetUrl || '')">
                <span aria-hidden="true">⧉</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <div class="empty-state__title">{{ t('mappings.emptyTitle', '暂无上传记录') }}</div>
      <div class="minor-text">{{ t('mappings.emptyDesc', '上传成功后，这里会持续记录原始链接和图床链接。') }}</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { showMessage } from 'siyuan'
import SyInput from '@/components/SiyuanTheme/SyInput.vue'
import type { UploadMappingItem } from '@/types/plugin'
import { copyTextToClipboard } from '@/utils/clipboard'
import { useI18n } from '@/utils/i18n'

const props = defineProps<{
  items: UploadMappingItem[]
  summary: {
    total: number
    success: number
    error: number
    cancelled: number
  }
}>()

defineEmits<{
  (e: 'clear'): void
  (e: 'export-json'): void
  (e: 'export-csv'): void
  (e: 'remove', id: string): void
}>()

const { t, mappingSourceTypeLabel, uploadStatusLabel } = useI18n()
const keyword = ref('')

const filteredItems = computed(() => {
  const search = keyword.value.trim().toLowerCase()
  if (!search)
    return props.items
  return props.items.filter(item =>
    [item.sourceUrl, item.sourceKey, item.targetUrl, item.fileName, item.imageId, item.time]
      .filter(Boolean)
      .some(text => String(text).toLowerCase().includes(search)),
  )
})

async function copyText(text: string) {
  if (!text) {
    showMessage(t('mappings.message.noCopyLink', '没有可复制的链接'))
    return
  }
  try {
    await copyTextToClipboard(text)
    showMessage(t('image.message.copySuccess', '已复制到剪贴板'))
  }
  catch {
    showMessage(t('image.message.copyFailed', '复制失败'))
  }
}
</script>
