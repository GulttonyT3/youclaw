import { Hono } from 'hono'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { getPaths } from '../config/index.ts'

const agents = new Hono()

// 读取 agents 目录下的所有 agent 配置
function loadAgentConfigs() {
  const agentsDir = getPaths().agents
  if (!existsSync(agentsDir)) return []

  const dirs = readdirSync(agentsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())

  return dirs.map(d => {
    const configPath = resolve(agentsDir, d.name, 'agent.yaml')
    const id = d.name
    const name = id // 简化版，后续解析 yaml
    const workspaceDir = resolve(agentsDir, d.name)

    return {
      id,
      name,
      workspaceDir,
      status: 'idle' as const,
      hasConfig: existsSync(configPath),
    }
  })
}

// GET /api/agents — 列出所有 agents
agents.get('/agents', (c) => {
  const configs = loadAgentConfigs()
  return c.json(configs)
})

// GET /api/agents/:id — 获取单个 agent 详情
agents.get('/agents/:id', (c) => {
  const id = c.req.param('id')
  const configs = loadAgentConfigs()
  const agent = configs.find(a => a.id === id)

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  return c.json(agent)
})

export { agents }
