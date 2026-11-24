/**
 * Offline demo model for POST /api/agent: a deterministic, rule-based stand-in
 * for a tool-calling LLM, so the lab runs without an API key.
 *
 * Each turn it reads the customer's latest message (keyword rules in Polish and
 * English) and the tool results already in the transcript (JSON, the shapes of
 * `toolResultForModel` in web/src/sim/tools.ts), then either requests the next
 * sensible tools or writes a final answer assembled from those results.
 *
 * Rules it never breaks:
 * - only tools from the list it was given, at most 3 per turn;
 * - never a call whose identical arguments already have a result (so an error
 *   result such as forbidden or rejected_by_user is not retried);
 * - more than one matching appliance: it asks which one instead of guessing;
 * - it says a ticket exists only when create_service_ticket returned it.
 *
 * This file is the only place in the project where keyword rules are allowed.
 */
import { type AgentMessage, type Lang, estimateTokens } from '../../../shared/api-types'
import { TOOL_NAMES, type ToolDef, type ToolName } from '../../../shared/tools'
import type { ChatOptions, ToolChatResult, UpstreamToolCall } from './types'

const MAX_CALLS_PER_TURN = 3

type Json = Record<string, unknown>

/** A tool call of the transcript and its result. */
interface Done {
  name: string
  args: Json
  key: string
  ok: boolean
  data: unknown
  error: { code: string; message: string } | null
  /** Answered after the customer's latest message (part of the current run). */
  inRun: boolean
}

interface Unit {
  serial: string
  productId: string
  model: string | null
  orderId: string | null
  date: string | null
}

interface Intents {
  text: string
  warranty: boolean
  fault: boolean
  repeated: boolean
  complaint: boolean
  delivery: boolean
  repair: boolean
  errorCode: string | null
  families: string[]
  orderIds: string[]
  caseIds: string[]
  shipmentIds: string[]
}

interface Planned {
  name: ToolName
  args: Json
  key: string
}

interface Plan {
  calls: Planned[]
  /** Tools the rules wanted but that are not in the tool list. */
  missing: Set<ToolName>
  /** More than one appliance matches: ask which one. */
  ambiguous: Unit[] | null
  /** The appliance the request is about, once known. */
  unit: Unit | null
  /** The orders were read but no appliance matches the request. */
  noMatch: boolean
}

// ---------------------------------------------------------------- keyword rules (pl + en)

const RX = {
  warranty: /warrant|guarantee|\bcovered\b|\bcover(?:s|ed)?\b|gwaranc|obejmuje|objęt/,
  fault:
    /\berror\b|błąd|błęd|\bblad|\bbled|\bfault|usterk|not work|doesn'?t work|won'?t|will not|nie działa|nie dziala|broken|zepsu|leak(?!guard)|ciek|switch\w* (?:itself )?off|wyłącza|overheat|very hot|nagrzewa|battery|akumulator|sensor|czujnik(?! zalania)|stopped|przestał|noise|hałas/,
  repeated: /\bagain\b|third time|second time|once more|keeps? (?:on )?\w+ing|znowu|ponownie|kolejny raz|trzeci raz|drugi raz|po raz (?:drugi|trzeci|kolejny)/,
  complaint:
    /complain|complaint|reklamac|skarg|nobody (?:called|contacted|got back)|no one (?:called|contacted)|nikt\b[^.?!]{0,20}(?:oddzwoni|odezwa|kontakt)|service cent|w (?:waszym )?serwisie|overdue|firm date|konkretn\w* termin|unacceptable|niedopuszczaln/,
  delivery:
    /where is (?:it|my)|deliver|shipment|parcel|tracking|\barriv|replacement part|spare part|dostaw|dostarcz|dotrze|dotarł|przesyłk|paczk|kurier|wysła|gdzie jest|część zamienn|czesc zamienn/,
  repair:
    /\b(?:book|arrange|schedule|organi[sz]e|request|send)\b[^.?!]{0,40}\b(?:repair|service|technician|engineer|visit)|\b(?:need|want|would like)\b[^.?!]{0,20}\brepair\b|\brepair (?:it|please)\b|\bticket\b|(?:umów|umówić|zorganiz\w*|zgłoś|zgłosić|załóż|założyć|proszę o)[^.?!]{0,40}(?:napraw|serwis|zgłoszeni)|(?:chcę|potrzebuję) napraw|zgłoszenie serwisowe/,
  errorCode: /(?:error|błąd|błędu|kod|code|shows|pokazuje|wyświetla)\s+(?:code\s+|kod\s+)?([A-Z]{1,2}\d{1,2})\b/i,
}

