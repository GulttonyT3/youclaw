// Error codes for frontend to identify specific errors and show corresponding UI
export enum ErrorCode {
  INSUFFICIENT_CREDITS = 'INSUFFICIENT_CREDITS',
  AUTH_FAILED = 'AUTH_FAILED',
  MODEL_CONNECTION_FAILED = 'MODEL_CONNECTION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  UNKNOWN = 'UNKNOWN',
}

// Agent event types
export type AgentEvent =
  | { type: 'stream'; agentId: string; chatId: string; text: string }
  | { type: 'tool_use'; agentId: string; chatId: string; tool: string; input?: string }
  | { type: 'complete'; agentId: string; chatId: string; fullText: string; sessionId: string }
  | { type: 'error'; agentId: string; chatId: string; error: string; errorCode?: ErrorCode }
  | { type: 'processing'; agentId: string; chatId: string; isProcessing: boolean }
  // Memory events
  | { type: 'memory_updated'; agentId: string; filePath: string }
  | { type: 'conversation_archived'; agentId: string; filename: string }

export type AgentEventType = AgentEvent['type']

export type EventFilter = {
  chatId?: string
  agentId?: string
  types?: AgentEventType[]
}

export type EventHandler = (event: AgentEvent) => void
export type Unsubscribe = () => void
