import { test, expect } from '../fixtures'

test.describe('Memory 管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByTestId('nav-memory').click()
    await page.waitForLoadState('networkidle')
  })

  test('Memory 页面加载', async ({ page }) => {
    await expect(page.getByText('MEMORY.md')).toBeVisible({ timeout: 10_000 })
  })

  test('查看和编辑 MEMORY.md', async ({ page }) => {
    // 等待编辑按钮出现
    const editBtn = page.getByTestId('memory-edit-btn')
    await expect(editBtn).toBeVisible({ timeout: 10_000 })

    // 点击编辑
    await editBtn.click()

    // textarea 应出现
    const textarea = page.getByTestId('memory-textarea')
    await expect(textarea).toBeVisible()

    // 获取当前内容
    const originalContent = await textarea.inputValue()

    // 添加测试内容
    const testLine = `\n<!-- e2e memory test ${Date.now()} -->`
    await textarea.fill(originalContent + testLine)

    // 保存
    await page.getByTestId('memory-save-btn').click()
    await page.waitForTimeout(1000)

    // 重新编辑验证持久化
    await editBtn.click()
    const savedContent = await page.getByTestId('memory-textarea').inputValue()
    expect(savedContent).toContain('e2e memory test')

    // 恢复原始内容
    await page.getByTestId('memory-textarea').fill(originalContent)
    await page.getByTestId('memory-save-btn').click()
  })

  test('Memory 页面只显示全局记忆编辑器', async ({ page }) => {
    await expect(page.getByText(/Global MEMORY\.md|全局 MEMORY\.md/)).toBeVisible()
    await expect(page.getByTestId('memory-edit-btn')).toBeVisible()
  })
})
