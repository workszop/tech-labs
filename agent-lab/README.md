# Service Agent Lab: watch an AI agent work

Service Agent Lab is an interactive, transparent playground for **tool-calling AI agents**. The fictional company Northstar Appliances sells coffee machines, vacuum cleaners, air purifiers and kitchen appliances. A customer writes to its support chat, and an LLM agent answers by calling tools against the company's systems: orders, products, warranties, logistics, CRM, a service knowledge base and service tickets. You see every step:

**customer message → model turn → tool calls (validated by the Worker) → tool results from the company systems → next model turn → … → final answer with sources**

What it teaches:
- how a model decides which tool to call, with which arguments, and what it does with the result
- that the model never touches the data itself: the application executes each tool, and the tool only returns the signed-in customer's records (asking for someone else's order is refused)
- retrieval as one tool among others (`search_service_knowledge`), including superseded documents the agent must not rely on
- human approval: the one state-changing tool, `create_service_ticket`, waits for the customer's Approve or Reject
- limits: steps, tool calls, tokens, timeouts and repeated calls end a run with an honest message, never silently

The app is bilingual. It opens in **Polish**; the PL/EN switch in the header changes the interface, the company texts, the knowledge base and the agent's system prompt, and starts a new conversation. Nine predefined scenarios (an error code on a coffee machine, a delayed replacement part, a warranty question, a repeated fault, a sensor error, a complaint about an overdue repair, an ambiguous request, a paid repair that needs a ticket, and someone else's order) cover the typical paths; you can also write your own messages and sign in as any of the 20 customers.

Every number on screen comes from a real operation: the tool calls the model really made, the arguments and results exchanged, durations measured in the browser, token usage reported by the provider, and the real cosine scores of the knowledge-base search. The model's reasoning is never shown or requested; only tool calls, results, statuses and the text the customer sees. Business dates (warranty, delivery estimates) use the fixed simulation date **2026-11-24** (`shared/sim.ts`), so the scenarios behave the same on every day.

```
┌──────────────────── GitHub Pages (static) ─────────────────────┐      ┌──── Cloudflare Worker ─────────┐      ┌── AI provider ───┐
│ React + TS + Vite + Tailwind + shadcn/ui + React Flow          │      │ access codes (D1, HMAC)        │      │ OpenAI-          │
│ • simulated company systems in IndexedDB (Dexie): customers,   │ HTTPS│ sessions (bearer, hashed)      │ HTTPS│ compatible API   │
│   orders, products, warranties, shipments, cases, tickets      │─────▶│ rate limits + quotas + cost    │─────▶│ chat with        │
│ • the ten tools, executed in the browser for the signed-in     │      │ embeddings proxy               │      │ function calling │
│   customer only                                                │      │ POST /api/agent: system prompt,│      │ embeddings       │
│ • knowledge base: chunking, vectors in IndexedDB, cosine top-k │      │ tool definitions, model call,  │      └──────────────────┘
│ • agent loop: sends the transcript, runs the tool calls, asks  │      │ tool-call validation,          │
│   for approval, enforces timeouts and repeated-call limits     │      │ per-run limits                 │
│ • trace UI: chat, execution graph, timeline, inspector, replay │      │ admin API (Access / token)     │
└────────────────────────────────────────────────────────────────┘      └────────────────────────────────┘
```

| Path | What |
|------|------|
| `web/` | The browser app. Main parts: `src/data/` (company records, knowledge base in both languages, the nine scenarios), `src/sim/` (simulation database and the ten tool implementations), `src/kb/` (chunking, indexing, search), `src/agent/` (agent loop and client-side limits), `src/api/` (Worker client), `src/state/` (store and actions), `src/features/` (UI), `scripts/e2e.mjs` (end-to-end check). |
| `worker/` | The Cloudflare Worker API gateway, D1 migrations, admin CLI and tests. See [`worker/README.md`](worker/README.md). |
| `shared/` | Code both sides import: the API contract (`api-types.ts`), the tool registry (`tools.ts`), the agent system prompt (`agent-prompt.ts`) and the simulation date (`sim.ts`). |
| `../.github/workflows/pages.yml` | CI for both labs and the GitHub Pages deployment of the whole site. |
| `../.github/workflows/agent-lab-worker-deploy.yml` | Manual deployment of this lab's Worker. |

