export interface AgentConfig {
  id: string
  name: string
  model: string
  workspaceDir: string
}

export interface AgentState {
  sessionId: string | null
  isProcessing: boolean
}

export interface ProcessParams {
  chatId: string
  prompt: string
  agentId: string
}
