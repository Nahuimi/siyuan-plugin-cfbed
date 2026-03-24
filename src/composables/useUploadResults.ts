import { computed, ref } from 'vue'
import { showMessage } from 'siyuan'
import { buildReplacePreviewItems } from '@/utils/replace'
import type { ImageItem, ReplacePreviewItem, UploadLogFilter, UploadMappingItem } from '@/types/plugin'

const UPLOAD_MAPPINGS_STORAGE_KEY = 'cfbed-upload-mappings'

type UploadLogItem = {
  id: string
  type: 'info' | 'success' | 'error'
  time: string
  message: string
}

type UseUploadResultsOptions = {
  filteredImages: { value: ImageItem[] }
}

export function useUploadResults(options: UseUploadResultsOptions) {
  const uploadMappings = ref<UploadMappingItem[]>(loadMappings())
  const uploadLogFilter = ref<UploadLogFilter>('all')
  const replacePreviewVisible = ref(false)
  const replacePreviewItems = ref<ReplacePreviewItem[]>([])

  function addMapping(item: UploadMappingItem) {
    uploadMappings.value.unshift(item)
    if (uploadMappings.value.length > 2000) {
      uploadMappings.value.length = 2000
    }
    persistMappings()
  }

  function clearMappings() {
    uploadMappings.value = []
    persistMappings()
  }

  function removeMapping(id: string) {
    uploadMappings.value = uploadMappings.value.filter(item => item.id !== id)
    persistMappings()
  }

  function findSuccessfulMapping(sourceUrl: string) {
    if (!sourceUrl)
      return undefined
    return uploadMappings.value.find(item => item.sourceUrl === sourceUrl && item.status === 'success' && item.targetUrl)
  }

  function buildReplacePreview() {
    replacePreviewItems.value = buildReplacePreviewItems(options.filteredImages.value)
    replacePreviewVisible.value = true
  }

  const mappingSummary = computed(() => {
    const total = uploadMappings.value.length
    const success = uploadMappings.value.filter(item => item.status === 'success').length
    const error = uploadMappings.value.filter(item => item.status === 'error').length
    const cancelled = uploadMappings.value.filter(item => item.status === 'cancelled').length
    return { total, success, error, cancelled }
  })

  function exportMappingsAsJson() {
    const blob = new Blob([JSON.stringify(uploadMappings.value, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    downloadBlob(blob, `cfbed-mappings-${Date.now()}.json`)
    showMessage('映射表已导出为 JSON')
  }

  function exportMappingsAsCsv() {
    const header = ['id', 'sourceUrl', 'targetUrl', 'sourceType', 'fileName', 'imageId', 'status', 'time']
    const rows = uploadMappings.value.map(item => [
      safeCsv(item.id),
      safeCsv(item.sourceUrl),
      safeCsv(item.targetUrl),
      safeCsv(item.sourceType),
      safeCsv(item.fileName || ''),
      safeCsv(item.imageId || ''),
      safeCsv(item.status),
      safeCsv(item.time),
    ])

    const csv = [header.join(','), ...rows.map(row => row.join(','))].join('\n')
    const blob = new Blob([`\uFEFF${csv}`], {
      type: 'text/csv;charset=utf-8',
    })
    downloadBlob(blob, `cfbed-mappings-${Date.now()}.csv`)
    showMessage('映射表已导出为 CSV')
  }

  function safeCsv(value: string) {
    const text = String(value ?? '')
    return `"${text.replace(/"/g, '""')}"`
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  function loadMappings() {
    try {
      const raw = localStorage.getItem(UPLOAD_MAPPINGS_STORAGE_KEY)
      if (!raw)
        return []
      return JSON.parse(raw) as UploadMappingItem[]
    }
    catch {
      return []
    }
  }

  function persistMappings() {
    localStorage.setItem(UPLOAD_MAPPINGS_STORAGE_KEY, JSON.stringify(uploadMappings.value))
  }

  function filterLogs(logs: UploadLogItem[]) {
    if (uploadLogFilter.value === 'all')
      return logs
    return logs.filter(log => log.type === uploadLogFilter.value)
  }

  return {
    uploadMappings,
    uploadLogFilter,
    replacePreviewVisible,
    replacePreviewItems,
    mappingSummary,
    addMapping,
    clearMappings,
    removeMapping,
    findSuccessfulMapping,
    buildReplacePreview,
    exportMappingsAsJson,
    exportMappingsAsCsv,
    filterLogs,
  }
}
