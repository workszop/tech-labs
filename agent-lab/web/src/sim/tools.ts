/**
 * The ten tools the agent can call, executed in the browser against the
 * simulated company systems in IndexedDB (`simDb`, never the seed modules).
 *
 * Authorization lives here, in the tool, not in the prompt: every record is
 * checked against `ctx.customerId`, the customer selected in the app. A record
 * of another customer gives `forbidden` with a message that names none of its
 * fields; an unknown ID gives `not_found`.
 */
import type { Lang } from '@shared/api-types'
import { SIM_TODAY } from '@shared/sim'
import { isToolName, type ToolName } from '@shared/tools'
import type { KnowledgeHit } from '@/data/kb/types'
import type { Localized, Shipment, Ticket, Warranty } from '@/data/company/types'
import { simDb } from './db'
import { errorSummary, summarize, type RecordKind } from './summaries'

export type ToolErrorCode =
  | 'forbidden'
  | 'not_found'
  | 'invalid_arguments'
  | 'unknown_tool'
  | 'tool_disabled'
  | 'too_many_calls'
  | 'rejected_by_user'
  | 'duplicate_call'
  | 'index_not_ready'
  | 'failed'
  | 'not_executed' // engine-made: the call certainly did not run (cancel, reload before a decision, forced-final turn)
  | 'result_unknown' // engine-made: the call may have run but its result was not recorded (reload or cancel while it ran)

export type ToolResult =
  | { ok: true; data: unknown; summary: string }
  | { ok: false; error: { code: ToolErrorCode; message: string }; summary: string }

export interface ToolContext {
  customerId: string
  lang: Lang
  searchKnowledge: (a: { query: string; productModel?: string; errorCode?: string }) => Promise<KnowledgeHit[]>
}

const ERROR_CODES: readonly ToolErrorCode[] = [
  'forbidden', 'not_found', 'invalid_arguments', 'unknown_tool', 'tool_disabled', 'too_many_calls',
  'rejected_by_user', 'duplicate_call', 'index_not_ready', 'failed',
]

// ---------------------------------------------------------------- helpers

class ToolError extends Error {
  constructor(
    readonly code: ToolErrorCode,
    message: string,
    readonly summary: string,
  ) {
    super(message)
  }
}

const KIND_TEXT: Record<RecordKind, string> = {
  customer: 'customer',
  order: 'order',
  shipment: 'shipment',
  case: 'service case',
  serial: 'unit',
  product: 'product',
}

function forbidden(kind: RecordKind, lang: Lang): ToolError {
  const message =
    kind === 'customer'
      ? 'Access denied: tools return data only for the authenticated customer of this session. Records of other customers cannot be accessed.'
      : `Access denied: the requested ${KIND_TEXT[kind]} is not linked to the authenticated customer's account. Records of other customers cannot be accessed.`
  return new ToolError('forbidden', message, summarize.forbidden(lang, kind))
}

function notFound(kind: RecordKind, lang: Lang): ToolError {
  const message =
    kind === 'serial'
      ? 'Not found: no warranty is registered for this serial number. Check the serial number in the customer\'s orders.'
      : `Not found: no ${KIND_TEXT[kind]} with this ID exists.`
  return new ToolError('not_found', message, summarize.notFound(lang, kind))
}

function invalid(message: string, lang: Lang): ToolError {
  return new ToolError('invalid_arguments', message, errorSummary(lang, 'invalid_arguments'))
}

/** Reads an optional string argument; anything else than a string is an invalid argument. */
function optArg(args: Record<string, unknown>, key: string, lang: Lang): string | undefined {
  const v = args[key]
  if (v === undefined || v === null) return undefined
  if (typeof v !== 'string') throw invalid(`Argument "${key}" must be a string.`, lang)
  const t = v.trim()
  if (!t) throw invalid(`Argument "${key}" must not be empty.`, lang)
  return t
}

function reqArg(args: Record<string, unknown>, key: string, lang: Lang): string {
  const v = optArg(args, key, lang)
  if (v === undefined) throw invalid(`Missing required argument "${key}".`, lang)
  return v
}

/** customer_id must be the authenticated customer; anything else is refused without a lookup. */
function requireOwnCustomer(args: Record<string, unknown>, ctx: ToolContext): string {
  const id = reqArg(args, 'customer_id', ctx.lang)
  if (id.toUpperCase() !== ctx.customerId) throw forbidden('customer', ctx.lang)
  return ctx.customerId
}

function tr(text: Localized, lang: Lang): string {
  return text[lang]
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000)
}

