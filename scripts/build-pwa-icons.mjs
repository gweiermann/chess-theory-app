import { readFile, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

// Reuse the app's rook mark. Canvas renders assets, without taking screenshots.
const source = await readFile(
  new URL('../public/icons/app.svg', import.meta.url),
  'utf8',
)
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  for (const [filename, size, maskable] of [
    ['icon-192.png', 192, false],
    ['icon-512.png', 512, false],
    ['maskable-512.png', 512, true],
    ['apple-touch-icon.png', 180, true],
  ]) {
    const svg = maskable ? source.replace('rx="96"', 'rx="0"') : source
    const data = await page.evaluate(
      async ({ svg, size }) => {
        const image = new globalThis.Image()
        image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`
        await image.decode()
        const canvas = globalThis.document.createElement('canvas')
        canvas.width = canvas.height = size
        canvas.getContext('2d').drawImage(image, 0, 0, size, size)
        return canvas.toDataURL('image/png').split(',')[1]
      },
      { svg, size },
    )
    await writeFile(
      new URL(`../public/icons/${filename}`, import.meta.url),
      Buffer.from(data, 'base64'),
    )
  }
} finally {
  await browser.close()
}
