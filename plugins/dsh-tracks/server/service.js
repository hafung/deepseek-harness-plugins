// The 航迹 ledger service: owns the ledger document, folds the live append
// feed, backfills history through `sessionQuery`, and answers the panel API.

import { LEDGER_VERSION, MAX_LEVEL, RECORDS } from './catalog.js'
import { createClock, systemTimeZone } from './clock.js'
import {
  applyEffect,
  applyPresence,
  buildView,
  noteSessionCreated,
} from './aggregate.js'
import { emptyScratch, emptyStat, foldEvent, shouldFold } from './fold.js'
import { MedalArtwork } from './medals.js'
import { emptyLedger, LedgerStore, normalizeLedger } from './store.js'
import { fileURLToPath } from 'node:url'

const BACKFILL_BATCH = 8
const MAX_SCRATCH = 4000

function pause() {
  return new Promise(resolve => {
    setImmediate(resolve)
  })
}

export class TracksService {
  /**
   * @param {object} options
   * @param {import('cordis').Context} options.ctx   plugin context.
   * @param {string} [options.directory] ledger directory override (tests).
   * @param {object} [options.logger]
   * @param {number} [options.autoBackfillDelay] ms to wait before the first backfill.
   * @param {string} [options.artworkDirectory] medal artwork folder override (tests).
   */
  constructor({ ctx, directory, artworkDirectory, logger = console, autoBackfillDelay = 6000 } = {}) {
    this.ctx = ctx
    this.logger = logger
    this.directory = directory
    this.autoBackfillDelay = autoBackfillDelay
    this.clock = createClock(systemTimeZone())
    this.store = new LedgerStore({ directory, logger })
    this.artwork = new MedalArtwork({
      // Package-relative: `server/` sits beside the `medals/` folder.
      directory: artworkDirectory ?? fileURLToPath(new URL('../medals/', import.meta.url)),
      logger,
    })
    this.ledger = emptyLedger(Date.now(), this.clock.timeZone)
    this.scratch = new Map()
    this.controller = null
    this.autoBackfillTimer = null
    this.backfilling = false
    this.started = false
    this.ready = false
    this.disposed = false
    this.lastError = ''
    this.backfill = {
      running: false,
      done: 0,
      total: 0,
      failed: 0,
      folded: 0,
      added: 0,
      trigger: 'auto',
      cancelled: false,
      startedAt: 0,
      finishedAt: 0,
      current: '',
      error: '',
    }
  }

  get sessionTitle() {
    return this.ctx?.get?.('sessionTitle')
  }

  get sessionQuery() {
    return this.ctx?.get?.('sessionQuery')
  }

  async start() {
    if (this.started) return
    this.started = true
    const now = Date.now()
    const raw = await this.store.load()
    if (this.disposed) return
    const normalized = raw === null ? null : normalizeLedger(raw, this.clock, now)
    if (raw !== null && normalized === null) {
      this.logger.warn?.('[dsh-tracks] ledger version mismatch; starting a fresh ledger')
    }
    this.ledger = normalized ?? emptyLedger(now, this.clock.timeZone)
    if (normalized !== null && normalized.meta.timeZone !== this.clock.timeZone) {
      // Day and hour buckets were written in another zone; they cannot be
      // re-derived without the logs, so rebuild from the log corpus instead of
      // showing numbers that silently disagree with the configured clock.
      this.logger.warn?.(`[dsh-tracks] time zone changed (${normalized.meta.timeZone} → ${this.clock.timeZone}); rebuilding the ledger`)
      this.ledger = emptyLedger(now, this.clock.timeZone)
    }
    this.ledger.meta.updatedAt = now
    this.ready = true
    void this.artwork.scan()
    this.scheduleAutoBackfill()
  }

  scheduleAutoBackfill() {
    if (this.disposed) return
    const timer = setTimeout(() => {
      this.autoBackfillTimer = null
      if (this.disposed) return
      void this.startBackfill('auto').catch(error => {
        this.lastError = String(error?.message ?? error)
        this.logger.warn?.(`[dsh-tracks] automatic backfill failed: ${this.lastError}`)
      })
    }, this.autoBackfillDelay)
    timer.unref?.()
    this.autoBackfillTimer = timer
  }

  touch() {
    this.ledger.meta.updatedAt = Date.now()
    this.store.schedule(this.ledger)
  }

  scratchFor(id) {
    let scratch = this.scratch.get(id)
    if (scratch === undefined) {
      if (this.scratch.size >= MAX_SCRATCH) this.scratch.clear()
      scratch = emptyScratch()
      this.scratch.set(id, scratch)
    }
    return scratch
  }

