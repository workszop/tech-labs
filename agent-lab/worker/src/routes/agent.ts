/**
 * POST /api/agent - one model turn of an agent run.
 *
 * The browser drives the loop and executes the tools; the Worker owns the
 * system prompt, the tool definitions, the model and its parameters, checks
 * every tool call the model makes, and enforces the per-run limits.
 */
import { buildAgentSystemPrompt } from '../../../shared/agent-prompt'
import {
  type AgentMessage,
  type AgentRequest,
  type AgentResponse,
  type RejectReason,
  type RejectedToolCall,
  type ToolCall,
  type ValidatedToolCall,
  estimateTokens,
  isLang,
} from '../../../shared/api-types'
import { SIM_TODAY } from '../../../shared/sim'
import { TOOLS, type ToolDef, type ToolName, getTool, isToolName, validateToolArgs } from '../../../shared/tools'
import { recordRunStep, releaseRunStep, reserveRunStep } from '../agent-runs'
import { requireSession } from '../auth/session'
import { cost, type RequestContext } from '../context'
import { reserveQuota, settleUsage, usageInfo } from '../db'
import { ApiError, isObject, json, readJson, toApiError } from '../http'
import { LIMITS } from '../limits'
import { createProvider } from '../providers'
import type { UpstreamToolCall } from '../providers/types'
import { enforceSessionRateLimit } from '../ratelimit'
import { assertNoClientModel } from './embeddings'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CUSTOMER_ID = /^CUST-\d{4}$/
const CALL_ID = /^[\w.:-]{1,100}$/

function bad(message: string): ApiError {
  return new ApiError('invalid_request', message)
}

/** The system prompt, tools and sampling are the server's; a client cannot send them. */
export function assertNoClientOverrides(body: Record<string, unknown>, serverModel: string): void {
  assertNoClientModel(body, serverModel)
  for (const key of ['system', 'tools', 'temperature'] as const) {
    if (key in body && body[key] !== undefined) {
      throw new ApiError('invalid_request', `\`${key}\` is set by the server and cannot be changed by the client.`)
    }
  }
}

function validateToolCallList(raw: unknown, where: string): ToolCall[] {
  if (!Array.isArray(raw)) throw bad(`${where}.toolCalls must be an array.`)
  return raw.map((c, j) => {
    if (!isObject(c)) throw bad(`${where}.toolCalls[${j}] must be an object.`)
    if (typeof c.id !== 'string' || !CALL_ID.test(c.id)) throw bad(`${where}.toolCalls[${j}].id is invalid.`)
    if (typeof c.name !== 'string' || !c.name || c.name.length > 100) throw bad(`${where}.toolCalls[${j}].name is invalid.`)
    if (!isObject(c.arguments)) throw bad(`${where}.toolCalls[${j}].arguments must be an object.`)
    return { id: c.id, name: c.name, arguments: c.arguments }
  })
}

