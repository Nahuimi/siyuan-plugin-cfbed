import { showMessage } from 'siyuan'
import type { DocInfo, ImageReferenceItem } from '@/types/plugin'

type SiyuanApiResponse<T = any> = {
  code: number
  msg: string
  data: T
}

type NotebookInfo = {
  id: string
  name: string
  icon: string
  sort: number
  closed: boolean
}

type ExportMdContentResponse = {
  hPath: string
  content: string
}

type BlockRow = {
  id: string
  box?: string
  path?: string
  hpath?: string
  root_id?: string
  type?: string
  markdown?: string
  content?: string
}

type NotificationPushResponse = {
  id: string
}

function normalizeApiPath(path: string) {
  return path.startsWith('/') ? path : `/${path}`
}

function getCurrentDocIdFromDom(): string {
  const selectors = [
    '.layout__wnd--active .protyle:not(.fn__none) .protyle-background',
    '.layout__wnd--active .protyle:not(.fn__none) [data-node-id]',
    '.protyle:not(.fn__none) .protyle-background',
    '.protyle:not(.fn__none) [data-node-id]',
  ]

  for (const selector of selectors) {
    const el = document.querySelector(selector)
    const id = el?.getAttribute('data-node-id') || ''
    if (id)
      return id
  }

  return ''
}

function getRootIdFromLayoutItem(item: any): string {
  if (!item)
    return ''

  const modelRootID = item?.model?.editor?.protyle?.block?.rootID
  if (modelRootID)
    return modelRootID

  const itemRootID = item?.editor?.protyle?.block?.rootID
  if (itemRootID)
    return itemRootID

  const headElement = item?.headElement as HTMLElement | undefined
  if (headElement?.classList?.contains('item--focus') || headElement?.classList?.contains('item--active')) {
    return modelRootID || itemRootID || ''
  }

  const children = item?.children || []
  for (const child of children) {
    const childRootID = getRootIdFromLayoutItem(child)
    if (childRootID)
      return childRootID
  }

  return ''
}

/**
 * petal / 插件环境统一请求入口
 * 思源后端 API 规范：POST + JSON，返回 { code, msg, data } [5]
 */
async function requestSiyuan<T = any>(
  path: string,
  body?: Record<string, any>,
  options?: {
    token?: string
  },
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (options?.token) {
    headers.Authorization = `Token ${options.token}`
  }

  const resp = await fetch(normalizeApiPath(path), {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
  })

  if (!resp.ok) {
    throw new Error(`请求失败：${resp.status} ${resp.statusText}`)
  }

  const json = await resp.json() as SiyuanApiResponse<T>
  if (json.code !== 0) {
    throw new Error(json.msg || `接口调用失败：${path}`)
  }

  return json.data
}

export function pushErrMsg(message: string, timeout = 3000) {
  try {
    showMessage(message || '操作失败', timeout, 'error')
  }
  catch {
    console.error(message || '操作失败')
  }
}

export function pushMsg(message: string, timeout = 3000) {
  try {
    showMessage(message || '操作成功', timeout, 'info')
  }
  catch {
    console.log(message || '操作成功')
  }
}

/**
 * 官方通知接口包装
 * /api/notification/pushMsg [5]
 */
export async function pushKernelMsg(message: string, timeout = 3000) {
  return await requestSiyuan<NotificationPushResponse>('/api/notification/pushMsg', {
    msg: message,
    timeout,
  })
}

/**
 * 官方报错通知接口包装
 * /api/notification/pushErrMsg [5]
 */
export async function pushKernelErrMsg(message: string, timeout = 3000) {
  return await requestSiyuan<NotificationPushResponse>('/api/notification/pushErrMsg', {
    msg: message,
    timeout,
  })
}

/**
 * 从当前活动编辑器上下文获取 rootID
 * 这是插件环境里最常见、最直接的获取当前文档方式。
 */
export function getCurrentDocIdFromLayout(): string {
  const win = window as any

  try {
    const mobileRootID = win?.siyuan?.mobileEditor?.protyle?.block?.rootID
    if (mobileRootID)
      return mobileRootID
  }
  catch {}

  try {
    const domRootID = getCurrentDocIdFromDom()
    if (domRootID)
      return domRootID
  }
  catch {}

  try {
    const centerChildren = win?.siyuan?.layout?.centerLayout?.children || []
    for (const layout of centerChildren) {
      const rootID = getRootIdFromLayoutItem(layout)
      if (rootID)
        return rootID
    }
  }
  catch {}

  return ''
}

export async function getCurrentDocId(): Promise<string> {
  const id = getCurrentDocIdFromLayout()
  if (!id) {
    throw new Error('未获取到当前文档 ID，请先打开目标文档')
  }
  return id
}

/**
 * SQL 查询
 * /api/query/sql [5]
 */
export async function sql<T = any>(stmt: string): Promise<T[]> {
  return await requestSiyuan<T[]>('/api/query/sql', { stmt })
}

