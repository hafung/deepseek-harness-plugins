const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')

const plugin = path.resolve(__dirname, '../plugins/dsh-experts')
const manifest = JSON.parse(fs.readFileSync(path.join(plugin, 'package.json'), 'utf8'))
const client = fs.readFileSync(path.join(plugin, manifest.exports['./client']), 'utf8')
assert.match(fs.readFileSync(path.join(plugin, manifest.dsh.bundle.patch), 'utf8'), /name: '@local\/dsh-experts'/)

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

let inputState = { draft: '', phase: 'plain', rev: 0 };
const inputListeners = new Set();
function publishInput(next) {
  inputState = next;
  for (const listener of inputListeners) listener();
}
function useInput(selector) {
  return selector(React.useSyncExternalStore(
    listener => { inputListeners.add(listener); return () => inputListeners.delete(listener); },
    () => inputState,
  ));
}
const inputActions = {
  setDraft(text) { publishInput({ ...inputState, draft: text, rev: inputState.rev + 1 }); },
  captureInsertion() {
    return { start: inputState.draft.length, end: inputState.draft.length, draftRev: inputState.rev };
  },
  insertText(text, span) {
    if (span.draftRev !== inputState.rev) return false;
    const draft = inputState.draft.slice(0, span.start) + text + inputState.draft.slice(span.end);
    publishInput({ ...inputState, draft, rev: inputState.rev + 1 });
    return true;
  },
};

const sessionState = { key: 'session-1' };
const sessionRows = { 'session-1': { id: 'session-1', retainedBy: { mainView: 1 } } };
let workspaceItems = [{ workspaceId: 'workspace-1' }];
let setPanelState = () => {};
let setSessionState = () => {};

const ctx = {
  effect(callback) {
    const dispose = callback();
    return () => { if (typeof dispose === 'function') dispose(); };
  },
  slots: {
    inject(key, callback) { callback(); },
    register(options, Component) { slots[options.name] = { options, Component }; return () => {}; },
  },
  layout: {
    selectPanel(id) {
      calls.push({ type: 'selectPanel', id });
      setPanelState(id ?? 'conversation');
    },
  },
  sessions: { list: { getSnapshot: () => ({ byId: sessionRows }) } },
  uiSession: { current: { getSnapshot: () => sessionState } },
  workspaces: { list: { getSnapshot: () => ({ items: workspaceItems }) } },
  uiWorkspace: {
    startSession(workspaceId, options) {
      calls.push({ type: 'startSession', workspaceId, options });
      if (workspaceItems.length === 0) return;
      sessionState.key = 'session-new';
      sessionRows['session-new'] = { id: 'session-new', retainedBy: { mainView: 1 } };
      setSessionState('session-new');
      inputActions.setDraft(options.prompt);
      setPanelState('conversation');
    },
  },
};

window.__ModuleLoader__ = { load(spec) {
  if (spec.id !== ${JSON.stringify(manifest.name)}) throw Error('Bad bundle ID');
  const plugin = spec.factory(require);
  for (const key of plugin.inject) if (!(key in ctx)) throw Error('Missing service ' + key);
  plugin.apply(ctx);
  const sidebar = slots['sidebar.panellist'];
  const page = slots.main;
  const toastSlot = slots['shell.overlay'];
  const bridgeSlot = slots['conversation.input.left'];
  if (!sidebar || !page || !toastSlot || !bridgeSlot) throw Error('Missing slot registration');
  if (sidebar.options.id !== page.options.key) throw Error('Mismatched panel');

  function App() {
    const [panel, setPanel] = React.useState('conversation');
    const [session, setSession] = React.useState('session-1');
    const input = useInput(state => state);
    setPanelState = setPanel;
    setSessionState = setSession;
    React.useEffect(() => {
      window.__setPanel = setPanel;
      window.__setSession = setSession;
      window.__clearSession = () => {
        sessionState.key = undefined;
        sessionRows['session-1'].retainedBy.mainView = 0;
        setSession(undefined);
      };
      window.__setWorkspaces = items => { workspaceItems = items; };
      window.__setPhase = phase => publishInput({ ...inputState, phase });
      window.__setCurrentSession = id => { sessionState.key = id; };
      window.__getDraft = () => inputState.draft;
    }, []);
    return h('div', { className: 'app' },
      h('nav', null,
        h('button', {
          type: 'button',
          onClick: () => setPanel('local-experts'),
        }, h(sidebar.Component, { size: 20, active: panel === 'local-experts' }), sidebar.options.label),
        h('span', { id: 'panel-indicator' }, panel)),
      h('main', null,
        panel === 'local-experts'
          ? h(page.Component, page.options.inject())
          : h('div', { className: 'composer' },
              session === undefined ? null : h(bridgeSlot.Component, {
                inputActions,
                useInput,
                sessionId: session,
              }),
              h('div', {
                contentEditable: true,
                suppressContentEditableWarning: true,
                'data-testid': 'editor',
              }, ''),
              h('textarea', {
                'aria-label': '会话输入框',
                value: input.draft,
                onChange: event => inputActions.setDraft(event.target.value),
              }),
              h('span', { id: 'draft-value' }, input.draft))),
      h(toastSlot.Component, null));
  }
  root.render(h(App));
} };