## The ten tools

Defined once in `shared/tools.ts`: the Worker sends the definitions to the model and validates its calls; the browser executes them. Every argument is a string checked against a schema (pattern, length, enum).

| Tool | System | Kind |
|------|--------|------|
| `get_customer_profile` | CRM | read-only |
| `get_customer_orders` | Orders | read-only |
| `get_product_details` | Products | read-only |
| `check_warranty` | Warranty | read-only |
| `get_shipments` | Logistics | read-only |
| `track_shipment` | Logistics | read-only |
| `get_crm_history` | CRM | read-only |
| `search_service_knowledge` | Service knowledge base | read-only |
| `get_service_case` | Service tickets | read-only |
| `create_service_ticket` | Service tickets | **state-changing**, needs the customer's approval |

---

## 1. Local development

Requirements: Node 20+ (22 recommended).

```sh
# Terminal 1: the API (offline "mock" models: no API key needed)
cd agent-lab/worker
npm install
cp .dev.vars.example .dev.vars        # PROVIDER=mock, dev ADMIN_TOKEN; put a random CODE_PEPPER in
npm run db:migrate:local
npm run dev                           # http://localhost:8787

# Terminal 2: create a participant access code (shown once)
cd agent-lab/worker
AGENT_LAB_API=http://localhost:8787 AGENT_LAB_ADMIN_TOKEN=dev-admin-token-change-me-0123456789 \
  npm run admin -- create --label "local dev"

# Terminal 3: the web app
cd agent-lab/web
npm install
echo "VITE_API_BASE_URL=http://localhost:8787" > .env.local
npm run dev                           # http://localhost:5173
```

The **mock provider** (`PROVIDER=mock`) is for development, tests and workshops without a key. It is deterministic:
- **Embeddings:** word-hash vectors with 256 dimensions (`mock-hash-embedding-256`). Texts that share wording really are similar.
- **Agent:** `mock-rule-based-agent`, a rule-based stand-in for a tool-calling model. It reads the customer's message (keyword rules in Polish and English) and the tool results already in the transcript, requests the next sensible tools (never more than 3 per turn, never a call that already has a result) and writes its answer from the results, quoting one or two sentences of the best current knowledge-base document. It is a teaching aid that makes the loop visible, not a language model, and it says so in every answer.

The UI shows an **"Offline demo models"** badge while the mock provider is active, so mock results are never presented as a real AI model.

**Checks:**

```sh
cd agent-lab/web    && npm run typecheck && npm test && npm run build
cd agent-lab/worker && npm run typecheck && npm test
```

**End-to-end check** (`web/scripts/e2e.mjs`): drives headless Chrome through the raw DevTools Protocol (no Playwright needed) against a running Worker with the mock provider and a built app. It activates with a fresh code, waits for the knowledge-base index, runs scenario 1 (at least three tool rows, a reply with sources), scenario 8 rejected and then approved (the ticket count in IndexedDB), scenario 9 (an access-denied step), reloads (conversation and data survive), switches the language (interface and document titles change) and checks for page errors and leaked secrets. It takes well under a minute.

```sh
cd agent-lab/web
npm run build && npm run preview &                       # http://localhost:4173 (must be in ALLOWED_ORIGINS)
npm run e2e                                              # or: node scripts/e2e.mjs --shots /tmp/agent-lab-shots
AGENT_LAB_E2E_LANG=en npm run e2e                        # main flow in English, then switch to Polish
```

