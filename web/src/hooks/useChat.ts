import { useState, useCallback } from 'react'
import { sendMessage, getMessages } from '../api/client'
import { useSSE } from './useSSE'

export type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export function useChat(agentId: string) {
  const [chatId, setChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingText, setStreamingText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  useSSE(chatId, (event) => {
    switch (event.type) {
      case 'stream':
        setStreamingText(prev => prev + (event.text ?? ''))
        break
      case 'complete':
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: event.fullText ?? '',
          timestamp: new Date().toISOString(),
        }])
        setStreamingText('')
        break
      case 'processing':
        setIsProcessing(event.isProcessing ?? false)
        break
      case 'error':
        setStreamingText('')
        setIsProcessing(false)
        break
    }
  })

  const send = useCallback(async (prompt: string) => {
    // 添加用户消息到列表
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
    }])
    setIsProcessing(true)
    setStreamingText('')

    const result = await sendMessage(agentId, prompt, chatId ?? undefined)
    if (!chatId) {
      setChatId(result.chatId)
    }
  }, [agentId, chatId])

  const loadChat = useCallback(async (existingChatId: string) => {
    setChatId(existingChatId)
    const msgs = await getMessages(existingChatId)
    setMessages(msgs.map(m => ({
      id: m.id,
      role: m.is_bot_message ? 'assistant' as const : 'user' as const,
      content: m.content,
      timestamp: m.timestamp,
    })))
  }, [])

  const newChat = useCallback(() => {
    setChatId(null)
    setMessages([])
    setStreamingText('')
    setIsProcessing(false)
  }, [])

  return { chatId, messages, streamingText, isProcessing, send, loadChat, newChat }
}