${client}
`

async function check() {
  const browser = await chromium.launch({ channel: process.env.DSH_SMOKE_BROWSER_CHANNEL })
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    page.setDefaultTimeout(6000)
    const failures = []
    page.on('pageerror', error => failures.push(error))

    await page.route('https://experts-check.test/**', async route => {
      if (route.request().url().endsWith('/fixture.js')) {
        await route.fulfill({ contentType: 'text/javascript; charset=utf-8', body: fixture })
      } else {
        await route.fulfill({
          contentType: 'text/html; charset=utf-8',
          body: '<meta charset="utf-8"><style>:root{color-scheme:light dark;font:14px system-ui}body{margin:0;color-scheme:light}nav{padding:12px;border-bottom:1px solid #8884;display:flex;gap:12px;align-items:center}main{height:calc(100vh - 54px)}.composer{padding:20px;display:grid;gap:12px}[contenteditable]{min-height:70px;border:1px solid #8888;padding:8px;border-radius:8px}</style><div id="root"></div><script src="/fixture.js"></script>',
        })
      }
    })

    const button = (name, options = {}) => page.getByRole('button', { name, exact: true, ...options })
    const cards = () => page.locator('.dsh-exp-card')
    const heading = () => page.getByRole('heading', { name: /^专家/ })
    const input = () => page.getByLabel('会话输入框')
    const apply = name => button(`应用 ${name}`)
    const field = label => page.locator(`[aria-label="${label}"]`)
    // The dialog schedules initial focus; wait for it before filling other fields.
    const waitEditorFocus = () => page.waitForFunction(() =>
      document.activeElement?.getAttribute('aria-label') === '专家名称')
    const waitEnabled = name => page.waitForFunction(label => {
      const node = [...document.querySelectorAll('button')]
        .find(candidate => candidate.textContent.trim() === label)
      return node !== undefined && !node.disabled
    }, name)

    await page.goto('https://experts-check.test/')
    await button('专家').click()
    await heading().waitFor()
    assert.equal(await cards().count(), 10)
    assert.equal(await page.locator('.dsh-exp-count').innerText(), '10 位')
    assert.equal(await page.locator('.dsh-exp-topline .dsh-exp-tool').count(), 2)
    assert.equal(await page.locator('.dsh-exp-toolbar .dsh-exp-tool').count(), 0)
    assert.equal(await page.getByRole('heading', { name: /^专家/ }).count(), 1)
    if (process.env.DSH_SMOKE_SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.DSH_SMOKE_SCREENSHOT_DIR, { recursive: true })
      await page.locator('main').screenshot({
        path: path.join(process.env.DSH_SMOKE_SCREENSHOT_DIR, 'experts.png'),
        animations: 'disabled',
      })
    }

    // Apply into an empty composer, then return to the conversation panel.
    await apply('深度研究员').click()
    await input().waitFor()
    assert.match(await input().inputValue(), /^你是一位严谨的深度研究员/)
    await page.getByText('已载入「深度研究员」').waitFor()
    assert.equal(await page.locator('#panel-indicator').innerText(), 'conversation')
    assert.equal(
      await page.evaluate(() => window.calls.findLast(call => call.type === 'selectPanel').id),
      null,
    )
    await page.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'editor')

    // Append to an existing draft, keep it, then undo through the toast.
    await input().fill('已有草稿')
    await button('专家').click()
    await apply('代码审查专家').click()
    await input().waitFor()
    assert.equal(
      await input().inputValue(),
      '已有草稿\n\n你是一位资深代码审查者，关注正确性、安全性与可维护性，而不是风格偏好。'
        + '\n\n请审查我提供的改动：\n1. 先概述改动意图与影响范围。'
        + '\n2. 按严重程度列出问题：阻断 / 重要 / 建议。每条给出文件与行号、触发条件、后果和最小修复方案。'
        + '\n3. 重点检查边界条件、并发与竞态、错误处理、资源释放、权限与注入风险、向后兼容。'
        + '\n4. 明确指出「没有发现问题」的部分，避免为了凑数而提建议。'
        + '\n5. 最后给出是否建议合并的结论。'
        + '\n\n不要重写整个文件，只给必要的补丁片段。',
    )
    await page.getByText('已追加到现有草稿末尾').waitFor()
    await page.getByRole('button', { name: '撤销' }).click()
    assert.equal(await input().inputValue(), '已有草稿')

    // Create a preset, then prove it survives a reload.
    await button('专家').click()
    await button('新建专家').click()
    await page.getByRole('dialog').waitFor()
    await waitEditorFocus()
    await field('专家名称').fill('测试专家')
    await field('一句话简介').fill('用于自动化测试')
    await field('专家分类').selectOption('writing')
    await field('提示词').fill('这是测试提示词。')
    await waitEnabled('创建专家')
    await button('创建专家').click()
    await page.getByText('测试专家', { exact: true }).waitFor()
    assert.equal(await cards().count(), 11)
    await page.reload()
    await button('专家').click()
    await heading().waitFor()
    await page.getByText('测试专家', { exact: true }).waitFor()

    // Search and filters.
    const search = page.getByLabel('搜索专家')
    await search.fill('测试专家')
    assert.equal(await cards().count(), 1)
    await search.fill('不存在的关键词')
    await page.getByText('没有匹配的专家').waitFor()
    await page.getByRole('button', { name: '清除筛选' }).click()
    await search.fill('')
    assert.equal(await cards().count(), 11)
    await page.getByRole('button', { name: /^写作/ }).click()
    assert.equal(await cards().count(), 3)
    await page.getByRole('button', { name: /^全部/ }).click()
    assert.equal(await cards().count(), 11)

    // Favorite, edit, export, delete.
    await page.getByRole('button', { name: '收藏 测试专家' }).click()
    await page.getByRole('button', { name: '取消收藏 测试专家' }).waitFor()
    assert.equal(await cards().first().getByText('测试专家', { exact: true }).count(), 1)

    await page.getByRole('button', { name: '编辑 测试专家' }).click()
    await waitEditorFocus()
    await field('专家名称').fill('测试专家 v2')
    await waitEnabled('保存修改')
    await button('保存修改').click()
    await page.getByText('测试专家 v2', { exact: true }).waitFor()

    const downloadPromise = page.waitForEvent('download')
    await button('导出').click()
    const download = await downloadPromise
    assert.match(download.suggestedFilename(), /^dsh-experts-\d{4}-\d{2}-\d{2}\.json$/)
    const chunks = []
    for await (const chunk of await download.createReadStream()) chunks.push(chunk)
    const backup = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    assert.equal(backup.format, 'dsh-experts')
    assert.equal(backup.version, 1)
    assert.equal(backup.presets.length, 11)
    const exported = backup.presets.find(item => item.name === '测试专家 v2')
    assert.equal(exported.prompt, '这是测试提示词。')
    assert.equal(exported.category, 'writing')

    await page.getByRole('button', { name: '删除 测试专家 v2' }).click()
    await page.getByRole('alertdialog').waitFor()
    await button('确认删除').click()
    await page.getByText('测试专家 v2', { exact: true }).waitFor({ state: 'detached' })
    assert.equal(await cards().count(), 10)

    // Import merges new ids and skips duplicates or malformed backups.
    const imported = {
      format: 'dsh-experts',
      version: 1,
      presets: [{
        id: 'imported-test-1',
        name: '导入的专家',
        description: '从备份导入',
        category: 'learning',
        icon: 'flask',
        favorite: false,
        prompt: '这是导入的提示词。',
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      }],
    }
    const pickBackup = content => page.locator('input[type=file]').setInputFiles({
      name: 'experts.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(content)),
    })
    await pickBackup(imported)
    await page.getByText('已导入 1 位专家').waitFor()
    await page.getByText('导入的专家', { exact: true }).waitFor()
    assert.equal(await cards().count(), 11)
    await pickBackup(imported)
    await page.getByText('没有新的专家可导入。').waitFor()
    await pickBackup({ ...imported, version: 2 })
    await page.getByText('导入失败：请选择由「专家」导出的 JSON 备份。').waitFor()
    await pickBackup({
      ...imported,
      presets: [{ ...imported.presets[0], id: 'broken-1', prompt: '' }],
    })
    await page.getByText(/导入失败：提示词不能为空/).waitFor()

    // Restore one deleted built-in.
    await page.getByRole('button', { name: '删除 会议纪要官' }).click()
    await page.getByRole('alertdialog').waitFor()
    await button('确认删除').click()
    await page.getByText('会议纪要官', { exact: true }).waitFor({ state: 'detached' })
    await button('恢复内置专家').click()
    await page.getByText('已恢复 1 位内置专家。').waitFor()
    await page.getByText('会议纪要官', { exact: true }).waitFor()

    // Restoring also reverts edits to built-ins; custom experts stay untouched.
    await page.getByRole('button', { name: '编辑 深度研究员' }).click()
    await waitEditorFocus()
    await field('提示词').fill('被修改的测试提示词')
    await waitEnabled('保存修改')
    await button('保存修改').click()
    await page.getByText('被修改的测试提示词').waitFor()
    await button('恢复内置专家').click()
    const restoreDialog = page.getByRole('alertdialog')
    await restoreDialog.waitFor()
    assert.match(await restoreDialog.innerText(), /1 位已修改/)
    await button('确认恢复').click()
    await restoreDialog.waitFor({ state: 'detached' })
    await page.getByRole('button', { name: '取消收藏 深度研究员' }).waitFor()
    await page.getByRole('button', { name: '编辑 深度研究员' }).click()
    assert.match(await field('提示词').inputValue(), /^你是一位严谨的深度研究员/)
    await button('取消').click()
    await page.getByText('导入的专家', { exact: true }).waitFor()

    // Without a session, an empty workspace reports a clear failure instead of guessing.
    await page.evaluate(() => {
      window.__clearSession()
      window.__setWorkspaces([])
    })
    await apply('翻译校对').click()
    await page.getByText('还没有可用的工作区。').waitFor()
    assert.equal(
      await page.evaluate(() => window.calls.filter(call => call.type === 'startSession').length),
      0,
    )

    // Without a session but with a workspace, start one and seed the draft.
    await page.evaluate(() => window.__setWorkspaces([{ workspaceId: 'workspace-1' }]))
    await apply('翻译校对').click()
    await page.getByText('已新建会话并载入「翻译校对」').waitFor()
    await input().waitFor()
    assert.match(await input().inputValue(), /^你是一位母语级中英翻译与校对/)
    const startCall = await page.evaluate(() => window.calls.find(call => call.type === 'startSession'))
    assert.equal(startCall.workspaceId, undefined)
    assert.equal(startCall.options.whenDraftExists, 'append')
    assert.match(startCall.options.prompt, /^你是一位母语级中英翻译与校对/)

    // A locked composer is reported without mutating the draft.
    const before = await input().inputValue()
    await page.evaluate(() => window.__setPhase('sending'))
    await button('专家').click()
    await apply('深度研究员').click()
    await page.getByText('输入框正在提交，请稍后再应用。').waitFor()
    assert.equal(await page.evaluate(() => window.__getDraft()), before)
    await page.evaluate(() => {
      window.__setPhase('plain')
      window.__setPanel('conversation')
    })
    await input().waitFor()
    assert.equal(await input().inputValue(), before)

    // A changed main session must not be written through a stale composer bridge.
    await button('专家').click()
    const stableDraft = await page.evaluate(() => window.__getDraft())
    await page.evaluate(() => window.__setCurrentSession('session-other'))
    await apply('数据分析师').click()
    await page.getByText('会话输入框正在同步。').waitFor()
    assert.equal(await page.evaluate(() => window.__getDraft()), stableDraft)

    // The original plugin's smoke storage key is untouched by this one.
    const keys = await page.evaluate(() => Object.keys(localStorage))
    assert.ok(keys.includes('@local/dsh-experts:v1'))
    assert.ok(!keys.includes('@local/dsh-todo-list:v1'))

    // Corrupt storage surfaces a recoverable error and the reset restores the seeds.
    await page.evaluate(() => localStorage.setItem('@local/dsh-experts:v1', '{broken'))
    await page.reload()
    await button('专家').click()
    await page.getByText('专家库暂时不可用').waitFor()
    await button('重置专家库').click()
    await page.getByText('本地专家库已重置为内置专家。').waitFor()
    assert.equal(await cards().count(), 10)

    assert.equal(failures.length, 0, failures.map(String).join('\n'))
    console.log('PASS: expert CRUD, search, filters, apply/append/undo, import/export, restore, session fallback and locked composer')
  } finally {
    await browser.close()
  }
}

check().catch(error => {
  console.error(error)
  process.exitCode = 1
})
