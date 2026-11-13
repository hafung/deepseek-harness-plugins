const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')

const plugin = path.resolve(__dirname, '../plugins/dsh-learn-english')
const manifest = JSON.parse(fs.readFileSync(path.join(plugin, 'package.json'), 'utf8'))
const client = fs.readFileSync(path.join(plugin, manifest.exports['./client']), 'utf8')
assert.match(fs.readFileSync(path.join(plugin, manifest.dsh.bundle.patch), 'utf8'), /name: '@local\/dsh-learn-english'/)
for (const file of [
  'index.js',
  'client.js',
  'icon.svg',
  'locale/zh.json',
  'locale/en.json',
  'server/edge-tts.js',
  'server/qwen-tts.js',
  'server/speech.js',
  'vendor/ws/index.js',
  'vendor/ws/LICENSE',
]) {
  assert.ok(fs.existsSync(path.join(plugin, file)), `${file} must exist`)
}
assert.doesNotMatch(client, /@deepseek-ai\/dsh-client-ui-primitives/)
assert.doesNotMatch(client, /dangerouslySetInnerHTML/)

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
window.addEventListener('error', event => { console.error('PAGE ERROR', event.message); });

const dicts = {};
let activeLocale = 'zh-CN';
let localeSnapshot = { active: activeLocale, locales: [], revision: 1 };
const snapshot = () => localeSnapshot;
const localeService = {
  getSnapshot: snapshot,
  getLocale: snapshot,
  subscribe: () => () => {},
  register(ns, locale, dict) {
    dicts[ns] ??= {};
    dicts[ns][locale] = dict;
    localeSnapshot = { ...localeSnapshot, revision: localeSnapshot.revision + 1 };
    return () => {};
  },
  bind(ns) { return key => dicts[ns]?.[activeLocale]?.[key] ?? dicts[ns]?.en?.[key] ?? key; },
};

const ctx = {
  effect(callback) { const dispose = callback(); return () => { if (typeof dispose === 'function') dispose(); }; },
  locale: localeService,
  slots: {
    inject(key, callback) { callback(); },
    register(options, Component) { slots[options.name] = { options, Component }; return () => {}; },
  },
};

try {
  localStorage.setItem('@local/dsh-learn-english:store:v1', JSON.stringify({
    version: 1, mode: 'free',
    threads: { free: [], polish: [] },
    prefs: { autoRead: false, edgeVoice: 'en-US-AvaNeural', qwenSpeaker: 'ryan', speed: 1 },
  }));
} catch {
  // about:blank has no storage; the client's readStore already falls back safely.
}

function makeWav(seconds = 1.8, sampleRate = 8000) {
  const samples = Math.floor(seconds * sampleRate);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const write = (offset, text) => { for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i)); };
  write(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); write(8, 'WAVE');
  write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i += 1) {
    view.setInt16(44 + i * 2, Math.round(Math.sin((i / sampleRate) * Math.PI * 2 * 220) * 2200), true);
  }
  return new Uint8Array(buffer);
}
const wav = makeWav();

