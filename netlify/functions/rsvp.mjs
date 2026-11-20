import { Readable } from 'node:stream'
import rsvp from '../../api/rsvp.js'

export function createNetlifyHandler(handler = rsvp) {
  return async function (request, context = {}) {
    const req = request.body ? Readable.fromWeb(request.body) : Readable.from([])
    req.method = request.method
    req.headers = Object.fromEntries(request.headers)
    req.headers.host = new URL(request.url).host
    delete req.headers['x-forwarded-for']
    delete req.headers['x-vercel-forwarded-for']
    req.socket = { remoteAddress: context.ip || 'unknown' }

    let status = 500
    let headers = {}
    let body = ''
    await handler(req, {
      writeHead(value, fields) { status = value; headers = fields },
      end(value) { body = value },
    })
    return new Response(body, { status, headers })
  }
}

export default createNetlifyHandler()

export const config = { path: '/api/rsvp' }
