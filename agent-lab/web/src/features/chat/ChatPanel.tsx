/**
 * Right panel: the customer chat, styled as the Northstar Appliances support
 * widget. The learner plays the signed-in customer; the agent's replies, its live
 * tool steps, the ticket confirmation card and run notices come from the store.
 */
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ListChecks, MessagesSquare } from 'lucide-react'
import type { ChatItem } from '@/agent/types'
import type { Customer, Product } from '@/data/company/types'
import { SCENARIOS, type Scenario } from '@/data/scenarios'
import { useLang, useT } from '@/i18n'
import { cancelRun, retryKbIndex, sendMessage, setActiveCustomer, showActivation, startNewConversation } from '@/state/actions'
import { getState, useStore } from '@/state/store'
import { useTable } from '@/sim/db'
import { IconBadge } from '../common'
import { ChatHeader, type AgentStatus } from './ChatHeader'
import { Composer, type BlockReason } from './Composer'
import { ConfirmationCard } from './ConfirmationCard'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AgentBubble, AgentRow, CustomerBubble, Escalation, NoticeItem, RunSteps, TypingIndicator, noticeContent } from './Messages'
import { draftKeepsScenario, runView, type RunView } from './model'
import { ScenarioList } from './Scenarios'
import { useShowHandler } from '../learn/bus'

const EMPTY_VIEW: RunView = { steps: [], sources: [], ticketId: null, handover: false, endReason: null }

