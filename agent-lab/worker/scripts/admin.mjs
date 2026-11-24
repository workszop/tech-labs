#!/usr/bin/env node
// Service Agent Lab admin CLI (Node ≥ 20, no dependencies).
//
//   AGENT_LAB_API=https://agent-lab-api.<you>.workers.dev AGENT_LAB_ADMIN_TOKEN=... node scripts/admin.mjs <command>
//
// Optional Cloudflare Access service token: CF_ACCESS_CLIENT_ID + CF_ACCESS_CLIENT_SECRET.
import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

const HELP = `Service Agent Lab admin CLI

Usage:
  admin create [--count 10] [--label "Workshop Nov"] [--expires 2026-12-31] [--requests 300]
               [--tokens 300000] [--max-sessions 3] [--csv codes.csv] [--json]
  admin list   [--json]
  admin update <id> [--requests n] [--tokens n] [--max-sessions n] [--label text|none]
               [--expires ISO|none] [--disable | --enable] [--reset-usage] [--revoke-sessions] [--json]
  admin revoke <id> [--json]

Environment:
  AGENT_LAB_API             Worker base URL (default http://localhost:8787)
  AGENT_LAB_ADMIN_TOKEN     ADMIN_TOKEN secret (Authorization: Bearer)
  CF_ACCESS_CLIENT_ID     optional Cloudflare Access service token id
  CF_ACCESS_CLIENT_SECRET optional Cloudflare Access service token secret
`

const base = (process.env.AGENT_LAB_API || 'http://localhost:8787').replace(/\/+$/, '')

function fail(msg, code = 1) {
  process.stderr.write(`error: ${msg}\n`)
  process.exit(code)
}

function headers() {
  const h = { Accept: 'application/json' }
  if (process.env.AGENT_LAB_ADMIN_TOKEN) h.Authorization = `Bearer ${process.env.AGENT_LAB_ADMIN_TOKEN}`
  if (process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET) {
    h['CF-Access-Client-Id'] = process.env.CF_ACCESS_CLIENT_ID
    h['CF-Access-Client-Secret'] = process.env.CF_ACCESS_CLIENT_SECRET
  }
  if (!h.Authorization && !h['CF-Access-Client-Id']) {
    fail('set AGENT_LAB_ADMIN_TOKEN (or CF_ACCESS_CLIENT_ID + CF_ACCESS_CLIENT_SECRET)')
  }
  return h
}

async function call(method, path, body) {
  const init = { method, headers: headers() }
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  let res
  try {
    res = await fetch(base + path, init)
  } catch (err) {
    fail(`cannot reach ${base}: ${err.cause?.code || err.message}`)
  }
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    fail(`HTTP ${res.status}: non-JSON response (is AGENT_LAB_API correct? Cloudflare Access login page?)`)
  }
  if (!res.ok) fail(`HTTP ${res.status} ${data?.error?.code ?? ''}: ${data?.error?.message ?? text}`)
  return data
}

function int(v, name) {
  if (v === undefined) return undefined
  const n = Number(v)
  if (!Number.isInteger(n) || n < 0) fail(`--${name} must be a non-negative integer`)
  return n
}

function expires(v) {
  if (v === undefined) return undefined
  if (v === 'none' || v === 'null' || v === '') return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v // server: end of that day, UTC
  if (Number.isNaN(Date.parse(v))) fail('--expires must be an ISO date/time or "none"')
  return new Date(v).toISOString()
}

const fmtDate = (s) => (s ? s.replace('T', ' ').replace(/\.\d{3}Z$/, 'Z') : '-')
const fmtUsd = (n) => `$${n.toFixed(4)}`

function table(rows, cols) {
  const head = cols.map((c) => c.title)
  const body = rows.map((r) => cols.map((c) => String(c.get(r))))
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i].length)))
  const line = (cells) => cells.map((c, i) => (cols[i].right ? c.padStart(widths[i]) : c.padEnd(widths[i]))).join('  ')
  console.log(line(head))
  console.log(widths.map((w) => '─'.repeat(w)).join('  '))
  for (const b of body) console.log(line(b))
}

