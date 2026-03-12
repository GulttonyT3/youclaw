import { Hono } from 'hono'
import { z } from 'zod/v4'
import { resolve } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import { ROOT_DIR } from '../config/index.ts'
import { getLogger } from '../logger/index.ts'
import type { MessageRouter } from '../channel/index.ts'

/**
 * Channel 定义：所有支持的 channel 元信息
 * 后续新增 channel 只需在这里加一条
 */
const CHANNEL_DEFINITIONS = [
  {
    id: 'telegram',
    label: 'Telegram',
    description: 'Telegram Bot API (Long Polling)',
    chatIdPrefix: 'tg:',
    envKeys: [
      { key: 'TELEGRAM_BOT_TOKEN', label: 'Bot Token', placeholder: '123456:ABC-DEF...', secret: true },
    ],
    docsUrl: 'https://core.telegram.org/bots',
  },
  {
    id: 'feishu',
    label: 'Feishu / Lark',
    description: 'Feishu Bot (WebSocket Long Connection)',
    chatIdPrefix: 'feishu:',
    envKeys: [
      { key: 'FEISHU_APP_ID', label: 'App ID', placeholder: 'cli_xxxxx', secret: false },
      { key: 'FEISHU_APP_SECRET', label: 'App Secret', placeholder: '', secret: true },
    ],
    docsUrl: 'https://open.feishu.cn',
  },
  {
    id: 'qq',
    label: 'QQ',
    description: 'QQ Bot API',
    chatIdPrefix: 'qq:',
    envKeys: [
      { key: 'QQ_BOT_APPID', label: 'Bot App ID', placeholder: '', secret: false },
      { key: 'QQ_BOT_SECRET', label: 'Bot Secret', placeholder: '', secret: true },
    ],
    docsUrl: 'https://q.qq.com',
  },
] as const

const updateEnvSchema = z.object({
  key: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  value: z.string(),
})

export function createChannelsRoutes(router: MessageRouter) {
  const channels = new Hono()

  // GET /api/channels — 列出所有 channel（含定义 + 运行时状态 + 配置值）
  channels.get('/channels', (c) => {
    const statuses = router.getChannelStatuses()
    const statusMap = new Map(statuses.map((s) => [s.name, s.connected]))

    const result = CHANNEL_DEFINITIONS.map((def) => {
      // 读取当前环境变量值（secret 类型只返回是否已配置）
      const envValues: Record<string, { value: string; configured: boolean }> = {}
      for (const env of def.envKeys) {
        const raw = process.env[env.key] ?? ''
        envValues[env.key] = {
          value: env.secret ? '' : raw,
          configured: raw.length > 0,
        }
      }

      return {
        ...def,
        connected: statusMap.get(def.id) ?? false,
        configured: def.envKeys.every((e) => (process.env[e.key] ?? '').length > 0),
        envValues,
      }
    })

    return c.json(result)
  })

  // PUT /api/channels/env — 保存单个环境变量到 .env
  channels.put('/channels/env', async (c) => {
    const body = await c.req.json()
    const parsed = updateEnvSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid parameters', details: parsed.error.issues }, 400)
    }

    const { key, value } = parsed.data
    const logger = getLogger()

    // 校验 key 属于某个 channel 的 envKeys
    const allKeys: string[] = CHANNEL_DEFINITIONS.flatMap((d) => d.envKeys.map((e) => e.key))
    if (!allKeys.includes(key)) {
      return c.json({ error: `Unknown channel env key: ${key}` }, 400)
    }

    const envPath = resolve(ROOT_DIR, '.env')

    try {
      let content = ''
      try {
        content = readFileSync(envPath, 'utf-8')
      } catch {
        // .env 不存在，创建空文件
      }

      const lineRegex = new RegExp(`^(#\\s*)?${key}\\s*=.*$`, 'm')
      if (lineRegex.test(content)) {
        content = content.replace(lineRegex, `${key}=${value}`)
      } else {
        content = content.trimEnd() + `\n${key}=${value}\n`
      }

      writeFileSync(envPath, content, 'utf-8')
      process.env[key] = value

      logger.info({ key }, 'Channel 环境变量已保存')
      return c.json({ ok: true, needsRestart: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error({ key, error: msg }, '保存 Channel 环境变量失败')
      return c.json({ error: msg }, 500)
    }
  })

  return channels
}
