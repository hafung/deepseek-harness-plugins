window.__ModuleLoader__.load({
  id: '@local/dsh-tracks',
  factory(require) {
    const {
      Fragment,
      createElement: h,
      useCallback,
      useEffect,
      useRef,
      useState,
    } = require('react')

    const NS = 'dsh-tracks'
    const API = '/api/plugins/tracks'
    const SEEN_KEY = '@local/dsh-tracks:seen:v1'
    const HEARTBEAT_MS = 30000
    const POLL_MS = 20000
    const NOTICE_MS = 7000
    const SLOT = 'sidebar.footer.action'
    const OVERLAY_SLOT = 'shell.overlay'

    // ---------------------------------------------------------------- format

    function pad2(value) {
      return String(value).padStart(2, '0')
    }

    function fmtInt(value) {
      const number = Math.round(Number(value) || 0)
      return String(number).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    }

    function trim(number) {
      const fixed = number >= 100 ? number.toFixed(0) : number >= 10 ? number.toFixed(1) : number.toFixed(2)
      return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
    }

    function fmtCount(value) {
      const number = Number(value) || 0
      if (number < 1000) return String(Math.round(number))
      if (number < 1_000_000) return `${trim(number / 1000)}k`
      if (number < 1_000_000_000) return `${trim(number / 1_000_000)}M`
      return `${trim(number / 1_000_000_000)}B`
    }

    function fmtDuration(ms) {
      const value = Math.max(0, Number(ms) || 0)
      const minutes = value / 60_000
      if (minutes < 1) return `${Math.max(1, Math.round(value / 1000))}s`
      if (minutes < 90) return `${Math.round(minutes)}m`
      const hours = value / 3_600_000
      if (hours < 10) return `${hours.toFixed(1)}h`
      return `${Math.round(hours)}h`
    }

    function fmtClock(minuteOfDay) {
      const total = Math.max(0, Math.min(1439, Math.round(Number(minuteOfDay) || 0)))
      return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`
    }

    function fmtMonthDay(at) {
      const value = Number(at)
      if (!Number.isFinite(value) || value <= 0) return ''
      const date = new Date(value)
      return `${date.getMonth() + 1}-${pad2(date.getDate())}`
    }

    function fmtStamp(at) {
      const value = Number(at)
      if (!Number.isFinite(value) || value <= 0) return ''
      const date = new Date(value)
      return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
    }

    function fmtRecordValue(definition, record, t) {
      if (!record) return '—'
      const value = Number(record.value) || 0
      switch (definition.unit) {
        case 'tokens':
          return fmtCount(value)
        case 'xp':
          return `${fmtInt(value)} XP`
        case 'clock':
          return fmtClock(value)
        case 'duration':
          return fmtDuration(value)
        default: {
          const unit = definition.unitSuffix === 'turns'
            ? t('unit.turns')
            : definition.unitSuffix === 'kinds' ? t('unit.kinds') : t('unit.sessions')
          return `${fmtInt(value)} ${unit}`
        }
      }
    }

    function fill(template, values) {
      return String(template).replace(/\{(\w+)\}/g, (match, name) => (
        values !== undefined && values[name] !== undefined ? String(values[name]) : match
      ))
    }

    // ----------------------------------------------------------------- locale

    const DICT = {
      zh: {
        'badge.title': '航迹',
        'badge.aria': '航迹：Lv.{level} {name}',
        'panel.aria': '航迹面板',
        'panel.level': 'Lv.{level}',
        'panel.progress': '{xp} / {next}',
        'panel.maxed': '深空 · {xp} XP',
        'panel.star': '★',
        'panel.todayXp': '今日 +{xp} XP',
        'panel.streak': '连击 {days} 天',
        'panel.streakNone': '还没连击',
        'panel.records': '纪录 {owned}/{total}',
        'personality.head': '航行人格',
        'personality.hint': '近 90 天的时段 × 节奏 × 协作 × 广度',
        'personality.empty': '再跑几轮，这张画像就会显形。',
        'title.day.short': '白日快枪手',
        'title.day.long': '长线工程师',
        'title.night.short': '夜行突击队',
        'title.night.long': '深夜总指挥',
        'axis.period.day': '白昼',
        'axis.period.night': '夜航',
        'axis.period.deepNight': '极夜',
        'axis.pace.short': '短打',
        'axis.pace.long': '长跑',
        'axis.team.solo': '独行',
        'axis.team.command': '指挥',
        'axis.breadth.narrow': '专精',
        'axis.breadth.wide': '博采',
        'axis.detail.period': '22:00–05:00 的开口占 {pct}',
        'axis.detail.pace': '平均每条会话 {turns} 轮',
        'axis.detail.team': '每条会话 {count} 次派出',
        'axis.detail.breadth': '用过 {count} 种工具',
        'hours.from': '00',
        'hours.to': '23',
        'totals.sessions': '会话',
        'totals.turns': '轮次',
        'totals.out': '产出',
        'totals.companion': '陪伴',
        'totals.online': '在场',
        'totals.tools': '工具',
        'totals.sub.online': '在场 {value}',
        'totals.sub.tools': '工具 {n} 种',
        'totals.sub.total': '总量 {value}',
        'totals.hint.sessions': '按会话 id 去重，主会话与子代理分开计。',
        'totals.hint.turns': 'turn/end 计数，含失败与取消。',
        'totals.hint.out': 'output token，副指标才是包含 cache 的总量。',
        'totals.hint.companion': '有事件活动的时间聚类，间隔超过 10 分钟切段。',
        'totals.hint.online': '页面可见时的客户端心跳，单次上限 10 分钟。',
        'totals.hint.tools': '去重后的工具名数量。',
        'records.head': '航迹纪录',
        'records.empty': '还没有纪录，先跑一轮。',
        'records.owned': '已破 {owned}/{total}',
        'unit.turns': '轮',
        'unit.kinds': '种',
        'unit.sessions': '条',
        'record.longestSession': '最长会话',
        'record.heaviestSession': '最重会话',
        'record.bestDay': '单日最高',
        'record.latestNight': '最晚时刻',
        'record.focusBlock': '最长专注',
        'record.tooliestSession': '工具最多',
        'record.mostSessionsDay': '单日会话',
        'record.fastestLevel': '最快升级',
        'record.hint.longestSession': '单条会话里结束的轮次数量。',
        'record.hint.heaviestSession': '单条会话的 output token；副行是总 token。',
        'record.hint.bestDay': '按天累计的 XP 峰值。',
        'record.hint.latestNight': '00:00–06:00 之间你亲手发消息的最晚时刻。',
        'record.hint.focusBlock': '相邻事件间隔都小于 10 分钟的最长连续段。',
        'record.hint.tooliestSession': '单条会话里调用过的不同工具种类数。',
        'record.hint.mostSessionsDay': '同一天里活跃过的会话数量。',
        'record.hint.fastestLevel': '相邻两级之间耗时最短的一次。',
        'medals.head': '任务徽章',
        'medals.count': '{owned}/{total}',
        'medal.firstTurn.label': '首航',
        'medal.firstTurn.detail': '完成第一轮对话。',
        'medal.tenSessions.label': '十次出航',
        'medal.tenSessions.detail': '累计 10 条会话。',
        'medal.hundredTurns.label': '百轮',
        'medal.hundredTurns.detail': '累计 100 轮对话。',
        'medal.millionOutput.label': '百万产出',
        'medal.millionOutput.detail': 'output token 累计到 100 万。',
        'medal.toolbox.label': '工具箱',
        'medal.toolbox.detail': '用过 8 种不同工具。',
        'medal.wideReader.label': '博采',
        'medal.wideReader.detail': '用过 12 种不同工具。',
        'medal.nightOwl.label': '夜航者',
        'medal.nightOwl.detail': '5 次在 00:00–05:00 开口。',
        'medal.streakWeek.label': '七日连击',
        'medal.streakWeek.detail': '连续 7 天有对话。',
        'medal.streakMonth.label': '满月连击',
        'medal.streakMonth.detail': '连续 30 天有对话。',
        'medal.deepFocus.label': '九十分钟',
        'medal.deepFocus.detail': '单个专注段超过 90 分钟。',
        'medal.commander.label': '指挥家',
        'medal.commander.detail': '累计派出 10 个子代理或工作流。',
        'medal.deepSpace.label': '深空',
        'medal.deepSpace.detail': '抵达第 10 级 深空。',
        'medal.locked': '未解锁 · {detail}',
        'medal.unlocked': '{label} · {date} 解锁',
        'action.share': '分享卡',
        'action.share.hint': '导出 3:4 的 PNG',
        'action.backfill': '重扫历史',
        'action.backfill.hint': '重新扫描本机所有会话日志，把安装前的、以及插件停用期间的会话补进账本。没有新数据时会显示「无新增」。',
        'action.backfill.cancelHint': '停止这次扫描',
        'action.cancel': '取消',
        'help.button': '这些数字是怎么算的',
        'backfill.progress': '扫描中 {done}/{total}',
        'backfill.scanned': '已扫描 {n} 条会话',
        'backfill.added': '新增 {n} 条',
        'backfill.nochange': '无新增',
        'backfill.cancelled': '已取消',
        'backfill.error': '扫描失败：{message}',
        'backfill.unavailable': '当前环境没有 sessionQuery，无法扫描',
        'backfill.failed': '{n} 条跳过',
        'help.title': '这些数字怎么算的',
        'help.total': '总 token ≠ 账单：包含 cache 命中，1M 上下文聊几十轮就能到亿级。',
        'help.output': '有效产出 = outputTokens，这才是「写了多少东西」。',
        'help.companion': '陪伴时长 = 有事件活动的时间聚类，不是工时。',
        'help.online': '在场时长 = 页面可见 + 心跳，关掉页面就停。',
        'help.records': '纪录只和你自己的过去比，破了会弹一次。',
        'notice.newRecord': '新纪录 · {label}',
        'error.load': '读取失败：{message}',
        'state.loading': '读取中…',
        'share.saved': '分享卡已导出',
        'share.blocked': '导出被浏览器拦截',
        'share.title': '航迹',
        'share.personality': '航行人格',
        'share.records': '航迹纪录',
        'share.footer': 'DeepSeek Harness · 航迹',
        'share.medals': '徽章',
        'share.level': 'Lv.{level}',
        'share.xp': '{xp} / {next}',
      },
      en: {
        'badge.title': 'Tracks',
        'badge.aria': 'Tracks: Lv.{level} {name}',
        'panel.aria': 'Tracks panel',
        'panel.level': 'Lv.{level}',
        'panel.progress': '{xp} / {next}',
        'panel.maxed': 'Deep space · {xp} XP',
        'panel.star': '★',
        'panel.todayXp': '+{xp} XP today',
        'panel.streak': '{days}-day streak',
        'panel.streakNone': 'No streak yet',
        'panel.records': 'Records {owned}/{total}',
        'personality.head': 'Voyage persona',
        'personality.hint': 'Last 90 days: hours × pace × teamwork × breadth',
        'personality.empty': 'A few more turns and this profile appears.',
        'title.day.short': 'Daylight quickdraw',
        'title.day.long': 'Long-haul engineer',
        'title.night.short': 'Night raid unit',
        'title.night.long': 'Midnight commander',
        'axis.period.day': 'Daylight',
        'axis.period.night': 'Night',
        'axis.period.deepNight': 'Deep night',
        'axis.pace.short': 'Short bursts',
        'axis.pace.long': 'Long runs',
        'axis.team.solo': 'Solo',
        'axis.team.command': 'Commanding',
        'axis.breadth.narrow': 'Focused',
        'axis.breadth.wide': 'Broad',
        'axis.detail.period': '{pct} of messages between 22:00 and 05:00',
        'axis.detail.pace': '{turns} turns per session',
        'axis.detail.team': '{count} delegations per session',
        'axis.detail.breadth': '{count} distinct tools used',
        'hours.from': '00',
        'hours.to': '23',
        'totals.sessions': 'sessions',
        'totals.turns': 'turns',
        'totals.out': 'output',
        'totals.companion': 'with you',
        'totals.online': 'on screen',
        'totals.tools': 'tools',
        'totals.sub.online': 'on screen {value}',
        'totals.sub.tools': '{n} tools',
        'totals.sub.total': 'total {value}',
        'totals.hint.sessions': 'Distinct session ids; main sessions and subagents counted separately.',
        'totals.hint.turns': 'Every turn/end, including failed and cancelled turns.',
        'totals.hint.out': 'Output tokens; the cache-heavy total is the secondary number.',
        'totals.hint.companion': 'Activity clusters, split when two events are more than 10 minutes apart.',
        'totals.hint.online': 'Visible-page heartbeat, capped at 10 minutes per tick.',
        'totals.hint.tools': 'Distinct tool names used.',
        'records.head': 'Records',
        'records.empty': 'No records yet — run a turn.',
        'records.owned': '{owned}/{total} set',
        'unit.turns': 'turns',
        'unit.kinds': 'kinds',
        'unit.sessions': 'sessions',
        'record.longestSession': 'Longest session',
        'record.heaviestSession': 'Heaviest session',
        'record.bestDay': 'Best day',
        'record.latestNight': 'Latest night',
        'record.focusBlock': 'Longest focus',
        'record.tooliestSession': 'Most tools',
        'record.mostSessionsDay': 'Busiest day',
        'record.fastestLevel': 'Fastest level',
        'record.hint.longestSession': 'Turns closed inside one session.',
        'record.hint.heaviestSession': 'Output tokens of one session; the sub-line is the cache-heavy total.',
        'record.hint.bestDay': 'Highest XP the ledger booked in one day.',
        'record.hint.latestNight': 'Latest moment you sent a message between 00:00 and 06:00.',
        'record.hint.focusBlock': 'Longest run of events that never paused for 10 minutes.',
        'record.hint.tooliestSession': 'Distinct tool kinds called inside one session.',
        'record.hint.mostSessionsDay': 'Sessions active on the same day.',
        'record.hint.fastestLevel': 'Shortest time between two adjacent levels.',
        'medals.head': 'Task medals',
        'medals.count': '{owned}/{total}',
        'medal.firstTurn.label': 'First light',
        'medal.firstTurn.detail': 'Finish your first turn.',
        'medal.tenSessions.label': 'Ten voyages',
        'medal.tenSessions.detail': 'Reach 10 sessions.',
        'medal.hundredTurns.label': 'Hundred turns',
        'medal.hundredTurns.detail': 'Reach 100 turns.',
        'medal.millionOutput.label': 'Million output',
        'medal.millionOutput.detail': 'Write 1,000,000 output tokens.',
        'medal.toolbox.label': 'Toolbox',
        'medal.toolbox.detail': 'Use 8 distinct tools.',
        'medal.wideReader.label': 'Wide reader',
        'medal.wideReader.detail': 'Use 12 distinct tools.',
        'medal.nightOwl.label': 'Night owl',
        'medal.nightOwl.detail': 'Speak five times between 00:00 and 05:00.',
        'medal.streakWeek.label': 'Seven-day streak',
        'medal.streakWeek.detail': 'Seven consecutive days with a turn.',
        'medal.streakMonth.label': 'Month streak',
        'medal.streakMonth.detail': 'Thirty consecutive days with a turn.',
        'medal.deepFocus.label': 'Ninety minutes',
        'medal.deepFocus.detail': 'One focus block longer than 90 minutes.',
        'medal.commander.label': 'Commander',
        'medal.commander.detail': 'Dispatch 10 subagents or workflows.',
        'medal.deepSpace.label': 'Deep space',
        'medal.deepSpace.detail': 'Reach level 10.',
        'medal.locked': 'Locked · {detail}',
        'medal.unlocked': '{label} · unlocked {date}',
        'action.share': 'Share card',
        'action.share.hint': 'Export a 3:4 PNG',
        'action.backfill': 'Rescan history',
        'action.backfill.hint': 'Re-read every local session log and fold in what this ledger has not seen — sessions from before the install, or from while the plugin was disabled. A second run reports "no new sessions".',
        'action.backfill.cancelHint': 'Stop this scan',
        'action.cancel': 'Cancel',
        'help.button': 'How these numbers are counted',
        'backfill.progress': 'Scanning {done}/{total}',
        'backfill.scanned': '{n} sessions scanned',
        'backfill.added': '{n} new',
        'backfill.nochange': 'nothing new',
        'backfill.cancelled': 'Cancelled',
        'backfill.error': 'Scan failed: {message}',
        'backfill.unavailable': 'sessionQuery is unavailable here',
        'backfill.failed': '{n} skipped',
        'help.title': 'How these numbers are counted',
        'help.total': 'Total tokens ≠ your bill: they include cache hits, so a 1M context reaches hundreds of millions.',
        'help.output': 'Effective output = outputTokens, the amount of text actually written.',
        'help.companion': 'Companion time clusters activity; it is not working hours.',
        'help.online': 'On-screen time counts a visible page heartbeat and stops when the page closes.',
        'help.records': 'Records only compare you with your past self; breaking one shows a single toast.',
        'notice.newRecord': 'New record · {label}',
        'error.load': 'Read failed: {message}',
        'state.loading': 'Reading…',
        'share.saved': 'Share card exported',
        'share.blocked': 'The browser blocked the download',
        'share.title': 'Tracks',
        'share.personality': 'VOYAGE PERSONA',
        'share.records': 'RECORDS',
        'share.footer': 'DeepSeek Harness · Tracks',
        'share.medals': 'MEDALS',
        'share.level': 'Lv.{level}',
        'share.xp': '{xp} / {next}',
      },
    }

    function makeT(translate) {
      return (key, values) => {
        let text
        try {
          text = translate(key)
        } catch {
          text = key
        }
        if (typeof text !== 'string' || text === key) {
          text = DICT.zh[key] ?? DICT.en[key] ?? key
        }
        return values === undefined ? text : fill(text, values)
      }
    }

    // ------------------------------------------------------------------ data

    function readSeenAt() {
      try {
        const raw = Number(localStorage.getItem(SEEN_KEY))
        if (Number.isFinite(raw) && raw > 0) return raw
      } catch {
        // Storage can be unavailable; the toast then simply shows once per mount.
      }
      const now = Date.now()
      try {
        localStorage.setItem(SEEN_KEY, String(now))
      } catch {
        // Ignore.
      }
      return now
    }

    function writeSeenAt(value) {
      try {
        localStorage.setItem(SEEN_KEY, String(value))
      } catch {
        // Ignore.
      }
    }

    // ------------------------------------------------------------ data store

    // The badge (sidebar foot) and the panel (frame-wide overlay) are two
    // separate slot entries, so their state lives in two tiny stores instead of
    // a React tree. The overlay is the only place that can host the panel: the
    // sidebar column clips its own overflow and owns its stacking context.
    const data = {
      state: null,
      error: '',
      loading: true,
      busy: false,
      listeners: new Set(),
      timer: null,
      users: 0,
      open: false,
    }

    function emitData() {
      for (const listener of [...data.listeners]) listener()
    }

    async function loadData() {
      if (data.busy) return
      data.busy = true
      try {
        const response = await fetch(`${API}/state`, { headers: { accept: 'application/json' } })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload = await response.json()
        if (payload && payload.ok === true) {
          data.state = payload
          data.error = ''
        } else {
          data.error = String(payload?.error ?? 'bad payload')
        }
      } catch (cause) {
        data.error = String(cause?.message ?? cause)
      } finally {
        data.busy = false
        data.loading = false
        emitData()
      }
    }

    function startPolling() {
      data.users += 1
      if (data.users === 1) {
        void loadData()
        data.timer = setInterval(() => {
          if (data.open || (typeof document !== 'undefined' && document.visibilityState === 'visible')) {
            void loadData()
          }
        }, POLL_MS)
      }
      return () => {
        data.users -= 1
        if (data.users <= 0 && data.timer !== null) {
          clearInterval(data.timer)
          data.timer = null
          data.users = 0
        }
      }
    }

    function useData() {
      const [snapshot, setSnapshot] = useState(() => ({ state: data.state, error: data.error, loading: data.loading }))
      useEffect(() => {
        const listener = () => setSnapshot({ state: data.state, error: data.error, loading: data.loading })
        data.listeners.add(listener)
        const stop = startPolling()
        return () => {
          data.listeners.delete(listener)
          stop()
        }
      }, [])
      return { ...snapshot, reload: loadData }
    }

    const overlay = {
      open: false,
      anchor: null,
      listeners: new Set(),
    }

    function emitOverlay() {
      for (const listener of [...overlay.listeners]) listener()
    }

    function setOverlayOpen(next) {
      const value = Boolean(next)
      if (overlay.open === value) return
      overlay.open = value
      data.open = value
      if (value) void loadData()
      emitOverlay()
    }

    function useOverlayOpen() {
      const [open, setOpen] = useState(overlay.open)
      useEffect(() => overlay.subscribe(() => setOpen(overlay.open)), [])
      return open
    }

    overlay.subscribe = listener => {
      overlay.listeners.add(listener)
      return () => {
        overlay.listeners.delete(listener)
      }
    }

    function useLocaleRevision(locale) {
      const [revision, setRevision] = useState(0)
      useEffect(() => {
        if (locale === undefined || typeof locale.subscribe !== 'function') return undefined
        return locale.subscribe(() => setRevision(value => value + 1))
      }, [locale])
      return revision
    }

    // ------------------------------------------------------------ medal art

    // Built-in placeholder glyphs, one per badge. They use `currentColor`, so a
    // locked badge is a muted outline and an unlocked one takes the brand color
    // without a second asset set. Drop `medals/<id>.svg|png` into the package to
    // override any of them — the Host then sends `icon` in `/state`.
    const MEDAL_GLYPHS = {
      firstTurn: [
        { t: 'p', d: 'M24 13.5v18' },
        { t: 'p', d: 'M16.8 20.7 24 13.5l7.2 7.2' },
        { t: 'p', d: 'M17.5 33.5h13' },
      ],
      tenSessions: [
        { t: 'c', x: 10.5, y: 19.5, r: 1.9, f: true },
        { t: 'c', x: 17.2, y: 19.5, r: 1.9, f: true },
        { t: 'c', x: 24, y: 19.5, r: 1.9, f: true },
        { t: 'c', x: 30.8, y: 19.5, r: 1.9, f: true },
        { t: 'c', x: 37.5, y: 19.5, r: 1.9, f: true },
        { t: 'c', x: 10.5, y: 28.5, r: 1.9, f: true },
        { t: 'c', x: 17.2, y: 28.5, r: 1.9, f: true },
        { t: 'c', x: 24, y: 28.5, r: 1.9, f: true },
        { t: 'c', x: 30.8, y: 28.5, r: 1.9, f: true },
        { t: 'c', x: 37.5, y: 28.5, r: 1.9, f: true },
      ],
      hundredTurns: [
        { t: 'p', d: 'M33.4 17.2A11.6 11.6 0 1 0 35.6 24' },
        { t: 'p', d: 'M32.6 20.6 35.7 24 32.6 27.4' },
        { t: 'c', x: 24, y: 24, r: 2, f: true },
      ],
      millionOutput: [
        { t: 'p', d: 'M15.5 32.5v-6' },
        { t: 'p', d: 'M24 32.5v-12' },
        { t: 'p', d: 'M32.5 32.5v-17' },
      ],
      toolbox: [
        { t: 'p', d: 'M13.5 22h21v11h-21z' },
        { t: 'p', d: 'M19.5 22v-3.2a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2V22' },
        { t: 'p', d: 'M13.5 27h21' },
      ],
      wideReader: [
        { t: 'p', d: 'M24 34.5v-19' },
        { t: 'p', d: 'M24 34.5 15.5 19.5' },
        { t: 'p', d: 'M24 34.5 32.5 19.5' },
        { t: 'p', d: 'M24 34.5 12 26' },
        { t: 'p', d: 'M24 34.5 36 26' },
      ],
      nightOwl: [
        { t: 'p', d: 'M31.6 29.4a10.6 10.6 0 1 1-9.8-15 8.8 8.8 0 0 0 9.8 15Z' },
        { t: 'c', x: 33.4, y: 15.4, r: 1.7, f: true },
      ],
      streakWeek: [
        { t: 'p', d: 'M16.5 24.4 21.6 29.6 31.7 18.6' },
      ],
      streakMonth: [
        { t: 'p', d: 'M15.5 19.5h17v13.2h-17z' },
        { t: 'p', d: 'M15.5 24h17' },
        { t: 'p', d: 'M20 15.8v4' },
        { t: 'p', d: 'M28 15.8v4' },
      ],
      deepFocus: [
        { t: 'c', x: 24, y: 24, r: 11.5 },
        { t: 'c', x: 24, y: 24, r: 6 },
        { t: 'c', x: 24, y: 24, r: 1.8, f: true },
      ],
      commander: [
        { t: 'p', d: 'M18.5 14v20' },
        { t: 'p', d: 'M18.5 16h12.8l-3.2 5 3.2 5H18.5' },
      ],
      deepSpace: [
        { t: 'p', d: 'M11.6 24a12.4 6.8 0 1 0 24.8 0a12.4 6.8 0 1 0-24.8 0' },
        { t: 'c', x: 30.6, y: 18.6, r: 2.6, f: true },
      ],
    }

    function MedalGlyph({ id, size = 20 }) {
      const glyph = MEDAL_GLYPHS[id] ?? MEDAL_GLYPHS.firstTurn
      const children = glyph.map((part, index) => (part.t === 'c'
        ? h('circle', {
          key: index,
          cx: part.x, cy: part.y, r: part.r,
          fill: part.f === true ? 'currentColor' : 'none',
          stroke: part.f === true ? 'none' : 'currentColor',
          strokeWidth: 2.3,
        })
        : h('path', {
          key: index,
          d: part.d,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        })))
      return h('svg', {
        className: 'tk-medal-svg',
        width: size,
        height: size,
        viewBox: '0 0 48 48',
        'aria-hidden': 'true',
        focusable: 'false',
      }, children)
    }

    /**
     * One medal: `icon` (from the Host, when `medals/<id>.*` exists) wins over
     * the built-in glyph, and a failed load falls back to the glyph. The socket
     * ring and the plate are CSS, so locked and unlocked read as an empty slot
     * versus a filled coin.
     */
    function MedalIcon({ id, icon }) {
      const [failed, setFailed] = useState(false)
      if (typeof icon === 'string' && icon !== '' && !failed) {
        return h('img', {
          className: 'tk-medal-img',
          src: icon,
          alt: '',
          draggable: false,
          decoding: 'async',
          onError: () => setFailed(true),
        })
      }
      return h(MedalGlyph, { id })
    }


    // --------------------------------------------------------------- pieces

    function LevelRing({ progress, size = 15, stroke = 2.4 }) {
      const radius = (size - stroke) / 2
      const circumference = 2 * Math.PI * radius
      const clamped = Math.max(0, Math.min(1, Number(progress) || 0))
      return h('svg', {
        className: 'tk-ring',
        width: size,
        height: size,
        viewBox: `0 0 ${size} ${size}`,
        'aria-hidden': 'true',
        focusable: 'false',
      },
        h('circle', {
          cx: size / 2, cy: size / 2, r: radius, fill: 'none',
          stroke: 'currentColor', strokeOpacity: 0.22, strokeWidth: stroke,
        }),
        h('circle', {
          cx: size / 2, cy: size / 2, r: radius, fill: 'none',
          stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round',
          strokeDasharray: `${Math.max(0.001, clamped) * circumference} ${circumference}`,
          transform: `rotate(-90 ${size / 2} ${size / 2})`,
        }),
      )
    }

    function StarRow({ stars, max, label }) {
      const items = []
      for (let index = 0; index < max; index += 1) {
        items.push(h('span', {
          key: index,
          className: index < stars ? 'tk-star is-on' : 'tk-star',
          'aria-hidden': 'true',
        }, label))
      }
      return h('span', { className: 'tk-stars', title: `${stars}/${max}` }, items)
    }

    function HoursBar({ hours, t }) {
      const values = Array.isArray(hours) ? hours : []
      const max = values.reduce((peak, value) => Math.max(peak, Number(value) || 0), 0)
      const bars = values.map((value, hour) => {
        const ratio = max > 0 ? (Number(value) || 0) / max : 0
        return h('span', {
          key: hour,
          className: ratio > 0 ? 'tk-hour is-on' : 'tk-hour',
          style: { height: `${Math.max(ratio > 0 ? 12 : 6, ratio * 100)}%` },
          title: `${pad2(hour)}:00`,
        })
      })
      return h('div', { className: 'tk-hours' },
        h('div', { className: 'tk-hours-track', 'aria-hidden': 'true' }, bars),
        h('div', { className: 'tk-hours-axis' },
          h('span', null, t('hours.from')),
          h('span', null, t('hours.to')),
        ),
      )
    }

    function axisDetail(axis, t) {
      const metric = Number(axis.metric) || 0
      switch (axis.key) {
        case 'period':
          return t('axis.detail.period', { pct: `${(metric * 100).toFixed(1)}%` })
        case 'pace':
          return t('axis.detail.pace', { turns: trim(metric) })
        case 'team':
          return t('axis.detail.team', { count: trim(metric) })
        default:
          return t('axis.detail.breadth', { count: Math.round(metric) })
      }
    }

    function PersonalityBlock({ personality, t }) {
      if (personality === undefined || personality === null) return null
      const axes = Array.isArray(personality.axes) ? personality.axes : []
      const title = t(`title.${String(personality.quad ?? 'day:short').replace(':', '.')}`)
      const hasData = axes.some(axis => (Number(axis.metric) || 0) > 0)
      return h('section', { className: 'tk-section' },
        h('div', { className: 'tk-section-head' },
          h('span', { className: 'tk-section-title' }, t('personality.head')),
          h('span', { className: 'tk-section-note' }, t('personality.hint')),
        ),
        hasData
          ? h(Fragment, null,
            h('div', { className: 'tk-tags' }, axes.map(axis => h('span', {
              key: axis.key,
              className: 'tk-tag',
              title: axisDetail(axis, t),
            }, t(`axis.${axis.key}.${axis.pole}`)))),
            h('p', { className: 'tk-persona-title' }, `「${title}」`),
          )
          : h('p', { className: 'tk-empty' }, t('personality.empty')),
        h(HoursBar, { hours: personality.hours, t }),
      )
    }

    function TotalsLine({ state, t }) {
      const totals = state.totals ?? {}
      const stats = [
        { key: 'sessions', value: fmtInt(totals.sessions) },
        { key: 'turns', value: fmtCount(totals.turns) },
        { key: 'out', value: fmtCount(totals.out) },
        { key: 'companion', value: fmtDuration(totals.companionMs) },
      ]
      const model = state.models?.entries?.[0]?.key ?? ''
      const modelLabel = model === '' ? '' : model.slice(model.lastIndexOf('/') + 1)
      return h(Fragment, null,
        h('div', { className: 'tk-totals', title: t('totals.hint.companion') },
          stats.map((stat, index) => h(Fragment, { key: stat.key },
            index > 0 ? h('span', { className: 'tk-dot', 'aria-hidden': 'true' }, '·') : null,
            h('span', { className: 'tk-total', title: t(`totals.hint.${stat.key}`) },
              h('b', null, stat.value),
              h('span', null, t(`totals.${stat.key}`)),
            ),
          )),
        ),
        h('div', { className: 'tk-subtotals' },
          h('span', { title: t('totals.hint.online') }, t('totals.sub.online', { value: fmtDuration(totals.onlineMs) })),
          h('span', { className: 'tk-dot', 'aria-hidden': 'true' }, '·'),
          h('span', { title: t('totals.hint.tools') }, t('totals.sub.tools', { n: totals.toolKinds ?? 0 })),
          h('span', { className: 'tk-dot', 'aria-hidden': 'true' }, '·'),
          h('span', { title: t('help.total') }, t('totals.sub.total', { value: fmtCount(totals.totalTokens) })),
          modelLabel !== ''
            ? h(Fragment, null,
              h('span', { className: 'tk-dot', 'aria-hidden': 'true' }, '·'),
              h('span', { className: 'tk-model', title: model }, modelLabel))
            : null,
        ),
      )
    }

    function RecordWall({ state, t }) {
      const defs = Array.isArray(state.recordDefs) ? state.recordDefs : []
      const records = state.records ?? {}
      const owned = Object.keys(records).length
      const rows = defs.map(definition => {
        const record = records[definition.id]
        const label = t(`record.${definition.id}`)
        const hint = t(`record.hint.${definition.id}`)
        const text = fmtRecordValue(definition, record, t)
        const when = record ? fmtMonthDay(record.at) : ''
        const name = record?.sessionTitle ? record.sessionTitle : ''
        return h('div', { key: definition.id, className: record ? 'tk-rec' : 'tk-rec is-empty', title: hint },
          h('div', { className: 'tk-rec-top' },
            h('span', { className: 'tk-rec-label' }, label),
            h('b', { className: 'tk-rec-value' }, text),
          ),
          h('div', { className: 'tk-rec-sub' },
            h('span', { className: 'tk-rec-when' }, when),
            name !== '' ? h('span', { className: 'tk-rec-name' }, name) : null,
          ),
        )
      })
      return h('section', { className: 'tk-section' },
        h('div', { className: 'tk-section-head' },
          h('span', { className: 'tk-section-title' }, t('records.head')),
          h('span', { className: 'tk-section-note' }, t('records.owned', { owned, total: defs.length })),
        ),
        rows.length === 0
          ? h('p', { className: 'tk-empty' }, t('records.empty'))
          : h('div', { className: 'tk-records' }, rows),
      )
    }

    function MedalRow({ medals, t }) {
      const list = Array.isArray(medals) ? medals : []
      const owned = list.filter(medal => medal.at > 0).length
      return h('section', { className: 'tk-section tk-section--tight' },
        h('div', { className: 'tk-section-head' },
          h('span', { className: 'tk-section-title' }, t('medals.head')),
          h('span', { className: 'tk-section-note' }, t('medals.count', { owned, total: list.length })),
        ),
        h('div', { className: 'tk-medals' },
          list.map(medal => {
            const label = t(`medal.${medal.id}.label`)
            const detail = t(`medal.${medal.id}.detail`)
            const hint = medal.at > 0
              ? t('medal.unlocked', { label, date: fmtStamp(medal.at) })
              : t('medal.locked', { detail })
            return h('span', {
              key: medal.id,
              className: medal.at > 0 ? 'tk-medal is-on' : 'tk-medal',
              title: hint,
              'aria-label': label,
              role: 'img',
            }, h(MedalIcon, { id: medal.id, icon: medal.icon }))
          }),
        ),
      )
    }

    function HelpBlock({ t }) {
      const lines = [
        t('help.total'),
        t('help.output'),
        t('help.companion'),
        t('help.online'),
        t('help.records'),
      ]
      return h('div', { className: 'tk-help' },
        h('div', { className: 'tk-help-title' }, t('help.title')),
        h('ul', null, lines.map((line, index) => h('li', { key: index }, line))),
      )
    }
    // ------------------------------------------------------------ share card

    const SHARE_W = 900
    const SHARE_H = 1200
    const SANS = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",system-ui,-apple-system,sans-serif'

    function roundRect(context, x, y, width, height, radius) {
      const r = Math.min(radius, width / 2, height / 2)
      context.beginPath()
      context.moveTo(x + r, y)
      context.arcTo(x + width, y, x + width, y + height, r)
      context.arcTo(x + width, y + height, x, y + height, r)
      context.arcTo(x, y + height, x, y, r)
      context.arcTo(x, y, x + width, y, r)
      context.closePath()
    }

    function drawShareCard(state, t) {
      const canvas = document.createElement('canvas')
      canvas.width = SHARE_W
      canvas.height = SHARE_H
      const context = canvas.getContext('2d')
      if (context === null) return null

      const ink = '#e9f1ff'
      const muted = 'rgba(233,241,255,0.56)'
      const faint = 'rgba(233,241,255,0.16)'
      const accent = '#5b9dff'
      const accent2 = '#57d6e0'

      const background = context.createLinearGradient(0, 0, SHARE_W * 0.5, SHARE_H)
      background.addColorStop(0, '#0b1224')
      background.addColorStop(0.5, '#101b34')
      background.addColorStop(1, '#080d19')
      context.fillStyle = background
      context.fillRect(0, 0, SHARE_W, SHARE_H)

      const glow = context.createRadialGradient(190, 120, 0, 190, 120, 640)
      glow.addColorStop(0, 'rgba(91,157,255,0.30)')
      glow.addColorStop(1, 'rgba(91,157,255,0)')
      context.fillStyle = glow
      context.fillRect(0, 0, SHARE_W, SHARE_H)

      let seed = 20261115
      const random = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296
        return seed / 4294967296
      }
      for (let index = 0; index < 110; index += 1) {
        const x = random() * SHARE_W
        const y = random() * SHARE_H
        const radius = random() * 1.7 + 0.2
        context.globalAlpha = random() * 0.5 + 0.12
        context.fillStyle = '#cfe4ff'
        context.beginPath()
        context.arc(x, y, radius, 0, Math.PI * 2)
        context.fill()
      }
      context.globalAlpha = 1

      context.strokeStyle = 'rgba(127,216,234,0.30)'
      context.lineWidth = 2
      context.beginPath()
      context.ellipse(668, 236, 268, 118, -0.46, 0, Math.PI * 2)
      context.stroke()

      const left = 72
      const width = SHARE_W - left * 2

      context.fillStyle = ink
      context.font = `600 30px ${SANS}`
      context.fillText(t('share.title'), left, 112)
      context.fillStyle = muted
      context.font = `400 20px ${SANS}`
      context.fillText(state.timeZone ?? '', left + 92, 110)

      // Level
      const level = state.level ?? { level: 1, name: '', xp: 0, next: null, progress: 0, stars: 0, maxStars: 3 }
      context.fillStyle = ink
      context.font = `700 86px ${SANS}`
      const levelText = t('share.level', { level: level.level })
      context.fillText(levelText, left, 262)
      const levelWidth = context.measureText(levelText).width
      context.font = `600 40px ${SANS}`
      context.fillStyle = 'rgba(233,241,255,0.86)'
      context.fillText(level.name, left + levelWidth + 24, 258)

      const progressY = 316
      roundRect(context, left, progressY, width, 12, 6)
      context.fillStyle = 'rgba(233,241,255,0.12)'
      context.fill()
      roundRect(context, left, progressY, Math.max(6, width * Math.max(0, Math.min(1, level.progress))), 12, 6)
      const bar = context.createLinearGradient(left, 0, left + width, 0)
      bar.addColorStop(0, accent)
      bar.addColorStop(1, accent2)
      context.fillStyle = bar
      context.fill()

      context.font = `500 22px ${SANS}`
      context.fillStyle = muted
      const xpText = level.next === null
        ? `${fmtInt(level.xp)} XP`
        : t('share.xp', { xp: fmtInt(level.xp), next: fmtInt(level.next) })
      context.fillText(xpText, left, progressY + 52)
      if (level.stars > 0) {
        context.fillStyle = '#ffd479'
        context.font = `600 24px ${SANS}`
        context.fillText('★'.repeat(Math.min(level.stars, 6)), left + width - 24 * Math.min(level.stars, 6), progressY + 52)
      }

      // Persona
      const personality = state.personality ?? { axes: [], quad: 'day:short', hours: [] }
      context.fillStyle = muted
      context.font = `600 20px ${SANS}`
      context.fillText(t('share.personality'), left, 442)

      const axes = Array.isArray(personality.axes) ? personality.axes : []
      let chipX = left
      context.font = `600 24px ${SANS}`
      for (const axis of axes) {
        const text = t(`axis.${axis.key}.${axis.pole}`)
        const chipWidth = context.measureText(text).width + 40
        roundRect(context, chipX, 466, chipWidth, 44, 22)
        context.fillStyle = 'rgba(91,157,255,0.16)'
        context.fill()
        context.strokeStyle = 'rgba(91,157,255,0.38)'
        context.lineWidth = 1
        context.stroke()
        context.fillStyle = ink
        context.fillText(text, chipX + 20, 496)
        chipX += chipWidth + 12
      }

      context.fillStyle = ink
      context.font = `600 54px ${SANS}`
      const personaTitle = t(`title.${String(personality.quad ?? 'day:short').replace(':', '.')}`)
      context.fillText(`「${personaTitle}」`, left, 592)

      // 24h rhythm
      const hours = Array.isArray(personality.hours) ? personality.hours : []
      const peak = hours.reduce((max, value) => Math.max(max, Number(value) || 0), 0)
      const barWidth = (width - 23 * 6) / 24
      for (let index = 0; index < 24; index += 1) {
        const ratio = peak > 0 ? (Number(hours[index]) || 0) / peak : 0
        const height = Math.max(6, ratio * 92)
        const x = left + index * (barWidth + 6)
        roundRect(context, x, 700 - height, barWidth, height, 3)
        context.fillStyle = ratio > 0
          ? `rgba(${Math.round(91 + 60 * ratio)}, ${Math.round(157 + 40 * ratio)}, 255, ${0.35 + ratio * 0.65})`
          : 'rgba(233,241,255,0.10)'
        context.fill()
      }
      context.fillStyle = muted
      context.font = `400 16px ${SANS}`
      context.fillText(t('hours.from'), left, 736)
      context.fillText(t('hours.to'), left + width - 18, 736)

      // Totals
      const totals = state.totals ?? {}
      const cells = [
        { value: fmtInt(totals.sessions), label: t('totals.sessions') },
        { value: fmtCount(totals.turns), label: t('totals.turns') },
        { value: fmtCount(totals.out), label: t('totals.out') },
        { value: fmtDuration(totals.companionMs), label: t('totals.companion') },
      ]
      const cellWidth = width / cells.length
      cells.forEach((cell, index) => {
        const x = left + index * cellWidth
        context.fillStyle = ink
        context.font = `600 38px ${SANS}`
        context.fillText(cell.value, x, 838)
        context.fillStyle = muted
        context.font = `400 18px ${SANS}`
        context.fillText(cell.label, x, 868)
      })

      context.strokeStyle = faint
      context.lineWidth = 1
      context.beginPath()
      context.moveTo(left, 900)
      context.lineTo(left + width, 900)
      context.stroke()

      // Records
      context.fillStyle = muted
      context.font = `600 20px ${SANS}`
      context.fillText(t('share.records'), left, 946)

      const defs = Array.isArray(state.recordDefs) ? state.recordDefs : []
      const records = state.records ?? {}
      const filled = defs.filter(definition => records[definition.id] !== undefined).slice(0, 4)
      filled.forEach((definition, index) => {
        const record = records[definition.id]
        const y = 992 + index * 44
        context.fillStyle = 'rgba(233,241,255,0.62)'
        context.font = `400 22px ${SANS}`
        context.fillText(t(`record.${definition.id}`), left, y)
        context.fillStyle = ink
        context.font = `600 24px ${SANS}`
        context.textAlign = 'right'
        context.fillText(fmtRecordValue(definition, record, t), left + width, y)
        context.textAlign = 'left'
      })
      if (filled.length === 0) {
        context.fillStyle = muted
        context.font = `400 22px ${SANS}`
        context.fillText(t('records.empty'), left, 992)
      }

      // Medals
      const medals = Array.isArray(state.medals) ? state.medals : []
      const owned = medals.filter(medal => medal.at > 0).length
      const dotY = 1140
      medals.forEach((medal, index) => {
        const x = left + 14 + index * 26
        context.beginPath()
        context.arc(x, dotY, 7.5, 0, Math.PI * 2)
        context.fillStyle = medal.at > 0 ? '#8be0ee' : 'rgba(233,241,255,0.14)'
        context.fill()
      })
      context.fillStyle = muted
      context.font = `400 18px ${SANS}`
      context.fillText(`${t('share.medals')} ${owned}/${medals.length}`, left, dotY + 34)

      context.fillStyle = 'rgba(233,241,255,0.34)'
      context.font = `400 16px ${SANS}`
      context.textAlign = 'right'
      context.fillText(t('share.footer'), left + width, dotY + 34)
      context.textAlign = 'left'

      return canvas
    }

    function downloadCanvas(canvas, name) {
      return new Promise(resolve => {
        const finish = ok => resolve(ok)
        try {
          canvas.toBlob(blob => {
            if (blob === null) {
              finish(false)
              return
            }
            const url = URL.createObjectURL(blob)
            const anchor = document.createElement('a')
            anchor.href = url
            anchor.download = name
            anchor.style.display = 'none'
            anchor.click()
            setTimeout(() => URL.revokeObjectURL(url), 4000)
            finish(true)
          }, 'image/png')
        } catch {
          finish(false)
        }
      })
    }

    // ----------------------------------------------------------------- panel

    /**
     * One line that says what the last scan actually did. A rescan right after
     * another one folds nothing, so "scanned 21, added 0" is the honest answer
     * to a click that otherwise looks like it did nothing.
     */
    function backfillNote(backfill, t) {
      if (backfill.ready === false) return t('backfill.unavailable')
      if (backfill.running) {
        return t('backfill.progress', { done: backfill.done ?? 0, total: backfill.total ?? 0 })
      }
      if (backfill.error) return t('backfill.error', { message: backfill.error })
      if (!(backfill.finishedAt > 0)) return ''
      if (backfill.cancelled) return t('backfill.cancelled')
      const scanned = backfill.done ?? 0
      const parts = [t('backfill.scanned', { n: scanned })]
      // A Host generation that predates the `added` counter cannot answer "did
      // anything get folded", so stay silent instead of claiming 无新增.
      if (typeof backfill.added === 'number') {
        const added = backfill.added
        parts.push(added > 0 ? t('backfill.added', { n: added }) : t('backfill.nochange'))
      }
      if ((backfill.failed ?? 0) > 0) parts.push(t('backfill.failed', { n: backfill.failed }))
      return parts.join(' · ')
    }

    function useAnchoredPosition(open) {
      const [position, setPosition] = useState(null)
      useEffect(() => {
        if (!open) {
          setPosition(null)
          return undefined
        }
        const measure = () => {
          const node = overlay.anchor
          if (node === null || node === undefined || typeof node.getBoundingClientRect !== 'function') return
          const rect = node.getBoundingClientRect()
          const viewportWidth = window.innerWidth
          const viewportHeight = window.innerHeight
          // Integer geometry: a fractional fixed offset makes every glyph land
          // on a half pixel and the whole panel reads as out of focus.
          const width = Math.round(Math.min(420, viewportWidth - 24))
          const left = Math.round(Math.max(8, Math.min(rect.left, viewportWidth - width - 8)))
          const bottom = Math.round(viewportHeight - rect.top + 8)
          const maxHeight = Math.round(Math.max(280, Math.min(rect.top - 16, viewportHeight - 32)))
          setPosition({ left, bottom, width, maxHeight })
        }
        measure()
        window.addEventListener('resize', measure)
        window.addEventListener('scroll', measure, true)
        return () => {
          window.removeEventListener('resize', measure)
          window.removeEventListener('scroll', measure, true)
        }
      }, [open])
      return position
    }

    function Panel({ state, error, loading, position, panelRef, onShare, onBackfill, onCancel, sharing, t, notice }) {
      const [help, setHelp] = useState(false)
      const level = state?.level
      const backfill = state?.backfill ?? {}
      const style = position === null
        ? { visibility: 'hidden' }
        : { left: `${position.left}px`, bottom: `${position.bottom}px`, width: `${position.width}px`, maxHeight: `${position.maxHeight}px` }

      return h('div', {
        ref: panelRef,
        className: 'tk-pop',
        style,
        role: 'dialog',
        'aria-modal': 'false',
        'aria-label': t('panel.aria'),
        tabIndex: -1,
        'data-tracks-panel': '',
      },
        h('div', { className: 'tk-pop-scroll' },
          notice !== null
            ? h('div', { className: 'tk-notice', role: 'status' },
              h('span', { className: 'tk-notice-dot', 'aria-hidden': 'true' }),
              h('span', null, t('notice.newRecord', { label: t(`record.${notice.id}`) })),
            )
            : null,

          level !== undefined
            ? h('header', { className: 'tk-head' },
              h('div', { className: 'tk-head-top' },
                h('span', { className: 'tk-lv' }, t('panel.level', { level: level.level })),
                h('h2', { className: 'tk-name' }, level.name),
                h(StarRow, { stars: level.stars, max: level.maxStars, label: t('panel.star') }),
              ),
              h('div', {
                className: 'tk-bar',
                role: 'progressbar',
                'aria-valuemin': 0,
                'aria-valuemax': 100,
                'aria-valuenow': Math.round((level.progress ?? 0) * 100),
              }, h('span', { className: 'tk-bar-fill', style: { width: `${Math.max(1.5, (level.progress ?? 0) * 100)}%` } })),
              h('div', { className: 'tk-barline' },
                h('span', null, level.next === null
                  ? t('panel.maxed', { xp: fmtInt(level.xp) })
                  : t('panel.progress', { xp: fmtInt(level.xp), next: fmtInt(level.next) })),
                h('span', { className: 'tk-barline-today' }, t('panel.todayXp', { xp: fmtInt(state.today?.xp ?? 0) })),
              ),
              h('div', { className: 'tk-head-meta' },
                h('span', null, (state.streak?.current ?? 0) > 0
                  ? t('panel.streak', { days: state.streak.current })
                  : t('panel.streakNone')),
                h('span', { className: 'tk-dot', 'aria-hidden': 'true' }, '·'),
                h('span', null, t('panel.records', { owned: state.recordsOwned ?? 0, total: state.recordCount ?? 8 })),
                h('button', {
                  type: 'button',
                  className: help ? 'tk-help-toggle is-on' : 'tk-help-toggle',
                  onClick: () => setHelp(value => !value),
                  'aria-expanded': help,
                  'aria-label': t('help.button'),
                  title: t('help.button'),
                }, '?'),
              ),
            )
            : null,

          help ? h(HelpBlock, { t }) : null,

          loading && state === null ? h('p', { className: 'tk-empty' }, t('state.loading')) : null,
          error !== '' ? h('p', { className: 'tk-error' }, t('error.load', { message: error })) : null,

          state !== null && level !== undefined
            ? h(Fragment, null,
              h(PersonalityBlock, { personality: state.personality, t }),
              h(TotalsLine, { state, t }),
              h(RecordWall, { state, t }),
              h(MedalRow, { medals: state.medals, t }),
            )
            : null,

          backfill.running
            ? h('div', { className: 'tk-backfill' },
              h('span', null, t('backfill.progress', { done: backfill.done ?? 0, total: backfill.total ?? 0 })),
              h('span', { className: 'tk-backfill-track' },
                h('span', {
                  style: { width: `${backfill.total > 0 ? Math.round(((backfill.done ?? 0) / backfill.total) * 100) : 3}%` },
                })),
            )
            : null,
        ),

        h('footer', { className: 'tk-foot' },
          h('button', {
            type: 'button',
            className: backfill.running ? 'tk-ghost tk-ghost--busy' : 'tk-ghost',
            onClick: backfill.running ? onCancel : onBackfill,
            title: backfill.running ? t('action.backfill.cancelHint') : t('action.backfill.hint'),
            disabled: backfill.ready === false,
          }, backfill.running ? t('action.cancel') : t('action.backfill')),
          h('span', { className: 'tk-foot-note' }, backfillNote(backfill, t)),
          h('button', {
            type: 'button',
            className: 'tk-ghost tk-ghost--primary',
            onClick: onShare,
            disabled: sharing || state === null,
            title: t('action.share.hint'),
          }, t('action.share')),
        ),
      )
    }

    // ----------------------------------------------------------------- badge

    function TracksBadge({ wide, t, locale }) {
      const buttonRef = useRef(null)
      const open = useOverlayOpen()
      const { state } = useData()
      useLocaleRevision(locale)
      const wasOpen = useRef(false)

      const level = state?.level
      const levelNumber = level?.level ?? 1
      const progress = level?.progress ?? 0

      // The panel lives in the frame overlay, so the badge restores focus when
      // the overlay closes (Escape, outside click, or the button itself).
      useEffect(() => {
        if (wasOpen.current && !open) {
          const node = buttonRef.current
          if (node !== null && typeof node.focus === 'function') node.focus({ preventScroll: true })
        }
        wasOpen.current = open
      }, [open])

      const label = t('badge.aria', { level: levelNumber, name: level?.name ?? '' })

      return h(Fragment, null,
        h('style', null, STYLES),
        h('button', {
          ref: buttonRef,
          type: 'button',
          className: wide ? 'tk-badge' : 'tk-badge tk-badge--rail',
          onClick: () => {
            overlay.anchor = buttonRef.current
            setOverlayOpen(!overlay.open)
          },
          'aria-haspopup': 'dialog',
          'aria-expanded': open,
          'aria-label': label,
          title: label,
        },
        h(LevelRing, { progress, size: wide ? 15 : 20, stroke: wide ? 2.4 : 2.8 }),
        wide
          ? h('span', { className: 'tk-badge-text' }, t('panel.level', { level: levelNumber }))
          : h('span', { className: 'tk-badge-mini' }, String(levelNumber)),
        ),
      )
    }

    // --------------------------------------------------------------- overlay

    function TracksOverlay({ t, locale }) {
      const open = useOverlayOpen()
      const { state, error, loading } = useData()
      const [sharing, setSharing] = useState(false)
      const [notice, setNotice] = useState(null)
      const [toast, setToast] = useState('')
      const panelRef = useRef(null)
      const position = useAnchoredPosition(open)
      useLocaleRevision(locale)

      useEffect(() => {
        if (!open) {
          setNotice(null)
          return undefined
        }
        const onKey = event => {
          if (event.key === 'Escape' && !event.defaultPrevented) {
            event.preventDefault()
            setOverlayOpen(false)
          }
        }
        const onPointer = event => {
          if (panelRef.current !== null && panelRef.current.contains(event.target)) return
          if (overlay.anchor !== null && overlay.anchor.contains && overlay.anchor.contains(event.target)) return
          setOverlayOpen(false)
        }
        document.addEventListener('keydown', onKey, true)
        document.addEventListener('mousedown', onPointer, true)
        return () => {
          document.removeEventListener('keydown', onKey, true)
          document.removeEventListener('mousedown', onPointer, true)
        }
      }, [open])

      useEffect(() => {
        if (!open || position === null) return
        const node = panelRef.current
        if (node !== null && typeof node.focus === 'function') node.focus({ preventScroll: true })
      }, [open, position])

      // A record broken since the last shown moment surfaces once, on open.
      useEffect(() => {
        if (!open || state === null) return
        const seenAt = readSeenAt()
        const fresh = (state.notices ?? []).filter(item => Number(item.at) > seenAt)
        if (fresh.length === 0) return
        const newest = fresh.reduce((left, right) => (left.at > right.at ? left : right))
        setNotice(newest)
        writeSeenAt(newest.at)
      }, [open, state])

      useEffect(() => {
        if (notice === null) return undefined
        const timer = setTimeout(() => setNotice(null), NOTICE_MS)
        return () => clearTimeout(timer)
      }, [notice])

      useEffect(() => {
        if (toast === '') return undefined
        const timer = setTimeout(() => setToast(''), 3200)
        return () => clearTimeout(timer)
      }, [toast])

      const onShare = useCallback(async () => {
        if (state === null || sharing) return
        setSharing(true)
        try {
          const canvas = drawShareCard(state, t)
          if (canvas === null) {
            setToast(t('share.blocked'))
            return
          }
          const stamp = new Date()
          const name = `dsh-tracks-${stamp.getFullYear()}${pad2(stamp.getMonth() + 1)}${pad2(stamp.getDate())}.png`
          const ok = await downloadCanvas(canvas, name)
          setToast(ok ? t('share.saved') : t('share.blocked'))
        } catch {
          setToast(t('share.blocked'))
        } finally {
          setSharing(false)
        }
      }, [state, sharing, t])

      const post = useCallback(async (path, body) => {
        try {
          const response = await fetch(`${API}${path}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body ?? {}),
          })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          return await response.json()
        } catch (cause) {
          setToast(String(cause?.message ?? cause))
          return null
        }
      }, [])

      // A rescan of an already-current ledger finishes in well under a second,
      // so sample it briefly: the button flips to 取消, the progress row shows,
      // and the result line lands without waiting for the 20s poll.
      const sample = useCallback(async (count = 6) => {
        for (let index = 0; index < count; index += 1) {
          await new Promise(resolve => setTimeout(resolve, 320))
          await loadData()
        }
      }, [])

      const applyBackfill = useCallback(result => {
        if (result?.backfill === undefined || data.state === null) return
        data.state = { ...data.state, backfill: result.backfill }
        emitData()
      }, [])

      const onBackfill = useCallback(async () => {
        const result = await post('/backfill', { action: 'start' })
        applyBackfill(result)
        void sample()
      }, [post, applyBackfill, sample])

      const onCancel = useCallback(async () => {
        const result = await post('/backfill', { action: 'cancel' })
        applyBackfill(result)
        void sample(2)
      }, [post, applyBackfill, sample])

      if (!open && toast === '') return null

      return h(Fragment, null,
        h('style', null, STYLES),
        open
          ? h(Panel, {
            state,
            error,
            loading,
            position,
            panelRef,
            onShare,
            onBackfill,
            onCancel,
            sharing,
            t,
            notice,
          })
          : null,
        toast !== ''
          ? h('span', { className: 'tk-toast', role: 'status' }, toast)
          : null,
      )
    }

    // ----------------------------------------------------------------- styles

    const STYLES = `
      .tk-badge {
        display:inline-flex; align-items:center; gap:7px; height:28px; padding:0 10px 0 7px;
        border:1px solid transparent; border-radius:var(--dsw-radius-sm, 8px);
        background:transparent; color:var(--dsw-alias-label-secondary, #6b7280);
        font:inherit; font-size:11px; font-weight:600; line-height:1; letter-spacing:0;
        cursor:pointer; white-space:nowrap;
        transition:background-color .15s ease, color .15s ease;
      }
      .tk-badge-text { font-variant-numeric:tabular-nums; }
      .tk-badge--rail { width:28px; height:28px; padding:0; justify-content:center; position:relative; }
      .tk-badge-mini { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
        font-size:8px; font-weight:700; font-variant-numeric:tabular-nums; pointer-events:none; }
      .tk-ring { color:var(--dsw-alias-brand-primary, #4f8cff); flex:none; }
      .tk-badge--rail .tk-ring { width:20px; height:20px; }
      @media (hover:hover) {
        .tk-badge:hover { background:var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.14));
          color:var(--dsw-alias-label-primary, #111827); }
      }
      .tk-badge[aria-expanded="true"] {
        background:var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.14));
        color:var(--dsw-alias-label-primary, #111827);
      }
      .tk-badge:focus-visible { outline:2px solid var(--dsw-alias-brand-primary, #4f8cff); outline-offset:-2px; }

      /* No backdrop-filter on purpose: it promotes the panel into a composited
         layer that lands off the device-pixel grid and softens every glyph. */
      .tk-pop {
        position:fixed; z-index:1; box-sizing:border-box; pointer-events:auto;
        display:flex; flex-direction:column;
        border:1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3));
        border-radius:var(--dsw-radius-lg, 16px);
        background:var(--dsw-alias-bg-overlay, #ffffff);
        color:var(--dsw-alias-label-primary, #111827);
        box-shadow:var(--dsw-shadow-lv3, 0 12px 32px rgba(0,0,0,.16));
        font-size:13px; line-height:1.6; text-align:left; overflow:hidden;
      }
      .tk-pop:focus { outline:none; }
      .tk-pop-scroll { overflow-y:auto; overscroll-behavior:contain; padding:16px 16px 4px; }
      .tk-pop-scroll::-webkit-scrollbar { width:8px; }
      .tk-pop-scroll::-webkit-scrollbar-thumb {
        background:var(--dsw-alias-scrollbar-bg-l2, rgba(127,127,127,.26)); border-radius:99px;
      }

      .tk-notice { display:flex; align-items:center; gap:8px; margin:0 0 14px; padding:8px 11px;
        border:1px solid color-mix(in srgb, var(--dsw-alias-brand-primary, #4f8cff) 34%, transparent);
        border-radius:var(--dsw-radius-sm, 8px);
        background:color-mix(in srgb, var(--dsw-alias-brand-primary, #4f8cff) 10%, transparent);
        font-size:12px; font-weight:600; line-height:1.4; }
      .tk-notice-dot { width:7px; height:7px; border-radius:50%; flex:none;
        background:var(--dsw-alias-brand-primary, #4f8cff); }

      .tk-head { padding-bottom:14px; }
      .tk-head-top { display:flex; align-items:baseline; gap:9px; }
      .tk-lv { font-size:12px; font-weight:700; letter-spacing:0; white-space:nowrap;
        color:var(--dsw-alias-brand-primary, #4f8cff); font-variant-numeric:tabular-nums; }
      .tk-name { margin:0; font-size:18px; font-weight:650; letter-spacing:0; line-height:1.25; }
      .tk-stars { margin-left:auto; display:inline-flex; gap:2px; font-size:12px; line-height:1; }
      .tk-star { color:var(--dsw-alias-label-secondary, #9ca3af); opacity:.4; }
      .tk-star.is-on { color:var(--dsw-alias-brand-primary, #4f8cff); opacity:1; }

      .tk-bar { position:relative; height:7px; margin:12px 0 9px; border-radius:99px; overflow:hidden;
        background:color-mix(in srgb, var(--dsw-alias-brand-primary, #4f8cff) 15%, transparent); }
      .tk-bar-fill { display:block; height:100%; border-radius:inherit;
        background:linear-gradient(90deg, var(--dsw-alias-brand-primary, #4f8cff),
          color-mix(in srgb, var(--dsw-alias-brand-primary, #4f8cff) 45%, #57d6e0)); }
      .tk-barline { display:flex; justify-content:space-between; gap:12px; font-size:12px;
        color:var(--dsw-alias-label-secondary, #6b7280); font-variant-numeric:tabular-nums; }
      .tk-barline-today { font-weight:600; color:var(--dsw-alias-label-primary, #111827); }
      .tk-head-meta { display:flex; align-items:center; gap:8px; margin-top:7px; font-size:11px;
        color:var(--dsw-alias-label-secondary, #6b7280); }
      .tk-dot { opacity:.5; }
      .tk-help-toggle { margin-left:auto; width:20px; height:20px; padding:0; display:grid; place-items:center;
        border:1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.32)); border-radius:50%;
        background:transparent; color:var(--dsw-alias-label-secondary, #6b7280);
        font:inherit; font-size:11px; font-weight:700; line-height:1; cursor:pointer; flex:none; }
      .tk-help-toggle.is-on { color:var(--dsw-alias-brand-primary, #4f8cff);
        border-color:color-mix(in srgb, var(--dsw-alias-brand-primary, #4f8cff) 46%, transparent); }

      .tk-section { padding:14px 0; border-top:1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.18)); }
      .tk-section--tight { padding-bottom:6px; }
      .tk-section-head { display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin-bottom:10px; }
      .tk-section-title { font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
        color:var(--dsw-alias-label-secondary, #6b7280); }
      .tk-section-note { font-size:11px; color:var(--dsw-alias-label-secondary, #6b7280);
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

      .tk-tags { display:flex; flex-wrap:wrap; gap:6px; }
      .tk-tag { display:inline-flex; align-items:center; height:24px; padding:0 10px; border-radius:99px;
        border:1px solid color-mix(in srgb, var(--dsw-alias-brand-primary, #4f8cff) 28%, transparent);
        background:color-mix(in srgb, var(--dsw-alias-brand-primary, #4f8cff) 9%, transparent);
        color:var(--dsw-alias-label-primary, #111827); font-size:12px; font-weight:600; white-space:nowrap; }
      .tk-persona-title { margin:10px 0 0; font-size:17px; font-weight:650; letter-spacing:0; line-height:1.4; }

      .tk-hours { margin-top:12px; }
      .tk-hours-track { display:flex; align-items:flex-end; gap:3px; height:40px; }
      .tk-hour { flex:1 1 0; min-width:0; border-radius:2px;
        background:color-mix(in srgb, var(--dsw-alias-label-secondary, #9ca3af) 18%, transparent); }
      .tk-hour.is-on { background:linear-gradient(180deg,
        color-mix(in srgb, var(--dsw-alias-brand-primary, #4f8cff) 92%, transparent),
        color-mix(in srgb, var(--dsw-alias-brand-primary, #4f8cff) 36%, transparent)); }
      .tk-hours-axis { display:flex; justify-content:space-between; margin-top:5px; font-size:10px;
        color:var(--dsw-alias-label-secondary, #6b7280); font-variant-numeric:tabular-nums; }

      .tk-totals { display:flex; flex-wrap:wrap; align-items:baseline; gap:7px; padding:12px 0;
        border-top:1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.18));
        font-size:11px; color:var(--dsw-alias-label-secondary, #6b7280); }
      .tk-total { display:inline-flex; align-items:baseline; gap:4px; white-space:nowrap; }
      .tk-total b { font-size:13px; font-weight:650; color:var(--dsw-alias-label-primary, #111827);
        font-variant-numeric:tabular-nums; }
      .tk-subtotals { display:flex; flex-wrap:wrap; align-items:baseline; gap:6px; margin:-4px 0 12px;
        font-size:11px; color:var(--dsw-alias-label-secondary, #6b7280); }
      .tk-model { max-width:50%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

      .tk-records { display:grid; grid-template-columns:1fr 1fr; gap:8px 10px; }
      .tk-rec { min-width:0; padding:8px 10px; border-radius:var(--dsw-radius-sm, 9px);
        background:color-mix(in srgb, var(--dsw-alias-label-secondary, #9ca3af) 8%, transparent); }
      .tk-rec.is-empty { background:transparent; box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l1, rgba(127,127,127,.2)); }
      .tk-rec-top { display:flex; align-items:baseline; justify-content:space-between; gap:8px; min-width:0; }
      .tk-rec-label { font-size:11px; color:var(--dsw-alias-label-secondary, #6b7280); white-space:nowrap;
        overflow:hidden; text-overflow:ellipsis; }
      .tk-rec-value { font-size:13px; font-weight:650; font-variant-numeric:tabular-nums; white-space:nowrap; }
      .tk-rec.is-empty .tk-rec-value { color:var(--dsw-alias-label-secondary, #9ca3af); font-weight:500; }
      .tk-rec-sub { display:flex; gap:6px; margin-top:2px; min-width:0; font-size:11px;
        color:var(--dsw-alias-label-secondary, #6b7280); }
      .tk-rec-when { flex:none; font-variant-numeric:tabular-nums; }
      .tk-rec-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

      /* A locked badge is an empty socket, an unlocked one a filled coin:
         the plate, ring and glyph weight all change, not just the hue. */
      .tk-medals { display:flex; flex-wrap:wrap; gap:5px; padding:2px 0 6px; }
      .tk-medal { display:inline-flex; align-items:center; justify-content:center;
        width:26px; height:26px; border-radius:50%; flex:none; position:relative;
        color:var(--dsw-alias-label-secondary, #9ca3af);
        background:transparent;
        box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--dsw-alias-label-secondary, #9ca3af) 16%, transparent);
        transition:background-color .16s ease, box-shadow .16s ease, transform .16s ease; }
      .tk-medal > * { opacity:.3; transition:opacity .16s ease; }
      .tk-medal.is-on { color:var(--dsw-alias-brand-primary, #4f8cff);
        background:color-mix(in srgb, var(--dsw-alias-brand-primary, #4f8cff) 15%, transparent);
        box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--dsw-alias-brand-primary, #4f8cff) 36%, transparent); }
      .tk-medal.is-on > * { opacity:1; }
      .tk-medal:not(.is-on) .tk-medal-img { filter:grayscale(1); }
      .tk-medal-svg { display:block; width:22px; height:22px; }
      .tk-medal-img { display:block; width:24px; height:24px; object-fit:contain; }
      .tk-medal:hover { transform:scale(1.1); }

      .tk-empty { margin:6px 0 12px; font-size:12px; color:var(--dsw-alias-label-secondary, #6b7280); }
      .tk-error { margin:6px 0 12px; font-size:12px; color:var(--dsw-alias-state-error-primary, #d9534f); }

      .tk-help { margin:2px 0 14px; padding:10px 12px; border-radius:var(--dsw-radius-sm, 9px);
        background:color-mix(in srgb, var(--dsw-alias-label-secondary, #9ca3af) 9%, transparent); }
      .tk-help-title { font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase;
        color:var(--dsw-alias-label-secondary, #6b7280); margin-bottom:6px; }
      .tk-help ul { margin:0; padding-left:15px; }
      .tk-help li { font-size:12px; line-height:1.7; color:var(--dsw-alias-label-secondary, #4b5563); }

      .tk-backfill { display:flex; align-items:center; gap:10px; padding:10px 0 14px;
        border-top:1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.18));
        font-size:11px; color:var(--dsw-alias-label-secondary, #6b7280); font-variant-numeric:tabular-nums; }
      .tk-backfill-track { flex:1; height:4px; border-radius:99px; overflow:hidden;
        background:color-mix(in srgb, var(--dsw-alias-label-secondary, #9ca3af) 22%, transparent); }
      .tk-backfill-track span { display:block; height:100%; border-radius:inherit;
        background:var(--dsw-alias-brand-primary, #4f8cff); }

      .tk-foot { display:flex; align-items:center; gap:8px; padding:10px 16px 12px;
        border-top:1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.18)); }
      .tk-foot-note { flex:1; min-width:0; font-size:10px; color:var(--dsw-alias-label-secondary, #6b7280);
        overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .tk-ghost { height:28px; padding:0 12px; border-radius:99px; cursor:pointer;
        border:1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.32)); background:transparent;
        color:var(--dsw-alias-label-secondary, #4b5563); font:inherit; font-size:12px; font-weight:600;
        white-space:nowrap; transition:color .15s ease, border-color .15s ease, background-color .15s ease; }
      @media (hover:hover) {
        .tk-ghost:hover:not(:disabled) { color:var(--dsw-alias-label-primary, #111827);
          border-color:var(--dsw-alias-border-l2, rgba(127,127,127,.5));
          background:var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12)); }
      }
      .tk-ghost:disabled { opacity:.45; cursor:default; }
      .tk-ghost--primary { color:var(--dsw-alias-label-primary, #111827);
        border-color:color-mix(in srgb, var(--dsw-alias-brand-primary, #4f8cff) 42%, transparent);
        background:color-mix(in srgb, var(--dsw-alias-brand-primary, #4f8cff) 12%, transparent); }
      .tk-ghost:focus-visible { outline:2px solid var(--dsw-alias-brand-primary, #4f8cff); outline-offset:1px; }

      .tk-toast { position:fixed; left:0; right:0; bottom:26px; z-index:2; pointer-events:none;
        width:max-content; margin:0 auto; padding:8px 14px; border-radius:99px;
        font-size:12px; font-weight:600; line-height:1.4;
        background:var(--dsw-alias-toast-bg, #23262d); color:var(--dsw-alias-toast-label, #ffffff);
        box-shadow:var(--dsw-shadow-lv2, 0 4px 12px rgba(0,0,0,.16)); animation:tk-toast-in .2s ease both; }

      @keyframes tk-toast-in { from { opacity:0; } to { opacity:1; } }
      @media (prefers-reduced-motion:reduce) {
        .tk-pop *, .tk-toast, .tk-notice, .tk-medal { animation-duration:.001ms !important; transition-duration:.001ms !important; }
      }
    `

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const t = makeT(ctx.locale.bind(NS))
        ctx.effect(() => ctx.locale.register(NS, 'zh', DICT.zh))
        ctx.effect(() => ctx.locale.register(NS, 'en', DICT.en))
        ctx.effect(() => ctx.locale.register(NS, 'zh-CN', DICT.zh))
        ctx.effect(() => ctx.locale.register(NS, 'en-US', DICT.en))

        // Presence heartbeat: only visible time counts, and a hidden page
        // prices its last stretch before going quiet.
        ctx.effect(() => {
          let visibleSince = typeof document !== 'undefined' && document.visibilityState === 'visible'
            ? Date.now()
            : 0
          let disposed = false
          const report = ms => {
            if (disposed || ms < 2000) return
            void fetch(`${API}/tick`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ ms: Math.min(ms, 600000) }),
            }).catch(() => {})
          }
          const beat = () => {
            if (typeof document === 'undefined') return
            if (document.visibilityState !== 'visible') {
              visibleSince = 0
              return
            }
            const now = Date.now()
            if (visibleSince === 0) {
              visibleSince = now
              return
            }
            const ms = now - visibleSince
            visibleSince = now
            report(ms)
          }
          const timer = setInterval(beat, HEARTBEAT_MS)
          const onVisibility = () => {
            if (document.visibilityState === 'visible') {
              visibleSince = Date.now()
              return
            }
            if (visibleSince > 0) {
              const ms = Date.now() - visibleSince
              visibleSince = 0
              report(ms)
            }
          }
          document.addEventListener('visibilitychange', onVisibility)
          return () => {
            disposed = true
            clearInterval(timer)
            document.removeEventListener('visibilitychange', onVisibility)
          }
        })

        const Badge = props => h(TracksBadge, { wide: Boolean(props?.wide), t, locale: ctx.locale })
        const Overlay = () => h(TracksOverlay, { t, locale: ctx.locale })

        ctx.slots.inject(SLOT, () => ctx.slots.register({
          name: SLOT,
          id: 'tracks',
          order: 30,
          label: () => t('badge.title'),
        }, Badge))

        ctx.slots.inject(OVERLAY_SLOT, () => ctx.slots.register({
          name: OVERLAY_SLOT,
          id: 'tracks-panel',
          order: 50,
        }, Overlay))
      },
    }
  },
})
