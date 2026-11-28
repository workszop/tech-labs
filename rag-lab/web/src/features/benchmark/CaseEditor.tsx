import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/input'
import { useCorpus } from '@/data/corpus'
import { CASE_KINDS, type BenchmarkCase } from '@/rag/benchmark'
import { deleteCase, saveCase } from '@/state/benchmark'
import { useT } from '@/i18n'
import { Alert, SEG, segItem } from '../common'
import { draftFromCase, draftToCase, emptyDraft, validateDraft, type CaseDraft } from './caseDraft'

const LABEL = 'mb-1 block font-mono text-[10.5px] font-medium uppercase tracking-[0.08em]'

/** A dialog for one test case: a new one (`c` undefined), one of the user's own, or a built-in one read-only. */
export function CaseEditor({ c, onClose }: { c?: BenchmarkCase; onClose: () => void }) {
  const tx = useT().lab.benchmark
  const corpus = useCorpus()
  const readOnly = !!c?.builtIn
  const [d, setD] = useState<CaseDraft>(() => (c ? draftFromCase(c) : emptyDraft()))
  const [tried, setTried] = useState(false)
  const check = validateDraft(d)
  const set = (patch: Partial<CaseDraft>) => setD((x) => ({ ...x, ...patch }))
  const save = async () => {
    setTried(true)
    if (check.errors.length) return
    await saveCase(draftToCase(d))
    onClose()
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="bench-case-editor">
        <DialogHeader>
          <DialogTitle>{readOnly ? tx.viewTitle : c ? tx.editTitle : tx.newTitle}</DialogTitle>
          {readOnly && <DialogDescription>{tx.readOnly}</DialogDescription>}
        </DialogHeader>
        <DialogBody className="space-y-3.5">
          <div>
            <span className={LABEL}>{tx.fields.kind}</span>
            <div className={SEG + ' flex-wrap'} role="group" aria-label={tx.fields.kind}>
              {CASE_KINDS.map((k) => (
                <button key={k} type="button" disabled={readOnly} aria-pressed={d.kind === k} className={segItem(d.kind === k)} onClick={() => set({ kind: k })}>
                  {tx.kinds[k]}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className={LABEL}>{tx.fields.question}</span>
            <Textarea rows={2} value={d.question} readOnly={readOnly} onChange={(e) => set({ question: e.target.value })} aria-invalid={tried && check.errors.includes('question')} data-testid="bench-editor-question" />
            {tried && check.errors.includes('question') && <span className="mt-1 block text-[12px] text-danger">{tx.errors.question}</span>}
          </label>
          <fieldset>
            <legend className={LABEL}>{tx.fields.expectedDocs}</legend>
            <div className="scroll-thin max-h-44 space-y-1 overflow-y-auto rounded-md border border-input p-2">
              {corpus.documents.map((doc) => (
                <label key={doc.id} className="flex items-center gap-2 text-[12.5px]">
                  <Checkbox
                    disabled={readOnly}
                    checked={d.expectedDocIds.includes(doc.id)}
                    onCheckedChange={(v) => set({ expectedDocIds: v === true ? [...d.expectedDocIds, doc.id] : d.expectedDocIds.filter((x) => x !== doc.id) })}
                  />
                  <span className="min-w-0 truncate">{doc.title}</span>
                </label>
              ))}
            </div>
            {tried && check.errors.includes('docs') && <span className="mt-1 block text-[12px] text-danger">{tx.errors.docs}</span>}
          </fieldset>
          <label className="block">
            <span className={LABEL}>{tx.fields.expectedAnswer}</span>
            <Textarea rows={3} value={d.expectedAnswer} readOnly={readOnly} onChange={(e) => set({ expectedAnswer: e.target.value })} />
          </label>
          <label className="block">
            <span className={LABEL}>{tx.fields.keyFacts}</span>
            <Textarea rows={3} value={d.keyFacts} readOnly={readOnly} onChange={(e) => set({ keyFacts: e.target.value })} className="font-mono text-[12.5px]" />
            <span className="mt-1 block text-[11.5px] text-muted-foreground">{tx.fields.keyFactsHint}</span>
          </label>
          <label className="block">
            <span className={LABEL}>{tx.fields.mustNotContain}</span>
            <Textarea rows={2} value={d.mustNotContain} readOnly={readOnly} onChange={(e) => set({ mustNotContain: e.target.value })} className="font-mono text-[12.5px]" />
            <span className="mt-1 block text-[11.5px] text-muted-foreground">{tx.fields.mustNotContainHint}</span>
          </label>
          {check.studentVerdict && <div data-testid="bench-student-verdict-note"><Alert tone="doc">{tx.studentVerdictNote}</Alert></div>}
        </DialogBody>
        <div className="flex flex-wrap items-center gap-2 border-t border-dashed px-5 py-3">
          {c && !c.builtIn && (
            <Button variant="ghost" size="sm" onClick={async () => { await deleteCase(c.id); onClose() }}>
              <Trash2 /> {tx.delete}
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>{tx.close}</Button>
            {!readOnly && <Button variant="accent" size="sm" onClick={() => void save()} data-testid="bench-editor-save">{tx.save}</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
