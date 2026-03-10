import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { EventBus } from '../events/index.ts'

export function createStreamRoutes(eventBus: EventBus) {
  const stream = new Hono()

  // GET /api/stream/:chatId — 订阅某个 chat 的流式事件
  stream.get('/stream/:chatId', (c) => {
    const chatId = c.req.param('chatId')

    return streamSSE(c, async (sse) => {
      const unsubscribe = eventBus.subscribe({ chatId }, (event) => {
        sse.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        })
      })

      // 发送连接确认
      await sse.writeSSE({
        event: 'connected',
        data: JSON.stringify({ chatId, timestamp: new Date().toISOString() }),
      })

      // 保持连接直到客户端断开
      try {
        // 等待中止信号
        await new Promise<void>((resolve) => {
          c.req.raw.signal.addEventListener('abort', () => resolve())
        })
      } finally {
        unsubscribe()
      }
    })
  })

  // GET /api/stream/system — 订阅系统级事件
  stream.get('/stream/system', (c) => {
    return streamSSE(c, async (sse) => {
      const unsubscribe = eventBus.subscribe({}, (event) => {
        sse.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        })
      })

      await sse.writeSSE({
        event: 'connected',
        data: JSON.stringify({ timestamp: new Date().toISOString() }),
      })

      try {
        await new Promise<void>((resolve) => {
          c.req.raw.signal.addEventListener('abort', () => resolve())
        })
      } finally {
        unsubscribe()
      }
    })
  })

  return stream
}
