import type { CfBedConfig } from '@/types/plugin'

type UploadChannel = CfBedConfig['uploadChannel']

type UploadTemplateOptions = {
  case?: 'lower' | 'upper' | 'none'
  slugify?: boolean
  momentJsFormat?: string
}

export type UploadTemplateNoteContext = {
  noteFileName: string
  noteFolderName: string
  noteFolderPath: string
  noteFilePath: string
}

export type UploadTemplateContext = {
  note: UploadTemplateNoteContext
  originalAttachmentFileName: string
  originalAttachmentFileExtension: string
  now: Date
  timestamp: string
  uuid: string
}

export const DEFAULT_CUSTOM_FILE_NAME_TEMPLATE = `${buildPlaceholder('originalAttachmentFileName')}-${buildPlaceholder('datetime')}`

const TEMPLATE_PLACEHOLDER_REGEX = /\$\{([a-z][a-z0-9]*)(?::(\{[^{}]*\}))?\}/gi

export function getDefaultChunkSizeMB(channel: UploadChannel) {
  if (channel === 'discord')
    return 8
  if (channel === 'telegram')
    return 16
  return 20
}

export function getChunkThresholdMB(channel: UploadChannel) {
  if (channel === 'discord')
    return 10
  if (channel === 'telegram')
    return 20
  return Number.POSITIVE_INFINITY
}

export function supportsClientChunkUpload(channel: UploadChannel) {
  return channel === 'telegram' || channel === 'discord'
}

export function resolveChunkSizeMB(channel: UploadChannel, configuredChunkSize?: number) {
  const nextSize = Number(configuredChunkSize)
  if (Number.isFinite(nextSize) && nextSize > 0)
    return Math.max(1, Math.round(nextSize))
  return getDefaultChunkSizeMB(channel)
}

export function createUploadTemplateContext(fileName: string, noteFilePath = '', now = new Date()): UploadTemplateContext {
  const normalizedFileName = String(fileName || '').trim()
  const lastDotIndex = normalizedFileName.lastIndexOf('.')

  return {
    note: createNoteTemplateContext(noteFilePath),
    originalAttachmentFileName: lastDotIndex > 0 ? normalizedFileName.slice(0, lastDotIndex) : normalizedFileName,
    originalAttachmentFileExtension: lastDotIndex > 0 ? normalizedFileName.slice(lastDotIndex + 1) : '',
    now,
    timestamp: String(now.getTime()),
    uuid: createUuid(),
  }
}

export function resolveUploadFolderTemplate(template: string, context: UploadTemplateContext) {
  const resolved = applyTemplate(normalizeTemplateString(template), context)
  return resolved
    .replace(/\\/g, '/')
    .split('/')
    .map(segment => sanitizePathSegment(segment))
    .filter(Boolean)
    .join('/')
}

export function resolveCustomFileNameTemplate(template: string, context: UploadTemplateContext) {
  const fallbackBaseName = context.originalAttachmentFileName || 'file'
  const resolved = sanitizeFileName(applyTemplate(normalizeTemplateString(template), context))
  const fileName = resolved || fallbackBaseName
  const extension = sanitizeFileExtension(context.originalAttachmentFileExtension)

  if (!extension)
    return fileName

  if (fileName.toLowerCase().endsWith(`.${extension.toLowerCase()}`))
    return fileName

  return `${fileName}.${extension}`
}

