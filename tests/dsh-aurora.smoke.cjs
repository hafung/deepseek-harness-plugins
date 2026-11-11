const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')

const plugin = path.resolve(__dirname, '../plugins/dsh-aurora')
const manifest = JSON.parse(fs.readFileSync(path.join(plugin, 'package.json'), 'utf8'))
const client = fs.readFileSync(path.join(plugin, manifest.exports['./client']), 'utf8')
const screenshotDir = process.env.DSH_SMOKE_SCREENSHOT_DIR || path.join(__dirname, '../test-results')

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
const slots = {};
const themeCalls = [];
const disposers = [];
const theme = {
  overrideTokens(source, tokens) {
    themeCalls.push({ source, tokens });
    return () => {};
  },
};
const ctx = {
  effect(callback) { const dispose = callback(); disposers.push(dispose); return () => {}; },
  inject(keys, callback) { callback({ theme, effect: ctx.effect }); },
  theme,
  get(name) { return name === 'theme' ? theme : undefined },
  slots: {
    inject(name, callback) { callback(); },
    register(options, Component) { slots[options.name] = { options, Component }; return () => {}; },
  },
};
window.__ModuleLoader__ = { load(spec) {
  if (spec.id !== '@local/dsh-aurora') throw Error('Bad bundle ID: ' + spec.id);
  const plugin = spec.factory(require);
  for (const key of plugin.inject) if (!(key in ctx)) throw Error('Missing service ' + key);
  plugin.apply(ctx);
  window.__slots = slots;
  window.__themeCalls = themeCalls;
  window.__styleCount = document.querySelectorAll('style[data-dsh-aurora]').length;
  const root = require('react-dom/client').createRoot(document.getElementById('root'));
  function App() {
    return h('div', { className: 'shell' },
      h('aside', { className: 'sidebar' },
        h('div', { className: 'brand' },
          h('span', { className: 'mark' }, h(slots['sidebar.brand.mark'].Component, { size: 24 })),
          h('span', { className: 'name' }, h(slots['sidebar.brand.name'].Component, {}))),
        h('div', { className: 'rows' }, ['插件', '专家', '自动化任务', '待办清单'].map(label =>
          h('div', { className: 'row', key: label }, label)))),
      h('main', { className: 'panel' }, h(slots['settings.section'].Component, { close() {} })));
  }
  root.render(h(App));
}};
`

const css = `
  html, body { margin: 0; height: 100%; }
  body { font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif; }
  #root, .shell { height: 100%; }
  .shell { display: grid; grid-template-columns: 280px 1fr; }
  .sidebar { height: 100%; padding: 14px 16px; box-sizing: border-box; }
  .brand { display: flex; align-items: center; gap: 8px; height: 30px; }
  .name { display: flex; align-items: center; }
  .rows { margin-top: 22px; display: grid; gap: 6px; }
  .row { height: 30px; display: flex; align-items: center; padding: 0 10px; border-radius: 8px; font-size: 13px; color: var(--dsw-alias-label-secondary, #555); }
  .row:hover { background: rgb(0 0 0 / .04); }
  .panel { height: 100%; overflow: auto; padding: 24px 28px; box-sizing: border-box; }
`

async function main() {
  fs.mkdirSync(screenshotDir, { recursive: true })
  const browser = await chromium.launch({ channel: process.env.DSH_SMOKE_BROWSER_CHANNEL })
  const page = await browser.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', error => errors.push(String(error)))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })

  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root"></div><script>${fixture}${client}</script></body></html>`)
  await page.waitForSelector('.dsh-aurora-name')

  const state = await page.evaluate(() => ({
    styleCount: window.__styleCount,
    name: document.querySelector('.dsh-aurora-name')?.textContent,
    markWidth: document.querySelector('.dsh-aurora-mark')?.getAttribute('width'),
    tokens: window.__themeCalls[0]?.tokens,
    source: window.__themeCalls[0]?.source,
    slots: Object.keys(window.__slots),
  }))

  assert.equal(state.slots.includes('sidebar.brand.mark'), true)
  assert.equal(state.slots.includes('sidebar.brand.name'), true)
  assert.equal(state.name, 'Aurora')
  assert.equal(state.markWidth, '24')
  assert.equal(state.styleCount, 1)
  assert.equal(state.source, '@local/dsh-aurora')
  assert.ok(state.tokens['--dsw-alias-bg-base']?.light)
  assert.ok(state.tokens['--dsw-alias-bg-base']?.dark)

  const canvas = await page.evaluate(() => getComputedStyle(document.body, '::before').backgroundImage)
  assert.match(canvas, /radial-gradient/)

  const pageText = await page.evaluate(() => document.body.innerText)
  assert.equal(await page.locator('.dsh-aurora-swatch').count(), 8)
  assert.ok(pageText.includes('本地图片，自动压缩'))
  assert.ok(!pageText.includes('1.6 MB'))
  assert.ok(!pageText.includes('https 图片'))

  const railStyle = await page.locator('.dsh-aurora-rail').first().evaluate(el => ({
    overflowX: getComputedStyle(el).overflowX,
    flexWrap: getComputedStyle(el).flexWrap,
  }))
  assert.equal(railStyle.overflowX, 'auto')
  assert.equal(railStyle.flexWrap, 'nowrap')

  await page.screenshot({ path: path.join(screenshotDir, 'aurora-light.png') })

  await page.getByRole('button', { name: '青竹' }).click()
  const bamboo = await page.evaluate(() => ({
    effect: document.body.dataset.dshAuroraEffect,
    base: getComputedStyle(document.body).getPropertyValue('--aurora-base').trim(),
    pressed: Array.from(document.querySelectorAll('.dsh-aurora-tile[aria-pressed="true"] .dsh-aurora-tile-label')).map(node => node.textContent),
  }))
  assert.equal(bamboo.effect, 'bamboo')
  assert.equal(bamboo.base, '#edf4ec')
  assert.ok(bamboo.pressed.includes('青竹'))

  await page.screenshot({ path: path.join(screenshotDir, 'aurora-bamboo.png') })

  await page.getByRole('button', { name: '墨笺' }).click()
  assert.equal(await page.evaluate(() => document.body.dataset.dshAuroraEffect), 'ink')
  await page.screenshot({ path: path.join(screenshotDir, 'aurora-ink.png') })

  await page.getByRole('button', { name: '星穹' }).click()
  assert.equal(await page.evaluate(() => document.body.dataset.dshAuroraEffect), 'starfield')
  await page.screenshot({ path: path.join(screenshotDir, 'aurora-starfield.png') })

  await page.evaluate(() => {
    document.body.setAttribute('data-ds-dark-theme', '')
    const dark = {
      '--dsw-alias-label-primary': '#e9eef7',
      '--dsw-alias-label-secondary': '#9fabc0',
      '--dsw-alias-bg-layer-1': 'rgb(22 26 46 / 0.76)',
      '--dsw-alias-border-l1': 'rgb(255 255 255 / 0.12)',
      '--dsw-alias-border-l2': 'rgb(255 255 255 / 0.2)',
      '--dsw-alias-brand-primary': '#7aa2ff',
      '--dsw-alias-state-warn-primary': '#ffbd79',
    }
    for (const [name, value] of Object.entries(dark)) document.body.style.setProperty(name, value)
  })
  await page.screenshot({ path: path.join(screenshotDir, 'aurora-starfield-dark.png') })

  await page.setViewportSize({ width: 720, height: 640 })
  const rail = page.locator('.dsh-aurora-rail').nth(1)
  const box = await rail.boundingBox()
  const scrollBefore = await rail.evaluate(el => el.scrollLeft)
  assert.ok(await rail.evaluate(el => el.scrollWidth > el.clientWidth), 'effects rail should overflow at 720px')
  await page.mouse.move(box.x + box.width - 24, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 24, box.y + box.height / 2, { steps: 10 })
  await page.mouse.up()
  const scrollAfter = await rail.evaluate(el => el.scrollLeft)
  assert.ok(scrollAfter > scrollBefore, `drag should scroll the rail (${scrollBefore} -> ${scrollAfter})`)
  assert.equal(await page.evaluate(() => document.body.dataset.dshAuroraEffect), 'starfield',
    'dragging the rail must not select a tile')

  assert.deepEqual(errors, [])
  await browser.close()
  console.log('dsh-aurora smoke ok:', JSON.stringify(state.slots))
}

main().catch(error => { console.error(error); process.exit(1) })
