import { describe, test, expect } from 'bun:test'
import { parseSkillInvocations } from '../src/skills/invoke.ts'

describe('parseSkillInvocations', () => {
  test('提取开头连续的已知 skill，并返回清理后的正文', () => {
    const parsed = parseSkillInvocations(
      '/pdf /agent-browser summarize this page',
      new Set(['pdf', 'agent-browser']),
    )

    expect(parsed).toEqual({
      requestedSkills: ['pdf', 'agent-browser'],
      cleanContent: 'summarize this page',
    })
  })

  test('遇到未知 /token 时停止解析，并保留后续内容', () => {
    const parsed = parseSkillInvocations(
      '/unknown /pdf keep everything',
      new Set(['pdf']),
    )

    expect(parsed).toEqual({
      requestedSkills: [],
      cleanContent: '/unknown /pdf keep everything',
    })
  })

  test('正文中的 /skill 不会被当作调用语法', () => {
    const parsed = parseSkillInvocations(
      'please use /pdf on this document',
      new Set(['pdf']),
    )

    expect(parsed).toEqual({
      requestedSkills: [],
      cleanContent: 'please use /pdf on this document',
    })
  })

  test('只有 skill 前缀没有正文时，cleanContent 为空字符串', () => {
    const parsed = parseSkillInvocations('/pdf /agent-browser', new Set(['pdf', 'agent-browser']))

    expect(parsed).toEqual({
      requestedSkills: ['pdf', 'agent-browser'],
      cleanContent: '',
    })
  })
})
