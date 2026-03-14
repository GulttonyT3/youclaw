import { Hono } from 'hono'
import { getSettings, updateSettings, getActiveModelConfig } from '../settings/manager.ts'

const app = new Hono()

// GET /settings — 返回完整 settings（apiKey 脱敏）
app.get('/settings', (c) => {
  const settings = getSettings()

  // apiKey 脱敏：只保留后 4 位
  const masked = {
    ...settings,
    customModels: settings.customModels.map((m) => ({
      ...m,
      apiKey: m.apiKey ? `****${m.apiKey.slice(-4)}` : '',
    })),
  }

  return c.json(masked)
})

// PATCH /settings — 局部更新
app.patch('/settings', async (c) => {
  const body = await c.req.json() as Record<string, unknown>

  // 只取 body 中实际传了的字段，避免 Zod default 值覆盖已有数据
  const current = getSettings()
  const partial: Record<string, unknown> = {}

  if ('activeModel' in body) {
    partial.activeModel = body.activeModel
  }

  if ('customModels' in body && Array.isArray(body.customModels)) {
    // 保留脱敏 apiKey 对应的原始值
    const existingMap = new Map(current.customModels.map((m) => [m.id, m.apiKey]))
    partial.customModels = (body.customModels as Array<Record<string, unknown>>).map((m) => {
      const apiKey = String(m.apiKey ?? '')
      if (apiKey.startsWith('****') && existingMap.has(String(m.id))) {
        return { ...m, apiKey: existingMap.get(String(m.id))! }
      }
      return m
    })
  }

  const updated = updateSettings(partial)

  // 返回脱敏后的结果
  const masked = {
    ...updated,
    customModels: updated.customModels.map((m) => ({
      ...m,
      apiKey: m.apiKey ? `****${m.apiKey.slice(-4)}` : '',
    })),
  }

  return c.json(masked)
})

// GET /settings/active-model — 返回当前激活模型的完整配置（内部用，不脱敏）
app.get('/settings/active-model', (c) => {
  const config = getActiveModelConfig()
  if (!config) {
    return c.json({ source: 'env' })
  }
  return c.json({ source: 'settings', ...config })
})

export function createSettingsRoutes() {
  return app
}
