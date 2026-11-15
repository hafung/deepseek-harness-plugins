// Profile aggregation: turns one folded event into the global ledger effects
// (totals, per-day XP, per-hour heat, records, streak, levels) and builds the
// read model the panel and the medal tests consume.

import {
  LEVELS,
  MAX_LEVEL,
  MAX_STARS,
  MEDALS,
  NIGHT_END_HOUR,
  NIGHT_START_HOUR,
  PERSONALITY_MONTHS,
  RECORDS,
  STAR_XP,
  XP_CAPS,
  XP_RATES,
  recordDirection,
} from './catalog.js'
import { dayIndex } from './clock.js'
import { emptyHourArray } from './fold.js'

const MAX_MONTHS = 48
const MAX_DAYS = 4000
const MAX_NOTICES = 24
const MAX_NOTES = 40
/** One record toast per record id inside this window. */
const NOTICE_COOLDOWN_MS = 30 * 60 * 1000

function pad(value) {
  return String(value).padStart(2, '0')
}

export function emptyDay() {
  return { xp: 0, out: 0, turns: 0, ms: 0, online: 0, sessions: [], tools: [], turnSeen: 0, notes: [] }
}

export function emptyMonth() {
  return { out: emptyHourArray(), human: emptyHourArray(), outTokens: 0, turns: 0, humanTotal: 0 }
}

export function emptyProfile(now) {
  return {
    totals: {
      out: 0,
      in: 0,
      cacheRead: 0,
      cacheWrite: 0,
      reasoning: 0,
      turns: 0,
      sessions: 0,
      mainSessions: 0,
      subagentSessions: 0,
      human: 0,
      nightSessions: 0,
      delegations: 0,
      companionMs: 0,
      onlineMs: 0,
      tools: [],
    },
    days: {},
    months: {},
    hours: { out: emptyHourArray(), human: emptyHourArray() },
    records: {},
    medals: {},
    streak: { current: 0, best: 0, lastDay: '', freezes: 0 },
    levels: { 1: now },
    level: 1,
    xp: 0,
    online: { totalMs: 0, byDay: {} },
    models: {},
    notices: [],
  }
}

export function ensureDay(profile, dayKey) {
  let day = profile.days[dayKey]
  if (day === undefined) {
    day = emptyDay()
    profile.days[dayKey] = day
    pruneRecord(profile.days, MAX_DAYS)
  }
  if (!Array.isArray(day.sessions)) day.sessions = []
  if (!Array.isArray(day.tools)) day.tools = []
  if (!Array.isArray(day.notes)) day.notes = []
  return day
}

export function ensureMonth(profile, monthKey) {
  let month = profile.months[monthKey]
  if (month === undefined) {
    month = emptyMonth()
    profile.months[monthKey] = month
    pruneRecord(profile.months, MAX_MONTHS)
  }
  if (!Array.isArray(month.out)) month.out = emptyHourArray()
  if (!Array.isArray(month.human)) month.human = emptyHourArray()
  return month
}

/** Drop the oldest keys once a timestamped record grows past `limit`. */
function pruneRecord(record, limit) {
  const keys = Object.keys(record)
  if (keys.length <= limit) return
  keys.sort()
  for (const key of keys.slice(0, keys.length - limit)) delete record[key]
}

/** XP a single day has earned, after applying the four daily caps. */
export function dayXpOf(day) {
  const online = Math.min(Math.floor((day.online || 0) / 60_000), XP_CAPS.online)
  const output = Math.min(Math.floor((day.out || 0) / XP_RATES.outputPerXp), XP_CAPS.output)
  const turns = Math.min(day.turns || 0, XP_CAPS.turns)
  const tools = Math.min((day.tools?.length || 0) * XP_RATES.xpPerTool, XP_CAPS.tools)
  return online + output + turns + tools
}

