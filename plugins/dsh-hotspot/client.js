window.__ModuleLoader__.load({
  id: '@local/dsh-hotspot',
  factory(require) {
    const {
      createElement: h,
      useCallback,
      useEffect,
      useMemo,
      useRef,
      useState,
    } = require('react')

    const panelId = 'local-hotspot'
    const API = '/api/plugins/hotspot'
    const KNOWN_KEY = '@local/dsh-hotspot:known:v1'
    const SAVED_KEY = '@local/dsh-hotspot:saved:v1'
    const COLLECTION_LIMIT = 160

    const CATEGORIES = [
      { id: 'all', label: '全部', color: 'var(--dsw-alias-brand-primary, #3b6fe0)' },
      { id: 'ai', label: 'AI 前沿', color: 'light-dark(#b2472f, #ff9d7d)' },
      { id: 'tech', label: '科技', color: 'light-dark(#245f9f, #8cc2ff)' },
      { id: 'business', label: '商业', color: 'light-dark(#88611a, #efc46b)' },
      { id: 'science', label: '科学', color: 'light-dark(#146c60, #77ddcd)' },
      { id: 'security', label: '安全', color: 'light-dark(#a03a3a, #ff9f99)' },
      { id: 'world', label: '全球', color: 'light-dark(#4b4d9e, #b4b6ff)' },
      { id: 'culture', label: '文化', color: 'light-dark(#7a3f6b, #e9a9d7)' },
    ]
    const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(category => [category.id, category]))

    const iconPaths = {
      radar: [
        'M12 3.2a8.8 8.8 0 1 0 8.8 8.8',
        'M12 7.1a4.9 4.9 0 1 0 4.9 4.9',
        'M12 12.1 18 6',
        'M2.8 12.1h3.1M12.1 2.8v3.1',
      ],
      refresh: ['M20 11a8 8 0 1 0-2.3 6.7', 'M20 4.5V11h-6.4'],
      external: ['M14 4h6v6', 'M20 4 10.5 13.5', 'M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10'],
      sparkles: ['M12 3.4l1.8 4.9 4.9 1.8-4.9 1.8L12 16.8l-1.8-4.9-4.9-1.8 4.9-1.8L12 3.4Z', 'M18.6 15.3l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z'],
      search: ['M11 4.2a6.8 6.8 0 1 0 0 13.6 6.8 6.8 0 0 0 0-13.6Z', 'm16.1 16.1 4 4'],
      close: ['M6 6l12 12M18 6 6 18'],
      clock: ['M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z', 'M12 7.5V12l3.2 2'],
      layers: ['M12 3.5 21 8l-9 4.5L3 8l9-4.5Z', 'M4.2 12 12 15.9 19.8 12', 'M4.2 16 12 19.9 19.8 16'],
      arrow: ['M5 12h13M13 6l6 6-6 6'],
      back: ['M19 12H6M11 5l-7 7 7 7'],
      check: ['m5 12.5 4.5 4.5L19 7'],
      copy: ['M9 9h10v10H9z', 'M5 15H4V4h11v1'],
      star: ['m12 3.6 2.55 5.17 5.7.83-4.12 4.02.97 5.68L12 16.62 6.9 19.3l.97-5.68L3.75 9.6l5.7-.83L12 3.6Z'],
      alert: ['M12 4 2.8 20h18.4L12 4Z', 'M12 9.5V14', 'M12 17.2v.3'],
      inbox: ['M4.5 5.5h15v13h-15z', 'M4.5 13h4l1.4 2.2h4.2L15.5 13h4'],
      filter: ['M4 6h16M7 12h10M10 18h4'],
      pen: ['M4 20h4l10.2-10.2a2.7 2.7 0 0 0-3.8-3.8L4 16.2V20Z', 'm13.7 6.3 3.8 3.8'],
    }

    function Glyph({ name = 'sparkles', size = 16, strokeWidth = 1.65 }) {
      const paths = iconPaths[name] ?? iconPaths.sparkles
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false',
      }, paths.map((d, index) => h('path', { key: index, d })))
    }

    function HotspotIcon({ size = 20 }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.65, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false',
      },
      h('circle', { cx: 12, cy: 12.1, r: 8.2, opacity: 0.34 }),
      h('circle', { cx: 12, cy: 12.1, r: 4.4, opacity: 0.62 }),
      h('path', { d: 'M12 12.1 18.4 5.7' }),
      h('circle', { cx: 12, cy: 12.1, r: 1.65, fill: 'currentColor', stroke: 'none' }),
      h('path', { d: 'M3.2 12.1h2.1M12.1 3.2v2.1' }))
    }

    function Spinner({ size = 14 }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round',
        className: 'hs-spin', 'aria-hidden': true,
      }, h('path', { d: 'M21 12a9 9 0 1 1-5.4-8.2' }))
    }

    function StarIcon({ filled = false, size = 15 }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24',
        fill: filled ? 'currentColor' : 'none', stroke: 'currentColor',
        strokeWidth: 1.55, strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false',
      }, h('path', {
        d: 'm12 3.6 2.55 5.17 5.7.83-4.12 4.02.97 5.68L12 16.62 6.9 19.3l.97-5.68L3.75 9.6l5.7-.83L12 3.6Z',
      }))
    }

    function hostOf(url) {
      try {
        return new URL(url).hostname.replace(/^www\./, '')
      } catch {
        return ''
      }
    }

    function firstChar(value) {
      return Array.from(String(value ?? '').trim())[0] ?? '·'
    }

    function truncate(value, length) {
      const chars = Array.from(String(value ?? ''))
      return chars.length > length ? `${chars.slice(0, length).join('')}…` : chars.join('')
    }

    function isChineseArticle(item) {
      const language = String(item.language ?? '').toLowerCase()
      if (language) return language.startsWith('zh')
      const text = `${item.title ?? ''} ${item.summary ?? ''}`
      return (text.match(/[\u4e00-\u9fff]/g) ?? []).length >= 20
    }

    function readCollection(key) {
      try {
        const raw = JSON.parse(localStorage.getItem(key) ?? '{}')
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
        const output = {}
        for (const [id, entry] of Object.entries(raw)) {
          if (!entry || typeof entry !== 'object' || !entry.item || entry.item.id !== id) continue
          output[id] = { item: entry.item, at: Number(entry.at) || 0 }
        }
        return output
      } catch {
        return {}
      }
    }

    function writeCollection(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value))
        return true
      } catch {
        return false
      }
    }

    function trimCollection(value) {
      return Object.fromEntries(
        Object.entries(value)
          .sort((a, b) => (b[1].at || 0) - (a[1].at || 0))
          .slice(0, COLLECTION_LIMIT),
      )
    }

    function useCollections() {
      const [known, setKnown] = useState(() => readCollection(KNOWN_KEY))
      const [saved, setSaved] = useState(() => readCollection(SAVED_KEY))

      useEffect(() => {
        const onStorage = event => {
          if (event.key === null || event.key === KNOWN_KEY) setKnown(readCollection(KNOWN_KEY))
          if (event.key === null || event.key === SAVED_KEY) setSaved(readCollection(SAVED_KEY))
        }
        window.addEventListener('storage', onStorage)
        return () => window.removeEventListener('storage', onStorage)
      }, [])

      const toggleKnown = useCallback(item => {
        setKnown(previous => {
          const next = { ...previous }
          if (next[item.id]) delete next[item.id]
          else next[item.id] = { item, at: Date.now() }
          const trimmed = trimCollection(next)
          writeCollection(KNOWN_KEY, trimmed)
          return trimmed
        })
      }, [])

      const toggleSaved = useCallback(item => {
        setSaved(previous => {
          const next = { ...previous }
          if (next[item.id]) delete next[item.id]
          else next[item.id] = { item, at: Date.now() }
          const trimmed = trimCollection(next)
          writeCollection(SAVED_KEY, trimmed)
          return trimmed
        })
      }, [])

      return { known, saved, toggleKnown, toggleSaved }
    }

    function formatRelative(timestamp, now) {
      const time = Number(timestamp)
      if (!Number.isFinite(time) || time <= 0) return '刚收录'
      const delta = Math.max(0, now - time)
      if (delta < 60_000) return '刚刚'
      if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} 分钟前`
      if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} 小时前`
      if (delta < 7 * 86_400_000) return `${Math.floor(delta / 86_400_000)} 天前`
      return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(new Date(time))
    }

    function formatClock(timestamp) {
      if (!timestamp) return '尚未更新'
      return new Intl.DateTimeFormat('zh-CN', {
        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(new Date(timestamp))
    }

    function formatDateLine(now) {
      const date = new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
      }).format(new Date(now))
      return date.replace(/\//g, '年').replace(/周/, ' · 周')
    }

    function formatCount(value) {
      const number = Number(value)
      if (!Number.isFinite(number)) return '—'
      return new Intl.NumberFormat('zh-CN', { notation: number >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(number)
    }

    function countdown(nextRefreshAt, now) {
      if (!nextRefreshAt) return '等待排程'
      const delta = nextRefreshAt - now
      if (delta <= 0) return '即将扫描'
      if (delta < 60_000) return '不到 1 分钟后'
      const minutes = Math.floor(delta / 60_000)
      if (minutes < 60) return `${minutes} 分钟后`
      return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分后`
    }

    async function getJson(path, options = {}) {
      const response = await fetch(path, {
        cache: 'no-store',
        ...options,
        headers: { accept: 'application/json', ...(options.headers ?? {}) },
      })
      let payload = null
      try {
        payload = await response.json()
      } catch {
        // A non-JSON error is still surfaced through the status below.
      }
      if (!response.ok) throw new Error(payload?.error ?? `请求失败（HTTP ${response.status}）`)
      return payload
    }

    function buildRewritePrompt(item, article) {
      const content = String(article?.content ?? item.summary ?? '').slice(0, 24_000)
      return [
        '请把下面这篇资讯改写成一篇适合简体中文互联网读者阅读的完整文章。',
        '',
        '核心约束：',
        '1. 保留原意、事实、数据、人物、时间、引语与观点倾向；不得添加原文没有的信息，不得编造，不得夸大或煽动。',
        '2. 不是逐字翻译。请按中文互联网读者的阅读习惯重组信息与段落，让表达自然、简洁、流畅，有信息密度。',
        '3. 标题可以改写得更符合中文阅读习惯，但不能标题党，不能改变事实。',
        '4. 输出一篇可以直接发布的完整文章，包含标题和正文；不要只给摘要，不要写“以下是改写”之类的说明。',
        '5. 如果正文抓取不完整，请先用 web_fetch 打开原文补全，再开始改写。',
        '',
        `原标题：${item.title}`,
        `来源：${item.sourceTitle}`,
        `时间：${formatClock(item.publishedAt)}`,
        `链接：${item.url}`,
        ...(article?.fallback ? ['注意：下面附带的正文可能不完整，RSS 摘要已包含在正文开头。'] : []),
        '',
        '原文：',
        content || '（未能抓取正文，请打开链接阅读）',
      ].join('\n')
    }

    function useHotspotData() {
      const [data, setData] = useState(null)
      const [error, setError] = useState('')
      const [refreshing, setRefreshing] = useState(false)
      const reloadRef = useRef(async () => {})
      const requestedRef = useRef(false)

      useEffect(() => {
        let stopped = false
        let timer = null
        let controller = null
        const schedule = delay => {
          if (timer) clearTimeout(timer)
          if (!stopped) timer = setTimeout(tick, delay)
        }
        async function tick() {
          if (stopped) return
          controller?.abort()
          controller = new AbortController()
          try {
            const next = await getJson(`${API}/state`, { signal: controller.signal })
            if (stopped) return
            setData(next)
            setError('')
            const stale = Boolean(next.lastRefresh) && Date.now() - next.lastRefresh > 61 * 60 * 1000
            if ((!next.items?.length || stale) && !next.refreshing && !requestedRef.current) {
              requestedRef.current = true
              try {
                await getJson(`${API}/refresh`, { method: 'POST', signal: controller.signal })
                schedule(1_200)
              } catch {
                schedule(5_000)
              } finally {
                requestedRef.current = false
              }
              return
            }
            schedule(next.refreshing ? 1_600 : 30_000)
          } catch (cause) {
            if (stopped || cause?.name === 'AbortError') return
            setError(cause?.message ?? String(cause))
            schedule(8_000)
          }
        }
        reloadRef.current = tick
        void tick()
        const onVisibility = () => {
          if (document.visibilityState === 'visible') {
            if (timer) clearTimeout(timer)
            void tick()
          }
        }
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
          stopped = true
          controller?.abort()
          if (timer) clearTimeout(timer)
          document.removeEventListener('visibilitychange', onVisibility)
        }
      }, [])

      const refresh = useCallback(async () => {
        setRefreshing(true)
        try {
          await getJson(`${API}/refresh`, { method: 'POST' })
          await reloadRef.current()
        } catch (cause) {
          setError(cause?.message ?? String(cause))
        } finally {
          setRefreshing(false)
        }
      }, [])

      return { data, error, refreshing, refresh }
    }

    function useClock() {
      const [now, setNow] = useState(Date.now())
      useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 30_000)
        return () => clearInterval(timer)
      }, [])
      return now
    }

    function CategoryChip({ item }) {
      return h('span', { className: 'hs-chip' },
        h('span', { className: 'hs-chip-dot', 'aria-hidden': true }),
        item.categoryLabel)
    }

    function SearchBox({ query, setQuery }) {
      return h('div', { className: 'hs-search-wrap' },
        h(Glyph, { name: 'search', size: 15 }),
        h('input', {
          type: 'search',
          value: query,
          placeholder: '搜索标题、来源或关键词',
          'aria-label': '搜索热点',
          onChange: event => setQuery(event.target.value),
        }),
        query && h('button', {
          type: 'button', className: 'hs-search-clear', onClick: () => setQuery(''),
          'aria-label': '清空搜索',
        }, h(Glyph, { name: 'close', size: 13 })))
    }

    const CREATOR_TONE_LABELS = {
      high: '强',
      good: '较好',
      fair: '中等',
      low: '偏低',
    }

    function creatorTone(value) {
      const score = Number(value) || 0
      if (score >= 85) return 'high'
      if (score >= 70) return 'good'
      if (score >= 55) return 'fair'
      return 'low'
    }

    function CreatorChip({ item }) {
      const score = Math.max(0, Math.min(100, Number(item.creatorScore) || 0))
      const tone = creatorTone(score)
      const detail = `自媒体选题适配 ${score}/100（${CREATOR_TONE_LABELS[tone]}）${item.creatorReason ? ` · ${item.creatorReason}` : ''}（独立于新闻价值）`
      return h('span', {
        className: `hs-creator-chip hs-creator-tone--${tone}`,
        title: detail,
        'aria-label': detail,
      },
      h(Glyph, { name: 'pen', size: 10 }),
      h('span', null, '选题'),
      h('b', null, score))
    }

    function SourceMark({ title, size = 30 }) {
      return h('span', {
        className: 'hs-source-mark', style: { width: size, height: size, fontSize: size * 0.42 },
        'aria-hidden': true,
      }, firstChar(title))
    }

    function CopyLinkButton({ url, title }) {
      const [status, setStatus] = useState('idle')
      const timer = useRef(0)

      useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current)
      }, [])

      async function copy(event) {
        event.preventDefault()
        event.stopPropagation()
        try {
          if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
          await navigator.clipboard.writeText(url)
          setStatus('copied')
        } catch {
          setStatus('error')
        }
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setStatus('idle'), 1800)
      }

      const label = status === 'copied' ? '已复制链接' : status === 'error' ? '复制失败，请手动复制' : '复制文章链接'
      return h('button', {
        type: 'button',
        className: `hs-copy-button${status === 'copied' ? ' is-copied' : ''}${status === 'error' ? ' is-error' : ''}`,
        title: title ? `${label}：${title}` : label,
        'aria-label': title ? `${label}：${title}` : label,
        onClick: copy,
      },
      status === 'copied' ? h(Glyph, { name: 'check', size: 13 }) : h(Glyph, { name: 'copy', size: 13 }),
      h('span', { className: 'hs-sr-only', role: 'status' },
        status === 'copied' ? '链接已复制' : status === 'error' ? '复制失败' : ''))
    }

    function MetaLine({ item, now }) {
      return h('div', { className: 'hs-meta' },
        h('span', { className: 'hs-meta-source', title: item.sourceTitles?.join(' / ') || item.sourceTitle },
          SourceMark({ title: item.sourceTitle, size: 20 }),
          h('span', null, item.sourceTitle)),
        h('span', { className: 'hs-meta-sep', 'aria-hidden': true }, '·'),
        h('time', { dateTime: new Date(item.publishedAt || Date.now()).toISOString() }, formatRelative(item.publishedAt, now)),
        item.coverage > 1 && h('span', { className: 'hs-coverage' },
          h(Glyph, { name: 'layers', size: 12 }),
          `${item.coverage} 源`),
        h(CopyLinkButton, { url: item.url, title: item.title }))
    }

    function Reason({ item }) {
      return h('p', { className: 'hs-reason' },
        h(Glyph, { name: 'sparkles', size: 12 }),
        h('span', null, item.reason || '今日高信号资讯'))
    }

    function ArticleActions({
      item, pendingAction, busy, saved, known, compact = false,
      onRewrite, onToggleSaved, onToggleKnown,
    }) {
      const canRewrite = !isChineseArticle(item)
      const small = compact ? ' hs-action-button--small' : ''
      return h('div', { className: 'hs-actions' },
        h('a', {
          className: 'hs-source-link',
          href: item.url,
          target: '_blank',
          rel: 'noopener noreferrer',
          title: `在浏览器中打开 ${hostOf(item.url)}`,
        }, '访问来源', h(Glyph, { name: 'external', size: 13 })),
        h('div', { className: 'hs-action-cluster' },
          canRewrite && h('button', {
            type: 'button',
            className: `hs-rewrite-button${small}`,
            disabled: Boolean(busy),
            title: '保留原意，改写为简中互联网读者习惯的流畅文章',
            'aria-label': `网感转写：${item.title}`,
            onClick: () => onRewrite(item),
          },
          pendingAction === 'rewrite' ? h(Spinner) : h(Glyph, { name: 'pen', size: 13 }),
          pendingAction === 'rewrite' ? '转写中…' : '网感转写'),
          h('button', {
            type: 'button',
            className: `hs-star-button${saved ? ' is-active' : ''}${small}`,
            'aria-pressed': Boolean(saved),
            'aria-label': saved ? `取消收藏：${item.title}` : `收藏：${item.title}`,
            title: saved ? '取消收藏' : '收藏',
            onClick: () => onToggleSaved(item),
          }, h(StarIcon, { filled: Boolean(saved), size: compact ? 14 : 15 })),
          h('button', {
            type: 'button',
            className: `hs-known-button${known ? ' is-active' : ''}${small}`,
            'aria-pressed': Boolean(known),
            'aria-label': known ? `移出看过：${item.title}` : `标记已知晓：${item.title}`,
            title: known ? '移出看过' : '归档到看过',
            onClick: () => onToggleKnown(item),
          },
          h(Glyph, { name: 'check', size: 13 }),
          known ? '已看过' : '已知晓')))
    }

    function LeadCard({
      item, now, pendingAction, busy, saved, known,
      onRewrite, onToggleSaved, onToggleKnown,
    }) {
      const category = CATEGORY_MAP[item.category] ?? CATEGORY_MAP.tech
      return h('article', {
        className: 'hs-lead',
        style: { '--hs-cat': category.color },
        'aria-labelledby': `hs-lead-${item.id}`,
      },
      h('div', { className: 'hs-lead-main' },
        h('div', { className: 'hs-lead-top' },
          h(CategoryChip, { item }),
          item.aging && h('span', {
            className: 'hs-aging-chip',
            title: '超过 72 小时新鲜度窗口，仅用于补足 Top 30',
          }, '较早'),
          item.aiRanked && h('span', { className: 'hs-ai-badge' },
            h(Glyph, { name: 'sparkles', size: 11 }), 'AI 精排'),
          h('span', { className: 'hs-rank-tag' }, `TOP ${String(item.rank).padStart(2, '0')}`)),
        h('h2', { className: 'hs-lead-title', id: `hs-lead-${item.id}` }, item.title),
        item.summary && h('p', { className: 'hs-lead-summary' }, item.summary),
        h(Reason, { item }),
        h(MetaLine, { item, now }),
        h(ArticleActions, {
          item, pendingAction, busy, saved, known, onRewrite, onToggleSaved, onToggleKnown,
        })),
      h('aside', { className: 'hs-lead-side' },
        h('div', {
          className: 'hs-gauge',
          style: { '--hs-heat': `${Math.max(0, Math.min(100, item.heat))}%` },
          role: 'img',
          'aria-label': `综合信号强度 ${item.heat} 分，满分 100`,
        },
        h('div', { className: 'hs-gauge-inner' },
          h('strong', null, item.heat),
          h('span', null, 'SIGNAL'))),
        h('p', { className: 'hs-gauge-caption' }, '综合信号强度'),
        h('div', {
          className: `hs-creator-block hs-creator-tone--${creatorTone(item.creatorScore)}`,
          title: '独立于新闻价值，衡量该选题对中文自媒体、公众号与短视频的适配度',
        },
        h('div', { className: 'hs-creator-head' },
          h('span', null, '自媒体选题'),
          h('b', null, item.creatorScore ?? 0)),
        h('div', { className: 'hs-creator-track' },
          h('span', { style: { width: `${Math.max(0, Math.min(100, item.creatorScore ?? 0))}%` } })),
        h('p', { className: 'hs-creator-note' }, item.creatorReason || '独立于新闻价值')),
        h('div', { className: 'hs-side-rule' }),
        h('p', { className: 'hs-side-label' }, '信源覆盖'),
        h('p', { className: 'hs-side-value' }, item.coverage > 1 ? `${item.coverage} 个信源共同关注` : '单一高信号信源'),
        h('p', { className: 'hs-side-label' }, '发布时间'),
        h('p', { className: 'hs-side-value' }, formatClock(item.publishedAt)),
        h('p', { className: 'hs-side-host' }, hostOf(item.url))),
      h('span', { className: 'hs-lead-ghost', 'aria-hidden': true }, String(item.rank).padStart(2, '0')))
    }

    function NewsCard({
      item, now, pendingAction, busy, saved, known, index, hideRank = false,
      onRewrite, onToggleSaved, onToggleKnown,
    }) {
      const category = CATEGORY_MAP[item.category] ?? CATEGORY_MAP.tech
      return h('article', {
        className: 'hs-card',
        style: { '--hs-cat': category.color, animationDelay: `${Math.min(index * 22, 260)}ms` },
        'aria-labelledby': `hs-card-${item.id}`,
      },
      h('div', { className: 'hs-card-top' },
        h('div', { className: 'hs-card-id' },
          !hideRank && h('span', { className: 'hs-card-rank' }, String(item.rank).padStart(2, '0')),
          h(SourceMark, { title: item.sourceTitle, size: 28 })),
        h('div', { className: 'hs-card-badges' },
          item.aging && h('span', {
            className: 'hs-aging-chip',
            title: '超过 72 小时新鲜度窗口，仅用于补足 Top 30',
          }, '较早'),
          h(CategoryChip, { item }),
          h(CreatorChip, { item }))),
      h('h3', { className: 'hs-card-title', id: `hs-card-${item.id}` }, item.title),
      item.summary && h('p', { className: 'hs-card-summary' }, item.summary),
      h(Reason, { item }),
      h(MetaLine, { item, now }),
      h(ArticleActions, {
        item, pendingAction, busy, saved, known, compact: true,
        onRewrite, onToggleSaved, onToggleKnown,
      }))
    }

    function Skeleton() {
      return h('div', { className: 'hs-skeleton', 'aria-busy': 'true', 'aria-label': '正在读取热点' },
        h('div', { className: 'hs-skeleton-lead hs-shimmer' }),
        h('div', { className: 'hs-skeleton-grid' },
          Array.from({ length: 6 }, (_, index) => h('div', {
            key: index, className: 'hs-skeleton-card hs-shimmer', style: { animationDelay: `${index * 80}ms` },
          }))))
    }

    function EmptyState({ error, scanning, onRefresh }) {
      return h('div', { className: 'hs-empty', role: error ? 'alert' : 'status' },
        h('span', { className: 'hs-empty-icon' }, h(Glyph, { name: error ? 'alert' : 'inbox', size: 24 })),
        h('h2', null, error ? '暂时无法读取热点' : scanning ? '正在建立今日榜单' : '今天的信号还在路上'),
        h('p', null, error
          ? error
          : scanning
            ? '正在并发扫描全部精选信源、去重并计算价值排序，首批结果会在片刻后出现。'
            : '还没有可展示的资讯。可以立即扫描一次，或稍后回来看看。'),
        h('button', {
          type: 'button', className: 'hs-primary-button', onClick: onRefresh, disabled: scanning,
        },
        scanning ? h(Spinner) : h(Glyph, { name: 'refresh', size: 14 }),
        scanning ? '正在扫描…' : '立即扫描'))
    }

    function ShelfEmpty({ kind, hasQuery, onBack, onClear }) {
      const saved = kind === 'saved'
      return h('div', { className: 'hs-empty', role: 'status' },
        h('span', { className: 'hs-empty-icon' },
          h(Glyph, { name: hasQuery ? 'search' : saved ? 'star' : 'check', size: 24 })),
        h('h2', null, hasQuery ? '没有找到匹配文章' : saved ? '还没有收藏' : '还没有看过记录'),
        h('p', null, hasQuery
          ? '换个关键词试试，或返回全部内容。'
          : saved
            ? '在卡片上点亮星标，之后可以在这里回看，不受 Top 30 刷新影响。'
            : '点击卡片上的「已知晓」归档文章，之后可以在这里回看。'),
        h('button', {
          type: 'button', className: 'hs-primary-button',
          onClick: hasQuery ? onClear : onBack,
        }, hasQuery ? '清空搜索' : '返回 Top 30'))
    }

    function AllKnownEmpty({ onOpenKnown }) {
      return h('div', { className: 'hs-empty', role: 'status' },
        h('span', { className: 'hs-empty-icon' }, h(Glyph, { name: 'check', size: 24 })),
        h('h2', null, '本轮 Top 30 都已看过'),
        h('p', null, '已归档的文章都保存在「看过」里，不会因为榜单刷新而消失。'),
        h('button', { type: 'button', className: 'hs-primary-button', onClick: onOpenKnown }, '打开看过'))
    }

    function HotspotPage(face) {
      const { data, error, refreshing, refresh } = useHotspotData()
      const { known, saved, toggleKnown, toggleSaved } = useCollections()
      const now = useClock()
      const [view, setView] = useState('briefing')
      const [tab, setTab] = useState('all')
      const [query, setQuery] = useState('')
      const [rewritePending, setRewritePending] = useState('')
      const [notice, setNotice] = useState(null)
      const tabRefs = useRef([])

      const items = data?.items ?? []
      const categories = useMemo(() => {
        const listed = data?.categories?.length ? data.categories : CATEGORIES.map(category => ({ ...category, count: 0 }))
        return listed.filter(category => category.id === 'all' || category.count > 0)
      }, [data])

      const briefingItems = useMemo(() => items.filter(item => !known[item.id]), [items, known])
      const knownEntries = useMemo(() => Object.values(known).sort((a, b) => (b.at || 0) - (a.at || 0)), [known])
      const savedEntries = useMemo(() => Object.values(saved).sort((a, b) => (b.at || 0) - (a.at || 0)), [saved])
      const collectionMode = view !== 'briefing'
      const shelfName = view === 'known' ? '看过' : '收藏'
      const baseItems = collectionMode
        ? (view === 'known' ? knownEntries : savedEntries).map(entry => entry.item)
        : briefingItems

      useEffect(() => {
        if (tab !== 'all' && !categories.some(category => category.id === tab)) setTab('all')
      }, [categories, tab])

      useEffect(() => {
        if (!notice) return
        const timer = setTimeout(() => setNotice(null), notice.kind === 'error' ? 8_000 : 5_500)
        return () => clearTimeout(timer)
      }, [notice])

      const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase()
        return baseItems.filter(item => {
          if (!collectionMode && tab !== 'all' && item.category !== tab) return false
          if (!needle) return true
          return `${item.title} ${item.summary} ${item.sourceTitle} ${item.reason} ${item.creatorReason}`.toLowerCase().includes(needle)
        })
      }, [baseItems, collectionMode, tab, query])

      function openShelf(next) {
        setView(current => current === next ? 'briefing' : next)
        setQuery('')
      }

      function backToBriefing() {
        setView('briefing')
        setQuery('')
      }

      function handleKnown(item) {
        const wasKnown = Boolean(known[item.id])
        toggleKnown(item)
        setNotice({ kind: 'success', text: wasKnown ? '已移出「看过」' : '已归档到「看过」' })
      }

      function handleSaved(item) {
        const wasSaved = Boolean(saved[item.id])
        toggleSaved(item)
        setNotice({ kind: 'success', text: wasSaved ? '已取消收藏' : '已加入「收藏」' })
      }

      async function rewrite(item) {
        if (rewritePending) return
        if (isChineseArticle(item)) {
          setNotice({ kind: 'error', text: '原文已经是中文，不需要转写。' })
          return
        }
        setRewritePending(item.id)
        setNotice(null)
        try {
          let article = null
          try {
            article = await getJson(`${API}/article?id=${encodeURIComponent(item.id)}`)
          } catch (cause) {
            article = { ok: false, content: item.summary, fallback: true }
            console.warn('[dsh-hotspot] article extraction failed:', cause)
          }
          const workspace = await face.workspaces.initializeDefault()
          if (!workspace) throw new Error('当前配置没有可用的默认工作区')
          const sessionId = `session-hotspot-rewrite-${item.id}-${Date.now().toString(36)}`
          await face.sessions.create({ workspaceId: workspace.workspaceId, sessionId })
          const prompt = buildRewritePrompt(item, article)
          await face.sessions.using(sessionId, { source: 'controllerOperation' }, async reference => {
            const result = await reference.binding.session.prompt(
              [{ type: 'text', text: prompt }],
              'queue',
              undefined,
              `hotspot-rewrite-${item.id}-${Date.now().toString(36)}`,
            )
            if (!result.ok) throw new Error(result.error?.message ?? '消息没有被会话接受')
            try {
              const renamed = await reference.binding.session.rename(`热点转写｜${truncate(item.title, 34)}`)
              if (!renamed.ok) console.warn('[dsh-hotspot] session rename failed:', renamed.error)
            } catch (cause) {
              console.warn('[dsh-hotspot] session rename failed:', cause)
            }
          })
          setNotice({ kind: 'success', text: '网感转写已在后台开始，稍后从左侧会话列表打开即可。' })
        } catch (cause) {
          setNotice({
            kind: 'error',
            text: `发送失败：${cause?.message ?? String(cause)}`,
          })
        } finally {
          setRewritePending('')
        }
      }

      function onTabKeyDown(event, index) {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') return
        event.preventDefault()
        const next = event.key === 'ArrowRight'
          ? (index + 1) % categories.length
          : event.key === 'ArrowLeft'
            ? (index - 1 + categories.length) % categories.length
            : event.key === 'Home' ? 0 : categories.length - 1
        setTab(categories[next].id)
        tabRefs.current[next]?.focus()
      }

      const stats = data?.stats ?? {}
      const progress = data?.progress ?? {}
      const scanning = Boolean(data?.refreshing) || refreshing
      const progressPercent = progress.total ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0
      const showSkeleton = !data && !error
      const allKnown = !collectionMode && !query.trim() && items.length > 0 && briefingItems.length === 0

      return h('section', { className: 'hs-page', 'aria-labelledby': 'hs-heading' },
        h('style', null, styles),
        h('div', { className: 'hs-shell' },
          h('header', { className: 'hs-hero' },
            h('div', { className: 'hs-topline' },
              h('div', { className: 'hs-wordmark' },
                h(HotspotIcon, { size: 16 }),
                h('span', null, 'SIGNAL DESK'),
                h('span', { className: `hs-live ${scanning ? 'hs-live--on' : ''}` },
                  h('span', null), scanning ? 'LIVE SCAN' : 'DAILY BRIEF')),
              h('div', { className: 'hs-controls' },
                h('span', { className: 'hs-updated' }, data?.lastRefresh ? `最近更新 ${formatRelative(data.lastRefresh, now)}` : '尚未更新'),
                data?.aiRanked && h('span', { className: 'hs-ai-mode' },
                  h(Glyph, { name: 'sparkles', size: 11 }), 'AI 精排'),
                h('button', {
                  type: 'button',
                  className: 'hs-refresh',
                  onClick: refresh,
                  disabled: scanning,
                  'aria-label': scanning ? '正在刷新热点' : '立即刷新热点',
                },
                h(Glyph, { name: 'refresh', size: 15 }),
                scanning ? '扫描中' : '立即刷新'))),
            h('div', { className: 'hs-title-row' },
              h('div', { className: 'hs-title-copy' },
                h('p', { className: 'hs-kicker' }, formatDateLine(now), h('span', { 'aria-hidden': true }, ' / '), '每日情报简报'),
                h('h1', { id: 'hs-heading' }, '热点', h('sup', null, '30')),
                h('p', { className: 'hs-lede' },
                  '从 ', h('strong', null, formatCount(stats.sourceCount || data?.sources?.count || 274)),
                  ' 个精选 RSS 信源中，筛出此刻最值得知道的 30 条资讯。科技与 AI 优先，不设行业边界。')),
              h('div', { className: 'hs-overview' },
                h('div', { className: 'hs-stats', 'aria-label': '热点概览' },
                  h('div', { className: 'hs-stat' },
                    h('b', null, formatCount(stats.candidates || stats.articles || 0)),
                    h('span', null, '本轮候选')),
                  h('div', { className: 'hs-stat' },
                    h('b', null, formatCount(stats.sourcesScanned ?? 0)),
                    h('span', null, '已扫描信源')),
                  h('div', { className: 'hs-stat hs-stat--accent' },
                    h('b', null, formatCount(items.length)),
                    h('span', null, '今日精选'))),
                h('div', { className: 'hs-shelves', 'aria-label': '我的资讯' },
                  h('button', {
                    type: 'button',
                    className: `hs-shelf${view === 'known' ? ' is-active' : ''}`,
                    'aria-pressed': view === 'known',
                    onClick: () => openShelf('known'),
                  },
                  h(Glyph, { name: 'check', size: 12 }),
                  h('span', null, '看过'),
                  h('b', null, knownEntries.length)),
                  h('button', {
                    type: 'button',
                    className: `hs-shelf${view === 'saved' ? ' is-active' : ''}`,
                    'aria-pressed': view === 'saved',
                    onClick: () => openShelf('saved'),
                  },
                  h(StarIcon, { filled: view === 'saved', size: 12 }),
                  h('span', null, '收藏'),
                  h('b', null, savedEntries.length))))),
            scanning && h('div', { className: 'hs-progress', role: 'status', 'aria-live': 'polite' },
              h('div', { className: 'hs-progress-head' },
                h('span', null, progress.message || '正在扫描信源…'),
                h('b', null, progress.stage === 'ranking' ? 'AI RANKING' : `${progressPercent}%`)),
              h('div', { className: `hs-progress-track ${progress.stage === 'ranking' ? 'hs-progress-track--rank' : ''}` },
                h('span', { style: { width: `${progress.stage === 'ranking' ? 100 : progressPercent}%` } }))),
            data?.lastError && data?.stats?.sourcesFailed > 0 && !scanning && h('p', { className: 'hs-degraded' },
              h(Glyph, { name: 'alert', size: 12 }),
              `${data.stats.sourcesFailed} 个信源本轮未能访问，榜单由其余信源生成。`),
            data?.llmError && !scanning && h('p', { className: 'hs-degraded hs-degraded--llm' },
              h(Glyph, { name: 'sparkles', size: 12 }),
              'AI 精排本轮不可用，已使用本地信号模型排序。')),

          collectionMode
            ? h('div', { className: 'hs-toolbar hs-toolbar--shelf' },
              h('div', { className: 'hs-shelf-heading' },
                h('button', {
                  type: 'button',
                  className: 'hs-back-button',
                  onClick: backToBriefing,
                }, h(Glyph, { name: 'back', size: 13 }), '返回 Top 30'),
                h('div', { className: 'hs-shelf-title' },
                  h('h2', null, shelfName),
                  h('span', null, `${filtered.length} 篇`))),
              h(SearchBox, { query, setQuery }))
            : h('div', { className: 'hs-toolbar' },
              h('div', { className: 'hs-tabbar', role: 'tablist', 'aria-label': '热点分类' },
                categories.map((category, index) => h('button', {
                  key: category.id,
                  ref: node => { tabRefs.current[index] = node },
                  type: 'button',
                  role: 'tab',
                  id: `hs-tab-${category.id}`,
                  'aria-selected': tab === category.id,
                  'aria-controls': 'hs-feed',
                  tabIndex: tab === category.id ? 0 : -1,
                  className: 'hs-tab',
                  onClick: () => setTab(category.id),
                  onKeyDown: event => onTabKeyDown(event, index),
                },
                category.label,
                h('span', { 'aria-hidden': true }, category.count ?? 0)))),
              h(SearchBox, { query, setQuery })),

          showSkeleton && !collectionMode
            ? h(Skeleton)
            : !data && error && !collectionMode
              ? h(EmptyState, { error, scanning: false, onRefresh: refresh })
              : collectionMode
                ? (filtered.length > 0
                  ? h('div', { className: 'hs-feed hs-feed--collection', id: 'hs-feed', role: 'region', 'aria-label': shelfName },
                    h('div', { className: 'hs-grid' },
                      filtered.map((item, index) => h(NewsCard, {
                        key: item.id, item, now, index, hideRank: true,
                        pendingAction: rewritePending === item.id ? 'rewrite' : '',
                        busy: Boolean(rewritePending),
                        saved: Boolean(saved[item.id]),
                        known: Boolean(known[item.id]),
                        onRewrite: rewrite,
                        onToggleSaved: handleSaved,
                        onToggleKnown: handleKnown,
                      }))))
                  : h(ShelfEmpty, {
                    kind: view,
                    hasQuery: Boolean(query.trim()),
                    onBack: backToBriefing,
                    onClear: () => setQuery(''),
                  }))
                : allKnown
                  ? h(AllKnownEmpty, {
                    onOpenKnown: () => {
                      setView('known')
                      setQuery('')
                    },
                  })
                  : h('div', { className: 'hs-feed', id: 'hs-feed', role: 'tabpanel', 'aria-labelledby': `hs-tab-${tab}` },
                    filtered.length > 0 && h(LeadCard, {
                      item: filtered[0],
                      now,
                      pendingAction: rewritePending === filtered[0].id ? 'rewrite' : '',
                      busy: Boolean(rewritePending),
                      saved: Boolean(saved[filtered[0].id]),
                      known: Boolean(known[filtered[0].id]),
                      onRewrite: rewrite,
                      onToggleSaved: handleSaved,
                      onToggleKnown: handleKnown,
                    }),
                    filtered.length > 1 && h('div', { className: 'hs-grid' },
                      filtered.slice(1).map((item, index) => h(NewsCard, {
                        key: item.id, item, now, index,
                        pendingAction: rewritePending === item.id ? 'rewrite' : '',
                        busy: Boolean(rewritePending),
                        saved: Boolean(saved[item.id]),
                        known: Boolean(known[item.id]),
                        onRewrite: rewrite,
                        onToggleSaved: handleSaved,
                        onToggleKnown: handleKnown,
                      }))),
                    filtered.length === 0 && (query.trim()
                      ? h(ShelfEmpty, {
                        kind: 'briefing',
                        hasQuery: true,
                        onBack: backToBriefing,
                        onClear: () => setQuery(''),
                      })
                      : h(EmptyState, { error: '', scanning, onRefresh: refresh }))),

          error && data && h('div', { className: 'hs-inline-error', role: 'alert' },
            h(Glyph, { name: 'alert', size: 14 }), `更新遇到问题：${error}`),

          h('footer', { className: 'hs-footer' },
            h('span', null, '信号来自 ',
              h('a', { href: 'https://github.com/fuxiaoai/tidings-rss', target: '_blank', rel: 'noopener noreferrer' }, 'Tidings RSS'),
              ` · ${data?.rankingWindowHours || 72} 小时新鲜度窗口 · 本机扫描，不上传阅读记录`),
            h('span', null, scanning
              ? '正在更新本轮榜单'
              : data?.nextRefreshAt ? `下次自动扫描：${countdown(data.nextRefreshAt, now)}` : '每小时自动扫描'))),

        notice && h('div', {
          className: `hs-toast hs-toast--${notice.kind}`,
          role: notice.kind === 'error' ? 'alert' : 'status',
        },
        h(Glyph, { name: notice.kind === 'error' ? 'alert' : 'check', size: 15 }),
        h('span', null, notice.text),
        h('button', { type: 'button', 'aria-label': '关闭提示', onClick: () => setNotice(null) },
          h(Glyph, { name: 'close', size: 13 }))))
    }

    const styles = `
      .hs-page {
        --hs-ink:var(--dsw-alias-label-primary, CanvasText);
        --hs-muted:var(--dsw-alias-label-secondary, GrayText);
        --hs-bg:var(--dsw-alias-bg-base, Canvas);
        --hs-surface:var(--dsw-alias-bg-layer-1, Canvas);
        --hs-surface-2:var(--dsw-alias-bg-layer-2, Canvas);
        --hs-overlay:var(--dsw-alias-bg-overlay, Canvas);
        --hs-line:var(--dsw-alias-border-l1, color-mix(in srgb, var(--hs-ink) 12%, transparent));
        --hs-line-strong:var(--dsw-alias-border-l2, color-mix(in srgb, var(--hs-ink) 20%, transparent));
        --hs-brand:var(--dsw-alias-brand-primary, #3b6fe0);
        --hs-error:var(--dsw-alias-state-error-primary, #b13b3b);
        --hs-success:var(--dsw-alias-state-success-primary, #2d7b50);
        --hs-warn:var(--dsw-alias-state-warn-primary, #9b6b18);
        --hs-hover:color-mix(in srgb, var(--hs-ink) 5%, transparent);
        --hs-soft:color-mix(in srgb, var(--hs-ink) 3.5%, transparent);
        --hs-serif:"Iowan Old Style","Palatino Linotype","Songti SC","Noto Serif SC",Georgia,"Times New Roman",serif;
        --hs-sans:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
        position:relative; box-sizing:border-box; height:100%; min-height:0; overflow:auto;
        color:var(--hs-ink); font-family:var(--hs-sans); font-size:14px; line-height:1.55;
        background:
          radial-gradient(940px 460px at 93% -10%, color-mix(in srgb, var(--hs-brand) 11%, transparent), transparent 68%),
          radial-gradient(680px 380px at -8% 16%, color-mix(in srgb, var(--hs-success) 6%, transparent), transparent 70%),
          var(--hs-bg);
        scrollbar-color:color-mix(in srgb, var(--hs-ink) 22%, transparent) transparent;
      }
      .hs-page *, .hs-page *::before, .hs-page *::after { box-sizing:border-box; }
      .hs-page button, .hs-page input { font:inherit; color:inherit; }
      .hs-page button { cursor:pointer; }
      .hs-page button:disabled { cursor:default; }
      .hs-page a { color:inherit; }
      .hs-page :focus-visible { outline:2px solid var(--hs-brand); outline-offset:2px; }
      .hs-shell { width:100%; max-width:1240px; margin:0 auto; padding:clamp(26px, 4.0vw, 50px) clamp(18px, 4.5vw, 52px) 66px; }
      .hs-hero { position:relative; }
      .hs-topline { display:flex; align-items:center; justify-content:space-between; gap:18px; flex-wrap:wrap; }
      .hs-wordmark { display:flex; align-items:center; gap:9px; color:var(--hs-muted); font-size:11px; font-weight:680; letter-spacing:.16em; }
      .hs-wordmark svg { color:var(--hs-brand); }
      .hs-live { display:inline-flex; align-items:center; gap:6px; margin-left:6px; padding-left:12px; border-left:1px solid var(--hs-line); font-size:9.5px; letter-spacing:.12em; color:color-mix(in srgb, var(--hs-muted) 72%, transparent); }
      .hs-live > span { width:5px; height:5px; border-radius:50%; background:var(--hs-muted); opacity:.55; }
      .hs-live--on { color:var(--hs-success); }
      .hs-live--on > span { background:var(--hs-success); opacity:1; animation:hs-pulse 1.8s ease-out infinite; }
      .hs-controls { display:flex; align-items:center; gap:16px; }
      .hs-updated { color:var(--hs-muted); font-size:11.5px; font-variant-numeric:tabular-nums; }
      .hs-ai-mode { display:inline-flex; align-items:center; gap:4px; color:var(--hs-brand); font-size:9.5px; font-weight:680; letter-spacing:.08em; white-space:nowrap; }
      .hs-refresh { display:inline-flex; align-items:center; gap:7px; min-height:36px; padding:0 13px; border:1px solid var(--hs-line); border-radius:999px; background:var(--hs-surface); font-size:12px; font-weight:600; box-shadow:0 1px 2px color-mix(in srgb, var(--hs-ink) 5%, transparent); transition:background-color .18s ease, border-color .18s ease, transform .18s ease; }
      .hs-refresh:hover:not(:disabled) { border-color:color-mix(in srgb, var(--hs-brand) 45%, var(--hs-line)); transform:translateY(-1px); }
      .hs-refresh:disabled { opacity:.62; }
      .hs-refresh:disabled svg { animation:hs-rotate 1.1s linear infinite; }
      .hs-title-row { display:grid; grid-template-columns:minmax(0, 1fr) auto; align-items:end; gap:38px; margin-top:30px; }
      .hs-title-copy { min-width:0; }
      .hs-kicker { display:flex; align-items:center; gap:9px; margin:0 0 8px; color:var(--hs-muted); font-size:10.5px; font-weight:620; letter-spacing:.12em; text-transform:uppercase; }
      .hs-kicker span { color:color-mix(in srgb, var(--hs-muted) 55%, transparent); }
      .hs-page h1 { display:flex; align-items:flex-start; gap:10px; margin:0; font-family:var(--hs-serif); font-size:clamp(50px, 7.2vw, 84px); line-height:.92; font-weight:600; letter-spacing:-.055em; }
      .hs-page h1 sup { margin-top:10px; padding:3px 7px; border:1px solid color-mix(in srgb, var(--hs-brand) 28%, var(--hs-line)); border-radius:999px; color:var(--hs-brand); font-family:var(--hs-sans); font-size:11px; line-height:1.2; font-weight:700; letter-spacing:0; }
      .hs-lede { max-width:620px; margin:17px 0 0; color:var(--hs-muted); font-size:14px; line-height:1.8; text-wrap:pretty; }
      .hs-lede strong { color:var(--hs-ink); font-weight:650; }
      .hs-overview { display:flex; flex-direction:column; align-items:stretch; gap:12px; }
      .hs-stats { display:grid; grid-template-columns:repeat(3, minmax(74px, auto)); border-top:1px solid var(--hs-line-strong); }
      .hs-stat { display:flex; flex-direction:column; gap:4px; padding:17px 16px 2px; border-right:1px solid var(--hs-line); }
      .hs-stat:first-child { padding-left:0; }
      .hs-stat:last-child { padding-right:0; border-right:0; }
      .hs-stat b { font-family:var(--hs-serif); font-size:28px; line-height:1; font-weight:600; letter-spacing:-.035em; font-variant-numeric:tabular-nums; white-space:nowrap; }
      .hs-stat span { color:var(--hs-muted); font-size:10px; font-weight:620; letter-spacing:.05em; white-space:nowrap; }
      .hs-stat--accent b { color:var(--hs-brand); }
      .hs-shelves { display:flex; align-items:center; justify-content:flex-end; gap:6px; }
      .hs-shelf { display:inline-flex; align-items:center; gap:5px; min-height:30px; padding:0 9px; border:1px solid var(--hs-line); border-radius:999px; background:color-mix(in srgb, var(--hs-surface) 58%, transparent); color:var(--hs-muted); font-size:10.5px; font-weight:600; white-space:nowrap; transition:background-color .16s ease, color .16s ease, border-color .16s ease; }
      .hs-shelf b { min-width:15px; padding:1px 4px; border-radius:999px; color:inherit; background:color-mix(in srgb, currentColor 8%, transparent); font-size:9px; font-variant-numeric:tabular-nums; text-align:center; }
      .hs-shelf:hover { color:var(--hs-ink); background:var(--hs-hover); }
      .hs-shelf.is-active { color:var(--hs-ink); border-color:color-mix(in srgb, var(--hs-brand) 26%, var(--hs-line)); background:var(--hs-surface); box-shadow:0 1px 4px color-mix(in srgb, var(--hs-ink) 6%, transparent); }
      .hs-shelf.is-active svg { color:var(--hs-brand); }
      .hs-progress { margin-top:27px; padding:13px 15px; border:1px solid var(--hs-line); border-radius:13px; background:color-mix(in srgb, var(--hs-surface) 74%, transparent); }
      .hs-progress-head { display:flex; justify-content:space-between; align-items:center; gap:14px; margin-bottom:8px; color:var(--hs-muted); font-size:11.5px; }
      .hs-progress-head span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .hs-progress-head b { flex:none; color:var(--hs-brand); font-size:9.5px; letter-spacing:.08em; font-variant-numeric:tabular-nums; }
      .hs-progress-track { height:3px; overflow:hidden; border-radius:99px; background:var(--hs-soft); }
      .hs-progress-track span { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg, var(--hs-brand), color-mix(in srgb, var(--hs-brand) 48%, var(--hs-success))); transition:width .4s ease; }
      .hs-progress-track--rank span { background-size:180% 100%; animation:hs-shimmer-bar 1.4s linear infinite; background-image:linear-gradient(90deg, color-mix(in srgb, var(--hs-brand) 25%, transparent), var(--hs-brand), color-mix(in srgb, var(--hs-brand) 25%, transparent)); }
      .hs-degraded { display:flex; align-items:center; gap:6px; margin:12px 0 0; color:var(--hs-warn); font-size:11px; }
      .hs-degraded--llm { color:var(--hs-muted); }
      .hs-toolbar { position:sticky; top:0; z-index:6; display:flex; align-items:center; justify-content:space-between; gap:18px; margin:32px -10px 20px; padding:11px 10px; background:color-mix(in srgb, var(--hs-bg) 86%, transparent); backdrop-filter:blur(18px) saturate(1.4); border-bottom:1px solid color-mix(in srgb, var(--hs-line) 82%, transparent); }
      .hs-toolbar--shelf { align-items:center; }
      .hs-shelf-heading { display:flex; align-items:center; gap:14px; min-width:0; }
      .hs-back-button { display:inline-flex; align-items:center; gap:5px; flex:none; min-height:30px; padding:0 9px; border:1px solid var(--hs-line); border-radius:999px; background:transparent; color:var(--hs-muted); font-size:10.5px; font-weight:600; white-space:nowrap; transition:color .16s ease, background-color .16s ease; }
      .hs-back-button:hover { color:var(--hs-ink); background:var(--hs-hover); }
      .hs-shelf-title { display:flex; align-items:baseline; gap:8px; min-width:0; }
      .hs-shelf-title h2 { margin:0; font-family:var(--hs-serif); font-size:21px; line-height:1.1; font-weight:600; letter-spacing:-.03em; white-space:nowrap; }
      .hs-shelf-title span { color:var(--hs-muted); font-size:10px; font-variant-numeric:tabular-nums; white-space:nowrap; }
      .hs-tabbar { display:flex; align-items:center; gap:3px; min-width:0; overflow-x:auto; scrollbar-width:none; }
      .hs-tabbar::-webkit-scrollbar { display:none; }
      .hs-tab { display:inline-flex; align-items:center; gap:6px; flex:none; min-height:32px; padding:0 11px; border:1px solid transparent; border-radius:999px; background:transparent; color:var(--hs-muted); font-size:12px; font-weight:580; white-space:nowrap; transition:background-color .16s ease, color .16s ease, border-color .16s ease; }
      .hs-tab > span { min-width:16px; padding:1px 4px; border-radius:999px; color:inherit; font-size:9.5px; font-variant-numeric:tabular-nums; text-align:center; background:color-mix(in srgb, currentColor 8%, transparent); opacity:.72; }
      .hs-tab:hover { color:var(--hs-ink); background:var(--hs-hover); }
      .hs-tab[aria-selected=true] { color:var(--hs-ink); background:var(--hs-surface); border-color:var(--hs-line); box-shadow:0 1px 4px color-mix(in srgb, var(--hs-ink) 7%, transparent); }
      .hs-tab[aria-selected=true] > span { color:var(--hs-brand); background:color-mix(in srgb, var(--hs-brand) 10%, transparent); opacity:1; }
      .hs-search-wrap { display:flex; align-items:center; gap:7px; flex:0 1 238px; min-width:180px; height:34px; padding:0 10px; border:1px solid var(--hs-line); border-radius:10px; background:color-mix(in srgb, var(--hs-surface) 74%, transparent); color:var(--hs-muted); transition:border-color .16s ease, background-color .16s ease; }
      .hs-search-wrap:focus-within { border-color:color-mix(in srgb, var(--hs-brand) 48%, var(--hs-line)); background:var(--hs-surface); }
      .hs-search-wrap input { width:100%; height:100%; border:0; outline:0; background:transparent; color:var(--hs-ink); font-size:12px; }
      .hs-search-wrap input::placeholder { color:color-mix(in srgb, var(--hs-muted) 74%, transparent); }
      .hs-search-wrap input::-webkit-search-cancel-button { display:none; }
      .hs-search-clear { display:grid; place-items:center; width:20px; height:20px; flex:none; padding:0; border:0; border-radius:50%; background:var(--hs-hover); color:var(--hs-muted); }
      .hs-feed { outline:0; }
      .hs-lead { position:relative; display:grid; grid-template-columns:minmax(0, 1fr) 214px; gap:34px; overflow:hidden; padding:clamp(24px, 3.7vw, 42px); border:1px solid color-mix(in srgb, var(--hs-cat) 21%, var(--hs-line)); border-radius:26px; background:linear-gradient(132deg, color-mix(in srgb, var(--hs-cat) 9%, var(--hs-surface)) 0%, var(--hs-surface) 56%, var(--hs-surface) 100%); box-shadow:0 26px 64px -54px color-mix(in srgb, var(--hs-cat) 38%, transparent), 0 1px 0 color-mix(in srgb, #fff 8%, transparent) inset; animation:hs-rise .5s cubic-bezier(.2,.7,.2,1) both; }
      .hs-lead::before { content:""; position:absolute; inset:0 auto 0 0; width:3px; background:linear-gradient(180deg, var(--hs-cat), color-mix(in srgb, var(--hs-cat) 16%, transparent)); }
      .hs-lead-main { position:relative; z-index:1; min-width:0; }
      .hs-lead-top { display:flex; align-items:center; gap:9px; flex-wrap:wrap; }
      .hs-chip { display:inline-flex; align-items:center; gap:6px; min-height:24px; padding:0 9px; border:1px solid color-mix(in srgb, var(--hs-cat) 24%, var(--hs-line)); border-radius:999px; color:var(--hs-cat); background:color-mix(in srgb, var(--hs-cat) 7%, transparent); font-size:10.5px; font-weight:680; letter-spacing:.02em; white-space:nowrap; }
      .hs-chip-dot { width:4.5px; height:4.5px; border-radius:50%; background:currentColor; }
      .hs-ai-badge { display:inline-flex; align-items:center; gap:4px; color:var(--hs-brand); font-size:9.5px; font-weight:680; letter-spacing:.08em; }
      .hs-aging-chip { display:inline-flex; align-items:center; min-height:24px; padding:0 8px; border:1px solid color-mix(in srgb, var(--hs-warn) 28%, var(--hs-line)); border-radius:999px; background:color-mix(in srgb, var(--hs-warn) 7%, transparent); color:var(--hs-warn); font-size:9.5px; font-weight:650; white-space:nowrap; }
      .hs-rank-tag { margin-left:auto; color:var(--hs-muted); font-size:9.5px; font-weight:680; letter-spacing:.13em; }
      .hs-page h2.hs-lead-title, .hs-lead-title { max-width:900px; margin:21px 0 0; font-family:var(--hs-serif); font-size:clamp(27px, 3.25vw, 40px); line-height:1.22; font-weight:600; letter-spacing:-.032em; text-wrap:balance; }
      .hs-lead-summary { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:4; overflow:hidden; max-width:800px; margin:17px 0 0; color:var(--hs-muted); font-size:13.5px; line-height:1.85; white-space:pre-line; }
      .hs-reason { display:flex; align-items:flex-start; gap:6px; margin:16px 0 0; color:var(--hs-cat); font-size:11.5px; font-weight:570; line-height:1.55; }
      .hs-reason svg { flex:none; margin-top:2px; }
      .hs-meta { display:flex; align-items:center; gap:7px; flex-wrap:wrap; margin-top:14px; color:var(--hs-muted); font-size:10.5px; }
      .hs-meta-source { display:inline-flex; align-items:center; gap:7px; min-width:0; }
      .hs-meta-source > span:last-child { overflow:hidden; max-width:280px; text-overflow:ellipsis; white-space:nowrap; }
      .hs-meta-sep { opacity:.38; }
      .hs-coverage { display:inline-flex; align-items:center; gap:4px; margin-left:3px; padding:2px 7px; border-radius:999px; background:color-mix(in srgb, var(--hs-cat) 8%, transparent); color:var(--hs-cat); font-size:9.5px; font-weight:620; }
      .hs-copy-button { display:inline-grid; place-items:center; flex:none; width:24px; height:24px; margin:-2px 0 -2px 1px; padding:0; border:0; border-radius:6px; background:transparent; opacity:.75; transition:color .16s ease, background-color .16s ease, opacity .16s ease; }
      .hs-page button.hs-copy-button { color:var(--hs-muted); }
      .hs-page button.hs-copy-button:hover { color:var(--hs-ink); background:var(--hs-hover); opacity:1; }
      .hs-page button.hs-copy-button.is-copied { color:var(--hs-success); background:color-mix(in srgb, var(--hs-success) 9%, transparent); opacity:1; }
      .hs-page button.hs-copy-button.is-error { color:var(--hs-error); background:color-mix(in srgb, var(--hs-error) 8%, transparent); opacity:1; }
      .hs-sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0; }
      .hs-source-mark { display:inline-grid; place-items:center; flex:none; border-radius:50%; background:color-mix(in srgb, var(--hs-cat) 10%, var(--hs-surface-2)); color:var(--hs-cat); font-family:var(--hs-serif); font-weight:650; line-height:1; }
      .hs-actions { display:flex; align-items:center; justify-content:space-between; gap:14px; margin-top:23px; padding-top:18px; border-top:1px solid color-mix(in srgb, var(--hs-line) 76%, transparent); }
      .hs-action-cluster { display:flex; align-items:center; justify-content:flex-end; gap:6px; flex-wrap:wrap; }
      .hs-source-link { display:inline-flex; align-items:center; gap:6px; color:var(--hs-muted); font-size:11.5px; font-weight:570; text-decoration:none; transition:color .16s ease; }
      .hs-source-link:hover { color:var(--hs-ink); }
      .hs-rewrite-button { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:38px; padding:0 13px; border:1px solid var(--hs-line-strong); border-radius:999px; background:transparent; font-size:11px; font-weight:600; white-space:nowrap; transition:color .16s ease, border-color .16s ease, background-color .16s ease, transform .16s ease, opacity .16s ease; }
      .hs-page button.hs-rewrite-button { color:var(--hs-muted); }
      .hs-rewrite-button:hover:not(:disabled) { color:var(--hs-ink); border-color:color-mix(in srgb, var(--hs-brand) 42%, var(--hs-line-strong)); background:var(--hs-hover); transform:translateY(-1px); }
      .hs-rewrite-button:disabled { opacity:.55; }
      .hs-star-button { display:inline-grid; place-items:center; flex:none; width:38px; height:38px; padding:0; border:1px solid var(--hs-line-strong); border-radius:50%; background:transparent; color:var(--hs-muted); transition:color .16s ease, border-color .16s ease, background-color .16s ease, transform .16s ease; }
      .hs-page button.hs-star-button { color:var(--hs-muted); }
      .hs-star-button:hover { color:var(--hs-ink); border-color:color-mix(in srgb, var(--hs-warn) 38%, var(--hs-line-strong)); background:var(--hs-hover); transform:translateY(-1px); }
      .hs-star-button.is-active { border-color:color-mix(in srgb, currentColor 32%, var(--hs-line-strong)); background:color-mix(in srgb, currentColor 9%, transparent); }
      .hs-page button.hs-star-button.is-active { color:light-dark(#9a5a12, #f0c46a); }
      .hs-page button.hs-star-button:not(.is-active):hover { color:var(--hs-ink); }
      .hs-known-button { display:inline-flex; align-items:center; justify-content:center; gap:5px; min-height:38px; padding:0 12px; border:1px solid var(--hs-line-strong); border-radius:999px; background:transparent; font-size:10.5px; font-weight:600; white-space:nowrap; transition:color .16s ease, border-color .16s ease, background-color .16s ease, transform .16s ease; }
      .hs-page button.hs-known-button { color:var(--hs-muted); }
      .hs-known-button:hover:not(:disabled) { color:var(--hs-ink); border-color:color-mix(in srgb, var(--hs-success) 38%, var(--hs-line-strong)); background:var(--hs-hover); transform:translateY(-1px); }
      .hs-known-button.is-active { border-color:color-mix(in srgb, var(--hs-success) 30%, var(--hs-line-strong)); background:color-mix(in srgb, var(--hs-success) 8%, transparent); }
      .hs-page button.hs-known-button.is-active { color:var(--hs-success); }
      .hs-page button.hs-known-button:not(.is-active):hover { color:var(--hs-ink); }
      .hs-action-button--small.hs-star-button { width:31px; height:31px; }
      .hs-primary-button { display:inline-flex; align-items:center; justify-content:center; gap:7px; min-height:38px; padding:0 15px; border:1px solid transparent; border-radius:999px; background:var(--hs-ink); color:var(--hs-bg); font-size:11.5px; font-weight:640; white-space:nowrap; box-shadow:0 5px 14px -10px color-mix(in srgb, var(--hs-ink) 80%, transparent); transition:background-color .18s ease, transform .18s ease, opacity .18s ease; }
      .hs-primary-button:hover:not(:disabled) { background:var(--hs-brand); transform:translateY(-1px); }
      .hs-page button.hs-primary-button { color:var(--hs-bg); }
      .hs-action-button--small { min-height:31px; padding:0 10px; font-size:10px; }
      .hs-lead-side { display:flex; flex-direction:column; align-items:flex-start; justify-content:center; padding-left:28px; border-left:1px solid color-mix(in srgb, var(--hs-line) 80%, transparent); }
      .hs-gauge { --hs-heat:80%; display:grid; place-items:center; width:102px; height:102px; border-radius:50%; background:conic-gradient(var(--hs-cat) var(--hs-heat), color-mix(in srgb, var(--hs-cat) 10%, transparent) 0); position:relative; }
      .hs-gauge::before { content:""; position:absolute; inset:5px; border-radius:50%; background:var(--hs-surface); }
      .hs-gauge-inner { position:relative; z-index:1; display:flex; flex-direction:column; align-items:center; gap:1px; }
      .hs-gauge-inner strong { font-family:var(--hs-serif); font-size:30px; line-height:1; font-weight:600; font-variant-numeric:tabular-nums; letter-spacing:-.04em; }
      .hs-gauge-inner span { color:var(--hs-muted); font-size:7.5px; font-weight:700; letter-spacing:.15em; }
      .hs-gauge-caption { margin:9px 0 0; color:var(--hs-muted); font-size:9.5px; letter-spacing:.05em; }
      .hs-creator-block { width:100%; margin-top:15px; }
      .hs-creator-head { display:flex; align-items:baseline; justify-content:space-between; gap:10px; }
      .hs-creator-head span { color:var(--hs-muted); font-size:9px; font-weight:620; letter-spacing:.08em; text-transform:uppercase; }
      .hs-creator-head b { color:var(--hs-creator-ink, var(--hs-ink)); font-family:var(--hs-serif); font-size:20px; line-height:1; font-weight:600; letter-spacing:-.03em; font-variant-numeric:tabular-nums; }
      .hs-creator-track { height:3px; margin-top:7px; overflow:hidden; border-radius:99px; background:var(--hs-soft); }
      .hs-creator-track span { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg, color-mix(in srgb, var(--hs-creator-ink, var(--hs-ink)) 32%, transparent), var(--hs-creator-ink, var(--hs-ink))); transition:width .4s ease; }
      .hs-creator-note { margin:7px 0 0; color:var(--hs-muted); font-size:9.5px; line-height:1.5; }
      .hs-side-rule { width:32px; height:1px; margin:15px 0 13px; background:var(--hs-line-strong); }
      .hs-side-label { margin:9px 0 2px; color:var(--hs-muted); font-size:9px; font-weight:620; letter-spacing:.08em; text-transform:uppercase; }
      .hs-side-value { margin:0; font-size:11px; line-height:1.45; font-weight:560; }
      .hs-side-host { margin:14px 0 0; color:var(--hs-muted); font-size:9.5px; text-decoration:underline; text-decoration-color:color-mix(in srgb, var(--hs-muted) 30%, transparent); text-underline-offset:3px; }
      .hs-lead-ghost { position:absolute; right:18px; bottom:-43px; color:var(--hs-ink); font-family:var(--hs-serif); font-size:190px; line-height:1; font-weight:600; opacity:.028; pointer-events:none; user-select:none; }
      .hs-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(292px, 1fr)); gap:15px; margin-top:15px; }
      .hs-feed--collection .hs-grid { margin-top:0; }
      .hs-card { position:relative; display:flex; flex-direction:column; min-width:0; padding:19px 19px 17px; border:1px solid var(--hs-line); border-radius:19px; background:var(--hs-surface); box-shadow:0 8px 26px -26px color-mix(in srgb, var(--hs-ink) 30%, transparent); transition:transform .2s cubic-bezier(.2,.7,.2,1), border-color .2s ease, box-shadow .2s ease; animation:hs-rise .45s cubic-bezier(.2,.7,.2,1) both; }
      .hs-card::before { content:""; position:absolute; inset:18px auto 18px 0; width:2px; border-radius:0 2px 2px 0; background:var(--hs-cat); opacity:0; transition:opacity .2s ease; }
      .hs-card:hover { transform:translateY(-3px); border-color:color-mix(in srgb, var(--hs-cat) 30%, var(--hs-line)); box-shadow:0 22px 40px -30px color-mix(in srgb, var(--hs-cat) 34%, transparent); }
      .hs-card:hover::before { opacity:1; }
      .hs-card-top { display:flex; align-items:center; justify-content:space-between; gap:10px; }
      .hs-card-badges { display:flex; align-items:center; justify-content:flex-end; gap:6px; flex-wrap:wrap; }
      .hs-creator-tone--high { --hs-creator-ink:light-dark(#9a5a12, #f0c46a); }
      .hs-creator-tone--good { --hs-creator-ink:light-dark(#1d6a54, #79d8bd); }
      .hs-creator-tone--fair { --hs-creator-ink:light-dark(#3d5d8c, #a9c8ff); }
      .hs-creator-tone--low { --hs-creator-ink:var(--hs-muted); }
      .hs-creator-chip { display:inline-flex; align-items:center; gap:4px; min-height:24px; padding:0 8px; border:1px solid color-mix(in srgb, var(--hs-creator-ink, var(--hs-line)) 28%, var(--hs-line)); border-radius:999px; background:color-mix(in srgb, var(--hs-creator-ink, var(--hs-muted)) 7%, transparent); color:var(--hs-creator-ink, var(--hs-muted)); font-size:9.5px; font-weight:620; white-space:nowrap; cursor:default; }
      .hs-creator-chip b { color:var(--hs-creator-ink, var(--hs-ink)); font-size:10.5px; font-variant-numeric:tabular-nums; }
      .hs-creator-chip svg { opacity:.72; }
      .hs-card-id { display:flex; align-items:center; gap:9px; min-width:0; }
      .hs-card-rank { color:var(--hs-muted); font-family:var(--hs-serif); font-size:12px; font-weight:600; letter-spacing:.04em; font-variant-numeric:tabular-nums; }
      .hs-card-title { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; overflow:hidden; margin:15px 0 0; font-size:16px; line-height:1.5; font-weight:640; letter-spacing:-.012em; text-wrap:pretty; }
      .hs-card-summary { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; overflow:hidden; margin:9px 0 0; color:var(--hs-muted); font-size:12px; line-height:1.72; white-space:pre-line; }
      .hs-card .hs-reason { margin-top:11px; font-size:10.5px; }
      .hs-card .hs-meta { margin-top:auto; padding-top:13px; }
      .hs-card .hs-actions { margin-top:12px; padding-top:12px; }
      .hs-card .hs-action-button--small { min-height:31px; padding:0 9px; font-size:10px; }
      .hs-skeleton { display:grid; gap:15px; }
      .hs-skeleton-lead { height:344px; border-radius:26px; }
      .hs-skeleton-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(292px, 1fr)); gap:15px; }
      .hs-skeleton-card { height:262px; border-radius:19px; }
      .hs-shimmer { background:linear-gradient(100deg, color-mix(in srgb, var(--hs-ink) 5%, transparent) 16%, color-mix(in srgb, var(--hs-ink) 9%, transparent) 32%, color-mix(in srgb, var(--hs-ink) 5%, transparent) 48%); background-size:220% 100%; animation:hs-shimmer 1.7s ease-in-out infinite; }
      .hs-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:330px; padding:40px 20px; border:1px dashed var(--hs-line-strong); border-radius:22px; text-align:center; background:color-mix(in srgb, var(--hs-surface) 56%, transparent); }
      .hs-empty-icon { display:grid; place-items:center; width:54px; height:54px; margin-bottom:16px; border-radius:17px; color:var(--hs-brand); background:color-mix(in srgb, var(--hs-brand) 9%, transparent); }
      .hs-empty h2 { margin:0; font-family:var(--hs-serif); font-size:25px; font-weight:600; letter-spacing:-.03em; }
      .hs-empty p { max-width:460px; margin:10px 0 0; color:var(--hs-muted); font-size:12.5px; line-height:1.8; }
      .hs-empty .hs-primary-button { margin-top:20px; }
      .hs-inline-error { display:flex; align-items:flex-start; gap:7px; padding:12px 14px; margin-top:14px; border:1px solid color-mix(in srgb, var(--hs-error) 24%, var(--hs-line)); border-radius:11px; color:var(--hs-error); font-size:11.5px; background:color-mix(in srgb, var(--hs-error) 5%, transparent); }
      .hs-footer { display:flex; justify-content:space-between; align-items:center; gap:10px 22px; flex-wrap:wrap; margin-top:44px; padding-top:17px; border-top:1px solid var(--hs-line); color:var(--hs-muted); font-size:9.5px; line-height:1.6; }
      .hs-footer a { color:inherit; text-decoration:underline; text-decoration-color:color-mix(in srgb, var(--hs-muted) 36%, transparent); text-underline-offset:3px; }
      .hs-footer a:hover { color:var(--hs-ink); }
      .hs-toast { position:fixed; left:50%; bottom:28px; z-index:50; display:flex; align-items:flex-start; gap:8px; width:max-content; max-width:min(560px, calc(100vw - 32px)); padding:11px 12px 11px 14px; transform:translateX(-50%); border:1px solid var(--hs-line-strong); border-radius:13px; background:var(--hs-overlay); color:var(--hs-ink); box-shadow:0 18px 55px -20px color-mix(in srgb, #000 40%, transparent); font-size:11.5px; line-height:1.55; animation:hs-toast-in .25s cubic-bezier(.2,.7,.2,1) both; }
      .hs-toast > svg { flex:none; margin-top:2px; color:var(--hs-success); }
      .hs-toast--error { border-color:color-mix(in srgb, var(--hs-error) 45%, var(--hs-line)); }
      .hs-toast--error > svg { color:var(--hs-error); }
      .hs-toast > span { min-width:0; overflow-wrap:anywhere; }
      .hs-toast > button { display:grid; place-items:center; flex:none; width:22px; height:22px; margin-left:2px; padding:0; border:0; border-radius:50%; background:var(--hs-hover); color:var(--hs-muted); }
      .hs-spin { animation:hs-rotate .9s linear infinite; }
      @keyframes hs-rotate { to { transform:rotate(360deg); } }
      @keyframes hs-pulse { 0% { box-shadow:0 0 0 0 color-mix(in srgb, currentColor 36%, transparent); } 70% { box-shadow:0 0 0 5px transparent; } 100% { box-shadow:0 0 0 0 transparent; } }
      @keyframes hs-rise { from { opacity:0; transform:translateY(9px); } to { opacity:1; transform:translateY(0); } }
      @keyframes hs-toast-in { from { opacity:0; transform:translate(-50%, 7px); } to { opacity:1; transform:translate(-50%, 0); } }
      @keyframes hs-shimmer { 0% { background-position:100% 0; } 100% { background-position:-100% 0; } }
      @keyframes hs-shimmer-bar { 0% { background-position:120% 0; } 100% { background-position:-120% 0; } }
      @media (max-width:980px) {
        .hs-title-row { grid-template-columns:1fr; gap:23px; }
        .hs-overview { width:100%; align-items:flex-start; }
        .hs-stats { justify-self:start; min-width:min(100%, 390px); }
        .hs-shelves { justify-content:flex-start; }
        .hs-stat { padding-top:13px; }
        .hs-lead { grid-template-columns:minmax(0, 1fr) 180px; gap:24px; }
        .hs-lead-side { padding-left:21px; }
      }
      @media (max-width:760px) {
        .hs-shell { padding-top:24px; }
        .hs-topline { align-items:flex-start; }
        .hs-live { display:none; }
        .hs-controls { gap:10px; }
        .hs-updated { display:none; }
        .hs-toolbar { align-items:stretch; flex-direction:column; gap:9px; margin-top:24px; }
        .hs-search-wrap { flex-basis:auto; width:100%; }
        .hs-lead { grid-template-columns:1fr; padding:23px 21px; }
        .hs-lead-side { display:grid; grid-template-columns:84px minmax(0, 1fr); align-items:center; gap:12px 17px; padding:20px 0 0; border-left:0; border-top:1px solid var(--hs-line); }
        .hs-gauge { grid-column:1; grid-row:1; width:84px; height:84px; }
        .hs-gauge-inner strong { font-size:25px; }
        .hs-gauge-caption { display:none; }
        .hs-creator-block { grid-column:2; grid-row:1; align-self:center; margin:0; }
        .hs-side-rule, .hs-side-label, .hs-side-value, .hs-side-host { display:none; }
        .hs-lead-ghost { font-size:140px; }
        .hs-grid { grid-template-columns:1fr; }
        .hs-skeleton-grid { grid-template-columns:1fr; }
        .hs-actions { margin-top:19px; }
      }
      @media (max-width:480px) {
        .hs-page h1 { font-size:54px; }
        .hs-stats { width:100%; grid-template-columns:repeat(3, 1fr); }
        .hs-shelves { width:100%; justify-content:flex-start; flex-wrap:wrap; }
        .hs-stat { padding-inline:10px; }
        .hs-stat:first-child { padding-left:0; }
        .hs-stat b { font-size:24px; }
        .hs-lead-title { font-size:25px; }
        .hs-lead-summary { -webkit-line-clamp:5; }
        .hs-tab { padding-inline:9px; font-size:11.5px; }
        .hs-footer { display:block; }
        .hs-footer span { display:block; }
        .hs-footer span + span { margin-top:4px; }
      }
      @media (prefers-reduced-motion:reduce) {
        .hs-page *, .hs-page *::before, .hs-page *::after { animation-duration:.001ms !important; animation-delay:0ms !important; animation-iteration-count:1 !important; transition-duration:.001ms !important; }
      }
    `

    return {
      inject: ['slots', 'sessions', 'workspaces'],
      apply(ctx) {
        const face = {
          sessions: ctx.sessions,
          workspaces: ctx.workspaces,
        }
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main', key: panelId, inject: () => face,
        }, HotspotPage))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: panelId, order: 30, label: '热点',
        }, HotspotIcon))
      },
    }
  },
})
