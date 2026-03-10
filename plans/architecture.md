# ZoerClaw 架构计划

## Context

ZoerClaw 是一个**桌面端 AI 助手应用**，灵感来自 nanoClaw 和 OpenClaw，但做了关键简化：
- **去掉 Docker 容器**：直接在进程内用 Claude Agent SDK 执行 agent
- **单 channel 起步**：先接入 Telegram（grammy），未来可扩展
- **保留核心能力**：定时任务、持久记忆、多 agent、Skills 系统
- **兼容 OpenClaw Skills**：完全兼容 SKILL.md 格式
- **Web UI**：Vite + React，聊天 + 管理后台，流式输出

## 技术栈

| 层 | 选型 |
|---|------|
| 运行时 | Bun |
| 语言 | TypeScript |
| HTTP | Hono |
| 实时通信 | SSE (Server-Sent Events) |
| 数据库 | SQLite (better-sqlite3) |
| Telegram | grammy |
| Agent SDK | @anthropic-ai/claude-agent-sdk |
| 定时任务 | cron-parser |
| 校验 | Zod |
| 前端 | Vite + React |

---

## 整体架构

```
┌──────────────────────────────────────────────────────────┐
│                        入口层                              │
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐  │
│  │  Telegram   │  │   Web UI    │  │    HTTP API      │  │
│  │  (grammy)   │  │ (Vite+React)│  │    (Hono)        │  │
│  │  Long Poll  │  │  SSE Stream │  │   REST + SSE     │  │
│  └──────┬──────┘  └──────┬──────┘  └────────┬─────────┘  │
│         │                │                   │            │
│  ┌──────▼────────────────▼───────────────────▼─────────┐  │
│  │                   EventBus                           │  │
│  │    (agent 事件的统一分发：流式文本、状态变更、错误)      │  │
│  └──────────────────────┬──────────────────────────────┘  │
│                         │                                 │
│  ┌──────────────────────▼──────────────────────────────┐  │
│  │                    核心层                             │  │
│  │                                                      │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │             AgentManager                        │  │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐          │  │  │
│  │  │  │ Agent A │ │ Agent B │ │ Agent C │  ...      │  │  │
│  │  │  │(Runtime)│ │(Runtime)│ │(Runtime)│           │  │  │
│  │  │  └─────────┘ └─────────┘ └─────────┘          │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │                                                      │  │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────┐   │  │
│  │  │  Scheduler │  │  Memory    │  │   Skills     │   │  │
│  │  │  (cron)    │  │  Manager   │  │   Loader     │   │  │
│  │  └────────────┘  └────────────┘  └──────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                 │
│  ┌──────────────────────▼──────────────────────────────┐  │
│  │                    存储层                             │  │
│  │  SQLite (messages, sessions, tasks, chats)           │  │
│  │  文件系统 (memory/MEMORY.md, memory/logs/*.md)        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                           │
│  Config ──── Logger                                       │
└──────────────────────────────────────────────────────────┘
```

### 核心设计原则

1. **EventBus 解耦**：Agent 执行时通过 EventBus 广播事件（流式文本、工具调用、完成、错误），所有订阅者（Telegram、Web SSE、日志）独立消费
2. **同一 Agent 多端共享**：一个 agent 可同时服务 Telegram 和 Web，共享记忆，但各端维护独立的对话 session
3. **Channel 统一抽象**：Telegram 和 Web 都实现 Channel 接口，通过 chatId 前缀区分来源（`tg:123` vs `web:uuid`）

---

## EventBus 设计

这是架构的关键枢纽，实现 Agent 执行与多端输出的解耦：

```typescript
// 事件类型
type AgentEvent =
  | { type: 'stream'; agentId: string; chatId: string; text: string }        // 流式文本片段
  | { type: 'tool_use'; agentId: string; chatId: string; tool: string }      // 工具调用
  | { type: 'complete'; agentId: string; chatId: string; fullText: string }  // 完成
  | { type: 'error'; agentId: string; chatId: string; error: string }        // 错误
  | { type: 'status'; agentId: string; status: AgentStatus }                 // 状态变更

class EventBus {
  subscribe(filter: EventFilter, handler: (event: AgentEvent) => void): Unsubscribe;
  emit(event: AgentEvent): void;
}
```

