// Incremental fold of one Session log event into one SessionStat row.
//
// Two rules make this safe to run from both the live append feed and the
// historical backfill:
//   1. only events at or after `inheritedEventCount` are folded (a fork copies
//      its prefix into the child log, and folding the prefix would count it
//      twice);
//   2. only events with `seq > stat.seq` are folded, so a re-read of the same
//      log is idempotent.

/** An event gap wider than this closes one focus segment and one presence run. */
export const FOCUS_GAP_MS = 10 * 60 * 1000

export function emptyHourArray() {
  const array = new Array(24)
  for (let i = 0; i < 24; i += 1) array[i] = 0
  return array
}

export function emptyStat(header = {}) {
  return {
    id: header.id ?? '',
    createdAt: header.createdAt ?? 0,
    cwd: header.cwd ?? '',
    agentPreset: header.agentPreset ?? '',
    origin: header.origin === 'subagent' ? 'subagent' : 'main',
    parentSession: header.parentSession ?? '',
    title: '',
    seq: -1,
    turns: 0,
    steps: 0,
    out: 0,
    in: 0,
    cacheRead: 0,
    cacheWrite: 0,
    reasoning: 0,
    llmMs: 0,
    toolMs: 0,
    firstAt: 0,
    lastAt: 0,
    hourOut: emptyHourArray(),
    hourHuman: emptyHourArray(),
    tools: [],
    toolCalls: 0,
    subagents: 0,
    workflows: 0,
    peakTurnTokens: 0,
    focusMs: 0,
    companionMs: 0,
    models: {},
    // Transient fold scratch (never persisted as-is):
    segStart: 0,
    segEnd: 0,
    turnOut: 0,
    stepStartAt: 0,
    dirty: false,
  }
}

/** Per-session scratch that must survive between events but not a restart. */
export function emptyScratch() {
  return { pending: new Map(), lastSeq: -1 }
}

function usageOf(event) {
  const usage = event?.data?.usage
  if (usage === null || typeof usage !== 'object') return null
  const read = key => {
    const value = usage[key]
    return Number.isFinite(value) && value > 0 ? value : 0
  }
  return {
    in: read('inputTokens'),
    out: read('outputTokens'),
    cacheRead: read('cacheReadTokens'),
    cacheWrite: read('cacheWriteTokens'),
    reasoning: read('reasoningTokens'),
  }
}

function modelKeyOf(event) {
  const source = event?.data?.message?.source
  if (source === null || typeof source !== 'object') return ''
  const provider = typeof source.provider === 'string' ? source.provider : ''
  const model = typeof source.model === 'string' ? source.model : ''
  if (provider === '' && model === '') return ''
  return `${provider}/${model}`
}

function emptyEffect(time, clock) {
  const parts = clock.parts(time)
  return {
    time,
    day: `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
    month: `${parts.year}-${String(parts.month).padStart(2, '0')}`,
    hour: parts.hour,
    minuteOfDay: parts.hour * 60 + parts.minute,
    out: 0,
    in: 0,
    cacheRead: 0,
    cacheWrite: 0,
    reasoning: 0,
    humanCount: 0,
    newTools: [],
    modelKey: '',
    companionMs: 0,
    focusClosed: 0,
    turnEnded: false,
    stepEnded: false,
    peakGain: 0,
  }
}

/**
 * Fold one event into `stat`, returning the aggregate effect of that event (or
 * `null` when the event carries nothing the ledger tracks).
 *
 * @param {object} stat  a SessionStat row; mutated in place.
 * @param {object} event a SessionEvent (`{ type, seq, time, data }`).
 * @param {object} scratch per-session scratch (`{ pending: Map }`).
 * @param {object} clock  clock bound to the configured zone.
 */
export function foldEvent(stat, event, scratch, clock) {
  if (event === null || typeof event !== 'object') return null
  const time = Number(event.time) || 0
  const effect = emptyEffect(time, clock)

  // Presence and focus segments are time-based: any event at all extends them.
  if (stat.firstAt === 0 || time < stat.firstAt) stat.firstAt = time
  if (time >= stat.lastAt) {
    if (stat.lastAt > 0) {
      const gap = time - stat.lastAt
      if (gap <= FOCUS_GAP_MS) {
        effect.companionMs = gap
        stat.companionMs += gap
        const span = time - stat.segStart
        if (span > stat.focusMs) stat.focusMs = span
      } else {
        // The previous run just ended; a closed run is the honest value even
        // though the open one is already tracked in `focusMs`.
        const closed = stat.segEnd - stat.segStart
        effect.focusClosed = closed
        if (closed > stat.focusMs) stat.focusMs = closed
        stat.segStart = time
      }
    } else {
      stat.segStart = time
    }
    stat.segEnd = time
    stat.lastAt = time
  }

  switch (event.type) {
    case 'user/message': {
      effect.humanCount = 1
      stat.hourHuman[effect.hour] += 1
      break
    }
    case 'step/start': {
      stat.steps += 1
      stat.stepStartAt = time
      break
    }
    case 'step/end': {
      effect.stepEnded = true
      if (stat.stepStartAt > 0 && time > stat.stepStartAt) {
        stat.llmMs += time - stat.stepStartAt
      }
      stat.stepStartAt = 0
      break
    }
    case 'turn/start': {
      stat.turnOut = 0
      break
    }
    case 'turn/end': {
      stat.turns += 1
      effect.turnEnded = true
      if (stat.turnOut > stat.peakTurnTokens) {
        effect.peakGain = stat.turnOut - stat.peakTurnTokens
        stat.peakTurnTokens = stat.turnOut
      }
      stat.turnOut = 0
      break
    }
    case 'assistant/message': {
      const usage = usageOf(event)
      if (usage !== null) {
        effect.in = usage.in
        effect.out = usage.out
        effect.cacheRead = usage.cacheRead
        effect.cacheWrite = usage.cacheWrite
        effect.reasoning = usage.reasoning
        stat.in += usage.in
        stat.out += usage.out
        stat.cacheRead += usage.cacheRead
        stat.cacheWrite += usage.cacheWrite
        stat.reasoning += usage.reasoning
        stat.hourOut[effect.hour] += usage.out
        stat.turnOut += usage.out
      }
      const modelKey = modelKeyOf(event)
      if (modelKey !== '') {
        effect.modelKey = modelKey
        stat.models[modelKey] = (stat.models[modelKey] ?? 0) + 1
      }
      break
    }
    case 'tool/call': {
      const name = typeof event.data?.name === 'string' ? event.data.name : ''
      const callId = event.data?.callId
      stat.toolCalls += 1
      if (callId !== undefined && callId !== null) scratch.pending.set(callId, time)
      if (name !== '') {
        if (!stat.tools.includes(name)) {
          stat.tools.push(name)
          effect.newTools.push(name)
        }
        if (name === 'workflow') stat.workflows += 1
      }
      break
    }
    case 'tool/result': {
      const callId = event.data?.message?.toolCallId ?? event.data?.callId
      if (callId !== undefined && callId !== null && scratch.pending.has(callId)) {
        const startedAt = scratch.pending.get(callId)
        scratch.pending.delete(callId)
        if (time > startedAt) stat.toolMs += time - startedAt
      }
      break
    }
    default:
      break
  }

  return effect
}

/**
 * Whether this event belongs to the session's own log tail.
 * @param {number} seq      event sequence number.
 * @param {number} inherited how many leading events came from a fork source.
 * @param {number} folded    highest sequence already folded (`-1` when none).
 */
export function shouldFold(seq, inherited, folded) {
  if (!Number.isFinite(seq)) return false
  if (seq < inherited) return false
  return seq > folded
}
