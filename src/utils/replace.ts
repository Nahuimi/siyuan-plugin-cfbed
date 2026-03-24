import type { ImageItem, ReplacePreviewItem } from '@/types/plugin'

export function buildReplacePreviewItems(images: ImageItem[]): ReplacePreviewItem[] {
  const items: ReplacePreviewItem[] = []

  for (const image of images) {
    if (!image.uploadedUrl || !image.docs?.length)
      continue

    for (const doc of image.docs) {
      items.push({
        imageId: image.id,
        oldUrl: doc.originalUrl || image.url,
        newUrl: image.uploadedUrl,
        docId: doc.docId,
        docPath: doc.docPath,
        docHPath: doc.docHPath,
      })
    }
  }

  return items
}

export function replaceAllOccurrences(content: string, oldUrl: string, newUrl: string) {
  if (!oldUrl || !newUrl || oldUrl === newUrl)
    return content

  return content.split(oldUrl).join(newUrl)
}
