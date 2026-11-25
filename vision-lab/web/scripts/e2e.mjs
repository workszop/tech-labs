#!/usr/bin/env node
// End-to-end check of RYBEX Vision Lab in headless Chromium (Playwright).
//
//   npm run build && npm run preview        (http://localhost:4175/)
//   node scripts/e2e.mjs [--shots <dir>]
//
// Environment: VISION_LAB_WEB (default http://localhost:4175/), CHROME_BIN (optional executable).
//
// Flow: fresh lab -> synthetic starter set rendered -> manual inspection -> remove a low-quality
// image -> label (team labels) -> real training -> evaluation on test and stress sets ->
// production line driven by the trained model -> capture an image back into the dataset ->
// business dashboard -> experiments -> reload (session resumes) -> Polish UI.
// Exits 1 with the list of failed checks. Training is real, so thresholds are deliberately loose.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) } catch { ({ chromium } = await import('playwright')) }

const WEB = process.env.VISION_LAB_WEB ?? 'http://localhost:4175/'
const shotsAt = process.argv.indexOf('--shots'), SHOTS = shotsAt > 0 ? process.argv[shotsAt + 1] : null
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
const failures = []
const check = (ok, name, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`); if (!ok) failures.push(name) }

const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g/.test(m.text())) errors.push(m.text()) })
const state = (f) => page.evaluate(`(${f})(window.__visionLab.getState())`)
const waitState = (f, timeout = 240000) => page.waitForFunction(`(${f})(window.__visionLab.getState())`, null, { timeout, polling: 500 })
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }) }
const stage = async (n) => { await page.locator('nav.side .side-item').nth(n - 1).click(); await page.waitForTimeout(400) }
const pct = (v) => (v * 100).toFixed(1) + '%'

await page.goto(WEB + '?lang=en')
await page.waitForFunction('window.__visionLab && window.__visionLab.getState().ready')
check(await state('s => s.samples.filter(x => x.source === "photo").length') === 210, 'red-label photos loaded')
await waitState('s => s.seeded')
const syn = await state('s => s.samples.filter(x => x.source === "synthetic").length')
check(syn > 300, 'synthetic starter set rendered', `${syn} images`)
check(await state('s => new Set(s.samples.filter(x => x.pool === "dev").map(x => x.group)).size > 0 && s.samples.filter(x => x.pool !== "dev").every(t => !s.samples.some(d => d.pool === "dev" && d.group === t.group))'), 'no tin or scene is shared between the training pool and the held-out sets')
await shot('1-problem')

// Stage 1: manual inspection (always "accept": 6 of 12 correct)
await page.getByRole('button', { name: 'Start the inspection' }).click()
for (let i = 0; i < 12; i++) { await page.locator('.manual img').waitFor(); await page.waitForTimeout(60); await page.keyboard.press('a') }
check(await state('s => s.manual && s.manual.total === 12 && s.manual.falseAccept === 6'), 'manual inspection recorded')

// Stage 2: remove one low-quality image, generate four more
await stage(2)
const lowId = await state('s => s.samples.find(x => x.meta.lowQuality).id')
await page.locator(`.thumbs.scroll .thumb[title="${lowId}"]`).click()
await page.getByRole('button', { name: 'Remove', exact: true }).click()
check(await state('s => s.lowQualityFound') === 1, 'low-quality image removed')
const before = await state('s => s.samples.length')
await page.getByRole('button', { name: /^Generate \d+ images$/ }).click()
await waitState(`s => s.samples.length >= ${before + 24} && !s.progress`)
check(true, 'generator added images')
await shot('2-data')

// Stage 3: label one by hand, the rest from the team's notes
await stage(3)
await page.keyboard.press('1')
check(await state('s => s.samples.filter(x => x.pool === "dev" && x.label !== null).length') === 1, 'keyboard labelling works')
await page.getByRole('button', { name: /Use the team’s labels/ }).click()
const labelled = await state('s => s.samples.filter(x => x.pool === "dev" && x.selected && !x.removed && x.label !== null).length')
check(labelled > 250, 'training images labelled', `${labelled}`)
await page.getByRole('button', { name: 'Correct them all' }).click().catch(() => {})
await shot('3-label')

// Stage 4: real training
await stage(4)
await page.getByRole('button', { name: 'Train the model' }).click()
await waitState('s => s.training && s.training.epoch >= 3', 300000)
await shot('4-training-live')
await waitState('s => !s.training && s.runs.length === 1 && s.runs[0].test && !s.progress', 600000)
const run = await state('s => s.runs[0]')
console.log(`     training: ${run.data.train} images, ${run.history.acc.length} epochs, ${run.seconds.toFixed(1)} s on ${run.backend}; train ${pct(run.history.acc.at(-1))}, val ${pct(run.history.valAcc.at(-1))}`)
console.log(`     test: acc ${pct(run.test.accuracy)} precision ${pct(run.test.precision)} recall ${pct(run.test.recall)} FAR ${pct(run.test.far)} FRR ${pct(run.test.frr)} (n=${run.test.n})`)
console.log('     stress: ' + Object.entries(run.stress).map(([k, v]) => `${k} ${pct(v.accuracy)}`).join(', '))
check(run.history.acc.length === 30 && run.history.loss[0] > run.history.loss.at(-1), 'loss decreased during training')
check(run.history.valAcc.at(-1) > 0.8, 'validation accuracy above 80%')
check(run.test.accuracy > 0.7, 'test accuracy above 70%')
check(Object.keys(run.stress).length === 6, 'all six stress sets evaluated')
await shot('4-train')

// Stage 5
await stage(5)
await page.locator('.cm2').waitFor()
const far0 = run.test.far
await page.locator('.field input[type=range]').first().fill('0.1')
const far1 = await state('s => s.runs[0].test.far'), frr1 = await state('s => s.runs[0].test.frr')
check(far1 <= far0 && frr1 >= run.test.frr, 'lower threshold: fewer false acceptances, more false rejections', `FAR ${pct(far0)} -> ${pct(far1)}, FRR ${pct(run.test.frr)} -> ${pct(frr1)}`)
await page.locator('.field input[type=range]').first().fill('0.5')
await page.getByRole('button', { name: 'Unseen packaging' }).click()
await shot('5-evaluate')

// Stage 6: the model drives the line
await stage(6)
await page.locator('.line-canvas').waitFor()
await page.locator('.panel', { hasText: 'Line controls' }).locator('input[type=range]').first().fill('120')
await waitState('s => s.lineStats.inspected >= 25', 300000)
const ls = await state('s => s.lineStats')
const right = ls.tp + ls.tn, decided = ls.tp + ls.tn + ls.fp + ls.fn
console.log(`     line: ${ls.inspected} inspected, ${right}/${decided} correct, escaped ${ls.fn}, wasted ${ls.fp}, late ${ls.uninspected}, inference ${(ls.inferenceMsSum / Math.max(1, ls.inferenceCount)).toFixed(0)} ms`)
check(ls.inferenceCount > 0, 'model ran on camera frames')
check(decided > 0 && right / decided > 0.7, 'line decisions mostly correct', `${right}/${decided}`)
await shot('6-line')
const pool = await state('s => s.samples.length')
await page.locator('.thumbs.short .thumb').first().click()
await page.getByRole('button', { name: 'Add to training data' }).click()
await waitState(`s => s.samples.length === ${pool + 1} && s.samples.at(-1).source === "line" && s.samples.at(-1).label === null`)
check(true, 'camera frame captured into the training pool (unlabelled)')

// Stage 7
await stage(7)
check(await page.locator('table.num tbody tr.total td').count() >= 3, 'business comparison shows manual and AI scenarios')
await shot('7-business')

// Experiments
await stage(8)
check(await page.locator('.exp').count() === 9, 'nine experiments listed')
await page.locator('.exp').first().getByRole('button').click()
check(await state('s => s.train.maxImages === 20 && s.stage === 4 && s.experiment === "few"'), 'experiment "few images" configures training')
await stage(8); await shot('8-experiments')
await page.getByRole('button', { name: 'Restore the standard setup' }).click()

// Resume after reload, Polish UI
await page.waitForTimeout(1200)
await page.goto(WEB)
await page.waitForFunction('window.__visionLab && window.__visionLab.getState().ready')
await waitState('s => s.modelVersion > 0 && s.currentRunId', 60000)
check(await state('s => s.runs.length === 1 && s.manual.total === 12 && s.samples.some(x => x.source === "line")'), 'session resumed after reload (model, results, dataset)')
await page.getByRole('button', { name: 'PL', exact: true }).click()
check(await page.locator('nav.side').innerText().then((t) => t.includes('Wytrenuj model')), 'Polish interface')
await shot('9-polish')

check(errors.length === 0, 'no uncaught errors', errors.slice(0, 3).join(' | '))
await browser.close()
if (failures.length) { console.error(`\n${failures.length} check(s) failed:\n - ${failures.join('\n - ')}`); process.exit(1) }
console.log('\nAll checks passed.')
