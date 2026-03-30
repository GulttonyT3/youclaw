import { describe, expect, test } from 'bun:test'
import { createBrowserActionRouter } from '../src/browser/router.ts'

describe('browser router dynamic extension state', () => {
  test('listTabs reflects the latest attached extension tab after router creation', async () => {
    let mainBridgeState = {
      connectionMode: 'extension-bridge',
      connectedTabId: 'tab-1',
      connectedTabTitle: 'First',
      connectedTabUrl: 'https://example.com/first',
    }

    const browserManager = {
      getProfile: () => ({ driver: 'extension-relay' }),
      getMainBridgeState: () => mainBridgeState,
      getProfileStatus: async () => ({ status: 'running' }),
      listTabs: async () => [],
    } as any

    const router = createBrowserActionRouter({
      browserManager,
      chatId: 'chat-1',
      agentId: 'agent-1',
      profileId: 'profile-1',
      target: 'host',
    })

    const first = await router.listTabs()
    expect(first.tabs[0]?.id).toBe('tab-1')

    mainBridgeState = {
      ...mainBridgeState,
      connectedTabId: 'tab-2',
      connectedTabTitle: 'Second',
      connectedTabUrl: 'https://example.com/second',
    }

    const second = await router.listTabs()
    expect(second.tabs[0]?.id).toBe('tab-2')
    expect(second.tabs[0]?.url).toBe('https://example.com/second')
  })
})
