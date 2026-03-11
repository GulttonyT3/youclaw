import { Hono } from 'hono'
import type { RegistryManager } from '../skills/registry.ts'
import { getLogger } from '../logger/index.ts'

export function createRegistryRoutes(registryManager: RegistryManager) {
  const api = new Hono()

  // 获取推荐技能列表（含安装状态）
  api.get('/registry/recommended', (c) => {
    const recommended = registryManager.getRecommended()
    return c.json(recommended)
  })

  // 安装推荐技能
  api.post('/registry/install', async (c) => {
    const logger = getLogger()
    const body = await c.req.json<{ slug: string }>()
    const { slug } = body

    if (!slug) {
      return c.json({ error: '缺少 slug 参数' }, 400)
    }

    try {
      await registryManager.installSkill(slug)
      return c.json({ ok: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error({ slug, error: message }, '安装技能失败')
      return c.json({ ok: false, error: message }, 500)
    }
  })

  // 卸载技能
  api.post('/registry/uninstall', async (c) => {
    const logger = getLogger()
    const body = await c.req.json<{ slug: string }>()
    const { slug } = body

    if (!slug) {
      return c.json({ error: '缺少 slug 参数' }, 400)
    }

    try {
      await registryManager.uninstallSkill(slug)
      return c.json({ ok: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error({ slug, error: message }, '卸载技能失败')
      return c.json({ ok: false, error: message }, 500)
    }
  })

  return api
}
