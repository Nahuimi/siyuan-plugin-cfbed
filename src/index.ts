import {
  Plugin,
  Setting,
  getFrontend,
  showMessage,
} from 'siyuan'
import '@/index.scss'
import PluginInfoString from '@/../plugin.json'
import { destroy, init } from '@/main'
import type { PanelTab, PluginSettings } from '@/types/plugin'
import { CFBED_SETTINGS_STORAGE, createDefaultSettings, getCfBedBridge, normalizeSettings } from '@/utils/plugin'

let PluginInfo = {
  version: '',
}
try {
  PluginInfo = PluginInfoString
}
catch {
  console.log('Plugin info parse error')
}
const {
  version,
} = PluginInfo

export default class CfBedPlugin extends Plugin {
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
  public settings: PluginSettings = createDefaultSettings()

  private text(key: string, fallback: string) {
    return this.i18n?.[key] || fallback
  }

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
    }
    catch {
      this.isElectron = false
    }

    this.settings = await this.loadSettings()
    this.initSetting()
    this.initCommands()

    this.addTopBar({
      icon: 'iconImage',
      title: this.i18n.addTopBarIcon || 'CloudFlare ImgBed',
      callback: () => {
        getCfBedBridge()?.togglePanel?.()
      },
    })

    init(this)
  }

  onunload() {
    destroy()
  }

  openSetting() {
    getCfBedBridge()?.openSetting?.()
  }

  async loadSettings(): Promise<PluginSettings> {
    return normalizeSettings(await this.loadData(CFBED_SETTINGS_STORAGE))
  }

  async saveSettings(settings: PluginSettings) {
    const next = normalizeSettings(settings)
    this.settings = next
    await this.saveData(CFBED_SETTINGS_STORAGE, next)
  }

  private initCommands() {
    const openTabCommand = (tab: PanelTab, langKey: string, langText: string) => {
      this.addCommand({
        langKey,
        langText,
        hotkey: '',
        callback: () => {
          getCfBedBridge()?.openPanel?.(tab)
        },
      })
    }

    openTabCommand('images', 'openCfBedImages', this.text('command.openImages', '打开 CloudFlare ImgBed 图片面板'))
    openTabCommand('settings', 'openCfBedSettings', this.text('command.openSettings', '打开 CloudFlare ImgBed 配置'))
    openTabCommand('upload', 'openCfBedUploadQueue', this.text('command.openUpload', '打开 CloudFlare ImgBed 上传队列'))
    openTabCommand('misc', 'openCfBedMappings', this.text('command.openMappings', '打开 CloudFlare ImgBed 迁移记录'))

    this.addCommand({
      langKey: 'refreshCfBedCurrentDoc',
      langText: this.text('command.refreshCurrentDoc', '刷新并打开 CloudFlare ImgBed 当前文档图片'),
      hotkey: '',
      callback: () => {
        getCfBedBridge()?.openPanel?.('images')
      },
    })
  }

  private initSetting() {
    this.setting = new Setting({
      width: '720px',
    })

    const panelButton = document.createElement('button')
    panelButton.className = 'b3-button b3-button--outline'
    panelButton.textContent = this.text('settings.panel.open', '打开图床管理面板')
    panelButton.onclick = () => getCfBedBridge()?.togglePanel?.(true)

    this.setting.addItem({
      title: this.text('settings.panel.title', '图床面板'),
      description: this.text('settings.panel.description', '查看当前笔记中的图片，并进行筛选、上传与替换。'),
      actionElement: panelButton,
    })

    const settingButton = document.createElement('button')
    settingButton.className = 'b3-button b3-button--outline'
    settingButton.textContent = this.text('settings.config.open', '打开配置面板')
    settingButton.onclick = () => {
      getCfBedBridge()?.openSetting?.()
      showMessage(this.text('settings.config.opened', '已打开 CloudFlare ImgBed 配置面板'))
    }

    this.setting.addItem({
      title: this.text('settings.config.title', 'CloudFlare-ImgBed 配置'),
      description: this.text('settings.config.description', '支持多个配置、自定义自己图床域名、上传后自动替换链接。'),
      actionElement: settingButton,
    })

    const uploadButton = document.createElement('button')
    uploadButton.className = 'b3-button b3-button--outline'
    uploadButton.textContent = this.text('settings.upload.open', '打开上传队列')
    uploadButton.onclick = () => getCfBedBridge()?.openPanel?.('upload')

    this.setting.addItem({
      title: this.text('settings.upload.title', '本地图片上传'),
      description: this.text('settings.upload.description', '直接打开上传队列页，拖拽本地图片到当前图床配置。'),
      actionElement: uploadButton,
    })

    const mappingsButton = document.createElement('button')
    mappingsButton.className = 'b3-button b3-button--outline'
    mappingsButton.textContent = this.text('settings.mappings.open', '打开迁移记录')
    mappingsButton.onclick = () => getCfBedBridge()?.openPanel?.('misc')

    this.setting.addItem({
      title: this.text('settings.mappings.title', '迁移记录'),
      description: this.text('settings.mappings.description', '查看历史上传映射、导出 JSON/CSV，并排查替换结果。'),
      actionElement: mappingsButton,
    })
  }
}
