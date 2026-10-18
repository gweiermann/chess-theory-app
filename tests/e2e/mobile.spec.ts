import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

async function openItalian(page: Page) {
  await page.goto(
    '/learn/play?family=italian-game-a79f8e15&line=C50-9be1bdf94f6d382ed8f5&mode=review&side=white',
  )
  await expect(page.getByTestId('square-e2')).toBeVisible()
  await expect(page.locator('.training-layout input')).toHaveCount(0)
}
async function touchDrag(
  page: Page,
  from: string,
  to: string,
  duringDrag?: () => Promise<void>,
) {
  const start = await page.getByTestId(`square-${from}`).boundingBox()
  const end = await page.getByTestId(`square-${to}`).boundingBox()
  if (!start || !end) throw new Error('Board squares must be visible')
  const session = await page.context().newCDPSession(page)
  const origin = { x: start.x + start.width / 2, y: start.y + start.height / 2 }
  const target = { x: end.x + end.width / 2, y: end.y + end.height / 2 }
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...origin, id: 1 }],
  })
  for (let step = 1; step <= 5; step++) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x: origin.x + ((target.x - origin.x) * step) / 5,
          y: origin.y + ((target.y - origin.y) * step) / 5,
          id: 1,
        },
      ],
    })
    if (step === 2 && duringDrag) await duringDrag()
  }
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  await session.detach()
}

test('mobile training and home fit without page scrolling', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'phone')
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 360, height: 640 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(
      page.getByRole('button', { name: 'Italienisch spielen →' }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight + 1,
      ),
    ).toBe(true)
    await openItalian(page)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight + 1,
      ),
    ).toBe(true)
    const boardBounds = await page.locator('.board-grid').boundingBox()
    expect(boardBounds!.width).toBeGreaterThanOrEqual(320)
    for (const locator of [
      page.getByTestId('square-a8'),
      page.getByTestId('square-h1'),
      page.getByRole('button', { name: 'Hilfe anzeigen' }),
      page.getByRole('button', { name: 'Neu starten' }),
    ]) {
      const box = await locator.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.y).toBeGreaterThanOrEqual(0)
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1)
    }
  }
})

test('real touch dragging moves a piece and queues a premove during the reply', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'phone')
  await openItalian(page)
  await expect
    .poll(() =>
      page
        .locator('.board-grid img.piece')
        .evaluateAll(
          (images) =>
            images.length === 32 &&
            images.every(
              (image) =>
                image instanceof HTMLImageElement &&
                image.complete &&
                image.naturalWidth > 0,
            ),
        ),
    )
    .toBe(true)
  await page.clock.install()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  await touchDrag(page, 'e2', 'e4')
  await expect(page.getByTestId('square-e4')).toHaveAttribute('data-piece', 'p')
  await page.clock.runFor(500)
  await expect(page.getByTestId('square-e7')).toHaveAttribute('data-piece', 'p')
  await touchDrag(page, 'g1', 'f3')
  await expect(page.getByTestId('square-f3')).toHaveClass(/queued/)
  await page.clock.runFor(400)
  await expect(page.getByTestId('square-e5')).toHaveAttribute('data-piece', 'p')
  await expect(page.getByTestId('square-f3')).toHaveAttribute('data-piece', 'n')
  await page.clock.runFor(900)
  await expect(page.getByTestId('square-c6')).toHaveAttribute('data-piece', 'n')
})

test('a selected piece survives the opponent reply between two taps', async ({
  page,
}) => {
  await openItalian(page)
  await page.clock.install()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  await page.getByRole('button', { name: 'e2 Weiß Bauer', exact: true }).click()
  await page.getByRole('button', { name: 'e4 leer', exact: true }).click()
  await page.clock.runFor(500)
  await expect(page.getByTestId('square-e7')).toHaveAttribute('data-piece', 'p')
  await page
    .getByRole('button', { name: 'g1 Weiß Springer', exact: true })
    .click()
  await page.clock.runFor(400)
  await expect(page.getByTestId('square-g1')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'f3 leer', exact: true }).click()
  await expect(page.getByTestId('square-f3')).toHaveAttribute('data-piece', 'n')
})

test('a touch drag survives the opponent reply while the finger is held down', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'phone')
  await openItalian(page)
  await page.clock.install()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  await touchDrag(page, 'e2', 'e4')
  await touchDrag(page, 'g1', 'f3', () => page.clock.runFor(900))
  await expect(page.getByTestId('square-e5')).toHaveAttribute('data-piece', 'p')
  await expect(page.getByTestId('square-f3')).toHaveAttribute('data-piece', 'n')
})

test('fast consecutive premoves execute in order after successive replies', async ({
  page,
}) => {
  await openItalian(page)
  await page.clock.install()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  for (const square of ['e2', 'e4', 'g1', 'f3', 'f1', 'c4']) {
    await page.getByRole('button', { name: new RegExp(`^${square} `) }).click()
  }
  await expect(page.getByTestId('square-f3')).toHaveClass(/queued/)
  await expect(page.getByTestId('square-c4')).toHaveClass(/queued/)
  await page.clock.runFor(900)
  await expect(page.getByTestId('square-f3')).toHaveAttribute('data-piece', 'n')
  await expect(page.getByTestId('square-c4')).toHaveClass(/queued/)
  await page.clock.runFor(900)
  await expect(page.getByTestId('square-c6')).toHaveAttribute('data-piece', 'n')
  await expect(page.getByTestId('square-c4')).toHaveAttribute('data-piece', 'b')
  await expect(page.getByTestId('square-f1')).toHaveAttribute('data-piece', '')
  await expect(page.locator('.history-text')).toHaveText(
    '1. e4 e5 2. Nf3 Nc6 3. Bc4',
  )
})

test('selecting the second premove survives the first premove executing', async ({
  page,
}) => {
  await openItalian(page)
  await page.clock.install()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  for (const square of ['e2', 'e4', 'g1', 'f3', 'f1']) {
    await page.getByRole('button', { name: new RegExp(`^${square} `) }).click()
  }
  await page.clock.runFor(900)
  await expect(page.getByTestId('square-f3')).toHaveAttribute('data-piece', 'n')
  await expect(page.getByTestId('square-f1')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'c4 leer', exact: true }).click()
  await expect(page.getByTestId('square-c4')).toHaveClass(/queued/)
  await page.clock.runFor(900)
  await expect(page.getByTestId('square-c4')).toHaveAttribute('data-piece', 'b')
})

test('dragging the second premove survives the first premove executing', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'phone')
  await openItalian(page)
  await page.clock.install()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  await touchDrag(page, 'e2', 'e4')
  await touchDrag(page, 'g1', 'f3')
  await touchDrag(page, 'f1', 'c4', () => page.clock.runFor(900))
  await expect(page.getByTestId('square-f3')).toHaveAttribute('data-piece', 'n')
  await expect(page.getByTestId('square-c4')).toHaveClass(/queued/)
  await page.clock.runFor(900)
  await expect(page.getByTestId('square-c4')).toHaveAttribute('data-piece', 'b')
})
