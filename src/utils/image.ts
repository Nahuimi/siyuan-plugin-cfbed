import type { ImageSourceType } from '@/types/plugin'

export function getDomainFromUrl(url: string) {
  try {
    return new URL(url).hostname.toLowerCase()
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

  if (/\.(png|jpe?g|gif|webp|bmp|svg|avif)(?:\?.*)?$/i.test(url))
    return true

  return isHttpUrl(url)
}

export function detectImageSourceType(url: string, ownDomains: string[]): ImageSourceType {
  if (isLocalAsset(url) || !isHttpUrl(url))
    return 'local'

  const host = getDomainFromUrl(url)
  const normalizedDomains = ownDomains.map(item => String(item || '').trim().toLowerCase()).filter(Boolean)
  if (normalizedDomains.some(domain => host === domain || host.endsWith(`.${domain}`)))
    return 'own'

  return 'external'
}

export function extractMarkdownImages(content: string) {
  const result: string[] = []
  const htmlImageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  result.push(...extractBalancedMarkdownImages(content))

  for (const match of content.matchAll(htmlImageRegex)) {
    if (match[1])
      result.push(match[1])
  }

  return result.filter(Boolean)
}

function extractBalancedMarkdownImages(content: string) {
  const urls: string[] = []

  for (let index = 0; index < content.length; index++) {
    if (content[index] !== '!' || content[index + 1] !== '[')
      continue

    const altEnd = findClosingBracket(content, index + 1, '[', ']')
    if (altEnd < 0 || content[altEnd + 1] !== '(')
      continue

    const target = readMarkdownLinkTarget(content, altEnd + 1)
    if (!target) {
      index = altEnd
      continue
    }

    if (target.url)
      urls.push(target.url)
    index = target.end
  }

  return urls
}

function findClosingBracket(content: string, start: number, openChar: string, closeChar: string) {
  let depth = 0
  let escaped = false

  for (let index = start; index < content.length; index++) {
    const char = content[index]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === openChar) {
      depth++
    }
    else if (char === closeChar) {
      depth--
      if (depth === 0)
        return index
    }
  }

  return -1
}

function readMarkdownLinkTarget(content: string, start: number) {
  let depth = 0
  let escaped = false

  for (let index = start; index < content.length; index++) {
    const char = content[index]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '(') {
      depth++
      continue
    }

    if (char === ')') {
      depth--
      if (depth === 0) {
        return {
          url: parseMarkdownLinkUrl(content.slice(start + 1, index)),
          end: index,
        }
      }
    }
  }

  return null
}

function parseMarkdownLinkUrl(rawTarget: string) {
  const target = rawTarget.trim()
  if (!target)
    return ''

  if (target.startsWith('<')) {
    const closingIndex = target.lastIndexOf('>')
    if (closingIndex > 0)
      return target.slice(1, closingIndex).trim()
  }

  let url = ''
  let depth = 0
  let escaped = false

  for (let index = 0; index < target.length; index++) {
    const char = target[index]

    if (escaped) {
      url += char
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (/\s/.test(char) && depth === 0)
      break

    if (char === '(')
      depth++
    else if (char === ')' && depth > 0)
      depth--

    url += char
  }

  return url.trim()
}
