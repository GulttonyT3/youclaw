import type { AgentEvent, EventFilter, EventHandler, Unsubscribe } from './types.ts'

interface Subscriber {
  filter: EventFilter
  handler: EventHandler
}

// 全局事件总线，解耦 Agent 执行和多端输出
export class EventBus {
  private subscribers: Set<Subscriber> = new Set()

  subscribe(filter: EventFilter, handler: EventHandler): Unsubscribe {
    const subscriber: Subscriber = { filter, handler }
    this.subscribers.add(subscriber)
    return () => {
      this.subscribers.delete(subscriber)
    }
  }

  emit(event: AgentEvent): void {
    for (const sub of this.subscribers) {
      if (this.matches(event, sub.filter)) {
        try {
          sub.handler(event)
        } catch {
          // 订阅者错误不应影响其他订阅者
        }
      }
    }
  }

  private matches(event: AgentEvent, filter: EventFilter): boolean {
    if (filter.chatId && 'chatId' in event && event.chatId !== filter.chatId) {
      return false
    }
    if (filter.agentId && 'agentId' in event && event.agentId !== filter.agentId) {
      return false
    }
    if (filter.types && !filter.types.includes(event.type)) {
      return false
    }
    return true
  }

  // 当前订阅者数量（调试用）
  get subscriberCount(): number {
    return this.subscribers.size
  }
}
