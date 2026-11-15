// 航迹 (tracks) — Host half.
//
// Owns the durable ledger, folds the live `session/event` append feed, backfills
// history through `sessionQuery`, and answers three small JSON routes for the
// client half. Nothing here costs tokens: no tools, no prompt sections.

import { readFile } from 'node:fs/promises'

import { TracksService } from './server/service.js'

export const inject = ['webServer']

const API = '/api/plugins/tracks'
const MAX_BODY_BYTES = 64 * 1024

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store, max-age=0',
    'content-length': Buffer.byteLength(body),
  })
  response.end(body)
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    request.on('data', chunk => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body too large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      if (text.trim() === '') {
        resolve({})
        return
      }
      try {
        const parsed = JSON.parse(text)
        resolve(parsed !== null && typeof parsed === 'object' ? parsed : {})
      } catch {
        reject(new Error('invalid json'))
      }
    })
    request.on('error', reject)
  })
}

function route(handler) {
  return (request, response) => {
    Promise.resolve(handler(request, response)).catch(error => {
      if (response.headersSent) {
        response.end()
        return
      }
      sendJson(response, 500, { ok: false, error: String(error?.message ?? error) })
    })
  }
}

export function apply(ctx) {
  const logger = {
    warn: (...args) => console.warn('[dsh-tracks]', ...args),
    info: (...args) => console.info('[dsh-tracks]', ...args),
  }
  const service = new TracksService({ ctx, logger })

  ctx.effect(() => {
    void service.start().catch(error => {
      logger.warn('startup failed:', error?.message ?? error)
    })
    return () => {
      void service.dispose()
    }
  })

  // Live path: every committed event in every session of this Host.
  ctx.on('session/event', (session, event) => {
    service.observe(session, event)
  })

  // A session with no events yet still counts as a session.
  ctx.on('session/created', session => {
    try {
      service.ensureSession(session?.header)
    } catch {
      // Counting a header must never break session creation.
    }
  })

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${API}/state`,
    handler: route((request, response) => {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        sendJson(response, 405, { ok: false, error: 'method not allowed' })
        return
      }
      if (request.method === 'HEAD') {
        response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        response.end()
        return
      }
      sendJson(response, 200, service.snapshot())
    }),
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${API}/tick`,
    handler: route(async (request, response) => {
      if (request.method !== 'POST') {
        sendJson(response, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const body = await readBody(request)
      sendJson(response, 200, service.tick(body.ms))
    }),
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${API}/backfill`,
    handler: route(async (request, response) => {
      if (request.method !== 'POST') {
        sendJson(response, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const body = await readBody(request)
      const action = typeof body.action === 'string' ? body.action : 'start'
      if (action === 'cancel') {
        sendJson(response, 200, { ok: true, backfill: service.cancelBackfill() })
        return
      }
      // Answer immediately; the scan continues in the background and its
      // progress is visible in the next `state` read.
      const started = service.startBackfill()
      void started.catch(error => {
        logger.warn('backfill failed:', error?.message ?? error)
      })
      sendJson(response, 202, { ok: true, backfill: service.backfillState() })
    }),
  }))

  // Medal artwork: `medals/<id>.svg|png` in this package. A prefix route keeps
  // the URLs stable and extension-typed so the browser caches them normally.
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: `${API}/medals`,
    handler: route(async (request, response) => {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { allow: 'GET, HEAD' })
        response.end()
        return
      }
      const relative = decodeURIComponent((request.url ?? '/').split('?')[0]).slice(`${API}/medals`.length)
      const artwork = await service.artwork.resolve(relative)
      if (artwork === null) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
        response.end('not found')
        return
      }
      const headers = {
        'content-type': artwork.type,
        'cache-control': 'public, max-age=300',
        etag: artwork.etag,
        'last-modified': new Date(artwork.mtime).toUTCString(),
      }
      const ifNoneMatch = request.headers['if-none-match']
      if (typeof ifNoneMatch === 'string' && ifNoneMatch === artwork.etag) {
        response.writeHead(304, headers)
        response.end()
        return
      }
      const body = await readFile(artwork.path)
      response.writeHead(200, { ...headers, 'content-length': body.length })
      response.end(request.method === 'HEAD' ? undefined : body)
    }),
  }))
}
