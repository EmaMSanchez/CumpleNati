import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { createServer as createViteServer } from 'vite'
import rsvp from '../api/rsvp.js'
import { loadLocalConfig } from './local-config.mjs'

for (const [key, value] of Object.entries(await loadLocalConfig())) process.env[key] ||= value
const preview = process.argv.includes('--preview')
const port = Number(process.env.PORT || 5173)
const vite = preview ? null : await createViteServer({ server: { middlewareMode: true }, appType: 'spa' })
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' }

const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, `http://${req.headers.host}`).pathname
    if (/(?:^|\/)\.(?:env(?:\.[^/]*)?|git)(?:\/|$)|\.(?:local\.gs|dpapi)$/i.test(decodeURIComponent(pathname))) {
      res.writeHead(404)
      return res.end()
    }
    if (pathname === '/api/rsvp') return await rsvp(req, res)
    if (pathname.startsWith('/api/')) { res.writeHead(404); return res.end() }
    if (vite) return vite.middlewares(req, res)
    let file = resolve('dist', `.${decodeURIComponent(pathname)}`)
    const root = resolve('dist')
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403); return res.end() }
    if (!extname(file)) file = resolve('dist/index.html')
    try {
      const content = await readFile(file)
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' })
      res.end(content)
    } catch { res.writeHead(404); res.end('Archivo no encontrado') }
  } catch { res.writeHead(500); res.end('No se pudo completar la solicitud') }
})

server.listen(port, '127.0.0.1', () => console.log(`Invitación de Natalia: http://localhost:${port}${preview ? ' (production preview)' : ''}`))
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => { await vite?.close(); server.close(); process.exit(0) })
}
