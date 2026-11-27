import { Layers } from 'lucide-react'
import { openChunkInDocument } from '@/state/actions'
import type { QueryRun } from '@/state/store'
import { useT } from '@/i18n'

/**
 * Under a RAG answer (Students face): the fragments that reached the model, as
 * "document title, fragment n, similarity 0.71". A row opens the fragment in its document.
 */
export function ContextList({ run }: { run: QueryRun }) {
  const tx = useT().lab.chat.contextList
  const score = new Map((run.search.ranked ?? []).map((r) => [r.chunkId, r.score]))
  const rows = run.context.included.map((id, i) => {
    const d = run.context.docs?.[i]
    return { id, title: d?.docTitle ?? id, n: (d?.chunkIndex ?? 0) + 1, score: score.get(id) }
  })
  return (
    <section className="rounded-xl border bg-card px-3 py-2.5" data-testid="context-list" tabIndex={-1} aria-label={tx.title}>
      <h4 className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold">
        <Layers className="size-3.5 shrink-0" /> {tx.title}
      </h4>
      {rows.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">{tx.none}</p>
      ) : (
        <ol className="space-y-1">
          {rows.map((r, i) => (
            <li key={r.id}>
              <button className="flex w-full items-baseline gap-1.5 rounded-md px-1 py-0.5 text-left text-[12px] leading-snug transition-colors cursor-pointer hover:bg-muted" onClick={() => openChunkInDocument(r.id)} title={tx.open} data-chunk-id={r.id}>
                <span className="shrink-0 font-mono font-medium">[{i + 1}]</span>
                <span className="min-w-0">{tx.row(r.title, r.n, r.score !== undefined ? r.score.toFixed(2) : '–')}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
