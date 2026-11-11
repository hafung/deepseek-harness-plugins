// Minimal, dependency-free RSS / Atom / JSON Feed reader for the Hotspot plugin.
// Feeds are third-party data: every field is treated as untrusted text.

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  copy: '©',
  reg: '®',
  trade: '™',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  middot: '·',
  bull: '•',
  laquo: '«',
  raquo: '»',
  times: '×',
}

const BLOCK_END = /<\/(?:p|div|section|article|li|ul|ol|h[1-6]|blockquote|figure|figcaption|tr|td|th|pre|table|header|footer|aside)\s*>/gi
const BR = /<br\s*\/?>/gi
const TAG = /<[^>]+>/g
const XML_DECL = /<\?xml[^>]*\?>/i

export function decodeEntities(value = '') {
  return String(value).replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x'
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10)
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code)
        } catch {
          return match
        }
      }
      return match
    }
    return ENTITIES[entity.toLowerCase()] ?? match
  })
}

export function cleanText(value = '') {
  let text = String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  // Decode first so escaped markup is handled in the same pass, then strip
  // markup and decode any remaining entities in the authored text.
  text = decodeEntities(text)
  text = text
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(BLOCK_END, '\n')
    .replace(BR, '\n')
    .replace(TAG, ' ')
  text = decodeEntities(text)
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function stripTags(value = '') {
  return cleanText(value).replace(/\n+/g, ' ').trim()
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function readTag(block, names) {
  for (const name of names) {
    const pattern = new RegExp(`<${escapeRegExp(name)}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapeRegExp(name)}\\s*>`, 'i')
    const match = pattern.exec(block)
    if (match) return match[1]
  }
  return ''
}

function tagAttributes(tag) {
  const attributes = {}
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g
  let match
  while ((match = pattern.exec(tag)) !== null) {
    attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '')
  }
  return attributes
}

function findLink(block) {
  const atomLinks = [...block.matchAll(/<link\b([^>]*)\/?>/gi)]
  let fallback = ''
  for (const match of atomLinks) {
    const attributes = tagAttributes(match[0])
    const href = attributes.href
    if (!href) continue
    const rel = (attributes.rel ?? '').toLowerCase()
    if (rel === 'alternate' || rel === '') {
      if ((attributes.type ?? '').toLowerCase() === 'text/html' || !attributes.type) return decodeEntities(href)
      fallback ||= decodeEntities(href)
    } else if (!fallback && rel !== 'self' && rel !== 'enclosure') {
      fallback = decodeEntities(href)
    }
  }
  const textLink = stripTags(readTag(block, ['link']))
  if (textLink && /^(?:https?:)?\/\//i.test(textLink)) return textLink
  const guid = stripTags(readTag(block, ['guid', 'id', 'permalink']))
  if (guid && /^https?:\/\//i.test(guid)) return guid
  return fallback
}

function resolveUrl(value, source) {
  if (!value) return ''
  try {
    return new URL(value, source.site || source.url).href
  } catch {
    return ''
  }
}

export function canonicalUrl(value = '') {
  try {
    const url = new URL(value)
    url.hash = ''
    const remove = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
      'spm', 'scm', 'share_token', 'share_source', 'from', 'source', 'ref', 'ref_src',
      'fbclid', 'gclid', 'yclid', 'mc_cid', 'mc_eid', 'igshid',
    ]
    for (const key of remove) url.searchParams.delete(key)
    if (url.hostname.toLowerCase().startsWith('www.')) url.hostname = url.hostname.slice(4)
    url.hostname = url.hostname.toLowerCase()
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) url.pathname = url.pathname.slice(0, -1)
    return url.href
  } catch {
    return value
  }
}

function firstImage(block, source) {
  const media = /<media:(?:content|thumbnail)\b([^>]*)\/?>/i.exec(block)
  if (media) {
    const attributes = tagAttributes(media[0])
    if (attributes.url) {
      const url = resolveUrl(attributes.url, source)
      if (url) return url
    }
  }
  const enclosure = /<enclosure\b([^>]*)\/?>/i.exec(block)
  if (enclosure) {
    const attributes = tagAttributes(enclosure[0])
    if (attributes.url && (!attributes.type || /^image\//i.test(attributes.type))) {
      const url = resolveUrl(attributes.url, source)
      if (url) return url
    }
  }
  const image = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')/i.exec(block)
  if (image) return resolveUrl(decodeEntities(image[1] ?? image[2] ?? ''), source)
  return ''
}

function readPublished(block, fetchedAt) {
  const raw = stripTags(readTag(block, ['pubDate', 'published', 'updated', 'dc:date', 'date', 'created']))
  if (!raw) return fetchedAt
  const normalized = raw
    .replace(/[年/]/g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const parsed = Date.parse(raw) || Date.parse(normalized)
  if (!Number.isFinite(parsed)) return fetchedAt
  // Guard against broken feeds that publish dates in the future.
  if (parsed > fetchedAt + 2 * 60 * 60 * 1000) return fetchedAt
  return parsed
}

function readAuthor(block) {
  const raw = stripTags(readTag(block, ['dc:creator', 'author', 'name', 'creator']))
  if (!raw) return ''
  return raw.replace(/^by\s+/i, '').slice(0, 100)
}

function parseRssItems(xml, source, fetchedAt) {
  const blocks = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item\s*>/gi)]
  if (blocks.length === 0) {
    const entries = [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry\s*>/gi)]
    for (const entry of entries) blocks.push(entry)
  }
  const items = []
  for (const blockMatch of blocks) {
    const block = blockMatch[1]
    const title = stripTags(readTag(block, ['title']))
    if (!title) continue
    const link = resolveUrl(findLink(block), source)
    if (!link) continue
    const rawSummary = readTag(block, ['description', 'summary', 'content:encoded', 'content'])
    const summary = cleanText(rawSummary)
      .replace(/^\s*(?:read|continue|view)\s+(?:more|full(?: article)?)\b.*$/gim, '')
      .replace(/^\s*(?:阅读全文|查看全文|点击查看)\s*$/gm, '')
      .trim()
    items.push({
      title: title.slice(0, 400),
      url: link,
      summary: summary.slice(0, 900),
      publishedAt: readPublished(block, fetchedAt),
      author: readAuthor(block),
      image: firstImage(block, source),
    })
  }
  return items
}