function getAssetReferenceCandidates(assetUrl: string): string[] {
  const normalized = String(assetUrl || '').trim().replace(/^\/+/, '')
  const fileName = normalized.split('/').pop() || normalized

  return Array.from(new Set([
    normalized,
    normalized.startsWith('assets/') ? `/${normalized}` : '',
    fileName ? `assets/${fileName}` : '',
    fileName ? `/assets/${fileName}` : '',
  ].filter(Boolean)))
}

export async function queryAssetReferences(assetUrl: string, limit = 50): Promise<ImageReferenceItem[]> {
  const candidates = getAssetReferenceCandidates(assetUrl)

  if (!candidates.length) {
    return []
  }

  const stmt = `
    select id, root_id, box, path, hpath, type, markdown, content
    from blocks
    where type != 'd'
      and (${candidates.map(item => `(markdown like '%${escapeSql(item)}%' or content like '%${escapeSql(item)}%')`).join(' or ')})
    order by updated desc
    limit ${Math.max(1, Math.min(200, limit))}
  `

  const rows = await sql<BlockRow>(stmt)
  return (rows || []).map(row => ({
    blockId: row.id,
    rootId: row.root_id || '',
    box: row.box || '',
    path: row.path || '',
    hpath: row.hpath || '',
    markdown: row.markdown || '',
    content: row.content || '',
    originalUrl: assetUrl,
  }))
}

export async function queryAssetReferencesBatch(assetUrls: string[], limitPerAsset = 50): Promise<Record<string, ImageReferenceItem[]>> {
  const normalizedUrls = Array.from(new Set(assetUrls.map(item => String(item || '').trim()).filter(Boolean)))
  const candidateMap = new Map<string, string[]>()
  const allCandidates = new Set<string>()

  for (const assetUrl of normalizedUrls) {
    const candidates = getAssetReferenceCandidates(assetUrl)
    if (!candidates.length)
      continue

    candidateMap.set(assetUrl, candidates)
    for (const candidate of candidates) {
      allCandidates.add(candidate)
    }
  }

  const result: Record<string, ImageReferenceItem[]> = {}
  for (const assetUrl of normalizedUrls) {
    result[assetUrl] = []
  }

  if (!allCandidates.size) {
    return result
  }

  const allRows: BlockRow[] = []
  const candidatesList = Array.from(allCandidates)
  const chunkSize = 40

  for (let i = 0; i < candidatesList.length; i += chunkSize) {
    const chunk = candidatesList.slice(i, i + chunkSize)
    const stmt = `
      select id, root_id, box, path, hpath, type, markdown, content
      from blocks
      where type != 'd'
        and (${chunk.map(item => `(markdown like '%${escapeSql(item)}%' or content like '%${escapeSql(item)}%')`).join(' or ')})
      order by updated desc
      limit ${Math.max(200, Math.min(2000, normalizedUrls.length * Math.max(1, limitPerAsset) * 3))}
    `

    const rows = await sql<BlockRow>(stmt)
    allRows.push(...(rows || []))
  }

  const seenByAsset = new Map<string, Set<string>>()
  for (const assetUrl of normalizedUrls) {
    seenByAsset.set(assetUrl, new Set())
  }

  for (const row of allRows) {
    const text = `${row.markdown || ''}\n${row.content || ''}`
    for (const assetUrl of normalizedUrls) {
      const refs = result[assetUrl]
      if (refs.length >= Math.max(1, limitPerAsset))
        continue

      const candidates = candidateMap.get(assetUrl) || []
      if (!candidates.some(candidate => text.includes(candidate)))
        continue

      const seen = seenByAsset.get(assetUrl)!
      if (seen.has(row.id))
        continue

      seen.add(row.id)
      refs.push({
        blockId: row.id,
        rootId: row.root_id || '',
        box: row.box || '',
        path: row.path || '',
        hpath: row.hpath || '',
        markdown: row.markdown || '',
        content: row.content || '',
        originalUrl: assetUrl,
      })
    }
  }

  return result
}

/**
 * 通过 blocks 表读取基础信息
 * 常用于补 notebook/path/hpath/root_id。
 */
export async function getDocBasicInfoById(docId: string): Promise<{
  id: string
  box: string
  path: string
  hpath: string
  rootID: string
} | null> {
  const rows = await sql<BlockRow>(`
    select id, box, path, hpath, root_id, type
    from blocks
    where id = '${escapeSql(docId)}'
    limit 1
  `)

  const row = rows?.[0]
  if (!row)
    return null

  return {
    id: row.id,
    box: row.box || '',
    path: row.path || '',
    hpath: row.hpath || '',
    rootID: row.root_id || row.id,
  }
}

/**
 * 列出笔记本
 * /api/notebook/lsNotebooks [5]
 */
export async function listNotebooks(): Promise<NotebookInfo[]> {
  const data = await requestSiyuan<{ notebooks: NotebookInfo[] }>('/api/notebook/lsNotebooks')
  return data?.notebooks || []
}