Its settings come from environment variables (`AGENT_LAB_API`, `AGENT_LAB_WEB`, `AGENT_LAB_ADMIN_TOKEN`, `AGENT_LAB_E2E_LANG`, `AGENT_LAB_DIST`, `AGENT_LAB_E2E_TIMEOUT_MS`, `CHROME_BIN`); the defaults match the commands above and are listed at the top of the script. It exits with code 1 and a list of the failed checks.

### Real models

Set in `worker/.dev.vars` (locally) or in `wrangler.jsonc` plus a secret (deployed):

- `PROVIDER=openai-compatible`
- `PROVIDER_API_KEY=...` (a secret: `npx wrangler secret put PROVIDER_API_KEY`)
- `CHAT_MODEL`: a chat model that supports **function calling** (tool calls, `tool_choice`, parallel tool calls), for example `gpt-4o-mini`
- `EMBEDDING_MODEL` and `EMBEDDING_DIMENSIONS`: an embedding model, for example `text-embedding-3-small` with 1536 dimensions
- both models listed in `ALLOWED_MODELS`; `PROVIDER_BASE_URL` for another OpenAI-compatible endpoint; prices in `*_PRICE_PER_MTOK`

After switching the embedding model the browser re-indexes the knowledge base by itself: vectors of different models are never mixed, and a search against an index built with another model is refused with a clear error.

## 2. GitHub Pages deployment

The whole site (labs index, RAG Lab, Service Agent Lab) is published by one workflow, `.github/workflows/pages.yml`, because a repository has only one Pages deployment.

1. In repository **Settings → Pages**, set **Source** to **GitHub Actions** (already done for RAG Lab).
2. Under **Settings → Secrets and variables → Actions → Variables**, add `AGENT_LAB_API_BASE_URL`, for example `https://agent-lab-api.<account>.workers.dev` (no trailing slash).
   - Make it a *variable*, not a secret. It ends up in public JavaScript.
   - **Never** put API keys in `VITE_*` variables.
   - Until the variable exists, the lab still builds and deploys; it then shows its "cannot reach the server" state.
3. Push to `main`, or run the workflow by hand. It type-checks, tests and builds `agent-lab/web` (with `VITE_API_BASE_URL` from the variable), type-checks and tests `agent-lab/worker`, does the same for RAG Lab, and publishes Service Agent Lab at `https://tech-labs.warsztaty-ai.com/agent-lab/`.

The build uses a **relative base path** (`base: './'`), so the same output works at any sub-path (override with `VITE_BASE`). The app has no client-side routes, so deep-link 404s cannot happen on Pages.

## 3. Cloudflare Worker deployment

The Worker is a separate one from RAG Lab's: `agent-lab-api`, with its own D1 database `agent-lab`.

```sh
cd agent-lab/worker
npx wrangler login
npx wrangler d1 create agent-lab             # paste its database_id over REPLACE_WITH_D1_ID in wrangler.jsonc
npm run db:migrate:remote                    # 0001_init.sql and 0002_agent_runs.sql
npx wrangler secret put CODE_PEPPER          # long random string; HMAC key of the access codes
npx wrangler secret put ADMIN_TOKEN          # >= 24 random chars, for the admin API/CLI
npx wrangler secret put PROVIDER_API_KEY     # only with PROVIDER=openai-compatible
# edit wrangler.jsonc vars: PROVIDER, ALLOWED_ORIGINS, CHAT_MODEL, EMBEDDING_MODEL, prices...
npm run deploy
```

Then set the repository variable `AGENT_LAB_API_BASE_URL` to the Worker's URL and run the Pages workflow again.

`ALLOWED_ORIGINS` holds **origins** only, without paths: `https://tech-labs.warsztaty-ai.com` (and `https://workszop.github.io` if the github.io address is used). `wrangler.jsonc` ships with `PROVIDER=mock`, so a fresh deployment works without a key; switch to `openai-compatible` when the key is set.

