import { getModel } from '@mariozechner/pi-ai'
import type { Api, Model } from '@mariozechner/pi-ai'
import { getLogger } from '../logger/index.ts'

// Known provider -> pi-ai provider mapping
const PROVIDER_MAP: Record<string, string> = {
  anthropic: 'anthropic',
  openai: 'openai',
  gemini: 'google',
  google: 'google',
  openrouter: 'openrouter',
  groq: 'groq',
  xai: 'xai',
  mistral: 'mistral',
  minimax: 'minimax',
  'minimax-cn': 'minimax-cn',
}

// Default model IDs per provider for fallback
const DEFAULT_MODEL_IDS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4.1',
  google: 'gemini-2.5-flash',
}

export interface ModelConfig {
  apiKey: string
  baseUrl: string
  modelId: string
  provider: string
}

/**
 * Resolve a YouClaw model config to a pi-ai Model object.
 *
 * Strategy:
 * 1. Try to resolve via pi-ai's built-in model registry (getModel)
 * 2. If that fails (custom/unknown model), construct a Model manually for the anthropic API
 */
export function resolvePiModel(config: ModelConfig): Model<Api> {
  const logger = getLogger()
  const piProvider = PROVIDER_MAP[config.provider] ?? config.provider

  // Try resolving from pi-ai's built-in registry
  try {
    const model = getModel(piProvider as any, config.modelId as any)
    if (model) {
      // Override baseUrl if custom one provided
      if (config.baseUrl) {
        return { ...model, baseUrl: config.baseUrl }
      }
      return model
    }
  } catch {
    // Model not in registry, fall back to manual construction
  }

  // For provider/modelId combos that include a slash (e.g., "minimax/MiniMax-M2.5-highspeed"),
  // try splitting and resolving
  if (config.modelId.includes('/')) {
    const [providerPart, modelPart] = config.modelId.split('/', 2)
    const mappedProvider = PROVIDER_MAP[providerPart!] ?? providerPart
    try {
      const model = getModel(mappedProvider as any, modelPart as any)
      if (model) {
        if (config.baseUrl) {
          return { ...model, baseUrl: config.baseUrl }
        }
        return model
      }
    } catch {
      // continue to manual construction
    }
  }

  logger.info({ provider: piProvider, modelId: config.modelId }, 'Model not in pi-ai registry, constructing manually')

  // Manual construction for custom/unknown models
  // Use anthropic-messages API as default since most proxies are Anthropic-compatible
  const api = resolveApi(piProvider)

  return {
    id: config.modelId,
    name: config.modelId,
    api,
    provider: piProvider,
    baseUrl: config.baseUrl || resolveDefaultBaseUrl(piProvider),
    reasoning: false,
    input: ['text', 'image'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 200000,
    maxTokens: 8192,
  } as Model<Api>
}

/**
 * Resolve the default API type for a provider
 */
function resolveApi(provider: string): Api {
  switch (provider) {
    case 'anthropic':
      return 'anthropic-messages'
    case 'openai':
      return 'openai-responses'
    case 'google':
      return 'google-generative-ai'
    case 'mistral':
      return 'mistral-conversations'
    default:
      // Most custom providers are OpenAI-compatible
      return 'openai-completions'
  }
}

/**
 * Resolve default base URL for known providers
 */
function resolveDefaultBaseUrl(provider: string): string {
  switch (provider) {
    case 'anthropic':
      return 'https://api.anthropic.com'
    case 'openai':
      return 'https://api.openai.com'
    case 'google':
      return 'https://generativelanguage.googleapis.com'
    case 'openrouter':
      return 'https://openrouter.ai/api'
    default:
      return ''
  }
}
