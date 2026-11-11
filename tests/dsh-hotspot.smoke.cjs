const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')

const plugin = path.resolve(__dirname, '../plugins/dsh-hotspot')
const manifest = JSON.parse(fs.readFileSync(path.join(plugin, 'package.json'), 'utf8'))
const client = fs.readFileSync(path.join(plugin, manifest.exports['./client']), 'utf8')
assert.match(fs.readFileSync(path.join(plugin, manifest.dsh.bundle.patch), 'utf8'), /name: '@local\/dsh-hotspot'/)
for (const file of ['index.js', 'sources.json', 'icon.svg', 'locale/zh.json', 'locale/en.json']) {
  assert.ok(fs.existsSync(path.join(plugin, file)), `${file} must exist`)
}

const dependencies = {
  react: 'react/cjs/react.production.js',
  scheduler: 'scheduler/cjs/scheduler.production.js',
  'react-dom': 'react-dom/cjs/react-dom.production.js',
  'react-dom/client': 'react-dom/cjs/react-dom-client.production.js',
}
const imports = Object.entries(dependencies).map(([name, source]) => {
  const [packageName, ...segments] = source.split('/')
  const directory = path.dirname(require.resolve(`${packageName}/package.json`))
  const code = fs.readFileSync(path.join(directory, ...segments), 'utf8')
  return `modules[${JSON.stringify(name)}] = (() => { const exports = {}; ${code}\nreturn exports })();`
}).join('\n')

const fixture = `
const modules = {}, process = { env: { NODE_ENV: 'production' } };
const require = name => {
  if (!(name in modules)) throw Error('Missing module: ' + name);
  return modules[name];
};
${imports}
const React = require('react');
const h = React.createElement;
const root = require('react-dom/client').createRoot(document.getElementById('root'));
const slots = {};
const calls = [];
window.calls = calls;
const ctx = {
  slots: {
    inject: (key, callback) => callback(),
    register(options, Component) { slots[options.name] = { options, Component }; },
  },
  sessions: {
    async create(options) { calls.push({ type: 'create', ...options }); return options.sessionId; },
    async using(id, options, callback) {
      if (options.source !== 'controllerOperation') throw Error('Bad retention source');
      return callback({ binding: { session: {
        async prompt(content, mode, signal, requestId) {
          calls.push({ type: 'prompt', id, content, mode, requestId });
          return { ok: true };
        },
        async rename(title) { calls.push({ type: 'rename', id, title }); return { ok: true }; },
      } } });
    },
  },
  workspaces: {
    async initializeDefault() { return { workspaceId: 'default-id' }; },
  },
  uiWorkspace: {
    openSession(id) { calls.push({ type: 'open', id }); window.showSession(id); },
  },
};
window.__ModuleLoader__ = { load(spec) {
  if (spec.id !== ${JSON.stringify(manifest.name)}) throw Error('Bad bundle ID');
  const plugin = spec.factory(require);
  for (const key of plugin.inject) if (!(key in ctx)) throw Error('Missing service ' + key);
  plugin.apply(ctx);
  const sidebar = slots['sidebar.panellist'];
  const page = slots.main;
  if (sidebar.options.id !== page.options.key) throw Error('Mismatched panel');
  function App() {
    const [view, setView] = React.useState(null);
    window.showSession = setView;
    return h(React.Fragment, null,
      h('nav', null, h('button', { onClick: () => setView(value => value === 'hotspot' ? null : 'hotspot') },
        h(sidebar.Component, { size: 20 }), sidebar.options.label)),
      view === 'hotspot' ? h('main', null, h(page.Component, page.options.inject()))
        : view && h('h1', null, '会话 ' + view));
  }
  root.render(h(App));
} };
${client}
`

