/**
 * Chunk labels ("contextual chunk headers").
 *
 * A chunk read on its own can lose what it is about: a list item without the
 * heading above it, or a paragraph from a superseded policy without the line
 * that says "outdated". A label puts that context back. It is written as one
 * line in front of the chunk text, so it is embedded together with the chunk
 * and the language model sees it in the excerpt, exactly like the chunk text.
 *
 * The label never changes `start`/`end`: those still point at the chunk body
 * inside the original document, so highlighting in the document view works.
 */

export interface ChunkLabelOptions {
  /** Document title and the nearest section heading above the chunk. */
  section: boolean
  /** Version, effective date, status and owner of the document. */
  meta: boolean
}

export interface ChunkLabelDoc {
  title: string
  version: string
  effectiveDate: string
  status: 'current' | 'outdated'
  owner: string
}

export interface ChunkLabelWords {
  version: string
  effectiveFrom: string
  current: string
  outdated: string
  owner: string
}

export interface Section {
  start: number
  title: string
}

/** Stable key of the options, stored with the index so that a change forces a rebuild. */
export function labelKey(o: ChunkLabelOptions): string {
  if (o.section && o.meta) return 'section+meta'
  if (o.section) return 'section'
  if (o.meta) return 'meta'
  return 'none'
}

/**
 * Headings of a plain-text document: a paragraph of one short line that does not
 * end like a sentence and is not a list item. The first paragraph is the document
 * title and is not a section.
 */
export function findSections(text: string): Section[] {
  const out: Section[] = []
  const paraRe = /\S[\s\S]*?(?=\n\s*\n|$)/g
  let m: RegExpExecArray | null
  let first = true
  while ((m = paraRe.exec(text))) {
    const p = m[0].trim()
    const isFirst = first
    first = false
    if (isFirst) continue
    if (p.includes('\n') || p.length > 80) continue
    if (/^[-•*\d]/.test(p)) continue
    if (/[.:;!?,…]$/.test(p)) continue
    out.push({ start: m.index, title: p })
  }
  return out
}

/** The section a position belongs to (the last heading at or before it), or null before the first heading. */
export function sectionAt(sections: Section[], pos: number): Section | null {
  let found: Section | null = null
  for (const s of sections) {
    if (s.start <= pos) found = s
    else break
  }
  return found
}

/**
 * The label line for one chunk, or '' when both options are off.
 * The section is added only when its heading was cut off, i.e. the chunk starts
 * after the heading line; a chunk that contains its own heading needs no repeat.
 */
export function chunkLabel(doc: ChunkLabelDoc, sections: Section[], chunkStart: number, o: ChunkLabelOptions, w: ChunkLabelWords): string {
  if (!o.section && !o.meta) return ''
  const parts: string[] = []
  let where = doc.title
  if (o.section) {
    const sec = sectionAt(sections, chunkStart)
    if (sec && sec.start < chunkStart && sec.title !== doc.title) where = `${doc.title} › ${sec.title}`
  }
  parts.push(where)
  if (o.meta) {
    parts.push(`${w.version} ${doc.version}`)
    parts.push(`${w.effectiveFrom} ${doc.effectiveDate}`)
    parts.push(doc.status === 'outdated' ? w.outdated : w.current)
    parts.push(`${w.owner}: ${doc.owner}`)
  }
  return `[${parts.join(' · ')}]`
}
