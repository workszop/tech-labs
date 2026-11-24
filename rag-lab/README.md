# RAG Lab: build your own knowledge engine

RAG Lab is an interactive, transparent **Retrieval-Augmented Generation** playground for beginners. You get the documents of a fictional company, Northstar Technologies: 21 documents in 5 folders. You choose which documents to index and watch each step of the pipeline:

**select → chunk → embed → store vectors → ask → embed question → cosine search → assemble context → generate → cite**

The app is bilingual. It opens in **Polish**, and the PL/EN switch in the header changes the interface, the company documents and the prompt sent to the model. Switching the language clears the knowledge base, because an index built from one language version cannot be mixed with the other. Texts live in `web/src/i18n/{pl,en}/`, the Polish documents in `web/src/data/pl/`, and the Polish prompt in `shared/prompt.ts`.

Every number on screen comes from a real operation:
- token counts from the real `cl100k_base` tokenizer
- real chunks
- real embedding vectors from the model
- exact cosine scores
- the exact prompt sent to the LLM (the Worker sends it back with the answer)
- token usage reported by the provider

```
┌──────────────── GitHub Pages (static) ────────────────┐      ┌──── Cloudflare Worker ────┐      ┌── AI provider ──┐
│ React + TS + Vite + Tailwind + shadcn/ui              │      │ access codes (D1, hashed) │      │ OpenAI-         │
│ • file explorer, preview, selection                   │ HTTPS│ sessions (bearer, hashed) │ HTTPS│ compatible API  │
│ • chunking + tokenizer in a Web Worker                │─────▶│ rate limits + quotas      │─────▶│ embeddings      │
│ • vector DB in IndexedDB (Dexie, Float32Array)        │      │ cost accounting           │      │ chat            │
│ • exact cosine search, top-k, threshold               │      │ embeddings + chat proxy   │      └─────────────────┘
│ • PCA (Web Worker) → Plotly 2D/3D map                 │      │ admin API (Access/token)  │
│ • React Flow pipeline, chat, citations, explainers    │      └───────────────────────────┘
└───────────────────────────────────────────────────────┘
```

| Path | What |
|------|------|
| `web/` | The browser app. Its main parts are `src/rag/` (chunker, similarity, PCA, tokenizer, IndexedDB store), `src/api/` (Worker client and SSE parser), `src/state/` (store and pipeline orchestration), `src/features/` (UI) and `src/data/documents.ts` (corpus). |
| `worker/` | The Cloudflare Worker API gateway, D1 migrations, admin CLI and tests. See [`worker/README.md`](worker/README.md). |
| `shared/` | The API contract (`api-types.ts`) and the prompt template (`prompt.ts`). Both apps use them. |
| `../.github/workflows/pages.yml` | CI for both apps, plus GitHub Pages deployment. |
| `../.github/workflows/rag-lab-worker-deploy.yml` | Manual deployment of the Worker. |

---

## 1. Local development

Requirements: Node 20+ (22 recommended).

```sh
# Terminal 1: the API (offline "mock" models: no API key needed)
cd rag-lab/worker
npm install
cp .dev.vars.example .dev.vars        # PROVIDER=mock, dev ADMIN_TOKEN, random CODE_PEPPER
npm run db:migrate:local
npm run dev                           # http://localhost:8787

# Terminal 2: create a participant access code (shown once)
cd rag-lab/worker
RAG_LAB_API=http://localhost:8787 RAG_LAB_ADMIN_TOKEN=dev-admin-token-change-me-0123456789 \
  npm run admin -- create --label "local dev"

# Terminal 3: the web app
cd rag-lab/web
npm install
echo "VITE_API_BASE_URL=http://localhost:8787" > .env.local
npm run dev                           # http://localhost:5173
```

The **mock provider** (`PROVIDER=mock`) is for development, tests and workshops without a key. It is deterministic:
- **Embeddings:** word-hash vectors with 256 dimensions. Texts that share wording really are similar.
- **Answers:** sentences extracted from the retrieved context, with citations.

The UI shows an **"Offline demo models"** badge while the mock provider is active, so mock results are never presented as a real AI model.

To use real models locally, set `PROVIDER=openai-compatible` and `PROVIDER_API_KEY=sk-...` in `worker/.dev.vars`.

**Checks:**

```sh
cd rag-lab/web    && npm run typecheck && npm test && npm run build
cd rag-lab/worker && npm run typecheck && npm test
cd rag-lab/web    && node scripts/e2e.mjs   # end-to-end: needs the worker (mock) on :8787 and `npm run preview` on :4173
```