/** 0-based index into LEVELS for a cumulative XP amount. */
export function levelIndexOf(xp) {
  const value = Number(xp) || 0
  for (let index = LEVELS.length - 1; index >= 0; index -= 1) {
    if (value >= LEVELS[index].xp) return index
  }
  return 0
}

export function levelView(profile) {
  const index = levelIndexOf(profile.xp)
  const entry = LEVELS[index]
  const next = LEVELS[index + 1]
  const base = entry.xp
  const ceiling = next === undefined ? null : next.xp
  const progress = ceiling === null ? 1 : Math.max(0, Math.min(1, (profile.xp - base) / (ceiling - base)))
  const stars = index === MAX_LEVEL - 1 ? Math.max(0, Math.floor((profile.xp - STAR_XP) / STAR_XP)) : 0
  return {
    level: entry.level,
    name: entry.name,
    xp: profile.xp,
    base,
    next: ceiling,
    toNext: ceiling === null ? 0 : Math.max(0, ceiling - profile.xp),
    progress,
    stars,
    maxStars: MAX_STARS,
    isMax: index === MAX_LEVEL - 1,
  }
}

function pushRecord(ledger, dayKey, id, value, at, sessionId, options) {
  const profile = ledger.profile
  const direction = recordDirection(id)
  const current = profile.records[id]
  if (current !== undefined && current !== null) {
    const previous = Number(current.value) || 0
    const next = Number(value) || 0
    if (direction === 'min' ? next >= previous : next <= previous) return false
  }
  const entry = { value, at }
  if (typeof sessionId === 'string' && sessionId !== '') entry.sessionId = sessionId
  profile.records[id] = entry
  if (current !== null && current !== undefined && options?.notices !== false) {
    // Growing inside the very same run is not a "new record": the session that
    // set it is still the one holding it.
    const sameRun = typeof sessionId === 'string' && sessionId !== ''
      && current.sessionId === sessionId
    // Two records in the same day can improve repeatedly; one ping per half
    // hour per record keeps the toast meaningful.
    const recent = profile.notices.find(item => item.id === id)
    const cooled = recent !== undefined && Number(recent.at) > at - NOTICE_COOLDOWN_MS
    if (!sameRun && !cooled) {
      const notice = { id, at, value, prev: current.value }
      profile.notices.unshift(notice)
      if (profile.notices.length > MAX_NOTICES) profile.notices.length = MAX_NOTICES
      const day = ensureDay(profile, dayKey)
      day.notes.push(notice)
      if (day.notes.length > MAX_NOTES) day.notes.shift()
    }
  }
  return true
}

/** Days with any recorded activity, newest first — used by the streak scan. */
function recentDayKeys(profile, limit = 60) {
  return Object.keys(profile.days).sort().slice(-limit)
}

function noteTurnDay(ledger, dayKey, at) {
  const profile = ledger.profile
  const day = ensureDay(profile, dayKey)
  if (day.turnSeen) return
  day.turnSeen = 1
  const streak = profile.streak
  const today = dayIndex(dayKey)
  const last = dayIndex(streak.lastDay)
  if (streak.lastDay === dayKey) return
  if (Number.isFinite(last) && Number.isFinite(today)) {
    const gap = today - last
    if (gap === 1) {
      streak.current += 1
    } else if (gap === 2 && streak.freezes > 0) {
      // A single missed day is covered by a freeze instead of resetting.
      streak.freezes -= 1
      streak.current += 1
    } else if (gap > 1) {
      streak.current = 1
    } else {
      // Clock moved backwards; keep the streak but move the anchor.
      streak.current = Math.max(1, streak.current)
    }
  } else {
    streak.current = Math.max(1, streak.current)
  }
  streak.lastDay = dayKey
  if (streak.current > streak.best) streak.best = streak.current
  // One freeze every ten consecutive days, at most two banked.
  if (streak.current > 0 && streak.current % 10 === 0 && streak.freezes < 2) streak.freezes += 1
  void at
}

