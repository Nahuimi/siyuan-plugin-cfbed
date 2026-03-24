<template>
  <section class="section-card glass-card">
    <div class="section-head">
      <div>
        <div class="section-title">上传映射表</div>
        <div class="section-desc">记录原始资源与上传后链接的映射关系，便于导出和排查。</div>
      </div>

      <div class="toolbar-row wrap">
        <span class="summary-badge">总数 {{ summary.total }}</span>
        <span class="summary-badge">成功 {{ summary.success }}</span>
        <span class="summary-badge">失败 {{ summary.error }}</span>
        <span class="summary-badge">取消 {{ summary.cancelled }}</span>
      </div>
    </div>

    <div class="toolbar-row wrap toolbar-row--panel">
      <SyButton class="header-btn" @click="$emit('export-json')">导出 JSON</SyButton>
      <SyButton class="header-btn" @click="$emit('export-csv')">导出 CSV</SyButton>
      <SyButton class="header-btn" @click="$emit('clear')">清空映射表</SyButton>
    </div>

    <div v-if="items.length" class="mapping-list mapping-list--scrollable">
      <div v-for="item in items" :key="item.id" class="mapping-item">
        <div class="mapping-item__head">
          <span class="tag" :class="`tag--${item.sourceType}`">{{ item.sourceType }}</span>
          <span class="status-pill" :class="`status-pill--${item.status}`">{{ item.status }}</span>
          <span class="minor-text">{{ item.time }}</span>
        </div>
        <div class="mapping-item__row">
          <div class="mapping-item__label">原始</div>
          <div class="mapping-item__value">{{ item.sourceUrl }}</div>
        </div>
        <div class="mapping-item__row">
          <div class="mapping-item__label">上传后</div>
          <div class="mapping-item__value">{{ item.targetUrl || '-' }}</div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state empty-state--premium">
      <div class="empty-state__icon">📄</div>
      <div class="empty-state__title">暂无映射记录</div>
      <div class="minor-text">执行上传后，这里会展示原始资源与新链接的对应关系。</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import SyButton from '@/components/SiyuanTheme/SyButton.vue'
import type { UploadMappingItem } from '@/types/plugin'

defineProps<{
  items: UploadMappingItem[]
  summary: {
    total: number
    success: number
    error: number
    cancelled: number
  }
}>()

defineEmits<{
  (e: 'export-json'): void
  (e: 'export-csv'): void
  (e: 'clear'): void
}>()
</script>
