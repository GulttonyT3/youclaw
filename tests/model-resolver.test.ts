import { describe, expect, test } from 'bun:test'
import './setup-light.ts'
import { resolvePiModel } from '../src/agent/model-resolver.ts'

describe('resolvePiModel', () => {
  test('preserves qualified proxy model ids for built-in cloud routes', () => {
    const model = resolvePiModel({
      apiKey: 'token',
      baseUrl: 'https://readmex.com/api',
      modelId: 'minimax/MiniMax-M2.5-highspeed',
      provider: 'builtin',
    })

    expect(model.provider).toBe('minimax')
    expect(model.api).toBe('anthropic-messages')
    expect(model.baseUrl).toBe('https://readmex.com/api')
    expect(model.id).toBe('minimax/MiniMax-M2.5-highspeed')
  })

  test('infers minimax anthropic api for proxy models missing from the local registry', () => {
    const model = resolvePiModel({
      apiKey: 'token',
      baseUrl: 'https://readmex.com/api',
      modelId: 'minimax/MiniMax-M2.7-highspeed',
      provider: 'builtin',
    })

    expect(model.provider).toBe('minimax')
    expect(model.api).toBe('anthropic-messages')
    expect(model.baseUrl).toBe('https://readmex.com/api')
    expect(model.id).toBe('minimax/MiniMax-M2.7-highspeed')
  })
})