const now = Date.now()
const sampleItems = [
  {
    id: 'a1b2c3d4e5f60718', rank: 1, category: 'ai', categoryLabel: 'AI 前沿',
    title: 'OpenAI 发布新一代推理模型，长任务能力大幅提升',
    summary: '新模型在代码、数学与多步骤工具调用上取得明显进步，并在同一天向开发者开放 API。',
    reason: '一手发布 · 开发者影响面大', heat: 96, coverage: 3,
    sourceTitle: 'OpenAI News', sourceTitles: ['OpenAI News', 'The Verge — News'],
    sourceId: 'openai', sourceSite: 'https://openai.com', author: 'OpenAI',
    url: 'https://openai.com/index/new-model', publishedAt: now - 25 * 60_000,
    fetchedAt: now, language: 'en', aiRanked: true, image: '',
    creatorScore: 86, creatorReason: '适合科技号首发解读',
  },
  {
    id: 'b1b2c3d4e5f60718', rank: 2, category: 'tech', categoryLabel: '科技',
    title: 'Apple 更新 Mac 产品线，统一内存带宽提升',
    summary: '新芯片与内存架构让本地模型推理更快，同时降低了高负载下的功耗。',
    reason: '本地 AI 硬件的重要更新', heat: 88, coverage: 1,
    sourceTitle: 'The Verge — News', sourceTitles: ['The Verge — News'],
    sourceId: 'verge', sourceSite: 'https://theverge.com', author: '',
    url: 'https://theverge.com/apple-mac', publishedAt: now - 2 * 3_600_000,
    fetchedAt: now, language: 'en', aiRanked: true, image: '',
    creatorScore: 74, creatorReason: '适合产品号实测',
  },
  {
    id: 'c1b2c3d4e5f60718', rank: 3, category: 'business', categoryLabel: '商业',
    title: 'AI 芯片公司完成新一轮融资，估值继续攀升',
    summary: '资金将用于扩大产能与下一代互连技术研发，投资方包括多家主权基金。',
    reason: '资本正在继续押注算力基础设施', heat: 81, coverage: 2,
    sourceTitle: 'Financial Times', sourceTitles: ['Financial Times', '36氪'],
    sourceId: 'ft', sourceSite: 'https://ft.com', author: '',
    url: 'https://ft.com/chip-funding', publishedAt: now - 4 * 3_600_000,
    fetchedAt: now, language: 'zh', aiRanked: true, image: '',
    creatorScore: 62, creatorReason: '适合商业号跟进',
  },
]

const state = {
  version: 1,
  ready: true,
  refreshing: false,
  progress: { stage: 'done', done: 274, total: 274, ok: 238, failed: 36, message: '已更新 30 条精选 · 扫描 238/274 个信源' },
  lastRefresh: now - 5 * 60_000,
  nextRefreshAt: now + 55 * 60_000,
  refreshIntervalMs: 3_600_000,
  rankingWindowHours: 72,
  refreshReason: 'launch',
  lastError: '',
  aiRanked: true,
  stats: { sourceCount: 274, sourcesScanned: 238, sourcesFailed: 36, articles: 4039, candidates: 120, topN: 30, aiCount: 1, chineseCount: 0 },
  items: sampleItems,
  categories: [
    { id: 'all', label: '全部', count: 3 },
    { id: 'ai', label: 'AI 前沿', count: 1 },
    { id: 'tech', label: '科技', count: 1 },
    { id: 'business', label: '商业', count: 1 },
  ],
  sources: { count: 274, upstream: 'https://github.com/fuxiaoai/tidings-rss', upstreamLabel: 'Tidings RSS', license: 'CC0-1.0' },
  serverNow: now,
}

