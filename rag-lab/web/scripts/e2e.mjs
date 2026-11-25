// End-to-end check of the acceptance scenarios against a running stack:
//   worker:  cd rag-lab/worker && npm run dev            (PROVIDER=mock, http://localhost:8787)
//   web:     cd rag-lab/web && npm run build && npm run preview   (http://localhost:4173)
// Usage: node scripts/e2e.mjs [--shots <dir>]
// Each run makes failed activation attempts on purpose. After ~4 runs within 15 minutes the
// Worker's brute-force protection (10 attempts / IP / 15 min) blocks activation — that is the
// throttle working. Reset it locally with:
//   cd ../worker && npx wrangler d1 execute DB --local --command "DELETE FROM rate_limits"
import { createRequire } from 'node:module'
// Resolved with require() so a globally installed Playwright (NODE_PATH) also works.
const { chromium } = createRequire(import.meta.url)('playwright')
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const API = process.env.RAG_LAB_API ?? 'http://localhost:8787'
const WEB = process.env.RAG_LAB_WEB ?? 'http://localhost:4173/'
const ADMIN = process.env.RAG_LAB_ADMIN_TOKEN ?? 'dev-admin-token-change-me-0123456789'
const shotsIdx = process.argv.indexOf('--shots')
const SHOTS = shotsIdx > 0 ? process.argv[shotsIdx + 1] : null

let failures = 0
const ok = (name) => console.log(`  ✓ ${name}`)
const fail = (name, e) => {
  failures++
  console.log(`  ✗ ${name}\n    ${e?.message ?? e}`)
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

const { codes } = await admin('POST', '/api/admin/codes', { count: 2, label: 'e2e', requestLimit: 200, tokenLimit: 500000 })
const code = codes[0].code
const revoked = codes[1]
await admin('DELETE', `/api/admin/codes/${revoked.id}`)

const browser = await chromium.launch()
// The app opens in Polish by default; these checks use the English labels.
const useEnglish = () => {
  if (!localStorage.getItem('rag-lab-prefs-v1')) localStorage.setItem('rag-lab-prefs-v1', JSON.stringify({ settings: { lang: 'en' }, selection: [] }))
}
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(useEnglish)
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const shot = async (n) => SHOTS && page.screenshot({ path: path.join(SHOTS, `${n}.png`) })

async function activateWith(c) {
  await page.getByLabel('Access code').fill(c)
  await page.getByRole('button', { name: 'Activate' }).click()
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

await step('A: valid code activates the app', async () => {
  await shot('01-activation')
  await activateWith(code)
  await page.getByText('Northstar Technologies').first().waitFor({ timeout: 5000 })
})

await step('C: select three documents and build a real vector index', async () => {
  for (const f of ['Sales', 'Human Resources', 'Customer Support']) await page.getByLabel(`Expand ${f}`).click()
  for (const d of ['Select Refund Policy', 'Select Remote Work Policy', 'Select Enterprise Discounts']) await page.getByLabel(d, { exact: true }).click()
  await page.getByTestId('build-index').click()
  await page.getByText('Index summary').waitFor()
  await page.waitForFunction(() => document.body.innerText.includes('3 indexed'), null, { timeout: 30000 })
  await shot('02-build')
})

await step('D+E: ask a question → real cosine ranking, streamed answer with citations', async () => {
  await page.getByTestId('chat-input').fill('What is the refund policy for annual plans?')
  await page.getByTestId('chat-input').press('Enter')
  const answer = page.getByTestId('answer').last()
  await answer.locator('text=/\\d+ in \\/ \\d+ out tokens/').waitFor({ timeout: 30000 })
  const txt = await answer.innerText()
  assert(/\[1\]|\b1\b/.test(txt), 'answer should cite a source')
  await page.getByTestId('tab-retrieval').click()
  const ranked = page.getByTestId('ranked-results')
  await ranked.waitFor()
  const first = await ranked.locator('li').first().innerText()
  assert(/Refund Policy/.test(first), `top result should be the Refund Policy, got: ${first.slice(0, 80)}`)
  assert(/0\.\d{3}/.test(first), 'scores visible')
  await shot('03-retrieval')
})

await step('E: citation opens the source document with the chunk highlighted', async () => {
  await page.getByTestId('answer').last().getByRole('button', { name: /\[1\]/ }).first().click()
  await page.locator('mark.mark-hit').waitFor({ timeout: 5000 })
  await shot('04-citation')
  await page.keyboard.press('Escape')
})

await step('F: vector map shows document and query points; pipeline shows completed stages', async () => {
  await page.getByTestId('tab-map').click()
  await page.locator('[data-testid=embedding-plot] .main-svg').first().waitFor({ timeout: 20000 })
  const legend = await page.locator('[data-testid=embedding-plot]').innerText()
  assert(/Your question/.test(legend), 'question in the centre of the question view')
  assert(/top-\d+ cut-off/.test(legend), 'top-k ring in the question view')
  await page.getByRole('tab', { name: '2D', exact: true }).click()
  await page.waitForFunction(() => /Questions/.test(document.querySelector('[data-testid=embedding-plot]')?.innerText ?? ''), null, { timeout: 10000 })
  await shot('05-map')
  await page.getByRole('tab', { name: 'Pipeline' }).click()
  await page.locator('.react-flow__node').first().waitFor()
  const completed = await page.locator('.react-flow__node', { hasText: 'Completed' }).count()
  assert(completed >= 9, `expected ≥ 9 completed stages, got ${completed}`)
  await page.locator('.react-flow__node', { hasText: 'Similarity Search' }).click()
  await page.getByTestId('ranked-results').waitFor()
  await shot('06-pipeline')
})

await step('Compare mode: RAG vs no-RAG answers', async () => {
  await page.getByLabel('Compare with no-RAG answer').click()
  await page.getByTestId('chat-input').fill('Can employees work remotely?')
  await page.getByTestId('chat-input').press('Enter')
  await page.getByTestId('baseline-answer').last().locator('text=/out tokens/').waitFor({ timeout: 30000 })
  await shot('07-compare')
})

await step('G: the local vector index survives a reload', async () => {
  await page.reload()
  await activateWith(code)
  await page.waitForFunction(() => document.body.innerText.includes('3 indexed'), null, { timeout: 10000 })
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

await step('Mobile layout uses tabs', async () => {
  const m = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await m.addInitScript(useEnglish)
  await m.goto(WEB)
  await m.getByText('Explore the documents first').click()
  await m.getByRole('navigation', { name: 'Sections' }).waitFor()
  if (SHOTS) await m.screenshot({ path: path.join(SHOTS, '08-mobile.png') })
  await m.close()
})

await step('no uncaught page errors', async () => assert(errors.length === 0, errors.join('\n')))
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