function validateMessages(raw: unknown): AgentMessage[] {
  const L = LIMITS.agentRequest
  if (!Array.isArray(raw) || raw.length === 0) throw bad('`messages` must be a non-empty array.')
  if (raw.length > L.maxMessages) throw new ApiError('payload_too_large', `At most ${L.maxMessages} messages per request.`)
  const out: AgentMessage[] = []
  /** Calls of the latest assistant message that still wait for their tool message. */
  let pending = new Map<string, string>()
  const seenIds = new Set<string>()
  raw.forEach((m, i) => {
    const where = `messages[${i}]`
    if (!isObject(m)) throw bad(`${where} must be an object.`)
    if (i === 0 && m.role !== 'user') throw bad('The first message must be a user message.')
    if (m.role !== 'tool' && pending.size) {
      throw bad(`${where}: every tool call of the previous assistant message must be answered by one tool message first.`)
    }
    if (m.role === 'user') {
      if (typeof m.content !== 'string' || !m.content.trim()) throw bad(`${where}.content must be a non-empty string.`)
      if (m.content.length > LIMITS.agent.maxMessageChars) {
        throw new ApiError('payload_too_large', `${where}.content is longer than ${LIMITS.agent.maxMessageChars} characters.`)
      }
      out.push({ role: 'user', content: m.content })
    } else if (m.role === 'assistant') {
      if (typeof m.content !== 'string') throw bad(`${where}.content must be a string.`)
      const msg: AgentMessage = { role: 'assistant', content: m.content }
      if (m.toolCalls !== undefined) {
        const calls = validateToolCallList(m.toolCalls, where)
        for (const c of calls) {
          if (seenIds.has(c.id)) throw bad(`${where}: tool call id "${c.id}" is used more than once.`)
          seenIds.add(c.id)
        }
        pending = new Map(calls.map((c) => [c.id, c.name]))
        if (calls.length) msg.toolCalls = calls
      }
      out.push(msg)
    } else if (m.role === 'tool') {
      if (typeof m.toolCallId !== 'string' || typeof m.name !== 'string') throw bad(`${where} needs string toolCallId and name.`)
      const name = pending.get(m.toolCallId)
      if (name === undefined) throw bad(`${where} does not answer a pending tool call of the previous assistant message.`)
      if (name !== m.name) throw bad(`${where}.name does not match the tool call it answers.`)
      if (typeof m.content !== 'string') throw bad(`${where}.content must be a string.`)
      if (m.content.length > L.maxToolContentChars) {
        throw new ApiError('payload_too_large', `${where}.content is longer than ${L.maxToolContentChars} characters.`)
      }
      pending.delete(m.toolCallId)
      out.push({ role: 'tool', toolCallId: m.toolCallId, name: m.name, content: m.content })
    } else {
      throw bad(`${where}.role must be "user", "assistant" or "tool".`)
    }
  })
  if (pending.size) throw bad('Every tool call must be answered by one tool message.')
  const last = out[out.length - 1]!
  if (last.role === 'assistant') throw bad('The last message must be a user or tool message.')
  return out
}

export function validateAgentRequest(body: unknown): AgentRequest {
  if (!isObject(body)) throw bad('Body must be a JSON object.')
  if (typeof body.runId !== 'string' || !UUID.test(body.runId)) throw bad('`runId` must be a UUID.')
  if (!isLang(body.lang)) throw bad('`lang` must be "pl" or "en".')
  const customer = body.customer
  if (!isObject(customer) || typeof customer.id !== 'string' || !CUSTOMER_ID.test(customer.id)) {
    throw bad('`customer.id` must look like CUST-1234.')
  }
  const name = typeof customer.name === 'string' ? customer.name.trim() : ''
  if (!name || name.length > LIMITS.agentRequest.maxCustomerNameChars) {
    throw bad(`\`customer.name\` must be 1 to ${LIMITS.agentRequest.maxCustomerNameChars} characters.`)
  }
  if (!Array.isArray(body.enabledTools)) throw bad('`enabledTools` must be an array of tool names.')
  const enabled: ToolName[] = []
  for (const t of body.enabledTools as unknown[]) {
    if (!isToolName(t)) throw bad(`\`enabledTools\` contains an unknown tool: ${JSON.stringify(t).slice(0, 60)}.`)
    if (enabled.includes(t)) throw bad(`\`enabledTools\` lists ${t} more than once.`)
    enabled.push(t)
  }
  return {
    runId: body.runId.toLowerCase(),
    lang: body.lang,
    customer: { id: customer.id, name },
    enabledTools: enabled,
    messages: validateMessages(body.messages),
  }
}

/** Tools sent upstream: the enabled ones, in registry order. */
function enabledToolDefs(enabled: ToolName[]): ToolDef[] {
  return TOOLS.filter((t) => enabled.includes(t.name))
}

function upstreamToolsSize(tools: ToolDef[]): number {
  return estimateTokens(JSON.stringify(tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters }))))
}

/**
 * Checks the model's tool calls in order. Valid calls are executed by the
 * browser; rejected ones are answered with an error tool message so the run
 * can continue.
 */
