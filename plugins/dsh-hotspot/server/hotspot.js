import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { canonicalUrl, fetchFeed, parseFeed } from './rss.js'
import { extractArticle } from './article.js'
import {
  CATEGORIES,
  buildLlmPrompt,
  estimateCreatorReason,
  estimateCreatorScore,
  parseLlmSelection,
  rankArticles,
  titleKey,
} from './rank.js'

const CACHE_VERSION = 1
const REFRESH_INTERVAL_MS = 60 * 60 * 1000
const LAUNCH_REFRESH_AFTER_MS = 30 * 60 * 1000
const MAX_ARTICLE_AGE_MS = 7 * 24 * 60 * 60 * 1000
const MAX_ARTICLES = 5_000
const MAX_PER_SOURCE = 36
const CONCURRENCY = 12
const FEED_TIMEOUT_MS = 11_000
const TOP_N = 30

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function articleId(url, title) {
  return createHash('sha1').update(`${canonicalUrl(url)}\u0000${title}`).digest('hex').slice(0, 20)
}

function dedupeSourceList(sources) {
  const seen = new Set()
  const output = []
  for (const source of sources) {
    const key = `${source.id}:${source.title}`
    if (seen.has(key)) continue
    seen.add(key)
    output.push(source)
  }
  return output
}

function mergeArticle(existing, incoming) {
  const sources = dedupeSourceList([
    ...(existing.sources ?? []),
    ...(incoming.sources ?? []),
    { id: incoming.sourceId, title: incoming.sourceTitle, url: incoming.url },
  ])
  return {
    ...existing,
    summary: (incoming.summary?.length ?? 0) > (existing.summary?.length ?? 0) ? incoming.summary : existing.summary,
    author: existing.author || incoming.author,
    image: existing.image || incoming.image,
    publishedAt: Math.min(existing.publishedAt || incoming.publishedAt, incoming.publishedAt || existing.publishedAt),
    fetchedAt: Math.max(existing.fetchedAt || 0, incoming.fetchedAt || 0),
    sources,
  }
}

function dedupeArticles(articles) {
  const sorted = [...articles].sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
  const byUrl = new Map()
  const byTitle = new Map()
  const output = []
  for (const raw of sorted) {
    const article = {
      ...raw,
      url: canonicalUrl(raw.url),
      sources: dedupeSourceList(raw.sources?.length
        ? raw.sources
        : [{ id: raw.sourceId, title: raw.sourceTitle, url: raw.url }]),
    }
    let existing = byUrl.get(article.url)
    const key = titleKey(article.title)
    if (!existing && key) {
      const candidate = byTitle.get(key)
      if (candidate && Math.abs((candidate.publishedAt || 0) - (article.publishedAt || 0)) < 36 * 60 * 60 * 1000
        && candidate.language === article.language) {
        existing = candidate
      }
    }
    if (existing) {
      Object.assign(existing, mergeArticle(existing, article))
      byUrl.set(article.url, existing)
      continue
    }
    output.push(article)
    byUrl.set(article.url, article)
    if (key) byTitle.set(key, article)
  }
  return output
}

