import { describe, test, expect, beforeEach } from 'bun:test'
import { cleanTables } from './setup.ts'
import {
  deleteChat,
  getChats,
  getMessages,
  getSession,
  saveMessage,
  saveSession,
  upsertChat,
} from '../src/db/index.ts'

describe('deleteChat', () => {
  beforeEach(() => cleanTables('messages', 'chats'))

  test('删除指定 chat 及其消息，不影响其他 chat', () => {
    upsertChat('chat-a', 'agent-1', 'Chat A')
    upsertChat('chat-b', 'agent-1', 'Chat B')

    saveMessage({
      id: 'msg-a',
      chatId: 'chat-a',
      sender: 'user',
      senderName: 'User',
      content: 'hello a',
      timestamp: '2026-03-10T10:00:00.000Z',
      isFromMe: false,
      isBotMessage: false,
    })
    saveMessage({
      id: 'msg-b',
      chatId: 'chat-b',
      sender: 'user',
      senderName: 'User',
      content: 'hello b',
      timestamp: '2026-03-10T11:00:00.000Z',
      isFromMe: false,
      isBotMessage: false,
    })

    deleteChat('chat-a')

    expect(getMessages('chat-a', 10)).toEqual([])
    expect(getChats().find((chat) => chat.chat_id === 'chat-a')).toBeUndefined()
    expect(getMessages('chat-b', 10).length).toBe(1)
    expect(getChats().find((chat) => chat.chat_id === 'chat-b')?.name).toBe('Chat B')
  })
})

describe('session 存取', () => {
  beforeEach(() => cleanTables('sessions'))

  test('未保存时返回 null', () => {
    expect(getSession('agent-1', 'web:chat-1')).toBeNull()
  })

  test('保存后可读取，重复保存会覆盖', () => {
    saveSession('agent-1', 'web:chat-1', 'session-1')
    expect(getSession('agent-1', 'web:chat-1')).toBe('session-1')

    saveSession('agent-1', 'web:chat-1', 'session-2')
    expect(getSession('agent-1', 'web:chat-1')).toBe('session-2')
  })
})
