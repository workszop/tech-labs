import { useEffect, useState } from 'react'
import { AlertTriangle, Monitor, X } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useStore, type Part } from '@/state/store'
import { useLang, useT } from '@/i18n'
import { ActivationScreen } from '@/features/ActivationScreen'
import { Header } from '@/features/Header'
import { PartsBar } from '@/features/PartsBar'
import { CasePart } from '@/features/parts/CasePart'
import { DataPart } from '@/features/parts/DataPart'
import { VectorsPart } from '@/features/parts/VectorsPart'
import { GeneratorPart } from '@/features/parts/GeneratorPart'
import { BenchmarkPart } from '@/features/parts/BenchmarkPart'
import { DocumentDialog } from '@/features/DocumentDialog'
import { LearnDialog } from '@/features/LearnDialog'
import { AccountPanel } from '@/features/AccountPanel'
import { GuideTracker } from '@/features/Guide'
import { ChunkInspectDialog } from '@/features/ChunkInspectDialog'
import { Alert } from '@/features/common'

const PART_VIEWS: Record<Part, () => React.ReactElement> = {
  case: CasePart,
  data: DataPart,
  vectors: VectorsPart,
  generator: GeneratorPart,
  benchmark: BenchmarkPart,
}

export default function App() {
  const status = useStore((s) => s.auth.status)
  const ready = useStore((s) => s.storage.ready)
  const storage = useStore((s) => s.storage)
  const part = useStore((s) => s.ui.part)
  const [narrowNoticeOpen, setNarrowNoticeOpen] = useState(true)
  const lang = useLang()
  const tx = useT().shell.app

  // index.html ships lang="pl"; keep the attribute in step with a stored or switched language.
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  if (!ready) return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{tx.opening}</div>

  const Current = PART_VIEWS[part]

  return (
    <TooltipProvider>
      {status === 'locked' ? (
        <ActivationScreen />
      ) : (
        <div className="flex h-full flex-col">
          <Header />
          {storage.error && <Alert tone="danger" className="m-2">{tx.storageError(storage.error)}</Alert>}
          {!storage.persistent && !storage.error && (
            <div className="edu-block flex items-start gap-2 bg-primary px-4 py-1.5 text-[12.5px] font-medium text-primary-foreground" role="status">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0 flex-1">{tx.notPersistent}</span>
            </div>
          )}
          {narrowNoticeOpen && (
            <div className="edu-block flex items-start gap-2 bg-doc px-4 py-2 text-[12.5px] text-white lg:hidden" role="note" data-testid="narrow-notice">
              <Monitor className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 flex-1">{tx.narrowNotice}</span>
              <button onClick={() => setNarrowNoticeOpen(false)} aria-label={tx.dismiss} className="cursor-pointer rounded-full p-0.5 text-white transition-colors hover:bg-foreground"><X className="size-4" /></button>
            </div>
          )}
          <PartsBar />
          <main className="scroll-thin min-h-0 flex-1 overflow-y-auto bg-background" data-part-scroll>
            <Current />
          </main>
          <DocumentDialog />
          <ChunkInspectDialog />
          <LearnDialog />
          <AccountPanel />
          <GuideTracker />
        </div>
      )}
    </TooltipProvider>
  )
}