**消费者：**
- **Telegram Channel** — 订阅 `complete` 事件，收到完整文本后发送消息
- **Web SSE** — 订阅 `stream` 事件，逐片段推送给浏览器
- **Memory Manager** — 订阅 `complete` 事件，追加每日日志
- **DB Logger** — 订阅 `complete` 事件，存储到 messages 表

---

## Agent 多端共享模型

```
                    ┌──────────────┐
                    │   Agent A    │
                    │  (Runtime)   │
                    │  (Memory)    │
                    │  (Skills)    │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼─────┐ ┌───▼────┐ ┌────▼─────┐
       │ Session 1  │ │Session2│ │ Session3 │
       │ tg:12345   │ │web:uuid│ │ tg:-100..│
       │ (私聊)     │ │(Web端) │ │ (群聊)   │
       └────────────┘ └────────┘ └──────────┘
```

- **Agent** = 一个独立的 AI 角色，有自己的配置、记忆、Skills
- **Session** = 一段对话上下文，按 `(agent_id, chat_id)` 唯一
- **chatId** = 统一标识符，`tg:` 前缀来自 Telegram，`web:` 前缀来自 Web
- **记忆共享**：同一 Agent 的所有 session 共享 MEMORY.md 和每日日志
- **Session 独立**：每个 chatId 有独立的 Claude SDK sessionId，对话历史互不干扰

---

## 消息流（多端统一）

```
任意入口 (Telegram / Web / API / Scheduler)
  │
  ▼
MessageRouter.handleInbound(chatId, message, source)
  │
  ├── 存入 SQLite messages 表
  ├── 解析 agent: AgentManager.resolveAgent(chatId)
  ├── 检查 trigger（群聊场景）
  │
  ▼
AgentQueue.enqueue(agentId, chatId)
  │
  ▼
AgentRuntime.process(prompt, systemPrompt, sessionId)
  │
  ├── 构建 system prompt = base + skills + memory context
  ├── Claude Agent SDK query()
  │     │
  │     ├── stream event → EventBus.emit({ type: 'stream', ... })
  │     └── result       → EventBus.emit({ type: 'complete', ... })
  │
  ▼
EventBus 广播
  ├── Telegram 订阅者 → bot.api.sendMessage() [仅对 tg: chatId]
  ├── Web SSE 订阅者  → res.write(chunk)     [仅对 web: chatId]
  ├── DB Logger       → 存入 messages 表
  └── Memory Manager  → 追加每日日志
```

---

## Web UI 模块规划（V1）

### 整体布局

```
┌──────────────────────────────────────────────────────┐
│  顶部导航栏：Logo · Agent 切换 · 系统状态 · 设置     │
├────────────┬─────────────────────────────────────────┤
│            │                                          │
│  侧边栏    │              主内容区                     │
│            │                                          │
│  · 聊天    │   (根据侧边栏选择切换)                    │
│  · Agents  │                                          │
│  · 任务    │                                          │
│  · 记忆    │                                          │
│  · Skills  │                                          │
│  · 系统    │                                          │
│            │                                          │
├────────────┴─────────────────────────────────────────┤
│  状态栏：连接状态 · 活跃 agent 数 · Telegram 状态     │
└──────────────────────────────────────────────────────┘
```

### 模块详情

#### 1. 聊天模块 (Chat)
**核心功能 — 与 Agent 对话**

```
┌────────────────────────────────────────────┐
│  对话列表（左）    │    对话内容（右）       │
│                   │                        │
│  · Agent A - Web  │  [消息气泡]            │
│  · Agent A - TG   │  [消息气泡]            │
│  · Agent B - Web  │  [流式输出中...]       │
│  · + 新对话       │                        │
│                   │  ┌──────────────────┐  │
│                   │  │ 输入框 · 发送    │  │
│                   │  └──────────────────┘  │
└────────────────────────────────────────────┘
```

- 与指定 Agent 的实时对话（SSE 流式输出）
- 查看所有对话历史（包括 Telegram 端的消息记录，只读）
- 新建 Web 端对话
- 消息支持 Markdown 渲染
- 支持文件/图片附件（未来）