export function checkToolCalls(
  calls: UpstreamToolCall[],
  enabled: ToolName[],
  opts: { maxParallel: number; remainingRunCalls: number; toolsRemoved: boolean },
): { valid: ValidatedToolCall[]; rejected: RejectedToolCall[]; transcript: ToolCall[] } {
  const valid: ValidatedToolCall[] = []
  const rejected: RejectedToolCall[] = []
  const transcript: ToolCall[] = []
  const reject = (c: UpstreamToolCall, reason: RejectReason, message: string) => {
    // A nameless call gets a placeholder name so the transcript stays valid on the next request.
    const name = c.name || 'unknown'
    rejected.push({ id: c.id, name, rawArguments: c.rawArguments, reason, message })
    transcript.push({ id: c.id, name, arguments: {} })
  }
  for (const c of calls) {
    if (!isToolName(c.name)) {
      reject(c, 'unknown_tool', `Unknown tool: ${c.name || '(no name)'}. Use only the tools you were given.`)
      continue
    }
    if (!enabled.includes(c.name)) {
      reject(c, 'tool_disabled', `The tool ${c.name} is disabled in this session. Do not call it again; answer without it.`)
      continue
    }
    if (opts.toolsRemoved) {
      reject(c, 'too_many_calls', 'The run limit is reached and tools are no longer available. Answer with what you already know.')
      continue
    }
    let parsed: unknown
    try {
      parsed = c.rawArguments.trim() === '' ? {} : JSON.parse(c.rawArguments)
    } catch {
      reject(c, 'invalid_arguments', `${c.name}: arguments are not valid JSON.`)
      continue
    }
    const check = validateToolArgs(c.name, parsed)
    if (!check.ok) {
      reject(c, 'invalid_arguments', check.error)
      continue
    }
    if (valid.length >= opts.maxParallel) {
      reject(c, 'too_many_calls', `At most ${opts.maxParallel} tool calls per step. Request this call again in the next step if you still need it.`)
      continue
    }
    if (valid.length >= opts.remainingRunCalls) {
      reject(c, 'too_many_calls', 'This run has used all its tool calls. Answer with what you already know.')
      continue
    }
    const def = getTool(c.name)
    const call: ValidatedToolCall = {
      id: c.id,
      name: c.name,
      arguments: check.args,
      system: def.system,
      readOnly: def.readOnly,
      requiresConfirmation: !def.readOnly,
    }
    valid.push(call)
    transcript.push({ id: c.id, name: c.name, arguments: check.args })
  }
  return { valid, rejected, transcript }
}

/**
 * Gives every upstream call an id not used anywhere in the transcript yet.
 * Some compatible servers restart their ids each turn (call_0, call_1, ...),
 * and the request validator requires ids to be unique across the transcript.
 */
export function uniqueCallIds(calls: UpstreamToolCall[], messages: AgentMessage[]): UpstreamToolCall[] {
  const used = new Set<string>()
  for (const m of messages) if (m.role === 'assistant') for (const c of m.toolCalls ?? []) used.add(c.id)
  return calls.map((c) => {
    let id = c.id
    while (used.has(id)) id = `call_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`
    used.add(id)
    return id === c.id ? c : { ...c, id }
  })
}

