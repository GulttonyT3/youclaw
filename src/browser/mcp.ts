import { mkdirSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod/v4'
import { getPaths } from '../config/index.ts'
import { getLogger } from '../logger/index.ts'
import type { BrowserManager } from './manager.ts'
import { createBrowserActionRouter } from './router.ts'
import type { BrowserTarget } from './types.ts'

function createScreenshotPath(chatId: string): string {
  const dir = resolve(getPaths().data, 'browser-artifacts', chatId)
  mkdirSync(dir, { recursive: true })
  return resolve(dir, `browser-${Date.now()}.png`)
}

export function createBrowserMcpServer(params: {
  browserManager: BrowserManager
  chatId: string
  agentId: string
  profileId: string
  target: BrowserTarget
}) {
  const { browserManager, chatId, agentId, profileId, target } = params
  const router = createBrowserActionRouter({
    browserManager,
    chatId,
    agentId,
    profileId,
    target,
  })

  return createSdkMcpServer({
    name: 'browser',
    version: '1.0.0',
    tools: [
      tool(
        'status',
        'Get the status of the current browser profile runtime.',
        {},
        async () => {
          try {
            const status = await router.getStatus()
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify(status, null, 2),
              }],
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            return { content: [{ type: 'text' as const, text: `Failed to get browser status: ${msg}` }], isError: true }
          }
        },
      ),
      tool(
        'list_tabs',
        'List browser tabs for the current profile.',
        {},
        async () => {
          try {
            const tabs = await router.listTabs()
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify(tabs, null, 2),
              }],
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            return { content: [{ type: 'text' as const, text: `Failed to list tabs: ${msg}` }], isError: true }
          }
        },
      ),
      tool(
        'open_tab',
        'Open a new browser tab. Optionally navigate to a URL immediately.',
        {
          url: z.string().optional().describe('Optional absolute URL to open in the new tab'),
        },
        async (args) => {
          try {
            const result = await router.openTab(args.url)
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            return { content: [{ type: 'text' as const, text: `Failed to open tab: ${msg}` }], isError: true }
          }
        },
      ),
      tool(
        'navigate',
        'Navigate the current browser tab to a URL.',
        {
          url: z.string().describe('Absolute URL to navigate to'),
        },
        async (args) => {
          try {
            const result = await router.navigate(args.url)
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            return { content: [{ type: 'text' as const, text: `Failed to navigate: ${msg}` }], isError: true }
          }
        },
      ),
      tool(
        'snapshot',
        'Capture a text snapshot of the current tab and assign refs to visible interactive elements.',
        {},
        async () => {
          try {
            const snapshot = await router.snapshot()
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify(snapshot, null, 2),
              }],
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            return { content: [{ type: 'text' as const, text: `Failed to capture snapshot: ${msg}` }], isError: true }
          }
        },
      ),
      tool(
        'act',
        'Interact with a visible element ref from the latest browser snapshot. Prefer this over raw CSS selectors.',
        {
          ref: z.string().describe('Element ref returned by the latest browser snapshot'),
          action: z.enum(['click', 'type', 'select', 'check', 'uncheck']).describe('Interaction to perform with the element ref'),
          text: z.string().optional().describe('Required when action is type'),
          option: z.string().optional().describe('Required when action is select; matches option label first, then value'),
        },
        async (args) => {
          try {
            const result = await router.act({
              ref: args.ref,
              action: args.action,
              text: args.text,
              option: args.option,
            })
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            return { content: [{ type: 'text' as const, text: `Failed to act on ref ${args.ref}: ${msg}` }], isError: true }
          }
        },
      ),
      tool(
        'screenshot',
        'Capture a screenshot of the current tab.',
        {
          path: z.string().optional().describe('Optional absolute output path for the screenshot PNG'),
        },
        async (args) => {
          try {
            const targetPath = args.path || createScreenshotPath(chatId)
            const result = await router.screenshot(targetPath)
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  ...result,
                  filename: basename(result.path),
                }, null, 2),
              }],
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            return { content: [{ type: 'text' as const, text: `Failed to take screenshot: ${msg}` }], isError: true }
          }
        },
      ),
      tool(
        'click',
        'Click the first DOM element matching a CSS selector in the current tab. Prefer snapshot + act when possible.',
        {
          selector: z.string().describe('CSS selector for the element to click'),
        },
        async (args) => {
          try {
            const result = await router.click(args.selector)
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            return { content: [{ type: 'text' as const, text: `Failed to click selector ${args.selector}: ${msg}` }], isError: true }
          }
        },
      ),
      tool(
        'type',
        'Fill an input or textarea identified by a CSS selector in the current tab. Prefer snapshot + act when possible.',
        {
          selector: z.string().describe('CSS selector for the input element'),
          text: z.string().describe('Text to enter into the field'),
        },
        async (args) => {
          try {
            const result = await router.type(args.selector, args.text)
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            return { content: [{ type: 'text' as const, text: `Failed to type into selector ${args.selector}: ${msg}` }], isError: true }
          }
        },
      ),
      tool(
        'press_key',
        'Send a keyboard shortcut or key to the current tab.',
        {
          key: z.string().describe('Key name accepted by Playwright, for example Enter or Meta+L'),
        },
        async (args) => {
          try {
            const result = await router.pressKey(args.key)
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            return { content: [{ type: 'text' as const, text: `Failed to press key ${args.key}: ${msg}` }], isError: true }
          }
        },
      ),
      tool(
        'close_tab',
        'Close the current tab or a tab identified by URL.',
        {
          url: z.string().optional().describe('Optional exact tab URL to close'),
        },
        async (args) => {
          try {
            const result = await router.closeTab(args.url)
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            return { content: [{ type: 'text' as const, text: `Failed to close tab: ${msg}` }], isError: true }
          }
        },
      ),
    ],
  })
}

export function logBrowserToolRegistration(profileId: string, target: BrowserTarget): void {
  const logger = getLogger()
  logger.info({ profileId, target, category: 'browser' }, 'Built-in browser MCP server registered')
}
