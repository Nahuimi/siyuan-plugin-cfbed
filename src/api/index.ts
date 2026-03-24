import { showMessage } from 'siyuan'
import type { DocInfo } from '@/types/plugin'

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

type ListDocsFile = {
  id: string
  path: string
  name: string
  name1?: string
  icon?: string
  alias?: string
  memo?: string
  bookmark?: string
  count?: number
  size?: number
  hSize?: string
  mtime?: number
  ctime?: number
  hMtime?: string
  hCtime?: string
  sort?: number
  subFileCount: number
  hidden?: boolean
  newFlashcardCount?: number
  dueFlashcardCount?: number
  flashcardCount?: number
}

type ListDocsByPathResponse = {
  box: string
  path: string
  files: ListDocsFile[]
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
}

type NotificationPushResponse = {
  id: string
}

function normalizeApiPath(path: string) {
  return path.startsWith('/') ? path : `/${path}`
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
    const centerChildren = win?.siyuan?.layout?.centerLayout?.children || []
    for (const layout of centerChildren) {
      const children = layout?.children || []
      for (const child of children) {
        const rootID = child?.model?.editor?.protyle?.block?.rootID
        if (rootID)
          return rootID
      }
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
 * 列出某路径下的子文档
 * /api/filetree/listDocsByPath [5]
 */
export async function listDocsByPath(
  notebook: string,
  path: string,
  options?: {
    sort?: number
    maxListCount?: number
    flashcard?: boolean
  },
): Promise<ListDocsFile[]> {
  const data = await requestSiyuan<ListDocsByPathResponse>('/api/filetree/listDocsByPath', {
    notebook,
    path,
    sort: options?.sort ?? 256,
    maxListCount: options?.maxListCount,
    flashcard: options?.flashcard ?? false,
  })

  return Array.isArray(data?.files) ? data.files : []
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
 * 递归获取指定文档的全部子文档
 */
export async function listChildDocs(docId: string): Promise<Array<{
  id: string
  path: string
  hpath: string
}>> {
  const root = await getDocNotebookAndPath(docId)
  const results: Array<{ id: string, path: string, hpath: string }> = []

  async function walk(currentPath: string) {
    const children = await listDocsByPath(root.notebook, currentPath)

    for (const item of children) {
      if (!item?.id || !item?.path)
        continue

      let hpath = ''
      try {
        hpath = await getHPathByPath(root.notebook, item.path)
      }
      catch {
        hpath = ''
      }

      results.push({
        id: item.id,
        path: item.path,
        hpath,
      })

      if ((item.subFileCount || 0) > 0) {
        await walk(item.path)
      }
    }
  }

  await walk(root.path)

  return results.filter(item => item.id !== docId)
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
 * 获取当前文档 + 全部子文档 markdown
 */
export async function getCurrentAndChildDocs(): Promise<DocInfo[]> {
  const currentDocId = await getCurrentDocId()
  const currentMeta = await getDocNotebookAndPath(currentDocId)

  const docs: DocInfo[] = []

  docs.push({
    id: currentDocId,
    path: currentMeta.path,
    hpath: currentMeta.hpath || '当前文档',
    content: await getDocContent(currentDocId),
  })

  const children = await listChildDocs(currentDocId)

  for (const child of children) {
    try {
      const content = await getDocContent(child.id)
      docs.push({
        id: child.id,
        path: child.path,
        hpath: child.hpath,
        content,
      })
    }
    catch (error) {
      console.warn('[cfbed] 读取子文档 markdown 失败:', child.id, error)
    }
  }

  return docs
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