const BASE = '' // 使用 vite proxy，无需前缀

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json() as Promise<T>
}

// 发消息给 agent
export async function sendMessage(agentId: string, prompt: string, chatId?: string) {
  return apiFetch<{ chatId: string; status: string }>(`/api/agents/${agentId}/message`, {
    method: 'POST',
    body: JSON.stringify({ prompt, chatId }),
  })
}

// 获取聊天列表
export async function getChats() {
  return apiFetch<Array<{ chat_id: string; name: string; agent_id: string; channel: string; last_message_time: string }>>('/api/chats')
}

// 获取消息历史
export async function getMessages(chatId: string) {
  return apiFetch<Array<{ id: string; chat_id: string; sender: string; sender_name: string; content: string; timestamp: string; is_from_me: number; is_bot_message: number }>>(`/api/chats/${encodeURIComponent(chatId)}/messages`)
}

// 获取 agents 列表
export async function getAgents() {
  return apiFetch<Array<{ id: string; name: string; workspaceDir: string; status: string; hasConfig: boolean }>>('/api/agents')
}
