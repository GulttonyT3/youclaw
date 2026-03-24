import { chromium, type Browser as PlaywrightBrowser, type BrowserContext, type Page } from 'playwright-core'
import { getLogger } from '../logger/index.ts'
import type { BrowserManager } from './manager.ts'
import { getChatBrowserState, upsertChatBrowserState } from './store.ts'
import { resolveCdpHttpBase } from './chrome.ts'

type SessionPage = {
  browser: PlaywrightBrowser
  context: BrowserContext
  page: Page
}

type SessionPageCandidate = Omit<SessionPage, 'browser'>

const browserConnections = new Map<string, Promise<PlaywrightBrowser>>()

function flattenPages(browser: PlaywrightBrowser): Array<{ context: BrowserContext; page: Page }> {
  return browser.contexts().flatMap((context) => context.pages().map((page) => ({ context, page })))
}

async function getPrimaryContext(browser: PlaywrightBrowser): Promise<BrowserContext> {
  const existing = browser.contexts()[0]
  if (existing) return existing
  return browser.newContext()
}

async function connectProfileBrowser(browserManager: BrowserManager, profileId: string): Promise<PlaywrightBrowser> {
  const cached = browserConnections.get(profileId)
  if (cached) {
    try {
      const browser = await cached
      if (browser.isConnected()) return browser
    } catch {}
    browserConnections.delete(profileId)
  }

  const connection = (async () => {
    const runtime = await browserManager.startProfile(profileId)
    const profile = browserManager.getProfile(profileId)
    if (!profile) {
      throw new Error('Browser profile not found')
    }

    const endpoint = runtime.wsEndpoint ?? profile.cdpUrl ?? resolveCdpHttpBase(profile)
    const browser = await chromium.connectOverCDP(endpoint)
    browser.on('disconnected', () => {
      browserConnections.delete(profileId)
    })
    return browser
  })()

  browserConnections.set(profileId, connection)
  return connection
}

function isUsablePage(page: Page): boolean {
  return !page.isClosed()
}

async function selectExistingPage(chatId: string, browser: PlaywrightBrowser, profileId: string): Promise<SessionPageCandidate | null> {
  const state = getChatBrowserState(chatId)
  const pages = flattenPages(browser).filter(({ page }) => isUsablePage(page))

  if (state?.profileId === profileId && state.activePageUrl) {
    const exact = pages.find(({ page }) => page.url() === state.activePageUrl)
    if (exact) return exact
  }

  const firstNavigated = pages.find(({ page }) => page.url() && page.url() !== 'about:blank')
  if (firstNavigated) return firstNavigated

  return pages[0] ?? null
}

async function persistChatPage(chatId: string, agentId: string, profileId: string, page: Page): Promise<void> {
  let title = ''
  try {
    title = await page.title()
  } catch {}

  upsertChatBrowserState(chatId, {
    agentId,
    profileId,
    activeTargetId: null,
    activePageUrl: page.url() || null,
    activePageTitle: title || null,
  })
}

export async function resolvePageForChat(
  browserManager: BrowserManager,
  params: { chatId: string; agentId: string; profileId: string },
): Promise<SessionPage> {
  const browser = await connectProfileBrowser(browserManager, params.profileId)
  const existing = await selectExistingPage(params.chatId, browser, params.profileId)
  if (existing) {
    await persistChatPage(params.chatId, params.agentId, params.profileId, existing.page)
    return { ...existing, browser }
  }

  const context = await getPrimaryContext(browser)
  const page = await context.newPage()
  await persistChatPage(params.chatId, params.agentId, params.profileId, page)
  return { browser, context, page }
}

export async function openTabForChat(
  browserManager: BrowserManager,
  params: { chatId: string; agentId: string; profileId: string; url?: string },
): Promise<{ url: string; title: string }> {
  const browser = await connectProfileBrowser(browserManager, params.profileId)
  const context = await getPrimaryContext(browser)
  const page = await context.newPage()
  if (params.url) {
    await page.goto(params.url, { waitUntil: 'domcontentloaded' })
  }
  await persistChatPage(params.chatId, params.agentId, params.profileId, page)
  return {
    url: page.url(),
    title: await page.title().catch(() => ''),
  }
}

