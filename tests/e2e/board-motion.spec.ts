import { test, expect } from '@playwright/test'

test('pieces glide to accepted destinations while premove input stays available', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto(
    '/learn/play?family=italian-game-a79f8e15&line=C50-9be1bdf94f6d382ed8f5&mode=review&side=white',
  )
  await expect(page.getByTestId('square-e2')).toBeVisible()
  await page.clock.install()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  const source = await page.getByTestId('square-e2').boundingBox()
  const destination = await page.getByTestId('square-e4').boundingBox()
  await page.getByTestId('square-e2').click()
  await page.getByTestId('square-e4').click()
  await expect(page.getByTestId('square-e4')).toHaveAttribute('data-piece', 'p')
  const pawn = page.locator('[data-piece-square="e4"]')
  const motion = await pawn.evaluate((element) => {
    const animation = element.getAnimations()[0]
    if (!animation) return null
    animation.pause()
    animation.currentTime = 80
    return element.getBoundingClientRect().y
  })
  expect(motion).not.toBeNull()
  expect(motion!).toBeGreaterThan(destination!.y + 1)
  expect(motion!).toBeLessThan(source!.y - 1)
  await page.getByTestId('square-g1').click()
  await page.getByTestId('square-f3').click()
  await expect(page.getByTestId('square-f3')).toHaveClass(/queued/)
  await pawn.evaluate((element) =>
    element.getAnimations().forEach((animation) => animation.finish()),
  )
  expect((await pawn.boundingBox())!.y).toBeCloseTo(destination!.y, 0)
})

test('history and restart retarget an unfinished piece transition', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto(
    '/learn/play?family=italian-game-a79f8e15&line=C50-9be1bdf94f6d382ed8f5&mode=review&side=white',
  )
  await expect(page.getByTestId('square-e2')).toBeVisible()
  await page.clock.install()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  await page.getByTestId('square-e2').click()
  await page.getByTestId('square-e4').click()
  const animation = await page
    .locator('[data-piece-square="e4"]')
    .evaluateHandle((element) => {
      const motion = element.getAnimations()[0]!
      motion.pause()
      motion.currentTime = 80
      return motion
    })
  await page.getByRole('button', { name: 'Vorheriger Zug' }).click()
  await expect(page.getByTestId('square-e2')).toHaveAttribute('data-piece', 'p')
  expect(await animation.evaluate((motion) => motion.playState)).toBe('idle')
  await page.getByRole('button', { name: 'Nächster Zug' }).click()
  await page.getByRole('button', { name: 'Neu starten' }).click()
  const pawn = page.locator('[data-piece-square="e2"]')
  await pawn.evaluate((element) =>
    element.getAnimations().forEach((motion) => motion.finish()),
  )
  const destination = await page.getByTestId('square-e2').boundingBox()
  expect((await pawn.boundingBox())!.y).toBeCloseTo(destination!.y, 0)
  await expect(page.locator('.piece-layer .piece')).toHaveCount(32)
})

test('reduced motion updates moves and resets immediately', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(
    '/learn/play?family=italian-game-a79f8e15&line=C50-9be1bdf94f6d382ed8f5&mode=review&side=white',
  )
  await expect(page.getByTestId('square-e2')).toBeVisible()
  await page.getByTestId('square-e2').click()
  await page.getByTestId('square-e4').click()
  const pawn = page.locator('[data-piece-square="e4"]')
  expect(await pawn.evaluate((element) => element.getAnimations().length)).toBe(
    0,
  )
  expect((await pawn.boundingBox())!.y).toBeCloseTo(
    (await page.getByTestId('square-e4').boundingBox())!.y,
    0,
  )
  await page.getByRole('button', { name: 'Neu starten' }).click()
  expect(
    await page
      .locator('.piece-layer')
      .evaluate((element) => element.getAnimations({ subtree: true }).length),
  ).toBe(0)
  await expect(page.getByTestId('square-e2')).toHaveAttribute('data-piece', 'p')
})

test('a released drag settles at its destination without replaying from the source', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto(
    '/learn/play?family=italian-game-a79f8e15&line=C50-9be1bdf94f6d382ed8f5&mode=review&side=white',
  )
  await expect(page.getByTestId('square-e2')).toBeVisible()
  const source = (await page.getByTestId('square-e2').boundingBox())!
  const destination = (await page.getByTestId('square-e4').boundingBox())!
  await page.mouse.move(
    source.x + source.width / 2,
    source.y + source.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    destination.x + destination.width / 2,
    destination.y + destination.height / 2,
    { steps: 5 },
  )
  await page.mouse.up()
  await expect(page.getByTestId('square-e4')).toHaveAttribute('data-piece', 'p')
  const pawn = page.locator('[data-piece-square="e4"]')
  expect(await pawn.evaluate((element) => element.getAnimations().length)).toBe(
    0,
  )
  expect((await pawn.boundingBox())!.y).toBeCloseTo(destination.y, 0)
})
