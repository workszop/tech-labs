#!/usr/bin/env node
// End-to-end check of Service Agent Lab against a running stack, driven through the raw
// Chrome DevTools Protocol (headless Chrome, no Playwright needed).
//
// Start the stack first (mock provider, so no API key and no cost):
//   worker:  cd agent-lab/worker && npm run db:migrate:local && npm run dev       (http://localhost:8787)
//   web:     cd agent-lab/web && npm run build && npm run preview                 (http://localhost:4173)
//            ALLOWED_ORIGINS of the Worker must contain the preview origin.
// Then:     cd agent-lab/web && node scripts/e2e.mjs [--shots <dir>]
//
// Environment (defaults in brackets):
//   AGENT_LAB_API            Worker URL                        [http://localhost:8787]
//   AGENT_LAB_WEB            URL of the built app              [http://localhost:4173/]
//   AGENT_LAB_ADMIN_TOKEN    ADMIN_TOKEN of the Worker         [dev-admin-token-change-me-0123456789]
//   AGENT_LAB_E2E_LANG       language of the main flow, pl|en  [pl] (the check then switches to the other)
//   AGENT_LAB_DIST           build output scanned for secrets  [agent-lab/web/dist]
//   AGENT_LAB_E2E_TIMEOUT_MS whole-run deadline                [180000]
//   CHROME_BIN               Chrome / Chromium executable      [google-chrome-stable]
//
// Flow: activate with a fresh code, wait for the knowledge-base index, scenario 1 (at least
// three tool rows, a reply with sources), scenario 8 rejected then approved (ticket count),
// scenario 9 (access denied step), reload (conversation and data survive), language switch
// (UI and a document title change, scenario 1 again in the other language), no uncaught
// errors, no secrets in the bundle or web storage. Exits 1 with the list of failed checks.
//
// Each run creates one access code (max 5 sessions) and makes about 25 Worker requests.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const env = process.env
const API = (env.AGENT_LAB_API ?? 'http://localhost:8787').replace(/\/+$/, '')
const WEB = env.AGENT_LAB_WEB ?? 'http://localhost:4173/'
const ADMIN = env.AGENT_LAB_ADMIN_TOKEN ?? 'dev-admin-token-change-me-0123456789'
const LANG = env.AGENT_LAB_E2E_LANG === 'en' ? 'en' : 'pl'
const OTHER = LANG === 'pl' ? 'en' : 'pl'
const DIST = env.AGENT_LAB_DIST ?? fileURLToPath(new URL('../dist/', import.meta.url))
const DEADLINE_MS = Number(env.AGENT_LAB_E2E_TIMEOUT_MS ?? 180_000)
const CHROME = env.CHROME_BIN ?? 'google-chrome-stable'
const shotsArg = process.argv.indexOf('--shots')
const SHOTS = shotsArg > 0 ? process.argv[shotsArg + 1] : null

const CMD_TIMEOUT_MS = 15_000
const RUN_TIMEOUT_MS = 30_000
const KB_TIMEOUT_MS = 60_000

