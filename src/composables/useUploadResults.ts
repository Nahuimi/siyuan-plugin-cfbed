import { computed, ref } from 'vue'
import { showMessage } from 'siyuan'
import { pushErrMsg } from '@/api/index'
import { usePlugin } from '@/main'
import { canImageBeReplaced } from '@/utils/replace'
import type { ImageItem, UploadLogFilter, UploadLogItem, UploadMappingItem } from '@/types/plugin'
import { useI18n } from '@/utils/i18n'
import { CFBED_MAPPINGS_LEGACY_STORAGE, CFBED_MAPPINGS_STORAGE } from '@/utils/plugin'

type UseUploadResultsOptions = {
  filteredImages: { value: ImageItem[] }
}

type MappingsPlugin = {
  loadData?: (storage: string) => Promise<UploadMappingItem[] | null | undefined>
  saveData?: (storage: string, data: UploadMappingItem[]) => Promise<void>
}

export function useUploadResults(options: UseUploadResultsOptions) {
  const plugin = usePlugin() as MappingsPlugin
  const { t } = useI18n()
  const uploadMappings = ref<UploadMappingItem[]>(loadLegacyMappings())
  const uploadLogFilter = ref<UploadLogFilter>('all')
  const replacePreviewActive = ref(false)
  let persistTimer: number | undefined
  let pendingSnapshot: UploadMappingItem[] | null = null
  let mappingsHydrated = false
  let mappingsMutatedBeforeHydrate = false

  void hydrateMappings()

  function addMapping(item: UploadMappingItem) {
    markMappingsMutated()
    uploadMappings.value.unshift(item)
    if (uploadMappings.value.length > 2000) {
      uploadMappings.value.length = 2000
    }
    persistMappings()
  }

  function clearMappings() {
    markMappingsMutated()
    uploadMappings.value = []
    persistMappings()
  }

  function removeMapping(id: string) {
    markMappingsMutated()
    uploadMappings.value = uploadMappings.value.filter(item => item.id !== id)
    persistMappings()
  }

  function findSuccessfulMapping(sourceUrl: string, sourceKey?: string) {
    const normalizedUrl = String(sourceUrl || '').trim()
    const normalizedKey = String(sourceKey || '').trim()

    if (!normalizedUrl && !normalizedKey)
      return undefined

    return uploadMappings.value.find((item) => {
      if (item.status !== 'success' || !item.targetUrl)
        return false
      if (normalizedKey && item.sourceKey === normalizedKey)
        return true
      return normalizedUrl ? item.sourceUrl === normalizedUrl : false
    })
  }

  function buildReplacePreview() {
    const replaceable = options.filteredImages.value.filter(canImageBeReplaced)
    if (!replaceable.length) {
      showMessage(t('mappings.preview.none', '当前没有可替换的已上传图片'))
      replacePreviewActive.value = false
      return
    }

    for (const image of options.filteredImages.value) {
      image.replacePreviewExcluded = !canImageBeReplaced(image)
    }

    replacePreviewActive.value = true
  }

  function hideReplacePreview() {
    replacePreviewActive.value = false
    for (const image of options.filteredImages.value) {
      image.replacePreviewExcluded = false
    }
  }

  function excludeImageFromReplacePreview(imageId: string) {
    const target = options.filteredImages.value.find(item => item.id === imageId)
    if (!target)
      return
    target.replacePreviewExcluded = true
  }

  function includeImageInReplacePreview(imageId: string) {
    const target = options.filteredImages.value.find(item => item.id === imageId)
    if (!target || !canImageBeReplaced(target))
      return
    target.replacePreviewExcluded = false
  }

  const replacePreviewImages = computed(() =>
    options.filteredImages.value.filter(item => canImageBeReplaced(item) && !item.replacePreviewExcluded),
  )

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
    showMessage(t('mappings.message.exportJson', '映射表已导出为 JSON'))
  }

  function exportMappingsAsCsv() {
    const header = ['id', 'sourceUrl', 'sourceKey', 'targetUrl', 'sourceType', 'fileName', 'imageId', 'status', 'time']
    const rows = uploadMappings.value.map(item => [
      safeCsv(item.id),
      safeCsv(item.sourceUrl),
      safeCsv(item.sourceKey || ''),
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
    showMessage(t('mappings.message.exportCsv', '映射表已导出为 CSV'))
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

  function normalizeMappings(items: UploadMappingItem[] | null | undefined): UploadMappingItem[] {
    if (!Array.isArray(items))
      return []

    return items
      .filter(Boolean)
      .map(item => ({
        ...item,
        sourceUrl: String(item.sourceUrl || ''),
        sourceKey: item.sourceKey ? String(item.sourceKey) : undefined,
        targetUrl: String(item.targetUrl || ''),
        sourceType: item.sourceType === 'queue' ? 'queue' as const : 'image' as const,
        status: item.status === 'cancelled' || item.status === 'error' ? item.status : 'success' as const,
        time: String(item.time || ''),
      }))
  }

  function loadLegacyMappings() {
    try {
      const raw = localStorage.getItem(CFBED_MAPPINGS_LEGACY_STORAGE)
      if (!raw)
        return []
      return normalizeMappings(JSON.parse(raw) as UploadMappingItem[])
    }
    catch {
      return []
    }
  }

  async function hydrateMappings() {
    try {
      const stored = normalizeMappings(await plugin.loadData?.(CFBED_MAPPINGS_STORAGE))
      if (stored.length && !mappingsMutatedBeforeHydrate) {
        uploadMappings.value = stored
      }

      if (!stored.length && uploadMappings.value.length) {
        await plugin.saveData?.(CFBED_MAPPINGS_STORAGE, uploadMappings.value)
        localStorage.removeItem(CFBED_MAPPINGS_LEGACY_STORAGE)
      }
    }
    catch (error: any) {
      pushErrMsg(error?.message || t('mappings.error.readFailed', '读取上传映射失败'))
    }
    finally {
      mappingsHydrated = true
    }
  }

  function persistMappings() {
    if (persistTimer)
      window.clearTimeout(persistTimer)

    const snapshot = normalizeMappings(uploadMappings.value)
    pendingSnapshot = snapshot
    uploadMappings.value = snapshot

    persistTimer = window.setTimeout(async () => {
      try {
        await plugin.saveData?.(CFBED_MAPPINGS_STORAGE, snapshot)
        localStorage.removeItem(CFBED_MAPPINGS_LEGACY_STORAGE)
        pendingSnapshot = null
      }
      catch (error: any) {
        try {
          localStorage.setItem(CFBED_MAPPINGS_LEGACY_STORAGE, JSON.stringify(snapshot))
        }
        catch {}
        pushErrMsg(error?.message || t('mappings.error.saveFailed', '保存上传映射失败'))
      }
    }, 160)
  }

  function markMappingsMutated() {
    if (!mappingsHydrated)
      mappingsMutatedBeforeHydrate = true
  }

  async function flushMappings() {
    if (!pendingSnapshot)
      return

    if (persistTimer)
      window.clearTimeout(persistTimer)

    const snapshot = pendingSnapshot
    pendingSnapshot = null
    await plugin.saveData?.(CFBED_MAPPINGS_STORAGE, snapshot)
    localStorage.removeItem(CFBED_MAPPINGS_LEGACY_STORAGE)
  }

  function filterLogs(logs: UploadLogItem[]) {
    if (uploadLogFilter.value === 'all')
      return logs
    return logs.filter(log => log.type === uploadLogFilter.value)
  }

  return {
    uploadMappings,
    uploadLogFilter,
    replacePreviewActive,
    replacePreviewImages,
    mappingSummary,
    addMapping,
    clearMappings,
    removeMapping,
    findSuccessfulMapping,
    buildReplacePreview,
    hideReplacePreview,
    excludeImageFromReplacePreview,
    includeImageInReplacePreview,
    exportMappingsAsJson,
    exportMappingsAsCsv,
    flushMappings,
    filterLogs,
  }
}
