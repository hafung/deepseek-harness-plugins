// Readable-text extraction for the "summarize the full article" action.
// It intentionally stays conservative: when extraction is weak the caller
// falls back to the feed summary and the agent can fetch the URL itself.

import { cleanText, fetchDocument } from './rss.js'

const MAX_ARTICLE_CHARS = 24_000
const BOILERPLATE = /^(?:advertisement|advertising|sponsored|share|share this|share on .+|subscribe|sign up|sign in|log in|newsletter|follow us|read more|related(?: articles?)?|recommended|more from .+|cookie(?:s| policy)?|privacy policy|terms of service|all rights reserved|skip to content|menu|home|search|comments?|listen to (?:this )?article|in this article|your browser does not support the audio element|广告|赞助|分享|分享到.+|订阅|登录|注册|首页|更多|相关阅读|推荐阅读|返回顶部|版权所有|评论|最会买|软媒应用|要知app|软媒魔方|投稿|rss订阅|收藏it之家|设置|日夜间|随系统|浅色|深色|主题色.*)$/i
const NAV_LINE = /^(?:[A-Za-z0-9]{1,10}|[\u4e00-\u9fff]{1,8})$/

function decodeBasic(text) {
  return cleanText(text)
}

function chooseArticle(html) {
  const blocks = [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article\s*>/gi)].map(match => match[1])
  if (blocks.length > 0) return blocks.reduce((best, block) => block.length > best.length ? block : best, '')
  const main = /<main\b[^>]*>([\s\S]*?)<\/main\s*>/i.exec(html)
  if (main) return main[1]
  const body = /<body\b[^>]*>([\s\S]*?)<\/body\s*>/i.exec(html)
  return body?.[1] ?? html
}

function pageTitle(html) {
  const og = /<meta\b[^>]*property\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']+)["']/i.exec(html)
    ?? /<meta\b[^>]*content\s*=\s*["']([^"']+)["'][^>]*property\s*=\s*["']og:title["']/i.exec(html)
  if (og) return cleanText(og[1]).slice(0, 300)
  const title = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html)
  return title ? cleanText(title[1]).slice(0, 300) : ''
}

function assertPublicArticleUrl(value) {
  const url = new URL(value)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('unsupported article URL')
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')
    || /^(?:127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host)
    || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)
    || (host.includes(':') && (host === '::1' || host.startsWith('fc') || host.startsWith('fd')))) {
    throw new Error('private article host is not allowed')
  }
  return url.href
}

function readableLines(html) {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, ' ')
  const withoutNoise = withoutComments
    .replace(/<(script|style|noscript|svg|canvas|template|iframe|form|button|select|textarea)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<figure\b[\s\S]*?<\/figure\s*>/gi, ' ')
  const text = decodeBasic(withoutNoise)
  const seen = new Set()
  const lines = []
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+/g, ' ').trim()
    if (!line) continue
    if (BOILERPLATE.test(line)) continue
    if (NAV_LINE.test(line)) continue
    if (/^首页\s*[>›»]/.test(line)) continue
    if (/^(?:来源|作者|责编|编辑|评论|发布时间|更新时间)[：:]/.test(line)) continue
    if (/^\d{4}[/.-]\d{1,2}[/.-]\d{1,2}/.test(line) && line.length < 40) continue
    if (/^感谢.{0,30}(?:线索|投稿|提供)/.test(line)) continue
    if (/^(?:https?:\/\/|www\.)\S+$/i.test(line)) continue
    if (line.length < 8 && !/[。！？.!?：:]$/.test(line)) continue
    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    lines.push(line)
    if (lines.join('\n').length >= MAX_ARTICLE_CHARS) break
  }
  return lines
}

export async function extractArticle(url, options = {}) {
  const startedAt = Date.now()
  try {
    const safeUrl = assertPublicArticleUrl(url)
    const page = await fetchDocument(safeUrl, options)
    if (!/html|text\/plain/i.test(page.contentType) && !/^\s*</.test(page.text.slice(0, 200))) {
      throw new Error('not an HTML article')
    }
    const html = page.text
    const article = chooseArticle(html)
    const lines = readableLines(article)
    let text = lines.join('\n\n').trim()
    if (text.length < 320) {
      const whole = readableLines(html)
      const fallback = whole.join('\n\n').trim()
      if (fallback.length > text.length) text = fallback
    }
    if (text.length < 120) throw new Error('article text too short')
    const truncated = text.length > MAX_ARTICLE_CHARS || page.truncated
    return {
      ok: true,
      text: text.slice(0, MAX_ARTICLE_CHARS),
      title: pageTitle(html),
      charCount: Math.min(text.length, MAX_ARTICLE_CHARS),
      truncated,
      sourceBytes: page.bytes,
      elapsedMs: Date.now() - startedAt,
    }
  } catch (error) {
    return {
      ok: false,
      error: error?.message ? String(error.message) : String(error),
      elapsedMs: Date.now() - startedAt,
    }
  }
}
