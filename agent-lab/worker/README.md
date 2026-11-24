# Service Agent Lab - Worker API gateway

The only server-side component of Service Agent Lab. The browser app (GitHub Pages) does
chunking, vector storage (IndexedDB) and cosine search itself; this Cloudflare
Worker handles:

- access codes → bearer-token sessions
- the embeddings proxy to an OpenAI-compatible provider (or an offline `mock` provider)
- one model turn of the service agent per `POST /api/agent`: system prompt, tool
  definitions, model, validation of the model's tool calls and per-run limits
- rate limits, quotas, usage and cost accounting (D1)
- admin operations (create / list / update / revoke codes)

The API contract is `../shared/api-types.ts`; the tool registry is
`../shared/tools.ts` and the agent system prompt `../shared/agent-prompt.ts`.
They are imported by relative path; wrangler/esbuild bundles them and `tsc`
includes them.

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/health` | none | status, provider, models, boolean config checks (no secrets) |
| POST | `/api/activate` | none | `{code}` → `{token, session}` (throttled) |
| GET | `/api/session` | session | `SessionInfo` |
| POST | `/api/logout` | session | 204, revokes the session (idempotent) |
| GET | `/api/usage` | session | `UsageInfo` |
| POST | `/api/embeddings` | session | `{inputs}` → vectors, rate-limited + quota |
| POST | `/api/agent` | session | `AgentRequest` → `AgentResponse`: one model turn of an agent run, rate-limited + quota + run limits |
| POST | `/api/admin/codes` | admin | create 1..200 codes; plaintext returned once (201) |
| GET | `/api/admin/codes` | admin | list + totals |
| PATCH | `/api/admin/codes/:id` | admin | limits / expiry / label / status / resetUsage / revokeSessions |
| DELETE | `/api/admin/codes/:id` | admin | revoke code + all its sessions (row and usage kept) |

### `POST /api/agent`

The browser drives the agent loop and executes the tools against the simulated
company systems; each model turn is one request carrying the whole transcript.
The Worker builds the system prompt (`buildAgentSystemPrompt`, date `SIM_TODAY`),
sends only the enabled tools, calls the model (temperature 0.2, at most 700
output tokens) and checks every tool call in order: unknown name →
`unknown_tool`, not enabled → `tool_disabled`, arguments not JSON or failing the
tool schema → `invalid_arguments`, beyond 5 per step or the run's remaining
calls → `too_many_calls`. Rejected calls come back in `rejected` (the browser
answers them with an error tool message, the run goes on); valid calls in
`toolCalls` (`create_service_ticket` has `requiresConfirmation: true`).

Runs are tracked in `agent_runs` (counters only, owned by the session that
started them). The last allowed step (`maxSteps`), or any step after the run
used `maxToolCalls`, is sent without tools and returns `forcedFinal: true`;
after `maxSteps` steps or `maxRunTokens` tokens the next request is
`run_limit_exceeded` (409). A client-supplied `model`, `system`, `tools` or
`temperature` is refused.

With `PROVIDER=mock` the turn is answered by `mock-rule-based-agent`
(`src/providers/mock-agent.ts`), a deterministic rule-based stand-in that reads
the latest customer message and the tool results already in the transcript.

Session auth = `Authorization: Bearer <token>`. Tokens are never accepted in
query strings (a request with `?token=`, `?access_token=`, `?code=`… is refused).

## Local development

```bash
cd agent-lab/worker
npm install
cp .dev.vars.example .dev.vars      # PROVIDER=mock, dev ADMIN_TOKEN, put a random CODE_PEPPER in
npm run db:migrate:local            # creates the local D1 in .wrangler/
npm run dev                         # http://localhost:8787
```

`.dev.vars` overrides the production-safe `vars` in `wrangler.jsonc` (which
default to `PROVIDER=openai-compatible`). With `PROVIDER=mock` no API key is needed.

Create a code and try it:

```bash
export AGENT_LAB_API=http://localhost:8787 AGENT_LAB_ADMIN_TOKEN=dev-admin-token-change-me-0123456789
npm run admin -- create --count 3 --label "Local test"
curl -s localhost:8787/api/activate -H 'Content-Type: application/json' -d '{"code":"AGT-…"}'
```

Trigger the cleanup cron locally: `curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=17+3+*+*+*"`.

Tests (real D1 in miniflare via `@cloudflare/vitest-pool-workers`):

```bash
npm run typecheck
npm test
```

> `.npmrc` sets `legacy-peer-deps=true`: npm 10's resolver crashes
> (`Cannot read properties of null (reading 'edgesOut')`) on vitest 4's optional
> peer graph. It does not change what gets installed for this project.

## Deploy

```bash
npx wrangler login
npx wrangler d1 create agent-lab                 # paste the database_id into wrangler.jsonc
npm run db:migrate:remote
npx wrangler secret put CODE_PEPPER            # ≥ 16 chars, random, e.g. 32 bytes base64url - never change it later (all codes depend on it)
npx wrangler secret put ADMIN_TOKEN            # ≥ 24 chars, random
npx wrangler secret put PROVIDER_API_KEY       # your OpenAI / compatible key
# edit vars in wrangler.jsonc: ALLOWED_ORIGINS, models, prices, limits
npm run deploy
```

