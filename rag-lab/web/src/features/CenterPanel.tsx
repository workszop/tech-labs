import { lazy, Suspense } from 'react'
import { Compass, FileSearch, Hammer, Loader2, Map, ThumbsUp, Workflow } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { setUi, useStore, type CenterTab } from '@/state/store'
import { useT } from '@/i18n'
import { Guide } from './Guide'
import { IndexBuilder } from './IndexBuilder'
import { RetrievalView } from './RetrievalView'
import { UserTesting } from './UserTesting'

const PipelineFlow = lazy(() => import('./PipelineFlow').then((m) => ({ default: m.PipelineFlow })))
const EmbeddingMap = lazy(() => import('./EmbeddingMap').then((m) => ({ default: m.EmbeddingMap })))

const Loading = () => (
  <div className="flex h-40 items-center justify-center text-muted-foreground">
    <Loader2 className="size-5 animate-spin" />
  </div>
)

// In a narrow centre panel (1024 px window, Polish labels) the tabs drop their icons and tighten, so all six fit.
const TAB = 'px-2 text-[12px] [&_svg]:hidden @[640px]:px-3 @[640px]:text-[13px] @[860px]:[&_svg]:block'

export function CenterPanel() {
  const tab = useStore((s) => s.ui.centerTab)
  const tx = useT().shell.centerTabs
  return (
    <Tabs value={tab} onValueChange={(v) => setUi({ centerTab: v as CenterTab })} className="flex h-full min-h-0 flex-col">
      <div className="scroll-thin @container flex shrink-0 items-center overflow-x-auto border-b bg-card px-3 py-2">
        <TabsList>
          <TabsTrigger value="guide" className={TAB}><Compass /> {tx.guide}</TabsTrigger>
          <TabsTrigger value="usertest" data-testid="tab-usertest" className={TAB}><ThumbsUp /> {tx.usertest}</TabsTrigger>
          <TabsTrigger value="pipeline" className={TAB}><Workflow /> {tx.pipeline}</TabsTrigger>
          <TabsTrigger value="build" data-testid="tab-build" className={TAB}><Hammer /> {tx.build}</TabsTrigger>
          <TabsTrigger value="map" data-testid="tab-map" className={TAB}><Map /> {tx.map}</TabsTrigger>
          <TabsTrigger value="retrieval" data-testid="tab-retrieval" className={TAB}><FileSearch /> {tx.retrieval}</TabsTrigger>
        </TabsList>
      </div>
      <div className="min-h-0 flex-1 bg-background">
        <TabsContent value="guide" className="scroll-thin h-full overflow-y-auto"><Guide /></TabsContent>
        <TabsContent value="usertest" className="scroll-thin h-full overflow-y-auto"><UserTesting /></TabsContent>
        <TabsContent value="pipeline" className="h-full"><Suspense fallback={<Loading />}><PipelineFlow /></Suspense></TabsContent>
        <TabsContent value="build" className="scroll-thin h-full overflow-y-auto"><IndexBuilder /></TabsContent>
        <TabsContent value="map" className="h-full"><Suspense fallback={<Loading />}><EmbeddingMap /></Suspense></TabsContent>
        <TabsContent value="retrieval" className="scroll-thin h-full overflow-y-auto"><RetrievalView /></TabsContent>
      </div>
    </Tabs>
  )
}
