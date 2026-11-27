import { lazy, Suspense, useState } from 'react'
import { FileSearch, Loader2, Workflow } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useStore } from '@/state/store'
import { useT } from '@/i18n'
import { Guide } from '../Guide'
import { ChatPanel } from '../ChatPanel'
import { RetrievalView } from '../RetrievalView'

const PipelineFlow = lazy(() => import('../PipelineFlow').then((m) => ({ default: m.PipelineFlow })))
const Loading = () => (
  <div className="flex h-40 items-center justify-center text-muted-foreground">
    <Loader2 className="size-5 animate-spin" />
  </div>
)

type TechTab = 'retrieval' | 'pipeline'

/** Part 1. Students: the guide next to the chat. Tech: the chat next to retrieval details and the pipeline. */
export function CasePart() {
  const view = useStore((s) => s.settings.view)
  const tx = useT().shell.techTabs
  const [tab, setTab] = useState<TechTab>('retrieval')
  const chat = (
    <div className="h-[80vh] min-h-[28rem] border-t bg-card lg:h-full lg:min-h-0 lg:border-t-0">
      <ChatPanel />
    </div>
  )
  return (
    <div data-testid="part-case" data-view={view} className="lg:grid lg:h-full lg:min-h-0 lg:grid-cols-2">
      {view === 'students' ? (
        <>
          <div className="scroll-thin lg:min-h-0 lg:overflow-y-auto">
            <Guide />
          </div>
          <div className="lg:min-h-0 lg:border-l">{chat}</div>
        </>
      ) : (
        <>
          <div className="lg:min-h-0 lg:border-r">{chat}</div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as TechTab)} className="flex h-[80vh] min-h-[28rem] flex-col lg:h-full lg:min-h-0">
            <div className="scroll-thin flex shrink-0 items-center overflow-x-auto border-b bg-card px-3 py-2">
              <TabsList>
                <TabsTrigger value="retrieval" data-testid="tab-retrieval"><FileSearch /> {tx.retrieval}</TabsTrigger>
                <TabsTrigger value="pipeline" data-testid="tab-pipeline"><Workflow /> {tx.pipeline}</TabsTrigger>
              </TabsList>
            </div>
            <div className="min-h-0 flex-1 bg-background">
              <TabsContent value="retrieval" className="scroll-thin h-full overflow-y-auto"><RetrievalView /></TabsContent>
              <TabsContent value="pipeline" className="h-full"><Suspense fallback={<Loading />}><PipelineFlow /></Suspense></TabsContent>
            </div>
          </Tabs>
        </>
      )}
    </div>
  )
}