export function normalizeTemplateString(value: string) {
  return String(value || '').replace(/\\\$\{/g, '${').trim()
}

function createNoteTemplateContext(noteFilePath: string): UploadTemplateNoteContext {
  const normalizedPath = String(noteFilePath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .trim()

  const segments = normalizedPath.split('/').filter(Boolean)
  const noteFileName = segments.at(-1) || ''
  const noteFolderPath = segments.slice(0, -1).join('/')
  const noteFolderName = noteFolderPath.split('/').filter(Boolean).at(-1) || ''
  const noteFilePathWithExtension = noteFileName
    ? /\.[a-z0-9]+$/i.test(noteFileName)
      ? normalizedPath
      : `${normalizedPath}.md`
    : ''

  return {
    noteFileName: stripFileExtension(noteFileName),
    noteFolderName,
    noteFolderPath,
    noteFilePath: noteFilePathWithExtension,
  }
}

function applyTemplate(template: string, context: UploadTemplateContext) {
  return String(template || '').replace(TEMPLATE_PLACEHOLDER_REGEX, (_, tokenName: string, rawOptions: string) => {
    const value = resolvePlaceholderValue(tokenName, parseTemplateOptions(rawOptions), context)
    return value ?? ''
  }).trim()
}

function resolvePlaceholderValue(tokenName: string, options: UploadTemplateOptions, context: UploadTemplateContext) {
  if (tokenName === 'noteFileName')
    return applyStringOptions(context.note.noteFileName, options)
  if (tokenName === 'noteFolderName')
    return applyStringOptions(context.note.noteFolderName, options)
  if (tokenName === 'noteFolderPath')
    return applyPathOptions(context.note.noteFolderPath, options)
  if (tokenName === 'noteFilePath')
    return applyPathOptions(context.note.noteFilePath, options)
  if (tokenName === 'originalAttachmentFileName')
    return applyStringOptions(context.originalAttachmentFileName, options)
  if (tokenName === 'originalAttachmentFileExtension')
    return applyStringOptions(context.originalAttachmentFileExtension, options)
  if (tokenName === 'date')
    return formatDateToken(context.now, options.momentJsFormat || 'YYYYMMDD')
  if (tokenName === 'time')
    return formatDateToken(context.now, options.momentJsFormat || 'HHmmss')
  if (tokenName === 'datetime')
    return formatDateToken(context.now, options.momentJsFormat || 'YYYYMMDD-HHmmss')
  if (tokenName === 'timestamp')
    return context.timestamp
  if (tokenName === 'uuid')
    return context.uuid
  return ''
}

function parseTemplateOptions(rawOptions?: string): UploadTemplateOptions {
  if (!rawOptions)
    return {}

  const text = rawOptions.trim().replace(/^\{/, '').replace(/\}$/, '')
  if (!text)
    return {}

  const result: UploadTemplateOptions = {}
  for (const pair of splitTemplateOptionPairs(text)) {
    const separatorIndex = pair.indexOf(':')
    if (separatorIndex < 0)
      continue

    const key = normalizeOptionKey(pair.slice(0, separatorIndex))
    const value = parseOptionValue(pair.slice(separatorIndex + 1))
    if (!key) {
      continue
    }

    ;(result as Record<string, unknown>)[key] = value
  }

  return result
}

function splitTemplateOptionPairs(raw: string) {
  const pairs: string[] = []
  let current = ''
  let quote: '\'' | '"' | '' = ''

  for (const char of raw) {
    if ((char === '\'' || char === '"') && !quote) {
      quote = char
      current += char
      continue
    }

    if (quote && char === quote) {
      quote = ''
      current += char
      continue
    }

    if (!quote && char === ',') {
      if (current.trim()) {
        pairs.push(current.trim())
      }
      current = ''
      continue
    }

    current += char
  }

  if (current.trim()) {
    pairs.push(current.trim())
  }

  return pairs
}

function normalizeOptionKey(value: string) {
  return String(value || '').trim().replace(/^['"]|['"]$/g, '')
}

function parseOptionValue(value: string): string | boolean | number {
  const normalized = String(value || '').trim()
  if (/^'.*'$|^".*"$/.test(normalized))
    return normalized.slice(1, -1)
  if (normalized === 'true')
    return true
  if (normalized === 'false')
    return false
  if (/^-?\d+(?:\.\d+)?$/.test(normalized))
    return Number(normalized)
  return normalized
}

function applyStringOptions(value: string, options: UploadTemplateOptions) {
  let nextValue = String(value || '')

  if (options.case === 'lower')
    nextValue = nextValue.toLowerCase()
  else if (options.case === 'upper')
    nextValue = nextValue.toUpperCase()

  if (options.slugify)
    nextValue = slugify(nextValue)

  return nextValue
}

function applyPathOptions(value: string, options: UploadTemplateOptions) {
  return String(value || '')
    .split('/')
    .map(segment => applyStringOptions(segment, options))
    .join('/')
}

function formatDateToken(date: Date, format: string) {
  const replacements: Array<[string, string]> = [
    ['YYYY', String(date.getFullYear())],
    ['YY', String(date.getFullYear()).slice(-2)],
    ['MM', pad(date.getMonth() + 1)],
    ['DD', pad(date.getDate())],
    ['HH', pad(date.getHours())],
    ['mm', pad(date.getMinutes())],
    ['ss', pad(date.getSeconds())],
    ['SSS', String(date.getMilliseconds()).padStart(3, '0')],
    ['M', String(date.getMonth() + 1)],
    ['D', String(date.getDate())],
    ['H', String(date.getHours())],
    ['m', String(date.getMinutes())],
    ['s', String(date.getSeconds())],
  ]

  let nextFormat = String(format || '')
  for (const [token, value] of replacements) {
    nextFormat = nextFormat.replace(new RegExp(token, 'g'), value)
  }
  return nextFormat
}

function slugify(value: string) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

function sanitizeFileName(value: string) {
  return stripControlCharacters(String(value || ''))
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
}

function sanitizePathSegment(value: string) {
  return sanitizeFileName(String(value || '').replace(/\//g, '-'))
}

function sanitizeFileExtension(value: string) {
  return String(value || '').replace(/[^a-z0-9]/gi, '')
}

function stripFileExtension(value: string) {
  const index = String(value || '').lastIndexOf('.')
  if (index <= 0)
    return String(value || '')
  return String(value).slice(0, index)
}

function createUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID()

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.random() * 16 | 0
    const value = char === 'x' ? random : (random & 0x3 | 0x8)
    return value.toString(16)
  })
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function stripControlCharacters(value: string) {
  return Array.from(value).filter(char => char >= ' ').join('')
}

function buildPlaceholder(name: string) {
  return ['$', '{', name, '}'].join('')
}
