// Static vocabulary for 航迹 (tracks): the orbit track, the record wall, the
// medal set and the four personality axes.
//
// Display text is NOT here: every label a user reads comes from the client
// half's locale dictionaries, keyed by the ids below. The Host only sends ids,
// numbers and the unit needed to format them.

export const LEDGER_VERSION = 1

/**
 * The 10-station orbit track. `xp` is the cumulative XP that unlocks the level.
 * Level 1 starts at 0, so a brand-new ledger is already on the pad.
 */
export const LEVELS = [
  { level: 1, name: '地面·整备', xp: 0 },
  { level: 2, name: '探空', xp: 60 },
  { level: 3, name: '近地轨道', xp: 240 },
  { level: 4, name: '空间站', xp: 700 },
  { level: 5, name: '同步轨道', xp: 1600 },
  { level: 6, name: '地月转移', xp: 3200 },
  { level: 7, name: '月面', xp: 6000 },
  { level: 8, name: '火星转移', xp: 11000 },
  { level: 9, name: '火星轨道', xp: 20000 },
  { level: 10, name: '深空', xp: 36000 },
]

export const MAX_LEVEL = LEVELS.length

/** Every 36k XP past 深空 adds one ★ instead of an unbounded level. */
export const STAR_XP = 36000
export const MAX_STARS = 3

/**
 * Daily caps. A cap only clips that day's increment; the cumulative total is
 * never reset. One unit each: presence minutes, 2k output tokens, one turn,
 * two XP per distinct tool kind.
 */
export const XP_CAPS = { online: 240, output: 200, turns: 60, tools: 40 }
export const XP_RATES = { outputPerXp: 2000, xpPerTurn: 1, xpPerTool: 2 }

/**
 * Eight personal bests. `unit` tells the panel how to render the value, and
 * `article: 'min'` marks a record that improves by shrinking (fastest level).
 */
export const RECORDS = [
  { id: 'longestSession', unit: 'count', unitSuffix: 'turns' },
  { id: 'heaviestSession', unit: 'tokens' },
  { id: 'bestDay', unit: 'xp' },
  { id: 'latestNight', unit: 'clock' },
  { id: 'focusBlock', unit: 'duration' },
  { id: 'tooliestSession', unit: 'count', unitSuffix: 'kinds' },
  { id: 'mostSessionsDay', unit: 'count', unitSuffix: 'sessions' },
  { id: 'fastestLevel', unit: 'duration', article: 'min' },
]

export const RECORD_IDS = RECORDS.map(record => record.id)

/** `min` records improve when the value shrinks; the rest grow. */
export function recordDirection(id) {
  return RECORDS.find(record => record.id === id)?.article === 'min' ? 'min' : 'max'
}

/** Twelve task badges, unlocked once and stamped with the unlock time. */
export const MEDALS = [
  { id: 'firstTurn', test: view => view.totals.turns >= 1 },
  { id: 'tenSessions', test: view => view.totals.sessions >= 10 },
  { id: 'hundredTurns', test: view => view.totals.turns >= 100 },
  { id: 'millionOutput', test: view => view.totals.out >= 1_000_000 },
  { id: 'toolbox', test: view => view.totals.toolKinds >= 8 },
  { id: 'wideReader', test: view => view.totals.toolKinds >= 12 },
  { id: 'nightOwl', test: view => view.totals.nightSessions >= 5 },
  { id: 'streakWeek', test: view => view.streak.best >= 7 },
  { id: 'streakMonth', test: view => view.streak.best >= 30 },
  { id: 'deepFocus', test: view => (view.records.focusBlock?.value ?? 0) >= 90 * 60 * 1000 },
  { id: 'commander', test: view => view.totals.delegations >= 10 },
  { id: 'deepSpace', test: view => view.level.level >= MAX_LEVEL },
]

export const MEDAL_IDS = MEDALS.map(medal => medal.id)

/** Night window for the 时段 axis, in local hours. */
export const NIGHT_START_HOUR = 22
export const NIGHT_END_HOUR = 5

/** Quadrant titles are `title.<period>.<pace>` in the client dictionaries. */
export const TITLE_QUADS = ['day:short', 'day:long', 'night:short', 'night:long']

/** How many trailing months feed the personality window (≈90 days). */
export const PERSONALITY_MONTHS = 4