window.fetch = async (url, options = {}) => {
  const target = String(url);
  const body = options.body ? JSON.parse(options.body) : {};
  calls.push({ url: target, body });
  if (target.endsWith('/status')) {
    return new Response(JSON.stringify({
      ok: true,
      model: { provider: 'deepseek', model: 'deepseek-chat', source: 'default' },
      modes: ['free', 'polish'],
      engines: {
        edge: { id: 'edge', label: 'Edge TTS', available: true, voice: 'en-US-EmmaNeural', voices: [
          { id: 'en-US-AvaNeural', label: 'Ava', tone: 'Warm, clear' },
          { id: 'en-US-EmmaNeural', label: 'Emma', tone: 'Bright, friendly' },
        ], detail: 'Microsoft neural voice, online' },
        qwen: { id: 'qwen', label: 'Qwen3-TTS', available: true, voice: 'serena', voices: [
          { id: 'ryan', label: 'Ryan', tone: 'Warm, natural' },
          { id: 'serena', label: 'Serena', tone: 'Clear, gentle' },
        ], detail: 'Local Qwen3-TTS 1.7B, private and offline' },
      },
      limits: { maxInputChars: 6000, maxSpeechChars: 2600 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (target.endsWith('/chat')) {
    const text = body.mode === 'polish'
      ? 'I really like this city, but I’d like to meet more people.'
      : 'That sounds like a full day! What was the best part?';
    const lines = [
      JSON.stringify({ type: 'meta', model: 'deepseek-chat' }),
      JSON.stringify({ type: 'delta', text: text.slice(0, 18) }),
      JSON.stringify({ type: 'delta', text: text.slice(18) }),
      JSON.stringify({ type: 'done', text }),
    ].join('\\n') + '\\n';
    return new Response(lines, { status: 200, headers: { 'content-type': 'application/x-ndjson' } });
  }
  if (target.endsWith('/tts')) {
    await new Promise(resolve => setTimeout(resolve, 60));
    return new Response(wav, { status: 200, headers: { 'content-type': 'audio/wav' } });
  }
  return new Response('not found', { status: 404 });
};

window.__ModuleLoader__ = { load(spec) {
  if (spec.id !== ${JSON.stringify(manifest.name)}) throw Error('Bad bundle ID');
  const plugin = spec.factory(require);
  for (const key of plugin.inject) if (!(key in ctx)) throw Error('Missing service ' + key);
  plugin.apply(ctx);
  const sidebar = slots['sidebar.panellist'];
  const page = slots.main;
  if (!sidebar || !page) throw Error('Slots not registered');
  if (sidebar.options.id !== page.options.key) throw Error('Mismatched panel');
  window.__panelId = sidebar.options.id;
  window.__sidebarLabel = sidebar.options.label();
  window.__sidebarComponent = sidebar.Component;
  const Page = page.Component;
  function App() {
    return h('main', { style: { height: '100vh', minHeight: 0 } }, h(Page, {}));
  }
  root.render(h(App));
} };
${client}
`

async function run() {
  const launchOptions = { headless: true }
  if (process.env.DSH_SMOKE_BROWSER_CHANNEL) launchOptions.channel = process.env.DSH_SMOKE_BROWSER_CHANNEL
  else if (
    process.platform === 'win32' &&
    fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ) {
    launchOptions.executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  }
  const browser = await chromium.launch(launchOptions)
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  await page.setContent(`<!doctype html>
    <html lang="zh-CN">
      <head><meta charset="utf-8" /><style>
        :root {
          --dsw-alias-label-primary:#22201c; --dsw-alias-label-secondary:#6d675d;
          --dsw-alias-bg-base:#f7f3eb; --dsw-alias-bg-layer-1:#fffdf8; --dsw-alias-bg-layer-2:#f1eadf;
          --dsw-alias-bg-overlay:#fffdf8; --dsw-alias-border-l1:#e4dbcc; --dsw-alias-border-l2:#d7ccba;
          --dsw-alias-brand-primary:#b96a3b; --dsw-alias-state-warn-primary:#9b6b18;
          --dsw-alias-state-error-primary:#b13b3b; --dsw-alias-state-success-primary:#2d7b50;
          --dsw-alias-button-info-fill:#3b82f6; --dsw-alias-button-info-hover:#60a5fa;
          --dsw-static-neutral-00:#fff;
        }
        * { box-sizing: border-box; } body { margin:0; background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
        #root { height:100vh; } main { height:100vh; }
      </style></head>
      <body><div id="root"></div></body>
    </html>`, { waitUntil: 'load' })
  await page.addScriptTag({ content: fixture })
  try {
    await page.waitForSelector('.le-page', { timeout: 15000 })
  } catch (error) {
    console.error('Browser diagnostics:', errors)
    console.error('Body preview:', (await page.locator('body').innerHTML()).slice(0, 5000))
    await browser.close()
    throw error
  }

  assert.equal(await page.evaluate(() => window.__panelId), 'local-learn-english')
  assert.equal(await page.evaluate(() => window.__sidebarLabel), 'Learn English')
  assert.match(await page.locator('.le-title').innerText(), /Speak like a local\./)
  assert.match(await page.locator('.le-modes').innerText(), /自由对话/)
  assert.match(await page.locator('.le-modes').innerText(), /地道润色/)
  assert.equal(await page.locator('.le-msg').count(), 0)
  assert.ok(await page.locator('.le-empty').isVisible())
  assert.equal(await page.locator('.le-composer-top').count(), 0)
  assert.doesNotMatch(await page.locator('.le-composer').innerText(), /仅英文|只返回英文|地道润色/)
  const disabledSend = await page.locator('.le-send').evaluate(element => {
    const style = getComputedStyle(element)
    return { opacity: style.opacity, background: style.backgroundColor, radius: style.borderRadius }
  })
  assert.equal(disabledSend.opacity, '0.4')
  assert.equal(disabledSend.radius, '999px')
  assert.notEqual(disabledSend.background, 'rgba(0, 0, 0, 0)')
  const desktopHeader = await page.evaluate(() => {
    const modes = document.querySelector('.le-modes').getBoundingClientRect()
    const subtitle = document.querySelector('.le-subtitle').getBoundingClientRect()
    return {
      modesLeft: modes.left,
      modesTop: modes.top,
      modesBottom: modes.bottom,
      subtitleRight: subtitle.right,
      subtitleTop: subtitle.top,
      subtitleBottom: subtitle.bottom,
    }
  })
  assert.ok(
    desktopHeader.modesLeft >= desktopHeader.subtitleRight - 1,
    'mode switch must sit to the right of the subtitle',
  )
  assert.ok(
    desktopHeader.modesTop < desktopHeader.subtitleBottom &&
      desktopHeader.modesBottom > desktopHeader.subtitleTop,
    'mode switch and subtitle must share a row',
  )

  await page.screenshot({ path: path.resolve(__dirname, '../.scratch/learn-english-empty.png') })

  await page.setViewportSize({ width: 760, height: 900 })
  await page.waitForTimeout(250)
  const tabletLayout = await page.evaluate(() => {
    const shell = document.querySelector('.le-shell').getBoundingClientRect()
    const modes = document.querySelector('.le-modes').getBoundingClientRect()
    const actions = document.querySelector('.le-actions').getBoundingClientRect()
    const brand = document.querySelector('.le-brand').getBoundingClientRect()
    return {
      width: window.innerWidth,
      shellLeft: shell.left,
      shellRight: shell.right,
      brandRight: brand.right,
      actionsRight: actions.right,
      modesRight: modes.right,
      modesLeft: modes.left,
    }
  })
  assert.ok(tabletLayout.modesRight <= tabletLayout.shellRight + 1, 'mode switch overflows the shell at 760px')
  assert.ok(tabletLayout.actionsRight <= tabletLayout.shellRight + 1, 'header actions overflow the shell at 760px')
  assert.ok(tabletLayout.brandRight < tabletLayout.actionsRight, 'brand and actions overlap at 760px')
  assert.ok(tabletLayout.modesLeft >= tabletLayout.shellLeft - 1, 'mode switch must stay inside the shell at 760px')
  await page.screenshot({ path: path.resolve(__dirname, '../.scratch/learn-english-tablet.png') })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.waitForTimeout(250)

  await page.getByRole('button', { name: /地道润色/ }).click()
  await page.waitForSelector('.le-empty--polish')
  assert.ok(await page.locator('.le-sample').isVisible())
  assert.match(await page.locator('.le-sample').innerText(), /I really like this city/)

  await page.locator('textarea').fill('这个方案我觉得还行，但预算有点高。')
  const activeSend = await page.locator('.le-send').evaluate(element => {
    const style = getComputedStyle(element)
    return { opacity: style.opacity, width: style.width, height: style.height }
  })
  assert.equal(activeSend.opacity, '1')
  assert.equal(activeSend.width, '34px')
  assert.equal(activeSend.height, '34px')
  await page.getByRole('button', { name: '发送' }).click()
  await page.waitForSelector('.le-polished', { timeout: 10000 })
  assert.equal(await page.locator('.le-polished-label').count(), 0)
  assert.doesNotMatch(await page.locator('.le-polished').innerText(), /自然美式表达/)
  await page.waitForFunction(() => document.querySelectorAll('.le-voice.is-ready').length === 2, null, { timeout: 10000 })
  const voiceBox = await page.locator('.le-voices').boundingBox()
  const polishedBox = await page.locator('.le-polished').boundingBox()
  const firstChip = await page.locator('.le-voice').first().boundingBox()
  assert.ok(voiceBox.y + voiceBox.height <= polishedBox.y + 1, 'audio controls must sit above the answer box')
  assert.ok(firstChip.width < 150 && firstChip.height < 34, 'audio chips must be compact')
  assert.match(await page.locator('.le-polished .le-prose').innerText(), /I really like this city/)
  assert.equal(await page.locator('.le-voice').count(), 2)
  const ttsCalls = await page.evaluate(() => window.calls.filter(call => call.url.endsWith('/tts')).map(call => call.body.engine))
  assert.deepEqual(ttsCalls.sort(), ['edge', 'qwen'])
  assert.equal(await page.locator('.le-polished .le-caret').count(), 0)

  await page.waitForTimeout(500)
  await page.screenshot({ path: path.resolve(__dirname, '../.scratch/learn-english-conversation.png') })

  await page.locator('textarea').fill('I usually get it iced.')
  await page.getByRole('button', { name: '发送' }).click()
  await page.waitForFunction(() => document.querySelectorAll('.le-polished').length === 2, null, { timeout: 10000 })
  const secondChat = await page.evaluate(() => {
    const chats = window.calls.filter(call => call.url.endsWith('/chat'))
    return chats[chats.length - 1].body.messages.map(message => message.role)
  })
  assert.ok(secondChat.includes('assistant'), 'the client must send prior assistant turns')
  assert.equal(secondChat[secondChat.length - 1], 'user')

  await page.getByRole('button', { name: /语音与播放/ }).click()
  await page.waitForSelector('.le-pop')
  assert.ok(await page.locator('.le-pop').isVisible())
  assert.equal(await page.locator('.le-pop select').nth(0).inputValue(), 'en-US-EmmaNeural')
  assert.equal(await page.locator('.le-pop select').nth(1).inputValue(), 'serena')
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.resolve(__dirname, '../.scratch/learn-english-settings.png') })
  await page.getByRole('button', { name: '1.15×' }).click()
  assert.equal(await page.getByRole('button', { name: '1.15×' }).getAttribute('aria-pressed'), 'true')
  await page.keyboard.press('Escape')
  await page.waitForSelector('.le-pop', { state: 'detached' })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(300)
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  assert.ok(mobileOverflow <= 0, `mobile conversation overflows horizontally by ${mobileOverflow}px`)
  const mobileVoiceBox = await page.locator('.le-voices').last().boundingBox()
  const mobileAnswerBox = await page.locator('.le-polished').last().boundingBox()
  assert.ok(
    mobileVoiceBox.y + mobileVoiceBox.height <= mobileAnswerBox.y + 1,
    'mobile audio controls must remain above the answer box',
  )
  await page.screenshot({ path: path.resolve(__dirname, '../.scratch/learn-english-mobile-conversation.png') })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.waitForTimeout(250)

  await page.getByRole('button', { name: '新对话' }).click()
  await page.getByRole('button', { name: '清空当前对话？' }).click()
  await page.waitForSelector('.le-empty--polish')
  assert.equal(await page.locator('.le-msg').count(), 0)

  await page.evaluate(() => {
    const style = document.documentElement.style
    style.setProperty('--dsw-alias-label-primary', '#eee8dc')
    style.setProperty('--dsw-alias-label-secondary', '#a69e91')
    style.setProperty('--dsw-alias-bg-base', '#161513')
    style.setProperty('--dsw-alias-bg-layer-1', '#1d1c19')
    style.setProperty('--dsw-alias-bg-layer-2', '#24221e')
    style.setProperty('--dsw-alias-bg-overlay', '#24221e')
    style.setProperty('--dsw-alias-border-l1', '#302d27')
    style.setProperty('--dsw-alias-border-l2', '#413c33')
    style.setProperty('--dsw-alias-brand-primary', '#d7935c')
    style.setProperty('--dsw-alias-state-warn-primary', '#d0a75b')
    style.setProperty('--dsw-alias-state-error-primary', '#e37b73')
    style.setProperty('--dsw-alias-state-success-primary', '#74b78d')
  })
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.resolve(__dirname, '../.scratch/learn-english-dark.png') })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(250)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  assert.ok(overflow <= 0, `mobile layout overflows horizontally by ${overflow}px`)
  assert.ok(await page.locator('textarea').isVisible())
  assert.ok(await page.locator('.le-send').isVisible())
  await page.screenshot({ path: path.resolve(__dirname, '../.scratch/learn-english-mobile.png') })

  if (errors.length) throw new Error(`Browser errors:\n${errors.join('\n')}`)
  console.log('dsh-learn-english smoke: PASS')
  await browser.close()
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