Generate secrets with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

### Configuration (vars)

| Var | Default | Meaning |
|---|---|---|
| `PROVIDER` | `openai-compatible` | or `mock` (offline, deterministic) |
| `PROVIDER_BASE_URL` | `https://api.openai.com/v1` | any OpenAI-compatible endpoint |
| `EMBEDDING_MODEL` / `CHAT_MODEL` | `text-embedding-3-small` / `gpt-4o-mini` | must be in `ALLOWED_MODELS` (else requests fail with `model_not_allowed`) |
| `EMBEDDING_DIMENSIONS` | `1536` | vectors are validated against it (mock: always 256) |
| `EMBED_TIMEOUT_MS` / `CHAT_TIMEOUT_MS` | 20000 / 60000 | → `upstream_timeout` (`CHAT_TIMEOUT_MS` is per agent turn) |
| `*_PRICE_PER_MTOK` | 0.02 / 0.15 / 0.60 | USD per 1M tokens (embedding, chat input, chat output) |
| `ALLOWED_ORIGINS` | `https://tech-labs.warsztaty-ai.com,https://workszop.github.io` | comma list, exact match |
| `SESSION_TTL_MINUTES` | 240 | absolute session lifetime (never beyond code expiry) |
| `SESSION_IDLE_TIMEOUT_MINUTES` | 0 (off) | idle timeout using sliding `last_activity_at` |
| `RATE_LIMIT_PER_MINUTE` | 30 | per session, embeddings + agent turns |
| `AGENT_MAX_STEPS` / `AGENT_MAX_TOOL_CALLS` / `AGENT_MAX_RUN_TOKENS` | 8 / 12 / 40000 | per agent run; published in `capabilities.agent` |
| `ACTIVATION_MAX_ATTEMPTS` / `ACTIVATION_WINDOW_SECONDS` | 10 / 900 | per client IP (failed + in-flight attempts) |
| `ACTIVATION_GLOBAL_FAILURES_PER_MINUTE` | 60 | all IPs together |
| `ACTIVATION_MIN_RESPONSE_MS` | 250 | failed activations are padded to this duration |
| `DEFAULT_REQUEST_LIMIT` / `DEFAULT_TOKEN_LIMIT` / `DEFAULT_MAX_SESSIONS` | 300 / 300000 / 3 | for new codes |
| `CLEANUP_RETENTION_DAYS` | 7 | cron deletes sessions expired/revoked longer ago, and agent runs older than that |
| `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` | empty | enable Cloudflare Access JWT verification for admin |

Secrets: `CODE_PEPPER`, `ADMIN_TOKEN`, `PROVIDER_API_KEY`.

Optional: uncomment the `ratelimits` block in `wrangler.jsonc` to add a Workers
Rate Limiting binding (`RATE_LIMITER`) as an extra per-session limiter; the D1
limiter works on its own.

## Cloudflare Access for `/api/admin/*` (recommended in production)

1. Zero Trust → Access → Applications → *Add* → Self-hosted.
   Domain: your worker host, path `api/admin/*` (workers.dev hosts are supported; or use a custom domain).
2. Policy: *Allow* your admin e-mails. For the CLI add a second policy *Service Auth* with a
   service token (Access → Service credentials → Service tokens).
3. Copy the application's **AUD tag** and set the vars
   `ACCESS_TEAM_DOMAIN=<team>.cloudflareaccess.com`, `ACCESS_AUD=<aud tag>`, deploy.
4. The Worker then verifies `Cf-Access-Jwt-Assertion` (RS256 against
   `https://<team>/cdn-cgi/access/certs`, checks `aud`, `iss`, `exp`/`nbf`, caches keys 10 min).
   `Authorization: Bearer <ADMIN_TOKEN>` is still accepted as an alternative; with Access in
   front of `/api/admin/*`, every request has to pass Access first anyway. Delete the
   `ADMIN_TOKEN` secret to turn the bearer path off completely.
5. CLI through Access: `export CF_ACCESS_CLIENT_ID=… CF_ACCESS_CLIENT_SECRET=…`.

## Admin CLI

`scripts/admin.mjs` (Node ≥ 20, no deps). Reads `AGENT_LAB_API` (default
`http://localhost:8787`) and `AGENT_LAB_ADMIN_TOKEN`, optionally
`CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`.

```bash
npm run admin -- create --count 10 --label "Workshop Nov" --expires 2026-12-31 \
  --requests 300 --tokens 300000 --max-sessions 3 --csv codes.csv
npm run admin -- list
npm run admin -- update <id> --requests 500 --tokens 500000 --expires none
npm run admin -- update <id> --disable            # or --enable
npm run admin -- update <id> --reset-usage --revoke-sessions
npm run admin -- revoke <id>
```

Every command accepts `--json`. A bare date for `--expires` means the end of that
day (UTC). Plaintext codes are printed once; `--csv` writes them to a file with mode 600.

## Limits

