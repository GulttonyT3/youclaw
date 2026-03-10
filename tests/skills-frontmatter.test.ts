import { describe, test, expect } from 'bun:test'
import { parseFrontmatter } from '../src/skills/frontmatter.ts'

describe('parseFrontmatter', () => {
  test('解析完整 frontmatter 并保留正文', () => {
    const raw = `
---
name: pdf
description: Read and summarize PDFs
version: 1.2.0
os: [darwin, linux]
dependencies: [pdftotext]
env: [OPENAI_API_KEY]
tools: [render]
tags: [docs, extraction]
globs: ["**/*.pdf"]
priority: critical
install:
  brew: brew install poppler
  apt: apt install poppler-utils
---
# Usage

Run this skill on uploaded PDF files.
`

    const parsed = parseFrontmatter(raw)

    expect(parsed.frontmatter).toEqual({
      name: 'pdf',
      description: 'Read and summarize PDFs',
      version: '1.2.0',
      os: ['darwin', 'linux'],
      dependencies: ['pdftotext'],
      env: ['OPENAI_API_KEY'],
      tools: ['render'],
      tags: ['docs', 'extraction'],
      globs: ['**/*.pdf'],
      priority: 'critical',
      install: {
        brew: 'brew install poppler',
        apt: 'apt install poppler-utils',
      },
    })
    expect(parsed.content).toBe('# Usage\n\nRun this skill on uploaded PDF files.')
  })

  test('install 值会被转成字符串，非法 priority 会被忽略', () => {
    const raw = `
---
name: mixed
description: Test parser coercion
priority: urgent
install:
  npm: 123
---
Body
`

    const parsed = parseFrontmatter(raw)

    expect(parsed.frontmatter.priority).toBeUndefined()
    expect(parsed.frontmatter.install).toEqual({ npm: '123' })
    expect(parsed.content).toBe('Body')
  })

  test('缺少起始 frontmatter 时抛错', () => {
    expect(() => parseFrontmatter('name: invalid')).toThrow('SKILL.md 缺少 frontmatter')
  })

  test('frontmatter 未闭合时抛错', () => {
    expect(() => parseFrontmatter('---\nname: demo\ndescription: test')).toThrow('SKILL.md frontmatter 未闭合')
  })

  test('缺少必填字段时抛错', () => {
    expect(() => parseFrontmatter('---\ndescription: only description\n---\nBody')).toThrow('SKILL.md frontmatter 缺少必需字段: name')
    expect(() => parseFrontmatter('---\nname: only-name\n---\nBody')).toThrow('SKILL.md frontmatter 缺少必需字段: description')
  })
})
