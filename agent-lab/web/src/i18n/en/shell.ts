// English strings for the app shell: header, activation, panels, errors.
// This file is the source of truth for the dictionary type; pl/shell.ts must mirror its shape.
// Later areas (systems, chat, flow, learn) live in their own files next to this one.
import type { ApiErrorCode } from '@shared/api-types'
import type { RunNoticeKey } from '@/agent/types'

type ErrorCode = ApiErrorCode | 'network' | 'aborted'

export const shell = {
  langSwitch: {
    label: 'Language',
  },

  common: {
    close: 'Close',
  },

  app: {
    sections: 'Sections',
    tabSystems: 'Systems',
    tabWorkspace: 'Agent',
    tabChat: 'Chat',
  },

  panels: {
    workspace: { title: 'Agent workspace', empty: 'The agent’s steps and tool calls will appear here.' },
    chat: { title: 'Customer chat', empty: 'The conversation with the customer will appear here.' },
  },

  header: {
    product: 'Service Agent Lab',
    tagline: 'See how an AI agent serves a customer',
    mockTooltip: 'The server runs in offline demo mode: the answers come from a scripted stand-in, not from a real AI model.',
    mockBadge: 'Offline demo models',
    usageTooltip: (u: { requestsUsed: string; requestLimit: string; tokensUsed: string; tokenLimit: string; cost: string }) =>
      `Requests ${u.requestsUsed}/${u.requestLimit} · Tokens ${u.tokensUsed}/${u.tokenLimit} · est. ${u.cost}`,
    tokensLeft: (formatted: string, _n: number) => `${formatted} tokens left`,
    activate: 'Activate',
    simDate: 'Simulation date',
    simDateTooltip: 'The company systems live on this date: warranties, deliveries and promised dates are checked against it, not against your clock.',
    kb: {
      label: 'Knowledge base',
      idle: 'Not indexed',
      checking: 'Checking…',
      indexing: (done: number, total: number) => `Indexing ${done}/${total}`,
      ready: 'Ready',
      error: 'Error',
      tooltip: 'Before the agent can search the service documents, their chunks are turned into vectors (embeddings) through the server and stored in this browser.',
    },
    mockBadgeShort: 'Offline demo',
    status: {
      button: 'Lab status',
      title: 'Lab status',
      ok: 'Everything is ready.',
      warn: 'Not everything is ready yet: see below.',
      danger: 'Something needs your attention: see below.',
      model: 'AI model',
      quota: 'AI allowance',
    },
    logout: 'Log out',
  },

  reset: {
    button: 'Reset',
    menuLabel: 'Reset options',
    newConversation: 'New conversation',
    newConversationHint: 'Clears the chat. Company data and earlier runs stay.',
    resetAll: 'Reset everything',
    resetAllHint: 'Restores the company data, removes tickets and runs, turns all tools back on.',
    confirmNewTitle: 'Start a new conversation?',
    confirmNewBody: 'The current chat with the customer is cleared and the agent starts without its history. Company data and earlier runs stay.',
    confirmResetTitle: 'Reset everything?',
    confirmResetBody: 'The company data returns to its original state (tickets created by the agent are removed), the runs and the conversation are deleted and all tools are switched on again. The language and the knowledge base index are kept.',
    confirmNew: 'Start new conversation',
    confirmReset: 'Reset everything',
    cancel: 'Cancel',
  },

  activation: {
    title: 'Welcome to Service Agent Lab',
    subtitle: 'See how an AI agent handles a customer request, step by step.',
    formTitle: 'Enter your access code',
    codeLabel: 'Access code',
    codePlaceholder: 'AGT-XXXX-XXXX-XXXX-XXXX-XXXX',
    checking: 'Checking code…',
    submit: 'Activate',
    help: 'Your workshop host gives you a personal code. It unlocks the AI models the agent runs on, with a fair-use allowance tracked on the server.',
    privacyLocal: 'The company data in this lab is fictional. The conversation and the results of the agent’s tools are sent to the AI provider through the Service Agent Lab server.',
    sessionNote: 'The session is kept in memory only. After a page reload you enter the code again.',
    explore: 'Look around first',
    exploreNote: 'Without a code you can look around the layout; the agent itself stays locked.',
    apiLabel: (url: string) => `API: ${url}`,
    rateLimited: (minutes: number | null) => `Too many attempts. Please wait ${minutes ? minutes + ' minute(s)' : 'a few minutes'} and try again.`,
    errors: {
      invalid_code: 'That access code was not recognised. Check for typos - codes look like AGT-XXXX-XXXX-XXXX-XXXX-XXXX.',
      expired_code: 'This access code has expired. Ask your workshop host for a new one.',
      revoked_code: 'This access code has been revoked. Ask your workshop host for a new one.',
      too_many_sessions: 'This code is already in use on the maximum number of devices. Log out elsewhere or ask your host.',
      quota_exceeded: 'This code has used up its AI allowance. Ask your workshop host to raise the limit.',
    } as Record<string, string>,
  },

  actions: {
    sessionExpired: 'Your session expired. Enter your access code again.',
    loggedOut: 'You are logged out.',
  },

  errors: {
    /**
     * One text per error code. In English the server's own (more specific) message is shown
     * when there is one and this map is the fallback; in Polish this map is shown first.
     */
    byCode: {
      invalid_request: 'The server rejected the request as invalid.',
      invalid_code: 'This access code is not valid. Check for typos and try again.',
      expired_code: 'This access code has expired.',
      revoked_code: 'This access code has been revoked by the administrator.',
      too_many_sessions: 'This access code is already in use in the maximum number of active sessions. Log out elsewhere or ask the organiser for help.',
      unauthorized: 'Missing or invalid session token. Activate an access code first.',
      session_expired: 'Your session has ended. Please enter your access code again.',
      quota_exceeded: 'The request or token budget of this access code is used up.',
      rate_limited: 'Too many requests. Please slow down.',
      payload_too_large: 'The request is larger than the server allows.',
      origin_not_allowed: 'This website is not allowed to use the Service Agent Lab API.',
      model_not_allowed: 'The model is chosen by the server and cannot be changed by the client.',
      upstream_unavailable: 'The AI model provider is not responding right now. Please try again in a moment.',
      upstream_timeout: 'The AI model took too long to answer. Please try again.',
      upstream_bad_response: 'The AI model sent an unexpected response. Please try again.',
      run_limit_exceeded: 'The agent reached the step or token limit for this question. Ask again in a new message.',
      not_found: 'Not found.',
      internal: 'Unexpected server error.',
      network: 'Could not reach the Service Agent Lab server. Check your internet connection and try again.',
      aborted: 'Cancelled.',
    } as Record<ErrorCode, string>,
    activateFirst: 'Please activate Service Agent Lab with your access code first.',
    requestFailed: (status: number) => `Request failed (HTTP ${status}).`,
    embeddingMalformed: 'The embedding response was malformed (wrong number of vectors or dimensions).',
    agentMalformed: 'The agent response from the server was malformed.',
  },

  /** Why a message could not be sent. */
  runErrors: {
    notReady: 'The app is still loading. Try again in a moment.',
    busy: 'The agent is still working on the previous message.',
    tooLong: (max: number) => `The message is too long (at most ${max} characters).`,
  },

  /** Chat notices for a run that ended without a normal answer (key: RunNoticeKey). */
  runNotices: {
    cancelled: 'You stopped the agent. Nothing more was done for this message.',
    reload: 'The page was reloaded while the agent was working. The run was stopped and nothing more was done.',
    max_steps: 'The agent reached its step limit and stopped before it could answer.',
    run_timeout: 'The agent took too long and was stopped. Try again, perhaps with a shorter question.',
    model_timeout: 'The AI model did not answer in time, so the agent stopped.',
    tool_loop: 'The agent kept repeating the same tool call and was stopped.',
    forced_final: 'The agent reached its limit of steps or tool calls. The answer may be incomplete.',
    run_limit_exceeded: 'The agent reached the step or token limit for this question.',
    quota_exceeded: 'The AI allowance of this access code is used up.',
    error: 'The agent could not finish because of an error.',
  } satisfies Record<RunNoticeKey, string>,
}