## 2. GitHub Pages deployment

1. In repository **Settings → Pages**, set **Source** to **GitHub Actions**.
2. Under **Settings → Secrets and variables → Actions → Variables**, add `RAG_LAB_API_BASE_URL`, for example `https://rag-lab-api.<account>.workers.dev`.
   - Make it a *variable*, not a secret. It ends up in public JavaScript.
   - **Never** put API keys in `VITE_*` variables.
3. Push to the default branch, or run the workflow by hand.
   - The workflow type-checks, tests and builds both apps.
   - It then publishes the labs index at the site root and RAG Lab at `https://tech-labs.warsztaty-ai.com/rag-lab/`.

The build uses a **relative base path** (`base: './'`), so the same output works at any sub-path. You can override it with `VITE_BASE`. The app has no client-side routes (state lives in memory), so deep-link 404s cannot happen on Pages.

## 3. Cloudflare Worker deployment

```sh
cd rag-lab/worker
npx wrangler login
npx wrangler d1 create rag-lab               # copy database_id into wrangler.jsonc
npm run db:migrate:remote
npx wrangler secret put CODE_PEPPER          # long random string; used to HMAC access codes
npx wrangler secret put ADMIN_TOKEN          # ≥ 32 random chars, for the admin API/CLI
npx wrangler secret put PROVIDER_API_KEY     # your OpenAI (or compatible) key
# edit wrangler.jsonc vars: ALLOWED_ORIGINS=https://<user>.github.io, CHAT_MODEL, prices…
npm run deploy
```

You can also run the manual workflow **RAG Lab → Cloudflare Worker**. It needs the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

`ALLOWED_ORIGINS` must hold the **origin** only: `https://<user>.github.io`, without the repository path.

## 4. D1 database initialization

The schema is in `worker/migrations/0001_init.sql`. It has four tables:
- `access_codes`: keyed hash, limits, usage counters, status
- `sessions`: SHA-256 of the bearer token, expiry, revocation
- `usage_events`: tokens, cost and operation; **no prompts or document text**
- `rate_limits`

Apply it with `npm run db:migrate:local` or `npm run db:migrate:remote`. A daily cron job cleans up expired sessions and old rate-limit windows.

## 5. API secret configuration

| Secret | Purpose |
|--------|---------|
| `PROVIDER_API_KEY` | Upstream model API key. Only the Worker reads it, and it is never returned to clients. |
| `CODE_PEPPER` | HMAC key for access-code hashes and hashed client IPs. If it changes, every existing code becomes invalid. |
| `ADMIN_TOKEN` | Bearer token for `/api/admin/*`. Leave it unset if you only use Cloudflare Access. |

Change the provider with `PROVIDER_BASE_URL`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, `CHAT_MODEL` and `ALLOWED_MODELS` in `wrangler.jsonc`. The browser never chooses models or upstream URLs.

## 6. Administrator setup

Admin endpoints (`/api/admin/codes…`) **never** accept participant codes or sessions. Two authentication methods are supported:

