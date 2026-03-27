import { computed, ref } from 'vue'
import { getCurrentDocs, getEditableDocContent, pushErrMsg, queryAssetReferencesBatch, updateDocContent } from '@/api/index'
import { useI18n } from '@/utils/i18n'
import { extractMarkdownImages, detectImageSourceType, getDomainFromUrl, isImageLikeUrl } from '@/utils/image'
import { canImageBeReplaced, replaceAllOccurrences } from '@/utils/replace'
import type { ImageItem, ImageReferenceItem } from '@/types/plugin'

function createFallbackReferences(item: Pick<ImageItem, 'docs' | 'url'>): ImageReferenceItem[] {
  return item.docs.map((doc, index) => ({
    blockId: `fallback:${doc.docId}:${index}`,
    rootId: doc.docId,
    box: '',
    path: doc.docPath,
    hpath: doc.docHPath,
    markdown: doc.originalUrl,
    content: doc.originalUrl,
    originalUrl: doc.originalUrl || item.url,
  }))
}

export function useImageScanner(
  ownDomains: { value: string[] },
  findMappedUrl?: (sourceUrl: string) => string | undefined,
) {
  const { t } = useI18n()
  const currentDocTitle = ref('')
  const images = ref<ImageItem[]>([])
  let refreshVersion = 0

  const filters = ref({
    local: true,
    external: true,
    own: true,
  })

  const filteredImages = computed(() =>
    images.value.filter((item) => {
      if (item.sourceType === 'local')
        return filters.value.local
      if (item.sourceType === 'external')
        return filters.value.external
      if (item.sourceType === 'own')
        return filters.value.own
      return true
    }),
  )

  const selectedCount = computed(() =>
    filteredImages.value.filter(item => item.selected).length,
  )

  const nonOwnCount = computed(() =>
    filteredImages.value.filter(item => item.sourceType !== 'own').length,
  )

  async function refreshImages() {
    const currentVersion = ++refreshVersion
    const previousImageMap = new Map(images.value.map(item => [item.url, item]))

    try {
      const docs = await getCurrentDocs()

      if (currentVersion !== refreshVersion)
        return

      currentDocTitle.value = docs[0]?.hpath || t('scanner.currentDoc', '当前文档')

      const map = new Map<string, ImageItem>()

      for (const doc of docs) {
        const urls = extractMarkdownImages(doc.content)

        for (const url of urls) {
          if (!isImageLikeUrl(url))
            continue

          const existed = map.get(url)
          if (existed) {
            existed.docs.push({
              docId: doc.id,
              docPath: doc.path,
              docHPath: doc.hpath,
              originalUrl: url,
            })
            continue
          }

          const previous = previousImageMap.get(url)
          const mappedUrl = findMappedUrl?.(url) || previous?.uploadedUrl || ''

          map.set(url, {
            id: `img-${Math.random().toString(36).slice(2, 8)}-${Date.now()}`,
            url,
            domain: getDomainFromUrl(url),
            sourceType: detectImageSourceType(url, ownDomains.value),
            docs: [
              {
                docId: doc.id,
                docPath: doc.path,
                docHPath: doc.hpath,
                originalUrl: url,
              },
            ],
            references: previous?.references || [],
            referenceCount: previous?.referenceCount || 0,
            referencesLoading: true,
            selected: previous?.selected ?? false,
            status: mappedUrl ? 'success' : 'idle',
            message: mappedUrl ? (previous?.message || t('scanner.message.existingLink', '已存在上传链接')) : '',
            uploadedUrl: mappedUrl,
            progress: 0,
            replacePreviewExcluded: false,
          })
        }
      }

      const nextImages = Array.from(map.values())

      if (currentVersion !== refreshVersion)
        return

      try {
        const referenceMap = await queryAssetReferencesBatch(nextImages.map(item => item.url))
        for (const item of nextImages) {
          const rows = referenceMap[item.url] || []
          const fallbackReferences = createFallbackReferences(item)
          item.references = rows.length ? rows : fallbackReferences
          item.referenceCount = rows.length || fallbackReferences.length
          item.referencesLoading = false
        }
      }
      catch {
        for (const item of nextImages) {
          const previous = previousImageMap.get(item.url)
          item.references = previous?.references || []
          item.referenceCount = previous?.referenceCount || 0
          item.referencesLoading = false
        }
      }

      if (currentVersion !== refreshVersion)
        return

      images.value = nextImages
    }
    catch (error: any) {
      pushErrMsg(error?.message || t('scanner.error.scanFailed', '扫描图片失败'))
    }
  }

  function toggleSelectVisible(selected: boolean) {
    for (const item of filteredImages.value) {
      item.selected = selected
    }
  }

  function patchImage(id: string, patch: Partial<ImageItem>) {
    images.value = images.value.map(item => item.id === id ? { ...item, ...patch } : item)
  }

  function resolveLatestImages(targetImages?: ImageItem[]) {
    if (!targetImages?.length)
      return images.value

    const latest = targetImages.map(item =>
      images.value.find(current => current.id === item.id)
      || images.value.find(current => current.url === item.url)
      || item,
    )

    return latest.filter((item, index) =>
      latest.findIndex(current => current.id === item.id) === index,
    )
  }

  async function replaceUploadedLinks(targetImages?: ImageItem[]) {
    const replaceGroups = new Map<string, Array<{ oldUrl: string, newUrl: string }>>()
    const sourceImages = resolveLatestImages(targetImages).filter(canImageBeReplaced)

    for (const image of sourceImages) {
      for (const doc of image.docs) {
        if (!replaceGroups.has(doc.docId)) {
          replaceGroups.set(doc.docId, [])
        }
        replaceGroups.get(doc.docId)!.push({
          oldUrl: doc.originalUrl,
          newUrl: image.uploadedUrl,
        })
      }
    }

    if (!replaceGroups.size) {
      pushErrMsg(t('scanner.error.noReplaceableLinks', '没有可替换的已上传链接'))
      return
    }

    for (const [docId, replacements] of replaceGroups.entries()) {
      const currentContent = await getEditableDocContent(docId)
      let nextContent = currentContent
      for (const item of replacements) {
        nextContent = replaceAllOccurrences(nextContent, item.oldUrl, item.newUrl)
      }

      if (nextContent !== currentContent) {
        await updateDocContent(docId, nextContent)
      }
    }
  }

  return {
    currentDocTitle,
    filters,
    filteredImages,
    selectedCount,
    nonOwnCount,
    refreshImages,
    toggleSelectVisible,
    patchImage,
    replaceUploadedLinks,
  }
}
