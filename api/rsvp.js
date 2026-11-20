import { isRequestId, validateRsvp } from '../shared/rsvp.js'

const MAX_BYTES = 8192
const WINDOW_MS = 10 * 60 * 1000
const MAX_REQUESTS = 8

function reply(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  })
  res.end(JSON.stringify(body))
}

function fail(res, status, code, message, headers) {
  reply(res, status, { ok: false, code, message }, headers)
}

async function readBody(req) {
  if (Number(req.headers['content-length']) > MAX_BYTES) throw new Error('BODY_TOO_LARGE')
  let body = req.body
  if (body === undefined) {
    const chunks = []
    let bytes = 0
    for await (const chunk of req) {
      bytes += Buffer.byteLength(chunk)
      if (bytes > MAX_BYTES) throw new Error('BODY_TOO_LARGE')
      chunks.push(Buffer.from(chunk))
    }
    body = Buffer.concat(chunks).toString('utf8')
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8')
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > MAX_BYTES) throw new Error('BODY_TOO_LARGE')
    body = JSON.parse(body)
  } else if (Buffer.byteLength(JSON.stringify(body) || '') > MAX_BYTES) throw new Error('BODY_TOO_LARGE')
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('INVALID_BODY')
  return body
}

export function createRsvpHandler({ fetchImpl = globalThis.fetch, env = () => process.env, now = Date.now } = {}) {
  const attempts = new Map()

  return async function handler(req, res) {
    if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Este formulario se envía con POST.', { Allow: 'POST' })
    if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return fail(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Activá JavaScript para enviar la confirmación desde el formulario.')
    }

    const config = env()
    if (req.headers.origin) {
      try {
        const origin = new URL(req.headers.origin)
        const matches = config.APP_ORIGIN ? origin.origin === new URL(config.APP_ORIGIN).origin : origin.host === req.headers.host
        if (!matches || !['http:', 'https:'].includes(origin.protocol)) throw new Error('ORIGIN')
      } catch { return fail(res, 403, 'FORBIDDEN_ORIGIN', 'Abrí la invitación original para enviar tu respuesta.') }
    }

    let body
    try { body = await readBody(req) }
    catch (error) {
      return fail(res, error.message === 'BODY_TOO_LARGE' ? 413 : 400, 'INVALID_BODY', 'No pudimos leer los datos. Revisá el formulario y volvé a intentar.')
    }

    if (body.website) return fail(res, 400, 'INVALID_SUBMISSION', 'No pudimos validar la respuesta. Recargá la invitación e intentá otra vez.')
    const checked = validateRsvp(body)
    if (!checked.valid || !isRequestId(body.requestId)) {
      return fail(res, 400, 'VALIDATION', Object.values(checked.errors)[0] || 'Recargá la invitación e intentá otra vez.')
    }

    let upstream
    try {
      upstream = new URL(config.GOOGLE_SCRIPT_URL)
      if (upstream.protocol !== 'https:' || upstream.hostname !== 'script.google.com' || !/^\/macros\/s\/[\w-]+\/exec$/.test(upstream.pathname)) throw new Error('CONFIGURATION')
      if (!config.GOOGLE_SCRIPT_SECRET || config.GOOGLE_SCRIPT_SECRET.length < 32) throw new Error('CONFIGURATION')
    } catch {
      return fail(res, 503, 'NOT_CONFIGURED', 'La confirmación todavía no está habilitada. No se envió tu respuesta; volvé a intentar más adelante.')
    }

    const currentTime = now()
    if (attempts.size >= 4096) {
      for (const [key, value] of attempts) if (value.expires <= currentTime) attempts.delete(key)
      if (attempts.size >= 4096) return fail(res, 429, 'RATE_LIMIT', 'Hay muchas solicitudes. Volvé a intentar en unos minutos.', { 'Retry-After': '600' })
    }
    const ip = String(req.socket?.remoteAddress || 'unknown')
    const previous = attempts.get(ip)
    const limit = previous && previous.expires > currentTime ? previous : { count: 0, expires: currentTime + WINDOW_MS }
    if (++limit.count > MAX_REQUESTS) {
      return fail(res, 429, 'RATE_LIMIT', 'Ya recibimos varios intentos. Esperá unos minutos antes de volver a enviar.', { 'Retry-After': String(Math.ceil((limit.expires - currentTime) / 1000)) })
    }
    attempts.set(ip, limit)

    try {
      const response = await fetchImpl(upstream, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: JSON.stringify({ ...checked.value, requestId: body.requestId, secret: config.GOOGLE_SCRIPT_SECRET }),
        redirect: 'follow',
        signal: AbortSignal.timeout(18000),
      })
      if (!response.ok) throw new Error('UPSTREAM_STATUS')
      const result = await response.json()
      if (result.ok !== true || result.saved !== true || result.requestId !== body.requestId) throw new Error('UNCONFIRMED_SAVE')
      return reply(res, 200, { ok: true, requestId: body.requestId, updated: result.updated === true })
    } catch {
      return fail(res, 502, 'SAVE_UNCONFIRMED', 'No pudimos verificar el guardado. Volvé a intentar: la misma respuesta no se duplica.')
    }
  }
}

export default createRsvpHandler()
