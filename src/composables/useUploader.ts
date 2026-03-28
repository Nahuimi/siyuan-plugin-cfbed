import { computed, ref } from 'vue'
import { showMessage } from 'siyuan'
import { getCurrentDocIdFromLayout, getDocInfoById, pushErrMsg } from '@/api/index'
import { runWithConcurrency } from '@/services/async-pool'
import { fetchFileFromImage, formatUploadError, uploadFileToCfBed } from '@/services/cfbed-upload'
import { useI18n } from '@/utils/i18n'
import { formatDateTime, formatTime } from '@/utils/time'
import type { BatchUploadScope, CfBedConfig, ImageItem, PluginSettings, QueueUploadItem, UploadLogItem, UploadLogType, UploadTaskSummary } from '@/types/plugin'
import { createUploadTemplateContext } from '@/utils/upload-config'

type UseUploaderOptions = {
  settings: { value: PluginSettings }
  filteredImages: { value: ImageItem[] }
  activeConfig: () => CfBedConfig
  refreshImages: (docId?: string) => Promise<void>
  replaceUploadedLinks: (targetImages?: ImageItem[]) => Promise<void>
  patchImage: (id: string, patch: Partial<ImageItem>) => void
  addMapping?: (item: any) => void
  findSuccessfulMapping?: (sourceUrl: string, sourceKey?: string) => { targetUrl: string } | undefined
}

type SuccessfulMapping = {
  targetUrl: string
}

