import { describe, test, expect } from 'bun:test'
import { checkEligibility } from '../src/skills/eligibility.ts'

describe('checkEligibility', () => {
  test('无约束时返回 eligible', () => {
    const result = checkEligibility({
      name: 'demo',
      description: 'demo skill',
    })

    expect(result.eligible).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.detail.os.passed).toBe(true)
    expect(result.detail.dependencies.results).toEqual([])
    expect(result.detail.env.results).toEqual([])
  })

  test('缺失依赖和环境变量时返回错误详情', () => {
    delete process.env.YOUCLAW_TEST_REQUIRED_ENV

    const result = checkEligibility({
      name: 'demo',
      description: 'demo skill',
      dependencies: ['__youclaw_missing_binary__'],
      env: ['YOUCLAW_TEST_REQUIRED_ENV'],
    })

    expect(result.eligible).toBe(false)
    expect(result.errors.some((error) => error.includes('依赖缺失'))).toBe(true)
    expect(result.errors.some((error) => error.includes('环境变量缺失'))).toBe(true)
    expect(result.detail.dependencies.passed).toBe(false)
    expect(result.detail.dependencies.results[0]?.name).toBe('__youclaw_missing_binary__')
    expect(result.detail.dependencies.results[0]?.found).toBe(false)
    expect(result.detail.env.passed).toBe(false)
    expect(result.detail.env.results[0]).toEqual({ name: 'YOUCLAW_TEST_REQUIRED_ENV', found: false })
  })

  test('OS 不匹配时返回错误', () => {
    const requiredOs = process.platform === 'darwin' ? ['linux'] : ['darwin']
    const result = checkEligibility({
      name: 'demo',
      description: 'demo skill',
      os: requiredOs,
    })

    expect(result.eligible).toBe(false)
    expect(result.errors[0]).toContain('OS 不匹配')
    expect(result.detail.os.passed).toBe(false)
    expect(result.detail.os.required).toEqual(requiredOs)
    expect(result.detail.os.current).toBe(process.platform)
  })
})