const t0 = Date.now()
const results = []
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail })
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? `\n       ${detail}` : ''}`)
}

// ---------------------------------------------------------------- Chrome process and DevTools connection

const procs = { chrome: null, profile: null, cdp: null, cleaning: false, deadlineHit: false }

/** One DevTools WebSocket: every command has a timeout; close, error, crash and detach reject everything pending. */
class Cdp {
  constructor(ws) {
    this.ws = ws
    this.nextId = 1
    this.pending = new Map()
    this.listeners = new Map()
    this.fatal = null
    ws.addEventListener('message', (m) => this.onMessage(m))
    ws.addEventListener('close', () => this.fail(new Error('the DevTools connection closed')))
    ws.addEventListener('error', () => this.fail(new Error('the DevTools connection failed')))
    this.on('Inspector.targetCrashed', () => this.fail(new Error('the page crashed (Inspector.targetCrashed)')))
    this.on('Inspector.detached', (p) => this.fail(new Error(`the debugger was detached (${p?.reason ?? 'unknown reason'})`)))
  }

  static connect(url, timeoutMs = CMD_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url)
      const timer = setTimeout(() => {
        ws.close()
        reject(new Error(`DevTools WebSocket did not open within ${timeoutMs} ms`))
      }, timeoutMs)
      ws.addEventListener('open', () => {
        clearTimeout(timer)
        resolve(new Cdp(ws))
      }, { once: true })
      ws.addEventListener('error', () => {
        clearTimeout(timer)
        reject(new Error(`DevTools WebSocket error (${url})`))
      }, { once: true })
    })
  }

  onMessage(m) {
    let msg
    try {
      msg = JSON.parse(typeof m.data === 'string' ? m.data : m.data.toString())
    } catch {
      return
    }
    if (msg.id !== undefined) {
      const p = this.pending.get(msg.id)
      if (!p) return
      this.pending.delete(msg.id)
      clearTimeout(p.timer)
      if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`))
      else p.resolve(msg.result ?? {})
      return
    }
    for (const fn of this.listeners.get(msg.method) ?? []) fn(msg.params)
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, [])
    this.listeners.get(method).push(fn)
  }

  send(method, params = {}, timeoutMs = CMD_TIMEOUT_MS) {
    if (this.fatal) return Promise.reject(this.fatal)
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`${method} got no answer within ${timeoutMs} ms`))
      }, timeoutMs)
      this.pending.set(id, { method, resolve, reject, timer })
      try {
        this.ws.send(JSON.stringify({ id, method, params }))
      } catch (e) {
        this.pending.delete(id)
        clearTimeout(timer)
        reject(e)
      }
    })
  }

  fail(err) {
    if (this.fatal) return
    this.fatal = err
    for (const p of this.pending.values()) {
      clearTimeout(p.timer)
      p.reject(err)
    }
    this.pending.clear()
  }

  close() {
    this.fatal ??= new Error('closed')
    try {
      this.ws.close()
    } catch {}
  }
}

async function launchChrome() {
  if (procs.cleaning || procs.deadlineHit) throw new Error('not starting Chrome: the run is already over')
  procs.profile = mkdtempSync(path.join(tmpdir(), 'agent-lab-e2e-'))
  const args = [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking', '--disable-sync', '--hide-scrollbars', '--mute-audio',
    '--remote-debugging-port=0', `--user-data-dir=${procs.profile}`, '--window-size=1440,900', 'about:blank',
  ]
  const chrome = spawn(CHROME, args, { stdio: ['ignore', 'ignore', 'pipe'] })
  procs.chrome = chrome
  let stderr = ''
  chrome.stderr.on('data', (d) => (stderr = (stderr + d).slice(-2000)))
  let exited = null
  chrome.on('error', (e) => (exited = e))
  chrome.on('exit', (code, signal) => {
    exited ??= new Error(`Chrome exited (code ${code}, signal ${signal})`)
    if (!procs.cleaning) procs.cdp?.fail(exited)
  })
  // Chrome picks a free port itself and writes it to DevToolsActivePort in the profile.
  const portFile = path.join(procs.profile, 'DevToolsActivePort')
  let port = null
  for (const start = Date.now(); Date.now() - start < 20_000; await sleep(100)) {
    if (exited) throw new Error(`${exited.message}\n${stderr.trim()}`)
    if (procs.deadlineHit) throw new Error('run deadline exceeded while Chrome was starting')
    if (existsSync(portFile)) {
      const [p] = readFileSync(portFile, 'utf8').split('\n')
      if (/^\d+$/.test(p ?? '')) {
        port = Number(p)
        break
      }
    }
  }
  if (!port) throw new Error(`Chrome did not open a debugging port within 20 s (pid ${chrome.pid})\n${stderr.trim()}`)
  let page = null
  for (const start = Date.now(); !page && Date.now() - start < 10_000; await sleep(100)) {
    if (exited) throw exited
    if (procs.deadlineHit) throw new Error('run deadline exceeded while Chrome was starting')
    try {
      const ctl = AbortSignal.timeout(2000)
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: ctl })).json()
      page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
    } catch {}
  }
  if (!page) throw new Error('Chrome has no page target to attach to')
  procs.cdp = await Cdp.connect(page.webSocketDebuggerUrl)
  console.log(`  Chrome pid ${chrome.pid}, DevTools port ${port}`)
  return procs.cdp
}

