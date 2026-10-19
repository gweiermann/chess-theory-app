import { expect, test } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'

test('publishes install metadata and icons within the deployed subdirectory', async ({
  page,
  request,
  baseURL,
}) => {
  await page.goto('./')
  const manifestHref = await page
    .locator('link[rel="manifest"]')
    .getAttribute('href')
  expect(manifestHref).toBeTruthy()
  const manifestUrl = new URL(manifestHref!, baseURL!).href
  const response = await request.get(manifestUrl)
  expect(response.ok()).toBe(true)
  const manifest = await response.json()
  expect(manifest.name).toBe('Chess Theory')
  expect(manifest.display).toBe('standalone')
  expect(new URL(manifest.start_url, manifestUrl).href).toBe(baseURL)
  expect(new URL(manifest.scope, manifestUrl).href).toBe(baseURL)
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192', type: 'image/png' }),
      expect.objectContaining({ sizes: '512x512', type: 'image/png' }),
      expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
    ]),
  )
  for (const icon of manifest.icons) {
    const iconUrl = new URL(icon.src, manifestUrl)
    expect(iconUrl.href.startsWith(baseURL!)).toBe(true)
    const width = await page.evaluate(async (url) => {
      const image = new Image()
      image.src = url
      await image.decode()
      return image.naturalWidth
    }, iconUrl.href)
    expect(`${width}x${width}`).toBe(icon.sizes)
  }
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  const session = await page.context().newCDPSession(page)
  const { installabilityErrors } = await session.send(
    'Page.getInstallabilityErrors',
  )
  expect(installabilityErrors).toEqual([])
  await session.detach()
})

test('opens unvisited lessons and restores a playable deep link offline', async ({
  page,
  context,
  baseURL,
}) => {
  await page.goto('./')
  await expect(
    page.getByRole('button', { name: 'Neue Variante lernen →' }),
  ).toBeVisible()
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true)
  const scope = await page.evaluate(
    async () => (await navigator.serviceWorker.ready).scope,
  )
  expect(scope).toBe(baseURL)
  await context.setOffline(true)
  await page.goto(`${baseURL}openings`)
  await expect(page.locator('.line-card')).toHaveCount(109)
  await page
    .getByRole('button', {
      name: 'Lernen: Italian Game: Anti-Fried Liver Defense',
      exact: true,
    })
    .click()
  await page.getByTestId('square-e2').click()
  await page.getByTestId('square-e4').click()
  await expect(page.getByTestId('square-e5')).toHaveAttribute('data-piece', 'p')
  await page.reload()
  await expect(page.getByTestId('square-e4')).toHaveAttribute('data-piece', 'p')
  await expect(page.getByTestId('square-e5')).toHaveAttribute('data-piece', 'p')
  await page.goto(`${baseURL}profile`)
  await expect(page.getByLabel('Bevorzugte Seite')).toBeVisible()
})

test('waits for an explicit update action before reloading the app', async ({
  page,
}) => {
  await page.goto('./profile')
  await expect(page.getByLabel('Bevorzugte Seite')).toBeVisible()
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true)
  const update = page.getByRole('button', { name: 'App aktualisieren' })
  await expect(update).toHaveCount(0)
  const panelBounds = await page.locator('.profile-panel').boundingBox()
  let reloads = 0
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      reloads++
  })
  const workerPath = '.output/public/sw.js'
  const original = await readFile(workerPath, 'utf8')
  try {
    // Real browser update detection: change only the generated worker's bytes.
    await writeFile(
      workerPath,
      `${original}\n// Update lifecycle verification\n`,
    )
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.ready).update()
    })
    await expect(update).toBeVisible()
    expect(await page.locator('.profile-panel').boundingBox()).toEqual(
      panelBounds,
    )
    expect(reloads).toBe(0)
    await Promise.all([page.waitForEvent('load'), update.click()])
    await expect(page.getByLabel('Bevorzugte Seite')).toBeVisible()
    await expect(update).toHaveCount(0)
    expect(reloads).toBe(1)
  } finally {
    await writeFile(workerPath, original)
  }
})