export async function navigateForChat(
  browserManager: BrowserManager,
  params: { chatId: string; agentId: string; profileId: string; url: string },
): Promise<{ url: string; title: string }> {
  const session = await resolvePageForChat(browserManager, params)
  await session.page.goto(params.url, { waitUntil: 'domcontentloaded' })
  await persistChatPage(params.chatId, params.agentId, params.profileId, session.page)
  return {
    url: session.page.url(),
    title: await session.page.title().catch(() => ''),
  }
}

export async function snapshotForChat(
  browserManager: BrowserManager,
  params: { chatId: string; agentId: string; profileId: string },
): Promise<Record<string, unknown>> {
  const session = await resolvePageForChat(browserManager, params)
  const page = session.page
  const title = await page.title().catch(() => '')
  const text = await page.evaluate(() => {
    const dom = globalThis as { document?: { body?: { innerText?: string } } }
    const body = dom.document?.body
    return body?.innerText?.slice(0, 4000) ?? ''
  })
  await persistChatPage(params.chatId, params.agentId, params.profileId, page)
  return {
    title,
    url: page.url(),
    text,
  }
}

export async function screenshotForChat(
  browserManager: BrowserManager,
  params: { chatId: string; agentId: string; profileId: string; path: string },
): Promise<{ path: string; url: string }> {
  const session = await resolvePageForChat(browserManager, params)
  await session.page.screenshot({ path: params.path, fullPage: true })
  await persistChatPage(params.chatId, params.agentId, params.profileId, session.page)
  return {
    path: params.path,
    url: session.page.url(),
  }
}

export async function clickForChat(
  browserManager: BrowserManager,
  params: { chatId: string; agentId: string; profileId: string; selector: string },
): Promise<{ url: string; title: string }> {
  const session = await resolvePageForChat(browserManager, params)
  await session.page.locator(params.selector).first().click()
  await persistChatPage(params.chatId, params.agentId, params.profileId, session.page)
  return {
    url: session.page.url(),
    title: await session.page.title().catch(() => ''),
  }
}

export async function typeForChat(
  browserManager: BrowserManager,
  params: { chatId: string; agentId: string; profileId: string; selector: string; text: string },
): Promise<{ url: string; title: string }> {
  const session = await resolvePageForChat(browserManager, params)
  const locator = session.page.locator(params.selector).first()
  await locator.fill(params.text)
  await persistChatPage(params.chatId, params.agentId, params.profileId, session.page)
  return {
    url: session.page.url(),
    title: await session.page.title().catch(() => ''),
  }
}

export async function pressKeyForChat(
  browserManager: BrowserManager,
  params: { chatId: string; agentId: string; profileId: string; key: string },
): Promise<{ url: string; title: string }> {
  const session = await resolvePageForChat(browserManager, params)
  await session.page.keyboard.press(params.key)
  await persistChatPage(params.chatId, params.agentId, params.profileId, session.page)
  return {
    url: session.page.url(),
    title: await session.page.title().catch(() => ''),
  }
}

export async function closeTabForChat(
  browserManager: BrowserManager,
  params: { chatId: string; agentId: string; profileId: string; url?: string },
): Promise<{ closed: boolean }> {
  const browser = await connectProfileBrowser(browserManager, params.profileId)
  const pages = flattenPages(browser).filter(({ page }) => isUsablePage(page))
  const target = params.url
    ? pages.find(({ page }) => page.url() === params.url)
    : pages[pages.length - 1]

  if (!target) return { closed: false }
  await target.page.close()
  const next = await selectExistingPage(params.chatId, browser, params.profileId)
  if (next) {
    await persistChatPage(params.chatId, params.agentId, params.profileId, next.page)
  }
  return { closed: true }
}

export async function disconnectAllBrowserSessions(): Promise<void> {
  const logger = getLogger()
  const entries = Array.from(browserConnections.entries())
  browserConnections.clear()
  await Promise.all(entries.map(async ([profileId, browserPromise]) => {
    try {
      const browser = await browserPromise
      await browser.close()
    } catch (err) {
      logger.debug({ profileId, err, category: 'browser' }, 'Failed to close Playwright browser connection cleanly')
    }
  }))
}