/** Product family (prefix of the product ID) by keyword. */
const FAMILIES: [string, RegExp][] = [
  ['PRD-COFFEE-', /coffee|espresso|barista|ekspres|\bkaw[aęy]\b/],
  ['PRD-VAC-', /vacuum|hoover|odkurzacz|aeroclean|roboclean|canistermax|robot\w* sprząt/],
  ['PRD-AIR-', /purifier|oczyszczacz|pureair|breezepure/],
  ['PRD-KITCHEN-', /\boven\b|piekarnik|fryer|frytkownic|aircrisp|mixer|chefmix|blender|quickblend|toaster|toster|toastline|\bhob\b|płyt\w* indukcyjn|inductacook|steamchef/],
  ['PRD-SMART-', /home hub|\bhub\b|smart ?plug|gniazdk|thermostat|termostat|climasense|leakguard|czujnik zalania|leak sensor/],
]

function analyze(text: string): Intents {
  const t = text.toLowerCase()
  const code = RX.errorCode.exec(text)?.[1]?.toUpperCase() ?? null
  return {
    text,
    warranty: RX.warranty.test(t),
    fault: RX.fault.test(t) || code !== null,
    repeated: RX.repeated.test(t),
    complaint: RX.complaint.test(t),
    delivery: RX.delivery.test(t),
    repair: RX.repair.test(t),
    errorCode: code,
    families: FAMILIES.filter(([, rx]) => rx.test(t)).map(([prefix]) => prefix),
    orderIds: unique(text.toUpperCase().match(/\bORD-\d{4}-\d{4}\b/g)),
    caseIds: unique(text.toUpperCase().match(/\bCASE-\d{4}-\d{3}\b/g)),
    shipmentIds: unique(text.toUpperCase().match(/\bSHIP-\d{4}-\d{3}\b/g)),
  }
}

function unique(xs: string[] | null): string[] {
  return [...new Set(xs ?? [])]
}

// ---------------------------------------------------------------- transcript

function callKey(name: string, args: Json): string {
  const sorted = Object.keys(args)
    .sort()
    .map((k) => [k, typeof args[k] === 'string' ? (args[k] as string).trim() : args[k]])
  return `${name}:${JSON.stringify(sorted)}`
}

function asObject(v: unknown): Json | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null
}

function lastUserIndex(messages: AgentMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i]!.role === 'user') return i
  return -1
}

/** Pairs every tool message with the call it answers and parses its JSON content. */
function readResults(messages: AgentMessage[]): Done[] {
  const lastUser = lastUserIndex(messages)
  const calls = new Map<string, { name: string; args: Json }>()
  const out: Done[] = []
  messages.forEach((m, i) => {
    if (m.role === 'assistant') for (const c of m.toolCalls ?? []) calls.set(c.id, { name: c.name, args: c.arguments ?? {} })
    if (m.role !== 'tool') return
    const call = calls.get(m.toolCallId) ?? { name: m.name, args: {} }
    let parsed: unknown = null
    try {
      parsed = JSON.parse(m.content)
    } catch {
      parsed = null
    }
    const err = asObject(asObject(parsed)?.error)
    const error = err && typeof err.code === 'string' ? { code: err.code, message: typeof err.message === 'string' ? err.message : '' } : null
    out.push({ name: call.name, args: call.args, key: callKey(call.name, call.args), ok: !error, data: error ? null : parsed, error, inRun: i > lastUser })
  })
  return out
}

/**
 * The request the agent works on: the customer's latest message, joined with
 * the message before it when the agent's last answer was a question (the
 * customer is answering a clarifying question).
 */
function requestText(messages: AgentMessage[]): string {
  const i = lastUserIndex(messages)
  if (i < 0) return ''
  const latest = (messages[i] as { content: string }).content
  const prev = messages[i - 1]
  if (prev?.role === 'assistant' && !prev.toolCalls?.length && /\?\s*$/.test(prev.content.trim())) {
    for (let j = i - 2; j >= 0; j--) {
      const m = messages[j]!
      if (m.role === 'user') return `${m.content}\n${latest}`
    }
  }
  return latest
}

/** Appliances (items with a serial number) the customer owns, from a get_customer_orders result. */
function unitsFromOrders(data: unknown): Unit[] {
  const d = asObject(data)
  const units: Unit[] = []
  for (const o of Array.isArray(d?.orders) ? d.orders : []) {
    const order = asObject(o)
    for (const it of Array.isArray(order?.items) ? order.items : []) {
      const item = asObject(it)
      const serial = str(item?.serial_number)
      const productId = str(item?.product_id)
      // A note marks a unit handed over to another owner.
      if (!serial || !productId || item?.note) continue
      units.push({ serial, productId, model: str(item?.model), orderId: str(order?.order_id), date: str(order?.date) })
    }
  }
  for (const u of Array.isArray(d?.transferred_units) ? d.transferred_units : []) {
    const item = asObject(u)
    const serial = str(item?.serial_number)
    const productId = str(item?.product_id)
    if (serial && productId) units.push({ serial, productId, model: str(item?.model), orderId: null, date: str(item?.transferred_on) })
  }
  return units
}

