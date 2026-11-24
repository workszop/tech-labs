// English strings for the app shell: header, activation, panels, errors.
// This file is the source of truth for the dictionary type; pl/shell.ts must mirror its shape.
// Later areas (systems, chat, flow, learn) live in their own files next to this one.
import type { ApiErrorCode } from '@shared/api-types'

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
    tabWorkspace: 'Workspace',
    tabChat: 'Chat',
  },

  panels: {
    systems: { title: 'Company systems', empty: 'The company systems the agent can read will appear here.' },
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
  },
}