Later deployments can use the manual workflow **Service Agent Lab -> Cloudflare Worker** (`.github/workflows/agent-lab-worker-deploy.yml`). It needs the repository secrets `CLOUDFLARE_API_TOKEN` (Workers and D1 edit) and `CLOUDFLARE_ACCOUNT_ID`, runs the Worker tests, applies the D1 migrations and then deploys. Always apply migrations before deploying a new Worker version: migration `0002` rebuilds `usage_events` so that it accepts `agent` usage events.

### D1 tables

- `access_codes`: keyed hash, limits, usage counters, status
- `sessions`: SHA-256 of the bearer token, expiry, revocation
- `usage_events`: tokens, cost and operation (`embeddings` or `agent`); **no prompts, messages or tool data**
- `rate_limits`
- `agent_runs`: per-run counters (steps, tool calls, tokens), owned by one session; no message text

A daily cron job (`17 3 * * *` UTC) removes old sessions, agent runs and rate-limit windows.

## 4. Secrets and configuration

| Secret | Purpose |
|--------|---------|
| `PROVIDER_API_KEY` | Upstream model API key. Only the Worker reads it; it is never returned to clients. Not needed with `PROVIDER=mock`. |
| `CODE_PEPPER` | HMAC key for access-code hashes and hashed client IPs. If it changes, every existing code becomes invalid. |
| `ADMIN_TOKEN` | Bearer token for `/api/admin/*`. Leave it unset if you only use Cloudflare Access. |