async function check() {
  const browser = await chromium.launch({ channel: process.env.DSH_SMOKE_BROWSER_CHANNEL })
  try {
    const page = await browser.newPage({ viewport: { width: 1180, height: 1500 } })
    page.setDefaultTimeout(5000)
    const failures = []
    page.on('pageerror', error => failures.push(error))
    page.on('console', message => {
      if (message.type() === 'error') failures.push(new Error(message.text()))
    })
    let apiState = state
    await page.route('https://hotspot-check.test/**', async route => {
      const url = new URL(route.request().url())
      if (url.pathname === '/fixture.js') {
        await route.fulfill({ contentType: 'text/javascript; charset=utf-8', body: fixture })
        return
      }
      if (url.pathname === '/api/plugins/hotspot/state') {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(apiState) })
        return
      }
      if (url.pathname === '/api/plugins/hotspot/refresh') {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, started: true, state: apiState }) })
        return
      }
      if (url.pathname === '/api/plugins/hotspot/article') {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true, id: url.searchParams.get('id'), content: '这是抓取到的完整正文。模型在长上下文任务上表现更好，API 价格保持不变。',
            fallback: false, charCount: 48,
          }),
        })
        return
      }
      await route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: '<meta charset="utf-8"><style>:root{color-scheme:light dark;font:14px system-ui}body{margin:0}nav{padding:10px 14px;border-bottom:1px solid #8884}main{height:calc(100vh - 45px)}</style><div id="root"></div><script src="/fixture.js"></script>',
      })
    })
    const button = name => page.getByRole('button', { name, exact: true })
    await page.goto('https://hotspot-check.test/')
    await button('热点').click()
    await page.getByRole('heading', { name: /热点/ }).waitFor()
    await page.getByRole('heading', { name: /OpenAI 发布新一代推理模型/ }).waitFor()
    assert.equal(await page.locator('.hs-card').count(), 2)
    await page.getByRole('tab', { name: /商业/ }).click()
    await page.getByRole('heading', { name: /AI 芯片公司完成新一轮融资/ }).waitFor()
    assert.equal(await page.locator('.hs-card').count(), 0)
    await page.getByRole('tab', { name: /全部/ }).click()
    await page.getByRole('searchbox', { name: '搜索热点' }).fill('Apple')
    await page.getByRole('heading', { name: /Apple 更新 Mac/ }).waitFor()
    assert.equal(await page.locator('.hs-card').count(), 0)
    await page.getByRole('button', { name: '清空搜索' }).click()
    await page.locator('.hs-creator-chip').first().waitFor()
    assert.equal(await page.locator('.hs-creator-chip').count(), 2)
    assert.match(await page.locator('.hs-lead .hs-creator-block').getAttribute('class'), /hs-creator-tone--high/)
    assert.match(await page.locator('.hs-card').first().locator('.hs-creator-chip').getAttribute('class'), /hs-creator-tone--good/)
    assert.match(await page.locator('.hs-card').filter({ hasText: 'AI 芯片公司完成新一轮融资' }).locator('.hs-creator-chip').getAttribute('class'), /hs-creator-tone--fair/)
    assert.equal(await page.locator('.hs-aging-chip').count(), 0)
    await page.getByText(/72 小时新鲜度窗口/).waitFor()
    const chineseCard = page.locator('.hs-card').filter({ hasText: 'AI 芯片公司完成新一轮融资' })
    assert.equal(await chineseCard.getByRole('button', { name: /网感转写/ }).count(), 0)
    assert.equal(await chineseCard.getByRole('button', { name: /标记已知晓/ }).count(), 1)
    assert.equal(await page.getByRole('button', { name: /总结全文/ }).count(), 0)
    if (process.env.DSH_SMOKE_SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.DSH_SMOKE_SCREENSHOT_DIR, { recursive: true })
      await page.locator('main').screenshot({
        path: path.join(process.env.DSH_SMOKE_SCREENSHOT_DIR, 'dsh-hotspot.png'),
        animations: 'disabled',
      })
    }
    const sourceHref = await page.getByRole('link', { name: /访问来源/ }).first().getAttribute('href')
    assert.equal(sourceHref, 'https://openai.com/index/new-model')
    const refreshResponse = page.waitForResponse(response =>
      response.url().endsWith('/api/plugins/hotspot/refresh') && response.request().method() === 'POST')
    await page.getByRole('button', { name: '立即刷新热点' }).click()
    await refreshResponse
    await page.getByRole('button', { name: '立即刷新热点' }).waitFor()

    const knownShelf = page.locator('.hs-shelf').filter({ hasText: '看过' })
    const savedShelf = page.locator('.hs-shelf').filter({ hasText: '收藏' })
    await page.getByRole('button', { name: /标记已知晓：OpenAI 发布新一代推理模型/ }).click()
    await page.getByRole('heading', { name: /OpenAI 发布新一代推理模型/ }).waitFor({ state: 'detached' })
    const knownStored = await page.evaluate(() => JSON.parse(localStorage.getItem('@local/dsh-hotspot:known:v1') ?? '{}'))
    assert.ok(knownStored.a1b2c3d4e5f60718, 'known snapshot must be persisted')
    await knownShelf.click()
    await page.getByRole('heading', { name: '看过' }).waitFor()
    assert.equal(await page.locator('.hs-feed--collection .hs-card').count(), 1)
    assert.equal(await page.locator('.hs-feed--collection .hs-card-rank').count(), 0)
    await page.getByRole('button', { name: /移出看过：OpenAI 发布新一代推理模型/ }).click()
    await page.getByRole('heading', { name: '还没有看过记录' }).waitFor()
    await page.locator('.hs-back-button').click()
    await page.getByRole('heading', { name: /OpenAI 发布新一代推理模型/ }).waitFor()

    await page.getByRole('button', { name: /收藏：OpenAI 发布新一代推理模型/ }).click()
    await page.getByRole('status').filter({ hasText: '已加入「收藏」' }).waitFor()
    const savedStored = await page.evaluate(() => JSON.parse(localStorage.getItem('@local/dsh-hotspot:saved:v1') ?? '{}'))
    assert.ok(savedStored.a1b2c3d4e5f60718, 'saved snapshot must be persisted')
    await page.reload()
    await button('热点').click()
    await page.locator('.hs-shelf').filter({ hasText: '收藏' }).click()
    await page.getByRole('heading', { name: '收藏' }).waitFor()
    assert.equal(await page.locator('.hs-feed--collection .hs-card').count(), 1)
    assert.equal(await page.getByRole('button', { name: /取消收藏：OpenAI 发布新一代推理模型/ }).getAttribute('aria-pressed'), 'true')
    if (process.env.DSH_SMOKE_SCREENSHOT_DIR) {
      await page.locator('main').screenshot({
        path: path.join(process.env.DSH_SMOKE_SCREENSHOT_DIR, 'dsh-hotspot-collection.png'),
        animations: 'disabled',
      })
    }
    await page.getByRole('button', { name: /取消收藏：OpenAI 发布新一代推理模型/ }).click()
    await page.getByRole('heading', { name: '还没有收藏' }).waitFor()
    await page.locator('.hs-back-button').click()

    await page.getByRole('button', { name: /网感转写：OpenAI 发布新一代推理模型/ }).click()
    await page.getByRole('status').filter({ hasText: '网感转写已在后台开始' }).waitFor()
    const calls = await page.evaluate(() => window.calls)
    const creates = calls.filter(call => call.type === 'create')
    const prompts = calls.filter(call => call.type === 'prompt')
    const renames = calls.filter(call => call.type === 'rename')
    assert.equal(creates.length, 1)
    assert.equal(prompts.length, 1)
    assert.equal(renames.length, 1)
    assert.ok(!calls.some(call => call.type === 'open'), 'background tasks must not switch panels')
    assert.equal(creates[0].workspaceId, 'default-id')
    assert.match(prompts[0].content[0].text, /改写成一篇适合简体中文互联网读者阅读的完整文章/)
    assert.match(prompts[0].content[0].text, /不得添加原文没有的信息/)
    assert.match(prompts[0].content[0].text, /不是逐字翻译/)
    assert.ok(prompts[0].id.startsWith('session-hotspot-rewrite-'))
    assert.ok(renames[0].title.startsWith('热点转写｜'))
    assert.ok(failures.length === 0, failures.map(error => error.message).join('\n'))
    console.log('dsh-hotspot smoke: ok')
  } finally {
    await browser.close()
  }
}

check().catch(error => {
  console.error(error)
  process.exitCode = 1
})
