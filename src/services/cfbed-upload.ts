import type { CfBedConfig, ConfigTestResult } from '@/types/plugin'
import { translate } from '@/utils/i18n'

type UploadLogType = 'info' | 'success' | 'error'

type UploadOptions = {
  signal?: AbortSignal
  onProgress?: (percent: number) => void
  onLog?: (type: UploadLogType, message: string) => void
}

type UploadHttpError = Error & {
  status?: number
  body?: string
  url?: string
}

function normalizeHost(host: string) {
  return String(host || '').trim().replace(/\/+$/, '')
}

function getPublicBaseUrl(config: CfBedConfig) {
  return normalizeHost(config.publicDomain || config.host)
}

function buildHeaders(config: CfBedConfig) {
  const headers: Record<string, string> = {}
  if (config.token)
    headers.Authorization = `Bearer ${config.token}`
  return headers
}

function buildBaseQuery(config: CfBedConfig) {
  const params = new URLSearchParams()
  if (config.authCode)
    params.set('authCode', config.authCode)
  if (config.uploadChannel)
    params.set('uploadChannel', config.uploadChannel)
  if (config.channelName)
    params.set('channelName', config.channelName)
  if (config.uploadFolder)
    params.set('uploadFolder', config.uploadFolder)
  if (config.uploadNameType)
    params.set('uploadNameType', config.uploadNameType)
  if (config.returnFormat)
    params.set('returnFormat', config.returnFormat)

  params.set('serverCompress', String(Boolean(config.serverCompress)))
  params.set('autoRetry', String(Boolean(config.autoRetry)))
  return params
}

function buildUploadUrls(config: CfBedConfig, extraQuery?: URLSearchParams) {
  const baseQuery = buildBaseQuery(config)
  extraQuery?.forEach((value, key) => baseQuery.set(key, value))

  const query = baseQuery.toString()
  const suffix = query ? `?${query}` : ''

  return Array.from(new Set([
    `${normalizeHost(config.host)}/upload${suffix}`,
    `${normalizeHost(config.host)}/upload/${suffix}`,
  ]))
}

function createHttpError(message: string, extras: Partial<UploadHttpError> = {}) {
  const error = new Error(message) as UploadHttpError
  Object.assign(error, extras)
  return error
}

function shouldRetryAlternativeUploadPath(error: any) {
  const status = Number(error?.status || 0)
  return status === 404 || status === 405
}

function filenameFromUrl(url: string) {
  try {
    const u = new URL(url, window.location.origin)
    const name = u.pathname.split('/').pop() || 'image'
    return decodeURIComponent(name)
  }
  catch {
    return `image-${Date.now()}.png`
  }
}

export function formatUploadError(error: any) {
  if (!error)
    return translate('upload.error.unknown', '未知错误')
  if (error.name === 'AbortError')
    return translate('upload.error.cancelled', '上传已取消')
  if (typeof error === 'string')
    return error
  return error.message || translate('upload.error.failed', '上传失败')
}

export async function fetchFileFromImage(url: string, signal?: AbortSignal) {
  const resp = await fetch(url, { signal })
  if (!resp.ok) {
    throw new Error(translate('upload.error.readImageStatus', '读取图片失败：{status}', { status: resp.status }))
  }
  const blob = await resp.blob()
  const name = filenameFromUrl(url)
  return new File([blob], name, { type: blob.type || 'image/png' })
}

