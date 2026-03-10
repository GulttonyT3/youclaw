import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import './setup.ts'
import { getPaths } from '../src/config/index.ts'
import { MemoryManager } from '../src/memory/manager.ts'

const memoryManager = new MemoryManager()
const createdAgentIds = new Set<string>()

function createAgentId(prefix: string) {
  const agentId = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  createdAgentIds.add(agentId)
  return agentId
}

function getAgentMemoryDir(agentId: string) {
  return resolve(getPaths().agents, agentId, 'memory')
}

function getMemoryFile(agentId: string) {
  return resolve(getAgentMemoryDir(agentId), 'MEMORY.md')
}

function getLogsDir(agentId: string) {
  return resolve(getAgentMemoryDir(agentId), 'logs')
}

async function waitFor(check: () => boolean, timeoutMs = 500) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (check()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('waitFor timeout')
}

describe('MemoryManager', () => {
  beforeEach(() => {
    for (const agentId of createdAgentIds) {
      rmSync(resolve(getPaths().agents, agentId), { recursive: true, force: true })
    }
    createdAgentIds.clear()
  })

  afterEach(() => {
    for (const agentId of createdAgentIds) {
      rmSync(resolve(getPaths().agents, agentId), { recursive: true, force: true })
    }
    createdAgentIds.clear()
  })

  test('getMemory 在文件不存在时返回空字符串', () => {
    const agentId = createAgentId('memory-empty')
    expect(memoryManager.getMemory(agentId)).toBe('')
  })

  test('updateMemory 会创建目录并写入 MEMORY.md', async () => {
    const agentId = createAgentId('memory-write')

    memoryManager.updateMemory(agentId, '长期记忆内容')

    await waitFor(() => existsSync(getMemoryFile(agentId)))
    expect(memoryManager.getMemory(agentId)).toBe('长期记忆内容')
  })

  test('appendDailyLog 会创建当天日志并追加内容', async () => {
    const agentId = createAgentId('memory-log')
    const today = new Date().toISOString().split('T')[0]!
    const todayLog = resolve(getLogsDir(agentId), `${today}.md`)

    memoryManager.appendDailyLog(agentId, 'web:chat-1', '第一条问题', '第一条回答')
    memoryManager.appendDailyLog(agentId, 'web:chat-1', '第二条问题', '第二条回答')

    await waitFor(() => existsSync(todayLog) && readFileSync(todayLog, 'utf-8').includes('第二条回答'))

    const content = readFileSync(todayLog, 'utf-8')
    expect(content).toContain(`# ${today}`)
    expect(content).toContain('第一条问题')
    expect(content).toContain('第一条回答')
    expect(content).toContain('第二条问题')
    expect(content).toContain('第二条回答')
  })

  test('getDailyLogDates 按日期降序返回，getMemoryContext 只包含最近 3 天日志', () => {
    const agentId = createAgentId('memory-context')
    mkdirSync(getLogsDir(agentId), { recursive: true })
    writeFileSync(getMemoryFile(agentId), '长期记忆 A')
    writeFileSync(resolve(getLogsDir(agentId), '2026-03-07.md'), '# 2026-03-07\nold')
    writeFileSync(resolve(getLogsDir(agentId), '2026-03-08.md'), '# 2026-03-08\nlog-08')
    writeFileSync(resolve(getLogsDir(agentId), '2026-03-09.md'), '# 2026-03-09\nlog-09')
    writeFileSync(resolve(getLogsDir(agentId), '2026-03-10.md'), '# 2026-03-10\nlog-10')

    expect(memoryManager.getDailyLogDates(agentId)).toEqual([
      '2026-03-10',
      '2026-03-09',
      '2026-03-08',
      '2026-03-07',
    ])
    expect(memoryManager.getDailyLog(agentId, '2026-03-09')).toContain('log-09')

    const context = memoryManager.getMemoryContext(agentId)
    expect(context).toContain('<long_term>')
    expect(context).toContain('长期记忆 A')
    expect(context).toContain('log-10')
    expect(context).toContain('log-09')
    expect(context).toContain('log-08')
    expect(context).not.toContain('old')
  })
})
