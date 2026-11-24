/**
 * Tool registry shared by the Worker (sends the definitions to the model and
 * validates the model's tool calls) and the browser (executes the tools against
 * the simulated company systems). Keep this file dependency-free.
 */

export type ToolName =
  | 'get_customer_profile'
  | 'get_customer_orders'
  | 'get_product_details'
  | 'check_warranty'
  | 'get_shipments'
  | 'track_shipment'
  | 'get_crm_history'
  | 'search_service_knowledge'
  | 'get_service_case'
  | 'create_service_ticket'

export type SystemId = 'orders' | 'products' | 'warranty' | 'logistics' | 'crm' | 'knowledge' | 'tickets'

/** One string property. Every tool argument is a string. */
export interface ToolStringProperty {
  type: 'string'
  description: string
  /** Checked after trimming. */
  maxLength: number
  /** Regular expression the trimmed value must match. */
  pattern?: string
  enum?: string[]
}

/**
 * The JSON-schema subset the tools need: a closed object of string properties.
 * It is sent to the model as is; `validateToolArgs` implements exactly this subset.
 */
export interface ToolSchema {
  type: 'object'
  properties: Record<string, ToolStringProperty>
  required: string[]
  /** At least this many properties must be present (get_shipments: customer or order). */
  minProperties?: number
  additionalProperties: false
}

export interface ToolDef {
  name: ToolName
  system: SystemId
  readOnly: boolean
  description: string
  parameters: ToolSchema
}

const DEFAULT_MAX = 200

const customerId: ToolStringProperty = {
  type: 'string',
  description: "The authenticated customer's ID, e.g. CUST-1042.",
  maxLength: DEFAULT_MAX,
  pattern: '^CUST-\\d{4}$',
}
const productId: ToolStringProperty = {
  type: 'string',
  description: 'Product ID, e.g. PRD-COFFEE-1.',
  maxLength: DEFAULT_MAX,
  pattern: '^PRD-[A-Z]+-\\d+$',
}

function schema(properties: Record<string, ToolStringProperty>, required: string[], minProperties?: number): ToolSchema {
  return { type: 'object', properties, required, ...(minProperties ? { minProperties } : {}), additionalProperties: false }
}

export const TOOLS: readonly ToolDef[] = [
  {
    name: 'get_customer_profile',
    system: 'crm',
    readOnly: true,
    description:
      "Returns the customer's profile: name, contact details and account information. Use it when you need to confirm who the customer is or how to reach them.",
    parameters: schema({ customer_id: customerId }, ['customer_id']),
  },
  {
    name: 'get_customer_orders',
    system: 'orders',
    readOnly: true,
    description:
      "Returns the customer's orders with dates, products, serial numbers and order status. Use it first when the customer mentions a purchase or a product whose order, product ID or serial number you do not know yet.",
    parameters: schema({ customer_id: customerId }, ['customer_id']),
  },
  {
    name: 'get_product_details',
    system: 'products',
    readOnly: true,
    description:
      'Returns catalogue data for one product: model name, category, warranty period in months and whether it is still in production. Use it when you need product facts such as the warranty length.',
    parameters: schema({ product_id: productId }, ['product_id']),
  },
  {
    name: 'check_warranty',
    system: 'warranty',
    readOnly: true,
    description:
      'Returns the warranty for one purchased unit: start and end date, status (active, expired or void), days remaining and any exclusion. Use it before saying whether a repair is covered.',
    parameters: schema(
      {
        customer_id: customerId,
        serial_number: { type: 'string', description: 'Serial number of the unit, e.g. BP500-26-10482.', maxLength: DEFAULT_MAX },
      },
      ['customer_id', 'serial_number'],
    ),
  },
  {
    name: 'get_shipments',
    system: 'logistics',
    readOnly: true,
    description:
      'Lists shipments (order deliveries, replacement parts, returns) with their current status, for the customer or for one order. Give customer_id, order_id or both. Use it for delivery questions when you do not know the shipment ID.',
    parameters: schema(
      {
        customer_id: customerId,
        order_id: { type: 'string', description: 'Order ID, e.g. ORD-2026-0187.', maxLength: DEFAULT_MAX, pattern: '^ORD-\\d{4}-\\d{4}$' },
      },
      [],
      1,
    ),
  },
  {
    name: 'track_shipment',
    system: 'logistics',
    readOnly: true,
    description:
      'Returns the dated tracking events, carrier, status and estimated delivery date of one shipment. Use it when you know the shipment ID and need to explain where the parcel is.',
    parameters: schema(
      {
        shipment_id: { type: 'string', description: 'Shipment ID, e.g. SHIP-2026-091.', maxLength: DEFAULT_MAX, pattern: '^SHIP-\\d{4}-\\d{3}$' },
      },
      ['shipment_id'],
    ),
  },
  {
    name: 'get_crm_history',
    system: 'crm',
    readOnly: true,
    description:
      "Returns the customer's past interactions with customer service (calls, e-mails, chats, complaints) with dates and outcomes. Use it for complaints, repeated faults or when earlier promises to the customer matter.",
    parameters: schema({ customer_id: customerId }, ['customer_id']),
  },
  {
    name: 'search_service_knowledge',
    system: 'knowledge',
    readOnly: true,
    description:
      'Searches the service knowledge base (manuals, error codes, warranty terms, service bulletins, support procedures) and returns the best matching passages with document title, authority, status and score. Use it for troubleshooting steps, error codes and policy questions.',
    parameters: schema(
      {
        query: { type: 'string', description: 'What to look for, in the customer language.', maxLength: 300 },
        product_model: { type: 'string', description: 'Optional model name to narrow the search, e.g. Northstar Barista Pro 500.', maxLength: DEFAULT_MAX },
        error_code: { type: 'string', description: 'Optional error code shown by the appliance, e.g. E04.', maxLength: DEFAULT_MAX },
      },
      ['query'],
    ),
  },
  {
    name: 'get_service_case',
    system: 'tickets',
    readOnly: true,
    description:
      'Returns one service case: product, fault description, status, promised date and history. Use it when the customer refers to an existing repair or case ID.',
    parameters: schema(
      {
        case_id: { type: 'string', description: 'Service case ID, e.g. CASE-2026-031.', maxLength: DEFAULT_MAX, pattern: '^CASE-\\d{4}-\\d{3}$' },
      },
      ['case_id'],
    ),
  },
  {
    name: 'create_service_ticket',
    system: 'tickets',
    readOnly: false,
    description:
      'Creates a new service ticket for a repair or follow-up and returns it with its ticket ID. It changes company data and runs only after the customer approves it in the app; use it only when a repair or human follow-up is really needed.',
    parameters: schema(
      {
        customer_id: customerId,
        product_id: productId,
        issue_description: { type: 'string', description: 'Short description of the fault and what was already tried.', maxLength: 600 },
        priority: { type: 'string', description: 'Ticket priority.', maxLength: DEFAULT_MAX, enum: ['low', 'normal', 'high', 'urgent'] },
      },
      ['customer_id', 'product_id', 'issue_description', 'priority'],
    ),
  },
]

