import { computed, ref } from 'vue'
import { showMessage } from 'siyuan'
import { pushErrMsg } from '@/api'
import { runWithConcurrency } from '@/services/async-pool'
import { fetchFileFromImage, formatUploadError, uploadFileToCfBed } from '@/services/cfbed-upload'
import { formatDateTime, formatTime } from '@/utils/time'
import type { BatchUploadScope, CfBedConfig, ImageItem, PluginSettings, UploadTaskSummary } from '@/types/plugin'
import type { QueueUploadItem } from '@/components/cfbed/UploadQueueItem.vue'

type UploadLogType = 'info' | 'success' | 'error'

type UploadLogItem = {
  id: string
  type: UploadLogType
  time: string
  message: string
}

type UseUploaderOptions = {
  settings: PluginSettings
  filteredImages: { value: ImageItem[] }
  activeConfig: () => CfBedConfig
  refreshImages: () => Promise<void>
  replaceUploadedLinks: () => Promise<void>
  patchImage: (id: string, patch: Partial<ImageItem>) => void
  addMapping?: (item: any) => void
  findSuccessfulMapping?: (sourceUrl: string) => { targetUrl: string } | undefined
}

export function useUploader(options: UseUploaderOptions) {
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

  function appendFiles(files: File[]) {
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    const items = imageFiles.map(createQueueItem)
    uploadQueue.value.push(...items)
    if (items.length) {
      addUploadLog('info', `已加入 ${items.length} 个待上传文件`)
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
      pushErrMsg('正在上传中，不能清空队列')
      return
    }
    uploadQueue.value = []
  }

  function patchQueueItem(id: string, patch: Partial<QueueUploadItem>) {
    uploadQueue.value = uploadQueue.value.map(item => item.id === id ? { ...item, ...patch } : item)
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
          message: '上传已取消',
        }
      }
      return item
    })

    for (const item of options.filteredImages.value) {
      if (item.status === 'queued' || item.status === 'preparing' || item.status === 'uploading') {
        options.patchImage(item.id, {
          status: 'cancelled',
          message: '上传已取消',
        })
      }
    }

    addUploadLog('info', '已取消所有上传任务')
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
      message: '上传已取消',
    })
    addUploadLog('info', `已取消队列文件上传：${queueId}`)
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
      message: '上传已取消',
    })
    addUploadLog('info', `已取消图片上传：${imageId}`)
  }

  async function uploadOneQueueItem(item: QueueUploadItem, config: CfBedConfig) {
    const taskKey = makeTaskKey('queue', item.id)
    const controller = new AbortController()
    runningControllers.set(taskKey, controller)

    patchQueueItem(item.id, {
      status: 'uploading',
      progress: 0,
      message: '',
    })

    try {
      addUploadLog('info', `开始上传：${item.name}`)
      const uploadedUrl = await uploadFileToCfBed(item.file, config, {
        onLog: addUploadLog,
        signal: controller.signal,
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
        message: '上传成功',
      })

      options.addMapping?.({
        id: `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sourceUrl: item.name,
        targetUrl: uploadedUrl,
        sourceType: 'queue',
        fileName: item.name,
        status: 'success',
        time: formatDateTime(),
      })

      addUploadLog('success', `${item.name} 上传成功：${uploadedUrl}`)
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
        targetUrl: '',
        sourceType: 'queue',
        fileName: item.name,
        status: error?.name === 'AbortError' ? 'cancelled' : 'error',
        time: formatDateTime(),
      })

      addUploadLog(error?.name === 'AbortError' ? 'info' : 'error', `${item.name} 上传失败：${detail}`)
      if (error?.name !== 'AbortError') {
        pushErrMsg(`${item.name} 上传失败：${detail}`)
      }
    }
    finally {
      runningControllers.delete(taskKey)
    }
  }

  async function uploadQueuedFiles() {
    if (!uploadQueue.value.length) {
      pushErrMsg('请先选择图片')
      return
    }

    let config: CfBedConfig
    try {
      config = options.activeConfig()
    }
    catch (error: any) {
      pushErrMsg(error?.message || '配置不可用')
      return
    }

    queueUploading.value = true
    queueSuccessCount.value = 0

    const pendingItems = uploadQueue.value.filter(item =>
      item.status === 'idle'
      || item.status === 'error'
      || item.status === 'cancelled',
    )

    const reusableItems = pendingItems.filter(item => options.findSuccessfulMapping?.(item.name))
    for (const item of reusableItems) {
      const mapped = options.findSuccessfulMapping?.(item.name)
      if (!mapped)
        continue
      patchQueueItem(item.id, {
        status: 'success',
        progress: 100,
        uploadedUrl: mapped.targetUrl,
        message: '已复用历史上传链接',
      })
      addUploadLog('success', `${item.name} 命中历史记录，已跳过上传`)
    }

    const uploadItems = pendingItems.filter(item => !options.findSuccessfulMapping?.(item.name))

    for (const item of uploadItems) {
      patchQueueItem(item.id, {
        status: 'queued',
        progress: 0,
        message: '',
      })
    }

    try {
      await runWithConcurrency(uploadItems, uploadConcurrency.value, async (item) => {
        await uploadOneQueueItem(item, config)
      })

      showMessage(`上传完成：${queueSuccessCount.value + reusableItems.length}/${pendingItems.length}`)
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

    let config: CfBedConfig
    try {
      config = options.activeConfig()
    }
    catch (error: any) {
      pushErrMsg(error?.message || '配置不可用')
      return
    }

    await uploadOneQueueItem(target, config)
  }

  async function uploadOneImage(item: ImageItem, config: CfBedConfig) {
    const taskKey = makeTaskKey('image', item.id)
    const controller = new AbortController()
    runningControllers.set(taskKey, controller)

    options.patchImage(item.id, {
      status: 'preparing',
      progress: 0,
      message: '正在读取图片',
    })

    try {
      addUploadLog('info', `开始准备图片：${item.url}`)
      const file = await fetchFileFromImage(item.url, controller.signal)

      options.patchImage(item.id, {
        status: 'uploading',
        progress: 0,
        message: '',
      })

      addUploadLog('info', `开始上传图片：${item.url}`)
      const uploadedUrl = await uploadFileToCfBed(file, config, {
        onLog: addUploadLog,
        signal: controller.signal,
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
        message: '上传成功',
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

      addUploadLog('success', `图片上传成功：${item.url} -> ${uploadedUrl}`)
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

      addUploadLog(error?.name === 'AbortError' ? 'info' : 'error', `图片上传失败：${item.url}，原因：${message}`)
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

  async function uploadSelectedByScope(scope: BatchUploadScope = 'all') {
    const selected = filterImagesByScope(scope)
    if (!selected.length) {
      pushErrMsg('没有符合条件的图片可上传')
      return
    }

    let config: CfBedConfig
    try {
      config = options.activeConfig()
    }
    catch (error: any) {
      pushErrMsg(error?.message || '配置不可用')
      return
    }

    imageUploading.value = true
    imageSuccessCount.value = 0

    const reusableImages = selected.filter(item => options.findSuccessfulMapping?.(item.url))
    for (const item of reusableImages) {
      const mapped = options.findSuccessfulMapping?.(item.url)
      if (!mapped)
        continue
      options.patchImage(item.id, {
        uploadedUrl: mapped.targetUrl,
        status: 'success',
        progress: 100,
        message: '已复用历史上传链接',
      })
      addUploadLog('success', `图片命中历史记录，已跳过上传：${item.url}`)
      imageSuccessCount.value++
    }

    const uploadImages = selected.filter(item => !options.findSuccessfulMapping?.(item.url))

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

      showMessage(`上传完成：${imageSuccessCount.value}/${selected.length}`)
      if (options.settings.autoReplace && imageSuccessCount.value > 0) {
        await options.replaceUploadedLinks()
      }
    }
    finally {
      imageUploading.value = false
      imageSuccessCount.value = 0
    }
  }

  async function uploadSelected() {
    await uploadSelectedByScope('all')
  }

  async function retryImage(item: ImageItem) {
    const mapped = options.findSuccessfulMapping?.(item.url)
    if (mapped?.targetUrl) {
      options.patchImage(item.id, {
        uploadedUrl: mapped.targetUrl,
        status: 'success',
        progress: 100,
        message: '已复用历史上传链接',
      })
      addUploadLog('success', `图片命中历史记录，已跳过上传：${item.url}`)
      return
    }

    let config: CfBedConfig
    try {
      config = options.activeConfig()
    }
    catch (error: any) {
      pushErrMsg(error?.message || '配置不可用')
      return
    }

    await uploadOneImage(item, config)
  }

  async function retryFailedImages() {
    const failed = options.filteredImages.value.filter(item =>
      item.sourceType !== 'own'
      && (item.status === 'error' || item.status === 'cancelled'),
    )

    if (!failed.length) {
      pushErrMsg('没有可重试的失败图片')
      return
    }

    let config: CfBedConfig
    try {
      config = options.activeConfig()
    }
    catch (error: any) {
      pushErrMsg(error?.message || '配置不可用')
      return
    }

    const reusableFailed = failed.filter(item => options.findSuccessfulMapping?.(item.url))
    for (const item of reusableFailed) {
      const mapped = options.findSuccessfulMapping?.(item.url)
      if (!mapped)
        continue
      options.patchImage(item.id, {
        uploadedUrl: mapped.targetUrl,
        status: 'success',
        progress: 100,
        message: '已复用历史上传链接',
      })
      addUploadLog('success', `图片命中历史记录，已跳过上传：${item.url}`)
    }

    const retryItems = failed.filter(item => !options.findSuccessfulMapping?.(item.url))

    await runWithConcurrency(retryItems, uploadConcurrency.value, async (item) => {
      await uploadOneImage(item, config)
    })
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
      pushErrMsg('没有可重试的队列文件')
      return
    }

    let config: CfBedConfig
    try {
      config = options.activeConfig()
    }
    catch (error: any) {
      pushErrMsg(error?.message || '配置不可用')
      return
    }

    await runWithConcurrency(failed, uploadConcurrency.value, async (item) => {
      await uploadOneQueueItem(item, config)
    })
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
    retryImage,
    retryFailedImages,
    retryQueueItem,
    retryFailedQueueItems,
    cancelAllUploads,
    cancelImageUpload,
    cancelQueueUpload,
  }
}
