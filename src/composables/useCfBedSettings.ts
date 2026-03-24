import { computed, ref } from 'vue'
import { pushErrMsg } from '@/api'
import type { CfBedConfig, PluginSettings } from '@/types/plugin'

const STORAGE_KEY = 'cfbed-plugin-settings'

function createDefaultConfig(): CfBedConfig {
  const id = `cfg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return {
    id,
    name: '默认配置',
    host: '',
    token: '',
    authCode: '',
    uploadChannel: 'telegram',
    channelName: '',
    uploadFolder: '',
    uploadNameType: 'default',
    returnFormat: 'default',
    autoRetry: false,
    serverCompress: false,
    chunkSizeMB: 5,
    publicDomain: '',
    enabled: true,
  }
}

function createDefaultSettings(): PluginSettings {
  const config = createDefaultConfig()
  return {
    activeConfigId: config.id,
    autoReplace: false,
    themeMode: 'auto',
    ownDomainsText: '',
    configs: [config],
  }
}

export function useCfBedSettings() {
  const settings = ref<PluginSettings>(loadSettings())

  const configOptions = computed(() =>
    settings.value.configs.map(item => ({
      value: item.id,
      text: item.name || '未命名配置',
    })),
  )

  const ownDomains = computed(() =>
    settings.value.ownDomainsText
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean),
  )

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw)
        return createDefaultSettings()

      const parsed = JSON.parse(raw) as PluginSettings
      if (!parsed.configs?.length)
        return createDefaultSettings()
      if (!parsed.activeConfigId)
        parsed.activeConfigId = parsed.configs[0].id
      if (!parsed.themeMode)
        parsed.themeMode = 'auto'
      return parsed
    }
    catch {
      return createDefaultSettings()
    }
  }

  function persistSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
  }

  function addConfig() {
    const config = createDefaultConfig()
    config.name = `配置 ${settings.value.configs.length + 1}`
    settings.value.configs.push(config)
    settings.value.activeConfigId = config.id
    persistSettings()
  }

  function removeConfig(id: string) {
    if (settings.value.configs.length <= 1) {
      throw new Error('至少保留一个配置')
    }

    settings.value.configs = settings.value.configs.filter(item => item.id !== id)

    if (settings.value.activeConfigId === id) {
      settings.value.activeConfigId = settings.value.configs[0]?.id || ''
    }

    persistSettings()
  }

  function activeConfig() {
    const config = settings.value.configs.find(item => item.id === settings.value.activeConfigId && item.enabled)
      || settings.value.configs.find(item => item.enabled)

    if (!config) {
      pushErrMsg('没有可用的启用配置')
      throw new Error('没有可用的启用配置')
    }

    return config
  }

  return {
    settings,
    configOptions,
    ownDomains,
    persistSettings,
    addConfig,
    removeConfig,
    activeConfig,
  }
}