/** POST /api/agent */
export async function handleAgent(c: RequestContext): Promise<Response> {
  const { session, code } = await requireSession(c.request, c.env.DB, c.cfg, c.now)
  await enforceSessionRateLimit(c, session.id)
  const body = await readJson(c.request, LIMITS.maxAgentBodyBytes)
  const provider = createProvider(c.cfg, c.fetch)
  if (isObject(body)) assertNoClientOverrides(body, provider.chatModel)
  const req = validateAgentRequest(body)
  const L = LIMITS.agentRequest

  const system = buildAgentSystemPrompt({ lang: req.lang, customer: req.customer, today: SIM_TODAY, enabledTools: req.enabledTools })
  const allTools = enabledToolDefs(req.enabledTools)
  const inputEstimate = estimateTokens(system) + estimateTokens(JSON.stringify(req.messages)) + upstreamToolsSize(allTools)
  if (inputEstimate > L.maxInputTokens) {
    throw new ApiError('payload_too_large', `The conversation is too long (about ${inputEstimate} tokens, at most ${L.maxInputTokens}). Start a new conversation.`)
  }

  const limits = { maxSteps: c.cfg.agentMaxSteps, maxToolCalls: c.cfg.agentMaxToolCalls, maxRunTokens: c.cfg.agentMaxRunTokens }
  const run = await reserveRunStep(c.env.DB, req.runId, session.id, limits, c.now)
  const step = run.steps
  const forcedFinal = step >= limits.maxSteps || run.tool_calls >= limits.maxToolCalls
  const tools = forcedFinal ? [] : allTools

  const est = inputEstimate + L.maxOutputTokens
  try {
    await reserveQuota(c.env.DB, code.id, est, c.now)
  } catch (err) {
    await releaseRunStep(c.env.DB, req.runId).catch((e) => toApiError(e, 'agent.release'))
    throw err
  }

  const t0 = Date.now()
  let result
  try {
    result = await provider.chatWithTools(
      system,
      req.messages,
      tools,
      { model: provider.chatModel, temperature: L.temperature, maxTokens: L.maxOutputTokens, lang: req.lang, toolChoice: forcedFinal ? 'none' : 'auto' },
      c.request.signal,
    )
  } catch (err) {
    const apiErr = toApiError(err, 'agent')
    await settleUsage(
      c.env.DB,
      { accessCodeId: code.id, sessionId: session.id, model: provider.chatModel, operation: 'agent', inputTokens: 0, outputTokens: 0, cost: 0, status: 'error' },
      est,
      Date.now(),
    ).catch((e) => toApiError(e, 'agent.refund'))
    await releaseRunStep(c.env.DB, req.runId).catch((e) => toApiError(e, 'agent.release'))
    throw apiErr
  }
  const durationMs = Date.now() - t0

  const usage = result.usage ?? {
    inputTokens: inputEstimate,
    outputTokens: estimateTokens(result.text) + estimateTokens(JSON.stringify(result.toolCalls)),
  }
  const checked = checkToolCalls(uniqueCallIds(result.toolCalls, req.messages), req.enabledTools, {
    maxParallel: LIMITS.agent.maxParallelToolCalls,
    remainingRunCalls: Math.max(0, limits.maxToolCalls - run.tool_calls),
    toolsRemoved: forcedFinal,
  })

  const settled = await settleUsage(
    c.env.DB,
    {
      accessCodeId: code.id,
      sessionId: session.id,
      model: provider.chatModel,
      operation: 'agent',
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cost: cost(c.cfg, 'agent', usage.inputTokens, usage.outputTokens),
      status: 'ok',
    },
    est,
    Date.now(),
  )
  const after = await recordRunStep(c.env.DB, req.runId, checked.valid.length, usage.inputTokens + usage.outputTokens)

  const assistantMessage: AgentResponse['assistantMessage'] = { role: 'assistant', content: result.text }
  if (checked.transcript.length) assistantMessage.toolCalls = checked.transcript
  const res: AgentResponse = {
    runId: req.runId,
    step,
    model: provider.chatModel,
    kind: result.toolCalls.length ? 'tool_calls' : 'final',
    assistantMessage,
    toolCalls: checked.valid,
    rejected: checked.rejected,
    forcedFinal,
    finishReason: result.finishReason,
    usage,
    durationMs,
    quota: usageInfo(settled ?? code),
    limits: {
      maxSteps: limits.maxSteps,
      maxToolCalls: limits.maxToolCalls,
      maxRunTokens: limits.maxRunTokens,
      stepsUsed: after.steps,
      toolCallsUsed: after.tool_calls,
      runTokens: after.tokens,
    },
  }
  return json(res)
}
