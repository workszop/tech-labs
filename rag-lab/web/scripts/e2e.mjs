// End-to-end check of the five-part app (Case, Data, Vector database, Generator, Benchmark) and its
// Students / Tech switch, against a running stack:
//   worker:  cd rag-lab/worker && npm run dev            (PROVIDER=mock, http://localhost:8787)
//   web:     cd rag-lab/web && npm run build && npm run preview   (http://localhost:4173)
// Usage: node scripts/e2e.mjs [--shots <dir>]
// Playwright is resolved with require(), so a globally installed one (NODE_PATH) works; it is not a
// dependency of this app. Without Playwright's own browsers, point RAG_LAB_CHROME at a Chrome binary:
//   NODE_PATH=<dir with playwright> RAG_LAB_CHROME=/usr/bin/google-chrome node scripts/e2e.mjs
// Other ports: RAG_LAB_API, RAG_LAB_WEB (the Worker's ALLOWED_ORIGINS must contain the web origin).
// Each run makes failed activation attempts on purpose. After ~4 runs within 15 minutes the
// Worker's brute-force protection (10 attempts / IP / 15 min) blocks activation – that is the
// throttle working. Reset it locally with:
//   cd ../worker && npx wrangler d1 execute DB --local --command "DELETE FROM rate_limits"
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const API = process.env.RAG_LAB_API ?? 'http://localhost:8787'
const WEB = process.env.RAG_LAB_WEB ?? 'http://localhost:4173/'
const ADMIN = process.env.RAG_LAB_ADMIN_TOKEN ?? 'dev-admin-token-change-me-0123456789'
const CHROME = process.env.RAG_LAB_CHROME
const shotsIdx = process.argv.indexOf('--shots')
const SHOTS = shotsIdx > 0 ? process.argv[shotsIdx + 1] : null
const PARTS = ['case', 'data', 'vectors', 'generator', 'benchmark']

let failures = 0
const ok = (name) => console.log(`  ✓ ${name}`)
const fail = (name, e) => {
  failures++
  console.log(`  ✗ ${name}\n    ${e?.message?.split('\n')[0] ?? e}`)
}
async function step(name, fn) {
  try {
    await fn()
    ok(name)
  } catch (e) {
    fail(name, e)
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'fail-' + name.slice(0, 12).replace(/\W+/g, '_') + '.png') }).catch(() => {})
  }
}
const assert = (c, m) => {
  if (!c) throw new Error(m)
}

