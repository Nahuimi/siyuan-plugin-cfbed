import { computed, ref } from 'vue'
import { pushErrMsg } from '@/api/index'
import { usePlugin } from '@/main'
import type { PluginSettings } from '@/types/plugin'
import { useI18n } from '@/utils/i18n'
import { cloneSettings, createDefaultConfig, createDefaultSettings, getDomainFromHost, normalizeSettings } from '@/utils/plugin'

type SettingsPlugin = {
  settings?: PluginSettings
  saveSettings?: (settings: PluginSettings) => Promise<void>
}

export function useCfBedSettings() {
  const plugin = usePlugin() as SettingsPlugin
  const { t } = useI18n()
  const settings = ref<PluginSettings>(cloneSettings(normalizeSettings(plugin.settings || createDefaultSettings())))
  let persistTimer: number | undefined
  let pendingSnapshot: PluginSettings | null = null

  const configOptions = computed(() =>
    settings.value.configs.map(item => ({
      value: item.id,
      text: item.name || t('common.untitledConfig', '未命名配置'),
    })),
  )

  const ownDomains = computed(() =>
    Array.from(new Set([
      ...settings.value.ownDomainsText
        .split('\n')
        .map(item => item.trim().toLowerCase())
        .filter(Boolean),
      ...settings.value.configs.flatMap(item => [item.host, item.publicDomain])
        .map(item => getDomainFromHost(item))
        .filter(Boolean),
    ])),
  )

  function persistSettings() {
    settings.value = normalizeSettings(settings.value)

    if (persistTimer)
      window.clearTimeout(persistTimer)

    const snapshot = cloneSettings(settings.value)
    pendingSnapshot = snapshot
    persistTimer = window.setTimeout(async () => {
      try {
        await plugin.saveSettings?.(snapshot)
        pendingSnapshot = null
      }
      catch (error: any) {
        pushErrMsg(error?.message || t('settings.error.saveFailed', '保存配置失败'))
      }
    }, 160)
  }

  async function flushSettings() {
    if (!pendingSnapshot)
      return

    if (persistTimer)
      window.clearTimeout(persistTimer)

    const snapshot = pendingSnapshot
    pendingSnapshot = null
    await plugin.saveSettings?.(snapshot)
  }

  function addConfig() {
    const config = createDefaultConfig()
    config.name = t('settings.defaultConfigName', '配置 {index}', { index: settings.value.configs.length + 1 })
    settings.value.configs.push(config)
    settings.value.activeConfigId = config.id
    persistSettings()
  }

  function removeConfig(id: string) {
    if (settings.value.configs.length <= 1) {
      throw new Error(t('settings.error.keepOneConfig', '至少保留一个配置'))
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
      pushErrMsg(t('settings.error.noEnabledConfig', '没有可用的启用配置'))
      throw new Error(t('settings.error.noEnabledConfig', '没有可用的启用配置'))
    }

    return config
  }

  return {
    settings,
    configOptions,
    ownDomains,
    persistSettings,
    flushSettings,
    addConfig,
    removeConfig,
    activeConfig,
  }
}
