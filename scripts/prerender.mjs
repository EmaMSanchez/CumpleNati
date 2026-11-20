import { readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { renderToString } from 'react-dom/server'
import { createElement } from 'react'

const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' })
try {
  const { default: App } = await vite.ssrLoadModule('/src/App.jsx')
  const html = await readFile('dist/index.html', 'utf8')
  const rendered = renderToString(createElement(App))
  await writeFile('dist/index.html', html.replace('<div id="root"></div>', `<div id="root">${rendered}</div>`))
  console.log('Invitación prerenderizada: contenido visible sin JavaScript.')
} finally { await vite.close() }