function modelKey(model: string): string {
  return model.toLowerCase().replace(/^northstar\s+/, '')
}

/** One unit, several (ask), or none. Model names win over product families. */
function pickUnit(intents: Intents, units: Unit[]): { unit: Unit | null; ambiguous: Unit[] | null } {
  const t = intents.text.toLowerCase()
  const byModel = units.filter((u) => u.model && t.includes(modelKey(u.model)))
  const candidates = byModel.length
    ? byModel
    : intents.families.length
      ? units.filter((u) => intents.families.some((f) => u.productId.startsWith(f)))
      : units
  if (candidates.length === 1) return { unit: candidates[0]!, ambiguous: null }
  if (candidates.length > 1) return { unit: null, ambiguous: candidates }
  return { unit: null, ambiguous: null }
}

// ---------------------------------------------------------------- planning

function plan(intents: Intents, done: Done[], customerId: string, available: Set<string>): Plan {
  const result: Plan = { calls: [], missing: new Set(), ambiguous: null, unit: null, noMatch: false }
  const doneKeys = new Set(done.map((d) => d.key))
  // Calls the Worker rejected come back with `arguments: {}`, so their key never matches a
  // planned call: a tool that got such an error in this run is not requested again.
  const rejectedNames = new Set(done.filter((d) => d.inRun && !d.ok && !Object.keys(d.args).length).map((d) => d.name))
  const find = (name: ToolName, args: Json) => {
    const key = callKey(name, args)
    for (let i = done.length - 1; i >= 0; i--) if (done[i]!.key === key) return done[i]!
    return null
  }
  const add = (name: ToolName, args: Json): void => {
    const key = callKey(name, args)
    if (doneKeys.has(key) || rejectedNames.has(name) || result.calls.some((c) => c.key === key)) return
    if (!available.has(name)) {
      result.missing.add(name)
      return
    }
    if (result.calls.length < MAX_CALLS_PER_TURN) result.calls.push({ name, args, key })
  }
  const me = { customer_id: customerId }

  // 1. Records the customer named explicitly.
  for (const id of intents.orderIds) add('get_shipments', { order_id: id })
  for (const id of intents.caseIds) add('get_service_case', { case_id: id })
  for (const id of intents.shipmentIds) add('track_shipment', { shipment_id: id })

  // 2. Delivery questions: find the shipment, then track the one still on its way.
  if (intents.delivery && !intents.orderIds.length && !intents.shipmentIds.length) {
    const r = find('get_shipments', me)
    if (!r) add('get_shipments', me)
    else if (r.ok) {
      const rows = (asObject(r.data)?.shipments as unknown[] | undefined) ?? []
      const list = rows.map(asObject).filter((s): s is Json => !!s && !!str(s.shipment_id))
      const pick = list.find((s) => s.status !== 'delivered' && s.status !== 'returned') ?? list[0]
      if (pick) add('track_shipment', { shipment_id: pick.shipment_id as string })
    }
  }

  // 3. Questions about one appliance: orders first, then warranty and knowledge.
  const named = intents.orderIds.length > 0 || intents.caseIds.length > 0
  const needsUnit =
    !named &&
    (intents.warranty || intents.repair || intents.repeated || (intents.fault && intents.families.length > 0 && !intents.complaint))
  let knowledgeWithModel = false
  if (needsUnit) {
    const r = find('get_customer_orders', me)
    if (!r) add('get_customer_orders', me)
    else if (r.ok) {
      const { unit, ambiguous } = pickUnit(intents, unitsFromOrders(r.data))
      if (ambiguous) return { ...result, calls: [], ambiguous }
      result.unit = unit
      result.noMatch = !unit
      if (unit) {
        if (intents.warranty || intents.fault || intents.repair || intents.repeated) {
          add('check_warranty', { customer_id: customerId, serial_number: unit.serial })
        }
        if (intents.fault && !intents.repeated) {
          knowledgeWithModel = true
          add('search_service_knowledge', knowledgeArgs(intents, unit.model))
        }
      }
    }
  }
  const unitPending = needsUnit && !result.unit && !result.noMatch && available.has('get_customer_orders') && !find('get_customer_orders', me)?.error
  if (intents.fault && !intents.repeated && !knowledgeWithModel && !unitPending) {
    add('search_service_knowledge', knowledgeArgs(intents, null))
  }

  // 4. Complaints and repeated faults: the CRM history, then the case it points to.
  if (intents.complaint || intents.repeated) {
    const r = find('get_crm_history', me)
    if (!r) add('get_crm_history', me)
    else if (r.ok) {
      const rows = ((asObject(r.data)?.interactions as unknown[] | undefined) ?? []).map(asObject).filter((x): x is Json => !!x)
      const withCase = rows.filter((x) => str(x.case_id))
      const pick = withCase.find((x) => x.type === 'complaint') ?? withCase[0]
      if (pick && !intents.caseIds.length) add('get_service_case', { case_id: pick.case_id as string })
    }
  }

  // 5. A ticket, alone in its turn, once everything else is known and the warranty was checked.
  const ticketTried = done.some((d) => d.inRun && d.name === 'create_service_ticket')
  if ((intents.repair || intents.repeated) && result.unit && !result.calls.length && !ticketTried) {
    const warrantyKnown =
      !!find('check_warranty', { customer_id: customerId, serial_number: result.unit.serial }) || !available.has('check_warranty')
    if (warrantyKnown) {
      add('create_service_ticket', {
        customer_id: customerId,
        product_id: result.unit.productId,
        issue_description: intents.text.replace(/\s+/g, ' ').trim().slice(0, 500),
        priority: intents.repeated ? 'high' : 'normal',
      })
    }
  }

  // 6. Nothing recognised but a product named: look at the orders.
  const anyIntent = intents.warranty || intents.fault || intents.complaint || intents.delivery || intents.repair || intents.repeated || named
  if (!anyIntent && intents.families.length && !done.some((d) => d.inRun)) add('get_customer_orders', me)

  return result
}