function syncLevel(ledger, at, dayKey, options) {
  const profile = ledger.profile
  const target = levelIndexOf(profile.xp) + 1
  let guard = 0
  while ((profile.level || 1) < target && guard < 64) {
    guard += 1
    profile.level += 1
    profile.levels[profile.level] = at
    const previousAt = profile.levels[profile.level - 1]
    if (Number.isFinite(previousAt) && at > previousAt) {
      pushRecord(ledger, dayKey, 'fastestLevel', at - previousAt, at, undefined, options)
    }
  }
  if ((profile.level || 1) > target) profile.level = target
}

/**
 * Apply one folded event to the profile.
 * @param {object} ledger  `{ sessions, profile, meta }`
 * @param {object} stat    the event's SessionStat row
 * @param {object} effect  the effect returned by `foldEvent`
 * @param {object} clock   clock bound to the configured zone
 * @param {object} [options] `{ notices: boolean }`
 */
export function applyEffect(ledger, stat, effect, clock, options = {}) {
  const profile = ledger.profile
  const totals = profile.totals
  const day = ensureDay(profile, effect.day)
  const month = ensureMonth(profile, effect.month)
  const hour = Math.max(0, Math.min(23, effect.hour))

  if (effect.out > 0 || effect.in > 0 || effect.cacheRead > 0 || effect.cacheWrite > 0 || effect.reasoning > 0) {
    totals.out += effect.out
    totals.in += effect.in
    totals.cacheRead += effect.cacheRead
    totals.cacheWrite += effect.cacheWrite
    totals.reasoning += effect.reasoning
    day.out += effect.out
    profile.hours.out[hour] += effect.out
    month.out[hour] += effect.out
    month.outTokens += effect.out
    pushRecord(ledger, effect.day, 'heaviestSession', stat.out, effect.time, stat.id, options)
  }

  if (effect.modelKey !== '') {
    profile.models[effect.modelKey] = (profile.models[effect.modelKey] ?? 0) + 1
  }

  if (effect.newTools.length > 0) {
    for (const name of effect.newTools) {
      if (!totals.tools.includes(name)) totals.tools.push(name)
      if (!day.tools.includes(name)) day.tools.push(name)
    }
    pushRecord(ledger, effect.day, 'tooliestSession', stat.tools.length, effect.time, stat.id, options)
  }

  if (effect.humanCount > 0) {
    totals.human += effect.humanCount
    profile.hours.human[hour] += effect.humanCount
    month.human[hour] += effect.humanCount
    month.humanTotal += effect.humanCount
    if (hour < NIGHT_END_HOUR && !stat.nightFlag) {
      stat.nightFlag = 1
      totals.nightSessions += 1
    }
    // 00:00–06:00 only: a 23:50 message is not "deeper into the night".
    if (hour < 6) pushRecord(ledger, effect.day, 'latestNight', effect.minuteOfDay, effect.time, stat.id, options)
  }

  if (effect.companionMs > 0) {
    totals.companionMs += effect.companionMs
    day.ms += effect.companionMs
  }

  if (!day.sessions.includes(stat.id)) day.sessions.push(stat.id)

  // 最长专注 advances with the open run, so publish it at natural boundaries
  // (a closed run, or the end of a turn) instead of on every token.
  if ((effect.turnEnded || effect.focusClosed > 0) && stat.focusMs > 0) {
    pushRecord(ledger, effect.day, 'focusBlock', stat.focusMs, effect.time, stat.id, options)
  }

  if (effect.turnEnded) {
    totals.turns += 1
    day.turns += 1
    month.turns += 1
    pushRecord(ledger, effect.day, 'longestSession', stat.turns, effect.time, stat.id, options)
    noteTurnDay(ledger, effect.day, effect.time)
  }

  recomputeDayXp(ledger, effect.day, effect.time, options)
  syncLevel(ledger, effect.time, effect.day, options)
}

