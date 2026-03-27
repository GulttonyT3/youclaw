import { describe, expect, test } from 'bun:test'
import type { BrowserProfile } from '../src/browser/types.ts'
import {
  buildBrowserMainBridgeState,
  clearBrowserMainBridgeSession,
  setBrowserMainBridgeSession,
} from '../src/browser/main-bridge.ts'

function createProfile(executablePath: string | null): BrowserProfile {
  return {
    id: 'relay-profile',
    name: 'Main Browser',
    driver: 'extension-relay',
    isDefault: false,
    executablePath,
    userDataDir: null,
    cdpPort: null,
    cdpUrl: null,
    headless: false,
    noSandbox: false,
    attachOnly: false,
    launchArgs: [],
    createdAt: new Date().toISOString(),
    updatedAt: null,
    runtime: null,
  }
}

describe('browser main bridge state', () => {
  test('session metadata upgrades the state to a main-bridge connection', () => {
    const profile = createProfile('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')

    setBrowserMainBridgeSession(profile.id, {
      browserId: 'chrome',
      browserName: 'Google Chrome',
      browserKind: 'chrome',
      tabId: '42',
      tabUrl: 'https://example.com',
      tabTitle: 'Example',
    })

    const state = buildBrowserMainBridgeState(
      profile,
      {
        token: 'token-0',
        connected: true,
        cdpUrl: 'http://127.0.0.1:9222',
        connectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        browsers: [
          {
            id: 'chrome',
            name: 'Google Chrome',
            kind: 'chrome',
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            isRecommended: true,
          },
        ],
        recommendedBrowserId: 'chrome',
        recommendationSource: 'priority',
      },
    )

    expect(state.connectionMode).toBe('main-bridge')
    expect(state.connectedBrowserName).toBe('Google Chrome')
    expect(state.connectedTabUrl).toBe('https://example.com')
    clearBrowserMainBridgeSession(profile.id)
  })

  test('uses explicit profile executable path selection when it matches a detected browser', () => {
    const state = buildBrowserMainBridgeState(
      createProfile('/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'),
      {
        token: 'token-1',
        connected: false,
        cdpUrl: null,
        connectedAt: null,
        updatedAt: null,
      },
      {
        browsers: [
          {
            id: 'chrome',
            name: 'Google Chrome',
            kind: 'chrome',
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            isRecommended: true,
          },
          {
            id: 'brave',
            name: 'Brave',
            kind: 'brave',
            executablePath: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
            isRecommended: false,
          },
        ],
        recommendedBrowserId: 'chrome',
        recommendationSource: 'priority',
      },
    )

    expect(state.selectedBrowserId).toBe('brave')
    expect(state.selectionSource).toBe('profile')
    expect(state.status).toBe('ready')
  })

  test('falls back to the recommended browser when profile selection is empty', () => {
    const state = buildBrowserMainBridgeState(
      createProfile(null),
      {
        token: 'token-2',
        connected: true,
        cdpUrl: 'http://127.0.0.1:9222',
        connectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        browsers: [
          {
            id: 'chrome',
            name: 'Google Chrome',
            kind: 'chrome',
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            isRecommended: true,
          },
        ],
        recommendedBrowserId: 'chrome',
        recommendationSource: 'priority',
      },
    )

    expect(state.selectedBrowserId).toBe('chrome')
    expect(state.selectionSource).toBe('recommended')
    expect(state.status).toBe('connected')
    expect(state.connectionMode).toBe('manual-cdp-fallback')
  })
})
