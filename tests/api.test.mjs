import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { createRsvpHandler } from '../api/rsvp.js'

const requestId = '8c3c191a-129d-44c0-8743-e2d5529ea110'
const valid = { fullName: 'Invitado Prueba', email: 'invitado@example.com', attendance: 'yes', guests: 2, requestId }
const configuration = { GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec', GOOGLE_SCRIPT_SECRET: 's'.repeat(64) }
const saved = () => Promise.resolve({ ok: true, json: async () => ({ ok: true, saved: true, requestId }) })

async function invoke(handler, { body = valid, raw, method = 'POST', headers = {} } = {}) {
  const req = Readable.from([raw ?? JSON.stringify(body)])
  req.method = method
  req.headers = { 'content-type': 'application/json', host: 'invitation.test', origin: 'https://invitation.test', ...headers }
  req.socket = { remoteAddress: '127.0.0.1' }
  const response = {}
  await handler(req, { writeHead(status, outputHeaders) { response.status = status; response.headers = outputHeaders }, end(output) { response.body = JSON.parse(output) } })
  return response
}

test('no confirma si Google Sheets no está configurado', async () => {
  let called = false
  const result = await invoke(createRsvpHandler({ env: () => ({}), fetchImpl: async () => { called = true } }))
  assert.equal(result.status, 503)
  assert.equal(result.body.ok, false)
  assert.equal(called, false)
})

test('reenvía datos validados y confirma solo el guardado verificado', async () => {
  const handler = createRsvpHandler({ env: () => configuration, fetchImpl: async (url, options) => {
    assert.equal(url.hostname, 'script.google.com')
    const payload = JSON.parse(options.body)
    assert.equal(payload.secret, configuration.GOOGLE_SCRIPT_SECRET)
    assert.equal(payload.email, valid.email)
    return saved()
  } })
  const result = await invoke(handler)
  assert.equal(result.status, 200)
  assert.equal(result.body.requestId, requestId)
  assert.equal(JSON.stringify(result.body).includes(configuration.GOOGLE_SCRIPT_SECRET), false)
})

test('rechaza métodos, origen ajeno y contenido no JSON', async () => {
  const handler = createRsvpHandler()
  assert.equal((await invoke(handler, { method: 'GET' })).status, 405)
  assert.equal((await invoke(handler, { headers: { origin: 'https://other.test' } })).status, 403)
  assert.equal((await invoke(handler, { headers: { 'content-type': 'text/plain' } })).status, 415)
})

test('respeta un origen público configurado', async () => {
  const handler = createRsvpHandler({ env: () => ({ ...configuration, APP_ORIGIN: 'https://public.test' }), fetchImpl: saved })
  assert.equal((await invoke(handler)).status, 403)
  assert.equal((await invoke(handler, { headers: { origin: 'https://public.test' } })).status, 200)
})

test('rechaza JSON inválido, mensajes grandes, honeypot y campos inválidos', async () => {
  const handler = createRsvpHandler({ env: () => configuration, fetchImpl: saved })
  assert.equal((await invoke(handler, { raw: '{broken' })).status, 400)
  assert.equal((await invoke(handler, { body: null })).status, 400)
  assert.equal((await invoke(handler, { headers: { 'content-length': '9000' } })).status, 413)
  assert.equal((await invoke(handler, { raw: JSON.stringify({ ...valid, ignored: 'x'.repeat(9000) }) })).status, 413)
  assert.equal((await invoke(handler, { body: { ...valid, website: 'spam' } })).status, 400)
  assert.equal((await invoke(handler, { body: { ...valid, guests: 0 } })).status, 400)
  assert.equal((await invoke(handler, { body: { ...valid, requestId: 'wrong' } })).status, 400)
})

test('rechaza respuestas del upstream sin prueba de guardado', async () => {
  for (const response of [{ ok: false }, { ok: true, requestId }, { ok: true, saved: true, requestId: 'wrong' }]) {
    const handler = createRsvpHandler({ env: () => configuration, fetchImpl: async () => ({ ok: true, json: async () => response }) })
    const result = await invoke(handler)
    assert.equal(result.status, 502)
    assert.equal(result.body.ok, false)
  }
})

test('maneja errores y timeouts sin revelar detalles internos', async () => {
  const handler = createRsvpHandler({ env: () => configuration, fetchImpl: async () => { throw new Error('sensitive backend details') } })
  const result = await invoke(handler)
  assert.equal(result.status, 502)
  assert.equal(JSON.stringify(result).includes('sensitive'), false)
})

test('el límite de solicitudes se restablece al expirar la ventana', async () => {
  let time = 0
  const handler = createRsvpHandler({ env: () => configuration, fetchImpl: saved, now: () => time })
  for (let i = 0; i < 8; i++) assert.equal((await invoke(handler)).status, 200)
  const limited = await invoke(handler)
  assert.equal(limited.status, 429)
  assert.equal(limited.headers['Retry-After'], '600')
  time = 600001
  assert.equal((await invoke(handler)).status, 200)
})

test('solo permite el endpoint HTTPS publicado de Google Apps Script', async () => {
  for (const url of ['http://script.google.com/macros/s/TEST/exec', 'https://other.test/macros/s/TEST/exec', 'https://script.google.com/macros/s/TEST/dev']) {
    const handler = createRsvpHandler({ env: () => ({ ...configuration, GOOGLE_SCRIPT_URL: url }), fetchImpl: saved })
    assert.equal((await invoke(handler)).status, 503)
  }
})
