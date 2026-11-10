// 极光主题：替换侧栏品牌 + 全应用背景光效，配置入口在「设置 → 外观」。
//
// 结构：
//   1. 调色板 / 效果定义        —— 纯数据，想加效果只加一条
//   2. 设置存储（localStorage） —— 品牌名、标志、背景效果、壁纸、压暗、模糊
//   3. 品牌位                   —— sidebar.brand.mark / sidebar.brand.name
//   4. 设置页                   —— settings.section（id: appearance）+ 导航图标
//   5. 皮肤样式                 —— 全局 <style>，由 body 上的属性驱动
window.__ModuleLoader__.load({
  id: '@local/dsh-aurora',
  factory(require) {
    const { createElement: h, useRef, useSyncExternalStore } = require('react')

    const SOURCE = '@local/dsh-aurora'
    const STORAGE_KEY = '@local/dsh-aurora:v1'
    const SECTION_ID = 'appearance'
    const MAX_IMAGE_CHARS = 4_400_000
    const MAX_UPLOAD_BYTES = 33_554_432
    const WALLPAPER_EDGE = 2560
    const LOGO_EDGE = 256

    /* ── 1. 调色板与效果 ─────────────────────────────────────────────── */

    const STARS = [
      '1.1px 1.1px at 18% 22%, rgb(255 255 255 / .55), transparent 100%',
      '1.4px 1.4px at 72% 14%, rgb(255 255 255 / .45), transparent 100%',
      '1px 1px at 44% 38%, rgb(255 255 255 / .35), transparent 100%',
      '1.2px 1.2px at 86% 46%, rgb(255 255 255 / .40), transparent 100%',
      '1px 1px at 28% 64%, rgb(255 255 255 / .30), transparent 100%',
      '1.3px 1.3px at 62% 78%, rgb(255 255 255 / .38), transparent 100%',
      '1px 1px at 8% 88%, rgb(255 255 255 / .28), transparent 100%',
      '1.1px 1.1px at 92% 84%, rgb(255 255 255 / .32), transparent 100%',
    ].map(dot => `radial-gradient(${dot})`).join(',\n    ')

    const PETALS = [
      '1.6px 1.1px at 16% 18%, rgb(255 208 228 / .55), transparent 100%',
      '1.3px 1.3px at 68% 12%, rgb(255 222 236 / .40), transparent 100%',
      '1.1px 1.5px at 38% 44%, rgb(255 196 222 / .34), transparent 100%',
      '1.5px 1px at 84% 38%, rgb(255 214 232 / .32), transparent 100%',
      '1.2px 1.2px at 24% 72%, rgb(255 200 224 / .26), transparent 100%',
      '1.4px 1.1px at 74% 82%, rgb(255 220 235 / .30), transparent 100%',
    ].map(dot => `radial-gradient(${dot})`).join(',\n    ')

    const FIREFLIES = [
      '1.4px 1.4px at 20% 24%, rgb(198 255 210 / .50), transparent 100%',
      '1.2px 1.2px at 66% 16%, rgb(198 255 210 / .38), transparent 100%',
      '1.6px 1.6px at 42% 46%, rgb(214 255 190 / .34), transparent 100%',
      '1.1px 1.1px at 84% 40%, rgb(198 255 210 / .32), transparent 100%',
      '1.3px 1.3px at 28% 72%, rgb(214 255 190 / .28), transparent 100%',
      '1.2px 1.2px at 76% 82%, rgb(198 255 210 / .30), transparent 100%',
    ].map(dot => `radial-gradient(${dot})`).join(',\n    ')

    const DEEP_STARS = [
      '1.8px 1.8px at 12% 18%, rgb(255 255 255 / .80), transparent 100%',
      '1.2px 1.2px at 28% 8%, rgb(214 232 255 / .55), transparent 100%',
      '1px 1px at 44% 26%, rgb(255 255 255 / .45), transparent 100%',
      '1.5px 1.5px at 58% 12%, rgb(255 236 214 / .60), transparent 100%',
      '1.1px 1.1px at 72% 30%, rgb(214 232 255 / .50), transparent 100%',
      '2px 2px at 86% 16%, rgb(255 255 255 / .70), transparent 100%',
      '1px 1px at 8% 44%, rgb(255 255 255 / .40), transparent 100%',
      '1.3px 1.3px at 34% 56%, rgb(214 232 255 / .42), transparent 100%',
      '1.1px 1.1px at 52% 44%, rgb(255 255 255 / .35), transparent 100%',
      '1.6px 1.6px at 68% 62%, rgb(255 236 214 / .50), transparent 100%',
      '1px 1px at 82% 52%, rgb(214 232 255 / .38), transparent 100%',
      '1.4px 1.4px at 94% 70%, rgb(255 255 255 / .55), transparent 100%',
      '1.1px 1.1px at 18% 76%, rgb(214 232 255 / .34), transparent 100%',
      '1.2px 1.2px at 46% 86%, rgb(255 255 255 / .42), transparent 100%',
      '1.5px 1.5px at 74% 90%, rgb(214 232 255 / .46), transparent 100%',
    ].map(dot => `radial-gradient(${dot})`).join(',\n    ')

    const EFFECTS = {
      aurora: {
        label: '极光',
        light: {
          base: '#eef3fd',
          layers: [
            'radial-gradient(62% 48% at 10% 0%, rgb(122 162 255 / .58), transparent 62%)',
            'radial-gradient(52% 42% at 98% 8%, rgb(208 146 255 / .46), transparent 66%)',
            'radial-gradient(68% 52% at 58% 112%, rgb(84 222 210 / .34), transparent 70%)',
            'linear-gradient(160deg, rgb(255 255 255 / .16), rgb(238 243 253 / .30))',
          ].join(',\n    '),
          grad: ['#2f63d8', '#7c4fd0', '#b4761c'],
          core: '#ffffff',
          name: ['#1e3a8a', '#5b3fb4', '#9a5f16'],
          swatch: 'linear-gradient(135deg, #8fd0ff 0%, #8f6bff 52%, #ffd9a8 100%)',
        },
        dark: {
          base: '#05060d',
          layers: `${STARS},
    radial-gradient(66% 52% at 12% 0%, rgb(62 112 255 / .40), transparent 62%),
    radial-gradient(54% 44% at 96% 10%, rgb(150 78 255 / .30), transparent 68%),
    radial-gradient(70% 54% at 60% 110%, rgb(0 190 210 / .20), transparent 70%),
    linear-gradient(160deg, rgb(13 17 36 / .92), rgb(4 5 10 / .98))`,
          grad: ['#9ec6ff', '#c3a6ff', '#ffd8a3'],
          core: '#0a0c18',
          name: ['#dfeaff', '#b9c8ff', '#d3b6ff', '#ffe0b0'],
          swatch: 'linear-gradient(135deg, #7ec8ff 0%, #9a7bff 50%, #ffd8a3 100%)',
        },
      },
      sakura: {
        label: '夜樱',
        light: {
          base: '#fdf1f5',
          layers: [
            'radial-gradient(58% 46% at 6% 2%, rgb(255 152 194 / .55), transparent 64%)',
            'radial-gradient(52% 42% at 98% 6%, rgb(255 188 154 / .42), transparent 66%)',
            'radial-gradient(64% 50% at 46% 112%, rgb(206 150 255 / .34), transparent 70%)',
            'linear-gradient(165deg, rgb(255 255 255 / .18), rgb(253 236 243 / .30))',
          ].join(',\n    '),
          grad: ['#d94a8f', '#a746c9', '#e08a52'],
          core: '#ffffff',
          name: ['#9c2a5e', '#8b2f9e', '#a85a1f'],
          swatch: 'linear-gradient(135deg, #ffb6d4 0%, #d08cff 55%, #ffd0a8 100%)',
        },
        dark: {
          base: '#0c0410',
          layers: `${PETALS},
    radial-gradient(60% 50% at 8% 0%, rgb(255 86 150 / .28), transparent 62%),
    radial-gradient(50% 42% at 96% 8%, rgb(176 92 255 / .24), transparent 66%),
    radial-gradient(70% 54% at 54% 112%, rgb(255 130 110 / .16), transparent 70%),
    linear-gradient(165deg, rgb(26 8 20 / .94), rgb(8 3 8 / .98))`,
          grad: ['#ffb3d1', '#d9a0ff', '#ffd0a8'],
          core: '#160611',
          name: ['#ffd7e6', '#f0b6ff', '#ffd9c2'],
          swatch: 'linear-gradient(135deg, #ff86b8 0%, #c07bff 55%, #ff9f7a 100%)',
        },
      },
      star: {
        label: '星夜',
        light: {
          base: '#eef3fc',
          layers: [
            'radial-gradient(60% 46% at 12% 0%, rgb(120 158 255 / .40), transparent 64%)',
            'radial-gradient(50% 40% at 92% 6%, rgb(178 148 255 / .34), transparent 66%)',
            'linear-gradient(170deg, rgb(255 255 255 / .18), rgb(238 243 252 / .30))',
          ].join(',\n    '),
          grad: ['#3570d8', '#6b4ad0', '#3a8aa8'],
          core: '#ffffff',
          name: ['#1f3f7d', '#4a3a9c', '#1f6673'],
          swatch: 'linear-gradient(135deg, #a9c8ff 0%, #c3a4ff 52%, #8fe6ff 100%)',
        },
        dark: {
          base: '#03040b',
          layers: `${STARS},
    radial-gradient(64% 48% at 16% 0%, rgb(88 120 255 / .30), transparent 62%),
    radial-gradient(48% 40% at 88% 12%, rgb(190 110 255 / .22), transparent 66%),
    radial-gradient(70% 50% at 50% 112%, rgb(40 90 160 / .26), transparent 70%),
    linear-gradient(170deg, rgb(8 10 22 / .95), rgb(2 3 8 / .99))`,
          grad: ['#a8c8ff', '#cbb0ff', '#9fe8ff'],
          core: '#05060e',
          name: ['#cfe0ff', '#d8c6ff', '#b6f0ff'],
          swatch: 'linear-gradient(135deg, #6f8dff 0%, #b184ff 52%, #62d8f0 100%)',
        },
      },
      starfield: {
        label: '星穹',
        light: {
          base: '#eef0fb',
          layers: [
            'radial-gradient(64% 50% at 8% 0%, rgb(120 120 255 / .40), transparent 62%)',
            'radial-gradient(54% 44% at 96% 10%, rgb(220 140 255 / .30), transparent 66%)',
            'radial-gradient(70% 54% at 56% 112%, rgb(80 180 255 / .24), transparent 70%)',
            'linear-gradient(165deg, rgb(255 255 255 / .14), rgb(238 240 251 / .28))',
          ].join(',\n    '),
          grad: ['#4a5ad8', '#8a4fd0', '#2f8ab0'],
          core: '#ffffff',
          name: ['#2b3a8a', '#5b3fb4', '#1f6f8a'],
          swatch: 'linear-gradient(135deg, #c9d4ff 0%, #c08fff 48%, #7fe6ff 100%)',
        },
        dark: {
          base: '#02030a',
          layers: `${DEEP_STARS},
    radial-gradient(68% 54% at 10% 0%, rgb(92 104 255 / .34), transparent 62%),
    radial-gradient(56% 46% at 96% 8%, rgb(196 96 255 / .26), transparent 66%),
    radial-gradient(70% 54% at 54% 112%, rgb(40 150 210 / .24), transparent 70%),
    linear-gradient(115deg, rgb(0 0 0 / 0) 26%, rgb(126 96 255 / .18) 46%, rgb(86 200 255 / .12) 58%, rgb(0 0 0 / 0) 74%),
    linear-gradient(170deg, rgb(6 8 20 / .96), rgb(1 2 6 / .99))`,
          grad: ['#cfe0ff', '#e0c2ff', '#9fe8ff'],
          core: '#02040c',
          name: ['#e8f0ff', '#d8c8ff', '#b6f0ff'],
          swatch: 'linear-gradient(135deg, #7c8dff 0%, #a86bff 48%, #5fd8ff 100%)',
        },
      },
      gilded: {
        label: '鎏金',
        light: {
          base: '#fbf6ec',
          layers: [
            'radial-gradient(52% 40% at 8% 0%, rgb(240 192 110 / .48), transparent 64%)',
            'radial-gradient(46% 38% at 96% 10%, rgb(214 152 100 / .34), transparent 66%)',
            'conic-gradient(from 210deg at 50% 120%, rgb(255 220 150 / .30), rgb(255 255 255 / 0) 40%, rgb(206 158 84 / .22) 70%, rgb(255 255 255 / 0))',
            'linear-gradient(165deg, rgb(255 253 248 / .20), rgb(250 244 234 / .30))',
          ].join(',\n    '),
          grad: ['#a9761f', '#c9a24a', '#8a5a12'],
          core: '#fffdf8',
          name: ['#6d4610', '#9a7220', '#5c3a08'],
          swatch: 'linear-gradient(135deg, #ffe2ab 0%, #d8a950 52%, #8f6420 100%)',
        },
        dark: {
          base: '#0a0805',
          layers: [
            'radial-gradient(56% 44% at 10% 0%, rgb(196 140 60 / .28), transparent 62%)',
            'radial-gradient(48% 40% at 94% 8%, rgb(120 84 40 / .34), transparent 66%)',
            'conic-gradient(from 200deg at 50% 120%, rgb(255 206 120 / .16), rgb(0 0 0 / 0) 38%, rgb(190 132 64 / .16) 72%, rgb(0 0 0 / 0))',
            'linear-gradient(165deg, rgb(16 12 8 / .96), rgb(4 4 4 / .99))',
          ].join(',\n    '),
          grad: ['#ffd79a', '#f0c070', '#d99a4a'],
          core: '#0b0805',
          name: ['#ffe6bd', '#f3cf92', '#dcae6a'],
          swatch: 'linear-gradient(135deg, #f7d089 0%, #c79a45 52%, #6b4a1c 100%)',
        },
      },
      bamboo: {
        label: '青竹',
        light: {
          base: '#edf4ec',
          layers: [
            'radial-gradient(60% 46% at 8% 0%, rgb(126 196 150 / .42), transparent 64%)',
            'radial-gradient(50% 40% at 96% 8%, rgb(168 208 120 / .30), transparent 66%)',
            'radial-gradient(66% 50% at 52% 112%, rgb(96 190 176 / .22), transparent 70%)',
            'linear-gradient(165deg, rgb(255 255 255 / .18), rgb(237 246 235 / .30))',
          ].join(',\n    '),
          grad: ['#2f7d5a', '#4f9a6a', '#1f5f4a'],
          core: '#ffffff',
          name: ['#1e5c40', '#2f7d5a', '#17604f'],
          swatch: 'linear-gradient(135deg, #cfeedd 0%, #8fd3a8 52%, #6bbf9a 100%)',
        },
        dark: {
          base: '#040d08',
          layers: `${FIREFLIES},
    radial-gradient(62% 50% at 10% 0%, rgb(40 150 100 / .34), transparent 62%),
    radial-gradient(50% 42% at 94% 10%, rgb(90 180 120 / .24), transparent 66%),
    radial-gradient(70% 54% at 56% 112%, rgb(20 120 110 / .28), transparent 70%),
    linear-gradient(165deg, rgb(8 22 16 / .95), rgb(2 6 4 / .99))`,
          grad: ['#9be8b6', '#7fd6a0', '#d9f7e3'],
          core: '#04100a',
          name: ['#d9f7e3', '#b6ecc9', '#e8fff0'],
          swatch: 'linear-gradient(135deg, #6fe0a8 0%, #3fa87a 52%, #1f6f5a 100%)',
        },
      },
      ink: {
        label: '墨笺',
        light: {
          base: '#f5f1e6',
          layers: [
            'radial-gradient(58% 44% at 6% 0%, rgb(120 150 120 / .26), transparent 64%)',
            'radial-gradient(50% 40% at 96% 6%, rgb(196 168 120 / .22), transparent 66%)',
            'radial-gradient(66% 52% at 54% 112%, rgb(70 110 90 / .16), transparent 70%)',
            'linear-gradient(165deg, rgb(255 253 245 / .30), rgb(245 241 230 / .38))',
          ].join(',\n    '),
          grad: ['#3d5c46', '#5c7a52', '#7a6136'],
          core: '#fffdf6',
          name: ['#2b4433', '#3f5c46', '#5c4a24'],
          swatch: 'linear-gradient(135deg, #e8f0e0 0%, #b9c9a4 52%, #d8c79a 100%)',
        },
        dark: {
          base: '#080b08',
          layers: [
            'radial-gradient(60% 48% at 10% 0%, rgb(64 110 88 / .34), transparent 62%)',
            'radial-gradient(50% 42% at 94% 8%, rgb(120 96 60 / .22), transparent 66%)',
            'radial-gradient(70% 54% at 54% 112%, rgb(40 70 60 / .30), transparent 70%)',
            'linear-gradient(165deg, rgb(12 16 12 / .96), rgb(4 6 4 / .99))',
          ].join(',\n    '),
          grad: ['#a8c8a8', '#c9b98a', '#e0d6b8'],
          core: '#080c08',
          name: ['#e4ecd8', '#d8c9a0', '#c0e0c8'],
          swatch: 'linear-gradient(135deg, #9fbc96 0%, #6d8a5c 52%, #b09a63 100%)',
        },
      },
      mist: {
        label: '雾白',
        light: {
          base: '#f5f7fa',
          layers: [
            'radial-gradient(60% 50% at 20% 0%, rgb(255 255 255 / .90), transparent 70%)',
            'radial-gradient(50% 40% at 90% 10%, rgb(226 233 244 / .80), transparent 68%)',
            'linear-gradient(170deg, rgb(248 250 253 / .90), rgb(238 242 248 / .92))',
          ].join(',\n    '),
          grad: ['#4a5a72', '#6b7280', '#3f4a5a'],
          core: '#ffffff',
          name: ['#33415a', '#4d5768', '#2b3442'],
          swatch: 'linear-gradient(135deg, #eef2f8 0%, #c9d3e0 52%, #9aa7b8 100%)',
        },
        dark: {
          base: '#0b0c10',
          layers: [
            'radial-gradient(60% 50% at 18% 0%, rgb(42 48 62 / .70), transparent 70%)',
            'radial-gradient(48% 40% at 92% 10%, rgb(30 34 46 / .70), transparent 68%)',
            'linear-gradient(170deg, rgb(18 20 26 / .96), rgb(9 10 14 / .98))',
          ].join(',\n    '),
          grad: ['#c8d0dc', '#aab4c4', '#dbe2ea'],
          core: '#0a0b0f',
          name: ['#d6dde8', '#bcc6d4', '#e7edf4'],
          swatch: 'linear-gradient(135deg, #6b7484 0%, #8f99a8 52%, #c3ccd8 100%)',
        },
      },
    }

    const MARK_OPTIONS = [
      { id: 'spark', label: '星芒' },
      { id: 'sakura', label: '樱花' },
      { id: 'torii', label: '鸟居' },
    ]

    const DEFAULT_SETTINGS = {
      name: 'Aurora',
      mark: 'spark',
      logo: '',
      effect: 'aurora',
      wallpaper: '',
      dim: 0.42,
      blur: 0,
    }

    /* ── 2. 存储与工具 ───────────────────────────────────────────────── */

    function isImageValue(value) {
      return typeof value === 'string'
        && value.length <= MAX_IMAGE_CHARS
        && (/^data:image\//i.test(value) || /^https?:\/\//i.test(value))
    }

    function cssUrl(value) {
      return `url("${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, '')}")`
    }

    function clamp(value, min, max, fallback) {
      const number = Number(value)
      if (!Number.isFinite(number)) return fallback
      return Math.min(max, Math.max(min, number))
    }

    function normalize(raw) {
      const s = raw && typeof raw === 'object' ? raw : {}
      const name = typeof s.name === 'string'
        ? Array.from(s.name.replace(/[\r\n\t]+/g, ' ')).slice(0, 24).join('')
        : DEFAULT_SETTINGS.name
      const mark = s.mark === 'custom' || MARK_OPTIONS.some(option => option.id === s.mark)
        ? s.mark
        : DEFAULT_SETTINGS.mark
      return {
        name,
        mark,
        logo: isImageValue(s.logo) ? s.logo : '',
        effect: Object.prototype.hasOwnProperty.call(EFFECTS, s.effect) ? s.effect : DEFAULT_SETTINGS.effect,
        wallpaper: isImageValue(s.wallpaper) ? s.wallpaper : '',
        dim: clamp(s.dim, 0, 0.85, DEFAULT_SETTINGS.dim),
        blur: Math.round(clamp(s.blur, 0, 24, DEFAULT_SETTINGS.blur)),
      }
    }

    function readSettings() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw === null) return { ...DEFAULT_SETTINGS }
        return normalize(JSON.parse(raw))
      } catch {
        return { ...DEFAULT_SETTINGS }
      }
    }

    function createStore(initial) {
      let value = initial
      const listeners = new Set()
      return {
        get: () => value,
        set(next) {
          value = next
          for (const listener of listeners) listener()
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
      }
    }

    const settingsStore = createStore(readSettings())
    const noticeStore = createStore('')
    let lastSaved = ''

    function persist(settings) {
      const serialized = JSON.stringify(settings)
      if (serialized === lastSaved) return
      lastSaved = serialized
      try {
        localStorage.setItem(STORAGE_KEY, serialized)
      } catch {
        noticeStore.set('这次没能保存到本机（存储空间不足），设置仍然生效。')
      }
    }

    function updateSettings(patch) {
      const next = normalize({ ...settingsStore.get(), ...patch })
      settingsStore.set(next)
      persist(next)
    }

    function useSettings() {
      return useSyncExternalStore(settingsStore.subscribe, settingsStore.get, settingsStore.get)
    }

    function useNotice() {
      return useSyncExternalStore(noticeStore.subscribe, noticeStore.get, noticeStore.get)
    }

    function compressImage(file, maxEdge, quality) {
      return createImageBitmap(file).then(bitmap => {
        const edge = Math.max(bitmap.width, bitmap.height)
        const scale = edge > maxEdge ? maxEdge / edge : 1
        const width = Math.max(1, Math.round(bitmap.width * scale))
        const height = Math.max(1, Math.round(bitmap.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = 'high'
        context.drawImage(bitmap, 0, 0, width, height)
        if (typeof bitmap.close === 'function') bitmap.close()
        return canvas.toDataURL('image/webp', quality)
      })
    }

    function chooseImage(onPick, plan) {
      const attempts = plan && plan.length
        ? plan
        : [{ maxEdge: WALLPAPER_EDGE, quality: 0.86 }, { maxEdge: 1920, quality: 0.8 }, { maxEdge: 1600, quality: 0.72 }]
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif,image/svg+xml'
      input.addEventListener('change', () => {
        const file = input.files && input.files[0]
        if (!file) return
        if (file.size > MAX_UPLOAD_BYTES) {
          noticeStore.set('图片超过 32 MB，请换一张小一点的。')
          return
        }
        noticeStore.set('正在处理图片…')
        let index = 0
        const attempt = () => compressImage(file, attempts[index].maxEdge, attempts[index].quality).then(result => {
          if (isImageValue(result) || index === attempts.length - 1) return result
          index += 1
          return attempt()
        })
        attempt().then(result => {
          if (!isImageValue(result)) {
            noticeStore.set('这个文件不是可用的图片。')
            return
          }
          noticeStore.set('')
          onPick(result)
        }, () => noticeStore.set('这张图片无法读取，换一张试试。'))
      })
      input.click()
    }

    /* ── 3. 标志图形 ─────────────────────────────────────────────────── */

    function markShape(name, paint) {
      const stroke = { stroke: paint, strokeWidth: 1.6, strokeLinecap: 'round', fill: 'none' }
      if (name === 'sakura') {
        const petals = [0, 72, 144, 216, 288].map(angle => h('ellipse', {
          key: angle,
          cx: 12,
          cy: 7.4,
          rx: 2.7,
          ry: 4.2,
          transform: `rotate(${angle} 12 12)`,
          fill: paint,
          fillOpacity: 0.9,
        }))
        return h('g', null, petals, h('circle', { cx: 12, cy: 12, r: 1.7, fill: 'var(--aurora-core)' }))
      }
      if (name === 'torii') {
        return h('g', null,
          h('path', { d: 'M3.4 6.2c2.9.9 5.7 1.3 8.6 1.3s5.7-.4 8.6-1.3', ...stroke }),
          h('path', { d: 'M5.2 9.6c2.2.6 4.5.9 6.8.9s4.6-.3 6.8-.9', ...stroke }),
          h('path', { d: 'M8.1 10.5 7.2 20M15.9 10.5l.9 9.5M4.9 20h14.2', ...stroke }),
          h('path', { d: 'M12 7.5v2.1', ...stroke }))
      }
      return h('g', null,
        h('path', {
          d: 'M12 2.4c.4 3.7 1.8 5.7 4.9 7.2 1 .5 2.1.9 3.3 1.2-2.8.8-4.6 1.9-5.8 4-.8 1.3-1.4 2.8-1.9 4.6-.5-1.8-1.1-3.3-1.9-4.6-1.3-2.1-3.1-3.2-5.8-4 1.2-.3 2.3-.7 3.3-1.2 3.1-1.5 4.5-3.5 4.9-7.2Z',
          fill: paint,
        }),
        h('circle', { cx: 18.6, cy: 5.4, r: 1.15, fill: paint, fillOpacity: 0.9 }),
        h('path', {
          d: 'M17.4 12.6c1.5.5 2.5 1.4 3 2.9',
          stroke: paint,
          strokeWidth: 1.2,
          strokeLinecap: 'round',
          fill: 'none',
          opacity: 0.55,
        }))
    }

    const GRADIENT_ID = 'dsh-aurora-mark-gradient'

    function BrandMark({ size = 24 }) {
      const settings = useSettings()
      if (settings.logo) {
        return h('img', {
          className: 'dsh-aurora-mark dsh-aurora-logo',
          src: settings.logo,
          width: size,
          height: size,
          alt: '',
          'aria-hidden': true,
          style: { width: `${size}px`, height: `${size}px` },
        })
      }
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        className: 'dsh-aurora-mark',
        'aria-hidden': true,
        focusable: 'false',
      },
      h('defs', null,
        h('linearGradient', {
          id: GRADIENT_ID,
          x1: '3',
          y1: '2',
          x2: '21',
          y2: '22',
          gradientUnits: 'userSpaceOnUse',
        },
        h('stop', { offset: '0', stopColor: 'var(--aurora-grad-1)' }),
        h('stop', { offset: '0.52', stopColor: 'var(--aurora-grad-2)' }),
        h('stop', { offset: '1', stopColor: 'var(--aurora-grad-3)' }))),
      markShape(settings.mark === 'custom' ? 'spark' : settings.mark, `url(#${GRADIENT_ID})`))
    }

    function BrandName() {
      const settings = useSettings()
      return h('span', { className: 'dsh-aurora-name' }, settings.name || DEFAULT_SETTINGS.name)
    }

    /* ── 4. 设置页 ───────────────────────────────────────────────────── */

    function AuroraIcon({ size = 16, active = false }) {
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: active ? 'var(--aurora-grad-2)' : 'currentColor',
        strokeWidth: 1.6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
      },
      h('path', { d: 'M12 3.2c.3 3.4 1.5 5 4.2 6.2.9.4 1.9.7 2.9.9-2.3.7-3.8 1.6-4.8 3.3-.6 1-1.1 2.2-1.5 3.6-.4-1.4-.9-2.6-1.5-3.6-1-1.7-2.5-2.6-4.8-3.3 1-.2 2-.5 2.9-.9 2.7-1.2 3.9-2.8 4.2-6.2Z' }),
      h('path', { d: 'M18.6 15.4v3.2M17 17h3.2' }))
    }

    function Swatch({ effectId }) {
      return h('span', {
        className: 'dsh-aurora-swatch',
        'data-effect': effectId,
        'aria-hidden': true,
      })
    }

    function Tile({ active, label, onClick, glyph }) {
      return h('button', {
        type: 'button',
        className: 'dsh-aurora-tile',
        'aria-pressed': active ? 'true' : 'false',
        onClick,
      }, glyph, h('span', { className: 'dsh-aurora-tile-label' }, label))
    }

    function Row({ label, hint, children }) {
      return h('div', { className: 'dsh-aurora-row' },
        h('div', { className: 'dsh-aurora-row-label' },
          h('span', null, label),
          hint ? h('span', { className: 'dsh-aurora-row-hint' }, hint) : null),
        h('div', { className: 'dsh-aurora-row-control' }, children))
    }

    /**
     * One-line horizontal strip: no wrapping and no visible scrollbar, so an
     * overflowing row is dragged left/right with the pointer instead. A plain
     * click (no movement) still selects the tile.
     */
    function Rail({ label, children }) {
      const railRef = useRef(null)
      const drag = useRef(null)
      const suppressClick = useRef(false)

      const stop = event => {
        const rail = railRef.current
        const state = drag.current
        if (!rail || !state || state.id !== event.pointerId) return
        if (state.captured && rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId)
        rail.classList.remove('is-dragging')
        suppressClick.current = state.moved > 4
        drag.current = null
      }

      return h('div', {
        ref: railRef,
        className: 'dsh-aurora-rail',
        role: 'group',
        'aria-label': label,
        onPointerDown: event => {
          if (event.button !== 0 || !railRef.current) return
          drag.current = { id: event.pointerId, x: event.clientX, left: railRef.current.scrollLeft, moved: 0, captured: false }
          suppressClick.current = false
        },
        onPointerMove: event => {
          const rail = railRef.current
          const state = drag.current
          if (!rail || !state || state.id !== event.pointerId) return
          const dx = event.clientX - state.x
          state.moved = Math.max(state.moved, Math.abs(dx))
          if (state.moved <= 3) return
          if (!state.captured) {
            state.captured = true
            rail.classList.add('is-dragging')
            try { rail.setPointerCapture(event.pointerId) } catch { /* capture is a nicety */ }
          }
          rail.scrollLeft = state.left - dx
        },
        onPointerUp: stop,
        onPointerCancel: stop,
        onClickCapture: event => {
          if (!suppressClick.current) return
          suppressClick.current = false
          event.preventDefault()
          event.stopPropagation()
        },
      }, children)
    }

    function ThemeSettings() {
      const settings = useSettings()
      const notice = useNotice()
      const dimPercent = Math.round(settings.dim * 100)
      const customLogo = settings.mark === 'custom'

      const markTiles = MARK_OPTIONS.map(option => h(Tile, {
        key: option.id,
        active: !customLogo && settings.mark === option.id,
        label: option.label,
        onClick: () => updateSettings({ mark: option.id }),
        glyph: h('svg', {
          className: 'dsh-aurora-tile-mark',
          width: 17,
          height: 17,
          viewBox: '0 0 24 24',
          'aria-hidden': true,
        }, markShape(option.id, 'currentColor')),
      }))

      markTiles.push(h(Tile, {
        key: 'custom',
        active: customLogo,
        label: '图片',
        onClick: () => {
          if (settings.logo) updateSettings({ mark: 'custom' })
          else chooseImage(value => updateSettings({ logo: value, mark: 'custom' }), [{ maxEdge: LOGO_EDGE, quality: 0.9 }])
        },
        glyph: h('svg', {
          className: 'dsh-aurora-tile-mark',
          width: 17,
          height: 17,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          'aria-hidden': true,
        },
        h('rect', { x: 3.5, y: 5, width: 17, height: 14, rx: 3 }),
        h('circle', { cx: 9, cy: 10, r: 1.4 }),
        h('path', { d: 'm6 17 4.2-4.2 3 3L16 11l2 2', strokeLinecap: 'round', strokeLinejoin: 'round' })),
      }))

      const effectTiles = Object.keys(EFFECTS).map(effectId => h(Tile, {
        key: effectId,
        active: settings.effect === effectId,
        label: EFFECTS[effectId].label,
        onClick: () => updateSettings({ effect: effectId }),
        glyph: h(Swatch, { effectId }),
      }))

      return h('div', { className: 'dsh-aurora-page' },
        h('header', { className: 'dsh-aurora-page-head' },
          h('h2', { className: 'dsh-aurora-page-title' }, '外观与背景'),
          h('p', { className: 'dsh-aurora-page-hint' },
            '替换侧栏左上角的品牌文字与标志，并用光效或自己的图片重绘整个应用背景。修改立即生效，保存在本机。')),

        h('section', { className: 'dsh-aurora-section' },
          h('h3', { className: 'dsh-aurora-section-title' }, '品牌'),
          h(Row, { label: '名称', hint: '最多 24 个字符' },
            h('input', {
              className: 'dsh-aurora-input',
              type: 'text',
              value: settings.name,
              maxLength: 24,
              spellCheck: false,
              placeholder: DEFAULT_SETTINGS.name,
              onChange: event => updateSettings({ name: event.target.value }),
            })),
          h(Row, { label: '标志', hint: '也可以上传一张图片' },
            h(Rail, { label: '标志样式' }, markTiles)),
          h(Row, { label: '自定义标志' },
            settings.logo
              ? h('div', { className: 'dsh-aurora-inline' },
                h('img', { className: 'dsh-aurora-thumb', src: settings.logo, alt: '' }),
                h('span', { className: 'dsh-aurora-inline-text' }, '已使用上传的图片'),
                h('button', {
                  type: 'button',
                  className: 'dsh-aurora-link',
                  onClick: () => updateSettings({ logo: '', mark: 'spark' }),
                }, '清除'))
              : h('button', {
                type: 'button',
                className: 'dsh-aurora-wide',
                onClick: () => chooseImage(value => updateSettings({ logo: value, mark: 'custom' }), [{ maxEdge: LOGO_EDGE, quality: 0.9 }]),
              }, '选择本地图片'))),

        h('section', { className: 'dsh-aurora-section' },
          h('h3', { className: 'dsh-aurora-section-title' }, '背景'),
          h(Row, { label: '光效', hint: '明暗主题各有一套配色' },
            h(Rail, { label: '背景光效' }, effectTiles)),
          h(Row, { label: '壁纸', hint: '本地图片，自动压缩' },
            h('div', { className: 'dsh-aurora-inline' },
              settings.wallpaper
                ? h('img', { className: 'dsh-aurora-thumb', src: settings.wallpaper, alt: '' })
                : h('span', { className: 'dsh-aurora-thumb dsh-aurora-thumb-empty', 'aria-hidden': true }),
              h('span', { className: 'dsh-aurora-inline-text' },
                settings.wallpaper ? '已设置自定义壁纸' : '未设置，使用上方光效'),
              h('div', { className: 'dsh-aurora-inline-actions' },
                h('button', {
                  type: 'button',
                  className: 'dsh-aurora-link',
                  onClick: () => chooseImage(value => updateSettings({ wallpaper: value })),
                }, settings.wallpaper ? '更换' : '上传'),
                settings.wallpaper
                  ? h('button', {
                    type: 'button',
                    className: 'dsh-aurora-link',
                    onClick: () => updateSettings({ wallpaper: '' }),
                  }, '清除')
                  : null))),
          h(Row, { label: '压暗', hint: '壁纸较亮时调高' },
            h('div', { className: 'dsh-aurora-slider' },
              h('input', {
                type: 'range',
                min: 0,
                max: 0.85,
                step: 0.01,
                value: settings.dim,
                'aria-label': '压暗',
                onChange: event => updateSettings({ dim: Number(event.target.value) }),
              }),
              h('output', null, `${dimPercent}%`))),
          h(Row, { label: '模糊', hint: '只模糊背景层' },
            h('div', { className: 'dsh-aurora-slider' },
              h('input', {
                type: 'range',
                min: 0,
                max: 24,
                step: 1,
                value: settings.blur,
                'aria-label': '模糊',
                onChange: event => updateSettings({ blur: Number(event.target.value) }),
              }),
              h('output', null, `${settings.blur}px`)))),

        h('footer', { className: 'dsh-aurora-page-foot' },
          h('button', {
            type: 'button',
            className: 'dsh-aurora-wide dsh-aurora-wide-inline',
            onClick: () => {
              settingsStore.set({ ...DEFAULT_SETTINGS })
              persist(settingsStore.get())
              noticeStore.set('')
            },
          }, '恢复默认'),
          h('span', { className: 'dsh-aurora-notice' }, notice)))
    }

    /* ── 5. 皮肤样式 ─────────────────────────────────────────────────── */

    const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>"
      + "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/>"
      + "<feColorMatrix type='saturate' values='0'/></filter>"
      + "<rect width='160' height='160' filter='url(#n)' opacity='.55'/></svg>",
    )}")`

    function paletteRules() {
      return Object.entries(EFFECTS).map(([id, effect]) => {
        const rule = (selector, palette) => `${selector} {
  --aurora-base: ${palette.base};
  --aurora-layers: ${palette.layers};
  --aurora-grad-1: ${palette.grad[0]};
  --aurora-grad-2: ${palette.grad[1]};
  --aurora-grad-3: ${palette.grad[2]};
  --aurora-core: ${palette.core};
  --aurora-name-image: linear-gradient(100deg, ${palette.name.join(', ')});
}`
        return `${rule(`body[data-dsh-aurora-effect="${id}"]`, effect.light)}
${rule(`body[data-ds-dark-theme][data-dsh-aurora-effect="${id}"]`, effect.dark)}`
      }).join('\n')
    }

    function swatchRules() {
      return Object.entries(EFFECTS).map(([id, effect]) => `
.dsh-aurora-swatch[data-effect="${id}"] { background-image: ${effect.light.swatch}; }
body[data-ds-dark-theme] .dsh-aurora-swatch[data-effect="${id}"] { background-image: ${effect.dark.swatch}; }`).join('\n')
    }

    function buildCss() {
      return `
/* ── dsh-aurora: palette ───────────────────────────────────────────── */
:root {
  --aurora-base: ${EFFECTS.aurora.light.base};
  --aurora-layers: ${EFFECTS.aurora.light.layers};
  --aurora-grad-1: ${EFFECTS.aurora.light.grad[0]};
  --aurora-grad-2: ${EFFECTS.aurora.light.grad[1]};
  --aurora-grad-3: ${EFFECTS.aurora.light.grad[2]};
  --aurora-core: #ffffff;
  --aurora-name-image: linear-gradient(100deg, ${EFFECTS.aurora.light.name.join(', ')});
}

${paletteRules()}

${swatchRules()}

/* ── dsh-aurora: brand ─────────────────────────────────────────────── */
.dsh-aurora-mark {
  display: block;
  overflow: visible;
  flex: none;
  filter: drop-shadow(0 0 5px rgb(126 166 255 / .45));
}

.dsh-aurora-logo {
  border-radius: 7px;
  object-fit: cover;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / .12);
}

.dsh-aurora-name {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--dsw-font-family-brand, var(--dsw-font-family, sans-serif));
  font-size: 15px;
  font-weight: 500;
  line-height: 1.15;
  letter-spacing: .09em;
  background-image: var(--aurora-name-image);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
}

body[data-ds-dark-theme] .dsh-aurora-mark {
  filter: drop-shadow(0 0 6px rgb(150 186 255 / .5));
}

/* ── dsh-aurora: settings page ─────────────────────────────────────── */
.dsh-aurora-page {
  display: grid;
  gap: 22px;
  max-width: 720px;
  padding: 2px 0 28px;
  color: var(--dsw-alias-label-primary, #111);
  font-size: 13px;
}

.dsh-aurora-page-head { display: grid; gap: 6px; }

.dsh-aurora-page-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: .01em;
}

.dsh-aurora-page-hint {
  margin: 0;
  max-width: 56ch;
  color: var(--dsw-alias-label-secondary, #666);
  font-size: 12.5px;
  line-height: 1.6;
}

.dsh-aurora-section { display: grid; gap: 14px; }

.dsh-aurora-section-title {
  margin: 0;
  font-size: 11.5px;
  font-weight: 650;
  letter-spacing: .09em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-secondary, #777);
}

.dsh-aurora-row {
  display: grid;
  grid-template-columns: minmax(96px, 148px) minmax(0, 1fr);
  align-items: start;
  gap: 8px 18px;
}

.dsh-aurora-row-label {
  display: grid;
  gap: 2px;
  padding-top: 5px;
  color: var(--dsw-alias-label-primary, #111);
  font-size: 12.5px;
}

.dsh-aurora-row-hint {
  color: var(--dsw-alias-label-secondary, #888);
  font-size: 11px;
  line-height: 1.45;
}

.dsh-aurora-row-control { min-width: 0; }

.dsh-aurora-input {
  width: 100%;
  max-width: 320px;
  box-sizing: border-box;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--dsw-alias-border-l1, rgb(0 0 0 / .12));
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1, rgb(255 255 255 / .7));
  color: var(--dsw-alias-label-primary, #111);
  font: inherit;
  font-size: 13px;
}

.dsh-aurora-input:focus {
  outline: 2px solid color-mix(in srgb, var(--dsw-alias-brand-primary, #4d6bfe) 55%, transparent);
  outline-offset: 0;
}

.dsh-aurora-rail {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 1px;
  scrollbar-width: none;
  -ms-overflow-style: none;
  overscroll-behavior-x: contain;
  touch-action: pan-y;
  user-select: none;
  cursor: grab;
}

.dsh-aurora-rail::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.dsh-aurora-rail.is-dragging { cursor: grabbing; }

.dsh-aurora-rail .dsh-aurora-tile { flex: none; }

.dsh-aurora-tile {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 56px;
  padding: 7px 9px 6px;
  border: 1px solid var(--dsw-alias-border-l1, rgb(0 0 0 / .1));
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1, rgb(255 255 255 / .6));
  color: var(--dsw-alias-label-secondary, #666);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: border-color .14s ease, color .14s ease, box-shadow .14s ease;
}

.dsh-aurora-tile:hover { color: var(--dsw-alias-label-primary, #111); }

.dsh-aurora-tile[aria-pressed="true"] {
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary, #4d6bfe) 60%, transparent);
  color: var(--dsw-alias-label-primary, #111);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-brand-primary, #4d6bfe) 16%, transparent);
}

.dsh-aurora-tile-mark { display: block; width: 17px; height: 17px; }

.dsh-aurora-swatch {
  display: block;
  width: 36px;
  height: 20px;
  border-radius: 5px;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / .22);
}

.dsh-aurora-tile-label { font-size: 10.5px; line-height: 1; }

.dsh-aurora-wide,
.dsh-aurora-link {
  font: inherit;
  cursor: pointer;
}

.dsh-aurora-wide {
  height: 30px;
  padding: 0 14px;
  border: 1px dashed var(--dsw-alias-border-l2, rgb(0 0 0 / .18));
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #666);
  font-size: 12px;
}

.dsh-aurora-wide:hover {
  color: var(--dsw-alias-label-primary, #111);
  border-color: var(--dsw-alias-brand-primary, #4d6bfe);
}

.dsh-aurora-wide-inline { justify-self: start; }

.dsh-aurora-link {
  padding: 0 2px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-brand-primary, #4d6bfe);
  font-size: 12px;
}

.dsh-aurora-link:hover { text-decoration: underline; }

.dsh-aurora-inline {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 5px 8px;
  border: 1px solid var(--dsw-alias-border-l1, rgb(0 0 0 / .08));
  border-radius: 10px;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1, #fff) 55%, transparent);
}

.dsh-aurora-thumb {
  display: block;
  width: 32px;
  height: 32px;
  flex: none;
  object-fit: cover;
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-2, rgb(0 0 0 / .06));
}

.dsh-aurora-thumb-empty {
  background-image: linear-gradient(135deg, rgb(255 255 255 / .5), rgb(0 0 0 / .06));
}

.dsh-aurora-inline-text {
  flex: 1;
  min-width: 0;
  color: var(--dsw-alias-label-primary, #111);
  font-size: 12px;
}

.dsh-aurora-inline-actions { display: flex; gap: 10px; flex: none; }

.dsh-aurora-slider {
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 320px;
}

.dsh-aurora-slider input[type="range"] {
  flex: 1;
  min-width: 0;
  accent-color: var(--dsw-alias-brand-primary, #4d6bfe);
}

.dsh-aurora-slider output {
  flex: none;
  min-width: 38px;
  text-align: end;
  color: var(--dsw-alias-label-secondary, #777);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}

.dsh-aurora-page-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 4px;
}

.dsh-aurora-notice {
  color: var(--dsw-alias-state-warn-primary, #9a6212);
  font-size: 11.5px;
  text-align: end;
}

/* ── dsh-aurora: canvas ────────────────────────────────────────────── */
html {
  background-color: var(--aurora-base);
}

body {
  background: transparent !important;
}

body::before {
  content: '';
  position: fixed;
  inset: -6%;
  z-index: -1;
  pointer-events: none;
  background-color: var(--aurora-base);
  background-image:
    var(--dsh-aurora-tint-light, none),
    var(--dsh-aurora-wall, none),
    var(--aurora-layers, none);
  background-repeat: no-repeat;
  filter: blur(var(--dsh-aurora-blur, 0px));
  animation: dsh-aurora-drift 52s ease-in-out infinite alternate;
  will-change: transform;
}

body[data-ds-dark-theme]::before {
  background-image:
    var(--dsh-aurora-tint-dark, none),
    var(--dsh-aurora-wall, none),
    var(--aurora-layers, none);
}

body::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  opacity: .05;
  mix-blend-mode: overlay;
  background-image: ${GRAIN};
  background-size: 160px 160px;
}

@keyframes dsh-aurora-drift {
  0%   { transform: translate3d(0, 0, 0) scale(1); }
  50%  { transform: translate3d(-1.6%, 1.1%, 0) scale(1.05); }
  100% { transform: translate3d(1.5%, -1%, 0) scale(1.02); }
}

@media (prefers-reduced-motion: reduce) {
  body::before { animation: none; }
}

@media (max-width: 720px) {
  .dsh-aurora-row { grid-template-columns: minmax(0, 1fr); gap: 6px; }
  .dsh-aurora-row-label { padding-top: 0; }
}
`
    }

    const TOKENS = {
      '--dsw-alias-bg-base': {
        light: 'rgb(255 255 255 / 0.34)',
        dark: 'rgb(8 10 20 / 0.40)',
      },
      '--dsw-specific-sidebar-fill': {
        light: 'rgb(255 255 255 / 0.28)',
        dark: 'rgb(12 15 30 / 0.34)',
      },
      '--dsw-alias-bg-layer-1': {
        light: 'rgb(255 255 255 / 0.62)',
        dark: 'rgb(20 24 44 / 0.66)',
      },
    }

    function tint(mode, dim) {
      if (!(dim > 0)) return 'none'
      if (mode === 'dark') {
        return `linear-gradient(180deg, rgb(4 6 14 / ${(dim * 0.72).toFixed(3)}), rgb(3 4 9 / ${dim.toFixed(3)}))`
      }
      return `linear-gradient(180deg, rgb(252 253 255 / ${(dim * 0.84).toFixed(3)}), rgb(244 247 255 / ${Math.min(0.94, dim + 0.12).toFixed(3)}))`
    }

    function applySkin(settings) {
      const body = document.body
      if (!body) return
      body.dataset.dshAuroraEffect = settings.effect
      body.style.setProperty('--dsh-aurora-wall', settings.wallpaper ? cssUrl(settings.wallpaper) : 'none')
      // 压暗层是为了让壁纸上的文字可读；没有壁纸时它会冲淡自带光效，所以只在有壁纸时叠加。
      const hasWallpaper = settings.wallpaper !== ''
      body.style.setProperty('--dsh-aurora-tint-light', hasWallpaper ? tint('light', settings.dim) : 'none')
      body.style.setProperty('--dsh-aurora-tint-dark', hasWallpaper ? tint('dark', settings.dim) : 'none')
      body.style.setProperty('--dsh-aurora-blur', `${settings.blur}px`)
    }

    function clearSkin() {
      const body = document.body
      if (!body) return
      delete body.dataset.dshAuroraEffect
      for (const property of ['--dsh-aurora-wall', '--dsh-aurora-tint-light', '--dsh-aurora-tint-dark', '--dsh-aurora-blur']) {
        body.style.removeProperty(property)
      }
    }

    return {
      inject: ['slots', 'theme'],
      apply(ctx) {
        ctx.effect(() => {
          const style = document.createElement('style')
          style.setAttribute('data-dsh-aurora', '')
          style.textContent = buildCss()
          document.head.appendChild(style)
          return () => { style.remove() }
        }, 'dsh-aurora: skin stylesheet')

        ctx.effect(() => {
          applySkin(settingsStore.get())
          const unsubscribe = settingsStore.subscribe(() => applySkin(settingsStore.get()))
          return () => {
            unsubscribe()
            clearSkin()
          }
        }, 'dsh-aurora: settings -> document')

        ctx.effect(
          () => ctx.theme.overrideTokens(SOURCE, TOKENS),
          'dsh-aurora: glass token overrides',
        )

        ctx.slots.inject('sidebar.brand.mark', () => ctx.slots.register({
          name: 'sidebar.brand.mark',
        }, BrandMark))

        ctx.slots.inject('sidebar.brand.name', () => ctx.slots.register({
          name: 'sidebar.brand.name',
        }, BrandName))

        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: SECTION_ID,
          order: 30,
          label: '外观',
        }, ThemeSettings))

        ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
          name: 'settings.section.icon',
          id: SECTION_ID,
        }, AuroraIcon))
      },
    }
  },
})
