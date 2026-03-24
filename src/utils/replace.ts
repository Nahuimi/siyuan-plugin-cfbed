import type { ImageItem } from '@/types/plugin'

export function canImageBeReplaced(image: ImageItem) {
  return Boolean(image.uploadedUrl && image.docs?.length)
}

export function replaceAllOccurrences(content: string, oldUrl: string, newUrl: string) {
  if (!oldUrl || !newUrl || oldUrl === newUrl)
    return content

  return content.split(oldUrl).join(newUrl)
}