- **Cloudflare Access (recommended).** Protect the path `/api/admin/*` of the Worker hostname with an Access application. Then set `ACCESS_TEAM_DOMAIN` (for example `yourteam.cloudflareaccess.com`) and `ACCESS_AUD` (the application's audience tag). The Worker verifies the `Cf-Access-Jwt-Assertion` JWT: RS256 signature, audience, issuer and expiry. For the CLI, use an Access service token: `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`.
- **Admin bearer token.** Set the `ADMIN_TOKEN` secret and send `Authorization: Bearer <token>`. The Worker compares it in constant time.

## 7. Access-code generation

```sh
export RAG_LAB_API=https://rag-lab-api.<account>.workers.dev
export RAG_LAB_ADMIN_TOKEN=...            # or CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET
npm run admin -- create --count 20 --label "Workshop 2026-12-03" --expires 2026-12-04 \
                        --requests 300 --tokens 300000 --max-sessions 2 --csv codes.csv
npm run admin -- list                     # usage, estimated cost, active sessions
npm run admin -- update <id> --tokens 500000 --reset-usage
npm run admin -- update <id> --revoke-sessions
npm run admin -- revoke <id>              # immediate; kills all sessions of that code
```

Codes look like `RAG-XXXX-XXXX-XXXX-XXXX-XXXX`: 100 random bits in Crockford base32. Input is normalised: case, spaces and dashes are ignored, and O/I/L are corrected. Only an HMAC-SHA256 of each code is stored. The plaintext is printed **once**, when the code is created.

## 8. Usage limits

The Worker enforces every limit. The UI only displays them.

| Limit | Default | Where |
|-------|---------|-------|
| Requests per code | 300 | `access_codes.request_limit` (per code; `DEFAULT_REQUEST_LIMIT`) |
| Tokens per code | 300,000 | `access_codes.token_limit` (`DEFAULT_TOKEN_LIMIT`) |
| Concurrent sessions per code | 3 | `max_sessions` (`DEFAULT_MAX_SESSIONS`) |
| Requests per session per minute | 30 | `RATE_LIMIT_PER_MINUTE` |
| Activation attempts per IP | 10 / 15 min | `ACTIVATION_MAX_ATTEMPTS`, `ACTIVATION_WINDOW_SECONDS` |
| Global failed activations | 60 / min | `ACTIVATION_GLOBAL_FAILURES_PER_MINUTE` |
| Embedding batch | 64 inputs, ≤ 2,000 tokens each | Worker constants (shown in `/api/session` capabilities) |
| Chat | ≤ 10 context chunks, ≤ 1,000-char question, ≤ 12,000 input tokens, 64–1,024 output tokens, temperature 0–1 | Worker constants |
| Session lifetime | 4 h | `SESSION_TTL_MINUTES` |

Quotas are reserved **atomically** before each upstream call, with a single conditional `UPDATE … WHERE used + estimate <= limit RETURNING`. They are reconciled to the provider's real token counts afterwards. As a result, parallel requests cannot overshoot a limit; a test checks exactly this case.

## 9. Security assumptions

- **No secrets in the browser.**
  - The provider key exists only as a Worker secret.
  - The frontend bundle contains only the Worker's public URL.
  - The frontend can only call fixed endpoints. It cannot choose upstream URLs or models.
- **Sessions use bearer tokens, not cookies.** GitHub Pages and workers.dev are different sites, and third-party cookies are increasingly blocked, so RAG Lab uses a short-lived bearer token instead:
  - 256-bit random token; only its SHA-256 is stored.
  - The browser keeps it **in memory only**: not in `localStorage`, cookies or URLs. Reloading the page means entering the code again; the local index is kept.
  - Logout revokes it on the server.
  - CORS allows only the configured origins. CORS is **not** treated as authentication: every paid endpoint checks the session independently.
  - Because no cookies are used, CSRF does not apply.
- **The access code is sent once**, to `/api/activate`, and never with model requests.
- **Privacy.**
  - Documents, vectors, the index and similarity search stay in the browser.
  - Text that is embedded, and each question with its retrieved excerpts, is processed by the model provider. The UI says so wherever it applies.
  - The Worker logs counts, not content.
- **Prompt injection.**
  - Retrieved excerpts are fenced in the prompt, and the system prompt says to treat them as untrusted data.
  - The Troubleshooting Guide contains a quoted injection attempt on purpose, for teaching.
- **Threat-model limits.** This setup is built for workshops: small groups, bounded budgets. Anyone holding a valid code can spend that code's budget, so keep limits tight and expiry dates short.

## 10. Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Could not reach the RAG Lab server" | Check that `VITE_API_BASE_URL` was set at build time, the Worker is deployed, and `ALLOWED_ORIGINS` contains your Pages origin exactly (`https://user.github.io`). |
| `origin_not_allowed` | Same as above. For local work, add `http://localhost:5173` and `http://localhost:4173`. |
| Activation always fails | The code has a typo or has expired or been revoked, or `CODE_PEPPER` changed after the code was created. `npm run admin -- list` shows the status. |
| "Rebuild required" banner | The Worker's embedding model or dimensions changed. Vectors from different models cannot be mixed, so click **Build Vector Index** again. Cached vectors are reused only for the same model. |
| Some batches failed | Use **Retry failed batches**. Finished batches are cached, so nothing is embedded twice. |
| Index disappears after a reload | The browser blocks IndexedDB (some private windows), or site data was cleared. A banner warns about this. |
| Pages shows a blank page | Make sure the Pages source is **GitHub Actions** and the site is opened at `…/rag-lab/`. |
| `quota_exceeded` | The code's request or token budget is used up. Raise it with `admin update <id> --tokens …` or `--reset-usage`. |