function findUrlInObject(data: any): string {
  if (!data)
    return ''

  if (typeof data === 'string' && /^https?:\/\//i.test(data))
    return data

  if (typeof data === 'string' && data.startsWith('/'))
    return data

  const candidates = [
    data.url,
    data.src,
    data.path,
    data.file,
    data.data?.url,
    data.data?.src,
    data.data?.path,
    data.data?.file,
    data.result?.url,
    data.result?.src,
    data.result?.path,
    data.result?.file,
  ]

  for (const item of candidates) {
    if (typeof item === 'string' && (/^https?:\/\//i.test(item) || item.startsWith('/')))
      return item
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const nested = findUrlInObject(item)
      if (nested)
        return nested
    }
  }

  if (typeof data === 'object') {
    for (const value of Object.values(data)) {
      const nested = findUrlInObject(value)
      if (nested)
        return nested
    }
  }

  return ''
}

function findStringByKey(data: any, targetKey: string): string {
  if (!data || typeof data !== 'object')
    return ''

  if (typeof data[targetKey] === 'string')
    return data[targetKey]

  const values = Array.isArray(data) ? data : Object.values(data)
  for (const value of values) {
    const nested = findStringByKey(value, targetKey)
    if (nested)
      return nested
  }

  return ''
}

function normalizeImageUrl(config: CfBedConfig, src: string) {
  if (!src)
    return ''
  if (/^https?:\/\//i.test(src))
    return src
  return `${getPublicBaseUrl(config)}${src.startsWith('/') ? '' : '/'}${src}`
}

function resolveUploadedUrl(config: CfBedConfig, data: any) {
  return normalizeImageUrl(config, findUrlInObject(data))
}

function assertChunkStepSucceeded(data: any, step: string) {
  if (data && typeof data === 'object' && 'success' in data && data.success === false) {
    throw new Error(translate('upload.error.stepFailed', '{step}失败', { step }))
  }

  const errorMessage = findStringByKey(data, 'error')
  if (errorMessage) {
    throw new Error(errorMessage)
  }
}

async function postForm(url: string, config: CfBedConfig, form: FormData, options: UploadOptions = {}) {
  return await new Promise<any>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url, true)

    const headers = buildHeaders(config)
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value))

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable)
        return
      const percent = Math.min(99, Math.round((event.loaded / event.total) * 100))
      options.onProgress?.(percent)
    }

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(createHttpError(translate('upload.error.httpStatus', '上传失败：{status}', { status: xhr.status }), {
          status: xhr.status,
          body: xhr.responseText,
          url,
        }))
        return
      }

      try {
        resolve(JSON.parse(xhr.responseText || 'null'))
      }
      catch {
        reject(createHttpError(translate('upload.error.responseParse', '响应解析失败'), {
          status: xhr.status,
          body: xhr.responseText,
          url,
        }))
      }
    }

    xhr.onerror = () => reject(createHttpError(translate('upload.error.network', '网络错误'), { url }))
    xhr.onabort = () => reject(new DOMException(translate('upload.error.cancelled', '上传已取消'), 'AbortError'))

    if (options.signal) {
      if (options.signal.aborted) {
        xhr.abort()
        return
      }

      options.signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    xhr.send(form)
  })
}

async function requestUpload(
  config: CfBedConfig,
  form: FormData,
  options: UploadOptions = {},
  extraQuery?: URLSearchParams,
) {
  const urls = buildUploadUrls(config, extraQuery)
  let lastError: any

  for (const url of urls) {
    try {
      return await postForm(url, config, form, options)
    }
    catch (error: any) {
      lastError = error
      if (!shouldRetryAlternativeUploadPath(error) || url === urls[urls.length - 1]) {
        throw error
      }
    }
  }

  throw lastError
}

async function uploadSingleFile(file: File, config: CfBedConfig, options: UploadOptions) {
  const form = new FormData()
  form.append('file', file)

  const data = await requestUpload(config, form, options)
  const uploadedUrl = resolveUploadedUrl(config, data)
  if (!uploadedUrl) {
    throw new Error(translate('upload.error.noImageUrl', '未从响应中解析到图片地址'))
  }

  return uploadedUrl
}

function appendChunkMetadata(
  form: FormData,
  file: File,
  totalChunks: number,
  uploadId?: string,
) {
  form.append('totalChunks', String(totalChunks))
  form.append('originalFileName', file.name)
  form.append('originalFileType', file.type || 'application/octet-stream')
  if (uploadId)
    form.append('uploadId', uploadId)
}

