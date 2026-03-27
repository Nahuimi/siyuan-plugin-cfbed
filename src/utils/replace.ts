import type { ImageItem } from '@/types/plugin'

export function canImageBeReplaced(image: ImageItem) {
  return Boolean(image.uploadedUrl && image.docs?.length)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function replaceAllOccurrences(content: string, oldUrl: string, newUrl: string) {
  if (!oldUrl || !newUrl || oldUrl === newUrl)
    return content

  const escapedOldUrl = escapeRegExp(oldUrl)
  const markdownPattern = new RegExp(`(!\\[[^\\]]*]\\()${escapedOldUrl}((?:\\s+"[^"]*")?\\))`, 'g')
  const htmlPattern = new RegExp(`(<img[^>]+src=["'])${escapedOldUrl}(["'][^>]*>)`, 'gi')

  return content
    .replace(markdownPattern, `$1${newUrl}$2`)
    .replace(htmlPattern, `$1${newUrl}$2`)
}
