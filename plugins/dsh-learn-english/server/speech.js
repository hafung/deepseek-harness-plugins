import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readdir, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { EDGE_VOICES, synthesizeEdge } from './edge-tts.js'
import { inspectQwen, QWEN_VOICES, synthesizeQwen } from './qwen-tts.js'

const CACHE_LIMIT = 120

function dataHome() {
  return process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh')
}

export class SpeechService {
  constructor(config = {}, logger = console) {
    this.logger = logger
    this.edgeVoice = config.edgeVoice ?? 'en-US-AvaNeural'
    this.qwenExe = config.qwenExe ?? 'D:\\DevTools\\Qwen3-TTS\\engine\\qwen_tts.exe'
    this.qwenModelDir =
      config.qwenModelDir ?? 'D:\\DevTools\\Qwen3-TTS\\models\\qwen3-tts-1.7b-customvoice'
    this.qwenSpeaker = config.qwenSpeaker ?? 'ryan'
    this.qwenThreads = Number(config.qwenThreads) || 8
    this.qwenStyle =
      config.qwenStyle ??
      'Speak like a warm, friendly American English teacher. Clear, natural, conversational, with a relaxed pace and a gentle smile in the voice.'
    this.cacheDir = config.cacheDir ?? path.join(dataHome(), 'plugin-data', 'dsh-learn-english', 'audio')
    this.inflight = new Map()
    this.qwenQueue = Promise.resolve()
    this.ready = this.#init()
    this.generated = 0
  }

  async #init() {
    await mkdir(this.cacheDir, { recursive: true })
  }

  async status() {
    await this.ready
    const qwen = await inspectQwen({ exe: this.qwenExe, modelDir: this.qwenModelDir })
    return {
      edge: {
        id: 'edge',
        label: 'Edge TTS',
        available: true,
        voice: this.edgeVoice,
        voices: EDGE_VOICES,
        detail: 'Microsoft neural voice, online',
      },
      qwen: {
        id: 'qwen',
        label: 'Qwen3-TTS',
        available: qwen.available,
        voice: this.qwenSpeaker,
        voices: QWEN_VOICES,
        detail: qwen.available
          ? 'Local Qwen3-TTS 1.7B, private and offline'
          : `Local engine unavailable${qwen.error ? `: ${qwen.error}` : ''}`,
        error: qwen.error,
      },
    }
  }

  async synthesize({ engine, text, voice, rate = 1, signal }) {
    await this.ready
    if (engine !== 'edge' && engine !== 'qwen') {
      throw Object.assign(new Error('Unknown speech engine.'), { status: 400 })
    }
    const clean = String(text ?? '').trim()
    if (!clean) throw Object.assign(new Error('There is no text to speak.'), { status: 400 })
    if (clean.length > 2600) {
      throw Object.assign(new Error('This reply is too long to synthesize in one piece.'), { status: 413 })
    }
    const numericRate = Math.max(0.5, Math.min(2, Number(rate) || 1))
    const selectedVoice =
      engine === 'edge'
        ? String(voice || this.edgeVoice)
        : String(voice || this.qwenSpeaker)
    if (engine === 'qwen') {
      const availability = await inspectQwen({ exe: this.qwenExe, modelDir: this.qwenModelDir })
      if (!availability.available) {
        throw Object.assign(
          new Error(`Local Qwen TTS is unavailable. Check the engine path in the plugin config. ${availability.error ?? ''}`.trim()),
          { status: 503 },
        )
      }
    }
    const hash = createHash('sha256')
      .update(JSON.stringify({
        engine,
        text: clean,
        voice: selectedVoice,
        rate: numericRate,
        model: engine === 'qwen' ? this.qwenModelDir : 'edge',
        style: engine === 'qwen' ? this.qwenStyle : '',
      }))
      .digest('hex')
      .slice(0, 32)
    const extension = engine === 'edge' ? 'mp3' : 'wav'
    const file = path.join(this.cacheDir, `${engine}-${hash}.${extension}`)
    const contentType = engine === 'edge' ? 'audio/mpeg' : 'audio/wav'

    try {
      const info = await stat(file)
      if (info.size > 100) {
        return { file, contentType, cached: true, engine, voice: selectedVoice, rate: numericRate }
      }
      await unlink(file).catch(() => {})
    } catch {
      // Cache miss.
    }

    if (this.inflight.has(file)) return this.inflight.get(file)
    const task = this.#render({
      engine,
      text: clean,
      voice: selectedVoice,
      rate: numericRate,
      file,
      contentType,
      signal,
    })
    this.inflight.set(file, task)
    try {
      return await task
    } finally {
      this.inflight.delete(file)
    }
  }

  async #render({ engine, text, voice, rate, file, contentType, signal }) {
    const temp = path.join(
      this.cacheDir,
      `.partial-${process.pid}-${randomUUID()}.${engine === 'edge' ? 'mp3' : 'wav'}`,
    )
    try {
      if (engine === 'edge') {
        const audio = await synthesizeEdge({ text, voice, rate, signal })
        await writeFile(temp, audio)
      } else {
        const run = () =>
          synthesizeQwen({
            text,
            exe: this.qwenExe,
            modelDir: this.qwenModelDir,
            speaker: voice,
            rate,
            threads: this.qwenThreads,
            style: this.qwenStyle,
            output: temp,
            signal,
          })
        const queued = this.qwenQueue.then(run, run)
        this.qwenQueue = queued.catch(() => {})
        await queued
      }
      await rename(temp, file)
      this.generated += 1
      if (this.generated % 12 === 0) void this.prune()
      return { file, contentType, cached: false, engine, voice, rate }
    } catch (error) {
      await rm(temp, { force: true }).catch(() => {})
      throw error
    }
  }

  async prune() {
    try {
      const names = (await readdir(this.cacheDir)).filter(name => /^(edge|qwen)-[a-f0-9]+\.(mp3|wav)$/i.test(name))
      if (names.length <= CACHE_LIMIT) return
      const entries = await Promise.all(
        names.map(async name => {
          const info = await stat(path.join(this.cacheDir, name)).catch(() => undefined)
          return info ? { name, at: info.mtimeMs } : undefined
        }),
      )
      entries
        .filter(Boolean)
        .sort((a, b) => a.at - b.at)
        .slice(0, Math.max(0, names.length - CACHE_LIMIT))
        .forEach(entry => {
          void rm(path.join(this.cacheDir, entry.name), { force: true }).catch(() => {})
        })
    } catch (error) {
      this.logger.warn?.('[dsh-learn-english] audio cache prune failed:', error?.message ?? error)
    }
  }
}
