<template>
  <section class="section-card glass-card misc-panel-section">
    <div class="section-head misc-panel-head">
      <div>
        <div class="section-title">杂项</div>
        <div class="section-desc">记录所有上传过的本地/原始链接与图床链接，支持搜索、复制和切换显示顺序。</div>
      </div>

      <div class="toolbar-row wrap">
        <span class="summary-badge">记录 {{ filteredItems.length }}</span>
        <span class="summary-badge">总数 {{ items.length }}</span>
      </div>
    </div>

    <div class="misc-toolbar">
      <SyInput v-model="keyword" placeholder="搜索本地链接 / 上传链接 / 文件名" />
      <SyButton class="header-btn" @click="$emit('clear')">清空记录</SyButton>
    </div>

    <div v-if="filteredItems.length" class="mapping-list mapping-list--scrollable misc-mapping-list">
      <div v-for="item in filteredItems" :key="item.id" class="mapping-item misc-mapping-item">
        <div class="mapping-item__head misc-mapping-item__head">
          <div class="misc-mapping-item__meta">
            <span class="tag" :class="`tag--${item.sourceType}`">{{ item.sourceType }}</span>
            <span class="status-pill" :class="`status-pill--${item.status}`">{{ item.status }}</span>
            <span class="minor-text">{{ item.time }}</span>
          </div>
          <div class="misc-mapping-item__ops">
            <div class="minor-text">{{ item.fileName || item.imageId || '记录项' }}</div>
            <button class="misc-icon-btn" title="删除记录" @click="$emit('remove', item.id)">
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        </div>

        <div class="misc-link-grid">
          <div class="misc-link-card">
            <div class="mapping-item__label">本地链接</div>
            <div class="mapping-item__value">{{ item.sourceUrl }}</div>
            <div class="misc-link-card__actions">
              <button class="misc-icon-btn" title="复制" @click="copyText(item.sourceUrl)">
                <span aria-hidden="true">⧉</span>
              </button>
            </div>
          </div>

          <div class="misc-link-card">
            <div class="mapping-item__label">图床链接</div>
            <div class="mapping-item__value">{{ item.targetUrl || '-' }}</div>
            <div class="misc-link-card__actions">
              <button class="misc-icon-btn" title="复制" @click="copyText(item.targetUrl || '')">
                <span aria-hidden="true">⧉</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state empty-state--premium">
      <div class="empty-state__icon">🧾</div>
      <div class="empty-state__title">暂无上传记录</div>
      <div class="minor-text">上传成功后，这里会持续记录原始链接和图床链接。</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { showMessage } from 'siyuan'
import SyInput from '@/components/SiyuanTheme/SyInput.vue'
import type { UploadMappingItem } from '@/types/plugin'

const props = defineProps<{
  items: UploadMappingItem[]
}>()

defineEmits<{
  (e: 'clear'): void
  (e: 'remove', id: string): void
}>()

const keyword = ref('')

const filteredItems = computed(() => {
  const search = keyword.value.trim().toLowerCase()
  if (!search)
    return props.items
  return props.items.filter(item =>
    [item.sourceUrl, item.targetUrl, item.fileName, item.imageId, item.time]
      .filter(Boolean)
      .some(text => String(text).toLowerCase().includes(search)),
  )
})

async function copyText(text: string) {
  if (!text) {
    showMessage('没有可复制的链接')
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    showMessage('已复制到剪贴板')
  }
  catch {
    showMessage('复制失败')
  }
}
</script>