function parseJsonFeed(text, source, fetchedAt) {
  const document = JSON.parse(text)
  if (!Array.isArray(document.items)) return []
  return document.items.slice(0, 24).flatMap(item => {
    const title = typeof item.title === 'string' ? item.title.trim() : ''
    const link = resolveUrl(item.url || item.external_url || item.id || '', source)
    if (!title || !link) return []
    const raw = item.content_html || item.content_text || item.summary || ''
    const summary = cleanText(String(raw))
    const published = Date.parse(item.date_published || item.date_modified || '')
    return [{
      title: title.slice(0, 400),
      url: link,
      summary: summary.slice(0, 900),
      publishedAt: Number.isFinite(published) && published <= fetchedAt + 2 * 60 * 60 * 1000 ? published : fetchedAt,
      author: Array.isArray(item.authors) ? String(item.authors[0]?.name ?? '').slice(0, 100) : '',
      image: item.image ? resolveUrl(item.image, source) : '',
    }]
  })
}

export function parseFeed(text, source, fetchedAt = Date.now()) {
  const trimmed = String(text ?? '').replace(XML_DECL, '').trim()
  if (!trimmed) return []
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return parseJsonFeed(trimmed, source, fetchedAt)
    } catch {
      return []
    }
  }
  return parseRssItems(trimmed, source, fetchedAt).slice(0, 24)
}

function charsetOf(buffer, contentType) {
  const header = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType ?? '')
  if (header) return header[1].toLowerCase()
  const prefix = new TextDecoder('latin1').decode(buffer.slice(0, 300))
  const declaration = /encoding\s*=\s*["']([\w-]+)/i.exec(prefix)
  return declaration?.[1]?.toLowerCase() ?? 'utf-8'
}

export function decodeBuffer(buffer, contentType) {
  const charset = charsetOf(buffer, contentType)
  try {
    return new TextDecoder(charset).decode(buffer)
  } catch {
    return new TextDecoder('utf-8').decode(buffer)
  }
}

async function readLimited(response, maxBytes) {
  if (!response.body) return new Uint8Array(await response.arrayBuffer())
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      const room = maxBytes - size
      if (room <= 0) break
      chunks.push(value.byteLength > room ? value.slice(0, room) : value)
      size += Math.min(value.byteLength, room)
      if (size >= maxBytes) {
        await reader.cancel().catch(() => {})
        break
      }
    }
  } finally {
    reader.releaseLock()
  }
  const output = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.byteLength
  }
  return output
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 DSH-Hotspot/1.0'

export async function fetchFeed(source, cache = {}, options = {}) {
  const timeoutMs = options.timeoutMs ?? 11_000
  const maxBytes = options.maxBytes ?? 3_000_000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('fetch timeout')), timeoutMs)
  const abort = () => controller.abort(options.signal?.reason ?? new Error('aborted'))
  if (options.signal) {
    if (options.signal.aborted) abort()
    else options.signal.addEventListener('abort', abort, { once: true })
  }
  const headers = {
    'user-agent': USER_AGENT,
    accept: 'application/rss+xml, application/atom+xml, application/feed+json, application/xml, text/xml;q=0.9, */*;q=0.8',
    'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
  }
  if (cache.etag) headers['if-none-match'] = cache.etag
  if (cache.lastModified) headers['if-modified-since'] = cache.lastModified
  try {
    const response = await fetch(source.url, {
      method: 'GET',
      headers,
      redirect: 'follow',
      signal: controller.signal,
    })
    if (response.status === 304) {
      return { notModified: true, etag: cache.etag, lastModified: cache.lastModified, text: '' }
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const buffer = await readLimited(response, maxBytes)
    if (buffer.byteLength === 0) throw new Error('empty response')
    const text = decodeBuffer(buffer, response.headers.get('content-type'))
    return {
      notModified: false,
      etag: response.headers.get('etag') ?? undefined,
      lastModified: response.headers.get('last-modified') ?? undefined,
      text,
      bytes: buffer.byteLength,
    }
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', abort)
  }
}

export async function fetchDocument(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? 16_000
  const maxBytes = options.maxBytes ?? 4_000_000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('fetch timeout')), timeoutMs)
  const abort = () => controller.abort(options.signal?.reason ?? new Error('aborted'))
  if (options.signal) {
    if (options.signal.aborted) abort()
    else options.signal.addEventListener('abort', abort, { once: true })
  }
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const type = response.headers.get('content-type') ?? ''
    const buffer = await readLimited(response, maxBytes)
    return {
      text: decodeBuffer(buffer, type),
      contentType: type,
      bytes: buffer.byteLength,
      url: response.url || url,
      truncated: buffer.byteLength >= maxBytes,
    }
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', abort)
  }
}