async function admin(method, p, body) {
  const res = await fetch(`${API}${p}`, { method, headers: { Authorization: `Bearer ${ADMIN}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status} ${await res.text()}`)
  return res.json()
}

const { codes } = await admin('POST', '/api/admin/codes', { count: 2, label: 'e2e', requestLimit: 300, tokenLimit: 500000 })
const code = codes[0].code
const revoked = codes[1]
await admin('DELETE', `/api/admin/codes/${revoked.id}`)

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {})
// The app opens in Polish by default; these checks use the English labels.
const useEnglish = () => {
  if (!localStorage.getItem('rag-lab-prefs-v1')) localStorage.setItem('rag-lab-prefs-v1', JSON.stringify({ settings: { lang: 'en' }, selection: [] }))
}
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
await ctx.addInitScript(useEnglish)
const page = await ctx.newPage()
page.setDefaultTimeout(15000)
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('crash', () => errors.push('the page crashed'))
const shot = async (n) => SHOTS && page.screenshot({ path: path.join(SHOTS, `${n}.png`) })

// ---------------------------------------------------------------- helpers
const nav = (part) => page.getByTestId(`nav-${part}`).click()
const face = (v) => page.getByTestId(`view-${v}`).click()
const viewOf = (part) => page.getByTestId(`part-${part}`).getAttribute('data-view')
const guideButton = () => page.locator('header').getByRole('button', { name: /guide/i })

async function activateWith(c) {
  await page.getByLabel('Access code').fill(c)
  await page.getByRole('button', { name: 'Activate' }).click()
}
async function build() {
  await nav('vectors')
  await page.getByTestId('rebuild-index').click()
  // Done when the button says the database matches the decisions (disabled) and no build is in progress.
  await page.waitForFunction(() => {
    const b = document.querySelector('[data-testid=rebuild-index]')
    return b?.disabled && !document.querySelector('[data-testid=build-progress]')
  }, null, { timeout: 30000 })
}
async function ask(q) {
  await nav('case')
  const n = await page.getByTestId('answer').count()
  await page.getByTestId('chat-input').fill(q)
  await page.getByTestId('chat-input').press('Enter')
  await page.getByTestId('answer').nth(n).locator('text=/\\d+ in \\/ \\d+ out tokens/').waitFor({ timeout: 30000 })
}
/** Click a document's checkbox in Data · Students (folders open collapsed each time the part opens). */
async function tick(titles) {
  await nav('data')
  for (const f of ['complaints', 'quality', 'production']) {
    const t = page.locator(`[data-folder-toggle=${f}]`)
    if ((await t.getAttribute('aria-label'))?.startsWith('Expand')) await t.click()
  }
  for (const d of titles) await page.getByLabel(`Select ${d}`, { exact: true }).click({ timeout: 3000 })
}

console.log('RAG Lab e2e')
await page.goto(WEB)

await step('B: invalid and revoked codes are refused', async () => {
  await activateWith('RAG-0000-0000-0000-0000-0000')
  await page.getByRole('alert').filter({ hasText: /not recognised/ }).waitFor({ timeout: 5000 })
  await activateWith(revoked.code)
  await page.getByRole('alert').filter({ hasText: /revoked/ }).waitFor({ timeout: 5000 })
  const r = await fetch(`${API}/api/embeddings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inputs: ['x'] }) })
  assert(r.status === 401, `unauthenticated embeddings returned ${r.status}`)
})

await step('A: valid code activates the app in the Students face', async () => {
  await shot('01-activation')
  await activateWith(code)
  await page.getByTestId('parts-bar').waitFor({ timeout: 5000 })
  for (const p of PARTS) await page.getByTestId(`nav-${p}`).waitFor()
  assert((await page.getByTestId('view-students').getAttribute('aria-checked')) === 'true', 'the app should open in the Students face')
})

await step('C: select three documents and build a real vector index', async () => {
  await tick(['Complaint handling', 'Batch hold and release', 'Can seam inspection'])
  await build()
  await page.getByTestId('vectors-result').filter({ hasText: /from 3 documents/ }).waitFor()
  await shot('02-build')
})

await step('D+E: ask → fragments under the answer (Students), real cosine ranking via Full details (Tech)', async () => {
  await ask('Up to what amount can I approve a refund myself?')
  const answer = page.getByTestId('answer').last()
  assert(/\b1\b/.test(await answer.innerText()), 'answer should cite a source')
  await page.locator('[data-panel=chat] [data-testid=context-list]').last().waitFor()
  await face('tech')
  assert((await viewOf('case')) === 'tech', 'the Case part should stay open in the Tech face')
  // Leave Retrieval first (it is the default tab), so the check below proves that "Full details" selects it.
  await page.getByTestId('tab-pipeline').click()
  assert((await page.getByTestId('tab-retrieval').getAttribute('data-state')) === 'inactive', 'Retrieval should be left before "Full details"')
  await page.locator('[data-panel=chat] button[aria-expanded]').last().click()
  await page.getByTestId('full-details').last().click()
  assert((await page.getByTestId('tab-retrieval').getAttribute('data-state')) === 'active', '"Full details" should open the Retrieval tab')
  const ranked = page.getByTestId('ranked-results')
  await ranked.waitFor()
  const first = await ranked.locator('li').first().innerText()
  assert(/Complaint handling/.test(first), `top result should be Complaint handling, got: ${first.slice(0, 80)}`)
  assert(/0\.\d{3}/.test(first), 'scores visible')
  await shot('03-retrieval')
})

await step('E: citation opens the source document with the chunk highlighted', async () => {
  await page.getByTestId('answer').last().getByRole('button', { name: /\[1\]|^1$/ }).first().click()
  await page.locator('mark.mark-hit, .mark-hit').first().waitFor({ timeout: 5000 })
  await shot('04-citation')
  await page.keyboard.press('Escape')
})

await step('F: vector map (Vector database · Tech) and pipeline (Case · Tech) show the real run', async () => {
  await nav('vectors')
  await page.locator('[data-testid=embedding-plot] .main-svg').first().waitFor({ timeout: 20000 })
  const legend = await page.locator('[data-testid=embedding-plot]').innerText()
  assert(/Your question/.test(legend), 'question in the centre of the question view')
  assert(/top-\d+ cut-off/.test(legend), 'top-k ring in the question view')
  await page.getByRole('tab', { name: '2D', exact: true }).click()
  await page.waitForFunction(() => /Questions/.test(document.querySelector('[data-testid=embedding-plot]')?.innerText ?? ''), null, { timeout: 10000 })
  await shot('05-map')
  await nav('case')
  await page.getByTestId('tab-pipeline').click()
  await page.locator('.react-flow__node').first().waitFor()
  const completed = await page.locator('.react-flow__node', { hasText: 'Completed' }).count()
  assert(completed >= 9, `expected ≥ 9 completed stages, got ${completed}`)
  await shot('06-pipeline')
})

await step('a: the switch keeps the part and changes its face', async () => {
  await nav('vectors')
  const before = await viewOf('vectors')
  await face(before === 'tech' ? 'students' : 'tech')
  await page.getByTestId('part-vectors').waitFor()
  const after = await viewOf('vectors')
  assert(after && after !== before, `data-view should change, stayed ${after}`)
  assert((await page.getByTestId('nav-vectors').getAttribute('aria-current')) === 'page', 'still on Vector database')
  await face('students')
})

await step('guide button shows the guide in both faces without changing the face', async () => {
  for (const v of ['students', 'tech']) {
    await face(v)
    await nav('generator')
    await guideButton().click()
    assert((await viewOf('case')) === v, `the face changed from ${v}`)
    await page.locator('[data-guide-step=sources]').waitFor()
    if (v === 'tech') assert((await page.getByTestId('tab-guide').getAttribute('data-state')) === 'active', 'Guide tab not selected')
  }
  await face('students')
})

await step('Compare mode (Generator · Students): answers with and without documents', async () => {
  await nav('generator')
  await page.getByTestId('answer-mode').getByRole('button').nth(2).click()
  assert((await page.getByTestId('answer-mode').getAttribute('data-mode')) === 'both', 'answer mode "both"')
  await nav('case')
  await page.getByTestId('chat-input').fill('How often is the can seam inspected?')
  await page.getByTestId('chat-input').press('Enter')
  await page.getByTestId('baseline-answer').last().locator('text=/out tokens/').waitFor({ timeout: 30000 })
  await shot('07-compare')
  await nav('generator')
  await page.getByTestId('answer-mode').getByRole('button').nth(0).click()
})

await step('b: untick a document → stale alert; the build removes it', async () => {
  await tick(['Can seam inspection'])
  await page.getByTestId('data-stale').waitFor()
  await build()
  await page.getByTestId('vectors-result').filter({ hasText: /from 2 documents/ }).waitFor()
  await nav('data')
  assert((await page.getByTestId('data-stale').count()) === 0, 'stale alert should be gone after the build')
  // The folders opened by tick() are still open after leaving Data and coming back.
  assert((await page.locator('[data-folder-toggle=production]').getAttribute('aria-label'))?.startsWith('Collapse'), 'folders should keep their open state')
})

await step('c: a benchmark run gives every built-in case a verdict mark (pass, fail, or waiting for the participant); the build waits; the CSV downloads', async () => {
  await nav('benchmark')
  await page.getByTestId('bench-cost').filter({ hasText: /questions = \d+ requests, you have \d+ left/ }).waitFor()
  // The mock answers in milliseconds: slow each answer down so the run is still going while we look.
  const slow = (route) => setTimeout(() => route.continue().catch(() => {}), 1500)
  await page.route('**/api/chat', slow)
  try {
    await page.getByTestId('bench-run').click()
    await page.getByTestId('bench-progress').waitFor()
    // The build is held back, with its reason, while the run lasts. (Changing a decision now would end the
    // run: a benchmark never scores a database that differs from the decisions on screen.)
    await nav('vectors')
    await page.getByTestId('build-blocked-bench').waitFor({ timeout: 3000 })
  } finally {
    await page.unroute('**/api/chat', slow)
  }
  await nav('benchmark')
  await page.waitForFunction(() => !document.querySelector('[data-testid=bench-progress]'), null, { timeout: 60000 })
  const verdicts = await page.locator('[data-testid=bench-cases] [data-case]').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-verdict')))
  assert(verdicts.length >= 4, `expected the 4 built-in cases, got ${verdicts.length}`)
  // 'waiting' is a verdict mark too: the case waits for the participant's own verdict.
  assert(verdicts.every((v) => v === 'pass' || v === 'fail' || v === 'waiting'), `every case needs a verdict mark: ${verdicts.join(',')}`)
  await nav('vectors')
  assert((await page.getByTestId('build-blocked-bench').count()) === 0, 'the build-blocked note should go away when the run ends')
  await nav('benchmark')
  await page.getByTestId('bench-runs').locator('tbody tr').first().waitFor()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('bench-export').click()])
  assert(/\.csv$/.test(download.suggestedFilename()), `CSV expected, got ${download.suggestedFilename()}`)
  const csv = readFileSync(await download.path(), 'utf8')
  assert(csv.split('\r\n').length >= 6 && /Run time;/.test(csv), 'CSV header and one row per case')
  await shot('08-benchmark')
})

await step('G: the local vector index survives a reload', async () => {
  await page.reload()
  await activateWith(code)
  await nav('vectors')
  await page.getByTestId('vectors-result').filter({ hasText: /from 2 documents/ }).waitFor({ timeout: 10000 })
})

await step('I: no provider secrets in the bundle or browser storage', async () => {
  const dist = new URL('../dist/assets/', import.meta.url)
  const needles = [/sk-[A-Za-z0-9]{20,}/, /PROVIDER_API_KEY/, /CODE_PEPPER/, /ADMIN_TOKEN/]
  for (const f of readdirSync(dist)) {
    const s = readFileSync(new URL(f, dist), 'utf8')
    for (const n of needles) assert(!n.test(s), `${f} matches ${n}`)
  }
  const ls = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie)
  assert(!/token|RAG-[0-9A-Z]{4}/.test(ls.replace(/"rag-lab-(theme|prefs-v1)"/g, '')), 'session token or code found in web storage')
})

await step('d: at 390 px nothing overflows sideways, in any part or face', async () => {
  await page.setViewportSize({ width: 390, height: 844 })
  const over = []
  for (const v of ['students', 'tech']) {
    await face(v)
    for (const p of PARTS) {
      await nav(p)
      await page.getByTestId(`part-${p}`).waitFor()
      await page.waitForTimeout(p === 'vectors' && v === 'tech' ? 1500 : 200)
      const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }))
      if (sw > iw) over.push(`${v}/${p}: ${sw} > ${iw}`)
    }
  }
  await face('students')
  await nav('benchmark')
  await shot('09-mobile-benchmark')
  assert(over.length === 0, over.join('; '))
})

await step('no uncaught page errors', async () => assert(errors.length === 0, errors.join('\n')))
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
