// Durable ledger file. The client never owns this state (localStorage is
// cleared by browser maintenance and fights across tabs), so the Host keeps one
// JSON document under `<DSH_HOME>/plugin-data/dsh-tracks/ledger.json` and writes
// it atomically: a temp file plus a rename, so a crash can never leave a
// half-written ledger behind.

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { LEDGER_VERSION } from './catalog.js'
import { emptyDay, emptyMonth, emptyProfile } from './aggregate.js'
import { emptyHourArray } from './fold.js'

const MAX_SESSIONS = 20_000

export function defaultDataDirectory() {
  const home = process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh')
  return path.join(home, 'plugin-data', 'dsh-tracks')
}

export function emptyLedger(now, timeZone) {
  return {
    v: LEDGER_VERSION,
    meta: { createdAt: now, updatedAt: now, timeZone, backfilledAt: 0, hostVersion: '' },
    sessions: {},
    profile: emptyProfile(now),
  }
}

function number(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback
}

function string(value, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizeHours(value) {
  const out = emptyHourArray()
  if (Array.isArray(value)) {
    for (let index = 0; index < 24; index += 1) out[index] = number(value[index])
  }
  return out
}

function normalizeStat(raw, fallbackId) {
  if (raw === null || typeof raw !== 'object') return null
  const id = string(raw.id, fallbackId)
  if (id === '') return null
  return {
    id,
    createdAt: number(raw.createdAt),
    cwd: string(raw.cwd),
    agentPreset: string(raw.agentPreset),
    origin: raw.origin === 'subagent' ? 'subagent' : 'main',
    parentSession: string(raw.parentSession),
    title: string(raw.title),
    seq: number(raw.seq, -1),
    turns: number(raw.turns),
    steps: number(raw.steps),
    out: number(raw.out),
    in: number(raw.in),
    cacheRead: number(raw.cacheRead),
    cacheWrite: number(raw.cacheWrite),
    reasoning: number(raw.reasoning),
    llmMs: number(raw.llmMs),
    toolMs: number(raw.toolMs),
    firstAt: number(raw.firstAt),
    lastAt: number(raw.lastAt),
    hourOut: normalizeHours(raw.hourOut),
    hourHuman: normalizeHours(raw.hourHuman),
    tools: Array.isArray(raw.tools) ? raw.tools.filter(tool => typeof tool === 'string') : [],
    toolCalls: number(raw.toolCalls),
    subagents: number(raw.subagents),
    workflows: number(raw.workflows),
    peakTurnTokens: number(raw.peakTurnTokens),
    focusMs: number(raw.focusMs),
    companionMs: number(raw.companionMs),
    models: record(raw.models),
    nightFlag: raw.nightFlag ? 1 : 0,
    segStart: number(raw.segStart),
    segEnd: number(raw.segEnd),
    turnOut: number(raw.turnOut),
    stepStartAt: number(raw.stepStartAt),
    dirty: false,
  }
}

function normalizeTotals(source) {
  const totals = emptyProfile(0).totals
  const merged = { ...totals, ...record(source) }
  merged.tools = Array.isArray(merged.tools) ? merged.tools.filter(tool => typeof tool === 'string') : []
  for (const key of Object.keys(totals)) {
    if (key === 'tools') continue
    merged[key] = number(merged[key])
  }
  return merged
}

/**
 * Accept a ledger read from disk, repairing anything a crash, a hand edit, or
 * an older build could have left out. Returns `null` when the document is
 * unusable, which tells the caller to start a fresh ledger.
 */
export function normalizeLedger(raw, clock, now) {
  if (raw === null || typeof raw !== 'object') return null
  if (number(raw.v, 0) !== LEDGER_VERSION) return null
  const ledger = emptyLedger(now, clock.timeZone)
  const meta = record(raw.meta)
  ledger.meta = {
    createdAt: number(meta.createdAt, now),
    updatedAt: number(meta.updatedAt, now),
    timeZone: string(meta.timeZone, clock.timeZone) || clock.timeZone,
    backfilledAt: number(meta.backfilledAt),
    hostVersion: string(meta.hostVersion),
  }

  const sessions = record(raw.sessions)
  for (const [key, value] of Object.entries(sessions)) {
    const stat = normalizeStat(value, key)
    if (stat !== null) ledger.sessions[stat.id] = stat
    if (Object.keys(ledger.sessions).length >= MAX_SESSIONS) break
  }

  const source = record(raw.profile)
  const profile = emptyProfile(now)
  profile.totals = normalizeTotals(source.totals)
  profile.xp = number(source.xp)
  profile.level = Math.max(1, number(source.level, 1))
  profile.levels = { ...record(source.levels) }
  if (!Number.isFinite(profile.levels[1])) profile.levels[1] = ledger.meta.createdAt
  profile.records = { ...record(source.records) }
  profile.medals = { ...record(source.medals) }
  profile.models = { ...record(source.models) }
  profile.notices = Array.isArray(source.notices) ? source.notices.slice(0, 24) : []
  const hours = record(source.hours)
  profile.hours = { out: normalizeHours(hours.out), human: normalizeHours(hours.human) }
  const online = record(source.online)
  profile.online = { totalMs: number(online.totalMs), byDay: { ...record(online.byDay) } }
  const streak = record(source.streak)
  profile.streak = {
    current: number(streak.current),
    best: number(streak.best),
    lastDay: string(streak.lastDay),
    freezes: number(streak.freezes),
  }

  for (const [key, value] of Object.entries(record(source.days))) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || value === null || typeof value !== 'object') continue
    const day = emptyDay()
    day.xp = number(value.xp)
    day.out = number(value.out)
    day.turns = number(value.turns)
    day.ms = number(value.ms)
    day.online = number(value.online)
    day.turnSeen = value.turnSeen ? 1 : 0
    day.sessions = Array.isArray(value.sessions) ? value.sessions.filter(id => typeof id === 'string') : []
    day.tools = Array.isArray(value.tools) ? value.tools.filter(tool => typeof tool === 'string') : []
    day.notes = Array.isArray(value.notes) ? value.notes.slice(-40) : []
    profile.days[key] = day
  }

  for (const [key, value] of Object.entries(record(source.months))) {
    if (!/^\d{4}-\d{2}$/.test(key) || value === null || typeof value !== 'object') continue
    const month = emptyMonth()
    month.out = normalizeHours(value.out)
    month.human = normalizeHours(value.human)
    month.outTokens = number(value.outTokens)
    month.turns = number(value.turns)
    month.humanTotal = number(value.humanTotal)
    profile.months[key] = month
  }

  ledger.profile = profile
  return ledger
}