#### 2. Agent 管理模块 (Agents)
**管理所有 Agent 实例**

```
┌────────────────────────────────────────────┐
│  Agent 列表          │  Agent 详情         │
│                      │                     │
│  [A] Jerry助手 🟢    │  基本信息           │
│  [B] 代码助手 🟡    │  · 名称 / ID / 模型 │
│  [C] 数据助手 ⚪    │  · 状态 / 工作目录  │
│                      │                     │
│  + 创建 Agent        │  Telegram 绑定      │
│                      │  · chatIds 列表     │
│                      │  · trigger 配置     │
│                      │                     │
│                      │  活跃 Sessions      │
│                      │  Skills 列表        │
│                      │  操作: 重载/停用    │
└────────────────────────────────────────────┘
```

- Agent 列表 + 状态指示（活跃/空闲/停用）
- 查看/编辑 Agent 配置（agent.yaml 的可视化编辑）
- 查看 Agent 的活跃 sessions
- 查看 Agent 加载的 Skills
- 创建新 Agent（向导式）
- 重载 Agent 配置 / 停用 Agent

#### 3. 定时任务模块 (Tasks)
**管理调度任务**

```
┌────────────────────────────────────────────┐
│  任务列表                                   │
│                                             │
│  ID    Agent    调度        下次执行  状态   │
│  t-1   Agent A  */5 * * *  14:30   🟢活跃  │
│  t-2   Agent B  每天 9:00  明天9:00 🟢活跃  │
│  t-3   Agent A  一次性     已完成   ✅完成  │
│                                             │
│  + 创建任务                                  │
│                                             │
│  ── 任务详情 ──                              │
│  Prompt: "生成今日代码审查报告"              │
│  最近运行记录:                               │
│    · 03-10 14:25 ✅ 耗时 12s               │
│    · 03-10 14:20 ✅ 耗时 8s                │
│    · 03-10 14:15 ❌ 超时                    │
└────────────────────────────────────────────┘
```

- 任务列表 + 状态（活跃/暂停/完成）
- 创建任务（选 Agent、写 Prompt、设调度规则）
- 编辑/暂停/删除任务
- 立即执行（手动触发）
- 查看运行历史 + 日志

#### 4. 记忆模块 (Memory)
**查看和管理 Agent 记忆**

```
┌────────────────────────────────────────────┐
│  Agent A 的记忆                             │
│                                             │
│  [长期记忆 MEMORY.md]  [每日日志]           │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ # Agent Memory                       │  │
│  │                                      │  │
│  │ ## 用户偏好                          │  │
│  │ - Jerry 偏好 TypeScript              │  │
│  │ - 使用 Bun 运行时                    │  │
│  │                                      │  │
│  │ ## 进行中的项目                       │  │
│  │ - ZoerClaw: 桌面AI助手              │  │
│  │                             [编辑]   │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  每日日志:                                   │
│  · 2026-03-10 (今天) - 5 条记录            │
│  · 2026-03-09 - 3 条记录                   │
│  · 2026-03-08 - 8 条记录                   │
└────────────────────────────────────────────┘
```

- 按 Agent 查看 MEMORY.md（Markdown 渲染 + 编辑）
- 按日期浏览每日对话日志
- 搜索记忆内容
- 手动编辑长期记忆

#### 5. Skills 模块 (Skills)
**查看和管理 Skills**

```
┌────────────────────────────────────────────┐
│  Skills 列表                                │
│                                             │
│  🌐 agent-browser     [bundled]  ✅ 可用   │
│     浏览器自动化                            │
│                                             │
│  🗄️ nubase-database   [bundled]  ✅ 可用   │
│     数据库操作                              │
│                                             │
│  📷 ai-image          [bundled]  ⚠️ 缺 env │
│     图片生成 (需要 MINIMAX_API_KEY)         │
│                                             │
│  ── Skill 详情 ──                           │
│  来源: bundled / workspace / personal       │
│  适用 OS: darwin                            │
│  依赖: chrome (✅), node (✅)               │
│  环境变量: BROWSER_KEY (❌ 未设置)          │
│  启用该 Skill 的 Agents: Agent A, Agent B   │
└────────────────────────────────────────────┘
```

