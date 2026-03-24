<template>
  <section class="section-card glass-card image-panel-section">
    <div class="section-head">
      <div class="image-panel-head image-panel-head--inline">
        <div class="section-title">图片列表</div>
        <div class="toolbar-row wrap image-panel-filters">
          <button class="filter-pill" :class="{ 'filter-pill--active': filters.local }" @click="$emit('toggle-filter', 'local')">本地</button>
          <button class="filter-pill" :class="{ 'filter-pill--active': filters.external }" @click="$emit('toggle-filter', 'external')">外链</button>
          <button class="filter-pill" :class="{ 'filter-pill--active': filters.own }" @click="$emit('toggle-filter', 'own')">自己图床</button>
          <span class="image-panel-actions__divider">|</span>
          <button class="select-option" @click="$emit('toggle-select', true)">全选</button>
          <button class="select-option" @click="$emit('toggle-select', false)">取消选择</button>
        </div>
      </div>
      <div class="summary-badges">
        <span class="summary-badge">共 {{ images.length }} 项</span>
        <span class="summary-badge">已选 {{ selectedCount }} 项</span>
        <span class="summary-badge summary-badge--accent">非自己图床 {{ nonOwnCount }} 项</span>
      </div>
    </div>

    <div class="image-panel-body">
      <div v-if="images.length" class="image-grid image-grid--premium image-grid--scrollable">
        <ImageCard
          v-for="item in images"
          :key="item.id"
          :item="item"
          @retry="$emit('retry', $event)"
          @cancel="$emit('cancel', $event)"
        />
      </div>

      <div v-else class="empty-state empty-state--premium image-empty-state">
        <div class="empty-state__icon">🖼️</div>
        <div class="empty-state__title">暂无图片结果</div>
        <div class="minor-text">点击左侧“刷新扫描”后，这里会展示当前笔记及子笔记中的图片资源。</div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import ImageCard from './ImageCard.vue'
import type { BatchUploadScope, ImageItem } from '@/types/plugin'

defineProps<{
  images: ImageItem[]
  selectedCount: number
  nonOwnCount: number
  filters: {
    local: boolean
    external: boolean
    own: boolean
  }
}>()

defineEmits<{
  (e: 'toggle-select', selected: boolean): void
  (e: 'toggle-filter', type: 'local' | 'external' | 'own'): void
  (e: 'retry', item: ImageItem): void
  (e: 'cancel', imageId: string): void
  (e: 'retry-failed'): void
  (e: 'upload-scope', scope: BatchUploadScope): void
}>()
</script>