export function ChatPanel() {
  const tx = useT()
  const lang = useLang()
  const conversation = useStore((s) => s.conversation)
  const runs = useStore((s) => s.runs)
  const currentRun = useStore((s) => s.currentRun)
  const pending = useStore((s) => s.pendingConfirmation)
  const authStatus = useStore((s) => s.auth.status)
  const maxChars = useStore((s) => s.auth.session?.capabilities.agent.maxMessageChars ?? 1000)
  const ready = useStore((s) => s.ready)
  const storage = useStore((s) => s.storage)
  const kb = useStore((s) => s.kbIndex)
  const activeCustomerId = useStore((s) => s.activeCustomerId)
  const customerRows = useTable<Customer>('customers')
  const products = useTable<Product>('products')
  const customers = useMemo(() => [...customerRows].sort((a, b) => a.id.localeCompare(b.id)), [customerRows])

  const [draft, setDraft] = useState('')
  const [scenarioId, setScenarioId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ---- derived run views (sources, steps, escalation) from the run records
  const views = useMemo(() => {
    const m = new Map<string, RunView>()
    for (const r of runs) m.set(r.id, runView(r))
    return m
  }, [runs])
  const viewOf = (runId: string) => views.get(runId) ?? EMPTY_VIEW

  // ---- why the composer cannot send now
  const active = authStatus === 'active'
  const block: BlockReason | null = !active
    ? { kind: 'inactive' }
    : storage === 'unavailable'
      ? { kind: 'storage' }
    : !ready
      ? { kind: 'loading' }
      : currentRun && pending
        ? { kind: 'awaiting' }
        : currentRun
          ? { kind: 'running' }
          : kb.status === 'checking'
            ? { kind: 'kbChecking' }
            : kb.status === 'indexing'
              ? { kind: 'kbIndexing', done: kb.done, total: kb.total }
              : kb.status === 'error'
                ? { kind: 'kbFailed' }
                : null
  const status: AgentStatus = !active ? 'offline' : pending ? 'waiting' : currentRun ? 'working' : 'online'

  // ---- scenario: the message is filled in, the learner sends it
  const scenario = scenarioId ? SCENARIOS.find((s) => s.id === scenarioId) : undefined
  useEffect(() => {
    if (scenario && scenario.customerId !== activeCustomerId) setScenarioId(null)
  }, [scenario, activeCustomerId])
  const prevLang = useRef(lang)
  useEffect(() => {
    if (prevLang.current === lang) return
    const before = prevLang.current
    prevLang.current = lang
    if (scenario && draft === scenario.message[before]) setDraft(scenario.message[lang])
  }, [lang, scenario, draft])

  const focusInput = () => requestAnimationFrame(() => inputRef.current?.focus())

  // A scenario ends the current conversation: ask first when there is one (as the identity selector does).
  const [confirmScenario, setConfirmScenario] = useState<Scenario | null>(null)
  const requestScenario = (s: Scenario) => {
    const st = getState()
    if (st.conversation.length > 0 || st.currentRun) setConfirmScenario(s)
    else void pickScenario(s)
  }

  const pickScenario = async (s: Scenario) => {
    setError(null)
    const st = getState()
    if (st.activeCustomerId !== s.customerId) await setActiveCustomer(s.customerId)
    else if (st.conversation.length > 0 || st.currentRun) startNewConversation()
    setDraft(s.message[lang])
    setScenarioId(s.id)
    focusInput()
  }

  // "Show me" from the Learn dialog: open a scenario the same way as its card does (asks first when a conversation exists).
  useShowHandler((target) => {
    if (target.kind !== 'scenario') return
    const s = SCENARIOS.find((x) => x.id === target.id)
    if (s) requestScenario(s)
  })

  // ---- scrolling: follow the newest item unless the user scrolled up
  const listRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const [showJump, setShowJump] = useState(false)
  const activeEvents = runs.find((r) => r.id === currentRun)?.events.length ?? 0
  const toBottom = useCallback(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
    stick.current = true
    setShowJump(false)
  }, [])
  const empty = conversation.length === 0 && !currentRun
  useLayoutEffect(() => {
    // The empty state (invitation and scenario cards) reads from the top.
    if (empty) {
      if (listRef.current) listRef.current.scrollTop = 0
      stick.current = true
      setShowJump(false)
    } else if (stick.current) toBottom()
    else setShowJump(true)
  }, [empty, conversation, activeEvents, currentRun, pending, toBottom])
  const keepPinned = useCallback(() => {
    if (stick.current) toBottom()
  }, [toBottom])
  const onScroll = () => {
    const el = listRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48
    stick.current = atBottom
    if (atBottom) setShowJump(false)
  }

  const send = () => {
    const text = draft.trim()
    if (!text || (block && block.kind !== 'kbFailed')) return
    stick.current = true
    setError(null)
    const sid = scenarioId ?? undefined
    setDraft('')
    setScenarioId(null)
    sendMessage(text, sid).catch((e: unknown) => {
      setError(e instanceof Error && e.message ? e.message : tx.chat.sendFailed)
      setDraft((d) => d || text)
    })
    inputRef.current?.focus()
  }

  // ---- screen reader announcements (polite): run started, approval asked, reply or notice
  const announcement = useAnnouncements(conversation, currentRun, (runId) => viewOf(runId).endReason)

  function renderItem(item: ChatItem) {
    switch (item.kind) {
      case 'customer':
        return (
          <>
            <CustomerBubble item={item} />
            <RunSteps runId={item.runId} steps={viewOf(item.runId).steps} active={currentRun === item.runId} onResize={keepPinned} />
          </>
        )
      case 'confirmation':
        return (
          <AgentRow>
            <ConfirmationCard
              item={item}
              live={pending?.runId === item.runId && pending.call.id === item.callId}
              customers={customers}
              products={products}
              onDecided={focusInput}
            />
          </AgentRow>
        )
      case 'agent':
        return <AgentBubble item={item} view={viewOf(item.runId)} />
      case 'notice': {
        const hasReply = conversation.some((i) => i.kind === 'agent' && i.runId === item.runId)
        const view = viewOf(item.runId)
        return (
          <>
            <NoticeItem item={item} reason={view.endReason} />
            {!hasReply && (view.ticketId || view.handover) && (
              <AgentRow>
                <Escalation view={view} standalone />
              </AgentRow>
            )}
          </>
        )
      }
    }
  }

  return (
    <section data-panel="chat" aria-label={tx.chat.widget.label} className="flex h-full min-h-0 flex-col bg-card">
      <ChatHeader status={status} customers={customers} onPickScenario={requestScenario} />
      <div className="relative min-h-0 flex-1">
        <div ref={listRef} onScroll={onScroll} className="scroll-thin @container h-full overflow-y-auto px-3 py-4" data-testid="chat-messages">
          {empty ? (
            <div data-testid="chat-empty">
              <div className="mb-4 flex items-start gap-3">
                <IconBadge tone="query"><MessagesSquare /></IconBadge>
                <div className="min-w-0">
                  <h2 className="font-display text-[17px] font-bold leading-tight">{tx.chat.empty.title}</h2>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--ink-2)]">{tx.chat.empty.body}</p>
                </div>
              </div>
              <ScenarioList customers={customers} onPick={requestScenario} />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {conversation.map((item) => (
                <Fragment key={item.id}>{renderItem(item)}</Fragment>
              ))}
              {currentRun && !pending && <TypingIndicator />}
            </div>
          )}
        </div>
        {showJump && !empty && (
          <button
            type="button"
            onClick={toBottom}
            className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-[12.5px] font-semibold text-background shadow-md"
            data-testid="jump-to-latest"
          >
            <ArrowDown className="size-3.5" aria-hidden="true" /> {tx.chat.messages.jumpToLatest}
          </button>
        )}
      </div>
      <div aria-live="polite" aria-atomic="true" className="sr-only" data-testid="chat-announcer">{announcement}</div>
      <Dialog open={confirmScenario !== null} onOpenChange={(o) => !o && setConfirmScenario(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmScenario ? tx.chat.scenarios.confirmTitle(confirmScenario.title[lang]) : ''}</DialogTitle>
            <DialogDescription>
              {confirmScenario ? tx.chat.scenarios.confirmBody(`${customers.find((c) => c.id === confirmScenario.customerId)?.name ?? confirmScenario.customerId}, ${confirmScenario.customerId}`) : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2 border-t border-dashed px-5 py-3">
            <Button variant="outline" onClick={() => setConfirmScenario(null)}>{tx.chat.scenarios.cancel}</Button>
            <Button
              onClick={() => {
                const s = confirmScenario
                setConfirmScenario(null)
                if (s) void pickScenario(s)
              }}
              data-testid="confirm-scenario"
            >
              <ListChecks /> {tx.chat.scenarios.confirm}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Composer
        ref={inputRef}
        value={draft}
        onChange={(v) => {
          setDraft(v)
          if (!draftKeepsScenario(v, scenario?.message[lang])) setScenarioId(null)
        }}
        onSend={send}
        onStop={() => {
          cancelRun()
          inputRef.current?.focus()
        }}
        onActivate={showActivation}
        onRetryKb={() => void retryKbIndex()}
        block={block}
        running={currentRun !== null}
        max={maxChars}
        error={error}
      />
    </section>
  )
}

