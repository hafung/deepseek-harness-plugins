window.__ModuleLoader__.load({
  id: '@local/dsh-experts',
  factory(require) {
    const {
      createElement: h,
      useEffect,
      useLayoutEffect,
      useMemo,
      useRef,
      useState,
      useSyncExternalStore,
    } = require('react')

    const panelId = 'local-experts'
    const storageKey = '@local/dsh-experts:v1'
    const backupFormat = 'dsh-experts'
    const emptyPresets = []
    const maxName = 80
    const maxDescription = 200
    const maxPrompt = 20_000

    const categories = [
      { id: 'general', label: '通用' },
      { id: 'writing', label: '写作' },
      { id: 'coding', label: '编程' },
      { id: 'analysis', label: '分析' },
      { id: 'learning', label: '学习' },
      { id: 'product', label: '产品' },
    ]
    const categoryMap = Object.fromEntries(categories.map(category => [category.id, category]))
    const categoryIds = new Set(categories.map(category => category.id))

    const iconPaths = {
      spark: [
        'M12 3.2l1.75 4.9 4.9 1.75-4.9 1.75L12 16.5l-1.75-4.9-4.9-1.75 4.9-1.75L12 3.2Z',
        'M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z',
      ],
      search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z', 'm16.2 16.2 4 4'],
      code: ['m8.5 8.5-4 3.5 4 3.5', 'm15.5 8.5 4 3.5-4 3.5', 'm13.2 5.5-2.4 13'],
      pen: ['M4 20h4l10.2-10.2a2.7 2.7 0 0 0-3.8-3.8L4 16.2V20Z', 'm13.7 6.3 3.8 3.8'],
      chart: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M2.5 20h19'],
      book: ['M5 4.5h9.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3V4.5Z', 'M8.5 4.5V17a3 3 0 0 0 3 3'],
      cube: ['m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z', 'M4 7.5 12 12l8-4.5', 'M12 12v9'],
      compass: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'm15.5 8.5-2.2 5-5 2.2 2.2-5 5-2.2Z'],
      bug: ['M8 8h8v7a4 4 0 0 1-8 0V8Z', 'M9.5 8a2.5 2.5 0 0 1 5 0', 'M4 11h4M16 11h4M4 16h4M16 16h4M6 6l2 2M18 6l-2 2'],
      translate: ['M4 6h9M8.5 4v2c0 4.5-2.2 7.6-5 9', 'M6.5 11.5c1 3 3.5 5 6.5 6', 'M13 20l4-9 4 9', 'M14.5 17h5'],
      calendar: ['M5 6h14a1.5 1.5 0 0 1 1.5 1.5V19A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V7.5A1.5 1.5 0 0 1 5 6Z', 'M8 3.5V8M16 3.5V8M3.5 11h17'],
      flask: ['M9.5 3h5', 'M10.5 3v5.2L5.6 18a2 2 0 0 0 1.8 3h9.2a2 2 0 0 0 1.8-3L13.5 8.2V3', 'M7.8 15.5h8.4'],
      plus: ['M12 5v14M5 12h14'],
      arrow: ['M5 12h13M13 6l6 6-6 6'],
      edit: ['M4 20h4l10.2-10.2a2.7 2.7 0 0 0-3.8-3.8L4 16.2V20Z', 'm13.7 6.3 3.8 3.8'],
      trash: ['M4 7h16', 'M9 7V4.5h6V7', 'M6 7l1 13h10l1-13', 'M10 11v5M14 11v5'],
      close: ['M6 6l12 12M18 6 6 18'],
      check: ['m5 12.5 4.5 4.5L19 7'],
      upload: ['M12 16V4m-4 4 4-4 4 4', 'M4 16v3.5h16V16'],
      download: ['M12 4v12m-4-4 4 4 4-4', 'M4 16v3.5h16V16'],
      reset: ['M4 10a8 8 0 1 1 1.6 6.4', 'M4 4v6h6'],
      alert: ['M12 4 2.8 20h18.4L12 4Z', 'M12 9.5V14', 'M12 17.2v.3'],
    }

    const iconOptions = [
      { id: 'spark', label: '灵感' },
      { id: 'search', label: '研究' },
      { id: 'code', label: '代码' },
      { id: 'bug', label: '调试' },
      { id: 'pen', label: '写作' },
      { id: 'translate', label: '翻译' },
      { id: 'chart', label: '分析' },
      { id: 'book', label: '阅读' },
      { id: 'cube', label: '架构' },
      { id: 'compass', label: '产品' },
      { id: 'calendar', label: '计划' },
      { id: 'flask', label: '实验' },
    ]
    const iconNames = new Set(iconOptions.map(option => option.id))

    function Glyph({ name = 'spark', size = 18, strokeWidth = 1.6 }) {
      const paths = iconPaths[name] ?? iconPaths.spark
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false',
      }, paths.map((d, index) => h('path', { key: index, d })))
    }

    function StarIcon({ filled = false, size = 16 }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24',
        fill: filled ? 'currentColor' : 'none', stroke: 'currentColor',
        strokeWidth: 1.5, strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false',
      }, h('path', {
        d: 'm12 3.6 2.55 5.17 5.7.83-4.12 4.02.97 5.68L12 16.62 6.9 19.3l.97-5.68L3.75 9.6l5.7-.83L12 3.6Z',
      }))
    }

    function ExpertsIcon({ size = 20 }) {
      return h(Glyph, { name: 'spark', size, strokeWidth: 1.7 })
    }

    /**
     * Built-in expert defaults. Edit names, descriptions, categories, icons or
     * prompts here; keep each id stable so "restore built-ins" updates the same
     * cards instead of creating duplicates. After editing, reload the page (or
     * re-enable the plugin), then use "恢复内置专家" to write the new defaults.
     */
    function seedPresets() {
      const base = 1_762_300_000_000
      return [
        {
          id: 'seed-deep-research',
          name: '深度研究员',
          description: '把开放问题拆成可核查的研究简报，附来源、反方观点与不确定性。',
          category: 'analysis',
          icon: 'search',
          favorite: true,
          builtin: true,
          createdAt: base,
          updatedAt: base,
          prompt: `你是一位严谨的深度研究员。请围绕我给出的主题完成一份可核查的研究简报。

工作方式：
1. 先拆解问题，列出 3–5 个关键子问题，以及回答它们需要的信息类型。
2. 使用可用的检索工具查证事实，优先一手来源；区分「已证实」「存疑」「推测」。
3. 对相互冲突的说法并列呈现，说明证据强弱与可能原因。
4. 不要编造来源、数据或引文；找不到证据时直接说明。

输出结构：
- 一句话结论
- 关键发现（每条附来源链接与日期）
- 反方观点与不确定性
- 建议的下一步行动`,
        },
        {
          id: 'seed-editor',
          name: '文案润色师',
          description: '在保留原意与事实的前提下收紧文字，让动词承担主要信息。',
          category: 'writing',
          icon: 'pen',
          favorite: false,
          builtin: true,
          createdAt: base - 3_000,
          updatedAt: base - 3_000,
          prompt: `你是一位克制、准确的文字编辑。请在保留原意与事实的前提下润色我提供的文本。

规则：
- 不新增未经证实的信息，不改变立场与结论。
- 优先删除冗余、空话和重复；让动词承担主要信息。
- 保持原有语言（中文/英文）与语气，除非我要求改写风格。
- 术语和专有名词保持一致。

输出：
1. 润色后的全文
2. 逐条说明主要修改及原因（不超过 8 条）
3. 如有歧义或事实缺口，单独列出并提问`,
        },
        {
          id: 'seed-reading-coach',
          name: '长文精读教练',
          description: '用提问和复述拆解长文论证，生成可自测的复习清单。',
          category: 'learning',
          icon: 'book',
          favorite: false,
          builtin: true,
          createdAt: base - 4_000,
          updatedAt: base - 4_000,
          prompt: `你是一位善于提问的阅读教练。请帮我真正读懂我提供的长文或章节。

请按以下顺序输出：
1. 用 5 句话概括作者的论证链（主张 → 理由 → 证据 → 结论）。
2. 列出核心概念，并用我可能熟悉的事物各打一个比方。
3. 找出作者最薄弱的两个环节，说明为什么。
4. 提出 3 个用于自测的问题（先不给答案）。
5. 给出一份 20 分钟内可完成的复习清单。

不要用「本文介绍了……」式的空泛总结。`,
        },
        {
          id: 'seed-data-analyst',
          name: '数据分析师',
          description: '从口径与数据质量出发，区分相关与因果，给出可复现的分析步骤。',
          category: 'analysis',
          icon: 'chart',
          favorite: false,
          builtin: true,
          createdAt: base - 5_000,
          updatedAt: base - 5_000,
          prompt: `你是一位重视因果与可复现性的数据分析师。请基于我提供的数据或问题进行分析。

要求：
- 先明确业务问题、指标定义、口径与时间窗口。
- 检查数据质量：缺失、重复、异常值、选择偏差。
- 提出假设，并说明需要什么证据来支持或推翻。
- 给出分析步骤与可执行的 SQL / pandas 代码（注明假设）。
- 区分相关与因果，指出结论的适用范围和局限。
- 最终输出：结论、置信度、下一步实验建议。`,
        },
        {
          id: 'seed-product-manager',
          name: '产品经理',
          description: '把模糊想法变成轻量 PRD：用户故事、范围、指标与最小验证。',
          category: 'product',
          icon: 'compass',
          favorite: false,
          builtin: true,
          createdAt: base - 6_000,
          updatedAt: base - 6_000,
          prompt: `你是一位擅长把模糊想法变成可执行方案的产品经理。请针对我的想法输出一份轻量 PRD。

包含：
- 问题与目标用户（含一个具体人物画像）
- 现有替代方案与不足
- 核心场景与用户故事（按优先级）
- 功能范围：必须有 / 应该有 / 暂不做
- 关键流程与异常路径
- 成功指标与埋点
- 主要风险与验证方式（最小实验）

主动指出我描述中含糊或自相矛盾的地方。`,
        },
        {
          id: 'seed-translator',
          name: '翻译校对',
          description: '母语级中英翻译，保留事实与术语，解释关键取舍。',
          category: 'writing',
          icon: 'translate',
          favorite: false,
          builtin: true,
          createdAt: base - 7_000,
          updatedAt: base - 7_000,
          prompt: `你是一位母语级中英翻译与校对。请在忠实原意的前提下，让译文读起来像目标语言的原生写作。

流程：
1. 判断文本类型、读者与语气。
2. 给出译文；术语首次出现时附原文。
3. 对文化特定表达做本地化处理，必要时加简短译注。
4. 输出「直译对照」中差异最大的 5 处，说明取舍。

不要增删事实；不确定的专有名词保留原文并标注。`,
        },
      ]
    }

    const presetIdPattern = /^[A-Za-z0-9_-]{1,80}$/

    function normalizePreset(raw) {
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error('专家条目格式异常。')
      }
      if (typeof raw.id !== 'string' || !presetIdPattern.test(raw.id)) {
        throw new Error('专家标识格式异常。')
      }
      if (typeof raw.name !== 'string' || raw.name.length > maxName || raw.name.trim() === '') {
        throw new Error('专家名称不能为空，且不超过 80 个字符。')
      }
      if (raw.description !== undefined
        && (typeof raw.description !== 'string' || raw.description.length > maxDescription)) {
        throw new Error('专家简介不能超过 200 个字符。')
      }
      if (typeof raw.prompt !== 'string' || raw.prompt.length > maxPrompt || raw.prompt.trim() === '') {
        throw new Error('提示词不能为空，且不超过 20000 个字符。')
      }
      const category = categoryIds.has(raw.category) ? raw.category : 'general'
      const icon = iconNames.has(raw.icon) ? raw.icon : 'spark'
      const updatedAt = Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now()
      const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : updatedAt
      return {
        id: raw.id,
        name: raw.name.trim(),
        description: typeof raw.description === 'string' ? raw.description.trim() : '',
        category,
        icon,
        favorite: raw.favorite === true,
        builtin: raw.builtin === true,
        createdAt,
        updatedAt,
        prompt: raw.prompt.trim(),
      }
    }

    function normalizePresets(list) {
      if (!Array.isArray(list)) throw new Error('专家列表必须是数组。')
      const ids = new Set()
      return list.map(raw => {
        const preset = normalizePreset(raw)
        if (ids.has(preset.id)) throw new Error(`专家标识重复：${preset.id}`)
        ids.add(preset.id)
        return preset
      })
    }

    function samePresetContent(left, right) {
      return left.name === right.name
        && left.description === right.description
        && left.category === right.category
        && left.icon === right.icon
        && left.prompt === right.prompt
    }

    function readPresets() {
      const raw = localStorage.getItem(storageKey)
      if (raw === null) {
        const presets = seedPresets()
        writePresets(presets)
        return presets
      }
      let parsed
      try {
        parsed = JSON.parse(raw)
      } catch {
        throw new Error('本地专家库不是有效的 JSON。')
      }
      if (parsed?.format !== backupFormat || parsed.version !== 1 || !Array.isArray(parsed.presets)) {
        throw new Error('本地专家库格式不受支持。')
      }
      return normalizePresets(parsed.presets)
    }

    function writePresets(presets) {
      localStorage.setItem(storageKey, JSON.stringify({
        format: backupFormat,
        version: 1,
        presets,
      }))
    }

    function createExpertStore() {
      const listeners = new Set()
      let snapshot
      let listening = false

      function notify() {
        for (const listener of listeners) listener()
      }

      function reload() {
        try {
          snapshot = { presets: readPresets(), error: '' }
        } catch {
          snapshot = {
            presets: emptyPresets,
            error: '读取本地专家库失败。请检查浏览器存储权限或存档格式。',
          }
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
          if (listeners.size === 1 && !listening) {
            listening = true
            window.addEventListener('storage', onStorage)
            reload()
          }
          return () => {
            listeners.delete(listener)
            if (listeners.size === 0 && listening) {
              listening = false
              window.removeEventListener('storage', onStorage)
            }
          }
        },
        update(change) {
          const next = change(readPresets())
          writePresets(next)
          reload()
        },
        reset() {
          writePresets(seedPresets())
          reload()
        },
      }
    }

    const toastListeners = new Set()
    let toastValue = null
    let toastTimer = null
    let toastSeq = 0

    function publishToast(entry) {
      clearTimeout(toastTimer)
      toastValue = { ...entry, key: ++toastSeq }
      for (const listener of toastListeners) listener()
      toastTimer = setTimeout(() => dismissToast(), 5200)
    }

    function dismissToast() {
      clearTimeout(toastTimer)
      toastTimer = null
      if (toastValue === null) return
      toastValue = null
      for (const listener of toastListeners) listener()
    }

    const toastStore = {
      getSnapshot: () => toastValue,
      subscribe(listener) {
        toastListeners.add(listener)
        return () => toastListeners.delete(listener)
      },
      dispose() {
        clearTimeout(toastTimer)
        toastTimer = null
        toastValue = null
      },
    }

    const inputBridge = {
      sessionId: undefined,
      actions: undefined,
      draft: '',
      phase: 'plain',
      occurrences: 0,
    }

    function ComposerBridge({ inputActions, sessionId, useInput }) {
      const input = useInput(state => state)
      useLayoutEffect(() => {
        inputBridge.sessionId = sessionId
        inputBridge.actions = inputActions
        inputBridge.draft = input.draft
        inputBridge.phase = input.phase
        inputBridge.occurrences = Array.isArray(input.occurrences) ? input.occurrences.length : 0
      }, [inputActions, input.draft, input.occurrences, input.phase, sessionId])
      return null
    }

    function ToastHost() {
      const toast = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot)
      const tone = toast?.tone ?? 'success'
      return h('div', { className: 'dsh-exp-toast-host', 'aria-live': 'polite' },
        toast === null ? null : h('div', { key: toast.key, className: 'dsh-exp-toast', 'data-tone': tone, role: 'status' },
          h('span', { className: 'dsh-exp-toast-icon' },
            h(Glyph, { name: tone === 'success' ? 'check' : 'alert', size: 15 })),
          h('div', { className: 'dsh-exp-toast-copy' },
            h('strong', null, toast.text),
            toast.detail ? h('span', null, toast.detail) : null),
          toast.action ? h('button', {
            type: 'button',
            className: 'dsh-exp-toast-action',
            onClick() {
              const action = toast.action
              dismissToast()
              try {
                action.run()
              } catch {
                publishToast({ tone: 'error', text: '撤销失败，草稿可能已被修改。' })
              }
            },
          }, toast.action.label) : null,
          h('button', {
            type: 'button',
            className: 'dsh-exp-toast-close',
            'aria-label': '关闭通知',
            onClick: dismissToast,
          }, h(Glyph, { name: 'close', size: 13 })),
          h('span', { className: 'dsh-exp-toast-progress', 'aria-hidden': true })))
    }

    function ExpertCard({ preset, index, onApply, onEdit, onDelete, onFavorite }) {
      const category = categoryMap[preset.category] ?? categoryMap.general
      return h('article', {
        className: 'dsh-exp-card',
        'data-cat': preset.category,
        style: { '--exp-index': String(index) },
      },
      h('div', { className: 'dsh-exp-card-top' },
        h('span', { className: 'dsh-exp-tile', 'aria-hidden': true },
          h(Glyph, { name: preset.icon, size: 20 })),
        h('button', {
          type: 'button',
          className: 'dsh-exp-star',
          'aria-pressed': preset.favorite,
          'aria-label': preset.favorite ? `取消收藏 ${preset.name}` : `收藏 ${preset.name}`,
          title: preset.favorite ? '取消收藏' : '收藏',
          onClick: () => onFavorite(preset),
        }, h(StarIcon, { filled: preset.favorite }))),
      h('div', { className: 'dsh-exp-card-copy' },
        h('h2', null, preset.name),
        preset.description ? h('p', { className: 'dsh-exp-desc' }, preset.description) : null,
        h('p', { className: 'dsh-exp-preview' }, preset.prompt)),
      h('div', { className: 'dsh-exp-card-foot' },
        h('span', { className: 'dsh-exp-cat' }, category.label),
        h('span', { className: 'dsh-exp-spacer' }),
        h('button', {
          type: 'button',
          className: 'dsh-exp-iconbtn',
          title: '编辑',
          'aria-label': `编辑 ${preset.name}`,
          onClick: () => onEdit(preset),
        }, h(Glyph, { name: 'edit', size: 15 })),
        h('button', {
          type: 'button',
          className: 'dsh-exp-iconbtn dsh-exp-iconbtn--danger',
          title: '删除',
          'aria-label': `删除 ${preset.name}`,
          onClick: () => onDelete(preset),
        }, h(Glyph, { name: 'trash', size: 15 })),
        h('button', {
          type: 'button',
          className: 'dsh-exp-apply',
          'aria-label': `应用 ${preset.name}`,
          onClick: () => onApply(preset),
        }, '应用', h(Glyph, { name: 'arrow', size: 14 }))))
    }

    function focusableElements(container) {
      if (!container) return []
      return [...container.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )].filter(element => element.getClientRects().length > 0)
    }

    function PresetEditor({ preset, onCancel, onSave }) {
      const [name, setName] = useState(preset?.name ?? '')
      const [description, setDescription] = useState(preset?.description ?? '')
      const [category, setCategory] = useState(preset?.category ?? 'general')
      const [icon, setIcon] = useState(preset?.icon ?? 'spark')
      const [prompt, setPrompt] = useState(preset?.prompt ?? '')
      const [error, setError] = useState('')
      const panelRef = useRef(null)
      const nameRef = useRef(null)
      const cancelRef = useRef(onCancel)
      cancelRef.current = onCancel

      useEffect(() => {
        const previous = document.activeElement
        const timer = setTimeout(() => nameRef.current?.focus(), 40)
        function onKeyDown(event) {
          if (event.key === 'Escape') {
            event.preventDefault()
            cancelRef.current()
            return
          }
          if (event.key !== 'Tab') return
          const list = focusableElements(panelRef.current)
          if (list.length === 0) return
          const first = list[0]
          const last = list[list.length - 1]
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
          }
        }
        document.addEventListener('keydown', onKeyDown)
        return () => {
          clearTimeout(timer)
          document.removeEventListener('keydown', onKeyDown)
          if (previous && typeof previous.focus === 'function') previous.focus()
        }
      }, [])

      function submit(event) {
        event.preventDefault()
        const cleanName = name.trim()
        const cleanPrompt = prompt.trim()
        if (cleanName === '') {
          setError('请先填写专家名称。')
          nameRef.current?.focus()
          return
        }
        if (cleanPrompt === '') {
          setError('请先填写提示词。')
          panelRef.current?.querySelector('textarea')?.focus()
          return
        }
        setError('')
        onSave({
          name: cleanName,
          description: description.trim(),
          category,
          icon,
          prompt: cleanPrompt,
        })
      }

      return h('div', {
        className: 'dsh-exp-layer',
        onMouseDown(event) {
          if (event.target === event.currentTarget) onCancel()
        },
      },
      h('form', {
        className: 'dsh-exp-dialog',
        ref: panelRef,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'dsh-exp-editor-title',
        onSubmit: submit,
      },
      h('header', { className: 'dsh-exp-dialog-head' },
        h('span', { className: 'dsh-exp-dialog-mark' }, h(Glyph, { name: icon, size: 22 })),
        h('div', { className: 'dsh-exp-dialog-title' },
          h('h2', { id: 'dsh-exp-editor-title' }, preset ? '编辑专家' : '新建专家'),
          h('p', null, preset ? '修改会立即同步到本机专家库。' : '保存后即可在任意会话中一键载入。')),
        h('button', {
          type: 'button',
          className: 'dsh-exp-dialog-close',
          'aria-label': '关闭',
          onClick: onCancel,
        }, h(Glyph, { name: 'close', size: 16 }))),
      h('div', { className: 'dsh-exp-field' },
        h('span', { className: 'dsh-exp-label' }, '图标'),
        h('div', { className: 'dsh-exp-icon-grid', role: 'group', 'aria-label': '选择图标' },
          iconOptions.map(option => h('button', {
            key: option.id,
            type: 'button',
            className: 'dsh-exp-icon-choice',
            'aria-pressed': icon === option.id,
            title: option.label,
            'aria-label': option.label,
            onClick: () => setIcon(option.id),
          }, h(Glyph, { name: option.id, size: 18 }))))),
      h('div', { className: 'dsh-exp-form-row' },
        h('label', { className: 'dsh-exp-field' },
          h('span', { className: 'dsh-exp-label' }, '名称'),
          h('input', {
            ref: nameRef,
            value: name,
            maxLength: maxName,
            placeholder: '例如：代码审查专家',
            'aria-label': '专家名称',
            onChange: event => setName(event.target.value),
          })),
        h('label', { className: 'dsh-exp-field' },
          h('span', { className: 'dsh-exp-label' }, '分类'),
          h('select', {
            value: category,
            'aria-label': '专家分类',
            onChange: event => setCategory(event.target.value),
          }, categories.map(item => h('option', { key: item.id, value: item.id }, item.label))))),
      h('label', { className: 'dsh-exp-field' },
        h('span', { className: 'dsh-exp-label' }, '一句话简介', h('span', { className: 'dsh-exp-hint' }, '选填')),
        h('input', {
          value: description,
          maxLength: maxDescription,
          placeholder: '它擅长什么？适合什么场景？',
          'aria-label': '一句话简介',
          onChange: event => setDescription(event.target.value),
        })),
      h('label', { className: 'dsh-exp-field' },
        h('span', { className: 'dsh-exp-label' }, '提示词',
          h('span', { className: 'dsh-exp-hint' }, `${prompt.length} / ${maxPrompt}`)),
        h('textarea', {
          value: prompt,
          maxLength: maxPrompt,
          rows: 9,
          spellCheck: false,
          placeholder: '写下角色、工作方式与输出格式…',
          'aria-label': '提示词',
          onChange: event => setPrompt(event.target.value),
        })),
      error ? h('p', { className: 'dsh-exp-error-text', role: 'alert' },
        h(Glyph, { name: 'alert', size: 14 }), error) : null,
      h('footer', { className: 'dsh-exp-dialog-foot' },
        h('p', null, '保存后不会自动发送。'),
        h('div', { className: 'dsh-exp-dialog-actions' },
          h('button', { type: 'button', className: 'dsh-exp-ghost', onClick: onCancel }, '取消'),
          h('button', {
            type: 'submit',
            className: 'dsh-exp-primary',
            disabled: name.trim() === '' || prompt.trim() === '',
          }, preset ? '保存修改' : '创建专家')))))
    }

    function ConfirmDialog({ preset, onCancel, onConfirm }) {
      const panelRef = useRef(null)
      const cancelRef = useRef(onCancel)
      cancelRef.current = onCancel
      useEffect(() => {
        const previous = document.activeElement
        const timer = setTimeout(() => {
          panelRef.current?.querySelector('.dsh-exp-ghost')?.focus()
        }, 30)
        function onKeyDown(event) {
          if (event.key === 'Escape') {
            event.preventDefault()
            cancelRef.current()
            return
          }
          if (event.key !== 'Tab') return
          const list = focusableElements(panelRef.current)
          if (list.length === 0) return
          const first = list[0]
          const last = list[list.length - 1]
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
          }
        }
        document.addEventListener('keydown', onKeyDown)
        return () => {
          clearTimeout(timer)
          document.removeEventListener('keydown', onKeyDown)
          if (previous && typeof previous.focus === 'function') previous.focus()
        }
      }, [])
      return h('div', {
        className: 'dsh-exp-layer',
        onMouseDown(event) {
          if (event.target === event.currentTarget) onCancel()
        },
      },
      h('div', {
        className: 'dsh-exp-dialog dsh-exp-dialog--small',
        ref: panelRef,
        role: 'alertdialog',
        'aria-modal': 'true',
        'aria-labelledby': 'dsh-exp-confirm-title',
      },
      h('header', { className: 'dsh-exp-dialog-head' },
        h('span', { className: 'dsh-exp-dialog-mark dsh-exp-dialog-mark--danger' },
          h(Glyph, { name: 'trash', size: 21 })),
        h('div', { className: 'dsh-exp-dialog-title' },
          h('h2', { id: 'dsh-exp-confirm-title' }, '删除专家'),
          h('p', null, `「${preset.name}」将从本机专家库移除。`)),
        h('button', {
          type: 'button',
          className: 'dsh-exp-dialog-close',
          'aria-label': '关闭',
          onClick: onCancel,
        }, h(Glyph, { name: 'close', size: 16 }))),
      h('p', { className: 'dsh-exp-confirm-copy' }, '提示词内容会一并删除，此操作无法撤销。'),
      h('footer', { className: 'dsh-exp-dialog-foot' },
        h('p', null, '如需保留，请先导出备份。'),
        h('div', { className: 'dsh-exp-dialog-actions' },
          h('button', { type: 'button', className: 'dsh-exp-ghost', onClick: onCancel }, '取消'),
          h('button', {
            type: 'button',
            className: 'dsh-exp-primary dsh-exp-primary--danger',
            onClick: onConfirm,
          }, '确认删除')))))
    }

    function RestoreDialog({ modifiedCount, missingCount, onCancel, onConfirm }) {
      const panelRef = useRef(null)
      const cancelRef = useRef(onCancel)
      cancelRef.current = onCancel
      useEffect(() => {
        const previous = document.activeElement
        const timer = setTimeout(() => {
          panelRef.current?.querySelector('.dsh-exp-ghost')?.focus()
        }, 30)
        function onKeyDown(event) {
          if (event.key === 'Escape') {
            event.preventDefault()
            cancelRef.current()
            return
          }
          if (event.key !== 'Tab') return
          const list = focusableElements(panelRef.current)
          if (list.length === 0) return
          const first = list[0]
          const last = list[list.length - 1]
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
          }
        }
        document.addEventListener('keydown', onKeyDown)
        return () => {
          clearTimeout(timer)
          document.removeEventListener('keydown', onKeyDown)
          if (previous && typeof previous.focus === 'function') previous.focus()
        }
      }, [])
      const parts = []
      if (modifiedCount > 0) parts.push(`${modifiedCount} 位已修改`)
      if (missingCount > 0) parts.push(`${missingCount} 位已删除`)
      return h('div', {
        className: 'dsh-exp-layer',
        onMouseDown(event) {
          if (event.target === event.currentTarget) onCancel()
        },
      },
      h('div', {
        className: 'dsh-exp-dialog dsh-exp-dialog--small',
        ref: panelRef,
        role: 'alertdialog',
        'aria-modal': 'true',
        'aria-labelledby': 'dsh-exp-restore-title',
      },
      h('header', { className: 'dsh-exp-dialog-head' },
        h('span', { className: 'dsh-exp-dialog-mark' },
          h(Glyph, { name: 'reset', size: 21 })),
        h('div', { className: 'dsh-exp-dialog-title' },
          h('h2', { id: 'dsh-exp-restore-title' }, '恢复内置专家'),
          h('p', null, `将还原 ${modifiedCount + missingCount} 位内置专家（${parts.join('，')}）。`)),
        h('button', {
          type: 'button',
          className: 'dsh-exp-dialog-close',
          'aria-label': '关闭',
          onClick: onCancel,
        }, h(Glyph, { name: 'close', size: 16 }))),
      h('p', { className: 'dsh-exp-confirm-copy' },
        '内置专家的名称、简介、分类、图标和提示词会恢复默认，收藏状态会保留。你创建的专家不会被修改。'),
      h('footer', { className: 'dsh-exp-dialog-foot' },
        h('p', null, '如需保留当前修改，请先导出备份。'),
        h('div', { className: 'dsh-exp-dialog-actions' },
          h('button', { type: 'button', className: 'dsh-exp-ghost', onClick: onCancel }, '取消'),
          h('button', {
            type: 'button',
            className: 'dsh-exp-primary',
            onClick: onConfirm,
          }, '确认恢复')))))
    }

    function ExpertsPage({ store, applyPreset }) {
      const { presets, error } = useSyncExternalStore(store.subscribe, store.getSnapshot)
      const [query, setQuery] = useState('')
      const [filter, setFilter] = useState('all')
      const [editor, setEditor] = useState(null)
      const [deleting, setDeleting] = useState(null)
      const [restoring, setRestoring] = useState(null)
      const [notice, setNotice] = useState(null)
      const searchRef = useRef(null)
      const fileRef = useRef(null)
      const noticeTimer = useRef(null)

      useEffect(() => () => clearTimeout(noticeTimer.current), [])

      function flash(tone, text) {
        clearTimeout(noticeTimer.current)
        setNotice({ tone, text })
        noticeTimer.current = setTimeout(() => setNotice(null), 6000)
      }

      const favoriteCount = presets.filter(preset => preset.favorite).length
      const normalizedQuery = query.trim().toLowerCase()
      const visible = useMemo(() => {
        return presets
          .filter(preset => {
            if (filter === 'starred' && !preset.favorite) return false
            if (filter !== 'all' && filter !== 'starred' && preset.category !== filter) return false
            if (normalizedQuery === '') return true
            const category = categoryMap[preset.category]?.label ?? ''
            return `${preset.name}\n${preset.description}\n${preset.prompt}\n${category}`
              .toLowerCase()
              .includes(normalizedQuery)
          })
          .sort((left, right) => {
            const favoriteDelta = Number(right.favorite) - Number(left.favorite)
            return favoriteDelta !== 0 ? favoriteDelta : right.updatedAt - left.updatedAt
          })
      }, [presets, filter, normalizedQuery])

      const filters = [
        { id: 'all', label: '全部', count: presets.length },
        { id: 'starred', label: '收藏', count: favoriteCount },
        ...categories.map(category => ({
          id: category.id,
          label: category.label,
          count: presets.filter(preset => preset.category === category.id).length,
        })),
      ]

      function savePreset(values) {
        const editing = editor?.preset ?? null
        try {
          store.update(list => {
            const now = Date.now()
            if (editing !== null) {
              return list.map(preset => preset.id === editing.id
                ? { ...preset, ...values, updatedAt: now }
                : preset)
            }
            return [{
              id: crypto.randomUUID(),
              ...values,
              favorite: false,
              builtin: false,
              createdAt: now,
              updatedAt: now,
            }, ...list]
          })
          setEditor(null)
          flash('success', editing !== null ? `已保存「${values.name}」` : `已创建「${values.name}」`)
          if (editing === null) {
            setFilter('all')
            setQuery('')
          }
        } catch (failure) {
          flash('error', `保存失败：${failure?.message ?? String(failure)}`)
        }
      }

      function deletePreset() {
        const preset = deleting
        if (preset === null) return
        try {
          store.update(list => list.filter(item => item.id !== preset.id))
          setDeleting(null)
          flash('success', `已删除「${preset.name}」`)
        } catch (failure) {
          flash('error', `删除失败：${failure?.message ?? String(failure)}`)
        }
      }

      function toggleFavorite(preset) {
        try {
          store.update(list => list.map(item => item.id === preset.id
            ? { ...item, favorite: !item.favorite }
            : item))
        } catch (failure) {
          flash('error', `更新收藏失败：${failure?.message ?? String(failure)}`)
        }
      }

      function clearFilters() {
        setQuery('')
        setFilter('all')
      }

      function exportAll() {
        try {
          const date = new Date().toISOString()
          const payload = {
            format: backupFormat,
            version: 1,
            exportedAt: date,
            presets: store.getSnapshot().presets,
          }
          const url = URL.createObjectURL(new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
            type: 'application/json;charset=utf-8',
          }))
          const link = document.createElement('a')
          link.href = url
          link.download = `dsh-experts-${date.slice(0, 10)}.json`
          try {
            link.click()
          } finally {
            setTimeout(() => URL.revokeObjectURL(url), 30_000)
          }
          flash('success', `已导出 ${payload.presets.length} 位专家。`)
        } catch {
          flash('error', '无法生成专家库备份。')
        }
      }

      async function importFile(event) {
        const input = event.currentTarget
        const file = input.files?.[0]
        input.value = ''
        if (!file) return
        try {
          let parsed
          try {
            parsed = JSON.parse(await file.text())
          } catch {
            throw new Error('文件内容不是有效的 JSON。')
          }
          if (parsed?.format !== backupFormat || parsed.version !== 1 || !Array.isArray(parsed.presets)) {
            throw new Error('请选择由「专家」导出的 JSON 备份。')
          }
          const incoming = normalizePresets(parsed.presets)
          let imported = 0
          let skipped = 0
          store.update(list => {
            const ids = new Set(list.map(preset => preset.id))
            const additions = []
            for (const preset of incoming) {
              if (ids.has(preset.id)) {
                skipped += 1
                continue
              }
              ids.add(preset.id)
              additions.push(preset)
              imported += 1
            }
            return [...additions, ...list]
          })
          if (imported === 0) {
            flash('info', '没有新的专家可导入。')
          } else {
            flash('success', `已导入 ${imported} 位专家`
              + (skipped > 0 ? `，跳过 ${skipped} 位已有专家。` : '。'))
          }
        } catch (failure) {
          flash('error', `导入失败：${failure?.message ?? String(failure)}`)
        }
      }

      function buildRestorePlan() {
        const seeds = seedPresets()
        const list = store.getSnapshot().presets
        const byId = new Map(list.map(preset => [preset.id, preset]))
        const missing = seeds.filter(seed => !byId.has(seed.id))
        const modified = seeds.filter(seed => {
          const existing = byId.get(seed.id)
          return existing !== undefined && !samePresetContent(existing, seed)
        })
        return { seeds, missing, modified, total: missing.length + modified.length }
      }

      function applyRestore(plan) {
        if (plan.total === 0) {
          setRestoring(null)
          flash('info', '内置专家均为默认内容。')
          return
        }
        store.update(current => {
          const seeds = seedPresets()
          const seedById = new Map(seeds.map(seed => [seed.id, seed]))
          const existing = new Set(current.map(preset => preset.id))
          const now = Date.now()
          const next = current.map(preset => {
            const seed = seedById.get(preset.id)
            if (seed === undefined || samePresetContent(preset, seed)) return preset
            return {
              ...seed,
              favorite: preset.favorite,
              createdAt: preset.createdAt,
              updatedAt: now,
            }
          })
          return [...seeds.filter(seed => !existing.has(seed.id)), ...next]
        })
        setRestoring(null)
        flash('success', `已恢复 ${plan.total} 位内置专家。`)
      }

      function requestRestore() {
        try {
          const plan = buildRestorePlan()
          if (plan.total === 0) {
            flash('info', '内置专家均为默认内容。')
            return
          }
          if (plan.modified.length > 0) {
            setRestoring({
              modifiedCount: plan.modified.length,
              missingCount: plan.missing.length,
            })
            return
          }
          applyRestore(plan)
        } catch (failure) {
          flash('error', `恢复失败：${failure?.message ?? String(failure)}`)
        }
      }

      function confirmRestore() {
        try {
          applyRestore(buildRestorePlan())
        } catch (failure) {
          setRestoring(null)
          flash('error', `恢复失败：${failure?.message ?? String(failure)}`)
        }
      }

      function resetStore() {
        try {
          store.reset()
          clearFilters()
          flash('success', '本地专家库已重置为内置专家。')
        } catch {
          flash('error', '重置失败，请检查浏览器存储权限。')
        }
      }

      const showEmpty = !error && visible.length === 0
      return h('section', { className: 'dsh-exp-page', 'aria-labelledby': 'dsh-exp-heading' },
        h('style', null, styles),
        h('div', { className: 'dsh-exp-inner' },
          h('header', { className: 'dsh-exp-hero' },
            h('div', { className: 'dsh-exp-hero-copy' },
              h('div', { className: 'dsh-exp-topline' },
                h('p', { className: 'dsh-exp-eyebrow' },
                  h(Glyph, { name: 'spark', size: 14 }), 'EXPERT PRESETS'),
                h('span', { className: 'dsh-exp-topline-rule', 'aria-hidden': true }),
                h('div', { className: 'dsh-exp-tools', role: 'group', 'aria-label': '专家库操作' },
                  h('input', {
                    ref: fileRef,
                    type: 'file',
                    accept: '.json,application/json',
                    hidden: true,
                    'aria-label': '选择专家 JSON 备份',
                    onChange: event => void importFile(event),
                  }),
                  h('button', {
                    type: 'button',
                    className: 'dsh-exp-tool',
                    title: '从 JSON 备份导入专家',
                    onClick: () => fileRef.current?.click(),
                  }, h(Glyph, { name: 'upload', size: 14 }), '导入'),
                  h('button', {
                    type: 'button',
                    className: 'dsh-exp-tool',
                    title: '把全部专家导出为 JSON',
                    onClick: exportAll,
                  }, h(Glyph, { name: 'download', size: 14 }), '导出'))),
              h('h1', { id: 'dsh-exp-heading', className: 'dsh-exp-title' },
                '专家', h('span', { className: 'dsh-exp-count' }, `${presets.length} 位`)),
              h('p', { className: 'dsh-exp-lede' },
                '把常用的角色、方法与输出规范沉淀成专家。选一位，一键装填到对话框。')),
            h('div', { className: 'dsh-exp-hero-actions' },
              h('button', {
                type: 'button',
                className: 'dsh-exp-primary',
                disabled: Boolean(error),
                onClick: () => setEditor({ preset: null }),
              }, h(Glyph, { name: 'plus', size: 16 }), '新建专家'))),
          error ? h('div', { className: 'dsh-exp-error', role: 'alert' },
            h('span', { className: 'dsh-exp-error-icon' }, h(Glyph, { name: 'alert', size: 18 })),
            h('div', null,
              h('strong', null, '专家库暂时不可用'),
              h('p', null, error)),
            h('button', { type: 'button', className: 'dsh-exp-ghost', onClick: resetStore }, '重置专家库')) : null,
          error ? null : h('div', { className: 'dsh-exp-toolbar' },
            h('label', { className: 'dsh-exp-search' },
              h(Glyph, { name: 'search', size: 16 }),
              h('input', {
                ref: searchRef,
                type: 'search',
                value: query,
                placeholder: '搜索专家、场景或提示词…',
                'aria-label': '搜索专家',
                onChange: event => setQuery(event.target.value),
              }),
              query !== '' ? h('button', {
                type: 'button',
                className: 'dsh-exp-search-clear',
                'aria-label': '清除搜索',
                onClick() {
                  setQuery('')
                  searchRef.current?.focus()
                },
              }, h(Glyph, { name: 'close', size: 13 })) : null),
            h('div', { className: 'dsh-exp-filters', role: 'group', 'aria-label': '筛选专家' },
              filters.map(item => h('button', {
                key: item.id,
                type: 'button',
                className: 'dsh-exp-chip',
                'aria-pressed': filter === item.id,
                onClick: () => setFilter(item.id),
              }, item.label, h('span', { className: 'dsh-exp-chip-count' }, item.count))))),
          notice !== null ? h('div', {
            className: 'dsh-exp-notice',
            'data-tone': notice.tone,
            role: notice.tone === 'error' ? 'alert' : 'status',
          },
          h(Glyph, { name: notice.tone === 'error' ? 'alert' : 'check', size: 15 }),
          h('span', null, notice.text),
          h('button', {
            type: 'button',
            className: 'dsh-exp-notice-close',
            'aria-label': '关闭提示',
            onClick: () => setNotice(null),
          }, h(Glyph, { name: 'close', size: 13 }))) : null,
          !error && visible.length > 0 ? h('div', { className: 'dsh-exp-grid' },
            visible.map((preset, index) => h(ExpertCard, {
              key: preset.id,
              preset,
              index,
              onApply: applyPreset,
              onEdit: target => setEditor({ preset: target }),
              onDelete: target => setDeleting(target),
              onFavorite: toggleFavorite,
            }))) : null,
          showEmpty ? h('div', { className: 'dsh-exp-empty' },
            h('span', { className: 'dsh-exp-empty-mark' }, h(Glyph, { name: 'spark', size: 24 })),
            h('strong', null,
              error ? '专家库暂时不可用'
                : presets.length === 0 ? '创建第一位专家'
                  : '没有匹配的专家'),
            h('p', null,
              error ? '可以尝试重置本地专家库，或检查浏览器存储权限。'
                : presets.length === 0 ? '把你的角色设定、工作流或输出规范保存下来。'
                  : '换个关键词或分类再试试。'),
            h('button', {
              type: 'button',
              className: 'dsh-exp-ghost',
              onClick: presets.length === 0 ? () => setEditor({ preset: null }) : clearFilters,
            }, presets.length === 0 ? '新建专家' : '清除筛选')) : null,
          h('footer', { className: 'dsh-exp-foot' },
            h('span', null, '应用只会把提示词载入输入框，不会自动发送。'),
            h('button', {
              type: 'button',
              className: 'dsh-exp-foot-action',
              title: '把内置专家还原为默认内容，不会修改你创建的专家',
              onClick: requestRestore,
            }, h(Glyph, { name: 'reset', size: 14 }), '恢复内置专家'))),
        editor !== null ? h(PresetEditor, {
          key: editor.preset?.id ?? 'new',
          preset: editor.preset,
          onCancel: () => setEditor(null),
          onSave: savePreset,
        }) : null,
        deleting !== null ? h(ConfirmDialog, {
          preset: deleting,
          onCancel: () => setDeleting(null),
          onConfirm: deletePreset,
        }) : null,
        restoring !== null ? h(RestoreDialog, {
          modifiedCount: restoring.modifiedCount,
          missingCount: restoring.missingCount,
          onCancel: () => setRestoring(null),
          onConfirm: confirmRestore,
        }) : null)
    }

    const styles = `
      .dsh-exp-page {
        --exp-accent:light-dark(#5b4bcf,#b9a9ff);
        --exp-accent-2:light-dark(#8b5cf6,#8b7bff);
        --exp-ink:var(--dsw-alias-label-primary,CanvasText);
        --exp-muted:var(--dsw-alias-label-secondary,light-dark(#5c6470,#aab3c0));
        --exp-line:var(--dsw-alias-border-l1,color-mix(in srgb,var(--exp-ink) 11%,transparent));
        --exp-line-strong:var(--dsw-alias-border-l2,color-mix(in srgb,var(--exp-ink) 18%,transparent));
        --exp-surface:var(--dsw-alias-bg-layer-1,Canvas);
        --exp-surface-2:var(--dsw-alias-bg-layer-2,Canvas);
        --exp-overlay:var(--dsw-alias-bg-overlay,Canvas);
        --exp-hover:color-mix(in srgb,var(--exp-ink) 4.5%,transparent);
        --exp-danger:var(--dsw-alias-state-error-primary,light-dark(#a03938,#ffaba6));
        --exp-warn:var(--dsw-alias-state-warn-primary,light-dark(#8a5a00,#f0c56b));
        --exp-success:var(--dsw-alias-state-success-primary,light-dark(#1f7a5a,#7fe0bb));
        container:dsh-exp / inline-size;
        height:100%; min-height:0; overflow-x:clip; overflow-y:auto;
        color:var(--exp-ink); font-size:14px; line-height:1.55;
        scrollbar-width:thin;
      }
      .dsh-exp-page *, .dsh-exp-layer *, .dsh-exp-toast-host * { box-sizing:border-box; }
      .dsh-exp-inner {
        position:relative; isolation:isolate;
        max-width:1080px; margin-inline:auto;
        padding:clamp(30px,5.6cqw,58px) clamp(18px,4.6cqw,54px) 44px;
      }
      .dsh-exp-inner::before {
        content:""; position:absolute; z-index:-1; inset:-90px -8% auto; height:330px;
        background:
          radial-gradient(46% 100% at 22% 0%,color-mix(in srgb,var(--exp-accent) 16%,transparent),transparent 70%),
          radial-gradient(38% 90% at 82% 6%,color-mix(in srgb,var(--exp-accent-2) 11%,transparent),transparent 72%);
        pointer-events:none;
      }
      .dsh-exp-page p { margin:0; }
      .dsh-exp-page h1, .dsh-exp-page h2 { margin:0; }
      .dsh-exp-page button, .dsh-exp-layer button, .dsh-exp-toast-host button {
        font:inherit; color:inherit; background:transparent; border:0; cursor:pointer;
      }
      .dsh-exp-page button, .dsh-exp-layer button { display:inline-flex; align-items:center; justify-content:center; gap:6px; }
      .dsh-exp-page button:disabled, .dsh-exp-layer button:disabled { opacity:.45; cursor:default; }
      .dsh-exp-page :focus-visible, .dsh-exp-layer :focus-visible, .dsh-exp-toast-host :focus-visible {
        outline:2px solid color-mix(in srgb,var(--exp-accent) 78%,transparent); outline-offset:2px;
      }
      .dsh-exp-hero { display:flex; justify-content:space-between; align-items:flex-end; gap:22px; margin-bottom:26px; }
      .dsh-exp-eyebrow {
        display:flex; align-items:center; gap:7px; margin-bottom:0 !important;
        color:var(--exp-accent); font-size:11px; font-weight:700; letter-spacing:.16em;
      }
      .dsh-exp-topline { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:11px; }
      .dsh-exp-topline-rule { width:1px; height:11px; flex:none; background:var(--exp-line-strong); }
      .dsh-exp-title {
        display:flex; align-items:center; gap:12px; flex-wrap:wrap;
        font-size:clamp(33px,5.2cqw,46px); line-height:1.05; font-weight:700; letter-spacing:-.035em;
      }
      .dsh-exp-count {
        display:inline-flex; align-items:center; height:26px; padding:0 10px;
        border-radius:999px; border:1px solid color-mix(in srgb,var(--exp-accent) 26%,var(--exp-line));
        background:color-mix(in srgb,var(--exp-accent) 10%,transparent);
        color:var(--exp-accent); font-size:12px; font-weight:650; letter-spacing:.01em;
      }
      .dsh-exp-lede { max-width:52ch; margin-top:12px !important; color:var(--exp-muted); font-size:13.5px; }
      .dsh-exp-hero-actions { flex:none; padding-bottom:4px; }
      .dsh-exp-primary {
        min-height:38px; padding:0 15px; border-radius:11px;
        color:light-dark(#fff,#17112e);
        background:linear-gradient(135deg,var(--exp-accent),var(--exp-accent-2));
        font-size:12.5px; font-weight:650; letter-spacing:.01em;
        box-shadow:0 10px 26px -14px color-mix(in srgb,var(--exp-accent) 80%,transparent);
        transition:filter .18s ease,transform .18s ease,box-shadow .18s ease;
      }
      .dsh-exp-primary:hover:not(:disabled) {
        filter:brightness(1.06); transform:translateY(-1px);
        box-shadow:0 14px 30px -14px color-mix(in srgb,var(--exp-accent) 86%,transparent);
      }
      .dsh-exp-primary:active:not(:disabled) { transform:translateY(0); }
      .dsh-exp-primary--danger { background:linear-gradient(135deg,light-dark(#b23b3b,#ff9c96),light-dark(#d14b4b,#ffc0b8)); }
      .dsh-exp-ghost {
        min-height:36px; padding:0 13px; border-radius:10px;
        border:1px solid var(--exp-line); background:var(--exp-surface);
        font-size:12.5px; font-weight:600; transition:background-color .16s ease,border-color .16s ease;
      }
      .dsh-exp-ghost:hover { background:var(--exp-hover); border-color:var(--exp-line-strong); }
      .dsh-exp-toolbar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:16px; }
      .dsh-exp-search {
        display:flex; align-items:center; gap:8px; flex:1 1 260px; min-width:210px; height:38px;
        padding:0 10px; border:1px solid var(--exp-line); border-radius:11px; background:var(--exp-surface);
        color:var(--exp-muted); transition:border-color .18s ease,box-shadow .18s ease;
      }
      .dsh-exp-search:focus-within {
        border-color:color-mix(in srgb,var(--exp-accent) 52%,var(--exp-line));
        box-shadow:0 0 0 3px color-mix(in srgb,var(--exp-accent) 13%,transparent);
      }
      .dsh-exp-search input {
        flex:1; min-width:0; height:100%; border:0; outline:0; background:none;
        color:var(--exp-ink); font:inherit; font-size:13px;
      }
      .dsh-exp-search input::placeholder { color:color-mix(in srgb,var(--exp-muted) 82%,transparent); }
      .dsh-exp-search input::-webkit-search-cancel-button { display:none; }
      .dsh-exp-search-clear {
        width:22px; height:22px; flex:none; border-radius:999px; color:var(--exp-muted);
      }
      .dsh-exp-search-clear:hover { background:var(--exp-hover); color:var(--exp-ink); }
      .dsh-exp-filters { display:flex; align-items:center; gap:5px; flex-wrap:wrap; }
      .dsh-exp-chip {
        height:31px; padding:0 10px; border-radius:999px; border:1px solid transparent;
        color:var(--exp-muted); font-size:12px; font-weight:600;
        transition:color .15s ease,background-color .15s ease,border-color .15s ease;
      }
      .dsh-exp-chip:hover { color:var(--exp-ink); background:var(--exp-hover); }
      .dsh-exp-chip[aria-pressed=true] {
        color:var(--exp-accent);
        border-color:color-mix(in srgb,var(--exp-accent) 25%,transparent);
        background:color-mix(in srgb,var(--exp-accent) 11%,transparent);
      }
      .dsh-exp-chip-count { font-size:10.5px; font-variant-numeric:tabular-nums; opacity:.68; }
      .dsh-exp-tools { display:flex; align-items:center; gap:1px; }
      .dsh-exp-tool {
        height:24px; padding:0 6px; border-radius:6px;
        color:color-mix(in srgb,var(--exp-muted) 86%,transparent); font-size:11.5px; font-weight:600;
        transition:background-color .15s ease,color .15s ease;
      }
      .dsh-exp-tool:hover { color:var(--exp-ink); background:var(--exp-hover); }
      .dsh-exp-notice {
        display:flex; align-items:center; gap:8px; margin-bottom:14px; padding:9px 11px;
        border:1px solid var(--exp-line); border-radius:10px; background:var(--exp-surface);
        color:var(--exp-muted); font-size:12.5px;
        animation:dsh-exp-fade .22s ease both;
      }
      .dsh-exp-notice[data-tone=success] { color:var(--exp-success); border-color:color-mix(in srgb,var(--exp-success) 24%,var(--exp-line)); }
      .dsh-exp-notice[data-tone=error] { color:var(--exp-danger); border-color:color-mix(in srgb,var(--exp-danger) 28%,var(--exp-line)); }
      .dsh-exp-notice > span { flex:1; overflow-wrap:anywhere; }
      .dsh-exp-notice-close { width:22px; height:22px; flex:none; border-radius:999px; color:inherit; opacity:.7; }
      .dsh-exp-notice-close:hover { opacity:1; background:var(--exp-hover); }
      .dsh-exp-grid {
        display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,282px),1fr)); gap:14px;
      }
      .dsh-exp-card {
        --exp-card-accent:light-dark(#6d5bd0,#b7a7ff);
        position:relative; display:flex; flex-direction:column; gap:11px;
        min-height:236px; padding:16px 16px 13px;
        border:1px solid var(--exp-line); border-radius:18px;
        background:linear-gradient(180deg,color-mix(in srgb,var(--exp-card-accent) 4.5%,var(--exp-surface)),var(--exp-surface) 58%);
        box-shadow:0 1px 0 light-dark(rgba(255,255,255,.5),rgba(255,255,255,.03)) inset;
        transition:transform .22s cubic-bezier(.2,.7,.2,1),border-color .22s ease,box-shadow .22s ease;
        animation:dsh-exp-rise .45s cubic-bezier(.2,.7,.2,1) backwards;
        animation-delay:calc(var(--exp-index,0) * 26ms);
      }
      .dsh-exp-card[data-cat=writing] { --exp-card-accent:light-dark(#b33a68,#ff9dbb); }
      .dsh-exp-card[data-cat=coding] { --exp-card-accent:light-dark(#2563a8,#8cbcff); }
      .dsh-exp-card[data-cat=analysis] { --exp-card-accent:light-dark(#0d7368,#7fdcca); }
      .dsh-exp-card[data-cat=learning] { --exp-card-accent:light-dark(#96600f,#f4c16a); }
      .dsh-exp-card[data-cat=product] { --exp-card-accent:light-dark(#3e5cba,#a3b6ff); }
      .dsh-exp-card:hover {
        transform:translateY(-3px);
        border-color:color-mix(in srgb,var(--exp-card-accent) 40%,var(--exp-line));
        box-shadow:0 20px 46px -30px color-mix(in srgb,var(--exp-card-accent) 72%,transparent),
          0 3px 10px -6px light-dark(rgba(22,18,45,.18),rgba(0,0,0,.5));
      }
      .dsh-exp-card-top { display:flex; align-items:flex-start; gap:8px; }
      .dsh-exp-tile {
        display:grid; place-items:center; width:41px; height:41px; flex:none; border-radius:12px;
        color:var(--exp-card-accent);
        background:linear-gradient(145deg,color-mix(in srgb,var(--exp-card-accent) 16%,transparent),color-mix(in srgb,var(--exp-card-accent) 7%,transparent));
        border:1px solid color-mix(in srgb,var(--exp-card-accent) 19%,transparent);
      }
      .dsh-exp-star {
        width:30px; height:30px; margin-left:auto; border-radius:9px; flex:none;
        color:color-mix(in srgb,var(--exp-muted) 72%,transparent);
        transition:color .16s ease,background-color .16s ease,transform .16s ease;
      }
      .dsh-exp-star:hover { color:light-dark(#b7791f,#f6c667); background:var(--exp-hover); transform:scale(1.06); }
      .dsh-exp-star[aria-pressed=true] { color:light-dark(#b7791f,#f6c667); }
      .dsh-exp-card-copy { display:flex; flex-direction:column; gap:6px; min-width:0; }
      .dsh-exp-card h2 {
        font-size:16.5px; line-height:1.3; font-weight:650; letter-spacing:-.015em;
        overflow-wrap:anywhere;
      }
      .dsh-exp-desc {
        display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
        color:var(--exp-muted); font-size:12.5px; line-height:1.5;
      }
      .dsh-exp-preview {
        display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;
        margin-top:2px !important; padding:8px 10px; border-radius:9px;
        background:color-mix(in srgb,var(--exp-ink) 3.6%,transparent);
        color:color-mix(in srgb,var(--exp-muted) 94%,transparent);
        font-size:11.5px; line-height:1.62; white-space:pre-line; overflow-wrap:anywhere;
      }
      .dsh-exp-spacer { flex:1; }
      .dsh-exp-card-foot {
        display:flex; align-items:center; gap:2px; margin-top:auto;
        padding-top:11px; border-top:1px solid var(--exp-line);
      }
      .dsh-exp-cat {
        display:inline-flex; align-items:center; height:22px; padding:0 8px; border-radius:999px;
        color:var(--exp-card-accent);
        background:color-mix(in srgb,var(--exp-card-accent) 11%,transparent);
        font-size:10.5px; font-weight:650; letter-spacing:.01em;
      }
      .dsh-exp-iconbtn {
        width:27px; height:27px; border-radius:8px; color:var(--exp-muted); opacity:.62;
        transition:opacity .15s ease,color .15s ease,background-color .15s ease;
      }
      .dsh-exp-iconbtn:hover { opacity:1; color:var(--exp-ink); background:var(--exp-hover); }
      .dsh-exp-iconbtn--danger:hover { color:var(--exp-danger); background:color-mix(in srgb,var(--exp-danger) 10%,transparent); }
      .dsh-exp-apply {
        height:30px; margin-left:5px; padding:0 11px; border-radius:999px;
        color:var(--exp-accent); background:color-mix(in srgb,var(--exp-accent) 11%,transparent);
        border:1px solid color-mix(in srgb,var(--exp-accent) 21%,transparent);
        font-size:11.5px; font-weight:650;
        transition:background-color .18s ease,color .18s ease,border-color .18s ease,box-shadow .18s ease;
      }
      .dsh-exp-apply svg { transition:transform .2s cubic-bezier(.2,.7,.2,1); }
      .dsh-exp-apply:hover {
        color:light-dark(#fff,#15102a); background:var(--exp-accent);
        border-color:var(--exp-accent);
        box-shadow:0 8px 18px -10px color-mix(in srgb,var(--exp-accent) 85%,transparent);
      }
      .dsh-exp-apply:hover svg { transform:translateX(2px); }
      .dsh-exp-empty {
        display:grid; justify-items:center; gap:7px; text-align:center;
        padding:52px 20px; border:1px dashed var(--exp-line-strong); border-radius:18px;
      }
      .dsh-exp-empty-mark {
        display:grid; place-items:center; width:48px; height:48px; margin-bottom:7px;
        border-radius:14px; color:var(--exp-accent);
        background:color-mix(in srgb,var(--exp-accent) 10%,transparent);
        border:1px solid color-mix(in srgb,var(--exp-accent) 18%,transparent);
      }
      .dsh-exp-empty strong { font-size:15px; font-weight:650; }
      .dsh-exp-empty p { max-width:40ch; color:var(--exp-muted); font-size:12.5px; }
      .dsh-exp-empty button { margin-top:8px; }
      .dsh-exp-error {
        display:flex; align-items:center; gap:12px; margin-bottom:16px; padding:13px 14px;
        border:1px solid color-mix(in srgb,var(--exp-danger) 26%,var(--exp-line)); border-radius:12px;
        background:color-mix(in srgb,var(--exp-danger) 5%,var(--exp-surface));
      }
      .dsh-exp-error-icon { display:grid; place-items:center; width:34px; height:34px; flex:none; border-radius:10px; color:var(--exp-danger); background:color-mix(in srgb,var(--exp-danger) 10%,transparent); }
      .dsh-exp-error strong { display:block; font-size:13px; }
      .dsh-exp-error p { margin-top:3px !important; color:var(--exp-muted); font-size:12px; }
      .dsh-exp-error .dsh-exp-ghost { margin-left:auto; flex:none; }
      .dsh-exp-foot {
        display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;
        margin-top:26px; padding-top:14px; border-top:1px solid var(--exp-line);
        color:var(--exp-muted); font-size:11.5px;
      }
      .dsh-exp-foot-action {
        height:28px; padding:0 8px; border-radius:8px; color:var(--exp-muted);
        font-size:11.5px; font-weight:600; transition:background-color .15s ease,color .15s ease;
      }
      .dsh-exp-foot-action:hover { color:var(--exp-ink); background:var(--exp-hover); }
      .dsh-exp-layer {
        position:fixed; inset:0; z-index:1300; display:grid; place-items:center;
        padding:22px; overflow:auto;
        background:color-mix(in srgb,light-dark(#0c0a18,#000) 48%,transparent);
        backdrop-filter:blur(4px);
        animation:dsh-exp-fade .2s ease both;
      }
      .dsh-exp-dialog {
        width:min(94vw,660px); max-height:min(90vh,860px); overflow:auto;
        display:flex; flex-direction:column; gap:16px;
        padding:22px; border:1px solid var(--exp-line-strong); border-radius:22px;
        background:var(--exp-overlay); color:var(--exp-ink);
        box-shadow:0 40px 120px -44px light-dark(rgba(25,18,60,.55),rgba(0,0,0,.85));
        animation:dsh-exp-pop .26s cubic-bezier(.2,.75,.2,1) both;
        scrollbar-width:thin;
      }
      .dsh-exp-dialog--small { width:min(92vw,430px); gap:14px; }
      .dsh-exp-dialog-head { display:flex; align-items:flex-start; gap:12px; }
      .dsh-exp-dialog-mark {
        display:grid; place-items:center; width:44px; height:44px; flex:none; border-radius:13px;
        color:var(--exp-accent); background:color-mix(in srgb,var(--exp-accent) 11%,transparent);
        border:1px solid color-mix(in srgb,var(--exp-accent) 18%,transparent);
      }
      .dsh-exp-dialog-mark--danger { color:var(--exp-danger); background:color-mix(in srgb,var(--exp-danger) 10%,transparent); border-color:color-mix(in srgb,var(--exp-danger) 18%,transparent); }
      .dsh-exp-dialog-title { flex:1; min-width:0; }
      .dsh-exp-dialog-title h2 { font-size:17px; line-height:1.3; font-weight:670; letter-spacing:-.015em; }
      .dsh-exp-dialog-title p { margin-top:3px !important; color:var(--exp-muted); font-size:12px; }
      .dsh-exp-dialog-close { width:30px; height:30px; flex:none; border-radius:9px; color:var(--exp-muted); }
      .dsh-exp-dialog-close:hover { color:var(--exp-ink); background:var(--exp-hover); }
      .dsh-exp-field { display:flex; flex-direction:column; gap:7px; min-width:0; }
      .dsh-exp-label { display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:12px; font-weight:640; color:var(--exp-ink); }
      .dsh-exp-hint { color:var(--exp-muted); font-size:10.5px; font-weight:500; font-variant-numeric:tabular-nums; }
      .dsh-exp-dialog input, .dsh-exp-dialog textarea, .dsh-exp-dialog select {
        width:100%; padding:9px 11px; border:1px solid var(--exp-line); border-radius:9px;
        background:var(--exp-surface); color:var(--exp-ink); font:inherit; font-size:13px;
        transition:border-color .16s ease,box-shadow .16s ease;
      }
      .dsh-exp-dialog input:focus, .dsh-exp-dialog textarea:focus, .dsh-exp-dialog select:focus {
        outline:none; border-color:color-mix(in srgb,var(--exp-accent) 56%,var(--exp-line));
        box-shadow:0 0 0 3px color-mix(in srgb,var(--exp-accent) 13%,transparent);
      }
      .dsh-exp-dialog textarea { min-height:190px; resize:vertical; line-height:1.7; }
      .dsh-exp-icon-grid { display:flex; flex-wrap:wrap; gap:6px; }
      .dsh-exp-icon-choice {
        width:36px; height:36px; border-radius:10px; color:var(--exp-muted);
        border:1px solid var(--exp-line); background:var(--exp-surface);
        transition:color .15s ease,border-color .15s ease,background-color .15s ease,transform .15s ease;
      }
      .dsh-exp-icon-choice:hover { color:var(--exp-ink); background:var(--exp-hover); transform:translateY(-1px); }
      .dsh-exp-icon-choice[aria-pressed=true] {
        color:var(--exp-accent); border-color:color-mix(in srgb,var(--exp-accent) 42%,transparent);
        background:color-mix(in srgb,var(--exp-accent) 12%,transparent);
      }
      .dsh-exp-form-row { display:grid; grid-template-columns:minmax(0,1.5fr) minmax(0,1fr); gap:12px; }
      .dsh-exp-error-text { display:flex; align-items:center; gap:6px; color:var(--exp-danger); font-size:12px; }
      .dsh-exp-dialog-foot { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; padding-top:4px; }
      .dsh-exp-dialog-foot p { color:var(--exp-muted); font-size:11.5px; }
      .dsh-exp-dialog-actions { display:flex; align-items:center; gap:8px; margin-left:auto; }
      .dsh-exp-confirm-copy { color:var(--exp-muted); font-size:12.5px; line-height:1.6; }
      .dsh-exp-toast-host {
        --exp-muted:var(--dsw-alias-label-secondary,light-dark(#5c6470,#aab3c0));
        --exp-line:var(--dsw-alias-border-l1,light-dark(#e3e5ea,#33343d));
        --exp-hover:color-mix(in srgb,currentColor 6%,transparent);
        --exp-danger:var(--dsw-alias-state-error-primary,light-dark(#a03938,#ffaba6));
        --exp-warn:var(--dsw-alias-state-warn-primary,light-dark(#8a5a00,#f0c56b));
        --exp-success:var(--dsw-alias-state-success-primary,light-dark(#1f7a5a,#7fe0bb));
        position:fixed; inset-block-start:var(--dsh-frame-overlay-top,18px); inset-inline:0; z-index:1400;
        display:flex; justify-content:center; padding:0 16px; pointer-events:none;
      }
      .dsh-exp-toast {
        --toast-accent:var(--exp-success,#1f7a5a);
        position:relative; display:flex; align-items:center; gap:10px; overflow:hidden;
        min-width:min(92vw,300px); max-width:min(92vw,520px);
        padding:10px 11px 11px; border-radius:14px;
        background:var(--dsw-alias-bg-overlay,light-dark(#fff,#1c1b26));
        border:1px solid color-mix(in srgb,var(--toast-accent) 26%,var(--exp-line,transparent));
        color:var(--dsw-alias-label-primary,#111);
        box-shadow:0 22px 60px -26px light-dark(rgba(30,22,70,.45),rgba(0,0,0,.8));
        pointer-events:auto;
        animation:dsh-exp-toast-in .3s cubic-bezier(.2,.75,.2,1) both;
      }
      .dsh-exp-toast[data-tone=error] { --toast-accent:var(--exp-danger,#a03938); }
      .dsh-exp-toast[data-tone=warn] { --toast-accent:var(--exp-warn,#8a5a00); }
      .dsh-exp-toast-icon {
        display:grid; place-items:center; width:26px; height:26px; flex:none; border-radius:999px;
        color:var(--toast-accent); background:color-mix(in srgb,var(--toast-accent) 13%,transparent);
      }
      .dsh-exp-toast-copy { display:flex; flex-direction:column; gap:1px; min-width:0; }
      .dsh-exp-toast-copy strong { font-size:12.5px; font-weight:650; line-height:1.4; }
      .dsh-exp-toast-copy span { color:var(--exp-muted); font-size:11px; line-height:1.4; }
      .dsh-exp-toast-action {
        flex:none; height:28px; padding:0 9px; border-radius:8px;
        color:var(--toast-accent); background:color-mix(in srgb,var(--toast-accent) 11%,transparent);
        font-size:11.5px; font-weight:650;
      }
      .dsh-exp-toast-action:hover { background:color-mix(in srgb,var(--toast-accent) 18%,transparent); }
      .dsh-exp-toast-close { width:24px; height:24px; flex:none; border-radius:999px; color:var(--exp-muted); }
      .dsh-exp-toast-close:hover { color:inherit; background:var(--exp-hover); }
      .dsh-exp-toast-progress {
        position:absolute; inset-inline:0; inset-block-end:0; height:2px;
        background:var(--toast-accent); opacity:.55; transform-origin:left center;
        animation:dsh-exp-progress 5.2s linear both;
      }
      @keyframes dsh-exp-rise {
        from { opacity:0; transform:translateY(10px) scale(.986); }
        to { opacity:1; transform:none; }
      }
      @keyframes dsh-exp-fade { from { opacity:0; } to { opacity:1; } }
      @keyframes dsh-exp-pop {
        from { opacity:0; transform:translateY(16px) scale(.972); }
        to { opacity:1; transform:none; }
      }
      @keyframes dsh-exp-toast-in {
        from { opacity:0; transform:translateY(-10px) scale(.97); }
        to { opacity:1; transform:none; }
      }
      @keyframes dsh-exp-progress { from { transform:scaleX(1); } to { transform:scaleX(0); } }
      @container dsh-exp (max-width:560px) {
        .dsh-exp-hero { align-items:flex-start; flex-direction:column; gap:14px; }
        .dsh-exp-hero-actions { padding-bottom:0; }
        .dsh-exp-toolbar { gap:8px; }
        .dsh-exp-form-row { grid-template-columns:1fr; }
        .dsh-exp-dialog { padding:18px; border-radius:18px; }
        .dsh-exp-foot { align-items:flex-start; flex-direction:column; }
      }
      @media (prefers-reduced-motion:reduce) {
        .dsh-exp-card, .dsh-exp-layer, .dsh-exp-dialog, .dsh-exp-toast, .dsh-exp-notice {
          animation:none !important;
        }
        .dsh-exp-toast-progress { animation:none !important; }
        .dsh-exp-card, .dsh-exp-primary, .dsh-exp-apply svg { transition:none !important; }
      }
    `

    return {
      inject: ['slots', 'layout', 'sessions', 'uiSession', 'uiWorkspace', 'workspaces'],
      apply(ctx) {
        const store = createExpertStore()

        function readMainSessionId() {
          try {
            const current = ctx.uiSession?.current?.getSnapshot?.()?.key
            if (current !== undefined) return current
          } catch {
            /* fall through to the retention projection */
          }
          try {
            const rows = ctx.sessions?.list?.getSnapshot?.()?.byId
            if (rows !== undefined && rows !== null) {
              const retained = Object.values(rows).find(row => (row?.retainedBy?.mainView ?? 0) > 0)
              if (typeof retained?.id === 'string') return retained.id
            }
          } catch {
            /* no projection available */
          }
          return undefined
        }

        function focusComposerSoon() {
          let attempts = 0
          const tick = () => {
            attempts += 1
            const editors = Array.from(document.querySelectorAll('[contenteditable="true"]'))
            const editor = editors.find(element => element.getClientRects().length > 0)
            if (editor !== undefined) {
              try {
                editor.focus()
              } catch {
                /* focus is a progressive enhancement */
              }
              return
            }
            if (attempts < 24) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }

        function applyPreset(preset) {
          const prompt = preset.prompt.trim()
          if (prompt === '') {
            publishToast({ tone: 'error', text: '这条专家没有提示词。' })
            return { ok: false }
          }
          const mainSessionId = readMainSessionId()
          const bridge = inputBridge
          const bridgeMatches = bridge.actions !== undefined
            && bridge.sessionId !== undefined
            && mainSessionId === bridge.sessionId

          if (bridgeMatches) {
            const actions = bridge.actions
            if (bridge.phase !== 'plain') {
              publishToast({
                tone: 'warn',
                text: '输入框正在提交，请稍后再应用。',
                detail: '等待当前消息发送完成后重试。',
              })
              return { ok: false }
            }
            const before = bridge.draft
            const empty = before.trim() === ''
            const appendAtEnd = bridge.occurrences === 0
            try {
              if (empty) {
                actions.setDraft(prompt)
              } else {
                const capture = actions.captureInsertion()
                const span = appendAtEnd
                  ? { start: before.length, end: before.length, draftRev: capture.draftRev }
                  : capture
                const separator = before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
                const inserted = actions.insertText(`${separator}${prompt}`, span)
                if (!inserted) {
                  actions.setDraft(`${before.replace(/\s+$/u, '')}\n\n${prompt}`)
                }
              }
            } catch (failure) {
              publishToast({
                tone: 'error',
                text: '载入输入框失败。',
                detail: failure?.message ?? String(failure),
              })
              return { ok: false }
            }
            ctx.layout.selectPanel(null)
            focusComposerSoon()
            publishToast({
              tone: 'success',
              text: `已载入「${preset.name}」`,
              detail: empty
                ? '可以直接编辑或发送'
                : appendAtEnd ? '已追加到现有草稿末尾' : '已插入到当前光标位置',
              action: {
                label: '撤销',
                run() {
                  try {
                    actions.setDraft(before)
                  } catch {
                    /* the session may have closed */
                  }
                },
              },
            })
            return { ok: true }
          }

          if (mainSessionId !== undefined) {
            publishToast({
              tone: 'warn',
              text: '会话输入框正在同步。',
              detail: '请回到对话页确认后再应用。',
            })
            return { ok: false }
          }

          const workspaceSnapshot = ctx.workspaces.list.getSnapshot()
          if (Array.isArray(workspaceSnapshot?.items) && workspaceSnapshot.items.length === 0) {
            publishToast({
              tone: 'error',
              text: '还没有可用的工作区。',
              detail: '请先在侧栏打开一个工作区，再应用专家。',
            })
            return { ok: false }
          }
          try {
            ctx.uiWorkspace.startSession(undefined, {
              prompt,
              whenDraftExists: 'append',
            })
            ctx.layout.selectPanel(null)
            publishToast({
              tone: 'success',
              text: `已新建会话并载入「${preset.name}」`,
              detail: '会话打开后可直接编辑或发送',
            })
            return { ok: true }
          } catch (failure) {
            publishToast({
              tone: 'error',
              text: '新建会话失败。',
              detail: failure?.message ?? String(failure),
            })
            return { ok: false }
          }
        }

        const face = { store, applyPreset }

        ctx.effect(() => () => {
          inputBridge.actions = undefined
          inputBridge.sessionId = undefined
          inputBridge.draft = ''
          inputBridge.phase = 'plain'
          toastStore.dispose()
        })

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: panelId,
          inject: () => face,
        }, ExpertsPage))

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: panelId,
          order: 5,
          label: '专家',
        }, ExpertsIcon))

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: `${panelId}-toast`,
          order: 40,
          label: '专家通知',
        }, ToastHost))

        ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left',
          id: `${panelId}-bridge`,
          order: 8,
          label: '专家输入桥接',
        }, ComposerBridge))
      },
    }
  },
})