export class LedgerStore {
  /**
   * @param {object} options
   * @param {string} [options.directory] data directory for this plugin.
   * @param {{ warn?: Function, info?: Function }} [options.logger]
   */
  constructor({ directory, logger = console } = {}) {
    this.directory = directory ?? defaultDataDirectory()
    this.file = path.join(this.directory, 'ledger.json')
    this.temp = path.join(this.directory, 'ledger.json.tmp')
    this.logger = logger
    this.timer = null
    this.queue = Promise.resolve()
    this.closed = false
  }

  async load() {
    try {
      const raw = await readFile(this.file, 'utf8')
      return JSON.parse(raw)
    } catch (error) {
      if (error?.code === 'ENOENT') return null
      this.logger.warn?.(`[dsh-tracks] ledger unreadable: ${error?.message ?? error}`)
      return null
    }
  }

  /** Debounced save: call as often as you like, the disk sees the last state. */
  schedule(ledger, delay = 1500) {
    if (this.closed) return
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush(ledger)
    }, delay)
    this.timer.unref?.()
  }

  /** Write immediately, serialized so two flushes never interleave. */
  flush(ledger) {
    if (this.closed) return Promise.resolve()
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    const snapshot = JSON.stringify(ledger)
    this.queue = this.queue.then(() => this.write(snapshot)).catch(error => {
      this.logger.warn?.(`[dsh-tracks] ledger write failed: ${error?.message ?? error}`)
    })
    return this.queue
  }

  async write(text) {
    await mkdir(this.directory, { recursive: true })
    await writeFile(this.temp, text, 'utf8')
    await rename(this.temp, this.file)
  }

  /** Final synchronous-ish write on plugin unload. */
  async close(ledger) {
    this.closed = true
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    try {
      await this.write(JSON.stringify(ledger))
    } catch (error) {
      this.logger.warn?.(`[dsh-tracks] final ledger write failed: ${error?.message ?? error}`)
    }
    await rm(this.temp, { force: true })
  }
}