- 列出所有可用 Skills（按来源分组：bundled / workspace / personal）
- 显示每个 Skill 的资格状态（OS/依赖/环境变量检查）
- 查看 Skill 详情（SKILL.md 内容渲染）
- 查看哪些 Agent 启用了该 Skill

#### 6. 系统模块 (System)
**监控和配置**

```
┌────────────────────────────────────────────┐
│  系统状态                                   │
│                                             │
│  服务运行时间: 2h 34m                       │
│  Telegram: 🟢 已连接 (Long Polling)        │
│  数据库: 🟢 zoerclaw.db (2.3 MB)          │
│  活跃 Agents: 3 / 总计: 5                  │
│  活跃 Sessions: 7                           │
│  定时任务: 4 活跃 / 1 暂停                  │
│                                             │
│  ── 实时日志 ──                              │
│  14:30:01 [agent-a] 收到消息 from tg:123   │
│  14:30:02 [agent-a] 开始处理...            │
│  14:30:15 [agent-a] 回复完成 (13s)         │
│  14:30:16 [scheduler] 执行任务 t-1         │
│                                             │
│  ── 配置 ──                                  │
│  环境变量 / 全局设置 / 日志级别              │
└────────────────────────────────────────────┘
```

- 系统运行状态概览
- Channel 连接状态
- 实时日志流（SSE 推送）
- 全局配置查看

---

## 项目结构（更新版）

```
ZoerClaw/
├── package.json
├── tsconfig.json
├── .env / .env.example
├── CLAUDE.md
│
├── src/                              # 后端
│   ├── index.ts                      # 主入口
│   │
│   ├── config/
│   │   ├── index.ts
│   │   ├── env.ts                    # Zod 环境变量校验
│   │   └── paths.ts                  # 路径常量
│   │
│   ├── logger/
│   │   └── index.ts                  # 结构化日志
│   │
│   ├── events/
│   │   ├── index.ts
│   │   ├── bus.ts                    # EventBus 实现
│   │   └── types.ts                  # AgentEvent 类型定义
│   │
│   ├── db/
│   │   ├── index.ts                  # 数据库初始化 + schema
│   │   ├── messages.ts               # 消息存储查询
│   │   ├── tasks.ts                  # 定时任务查询
│   │   └── sessions.ts              # Session 管理查询
│   │
│   ├── agent/
│   │   ├── index.ts
│   │   ├── manager.ts               # AgentManager：多 agent 生命周期
│   │   ├── runtime.ts               # AgentRuntime：封装 Claude Agent SDK
│   │   ├── queue.ts                  # AgentQueue：并发控制
│   │   └── types.ts
│   │
│   ├── channel/
│   │   ├── index.ts
│   │   ├── types.ts                  # Channel 接口
│   │   ├── telegram.ts              # TelegramChannel (grammy)
│   │   └── router.ts               # 消息路由：channel → agent
│   │
│   ├── memory/
│   │   ├── index.ts
│   │   └── manager.ts              # 每 agent 记忆管理
│   │
│   ├── scheduler/
│   │   ├── index.ts
│   │   └── scheduler.ts            # 定时任务轮询 + 执行
│   │
│   ├── skills/
│   │   ├── index.ts
│   │   ├── loader.ts               # SKILL.md 发现 + 加载
│   │   ├── frontmatter.ts          # 前置元数据解析
│   │   ├── eligibility.ts          # 资格检查
│   │   └── types.ts
│   │
│   └── routes/                      # HTTP API (Hono)
│       ├── index.ts
│       ├── health.ts                # GET /api/health
│       ├── agents.ts                # Agent 管理 CRUD
│       ├── messages.ts              # 消息发送 + 历史查询
│       ├── stream.ts                # SSE 流式推送端点
│       ├── tasks.ts                 # 定时任务 CRUD
│       ├── memory.ts                # 记忆查询/编辑
│       └── skills.ts                # Skills 列表
│
├── web/                              # 前端 (Vite + React)
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx                  # React 入口
│   │   ├── App.tsx                   # 路由 + 布局
│   │   ├── api/                      # API 客户端
│   │   │   ├── client.ts             # fetch 封装
│   │   │   └── sse.ts                # SSE 订阅封装
│   │   ├── pages/
│   │   │   ├── Chat.tsx              # 聊天页
│   │   │   ├── Agents.tsx            # Agent 管理页
│   │   │   ├── Tasks.tsx             # 任务管理页
│   │   │   ├── Memory.tsx            # 记忆查看页
│   │   │   ├── Skills.tsx            # Skills 列表页
│   │   │   └── System.tsx            # 系统监控页
│   │   ├── components/
│   │   │   ├── layout/               # 布局组件（Sidebar, Navbar, StatusBar）
│   │   │   ├── chat/                 # 聊天组件（MessageList, Input, Bubble）
│   │   │   ├── agents/               # Agent 组件（AgentCard, ConfigEditor）
│   │   │   ├── tasks/                # 任务组件（TaskList, TaskForm, RunLog）
│   │   │   ├── memory/               # 记忆组件（MemoryEditor, DailyLog）
│   │   │   └── common/               # 通用组件（Badge, Modal, Loading）
│   │   ├── hooks/                    # React hooks
│   │   │   ├── useSSE.ts             # SSE 连接 hook
│   │   │   ├── useAgent.ts           # Agent 数据 hook
│   │   │   └── useChat.ts            # 聊天状态 hook
│   │   ├── stores/                   # 状态管理（zustand 或 context）
│   │   └── styles/                   # Tailwind CSS
│   └── public/
│
├── agents/                           # Agent 工作空间
│   └── default/
│       ├── agent.yaml
│       ├── prompts/
│       │   └── system.md
│       ├── skills/
│       └── memory/
│           ├── MEMORY.md
│           └── logs/
│
├── skills/                           # 共享 Skills
├── prompts/                          # 共享提示词模板
│   ├── system.md
│   └── env.md
├── plans/                            # 项目计划文档
│
└── data/
    └── zoerclaw.db
```

