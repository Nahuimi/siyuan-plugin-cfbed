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
export type UploadLogType = 'info' | 'success' | 'error'

export type PanelTab = 'images' | 'settings' | 'upload' | 'misc'
export type ThemeMode = 'auto' | 'light' | 'dark'
export type ResolvedThemeMode = 'light' | 'dark'

export interface ImageOccurrence {
  docId: string
  docHPath: string
  docPath: string
  originalUrl: string
}

export interface ImageReferenceItem {
  blockId: string
  rootId: string
  box: string
  path: string
  hpath: string
  markdown: string
  content: string
  originalUrl: string
}

export interface ImageItem {
  id: string
  url: string
  domain: string
  sourceType: ImageSourceType
  docs: ImageOccurrence[]
  references?: ImageReferenceItem[]
  referenceCount?: number
  referencesLoading?: boolean
  selected: boolean
  status?: UploadStatus
  message?: string
  uploadedUrl?: string
  progress?: number
  replacePreviewExcluded?: boolean
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
  uploadNameType: 'default' | 'index' | 'origin' | 'short' | 'custom'
  customFileNameTemplate: string
  returnFormat: 'default' | 'full'
  autoRetry: boolean
  serverCompress: boolean
  chunkSizeMB: number
  publicDomain: string
  enabled: boolean
}

export interface QueueUploadItem {
  id: string
  file: File
  name: string
  size: number
  status: UploadStatus
  progress: number
  message: string
  uploadedUrl: string
}

export interface UploadLogItem {
  id: string
  type: UploadLogType
  time: string
  message: string
}

export interface PluginSettings {
  activeConfigId: string
  autoReplace: boolean
  themeMode: ThemeMode
  ownDomainsText: string
  configs: CfBedConfig[]
}

export interface ActiveConfigSummary extends CfBedConfig {
  channelLabel: string
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
  sourceKey?: string
  targetUrl: string
  sourceType: 'queue' | 'image'
  fileName?: string
  imageId?: string
  status: 'success' | 'error' | 'cancelled'
  time: string
}

export interface ConfigTestResult {
  ok: boolean
  message: string
  detail?: any
}

export interface ReplacePreviewItem {
  docId: string
  docPath: string
  docHPath: string
  imageId: string
  oldUrl: string
  newUrl: string
}

export interface CfBedBridge {
  togglePanel: (force?: boolean) => void
  openPanel: (tab?: PanelTab) => void
  openSetting: () => void
}
