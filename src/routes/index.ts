import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { health } from './health.ts'
import { agents } from './agents.ts'
import { createMessagesRoutes } from './messages.ts'
import { createStreamRoutes } from './stream.ts'
import type { AgentRuntime } from '../agent/index.ts'
import type { EventBus } from '../events/index.ts'

export function createApp(agentRuntime: AgentRuntime, eventBus: EventBus, defaultAgentId: string) {
  const app = new Hono()

  // CORS — 允许 Vite dev server
  app.use('/*', cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowHeaders: ['Content-Type'],
  }))

  // 挂载路由
  app.route('/api', health)
  app.route('/api', agents)
  app.route('/api', createMessagesRoutes(agentRuntime, defaultAgentId))
  app.route('/api', createStreamRoutes(eventBus))

  return app
}