---

## 关键设计

### 1. Agent 系统

**AgentManager** 管理多个 agent，每个 agent 有独立的：
- 工作空间目录（`agents/<id>/`）
- 配置文件（`agent.yaml`）
- AgentRuntime 实例（封装 Claude Agent SDK `query()`）
- 记忆文件（`memory/MEMORY.md` + `memory/logs/`）
- Skills 列表
- 多个 Session（按 chatId 区分）

**agent.yaml 格式：**
```yaml
id: default
name: "Jerry's Assistant"
model: "claude-sonnet-4-6"
trigger: "@assistant"
requiresTrigger: false
telegram:
  chatIds:
    - "tg:123456789"
memory:
  enabled: true
skills:
  - agent-browser
  - file-upload
```

**AgentRuntime** 参考 zoer-agent 的设计思路：
- 封装 Claude Agent SDK `query()` 调用
- 流式处理：每个文本片段通过 EventBus 广播
- Session resume 支持（通过 sessionId）
- 系统提示词 = base + skills + memory context

**AgentQueue**：每 agent 最多 1 个并发执行，多余请求排队

### 2. Channel 系统

**Channel 接口**：
```typescript
interface Channel {
  name: string;
  connect(): Promise<void>;
  sendMessage(chatId: string, text: string): Promise<void>;
  isConnected(): boolean;
  ownsChatId(chatId: string): boolean;
  disconnect(): Promise<void>;
}
```

**chatId 规范：**
- Telegram: `tg:<chat_id>` (如 `tg:123456789`)
- Web: `web:<uuid>` (如 `web:a1b2c3d4`)

Telegram Channel 订阅 EventBus 的 `complete` 事件，Web 端订阅 `stream` 事件（逐片段推送）。

### 3. Memory 系统

**文件式记忆**（兼容 OpenClaw 理念）：
- `agents/<id>/memory/MEMORY.md` — 长期记忆
- `agents/<id>/memory/logs/YYYY-MM-DD.md` — 每日对话日志

**所有 session 共享同一 Agent 的记忆**。

### 4. 定时任务系统

- 三种调度类型：`cron` / `interval` / `once`
- 每 60 秒轮询 `scheduled_tasks` 表
- 到期任务通过 AgentRuntime 直接执行
- 结果发送到指定 chatId（可以是 Telegram 或 Web）

### 5. Skills 系统（完全兼容 OpenClaw）