function knowledgeArgs(intents: Intents, model: string | null): Json {
  return {
    query: intents.text.replace(/\s+/g, ' ').trim().slice(0, 300),
    ...(model ? { product_model: model } : {}),
    ...(intents.errorCode ? { error_code: intents.errorCode } : {}),
  }
}

// ---------------------------------------------------------------- the final answer

const T = {
  en: {
    intro: 'I am the offline demo model of Service Agent Lab: this answer is put together by fixed rules from the tool results.',
    unit: (u: Unit) =>
      `Your orders show the ${u.model ?? u.productId} with serial number ${u.serial}${u.orderId ? ` (order ${u.orderId}${u.date ? ` of ${u.date}` : ''})` : ''}.`,
    clarify: (list: string) => `I can see more than one matching appliance on your account: ${list}. Which one do you mean?`,
    noMatch: 'I could not find an appliance in your orders that matches your request.',
    noOrders: 'Your account has no orders I could use.',
    warranty: {
      active: (id: string, end: string, days: number) => `Warranty ${id} is active until ${end} (${days} days left), so the repair is covered.`,
      expired: (id: string, end: string) => `Warranty ${id} expired on ${end}, so a repair would be paid.`,
      void: (id: string, reason: string) => `Warranty ${id} is void: ${reason}`,
    },
    soon: 'The warranty ends soon, so please contact service before that date.',
    kb: (title: string, text: string) => `From "${title}": ${text}`,
    superseded: (title: string) => `I did not rely on "${title}" because a newer document replaced it.`,
    kbTitle: (title: string) => `The service document "${title}" matches your question.`,
    kbEmpty: 'The service knowledge base had no matching passage.',
    shipments: (n: number) => (n ? `I found ${n} shipment${n === 1 ? '' : 's'} on your account.` : 'I found no shipments for your account.'),
    shipmentRow: (s: Json) =>
      `Shipment ${s.shipment_id} (${s.contents ?? s.type}) is ${statusText('en', s.status)}${s.delivered_date ? `, delivered on ${s.delivered_date}` : s.estimated_delivery ? `, estimated delivery ${s.estimated_delivery}` : ''}.`,
    lastEvent: (at: string, where: string, what: string) => `Last tracking event: ${at}, ${where}: ${what}`,
    crm: (n: number, date: string | null) => (n ? `Your service history has ${n} contact${n === 1 ? '' : 's'}, the latest on ${date}.` : 'Your service history is empty.'),
    earlier: (ids: string) => `Earlier service cases for this problem: ${ids}.`,
    case: (c: Json) =>
      `Service case ${c.case_id} (${c.model ?? c.product_id}) is ${statusText('en', c.status)}${c.promised_date ? `; the promised date was ${c.promised_date}` : ''}.`,
    overdue: 'That date has passed, and I am sorry for the delay. I cannot promise a new date myself, so I am passing your complaint to our customer service team, who will contact you.',
    ticket: (id: string, prio: string) => `Service ticket ${id} was created with ${prio} priority. Our service team will contact you about it.`,
    ticketRejected: 'You did not approve the service ticket, so nothing was created.',
    escalate: 'Because the same fault keeps coming back, I recommend a human specialist looks at it.',
    forbidden: (what: string) => `I cannot access ${what}: the system refused it because it is not linked to your account, so I cannot share any details about it.`,
    notFound: (what: string) => `The system could not find ${what}.`,
    disabled: (tool: string) => `The tool ${tool} is not available in this session, so I could not use it.`,
    notReady: 'The service knowledge base is not ready (it has not been indexed for this language and model yet), so I could not search the service documents.',
    duplicate: (tool: string) => `A repeated ${tool} call was blocked, so I used the results I already had.`,
    failed: (tool: string) => `The ${tool} call did not work, so I could not use it.`,
    missing: (tools: string) => `I do not have the tools ${tools} in this session, so I could not check everything.`,
    limit: 'I reached the limit of this request before finishing all checks, so this answer may be incomplete.',
    nothing: 'Could you tell me a bit more, for example which appliance or order this is about? I can also pass you to our customer service team.',
    human: 'If you prefer, our customer service team can take over.',
    record: { get_shipments: 'that order', get_service_case: 'that service case', track_shipment: 'that shipment', check_warranty: 'that unit', other: 'that record' },
  },
  pl: {
    intro: 'Jestem demonstracyjnym modelem offline Service Agent Lab: tę odpowiedź składają stałe reguły z wyników narzędzi.',
    unit: (u: Unit) =>
      `W Twoich zamówieniach jest ${u.model ?? u.productId} o numerze seryjnym ${u.serial}${u.orderId ? ` (zamówienie ${u.orderId}${u.date ? ` z ${u.date}` : ''})` : ''}.`,
    clarify: (list: string) => `Na Twoim koncie widzę więcej niż jedno pasujące urządzenie: ${list}. O które chodzi?`,
    noMatch: 'W Twoich zamówieniach nie znalazłem urządzenia, którego dotyczy pytanie.',
    noOrders: 'Na Twoim koncie nie ma zamówień, z których mógłbym skorzystać.',
    warranty: {
      active: (id: string, end: string, days: number) => `Gwarancja ${id} jest ważna do ${end} (zostało ${days} dni), więc naprawa jest nią objęta.`,
      expired: (id: string, end: string) => `Gwarancja ${id} wygasła ${end}, więc naprawa byłaby odpłatna.`,
      void: (id: string, reason: string) => `Gwarancja ${id} jest nieważna: ${reason}`,
    },
    soon: 'Gwarancja niedługo się kończy, więc warto zgłosić się do serwisu przed tą datą.',
    kb: (title: string, text: string) => `Według dokumentu „${title}”: ${text}`,
    superseded: (title: string) => `Nie opieram się na dokumencie „${title}”, bo zastąpił go nowszy.`,
    kbTitle: (title: string) => `Pasuje do tego dokument serwisowy „${title}”.`,
    kbEmpty: 'W bazie wiedzy serwisowej nie znalazłem pasującego fragmentu.',
    shipments: (n: number) => (n ? `Na Twoim koncie znalazłem przesyłki: ${n}.` : 'Na Twoim koncie nie znalazłem żadnych przesyłek.'),
    shipmentRow: (s: Json) =>
      `Przesyłka ${s.shipment_id} (${s.contents ?? s.type}) jest ${statusText('pl', s.status)}${s.delivered_date ? `, doręczona ${s.delivered_date}` : s.estimated_delivery ? `, przewidywana dostawa ${s.estimated_delivery}` : ''}.`,
    lastEvent: (at: string, where: string, what: string) => `Ostatnie zdarzenie: ${at}, ${where}: ${what}`,
    crm: (n: number, date: string | null) => (n ? `W historii obsługi masz kontakty: ${n}, ostatni ${date}.` : 'Historia obsługi jest pusta.'),
    earlier: (ids: string) => `Wcześniejsze sprawy serwisowe z tym problemem: ${ids}.`,
    case: (c: Json) =>
      `Sprawa serwisowa ${c.case_id} (${c.model ?? c.product_id}) ma status: ${statusText('pl', c.status)}${c.promised_date ? `; obiecany termin to ${c.promised_date}` : ''}.`,
    overdue: 'Ten termin minął i bardzo przepraszam za opóźnienie. Sam nie mogę obiecać nowej daty, dlatego przekazuję reklamację zespołowi obsługi klienta, który się z Tobą skontaktuje.',
    ticket: (id: string, prio: string) => `Zgłoszenie serwisowe ${id} zostało utworzone z priorytetem ${prio}. Zespół serwisu skontaktuje się z Tobą w tej sprawie.`,
    ticketRejected: 'Zgłoszenie serwisowe nie zostało zatwierdzone, więc nic nie zostało utworzone.',
    escalate: 'Ta sama usterka wraca, więc proponuję, żeby zajął się nią specjalista z zespołu obsługi.',
    forbidden: (what: string) => `Nie mam dostępu do ${what}: system odmówił dostępu, bo ten rekord nie należy do Twojego konta, więc nie mogę podać żadnych szczegółów.`,
    notFound: (what: string) => `System nie znalazł ${what}.`,
    disabled: (tool: string) => `Narzędzie ${tool} nie jest dostępne w tej sesji, więc nie mogłem z niego skorzystać.`,
    notReady: 'Baza wiedzy serwisowej nie jest gotowa (nie została jeszcze zindeksowana dla tego języka i modelu), więc nie mogłem przeszukać dokumentów serwisowych.',
    duplicate: (tool: string) => `Powtórne wywołanie ${tool} zostało zablokowane, więc skorzystałem z wyników, które już miałem.`,
    failed: (tool: string) => `Wywołanie ${tool} się nie powiodło, więc nie mogłem z niego skorzystać.`,
    missing: (tools: string) => `W tej sesji nie mam narzędzi ${tools}, więc nie mogłem sprawdzić wszystkiego.`,
    limit: 'Osiągnąłem limit tego zapytania, zanim sprawdziłem wszystko, więc odpowiedź może być niepełna.',
    nothing: 'Czy możesz napisać trochę więcej, na przykład którego urządzenia lub zamówienia to dotyczy? Mogę też przekazać sprawę zespołowi obsługi klienta.',
    human: 'Jeśli wolisz, sprawą może zająć się zespół obsługi klienta.',
    record: { get_shipments: 'tego zamówienia', get_service_case: 'tej sprawy serwisowej', track_shipment: 'tej przesyłki', check_warranty: 'tego urządzenia', other: 'tego rekordu' },
  },
}

