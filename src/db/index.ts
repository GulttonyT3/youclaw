import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { getPaths } from '../config/index.ts'
import { getLogger } from '../logger/index.ts'

let _db: Database | null = null

const SCHEMA = `
CREATE TABLE IF NOT EXISTS messages (
  id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  sender TEXT,
  sender_name TEXT,
  content TEXT,
  timestamp TEXT NOT NULL,
  is_from_me INTEGER DEFAULT 0,
  is_bot_message INTEGER DEFAULT 0,
  PRIMARY KEY (id, chat_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_time ON messages(chat_id, timestamp);

CREATE TABLE IF NOT EXISTS chats (
  chat_id TEXT PRIMARY KEY,
  name TEXT,
  agent_id TEXT,
  channel TEXT,
  is_group INTEGER DEFAULT 0,
  last_message_time TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  agent_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  PRIMARY KEY (agent_id, chat_id)
);

CREATE TABLE IF NOT EXISTS kv_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`

export function initDatabase(): Database {
  if (_db) return _db

  const paths = getPaths()
  mkdirSync(dirname(paths.db), { recursive: true })

  _db = new Database(paths.db)
  _db.exec('PRAGMA journal_mode=WAL')
  _db.exec('PRAGMA foreign_keys=ON')
  _db.exec(SCHEMA)

  getLogger().info({ path: paths.db }, '数据库初始化完成')
  return _db
}

export function getDatabase(): Database {
  if (!_db) throw new Error('数据库未初始化')
  return _db
}

// ===== 消息操作 =====

export function saveMessage(msg: {
  id: string
  chatId: string
  sender: string
  senderName: string
  content: string
  timestamp: string
  isFromMe: boolean
  isBotMessage: boolean
}) {
  const db = getDatabase()
  db.run(
    `INSERT OR REPLACE INTO messages (id, chat_id, sender, sender_name, content, timestamp, is_from_me, is_bot_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [msg.id, msg.chatId, msg.sender, msg.senderName, msg.content, msg.timestamp, msg.isFromMe ? 1 : 0, msg.isBotMessage ? 1 : 0]
  )
}

export function getMessages(chatId: string, limit = 50, before?: string): Array<{
  id: string; chat_id: string; sender: string; sender_name: string
  content: string; timestamp: string; is_from_me: number; is_bot_message: number
}> {
  const db = getDatabase()
  if (before) {
    return db.query(
      `SELECT * FROM messages WHERE chat_id = ? AND timestamp < ? ORDER BY timestamp DESC LIMIT ?`
    ).all(chatId, before, limit) as any
  }
  return db.query(
    `SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp DESC LIMIT ?`
  ).all(chatId, limit) as any
}

// ===== Chat 操作 =====

export function upsertChat(chatId: string, agentId: string, name?: string, channel = 'web') {
  const db = getDatabase()
  db.run(
    `INSERT INTO chats (chat_id, name, agent_id, channel, last_message_time)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(chat_id) DO UPDATE SET
       last_message_time = excluded.last_message_time,
       name = COALESCE(excluded.name, chats.name)`,
    [chatId, name ?? chatId, agentId, channel, new Date().toISOString()]
  )
}

export function getChats(): Array<{
  chat_id: string; name: string; agent_id: string; channel: string; last_message_time: string
}> {
  const db = getDatabase()
  return db.query('SELECT * FROM chats ORDER BY last_message_time DESC').all() as any
}

// ===== Session 操作 =====

export function getSession(agentId: string, chatId: string): string | null {
  const db = getDatabase()
  const row = db.query('SELECT session_id FROM sessions WHERE agent_id = ? AND chat_id = ?').get(agentId, chatId) as any
  return row?.session_id ?? null
}

export function saveSession(agentId: string, chatId: string, sessionId: string) {
  const db = getDatabase()
  db.run(
    `INSERT OR REPLACE INTO sessions (agent_id, chat_id, session_id) VALUES (?, ?, ?)`,
    [agentId, chatId, sessionId]
  )
}