**加载优先级：**
1. Agent 工作空间 skills: `agents/<id>/skills/`
2. 项目 skills: `skills/`
3. 用户 skills: `~/.zoerclaw/skills/`

### 6. 数据库 Schema

```sql
CREATE TABLE messages (
  id TEXT, chat_id TEXT, sender TEXT, sender_name TEXT,
  content TEXT, timestamp TEXT,
  is_from_me INTEGER, is_bot_message INTEGER DEFAULT 0,
  PRIMARY KEY (id, chat_id)
);

CREATE TABLE chats (
  chat_id TEXT PRIMARY KEY, name TEXT, agent_id TEXT,
  channel TEXT, is_group INTEGER DEFAULT 0, last_message_time TEXT
);

CREATE TABLE sessions (
  agent_id TEXT, chat_id TEXT, session_id TEXT NOT NULL,
  PRIMARY KEY (agent_id, chat_id)
);

CREATE TABLE scheduled_tasks (
  id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, chat_id TEXT NOT NULL,
  prompt TEXT NOT NULL, schedule_type TEXT NOT NULL,
  schedule_value TEXT NOT NULL, context_mode TEXT DEFAULT 'isolated',
  next_run TEXT, status TEXT DEFAULT 'active', created_at TEXT NOT NULL
);

CREATE TABLE task_run_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL,
  run_at TEXT NOT NULL, duration_ms INTEGER NOT NULL,
  status TEXT NOT NULL, result TEXT, error TEXT
);

CREATE TABLE kv_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
```

### 7. HTTP API

```
# 健康 & 状态
GET  /api/health
GET  /api/status

# Agent 管理
GET  /api/agents
GET  /api/agents/:id
POST /api/agents/:id/reload

# 聊天 & 消息
POST /api/agents/:id/message         # 发消息（触发 agent 处理）
GET  /api/chats                       # 所有对话列表
GET  /api/chats/:chatId/messages      # 消息历史

# SSE 流式推送
GET  /api/stream/:chatId              # 订阅某个 chat 的流式事件
GET  /api/stream/system               # 订阅系统级事件（日志、状态变更）

# 定时任务
GET  /api/tasks
POST /api/tasks
PUT  /api/tasks/:id
DELETE /api/tasks/:id
POST /api/tasks/:id/run               # 手动触发
GET  /api/tasks/:id/logs              # 运行历史

# 记忆
GET  /api/agents/:id/memory           # MEMORY.md 内容
PUT  /api/agents/:id/memory           # 编辑 MEMORY.md
GET  /api/agents/:id/memory/logs      # 每日日志列表
GET  /api/agents/:id/memory/logs/:date # 某天的日志

# Skills
GET  /api/skills                      # 所有可用 skills
GET  /api/agents/:id/skills           # agent 启用的 skills
```

---

## 开发方针

- **从零编写所有代码**，参考 zoer-agent / nanoClaw / OpenClaw 的架构设计，但不直接拷贝
- **Agent 执行方式**：使用 Claude Agent SDK 的 `query()` 函数
- **开发节奏**：渐进式，先完成 Phase 1 再继续
- **Telegram 模式**：Long Polling（`bot.start()` 长轮询，无需公网 IP）

### 参考文件索引（仅参考设计思路，不拷贝代码）

| 组件 | 参考来源 | 关键参考文件 |
|------|----------|-------------|
| AgentRuntime | zoer-agent | `zoer-agent/src/agent/runtime.ts` |
| Logger | zoer-agent | `zoer-agent/src/logger/index.ts` |
| Config | zoer-agent | `zoer-agent/src/config/env.ts` |
| Telegram Channel | nanoClaw | `nanoclaw/src/channels/telegram.ts` |
| Channel 接口 | nanoClaw | `nanoclaw/src/types.ts` |
| SQLite Schema | nanoClaw | `nanoclaw/src/db.ts` |
| 消息格式化 | nanoClaw | `nanoclaw/src/router.ts` |
| Scheduler | nanoClaw | `nanoclaw/src/task-scheduler.ts` |
| Skill 类型/加载 | OpenClaw | `openclaw/src/agents/skills/` |

---

## 渐进式开发阶段

