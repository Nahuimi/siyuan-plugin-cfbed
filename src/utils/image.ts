import type { ImageSourceType } from '@/types/plugin'

export function getDomainFromUrl(url: string) {
  try {
    return new URL(url).hostname
  }
  catch {
    return ''
  }
}

export function isLocalAsset(url: string) {
  return url.startsWith('assets/')
    || url.startsWith('/assets/')
    || url.startsWith('file://')
    || url.startsWith('./')
    || url.startsWith('../')
  // 思源环境下本地图片有时不是标准 http 链接
}

export function isHttpUrl(url: string) {
  return /^https?:\/\//i.test(url)
}

export function isImageLikeUrl(url: string) {
  if (!url)
    return false

  if (isLocalAsset(url))
    return true

  if (/\.(png|jpe?g|gif|webp|bmp|svg|avif)(\?.*)?$/i.test(url))
    return true

  return isHttpUrl(url)
}

export function detectImageSourceType(url: string, ownDomains: string[]): ImageSourceType {
  if (isLocalAsset(url) || !isHttpUrl(url))
    return 'local'

  const host = getDomainFromUrl(url)
  if (ownDomains.includes(host))
    return 'own'

  return 'external'
}

export function extractMarkdownImages(content: string) {
  const result: string[] = []

  const mdImageRegex = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
  const htmlImageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi

  let match: RegExpExecArray | null

  while ((match = mdImageRegex.exec(content))) {
    if (match[1])
      result.push(match[1])
  }

  while ((match = htmlImageRegex.exec(content))) {
    if (match[1])
      result.push(match[1])
  }

  return result.filter(Boolean)
}