async function cleanup() {
  if (procs.cleaning) return
  procs.cleaning = true
  procs.cdp?.close()
  const chrome = procs.chrome
  if (chrome && chrome.exitCode === null && chrome.signalCode === null) {
    const gone = new Promise((r) => chrome.once('exit', r))
    chrome.kill('SIGTERM')
    const timedOut = await Promise.race([gone.then(() => false), sleep(3000).then(() => true)])
    if (timedOut) {
      chrome.kill('SIGKILL')
      await Promise.race([gone, sleep(2000)])
    }
  }
  if (procs.profile) {
    for (let i = 0; i < 5; i++) {
      try {
        rmSync(procs.profile, { recursive: true, force: true })
        break
      } catch {
        await sleep(200)
      }
    }
  }
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`\n${sig}: stopping Chrome`)
    cleanup().finally(() => process.exit(130))
  })
}

// ---------------------------------------------------------------- page helpers

let cdp
const pageErrors = []

async function ev(expression, timeoutMs = CMD_TIMEOUT_MS) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, timeoutMs)
  if (r.exceptionDetails) {
    const d = r.exceptionDetails
    throw new Error(`page script failed: ${d.exception?.description ?? d.text}`.split('\n')[0])
  }
  return r.result?.value
}

async function waitFor(expression, label, timeoutMs = 10_000) {
  const start = Date.now()
  let lastError = null
  while (Date.now() - start < timeoutMs) {
    try {
      if (await ev(expression)) return
      lastError = null
    } catch (e) {
      if (cdp.fatal) throw e
      lastError = e
    }
    await sleep(100)
  }
  throw new Error(`timed out after ${timeoutMs} ms waiting for ${label}${lastError ? ` (${lastError.message})` : ''}`)
}

const q = (sel) => JSON.stringify(sel)
/** Clicks the first element matching `sel` (inside `scope` when given). */
const click = (sel, scope = 'document') =>
  ev(`(() => { const e = ${scope}.querySelector(${q(sel)}); if (!e) throw new Error('no element ' + ${q(sel)}); e.click(); return true })()`)
const CHAT = `document.querySelector('[data-panel=chat]')`
const inChat = (sel) => `${CHAT}?.querySelector(${q(sel)})`
const countInChat = (sel) => ev(`${CHAT}?.querySelectorAll(${q(sel)}).length ?? 0`)

async function key(k, code, vk) {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk })
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk })
}

async function shot(name) {
  if (!SHOTS) return
  try {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(path.join(SHOTS, `${name}.png`), Buffer.from(data, 'base64'))
  } catch {}
}

/** Reads from the browser's IndexedDB without knowing its schema version. */
const idb = (db, body) =>
  ev(`new Promise((resolve, reject) => { const r = indexedDB.open(${q(db)}); r.onerror = () => reject(r.error); r.onsuccess = () => { const db = r.result; try { ${body} } catch (e) { db.close(); reject(e) } } })`)
const ticketCount = () =>
  idb('agent-lab-sim', `const c = db.transaction('tickets').objectStore('tickets').count(); c.onsuccess = () => { db.close(); resolve(c.result) }; c.onerror = () => reject(c.error)`)
const ticketExists = (id) =>
  idb('agent-lab-sim', `const g = db.transaction('tickets').objectStore('tickets').get(${q(id)}); g.onsuccess = () => { db.close(); resolve(!!g.result) }; g.onerror = () => reject(g.error)`)
const kbIndexed = (lang) =>
  idb('agent-lab-kb', `if (!db.objectStoreNames.contains('meta')) { db.close(); return resolve(false) } const g = db.transaction('meta').objectStore('meta').get(${q(lang)}); g.onsuccess = () => { db.close(); resolve(!!g.result) }; g.onerror = () => reject(g.error)`)

// Stable hooks first (data-testid), then the selectors that worked before they existed.
const CODE_INPUT = `(document.querySelector('[data-testid=activation-code]') ?? document.querySelector('#code'))`
const CODE_SUBMIT = `(document.querySelector('[data-testid=activation-submit]') ?? ${CODE_INPUT}?.form?.querySelector('button[type=submit]'))`