async function mapLimit(items, limit, worker) {
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next
      next += 1
      if (index >= items.length) return
      await worker(items[index], index)
    }
  })
  await Promise.all(workers)
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export class HotspotService {
  constructor({ ctx, sources, upstream = {}, dataDir, logger = console } = {}) {
    this.ctx = ctx
    this.sources = (sources ?? []).filter(source => source?.url)
    this.upstream = upstream
    this.logger = logger
    this.dataDir = dataDir ?? path.join(
      process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh'),
      'plugin-data',
      'dsh-hotspot',
    )
    this.cacheFile = path.join(this.dataDir, 'cache.json')
    this.articleMap = new Map()
    this.feedMeta = {}
    this.articleCache = new Map()
    this.timer = null
    this.refreshPromise = null
    this.stopped = false
    this.llmError = ''
    this.state = {
      version: CACHE_VERSION,
      ready: false,
      refreshing: false,
      progress: { stage: 'idle', done: 0, total: this.sources.length, ok: 0, failed: 0, message: '等待首次扫描' },
      lastRefresh: 0,
      nextRefreshAt: 0,
      refreshIntervalMs: REFRESH_INTERVAL_MS,
      rankingWindowHours: 72,
      refreshReason: '',
      lastError: '',
      llmError: '',
      aiRanked: false,
      stats: {
        sourceCount: this.sources.length,
        sourcesScanned: 0,
        sourcesFailed: 0,
        articles: 0,
        candidates: 0,
        topN: TOP_N,
      },
      items: [],
      categories: CATEGORIES.map(category => ({ ...category, count: 0 })),
    }
  }

  async start() {
    await this.loadCache()
    if (this.stopped) return
    this.state.ready = true
    const age = Date.now() - this.state.lastRefresh
    if (!this.state.items.length || !this.state.lastRefresh || age >= LAUNCH_REFRESH_AFTER_MS) {
      void this.refresh('launch')
    } else {
      this.scheduleNext(REFRESH_INTERVAL_MS - age)
    }
  }

  dispose() {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  async loadCache() {
    try {
      const raw = await fs.readFile(this.cacheFile, 'utf8')
      const cache = JSON.parse(raw)
      if (cache?.version !== CACHE_VERSION) return
      const now = Date.now()
      const articles = Array.isArray(cache.articles) ? cache.articles : []
      this.articleMap = new Map(articles
        .filter(article => article?.id && article?.title && article?.url)
        .filter(article => now - (article.publishedAt || 0) <= MAX_ARTICLE_AGE_MS)
        .map(article => [article.id, article]))
      this.feedMeta = cache.feedMeta && typeof cache.feedMeta === 'object' ? cache.feedMeta : {}
      const displayCutoff = now - 120 * 60 * 60 * 1000
      if (Array.isArray(cache.items) && cache.items.length) {
        this.state.items = cache.items
          .filter(item => (Number(item.publishedAt) || 0) >= displayCutoff)
          .slice(0, TOP_N)
      }
      this.state.lastRefresh = Number(cache.lastRefresh) || 0
      this.state.rankingWindowHours = Number(cache.rankingWindowHours) || 72
      this.state.aiRanked = Boolean(cache.aiRanked)
      this.state.stats = {
        ...this.state.stats,
        ...(cache.stats ?? {}),
        sourceCount: this.sources.length,
        articles: this.articleMap.size,
      }
      this.state.categories = this.categoriesFor(this.state.items)
      this.state.progress = {
        stage: 'idle',
        done: 0,
        total: this.sources.length,
        ok: 0,
        failed: 0,
        message: this.state.items.length ? '已载入本地快照，准备检查更新' : '等待首次扫描',
      }
      if (this.state.lastRefresh) {
        this.state.nextRefreshAt = this.state.lastRefresh + REFRESH_INTERVAL_MS
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') this.logger.warn?.('[dsh-hotspot] cache read failed:', error?.message ?? error)
    }
  }

  categoriesFor(items) {
    const counts = {}
    for (const item of items) counts[item.category] = (counts[item.category] ?? 0) + 1
    return [
      { id: 'all', label: '全部', count: items.length },
      ...CATEGORIES.map(category => ({ ...category, count: counts[category.id] ?? 0 })),
    ]
  }

  getState() {
    const displayCutoff = Date.now() - 120 * 60 * 60 * 1000
    const items = this.state.items
      .filter(item => (Number(item.publishedAt) || 0) >= displayCutoff)
      .slice(0, TOP_N)
      .map(item => ({
        ...item,
        creatorScore: Number.isFinite(item.creatorScore) ? item.creatorScore : estimateCreatorScore(item),
        creatorReason: item.creatorReason || estimateCreatorReason(item),
        aging: item.aging ?? Boolean(item.publishedAt && Date.now() - item.publishedAt > 72 * 60 * 60 * 1000),
      }))
    return {
      ...this.state,
      serverNow: Date.now(),
      items,
      categories: this.categoriesFor(items),
      rankingWindowHours: this.state.rankingWindowHours || 72,
      llmError: this.llmError || this.state.llmError || '',
      stats: {
        ...this.state.stats,
        sourceCount: this.sources.length,
        topN: TOP_N,
        articles: this.articleMap.size,
        aiCount: items.filter(item => item.category === 'ai').length,
        chineseCount: items.filter(item => item.language === 'zh').length,
      },
      sources: {
        count: this.sources.length,
        upstream: this.upstream.url ?? '',
        upstreamLabel: this.upstream.label ?? '',
        license: this.upstream.license ?? '',
      },
    }
  }

  triggerRefresh(reason = 'manual') {
    if (this.refreshPromise) return { started: false, state: this.getState() }
    void this.refresh(reason)
    return { started: true, state: this.getState() }
  }

  scheduleNext(delay = REFRESH_INTERVAL_MS) {
    if (this.stopped) return
    if (this.timer) clearTimeout(this.timer)
    const wait = clamp(delay, 30_000, REFRESH_INTERVAL_MS)
    this.timer = setTimeout(() => {
      this.timer = null
      void this.refresh('interval').finally(() => {
        if (!this.stopped && !this.refreshPromise) this.scheduleNext(REFRESH_INTERVAL_MS)
      })
    }, wait)
    this.state.nextRefreshAt = Date.now() + wait
  }

  async refresh(reason = 'interval') {
    if (this.stopped) return this.getState()
    if (this.refreshPromise) return this.refreshPromise
    this.refreshPromise = this.#runRefresh(reason).finally(() => {
      this.refreshPromise = null
      if (!this.stopped) this.scheduleNext(REFRESH_INTERVAL_MS)
    })
    return this.refreshPromise
  }

  async #runRefresh(reason) {
    const startedAt = Date.now()
    this.state.refreshing = true
    this.state.refreshReason = reason
    this.state.lastError = ''
    this.state.progress = {
      stage: 'fetching',
      done: 0,
      total: this.sources.length,
      ok: 0,
      failed: 0,
      startedAt,
      message: `正在扫描 ${this.sources.length} 个信源`,
    }
    if (this.timer) clearTimeout(this.timer)
    this.timer = null

    let ok = 0
    let failed = 0
    const failures = []
    try {
      await mapLimit(this.sources, CONCURRENCY, async source => {
        const previous = this.feedMeta[source.id] ?? {}
        try {
          const result = await fetchFeed(source, previous, { timeoutMs: FEED_TIMEOUT_MS })
          const now = Date.now()
          if (!result.notModified) {
            const feedItems = parseFeed(result.text, source, now)
            if (feedItems.length === 0) throw new Error('no readable entries')
            for (const item of feedItems) {
              const url = canonicalUrl(item.url)
              if (!url) continue
              const id = articleId(url, item.title)
              const article = {
                id,
                title: item.title,
                url,
                summary: item.summary,
                publishedAt: Number(item.publishedAt) || now,
                fetchedAt: now,
                author: item.author ?? '',
                image: item.image ?? '',
                sourceId: source.id,
                sourceTitle: source.title,
                sourceSite: source.site ?? '',
                category: source.category ?? '',
                language: source.language ?? 'en',
                packs: Array.isArray(source.packs) ? source.packs : [],
                sources: [{ id: source.id, title: source.title, url }],
              }
              const existing = this.articleMap.get(id)
              this.articleMap.set(id, existing ? mergeArticle(existing, article) : article)
            }
            this.feedMeta[source.id] = {
              etag: result.etag,
              lastModified: result.lastModified,
              lastFetched: now,
              lastOk: now,
              bytes: result.bytes ?? 0,
              entries: feedItems.length,
              error: '',
            }
          } else {
            this.feedMeta[source.id] = {
              ...previous,
              lastFetched: now,
              lastOk: now,
              checked: now,
              notModified: true,
              error: '',
            }
          }
          ok += 1
        } catch (error) {
          failed += 1
          const message = error?.name === 'AbortError' ? '超时' : String(error?.message ?? error).slice(0, 180)
          if (failures.length < 8) failures.push(`${source.title}: ${message}`)
          this.feedMeta[source.id] = {
            ...previous,
            lastFetched: Date.now(),
            lastAttempt: Date.now(),
            error: message,
          }
        } finally {
          this.state.progress = {
            ...this.state.progress,
            done: this.state.progress.done + 1,
            ok,
            failed,
            message: `扫描信源 ${this.state.progress.done + 1}/${this.sources.length}`,
          }
          this.state.stats = {
            ...this.state.stats,
            articles: this.articleMap.size,
            sourcesScanned: this.state.progress.done,
            sourcesFailed: failed,
          }
        }
      })

      this.pruneArticles()
      const articles = dedupeArticles([...this.articleMap.values()])
      this.state.progress = {
        ...this.state.progress,
        stage: 'ranking',
        message: `从 ${articles.length.toLocaleString('zh-CN')} 条资讯中筛选今日 Top ${TOP_N}`,
      }
      this.llmError = ''
      this.state.llmError = ''
      const ranked = await rankArticles(articles, {
        now: Date.now(),
        topN: TOP_N,
        llmRank: (candidates, options) => this.#llmRank(candidates, options),
      })
      this.state.items = ranked.items
      this.state.categories = this.categoriesFor(ranked.items)
      this.state.lastRefresh = Date.now()
      this.state.rankingWindowHours = ranked.windowHours || 72
      this.state.aiRanked = ranked.llm
      this.state.stats = {
        ...this.state.stats,
        sourceCount: this.sources.length,
        sourcesScanned: ok,
        sourcesFailed: failed,
        articles: this.articleMap.size,
        candidates: articles.length,
        preselected: ranked.candidates,
        topN: TOP_N,
      }
      this.state.lastError = failures.length ? failures.join('；') : ''
      this.state.progress = {
        stage: 'saving',
        done: this.sources.length,
        total: this.sources.length,
        ok,
        failed,
        startedAt,
        message: '正在保存今日快照',
      }
      await this.saveCache()
      this.state.progress = {
        stage: 'done',
        done: this.sources.length,
        total: this.sources.length,
        ok,
        failed,
        startedAt,
        finishedAt: Date.now(),
        message: `已更新 ${ranked.items.length} 条精选 · 扫描 ${ok}/${this.sources.length} 个信源`,
      }
    } catch (error) {
      const message = String(error?.message ?? error)
      this.state.lastError = message
      this.state.progress = {
        stage: 'error',
        done: this.state.progress.done,
        total: this.sources.length,
        ok,
        failed,
        startedAt,
        finishedAt: Date.now(),
        message: `扫描失败：${message}`,
      }
      this.logger.warn?.('[dsh-hotspot] refresh failed:', error)
    } finally {
      this.state.refreshing = false
      this.state.ready = true
      this.state.nextRefreshAt = Date.now() + REFRESH_INTERVAL_MS
    }
    return this.getState()
  }

  pruneArticles() {
    const cutoff = Date.now() - MAX_ARTICLE_AGE_MS
    const perSource = new Map()
    const keep = []
    for (const article of this.articleMap.values()) {
      if ((article.publishedAt || 0) < cutoff && (article.fetchedAt || 0) < cutoff) continue
      const list = perSource.get(article.sourceId) ?? []
      list.push(article)
      perSource.set(article.sourceId, list)
    }
    for (const list of perSource.values()) {
      list.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
      keep.push(...list.slice(0, MAX_PER_SOURCE))
    }
    keep.sort((a, b) => (b.fetchedAt || 0) - (a.fetchedAt || 0))
    this.articleMap = new Map(keep.slice(0, MAX_ARTICLES).map(article => [article.id, article]))
  }

  async saveCache() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true })
      const payload = {
        version: CACHE_VERSION,
        savedAt: Date.now(),
        lastRefresh: this.state.lastRefresh,
        rankingWindowHours: this.state.rankingWindowHours,
        aiRanked: this.state.aiRanked,
        stats: this.state.stats,
        items: this.state.items,
        feedMeta: this.feedMeta,
        articles: [...this.articleMap.values()],
      }
      const text = JSON.stringify(payload)
      const temp = `${this.cacheFile}.${process.pid}.tmp`
      await fs.writeFile(temp, text, 'utf8')
      await fs.rename(temp, this.cacheFile)
      this.logger.info?.(`[dsh-hotspot] saved ${this.state.items.length} items (${formatBytes(text.length)})`)
    } catch (error) {
      this.logger.warn?.('[dsh-hotspot] cache write failed:', error?.message ?? error)
    }
  }

  async #llmRank(candidates, { now, topN, windowHours = 72 }) {
    const llm = this.ctx?.get?.('llm')
    const defaultModel = this.ctx?.get?.('agentDefaultModel')
    const selection = defaultModel?.currentSelection?.()
    if (!llm?.stream || !selection?.provider || !selection?.model) {
      this.llmError = '默认模型不可用'
      throw new Error(this.llmError)
    }
    const prompt = buildLlmPrompt(candidates, { now, topN, windowHours })
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error('ranking timed out')), 100_000)
    let text = ''
    let finish
    try {
      const stream = llm.stream({
        provider: selection.provider,
        model: selection.model,
        system: '你是严谨的中文科技新闻主编，只依据给定候选资讯做判断，输出严格 JSON。',
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        temperature: 0.2,
        maxTokens: 8_000,
        signal: controller.signal,
      })
      for await (const chunk of stream) {
        if (chunk.type === 'text-delta') text += chunk.text
        if (chunk.type === 'finish') {
          finish = chunk.reason
          if (chunk.reason?.kind === 'error') throw new Error(chunk.reason.failure?.message ?? 'model error')
          if (chunk.reason?.kind === 'aborted') throw new Error('model aborted')
        }
      }
      if (finish?.kind === 'max-tokens' && !text.trim()) throw new Error('empty model reply')
      const selectionItems = parseLlmSelection(text)
      if (!selectionItems.length) throw new Error('model reply was not a JSON array')
      this.logger.info?.(`[dsh-hotspot] AI ranked ${selectionItems.length} candidates with ${selection.model}`)
      return selectionItems
    } catch (error) {
      this.llmError = String(error?.message ?? error).slice(0, 240)
      this.logger.warn?.(`[dsh-hotspot] AI ranking failed, using signal ranking: ${this.llmError}`)
      throw error
    } finally {
      clearTimeout(timer)
    }
  }

  async getArticle(id) {
    const item = this.state.items.find(entry => entry.id === id) ?? this.articleMap.get(id)
    if (!item) return { ok: false, status: 404, error: '这条资讯已不在当前榜单中。' }
    const cached = this.articleCache.get(id)
    if (cached && Date.now() - cached.at < 6 * 60 * 60 * 1000) return cached.value
    const extracted = await extractArticle(item.url)
    let content = ''
    let fallback = false
    if (extracted.ok) {
      content = extracted.text
      if (content.length < 500 && item.summary) {
        content = `${item.summary}\n\n${content}`.trim()
        fallback = true
      }
    } else {
      content = item.summary
      fallback = true
    }
    content = content.slice(0, 24_000)
    const value = {
      ok: true,
      id,
      title: item.title,
      url: item.url,
      sourceTitle: item.sourceTitle,
      summary: item.summary,
      content,
      charCount: content.length,
      truncated: Boolean(extracted.truncated) || content.length >= 24_000,
      fallback,
      note: fallback
        ? '原文正文只提取到较少内容；已附上 RSS 摘要，智能体可再用 web_fetch 补全。'
        : '',
      extractedAt: Date.now(),
    }
    this.articleCache.set(id, { at: Date.now(), value })
    if (this.articleCache.size > 120) {
      const first = this.articleCache.keys().next().value
      if (first) this.articleCache.delete(first)
    }
    return value
  }
}
