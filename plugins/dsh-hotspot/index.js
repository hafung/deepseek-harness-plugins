import { readFileSync } from 'node:fs'

import { HotspotService } from './server/hotspot.js'

export const inject = ['webServer']

const catalog = JSON.parse(readFileSync(new URL('./sources.json', import.meta.url), 'utf8'))

function sendJson(response, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store, max-age=0',
    'content-length': Buffer.byteLength(body),
    ...extraHeaders,
  })
  response.end(body)
}

function methodNotAllowed(response, allow) {
  sendJson(response, 405, { ok: false, error: '不支持的请求方法。' }, { allow })
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
  const service = new HotspotService({
    ctx,
    sources: catalog.sources,
    upstream: {
      url: catalog.upstream,
      label: 'Tidings RSS',
      license: catalog.upstreamLicense,
    },
    logger: console,
  })

  ctx.effect(() => {
    void service.start().catch(error => {
      console.warn('[dsh-hotspot] startup failed:', error?.message ?? error)
    })
    return () => service.dispose()
  })

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/plugins/hotspot/state',
    handler: route((request, response) => {
      if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed(response, 'GET, HEAD')
      const state = service.getState()
      if (request.method === 'HEAD') {
        response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        response.end()
        return
      }
      sendJson(response, 200, state)
    }),
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/plugins/hotspot/refresh',
    handler: route((request, response) => {
      if (request.method !== 'POST') return methodNotAllowed(response, 'POST')
      const { started } = service.triggerRefresh('manual')
      sendJson(response, 202, { ok: true, started })
    }),
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/plugins/hotspot/article',
    handler: route(async (request, response) => {
      if (request.method !== 'GET') return methodNotAllowed(response, 'GET')
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      const id = url.searchParams.get('id') ?? ''
      if (!/^[a-f0-9]{8,40}$/i.test(id)) {
        sendJson(response, 400, { ok: false, error: '缺少有效的资讯 id。' })
        return
      }
      const article = await service.getArticle(id)
      if (!article.ok) {
        sendJson(response, article.status ?? 404, article)
        return
      }
      sendJson(response, 200, article)
    }),
  }))
}
