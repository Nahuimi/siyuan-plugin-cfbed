<template>
  <div class="image-card premium-card" :class="{ 'image-card--selected': localSelected }" @click="toggleSelected">
    <div class="image-head">
      <span class="tag image-tag" :class="`tag--${item.sourceType}`">{{ sourceTypeLabel(item.sourceType) }}</span>
      <button
        class="ref-count"
        :class="{ 'ref-count--active': docsExpanded }"
        :title="docsExpanded ? '关闭引用窗口' : '查看引用内容'"
        @click.stop="docsExpanded = !docsExpanded"
      >
        <span class="ref-count__value">{{ item.docs?.length || 0 }}</span>
      </button>
    </div>

    <div class="image-preview-wrap">
      <img class="image-preview" :src="item.uploadedUrl || item.url" alt="preview">
    </div>

    <div
      v-if="item.status === 'queued' || item.status === 'preparing' || item.status === 'uploading' || item.progress"
      class="progress-bar image-progress"
    >
      <div class="progress-bar__inner" :style="{ width: `${item.progress || 0}%` }" />
    </div>

    <div v-if="typeof item.progress === 'number' && item.status !== 'idle'" class="minor-text">
      进度：{{ item.progress || 0 }}%
    </div>

    <div class="toolbar-row wrap toolbar-row--panel image-toolbar" @click.stop>
      <button class="image-action image-action--compact" @click="copyText(item.url)">原链接</button>
      <button
        v-if="item.sourceType !== 'own' && item.status !== 'uploading' && item.status !== 'preparing' && item.status !== 'queued'"
        class="image-action image-action--compact"
        @click="$emit('retry', item)"
      >
        {{ item.status === 'error' || item.status === 'cancelled' ? '重传' : '上传' }}
      </button>
      <button class="image-action image-action--compact" @click="copyText(toMarkdown(item.uploadedUrl || item.url))">Markdown</button>
      <button
        v-if="item.status === 'uploading' || item.status === 'preparing' || item.status === 'queued'"
        class="image-action image-action--compact image-action--danger"
        @click="$emit('cancel', item.id)"
      >
        取消
      </button>
    </div>

    <div v-if="docsExpanded && item.docs?.length" class="ref-dialog" @click.stop>
      <div class="ref-dialog__mask" @click="docsExpanded = false" />
      <div class="ref-dialog__panel premium-card">
        <div class="ref-dialog__head">
          <div class="ref-dialog__title-wrap">
            <div class="ref-dialog__title">引用内容</div>
            <div class="ref-dialog__subtitle">共 {{ item.docs.length }} 条引用</div>
          </div>
          <button class="ref-dialog__icon-btn" title="关闭" @click="closeDocs">
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div class="ref-dialog__list">
          <div
            v-for="doc in item.docs"
            :key="`${doc.docId}-${doc.originalUrl}`"
            class="ref-dialog__item"
          >
            <div class="ref-dialog__main">
              <div class="ref-dialog__path">{{ doc.docHPath || doc.docPath || doc.docId }}</div>
              <div class="ref-dialog__content">{{ doc.originalUrl }}</div>
            </div>
            <button class="ref-dialog__icon-btn ref-dialog__copy" title="复制" @click="copyReference(doc)">
              <span aria-hidden="true">⧉</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="item.uploadedUrl" class="success-box">
      <div class="success-box__label">上传结果</div>
      <div class="success-box__value">{{ item.uploadedUrl }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { showMessage } from 'siyuan'
import type { ImageItem, ImageSourceType } from '@/types/plugin'

const props = defineProps<{
  item: ImageItem
}>()

defineEmits<{
  (e: 'retry', item: ImageItem): void
  (e: 'cancel', imageId: string): void
}>()

const docsExpanded = defineModel<boolean>('docsExpanded', { default: false })
const localSelected = computed({
  get: () => props.item.selected,
  set: (value) => {
    props.item.selected = value
  },
})

function sourceTypeLabel(type: ImageSourceType) {
  if (type === 'local')
    return '本'
  if (type === 'own')
    return '外'
  return '外'
}

function toMarkdown(url: string) {
  return `![](${url})`
}

function toggleSelected() {
  localSelected.value = !localSelected.value
}

function closeDocs() {
  docsExpanded.value = false
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && docsExpanded.value)
    closeDocs()
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    showMessage('已复制到剪贴板')
  }
  catch {
    showMessage('复制失败')
  }
}

function copyReference(doc: ImageItem['docs'][number]) {
  copyText(`${doc.docHPath || doc.docPath || doc.docId}\n${doc.originalUrl}`)
}

watch(docsExpanded, (value) => {
  if (!value)
    return
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>