  /**
   * Materialize (or refresh) the SessionStat row for a session header and count
   * it once into the profile totals.
   */
  ensureSession(header) {
    if (header === null || header === undefined) return null
    const id = typeof header.id === 'string' ? header.id : ''
    if (id === '') return null
    let stat = this.ledger.sessions[id]
    if (stat !== undefined) {
      if (stat.agentPreset === '' && typeof header.agentPreset === 'string') stat.agentPreset = header.agentPreset
      if (stat.cwd === '' && typeof header.cwd === 'string') stat.cwd = header.cwd
      if (stat.createdAt === 0 && Number.isFinite(header.createdAt)) stat.createdAt = header.createdAt
      if (stat.parentSession === '' && typeof header.parentSession === 'string') stat.parentSession = header.parentSession
      return stat
    }
    stat = emptyStat(header)
    this.ledger.sessions[id] = stat
    noteSessionCreated(this.ledger.profile, stat)
    return stat
  }

  /** Fold one appended live event. Safe to call for events already counted. */
  observe(session, event) {
    if (this.disposed || !this.ready) return
    try {
      const header = session?.header
      const stat = this.ensureSession(header)
      if (stat === null) return
      const inherited = Number(session?.inheritedEventCount) || 0
      const seq = Number(event?.seq)
      if (!shouldFold(seq, inherited, stat.seq)) return
      const scratch = this.scratchFor(stat.id)
      const effect = foldEvent(stat, event, scratch, this.clock)
      stat.seq = seq
      if (effect !== null) {
        applyEffect(this.ledger, stat, effect, this.clock, { notices: this.backfilling === false })
      }
      if (event?.type === 'user/message') this.refreshTitle(session, stat)
      this.touch()
    } catch (error) {
      this.lastError = String(error?.message ?? error)
      this.logger.warn?.(`[dsh-tracks] observe failed: ${this.lastError}`)
    }
  }

  refreshTitle(session, stat) {
    try {
      const snapshot = this.sessionTitle?.get?.(session)
      const title = typeof snapshot?.title === 'string' ? snapshot.title : ''
      if (title !== '' && title !== stat.title) stat.title = title
    } catch {
      // Title is decoration; a missing reader must never break the ledger.
    }
  }

  /** Fold one whole session log (backfill path). Returns the number of events folded. */
  async ingestSession(header, signal) {
    const query = this.sessionQuery
    if (query === undefined || query === null) throw new Error('sessionQuery unavailable')
    const id = typeof header?.id === 'string' ? header.id : ''
    if (id === '') return 0
    const stat = this.ensureSession(header)
    if (stat === null) return 0
    const snapshot = await query.readSession(id)
    if (signal?.aborted) return 0
    const inherited = Number(snapshot?.inheritedEventCount) || 0
    const events = Array.isArray(snapshot?.events) ? snapshot.events : []
    const scratch = emptyScratch()
    let folded = 0
    for (const event of events) {
      const seq = Number(event?.seq)
      if (!shouldFold(seq, inherited, stat.seq)) continue
      const effect = foldEvent(stat, event, scratch, this.clock)
      stat.seq = seq
      folded += 1
      if (effect !== null) applyEffect(this.ledger, stat, effect, this.clock, { notices: false })
    }
    try {
      const title = await query.readTitle?.(id)
      // `readTitle` answers a title snapshot; tolerate the observation wrapper
      // too so a shape change does not silently drop every session name.
      const text = typeof title?.title === 'string'
        ? title.title
        : typeof title?.title?.title === 'string' ? title.title.title : ''
      if (text !== '') stat.title = text
    } catch {
      // Titles are best effort; the ledger stays correct without them.
    }
    return folded
  }

  backfillState() {
    return {
      running: this.backfill.running,
      done: this.backfill.done,
      total: this.backfill.total,
      failed: this.backfill.failed,
      folded: this.backfill.folded,
      added: this.backfill.added,
      trigger: this.backfill.trigger,
      cancelled: this.backfill.cancelled,
      startedAt: this.backfill.startedAt,
      finishedAt: this.backfill.finishedAt,
      current: this.backfill.current,
      error: this.backfill.error,
      ready: this.sessionQuery !== undefined && this.sessionQuery !== null,
    }
  }

