import { Plugin } from 'siyuan'
import { createApp, type App as VueApp } from 'vue'
import App from './App.vue'

let plugin: Plugin | null = null
export function usePlugin(pluginProps?: Plugin): Plugin {
  if (pluginProps)
    plugin = pluginProps
  if (!plugin)
    throw new Error('need bind plugin')
  return plugin
}


let app: VueApp<Element> | null = null
let root: HTMLDivElement | null = null
export function init(pluginInstance: Plugin) {
  usePlugin(pluginInstance)

  if (root)
    destroy()

  root = document.createElement('div')
  root.classList.add('plugin-cfbed-app')
  root.id = `${pluginInstance.name}-root`
  document.body.appendChild(root)

  app = createApp(App)
  app.mount(root)
}

export function destroy() {
  if (app) {
    app.unmount()
    app = null
  }
  if (root?.parentNode) {
    root.parentNode.removeChild(root)
  }
  root = null
}
