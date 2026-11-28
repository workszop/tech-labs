// Own documents: read PDF, DOCX and plain text in the browser and enforce the workshop limits.
// Files never leave the browser here; only chunk text goes to the Worker later (embeddings, chat).
import { uid } from '@/lib/utils'

export const OWN_LIMITS = { maxFiles: 10, maxPdfPages: 20, maxChars: 60_000, maxBytes: 10 * 1024 * 1024, charsPerPage: 3000 } as const

export type OwnFileKind = 'pdf' | 'docx' | 'txt'

export interface OwnDoc {
  id: string
  name: string
  kind: OwnFileKind
  /** PDF: real pages; other files: pages of 3000 characters. */
  pages: number
  chars: number
  text: string
}

export type RejectReason = 'tooMany' | 'tooBig' | 'badType' | 'tooManyPages' | 'tooLong' | 'noText' | 'unreadable' | 'duplicate'

export interface Rejected {
  name: string
  reason: RejectReason
}

export function kindOf(name: string, type: string): OwnFileKind | null {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf' || type === 'application/pdf') return 'pdf'
  if (ext === 'docx' || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
  if (ext === 'txt' || ext === 'md' || type === 'text/plain' || type === 'text/markdown') return 'txt'
  return null
}

/** Checks that need no parsing: number of files, size, type. */
export function checkPreParse(file: { name: string; size: number; type: string }, alreadyAccepted: number): RejectReason | null {
  if (!kindOf(file.name, file.type)) return 'badType'
  if (alreadyAccepted >= OWN_LIMITS.maxFiles) return 'tooMany'
  if (file.size > OWN_LIMITS.maxBytes) return 'tooBig'
  return null
}

/** Checks on the parsed text: PDF pages, length of other files, a text layer at all. */
export function checkParsed(kind: OwnFileKind, pages: number, text: string): RejectReason | null {
  if (kind === 'pdf' && pages > OWN_LIMITS.maxPdfPages) return 'tooManyPages'
  if (kind !== 'pdf' && text.length > OWN_LIMITS.maxChars) return 'tooLong'
  // A scan has (almost) no text layer; page numbers or a stamped footer must not pass as text.
  const minChars = kind === 'pdf' ? Math.max(20, 30 * pages) : 20
  if (text.trim().length < minChars) return 'noText'
  return null
}

/** UTF-8 when valid, otherwise Windows-1250 (Polish text files saved by older Windows programs). */
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '')
  } catch {
    return new TextDecoder('windows-1250').decode(bytes)
  }
}

/** File names go into the prompt as the source title; the Worker caps that field at 300 characters. */
export function shortDocName(name: string, max = 200): string {
  if (name.length <= max) return name
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 && name.length - dot <= 10 ? name.slice(dot) : ''
  return `${name.slice(0, max - ext.length - 1)}…${ext}`
}

const textPages = (chars: number) => Math.max(1, Math.ceil(chars / OWN_LIMITS.charsPerPage))

async function parsePdf(file: File): Promise<{ text: string; pages: number }> {
  const pdfjs = await import('pdfjs-dist')
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  }
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const doc = await task.promise
  // Over the page limit: the count alone rejects the file, no need to read any text.
  if (doc.numPages > OWN_LIMITS.maxPdfPages) {
    void task.destroy()
    return { text: '', pages: doc.numPages }
  }
  try {
    const pages: string[] = []
    // Past the limit there is no need to read further; the page count alone rejects the file.
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent()
      pages.push(content.items.map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : ' ') : '')).join('').replace(/[ \t]+\n/g, '\n').trim())
    }
    return { text: pages.join('\n\n'), pages: doc.numPages }
  } finally {
    void task.destroy()
  }
}

async function parseDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const res = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
  return res.value.replace(/\n{3,}/g, '\n\n').trim()
}

export async function parseFile(file: File): Promise<{ text: string; pages: number }> {
  const kind = kindOf(file.name, file.type)
  if (kind === 'pdf') return parsePdf(file)
  const text = kind === 'docx' ? await parseDocx(file) : decodeText(new Uint8Array(await file.arrayBuffer())).replace(/\r\n/g, '\n')
  return { text, pages: textPages(text.length) }
}

/** Parse new files in order; accepted ones get an id, the others a reason. */
export async function addFiles(files: File[], existing: OwnDoc[]): Promise<{ accepted: OwnDoc[]; rejected: Rejected[] }> {
  const accepted: OwnDoc[] = []
  const rejected: Rejected[] = []
  for (const f of files) {
    const pre = checkPreParse(f, existing.length + accepted.length)
    if (pre) {
      rejected.push({ name: f.name, reason: pre })
      continue
    }
    const kind = kindOf(f.name, f.type)!
    let parsed: { text: string; pages: number }
    try {
      parsed = await parseFile(f)
    } catch {
      rejected.push({ name: f.name, reason: 'unreadable' })
      continue
    }
    const bad = checkParsed(kind, parsed.pages, parsed.text)
    if (bad) {
      rejected.push({ name: f.name, reason: bad })
      continue
    }
    const dup = [...existing, ...accepted].some((d) => d.name === f.name && d.chars === parsed.text.length)
    if (dup) {
      rejected.push({ name: f.name, reason: 'duplicate' })
      continue
    }
    accepted.push({ id: uid('own'), name: f.name, kind, pages: parsed.pages, chars: parsed.text.length, text: parsed.text })
  }
  return { accepted, rejected }
}
