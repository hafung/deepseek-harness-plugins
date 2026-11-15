// Local day / hour bucketing. Every timestamp the ledger folds is an
// `event.time` in epoch milliseconds; a single configured time zone decides
// which natural day and which hour bucket it belongs to.

const FORMATTERS = new Map()

function formatterFor(timeZone) {
  let formatter = FORMATTERS.get(timeZone)
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    FORMATTERS.set(timeZone, formatter)
  }
  return formatter
}

function pad(value) {
  return String(value).padStart(2, '0')
}

export function systemTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/**
 * A clock bound to one time zone.
 * @param {string} [timeZone] IANA zone; defaults to the host system zone.
 */
export function createClock(timeZone = systemTimeZone()) {
  const formatter = formatterFor(timeZone)
  const parts = ms => {
    const result = { year: 1970, month: 1, day: 1, hour: 0, minute: 0 }
    for (const part of formatter.formatToParts(new Date(Number(ms) || 0))) {
      switch (part.type) {
        case 'year': result.year = Number(part.value); break
        case 'month': result.month = Number(part.value); break
        case 'day': result.day = Number(part.value); break
        case 'hour': result.hour = Number(part.value) % 24; break
        case 'minute': result.minute = Number(part.value); break
        default: break
      }
    }
    return result
  }
  return {
    timeZone,
    parts,
    /** `YYYY-MM-DD` in this zone. */
    day(ms) {
      const p = parts(ms)
      return `${p.year}-${pad(p.month)}-${pad(p.day)}`
    },
    /** `YYYY-MM` in this zone. */
    month(ms) {
      const p = parts(ms)
      return `${p.year}-${pad(p.month)}`
    },
  }
}

/** Whole days since the epoch for a `YYYY-MM-DD` key (used for streak gaps). */
export function dayIndex(dayKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dayKey ?? ''))
  if (match === null) return Number.NaN
  return Math.round(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000)
}

/** `04:37` from a minute-of-day number. */
export function clockLabel(minuteOfDay) {
  const total = Math.max(0, Math.min(1439, Math.round(Number(minuteOfDay) || 0)))
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}