const STATUS: Record<string, { en: string; pl: string }> = {
  delivered: { en: 'delivered', pl: 'doręczona' },
  in_transit: { en: 'in transit', pl: 'w drodze' },
  delayed: { en: 'delayed', pl: 'opóźniona' },
  awaiting_pickup: { en: 'waiting for pickup', pl: 'do odbioru' },
  returned: { en: 'returned', pl: 'zwrócona' },
  open: { en: 'open', pl: 'otwarta' },
  waiting_for_part: { en: 'waiting for a part', pl: 'czeka na część' },
  in_repair: { en: 'in repair', pl: 'w naprawie' },
  resolved: { en: 'resolved', pl: 'zamknięta' },
  escalated: { en: 'escalated', pl: 'przekazana wyżej' },
}
const PRIORITY: Record<string, string> = { low: 'niskim', normal: 'normalnym', high: 'wysokim', urgent: 'pilnym' }

function statusText(lang: Lang, s: unknown): string {
  return typeof s === 'string' ? (STATUS[s]?.[lang] ?? s) : '?'
}

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t
}

/** Model-specific documents and service bulletins beat general documents of the same search. */
const PREFERRED_AUTHORITY = new Set(['model_specific', 'service_bulletin'])

// Intended: a current model-specific or bulletin hit wins over a higher-ranked current general document.
/** The hit to quote: never a superseded one; a model-specific or bulletin hit first, else the best-ranked current hit. */
function topCurrentHit(hits: Json[]): Json | null {
  const current = hits.filter((h) => h.status !== 'superseded')
  return current.find((h) => PREFERRED_AUTHORITY.has(String(h.authority))) ?? current[0] ?? null
}

