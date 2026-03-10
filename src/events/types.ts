// Agent 事件类型
export type AgentEvent =
  | { type: 'stream'; agentId: string; chatId: string; text: string }
  | { type: 'tool_use'; agentId: string; chatId: string; tool: string; input?: string }
  | { type: 'complete'; agentId: string; chatId: string; fullText: string; sessionId: string }
  | { type: 'error'; agentId: string; chatId: string; error: string }
  | { type: 'processing'; agentId: string; chatId: string; isProcessing: boolean }

export type AgentEventType = AgentEvent['type']

export type EventFilter = {
  chatId?: string
  agentId?: string
  types?: AgentEventType[]
}

export type EventHandler = (event: AgentEvent) => void
export type Unsubscribe = () => void