const CODE_COLS = [
  { title: 'ID', get: (r) => r.id },
  { title: 'LABEL', get: (r) => r.label ?? '-' },
  { title: 'STATUS', get: (r) => r.status },
  { title: 'REQUESTS', get: (r) => `${r.requestsUsed}/${r.requestLimit}`, right: true },
  { title: 'TOKENS', get: (r) => `${r.tokensUsed}/${r.tokenLimit}`, right: true },
  { title: 'COST', get: (r) => fmtUsd(r.estimatedCostUsd), right: true },
  { title: 'SESS', get: (r) => `${r.activeSessions}/${r.maxSessions}`, right: true },
  { title: 'EXPIRES', get: (r) => fmtDate(r.expiresAt) },
  { title: 'LAST USED', get: (r) => fmtDate(r.lastUsedAt) },
]

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function main() {
  const argv = process.argv.slice(2)
  const cmd = argv[0]
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    process.stdout.write(HELP)
    return
  }
  const { values: o, positionals } = parseArgs({
    args: argv.slice(1),
    allowPositionals: true,
    options: {
      count: { type: 'string' },
      label: { type: 'string' },
      expires: { type: 'string' },
      requests: { type: 'string' },
      tokens: { type: 'string' },
      'max-sessions': { type: 'string' },
      csv: { type: 'string' },
      json: { type: 'boolean' },
      disable: { type: 'boolean' },
      enable: { type: 'boolean' },
      'reset-usage': { type: 'boolean' },
      'revoke-sessions': { type: 'boolean' },
    },
  })

  if (cmd === 'create') {
    const body = {
      count: int(o.count, 'count') ?? 1,
      label: o.label,
      expiresAt: expires(o.expires),
      requestLimit: int(o.requests, 'requests'),
      tokenLimit: int(o.tokens, 'tokens'),
      maxSessions: int(o['max-sessions'], 'max-sessions'),
    }
    const res = await call('POST', '/api/admin/codes', body)
    if (o.json) return console.log(JSON.stringify(res, null, 2))
    console.log(`Created ${res.codes.length} code(s). Plaintext codes are shown ONCE - store them now.\n`)
    table(res.codes, [{ title: 'CODE', get: (r) => r.code }, ...CODE_COLS.slice(0, 3), CODE_COLS[3], CODE_COLS[4], CODE_COLS[6], CODE_COLS[7]])
    if (o.csv) {
      const cols = ['code', 'id', 'label', 'expiresAt', 'requestLimit', 'tokenLimit', 'maxSessions']
      const csv = [cols.join(','), ...res.codes.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n'
      writeFileSync(o.csv, csv, { mode: 0o600 })
      console.log(`\nWrote ${o.csv} (contains plaintext codes - handle with care).`)
    }
    return
  }

  if (cmd === 'list') {
    const res = await call('GET', '/api/admin/codes')
    if (o.json) return console.log(JSON.stringify(res, null, 2))
    if (!res.codes.length) return console.log('No access codes yet.')
    table(res.codes, CODE_COLS)
    console.log(`\n${res.codes.length} code(s) · totals: ${res.totals.requests} requests · ${res.totals.tokens} tokens · ${fmtUsd(res.totals.estimatedCostUsd)}`)
    return
  }

  if (cmd === 'update' || cmd === 'revoke') {
    const id = positionals[0]
    if (!id) fail(`usage: admin ${cmd} <id>`)
    let rec
    if (cmd === 'revoke') {
      rec = await call('DELETE', `/api/admin/codes/${encodeURIComponent(id)}`)
    } else {
      if (o.disable && o.enable) fail('use either --disable or --enable')
      const body = {}
      if (o.requests !== undefined) body.requestLimit = int(o.requests, 'requests')
      if (o.tokens !== undefined) body.tokenLimit = int(o.tokens, 'tokens')
      if (o['max-sessions'] !== undefined) body.maxSessions = int(o['max-sessions'], 'max-sessions')
      if (o.label !== undefined) body.label = o.label === 'none' ? null : o.label
      if (o.expires !== undefined) body.expiresAt = expires(o.expires)
      if (o.disable) body.status = 'disabled'
      if (o.enable) body.status = 'active'
      if (o['reset-usage']) body.resetUsage = true
      if (o['revoke-sessions']) body.revokeSessions = true
      if (!Object.keys(body).length) fail('nothing to update (see --help)')
      rec = await call('PATCH', `/api/admin/codes/${encodeURIComponent(id)}`, body)
    }
    if (o.json) return console.log(JSON.stringify(rec, null, 2))
    table([rec], CODE_COLS)
    return
  }

  fail(`unknown command "${cmd}"\n\n${HELP}`)
}

main().catch((err) => fail(err?.message ?? String(err)))
