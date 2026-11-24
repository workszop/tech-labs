import type { AgentMessage, Lang } from '../../../shared/api-types'
import type { ToolDef } from '../../../shared/tools'

export interface EmbedResult {
  model: string
  /** One vector per input, in input order. */
  embeddings: number[][]
  /** Provider-reported input tokens, or null if the provider did not report usage. */
  inputTokens: number | null
}

export interface ChatOptions {
  model: string
  temperature: number
  maxTokens: number
  /** Language of the run. A hint for the offline mock model; real providers ignore it. */
  lang?: Lang
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

/** One tool call as the model returned it; the arguments are not parsed or validated yet. */
export interface UpstreamToolCall {
  id: string
  name: string
  rawArguments: string
}

export interface ToolChatResult {
  /** Text of the assistant message; may be empty on a tool-call turn. */
  text: string
  toolCalls: UpstreamToolCall[]
  finishReason: string | null
  /** null when the provider did not report usage. */
  usage: TokenUsage | null
}

/**
 * Upstream LLM provider. Implementations throw `ApiError` with
 * upstream_unavailable / upstream_timeout / upstream_bad_response.
 */
export interface Provider {
  readonly name: 'openai-compatible' | 'mock'
  readonly embeddingModel: string
  readonly chatModel: string
  readonly embeddingDimensions: number
  /** `lang` is a hint about the inputs' language; real providers ignore it. */
  embed(inputs: string[], signal?: AbortSignal, lang?: Lang): Promise<EmbedResult>
  /**
   * One model turn with function calling. `toolChoice: 'none'` (or an empty
   * `tools` list) means the model must answer in text: no tools are sent.
   */
  chatWithTools(
    system: string,
    messages: AgentMessage[],
    tools: ToolDef[],
    opts: ChatOptions & { toolChoice: 'auto' | 'none' },
    signal?: AbortSignal,
  ): Promise<ToolChatResult>
}