async function activate(code) {
  await waitFor(`!!${CODE_INPUT}`, 'the access-code field')
  await ev(`(() => { const i = ${CODE_INPUT}; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${q(code)}); i.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
  await waitFor(`!!${CODE_SUBMIT} && !${CODE_SUBMIT}.disabled`, 'the activation button to be enabled')
  await ev(`(() => { ${CODE_SUBMIT}.click(); return true })()`)
  await waitFor(`!${CODE_INPUT} && !!${CHAT}`, 'the lab to open after activation', 15_000)
}

/**
 * Waits until the knowledge base of `lang` is indexed (meta row in IndexedDB), the
 * header's readiness marker says ready (when the build has `data-kb-status`) and the
 * composer is not waiting for it. Returns the last observed state either way.
 */
async function waitKbReady(lang) {
  const start = Date.now()
  let state = null
  while (Date.now() - start < KB_TIMEOUT_MS) {
    const ui = await ev(`(() => { const r = ${inChat('[data-testid=composer-reason]')}; const m = document.querySelector('[data-kb-status]'); return { composer: !!${inChat('[data-testid=composer-input]')}, reason: r?.dataset.reason ?? null, marker: m ? m.dataset.kbStatus : null } })()`)
    state = { ...ui, indexed: await kbIndexed(lang) }
    state.ready = state.indexed && state.composer && !/^(kb|loading)/.test(state.reason ?? '') && (state.marker === null || state.marker === 'ready')
    if (state.ready) return state
    await sleep(200)
  }
  return state ?? { ready: false }
}

/** Accepts a confirmation dialog when one opened (new conversation, language switch). */
async function acceptConfirmationIfAny(waitMs = 800) {
  const start = Date.now()
  while (Date.now() - start < waitMs) {
    const done = await ev(`(() => { const d = [...document.querySelectorAll('[role=dialog],[role=alertdialog]')].find((x) => !x.matches('[data-testid=record-dialog]')); if (!d) return false; const b = d.querySelector('[data-testid^=confirm]') ?? [...d.querySelectorAll('button')].filter((x) => !x.disabled).pop(); if (!b) return false; b.click(); return true })()`)
    if (done) return true
    await sleep(100)
  }
  return false
}

/** Picks a predefined scenario (empty-state card or the scenario dialog) and sends its message. */
async function runScenario(id) {
  const before = await countInChat('[data-testid=customer-message]')
  if (await ev(`!!${inChat(`[data-testid=chat-empty] [data-scenario="${id}"]`)}`)) {
    await click(`[data-testid=chat-empty] [data-scenario="${id}"]`, CHAT)
  } else {
    await click('[data-testid=open-scenarios]')
    await waitFor(`!!document.querySelector('[role=dialog] [data-scenario="${id}"]')`, `scenario ${id} in the scenario dialog`)
    await click(`[role=dialog] [data-scenario="${id}"]`)
    await waitFor(`!document.querySelector('[role=dialog] [data-scenario]')`, 'the scenario dialog to close')
    await acceptConfirmationIfAny()
  }
  await waitFor(`(${inChat('[data-testid=composer-input]')}?.value ?? '').trim().length > 10`, `the message of scenario ${id} in the composer`)
  await waitFor(`!${inChat('[data-testid=composer-send]')}?.disabled`, 'the send button to be enabled')
  const sent = await countInChat('[data-testid=customer-message]')
  await click('[data-testid=composer-send]', CHAT)
  // Picking a scenario of another customer starts a new conversation, so compare with the count after picking.
  await waitFor(`${CHAT}.querySelectorAll('[data-testid=customer-message]').length > ${Math.min(before, sent)}`, `the customer message of scenario ${id}`)
}

/** The run is over: no Stop button, no typing indicator, no pending confirmation. */
const waitIdle = (label) =>
  waitFor(`!${inChat('[data-testid=composer-stop]')} && !${inChat('[data-testid=typing]')} && !${inChat('[data-testid=confirmation-card][data-state=pending]')}`, label, RUN_TIMEOUT_MS)

const lastAgent = `[...${CHAT}.querySelectorAll('[data-testid=agent-message]')].pop()`
const lastAgentSources = () => ev(`[...(${lastAgent}?.querySelectorAll('[data-source]') ?? [])].map((e) => e.dataset.source)`)

/** Unfolds the step list of the latest run and returns its rows. */
async function latestSteps() {
  await ev(`(() => { const b = [...${CHAT}.querySelectorAll('[data-testid=run-steps] button[aria-expanded=false]')].pop(); if (b) b.click(); return true })()`)
  await waitFor(`!![...${CHAT}.querySelectorAll('[data-testid=run-steps]')].pop()?.querySelector('[data-step]')`, 'the tool rows of the run')
  return ev(`[...[...${CHAT}.querySelectorAll('[data-testid=run-steps]')].pop().querySelectorAll('[data-step]')].map((e) => ({ status: e.dataset.stepStatus, code: e.dataset.stepCode ?? null }))`)
}

/** Opens a source chip of the latest reply and returns the record dialog's title. */
async function openSourceTitle(id) {
  await click(`[data-source="${id}"]`, lastAgent)
  await waitFor(`document.querySelector('[data-testid=record-dialog]')?.dataset.record === ${q(id)}`, `the record dialog of ${id}`)
  const title = await ev(`(() => { const d = document.querySelector('[data-testid=record-dialog]'); const dlg = d.closest('[role=dialog]') ?? d; const t = dlg.querySelector('[data-testid=record-title]') ?? document.getElementById(dlg.getAttribute('aria-labelledby') ?? '') ?? dlg.querySelector('h2'); return t?.innerText.trim() ?? '' })()`)
  await key('Escape', 'Escape', 27)
  await waitFor(`!document.querySelector('[data-testid=record-dialog]')`, 'the record dialog to close')
  return title
}

// ---------------------------------------------------------------- the run

async function admin(method, p, body) {
  const res = await fetch(`${API}${p}`, {
    method,
    headers: { Authorization: `Bearer ${ADMIN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`${method} ${p} -> ${res.status} ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

async function main() {
  console.log(`Service Agent Lab e2e: web ${WEB}, api ${API}, main language ${LANG}`)
  if (SHOTS) mkdirSync(SHOTS, { recursive: true })

  const health = await (await fetch(`${API}/api/health`, { signal: AbortSignal.timeout(5000) })).json()
  if (health.provider !== 'mock') console.log(`  note: the Worker uses provider "${health.provider}", not the mock; answers will vary`)
  const { codes } = await admin('POST', '/api/admin/codes', { count: 1, label: 'e2e', requestLimit: 500, tokenLimit: 2_000_000, maxSessions: 5 })
  const CODE = codes[0].code

  cdp = await launchChrome()
  cdp.on('Runtime.exceptionThrown', (p) => pageErrors.push(`exception: ${p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text}`.split('\n')[0]))
  cdp.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error') pageErrors.push(`console.error: ${p.args?.map((a) => a.value ?? a.description ?? '').join(' ')}`.slice(0, 300))
  })
  cdp.on('Log.entryAdded', (p) => {
    if (p.entry?.level === 'error') pageErrors.push(`${p.entry.source}: ${p.entry.text} ${p.entry.url ?? ''}`.slice(0, 300))
  })
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Log.enable')
  await cdp.send('Inspector.enable')
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await cdp.send('Page.navigate', { url: WEB })

  // -- activation and knowledge base
  await activate(CODE)
  const shell = await ev(`({ chat: !!${CHAT}, systems: !!document.querySelector('[data-panel=systems]'), workspace: !!document.querySelector('[data-panel=workspace]'), codeField: !!${CODE_INPUT} })`)
  check('activation with a fresh code opens the lab (chat, systems and workspace panels)', shell.chat && shell.systems && shell.workspace && !shell.codeField, JSON.stringify(shell))
  if ((await ev('document.documentElement.lang')) !== LANG) {
    await click(`[data-testid=lang-switch] button[lang=${LANG}]`)
    await acceptConfirmationIfAny()
    await waitFor(`document.documentElement.lang === ${q(LANG)}`, `the ${LANG} interface`)
  }
  const kb1 = await waitKbReady(LANG)
  check(`${LANG}: knowledge base indexed and marked ready (${elapsed()})`, kb1.ready, JSON.stringify(kb1))
  if (!kb1.ready) throw new Error(`the ${LANG} knowledge base was not ready within ${KB_TIMEOUT_MS} ms`)
  await shot(`${LANG}-01-ready`)

  // -- scenario 1: tool calls and a reply with sources
  await runScenario('product-failure-e04')
  await waitIdle('scenario 1 to finish')
  await waitFor(`!!${lastAgent}`, 'the reply of scenario 1')
  const s1Steps = await latestSteps()
  check(`${LANG} s1: at least three tool rows`, s1Steps.length >= 3, `got ${s1Steps.length}`)
  check(`${LANG} s1: every tool call succeeded`, s1Steps.every((s) => s.status === 'ok'), JSON.stringify(s1Steps))
  const s1Sources = await lastAgentSources()
  const docId = s1Sources.find((s) => s.startsWith('DOC-'))
  check(`${LANG} s1: reply cites a knowledge document and a company record`, !!docId && s1Sources.some((s) => /^(ORD|WAR)-/.test(s)), s1Sources.join(', ') || 'no sources')
  const s1Text = await ev(`${lastAgent}?.innerText ?? ''`)
  check(`${LANG} s1: reply has no raw markdown`, !/(^|\s)##\s|\*\*/.test(s1Text), s1Text.slice(0, 200))
  const docTitleBefore = docId ? await openSourceTitle(docId) : ''
  check(`${LANG} s1: the document source opens with its title`, docTitleBefore.length > 3, docTitleBefore)
  await shot(`${LANG}-02-s1`)

  // -- scenario 8: reject, then approve
  const tickets0 = await ticketCount()
  await runScenario('paid-repair-ticket')
  await waitFor(`!!${inChat('[data-testid=confirmation-card][data-state=pending] [data-testid=confirm-reject]')}`, 'the ticket confirmation card', RUN_TIMEOUT_MS)
  await shot(`${LANG}-03-s8-card`)
  await click('[data-testid=confirmation-card][data-state=pending] [data-testid=confirm-reject]', CHAT)
  await waitIdle('scenario 8 to finish after Reject')
  check(`${LANG} s8 reject: the card shows the rejection`, await ev(`!!${inChat('[data-testid=confirmation-card][data-state=rejected]')}`))
  check(`${LANG} s8 reject: no ticket was written`, (await ticketCount()) === tickets0, `${tickets0} -> ${await ticketCount()}`)
  check(`${LANG} s8 reject: no ticket claimed in the chat`, !(await ev(`!!${inChat('[data-testid=escalation][data-kind=ticket]')}`)))

  await runScenario('paid-repair-ticket')
  await waitFor(`!!${inChat('[data-testid=confirmation-card][data-state=pending] [data-testid=confirm-approve]')}`, 'the ticket confirmation card', RUN_TIMEOUT_MS)
  await click('[data-testid=confirmation-card][data-state=pending] [data-testid=confirm-approve]', CHAT)
  await waitIdle('scenario 8 to finish after Approve')
  const tickets1 = await ticketCount()
  check(`${LANG} s8 approve: exactly one ticket written`, tickets1 === tickets0 + 1, `${tickets0} -> ${tickets1}`)
  check(`${LANG} s8 approve: the card shows the approval`, await ev(`!!${inChat('[data-testid=confirmation-card][data-state=approved]')}`))
  const ticketId = await ev(`${inChat('[data-testid=escalation][data-kind=ticket] [data-source]')}?.dataset.source ?? null`)
  check(`${LANG} s8 approve: the reply names the new ticket`, /^TCK-2026-\d{4}$/.test(ticketId ?? ''), String(ticketId))
  await shot(`${LANG}-04-s8-approved`)

  // -- scenario 9: another customer's order
  await runScenario('access-control')
  await waitIdle('scenario 9 to finish')
  await waitFor(`!!${lastAgent}`, 'the reply of scenario 9')
  const s9Steps = await latestSteps()
  check(`${LANG} s9: an access-denied step is shown as an error`, s9Steps.some((s) => s.code === 'forbidden' && s.status === 'error'), JSON.stringify(s9Steps))
  check(`${LANG} s9: the reply cites no record`, (await lastAgentSources()).length === 0, (await lastAgentSources()).join(', '))
  await shot(`${LANG}-05-s9`)

  // -- reload: the conversation and the company data survive (the session token does not: activate again)
  const before = {
    customer: await countInChat('[data-testid=customer-message]'),
    agent: await countInChat('[data-testid=agent-message]'),
    text: await ev(`${lastAgent}?.innerText ?? ''`),
  }
  await cdp.send('Page.reload', { ignoreCache: true })
  await waitFor(`document.readyState === 'complete' && (!!${CODE_INPUT} || !!${CHAT})`, 'the page after reload', 15_000)
  if (await ev(`!!${CODE_INPUT}`)) await activate(CODE)
  await waitFor(`${CHAT}.querySelectorAll('[data-testid=agent-message]').length >= ${before.agent}`, 'the restored conversation', 15_000)
  const after = {
    customer: await countInChat('[data-testid=customer-message]'),
    agent: await countInChat('[data-testid=agent-message]'),
    text: await ev(`${lastAgent}?.innerText ?? ''`),
  }
  check('reload: the conversation is restored', after.customer === before.customer && after.agent === before.agent && after.text === before.text, `${JSON.stringify({ ...before, text: before.text.length })} -> ${JSON.stringify({ ...after, text: after.text.length })}`)
  check('reload: the approved ticket is still in the company data', ticketId ? await ticketExists(ticketId) : false, String(ticketId))
  check('reload: no ticket was lost or added', (await ticketCount()) === tickets1)
  await shot(`${LANG}-06-reloaded`)

  // -- language switch
  const uiBefore = await ev(`${inChat('[data-testid=composer-input]')}?.placeholder ?? ''`)
  await click(`[data-testid=lang-switch] button[lang=${OTHER}]`)
  await acceptConfirmationIfAny()
  await waitFor(`document.documentElement.lang === ${q(OTHER)}`, `the ${OTHER} interface`)
  await waitFor(`!!${inChat('[data-testid=composer-input]')}`, 'the composer')
  const uiAfter = await ev(`${inChat('[data-testid=composer-input]')}?.placeholder ?? ''`)
  check(`language switch: the interface is in ${OTHER}`, uiAfter !== '' && uiAfter !== uiBefore, `"${uiBefore}" -> "${uiAfter}"`)
  const kb2 = await waitKbReady(OTHER)
  check(`${OTHER}: knowledge base indexed and marked ready (${elapsed()})`, kb2.ready, JSON.stringify(kb2))
  if (!kb2.ready) throw new Error(`the ${OTHER} knowledge base was not ready within ${KB_TIMEOUT_MS} ms`)
  await runScenario('product-failure-e04')
  await waitIdle(`scenario 1 (${OTHER}) to finish`)
  await waitFor(`!!${lastAgent}`, `the reply of scenario 1 (${OTHER})`)
  const otherSources = await lastAgentSources()
  check(`${OTHER} s1: reply cites a knowledge document`, otherSources.some((s) => s.startsWith('DOC-')), otherSources.join(', ') || 'no sources')
  const sameDoc = !!docId && otherSources.includes(docId)
  check(`${OTHER} s1: reply cites the same document as in ${LANG} (${docId})`, sameDoc, otherSources.join(', '))
  const docTitleAfter = sameDoc ? await openSourceTitle(docId) : ''
  check(`language switch: the title of ${docId} changed`, docTitleBefore.length > 3 && docTitleAfter.length > 3 && docTitleAfter !== docTitleBefore, `"${docTitleBefore}" -> "${docTitleAfter}"`)
  await shot(`${OTHER}-07-s1`)

  // -- hygiene
  const storage = await ev(`JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie`)
  check('no access code or session token in web storage', !storage.includes(CODE) && !/AGT-[0-9A-Z]{4}|"token"|Bearer/i.test(storage))
  const assets = path.join(DIST, 'assets')
  if (existsSync(assets)) {
    const needles = [/sk-[A-Za-z0-9]{20,}/, /PROVIDER_API_KEY/, /CODE_PEPPER/, /ADMIN_TOKEN/]
    const hits = readdirSync(assets).flatMap((f) => {
      const s = readFileSync(path.join(assets, f), 'utf8')
      return needles.filter((n) => n.test(s)).map((n) => `${f}: ${n}`)
    })
    check('no provider secrets in the built bundle', hits.length === 0, hits.join('; '))
  } else {
    check(`built bundle found for the secret scan (${assets})`, false, 'set AGENT_LAB_DIST to the dist folder of the build under test')
  }
  check('no uncaught page errors or console errors', pageErrors.length === 0, pageErrors.slice(0, 8).join('\n       '))
}

// The deadline covers everything from the first request on: health and admin calls,
// Chrome startup and the browser flow. When it fires, the run stops and Chrome is cleaned up.
let deadlineTimer
const deadline = new Promise((_, reject) => {
  deadlineTimer = setTimeout(() => {
    const err = new Error(`the whole run exceeded ${DEADLINE_MS} ms`)
    procs.deadlineHit = true
    procs.cdp?.fail(err)
    reject(err)
  }, DEADLINE_MS)
})

let exitCode = 0
try {
  await Promise.race([main(), deadline])
} catch (e) {
  check('the run completed', false, e?.message ?? String(e))
  await shot('fail')
} finally {
  clearTimeout(deadlineTimer)
  await cleanup()
}
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed in ${elapsed()}`)
if (failed.length) {
  exitCode = 1
  console.log('Failed checks:')
  for (const f of failed) console.log(`  - ${f.name}${f.detail ? `: ${f.detail}` : ''}`)
}
process.exit(exitCode)
