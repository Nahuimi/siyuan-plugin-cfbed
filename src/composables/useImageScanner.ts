import { computed, ref } from 'vue'
import { pushErrMsg, updateDocContent } from '@/api'
import { getCurrentDocs, queryAssetReferences, queryAssetReferencesBatch } from '@/api/index'
import { extractMarkdownImages, detectImageSourceType, getDomainFromUrl, isImageLikeUrl } from '@/utils/image'
import { replaceAllOccurrences } from '@/utils/replace'
import { canImageBeReplaced } from '@/utils/replace'
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

      currentDocTitle.value = docs[0]?.hpath || '当前文档'

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
            selected: false,
            status: findMappedUrl?.(url) ? 'success' : 'idle',
            message: '',
            uploadedUrl: findMappedUrl?.(url) || '',
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
      pushErrMsg(error?.message || '扫描图片失败')
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

  async function replaceUploadedLinks(targetImages?: ImageItem[]) {
    const replaceGroups = new Map<string, Array<{ oldUrl: string, newUrl: string }>>()
    const sourceImages = (targetImages?.length ? targetImages : images.value).filter(canImageBeReplaced)

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
      pushErrMsg('没有可替换的已上传链接')
      return
    }

    const docs = await getCurrentDocs()
    const docMap = new Map(docs.map(doc => [doc.id, doc]))

    for (const [docId, replacements] of replaceGroups.entries()) {
      const doc = docMap.get(docId)
      if (!doc)
        continue

      let nextContent = doc.content
      for (const item of replacements) {
        nextContent = replaceAllOccurrences(nextContent, item.oldUrl, item.newUrl)
      }

      if (nextContent !== doc.content) {
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
