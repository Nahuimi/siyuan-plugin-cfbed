export type ImageSourceType = 'local' | 'external' | 'own'

export type UploadStatus =
  | 'idle'
  | 'queued'
  | 'preparing'
  | 'uploading'
  | 'success'
  | 'error'
  | 'cancelled'

export type BatchUploadScope = 'all' | 'local' | 'external'

export type UploadLogFilter = 'all' | 'info' | 'success' | 'error'

export interface ImageOccurrence {
  docId: string
  docHPath: string
  docPath: string
  originalUrl: string
}

export interface ImageItem {
  id: string
  url: string
  domain: string
  sourceType: ImageSourceType
  docs: ImageOccurrence[]
  selected: boolean
  status?: UploadStatus
  message?: string
  uploadedUrl?: string
  progress?: number
}

export interface DocInfo {
  id: string
  path: string
  hpath: string
  content: string
}

export interface CfBedConfig {
  id: string
  name: string
  host: string
  token: string
  authCode: string
  uploadChannel: 'telegram' | 'cfr2' | 's3' | 'discord' | 'huggingface'
  channelName: string
  uploadFolder: string
  uploadNameType: 'default' | 'index' | 'origin' | 'short'
  returnFormat: 'default' | 'full'
  autoRetry: boolean
  serverCompress: boolean
  chunkSizeMB: number
  publicDomain: string
  enabled: boolean
}

export interface PluginSettings {
  activeConfigId: string
  autoReplace: boolean
  ownDomainsText: string
  configs: CfBedConfig[]
}

export interface UploadTaskSummary {
  total: number
  running: number
  success: number
  error: number
  cancelled: number
  progress: number
}

export interface UploadMappingItem {
  id: string
  sourceUrl: string
  targetUrl: string
  sourceType: 'queue' | 'image'
  fileName?: string
  imageId?: string
  status: 'success' | 'error' | 'cancelled'
  time: string
}

export interface ReplacePreviewItem {
  imageId: string
  oldUrl: string
  newUrl: string
  docId: string
  docPath: string
  docHPath: string
}

export interface ConfigTestResult {
  ok: boolean
  message: string
  detail?: any
}
