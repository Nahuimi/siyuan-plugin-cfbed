export function formatTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

export function formatDateTime() {
  return new Date().toLocaleString('zh-CN', { hour12: false })
}