/** Warranty status against the simulation date: void (exclusion), active (end date inclusive) or expired. */
export function warrantyStatus(w: Pick<Warranty, 'endDate' | 'voided'>, today = SIM_TODAY): { status: 'active' | 'expired' | 'void'; daysRemaining: number } {
  if (w.voided && w.voided.date <= today) return { status: 'void', daysRemaining: 0 }
  const days = daysBetween(today, w.endDate)
  return days >= 0 ? { status: 'active', daysRemaining: days } : { status: 'expired', daysRemaining: 0 }
}

async function modelName(productId: string): Promise<string | null> {
  return (await simDb.products.get(productId))?.model ?? null
}

function shipmentRow(s: Shipment, lang: Lang) {
  const last = s.events[s.events.length - 1]
  return {
    shipment_id: s.id,
    type: s.type,
    order_id: s.orderId,
    case_id: s.caseId,
    carrier: s.carrier,
    tracking_number: s.trackingNumber,
    status: s.status,
    contents: tr(s.contents, lang),
    shipped_date: s.shippedDate,
    estimated_delivery: s.estimatedDelivery,
    delivered_date: s.deliveredDate,
    last_event: last ? { at: last.at, location: last.location, description: tr(last.description, lang) } : null,
  }
}

type Handler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<{ data: unknown; summary: string }>

// ---------------------------------------------------------------- tools

