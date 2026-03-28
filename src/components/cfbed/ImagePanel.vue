<template>
  <section class="section-card surface-card image-panel-section">
    <div class="section-head section-head--image-panel">
      <div class="section-title">{{ t('images.title', '图片列表') }}</div>

      <div class="image-panel-meta">
        <div class="toolbar-row wrap image-panel-filters">
          <button class="filter-pill" :class="{ 'filter-pill--active': filters.local }" @click="$emit('toggle-filter', 'local')">{{ t('images.filter.local', '本地') }}</button>
          <button class="filter-pill" :class="{ 'filter-pill--active': filters.external }" @click="$emit('toggle-filter', 'external')">{{ t('images.filter.external', '外链') }}</button>
          <button class="filter-pill" :class="{ 'filter-pill--active': filters.own }" @click="$emit('toggle-filter', 'own')">{{ t('images.filter.own', '自己图床') }}</button>
          <span class="image-panel-actions__divider">|</span>
          <button class="select-option" @click="$emit('toggle-select', true)">{{ t('images.selectAll', '全选') }}</button>
          <button class="select-option" @click="$emit('toggle-select', false)">{{ t('images.clearSelection', '取消选择') }}</button>
        </div>

        <div class="summary-badges">
          <span class="summary-badge">{{ t('images.summary.total', '共 {count} 项', { count: images.length }) }}</span>
          <span class="summary-badge">{{ t('images.summary.selected', '已选 {count} 项', { count: selectedCount }) }}</span>
          <span class="summary-badge summary-badge--accent">{{ t('images.summary.nonOwn', '非自己图床 {count} 项', { count: nonOwnCount }) }}</span>
          <span class="summary-badge">{{ t('panel.header.stats.replaceable', '可替换 {count}', { count: replaceableCount }) }}</span>
        </div>
      </div>
    </div>

    <div class="image-panel-body">
      <div v-if="images.length" class="image-grid image-grid--scrollable">
        <ImageCard
          v-for="item in images"
          :key="item.id"
          :item="item"
          :replace-preview-active="replacePreviewActive"
          @retry="$emit('retry', $event)"
          @cancel="$emit('cancel', $event)"
          @confirm-replace="$emit('confirm-replace', $event)"
          @cancel-replace="$emit('cancel-replace', $event)"
        />
      </div>

      <div v-else class="empty-state image-empty-state">
        <div class="empty-state__title">{{ t('images.empty.title', '当前文档还没有可显示的图片结果') }}</div>
        <div class="minor-text">{{ t('images.empty.desc', '点击“刷新扫描”后，这里会展示当前笔记中的图片资源。') }}</div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import ImageCard from './ImageCard.vue'
import type { ImageItem } from '@/types/plugin'
import { useI18n } from '@/utils/i18n'

defineProps<{
  images: ImageItem[]
  selectedCount: number
  nonOwnCount: number
  replaceableCount: number
  filters: {
    local: boolean
    external: boolean
    own: boolean
  }
  replacePreviewActive: boolean
}>()

defineEmits<{
  (e: 'toggle-select', selected: boolean): void
  (e: 'toggle-filter', type: 'local' | 'external' | 'own'): void
  (e: 'retry', item: ImageItem): void
  (e: 'cancel', imageId: string): void
  (e: 'confirm-replace', item: ImageItem): void
  (e: 'cancel-replace', item: ImageItem): void
}>()

const { t } = useI18n()
</script>
