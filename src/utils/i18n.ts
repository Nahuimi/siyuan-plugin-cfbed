import { usePlugin } from '@/main'
import type { ImageSourceType, UploadLogFilter, UploadStatus } from '@/types/plugin'

type TranslateParams = Record<string, string | number | boolean | null | undefined>
type I18nMap = Record<string, string>

type PluginWithI18n = {
  i18n?: I18nMap
}

function interpolate(template: string, params?: TranslateParams) {
  if (!params)
    return template

  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ''))
}

function getLocaleMap(): I18nMap {
  try {
    return ((usePlugin() as PluginWithI18n).i18n || {}) as I18nMap
  }
  catch {
    return {}
  }
}

export function translate(key: string, fallback?: string, params?: TranslateParams) {
  const localeMap = getLocaleMap()
  const template = localeMap[key] || fallback || key
  return interpolate(template, params)
}

export function useI18n() {
  const t = (key: string, fallback?: string, params?: TranslateParams) =>
    translate(key, fallback, params)

  const sourceTypeLabel = (type: ImageSourceType) => {
    if (type === 'local')
      return t('source.local', '本地')
    if (type === 'own')
      return t('source.own', '自己图床')
    return t('source.external', '外链')
  }

  const uploadStatusLabel = (status: UploadStatus) => {
    if (status === 'queued')
      return t('status.queued', '排队中')
    if (status === 'preparing')
      return t('status.preparing', '准备中')
    if (status === 'uploading')
      return t('status.uploading', '上传中')
    if (status === 'success')
      return t('status.success', '成功')
    if (status === 'error')
      return t('status.error', '失败')
    if (status === 'cancelled')
      return t('status.cancelled', '已取消')
    return t('status.idle', '未开始')
  }

  const mappingSourceTypeLabel = (type: 'queue' | 'image') => {
    if (type === 'queue')
      return t('mapping.source.queue', '队列文件')
    return t('mapping.source.image', '文档图片')
  }

  const uploadLogTypeLabel = (type: UploadLogFilter | 'success' | 'error' | 'info') => {
    if (type === 'info')
      return t('log.info', '信息')
    if (type === 'success')
      return t('log.success', '成功')
    if (type === 'error')
      return t('log.error', '失败')
    return t('log.all', '全部')
  }

  return {
    t,
    sourceTypeLabel,
    uploadStatusLabel,
    mappingSourceTypeLabel,
    uploadLogTypeLabel,
  }
}
