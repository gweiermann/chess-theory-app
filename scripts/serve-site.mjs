import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const index = args.indexOf(name)
  return index < 0 ? fallback : args[index + 1]
}
const root = resolve(option('--dir', '.output/public'))
const port = Number(option('--port', '3041'))
const host = option('--host', '127.0.0.1')
const base = option('--base', '/')
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
}

createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405)
    response.end()
    return
  }
  let pathname
  try {
    pathname = decodeURIComponent(
      new URL(request.url, 'http://localhost').pathname,
    )
  } catch {
    response.writeHead(400)
    response.end()
    return
  }
  if (base !== '/') {
    if (!pathname.startsWith(base)) {
      response.writeHead(404)
      response.end('Not found')
      return
    }
    pathname = `/${pathname.slice(base.length)}`
  }
  let filename = resolve(root, `.${pathname}`)
  if (filename !== root && !filename.startsWith(`${root}${sep}`)) {
    response.writeHead(403)
    response.end()
    return
  }
  try {
    const info = await stat(filename)
    if (info.isDirectory()) filename = resolve(filename, 'index.html')
    await stat(filename)
  } catch {
    // Missing runtime assets are genuine failures, never HTML with a 200.
    if (
      extname(pathname) ||
      /^\/(?:_nuxt|data|assets|sb-|storybook)/.test(pathname)
    ) {
      response.writeHead(404)
      response.end('Not found')
      return
    }
    filename = resolve(root, 'index.html')
  }
  try {
    const body = await readFile(filename)
    response.writeHead(200, {
      'Content-Type': mime[extname(filename)] ?? 'application/octet-stream',
      'Content-Length': body.byteLength,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    response.end(request.method === 'HEAD' ? undefined : body)
  } catch {
    response.writeHead(404)
    response.end('Not found')
  }
}).listen(port, host, () =>
  console.log(`Serving ${root} at http://${host}:${port}`),
)
