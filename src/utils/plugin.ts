import type { CfBedBridge, CfBedConfig, PluginSettings } from '@/types/plugin'

export const CFBED_BRIDGE_KEY = '_sy_plugin_cfbed'
export const CFBED_SETTINGS_STORAGE = 'settings.json'
export const CFBED_MAPPINGS_STORAGE = 'upload-mappings.json'
export const CFBED_MAPPINGS_LEGACY_STORAGE = 'cfbed-upload-mappings'

function createConfigId() {
  return `cfg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createDefaultConfig(): CfBedConfig {
  return {
    id: createConfigId(),
    name: '默认图床',
    host: '',
    token: '',
    authCode: '',
    uploadChannel: 'telegram',
    channelName: '',
    uploadFolder: '',
    uploadNameType: 'default',
    returnFormat: 'default',
    autoRetry: true,
    serverCompress: true,
    chunkSizeMB: 20,
    publicDomain: '',
    enabled: true,
  }
}

export function createDefaultSettings(): PluginSettings {
  const config = createDefaultConfig()
  return {
    activeConfigId: config.id,
    autoReplace: false,
    themeMode: 'auto',
    ownDomainsText: '',
    configs: [config],
  }
}

export function normalizeConfig(config?: Partial<CfBedConfig> | null): CfBedConfig {
  return {
    ...createDefaultConfig(),
    ...config,
    id: config?.id || createConfigId(),
    chunkSizeMB: Math.max(1, Number(config?.chunkSizeMB || 20)),
  }
}

export function normalizeSettings(settings?: Partial<PluginSettings> | null): PluginSettings {
  const defaults = createDefaultSettings()
  const configs = Array.isArray(settings?.configs) && settings.configs.length
    ? settings.configs.map(item => normalizeConfig(item))
    : defaults.configs

  const themeMode = settings?.themeMode === 'light' || settings?.themeMode === 'dark' || settings?.themeMode === 'auto'
    ? settings.themeMode
    : defaults.themeMode

  const activeConfigId = settings?.activeConfigId && configs.some(item => item.id === settings.activeConfigId)
    ? settings.activeConfigId
    : configs[0].id

  return {
    activeConfigId,
    autoReplace: Boolean(settings?.autoReplace),
    themeMode,
    ownDomainsText: String(settings?.ownDomainsText || ''),
    configs,
  }
}

export function cloneSettings(settings: PluginSettings): PluginSettings {
  return JSON.parse(JSON.stringify(settings)) as PluginSettings
}

export function getDomainFromHost(value: string) {
  const normalized = String(value || '').trim()
  if (!normalized)
    return ''

  try {
    const url = new URL(/^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`)
    return url.hostname.toLowerCase()
  }
  catch {
    return normalized
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .replace(/:\d+$/, '')
      .toLowerCase()
  }
}

export function getCfBedBridge(): CfBedBridge | undefined {
  return (window as any)[CFBED_BRIDGE_KEY] as CfBedBridge | undefined
}

export function setCfBedBridge(bridge?: CfBedBridge) {
  const win = window as any
  if (bridge) {
    win[CFBED_BRIDGE_KEY] = bridge
    return
  }

  delete win[CFBED_BRIDGE_KEY]
}