export const TOOL_NAMES: readonly ToolName[] = TOOLS.map((t) => t.name)

const BY_NAME = new Map<string, ToolDef>(TOOLS.map((t) => [t.name, t]))

function own(o: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(o, key)
}

export function isToolName(v: unknown): v is ToolName {
  return typeof v === 'string' && BY_NAME.has(v)
}

export function getTool(name: ToolName): ToolDef {
  const t = BY_NAME.get(name)
  if (!t) throw new Error(`Unknown tool: ${String(name)}`)
  return t
}

/**
 * Checks tool arguments against the tool's schema. Error messages are written
 * for the model (they are fed back as the tool result) and name the argument.
 */
export function validateToolArgs(
  name: ToolName,
  args: unknown,
): { ok: true; args: Record<string, unknown> } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error: `${name}: ${error}` })
  const tool = BY_NAME.get(name)
  if (!tool) return { ok: false, error: `Unknown tool: ${String(name)}` }
  if (typeof args !== 'object' || args === null || Array.isArray(args)) return fail('arguments must be a JSON object.')
  const { properties, required, minProperties } = tool.parameters
  const out: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(args)) {
    const prop = own(properties, key) ? properties[key] : undefined
    if (!prop) return fail(`unknown argument "${key}". Allowed: ${Object.keys(properties).join(', ')}.`)
    const optional = !required.includes(key)
    // Models routinely send an optional argument they do not use as "" or null: that means omitted.
    if (optional && (raw === null || (typeof raw === 'string' && !raw.trim()))) continue
    if (raw === null) return fail(`missing required argument "${key}".`)
    if (typeof raw !== 'string') return fail(`argument "${key}" must be a string.`)
    const value = raw.trim()
    if (!value) return fail(`argument "${key}" must not be empty.`)
    if (value.length > prop.maxLength) return fail(`argument "${key}" is longer than ${prop.maxLength} characters.`)
    if (prop.enum && !prop.enum.includes(value)) return fail(`argument "${key}" must be one of: ${prop.enum.join(', ')}.`)
    if (prop.pattern && !new RegExp(prop.pattern).test(value)) return fail(`argument "${key}" has the wrong format (${prop.description})`)
    out[key] = value
  }
  for (const key of required) {
    if (!own(out, key)) return fail(`missing required argument "${key}".`)
  }
  if (minProperties && Object.keys(out).length < minProperties) {
    return fail(`give at least one of: ${Object.keys(properties).join(', ')}.`)
  }
  return { ok: true, args: out }
}