const HANDLERS: Record<ToolName, Handler> = {
  async get_customer_profile(args, ctx) {
    const id = requireOwnCustomer(args, ctx)
    const c = await simDb.customers.get(id)
    if (!c) throw notFound('customer', ctx.lang)
    return {
      data: {
        customer_id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        address: `${c.address.street}, ${c.address.postalCode} ${c.address.city}, ${c.address.country}`,
        preferred_language: c.preferredLanguage,
        segment: c.segment,
        customer_since: c.customerSince,
        notes: tr(c.notes, ctx.lang),
      },
      summary: summarize.profile(ctx.lang, c.name, c.id),
    }
  },

  async get_customer_orders(args, ctx) {
    const id = requireOwnCustomer(args, ctx)
    const orders = (await simDb.orders.where('customerId').equals(id).toArray()).sort((a, b) => b.date.localeCompare(a.date))
    const products = new Map((await simDb.products.toArray()).map((p) => [p.id, p]))
    const held = await simDb.warranties.where('customerId').equals(id).toArray()
    const heldIds = new Set(held.map((w) => w.id))
    const out = orders.map((o) => ({
      order_id: o.id,
      date: o.date,
      channel: o.channel,
      status: o.status,
      total_eur: o.totalEur,
      items: o.lines.map((l) => ({
        product_id: l.productId,
        model: products.get(l.productId)?.model ?? null,
        quantity: l.quantity,
        unit_price_eur: l.unitPriceEur,
        serial_number: l.serialNumber,
        warranty_id: l.warrantyId,
        ...(l.warrantyId && !heldIds.has(l.warrantyId)
          ? { note: ctx.lang === 'pl' ? 'Urządzenie i gwarancja przekazane innemu właścicielowi.' : 'Unit and warranty transferred to another owner.' }
          : {}),
      })),
    }))
    // Units the customer received from someone else (transferred warranty).
    const ownOrderIds = new Set(orders.map((o) => o.id))
    const transferred = held
      .filter((w) => !ownOrderIds.has(w.orderId))
      .map((w) => ({
        serial_number: w.serialNumber,
        product_id: w.productId,
        model: products.get(w.productId)?.model ?? null,
        warranty_id: w.id,
        transferred_on: w.transfer?.date ?? null,
      }))
    return {
      data: { customer_id: id, orders: out, ...(transferred.length ? { transferred_units: transferred } : {}) },
      summary: summarize.orders(ctx.lang, out.length, out[0]?.order_id ?? null),
    }
  },

  async get_product_details(args, ctx) {
    const id = reqArg(args, 'product_id', ctx.lang).toUpperCase()
    const p = await simDb.products.get(id)
    if (!p) throw notFound('product', ctx.lang)
    return {
      data: {
        product_id: p.id,
        model: p.model,
        category: p.category,
        kind: p.kind,
        warranty_months: p.warrantyMonths,
        price_eur: p.priceEur,
        launch_year: p.launchYear,
        in_production: p.inProduction,
        discontinued: p.discontinued,
        description: tr(p.description, ctx.lang),
      },
      summary: summarize.product(ctx.lang, p.model, p.warrantyMonths, p.inProduction),
    }
  },

  async check_warranty(args, ctx) {
    const id = requireOwnCustomer(args, ctx)
    const serial = reqArg(args, 'serial_number', ctx.lang).toUpperCase()
    const w = await simDb.warranties.where('serialNumber').equals(serial).first()
    if (!w) throw notFound('serial', ctx.lang)
    if (w.customerId !== id) throw forbidden('serial', ctx.lang)
    const { status, daysRemaining } = warrantyStatus(w)
    return {
      data: {
        warranty_id: w.id,
        serial_number: w.serialNumber,
        product_id: w.productId,
        model: await modelName(w.productId),
        // After a transfer the order belongs to the previous owner, so it is not shown.
        order_id: w.transfer ? null : w.orderId,
        start_date: w.startDate,
        end_date: w.endDate,
        months: w.months,
        status,
        days_remaining: daysRemaining,
        ...(status === 'expired' ? { days_since_expiry: daysBetween(w.endDate, SIM_TODAY) } : {}),
        exclusion: w.voided ? { voided_on: w.voided.date, reason: tr(w.voided.reason, ctx.lang) } : null,
        transferred_on: w.transfer?.date ?? null,
        checked_on: SIM_TODAY,
      },
      summary: summarize.warranty(ctx.lang, status, w.endDate, daysRemaining),
    }
  },

  async get_shipments(args, ctx) {
    const customerArg = optArg(args, 'customer_id', ctx.lang)
    const orderId = optArg(args, 'order_id', ctx.lang)?.toUpperCase()
    if (!customerArg && !orderId) throw invalid('Give customer_id, order_id or both.', ctx.lang)
    if (customerArg && customerArg.toUpperCase() !== ctx.customerId) throw forbidden('customer', ctx.lang)
    if (orderId) {
      const order = await simDb.orders.get(orderId)
      if (!order) throw notFound('order', ctx.lang)
      if (order.customerId !== ctx.customerId) throw forbidden('order', ctx.lang)
    }
    const all = await simDb.shipments.where('customerId').equals(ctx.customerId).toArray()
    const list = all
      .filter((s) => !orderId || s.orderId === orderId)
      .sort((a, b) => b.shippedDate.localeCompare(a.shippedDate) || b.id.localeCompare(a.id))
    const open = list.find((s) => s.status !== 'delivered' && s.status !== 'returned')
    const highlight = open ?? list[0]
    return {
      data: { customer_id: ctx.customerId, ...(orderId ? { order_id: orderId } : {}), shipments: list.map((s) => shipmentRow(s, ctx.lang)) },
      summary: summarize.shipments(ctx.lang, list.length, highlight ? { id: highlight.id, status: highlight.status } : null),
    }
  },

  async track_shipment(args, ctx) {
    const id = reqArg(args, 'shipment_id', ctx.lang).toUpperCase()
    const s = await simDb.shipments.get(id)
    if (!s) throw notFound('shipment', ctx.lang)
    if (s.customerId !== ctx.customerId) throw forbidden('shipment', ctx.lang)
    return {
      data: {
        ...shipmentRow(s, ctx.lang),
        from: s.from,
        to: s.to,
        events: s.events.map((e) => ({ at: e.at, location: e.location, code: e.code, description: tr(e.description, ctx.lang) })),
        checked_on: SIM_TODAY,
      },
      summary: summarize.track(ctx.lang, s.id, s.status, s.estimatedDelivery, s.deliveredDate),
    }
  },

  async get_crm_history(args, ctx) {
    const id = requireOwnCustomer(args, ctx)
    const rows = (await simDb.interactions.where('customerId').equals(id).toArray()).sort(
      (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
    )
    return {
      data: {
        customer_id: id,
        interactions: rows.map((r) => ({
          interaction_id: r.id,
          date: r.date,
          channel: r.channel,
          type: r.type,
          subject: tr(r.subject, ctx.lang),
          summary: tr(r.summary, ctx.lang),
          outcome: tr(r.outcome, ctx.lang),
          case_id: r.caseId,
          order_id: r.orderId,
          handled_by: r.handledBy,
        })),
      },
      summary: summarize.crm(ctx.lang, rows.length, rows[0]?.date ?? null),
    }
  },

  async search_service_knowledge(args, ctx) {
    const query = reqArg(args, 'query', ctx.lang)
    const productModel = optArg(args, 'product_model', ctx.lang)
    const errorCode = optArg(args, 'error_code', ctx.lang)
    let hits: KnowledgeHit[]
    try {
      hits = await ctx.searchKnowledge({ query, ...(productModel ? { productModel } : {}), ...(errorCode ? { errorCode } : {}) })
    } catch (e) {
      const code = (e as { code?: unknown })?.code
      const known = typeof code === 'string' && (ERROR_CODES as readonly string[]).includes(code) ? (code as ToolErrorCode) : 'failed'
      const message = e instanceof Error && e.message ? e.message : 'The knowledge base search failed.'
      throw new ToolError(known, message, errorSummary(ctx.lang, known))
    }
    return {
      data: hits,
      summary: summarize.knowledge(ctx.lang, hits.length, hits[0]?.docTitle ?? null),
    }
  },

  async get_service_case(args, ctx) {
    const id = reqArg(args, 'case_id', ctx.lang).toUpperCase()
    const c = await simDb.cases.get(id)
    if (!c) throw notFound('case', ctx.lang)
    if (c.customerId !== ctx.customerId) throw forbidden('case', ctx.lang)
    const overdue = c.status !== 'resolved' && c.promisedDate !== null && c.promisedDate < SIM_TODAY
    return {
      data: {
        case_id: c.id,
        product_id: c.productId,
        model: await modelName(c.productId),
        serial_number: c.serialNumber,
        warranty_id: c.warrantyId,
        opened_date: c.openedDate,
        status: c.status,
        error_code: c.errorCode,
        fault: tr(c.fault, ctx.lang),
        covered_by_warranty: c.coveredByWarranty,
        promised_date: c.promisedDate,
        promised_date_passed: overdue,
        resolved_date: c.resolvedDate,
        resolution: c.resolution ? tr(c.resolution, ctx.lang) : null,
        shipment_ids: c.shipmentIds,
        history: c.history.map((h) => ({ date: h.date, note: tr(h.note, ctx.lang) })),
        checked_on: SIM_TODAY,
      },
      summary: summarize.serviceCase(ctx.lang, c.id, c.status, overdue),
    }
  },

  async create_service_ticket(args, ctx) {
    const customerId = requireOwnCustomer(args, ctx)
    const productId = reqArg(args, 'product_id', ctx.lang).toUpperCase()
    const issue = reqArg(args, 'issue_description', ctx.lang)
    const priority = reqArg(args, 'priority', ctx.lang)
    if (!['low', 'normal', 'high', 'urgent'].includes(priority)) throw invalid('Argument "priority" must be one of: low, normal, high, urgent.', ctx.lang)
    if (issue.length > 600) throw invalid('Argument "issue_description" is longer than 600 characters.', ctx.lang)
    const product = await simDb.products.get(productId)
    if (!product) throw notFound('product', ctx.lang)
    const year = SIM_TODAY.slice(0, 4)
    const ticket = await simDb.transaction('rw', simDb.tickets, async () => {
      const prefix = `TCK-${year}-`
      const last = (await simDb.tickets.toArray())
        .map((t) => (t.id.startsWith(prefix) ? Number(t.id.slice(prefix.length)) : 0))
        .reduce((a, b) => Math.max(a, b), 0)
      const t: Ticket = {
        id: `${prefix}${String(last + 1).padStart(4, '0')}`,
        customerId,
        productId,
        issueDescription: issue,
        priority: priority as Ticket['priority'],
        status: 'open',
        createdDate: SIM_TODAY,
        createdBy: 'agent',
      }
      await simDb.tickets.add(t)
      return t
    })
    return {
      data: {
        ticket_id: ticket.id,
        status: ticket.status,
        customer_id: ticket.customerId,
        product_id: ticket.productId,
        model: product.model,
        priority: ticket.priority,
        issue_description: ticket.issueDescription,
        created_date: ticket.createdDate,
      },
      summary: summarize.ticket(ctx.lang, ticket.id, ticket.priority),
    }
  },
}

// ---------------------------------------------------------------- entry points

/** Runs one tool for the authenticated customer in `ctx`. Never throws. */
export async function executeTool(name: ToolName, args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const lang: Lang = ctx.lang === 'en' ? 'en' : 'pl'
  const context: ToolContext = { ...ctx, lang }
  if (!isToolName(name)) {
    return { ok: false, error: { code: 'unknown_tool', message: `Unknown tool: ${String(name)}.` }, summary: errorSummary(lang, 'unknown_tool') }
  }
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    return { ok: false, error: { code: 'invalid_arguments', message: 'Arguments must be a JSON object.' }, summary: errorSummary(lang, 'invalid_arguments') }
  }
  try {
    const { data, summary } = await HANDLERS[name](args, context)
    return { ok: true, data, summary }
  } catch (e) {
    if (e instanceof ToolError) return { ok: false, error: { code: e.code, message: e.message }, summary: e.summary }
    return {
      ok: false,
      error: { code: 'failed', message: 'The company system did not respond. The tool could not complete; try again later or offer human support.' },
      summary: errorSummary(lang, 'failed'),
    }
  }
}

/** JSON text sent to the model as the tool message: the data, or `{ error }`. The summary stays in the UI. */
export function toolResultForModel(r: ToolResult): string {
  return r.ok ? JSON.stringify(r.data ?? null) : JSON.stringify({ error: { code: r.error.code, message: r.error.message } })
}