export function recomputeDayXp(ledger, dayKey, at, options = {}) {
  const profile = ledger.profile
  const day = ensureDay(profile, dayKey)
  const next = dayXpOf(day)
  const delta = next - (day.xp || 0)
  if (delta !== 0) {
    day.xp = next
    profile.xp += delta
  }
  if (day.xp > 0) {
    pushRecord(ledger, dayKey, 'bestDay', day.xp, at, undefined, options)
  }
  if (day.sessions.length > 0) {
    pushRecord(ledger, dayKey, 'mostSessionsDay', day.sessions.length, at, undefined, options)
  }
  return day
}

/** Add presence milliseconds (client heartbeat) to the ledger. */
export function applyPresence(ledger, ms, now, clock, options = {}) {
  const amount = Math.max(0, Math.min(Number(ms) || 0, 10 * 60_000))
  if (amount === 0) return 0
  const profile = ledger.profile
  const dayKey = clock.day(now)
  const day = ensureDay(profile, dayKey)
  day.online += amount
  profile.online.totalMs += amount
  profile.online.byDay[dayKey] = (profile.online.byDay[dayKey] ?? 0) + amount
  profile.totals.onlineMs += amount
  pruneRecord(profile.online.byDay, MAX_DAYS)
  recomputeDayXp(ledger, dayKey, now, options)
  syncLevel(ledger, now, dayKey, options)
  return amount
}

/** Count a session row into the profile once, when its stat is first created. */
export function noteSessionCreated(profile, stat) {
  profile.totals.sessions += 1
  if (stat.origin === 'subagent') profile.totals.subagentSessions += 1
  else profile.totals.mainSessions += 1
}

export function noteDelegation(profile, count = 1) {
  profile.totals.delegations += count
}

/** Last `count` `YYYY-MM` keys ending at `now`, newest first. */
function recentMonths(clock, now, count) {
  const parts = clock.parts(now)
  let year = parts.year
  let month = parts.month
  const keys = []
  for (let index = 0; index < count; index += 1) {
    keys.push(`${year}-${pad(month)}`)
    month -= 1
    if (month === 0) {
      month = 12
      year -= 1
    }
  }
  return keys
}

function sumMonthsHours(profile, keys) {
  const out = emptyHourArray()
  const human = emptyHourArray()
  let total = 0
  for (const key of keys) {
    const month = profile.months[key]
    if (month === undefined) continue
    for (let hour = 0; hour < 24; hour += 1) {
      out[hour] += month.out[hour] ?? 0
      human[hour] += month.human[hour] ?? 0
      total += month.human[hour] ?? 0
    }
  }
  return { out, human, humanTotal: total }
}

function personalityView(profile, clock, now) {
  const windowKeys = recentMonths(clock, now, PERSONALITY_MONTHS)
  const window = sumMonthsHours(profile, windowKeys)
  // A brand-new ledger can have no monthly data yet; fall back to all time.
  const hours = window.humanTotal > 0 ? window : { out: profile.hours.out, human: profile.hours.human, humanTotal: profile.totals.human }
  const humanTotal = hours.humanTotal
  const nightHours = []
  for (let hour = NIGHT_START_HOUR; hour < 24; hour += 1) nightHours.push(hour)
  for (let hour = 0; hour < NIGHT_END_HOUR; hour += 1) nightHours.push(hour)
  let nightCount = 0
  for (const hour of nightHours) nightCount += hours.human[hour] ?? 0
  const nightRatio = humanTotal > 0 ? nightCount / humanTotal : 0

  const sessions = Math.max(1, profile.totals.sessions)
  const avgTurns = profile.totals.turns / sessions
  const delegations = profile.totals.delegations / sessions
  const toolKinds = profile.totals.tools.length

  const period = nightRatio > 0.55 ? 'deepNight' : nightRatio > 0.35 ? 'night' : 'day'
  const pace = avgTurns >= 10 ? 'long' : 'short'
  const team = delegations > 0.5 ? 'command' : 'solo'
  const breadth = toolKinds >= 8 ? 'wide' : 'narrow'

  const quad = `${period === 'day' ? 'day' : 'night'}:${pace}`
  return {
    // Display text stays on the client: it renders `axis.<key>.<pole>` and
    // `title.<period>.<pace>` from these stable ids.
    poles: { period, pace, team, breadth },
    quad,
    nightRatio,
    window: { months: windowKeys.slice().reverse(), from: windowKeys[windowKeys.length - 1], to: windowKeys[0] },
    hours: hours.human.map((value, hour) => value + (hours.out[hour] ?? 0) / Math.max(1, 4000)),
    rawHours: hours.human,
    axes: [
      { key: 'period', pole: period, metric: nightRatio },
      { key: 'pace', pole: pace, metric: avgTurns },
      { key: 'team', pole: team, metric: delegations },
      { key: 'breadth', pole: breadth, metric: toolKinds },
    ],
  }
}

