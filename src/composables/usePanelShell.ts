import { computed, type Ref } from 'vue'
import type { ActiveConfigSummary, PanelTab, PluginSettings, ResolvedThemeMode } from '@/types/plugin'
import { useI18n } from '@/utils/i18n'

type UsePanelShellOptions = {
  settings: Ref<PluginSettings>
  activeTab: Ref<PanelTab>
  replacePreviewActive: Ref<boolean>
  systemPrefersDark: Ref<boolean>
}

export function uploadChannelLabel(channel: string) {
  if (channel === 'telegram')
    return 'Telegram'
  if (channel === 'cfr2')
    return 'Cloudflare R2'
  if (channel === 's3')
    return 'S3'
  if (channel === 'discord')
    return 'Discord'
  if (channel === 'huggingface')
    return 'Hugging Face'
  return channel
}

export function usePanelShell(options: UsePanelShellOptions) {
  const { t } = useI18n()

  const resolvedThemeMode = computed<ResolvedThemeMode>(() => options.settings.value.themeMode === 'auto'
    ? (options.systemPrefersDark.value ? 'dark' : 'light')
    : options.settings.value.themeMode)

  const themeModeIcon = computed(() => {
    if (options.settings.value.themeMode === 'auto')
      return '◐'
    return resolvedThemeMode.value === 'dark' ? '☾' : '☀'
  })

  const themeModeLabel = computed(() => {
    if (options.settings.value.themeMode === 'auto')
      return t('theme.auto', '跟随系统')
    return resolvedThemeMode.value === 'dark'
      ? t('theme.dark', '暗色模式')
      : t('theme.light', '亮色模式')
  })

  const themeButtonTitle = computed(() => t('theme.switchTitle', '主题：{mode}（点击切换）', { mode: themeModeLabel.value }))

  const activeConfigSummary = computed<ActiveConfigSummary | null>(() => {
    const current = options.settings.value.configs.find(item => item.id === options.settings.value.activeConfigId)
      || options.settings.value.configs[0]
      || null

    if (!current)
      return null

    return {
      ...current,
      channelLabel: uploadChannelLabel(current.uploadChannel),
    }
  })

  const activeTabHint = computed(() => {
    if (options.activeTab.value === 'settings')
      return t('panel.hint.settings', '集中维护 CloudFlare-ImgBed 配置、公开域名和上传参数。')
    if (options.activeTab.value === 'upload')
      return t('panel.hint.upload', '适合拖拽本地文件到队列中，和文档内图片扫描流程相互独立。')
    if (options.activeTab.value === 'misc')
      return t('panel.hint.misc', '保留上传映射，方便排查和复用历史结果。')
    return options.replacePreviewActive.value
      ? t('panel.hint.replacePreview', '当前处于替换预览模式，只展示待写回文档的图片。')
      : t('panel.hint.images', '按来源筛选当前文档图片，选择后批量上传或手动替换。')
  })

  return {
    resolvedThemeMode,
    themeModeIcon,
    themeModeLabel,
    themeButtonTitle,
    activeConfigSummary,
    activeTabHint,
  }
}
