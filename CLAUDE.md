# ZoerClaw

桌面端 AI 助手应用，参考 nanoClaw/OpenClaw 设计。

## 命令

```bash
bun run dev          # 启动后端开发模式 (hot reload)
bun run dev:web      # 启动前端开发模式
bun run start        # 生产模式启动
bun run typecheck    # TypeScript 类型检查
bun test             # 运行测试
```

## 技术栈

- **运行时**: Bun
- **后端**: Hono (HTTP) + bun:sqlite (数据库) + Pino (日志)
- **Agent**: @anthropic-ai/claude-agent-sdk
- **前端**: Vite + React + shadcn/ui + Tailwind CSS
- **校验**: Zod

## 架构

- 详见 `plans/architecture.md`
- 三层结构：入口层（Telegram/Web/API）→ 核心层（AgentManager/Scheduler/Memory/Skills）→ 存储层（SQLite/文件系统）
- EventBus 解耦 Agent 执行和多端输出

## 约定

- Bun 自动加载 .env，不使用 dotenv
- 使用 `bun:sqlite` 而非 better-sqlite3
- 使用 `Bun.file` 而非 node:fs 的 readFile/writeFile
- 提交信息使用 Conventional Commits（英文）
- 代码注释使用中文