  /**
   * Walk the whole session corpus and fold whatever this ledger has not seen.
   * Idempotent: a run right after another one folds nothing, which is why the
   * result reports "scanned" and "added" separately.
   * @param {'auto' | 'manual'} [trigger] who asked for this pass.
   */
  async startBackfill(trigger = 'manual') {
    if (this.backfilling) return this.backfillState()
    const query = this.sessionQuery
    if (query === undefined || query === null) {
      this.backfill = { ...this.backfill, running: false, error: 'sessionQuery unavailable', ready: false }
      return this.backfillState()
    }
    if (this.autoBackfillTimer !== null && this.autoBackfillTimer !== undefined) {
      clearTimeout(this.autoBackfillTimer)
      this.autoBackfillTimer = null
    }
    this.controller = new AbortController()
    const signal = this.controller.signal
    this.backfilling = true
    this.backfill = {
      running: true,
      done: 0,
      total: 0,
      failed: 0,
      folded: 0,
      added: 0,
      trigger,
      cancelled: false,
      startedAt: Date.now(),
      finishedAt: 0,
      current: '',
      error: '',
    }
    let index = 0
    try {
      const records = await query.listSessions(signal)
      const list = Array.isArray(records) ? records : []
      this.backfill.total = list.length
      for (const record of list) {
        if (signal.aborted) break
        index += 1
        const header = record?.header ?? record
        this.backfill.current = typeof header?.id === 'string' ? header.id : ''
        try {
          const folded = await this.ingestSession(header, signal)
          this.backfill.folded += folded
          if (folded > 0) this.backfill.added += 1
        } catch (error) {
          this.backfill.failed += 1
          this.logger.warn?.(`[dsh-tracks] backfill skipped ${this.backfill.current}: ${error?.message ?? error}`)
        }
        this.backfill.done = index
        if (index % BACKFILL_BATCH === 0) {
          await this.store.flush(this.ledger)
          await pause()
        }
      }
      if (!signal.aborted) this.ledger.meta.backfilledAt = Date.now()
    } catch (error) {
      this.backfill.error = String(error?.message ?? error)
      this.lastError = this.backfill.error
      this.logger.warn?.(`[dsh-tracks] backfill failed: ${this.backfill.error}`)
    } finally {
      this.backfilling = false
      this.backfill.running = false
      this.backfill.current = ''
      this.backfill.finishedAt = Date.now()
      this.controller = null
      await this.store.flush(this.ledger)
    }
    return this.backfillState()
  }

  cancelBackfill() {
    if (this.backfilling) this.backfill.cancelled = true
    if (this.controller !== null) this.controller.abort()
    if (this.autoBackfillTimer !== null && this.autoBackfillTimer !== undefined) {
      clearTimeout(this.autoBackfillTimer)
      this.autoBackfillTimer = null
    }
    return this.backfillState()
  }

  /** Client presence heartbeat, capped per tick so a sleeping tab cannot inflate it. */
  tick(ms) {
    if (!this.ready) return { ok: false, applied: 0, onlineMs: 0, now: Date.now() }
    const now = Date.now()
    const applied = applyPresence(this.ledger, ms, now, this.clock, { notices: this.backfilling === false })
    if (applied > 0) this.touch()
    return { ok: true, applied, onlineMs: this.ledger.profile.online.totalMs, now }
  }

  topModels(limit = 4) {
    const entries = Object.entries(this.ledger.profile.models ?? {})
      .sort((left, right) => right[1] - left[1])
      .slice(0, limit)
    const total = entries.reduce((sum, entry) => sum + entry[1], 0)
    return { entries: entries.map(([key, count]) => ({ key, count })), total }
  }

  snapshot() {
    const now = Date.now()
    const sessions = Object.values(this.ledger.sessions)
    let subagentSessions = 0
    let workflows = 0
    let companions = 0
    for (const stat of sessions) {
      if (stat.origin === 'subagent') subagentSessions += 1
      workflows += stat.workflows ?? 0
      if (stat.companionMs > 0) companions += 1
    }
    // Delegations must be visible to the medal tests, so publish them before
    // the view (and its medal sync) is built.
    this.ledger.profile.totals.delegations = subagentSessions + workflows
    // Pick up artwork dropped in while the Host runs; the scan is async, so the
    // URL lands in a following snapshot.
    this.artwork.refreshIfStale()
    const view = buildView(this.ledger, this.clock, now)
    return {
      ok: true,
      v: LEDGER_VERSION,
      api: 2,
      now,
      timeZone: this.clock.timeZone,
      level: { ...view.level, maxLevel: MAX_LEVEL },
      today: view.today,
      streak: view.streak,
      personality: view.personality,
      totals: {
        ...view.totals,
        subagentSessions,
        mainSessions: view.totals.sessions - subagentSessions,
        delegations: subagentSessions + workflows,
        workflows,
        companions,
      },
      records: view.records,
      recordDefs: RECORDS.map(definition => ({
        id: definition.id,
        unit: definition.unit,
        unitSuffix: definition.unitSuffix ?? '',
        direction: definition.article === 'min' ? 'min' : 'max',
      })),
      recordCount: RECORDS.length,
      recordsOwned: view.recordsOwned,
      medals: view.medals.map(medal => ({ ...medal, icon: this.artwork.urlFor(medal.id) })),
      notices: (view.notices ?? []).slice(0, 6),
      models: this.topModels(4),
      backfill: this.backfillState(),
      ledger: {
        sessions: sessions.length,
        updatedAt: this.ledger.meta.updatedAt,
        createdAt: this.ledger.meta.createdAt,
        backfilledAt: this.ledger.meta.backfilledAt,
        xp: this.ledger.profile.xp,
        error: this.lastError,
      },
    }
  }

  async dispose() {
    if (this.disposed) return
    this.disposed = true
    if (this.autoBackfillTimer !== null && this.autoBackfillTimer !== undefined) {
      clearTimeout(this.autoBackfillTimer)
      this.autoBackfillTimer = null
    }
    if (this.controller !== null) this.controller.abort()
    this.scratch.clear()
    await this.store.close(this.ledger)
  }
}
