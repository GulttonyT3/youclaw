/**
 * 前端辅助函数测试
 *
 * 测试 Tasks.tsx 中导出的纯函数逻辑
 * 由于组件函数是模块内部的，这里直接复制逻辑进行验证
 */

import { describe, test, expect } from 'bun:test'

// 复制自 Tasks.tsx 的纯函数（它们未 export，所以这里复制测试）

function formatRelative(iso: string | null): string {
  if (!iso) return '-'
  const date = new Date(iso)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const absDiff = Math.abs(diffMs)

  if (absDiff < 60_000) return diffMs > 0 ? 'in <1m' : '<1m ago'
  if (absDiff < 3_600_000) {
    const m = Math.round(absDiff / 60_000)
    return diffMs > 0 ? `in ${m}m` : `${m}m ago`
  }
  if (absDiff < 86_400_000) {
    const h = Math.round(absDiff / 3_600_000)
    return diffMs > 0 ? `in ${h}h` : `${h}h ago`
  }
  return date.toLocaleString()
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function scheduleLabel(type: string, value: string): string {
  if (type === 'cron') return `cron: ${value}`
  if (type === 'interval') {
    const ms = parseInt(value, 10)
    if (ms < 60_000) return `every ${ms / 1000}s`
    if (ms < 3_600_000) return `every ${ms / 60_000}m`
    return `every ${ms / 3_600_000}h`
  }
  if (type === 'once') return `once: ${new Date(value).toLocaleString()}`
  return value
}

function msToMinutes(ms: string): string {
  const n = parseInt(ms, 10)
  if (isNaN(n)) return ms
  return String(n / 60_000)
}

function isoToDatetimeLocal(iso: string): string {
  try {
    const d = new Date(iso)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return iso
  }
}

// ===== formatRelative =====

describe('formatRelative', () => {
  test('null → "-"', () => {
    expect(formatRelative(null)).toBe('-')
  })

  test('未来 30 秒 → "in <1m"', () => {
    const future = new Date(Date.now() + 30_000).toISOString()
    expect(formatRelative(future)).toBe('in <1m')
  })

  test('过去 30 秒 → "<1m ago"', () => {
    const past = new Date(Date.now() - 30_000).toISOString()
    expect(formatRelative(past)).toBe('<1m ago')
  })

  test('未来 5 分钟 → "in 5m"', () => {
    const future = new Date(Date.now() + 5 * 60_000).toISOString()
    expect(formatRelative(future)).toBe('in 5m')
  })

  test('过去 10 分钟 → "10m ago"', () => {
    const past = new Date(Date.now() - 10 * 60_000).toISOString()
    expect(formatRelative(past)).toBe('10m ago')
  })

  test('未来 2 小时 → "in 2h"', () => {
    const future = new Date(Date.now() + 2 * 3_600_000).toISOString()
    expect(formatRelative(future)).toBe('in 2h')
  })

  test('过去 3 小时 → "3h ago"', () => {
    const past = new Date(Date.now() - 3 * 3_600_000).toISOString()
    expect(formatRelative(past)).toBe('3h ago')
  })

  test('超过 24 小时使用 toLocaleString', () => {
    const farFuture = new Date(Date.now() + 2 * 86_400_000).toISOString()
    const result = formatRelative(farFuture)
    expect(result).not.toContain('in ')
    expect(result).not.toContain(' ago')
  })
})

// ===== formatDuration =====

describe('formatDuration', () => {
  test('毫秒级别', () => {
    expect(formatDuration(50)).toBe('50ms')
    expect(formatDuration(999)).toBe('999ms')
  })

  test('秒级别', () => {
    expect(formatDuration(1000)).toBe('1.0s')
    expect(formatDuration(1500)).toBe('1.5s')
    expect(formatDuration(10000)).toBe('10.0s')
  })

  test('边界值', () => {
    expect(formatDuration(0)).toBe('0ms')
    expect(formatDuration(1)).toBe('1ms')
  })
})

// ===== scheduleLabel =====

describe('scheduleLabel', () => {
  test('cron 类型', () => {
    expect(scheduleLabel('cron', '0 9 * * *')).toBe('cron: 0 9 * * *')
    expect(scheduleLabel('cron', '*/5 * * * *')).toBe('cron: */5 * * * *')
  })

  test('interval — 秒级', () => {
    expect(scheduleLabel('interval', '30000')).toBe('every 30s')
  })

  test('interval — 分钟级', () => {
    expect(scheduleLabel('interval', '60000')).toBe('every 1m')
    expect(scheduleLabel('interval', '1800000')).toBe('every 30m')
  })

  test('interval — 小时级', () => {
    expect(scheduleLabel('interval', '3600000')).toBe('every 1h')
    expect(scheduleLabel('interval', '7200000')).toBe('every 2h')
  })

  test('once 类型', () => {
    const result = scheduleLabel('once', '2026-03-10T14:30:00.000Z')
    expect(result.startsWith('once: ')).toBe(true)
  })

  test('未知类型返回原始值', () => {
    expect(scheduleLabel('unknown', 'raw-value')).toBe('raw-value')
  })
})

// ===== msToMinutes =====

describe('msToMinutes', () => {
  test('正常转换', () => {
    expect(msToMinutes('60000')).toBe('1')
    expect(msToMinutes('1800000')).toBe('30')
    expect(msToMinutes('3600000')).toBe('60')
  })

  test('非整数分钟', () => {
    expect(msToMinutes('90000')).toBe('1.5')
  })

  test('NaN 返回原始字符串', () => {
    expect(msToMinutes('abc')).toBe('abc')
    expect(msToMinutes('')).toBe('')
  })
})

// ===== isoToDatetimeLocal =====

describe('isoToDatetimeLocal', () => {
  test('标准 ISO 转换', () => {
    // 注意：转换为本地时间
    const result = isoToDatetimeLocal('2026-03-10T14:30:00.000Z')
    // 应该匹配 YYYY-MM-DDTHH:MM 格式
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  test('月和日正确补零', () => {
    const result = isoToDatetimeLocal('2026-01-05T03:07:00.000Z')
    // 本地时间可能因时区不同，但格式正确
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })
})

// ===== ScheduledTaskDTO 类型验证 =====

describe('ScheduledTaskDTO 字段完整性', () => {
  test('包含所有必要字段（类型定义验证）', () => {
    // 模拟一个完整的 DTO 对象，验证类型正确
    const dto = {
      id: 'test-id',
      agent_id: 'agent-1',
      chat_id: 'task:test',
      prompt: 'test prompt',
      schedule_type: 'interval',
      schedule_value: '60000',
      next_run: '2026-03-10T10:00:00.000Z' as string | null,
      last_run: null as string | null,
      status: 'active',
      created_at: '2026-03-10T00:00:00.000Z',
      name: 'test name' as string | null,
      description: 'test desc' as string | null,
    }

    expect(dto.name).toBe('test name')
    expect(dto.description).toBe('test desc')
    expect(Object.keys(dto).length).toBe(12) // 12 个字段
  })
})

// ===== 新增边界测试 =====

describe('formatRelative — 精确边界', () => {
  test('精确边界 60 秒未来 → "in 1m"', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    expect(formatRelative(future)).toBe('in 1m')
  })

  test('精确边界 60 秒过去 → "1m ago"', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(formatRelative(past)).toBe('1m ago')
  })

  test('精确边界 1 小时未来 → "in 1h"', () => {
    const future = new Date(Date.now() + 3_600_000).toISOString()
    expect(formatRelative(future)).toBe('in 1h')
  })

  test('精确边界 24 小时未来 → toLocaleString', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    const result = formatRelative(future)
    // 24 小时正好等于 86_400_000，absDiff < 86_400_000 为 false，走 toLocaleString
    expect(result).not.toContain('in ')
    expect(result).not.toContain(' ago')
  })

  test('空字符串 → "-"（falsy 值）', () => {
    expect(formatRelative('')).toBe('-')
  })

  test('负零毫秒差（当前时间） → "<1m ago" 或 "in <1m"', () => {
    const now = new Date(Date.now()).toISOString()
    const result = formatRelative(now)
    // diffMs 接近 0，absDiff < 60_000 为 true
    expect(result === '<1m ago' || result === 'in <1m').toBe(true)
  })
})

