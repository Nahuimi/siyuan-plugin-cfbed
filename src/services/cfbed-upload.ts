import type { CfBedConfig, ConfigTestResult } from '@/types/plugin'

type UploadLogType = 'info' | 'success' | 'error'

type UploadOptions = {
  signal?: AbortSignal
  onProgress?: (percent: number) => void
  onLog?: (type: UploadLogType, message: string) => void
}

function normalizeHost(host: string) {
  return (host || '').replace(/\/+$/, '')
}

function buildHeaders(config: CfBedConfig) {
  const headers: Record<string, string> = {}
  if (config.token)
    headers.Authorization = `Bearer ${config.token}`
  if (config.authCode)
    headers['x-auth-code'] = config.authCode
  return headers
}

function buildBaseQuery(config: CfBedConfig) {
  const params = new URLSearchParams()
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
  if (config.serverCompress)
    params.set('serverCompress', 'true')
  return params
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
    return '未知错误'
  if (error.name === 'AbortError')
    return '上传已取消'
  if (typeof error === 'string')
    return error
  return error.message || '上传失败'
}

export async function fetchFileFromImage(url: string, signal?: AbortSignal) {
  const resp = await fetch(url, { signal })
  if (!resp.ok) {
    throw new Error(`读取图片失败：${resp.status}`)
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

function normalizeImageUrl(host: string, src: string) {
  if (!src)
    return ''
  if (/^https?:\/\//i.test(src))
    return src
  return `${normalizeHost(host)}${src.startsWith('/') ? '' : '/'}${src}`
}

async function uploadByXHR(file: File, config: CfBedConfig, options: UploadOptions) {
  const query = buildBaseQuery(config)
  const url = `${normalizeHost(config.host)}/upload?${query.toString()}`
  const form = new FormData()
  form.append('file', file)

  return await new Promise<string>((resolve, reject) => {
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
        reject(new Error(`上传失败：${xhr.status}`))
        return
      }

      try {
        const data = JSON.parse(xhr.responseText)
        const rawUrl = findUrlInObject(data)
        const uploadedUrl = normalizeImageUrl(config.host, rawUrl)
        if (!uploadedUrl)
          reject(new Error('未从响应中解析到图片地址'))
        else
          resolve(uploadedUrl)
      }
      catch {
        reject(new Error('响应解析失败'))
      }
    }

    xhr.onerror = () => reject(new Error('网络错误'))
    xhr.onabort = () => reject(new DOMException('aborted', 'AbortError'))

    if (options.signal) {
      options.signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    xhr.send(form)
  })
}

export async function uploadFileToCfBed(file: File, config: CfBedConfig, options: UploadOptions = {}) {
  if (!config.host) {
    throw new Error('图床 host 未配置')
  }

  options.onLog?.('info', `开始上传：${file.name}`)
  const uploadedUrl = await uploadByXHR(file, config, options)
  options.onProgress?.(100)
  options.onLog?.('success', `上传成功：${uploadedUrl}`)
  return uploadedUrl
}

export async function testCfBedConfig(config: CfBedConfig): Promise<ConfigTestResult> {
  if (!config.host) {
    return {
      ok: false,
      message: 'host 未填写',
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
        message: '健康检查通过',
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
          ? '站点可访问，但鉴权可能受限'
          : '站点可访问',
        detail: { url: rootUrl, status: rootResp.status },
      }
    }

    return {
      ok: false,
      message: `站点响应异常：${rootResp.status}`,
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
