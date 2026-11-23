import { SELF, createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test'
import type {
  ActivateResponse,
  AdminCodeRecord,
  AdminCreateCodesRequest,
  ApiErrorBody,
} from '../../shared/api-types'
import { handleRequest } from '../src/index'
import type { Env } from '../src/env'
import type { FetchLike } from '../src/providers/openai-compatible'

export const BASE = 'https://rag-lab-api.test'
export const ADMIN_TOKEN = 'test-admin-token-0123456789abcdef'
export const PROVIDER_KEY = 'sk-test-SUPERSECRET-provider-key-1234567890'
export const ORIGIN = 'http://localhost:5173'

let ipCounter = 0
/** A fresh client IP per call so activation throttling of one test never affects another. */
export function freshIp(): string {
  ipCounter++
  return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}-${crypto.randomUUID().slice(0, 6)}`
}

export function api(path: string, init: RequestInit = {}): Promise<Response> {
  return SELF.fetch(BASE + path, init)
}

export function jsonInit(method: string, body: unknown, headers: Record<string, string> = {}): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }
}

export function adminHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${ADMIN_TOKEN}` }
}

export async function createCodes(opts: AdminCreateCodesRequest = {}): Promise<(AdminCodeRecord & { code: string })[]> {
  const res = await api('/api/admin/codes', jsonInit('POST', opts, adminHeaders()))
  if (res.status !== 201) throw new Error(`createCodes failed: ${res.status} ${await res.text()}`)
  const body = (await res.json()) as { codes: (AdminCodeRecord & { code: string })[] }
  return body.codes
}

export async function createCode(opts: AdminCreateCodesRequest = {}) {
  return (await createCodes({ ...opts, count: 1 }))[0]!
}

export async function activateRaw(code: string, ip = freshIp(), extraHeaders: Record<string, string> = {}): Promise<Response> {
  return api('/api/activate', jsonInit('POST', { code }, { 'CF-Connecting-IP': ip, ...extraHeaders }))
}

export async function activate(code: string, ip = freshIp()): Promise<ActivateResponse> {
  const res = await activateRaw(code, ip)
  if (res.status !== 200) throw new Error(`activate failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as ActivateResponse
}

/** New code + session in one go. */
export async function newSession(opts: AdminCreateCodesRequest = {}) {
  const code = await createCode(opts)
  const act = await activate(code.code)
  return { code, token: act.token, session: act.session }
}

export function auth(token: string, extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${token}`, ...extra }
}

export async function expectError(res: Response, status: number, code: string): Promise<ApiErrorBody> {
  const text = await res.text()
  let body: ApiErrorBody
  try {
    body = JSON.parse(text) as ApiErrorBody
  } catch {
    throw new Error(`expected JSON error ${code}, got ${res.status}: ${text}`)
  }
  if (res.status !== status || body.error?.code !== code) {
    throw new Error(`expected ${status} ${code}, got ${res.status} ${text}`)
  }
  if (typeof body.error.message !== 'string' || !body.error.message) throw new Error('error.message missing')
  return body
}

/**
 * Calls the worker's handler directly with env overrides (and optionally a fake
 * upstream fetch). Shares the same D1 database as SELF.
 */
export async function callWith(
  overrides: Partial<Record<keyof Env, string>>,
  path: string,
  init: RequestInit = {},
  fetchImpl?: FetchLike,
): Promise<Response> {
  const ctx = createExecutionContext()
  const res = await handleRequest(new Request(BASE + path, init), { ...env, ...overrides } as Env, ctx, { fetch: fetchImpl })
  // Body may be a stream that the waitUntil'd pump writes into; read it before waiting.
  const text = await res.text()
  await waitOnExecutionContext(ctx)
  return new Response(text, { status: res.status, headers: res.headers })
}

export interface SseEvt {
  event: string
  data: any
}

export function parseSseText(text: string): SseEvt[] {
  return text
    .split('\n\n')
    .filter((b) => b.trim())
    .map((block) => {
      let event = 'message'
      const data: string[] = []
      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7)
        else if (line.startsWith('data: ')) data.push(line.slice(6))
      }
      return { event, data: JSON.parse(data.join('\n')) }
    })
}

/** Waits until we're not within `marginMs` of a minute boundary (fixed-window tests). */
export async function avoidMinuteBoundary(marginMs = 3000): Promise<void> {
  const into = Date.now() % 60_000
  if (into > 60_000 - marginMs) await new Promise((r) => setTimeout(r, 60_000 - into + 50))
}

export const sampleContext = [
  {
    chunkId: 'hr-remote-work#1',
    documentTitle: 'Remote Work Policy',
    folder: 'HR',
    text: 'Employees may work remotely up to three days per week. Remote work requires manager approval. The office is open from 8am to 6pm.',
  },
  {
    chunkId: 'it-laptops#0',
    documentTitle: 'Laptop Policy',
    folder: 'IT',
    text: 'Every new employee receives a laptop on the first day. Laptops are replaced every three years.',
  },
]

export { env }

export const sampleContextPl = [
  {
    chunkId: 'hr-remote-work#1',
    documentTitle: 'Zasady pracy zdalnej',
    folder: 'Kadry',
    text: 'Pracownicy mogą pracować zdalnie do trzech dni w tygodniu, czyli trzy dni w tygodniu. Praca zdalna wymaga zgody przełożonego. Zasady obowiązują od 1 marca 2026 r. we wszystkich biurach.',
  },
  {
    chunkId: 'hr-leave-policy#0',
    documentTitle: 'Zasady urlopowe',
    folder: 'Kadry',
    text: 'Każdemu pracownikowi przysługuje 20 dni urlopu w roku. Niewykorzystane dni przechodzą na kolejny rok.',
  },
]
