import { Hono } from 'hono'
import { getAuthToken } from './auth.ts'
import { getLogger } from '../logger/index.ts'

// readmex.com API 地址
function getReadmexBaseUrl(): string {
  return process.env.READMEX_API_URL || 'https://readmex.com'
}

export function createCreditRoutes() {
  const app = new Hono()

  // GET /credit/balance — 查询积分余额
  app.get('/credit/balance', async (c) => {
    const token = getAuthToken()
    if (!token) {
      return c.json({ error: 'Not logged in' }, 401)
    }

    try {
      const res = await fetch(`${getReadmexBaseUrl()}/api/credit/balance`, {
        headers: { rdxtoken: token },
      })

      if (!res.ok) {
        return c.json({ error: 'Failed to fetch balance' }, 500)
      }

      const data = await res.json()
      return c.json(data)
    } catch (err) {
      const logger = getLogger()
      logger.error({ error: String(err), category: 'credit' }, 'Failed to fetch credit balance')
      return c.json({ error: 'Failed to fetch balance' }, 500)
    }
  })

  // GET /credit/transactions — 查询积分流水
  app.get('/credit/transactions', async (c) => {
    const token = getAuthToken()
    if (!token) {
      return c.json({ error: 'Not logged in' }, 401)
    }

    try {
      // 透传分页参数
      const url = new URL(`${getReadmexBaseUrl()}/api/credit/transactions`)
      const page = c.req.query('page')
      const limit = c.req.query('limit')
      if (page) url.searchParams.set('page', page)
      if (limit) url.searchParams.set('limit', limit)

      const res = await fetch(url.toString(), {
        headers: { rdxtoken: token },
      })

      if (!res.ok) {
        return c.json({ error: 'Failed to fetch transactions' }, 500)
      }

      const data = await res.json()
      return c.json(data)
    } catch (err) {
      const logger = getLogger()
      logger.error({ error: String(err), category: 'credit' }, 'Failed to fetch credit transactions')
      return c.json({ error: 'Failed to fetch transactions' }, 500)
    }
  })

  return app
}