function recordView(ledger) {
  const profile = ledger.profile
  const output = {}
  for (const definition of RECORDS) {
    const stored = profile.records[definition.id]
    if (stored === undefined || stored === null) continue
    const session = typeof stored.sessionId === 'string' ? ledger.sessions[stored.sessionId] : undefined
    output[definition.id] = {
      value: stored.value,
      at: stored.at,
      sessionId: stored.sessionId ?? '',
      sessionTitle: session?.title ?? '',
    }
  }
  return output
}

/**
 * Build the read model. Medals are synced in place (their unlock timestamp is
 * durable), so call this on every snapshot and every medal-dependent view.
 */
export function buildView(ledger, clock, now) {
  const profile = ledger.profile
  const todayKey = clock.day(now)
  const today = profile.days[todayKey] ?? emptyDay()
  const totals = profile.totals
  const level = levelView(profile)
  const records = recordView(ledger)
  const activeDays = Object.keys(profile.days).length
  const view = {
    now,
    dayKey: todayKey,
    level,
    today: { xp: dayXpOf(today), out: today.out ?? 0, turns: today.turns ?? 0, onlineMs: today.online ?? 0, sessions: today.sessions?.length ?? 0, notes: today.notes ?? [] },
    totals: {
      sessions: totals.sessions,
      mainSessions: totals.mainSessions,
      subagentSessions: totals.subagentSessions,
      turns: totals.turns,
      out: totals.out,
      in: totals.in,
      cacheRead: totals.cacheRead,
      cacheWrite: totals.cacheWrite,
      reasoning: totals.reasoning,
      totalTokens: totals.out + totals.in + totals.cacheRead + totals.cacheWrite,
      toolKinds: totals.tools.length,
      tools: totals.tools,
      delegations: totals.delegations,
      nightSessions: totals.nightSessions,
      companionMs: totals.companionMs,
      onlineMs: totals.onlineMs,
      human: totals.human,
      activeDays,
    },
    records,
    streak: { current: profile.streak.current, best: profile.streak.best, freezes: profile.streak.freezes, lastDay: profile.streak.lastDay },
    hours: profile.hours,
    models: profile.models,
    notices: profile.notices,
  }
  view.medals = syncMedals(profile, view, now)
  view.personality = personalityView(profile, clock, now)
  view.recordsOwned = Object.keys(view.records).length
  return view
}

function syncMedals(profile, view, now) {
  const output = []
  for (const medal of MEDALS) {
    let at = profile.medals[medal.id] ?? 0
    if (at === 0) {
      let unlocked = false
      try {
        unlocked = medal.test(view) === true
      } catch {
        unlocked = false
      }
      if (unlocked) {
        at = now
        profile.medals[medal.id] = at
      }
    }
    output.push({ id: medal.id, at })
  }
  return output
}

/** Every day key that ever logged a turn, ascending — diagnostics only. */
export function turnDays(profile) {
  return recentDayKeys(profile).filter(key => profile.days[key]?.turnSeen)
}