/**
 * One polite announcement at a time: "working" when a run starts, "asks for
 * approval" when a card appears, then the reply or the notice text. Items that
 * were already there when the panel mounted (a restored conversation) are not read.
 */
function useAnnouncements(conversation: ChatItem[], currentRun: string | null, reasonOf: (runId: string) => string | null): string {
  const tx = useT()
  const [text, setText] = useState('')
  const seen = useRef<Set<string> | null>(null)
  const lastRun = useRef<string | null>(currentRun)
  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(conversation.map((i) => i.id))
      return
    }
    const known = seen.current
    const fresh = conversation.filter((i) => !known.has(i.id))
    for (const i of fresh) known.add(i.id)
    const last = [...fresh].reverse().find((i) => i.kind !== 'customer')
    if (!last) return
    if (last.kind === 'agent') setText(tx.chat.announce.replied(last.text))
    else if (last.kind === 'notice') {
      const c = noticeContent(last, reasonOf(last.runId), tx)
      setText(`${c.title}. ${c.body}`)
    }
    else if (last.kind === 'confirmation' && last.state === 'pending') setText(tx.chat.announce.waiting)
  }, [conversation, tx])
  useEffect(() => {
    if (currentRun && currentRun !== lastRun.current) setText(tx.chat.announce.working)
    lastRun.current = currentRun
  }, [currentRun, tx])
  return text
}
