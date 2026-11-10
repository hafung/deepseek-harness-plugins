window.__ModuleLoader__.load({
  id: '@local/dsh-todo-list',
  factory(require) {
    const { createElement: h, useEffect, useRef, useState, useSyncExternalStore } = require('react')
    const panelId = 'local-todo-list'
    const storageKey = '@local/dsh-todo-list:v1'
    const backupFormat = 'dsh-todo-list'
    const emptyList = []

    function readTasks() {
      const raw = localStorage.getItem(storageKey)
      const tasks = raw === null ? emptyList : JSON.parse(raw)
      if (!Array.isArray(tasks) || tasks.some(task =>
        !task || typeof task.id !== 'string' || typeof task.title !== 'string'
        || typeof task.notes !== 'string' || typeof task.done !== 'boolean')) {
        throw new Error('待办存档格式异常')
      }
      return tasks
    }

    function readBackup(text) {
      let backup
      try {
        backup = JSON.parse(text)
      } catch {
        throw new Error('文件内容无法解析为 JSON。')
      }
      if (backup?.format !== backupFormat || backup.version !== 1 || !Array.isArray(backup.tasks)) {
        throw new Error('请选择格式版本为 1 的待办清单备份。')
      }
      const ids = new Set()
      const validText = entry => typeof entry?.title === 'string'
        && entry.title.trim().length > 0 && entry.title.length <= 200
        && typeof entry.notes === 'string' && entry.notes.length <= 8000
      return backup.tasks.map((task, index) => {
        if (typeof task?.id !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(task.id)
          || ids.has(task.id) || !validText(task) || typeof task.done !== 'boolean'
          || (task.dispatch !== undefined && (!validText(task.dispatch) || typeof task.dispatch.accepted !== 'boolean'))) {
          throw new Error(`备份第 ${index + 1} 条待办的数据格式有误，或与其他条目重复。`)
        }
        ids.add(task.id)
        const { id, title, notes, done, dispatch } = task
        return {
          id, title, notes, done,
          ...(dispatch && { dispatch: { title: dispatch.title, notes: dispatch.notes, accepted: dispatch.accepted } }),
        }
      })
    }

    function downloadBackup(tasks) {
      const date = new Date().toISOString()
      const backup = { format: backupFormat, version: 1, exportedAt: date, tasks }
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2) + '\n'], {
        type: 'application/json;charset=utf-8',
      }))
      const link = document.createElement('a')
      link.href = url
      link.download = `dsh-todo-list-${date.slice(0, 10)}.json`
      try {
        link.click()
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 30_000)
      }
    }

    function createTaskStore() {
      const listeners = new Set()
      let snapshot
      let pending = null
      function notify() {
        for (const listener of listeners) listener()
      }
      function reload() {
        try {
          snapshot = { tasks: readTasks(), error: '', pending }
        } catch {
          snapshot = { tasks: emptyList, error: '读取本地待办失败。请检查存储权限或存档。', pending }
        }
        notify()
      }
      function onStorage(event) {
        if (event.key === storageKey || event.key === null) reload()
      }
      reload()
      return {
        getSnapshot: () => snapshot,
        subscribe(listener) {
          listeners.add(listener)
          if (listeners.size === 1) {
            window.addEventListener('storage', onStorage)
            reload()
          }
          return () => {
            listeners.delete(listener)
            if (listeners.size === 0) window.removeEventListener('storage', onStorage)
          }
        },
        update(change) {
          const tasks = change(readTasks())
          localStorage.setItem(storageKey, JSON.stringify(tasks))
          reload()
        },
        setPending(id) {
          pending = id
          snapshot = { ...snapshot, pending }
          notify()
        },
      }
    }

    function TodoIcon({ size = 20 }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.65, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': true,
      },
      h('rect', { x: 4, y: 4, width: 16, height: 16, rx: 4 }),
      h('path', { d: 'm8 12 2.5 2.5L16 9' }))
    }

    function Glyph({ path, size = 16 }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': true,
      }, h('path', { d: path }))
    }

    const icons = {
      plus: 'M12 5v14M5 12h14',
      arrow: 'M7 17 17 7M7 7h10v10',
      send: 'm4 11 16-7-7 16-2-7-7-2Zm7 2 4-4',
      upload: 'M12 16V4m-4 4 4-4 4 4M5 16v4h14v-4',
      download: 'M12 4v12m-4-4 4 4 4-4M5 16v4h14v-4',
    }

    function sessionIdFor(taskId) {
      return `session-${taskId}`
    }

    const interactionLabels = {
      approval: '待审批',
      question: '待回答',
      'plan-review': '计划待审',
    }

    function StatusBadge({ tone, children }) {
      return h('span', {
        className: `dsh-todo-badge dsh-todo-badge--${tone}`,
      }, h('span', { 'aria-hidden': true }), children)
    }

    function SessionBadge({ id, row, live, ready, archived, done, readOutcome }) {
      const [outcome, setOutcome] = useState(null)
      const interaction = live?.pendingInteraction?.kind
      const running = live?.running ?? row?.running
      const revision = row?.updatedAt
      const inspect = ready && Boolean(row) && !archived && !done && !interaction
        && running === false && row.blank === false

      useEffect(() => {
        if (!inspect) return
        const controller = new AbortController()
        readOutcome(id, controller.signal).then(
          result => { if (!controller.signal.aborted) setOutcome({ revision, result }) },
          () => { if (!controller.signal.aborted) setOutcome({ revision, result: 'unknown' }) },
        )
        return () => controller.abort()
      }, [inspect, id, revision, readOutcome])

      if (done) return h(StatusBadge, { tone: 'done' }, '已完成')
      if (archived) return h(StatusBadge, { tone: 'quiet' }, '会话已归档')
      if (interaction) return h(StatusBadge, { tone: 'attention' }, interactionLabels[interaction] ?? '待你处理')
      if (running) return h(StatusBadge, { tone: 'active' }, '执行中')
      if (!ready) return h(StatusBadge, { tone: 'quiet' }, '同步中')
      if (!row) return h(StatusBadge, { tone: 'quiet' }, '会话不可用')
      if (row.blank) return h(StatusBadge, { tone: 'quiet' }, '已提交')

      const result = outcome?.revision === revision ? outcome?.result : undefined
      if (result === 'completed') return h(StatusBadge, { tone: 'review' }, '待验收')
      if (result === 'error' || result === 'max-tokens') return h(StatusBadge, { tone: 'error' }, '执行失败')
      if (result === 'blocked' || result === 'aborted' || result === 'interrupted') {
        return h(StatusBadge, { tone: 'error' }, '执行中断')
      }
      return h(StatusBadge, { tone: 'quiet' }, result ? '待查看' : '读取结果中')
    }

    function TaskForm({ task, save, cancel }) {
      const [title, setTitle] = useState(task?.title ?? '')
      const [notes, setNotes] = useState(task?.notes ?? '')
      return h('form', {
        className: 'dsh-todo-form',
        onSubmit(event) {
          event.preventDefault()
          if (title.trim()) save(title.trim(), notes.trim())
        },
      },
      h('label', null, '任务名称', h('input', {
        required: true, value: title, maxLength: 200, autoFocus: true,
        placeholder: '例如：整理本周的项目笔记',
        onChange: event => setTitle(event.target.value),
      })),
      h('label', null, '备注（选填）', h('textarea', {
        rows: 2, value: notes, maxLength: 8000, placeholder: '补充背景、步骤或交付要求',
        onChange: event => setNotes(event.target.value),
      })),
      h('div', { className: 'dsh-todo-actions' },
        h('button', { type: 'submit', className: 'dsh-todo-primary', disabled: !title.trim() },
          task ? '保存修改' : '添加待办'),
        h('button', { type: 'button', onClick: cancel }, '取消')))
    }

    function TodoPage({ store, sendTask, catalog, status, workspaceList, readOutcome, openSession }) {
      const { tasks, error, pending } = useSyncExternalStore(store.subscribe, store.getSnapshot)
      const sessions = useSyncExternalStore(catalog.subscribe, catalog.getSnapshot)
      const liveStatuses = useSyncExternalStore(status.subscribe, status.getSnapshot)
      const { archivedSessionIds } = useSyncExternalStore(workspaceList.subscribe, workspaceList.getSnapshot)
      const archived = new Set(archivedSessionIds)
      const [adding, setAdding] = useState(false)
      const [filter, setFilter] = useState('all')
      const [editing, setEditing] = useState(null)
      const [deleting, setDeleting] = useState(null)
      const [notice, setNotice] = useState(null)
      const [importing, setImporting] = useState(false)
      const importInput = useRef(null)
      const done = tasks.filter(task => task.done).length
      const visible = tasks.filter(task => filter === 'all' || task.done === (filter === 'done'))

      function changeTasks(change) {
        try {
          store.update(change)
          setNotice(null)
          return true
        } catch {
          setNotice({ error: true, text: '保存待办失败。请检查本地存储空间和权限。' })
          return false
        }
      }

      async function importBackup(event) {
        const input = event.currentTarget
        const file = input.files[0]
        input.value = ''
        if (!file || importing) return
        setImporting(true)
        setNotice(null)
        try {
          const incoming = readBackup(await file.text())
          const localCatalog = catalog.getSnapshot()
          if (localCatalog.phase !== 'ready' && incoming.some(item => item.dispatch)) {
            throw new Error('会话列表正在同步，请稍后重试。')
          }
          const localSessions = localCatalog.byId
          const localArchives = new Set(workspaceList.getSnapshot().archivedSessionIds)
          let imported = 0
          let reassignable = 0
          const saved = changeTasks(items => {
            const existingIds = new Set(items.map(item => item.id))
            const additions = []
            for (const item of incoming) {
              if (existingIds.has(item.id)) continue
              const { dispatch, ...task } = item
              const id = sessionIdFor(task.id)
              if (dispatch && (localSessions[id] || localArchives.has(id))) additions.push(item)
              else {
                if (dispatch) reassignable += 1
                additions.push(task)
              }
            }
            imported = additions.length
            return [...additions, ...items]
          })
          if (saved) {
            setFilter('all')
            setEditing(null)
            setDeleting(null)
            setNotice({ text: `已导入 ${imported} 条待办，跳过 ${incoming.length - imported} 条现有记录。`
              + (reassignable ? `其中 ${reassignable} 条可在本机重新派发。` : '') })
          }
        } catch (error) {
          setNotice({ error: true, text: `导入失败。 ${error?.message ?? String(error)}` })
        } finally {
          setImporting(false)
        }
      }

      async function send(task) {
        if (store.getSnapshot().pending !== null || task.dispatch?.accepted) return
        store.setPending(task.id)
        setEditing(null)
        setDeleting(null)
        setNotice(null)
        try {
          await sendTask(task.id)
          setNotice({ text: '已交给主 Agent。可从任务行打开对应会话。' })
        } catch (error) {
          setNotice({
            error: true,
            text: `发送未确认，可以重试。详情：${error?.message ?? String(error)}`,
          })
        } finally {
          store.setPending(null)
        }
      }

      function renderTask(task) {
        const busy = pending === task.id
        const sent = task.dispatch?.accepted
        const id = sessionIdFor(task.id)
        const row = sessions.byId[id]
        const isArchived = archived.has(id)
        const update = changes => changeTasks(items =>
          items.map(item => item.id === task.id ? { ...item, ...changes } : item))
        return h('li', { key: task.id, className: 'dsh-todo-item' },
          h('div', { className: 'dsh-todo-row' },
            h('input', {
              type: 'checkbox', checked: task.done, disabled: busy,
              'aria-label': `${task.done ? '重新打开' : '完成'} ${task.title}`,
              onChange: () => update({ done: !task.done }),
            }),
            h('div', { className: 'dsh-todo-copy' },
              h('div', { className: 'dsh-todo-item-heading' },
                h('span', { className: task.done ? 'dsh-todo-done' : undefined }, task.title),
                sent ? h(SessionBadge, {
                  id, row, live: liveStatuses.get(id), ready: sessions.phase === 'ready',
                  archived: isArchived, done: task.done, readOutcome,
                }) : task.done ? h(StatusBadge, { tone: 'done' }, '已完成') : null),
              task.notes && h('p', { className: 'dsh-todo-muted' }, task.notes)),
            h('div', { className: 'dsh-todo-actions' },
              sent
                ? h('button', {
                  type: 'button', className: 'dsh-todo-row-primary', disabled: !row || isArchived,
                  onClick() {
                    try { openSession(id) }
                    catch { setNotice({ error: true, text: '会话暂时无法打开，请在 Harness 侧栏中查看。' }) }
                  },
                }, '打开会话', h(Glyph, { path: icons.arrow, size: 13 }))
                : h('button', {
                  type: 'button', className: 'dsh-todo-row-primary', disabled: pending !== null,
                  onClick: () => void send(task),
                }, h(Glyph, { path: icons.send, size: 14 }),
                busy ? '发送中…' : task.dispatch ? '重试发送' : '发给主 Agent'),
              h('button', {
                type: 'button', disabled: busy,
                onClick: () => { setEditing(task.id); setDeleting(null) },
              }, '编辑'),
              h('button', {
                type: 'button', disabled: busy,
                onClick: () => { setDeleting(task.id); setEditing(null) },
              }, '删除'))),
          editing === task.id && h(TaskForm, {
            task, cancel: () => setEditing(null),
            save(title, notes) {
              const saved = update({ title, notes })
              if (saved) setEditing(null)
              return saved
            },
          }),
          deleting === task.id && h('div', { className: 'dsh-todo-confirm' },
            h('p', null, '删除这条待办？'),
            h('div', { className: 'dsh-todo-actions' },
              h('button', {
                type: 'button', className: 'dsh-todo-danger',
                onClick() {
                  if (changeTasks(items => items.filter(item => item.id !== task.id))) setDeleting(null)
                },
              }, '确认删除'),
              h('button', { type: 'button', onClick: () => setDeleting(null) }, '取消'))))
      }

      return h('section', { className: 'dsh-todo-page', 'aria-labelledby': 'dsh-todo-heading' },
        h('style', null, styles),
        h('div', { className: 'dsh-todo-inner' },
          h('header', { className: 'dsh-todo-header' },
            h('div', null,
              h('p', { className: 'dsh-todo-eyebrow' }, h(TodoIcon, { size: 17 }), '个人工作台'),
              h('h1', { id: 'dsh-todo-heading' }, '待办清单'),
              h('p', { className: 'dsh-todo-muted' }, '整理任务，跟进 Agent 的进展与交付。')),
            h('button', {
              type: 'button', className: 'dsh-todo-primary', disabled: Boolean(error),
              'aria-expanded': adding,
              onClick: () => { setAdding(!adding); setEditing(null); setDeleting(null) },
            }, h(Glyph, { path: icons.plus }), '新建待办')),
          error && h('p', { role: 'alert', className: 'dsh-todo-danger' }, error),
          adding && !error && h(TaskForm, {
            cancel: () => setAdding(false),
            save(title, notes) {
              const saved = changeTasks(items => [{ id: crypto.randomUUID(), title, notes, done: false }, ...items])
              if (saved) {
                setAdding(false)
                setFilter('all')
              }
              return saved
            },
          }),
          h('div', { className: 'dsh-todo-toolbar' },
            h('div', { className: 'dsh-todo-filters', role: 'group', 'aria-label': '筛选待办' },
            [['all', '全部', tasks.length], ['open', '待完成', tasks.length - done], ['done', '已完成', done]].map(([value, label, count]) =>
              h('button', {
                key: value, type: 'button', 'aria-pressed': filter === value,
                'aria-label': label,
                onClick: () => { setFilter(value); setEditing(null); setDeleting(null) },
              }, label, h('span', { 'aria-hidden': true }, count)))),
            h('div', { className: 'dsh-todo-backup', role: 'group', 'aria-label': '待办备份' },
              h('input', {
                ref: importInput, type: 'file', accept: '.json,application/json', hidden: true,
                'aria-label': '选择待办 JSON 备份', onChange: event => void importBackup(event),
              }),
              h('button', {
                type: 'button', disabled: Boolean(error) || importing || pending !== null,
                onClick: () => importInput.current.click(),
              }, h(Glyph, { path: icons.upload, size: 15 }), importing ? '导入中…' : '导入 JSON'),
              h('button', {
                type: 'button', disabled: Boolean(error),
                onClick() {
                  try { downloadBackup(store.getSnapshot().tasks) }
                  catch { setNotice({ error: true, text: '无法生成待办备份。' }) }
                },
              }, h(Glyph, { path: icons.download, size: 15 }), '导出 JSON'))),
          notice && h('div', { className: 'dsh-todo-notice' },
            h('p', { role: notice.error ? 'alert' : 'status', className: notice.error ? 'dsh-todo-danger' : '' },
              notice.text)),
          visible.length
            ? h('ul', { className: 'dsh-todo-list' }, visible.map(renderTask))
            : !error && h('div', { className: 'dsh-todo-empty' },
              h('span', { className: 'dsh-todo-empty-mark' }, h(TodoIcon, { size: 24 })),
              h('strong', null, filter === 'all' ? '开始安排你的工作' : '这个分类暂无任务'),
              h('p', { className: 'dsh-todo-muted' },
                filter === 'all' ? '新建一条待办，随时交给 Agent。' : '切换筛选可查看其他待办。'))))
    }

    const styles = `
      .dsh-todo-page {
        --todo-ink:var(--dsw-alias-label-primary, CanvasText);
        --todo-muted:var(--dsw-alias-label-secondary, light-dark(#52616b, #aeb8bc));
        --todo-line:color-mix(in srgb, var(--todo-ink) 11%, transparent);
        --todo-accent:light-dark(#26534c, #b7e0d2);
        --todo-hover:color-mix(in srgb, var(--todo-ink) 5%, transparent);
        --todo-surface:var(--dsw-alias-bg-layer-1, Canvas);
        container:dsh-todo / inline-size;
        height:100%; min-height:0; overflow:auto; color:var(--todo-ink);
        font-size:14px; line-height:1.5;
      }
      .dsh-todo-inner { box-sizing:border-box; max-width:920px; margin-inline:auto; padding:clamp(28px, 6cqw, 64px) clamp(18px, 6cqw, 58px) 54px; }
      .dsh-todo-header { display:flex; justify-content:space-between; align-items:flex-end; gap:18px; margin-bottom:34px; }
      .dsh-todo-header h1 { margin:10px 0 8px; font-size:clamp(29px, 5.5cqw, 43px); line-height:1.14; font-weight:680; letter-spacing:-.025em; }
      .dsh-todo-page p { margin:0; }
      .dsh-todo-muted { color:var(--todo-muted); }
      .dsh-todo-eyebrow { display:flex; align-items:center; gap:8px; color:var(--todo-accent); font-size:12px; font-weight:650; letter-spacing:.09em; }
      .dsh-todo-page button, .dsh-todo-page input:not([type=checkbox]), .dsh-todo-page textarea {
        box-sizing:border-box; font:inherit; color:inherit; background:transparent; border:0; border-radius:8px;
      }
      .dsh-todo-page button {
        display:inline-flex; align-items:center; justify-content:center; gap:6px;
        padding:6px 9px; cursor:pointer; min-height:34px; white-space:nowrap;
        font-size:12px; font-weight:550; transition:background-color .15s ease, color .15s ease;
      }
      .dsh-todo-page button:hover:not(:disabled) { background:var(--todo-hover); }
      .dsh-todo-page button:disabled { opacity:.45; cursor:default; }
      .dsh-todo-page button.dsh-todo-primary {
        padding:8px 13px; min-height:38px; color:light-dark(#fff, #173731); background:var(--todo-accent);
      }
      .dsh-todo-page button.dsh-todo-primary:hover:not(:disabled) {
        background:color-mix(in srgb, var(--todo-accent) 86%, var(--todo-surface));
      }
      .dsh-todo-page button.dsh-todo-row-primary { color:var(--todo-accent); }
      .dsh-todo-page input:not([type=checkbox]), .dsh-todo-page textarea {
        width:100%; padding:9px 11px; background:var(--todo-surface); border:1px solid var(--todo-line); font-weight:400;
      }
      .dsh-todo-page textarea { resize:vertical; }
      .dsh-todo-page :focus-visible { outline:2px solid var(--todo-accent); outline-offset:2px; }
      .dsh-todo-form, .dsh-todo-confirm { display:grid; gap:12px; }
      .dsh-todo-form label { display:grid; gap:6px; font-size:13px; font-weight:550; }
      .dsh-todo-inner > .dsh-todo-form { padding:18px; margin-bottom:20px; border:1px solid var(--todo-line); border-radius:14px; }
      .dsh-todo-toolbar { display:flex; justify-content:space-between; align-items:center; gap:8px 12px; flex-wrap:wrap; margin-bottom:14px; }
      .dsh-todo-backup { display:flex; gap:4px; color:var(--todo-muted); }
      .dsh-todo-filters, .dsh-todo-actions { display:flex; gap:3px; flex-wrap:wrap; align-items:center; }
      .dsh-todo-filters { display:inline-flex; padding:4px; border:1px solid var(--todo-line); border-radius:11px; }
      .dsh-todo-filters button { color:var(--todo-muted); min-height:30px; padding-inline:10px; }
      .dsh-todo-filters button[aria-pressed=true] { color:var(--todo-ink); background:var(--todo-hover); }
      .dsh-todo-filters button span { font-variant-numeric:tabular-nums; font-size:11px; opacity:.8; }
      .dsh-todo-notice { padding:10px 13px; margin:0 0 12px; border-radius:9px; background:var(--todo-hover); }
      .dsh-todo-notice p { overflow-wrap:anywhere; font-size:13px; }
      .dsh-todo-danger { color:var(--dsw-alias-state-error-primary, #a03938) !important; }
      .dsh-todo-list { list-style:none; padding:0; margin:0; border:1px solid var(--todo-line); border-radius:15px; overflow:clip; }
      .dsh-todo-item { padding:14px 14px 14px 17px; }
      .dsh-todo-item + .dsh-todo-item { border-top:1px solid var(--todo-line); }
      .dsh-todo-row { display:grid; grid-template-columns:19px minmax(0, 1fr) auto; gap:11px; align-items:start; }
      .dsh-todo-row input[type=checkbox] { margin:8px 0 0; width:16px; height:16px; accent-color:var(--todo-accent); cursor:pointer; }
      .dsh-todo-row > .dsh-todo-actions { color:var(--todo-muted); }
      .dsh-todo-copy { min-width:0; padding-top:6px; overflow-wrap:anywhere; }
      .dsh-todo-item-heading { display:flex; flex-wrap:wrap; align-items:center; gap:6px 10px; font-weight:600; }
      .dsh-todo-copy p { white-space:pre-wrap; font-size:13px; margin-top:4px; }
      .dsh-todo-done { text-decoration:line-through; color:var(--todo-muted); }
      .dsh-todo-badge {
        --badge-ink:var(--todo-muted); display:inline-flex; flex:none; align-items:center; gap:5px;
        border-radius:999px; padding:2px 7px; font-size:11px; font-weight:620; color:var(--badge-ink);
        background:color-mix(in srgb, var(--badge-ink) 11%, transparent);
      }
      .dsh-todo-badge > span { width:5px; height:5px; border-radius:50%; background:currentColor; }
      .dsh-todo-badge--attention { --badge-ink:light-dark(#925218, #ffbd79); }
      .dsh-todo-badge--active { --badge-ink:light-dark(#2458a0, #a7c7fb); }
      .dsh-todo-badge--review, .dsh-todo-badge--done { --badge-ink:var(--todo-accent); }
      .dsh-todo-badge--error { --badge-ink:light-dark(#a03938, #ffaba6); }
      .dsh-todo-item > .dsh-todo-form, .dsh-todo-item > .dsh-todo-confirm { margin:12px 0 0 30px; }
      .dsh-todo-empty { display:grid; justify-items:center; gap:6px; text-align:center; padding:44px 16px; border:1px dashed var(--todo-line); border-radius:15px; }
      .dsh-todo-empty-mark { display:grid; place-items:center; width:43px; height:43px; margin-bottom:7px; border-radius:13px; color:var(--todo-accent); background:var(--todo-hover); }
      @container dsh-todo (max-width:500px) {
        .dsh-todo-header { align-items:flex-start; margin-bottom:23px; }
        .dsh-todo-header > button { margin-top:23px; }
        .dsh-todo-row { grid-template-columns:19px minmax(0, 1fr); gap:5px 8px; }
        .dsh-todo-row > .dsh-todo-actions { grid-column:2; margin-left:-8px; }
      }
      @media (prefers-reduced-motion:reduce) { .dsh-todo-page button { transition:none; } }
    `

    function boundSource(source) {
      return {
        subscribe: listener => source.subscribe(listener),
        getSnapshot: () => source.getSnapshot(),
      }
    }

    return {
      inject: ['slots', 'sessions', 'workspaces', 'uiSession', 'uiWorkspace'],
      apply(ctx) {
        const store = createTaskStore()
        const sessions = ctx.sessions
        const workspaces = ctx.workspaces
        const face = {
          store,
          catalog: boundSource(sessions.list),
          status: boundSource(ctx.uiSession.sessionStatus),
          workspaceList: boundSource(workspaces.list),
          openSession: id => ctx.uiWorkspace.openSession(id),
          readOutcome: (id, signal) => sessions.using(id, { source: 'controllerOperation', signal }, reference => {
            const { session, eventSource } = reference.binding
            if (session.getSnapshot().openState !== 'open') return 'unknown'
            const terminal = eventSource.getSnapshot().entries.findLast(({ event }) =>
              event.type === 'turn/start' || event.type === 'turn/end')
            return terminal?.event.type === 'turn/end' ? terminal.event.data.reason.kind : 'unknown'
          }),
          async sendTask(taskId) {
            const task = store.getSnapshot().tasks.find(item => item.id === taskId)
            if (!task) throw new Error('这条待办已被删除')
            if (task.dispatch?.accepted) return
            const workspace = await workspaces.initializeDefault()
            if (!workspace) throw new Error('当前配置没有可用的默认工作区')
            // Stable IDs make both creation and queue admission safe to retry.
            const id = await sessions.create({
              workspaceId: workspace.workspaceId, sessionId: sessionIdFor(task.id),
            })
            const dispatch = task.dispatch ?? { title: task.title, notes: task.notes, accepted: false }
            if (!task.dispatch) {
              store.update(items => items.map(item => item.id === taskId ? { ...item, dispatch } : item))
            }
            const text = [
              '请处理这条待办任务。',
              '',
              `任务：${dispatch.title}`,
              ...(dispatch.notes ? ['', '备注：', dispatch.notes] : []),
            ].join('\n')
            await sessions.using(id, { source: 'controllerOperation' }, async reference => {
              const session = reference.binding.session
              const result = await session.prompt([{ type: 'text', text }], 'queue', undefined, taskId)
              if (!result.ok) throw new Error(result.error.message)
              store.update(items => items.map(item =>
                item.id === taskId ? { ...item, dispatch: { ...dispatch, accepted: true } } : item))
              // Harness can still generate its own title if the rename fails.
              const title = `待办：${Array.from(dispatch.title).slice(0, 48).join('')}`
              try {
                const renamed = await session.rename(title)
                if (!renamed.ok) console.warn('[dsh-todo-list] session rename failed:', renamed.error)
              } catch (error) {
                console.warn('[dsh-todo-list] session rename failed:', error)
              }
            })
          },
        }
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main', key: panelId, inject: () => face,
        }, TodoPage))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: panelId, order: 20, label: '待办清单',
        }, TodoIcon))
      },
    }
  },
})
