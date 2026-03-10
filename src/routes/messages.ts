import { Hono } from 'hono'
import { randomUUID } from 'node:crypto'
import { saveMessage, getMessages, getChats, upsertChat } from '../db/index.ts'
import type { AgentRuntime } from '../agent/index.ts'

export function createMessagesRoutes(agentRuntime: AgentRuntime, defaultAgentId: string) {
  const messages = new Hono()

  // POST /api/agents/:id/message — 发消息给 agent
  messages.post('/agents/:id/message', async (c) => {
    const agentId = c.req.param('id')
    const body = await c.req.json<{ prompt: string; chatId?: string }>()

    if (!body.prompt) {
      return c.json({ error: 'prompt is required' }, 400)
    }

    // 如果没有 chatId，创建一个新的 web chat
    const chatId = body.chatId ?? `web:${randomUUID()}`

    // 确保 chat 存在
    upsertChat(chatId, agentId, undefined, 'web')

    // 存储用户消息
    saveMessage({
      id: randomUUID(),
      chatId,
      sender: 'user',
      senderName: 'User',
      content: body.prompt,
      timestamp: new Date().toISOString(),
      isFromMe: false,
      isBotMessage: false,
    })

    // 后台处理 agent 回复（不阻塞请求）
    agentRuntime.process({
      chatId,
      prompt: body.prompt,
      agentId,
    }).then(fullText => {
      // 存储 bot 回复
      saveMessage({
        id: randomUUID(),
        chatId,
        sender: 'assistant',
        senderName: 'Assistant',
        content: fullText,
        timestamp: new Date().toISOString(),
        isFromMe: true,
        isBotMessage: true,
      })
    })

    // 立即返回 chatId，前端通过 SSE 获取流式回复
    return c.json({ chatId, status: 'processing' })
  })

  // GET /api/chats — 所有对话列表
  messages.get('/chats', (c) => {
    return c.json(getChats())
  })

  // GET /api/chats/:chatId/messages — 消息历史
  messages.get('/chats/:chatId/messages', (c) => {
    const chatId = c.req.param('chatId')
    const limit = Number(c.req.query('limit') ?? '50')
    const before = c.req.query('before')

    const msgs = getMessages(chatId, limit, before ?? undefined)
    // 返回时按时间正序
    return c.json(msgs.reverse())
  })

  return messages
}