| Limit | Value | Over the limit |
|---|---|---|
| Body size: embeddings / agent / activate / admin | 512 KB / 256 KB / 4 KB / 32 KB | `payload_too_large` 413 |
| Inputs per embeddings call | 64 | 413 |
| Estimated tokens per embedding input | 2000 | 413 |
| Agent transcript | 60 messages; user message 1000 chars; tool result 16000 chars | 413 |
| Estimated agent input tokens (system + tools + transcript) | 24000 | 413 |
| Agent run | 8 steps, 12 tool calls (5 per step), 40000 tokens | `forcedFinal`, then `run_limit_exceeded` 409 |
| Requests per session per minute | `RATE_LIMIT_PER_MINUTE` (30) | `rate_limited` 429 + `retryAfterSeconds` |
| Activation attempts per IP | 10 / 15 min (failed + in-flight) | 429 |
| Failed activations, global | 60 / min | 429 |

A body with `model` different from the server's model is `model_not_allowed`;
`system`, `tools` or `temperature` in an agent request is `invalid_request`.
The client can never choose provider URLs, models, tools or the system prompt.

## Quotas and accounting

- Before calling upstream, one conditional `UPDATE … RETURNING` reserves
  `requests_used + 1` and `tokens_used + estimate` only if the code is active,
  not revoked/expired, and both budgets have room. D1 executes statements
  serially, so parallel requests cannot overshoot (tested: 10 parallel requests
  against a limit of 3 → exactly 3 succeed).
  - estimate: embeddings = Σ ⌈len/4⌉; agent turn = estimated input tokens + 700.
- Afterwards a single D1 batch replaces the estimate with the provider-reported
  usage (or the estimate if none is reported), adds the cost, and inserts a
  `usage_events` row (`ok` / `error` / `aborted`; operation `embeddings` or
  `agent`; token counts only - never prompt or document text).
- **Upstream failure:** the token reservation is refunded; **the request stays
  counted** (it used a request slot; this also caps retry storms against a failing provider).
  A failed agent turn also gives its step back to the run.

## Security notes

- **Access codes**: `AGT-XXXX-XXXX-XXXX-XXXX-XXXX`, 20 Crockford base32 symbols from
  `crypto.getRandomValues` = 100 bits. Input is normalised (trim, uppercase, drop
  spaces/dashes, O→0, I/L→1, optional `AGT` prefix). Only
  `HMAC-SHA256(CODE_PEPPER, normalised)` is stored. Unknown and malformed codes
  get an identical `invalid_code` response, padded to a minimum duration.
- **Sessions**: 32 random bytes, base64url; only `SHA-256(token)` is stored as the
  session id. Cross-site (github.io ↔ workers.dev) → bearer tokens, no cookies,
  so no CSRF surface. Tokens live in browser memory only. `max_sessions` is
  enforced in the same atomic statement that creates the session.
- **Brute force**: per-IP counter keyed by `HMAC(pepper, CF-Connecting-IP)` (raw IPs
  are never stored), incremented atomically *before* checking the code; successes
  give their slot back. Plus a global failed-attempts ceiling.
  *Classroom note:* participants behind one NAT share the IP budget (10 typos /
  15 min); raise `ACTIVATION_MAX_ATTEMPTS` for large workshops.
- **CORS is not auth**: exact-origin allowlist, `Vary: Origin`, no credentials.
  Browser requests from other origins get 403 `origin_not_allowed`; requests
  without `Origin` (curl, CLI) pass CORS but still need auth.
- **Admin** auth is separate (Access JWT or `ADMIN_TOKEN`, constant-time compare;
  disabled if `ADMIN_TOKEN` is shorter than 24 chars). Session tokens are never
  accepted on admin routes.
- **Provider**: URL, key and models come from server config only. Upstream error
  bodies are never forwarded; logs contain only operation, status and the
  upstream error type. All errors are `ApiErrorBody`; unexpected ones are
  `internal` without details.
- **Data minimisation**: no prompts, questions, documents or IPs are stored.
  The cron (`17 3 * * *` UTC) deletes old sessions, agent runs and rate-limit windows.

## Layout

```
src/index.ts            router, CORS, error boundary, scheduled()
src/env.ts              Env + config parsing (defaults)
src/limits.ts           hard limits + Capabilities
src/http.ts             ApiError, JSON helpers, size-limited body reader
src/cors.ts             CORS decisions
src/crypto.ts           random, hashes, HMAC, constant-time compare
src/codes.ts            access-code generation / normalisation / hashing
src/db.ts               row mapping, counters, quota reserve/settle
src/agent-runs.ts       per-run step / tool-call / token counters
src/ratelimit.ts        per-session limiter (D1 + optional binding)
src/scheduled.ts        cleanup cron
src/auth/session.ts     bearer session auth
src/auth/admin.ts       admin auth (ADMIN_TOKEN, Cloudflare Access JWT)
src/routes/*.ts         endpoint handlers
src/providers/          Provider interface, openai-compatible, mock (embeddings), mock-agent (rule-based agent)
migrations/*.sql
scripts/admin.mjs       admin CLI
test/*.test.ts          Vitest (workers pool, real D1)
```
