import {
  Plugin,
  Setting,
  getFrontend,
  showMessage,
} from 'siyuan'
import '@/index.scss'
import PluginInfoString from '@/../plugin.json'
import { destroy, init } from '@/main'
import type { CfBedConfig, PluginSettings } from '@/types/plugin'

const STORAGE_NAME = 'settings.json'

function createDefaultConfig(): CfBedConfig {
  return {
    id: `cfg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

function getDefaultSettings(): PluginSettings {
  const defaultConfig = createDefaultConfig()
  return {
    activeConfigId: defaultConfig.id,
    autoReplace: false,
    ownDomainsText: '',
    configs: [defaultConfig],
  }
}

let PluginInfo = {
  version: '',
}
try {
  PluginInfo = PluginInfoString
} catch (err) {
  console.log('Plugin info parse error: ', err)
}
const {
  version,
} = PluginInfo

export default class PluginSample extends Plugin {
  // Run as mobile
  public isMobile: boolean
  // Run in browser
  public isBrowser: boolean
  // Run as local
  public isLocal: boolean
  // Run in Electron
  public isElectron: boolean
  // Run in window
  public isInWindow: boolean
  public platform: SyFrontendTypes
  public readonly version = version
  public settings: PluginSettings = getDefaultSettings()

  async onload() {
    const frontEnd = getFrontend()
    this.platform = frontEnd as SyFrontendTypes
    this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile"
    this.isBrowser = frontEnd.includes('browser')
    this.isLocal =
      location.href.includes('127.0.0.1')
      || location.href.includes('localhost')
    this.isInWindow = location.href.includes('window.html')

    try {
      require("@electron/remote")
        .require("@electron/remote/main")
      this.isElectron = true
    } catch (err) {
      this.isElectron = false
    }

    this.settings = await this.loadSettings()
    this.initSetting()

    this.addTopBar({
      icon: 'iconImage',
      title: this.i18n.addTopBarIcon || 'CloudFlare ImgBed',
      callback: () => {
        window._sy_plugin_sample?.togglePanel?.()
      },
    })

    init(this)
  }

  onunload() {
    destroy()
  }

  openSetting() {
    window._sy_plugin_sample?.openSetting?.()
  }

  async loadSettings(): Promise<PluginSettings> {
    const stored = await this.loadData(STORAGE_NAME)
    const defaults = getDefaultSettings()
    const configs = Array.isArray(stored?.configs) && stored.configs.length
      ? stored.configs.map((item: Partial<CfBedConfig>) => ({
          ...createDefaultConfig(),
          ...item,
        }))
      : defaults.configs

    const activeConfigId = stored?.activeConfigId && configs.some(item => item.id === stored.activeConfigId)
      ? stored.activeConfigId
      : configs[0].id

    return {
      ...defaults,
      ...stored,
      activeConfigId,
      configs,
    }
  }

  async saveSettings(settings: PluginSettings) {
    this.settings = settings
    await this.saveData(STORAGE_NAME, settings)
  }

  private initSetting() {
    this.setting = new Setting({
      width: '720px',
    })

    const panelButton = document.createElement('button')
    panelButton.className = 'b3-button b3-button--outline'
    panelButton.textContent = '打开图床管理面板'
    panelButton.onclick = () => window._sy_plugin_sample?.togglePanel?.(true)

    this.setting.addItem({
      title: '图床面板',
      description: '查看当前笔记与子笔记中的图片，并进行筛选、上传与替换。',
      actionElement: panelButton,
    })

    const settingButton = document.createElement('button')
    settingButton.className = 'b3-button b3-button--outline'
    settingButton.textContent = '打开配置面板'
    settingButton.onclick = () => {
      window._sy_plugin_sample?.openSetting?.()
      showMessage('已打开 CloudFlare ImgBed 配置面板')
    }

    this.setting.addItem({
      title: 'CloudFlare-ImgBed 配置',
      description: '支持多个配置、自定义自己图床域名、上传后自动替换链接。',
      actionElement: settingButton,
    })
  }
}
