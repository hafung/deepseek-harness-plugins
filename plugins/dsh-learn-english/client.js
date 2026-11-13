window.__ModuleLoader__.load({
  id: '@local/dsh-learn-english',
  factory(require) {
    const {
      createElement: h,
      Fragment,
      useCallback,
      useEffect,
      useMemo,
      useRef,
      useState,
      useSyncExternalStore,
    } = require('react')

    const PANEL_ID = 'local-learn-english'
    const API = '/api/plugins/learn-english'
    const NS = 'learnEnglish'
    const STORE_KEY = '@local/dsh-learn-english:store:v1'
    const MAX_MESSAGES = 60
    const MAX_INPUT = 6000
    const ARCHIVE_LIMIT = 20
    const ARCHIVE_MESSAGES = 40
    const ARCHIVE_CHAR_BUDGET = 900_000

    const MODE_ORDER = ['free', 'polish']
    const MODE_STYLE = {
      free: { icon: 'chat', accent: 'brand' },
      polish: { icon: 'pen', accent: 'polish' },
    }

    const FALLBACK_EDGE_VOICES = [
      { id: 'en-US-AvaNeural', label: 'Ava', tone: 'Warm, clear' },
      { id: 'en-US-EmmaNeural', label: 'Emma', tone: 'Bright, friendly' },
      { id: 'en-US-AndrewNeural', label: 'Andrew', tone: 'Calm, natural' },
      { id: 'en-US-BrianNeural', label: 'Brian', tone: 'Casual, easygoing' },
    ]
    const FALLBACK_QWEN_VOICES = [
      { id: 'ryan', label: 'Ryan', tone: 'Warm, natural' },
      { id: 'serena', label: 'Serena', tone: 'Clear, gentle' },
      { id: 'aiden', label: 'Aiden', tone: 'Bright, friendly' },
    ]

    const DICT = {
      en: {
        'nav.label': 'Learn English',
        kicker: 'LEARN ENGLISH · STUDIO',
        title: 'Speak like a local.',
        subtitle: 'A quiet room to practice the English you actually want to speak.',
        'status.loading': 'Connecting',
        'status.ready': 'Ready',
        'status.offline': 'Host offline',
        'status.model': 'Choose a model',
        'controls.autoRead': 'Auto-read',
        'controls.settings': 'Voice & playback',
        'controls.newChat': 'New chat',
        'controls.newChatHint': 'Files the current chat into history, then starts a blank one.',
        'controls.history': 'Chat history',
        'controls.export': 'Export',
        'controls.exportPdf': 'Export PDF',
        'controls.exportZip': 'Export ZIP',
        'controls.exporting': 'Exporting',
        'controls.exportPdfStage': 'Generating PDF',
        'controls.exportPreparing': 'Preparing…',
        'controls.exportAudio': 'Fetching audio',
        'controls.exportZipping': 'Packaging ZIP',
        'controls.exportPdfHint': 'Download this conversation as a print-ready A4 PDF.',
        'controls.exportPdfDesc': 'A4 layout, downloaded directly',
        'controls.exportZipDesc': 'HTML + Edge / Qwen audio, playable offline',
        'history.title': 'Chat history',
        'history.close': 'Close history',
        'history.empty': 'No saved chats yet. Starting a new chat files the current one here automatically.',
        'history.note': 'Choose a conversation to continue.',
        'history.turnUnit': 'turns',
        'history.messageUnit': 'messages',
        'history.open': 'Open conversation',
        'pdf.kicker': 'LEARN ENGLISH · PRACTICE NOTES',
        'pdf.title': 'English practice notes',
        'pdf.lede': 'A private conversation record from your English studio.',
        'pdf.footer': 'Learn English · DeepSeek Harness',
        'zip.audioMissing': 'No audio available for this reply.',
        'zip.note': 'Open index.html in a browser to read and listen offline. Keep the audio folder beside it.',
        'errors.pdf': 'The PDF could not be generated. Please try again.',
        'errors.zip': 'The ZIP could not be generated. Please try again.',
        'mode.free.name': 'Free talk',
        'mode.free.tag': 'Conversation',
        'mode.free.desc': 'Chat with Alex like a friend. He always replies in English.',
        'mode.free.hint': 'Alex replies in English only',
        'mode.polish.name': 'Polish',
        'mode.polish.tag': 'Rewrite',
        'mode.polish.desc': 'Chinese or rough English in. Natural American English out.',
        'mode.polish.hint': 'Only the final English comes back',
        'empty.free.title': 'Hi, I’m Alex.',
        'empty.free.body':
          'Your American English conversation partner. Tell me about your day, ask about a phrase, or start with one of these.',
        'empty.polish.title': 'Make it sound native.',
        'empty.polish.body':
          'Send a thought, a rough sentence, or a whole message. You’ll get only the natural American English version — never an answer, never a word-for-word translation.',
        'empty.polish.sample': 'Before / After',
        'empty.polish.before': 'I very like this city, but I want to know more people.',
        'empty.polish.after': 'I really like this city, but I’d like to meet more people.',
        'suggest.free.1': 'Tell me about your day.',
        'suggest.free.2': 'What’s the difference between “make” and “do”?',
        'suggest.free.3': 'Let’s role-play ordering coffee.',
        'suggest.free.4': 'How do I sound more natural at work?',
        'suggest.polish.1': 'I very like this city, but I want to know more people.',
        'suggest.polish.2': 'Could you please send me the report when you have time.',
        'suggest.polish.3': '这个方案我觉得还行，但预算有点高。',
        'suggest.polish.4': 'Sorry I didn’t reply earlier — I was swamped.',
        'message.you': 'You',
        'message.alex': 'Alex',
        'message.teacher': 'American English teacher',
        'message.editor': 'American English editor',
        'message.editorRole': 'Only the final English',
        'message.polished': 'Natural American English',
        'message.thinkingFree': 'Alex is thinking',
        'message.thinkingPolish': 'Finding the most natural phrasing',
        'message.refining': 'Tightening the English',
        'message.stopped': 'Stopped',
        'message.failed': 'Something interrupted the reply.',
        'message.retry': 'Retry',
        'message.regenerate': 'Regenerate',
        'message.copy': 'Copy',
        'message.copied': 'Copied',
        'message.download': 'Download audio',
        'composer.free.placeholder': 'Say anything. Alex will keep the conversation going in English.',
        'composer.polish.placeholder': 'Write what you want to say — Chinese, rough English, or both.',
        'composer.hint': 'Enter to send · Shift + Enter for a new line',
        'composer.englishOnly': 'English only',
        'composer.send': 'Send',
        'composer.stop': 'Stop',
        'tts.edge': 'Edge',
        'tts.qwen': 'Qwen',
        'tts.generating': 'Generating',
        'tts.play': 'Play',
        'tts.pause': 'Pause',
        'tts.retry': 'Retry voice',
        'tts.unavailable': 'Unavailable',
        'tts.failed': 'Voice failed',
        'tts.auto': 'Auto',
        'settings.title': 'Voice & playback',
        'settings.autoRead': 'Read new replies aloud',
        'settings.autoReadHint': 'Edge speaks automatically. Qwen appears quietly when ready.',
        'settings.edgeVoice': 'Edge voice',
        'settings.qwenVoice': 'Qwen voice',
        'settings.speed': 'Speed',
        'settings.engines': 'Engines',
        'settings.online': 'Online',
        'settings.local': 'Local',
        'settings.qwenHint':
          'Qwen loads the 1.7B model on this machine, so the first clip can take about a minute. Later clips are faster.',
        'settings.close': 'Close settings',
        'settings.model': 'Model',
        'settings.modelMissing': 'No default model selected in Harness.',
        'speed.085': '0.85×',
        'speed.1': '1×',
        'speed.115': '1.15×',
        'errors.requestFailed': 'The reply could not be completed.',
        'errors.emptyReply': 'The model returned an empty reply.',
        'errors.copyFailed': 'Could not copy.',
        'errors.offline': 'Could not reach the plugin host.',
        'errors.tts': 'Audio could not be generated.',
        'errors.englishFallback': 'Only English is allowed here, so the reply was reset. Please try again.',
      },
      zh: {
        'nav.label': 'Learn English',
        kicker: 'LEARN ENGLISH · 英语练习室',
        title: 'Speak like a local.',
        subtitle: '把想说的话，变成美国人日常会说的英语。',
        'status.loading': '连接中',
        'status.ready': '就绪',
        'status.offline': '服务未连接',
        'status.model': '需要选择模型',
        'controls.autoRead': '自动朗读',
        'controls.settings': '语音与播放',
        'controls.newChat': '新对话',
        'controls.newChatHint': '当前对话会先存入历史，再从空白页开始。',
        'controls.history': '历史对话',
        'controls.export': '导出',
        'controls.exportPdf': '导出 PDF',
        'controls.exportZip': '导出 ZIP',
        'controls.exporting': '正在导出',
        'controls.exportPdfStage': '正在生成 PDF',
        'controls.exportPreparing': '正在准备…',
        'controls.exportAudio': '正在获取音频',
        'controls.exportZipping': '正在打包 ZIP',
        'controls.exportPdfHint': '直接下载当前对话的 A4 打印排版 PDF。',
        'controls.exportPdfDesc': 'A4 排版，直接下载 PDF',
        'controls.exportZipDesc': 'HTML + Edge / Qwen 音频，离线可播放',
        'history.title': '历史对话',
        'history.close': '关闭历史',
        'history.empty': '还没有历史对话。点「新对话」后，当前聊天会自动保存在这里。',
        'history.note': '选择一条记录继续练习。',
        'history.turnUnit': '轮',
        'history.messageUnit': '条',
        'history.open': '打开对话',
        'pdf.kicker': 'LEARN ENGLISH · 练习记录',
        'pdf.title': '英语练习记录',
        'pdf.lede': '来自你的英语练习室的一段私人对话记录。',
        'pdf.footer': 'Learn English · DeepSeek Harness',
        'zip.audioMissing': '本段没有可用音频。',
        'zip.note': '打开 index.html 即可离线阅读并播放音频；请保持 audio 文件夹与 index.html 位于同一目录。',
        'errors.pdf': 'PDF 生成失败，请重试。',
        'errors.zip': 'ZIP 生成失败，请重试。',
        'mode.free.name': '自由对话',
        'mode.free.tag': 'Free talk',
        'mode.free.desc': '和 Alex 像朋友一样聊天，他只用英文回复。',
        'mode.free.hint': 'Alex 只用英文回复',
        'mode.polish.name': '地道润色',
        'mode.polish.tag': 'Polish',
        'mode.polish.desc': '中文、散装英语都可以，只返回自然的美式表达。',
        'mode.polish.hint': '只返回最终英文',
        'empty.free.title': '嗨，我是 Alex。',
        'empty.free.body':
          '你的美式英语对话伙伴。聊聊今天发生了什么，问问某个表达，或者从下面选一句开始。',
        'empty.polish.title': '让这句话听起来像母语者。',
        'empty.polish.body':
          '发来一个想法、一句不完整的英文，或一整段中文。你只会收到自然的美式英语版本——不是回答问题，也不是逐字翻译。',
        'empty.polish.sample': 'Before / After',
        'empty.polish.before': 'I very like this city, but I want to know more people.',
        'empty.polish.after': 'I really like this city, but I’d like to meet more people.',
        'suggest.free.1': '跟我聊聊你今天过得怎么样。',
        'suggest.free.2': '“make” 和 “do” 到底有什么区别？',
        'suggest.free.3': '我们角色扮演一下点咖啡吧。',
        'suggest.free.4': '怎么在工作场合说得更自然？',
        'suggest.polish.1': '我明天可能会晚到一点，能帮我跟同事说一下吗？',
        'suggest.polish.2': 'Could you please send me the report when you have time.',
        'suggest.polish.3': '这个方案我觉得还行，但预算有点高。',
        'suggest.polish.4': 'Sorry I didn’t reply earlier — I was swamped.',
        'message.you': '你',
        'message.alex': 'Alex',
        'message.teacher': '美式英语老师',
        'message.editor': '美式英语编辑',
        'message.editorRole': '只返回最终英文',
        'message.polished': '自然美式表达',
        'message.thinkingFree': 'Alex 正在思考',
        'message.thinkingPolish': '正在寻找最自然的说法',
        'message.refining': '正在把回复收紧为英文',
        'message.stopped': '已停止',
        'message.failed': '回复被中断了。',
        'message.retry': '重试',
        'message.regenerate': '重新生成',
        'message.copy': '复制',
        'message.copied': '已复制',
        'message.download': '下载音频',
        'composer.free.placeholder': '想说什么都可以。Alex 会继续用英文和你聊。',
        'composer.polish.placeholder': '写下你想说的话——中文、散装英语，或者中英混着来。',
        'composer.hint': 'Enter 发送 · Shift + Enter 换行',
        'composer.englishOnly': '仅英文',
        'composer.send': '发送',
        'composer.stop': '停止',
        'tts.edge': 'Edge',
        'tts.qwen': 'Qwen',
        'tts.generating': '生成中',
        'tts.play': '播放',
        'tts.pause': '暂停',
        'tts.retry': '重试语音',
        'tts.unavailable': '不可用',
        'tts.failed': '语音失败',
        'tts.auto': '自动',
        'settings.title': '语音与播放',
        'settings.autoRead': '自动朗读新回复',
        'settings.autoReadHint': 'Edge 会自动开口；Qwen 在后台准备好后出现。',
        'settings.edgeVoice': 'Edge 音色',
        'settings.qwenVoice': 'Qwen 音色',
        'settings.speed': '语速',
        'settings.engines': '语音引擎',
        'settings.online': '在线',
        'settings.local': '本地',
        'settings.qwenHint':
          'Qwen 会在本机加载 1.7B 模型，第一段语音可能要等一分钟左右，之后会快很多。',
        'settings.close': '关闭设置',
        'settings.model': '当前模型',
        'settings.modelMissing': 'Harness 里还没有选择默认模型。',
        'speed.085': '0.85×',
        'speed.1': '1×',
        'speed.115': '1.15×',
        'errors.requestFailed': '回复没能完成。',
        'errors.emptyReply': '模型返回了空回复。',
        'errors.copyFailed': '复制失败。',
        'errors.offline': '无法连接插件服务。',
        'errors.tts': '无法生成音频。',
        'errors.englishFallback': '这里只允许英文，回复已被重置。请再试一次。',
      },
    }
    const iconPaths = {
      chat: [
        'M4.4 5.2h12.1a2.2 2.2 0 0 1 2.2 2.2v7.1a2.2 2.2 0 0 1-2.2 2.2H9.2L4.8 20v-3.3H4.4a2.2 2.2 0 0 1-2.2-2.2V7.4a2.2 2.2 0 0 1 2.2-2.2Z',
        'M7.1 8.9h7.5M7.1 12.1h4.8',
      ],
      pen: [
        'M4 20h4.1L18.5 9.6a2.85 2.85 0 0 0-4-4L4 16v4Z',
        'm13.4 6.4 4 4',
        'M12.1 20H21',
      ],
      send: ['M4.2 11.5 20 4.2l-7.3 15.8-2.1-6.4-6.4-2.1Z', 'm10.6 13.6 4.2-4.2'],
      stop: ['M7.2 7.2h9.6v9.6H7.2z'],
      plus: ['M12 5v14M5 12h14'],
      copy: ['M9 8.2h9.3v11H9z', 'M5.7 15.8H4.4V4.8h9.3v1.3'],
      check: ['m5 12.5 4.4 4.4L19 7'],
      play: ['M8.5 5.3 18.7 12 8.5 18.7V5.3Z'],
      pause: ['M8.5 6.2v11.6M15.5 6.2v11.6'],
      download: ['M12 4.5v10.8', 'm7.8 11 4.2 4.2 4.2-4.2', 'M5 19.5h14'],
      settings: [
        'M4 6.5h8M16 6.5h4M4 12h3M11 12h9M4 17.5h10M18 17.5h2',
        'M14 4.5v4M9 10v4M16 15.5v4',
      ],
      close: ['M6 6l12 12M18 6 6 18'],
      alert: ['M12 4 2.9 20h18.2L12 4Z', 'M12 9.4v4.4', 'M12 17.1v.3'],
      refresh: ['M20 11a8 8 0 1 0-2.3 6.7', 'M20 4.5V11h-6.4'],
      clock: ['M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z', 'M12 7.7V12l3.1 1.9'],
      archive: ['M4 8.2h16v11.3H4z', 'M3 4.5h18v3.7H3z', 'M9.2 12.2h5.6'],
      sparkles: [
        'M12 3.4l1.8 4.9 4.9 1.8-4.9 1.8L12 16.8l-1.8-4.9-4.9-1.8 4.9-1.8L12 3.4Z',
        'M18.6 15.3l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z',
      ],
      volume: ['M4.2 9.6h3.5L12.4 5.9v12.2l-4.7-3.7H4.2V9.6Z', 'M15.8 9.2a4 4 0 0 1 0 5.6', 'M18.2 6.8a7.4 7.4 0 0 1 0 10.4'],
      arrow: ['M5 12h13M13 6l6 6-6 6'],
      globe: ['M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2Z', 'M3.7 12h16.6', 'M12 3.5c2.2 2.3 3.4 5.2 3.4 8.5S14.2 18.2 12 20.5c-2.2-2.3-3.4-5.2-3.4-8.5S9.8 5.8 12 3.5Z'],
      chevron: ['m8 10 4 4 4-4'],
    }

    function Glyph({ name = 'sparkles', size = 16, strokeWidth = 1.7 }) {
      const paths = iconPaths[name] ?? iconPaths.sparkles
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: 'false',
        },
        paths.map((d, index) => h('path', { key: index, d })),
      )
    }

    function SendArrowIcon({ size = 16 }) {
      return h(
        'svg',
        { viewBox: '0 0 16 16', width: size, height: size, 'aria-hidden': true, focusable: 'false' },
        h('path', {
          d: 'M8.3125 0.980183C8.66767 1.0531 8.97902 1.20418 9.2627 1.43233C9.48724 1.61297 9.73029 1.85793 9.97949 2.10714L14.707 6.83468L13.293 8.24874L9 3.95577V15.0417H7V3.95577L2.70703 8.24874L1.29297 6.83468L6.02051 2.10714C6.26971 1.85793 6.51277 1.61297 6.7373 1.43233C6.97662 1.23986 7.28445 1.04402 7.6875 0.980183C7.8973 0.947006 8.1031 0.95516 8.3125 0.980183Z',
          fill: 'currentColor',
        }),
      )
    }

    function StopSquareIcon({ size = 16 }) {
      return h(
        'svg',
        { viewBox: '0 0 16 16', width: size, height: size, 'aria-hidden': true, focusable: 'false' },
        h('rect', { x: 3, y: 3, width: 10, height: 10, rx: 3, fill: 'currentColor' }),
      )
    }

    function LearnEnglishIcon({ size = 20 }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.65,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: 'false',
        },
        h('path', {
          d: 'M4 5.4h11.1a2 2 0 0 1 2 2v6.2a2 2 0 0 1-2 2H9.4L5.3 18.8v-3.2H4a2 2 0 0 1-2-2V7.4a2 2 0 0 1 2-2Z',
        }),
        h('path', { d: 'M5.8 8.9h6.6M5.8 11.7h3.9' }),
        h('path', { d: 'M18.6 3.6v4M16.6 5.6h4' }),
      )
    }

    function useLocale(localeService) {
      const snapshot = useSyncExternalStore(
        listener => localeService.subscribe(listener),
        () => localeService.getSnapshot(),
        () => localeService.getSnapshot(),
      )
      const bound = useMemo(() => localeService.bind(NS), [localeService])
      const fallback = String(snapshot.active).toLowerCase().startsWith('zh') ? DICT.zh : DICT.en
      const t = useMemo(
        () => key => {
          const value = bound(key)
          return value === key ? fallback[key] ?? key : value
        },
        [bound, fallback],
      )
      return { t, locale: snapshot.active }
    }

    function formatDuration(seconds) {
      const value = Number(seconds)
      if (!Number.isFinite(value) || value <= 0) return '0:00'
      const minutes = Math.floor(value / 60)
      const rest = Math.floor(value % 60)
      return `${minutes}:${String(rest).padStart(2, '0')}`
    }

    function makeId() {
      try {
        return globalThis.crypto?.randomUUID?.() ?? `le-${Date.now()}-${Math.random().toString(16).slice(2)}`
      } catch {
        return `le-${Date.now()}-${Math.random().toString(16).slice(2)}`
      }
    }

    function safeText(value) {
      return typeof value === 'string' ? value : ''
    }

    function defaultStore() {
      return {
        version: 1,
        mode: 'free',
        threads: { free: [], polish: [] },
        archived: [],
        prefs: {
          autoRead: true,
          edgeVoice: 'en-US-AvaNeural',
          qwenSpeaker: 'ryan',
          speed: 1,
          edgeVoiceCustom: false,
          qwenVoiceCustom: false,
        },
      }
    }

    function sanitizeMessage(message, mode) {
      if (!message || (message.role !== 'user' && message.role !== 'assistant')) return null
      const content = safeText(message.content).slice(0, 12000)
      if (!content && message.role === 'user') return null
      const status = ['done', 'error', 'stopped'].includes(message.status) ? message.status : 'done'
      return {
        id: typeof message.id === 'string' && message.id ? message.id : makeId(),
        role: message.role,
        content,
        at: Number(message.at) || Date.now(),
        mode,
        status,
        error: safeText(message.error).slice(0, 1000),
        refining: false,
      }
    }

    function readStore() {
      const fallback = defaultStore()
      try {
        const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null')
        if (!raw || typeof raw !== 'object') return fallback
        const mode = raw.mode === 'polish' ? 'polish' : 'free'
        const threads = { free: [], polish: [] }
        for (const key of MODE_ORDER) {
          const list = Array.isArray(raw.threads?.[key]) ? raw.threads[key] : []
          threads[key] = list
            .map(message => sanitizeMessage(message, key))
            .filter(Boolean)
            .slice(-MAX_MESSAGES)
        }
        const edgeVoice =
          typeof raw.prefs?.edgeVoice === 'string' ? raw.prefs.edgeVoice : fallback.prefs.edgeVoice
        const qwenSpeaker =
          typeof raw.prefs?.qwenSpeaker === 'string' ? raw.prefs.qwenSpeaker : fallback.prefs.qwenSpeaker
        const prefs = {
          autoRead: raw.prefs?.autoRead !== false,
          edgeVoice,
          qwenSpeaker,
          speed: [0.85, 1, 1.15].includes(Number(raw.prefs?.speed)) ? Number(raw.prefs.speed) : 1,
          edgeVoiceCustom:
            raw.prefs?.edgeVoiceCustom === true || edgeVoice !== fallback.prefs.edgeVoice,
          qwenVoiceCustom:
            raw.prefs?.qwenVoiceCustom === true || qwenSpeaker !== fallback.prefs.qwenSpeaker,
        }
        const archived = (Array.isArray(raw.archived) ? raw.archived : [])
          .map(entry => {
            if (!entry || !MODE_ORDER.includes(entry.mode)) return null
            const archivedMessages = (Array.isArray(entry.messages) ? entry.messages : [])
              .map(message => sanitizeMessage(message, entry.mode))
              .filter(Boolean)
              .slice(-MAX_MESSAGES)
            if (!archivedMessages.length) return null
            return {
              id: typeof entry.id === 'string' && entry.id ? entry.id : makeId(),
              mode: entry.mode,
              archivedAt: Number(entry.archivedAt) || Date.now(),
              messages: archivedMessages,
            }
          })
          .filter(Boolean)
          .slice(0, ARCHIVE_LIMIT)
        return { version: 1, mode, threads, archived, prefs }
      } catch {
        return fallback
      }
    }

    function messageForDisk(message) {
      return {
        id: message.id,
        role: message.role,
        content: message.content,
        at: message.at,
        status: message.status === 'error' || message.status === 'stopped' ? message.status : 'done',
        error: message.error ?? '',
      }
    }

    function storeForDisk(store) {
      const threads = {}
      for (const key of MODE_ORDER) {
        threads[key] = (store.threads[key] ?? [])
          .filter(message => message.status !== 'streaming')
          .map(messageForDisk)
          .slice(-MAX_MESSAGES)
      }
      const archived = []
      let archiveChars = 0
      for (const entry of store.archived ?? []) {
        if (archived.length >= ARCHIVE_LIMIT) break
        const messages = (entry.messages ?? [])
          .filter(message => message.status !== 'streaming')
          .map(messageForDisk)
          .slice(-ARCHIVE_MESSAGES)
        if (!messages.length) continue
        const chars = messages.reduce((total, message) => total + message.content.length, 0)
        if (archived.length && archiveChars + chars > ARCHIVE_CHAR_BUDGET) break
        archived.push({ id: entry.id, mode: entry.mode, archivedAt: entry.archivedAt, messages })
        archiveChars += chars
      }
      return { version: 1, mode: store.mode, threads, archived, prefs: store.prefs }
    }

    function friendlyClientError(error, t) {
      const raw = String(error?.message ?? error ?? '').replace(/\s+/g, ' ').trim()
      if (!raw || /failed to fetch|networkerror|load failed/i.test(raw)) return t('errors.offline')
      return raw
    }

    function formatArchiveTime(at, locale) {
      const date = new Date(Number(at) || Date.now())
      try {
        return new Intl.DateTimeFormat(locale || 'en', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(date)
      } catch {
        return date.toLocaleString()
      }
    }

    function archivePreview(entry) {
      const messages = entry?.messages ?? []
      const source =
        [...messages].reverse().find(message => message.role === 'user' && message.content.trim()) ??
        [...messages].reverse().find(message => message.content.trim())
      const text = String(source?.content ?? '').replace(/\s+/g, ' ').trim()
      return text.length > 62 ? `${Array.from(text).slice(0, 62).join('')}…` : text
    }

    const PDF_PAGE_WIDTH = 595.28
    const PDF_PAGE_HEIGHT = 841.89
    const PDF_CANVAS_SCALE = 2.5
    const PDF_CANVAS_WIDTH = Math.round(PDF_PAGE_WIDTH * PDF_CANVAS_SCALE)
    const PDF_CANVAS_HEIGHT = Math.round(PDF_PAGE_HEIGHT * PDF_CANVAS_SCALE)
    const PDF_MARGIN = 120
    const PDF_CONTENT_WIDTH = PDF_CANVAS_WIDTH - PDF_MARGIN * 2
    const PDF_PAGE_BOTTOM = 1972
    const PDF_FIRST_TOP = 380
    const PDF_RUNNING_TOP = 150
    const PDF_SERIF =
      'Georgia, "Iowan Old Style", "Palatino Linotype", "Songti SC", "Noto Serif SC", serif'
    const PDF_SANS = '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    const PDF_INK = '#211f1b'
    const PDF_MUTED = '#7b7468'
    const PDF_LINE = '#e5dccd'
    const PDF_SOFT = '#f7f3eb'
    const PDF_SOFT_LINE = '#e7dfd2'
    const PDF_ACCENT = '#b08a3e'
    const PDF_MARK_TEXT = '#fffdf8'

    function pdfDate(locale, timestamp = Date.now()) {
      const at = Number(timestamp) || Date.now()
      try {
        return new Intl.DateTimeFormat(locale || 'en', {
          dateStyle: 'long',
          timeStyle: 'short',
        }).format(new Date(at))
      } catch {
        return new Date(at).toLocaleString()
      }
    }

    function exportStamp() {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate(),
      ).padStart(2, '0')}`
    }

    function exportBaseName(mode) {
      return `learn-english-${mode}-${exportStamp()}`
    }

    function pdfFilename(mode) {
      return `${exportBaseName(mode)}.pdf`
    }

    function zipFilename(mode) {
      return `${exportBaseName(mode)}.zip`
    }

    function fillPdfRoundRect(ctx, x, y, width, height, radius, fill, stroke) {
      const r = Math.min(radius, width / 2, height / 2)
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + width - r, y)
      ctx.quadraticCurveTo(x + width, y, x + width, y + r)
      ctx.lineTo(x + width, y + height - r)
      ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
      ctx.lineTo(x + r, y + height)
      ctx.quadraticCurveTo(x, y + height, x, y + height - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()
      if (fill) {
        ctx.fillStyle = fill
        ctx.fill()
      }
      if (stroke) {
        ctx.strokeStyle = stroke
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
    }

    function wrapPdfText(ctx, value, maxWidth) {
      const lines = []
      const paragraphs = String(value ?? '').replace(/\r\n/g, '\n').split('\n')
      for (const paragraph of paragraphs) {
        if (!paragraph.trim()) {
          lines.push('')
          continue
        }
        const tokens = paragraph.match(/\S+\s*/g) ?? []
        let line = ''
        for (const token of tokens) {
          if (ctx.measureText(line + token).width <= maxWidth) {
            line += token
            continue
          }
          if (line.trim()) {
            lines.push(line.trimEnd())
            line = ''
          }
          const clean = token.trimStart()
          if (ctx.measureText(clean).width <= maxWidth) {
            line = clean
            continue
          }
          for (const character of Array.from(clean)) {
            if (line && ctx.measureText(line + character).width > maxWidth) {
              lines.push(line.trimEnd())
              line = ''
            }
            line += character
          }
        }
        if (line.trim()) lines.push(line.trimEnd())
      }
      return lines.length ? lines : ['']
    }

    function drawPdfHeader(ctx, { modeName, date, countLabel, t }) {
      fillPdfRoundRect(ctx, PDF_MARGIN, 106, 74, 74, 17, PDF_INK)
      ctx.fillStyle = PDF_MARK_TEXT
      ctx.font = `600 35px ${PDF_SERIF}`
      ctx.textAlign = 'center'
      ctx.fillText('Aa', PDF_MARGIN + 37, 156)
      ctx.textAlign = 'left'

      ctx.fillStyle = PDF_MUTED
      ctx.font = `700 16px ${PDF_SANS}`
      ctx.fillText(t('pdf.kicker'), PDF_MARGIN + 92, 132)

      ctx.fillStyle = PDF_INK
      ctx.font = `600 58px ${PDF_SERIF}`
      ctx.fillText(t('pdf.title'), PDF_MARGIN + 90, 199)

      ctx.textAlign = 'right'
      ctx.fillStyle = PDF_INK
      ctx.font = `700 18px ${PDF_SANS}`
      ctx.fillText(modeName, PDF_CANVAS_WIDTH - PDF_MARGIN, 130)
      ctx.fillStyle = PDF_MUTED
      ctx.font = `400 17px ${PDF_SANS}`
      ctx.fillText(date, PDF_CANVAS_WIDTH - PDF_MARGIN, 159)
      ctx.fillText(countLabel, PDF_CANVAS_WIDTH - PDF_MARGIN, 185)
      ctx.textAlign = 'left'

      ctx.strokeStyle = PDF_LINE
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(PDF_MARGIN, 294)
      ctx.lineTo(PDF_CANVAS_WIDTH - PDF_MARGIN, 294)
      ctx.stroke()

      ctx.fillStyle = PDF_MUTED
      ctx.font = `400 20px ${PDF_SANS}`
      ctx.fillText(t('pdf.lede'), PDF_MARGIN, 338)
    }

    function drawPdfRunningHeader(ctx, { modeName, date, t }) {
      ctx.fillStyle = PDF_MUTED
      ctx.font = `700 15px ${PDF_SANS}`
      ctx.fillText(t('pdf.kicker'), PDF_MARGIN, 78)
      ctx.textAlign = 'right'
      ctx.fillStyle = PDF_MUTED
      ctx.font = `400 15px ${PDF_SANS}`
      ctx.fillText(`${modeName} · ${date}`, PDF_CANVAS_WIDTH - PDF_MARGIN, 78)
      ctx.textAlign = 'left'
      ctx.strokeStyle = PDF_LINE
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(PDF_MARGIN, 98)
      ctx.lineTo(PDF_CANVAS_WIDTH - PDF_MARGIN, 98)
      ctx.stroke()
    }

    function drawPdfFooter(ctx, page, total, t) {
      ctx.strokeStyle = PDF_LINE
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(PDF_MARGIN, 2018)
      ctx.lineTo(PDF_CANVAS_WIDTH - PDF_MARGIN, 2018)
      ctx.stroke()
      ctx.fillStyle = PDF_MUTED
      ctx.font = `400 16px ${PDF_SANS}`
      ctx.fillText(t('pdf.footer'), PDF_MARGIN, 2052)
      ctx.textAlign = 'right'
      ctx.fillText(`${page} / ${total}`, PDF_CANVAS_WIDTH - PDF_MARGIN, 2052)
      ctx.textAlign = 'left'
    }

    function pdfPage() {
      const canvas = document.createElement('canvas')
      canvas.width = PDF_CANVAS_WIDTH
      canvas.height = PDF_CANVAS_HEIGHT
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, PDF_CANVAS_WIDTH, PDF_CANVAS_HEIGHT)
      ctx.textBaseline = 'alphabetic'
      ctx.textAlign = 'left'
      return { canvas, ctx, y: PDF_RUNNING_TOP }
    }

    async function buildConversationPdf({ mode, messages, t, locale }) {
      try {
        await document.fonts?.ready
      } catch {
        // System fonts remain usable when the FontFaceSet is unavailable.
      }
      const printable = messages.filter(message => message.content.trim())
      const modeName = t(`mode.${mode}.name`)
      const conversationAt = Number(printable[0]?.at) || Date.now()
      const date = pdfDate(locale, conversationAt)
      const userTurns = printable.filter(message => message.role === 'user').length
      const countLabel = `${userTurns} ${t('history.turnUnit')} · ${printable.length} ${t('history.messageUnit')}`
      const pages = []
      let current = null

      const newPage = first => {
        current = pdfPage()
        pages.push(current)
        if (first) {
          drawPdfHeader(current.ctx, { modeName, date, countLabel, t })
          current.y = PDF_FIRST_TOP
        } else {
          drawPdfRunningHeader(current.ctx, { modeName, date, t })
          current.y = PDF_RUNNING_TOP
        }
      }

      const drawLabel = (label, index) => {
        if (current.y + 34 > PDF_PAGE_BOTTOM) newPage(false)
        const ctx = current.ctx
        ctx.fillStyle = PDF_MUTED
        ctx.font = `700 17px ${PDF_SANS}`
        ctx.fillText(String(label).toUpperCase(), PDF_MARGIN, current.y + 20)
        ctx.textAlign = 'right'
        ctx.fillText(
          String(index + 1).padStart(2, '0'),
          PDF_CANVAS_WIDTH - PDF_MARGIN,
          current.y + 20,
        )
        ctx.textAlign = 'left'
        current.y += 34
      }

      newPage(true)
      printable.forEach((message, index) => {
        const isUser = message.role === 'user'
        const isPolishAssistant = !isUser && mode === 'polish'
        const ctx = current.ctx
        if (isUser) {
          ctx.font = `400 27px ${PDF_SANS}`
          const lines = wrapPdfText(ctx, message.content, PDF_CONTENT_WIDTH - 48)
          const lineHeight = 42
          const padding = 22
          const boxHeight = lines.length * lineHeight + padding * 2
          if (
            current.y + 34 + boxHeight > PDF_PAGE_BOTTOM &&
            34 + boxHeight <= PDF_PAGE_BOTTOM - PDF_RUNNING_TOP
          ) {
            newPage(false)
          }
          drawLabel(t('message.you'), index)
          let remaining = lines.slice()
          while (remaining.length) {
            const available = PDF_PAGE_BOTTOM - current.y
            if (available < padding * 2 + lineHeight) {
              newPage(false)
              continue
            }
            const maxLines = Math.max(1, Math.floor((available - padding * 2) / lineHeight))
            const chunk = remaining.splice(0, maxLines)
            const height = chunk.length * lineHeight + padding * 2
            fillPdfRoundRect(
              current.ctx,
              PDF_MARGIN,
              current.y,
              PDF_CONTENT_WIDTH,
              height,
              10,
              PDF_SOFT,
              PDF_SOFT_LINE,
            )
            current.ctx.fillStyle = PDF_INK
            current.ctx.font = `400 27px ${PDF_SANS}`
            chunk.forEach((line, lineIndex) => {
              current.ctx.fillText(
                line,
                PDF_MARGIN + 24,
                current.y + padding + 22 + lineIndex * lineHeight,
              )
            })
            current.y += height + 24
            if (remaining.length) newPage(false)
          }
          current.y += 12
          return
        }

        ctx.font = `400 30px ${PDF_SERIF}`
        const indent = isPolishAssistant ? 26 : 0
        const lines = wrapPdfText(ctx, message.content, PDF_CONTENT_WIDTH - indent)
        const lineHeight = 48
        if (current.y + 34 + lineHeight * 2 > PDF_PAGE_BOTTOM) newPage(false)
        drawLabel(isPolishAssistant ? t('message.editor') : t('message.alex'), index)
        let remaining = lines.slice()
        while (remaining.length) {
          const available = PDF_PAGE_BOTTOM - current.y
          const maxLines = Math.max(0, Math.floor(available / lineHeight))
          if (maxLines === 0) {
            newPage(false)
            continue
          }
          const chunk = remaining.splice(0, maxLines)
          if (indent) {
            current.ctx.fillStyle = PDF_ACCENT
            current.ctx.fillRect(
              PDF_MARGIN,
              current.y + 4,
              3,
              Math.max(8, chunk.length * lineHeight - 10),
            )
          }
          current.ctx.fillStyle = PDF_INK
          current.ctx.font = `400 30px ${PDF_SERIF}`
          chunk.forEach((line, lineIndex) => {
            current.ctx.fillText(
              line,
              PDF_MARGIN + indent,
              current.y + 31 + lineIndex * lineHeight,
            )
          })
          current.y += chunk.length * lineHeight + 8
          if (remaining.length) newPage(false)
        }
        current.y += 22
      })

      pages.forEach((page, index) => drawPdfFooter(page.ctx, index + 1, pages.length, t))
      const jpegs = pages.map(page => dataUrlBytes(page.canvas.toDataURL('image/jpeg', 0.94)))
      return jpegPdfBlob(jpegs)
    }

    function dataUrlBytes(dataUrl) {
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
      return bytes
    }

    function jpegPdfBlob(jpegs) {
      const encoder = new TextEncoder()
      const chunks = []
      let offset = 0
      const offsets = [0]
      const add = value => {
        const bytes = typeof value === 'string' ? encoder.encode(value) : value
        chunks.push(bytes)
        offset += bytes.length
      }
      const writeObject = (id, body) => {
        offsets[id] = offset
        add(`${id} 0 obj\n`)
        body()
        add('\nendobj\n')
      }

      const pageCount = jpegs.length
      const totalObjects = 2 + pageCount * 3 + 1
      const pageIds = Array.from({ length: pageCount }, (_, index) => 3 + index * 3)
      add('%PDF-1.4\n')
      add(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))

      writeObject(1, () => add('<< /Type /Catalog /Pages 2 0 R >>'))
      writeObject(2, () =>
        add(
          `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`,
        ),
      )

      jpegs.forEach((jpeg, index) => {
        const pageId = 3 + index * 3
        const imageId = pageId + 1
        const contentId = pageId + 2
        writeObject(pageId, () =>
          add(
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
          ),
        )
        writeObject(imageId, () => {
          add(
            `<< /Type /XObject /Subtype /Image /Width ${PDF_CANVAS_WIDTH} /Height ${PDF_CANVAS_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
          )
          add(jpeg)
          add('\nendstream')
        })
        const stream = encoder.encode(
          `q ${PDF_PAGE_WIDTH} 0 0 ${PDF_PAGE_HEIGHT} 0 0 cm /Im0 Do Q\n`,
        )
        writeObject(contentId, () => {
          add(`<< /Length ${stream.length} >>\nstream\n`)
          add(stream)
          add('endstream')
        })
      })

      const infoId = 3 + pageCount * 3
      writeObject(infoId, () =>
        add(
          '<< /Title (Learn English practice notes) /Creator (Learn English) /Producer (Learn English DSH plugin) >>',
        ),
      )

      const xrefOffset = offset
      add(`xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`)
      for (let id = 1; id <= totalObjects; id += 1) {
        add(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`)
      }
      add(
        `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
      )
      return new Blob(chunks, { type: 'application/pdf' })
    }

    function downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.rel = 'noopener'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    }

    async function downloadConversationPdf({ mode, messages, t, locale }) {
      const blob = await buildConversationPdf({ mode, messages, t, locale })
      downloadBlob(blob, pdfFilename(mode))
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, character => {
        if (character === '&') return '&amp;'
        if (character === '<') return '&lt;'
        if (character === '>') return '&gt;'
        if (character === '"') return '&quot;'
        return '&#39;'
      })
    }

    function zipCrc32(bytes) {
      let crc = 0xffffffff
      for (let index = 0; index < bytes.length; index += 1) {
        crc = (crc >>> 8) ^ ZIP_CRC_TABLE[(crc ^ bytes[index]) & 0xff]
      }
      return (crc ^ 0xffffffff) >>> 0
    }

    const ZIP_CRC_TABLE = (() => {
      const table = new Uint32Array(256)
      for (let index = 0; index < 256; index += 1) {
        let value = index
        for (let bit = 0; bit < 8; bit += 1) {
          value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
        }
        table[index] = value >>> 0
      }
      return table
    })()

    function zipDosStamp() {
      const now = new Date()
      const year = Math.max(1980, now.getFullYear())
      return {
        date: ((year - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate(),
        time: (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2),
      }
    }

    function zipBlob(files) {
      const encoder = new TextEncoder()
      const stamp = zipDosStamp()
      const localParts = []
      const centralParts = []
      let offset = 0
      for (const file of files) {
        const name = encoder.encode(file.name)
        const data = file.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(file.bytes)
        const crc = zipCrc32(data)
        const local = new Uint8Array(30 + name.length)
        const lv = new DataView(local.buffer)
        lv.setUint32(0, 0x04034b50, true)
        lv.setUint16(4, 20, true)
        lv.setUint16(6, 0x0800, true)
        lv.setUint16(8, 0, true)
        lv.setUint16(10, stamp.time, true)
        lv.setUint16(12, stamp.date, true)
        lv.setUint32(14, crc, true)
        lv.setUint32(18, data.length, true)
        lv.setUint32(22, data.length, true)
        lv.setUint16(26, name.length, true)
        lv.setUint16(28, 0, true)
        local.set(name, 30)
        localParts.push(local, data)

        const central = new Uint8Array(46 + name.length)
        const cv = new DataView(central.buffer)
        cv.setUint32(0, 0x02014b50, true)
        cv.setUint16(4, 20, true)
        cv.setUint16(6, 20, true)
        cv.setUint16(8, 0x0800, true)
        cv.setUint16(10, 0, true)
        cv.setUint16(12, stamp.time, true)
        cv.setUint16(14, stamp.date, true)
        cv.setUint32(16, crc, true)
        cv.setUint32(20, data.length, true)
        cv.setUint32(24, data.length, true)
        cv.setUint16(28, name.length, true)
        cv.setUint16(30, 0, true)
        cv.setUint16(32, 0, true)
        cv.setUint16(34, 0, true)
        cv.setUint16(36, 0, true)
        cv.setUint32(38, 0, true)
        cv.setUint32(42, offset, true)
        central.set(name, 46)
        centralParts.push(central)
        offset += local.length + data.length
      }

      const centralOffset = offset
      const centralSize = centralParts.reduce((total, part) => total + part.length, 0)
      const end = new Uint8Array(22)
      const ev = new DataView(end.buffer)
      ev.setUint32(0, 0x06054b50, true)
      ev.setUint16(4, 0, true)
      ev.setUint16(6, 0, true)
      ev.setUint16(8, files.length, true)
      ev.setUint16(10, files.length, true)
      ev.setUint32(12, centralSize, true)
      ev.setUint32(16, centralOffset, true)
      ev.setUint16(20, 0, true)
      return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' })
    }

    async function fetchTtsAsset({ engine, text, voice, rate }) {
      const response = await fetch(`${API}/tts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ engine, text, voice, rate }),
      })
      if (!response.ok) throw new Error(`TTS ${engine} failed: ${response.status}`)
      const blob = await response.blob()
      if (!blob.size) throw new Error(`TTS ${engine} returned no audio`)
      const type = response.headers.get('content-type') || ''
      const ext = type.includes('wav') ? 'wav' : type.includes('mpeg') ? 'mp3' : engine === 'edge' ? 'mp3' : 'wav'
      return { bytes: new Uint8Array(await blob.arrayBuffer()), ext }
    }

    function zipPlayerHtml(engine, voiceName, file, t) {
      const label = engine === 'edge' ? t('tts.edge') : t('tts.qwen')
      return `<div class="player" data-src="${escapeHtml(file)}">
        <button class="play" type="button" aria-label="${escapeHtml(label)} · ${escapeHtml(voiceName)}">▶</button>
        <span class="audio-copy"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(voiceName)}</span></span>
        <span class="bar"><i></i></span>
        <span class="time">0:00</span>
      </div>`
    }

    function buildZipHtml({ mode, messages, t, locale, audioByMessage }) {
      const printable = messages.filter(message => message.content.trim())
      const modeName = t(`mode.${mode}.name`)
      const conversationAt = Number(printable[0]?.at) || Date.now()
      const date = pdfDate(locale, conversationAt)
      const userTurns = printable.filter(message => message.role === 'user').length
      const countLabel = `${userTurns} ${t('history.turnUnit')} · ${printable.length} ${t('history.messageUnit')}`
      const rows = printable
        .map((message, index) => {
          const isUser = message.role === 'user'
          const label = isUser
            ? t('message.you')
            : mode === 'polish'
              ? t('message.editor')
              : t('message.alex')
          const number = String(index + 1).padStart(2, '0')
          if (isUser) {
            return `<article class="msg user">
              <div class="msg-label"><span>${escapeHtml(label)}</span><span>${number}</span></div>
              <div class="bubble">${escapeHtml(message.content)}</div>
            </article>`
          }
          const audios = (audioByMessage.get(message.id) ?? [])
            .slice()
            .sort((a, b) => (a.engine === 'edge' ? -1 : 1))
          const audioRow = audios.length
            ? `<div class="audio-row">${audios
                .map(audio => zipPlayerHtml(audio.engine, audio.voiceName, audio.file, t))
                .join('')}</div>`
            : `<p class="audio-missing">${escapeHtml(t('zip.audioMissing'))}</p>`
          return `<article class="msg assistant${mode === 'polish' ? ' polish' : ''}">
            <div class="msg-label"><span>${escapeHtml(label)}</span><span>${number}</span></div>
            <div class="content">${escapeHtml(message.content)}</div>
            ${audioRow}
          </article>`
        })
        .join('')

      return `<!doctype html>
<html lang="${escapeHtml(locale || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(t('pdf.title'))} · ${escapeHtml(modeName)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { background: #f1ede5; color: #211f1b; font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
  .sheet { width: min(840px, calc(100% - 36px)); margin: 32px auto 56px; padding: 46px 52px 36px; border: 1px solid #dfd5c4; border-radius: 4px; background: #fffdf8; box-shadow: 0 24px 70px -38px rgba(33,31,27,.45); }
  .doc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 28px; padding-bottom: 22px; border-bottom: 1px solid #e5dccd; }
  .brand { display: flex; align-items: flex-start; gap: 13px; }
  .mark { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; color: #fffdf8; background: #211f1b; font-family: Georgia, "Songti SC", serif; font-size: 19px; font-weight: 600; letter-spacing: -.06em; }
  .kicker { margin: 1px 0 5px; color: #8b8377; font-size: 9px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; }
  h1 { margin: 0; font-family: Georgia, "Songti SC", "Noto Serif SC", serif; font-size: 32px; line-height: 1.05; font-weight: 600; letter-spacing: -.04em; }
  .doc-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; padding-top: 3px; color: #7b7468; font-size: 10px; line-height: 1.5; white-space: nowrap; }
  .doc-meta strong { color: #211f1b; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .lede { margin: 19px 0 0; color: #756e63; font-size: 12px; line-height: 1.7; }
  .transcript { margin-top: 30px; }
  .msg { margin-top: 24px; break-inside: avoid; page-break-inside: avoid; }
  .msg:first-child { margin-top: 0; }
  .msg-label { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; color: #8b8377; font-size: 8.5px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; }
  .msg-label > span:last-child { color: #b6ad9e; font-variant-numeric: tabular-nums; letter-spacing: .04em; }
  .bubble { padding: 11px 14px; border: 1px solid #e7dfd2; border-radius: 9px; background: #f7f3eb; color: #211f1b; font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 13px; line-height: 1.66; white-space: pre-wrap; overflow-wrap: anywhere; }
  .content { white-space: pre-wrap; overflow-wrap: anywhere; color: #211f1b; font-family: Georgia, "Songti SC", "Noto Serif SC", serif; font-size: 15.5px; line-height: 1.68; }
  .assistant.polish .content { padding-left: 14px; border-left: 2px solid #b08a3e; }
  .audio-row { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 11px; }
  .player { display: flex; align-items: center; gap: 7px; min-width: 144px; padding: 5px 8px 6px 5px; border: 1px solid #e5dccd; border-radius: 9px; background: #fbf8f2; }
  .player.is-playing { border-color: #c4a56b; background: #fffaf0; }
  .player.is-error { opacity: .58; }
  .play { display: grid; place-items: center; flex: none; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 50%; color: #fffdf8; background: #211f1b; font-size: 11px; line-height: 1; cursor: pointer; }
  .play:disabled { cursor: default; }
  .audio-copy { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .audio-copy strong { color: #211f1b; font-size: 9px; line-height: 1.2; letter-spacing: .04em; }
  .audio-copy span { color: #7b7468; font-size: 8px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bar { display: block; width: 54px; height: 3px; overflow: hidden; border-radius: 99px; background: #ebe4d7; }
  .bar i { display: block; width: 0; height: 100%; border-radius: inherit; background: #b08a3e; transition: width .1s linear; }
  .time { min-width: 26px; color: #8b8377; font-size: 8px; font-variant-numeric: tabular-nums; text-align: right; }
  .audio-missing { margin: 9px 0 0; color: #a49b8d; font-size: 9px; }
  .intro-note { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; color: #7b7468; font-size: 9px; }
  .intro-note::before { content: "♪"; color: #b08a3e; font-size: 13px; }
  .doc-foot { margin-top: 36px; padding-top: 12px; border-top: 1px solid #e7dfd2; color: #958d80; font-size: 9px; line-height: 1.6; }
  @media (max-width: 620px) {
    .sheet { width: 100%; margin: 0; padding: 28px 20px 30px; border: 0; border-radius: 0; box-shadow: none; }
    .doc-head { gap: 14px; }
    h1 { font-size: 27px; }
    .doc-meta { font-size: 9px; }
    .player { flex: 1 1 160px; }
  }
  @media print {
    html, body { background: #fff; }
    body { margin: 0; }
    .sheet { width: auto; max-width: none; margin: 0; padding: 0; border: 0; box-shadow: none; background: #fff; }
    .audio-row, .audio-missing, .intro-note { display: none !important; }
    .msg { margin-top: 17px; }
  }
</style>
</head>
<body>
  <main class="sheet">
    <header class="doc-head">
      <div class="brand">
        <div class="mark">Aa</div>
        <div>
          <div class="kicker">${escapeHtml(t('pdf.kicker'))}</div>
          <h1>${escapeHtml(t('pdf.title'))}</h1>
        </div>
      </div>
      <div class="doc-meta">
        <strong>${escapeHtml(modeName)}</strong>
        <span>${escapeHtml(date)}</span>
        <span>${escapeHtml(countLabel)}</span>
      </div>
    </header>
    <p class="lede">${escapeHtml(t('pdf.lede'))}</p>
    <div class="intro-note">${escapeHtml(t('zip.note'))}</div>
    <section class="transcript">
      ${rows}
    </section>
    <footer class="doc-foot">${escapeHtml(t('pdf.footer'))} · ${escapeHtml(modeName)}</footer>
  </main>
  <script>
    (() => {
      const players = Array.from(document.querySelectorAll('.player'));
      let current = null;
      const format = value => {
        if (!Number.isFinite(value) || value <= 0) return '0:00';
        const total = Math.floor(value);
        return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
      };
      for (const player of players) {
        const audio = new Audio(player.dataset.src);
        audio.preload = 'metadata';
        const button = player.querySelector('.play');
        const bar = player.querySelector('.bar > i');
        const time = player.querySelector('.time');
        const update = () => {
          button.textContent = audio.paused ? '▶' : '❚❚';
          player.classList.toggle('is-playing', !audio.paused);
        };
        button.addEventListener('click', async () => {
          if (audio.paused) {
            if (current && current !== audio) current.pause();
            current = audio;
            try {
              await audio.play();
            } catch {
              player.classList.add('is-error');
              button.disabled = true;
              time.textContent = '--:--';
            }
          } else {
            audio.pause();
          }
        });
        audio.addEventListener('loadedmetadata', () => {
          time.textContent = format(audio.duration);
        });
        audio.addEventListener('timeupdate', () => {
          bar.style.width = (audio.duration ? (audio.currentTime / audio.duration) * 100 : 0) + '%';
          time.textContent = format(audio.currentTime);
        });
        audio.addEventListener('play', update);
        audio.addEventListener('pause', update);
        audio.addEventListener('ended', () => {
          update();
          bar.style.width = '0%';
          time.textContent = format(audio.duration);
        });
        audio.addEventListener('error', () => {
          player.classList.add('is-error');
          button.disabled = true;
          time.textContent = '--:--';
        });
      }
    })();
  </script>
</body>
</html>`
    }

    async function downloadConversationZip({ mode, messages, t, locale, prefs, host, onProgress }) {
      const printable = messages.filter(message => message.content.trim())
      const assistants = printable.filter(message => message.role === 'assistant')
      const total = assistants.length * 2
      const audioByMessage = new Map()
      const audioFiles = []
      let completed = 0

      for (let index = 0; index < assistants.length; index += 1) {
        const message = assistants[index]
        const jobs = ['edge', 'qwen'].map(async engine => {
          const voice = engine === 'edge' ? prefs.edgeVoice : prefs.qwenSpeaker
          const voiceName = voiceLabel(host, engine, voice)
          try {
            const asset = await fetchTtsAsset({
              engine,
              text: message.content,
              voice,
              rate: prefs.speed,
            })
            const file = `audio/${String(index + 1).padStart(3, '0')}-${engine}.${asset.ext}`
            const entry = { engine, voiceName, file }
            const list = audioByMessage.get(message.id) ?? []
            list.push(entry)
            audioByMessage.set(message.id, list)
            audioFiles.push({ name: file, bytes: asset.bytes })
          } catch {
            // A missing engine must not block the rest of the export.
          } finally {
            completed += 1
            onProgress?.({ phase: 'audio', done: completed, total })
          }
        })
        await Promise.all(jobs)
      }

      onProgress?.({ phase: 'zip' })
      const html = buildZipHtml({ mode, messages, t, locale, audioByMessage })
      const modeName = t(`mode.${mode}.name`)
      const readme = [
        'Learn English · conversation export',
        '',
        `Mode: ${modeName}`,
        `Exported: ${pdfDate(locale)}`,
        `Messages: ${printable.length}`,
        '',
        'Open index.html in a browser to read and listen.',
        'Keep the audio folder next to index.html.',
        '',
        t('zip.note'),
      ].join('\n')
      const root = exportBaseName(mode)
      const files = [
        { name: `${root}/index.html`, bytes: new TextEncoder().encode(html) },
        { name: `${root}/README.txt`, bytes: new TextEncoder().encode(readme) },
        ...audioFiles.map(file => ({ name: `${root}/${file.name}`, bytes: file.bytes })),
      ]
      const zip = zipBlob(files)
      downloadBlob(zip, zipFilename(mode))
    }

    function resolveVoices(host, engine) {
      const listed = host?.data?.engines?.[engine]?.voices
      if (Array.isArray(listed) && listed.length) return listed
      return engine === 'edge' ? FALLBACK_EDGE_VOICES : FALLBACK_QWEN_VOICES
    }

    function voiceLabel(host, engine, id) {
      const voices = resolveVoices(host, engine)
      return voices.find(voice => voice.id === id)?.label ?? id
    }

    const speechCache = new Map()
    let activeSpeechAudio = null

    function evictSpeech(key) {
      const entry = speechCache.get(key)
      if (entry?.url) {
        try {
          URL.revokeObjectURL(entry.url)
        } catch {
          // Ignore a URL that was already released.
        }
      }
      speechCache.delete(key)
    }

    function pruneSpeech() {
      const ready = [...speechCache.entries()].filter(([, entry]) => entry.status === 'ready')
      if (ready.length <= 30) return
      ready
        .sort((a, b) => a[1].createdAt - b[1].createdAt)
        .slice(0, ready.length - 30)
        .forEach(([key]) => evictSpeech(key))
    }

    async function loadSpeech(key, payload, t) {
      const existing = speechCache.get(key)
      if (existing?.status === 'ready') return existing
      if (existing?.status === 'loading') return existing.promise
      const entry = { status: 'loading', createdAt: Date.now() }
      entry.promise = (async () => {
        let response
        try {
          response = await fetch(`${API}/tts`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        } catch {
          const error = new Error(t('errors.offline'))
          speechCache.set(key, { status: 'error', error: error.message, createdAt: Date.now() })
          throw error
        }
        if (!response.ok) {
          let message = t('errors.tts')
          try {
            const body = await response.json()
            if (body?.error) message = String(body.error)
          } catch {
            // Keep the localized fallback.
          }
          const error = new Error(message)
          speechCache.set(key, { status: 'error', error: message, createdAt: Date.now() })
          throw error
        }
        const blob = await response.blob()
        if (!blob.size) {
          const error = new Error(t('errors.tts'))
          speechCache.set(key, { status: 'error', error: error.message, createdAt: Date.now() })
          throw error
        }
        const url = URL.createObjectURL(blob)
        const ready = { status: 'ready', url, blob, createdAt: Date.now() }
        speechCache.set(key, ready)
        pruneSpeech()
        return ready
      })()
      speechCache.set(key, entry)
      return entry.promise
    }

    function renderInline(text, prefix) {
      const nodes = []
      const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g
      let last = 0
      let match
      let index = 0
      while ((match = pattern.exec(text)) !== null) {
        if (match.index > last) nodes.push(text.slice(last, match.index))
        const token = match[0]
        const key = `${prefix}-i${index}`
        if (token.startsWith('**')) nodes.push(h('strong', { key }, token.slice(2, -2)))
        else if (token.startsWith('`')) nodes.push(h('code', { key }, token.slice(1, -1)))
        else nodes.push(h('em', { key }, token.slice(1, -1)))
        last = match.index + token.length
        index += 1
      }
      if (last < text.length) nodes.push(text.slice(last))
      return nodes
    }

    function renderMarkdown(text) {
      const source = safeText(text)
      if (!source) return null
      const lines = source.replace(/\r\n/g, '\n').split('\n')
      const blocks = []
      let paragraph = []
      let list = null
      let quote = null
      let key = 0

      const flushParagraph = () => {
        if (!paragraph.length) return
        const joined = paragraph.join(' ')
        blocks.push(h('p', { key: `p-${key++}` }, renderInline(joined, `p-${key}`)))
        paragraph = []
      }
      const flushList = () => {
        if (!list) return
        const type = list.ordered ? 'ol' : 'ul'
        blocks.push(
          h(
            type,
            { key: `list-${key++}` },
            list.items.map((item, index) =>
              h('li', { key: index }, renderInline(item, `li-${key}-${index}`)),
            ),
          ),
        )
        list = null
      }
      const flushQuote = () => {
        if (!quote) return
        blocks.push(
          h(
            'blockquote',
            { key: `quote-${key++}` },
            quote.map((line, index) => h('p', { key: index }, renderInline(line, `q-${key}-${index}`))),
          ),
        )
        quote = null
      }
      const flush = () => {
        flushParagraph()
        flushList()
        flushQuote()
      }

      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index]
        const fence = /^```/.test(line.trim())
        if (fence) {
          flush()
          const code = []
          index += 1
          while (index < lines.length && !/^```/.test(lines[index].trim())) {
            code.push(lines[index])
            index += 1
          }
          blocks.push(h('pre', { key: `pre-${key++}` }, h('code', null, code.join('\n'))))
          continue
        }
        if (!line.trim()) {
          flush()
          continue
        }
        const heading = /^(#{1,4})\s+(.+)$/.exec(line)
        if (heading) {
          flush()
          const size = Math.min(4, heading[1].length + 2)
          blocks.push(
            h(
              `h${size}`,
              { key: `h-${key++}` },
              renderInline(heading[2], `h-${key}`),
            ),
          )
          continue
        }
        const bullet = /^\s*[-*+]\s+(.+)$/.exec(line)
        const numbered = /^\s*\d+[.)]\s+(.+)$/.exec(line)
        if (bullet || numbered) {
          flushParagraph()
          flushQuote()
          const ordered = Boolean(numbered)
          if (!list || list.ordered !== ordered) {
            flushList()
            list = { ordered, items: [] }
          }
          list.items.push((bullet ?? numbered)[1])
          continue
        }
        const quoted = /^\s*>\s?(.*)$/.exec(line)
        if (quoted) {
          flushParagraph()
          flushList()
          if (!quote) quote = []
          quote.push(quoted[1])
          continue
        }
        flushList()
        flushQuote()
        paragraph.push(line.trim())
      }
      flush()
      return blocks
    }

    function RichText({ text, className }) {
      return h('div', { className }, renderMarkdown(text))
    }

    function StatusPill({ host, t, onRefresh }) {
      const modelMissing = Boolean(host.data) && !host.data.model
      const state = host.loading ? 'loading' : host.error ? 'offline' : modelMissing ? 'model' : 'ready'
      const label =
        state === 'loading'
          ? t('status.loading')
          : state === 'offline'
            ? t('status.offline')
            : state === 'model'
              ? t('status.model')
              : t('status.ready')
      const detail =
        state === 'offline'
          ? host.error
          : state === 'model'
            ? t('settings.modelMissing')
            : host.data?.model
              ? `${host.data.model.provider} · ${host.data.model.model}`
              : ''
      return h(
        'button',
        {
          type: 'button',
          className: `le-status is-${state}`,
          onClick: onRefresh,
          title: detail || label,
          'aria-label': `${label}${detail ? ` — ${detail}` : ''}`,
        },
        h('span', { className: 'le-status-dot', 'aria-hidden': true }),
        h('span', { className: 'le-status-text' }, label),
      )
    }

    function ModeCard({ mode, active, disabled, t, onClick }) {
      const style = MODE_STYLE[mode]
      return h(
        'button',
        {
          type: 'button',
          className: `le-mode le-mode--${mode}${active ? ' is-active' : ''}`,
          onClick,
          disabled,
          'aria-pressed': active,
          title: t(`mode.${mode}.desc`),
        },
        h('span', { className: 'le-mode-icon' }, h(Glyph, { name: style.icon, size: 18 })),
        h(
          'span',
          { className: 'le-mode-copy' },
          h(
            'span',
            { className: 'le-mode-title' },
            h('strong', null, t(`mode.${mode}.name`)),
            h('span', { className: 'le-mode-tag' }, t(`mode.${mode}.tag`)),
          ),
          h('span', { className: 'le-mode-desc' }, t(`mode.${mode}.desc`)),
        ),
        h('span', { className: 'le-mode-rail', 'aria-hidden': true }),
      )
    }

    function EmptyState({ mode, t, onPick }) {
      const isPolish = mode === 'polish'
      const suggestions = [1, 2, 3, 4].map(index => t(`suggest.${mode}.${index}`))
      return h(
        'section',
        { className: `le-empty le-empty--${mode}` },
        isPolish
          ? h('div', { className: 'le-empty-mark is-polish' }, h(Glyph, { name: 'pen', size: 22 }))
          : h('div', { className: 'le-empty-mark' }, h('span', null, 'Aa')),
        h('h2', { className: 'le-empty-title' }, t(`empty.${mode}.title`)),
        h('p', { className: 'le-empty-body' }, t(`empty.${mode}.body`)),
        isPolish
          ? h(
              'div',
              { className: 'le-sample' },
              h('div', { className: 'le-sample-label' }, t('empty.polish.sample')),
              h(
                'div',
                { className: 'le-sample-row is-before' },
                h('span', { className: 'le-sample-tag' }, 'Before'),
                h('span', null, t('empty.polish.before')),
              ),
              h(
                'div',
                { className: 'le-sample-row is-after' },
                h('span', { className: 'le-sample-tag' }, 'After'),
                h('span', null, t('empty.polish.after')),
              ),
            )
          : null,
        h(
          'div',
          { className: 'le-prompts' },
          suggestions.map((text, index) =>
            h(
              'button',
              {
                type: 'button',
                key: index,
                className: 'le-prompt',
                onClick: () => onPick(text),
                title: text,
              },
              h('span', null, text),
              h(Glyph, { name: index === 3 ? 'arrow' : 'plus', size: 13 }),
            ),
          ),
        ),
      )
    }

    function Thinking({ mode, t, refining = false }) {
      return h(
        'div',
        { className: `le-thinking${refining ? ' is-refining' : ''}` },
        h('span', { className: 'le-dots', 'aria-hidden': true }, h('i'), h('i'), h('i')),
        h(
          'span',
          null,
          refining
            ? t('message.refining')
            : t(mode === 'polish' ? 'message.thinkingPolish' : 'message.thinkingFree'),
        ),
      )
    }

    function VoicePlayer({
      engine,
      messageId,
      text,
      voice,
      rate,
      voiceName,
      autoGenerate,
      autoPlay,
      available,
      t,
    }) {
      const cacheKey = `${messageId}:${engine}:${voice}:${rate}`
      const [phase, setPhase] = useState(available ? 'idle' : 'unavailable')
      const [url, setUrl] = useState('')
      const [duration, setDuration] = useState(0)
      const [playing, setPlaying] = useState(false)
      const [progress, setProgress] = useState(0)
      const [error, setError] = useState('')
      const phaseRef = useRef(available ? 'idle' : 'unavailable')
      const mountedRef = useRef(true)
      const audioRef = useRef(null)
      const queuePlayRef = useRef(false)

      useEffect(() => {
        mountedRef.current = true
        if (autoGenerate) void start(autoPlay)
        return () => {
          mountedRef.current = false
          const audio = audioRef.current
          if (audio) {
            audio.pause()
            if (activeSpeechAudio === audio) activeSpeechAudio = null
            audio.removeAttribute('src')
            audio.load()
          }
          audioRef.current = null
        }
        // The player is intentionally mounted once per message and voice.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])

      function makeAudio(source) {
        const audio = new Audio(source)
        audio.preload = 'metadata'
        audio.addEventListener('loadedmetadata', () => {
          const total = Number(audio.duration)
          if (mountedRef.current && Number.isFinite(total) && total > 0) setDuration(total)
        })
        audio.addEventListener('play', () => {
          if (activeSpeechAudio && activeSpeechAudio !== audio) activeSpeechAudio.pause()
          activeSpeechAudio = audio
          if (mountedRef.current) setPlaying(true)
        })
        audio.addEventListener('pause', () => {
          if (mountedRef.current) setPlaying(false)
        })
        audio.addEventListener('timeupdate', () => {
          if (!mountedRef.current) return
          const total = Number(audio.duration)
          setProgress(total > 0 ? Math.min(1, audio.currentTime / total) : 0)
        })
        audio.addEventListener('ended', () => {
          if (!mountedRef.current) return
          setPlaying(false)
          setProgress(0)
        })
        audio.addEventListener('error', () => {
          if (!mountedRef.current) return
          phaseRef.current = 'error'
          setPhase('error')
          setError(t('errors.tts'))
        })
        return audio
      }

      async function start(wantPlay = false) {
        if (!available) {
          phaseRef.current = 'error'
          setError(t('tts.unavailable'))
          setPhase('error')
          return
        }
        if (phaseRef.current === 'loading') {
          if (wantPlay) queuePlayRef.current = true
          return
        }
        if (phaseRef.current === 'ready') {
          if (wantPlay) void togglePlay()
          return
        }
        phaseRef.current = 'loading'
        setPhase('loading')
        setError('')
        try {
          const entry = await loadSpeech(
            cacheKey,
            { engine, text, voice, rate },
            t,
          )
          if (!mountedRef.current) return
          const audio = makeAudio(entry.url)
          audioRef.current = audio
          setUrl(entry.url)
          if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration)
          phaseRef.current = 'ready'
          setPhase('ready')
          if (wantPlay || queuePlayRef.current) {
            queuePlayRef.current = false
            try {
              await audio.play()
            } catch {
              // Browsers can block autoplay; the play button remains available.
            }
          }
        } catch (caught) {
          if (!mountedRef.current) return
          phaseRef.current = 'error'
          setPhase('error')
          setError(String(caught?.message ?? caught ?? t('errors.tts')))
        }
      }

      async function togglePlay() {
        const audio = audioRef.current
        if (!audio) {
          queuePlayRef.current = true
          return
        }
        if (audio.paused) {
          try {
            await audio.play()
          } catch {
            // Autoplay restrictions are harmless; the user can try again.
          }
        } else {
          audio.pause()
        }
      }

      function onClick() {
        if (!available) return
        if (phase === 'idle') {
          void start(true)
          return
        }
        if (phase === 'error') {
          evictSpeech(cacheKey)
          phaseRef.current = 'idle'
          setPhase('idle')
          setError('')
          void start(true)
          return
        }
        if (phase === 'loading') {
          queuePlayRef.current = true
          return
        }
        void togglePlay()
      }

      function download(event) {
        event.stopPropagation()
        if (!url) return
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `learn-english-${engine}-${messageId.slice(0, 8)}.${engine === 'edge' ? 'mp3' : 'wav'}`
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
      }

      const unavailable = phase === 'unavailable' || !available
      const label = engine === 'edge' ? t('tts.edge') : t('tts.qwen')
      const meta =
        unavailable
          ? t('tts.unavailable')
          : phase === 'loading'
            ? t('tts.generating')
            : phase === 'error'
              ? t('tts.failed')
              : `${voiceName}${Number.isFinite(duration) && duration > 0.5 ? ` · ${formatDuration(duration)}` : ''}`
      const iconName = unavailable
        ? 'alert'
        : phase === 'error'
          ? 'refresh'
          : phase === 'ready' && playing
            ? 'pause'
            : 'play'

      return h(
        'div',
        {
          className: `le-voice is-${phase}${playing ? ' is-playing' : ''}${unavailable ? ' is-unavailable' : ''}`,
          title: error || meta,
        },
        h(
          'button',
          {
            type: 'button',
            className: 'le-voice-play',
            onClick,
            disabled: unavailable,
            'aria-label': `${label}: ${playing ? t('tts.pause') : t('tts.play')}`,
          },
          phase === 'loading'
            ? h('span', { className: 'le-voice-spin', 'aria-hidden': true })
            : h(Glyph, { name: iconName, size: 14 }),
        ),
        h(
          'button',
          { type: 'button', className: 'le-voice-copy', onClick, disabled: unavailable },
          h('span', { className: 'le-voice-name' }, label),
          h('span', { className: 'le-voice-meta' }, meta),
        ),
        url && phase === 'ready'
          ? h(
              'button',
              {
                type: 'button',
                className: 'le-voice-download',
                onClick: download,
                title: t('message.download'),
                'aria-label': t('message.download'),
              },
              h(Glyph, { name: 'download', size: 13 }),
            )
          : null,
        h(
          'span',
          { className: 'le-voice-progress', 'aria-hidden': true },
          h('span', { style: { width: `${Math.round(progress * 100)}%` } }),
        ),
      )
    }

    function SpeechBar({ message, prefs, host, t, autoGenerate }) {
      const qwenStatus = host?.data?.engines?.qwen
      const qwenAvailable = qwenStatus ? Boolean(qwenStatus.available) : true
      const edgeVoices = resolveVoices(host, 'edge')
      const qwenVoices = resolveVoices(host, 'qwen')
      const edgeVoiceName =
        edgeVoices.find(voice => voice.id === prefs.edgeVoice)?.label ?? prefs.edgeVoice
      const qwenVoiceName =
        qwenVoices.find(voice => voice.id === prefs.qwenSpeaker)?.label ?? prefs.qwenSpeaker
      return h(
        'div',
        { className: 'le-voices' },
        h(VoicePlayer, {
          key: `edge:${prefs.edgeVoice}:${prefs.speed}`,
          engine: 'edge',
          messageId: message.id,
          text: message.content,
          voice: prefs.edgeVoice,
          voiceName: edgeVoiceName,
          rate: prefs.speed,
          autoGenerate,
          autoPlay: autoGenerate && prefs.autoRead,
          available: true,
          t,
        }),
        h(VoicePlayer, {
          key: `qwen:${prefs.qwenSpeaker}:${prefs.speed}`,
          engine: 'qwen',
          messageId: message.id,
          text: message.content,
          voice: prefs.qwenSpeaker,
          voiceName: qwenVoiceName,
          rate: prefs.speed,
          autoGenerate,
          autoPlay: false,
          available: qwenAvailable,
          t,
        }),
      )
    }

    function Message({
      message,
      mode,
      isLatest,
      busy,
      t,
      prefs,
      host,
      autoTts,
      onRetry,
      onRegenerate,
    }) {
      const [copied, setCopied] = useState(false)
      const copyTimer = useRef(null)
      useEffect(
        () => () => {
          if (copyTimer.current) clearTimeout(copyTimer.current)
        },
        [],
      )

      async function copy() {
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(message.content)
          } else {
            const area = document.createElement('textarea')
            area.value = message.content
            area.style.position = 'fixed'
            area.style.opacity = '0'
            document.body.appendChild(area)
            area.select()
            document.execCommand('copy')
            area.remove()
          }
          setCopied(true)
          if (copyTimer.current) clearTimeout(copyTimer.current)
          copyTimer.current = setTimeout(() => setCopied(false), 1600)
        } catch {
          setCopied(false)
        }
      }

      if (message.role === 'user') {
        return h(
          'article',
          { className: 'le-msg le-msg--user' },
          h(
            'div',
            { className: 'le-user-wrap' },
            h('div', { className: 'le-user-label' }, t('message.you')),
            h('div', { className: 'le-user-bubble', dir: 'auto' }, message.content),
            h(
              'div',
              { className: 'le-user-actions' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'le-action',
                  onClick: copy,
                  title: t('message.copy'),
                  'aria-label': t('message.copy'),
                },
                h(Glyph, { name: copied ? 'check' : 'copy', size: 13 }),
              ),
            ),
          ),
        )
      }

      const isPolish = mode === 'polish'
      const streaming = message.status === 'streaming'
      const hasContent = Boolean(message.content.trim())
      const showCaret = streaming && hasContent
      const speaker = isPolish ? t('message.editor') : t('message.alex')
      const role = isPolish ? '' : t('message.teacher')

      return h(
        'article',
        {
          className: `le-msg le-msg--assistant${isPolish ? ' is-polish' : ''}${
            streaming ? ' is-streaming' : ''
          }`,
          'data-status': message.status,
        },
        h('div', { className: `le-avatar${isPolish ? ' is-polish' : ''}`, 'aria-hidden': true }, isPolish ? 'Aa' : 'A'),
        h(
          'div',
          { className: 'le-msg-main' },
          h(
            'div',
            { className: 'le-msg-head' },
            h(
              'div',
              { className: 'le-speaker' },
              h('span', { className: 'le-speaker-name' }, speaker),
              role ? h('span', { className: 'le-speaker-role' }, role) : null,
              streaming ? h('span', { className: 'le-live-dot', 'aria-hidden': true }) : null,
            ),
            message.status === 'done' && hasContent
              ? h(SpeechBar, {
                  message,
                  prefs,
                  host,
                  t,
                  autoGenerate: Boolean(autoTts),
                })
              : null,
          ),
          !hasContent && streaming && !message.refining
            ? h(Thinking, { mode, t })
            : null,
          hasContent
            ? isPolish
              ? h(
                  'div',
                  { className: 'le-polished' },
                  h(
                    'div',
                    { className: 'le-prose' },
                    renderMarkdown(message.content),
                    showCaret ? h('span', { className: 'le-caret', 'aria-hidden': true }) : null,
                  ),
                )
              : h(
                  'div',
                  { className: 'le-msg-body' },
                  h(
                    'div',
                    { className: 'le-prose' },
                    renderMarkdown(message.content),
                    showCaret ? h('span', { className: 'le-caret', 'aria-hidden': true }) : null,
                  ),
                )
            : null,
          message.refining ? h(Thinking, { mode, t, refining: true }) : null,
          message.status === 'error'
            ? h(
                'div',
                { className: 'le-error', role: 'alert' },
                h(Glyph, { name: 'alert', size: 16 }),
                h(
                  'div',
                  { className: 'le-error-copy' },
                  h('strong', null, t('message.failed')),
                  h('span', null, message.error || t('errors.requestFailed')),
                ),
                isLatest && !busy
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'le-error-retry',
                        onClick: () => onRetry(message.id),
                      },
                      h(Glyph, { name: 'refresh', size: 13 }),
                      t('message.retry'),
                    )
                  : null,
              )
            : null,
          message.status === 'stopped' && !hasContent
            ? h('div', { className: 'le-stopped' }, h(Glyph, { name: 'stop', size: 12 }), t('message.stopped'))
            : null,
          message.status !== 'error'
            ? h(
                'div',
                { className: 'le-msg-actions' },
                hasContent
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'le-action',
                        onClick: copy,
                        title: t('message.copy'),
                        'aria-label': t('message.copy'),
                      },
                      h(Glyph, { name: copied ? 'check' : 'copy', size: 13 }),
                      h('span', null, copied ? t('message.copied') : t('message.copy')),
                    )
                  : null,
                isLatest && message.status === 'done' && !busy
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'le-action',
                        onClick: () => onRegenerate(message.id),
                        title: t('message.regenerate'),
                        'aria-label': t('message.regenerate'),
                      },
                      h(Glyph, { name: 'refresh', size: 13 }),
                      h('span', null, t('message.regenerate')),
                    )
                  : null,
                message.status === 'stopped' && hasContent
                  ? h('span', { className: 'le-msg-note' }, t('message.stopped'))
                  : null,
              )
            : null,
        ),
      )
    }

    function HistoryPopover({ open, onClose, t, locale, archived, busy, onLoad }) {
      const ref = useRef(null)
      useEffect(() => {
        if (!open) return undefined
        const onPointer = event => {
          if (event.target?.closest?.('[data-history-trigger]')) return
          if (ref.current && !ref.current.contains(event.target)) onClose()
        }
        const onKey = event => {
          if (event.key === 'Escape') onClose()
        }
        document.addEventListener('pointerdown', onPointer)
        document.addEventListener('keydown', onKey)
        return () => {
          document.removeEventListener('pointerdown', onPointer)
          document.removeEventListener('keydown', onKey)
        }
      }, [open, onClose])

      if (!open) return null
      return h(
        'div',
        { className: 'le-history-pop', ref, role: 'dialog', 'aria-label': t('history.title') },
        h(
          'div',
          { className: 'le-pop-head' },
          h(
            'div',
            { className: 'le-history-heading' },
            h('strong', null, t('history.title')),
            h('span', { className: 'le-history-total' }, archived.length),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'le-icon-btn le-pop-close',
              onClick: onClose,
              title: t('history.close'),
              'aria-label': t('history.close'),
            },
            h(Glyph, { name: 'close', size: 14 }),
          ),
        ),
        archived.length === 0
          ? h(
              'div',
              { className: 'le-history-empty' },
              h(Glyph, { name: 'clock', size: 18 }),
              h('p', null, t('history.empty')),
            )
          : h(
              'div',
              { className: 'le-history-list' },
              archived.map(entry => {
                const turns = entry.messages.filter(message => message.role === 'user').length
                return h(
                  'button',
                  {
                    key: entry.id,
                    type: 'button',
                    className: 'le-history-item',
                    onClick: () => onLoad(entry.id),
                    disabled: busy,
                    title: t('history.open'),
                  },
                  h(
                    'span',
                    { className: 'le-history-item-top' },
                    h(
                      'span',
                      { className: `le-history-mode is-${entry.mode}` },
                      h(Glyph, { name: MODE_STYLE[entry.mode].icon, size: 11 }),
                      t(`mode.${entry.mode}.name`),
                    ),
                    h(
                      'time',
                      null,
                      formatArchiveTime(
                        entry.messages[entry.messages.length - 1]?.at ?? entry.archivedAt,
                        locale,
                      ),
                    ),
                  ),
                  h('span', { className: 'le-history-preview' }, archivePreview(entry)),
                  h(
                    'span',
                    { className: 'le-history-meta' },
                    `${turns} ${t('history.turnUnit')} · ${entry.messages.length} ${t('history.messageUnit')}`,
                    h(Glyph, { name: 'arrow', size: 12 }),
                  ),
                )
              }),
            ),
        archived.length ? h('p', { className: 'le-history-note' }, t('history.note')) : null,
      )
    }

    function ExportMenu({ open, onClose, t, disabled, onPdf, onZip }) {
      const ref = useRef(null)
      useEffect(() => {
        if (!open) return undefined
        const onPointer = event => {
          if (event.target?.closest?.('[data-export-trigger]')) return
          if (ref.current && !ref.current.contains(event.target)) onClose()
        }
        const onKey = event => {
          if (event.key === 'Escape') onClose()
        }
        document.addEventListener('pointerdown', onPointer)
        document.addEventListener('keydown', onKey)
        return () => {
          document.removeEventListener('pointerdown', onPointer)
          document.removeEventListener('keydown', onKey)
        }
      }, [open, onClose])

      if (!open) return null
      return h(
        'div',
        { className: 'le-export-menu', ref, role: 'menu', 'aria-label': t('controls.export') },
        h(
          'button',
          {
            type: 'button',
            className: 'le-export-item',
            role: 'menuitem',
            onClick: onPdf,
            disabled,
          },
          h('span', { className: 'le-export-item-icon' }, h(Glyph, { name: 'download', size: 16 })),
          h(
            'span',
            { className: 'le-export-item-copy' },
            h('strong', null, t('controls.exportPdf')),
            h('span', null, t('controls.exportPdfDesc')),
          ),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'le-export-item',
            role: 'menuitem',
            onClick: onZip,
            disabled,
          },
          h('span', { className: 'le-export-item-icon' }, h(Glyph, { name: 'archive', size: 16 })),
          h(
            'span',
            { className: 'le-export-item-copy' },
            h('strong', null, t('controls.exportZip')),
            h('span', null, t('controls.exportZipDesc')),
          ),
        ),
      )
    }

    function SettingsPopover({ open, onClose, t, prefs, onPrefs, host }) {
      const ref = useRef(null)
      useEffect(() => {
        if (!open) return undefined
        const onPointer = event => {
          if (event.target?.closest?.('[data-settings-trigger]')) return
          if (ref.current && !ref.current.contains(event.target)) onClose()
        }
        const onKey = event => {
          if (event.key === 'Escape') onClose()
        }
        document.addEventListener('pointerdown', onPointer)
        document.addEventListener('keydown', onKey)
        return () => {
          document.removeEventListener('pointerdown', onPointer)
          document.removeEventListener('keydown', onKey)
        }
      }, [open, onClose])

      if (!open) return null
      const edgeVoices = resolveVoices(host, 'edge')
      const qwenVoices = resolveVoices(host, 'qwen')
      const engines = host?.data?.engines
      const model = host?.data?.model

      return h(
        'div',
        { className: 'le-pop', ref, role: 'dialog', 'aria-label': t('settings.title') },
        h(
          'div',
          { className: 'le-pop-head' },
          h('strong', null, t('settings.title')),
          h(
            'button',
            {
              type: 'button',
              className: 'le-icon-btn le-pop-close',
              onClick: onClose,
              title: t('settings.close'),
              'aria-label': t('settings.close'),
            },
            h(Glyph, { name: 'close', size: 14 }),
          ),
        ),
        h(
          'button',
          {
            type: 'button',
            className: `le-switch${prefs.autoRead ? ' is-on' : ''}`,
            role: 'switch',
            'aria-checked': prefs.autoRead,
            onClick: () => onPrefs({ autoRead: !prefs.autoRead }, false),
          },
          h(
            'span',
            { className: 'le-switch-copy' },
            h('strong', null, t('settings.autoRead')),
            h('span', null, t('settings.autoReadHint')),
          ),
          h('span', { className: 'le-switch-track', 'aria-hidden': true }, h('span', null)),
        ),
        h(
          'label',
          { className: 'le-field' },
          h('span', { className: 'le-field-label' }, t('settings.edgeVoice')),
          h(
            'select',
            {
              className: 'le-select',
              value: prefs.edgeVoice,
              onChange: event => onPrefs({ edgeVoice: event.target.value, edgeVoiceCustom: true }, true),
            },
            edgeVoices.map(voice =>
              h(
                'option',
                { key: voice.id, value: voice.id },
                `${voice.label}${voice.tone ? ` — ${voice.tone}` : ''}`,
              ),
            ),
          ),
        ),
        h(
          'label',
          { className: 'le-field' },
          h('span', { className: 'le-field-label' }, t('settings.qwenVoice')),
          h(
            'select',
            {
              className: 'le-select',
              value: prefs.qwenSpeaker,
              onChange: event => onPrefs({ qwenSpeaker: event.target.value, qwenVoiceCustom: true }, true),
            },
            qwenVoices.map(voice =>
              h(
                'option',
                { key: voice.id, value: voice.id },
                `${voice.label}${voice.tone ? ` — ${voice.tone}` : ''}`,
              ),
            ),
          ),
        ),
        h(
          'div',
          { className: 'le-field' },
          h('span', { className: 'le-field-label' }, t('settings.speed')),
          h(
            'div',
            { className: 'le-segment' },
            [0.85, 1, 1.15].map(value =>
              h(
                'button',
                {
                  key: value,
                  type: 'button',
                  className: prefs.speed === value ? 'is-active' : '',
                  'aria-pressed': prefs.speed === value,
                  onClick: () => onPrefs({ speed: value }, true),
                },
                t(`speed.${String(value).replace('.', '')}`),
              ),
            ),
          ),
        ),
        h(
          'div',
          { className: 'le-engine-list' },
          h('span', { className: 'le-field-label' }, t('settings.engines')),
          h(
            'div',
            { className: 'le-engine' },
            h('span', {
              className: `le-engine-dot${engines?.edge?.available !== false ? ' is-on' : ''}`,
              'aria-hidden': true,
            }),
            h(
              'span',
              { className: 'le-engine-copy' },
              h('strong', null, engines?.edge?.label ?? t('tts.edge')),
              h('span', null, engines?.edge?.detail ?? t('settings.online')),
            ),
            h('span', { className: 'le-engine-tag' }, t('settings.online')),
          ),
          h(
            'div',
            { className: 'le-engine' },
            h('span', {
              className: `le-engine-dot${engines?.qwen?.available ? ' is-on' : ' is-off'}`,
              'aria-hidden': true,
            }),
            h(
              'span',
              { className: 'le-engine-copy' },
              h('strong', null, engines?.qwen?.label ?? t('tts.qwen')),
              h('span', null, engines?.qwen?.detail ?? t('settings.local')),
            ),
            h('span', { className: 'le-engine-tag' }, t('settings.local')),
          ),
        ),
        h('div', { className: 'le-model-line' }, h('span', null, t('settings.model')), h('code', null, model ? model.model : '—')),
        h('p', { className: 'le-note' }, t('settings.qwenHint')),
      )
    }

    function Composer({ mode, draft, onDraft, busy, exporting, onSend, onStop, t, textareaRef }) {
      const composingRef = useRef(false)
      useEffect(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = '0px'
        el.style.height = `${Math.min(Math.max(el.scrollHeight, 56), 168)}px`
      }, [draft, textareaRef])

      const pick = event => {
        if (event.key === 'Enter' && !event.shiftKey && !composingRef.current && !event.nativeEvent?.isComposing) {
          event.preventDefault()
          if (!busy && !exporting) onSend()
        }
      }

      return h(
        'section',
        { className: `le-composer${busy ? ' is-busy' : ''}` },
        h('textarea', {
          ref: textareaRef,
          value: draft,
          placeholder: t(`composer.${mode}.placeholder`),
          rows: 1,
          maxLength: MAX_INPUT,
          onChange: event => onDraft(event.target.value),
          onKeyDown: pick,
          onCompositionStart: () => {
            composingRef.current = true
          },
          onCompositionEnd: () => {
            composingRef.current = false
          },
          'aria-label': t(`composer.${mode}.placeholder`),
        }),
        h(
          'div',
          { className: 'le-composer-foot' },
          h(
            'div',
            { className: 'le-composer-meta' },
            h('span', { className: 'le-hint' }, t('composer.hint')),
          ),
          h(
            'div',
            { className: 'le-composer-buttons' },
            busy
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'le-send is-stop',
                    onClick: onStop,
                    title: t('composer.stop'),
                    'aria-label': t('composer.stop'),
                  },
                  h(StopSquareIcon),
                )
              : h(
                  'button',
                  {
                    type: 'button',
                    className: 'le-send',
                    onClick: onSend,
                    disabled: exporting || !draft.trim(),
                    title: t('composer.send'),
                    'aria-label': t('composer.send'),
                  },
                  h(SendArrowIcon),
                ),
          ),
        ),
      )
    }

    function LearnEnglishPage({ localeService }) {
      const { t, locale } = useLocale(localeService)
      const [store, setStore] = useState(readStore)
      const [draft, setDraft] = useState('')
      const [busy, setBusy] = useState(false)
      const [freshId, setFreshId] = useState('')
      const [settingsOpen, setSettingsOpen] = useState(false)
      const [historyOpen, setHistoryOpen] = useState(false)
      const [exportOpen, setExportOpen] = useState(false)
      const [exporting, setExporting] = useState(false)
      const [exportStage, setExportStage] = useState('')
      const [host, setHost] = useState({ loading: true, data: null, error: '' })
      const busyRef = useRef(false)
      const exportingRef = useRef(false)
      const activeRequestRef = useRef(null)
      const threadRef = useRef(null)
      const textareaRef = useRef(null)
      const stickRef = useRef(true)
      const aliveRef = useRef(true)

      const mode = store.mode
      const messages = store.threads[mode] ?? []
      const archived = store.archived ?? []
      const streaming = messages.some(message => message.status === 'streaming')
      const lastAssistantId = [...messages].reverse().find(message => message.role === 'assistant')?.id

      useEffect(() => {
        aliveRef.current = true
        return () => {
          aliveRef.current = false
          activeRequestRef.current?.abort()
        }
      }, [])

      useEffect(() => {
        const timer = setTimeout(() => {
          try {
            localStorage.setItem(STORE_KEY, JSON.stringify(storeForDisk(store)))
          } catch {
            // A full or unavailable localStorage must not break the studio.
          }
        }, 240)
        return () => clearTimeout(timer)
      }, [store])

      const refreshHost = useCallback(async () => {
        setHost(current => ({ ...current, loading: true, error: '' }))
        try {
          const response = await fetch(`${API}/status`, { headers: { accept: 'application/json' } })
          if (!response.ok) throw new Error(`Host status ${response.status}`)
          const data = await response.json()
          if (!aliveRef.current) return
          setHost({ loading: false, data, error: '' })
        } catch (error) {
          if (!aliveRef.current) return
          setHost({ loading: false, data: null, error: String(error?.message ?? error) })
        }
      }, [])

      useEffect(() => {
        void refreshHost()
      }, [refreshHost])

      useEffect(() => {
        if (!host.data) return
        const edgeDefault = host.data.engines?.edge?.voice
        const qwenDefault = host.data.engines?.qwen?.voice
        setStore(previous => {
          const next = { ...previous.prefs }
          let changed = false
          if (!next.edgeVoiceCustom && edgeDefault && next.edgeVoice !== edgeDefault) {
            next.edgeVoice = edgeDefault
            changed = true
          }
          if (!next.qwenVoiceCustom && qwenDefault && next.qwenSpeaker !== qwenDefault) {
            next.qwenSpeaker = qwenDefault
            changed = true
          }
          return changed ? { ...previous, prefs: next } : previous
        })
      }, [host.data])

      useEffect(() => {
        const el = threadRef.current
        if (!el) return
        if (stickRef.current) {
          if (streaming) el.scrollTop = el.scrollHeight
          else el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
        }
      }, [messages, streaming, freshId])

      useEffect(() => {
        stickRef.current = true
        const el = threadRef.current
        if (el) {
          el.scrollTop = el.scrollHeight
        }
      }, [mode])

      const updateMessage = useCallback((messageMode, messageId, patch) => {
        setStore(previous => {
          const thread = previous.threads[messageMode] ?? []
          return {
            ...previous,
            threads: {
              ...previous.threads,
              [messageMode]: thread.map(message =>
                message.id === messageId
                  ? { ...message, ...(typeof patch === 'function' ? patch(message) : patch) }
                  : message,
              ),
            },
          }
        })
      }, [])

      const updatePrefs = useCallback(
        (patch, resetTts) => {
          setStore(previous => ({
            ...previous,
            prefs: { ...previous.prefs, ...patch },
          }))
          if (resetTts) setFreshId('')
        },
        [],
      )

      function selectMode(nextMode) {
        if (busyRef.current || exportingRef.current || nextMode === mode) return
        setFreshId('')
        setStore(previous => ({ ...previous, mode: nextMode }))
      }

      async function runCompletion(requestMode, history, assistantId) {
        if (busyRef.current) return
        busyRef.current = true
        setBusy(true)
        setFreshId('')
        const controller = new AbortController()
        activeRequestRef.current = controller
        let accumulated = ''
        let completed = false

        const consume = event => {
          if (!event || typeof event.type !== 'string') return
          if (event.type === 'delta') {
            accumulated += safeText(event.text)
            updateMessage(requestMode, assistantId, { content: accumulated, refining: false })
            return
          }
          if (event.type === 'replace') {
            accumulated = safeText(event.text)
            updateMessage(requestMode, assistantId, { content: accumulated, refining: false })
            return
          }
          if (event.type === 'refining') {
            updateMessage(requestMode, assistantId, { refining: true })
            return
          }
          if (event.type === 'done') {
            accumulated = safeText(event.text) || accumulated
            completed = true
            setFreshId(assistantId)
            updateMessage(requestMode, assistantId, {
              content: accumulated,
              status: 'done',
              refining: false,
              error: '',
              model: event.model ?? '',
            })
            return
          }
          if (event.type === 'error') {
            throw new Error(safeText(event.message) || t('errors.requestFailed'))
          }
        }

        try {
          let response
          try {
            response = await fetch(`${API}/chat`, {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'application/x-ndjson' },
              body: JSON.stringify({ mode: requestMode, messages: history }),
              signal: controller.signal,
            })
          } catch (error) {
            if (controller.signal.aborted) throw error
            throw new Error(t('errors.offline'))
          }
          if (!response.ok) {
            let message = t('errors.requestFailed')
            try {
              const body = await response.json()
              if (body?.error) message = String(body.error)
            } catch {
              // Keep the localized fallback.
            }
            throw new Error(message)
          }
          if (!response.body) throw new Error(t('errors.requestFailed'))

          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          let ended = false
          while (!ended) {
            const chunk = await reader.read()
            if (chunk.done) {
              ended = true
              break
            }
            buffer += decoder.decode(chunk.value, { stream: true })
            let lineEnd = buffer.indexOf('\n')
            while (lineEnd >= 0) {
              const line = buffer.slice(0, lineEnd).trim()
              buffer = buffer.slice(lineEnd + 1)
              if (line) {
                let event
                try {
                  event = JSON.parse(line)
                } catch {
                  event = null
                }
                if (event) consume(event)
              }
              lineEnd = buffer.indexOf('\n')
            }
          }
          const tail = `${buffer}${decoder.decode()}`.trim()
          if (tail) {
            let event = null
            try {
              event = JSON.parse(tail)
            } catch {
              event = null
            }
            if (event) consume(event)
          }
          if (!completed) throw new Error(t('errors.requestFailed'))
        } catch (error) {
          if (!aliveRef.current) return
          if (controller.signal.aborted) {
            updateMessage(requestMode, assistantId, {
              status: 'stopped',
              refining: false,
              content: accumulated,
            })
          } else {
            const message = friendlyClientError(error, t)
            updateMessage(requestMode, assistantId, {
              status: 'error',
              refining: false,
              error: message,
            })
          }
        } finally {
          if (aliveRef.current) {
            busyRef.current = false
            activeRequestRef.current = null
            setBusy(false)
            requestAnimationFrame(() => textareaRef.current?.focus())
          }
        }
      }

      function send() {
        if (busyRef.current) return
        const text = draft.trim().slice(0, MAX_INPUT)
        if (!text) return
        const requestMode = mode
        const thread = store.threads[requestMode] ?? []
        const history = thread
          .filter(
            message =>
              message.role === 'user' ||
              (message.role === 'assistant' && message.status === 'done' && message.content.trim()),
          )
          .slice(-16)
          .map(message => ({ role: message.role, content: message.content }))
        const now = Date.now()
        const assistantId = makeId()
        const userMessage = {
          id: makeId(),
          role: 'user',
          content: text,
          at: now,
          mode: requestMode,
          status: 'done',
          error: '',
          refining: false,
        }
        const assistantMessage = {
          id: assistantId,
          role: 'assistant',
          content: '',
          at: now,
          mode: requestMode,
          status: 'streaming',
          error: '',
          refining: false,
        }
        setDraft('')
        setFreshId('')
        stickRef.current = true
        setStore(previous => ({
          ...previous,
          threads: {
            ...previous.threads,
            [requestMode]: [...(previous.threads[requestMode] ?? []), userMessage, assistantMessage].slice(-MAX_MESSAGES),
          },
        }))
        void runCompletion(requestMode, [...history, { role: 'user', content: text }], assistantId)
      }

      function regenerate(messageId) {
        if (busyRef.current) return
        const requestMode = mode
        const thread = store.threads[requestMode] ?? []
        const index = thread.findIndex(message => message.id === messageId)
        if (index < 0 || index !== thread.length - 1 || thread[index].role !== 'assistant') return
        let userIndex = -1
        for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
          if (thread[cursor].role === 'user') {
            userIndex = cursor
            break
          }
        }
        if (userIndex < 0) return
        const history = thread
          .slice(0, index)
          .filter(
            message =>
              message.role === 'user' ||
              (message.role === 'assistant' && message.status === 'done' && message.content.trim()),
          )
          .slice(-16)
          .map(message => ({ role: message.role, content: message.content }))
        const assistantId = makeId()
        const replacement = {
          id: assistantId,
          role: 'assistant',
          content: '',
          at: Date.now(),
          mode: requestMode,
          status: 'streaming',
          error: '',
          refining: false,
        }
        setFreshId('')
        stickRef.current = true
        setStore(previous => {
          const current = previous.threads[requestMode] ?? []
          return {
            ...previous,
            threads: {
              ...previous.threads,
              [requestMode]: current.map((message, cursor) =>
                cursor === index ? replacement : message,
              ),
            },
          }
        })
        void runCompletion(requestMode, history, assistantId)
      }

      function stop() {
        activeRequestRef.current?.abort()
      }

      function makeArchive(archiveMode, archiveMessages) {
        return {
          id: makeId(),
          mode: archiveMode,
          archivedAt: Date.now(),
          messages: archiveMessages.slice(-ARCHIVE_MESSAGES),
        }
      }

      function startNewChat() {
        if (busyRef.current || exportingRef.current) return
        setFreshId('')
        setHistoryOpen(false)
        setExportOpen(false)
        setStore(previous => {
          const current = previous.threads[previous.mode] ?? []
          if (!current.length) return previous
          return {
            ...previous,
            archived: [makeArchive(previous.mode, current), ...(previous.archived ?? [])].slice(
              0,
              ARCHIVE_LIMIT,
            ),
            threads: { ...previous.threads, [previous.mode]: [] },
          }
        })
        stickRef.current = true
      }

      function loadArchived(archiveId) {
        if (busyRef.current || exportingRef.current) return
        const entry = archived.find(item => item.id === archiveId)
        if (!entry) return
        setFreshId('')
        setHistoryOpen(false)
        setExportOpen(false)
        setStore(previous => {
          const target = previous.threads[entry.mode] ?? []
          let nextArchived = (previous.archived ?? []).filter(item => item.id !== entry.id)
          if (target.length) {
            nextArchived = [makeArchive(entry.mode, target), ...nextArchived]
          }
          return {
            ...previous,
            mode: entry.mode,
            threads: { ...previous.threads, [entry.mode]: entry.messages },
            archived: nextArchived.slice(0, ARCHIVE_LIMIT),
          }
        })
        stickRef.current = true
      }

      async function startExport(kind) {
        if (
          busyRef.current ||
          exportingRef.current ||
          !messages.some(message => message.content.trim())
        ) {
          return
        }
        exportingRef.current = true
        setExporting(true)
        setExportOpen(false)
        setSettingsOpen(false)
        setHistoryOpen(false)
        setExportStage(t(kind === 'pdf' ? 'controls.exportPdfStage' : 'controls.exportPreparing'))
        try {
          await new Promise(resolve => setTimeout(resolve, 30))
          if (kind === 'pdf') {
            await downloadConversationPdf({ mode, messages, t, locale })
          } else {
            await downloadConversationZip({
              mode,
              messages,
              t,
              locale,
              prefs: store.prefs,
              host,
              onProgress: progress => {
                if (!aliveRef.current) return
                if (progress.phase === 'audio') {
                  setExportStage(
                    `${t('controls.exportAudio')} ${progress.done}/${progress.total}`,
                  )
                } else if (progress.phase === 'zip') {
                  setExportStage(t('controls.exportZipping'))
                }
              },
            })
          }
        } catch (error) {
          console.error(`[dsh-learn-english] ${kind.toUpperCase()} export failed:`, error)
          if (typeof window.alert === 'function') {
            window.alert(t(kind === 'pdf' ? 'errors.pdf' : 'errors.zip'))
          }
        } finally {
          exportingRef.current = false
          if (aliveRef.current) {
            setExporting(false)
            setExportStage('')
          }
        }
      }

      function pickPrompt(text) {
        setDraft(text)
        requestAnimationFrame(() => {
          const area = textareaRef.current
          if (!area) return
          area.focus()
          area.setSelectionRange(text.length, text.length)
        })
      }

      const titleWords = t('title').split(' ')
      const titleTail = titleWords.length > 1 ? titleWords.pop() : ''
      const titleHead = titleWords.join(' ')

      return h(
        'div',
        { className: 'le-page' },
        h(
          'div',
          { className: 'le-shell' },
          h(
            'header',
            { className: 'le-header' },
            h(
              'div',
              { className: 'le-brand' },
              h('div', { className: 'le-mark', 'aria-hidden': true }, h('span', null, 'Aa')),
              h(
                'div',
                { className: 'le-brand-copy' },
                h('div', { className: 'le-kicker' }, t('kicker')),
                h('h1', { className: 'le-title' }, titleHead ? `${titleHead} ` : '', h('em', null, titleTail)),
                h(
                  'div',
                  { className: 'le-brand-subrow' },
                  h('p', { className: 'le-subtitle' }, t('subtitle')),
                  h(
                    'div',
                    { className: 'le-modes', role: 'group', 'aria-label': 'Practice mode' },
                    MODE_ORDER.map(item =>
                      h(ModeCard, {
                        key: item,
                        mode: item,
                        active: mode === item,
                        disabled: busy || exporting,
                        t,
                        onClick: () => selectMode(item),
                      }),
                    ),
                  ),
                ),
              ),
            ),
            h(
              'div',
              { className: 'le-actions' },
              h(StatusPill, { host, t, onRefresh: refreshHost }),
              h(
                'button',
                {
                  type: 'button',
                  className: `le-chip-toggle${store.prefs.autoRead ? ' is-on' : ''}`,
                  onClick: () => updatePrefs({ autoRead: !store.prefs.autoRead }, false),
                  'aria-pressed': store.prefs.autoRead,
                  title: t('controls.autoRead'),
                },
                h(Glyph, { name: 'volume', size: 14 }),
                h('span', { className: 'le-chip-label' }, t('controls.autoRead')),
              ),
              h(
                'div',
                { className: 'le-history-wrap' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: `le-icon-btn le-history-btn${historyOpen ? ' is-active' : ''}`,
                    onClick: () => {
                      setHistoryOpen(value => !value)
                      setSettingsOpen(false)
                      setExportOpen(false)
                    },
                    title: t('controls.history'),
                    'aria-label': `${t('controls.history')}${archived.length ? ` · ${archived.length}` : ''}`,
                    'aria-expanded': historyOpen,
                    'data-history-trigger': true,
                  },
                  h(Glyph, { name: 'clock', size: 16 }),
                  archived.length
                    ? h('span', { className: 'le-history-badge' }, archived.length > 9 ? '9+' : archived.length)
                    : null,
                ),
                h(HistoryPopover, {
                  open: historyOpen,
                  onClose: () => setHistoryOpen(false),
                  t,
                  locale,
                  archived,
                  busy: busy || exporting,
                  onLoad: loadArchived,
                }),
              ),
              h(
                'div',
                { className: 'le-settings-wrap' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: `le-icon-btn${settingsOpen ? ' is-active' : ''}`,
                    onClick: () => {
                      setSettingsOpen(value => !value)
                      setHistoryOpen(false)
                      setExportOpen(false)
                    },
                    title: t('controls.settings'),
                    'aria-label': t('controls.settings'),
                    'aria-expanded': settingsOpen,
                    'data-settings-trigger': true,
                  },
                  h(Glyph, { name: 'settings', size: 16 }),
                ),
                h(SettingsPopover, {
                  open: settingsOpen,
                  onClose: () => setSettingsOpen(false),
                  t,
                  prefs: store.prefs,
                  onPrefs: updatePrefs,
                  host,
                }),
              ),
              h(
                'div',
                { className: 'le-export-wrap' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: `le-export-button${exportOpen ? ' is-active' : ''}`,
                    onClick: () => {
                      setExportOpen(value => !value)
                      setSettingsOpen(false)
                      setHistoryOpen(false)
                    },
                    disabled: busy || exporting || !messages.some(message => message.content.trim()),
                    title: t('controls.export'),
                    'aria-label': exporting ? t('controls.exporting') : t('controls.export'),
                    'aria-busy': exporting,
                    'aria-haspopup': 'menu',
                    'aria-expanded': exportOpen,
                    'data-export-trigger': true,
                  },
                  exporting
                    ? h('span', { className: 'le-export-spin', 'aria-hidden': true })
                    : h(Glyph, { name: 'download', size: 14 }),
                  h(
                    'span',
                    { className: 'le-export-label' },
                    exporting ? t('controls.exporting') : t('controls.export'),
                  ),
                  exporting
                    ? null
                    : h(
                        'span',
                        { className: 'le-export-caret', 'aria-hidden': true },
                        h(Glyph, { name: 'chevron', size: 11 }),
                      ),
                ),
                h(ExportMenu, {
                  open: exportOpen,
                  onClose: () => setExportOpen(false),
                  t,
                  disabled: busy || exporting || !messages.some(message => message.content.trim()),
                  onPdf: () => startExport('pdf'),
                  onZip: () => startExport('zip'),
                }),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'le-new-chat',
                  onClick: startNewChat,
                  disabled: busy || exporting || messages.length === 0,
                  title: t('controls.newChatHint'),
                },
                h(Glyph, { name: 'plus', size: 14 }),
                h('span', null, t('controls.newChat')),
              ),
            ),
          ),
          h(
            'main',
            {
              className: 'le-thread',
              ref: threadRef,
              onScroll: () => {
                const el = threadRef.current
                if (!el) return
                stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 110
              },
            },
            h(
              'div',
              { className: 'le-thread-inner' },
              messages.length === 0
                ? h(EmptyState, { mode, t, onPick: pickPrompt })
                : messages.map(message =>
                    h(Message, {
                      key: message.id,
                      message,
                      mode,
                      isLatest: message.id === lastAssistantId,
                      busy: busy || exporting,
                      t,
                      prefs: store.prefs,
                      host,
                      autoTts: message.id === freshId,
                      onRetry: regenerate,
                      onRegenerate: regenerate,
                    }),
                  ),
              h('div', { className: 'le-thread-tail', 'aria-hidden': true }),
            ),
          ),
          h(Composer, {
            mode,
            draft,
            onDraft: setDraft,
            busy,
            exporting,
            onSend: send,
            onStop: stop,
            t,
            textareaRef,
          }),
          exporting
            ? h(
                'div',
                { className: 'le-export-toast', role: 'status' },
                h('span', { className: 'le-export-toast-spin', 'aria-hidden': true }),
                h('span', null, exportStage || t('controls.exporting')),
              )
            : null,
        ),
        h('div', { className: 'le-sr', role: 'status', 'aria-live': 'polite' }, busy ? t('status.loading') : ''),
      )
    }

    const styles = `
      .le-page {
        --le-ink:var(--dsw-alias-label-primary, CanvasText);
        --le-muted:var(--dsw-alias-label-secondary, GrayText);
        --le-bg:var(--dsw-alias-bg-base, Canvas);
        --le-surface:var(--dsw-alias-bg-layer-1, Canvas);
        --le-surface-2:var(--dsw-alias-bg-layer-2, Canvas);
        --le-overlay:var(--dsw-alias-bg-overlay, Canvas);
        --le-line:var(--dsw-alias-border-l1, color-mix(in srgb, var(--le-ink) 12%, transparent));
        --le-line-strong:var(--dsw-alias-border-l2, color-mix(in srgb, var(--le-ink) 20%, transparent));
        --le-brand:var(--dsw-alias-brand-primary, AccentColor);
        --le-polish:var(--dsw-alias-state-warn-primary, AccentColor);
        --le-error:var(--dsw-alias-state-error-primary, CanvasText);
        --le-success:var(--dsw-alias-state-success-primary, CanvasText);
        --le-hover:color-mix(in srgb, var(--le-ink) 5%, transparent);
        --le-soft:color-mix(in srgb, var(--le-ink) 3.2%, transparent);
        --le-serif:"Iowan Old Style","Palatino Linotype","Songti SC","Noto Serif SC",Georgia,"Times New Roman",serif;
        --le-sans:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
        --le-shadow:0 28px 70px -46px color-mix(in srgb, var(--le-ink) 46%, transparent);
        position:relative; display:flex; flex-direction:column; box-sizing:border-box;
        width:100%; height:100%; min-height:0; overflow:hidden;
        color:var(--le-ink); font-family:var(--le-sans); font-size:14px; line-height:1.5;
        background:
          radial-gradient(1040px 520px at 88% -14%, color-mix(in srgb, var(--le-brand) 10%, transparent), transparent 66%),
          radial-gradient(820px 440px at -12% 108%, color-mix(in srgb, var(--le-polish) 6%, transparent), transparent 70%),
          var(--le-bg);
      }
      .le-page *, .le-page *::before, .le-page *::after { box-sizing:border-box; }
      .le-page button, .le-page input, .le-page textarea, .le-page select { font:inherit; color:inherit; }
      .le-page button { cursor:pointer; }
      .le-page button:disabled { cursor:default; }
      .le-page :focus-visible { outline:2px solid color-mix(in srgb, var(--le-brand) 80%, var(--le-ink)); outline-offset:2px; }
      .le-page ::selection { background:color-mix(in srgb, var(--le-brand) 24%, transparent); }
      .le-shell {
        position:relative; z-index:1; display:flex; flex-direction:column; flex:1 1 auto;
        width:100%; max-width:1120px; height:100%; min-height:0; margin:0 auto;
        padding:clamp(16px, 2.6vh, 24px) clamp(18px, 3.6vw, 42px) clamp(14px, 2.2vh, 20px);
      }
      .le-header { display:flex; align-items:flex-start; justify-content:space-between; gap:24px; flex:none; }
      .le-brand { display:flex; align-items:flex-start; gap:14px; min-width:0; }
      .le-mark {
        display:grid; place-items:center; flex:none; width:46px; height:46px; margin-top:2px;
        border-radius:15px; color:var(--le-bg); background:var(--le-ink);
        box-shadow:0 10px 22px -14px color-mix(in srgb, var(--le-ink) 70%, transparent);
      }
      .le-mark span { font-family:var(--le-serif); font-size:23px; font-weight:600; letter-spacing:-.06em; transform:translateY(-1px); }
      .le-brand-copy { min-width:0; }
      .le-kicker { display:flex; align-items:center; gap:7px; margin:1px 0 4px; color:var(--le-muted); font-size:9.5px; font-weight:720; letter-spacing:.17em; text-transform:uppercase; }
      .le-kicker::before { content:""; width:16px; height:1px; background:color-mix(in srgb, var(--le-brand) 72%, transparent); }
      .le-title { margin:0; font-family:var(--le-serif); font-size:clamp(29px, 3vw, 37px); line-height:1.04; font-weight:600; letter-spacing:-.045em; }
      .le-title em { color:var(--le-brand); font-weight:500; }
      .le-brand-subrow { display:flex; align-items:center; gap:14px; flex-wrap:wrap; min-width:0; margin-top:7px; }
      .le-subtitle { max-width:560px; margin:0; color:var(--le-muted); font-size:12.5px; line-height:1.65; text-wrap:pretty; }
      .le-actions { display:flex; align-items:center; justify-content:flex-end; gap:7px; flex:none; flex-wrap:wrap; padding-top:3px; }
      .le-status { display:inline-flex; align-items:center; gap:7px; min-height:32px; padding:0 11px; border:1px solid var(--le-line); border-radius:999px; background:color-mix(in srgb, var(--le-surface) 70%, transparent); color:var(--le-muted); font-size:10.5px; font-weight:640; letter-spacing:.02em; transition:border-color .18s ease, background-color .18s ease; }
      .le-status:hover { border-color:var(--le-line-strong); background:var(--le-surface); }
      .le-status-dot { width:6px; height:6px; border-radius:50%; background:var(--le-muted); opacity:.45; }
      .le-status.is-ready { color:var(--le-success); }
      .le-status.is-ready .le-status-dot { background:var(--le-success); opacity:1; box-shadow:0 0 0 3px color-mix(in srgb, var(--le-success) 13%, transparent); }
      .le-status.is-model { color:var(--le-polish); }
      .le-status.is-model .le-status-dot { background:var(--le-polish); opacity:1; }
      .le-status.is-offline { color:var(--le-error); }
      .le-status.is-offline .le-status-dot { background:var(--le-error); opacity:1; }
      .le-status.is-loading .le-status-dot { animation:le-pulse 1.4s ease-out infinite; }
      .le-chip-toggle { display:inline-flex; align-items:center; gap:6px; min-height:32px; padding:0 10px; border:1px solid var(--le-line); border-radius:999px; background:transparent; color:var(--le-muted); font-size:10.5px; font-weight:620; transition:color .18s ease, border-color .18s ease, background-color .18s ease; }
      .le-chip-toggle:hover { color:var(--le-ink); border-color:var(--le-line-strong); background:var(--le-hover); }
      .le-chip-toggle.is-on { color:var(--le-ink); border-color:color-mix(in srgb, var(--le-brand) 24%, var(--le-line)); background:color-mix(in srgb, var(--le-brand) 7%, transparent); }
      .le-chip-toggle.is-on svg { color:var(--le-brand); }
      .le-icon-btn { display:grid; place-items:center; width:32px; height:32px; padding:0; border:1px solid var(--le-line); border-radius:50%; background:transparent; color:var(--le-muted); transition:color .18s ease, border-color .18s ease, background-color .18s ease, transform .18s ease; }
      .le-icon-btn:hover { color:var(--le-ink); border-color:var(--le-line-strong); background:var(--le-hover); }
      .le-icon-btn.is-active { color:var(--le-ink); border-color:color-mix(in srgb, var(--le-brand) 32%, var(--le-line)); background:color-mix(in srgb, var(--le-brand) 7%, transparent); }
      .le-settings-wrap { position:relative; }
      .le-history-wrap { position:relative; display:inline-flex; }
      .le-history-btn { position:relative; }
      .le-history-badge { position:absolute; top:-3px; right:-3px; display:grid; place-items:center; min-width:14px; height:14px; padding:0 3px; border-radius:999px; color:var(--le-bg); background:var(--le-brand); font-size:7.5px; font-weight:750; line-height:1; box-shadow:0 0 0 2px var(--le-surface); }
      .le-export-wrap { position:relative; display:inline-flex; }
      .le-export-button { display:inline-flex; align-items:center; gap:6px; min-height:32px; padding:0 11px; border:1px solid var(--le-line); border-radius:999px; background:transparent; color:var(--le-muted); font-size:10.5px; font-weight:650; white-space:nowrap; transition:border-color .18s ease, color .18s ease, background-color .18s ease; }
      .le-export-button:hover:not(:disabled) { color:var(--le-ink); border-color:var(--le-line-strong); background:var(--le-hover); }
      .le-export-button.is-active { color:var(--le-ink); border-color:color-mix(in srgb, var(--le-brand) 28%, var(--le-line)); background:color-mix(in srgb, var(--le-brand) 6%, transparent); }
      .le-export-button:disabled { opacity:.45; }
      .le-export-caret { display:inline-flex; margin-left:-2px; opacity:.55; }
      .le-export-spin { width:12px; height:12px; border:1.6px solid color-mix(in srgb, var(--le-muted) 30%, transparent); border-top-color:var(--le-brand); border-radius:50%; animation:le-rotate .8s linear infinite; }
      .le-export-menu { position:absolute; top:calc(100% + 9px); right:0; z-index:40; width:282px; padding:6px; border:1px solid var(--le-line-strong); border-radius:14px; background:var(--le-overlay); box-shadow:0 24px 65px -24px color-mix(in srgb, var(--le-ink) 35%, transparent); animation:le-pop .18s cubic-bezier(.2,.7,.2,1) both; }
      .le-export-item { display:flex; align-items:flex-start; gap:10px; width:100%; padding:9px 9px; border:0; border-radius:9px; background:transparent; color:var(--le-ink); text-align:left; transition:background-color .16s ease; }
      .le-export-item:hover:not(:disabled) { background:var(--le-hover); }
      .le-export-item:disabled { opacity:.55; }
      .le-export-item-icon { display:grid; place-items:center; flex:none; width:29px; height:29px; border-radius:8px; color:var(--le-brand); background:color-mix(in srgb, var(--le-brand) 8%, transparent); }
      .le-export-item-copy { display:flex; flex-direction:column; gap:2px; min-width:0; }
      .le-export-item-copy strong { font-size:11px; font-weight:680; }
      .le-export-item-copy span { color:var(--le-muted); font-size:9px; line-height:1.4; }
      .le-export-toast { position:fixed; left:50%; bottom:24px; z-index:70; display:flex; align-items:center; gap:8px; max-width:calc(100vw - 32px); padding:9px 14px; transform:translateX(-50%); border:1px solid var(--le-line-strong); border-radius:999px; background:var(--le-overlay); color:var(--le-ink); font-size:10.5px; font-weight:600; box-shadow:0 18px 50px -20px color-mix(in srgb, var(--le-ink) 40%, transparent); animation:le-rise .2s ease both; }
      .le-export-toast-spin { width:12px; height:12px; border:1.6px solid color-mix(in srgb, var(--le-muted) 30%, transparent); border-top-color:var(--le-brand); border-radius:50%; animation:le-rotate .8s linear infinite; }
      .le-new-chat { display:inline-flex; align-items:center; gap:6px; min-height:32px; padding:0 12px; border:1px solid var(--le-line); border-radius:999px; background:var(--le-surface); color:var(--le-ink); font-size:10.5px; font-weight:650; white-space:nowrap; box-shadow:0 1px 2px color-mix(in srgb, var(--le-ink) 5%, transparent); transition:border-color .18s ease, color .18s ease, background-color .18s ease, transform .18s ease; }
      .le-new-chat:hover:not(:disabled) { border-color:var(--le-line-strong); transform:translateY(-1px); }
      .le-new-chat:disabled { opacity:.55; }
      .le-modes { display:inline-flex; align-items:center; gap:2px; flex:none; margin:0; padding:3px; border:1px solid var(--le-line); border-radius:11px; background:color-mix(in srgb, var(--le-surface) 50%, transparent); }
      .le-mode {
        position:relative; display:flex; align-items:center; gap:5px; min-width:0; padding:4px 9px 4px 6px;
        border:1px solid transparent; border-radius:8px; text-align:left;
        background:transparent;
        transition:border-color .18s ease, background-color .18s ease, box-shadow .18s ease;
        overflow:hidden;
      }
      .le-mode:hover:not(:disabled) { background:var(--le-hover); }
      .le-mode:disabled { opacity:.62; }
      .le-mode.is-active { background:var(--le-surface); border-color:color-mix(in srgb, var(--le-brand) 24%, var(--le-line)); box-shadow:0 1px 3px color-mix(in srgb, var(--le-ink) 8%, transparent); }
      .le-mode--polish.is-active { border-color:color-mix(in srgb, var(--le-polish) 28%, var(--le-line)); }
      .le-mode-rail { display:none; }
      .le-mode-icon { display:grid; place-items:center; flex:none; width:22px; height:22px; border-radius:7px; color:var(--le-muted); background:transparent; transition:color .18s ease, background-color .18s ease; }
      .le-mode.is-active .le-mode-icon { color:var(--le-brand); background:color-mix(in srgb, var(--le-brand) 9%, transparent); }
      .le-mode--polish.is-active .le-mode-icon { color:var(--le-polish); background:color-mix(in srgb, var(--le-polish) 9%, transparent); }
      .le-mode-copy { display:flex; flex-direction:column; min-width:0; gap:0; }
      .le-mode-title { display:flex; align-items:baseline; gap:0; flex-wrap:nowrap; }
      .le-mode-title strong { font-family:var(--le-serif); font-size:12.5px; font-weight:600; letter-spacing:-.01em; white-space:nowrap; }
      .le-mode-tag { display:none; }
      .le-mode-desc { display:none; }
      .le-thread {
        flex:1 1 auto; min-height:0; overflow-y:auto; overflow-x:hidden;
        margin:0 -8px; padding:8px 8px 10px; scrollbar-width:thin;
        scrollbar-color:color-mix(in srgb, var(--le-ink) 20%, transparent) transparent;
        overscroll-behavior:contain;
      }
      .le-thread-inner { display:flex; flex-direction:column; width:100%; max-width:796px; min-height:100%; margin:0 auto; padding-top:2px; }
      .le-thread-tail { height:2px; }
      .le-empty { display:flex; flex:1 1 auto; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:clamp(16px, 3vh, 34px) 12px; animation:le-rise .45s cubic-bezier(.2,.7,.2,1) both; }
      .le-empty-mark { display:grid; place-items:center; width:50px; height:50px; margin-bottom:15px; border:1px solid color-mix(in srgb, var(--le-brand) 20%, var(--le-line)); border-radius:16px; color:var(--le-brand); background:color-mix(in srgb, var(--le-brand) 7%, transparent); box-shadow:0 10px 30px -22px color-mix(in srgb, var(--le-brand) 50%, transparent); }
      .le-empty-mark span { font-family:var(--le-serif); font-size:23px; font-weight:600; letter-spacing:-.05em; }
      .le-empty-mark.is-polish { color:var(--le-polish); border-color:color-mix(in srgb, var(--le-polish) 22%, var(--le-line)); background:color-mix(in srgb, var(--le-polish) 7%, transparent); }
      .le-empty-title { margin:0; font-family:var(--le-serif); font-size:clamp(25px, 2.8vw, 31px); line-height:1.18; font-weight:600; letter-spacing:-.035em; }
      .le-empty-body { max-width:520px; margin:10px 0 0; color:var(--le-muted); font-size:12px; line-height:1.75; text-wrap:pretty; }
      .le-sample { width:100%; max-width:560px; margin:19px 0 3px; padding:13px 16px 14px; border:1px solid var(--le-line); border-radius:14px; text-align:left; background:color-mix(in srgb, var(--le-surface) 54%, transparent); }
      .le-sample-label { margin-bottom:8px; color:var(--le-muted); font-size:8.5px; font-weight:720; letter-spacing:.14em; text-transform:uppercase; }
      .le-sample-row { display:flex; align-items:baseline; gap:10px; font-family:var(--le-serif); font-size:13px; line-height:1.6; }
      .le-sample-row + .le-sample-row { margin-top:6px; }
      .le-sample-tag { flex:none; width:42px; color:var(--le-muted); font-family:var(--le-sans); font-size:8.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
      .le-sample-row.is-before { color:color-mix(in srgb, var(--le-muted) 84%, transparent); }
      .le-sample-row.is-after { color:var(--le-ink); }
      .le-sample-row.is-after .le-sample-tag { color:var(--le-polish); }
      .le-prompts { display:flex; flex-wrap:wrap; justify-content:center; gap:7px; width:100%; max-width:620px; margin-top:19px; }
      .le-prompt { display:inline-flex; align-items:center; gap:7px; max-width:100%; min-height:32px; padding:6px 10px 6px 12px; border:1px solid var(--le-line); border-radius:999px; background:color-mix(in srgb, var(--le-surface) 68%, transparent); color:var(--le-muted); font-size:11px; line-height:1.35; text-align:left; transition:color .18s ease, border-color .18s ease, background-color .18s ease, transform .18s ease; }
      .le-prompt > span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .le-prompt svg { flex:none; opacity:.55; }
      .le-prompt:hover { color:var(--le-ink); border-color:color-mix(in srgb, var(--le-brand) 26%, var(--le-line)); background:var(--le-surface); transform:translateY(-1px); }
      .le-msg { animation:le-rise .28s cubic-bezier(.2,.7,.2,1) both; }
      .le-msg + .le-msg { margin-top:26px; }
      .le-msg--user { display:flex; justify-content:flex-end; padding-left:12%; }
      .le-user-wrap { display:flex; flex-direction:column; align-items:flex-end; max-width:min(82%, 650px); }
      .le-user-label { margin:0 6px 4px 0; color:var(--le-muted); font-size:8.5px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; }
      .le-user-bubble { padding:10px 14px; border:1px solid color-mix(in srgb, var(--le-brand) 17%, var(--le-line)); border-radius:17px 17px 5px 17px; color:var(--le-ink); background:color-mix(in srgb, var(--le-brand) 8%, var(--le-surface)); font-size:13.5px; line-height:1.68; white-space:pre-wrap; overflow-wrap:anywhere; }
      .le-user-actions { display:flex; justify-content:flex-end; min-height:18px; margin-top:2px; opacity:0; transition:opacity .18s ease; }
      .le-user-wrap:hover .le-user-actions, .le-user-wrap:focus-within .le-user-actions { opacity:1; }
      .le-msg--assistant { display:grid; grid-template-columns:32px minmax(0, 1fr); gap:12px; align-items:flex-start; }
      .le-avatar { display:grid; place-items:center; width:32px; height:32px; margin-top:1px; border:1px solid color-mix(in srgb, var(--le-brand) 20%, var(--le-line)); border-radius:10px; color:var(--le-brand); background:color-mix(in srgb, var(--le-brand) 7%, var(--le-surface)); font-family:var(--le-serif); font-size:16px; font-weight:600; letter-spacing:-.05em; }
      .le-avatar.is-polish { color:var(--le-polish); border-color:color-mix(in srgb, var(--le-polish) 24%, var(--le-line)); background:color-mix(in srgb, var(--le-polish) 7%, var(--le-surface)); }
      .le-msg-main { min-width:0; }
      .le-msg-head { display:flex; align-items:center; justify-content:space-between; gap:8px 12px; min-height:24px; flex-wrap:wrap; }
      .le-speaker { display:flex; align-items:center; gap:8px; min-height:22px; min-width:0; flex:1 1 auto; flex-wrap:wrap; }
      .le-speaker-name { color:var(--le-ink); font-family:var(--le-serif); font-size:14px; font-weight:600; letter-spacing:-.01em; }
      .le-speaker-role { color:var(--le-muted); font-size:9px; font-weight:650; letter-spacing:.06em; text-transform:uppercase; }
      .le-live-dot { width:5px; height:5px; border-radius:50%; background:var(--le-brand); animation:le-pulse 1.4s ease-out infinite; }
      .le-msg-body { margin-top:2px; }
      .le-prose { color:var(--le-ink); font-family:var(--le-serif); font-size:15.5px; line-height:1.72; letter-spacing:-.003em; overflow-wrap:anywhere; }
      .le-prose p { margin:0 0 9px; }
      .le-prose p:last-child { margin-bottom:0; }
      .le-prose strong { font-weight:650; }
      .le-prose em { font-style:italic; }
      .le-prose code { padding:1px 5px; border:1px solid var(--le-line); border-radius:5px; background:var(--le-soft); font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:.82em; }
      .le-prose pre { margin:9px 0; padding:11px 13px; overflow:auto; border:1px solid var(--le-line); border-radius:10px; background:var(--le-soft); font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:11.5px; line-height:1.55; }
      .le-prose pre code { padding:0; border:0; background:transparent; }
      .le-prose ul, .le-prose ol { margin:4px 0 9px; padding-left:20px; }
      .le-prose li { margin:2px 0; }
      .le-prose h3, .le-prose h4, .le-prose h5, .le-prose h6 { margin:12px 0 5px; font-size:1.02em; font-weight:650; }
      .le-prose blockquote { margin:8px 0; padding:2px 0 2px 12px; border-left:2px solid color-mix(in srgb, var(--le-brand) 32%, var(--le-line)); color:var(--le-muted); }
      .le-polished { position:relative; margin-top:5px; padding:13px 16px 14px; border:1px solid color-mix(in srgb, var(--le-polish) 22%, var(--le-line)); border-radius:14px; background:linear-gradient(135deg, color-mix(in srgb, var(--le-polish) 5%, var(--le-surface)), color-mix(in srgb, var(--le-surface) 82%, transparent)); box-shadow:0 12px 30px -28px color-mix(in srgb, var(--le-polish) 50%, transparent); }
      .le-polished .le-prose { font-size:17px; line-height:1.64; }
      .le-caret { display:inline-block; width:2px; height:.95em; margin-left:2px; border-radius:2px; background:var(--le-brand); vertical-align:-.08em; animation:le-blink 1s steps(2, start) infinite; }
      .le-polished .le-caret { background:var(--le-polish); }
      .le-thinking { display:flex; align-items:center; gap:8px; min-height:24px; margin-top:3px; color:var(--le-muted); font-size:11px; }
      .le-thinking.is-refining { margin-top:9px; color:color-mix(in srgb, var(--le-brand) 72%, var(--le-muted)); }
      .le-dots { display:inline-flex; align-items:center; gap:3px; }
      .le-dots i { width:4px; height:4px; border-radius:50%; background:currentColor; opacity:.35; animation:le-dot 1.15s ease-in-out infinite; }
      .le-dots i:nth-child(2) { animation-delay:.14s; }
      .le-dots i:nth-child(3) { animation-delay:.28s; }
      .le-msg-actions { display:flex; align-items:center; gap:2px; min-height:24px; margin-top:6px; opacity:0; transition:opacity .18s ease; }
      .le-msg:hover .le-msg-actions, .le-msg:focus-within .le-msg-actions { opacity:1; }
      .le-action { display:inline-flex; align-items:center; gap:5px; min-height:24px; padding:0 7px; border:0; border-radius:6px; background:transparent; color:var(--le-muted); font-size:9.5px; font-weight:620; transition:color .16s ease, background-color .16s ease; }
      .le-action:hover { color:var(--le-ink); background:var(--le-hover); }
      .le-msg-note { margin-left:5px; color:var(--le-muted); font-size:9.5px; }
      .le-stopped { display:flex; align-items:center; gap:6px; margin-top:5px; color:var(--le-muted); font-size:11px; }
      .le-error { display:flex; align-items:flex-start; gap:9px; margin-top:10px; padding:10px 12px; border:1px solid color-mix(in srgb, var(--le-error) 25%, var(--le-line)); border-radius:11px; color:var(--le-error); background:color-mix(in srgb, var(--le-error) 5%, transparent); }
      .le-error > svg { flex:none; margin-top:1px; }
      .le-error-copy { display:flex; flex-direction:column; gap:2px; min-width:0; font-size:10.5px; line-height:1.5; }
      .le-error-copy strong { font-size:11px; font-weight:680; }
      .le-error-copy span { color:color-mix(in srgb, var(--le-error) 82%, var(--le-ink)); overflow-wrap:anywhere; }
      .le-error-retry { display:inline-flex; align-items:center; gap:4px; flex:none; margin-left:auto; min-height:26px; padding:0 8px; border:1px solid color-mix(in srgb, var(--le-error) 30%, var(--le-line)); border-radius:7px; background:transparent; color:var(--le-error); font-size:9.5px; font-weight:650; }
      .le-error-retry:hover { background:color-mix(in srgb, var(--le-error) 8%, transparent); }
      .le-voices { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:4px; flex:0 1 auto; margin:0 0 0 auto; }
      .le-voice { position:relative; display:flex; align-items:center; gap:4px; min-width:0; max-width:none; padding:2px 5px 3px 3px; border:1px solid var(--le-line); border-radius:8px; background:color-mix(in srgb, var(--le-surface) 66%, transparent); overflow:hidden; transition:border-color .18s ease, background-color .18s ease; }
      .le-voice:hover { border-color:var(--le-line-strong); background:var(--le-surface); }
      .le-voice.is-playing { border-color:color-mix(in srgb, var(--le-brand) 30%, var(--le-line)); background:color-mix(in srgb, var(--le-brand) 5%, var(--le-surface)); }
      .le-voice.is-error { border-color:color-mix(in srgb, var(--le-error) 24%, var(--le-line)); }
      .le-voice.is-unavailable { opacity:.62; }
      .le-voice-play { display:grid; place-items:center; flex:none; width:21px; height:21px; padding:0; border:0; border-radius:50%; color:var(--le-ink); background:color-mix(in srgb, var(--le-ink) 7%, transparent); transition:background-color .18s ease, color .18s ease, transform .18s ease; }
      .le-voice-play svg { width:11px; height:11px; }
      .le-voice-play:hover:not(:disabled) { background:var(--le-ink); color:var(--le-bg); transform:scale(1.04); }
      .le-voice.is-ready .le-voice-play { background:var(--le-ink); color:var(--le-bg); }
      .le-voice.is-playing .le-voice-play { background:var(--le-brand); color:var(--le-bg); }
      .le-voice.is-error .le-voice-play { color:var(--le-error); background:color-mix(in srgb, var(--le-error) 10%, transparent); }
      .le-voice-copy { display:flex; flex-direction:row; align-items:baseline; gap:4px; min-width:0; padding:0; border:0; background:transparent; text-align:left; }
      .le-voice-name { color:var(--le-ink); font-size:8.5px; font-weight:700; letter-spacing:.03em; line-height:1.2; }
      .le-voice-meta { max-width:78px; color:var(--le-muted); font-size:8px; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .le-voice.is-loading .le-voice-meta { color:color-mix(in srgb, var(--le-brand) 64%, var(--le-muted)); animation:le-fade 1.4s ease-in-out infinite; }
      .le-voice.is-error .le-voice-meta { color:var(--le-error); }
      .le-voice-download { display:grid; place-items:center; flex:none; width:18px; height:18px; margin-left:0; padding:0; border:0; border-radius:4px; background:transparent; color:var(--le-muted); opacity:0; transition:opacity .16s ease, color .16s ease, background-color .16s ease; }
      .le-voice-download svg { width:11px; height:11px; }
      .le-voice:hover .le-voice-download, .le-voice:focus-within .le-voice-download { opacity:1; }
      .le-voice-download:hover { color:var(--le-ink); background:var(--le-hover); }
      .le-voice-progress { position:absolute; left:5px; right:5px; bottom:2px; height:1px; border-radius:2px; background:color-mix(in srgb, var(--le-ink) 8%, transparent); overflow:hidden; }
      .le-voice-progress > span { display:block; height:100%; border-radius:2px; background:var(--le-brand); transition:width .12s linear; }
      .le-voice.is-playing .le-voice-progress > span { background:var(--le-brand); }
      .le-voice-spin { width:10px; height:10px; border:1.5px solid color-mix(in srgb, currentColor 28%, transparent); border-top-color:currentColor; border-radius:50%; animation:le-rotate .8s linear infinite; }
      .le-composer { flex:none; margin-top:9px; padding:8px 10px 8px 14px; border:1px solid var(--le-line-strong); border-radius:18px; background:color-mix(in srgb, var(--le-surface) 88%, transparent); box-shadow:var(--le-shadow); backdrop-filter:blur(16px); transition:border-color .2s ease, box-shadow .2s ease; }
      .le-composer:focus-within { border-color:color-mix(in srgb, var(--le-brand) 38%, var(--le-line-strong)); box-shadow:0 28px 70px -44px color-mix(in srgb, var(--le-ink) 55%, transparent), 0 0 0 3px color-mix(in srgb, var(--le-brand) 7%, transparent); }
      .le-composer textarea { display:block; width:100%; min-height:56px; max-height:168px; padding:7px 2px 3px; border:0; outline:0; resize:none; color:var(--le-ink); background:transparent; font-size:13.5px; line-height:1.62; scrollbar-width:thin; }
      .le-page .le-composer textarea:focus-visible { outline:none; }
      .le-composer textarea::placeholder { color:color-mix(in srgb, var(--le-muted) 78%, transparent); }
      .le-composer-foot { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; padding:2px 1px 0; }
      .le-composer-meta { display:flex; align-items:center; gap:10px; min-width:0; }
      .le-hint { color:color-mix(in srgb, var(--le-muted) 68%, transparent); font-size:8.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .le-composer-buttons { display:flex; align-items:center; gap:6px; flex:none; }
      .le-send { display:grid; place-items:center; flex:none; width:34px; height:34px; padding:0; border:0; border-radius:999px; corner-shape:round; color:var(--dsw-static-neutral-00, var(--le-bg)); background:var(--dsw-alias-button-info-fill, var(--le-brand)); cursor:pointer; transform:translateY(-2px); transition:background-color .1s; }
      .le-send:hover:not(:disabled) { background:var(--dsw-alias-button-info-hover, var(--le-brand)); }
      .le-send:disabled { opacity:.4; cursor:default; }
      .le-send.is-stop { background:var(--dsw-alias-button-info-fill, var(--le-brand)); opacity:1; }
      .le-history-pop { position:absolute; top:calc(100% + 9px); right:0; z-index:30; display:flex; flex-direction:column; gap:12px; width:332px; max-height:min(68vh, 540px); padding:14px; overflow:auto; border:1px solid var(--le-line-strong); border-radius:15px; background:var(--le-overlay); box-shadow:0 24px 65px -24px color-mix(in srgb, var(--le-ink) 35%, transparent); animation:le-pop .18s cubic-bezier(.2,.7,.2,1) both; }
      .le-history-heading { display:flex; align-items:center; gap:8px; }
      .le-history-heading strong { font-family:var(--le-serif); font-size:16px; font-weight:600; letter-spacing:-.02em; }
      .le-history-total { display:grid; place-items:center; min-width:17px; height:17px; padding:0 4px; border-radius:999px; color:var(--le-muted); background:var(--le-soft); font-size:8px; font-weight:700; }
      .le-history-list { display:flex; flex-direction:column; gap:7px; }
      .le-history-item { display:flex; flex-direction:column; gap:5px; width:100%; padding:9px 10px 8px; border:1px solid var(--le-line); border-radius:10px; text-align:left; background:color-mix(in srgb, var(--le-surface) 48%, transparent); transition:border-color .16s ease, background-color .16s ease, transform .16s ease; }
      .le-history-item:hover:not(:disabled) { border-color:color-mix(in srgb, var(--le-brand) 28%, var(--le-line)); background:var(--le-surface); transform:translateY(-1px); }
      .le-history-item:disabled { opacity:.55; }
      .le-history-item-top { display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .le-history-mode { display:inline-flex; align-items:center; gap:4px; color:var(--le-brand); font-size:8px; font-weight:720; letter-spacing:.04em; }
      .le-history-mode.is-polish { color:var(--le-polish); }
      .le-history-mode svg { opacity:.8; }
      .le-history-item time { color:var(--le-muted); font-size:8px; white-space:nowrap; }
      .le-history-preview { display:-webkit-box; overflow:hidden; color:var(--le-ink); font-family:var(--le-serif); font-size:12px; line-height:1.5; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
      .le-history-meta { display:flex; align-items:center; justify-content:space-between; gap:8px; color:var(--le-muted); font-size:8px; }
      .le-history-meta svg { opacity:.5; }
      .le-history-empty { display:flex; flex-direction:column; align-items:center; gap:8px; padding:20px 12px; border:1px dashed var(--le-line); border-radius:10px; color:var(--le-muted); text-align:center; }
      .le-history-empty p { margin:0; font-size:10px; line-height:1.55; }
      .le-history-note { margin:0; color:var(--le-muted); font-size:8.5px; line-height:1.5; }
      .le-pop { position:absolute; top:calc(100% + 9px); right:0; z-index:30; display:flex; flex-direction:column; gap:12px; width:292px; max-height:min(72vh, 590px); padding:14px; overflow:auto; border:1px solid var(--le-line-strong); border-radius:15px; background:var(--le-overlay); box-shadow:0 24px 65px -24px color-mix(in srgb, var(--le-ink) 35%, transparent); animation:le-pop .18s cubic-bezier(.2,.7,.2,1) both; }
      .le-pop-head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
      .le-pop-head strong { font-family:var(--le-serif); font-size:16px; font-weight:600; letter-spacing:-.02em; }
      .le-pop-close { width:26px; height:26px; }
      .le-switch { display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; padding:10px 11px; border:1px solid var(--le-line); border-radius:11px; text-align:left; background:color-mix(in srgb, var(--le-surface) 54%, transparent); }
      .le-switch:hover { border-color:var(--le-line-strong); }
      .le-switch-copy { display:flex; flex-direction:column; gap:2px; min-width:0; }
      .le-switch-copy strong { font-size:10.5px; font-weight:680; }
      .le-switch-copy span { color:var(--le-muted); font-size:9px; line-height:1.4; }
      .le-switch-track { position:relative; flex:none; width:32px; height:18px; border-radius:999px; background:color-mix(in srgb, var(--le-ink) 13%, transparent); transition:background-color .2s ease; }
      .le-switch-track > span { position:absolute; top:2px; left:2px; width:14px; height:14px; border-radius:50%; background:var(--le-surface); box-shadow:0 1px 3px color-mix(in srgb, var(--le-ink) 22%, transparent); transition:transform .2s cubic-bezier(.2,.7,.2,1); }
      .le-switch.is-on .le-switch-track { background:var(--le-brand); }
      .le-switch.is-on .le-switch-track > span { transform:translateX(14px); background:var(--le-bg); }
      .le-field { display:flex; flex-direction:column; gap:6px; }
      .le-field-label { color:var(--le-muted); font-size:8.5px; font-weight:700; letter-spacing:.11em; text-transform:uppercase; }
      .le-select { width:100%; height:32px; padding:0 27px 0 9px; border:1px solid var(--le-line); border-radius:8px; color:var(--le-ink); background:color-mix(in srgb, var(--le-surface) 70%, transparent); font-size:10.5px; appearance:none; background-image:linear-gradient(45deg, transparent 50%, var(--le-muted) 50%), linear-gradient(135deg, var(--le-muted) 50%, transparent 50%); background-position:calc(100% - 13px) 13px, calc(100% - 9px) 13px; background-size:4px 4px, 4px 4px; background-repeat:no-repeat; }
      .le-select:hover { border-color:var(--le-line-strong); }
      .le-select option { color:var(--le-ink); background:var(--le-surface); }
      .le-segment { display:grid; grid-template-columns:repeat(3, 1fr); gap:3px; padding:2px; border:1px solid var(--le-line); border-radius:8px; background:var(--le-soft); }
      .le-segment button { min-height:26px; padding:0 4px; border:0; border-radius:6px; background:transparent; color:var(--le-muted); font-size:9.5px; font-weight:650; transition:color .16s ease, background-color .16s ease, box-shadow .16s ease; }
      .le-segment button:hover { color:var(--le-ink); }
      .le-segment button.is-active { color:var(--le-ink); background:var(--le-surface); box-shadow:0 1px 2px color-mix(in srgb, var(--le-ink) 8%, transparent); }
      .le-engine-list { display:flex; flex-direction:column; gap:6px; }
      .le-engine { display:grid; grid-template-columns:6px minmax(0, 1fr) auto; align-items:center; gap:8px; padding:7px 8px; border:1px solid var(--le-line); border-radius:8px; background:color-mix(in srgb, var(--le-surface) 45%, transparent); }
      .le-engine-dot { width:5px; height:5px; border-radius:50%; background:var(--le-muted); opacity:.55; }
      .le-engine-dot.is-on { background:var(--le-success); opacity:1; }
      .le-engine-dot.is-off { background:var(--le-error); opacity:.8; }
      .le-engine-copy { display:flex; flex-direction:column; gap:1px; min-width:0; }
      .le-engine-copy strong { font-size:9.5px; font-weight:680; }
      .le-engine-copy span { color:var(--le-muted); font-size:8.5px; line-height:1.35; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .le-engine-tag { color:var(--le-muted); font-size:7.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
      .le-model-line { display:flex; align-items:center; justify-content:space-between; gap:10px; padding-top:1px; color:var(--le-muted); font-size:8.5px; font-weight:650; letter-spacing:.05em; text-transform:uppercase; }
      .le-model-line code { max-width:170px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--le-ink); font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:9px; text-transform:none; }
      .le-note { margin:0; color:color-mix(in srgb, var(--le-muted) 80%, transparent); font-size:8.5px; line-height:1.55; }
      .le-sr { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0; }
      @keyframes le-rise { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      @keyframes le-pop { from { opacity:0; transform:translateY(-4px) scale(.985); } to { opacity:1; transform:translateY(0) scale(1); } }
      @keyframes le-blink { 50% { opacity:0; } }
      @keyframes le-rotate { to { transform:rotate(360deg); } }
      @keyframes le-pulse { 0% { box-shadow:0 0 0 0 color-mix(in srgb, currentColor 28%, transparent); } 70% { box-shadow:0 0 0 5px transparent; } 100% { box-shadow:0 0 0 0 transparent; } }
      @keyframes le-dot { 0%, 70%, 100% { opacity:.28; transform:translateY(0); } 35% { opacity:1; transform:translateY(-2px); } }
      @keyframes le-fade { 0%, 100% { opacity:.62; } 50% { opacity:1; } }
      @media (hover:none) {
        .le-msg-actions, .le-user-actions, .le-voice-download { opacity:1; }
      }
      @media (max-width:900px) {
        .le-shell { padding-inline:clamp(16px, 3.2vw, 26px); }
        .le-subtitle { max-width:420px; }
        .le-chip-label { display:none; }
        .le-status-text { display:none; }
        .le-status { width:30px; min-height:30px; justify-content:center; padding:0; }
        .le-export-label, .le-export-caret { display:none; }
        .le-export-button { width:32px; padding:0; justify-content:center; }
      }
      @media (max-width:680px) {
        .le-header { gap:14px; flex-wrap:wrap; }
        .le-brand { width:100%; }
        .le-brand-copy { flex:1 1 auto; }
        .le-brand-subrow { gap:8px; }
        .le-actions { width:100%; justify-content:flex-start; }
        .le-modes { display:flex; width:100%; gap:2px; }
        .le-mode { flex:1 1 0; justify-content:center; padding:5px 8px; gap:6px; }
        .le-mode-icon { width:22px; height:22px; border-radius:7px; }
        .le-mode-title strong { font-size:13px; }
        .le-thread { margin-inline:-4px; padding-inline:4px; }
        .le-user-wrap { max-width:92%; }
        .le-msg--user { padding-left:4%; }
        .le-msg--assistant { grid-template-columns:28px minmax(0, 1fr); gap:9px; }
        .le-avatar { width:28px; height:28px; border-radius:9px; font-size:14px; }
        .le-hint { display:none; }
        .le-composer { padding-left:12px; }
        .le-pop, .le-history-pop, .le-export-menu { position:fixed; top:70px; right:12px; left:12px; width:auto; max-height:70vh; }
      }
      @media (max-width:440px) {
        .le-mark { width:40px; height:40px; border-radius:13px; }
        .le-mark span { font-size:20px; }
        .le-title { font-size:27px; }
        .le-subtitle { font-size:11.5px; }
        .le-status-text { display:none; }
        .le-status { width:30px; min-height:30px; justify-content:center; padding:0; }
        .le-new-chat span { display:none; }
        .le-new-chat { width:32px; min-height:32px; justify-content:center; padding:0; }
        .le-prose { font-size:15px; }
        .le-polished .le-prose { font-size:16px; }
        .le-empty { padding-top:22px; }
        .le-sample { display:none; }
        .le-msg-head { align-items:flex-start; }
      }
      @media (max-height:720px) and (min-width:681px) {
        .le-subtitle { display:none; }
        .le-empty { padding-top:18px; }
        .le-sample { display:none; }
      }
      @media (prefers-reduced-motion:reduce) {
        .le-page *, .le-page *::before, .le-page *::after { animation-duration:.001ms !important; animation-delay:0ms !important; animation-iteration-count:1 !important; transition-duration:.001ms !important; scroll-behavior:auto !important; }
      }
    `

    function LearnEnglishRoot({ localeService }) {
      return h(
        Fragment,
        null,
        h('style', null, styles),
        h(LearnEnglishPage, { localeService }),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, 'en', DICT.en))
        ctx.effect(() => ctx.locale.register(NS, 'zh', DICT.zh))
        ctx.effect(() => ctx.locale.register(NS, 'en-US', DICT.en))
        ctx.effect(() => ctx.locale.register(NS, 'zh-CN', DICT.zh))
        const t = ctx.locale.bind(NS)
        ctx.slots.inject('main', () =>
          ctx.slots.register(
            { name: 'main', key: PANEL_ID },
            () => h(LearnEnglishRoot, { localeService: ctx.locale }),
          ),
        )
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: 25,
              label: () => (t('nav.label') === 'nav.label' ? 'Learn English' : t('nav.label')),
            },
            LearnEnglishIcon,
          ),
        )
      },
    }
  },
})