/**
 * 根据 ID 获取人类可读路径
 * /api/filetree/getHPathByID [5]
 */
export async function getDocHPathById(docId: string): Promise<string> {
  return await requestSiyuan<string>('/api/filetree/getHPathByID', {
    id: docId,
  })
}

/**
 * 根据 notebook + path 获取人类可读路径
 * /api/filetree/getHPathByPath [5]
 */
export async function getHPathByPath(notebook: string, path: string): Promise<string> {
  return await requestSiyuan<string>('/api/filetree/getHPathByPath', {
    notebook,
    path,
  })
}

/**
 * 根据人类可读路径获取文档 IDs
 * /api/filetree/getIDsByHPath [5]
 */
export async function getIDsByHPath(notebook: string, hpath: string): Promise<string[]> {
  return await requestSiyuan<string[]>('/api/filetree/getIDsByHPath', {
    notebook,
    path: hpath,
  })
}

/**
 * 获取文档 notebook/path/hpath
 */
export async function getDocNotebookAndPath(docId: string): Promise<{
  notebook: string
  path: string
  hpath: string
}> {
  const basic = await getDocBasicInfoById(docId)
  if (!basic) {
    throw new Error(`未找到文档信息：${docId}`)
  }

  let hpath = basic.hpath || ''
  if (!hpath) {
    try {
      hpath = await getDocHPathById(docId)
    }
    catch {
      hpath = ''
    }
  }

  return {
    notebook: basic.box,
    path: basic.path,
    hpath,
  }
}

/**
 * 导出 markdown 文本
 * /api/export/exportMdContent [5]
 *
 * 这是目前最适合你“扫描 markdown 图片链接”的接口。
 */
export async function getDocContent(docId: string): Promise<string> {
  const data = await requestSiyuan<ExportMdContentResponse>('/api/export/exportMdContent', {
    id: docId,
  })
  return data?.content || ''
}

/**
 * 获取可直接回写到文档根块的源码
 * 使用 getBlockKramdown 避免 exportMdContent 导出的 frontmatter / 标题包装被再次写入正文。
 */
export async function getEditableDocContent(docId: string): Promise<string> {
  return await getBlockKramdown(docId)
}

/**
 * 更新文档根块 markdown
 * /api/block/updateBlock [5]
 *
 * 思源官方接口支持 dataType=markdown。
 * 对于文档块，直接更新 root block 即可。
 */
export async function updateDocContent(docId: string, markdown: string): Promise<void> {
  await requestSiyuan('/api/block/updateBlock', {
    id: docId,
    dataType: 'markdown',
    data: markdown,
  })
}

/**
 * 获取当前文档 markdown
 */
export async function getCurrentDocs(): Promise<DocInfo[]> {
  const currentDocId = await getCurrentDocId()
  const currentMeta = await getDocNotebookAndPath(currentDocId)

  return [{
    id: currentDocId,
    path: currentMeta.path,
    hpath: currentMeta.hpath || '当前文档',
    content: await getDocContent(currentDocId),
  }]
}

/**
 * 读取块属性
 * /api/attr/getBlockAttrs [5]
 */
export async function getBlockAttrs(blockId: string): Promise<Record<string, any>> {
  return await requestSiyuan<Record<string, any>>('/api/attr/getBlockAttrs', {
    id: blockId,
  })
}

/**
 * 设置块属性
 * /api/attr/setBlockAttrs [5]
 */
export async function setBlockAttrs(blockId: string, attrs: Record<string, any>): Promise<void> {
  await requestSiyuan('/api/attr/setBlockAttrs', {
    id: blockId,
    attrs,
  })
}

/**
 * 获取块 kramdown
 * /api/block/getBlockKramdown [5]
 */
export async function getBlockKramdown(blockId: string): Promise<string> {
  const data = await requestSiyuan<{ id: string, kramdown: string }>('/api/block/getBlockKramdown', {
    id: blockId,
  })
  return data?.kramdown || ''
}

/**
 * 上传资源到思源 assets
 * /api/asset/upload [5]
 */
export async function uploadAssetFiles(files: File[], assetsDirPath = '/assets/'): Promise<{
  errFiles: string[]
  succMap: Record<string, string>
}> {
  const form = new FormData()
  form.append('assetsDirPath', assetsDirPath)

  for (const file of files) {
    form.append('file[]', file)
  }

  const resp = await fetch('/api/asset/upload', {
    method: 'POST',
    body: form,
  })

  if (!resp.ok) {
    throw new Error(`上传资源失败：${resp.status} ${resp.statusText}`)
  }

  const json = await resp.json() as SiyuanApiResponse<{
    errFiles: string[]
    succMap: Record<string, string>
  }>

  if (json.code !== 0) {
    throw new Error(json.msg || '上传资源失败')
  }

  return json.data || { errFiles: [], succMap: {} }
}

function escapeSql(value: string) {
  return String(value).replace(/'/g, "''")
}