async function uploadChunkedFile(file: File, config: CfBedConfig, options: UploadOptions) {
  const chunkSize = Math.max(1, Number(config.chunkSizeMB || 20)) * 1024 * 1024
  const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize))

  options.onLog?.('info', translate('upload.log.chunkedStart', '{name} 启用分块上传，共 {count} 块', {
    name: file.name,
    count: totalChunks,
  }))

  const initQuery = new URLSearchParams({ initChunked: 'true' })
  const initForm = new FormData()
  appendChunkMetadata(initForm, file, totalChunks)

  const initData = await requestUpload(config, initForm, { signal: options.signal }, initQuery)
  const uploadId = findStringByKey(initData, 'uploadId')

  if (!uploadId) {
    throw new Error(translate('upload.error.initChunk', '初始化分块上传失败'))
  }

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const chunkStart = chunkIndex * chunkSize
    const chunkEnd = Math.min(file.size, chunkStart + chunkSize)
    const chunk = file.slice(chunkStart, chunkEnd, file.type || 'application/octet-stream')
    const chunkForm = new FormData()

    chunkForm.append('file', chunk, file.name)
    appendChunkMetadata(chunkForm, file, totalChunks, uploadId)
    chunkForm.append('chunkIndex', String(chunkIndex))

    options.onLog?.('info', translate('upload.log.chunkProgress', '{name} 上传分块 {current}/{total}', {
      name: file.name,
      current: chunkIndex + 1,
      total: totalChunks,
    }))

    const chunkData = await requestUpload(config, chunkForm, {
      signal: options.signal,
      onProgress: (chunkPercent) => {
        const overall = Math.min(99, Math.round(((chunkIndex + chunkPercent / 100) / totalChunks) * 100))
        options.onProgress?.(overall)
      },
    }, new URLSearchParams({ chunked: 'true' }))

    assertChunkStepSucceeded(chunkData, translate('upload.chunkStep', '分块 {index}', { index: chunkIndex + 1 }))
  }

  options.onProgress?.(99)

  const mergeForm = new FormData()
  appendChunkMetadata(mergeForm, file, totalChunks, uploadId)

  const mergeData = await requestUpload(
    config,
    mergeForm,
    { signal: options.signal },
    new URLSearchParams({ chunked: 'true', merge: 'true' }),
  )
  const uploadedUrl = resolveUploadedUrl(config, mergeData)

  if (!uploadedUrl) {
    throw new Error(translate('upload.error.mergeNoUrl', '分块合并后未返回图片地址'))
  }

  return uploadedUrl
}

export async function uploadFileToCfBed(file: File, config: CfBedConfig, options: UploadOptions = {}) {
  if (!config.host) {
    throw new Error(translate('upload.error.hostMissing', '图床 host 未配置'))
  }

  options.onLog?.('info', translate('upload.log.start', '开始上传：{name}', { name: file.name }))

  const chunkThreshold = Math.max(1, Number(config.chunkSizeMB || 20)) * 1024 * 1024
  const shouldUseChunked = config.uploadChannel !== 'huggingface' && file.size > chunkThreshold

  const uploadedUrl = shouldUseChunked
    ? await uploadChunkedFile(file, config, options)
    : await uploadSingleFile(file, config, options)

  options.onProgress?.(100)
  options.onLog?.('success', translate('upload.log.success', '上传成功：{url}', { url: uploadedUrl }))
  return uploadedUrl
}

export async function testCfBedConfig(config: CfBedConfig): Promise<ConfigTestResult> {
  if (!config.host) {
    return {
      ok: false,
      message: translate('upload.test.hostMissing', 'host 未填写'),
    }
  }

  try {
    const healthUrl = `${normalizeHost(config.host)}/health`
    const healthResp = await fetch(healthUrl, {
      method: 'GET',
      headers: buildHeaders(config),
    })

    if (healthResp.ok) {
      return {
        ok: true,
        message: translate('upload.test.healthPassed', '健康检查通过'),
        detail: { url: healthUrl, status: healthResp.status },
      }
    }
  }
  catch {
  }

  try {
    const rootUrl = `${normalizeHost(config.host)}/`
    const rootResp = await fetch(rootUrl, {
      method: 'GET',
      headers: buildHeaders(config),
    })

    if (rootResp.ok || rootResp.status === 401 || rootResp.status === 403) {
      return {
        ok: true,
        message: rootResp.status === 401 || rootResp.status === 403
          ? translate('upload.test.siteAccessibleLimited', '站点可访问，但鉴权可能受限')
          : translate('upload.test.siteAccessible', '站点可访问'),
        detail: { url: rootUrl, status: rootResp.status },
      }
    }

    return {
      ok: false,
      message: translate('upload.test.siteResponseError', '站点响应异常：{status}', { status: rootResp.status }),
      detail: { url: rootUrl, status: rootResp.status },
    }
  }
  catch (error: any) {
    return {
      ok: false,
      message: formatUploadError(error),
      detail: error,
    }
  }
}
