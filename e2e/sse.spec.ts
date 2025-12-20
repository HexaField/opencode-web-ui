import { expect, test } from '@playwright/test'

test.describe('SSE Streaming', () => {
  test('should receive session updates via SSE', async ({ page }) => {
    // 1. Navigate to the app
    await page.goto('/')

    // Wait for the folder browser to appear
    await page.waitForSelector('input[placeholder="Enter path..."]')

    // 2. Connect to a folder
    // We can just type a path and click "Open"
    // Or we can use the URL parameter if the app supports it (it does)

    // Let's use the URL parameter to skip the folder selection step
    // We need a valid path. In CI/Test environment, we can use the current directory.
    // But we need to know what it is.
    // Let's try to use the current working directory of the test runner.
    const cwd = process.cwd()
    await page.goto(`/?folder=${encodeURIComponent(cwd)}`)

    // Wait for the workspace to load
    // Look for something that indicates we are in the workspace
    await page.waitForSelector('text=Sessions', { timeout: 10000 })

    // Intercept the events endpoint
    const eventsRequestPromise = page.waitForRequest(
      (request) => request.url().includes('/events') && request.resourceType() === 'eventsource'
    )

    // 3. Create a new session
    // Click the "New Session" button
    const newSessionButton = page.getByRole('button', { name: 'New Session' })
    await newSessionButton.click()

    // Wait for the chat interface to load
    await page.waitForSelector('textarea[placeholder="Type a message..."]')

    // 4. Send a message
    await page.getByPlaceholder('Type a message...').fill('Hello SSE')
    await page.getByRole('button', { name: 'Send' }).click()

    // 5. Verify the message appears in the chat (optimistic update)
    await expect(page.getByText('Hello SSE')).toBeVisible()

    // 6. Verify the SSE connection is established
    const request = await eventsRequestPromise
    expect(request).toBeTruthy()

    // Verify the response is a stream
    const response = await request.response()
    expect(response?.headers()['content-type']).toBe('text/event-stream')
  })
})