### Phase 1：Web 聊天 + Agent 管理 ← 当前阶段
**目标：浏览器中与 Agent 流式对话，能查看/切换 Agent**

#### 后端实现

**Step 1: 项目骨架**
- `bun init`，配置 `package.json`
- `tsconfig.json`、`.gitignore`、`.env.example`、`CLAUDE.md`
- 依赖：`@anthropic-ai/claude-agent-sdk` `hono` `better-sqlite3` `zod` `pino`

**Step 2: Config + Logger**
- `src/config/env.ts` — Zod 校验：`ANTHROPIC_API_KEY`、`PORT`(3000)、`DATA_DIR`(./data)、`AGENT_MODEL`(claude-sonnet-4-6)
- `src/config/paths.ts` — 路径常量
- `src/logger/index.ts` — Pino 结构化日志

**Step 3: EventBus**
- `src/events/bus.ts` — 基于 EventEmitter 的事件总线
- `src/events/types.ts` — AgentEvent 类型（stream / tool_use / complete / error）
- 支持按 chatId 过滤订阅

**Step 4: Database**
- `src/db/index.ts` — better-sqlite3 初始化 + 建表
- 初始表：`messages`、`chats`、`sessions`、`kv_state`
- 基本查询：存消息、查消息历史、存/取 session

**Step 5: AgentRuntime**
- `src/agent/runtime.ts` — 封装 Claude Agent SDK `query()`
  - `process(prompt, options)` → 调用 query()
  - 流式处理：每个文本片段 → EventBus.emit({ type: 'stream' })
  - 完成时 → EventBus.emit({ type: 'complete' })
  - Session resume 支持
- `src/agent/types.ts` — AgentState 类型

**Step 6: HTTP API + SSE**
- `src/routes/health.ts` — GET /api/health
- `src/routes/agents.ts` — GET /api/agents（读取 agents/ 目录）
- `src/routes/messages.ts` — POST /api/agents/:id/message + GET /api/chats/:chatId/messages
- `src/routes/stream.ts` — GET /api/stream/:chatId（SSE 端点，订阅 EventBus 转发给浏览器）
- CORS 配置（允许 Vite dev server）

**Step 7: 主入口**
- `src/index.ts` — 启动 Config → DB → EventBus → AgentRuntime → Hono Server
- 优雅关闭（SIGTERM/SIGINT）

**Step 8: 基础提示词 + Agent 工作空间**
- `prompts/system.md` — 基础系统提示词
- `prompts/env.md` — 环境上下文模板
- `agents/default/agent.yaml` — 默认 agent 配置

#### 前端实现

**Step 9: Vite + React 脚手架**
- `web/` 目录，Vite + React + TypeScript
- shadcn/ui 初始化（Tailwind CSS + Radix UI）
- 基础主题配置（参考 OpenClaw 暗色风格）

**Step 10: 布局骨架**
参考 OpenClaw 的 shell 布局：
```
┌─────────────────────────────────────────────┐
│  TOPBAR: Logo "ZoerClaw" · 系统状态指示     │
├──────────┬──────────────────────────────────┤
│ SIDEBAR  │          CONTENT                 │
│ (220px)  │                                  │
│          │                                  │
│ Chat     │   (根据路由切换)                  │
│ Agents   │                                  │
│ ──────── │                                  │
│ Tasks  ○ │                                  │
│ Memory ○ │                                  │
│ Skills ○ │                                  │
│ System ○ │                                  │
│          │   ○ = Phase 1 占位，不可用        │
└──────────┴──────────────────────────────────┘
```

组件：
- `components/layout/Sidebar.tsx` — 导航侧边栏
- `components/layout/Topbar.tsx` — 顶栏
- `components/layout/Shell.tsx` — 整体布局容器
- 路由：react-router-dom

**Step 11: 聊天模块**
```
┌──────────────┬────────────────────────────┐
│ 对话列表      │   对话内容                  │
│              │                            │
│ Agent A 🟢  │  [user] 你好               │
│  └ web:xxx  │  [assistant] 你好！有什么... │
│              │  [user] 帮我写个函数        │
│              │  [assistant] ▊ (流式输出中) │
│              │                            │
│ + 新对话     │  ┌────────────────────────┐│
│              │  │ 输入消息...      [发送] ││
│              │  └────────────────────────┘│
└──────────────┴────────────────────────────┘
```

