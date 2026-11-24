import * as React from 'react'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { KbDocument } from '@/data/kb/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLang, useT } from '@/i18n'
import { chunksOf, type StoredChunk } from '@/kb/indexer'
import { Alert } from '../common'
import type { RecordRef } from './model'
import { Links, MonoLabel, RecordLink, StatusChip, TONES, fmtDate, useExplorerData } from './ui'

/** A knowledge document: metadata, rendered text, and the chunks the knowledge search works with. */
export function DocumentView({ doc, links }: { doc: KbDocument; links: RecordRef[] }) {
  const tx = useT().systems
  const lang = useLang()
  const { data } = useExplorerData()
  const [chunks, setChunks] = useState<StoredChunk[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    setChunks(null)
    setFailed(false)
    chunksOf(doc.id, lang).then(
      (c) => live && setChunks(c),
      () => live && setFailed(true),
    )
    return () => {
      live = false
    }
  }, [doc.id, lang])

  const m = tx.doc.meta
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-1 gap-x-5 gap-y-2.5 sm:grid-cols-3">
        <div>
          <dt><MonoLabel>{m.authority}</MonoLabel></dt>
          <dd className="mt-0.5 text-[14px]">{tx.enums.authorityOne[doc.authority]}</dd>
        </div>
        <div>
          <dt><MonoLabel>{m.status}</MonoLabel></dt>
          <dd className="mt-0.5"><StatusChip tone={TONES.docStatus[doc.status]}>{tx.enums.docStatus[doc.status]}</StatusChip></dd>
        </div>
        <div>
          <dt><MonoLabel>{m.effective}</MonoLabel></dt>
          <dd className="mt-0.5 text-[14px]">{fmtDate(doc.effectiveDate)}</dd>
        </div>
        <div className="sm:col-span-3">
          <dt><MonoLabel>{m.appliesTo}</MonoLabel></dt>
          <dd className="mt-0.5 text-[14px]">{doc.appliesTo.length ? doc.appliesTo.join(', ') : tx.doc.allProducts}</dd>
        </div>
      </dl>
      {doc.status === 'superseded' && doc.supersededBy && (
        <Alert tone="warn">
          {tx.doc.supersededNote(doc.supersededBy)} <RecordLink refTo={{ kind: 'document', id: doc.supersededBy }} />
        </Alert>
      )}
      <Links refs={links} data={data} />

      <Tabs defaultValue="text">
        <TabsList>
          <TabsTrigger value="text">{tx.doc.tabText}</TabsTrigger>
          <TabsTrigger value="chunks" data-testid="doc-chunks-tab">{tx.doc.tabChunks(chunks ? chunks.length : null)}</TabsTrigger>
        </TabsList>
        <TabsContent value="text" className="mt-3">
          <article className="max-w-[70ch] text-[14.5px] leading-[1.7] text-foreground" data-testid="doc-text">
            <Markdown text={doc.body} />
          </article>
        </TabsContent>
        <TabsContent value="chunks" className="mt-3 space-y-2.5" data-testid="doc-chunks">
          <p className="text-[13px] leading-relaxed text-[var(--ink-2)]">{tx.doc.chunksIntro}</p>
          {failed ? (
            <Alert tone="danger">{tx.doc.chunksError}</Alert>
          ) : !chunks ? (
            <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="size-4 animate-spin" /> {tx.doc.loadingChunks}</p>
          ) : (
            chunks.map((c) => (
              <section key={c.chunkId} className="overflow-hidden rounded-lg border border-border" data-chunk={c.chunkId}>
                <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-hairline bg-subtle px-3 py-1.5">
                  <MonoLabel>{tx.doc.chunk(c.index)}</MonoLabel>
                  <span className="min-w-0 truncate text-[12.5px] font-semibold">{c.section}</span>
                  <StatusChip tone="doc" className="ml-auto">{tx.doc.tokens(c.tokens)}</StatusChip>
                </header>
                <p className="whitespace-pre-wrap px-3 py-2 text-[13px] leading-relaxed text-[var(--ink-2)]">{c.text.replace(/^##\s+.*\n+/, '')}</p>
              </section>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** Markdown-light: `## ` headings, paragraphs, `- ` and `1. ` lists, **bold**. Enough for the service documents. */
export function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let para: string[] = []
  const flushPara = () => {
    if (para.length) blocks.push(<p key={blocks.length} className="mb-3">{inline(para.join(' '))}</p>)
    para = []
  }
  const flushList = () => {
    if (!list) return
    const items = list.items.map((it, i) => <li key={i}>{inline(it)}</li>)
    blocks.push(list.ordered ? <ol key={blocks.length} className="mb-3 list-decimal space-y-1 pl-6">{items}</ol> : <ul key={blocks.length} className="mb-3 list-disc space-y-1 pl-6">{items}</ul>)
    list = null
  }
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    const h = /^#{2,3}\s+(.+)$/.exec(line)
    const ul = /^\s*[-*]\s+(.+)$/.exec(line)
    const ol = /^\s*\d+[.)]\s+(.+)$/.exec(line)
    if (h) {
      flushPara()
      flushList()
      blocks.push(<h3 key={blocks.length} className="mb-1.5 mt-4 font-display text-[16px] font-bold first:mt-0">{h[1]}</h3>)
    } else if (ul || ol) {
      flushPara()
      const ordered = !!ol
      if (list && list.ordered !== ordered) flushList()
      if (!list) list = { ordered, items: [] }
      list.items.push((ul ?? ol)![1]!)
    } else if (!line.trim()) {
      flushPara()
      flushList()
    } else if (list && /^\s+\S/.test(raw)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`
    } else {
      flushList()
      para.push(line.trim())
    }
  }
  flushPara()
  flushList()
  return <>{blocks}</>
}

function inline(s: string): React.ReactNode {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong> : part))
}
