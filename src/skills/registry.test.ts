import { describe, test, expect, beforeEach, mock, afterEach } from 'bun:test'
import { RegistryManager } from './registry.ts'
import type { SkillsLoader } from './loader.ts'
import type { Skill } from './types.ts'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'

// 初始化环境和日志（RegistryManager 内部依赖）
import { loadEnv } from '../config/index.ts'
import { initLogger } from '../logger/index.ts'
loadEnv()
initLogger()

/** 创建 mock SkillsLoader */
function createMockLoader(skills: Partial<Skill>[] = []): SkillsLoader {
  return {
    loadAllSkills: () => skills as Skill[],
    refresh: () => skills as Skill[],
  } as unknown as SkillsLoader
}

describe('RegistryManager', () => {
  describe('getRecommended', () => {
    test('返回推荐列表，包含正确字段', () => {
      const manager = new RegistryManager(createMockLoader())
      const list = manager.getRecommended()

      expect(list.length).toBe(10)
      // 每项都有必要字段
      for (const item of list) {
        expect(typeof item.slug).toBe('string')
        expect(typeof item.displayName).toBe('string')
        expect(typeof item.summary).toBe('string')
        expect(typeof item.category).toBe('string')
        expect(typeof item.installed).toBe('boolean')
      }
      expect(list[0].slug).toBe('self-improving-agent')
      expect(list[0].displayName).toBe('Self Improving Agent')
      expect(list[0].category).toBe('agent')
    })

    test('已安装的技能标记 installed=true（通过 registryMeta）', () => {
      const manager = new RegistryManager(createMockLoader([
        {
          name: 'DuckDuckGo Web Search',
          source: 'user',
          registryMeta: {
            source: 'clawhub',
            slug: 'ddg-web-search',
            installedAt: '2024-01-01',
            displayName: 'DuckDuckGo Web Search',
          },
        },
      ]))
      const list = manager.getRecommended()

      const ddg = list.find(s => s.slug === 'ddg-web-search')!
      expect(ddg.installed).toBe(true)
    })

    test('已安装的技能标记 installed=true（通过目录检测）', () => {
      const userSkillsDir = resolve(homedir(), '.youclaw', 'skills')
      const testDir = resolve(userSkillsDir, 'coding')

      // 创建测试目录
      mkdirSync(testDir, { recursive: true })
      writeFileSync(resolve(testDir, 'SKILL.md'), '---\nname: coding\ndescription: test\n---\n')

      try {
        const manager = new RegistryManager(createMockLoader())
        const list = manager.getRecommended()

        const coding = list.find(s => s.slug === 'coding')!
        expect(coding.installed).toBe(true)
      } finally {
        // 清理
        rmSync(testDir, { recursive: true, force: true })
      }
    })
  })

  describe('installSkill', () => {
    test('未知 slug 抛出错误', async () => {
      const manager = new RegistryManager(createMockLoader())
      await expect(manager.installSkill('unknown-skill')).rejects.toThrow('未知的推荐技能')
    })

    test('已安装的技能抛出错误', async () => {
      const userSkillsDir = resolve(homedir(), '.youclaw', 'skills')
      const testDir = resolve(userSkillsDir, 'ddg-web-search')

      mkdirSync(testDir, { recursive: true })
      writeFileSync(resolve(testDir, 'SKILL.md'), '---\nname: ddg\ndescription: test\n---\n')

      try {
        const manager = new RegistryManager(createMockLoader())
        await expect(manager.installSkill('ddg-web-search')).rejects.toThrow('已安装')
      } finally {
        rmSync(testDir, { recursive: true, force: true })
      }
    })
  })

  describe('uninstallSkill', () => {
    test('未安装的技能抛出错误', async () => {
      const slug = `test-uninstall-${Date.now()}`
      const manager = new RegistryManager(createMockLoader())
      await expect(manager.uninstallSkill(slug)).rejects.toThrow('未安装')
    })

    test('已安装的技能可以卸载', async () => {
      const slug = `test-uninstall-${Date.now()}`
      const userSkillsDir = resolve(homedir(), '.youclaw', 'skills')
      const testDir = resolve(userSkillsDir, slug)

      mkdirSync(testDir, { recursive: true })
      writeFileSync(resolve(testDir, 'SKILL.md'), '---\nname: test\ndescription: test\n---\n')

      const manager = new RegistryManager(createMockLoader())
      await manager.uninstallSkill(slug)

      expect(existsSync(testDir)).toBe(false)
    })
  })
})