Every variable, with its default, is listed in [`worker/README.md`](worker/README.md#configuration-vars). The browser never chooses the provider, models, tools, system prompt or upstream URLs.

## 5. Access codes

Admin endpoints (`/api/admin/codes...`) never accept participant codes or sessions. They are protected by Cloudflare Access (recommended) or the `ADMIN_TOKEN` bearer token; see [`worker/README.md`](worker/README.md).

```sh
export AGENT_LAB_API=https://agent-lab-api.<account>.workers.dev
export AGENT_LAB_ADMIN_TOKEN=...          # or CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET
npm run admin -- create --count 20 --label "Workshop 2026-12-03" --expires 2026-12-04 \
                        --requests 300 --tokens 300000 --max-sessions 2 --csv codes.csv
npm run admin -- list                     # usage, estimated cost, active sessions
npm run admin -- update <id> --tokens 500000 --reset-usage
npm run admin -- revoke <id>              # immediate; ends every session of that code
```

Codes look like `AGT-XXXX-XXXX-XXXX-XXXX-XXXX`: 100 random bits in Crockford base32. Input is normalised (case, spaces and dashes are ignored, O/I/L are corrected). Only an HMAC-SHA256 of each code is stored; the plaintext is printed **once**, when the code is created.

## 6. Limits

The Worker enforces its limits; the browser adds its own run guards. The UI only displays them.

| Limit | Default | Where |
|-------|---------|-------|
| Requests per code | 300 | `access_codes.request_limit` (`DEFAULT_REQUEST_LIMIT`) |
| Tokens per code | 300,000 | `access_codes.token_limit` (`DEFAULT_TOKEN_LIMIT`) |
| Concurrent sessions per code | 3 | `max_sessions` (`DEFAULT_MAX_SESSIONS`) |
| Session lifetime | 4 h | `SESSION_TTL_MINUTES` |
| Requests per session per minute | 90 | `RATE_LIMIT_PER_MINUTE`. Indexing the knowledge base costs about 7 embedding requests per language and every agent step is one request. |
| Activation attempts per IP | 10 / 15 min | `ACTIVATION_MAX_ATTEMPTS`, `ACTIVATION_WINDOW_SECONDS` |
| Global failed activations | 60 / min | `ACTIVATION_GLOBAL_FAILURES_PER_MINUTE` |
| Model turns per run | 8 (the last one without tools) | `AGENT_MAX_STEPS` |
| Tool calls per run / per turn | 12 / 5 | `AGENT_MAX_TOOL_CALLS` / Worker constant |
| Tokens per run | 40,000 | `AGENT_MAX_RUN_TOKENS` |
| One agent request | 60 messages, customer message ≤ 1,000 chars, tool result ≤ 16,000 chars, ≤ 24,000 estimated input tokens, 700 output tokens, temperature 0.2 | Worker constants |
| Embedding batch | 64 inputs, ≤ 2,000 tokens each | Worker constants |
| Model turn / tool / whole run | 60 s / 20 s / 180 s | browser (`web/src/agent/limits.ts`) |
| Identical tool calls | the third identical call (same tool and arguments) ends the run | browser |

A run that reaches a limit always ends with a visible notice and an honest final message. Quotas are reserved **atomically** before each upstream call and reconciled to the provider's token counts afterwards, so parallel requests cannot overshoot a limit.

## 7. Security notes

- **No secrets in the browser.** The provider key exists only as a Worker secret; the bundle contains only the Worker's public URL. The browser cannot choose models, upstream URLs, the system prompt or the tool definitions; a request that tries is refused.
- **Sessions use bearer tokens, not cookies.** 256-bit random token, only its SHA-256 is stored, kept **in browser memory only** (reloading the page means entering the code again; the simulated data and the conversation are kept in IndexedDB). CORS allows only the configured origins and is not treated as authentication.
- **The Worker validates every tool call** of the model: unknown tools, disabled tools, malformed or schema-violating arguments and calls beyond the limits are rejected and reported to the model as errors, so the run goes on and the trace shows the rejection.
- **Tools see one customer.** The tools execute for the signed-in customer only; a request for another customer's order, shipment, case or serial number returns `forbidden` and no field of that record.
- **Human approval** guards the only state-changing tool: no ticket is written, and none is claimed, unless the customer approves it.
- **Privacy.** The company data is fictional. Customer messages, tool results and knowledge-base texts are sent to the model provider as part of the agent requests (and texts to embed as part of embedding requests); the Worker stores counts, not content.
- **Honest limits of a browser-side simulation.** This is a teaching setup, not a production architecture:
  - The company data and the tool execution live in the learner's browser. Anyone can inspect or change the IndexedDB data and the tool results with the browser's developer tools.
  - In a real deployment, CRM, logistics, orders and tickets would sit behind authenticated server APIs, and the server, not the browser, would execute the tools for the authenticated customer.
  - The Worker cannot verify that a tool result sent back by the browser is genuine. It validates what the model asks for, not what the browser answers.
  - Anyone holding a valid code can spend that code's budget, so keep limits tight and expiry dates short.

## 8. Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Cannot reach the server" on the activation screen | `AGENT_LAB_API_BASE_URL` was not set when the Pages workflow ran (the build then points at `localhost:8787`), the Worker is not deployed, or `ALLOWED_ORIGINS` does not contain the page's origin exactly. Set the variable and run the workflow again. |
| `origin_not_allowed` | Same as above. For local work, add `http://localhost:5173` and `http://localhost:4173`. |
| Activation always fails | The code has a typo, has expired or been revoked, or `CODE_PEPPER` changed after the code was created. `npm run admin -- list` shows the status. |
| Every agent turn fails right after a new deployment | The D1 migrations were not applied (`usage_events` rejects `agent` events without `0002`). Run `npm run db:migrate:remote`. |
| `rate_limited` while the knowledge base is indexed or right after a language switch | Indexing a language takes about 7 embedding requests; raise `RATE_LIMIT_PER_MINUTE` (default 90) for heavy use or wait a minute. |
| The knowledge base keeps showing "indexing" or the search tool reports "not ready" | The index of the current language is missing or was built with another embedding model; it is rebuilt automatically. If IndexedDB is blocked (some private windows), the lab cannot keep its data. |
| The agent with a real model never calls tools | The chat model does not support function calling. Use a model that does. |
| `quota_exceeded` | The code's request or token budget is spent. Raise it with `admin update <id> --tokens ...` or `--reset-usage`. |
| Pages shows a blank page | Make sure the Pages source is **GitHub Actions** and the lab is opened at `.../agent-lab/`. |