describe('formatDuration — 大数值', () => {
  test('大数值转换', () => {
    expect(formatDuration(3_600_000)).toBe('3600.0s')
    expect(formatDuration(100_000)).toBe('100.0s')
  })
})

describe('scheduleLabel — 边界情况', () => {
  test('interval NaN → "every NaNh"', () => {
    // parseInt('not-a-number', 10) 为 NaN，所有比较均为 false，走到 return `every ${NaN / 3_600_000}h`
    expect(scheduleLabel('interval', 'not-a-number')).toBe('every NaNh')
  })

  test('interval 0 → "every 0s"', () => {
    // 0 < 60_000 为 true，0 / 1000 = 0
    expect(scheduleLabel('interval', '0')).toBe('every 0s')
  })

  test('cron 空值 → "cron: "', () => {
    expect(scheduleLabel('cron', '')).toBe('cron: ')
  })
})

describe('msToMinutes — 边界情况', () => {
  test('负数 → "-1"', () => {
    expect(msToMinutes('-60000')).toBe('-1')
  })

  test('0 → "0"', () => {
    expect(msToMinutes('0')).toBe('0')
  })
})

describe('isoToDatetimeLocal — 无效输入', () => {
  test('无效日期字符串 → NaN 填充结果（不会触发 catch）', () => {
    const result = isoToDatetimeLocal('not-a-date')
    // new Date('not-a-date') 不抛异常，但各字段均为 NaN
    expect(result).toBe('NaN-NaN-NaNTNaN:NaN')
  })

  test('空字符串 → NaN 填充结果（不会触发 catch）', () => {
    const result = isoToDatetimeLocal('')
    // new Date('') 不抛异常，但各字段均为 NaN
    expect(result).toBe('NaN-NaN-NaNTNaN:NaN')
  })
})
