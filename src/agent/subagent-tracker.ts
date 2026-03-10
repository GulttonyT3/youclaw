import { getLogger } from '../logger/index.ts'

export interface SubagentInfo {
  taskId: string
  agentId: string
  description: string
  status: 'running' | 'completed' | 'failed'
  summary?: string
  startedAt: string
  completedAt?: string
}

/**
 * 跟踪子 Agent 的生命周期
 * 记录活跃和最近完成的子 Agent 任务
 */
export class SubagentTracker {
  private active: Map<string, SubagentInfo> = new Map()    // taskId -> info
  private recent: SubagentInfo[] = []                       // 最近完成的任务
  private maxRecent: number = 50

  /**
   * 记录子 Agent 启动
   */
  track(agentId: string, taskId: string, description: string): void {
    const info: SubagentInfo = {
      taskId,
      agentId,
      description,
      status: 'running',
      startedAt: new Date().toISOString(),
    }
    this.active.set(taskId, info)
    getLogger().debug({ agentId, taskId, description }, '子 Agent 已启动')
  }

  /**
   * 更新子 Agent 进度
   */
  updateProgress(taskId: string, summary?: string): void {
    const info = this.active.get(taskId)
    if (info) {
      info.summary = summary
      getLogger().debug({ taskId, summary }, '子 Agent 进度更新')
    }
  }

  /**
   * 标记子 Agent 完成
   */
  complete(taskId: string, status: 'completed' | 'failed', summary: string): void {
    const info = this.active.get(taskId)
    if (info) {
      info.status = status
      info.summary = summary
      info.completedAt = new Date().toISOString()

      this.active.delete(taskId)
      this.recent.unshift(info)

      // 限制最近记录数量
      if (this.recent.length > this.maxRecent) {
        this.recent = this.recent.slice(0, this.maxRecent)
      }

      getLogger().debug({ taskId, status, summary }, '子 Agent 已完成')
    }
  }

  /**
   * 获取活跃的子 Agent 列表
   */
  getActive(agentId?: string): SubagentInfo[] {
    const all = Array.from(this.active.values())
    if (agentId) {
      return all.filter((info) => info.agentId === agentId)
    }
    return all
  }

  /**
   * 获取最近完成的子 Agent 列表
   */
  getRecent(agentId?: string, limit: number = 10): SubagentInfo[] {
    let results = this.recent
    if (agentId) {
      results = results.filter((info) => info.agentId === agentId)
    }
    return results.slice(0, limit)
  }
}
