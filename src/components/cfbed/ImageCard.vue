<template>
  <div class="image-card premium-card" :class="{ 'image-card--selected': localSelected }" @click="toggleSelected">
    <div class="image-head">
      <span class="tag image-tag" :class="`tag--${item.sourceType}`">{{ sourceTypeLabel(item.sourceType) }}</span>
      <button
        class="ref-count"
        :class="{ 'ref-count--active': docsExpanded }"
        :title="item.referencesLoading ? '正在刷新引用数' : (docsExpanded ? '关闭引用窗口' : '查看引用内容')"
        @click.stop="docsExpanded = !docsExpanded"
      >
        <span class="ref-count__value">{{ item.referenceCount || 0 }}</span>
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

    <div class="toolbar-row wrap toolbar-row--panel image-toolbar" @click.stop>
      <button class="image-action image-action--compact" @click="copyText(item.url)">原链接</button>
      <button
        v-if="item.sourceType !== 'own' && item.status !== 'uploading' && item.status !== 'preparing' && item.status !== 'queued'"
        class="image-action image-action--compact"
        :class="{ 'image-action--success': item.status === 'success' && !!item.uploadedUrl }"
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

    <div v-if="replacePreviewActive && item.uploadedUrl && !item.replacePreviewExcluded" class="ref-dialog ref-dialog--replace" @click.stop>
      <div class="ref-dialog__panel premium-card">
        <div class="ref-dialog__head">
          <div class="ref-dialog__title-wrap">
            <div class="ref-dialog__title">替换预览</div>
            <div class="ref-dialog__subtitle">共 {{ item.docs.length }} 处待替换</div>
          </div>
        </div>

        <div class="ref-dialog__list ref-dialog__list--replace">
          <div
            v-for="doc in item.docs"
            :key="`${item.id}-${doc.docId}-${doc.originalUrl}`"
            class="ref-dialog__item ref-dialog__item--replace"
          >
            <div class="ref-dialog__main ref-dialog__main--replace">
              <div class="ref-dialog__path">{{ doc.docHPath || doc.docPath || doc.docId }}</div>
              <div class="replace-link-pair">
                <div class="replace-link-pair__label">原链接</div>
                <div class="replace-link-pair__value">{{ doc.originalUrl || item.url }}</div>
              </div>
              <div class="replace-link-pair replace-link-pair--next">
                <div class="replace-link-pair__label">替换为</div>
                <div class="replace-link-pair__value">{{ item.uploadedUrl }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="toolbar-row wrap toolbar-row--panel replace-action-row">
          <button class="image-action image-action--compact image-action--danger" @click="$emit('cancel-replace', item)">取消</button>
          <button class="image-action image-action--compact image-action--success" @click="$emit('confirm-replace', item)">确认替换</button>
        </div>
      </div>
    </div>

    <div v-if="docsExpanded" class="ref-dialog" @click.stop>
      <div class="ref-dialog__mask" @click="docsExpanded = false" />
      <div class="ref-dialog__panel premium-card">
        <div class="ref-dialog__head">
          <div class="ref-dialog__title-wrap">
            <div class="ref-dialog__title">引用内容</div>
            <div class="ref-dialog__subtitle">共 {{ item.referenceCount || 0 }} 条引用</div>
          </div>
          <button class="ref-dialog__icon-btn" title="关闭" @click="closeDocs">
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div v-if="item.referencesLoading" class="minor-text">正在查找引用…</div>

        <div v-else-if="!item.references?.length" class="minor-text">未找到引用</div>

        <div v-else class="ref-dialog__list">
          <div
            v-for="doc in item.references"
            :key="doc.blockId"
            class="ref-dialog__item"
            role="button"
            tabindex="0"
            title="点击跳转到引用块"
            @click="openReference(doc)"
            @keydown.enter.prevent="openReference(doc)"
            @keydown.space.prevent="openReference(doc)"
          >
            <div class="ref-dialog__main">
              <div class="ref-dialog__path">{{ doc.hpath || doc.path || doc.rootId || doc.blockId }}</div>
              <div class="ref-dialog__content">{{ doc.markdown || doc.content || doc.originalUrl }}</div>
            </div>
            <button class="ref-dialog__icon-btn ref-dialog__copy" title="复制" @click.stop="copyReference(doc)">
              <span aria-hidden="true">⧉</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { openTab, showMessage } from 'siyuan'
import { queryAssetReferences } from '@/api/index'
import { usePlugin } from '@/main'
import type { ImageItem, ImageReferenceItem, ImageSourceType } from '@/types/plugin'

const props = defineProps<{
  item: ImageItem
  replacePreviewActive?: boolean
}>()

defineEmits<{
  (e: 'retry', item: ImageItem): void
  (e: 'cancel', imageId: string): void
  (e: 'confirm-replace', item: ImageItem): void
  (e: 'cancel-replace', item: ImageItem): void
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

function copyReference(doc: ImageReferenceItem) {
  copyText(`${doc.hpath || doc.path || doc.rootId || doc.blockId}\n${doc.markdown || doc.content || doc.originalUrl}`)
}

function openReference(doc: ImageReferenceItem) {
  try {
    const plugin = usePlugin()
    if (!plugin?.app) {
      showMessage('未获取到插件上下文，无法跳转')
      return
    }

    const targetId = doc.blockId.startsWith('fallback:')
      ? doc.rootId
      : doc.blockId

    openTab({
      app: plugin.app,
      doc: {
        id: targetId,
        action: ['cb-get-focus', 'cb-get-hl'],
        zoomIn: false,
      },
      keepCursor: false,
      removeCurrentTab: false,
    })

    window._sy_plugin_sample?.togglePanel?.(false)
  }
  catch {
    showMessage('跳转失败')
  }
}

function createFallbackReferences(item: Pick<ImageItem, 'docs' | 'url'>): ImageReferenceItem[] {
  return item.docs.map((doc, index) => ({
    blockId: `fallback:${doc.docId}:${index}`,
    rootId: doc.docId,
    box: '',
    path: doc.docPath,
    hpath: doc.docHPath,
    markdown: doc.originalUrl,
    content: doc.originalUrl,
    originalUrl: doc.originalUrl || item.url,
  }))
}

watch(docsExpanded, (value) => {
  if (!value)
    return

  if (props.item.referencesLoading)
    return

  props.item.referencesLoading = true
  queryAssetReferences(props.item.url)
    .then((rows) => {
      const fallbackReferences = createFallbackReferences(props.item)
      props.item.references = rows.length ? rows : fallbackReferences
      props.item.referenceCount = Math.max(rows.length, fallbackReferences.length)
    })
    .catch(() => {
      const fallbackReferences = createFallbackReferences(props.item)
      props.item.references = fallbackReferences
      props.item.referenceCount = fallbackReferences.length
      showMessage('查找引用失败')
    })
    .finally(() => {
      props.item.referencesLoading = false
    })
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>