/** Longest quote; a first sentence longer than this is not quoted (it would have to be cut). */
const MAX_QUOTE_CHARS = 360

/**
 * Splits plain text into sentences, only where a sentence really ends: after
 * `.`, `!` or `?` (and closing quotes or brackets) followed by whitespace and a
 * word that does not start with a lowercase letter or a digit. A dot after a
 * short lowercase token (np., ok., e.g., itp.) is an abbreviation, not an end.
 * Dots inside numbers, versions and dates (3.5, v2.1, 14.11.2026) are never
 * followed by whitespace, so they never split. The trailing text without an
 * end mark is returned separately as `rest`.
 */
function splitSentences(text: string): { sentences: string[]; rest: string } {
  const sentences: string[] = []
  const boundary = /[.!?]["'”’)\]]*(?=\s+(\S))/g
  let from = 0
  let m: RegExpExecArray | null
  while ((m = boundary.exec(text))) {
    const end = m.index + m[0].length
    const next = text.slice(end).trimStart()
    if (/^[\p{Ll}\d]/u.test(next)) continue
    if (text[m.index] === '.' && /(?:^|[\s(„"])[\p{Ll}]{1,3}(?:\.[\p{Ll}]{1,3})*$/u.test(text.slice(from, m.index))) continue
    sentences.push(text.slice(from, end).trim())
    from = end
  }
  const tail = text.slice(from).trim()
  if (/[.!?]["'”’)\]]*$/.test(tail)) return { sentences: [...sentences, tail], rest: '' }
  return { sentences, rest: tail }
}

/**
 * One or two whole sentences of a knowledge chunk, as plain text: markdown
 * headings are dropped, list markers and emphasis removed, and a list item
 * without an end mark becomes its own sentence. A chunk can start or end in the
 * middle of a sentence (chunk boundaries and overlap); such fragments are never
 * quoted. Returns '' when no whole sentence is left.
 */
export function quoteSentences(markdown: string): string {
  const lines = markdown
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .map((l) => {
      const item = /^\s*(?:[-*+]|\d+[.)])\s+/.test(l)
      const plain = l
        .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')
        .replace(/(\*\*|__|\*|`)/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      // A list item is complete in itself; a paragraph line without an end mark may be cut off.
      return item && plain && !/[.!?:;,]$/.test(plain) ? `${plain}.` : plain
    })
    .filter(Boolean)
  const { sentences } = splitSentences(lines.join(' '))
  // A first "sentence" that starts in lowercase is the end of a sentence cut off by the chunk boundary.
  const whole = sentences.filter((x, i) => i > 0 || /^[\p{Lu}\d„"'(]/u.test(x))
  if (!whole.length || whole[0]!.length > MAX_QUOTE_CHARS) return ''
  const two = whole.slice(0, 2).join(' ')
  return two.length <= MAX_QUOTE_CHARS ? two : whole[0]!
}

function errorLine(lang: Lang, d: Done): string {
  const t = T[lang]
  const id = Object.values(d.args).find((v) => typeof v === 'string' && /^(ORD|CASE|SHIP|PRD)-/.test(v)) as string | undefined
  const kind = t.record[d.name as keyof typeof t.record] ?? t.record.other
  const what = id ? `${kind} ${id}` : kind
  switch (d.error?.code) {
    case 'forbidden':
      return t.forbidden(what)
    case 'not_found':
      return t.notFound(what)
    case 'tool_disabled':
    case 'unknown_tool':
      return t.disabled(d.name)
    case 'index_not_ready':
      return t.notReady
    case 'duplicate_call':
      return t.duplicate(d.name)
    case 'rejected_by_user':
      return d.name === 'create_service_ticket' ? t.ticketRejected : t.failed(d.name)
    default:
      return t.failed(d.name)
  }
}

function answer(lang: Lang, intents: Intents, done: Done[], p: Plan, limitReached: boolean): string {
  const t = T[lang]
  const out: string[] = [t.intro]
  if (p.ambiguous) {
    const list = p.ambiguous
      .map((u) => `${u.model ?? u.productId} (${u.serial}${u.date ? `, ${u.date}` : ''})`)
      .join(lang === 'pl' ? ' oraz ' : ' and ')
    out.push(t.clarify(list))
    return out.join('\n\n')
  }
  if (p.unit) out.push(t.unit(p.unit))
  else if (p.noMatch) out.push(t.noMatch)

  const run = done.filter((d) => d.inRun)
  let useful = !!p.unit
  for (const d of run) {
    if (!d.ok) {
      out.push(errorLine(lang, d))
      continue
    }
    const data = asObject(d.data)
    switch (d.name) {
      case 'get_customer_orders':
        if (!unitsFromOrders(d.data).length && !(data?.orders as unknown[] | undefined)?.length) out.push(t.noOrders)
        break
      case 'check_warranty': {
        if (!data) break
        useful = true
        const id = String(data.warranty_id)
        if (data.status === 'active') {
          out.push(t.warranty.active(id, String(data.end_date), Number(data.days_remaining)))
          if (Number(data.days_remaining) <= 30) out.push(t.soon)
        } else if (data.status === 'void') {
          out.push(t.warranty.void(id, String(asObject(data.exclusion)?.reason ?? '')))
        } else out.push(t.warranty.expired(id, String(data.end_date)))
        break
      }
      case 'search_service_knowledge': {
        const hits = (Array.isArray(d.data) ? d.data : []).map(asObject).filter((h): h is Json => !!h)
        const top = topCurrentHit(hits)
        const quote = top ? quoteSentences(String(top.text ?? '')) : ''
        if (top && quote) out.push(t.kb(String(top.docTitle), quote))
        else if (top) out.push(t.kbTitle(String(top.docTitle)))
        else out.push(t.kbEmpty)
        for (const h of hits.filter((x) => x.status === 'superseded').slice(0, 1)) out.push(t.superseded(String(h.docTitle)))
        useful = useful || !!top
        break
      }
      case 'get_shipments': {
        const rows = ((data?.shipments as unknown[] | undefined) ?? []).map(asObject).filter((x): x is Json => !!x)
        useful = true
        const tracked = run.some((x) => x.ok && x.name === 'track_shipment')
        if (!tracked) {
          out.push(t.shipments(rows.length))
          for (const s of rows.slice(0, 3)) out.push(t.shipmentRow(s))
        }
        break
      }
      case 'track_shipment': {
        if (!data) break
        useful = true
        out.push(t.shipmentRow(data))
        const events = (data.events as unknown[] | undefined)?.map(asObject).filter((x): x is Json => !!x) ?? []
        const last = events[events.length - 1]
        if (last) out.push(t.lastEvent(String(last.at), String(last.location), String(last.description)))
        break
      }
      case 'get_crm_history': {
        const rows = ((data?.interactions as unknown[] | undefined) ?? []).map(asObject).filter((x): x is Json => !!x)
        useful = true
        out.push(t.crm(rows.length, str(rows[0]?.date)))
        if (intents.repeated) {
          const ids = unique(rows.filter((r) => r.type === 'service_request').map((r) => str(r.case_id)).filter((x): x is string => !!x))
          if (ids.length) out.push(t.earlier(ids.join(', ')))
        }
        break
      }
      case 'get_service_case': {
        if (!data) break
        useful = true
        out.push(t.case(data))
        if (data.promised_date_passed === true) out.push(t.overdue)
        break
      }
      case 'create_service_ticket': {
        if (!data) break
        useful = true
        const prio = String(data.priority)
        out.push(t.ticket(String(data.ticket_id), lang === 'pl' ? (PRIORITY[prio] ?? prio) : prio))
        break
      }
      default:
        useful = useful || !!d.data
    }
  }
  const ticketDone = run.some((d) => d.name === 'create_service_ticket')
  if (intents.repeated && !ticketDone) out.push(t.escalate)
  if (p.missing.size && !limitReached) out.push(t.missing([...p.missing].join(', ')))
  if (limitReached) out.push(t.limit)
  if (!useful && !run.length) out.push(t.nothing)
  else if (run.some((d) => !d.ok) || p.missing.size) out.push(t.human)
  return out.join('\n\n')
}

// ---------------------------------------------------------------- entry point

/**
 * One turn of the rule-based agent. `toolChoice: 'none'` means the Worker took
 * the tools away (run limit): the agent then answers with what it has and says
 * that the answer may be incomplete.
 */
export function mockAgentTurn(
  system: string,
  messages: AgentMessage[],
  tools: ToolDef[],
  opts: ChatOptions & { toolChoice: 'auto' | 'none' },
): ToolChatResult {
  const lang: Lang = opts.lang ?? (/^Jesteś/.test(system) ? 'pl' : 'en')
  // The customer ID is in the system prompt, as it is for a real model.
  const customerId = /\b(CUST-\d{4})\b/.exec(system)?.[1] ?? 'CUST-0000'
  const forced = opts.toolChoice === 'none'
  const available = new Set<string>(forced ? TOOL_NAMES : tools.map((t) => t.name))
  const intents = analyze(requestText(messages))
  const done = readResults(messages)
  const p = plan(intents, done, customerId, available)

  const inputTokens = estimateTokens(system) + estimateTokens(JSON.stringify(messages)) + estimateTokens(JSON.stringify(tools))
  if (!forced && p.calls.length && !p.ambiguous) {
    const turn = messages.filter((m) => m.role === 'assistant').length + 1
    const toolCalls: UpstreamToolCall[] = p.calls.map((c, i) => ({ id: `mock_${turn}_${i + 1}`, name: c.name, rawArguments: JSON.stringify(c.args) }))
    return {
      text: '',
      toolCalls,
      finishReason: 'tool_calls',
      usage: { inputTokens, outputTokens: estimateTokens(JSON.stringify(toolCalls)) },
    }
  }
  const limitReached = forced && p.calls.length > 0
  const text = answer(lang, intents, done, p, limitReached)
  return { text, toolCalls: [], finishReason: 'stop', usage: { inputTokens, outputTokens: estimateTokens(text) } }
}