export function useUploader(options: UseUploaderOptions) {
  const { t } = useI18n()
  const uploadQueue = ref<QueueUploadItem[]>([])
  const uploadLogs = ref<UploadLogItem[]>([])
  const isDragging = ref(false)
  const uploadConcurrency = ref(3)

  const runningControllers = new Map<string, AbortController>()
  const queueUploading = ref(false)
  const imageUploading = ref(false)
  const queueSuccessCount = ref(0)
  const imageSuccessCount = ref(0)

  const hasRunningTask = computed(() => runningControllers.size > 0)

  function resolveActiveConfig() {
    try {
      return options.activeConfig()
    }
    catch (error: any) {
      pushErrMsg(error?.message || t('uploader.error.configUnavailable', '配置不可用'))
      return null
    }
  }

  function addUploadLog(type: UploadLogType, message: string) {
    uploadLogs.value.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      time: formatTime(),
      message,
    })
    if (uploadLogs.value.length > 200) {
      uploadLogs.value.length = 200
    }
  }

  function removeUploadLog(id: string) {
    uploadLogs.value = uploadLogs.value.filter(item => item.id !== id)
  }

  function clearUploadLogs() {
    uploadLogs.value = []
  }

  function createQueueItem(file: File): QueueUploadItem {
    return {
      id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      name: file.name,
      size: file.size,
      status: 'idle',
      progress: 0,
      message: '',
      uploadedUrl: '',
    }
  }

  function getQueueSourceKey(file: File) {
    return `queue:${file.name}:${file.size}:${file.lastModified}`
  }

  async function resolveActiveNotePath() {
    const currentDocId = getCurrentDocIdFromLayout()
    if (!currentDocId)
      return ''

    try {
      const doc = await getDocInfoById(currentDocId)
      return doc.hpath
    }
    catch {
      return ''
    }
  }

  function appendFiles(files: File[]) {
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    const items = imageFiles.map(createQueueItem)
    uploadQueue.value.push(...items)
    if (items.length) {
      addUploadLog('info', t('uploader.log.filesAdded', '已加入 {count} 个待上传文件', { count: items.length }))
    }
  }

  function handleDrop(event: DragEvent) {
    isDragging.value = false
    const files = Array.from(event.dataTransfer?.files || [])
    appendFiles(files)
  }

  function handleFileInputChange(event: Event) {
    const files = Array.from((event.target as HTMLInputElement).files || [])
    appendFiles(files)
    ;(event.target as HTMLInputElement).value = ''
  }

  function clearUploadQueue() {
    if (queueUploading.value) {
      pushErrMsg(t('uploader.error.cannotClearQueue', '正在上传中，不能清空队列'))
      return
    }
    uploadQueue.value = []
  }

  function patchQueueItem(id: string, patch: Partial<QueueUploadItem>) {
    uploadQueue.value = uploadQueue.value.map(item => item.id === id ? { ...item, ...patch } : item)
  }

  function getQueueMapping(item: QueueUploadItem) {
    return options.findSuccessfulMapping?.(item.name, getQueueSourceKey(item.file))
  }

  function getImageMapping(item: ImageItem) {
    return options.findSuccessfulMapping?.(item.url)
  }

  function applyQueueMapping(item: QueueUploadItem, mapped: SuccessfulMapping, message = t('uploader.message.reusedLink', '已复用历史上传链接')) {
    patchQueueItem(item.id, {
      status: 'success',
      progress: 100,
      uploadedUrl: mapped.targetUrl,
      message,
    })
    addUploadLog('success', t('uploader.log.queueHitHistory', '{name} 命中历史记录，已跳过上传', { name: item.name }))
  }

  function applyImageMapping(item: ImageItem, mapped: SuccessfulMapping, message = t('uploader.message.reusedLink', '已复用历史上传链接')) {
    options.patchImage(item.id, {
      uploadedUrl: mapped.targetUrl,
      status: 'success',
      progress: 100,
      message,
    })
    addUploadLog('success', t('uploader.log.imageHitHistory', '图片命中历史记录，已跳过上传：{url}', { url: item.url }))
  }

  function reuseQueueMappings(items: QueueUploadItem[]) {
    const reused = new Set<string>()

    for (const item of items) {
      const mapped = getQueueMapping(item)
      if (!mapped)
        continue

      reused.add(item.id)
      applyQueueMapping(item, mapped)
    }

    return reused
  }

  function reuseImageMappings(items: ImageItem[], countAsSuccess = false) {
    const reused = new Set<string>()

    for (const item of items) {
      const mapped = getImageMapping(item)
      if (!mapped)
        continue

      reused.add(item.id)
      applyImageMapping(item, mapped)
      if (countAsSuccess)
        imageSuccessCount.value++
    }

    return reused
  }

  function makeTaskKey(prefix: string, unique: string) {
    return `${prefix}:${unique}`
  }

  function cancelAllUploads() {
    for (const controller of runningControllers.values()) {
      controller.abort()
    }
    runningControllers.clear()

    uploadQueue.value = uploadQueue.value.map(item => {
      if (item.status === 'queued' || item.status === 'preparing' || item.status === 'uploading') {
        return {
          ...item,
          status: 'cancelled',
          message: t('uploader.message.cancelled', '上传已取消'),
        }
      }
      return item
    })

    for (const item of options.filteredImages.value) {
      if (item.status === 'queued' || item.status === 'preparing' || item.status === 'uploading') {
        options.patchImage(item.id, {
          status: 'cancelled',
          message: t('uploader.message.cancelled', '上传已取消'),
        })
      }
    }

    addUploadLog('info', t('uploader.log.cancelAll', '已取消所有上传任务'))
  }

  function cancelQueueUpload(queueId: string) {
    const key = makeTaskKey('queue', queueId)
    const controller = runningControllers.get(key)
    if (controller) {
      controller.abort()
      runningControllers.delete(key)
    }
    patchQueueItem(queueId, {
      status: 'cancelled',
      message: t('uploader.message.cancelled', '上传已取消'),
    })
    addUploadLog('info', t('uploader.log.cancelQueue', '已取消队列文件上传：{id}', { id: queueId }))
  }

  function cancelImageUpload(imageId: string) {
    const key = makeTaskKey('image', imageId)
    const controller = runningControllers.get(key)
    if (controller) {
      controller.abort()
      runningControllers.delete(key)
    }
    options.patchImage(imageId, {
      status: 'cancelled',
      message: t('uploader.message.cancelled', '上传已取消'),
    })
    addUploadLog('info', t('uploader.log.cancelImage', '已取消图片上传：{id}', { id: imageId }))
  }

  async function uploadOneQueueItem(item: QueueUploadItem, config: CfBedConfig, noteFilePath = '') {
    const taskKey = makeTaskKey('queue', item.id)
    const controller = new AbortController()
    runningControllers.set(taskKey, controller)

    patchQueueItem(item.id, {
      status: 'uploading',
      progress: 0,
      message: '',
    })

    try {
      addUploadLog('info', t('uploader.log.startQueueUpload', '开始上传：{name}', { name: item.name }))
      const uploadedUrl = await uploadFileToCfBed(item.file, config, {
        onLog: addUploadLog,
        signal: controller.signal,
        templateContext: createUploadTemplateContext(item.file.name, noteFilePath),
        onProgress: (percent) => {
          patchQueueItem(item.id, {
            status: 'uploading',
            progress: percent,
          })
        },
      })

      queueSuccessCount.value++
      patchQueueItem(item.id, {
        status: 'success',
        progress: 100,
        uploadedUrl,
        message: t('uploader.message.uploadSuccess', '上传成功'),
      })

      options.addMapping?.({
        id: `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sourceUrl: item.name,
        sourceKey: getQueueSourceKey(item.file),
        targetUrl: uploadedUrl,
        sourceType: 'queue',
        fileName: item.name,
        status: 'success',
        time: formatDateTime(),
      })

      addUploadLog('success', t('uploader.log.queueUploadSuccess', '{name} 上传成功：{url}', { name: item.name, url: uploadedUrl }))
    }
    catch (error: any) {
      const detail = formatUploadError(error)
      patchQueueItem(item.id, {
        status: error?.name === 'AbortError' ? 'cancelled' : 'error',
        message: detail,
      })

      options.addMapping?.({
        id: `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sourceUrl: item.name,
        sourceKey: getQueueSourceKey(item.file),
        targetUrl: '',
        sourceType: 'queue',
        fileName: item.name,
        status: error?.name === 'AbortError' ? 'cancelled' : 'error',
        time: formatDateTime(),
      })

      addUploadLog(error?.name === 'AbortError' ? 'info' : 'error', t('uploader.log.queueUploadFailed', '{name} 上传失败：{detail}', { name: item.name, detail }))
      if (error?.name !== 'AbortError') {
        pushErrMsg(t('uploader.notify.queueUploadFailed', '{name} 上传失败：{detail}', { name: item.name, detail }))
      }
    }
    finally {
      runningControllers.delete(taskKey)
    }
  }

  async function uploadQueuedFiles() {
    if (!uploadQueue.value.length) {
      pushErrMsg(t('uploader.error.selectImagesFirst', '请先选择图片'))
      return
    }

    const config = resolveActiveConfig()
    if (!config)
      return

    const pendingItems = uploadQueue.value.filter(item =>
      item.status === 'idle'
      || item.status === 'error'
      || item.status === 'cancelled',
    )

    if (!pendingItems.length) {
      pushErrMsg(t('uploader.error.noQueueFiles', '没有可上传的队列文件'))
      return
    }

    queueUploading.value = true
    queueSuccessCount.value = 0
    const noteFilePath = await resolveActiveNotePath()

    const reusedQueueIds = reuseQueueMappings(pendingItems)
    const uploadItems = pendingItems.filter(item => !reusedQueueIds.has(item.id))

    for (const item of uploadItems) {
      patchQueueItem(item.id, {
        status: 'queued',
        progress: 0,
        message: '',
      })
    }

    try {
      await runWithConcurrency(uploadItems, uploadConcurrency.value, async (item) => {
        await uploadOneQueueItem(item, config, noteFilePath)
      })

      showMessage(t('uploader.message.uploadComplete', '上传完成：{done}/{total}', {
        done: queueSuccessCount.value + reusedQueueIds.size,
        total: pendingItems.length,
      }))
      await options.refreshImages()
    }
    finally {
      queueUploading.value = false
      queueSuccessCount.value = 0
    }
  }

  async function retryQueueItem(queueId: string) {
    const target = uploadQueue.value.find(item => item.id === queueId)
    if (!target)
      return

    const mapped = getQueueMapping(target)
    if (mapped) {
      applyQueueMapping(target, mapped)
      return
    }

    const config = resolveActiveConfig()
    if (!config)
      return

    await uploadOneQueueItem(target, config, await resolveActiveNotePath())
  }

  async function uploadOneImage(item: ImageItem, config: CfBedConfig) {
    const taskKey = makeTaskKey('image', item.id)
    const controller = new AbortController()
    runningControllers.set(taskKey, controller)

    options.patchImage(item.id, {
      status: 'preparing',
      progress: 0,
      message: t('uploader.message.preparingImage', '正在读取图片'),
    })

    try {
      addUploadLog('info', t('uploader.log.prepareImage', '开始准备图片：{url}', { url: item.url }))
      const file = await fetchFileFromImage(item.url, controller.signal)

      options.patchImage(item.id, {
        status: 'uploading',
        progress: 0,
        message: '',
      })

      addUploadLog('info', t('uploader.log.startImageUpload', '开始上传图片：{url}', { url: item.url }))
      const uploadedUrl = await uploadFileToCfBed(file, config, {
        onLog: addUploadLog,
        signal: controller.signal,
        templateContext: createUploadTemplateContext(file.name, item.docs[0]?.docHPath || item.docs[0]?.docPath || ''),
        onProgress: (percent) => {
          options.patchImage(item.id, {
            status: 'uploading',
            progress: percent,
            message: '',
          })
        },
      })

      imageSuccessCount.value++
      options.patchImage(item.id, {
        uploadedUrl,
        status: 'success',
        progress: 100,
        message: t('uploader.message.uploadSuccess', '上传成功'),
      })

      options.addMapping?.({
        id: `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sourceUrl: item.url,
        targetUrl: uploadedUrl,
        sourceType: 'image',
        imageId: item.id,
        status: 'success',
        time: formatDateTime(),
      })

      addUploadLog('success', t('uploader.log.imageUploadSuccess', '图片上传成功：{from} -> {to}', {
        from: item.url,
        to: uploadedUrl,
      }))
    }
    catch (error: any) {
      const message = formatUploadError(error)
      options.patchImage(item.id, {
        status: error?.name === 'AbortError' ? 'cancelled' : 'error',
        message,
      })

      options.addMapping?.({
        id: `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sourceUrl: item.url,
        targetUrl: '',
        sourceType: 'image',
        imageId: item.id,
        status: error?.name === 'AbortError' ? 'cancelled' : 'error',
        time: formatDateTime(),
      })

      addUploadLog(error?.name === 'AbortError' ? 'info' : 'error', t('uploader.log.imageUploadFailed', '图片上传失败：{url}，原因：{reason}', {
        url: item.url,
        reason: message,
      }))
    }
    finally {
      runningControllers.delete(taskKey)
    }
  }

  function filterImagesByScope(scope: BatchUploadScope) {
    return options.filteredImages.value.filter((item) => {
      if (!item.selected)
        return false
      if (item.sourceType === 'own')
        return false
      if (scope === 'all')
        return true
      if (scope === 'local')
        return item.sourceType === 'local'
      if (scope === 'external')
        return item.sourceType === 'external'
      return true
    })
  }

  function normalizeUploadTargets(targetImages: ImageItem[]) {
    const nextTargets = targetImages
      .map(item => options.filteredImages.value.find(current => current.id === item.id || current.url === item.url) || item)
      .filter(item => item.sourceType !== 'own')

    return nextTargets.filter((item, index) =>
      nextTargets.findIndex(current => current.id === item.id || current.url === item.url) === index,
    )
  }

  async function uploadImages(targetImages: ImageItem[]) {
    const selected = normalizeUploadTargets(targetImages)
    if (!selected.length) {
      pushErrMsg(t('uploader.error.noImagesForScope', '没有符合条件的图片可上传'))
      return
    }

    const config = resolveActiveConfig()
    if (!config)
      return

    imageUploading.value = true
    imageSuccessCount.value = 0

    const reusedImageIds = reuseImageMappings(selected, true)
    const uploadImages = selected.filter(item => !reusedImageIds.has(item.id))

    for (const item of uploadImages) {
      options.patchImage(item.id, {
        status: 'queued',
        progress: 0,
        message: '',
      })
    }

    try {
      await runWithConcurrency(uploadImages, uploadConcurrency.value, async (item) => {
        await uploadOneImage(item, config)
      })

      showMessage(t('uploader.message.uploadComplete', '上传完成：{done}/{total}', {
        done: imageSuccessCount.value,
        total: selected.length,
      }))
      if (options.settings.value.autoReplace && imageSuccessCount.value > 0) {
        await options.replaceUploadedLinks(selected)
        await options.refreshImages()
      }
    }
    finally {
      imageUploading.value = false
      imageSuccessCount.value = 0
    }
  }

  async function uploadSelectedByScope(scope: BatchUploadScope = 'all') {
    const selected = filterImagesByScope(scope)
    await uploadImages(selected)
  }

  async function uploadSelected() {
    await uploadSelectedByScope('all')
  }

  async function retryImage(item: ImageItem) {
    const mapped = getImageMapping(item)
    if (mapped?.targetUrl) {
      applyImageMapping(item, mapped)
      return
    }

    const config = resolveActiveConfig()
    if (!config)
      return

    await uploadOneImage(item, config)
  }

  async function retryFailedImages() {
    const failed = options.filteredImages.value.filter(item =>
      item.sourceType !== 'own'
      && (item.status === 'error' || item.status === 'cancelled'),
    )

    if (!failed.length) {
      pushErrMsg(t('uploader.error.noFailedImages', '没有可重试的失败图片'))
      return
    }

    const config = resolveActiveConfig()
    if (!config)
      return

    imageUploading.value = true
    imageSuccessCount.value = 0

    const reusedImageIds = reuseImageMappings(failed, true)
    const retryItems = failed.filter(item => !reusedImageIds.has(item.id))

    try {
      await runWithConcurrency(retryItems, uploadConcurrency.value, async (item) => {
        await uploadOneImage(item, config)
      })

      showMessage(t('uploader.message.retryComplete', '重试完成：{done}/{total}', {
        done: imageSuccessCount.value,
        total: failed.length,
      }))
      if (options.settings.value.autoReplace && imageSuccessCount.value > 0) {
        await options.replaceUploadedLinks(failed)
        await options.refreshImages()
      }
    }
    finally {
      imageUploading.value = false
      imageSuccessCount.value = 0
    }
  }

  const queueSummary = computed(() => {
    const total = uploadQueue.value.length
    const success = uploadQueue.value.filter(item => item.status === 'success').length
    const error = uploadQueue.value.filter(item => item.status === 'error').length
    const uploading = uploadQueue.value.filter(item => item.status === 'uploading' || item.status === 'preparing' || item.status === 'queued').length
    return { total, success, error, uploading }
  })

  async function retryFailedQueueItems() {
    const failed = uploadQueue.value.filter(item => item.status === 'error' || item.status === 'cancelled')
    if (!failed.length) {
      pushErrMsg(t('uploader.error.noFailedQueueFiles', '没有可重试的队列文件'))
      return
    }

    const config = resolveActiveConfig()
    if (!config)
      return

    queueUploading.value = true
    queueSuccessCount.value = 0
    const noteFilePath = await resolveActiveNotePath()

    const reusedQueueIds = reuseQueueMappings(failed)
    const retryItems = failed.filter(item => !reusedQueueIds.has(item.id))

    try {
      await runWithConcurrency(retryItems, uploadConcurrency.value, async (item) => {
        await uploadOneQueueItem(item, config, noteFilePath)
      })

      showMessage(t('uploader.message.retryComplete', '重试完成：{done}/{total}', {
        done: queueSuccessCount.value + reusedQueueIds.size,
        total: failed.length,
      }))
    }
    finally {
      queueUploading.value = false
      queueSuccessCount.value = 0
    }
  }

  const taskSummary = computed<UploadTaskSummary>(() => {
    const queueItems = uploadQueue.value

    const imageItems = options.filteredImages.value.filter(item =>
      item.status && item.status !== 'idle',
    )

    const allStatuses = [
      ...queueItems.map(item => ({
        status: item.status,
        progress: item.progress || 0,
      })),
      ...imageItems.map(item => ({
        status: item.status || 'idle',
        progress: item.progress || 0,
      })),
    ]

    const total = allStatuses.length
    const running = allStatuses.filter(item =>
      item.status === 'queued' || item.status === 'preparing' || item.status === 'uploading',
    ).length
    const success = allStatuses.filter(item => item.status === 'success').length
    const error = allStatuses.filter(item => item.status === 'error').length
    const cancelled = allStatuses.filter(item => item.status === 'cancelled').length

    const progress = total
      ? Math.round(allStatuses.reduce((sum, item) => sum + (item.progress || 0), 0) / total)
      : 0

    return {
      total,
      running,
      success,
      error,
      cancelled,
      progress,
    }
  })

  return {
    isDragging,
    uploadQueue,
    uploadLogs,
    uploadConcurrency,
    queueUploading,
    imageUploading,
    hasRunningTask,
    queueSummary,
    taskSummary,
    appendFiles,
    handleDrop,
    handleFileInputChange,
    clearUploadQueue,
    uploadQueuedFiles,
    uploadSelected,
    uploadSelectedByScope,
    uploadImages,
    retryImage,
    retryFailedImages,
    retryQueueItem,
    retryFailedQueueItems,
    cancelAllUploads,
    cancelImageUpload,
    cancelQueueUpload,
    removeUploadLog,
    clearUploadLogs,
  }
}
