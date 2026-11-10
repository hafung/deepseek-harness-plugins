const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')

const plugin = path.resolve(__dirname, '../plugins/dsh-todo-list')
const manifest = JSON.parse(fs.readFileSync(path.join(plugin, 'package.json'), 'utf8'))
const client = fs.readFileSync(path.join(plugin, manifest.exports['./client']), 'utf8')
assert.match(fs.readFileSync(path.join(plugin, manifest.dsh.bundle.patch), 'utf8'), /name: '@local\/dsh-todo-list'/)

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
class Source {
  listeners = new Set();
  constructor(value) { this.value = value; }
  getSnapshot() { return this.value; }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  publish(value) {
    this.value = value;
    for (const listener of this.listeners) listener();
  }
}
const records = JSON.parse(sessionStorage.getItem('host-records') ?? '{}');
const catalog = new Source({ byId: records, phase: 'ready' });
const statuses = new Source(new Map());
window.setHostSession = (id, state) => {
  const { interaction, reason, ...fields } = state;
  records[id] = { ...records[id], ...fields };
  if (reason !== undefined) records[id].reason = reason;
  sessionStorage.setItem('host-records', JSON.stringify(records));
  catalog.publish({ byId: { ...records }, phase: 'ready' });
  const next = new Map(statuses.value);
  next.set(id, { running: fields.running, pendingInteraction: interaction && { kind: interaction } });
  statuses.publish(next);
};
class WorkspaceService {
  workspace = { workspaceId: 'default-id' };
  list = new Source({ archivedSessionIds: [] });
  async initializeDefault() {
    return window.noDefaultWorkspace ? undefined : this.workspace;
  }
}
const ctx = {
  slots: { inject: (key, callback) => callback(), register(options, Component) { slots[options.name] = { options, Component }; } },
  sessions: {
    list: catalog,
    async create(options) {
      calls.push({ type: 'create', ...options });
      window.setHostSession(options.sessionId, { blank: true, running: false, updatedAt: 0 });
      return options.sessionId;
    },
    async using(id, options, callback) {
      if (options.source !== 'controllerOperation') throw Error('Bad retention source');
      return callback({ binding: {
        eventSource: { getSnapshot: () => ({ entries: records[id]?.reason
          ? [{ event: { type: 'turn/end', data: { reason: { kind: records[id].reason } } } }]
          : [{ event: { type: 'turn/start' } }] }) },
        session: {
        getSnapshot: () => ({ openState: 'open' }),
        async prompt(content, mode, signal, requestId) {
          calls.push({ type: 'prompt', id, content, mode, requestId });
          await new Promise(resolve => { window.finishSend = resolve; });
          return window.rejectSend ? { ok: false, error: { message: '队列暂不可用' } } : { ok: true };
        },
        async rename(title) {
          calls.push({ type: 'rename', id, title });
          return { ok: true };
        },
      } } });
    },
  },
  workspaces: new WorkspaceService(),
  uiSession: { sessionStatus: statuses },
  uiWorkspace: { openSession(id) {
    calls.push({ type: 'open', id });
    window.showSession(id);
  } },
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
      h('nav', null, h('button', { onClick: () => setView(value => value === 'todo' ? null : 'todo') },
        h(sidebar.Component, { size: 20 }), sidebar.options.label)),
      view === 'todo' ? h('main', null, h(page.Component, page.options.inject()))
        : view && h('h1', null, '会话 ' + view));
  }
  root.render(h(App));
} };
${client}
`

async function check() {
  const browser = await chromium.launch({ channel: process.env.DSH_SMOKE_BROWSER_CHANNEL })
  try {
    const page = await browser.newPage({ viewport: { width: 920, height: 700 } })
    page.setDefaultTimeout(4000)
    const failures = []
    page.on('pageerror', error => failures.push(error))
    await page.route('https://todo-check.test/**', async route => {
      if (route.request().url().endsWith('/fixture.js')) {
        await route.fulfill({ contentType: 'text/javascript; charset=utf-8', body: fixture })
      } else {
        await route.fulfill({
          contentType: 'text/html; charset=utf-8',
          body: '<meta charset="utf-8"><style>:root{color-scheme:light dark;font:14px system-ui}body{margin:0}nav{padding:12px;border-bottom:1px solid #8884}main{height:calc(100vh - 50px)}</style><div id="root"></div><script src="/fixture.js"></script>',
        })
      }
    })
    const button = name => page.getByRole('button', { name, exact: true })
    const title = () => page.getByLabel('任务名称', { exact: true })
    const task = () => page.locator('li').filter({ hasText: '整理资料' })
    await page.goto('https://todo-check.test/')
    await button('待办清单').click()
    await page.getByRole('heading', { name: '待办清单' }).waitFor()
    await button('新建待办').click()
    await title().fill('  整理资料  ')
    await page.getByLabel('备注（选填）').fill('第一行\n第二行')
    await button('添加待办').click()
    await task().waitFor()
    assert.equal(await task().count(), 1)
    await task().getByRole('button', { name: '编辑' }).click()
    await task().getByLabel('任务名称', { exact: true }).fill('整理资料清单')
    await button('保存修改').click()
    await page.getByText('整理资料清单', { exact: true }).waitFor()
    if (process.env.DSH_SMOKE_SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.DSH_SMOKE_SCREENSHOT_DIR, { recursive: true })
      await page.locator('main').screenshot({
        path: path.join(process.env.DSH_SMOKE_SCREENSHOT_DIR, 'todo-list.png'),
        animations: 'disabled',
      })
    }
    await task().getByRole('checkbox').check()
    await button('待完成').click()
    assert.equal(await task().count(), 0)
    await button('已完成').click()
    await task().getByRole('checkbox').click()
    await task().waitFor({ state: 'detached' })
    await button('全部').click()
    await page.evaluate(() => { window.noDefaultWorkspace = true })
    await task().getByRole('button', { name: '发给主 Agent' }).click()
    await page.getByRole('alert').filter({ hasText: '没有可用的默认工作区' }).waitFor()
    assert.deepEqual(await page.evaluate(() => window.calls), [])
    await page.evaluate(() => { window.noDefaultWorkspace = false })
    await task().getByRole('button', { name: '发给主 Agent' }).click()
    await button('发送中…').waitFor()
    await button('待办清单').click()
    await button('待办清单').click()
    assert.equal(await button('发送中…').isDisabled(), true)
    await page.evaluate(() => { window.rejectSend = true; window.finishSend() })
    await button('重试发送').waitFor()
    const firstCalls = await page.evaluate(() => window.calls)
    assert.equal(firstCalls.length, 2)
    const [firstCreate, firstPrompt] = firstCalls
    assert.equal(firstCreate.workspaceId, 'default-id')
    assert.equal(firstCreate.sessionId, 'session-' + firstPrompt.requestId)
    assert.deepEqual(firstPrompt, {
      type: 'prompt',
      id: firstCreate.sessionId,
      content: [{ type: 'text', text: '请处理这条待办任务。\n\n任务：整理资料清单\n\n备注：\n第一行\n第二行' }],
      mode: 'queue',
      requestId: firstPrompt.requestId,
    })
    await page.reload()
    await button('待办清单').click()
    await button('重试发送').click()
    await button('发送中…').waitFor()
    await page.evaluate(() => window.finishSend())
    await page.getByRole('status').filter({ hasText: '已交给主 Agent' }).waitFor()
    await page.getByRole('heading', { name: '待办清单' }).waitFor()
    assert.deepEqual(await page.evaluate(() => window.calls), [
      firstCreate, firstPrompt, { type: 'rename', id: firstCreate.sessionId, title: '待办：整理资料清单' },
    ])
    assert.equal(await task().getByRole('checkbox').isChecked(), false)
    await task().getByText('已提交', { exact: true }).waitFor()
    await button('新建待办').click()
    await title().fill('需要审批的任务')
    await page.getByLabel('备注（选填）').fill('请先确认执行权限。')
    await button('添加待办').click()
    const approval = page.locator('li').filter({ hasText: '需要审批的任务' })
    await approval.getByRole('button', { name: '发给主 Agent' }).click()
    await approval.getByRole('button', { name: '发送中…' }).waitFor()
    await page.evaluate(() => window.finishSend())
    await approval.getByRole('button', { name: '打开会话' }).waitFor()
    const approvalId = await page.evaluate(() => window.calls.findLast(call => call.type === 'create').sessionId)
    await page.evaluate(([finished, waiting]) => {
      window.setHostSession(finished, { blank: false, running: true, updatedAt: 1 })
      window.setHostSession(waiting, { blank: false, running: true, interaction: 'approval', updatedAt: 1 })
    }, [firstCreate.sessionId, approvalId])
    await task().getByText('执行中', { exact: true }).waitFor()
    await approval.getByText('待审批', { exact: true }).waitFor()
    await page.evaluate(id => window.setHostSession(id, { running: false, reason: 'error' }), firstCreate.sessionId)
    await task().getByText('执行失败', { exact: true }).waitFor()
    await page.evaluate(id => window.setHostSession(id, { running: false, reason: 'completed', updatedAt: 2 }), firstCreate.sessionId)
    await task().getByText('待验收', { exact: true }).waitFor()
    await approval.getByRole('button', { name: '打开会话' }).click()
    await page.getByRole('heading', { name: '会话 ' + approvalId, exact: true }).waitFor()
    await button('待办清单').click()
    await task().getByRole('button', { name: '打开会话' }).click()
    await page.getByRole('heading', { name: '会话 ' + firstCreate.sessionId, exact: true }).waitFor()
    await page.reload()
    await button('待办清单').click()
    await page.getByText('整理资料清单', { exact: true }).waitFor()
    await task().getByText('待验收', { exact: true }).waitFor()
    await task().getByRole('checkbox').check()
    await task().getByText('已完成', { exact: true }).waitFor()
    await button('已完成').click()
    const downloadPromise = page.waitForEvent('download')
    await button('导出 JSON').click()
    const download = await downloadPromise
    assert.match(download.suggestedFilename(), /^dsh-todo-list-\d{4}-\d{2}-\d{2}\.json$/)
    const chunks = []
    for await (const chunk of await download.createReadStream()) chunks.push(chunk)
    const backup = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    assert.equal(backup.format, 'dsh-todo-list')
    assert.equal(backup.version, 1)
    assert.equal(backup.tasks.length, 2)
    const exported = backup.tasks.find(item => item.title === '整理资料清单')
    assert.equal(exported.notes, '第一行\n第二行')
    assert.equal(exported.done, true)
    assert.equal(exported.dispatch.accepted, true)

    await task().getByRole('button', { name: '删除' }).click()
    await button('确认删除').click()
    await task().waitFor({ state: 'detached' })
    assert.equal(await task().count(), 0)
    const pickBackup = content => page.locator('input[type=file]').setInputFiles({
      name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(content)),
    })
    await pickBackup({ ...backup, tasks: [exported, { ...exported, done: 'true' }] })
    await page.getByRole('alert').filter({ hasText: '导入失败' }).waitFor()
    assert.equal(await task().count(), 0)
    const imported = {
      ...backup,
      tasks: [
        ...backup.tasks.map(item => item.id === exported.id ? item : { ...item, title: '备份中的旧名称' }),
        { ...exported, id: '33333333-3333-4333-8333-333333333333', title: '其他电脑的任务', done: false },
      ],
    }
    await pickBackup(imported)
    await page.getByRole('status').filter({ hasText: '已导入 2 条待办，跳过 1 条现有记录' }).waitFor()
    await task().getByRole('button', { name: '打开会话' }).waitFor()
    assert.equal(await task().getByRole('checkbox').isChecked(), true)
    await approval.waitFor()
    await page.locator('li').filter({ hasText: '其他电脑的任务' }).getByRole('button', { name: '发给主 Agent' }).waitFor()
    await pickBackup(imported)
    await page.getByRole('status').filter({ hasText: '已导入 0 条待办，跳过 3 条现有记录' }).waitFor()
    assert.equal(await page.locator('li').count(), 3)
    assert.equal(failures.length, 0, failures.map(String).join('\n'))
    console.log('PASS: task workflow, JSON export, atomic validation, merge, deduplication and portable restore')
  } finally {
    await browser.close()
  }
}

check().catch(error => { console.error(error); process.exitCode = 1 })
