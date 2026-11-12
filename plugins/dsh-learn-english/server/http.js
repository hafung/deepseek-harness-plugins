export function sendJson(response, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store, max-age=0',
    'content-length': Buffer.byteLength(body),
    ...extraHeaders,
  })
  response.end(body)
}

export function sendError(response, status, message, extraHeaders = {}) {
  sendJson(response, status, { ok: false, error: message }, extraHeaders)
}

export function methodNotAllowed(response, allow) {
  sendError(response, 405, 'Method not allowed.', { allow })
}

export async function readJson(request, limit = 128 * 1024) {
  const chunks = []
  let total = 0
  for await (const chunk of request) {
    total += chunk.length
    if (total > limit) {
      const error = new Error('Request body is too large.')
      error.status = 413
      throw error
    }
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    const error = new Error('Request body is not valid JSON.')
    error.status = 400
    throw error
  }
}

export function route(handler) {
  return (request, response) => {
    Promise.resolve(handler(request, response)).catch(error => {
      if (response.headersSent) {
        if (!response.writableEnded && !response.destroyed) response.end()
        return
      }
      const status = Number.isInteger(error?.status) ? error.status : 500
      sendError(response, status, String(error?.message ?? error))
    })
  }
}

export function writeNdjson(response, payload) {
  if (response.destroyed || response.writableEnded) return false
  return response.write(`${JSON.stringify(payload)}\n`)
}
