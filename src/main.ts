import { Plugin } from 'siyuan'
import { createApp } from 'vue'
import App from './App.vue'

let plugin = null
export function usePlugin(pluginProps?: Plugin): Plugin {
  if (pluginProps) {
    plugin = pluginProps
  }
  if (!plugin && !pluginProps) {
    console.error('need bind plugin')
  }
  return plugin
}


let app = null
let root: HTMLDivElement | null = null
export function init(plugin: Plugin) {
  usePlugin(plugin)

  root = document.createElement('div')
  root.classList.add('plugin-cfbed-app')
  root.id = `${plugin.name}-root`
  app = createApp(App)
  app.mount(root)
  document.body.appendChild(root)
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
