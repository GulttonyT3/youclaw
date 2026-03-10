import { resolve } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { loadEnv, getEnv, getPaths, ROOT_DIR } from './config/index.ts'
import { initLogger, getLogger } from './logger/index.ts'
import { initDatabase } from './db/index.ts'
import { EventBus } from './events/index.ts'
import { AgentRuntime } from './agent/index.ts'
import { createApp } from './routes/index.ts'

async function main() {
  // 1. 加载环境变量
  loadEnv()
  const env = getEnv()

  // 2. 初始化日志
  const logger = initLogger()
  logger.info('ZoerClaw 启动中...')

  // 3. 初始化数据库
  initDatabase()

  // 4. 创建 EventBus
  const eventBus = new EventBus()

  // 5. 构建系统提示词
  const systemPrompt = buildSystemPrompt()

  // 6. 创建 AgentRuntime
  const defaultAgentId = 'default'
  const agentConfig = {
    id: defaultAgentId,
    name: 'Default Assistant',
    model: env.AGENT_MODEL,
    workspaceDir: resolve(getPaths().agents, defaultAgentId),
  }
  const agentRuntime = new AgentRuntime(agentConfig, eventBus, systemPrompt)

  // 7. 创建 HTTP 服务
  const app = createApp(agentRuntime, eventBus, defaultAgentId)

  const server = Bun.serve({
    port: env.PORT,
    fetch: app.fetch,
  })

  logger.info({ port: env.PORT }, `HTTP 服务已启动: http://localhost:${env.PORT}`)
  logger.info('ZoerClaw 已就绪')

  // 8. 优雅关闭
  const shutdown = () => {
    logger.info('正在关闭...')
    server.stop()
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

function buildSystemPrompt(): string {
  const promptsDir = getPaths().prompts
  let prompt = ''

  // 加载基础系统提示词
  const systemPath = resolve(promptsDir, 'system.md')
  if (existsSync(systemPath)) {
    prompt += readFileSync(systemPath, 'utf-8')
  }

  // 加载并填充环境上下文
  const envPath = resolve(promptsDir, 'env.md')
  if (existsSync(envPath)) {
    let envPrompt = readFileSync(envPath, 'utf-8')
    envPrompt = envPrompt
      .replace('{{date}}', new Date().toISOString().split('T')[0]!)
      .replace('{{os}}', process.platform)
      .replace('{{platform}}', process.arch)
      .replace('{{cwd}}', process.cwd())
    prompt += '\n\n' + envPrompt
  }

  return prompt
}

main().catch((err) => {
  console.error('启动失败:', err)
  process.exit(1)
})