组件：
- `pages/Chat.tsx` — 聊天页面
- `components/chat/ChatSidebar.tsx` — 对话列表
- `components/chat/MessageList.tsx` — 消息列表（分组渲染，参考 OpenClaw）
- `components/chat/MessageBubble.tsx` — 单条消息（Markdown 渲染）
- `components/chat/ChatInput.tsx` — 输入框 + 发送按钮
- `hooks/useSSE.ts` — SSE 连接 hook
- `hooks/useChat.ts` — 聊天状态管理

功能：
- SSE 流式输出（逐字显示）
- Markdown 渲染（react-markdown + remark-gfm）
- 消息历史加载
- 新建对话
- 自动滚动到底部

**Step 12: Agent 管理模块**
```
┌──────────────┬────────────────────────────┐
│ Agent 列表    │   Agent 详情               │
│              │                            │
│ [🟢] 默认   │  名称: Jerry's Assistant   │
│     助手     │  ID: default               │
│              │  模型: claude-sonnet-4-6    │
│ [⚪] 代码   │  状态: 空闲                 │
│     助手     │  工作目录: agents/default/  │
│              │                            │
│              │  活跃 Sessions: 2           │
│              │  · web:abc... (Web)         │
│              │  · tg:123... (Telegram)     │
│              │                            │
│              │  [开始对话] [重载配置]       │
└──────────────┴────────────────────────────┘
```

组件：
- `pages/Agents.tsx` — Agent 管理页
- `components/agents/AgentList.tsx` — Agent 列表
- `components/agents/AgentDetail.tsx` — Agent 详情面板

功能：
- Agent 列表 + 状态指示
- 查看 Agent 配置信息
- 查看活跃 sessions
- 点击"开始对话"跳转到 Chat 页

**交付物：** 浏览器打开 `http://localhost:5173`，能与 Claude Agent 流式对话，能查看和切换 Agent

**验证：**
1. `bun run dev` 启动后端 → `http://localhost:3000/api/health` 返回 OK
2. `cd web && bun run dev` 启动前端 → `http://localhost:5173` 看到完整布局
3. 在聊天界面输入消息 → 看到 Claude 流式回复
4. 切换到 Agents 页 → 看到 default agent 信息
5. SSE 端点 `curl http://localhost:3000/api/stream/web:test` → 收到事件流

---

### Phase 2：Telegram 接入 + 多 Agent
**目标：Telegram Bot + 多 agent 路由**

实现：
1. TelegramChannel（grammy, Long Polling）
2. agent.yaml 配置格式（Telegram chatId 绑定）
3. AgentManager（加载/管理多 agent）
4. MessageRouter（按 chatId 路由到 agent，支持 tg: 和 web: 前缀）
5. Trigger pattern 支持（群聊 @mention）
6. AgentQueue 并发控制
7. Web Agent 管理模块增强（编辑配置）

### Phase 3：Skills 系统
**目标：OpenClaw 兼容的 Skills 加载**

实现：
1. Skills Loader（SKILL.md 发现 + 加载，三级优先级）
2. Frontmatter 解析
3. 资格检查（OS/bin/env）
4. Skills 注入 Agent 系统提示词
5. Web Skills 管理模块

### Phase 4：Memory 系统
**目标：跨 session 持久记忆**

实现：
1. MemoryManager
2. 每日对话日志自动写入
3. Memory 上下文注入系统提示词
4. Agent 可自主更新 MEMORY.md
5. Web 记忆查看/编辑模块

### Phase 5：定时任务
**目标：cron/interval/once 调度**

实现：
1. Scheduler 轮询循环
2. 任务 CRUD（数据库 + API）
3. 任务执行 + 结果发送（Telegram / Web）
4. 运行日志记录
5. Web 任务管理模块

### Phase 6：系统监控 + 完善
**目标：系统模块 + 全面打磨**

实现：
1. Web 系统监控模块（状态、日志流、配置）
2. 完善所有 HTTP API
3. OpenAPI 文档
4. 错误处理优化
5. UI 响应式适配
