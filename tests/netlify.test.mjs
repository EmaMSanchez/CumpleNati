import test from 'node:test'
import assert from 'node:assert/strict'
import { createRsvpHandler } from '../api/rsvp.js'
import { config, createNetlifyHandler } from '../netlify/functions/rsvp.mjs'

const requestId = '8c3c191a-129d-44c0-8743-e2d5529ea110'
const valid = { fullName: 'Invitado Prueba', email: 'invitado@example.com', attendance: 'yes', guests: 2, requestId }
const environment = { GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec', GOOGLE_SCRIPT_SECRET: 's'.repeat(64) }
const saved = async () => ({ ok: true, json: async () => ({ ok: true, saved: true, requestId }) })

function request({ method = 'POST', body = valid, headers = {} } = {}) {
  return new Request('https://cumple-test.netlify.app/api/rsvp', {
    method,
    headers: { 'Content-Type': 'application/json', Origin: 'https://cumple-test.netlify.app', ...headers },
    ...(method !== 'GET' ? { body: JSON.stringify(body) } : {}),
  })
}

test('Netlify conserva /api/rsvp y devuelve la confirmación verificada', async () => {
  assert.equal(config.path, '/api/rsvp')
  const handler = createNetlifyHandler(createRsvpHandler({ env: () => environment, fetchImpl: saved }))
  const response = await handler(request(), { ip: '192.0.2.1' })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal((await response.json()).requestId, requestId)
})

test('Netlify rechaza el origen ajeno, GET y cuerpos inválidos', async () => {
  const handler = createNetlifyHandler(createRsvpHandler({ env: () => environment, fetchImpl: saved }))
  assert.equal((await handler(request({ headers: { Origin: 'https://other.test' } }))).status, 403)
  assert.equal((await handler(request({ method: 'GET' }))).status, 405)
  assert.equal((await handler(request({ body: { ...valid, guests: 0 } }))).status, 400)
  assert.equal((await handler(request({ headers: { 'Content-Length': '9000' } }))).status, 413)
})

test('Netlify usa la IP verificada del contexto, no las cabeceras del visitante', async () => {
  const handler = createNetlifyHandler(createRsvpHandler({ env: () => environment, fetchImpl: saved }))
  for (let i = 0; i < 8; i++) {
    const response = await handler(request({ headers: { 'X-Forwarded-For': `fake-${i}`, 'X-Vercel-Forwarded-For': `fake-${i}` } }), { ip: '192.0.2.1' })
    assert.equal(response.status, 200)
  }
  assert.equal((await handler(request({ headers: { 'X-Forwarded-For': 'another-fake' } }), { ip: '192.0.2.1' })).status, 429)
  assert.equal((await handler(request(), { ip: '192.0.2.2' })).status, 200)
})

test('Netlify no publica el secreto ni confirma sin configuración', async () => {
  const missing = createNetlifyHandler(createRsvpHandler({ env: () => ({}) }))
  const error = await missing(request())
  assert.equal(error.status, 503)
  assert.equal((await error.json()).ok, false)
  const configured = createNetlifyHandler(createRsvpHandler({ env: () => environment, fetchImpl: saved }))
  const response = await configured(request())
  assert.equal((await response.text()).includes(environment.GOOGLE_SCRIPT_SECRET), false)
})
