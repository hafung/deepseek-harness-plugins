// Host-side smoke test for 航迹 (dsh-tracks): fold math, XP caps, records,
// levels, streak, personality, medals, fork de-duplication and backfill.
//
// Run: node tests/dsh-tracks.smoke.cjs

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const plugin = path.resolve(__dirname, '../plugins/dsh-tracks')

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(plugin, 'package.json'), 'utf8'))
  assert.equal(manifest.name, '@local/dsh-tracks')
  assert.ok(manifest.dsh.bundle.patch, 'manifest must declare a bundle patch')
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.ok(manifest.exports['./client'], 'manifest must export ./client')
  assert.match(
    fs.readFileSync(path.join(plugin, manifest.dsh.bundle.patch), 'utf8'),
    /name: '@local\/dsh-tracks'/,
  )
  for (const file of ['index.js', 'client.js', 'icon.svg', 'locale/zh.json', 'locale/en.json', 'README.md']) {
    assert.ok(fs.existsSync(path.join(plugin, file)), `${file} must exist`)
  }
  const listed = new Set(manifest.files)
  for (const file of ['index.js', 'client.js', 'cordis.patch.yml', 'icon.svg', 'locale/zh.json', 'locale/en.json', 'server/fold.js']) {
    assert.ok(listed.has(file) || [...listed].some(pattern => new RegExp(`^${pattern.replace('*', '[^/]*')}$`).test(file)), `${file} must be published`)
  }
  for (const locale of ['en', 'zh']) {
    const dict = JSON.parse(fs.readFileSync(path.join(plugin, `locale/${locale}.json`), 'utf8'))
    assert.ok(dict.meta?.title, `${locale} locale needs meta.title`)
    assert.ok(dict.meta?.description, `${locale} locale needs meta.description`)
  }

  const { createClock } = await import('../plugins/dsh-tracks/server/clock.js')
  const fold = await import('../plugins/dsh-tracks/server/fold.js')
  const aggregate = await import('../plugins/dsh-tracks/server/aggregate.js')
  const catalog = await import('../plugins/dsh-tracks/server/catalog.js')
  const { emptyLedger } = await import('../plugins/dsh-tracks/server/store.js')
  const { TracksService } = await import('../plugins/dsh-tracks/server/service.js')

  const clock = createClock('Asia/Shanghai')
  assert.equal(clock.day(Date.UTC(2026, 10, 15, 1, 0, 0)), '2026-11-15')
  assert.equal(clock.parts(Date.UTC(2026, 10, 15, 1, 0, 0)).hour, 9)
  // 16:30Z is already the next day in Shanghai.
  assert.equal(clock.day(Date.UTC(2026, 10, 15, 16, 30, 0)), '2026-11-16')

  // ---------------------------------------------------------------- fold math
  const base = Date.UTC(2026, 10, 15, 1, 0, 0)
  const header = { id: 'session-alpha', createdAt: base, cwd: '/repo', isSeeded: false, version: 1 }
  const events = [
    { type: 'user/message', seq: 0, time: base, data: { role: 'user', source: { kind: 'user' }, content: [] } },
    { type: 'step/start', seq: 1, time: base + 1_000, data: { turn: 1, step: 1 } },
    {
      type: 'assistant/message', seq: 2, time: base + 2_000,
      data: {
        turn: 1, step: 1, stream: [],
        message: { role: 'assistant', source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' }, content: [] },
        usage: { inputTokens: 1_000, outputTokens: 2_000, cacheReadTokens: 500, cacheWriteTokens: 100, reasoningTokens: 300 },
      },
    },
    { type: 'tool/call', seq: 3, time: base + 3_000, data: { turn: 1, step: 1, callId: 'call-1', name: 'read', arguments: '{}' } },
    { type: 'tool/result', seq: 4, time: base + 4_000, data: { turn: 1, step: 1, message: { role: 'tool', toolCallId: 'call-1', source: { kind: 'tool', callId: 'call-1' }, content: [] } } },
    {
      type: 'assistant/message', seq: 5, time: base + 5_000,
      data: {
        turn: 1, step: 1, stream: [],
        message: { role: 'assistant', source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' }, content: [] },
        usage: { inputTokens: 1_000, outputTokens: 4_000 },
      },
    },
    { type: 'turn/end', seq: 6, time: base + 6_000, data: { turn: 1, reason: { kind: 'completed' } } },
    { type: 'user/message', seq: 7, time: base + 60_000, data: { role: 'user', source: { kind: 'user' }, content: [] } },
    { type: 'turn/end', seq: 8, time: base + 61_000, data: { turn: 2, reason: { kind: 'completed' } } },
  ]

  const stat = fold.emptyStat(header)
  const scratch = fold.emptyScratch()
  let lastEffect = null
  for (const event of events) {
    lastEffect = fold.foldEvent(stat, event, scratch, clock)
  }
  assert.equal(stat.turns, 2, 'two turn/end events')
  assert.equal(stat.steps, 1)
  assert.equal(stat.out, 6_000, 'output tokens sum')
  assert.equal(stat.in, 2_000)
  assert.equal(stat.cacheRead, 500)
  assert.equal(stat.cacheWrite, 100)
  assert.equal(stat.reasoning, 300)
  assert.deepEqual(stat.tools, ['read'])
  assert.equal(stat.toolCalls, 1)
  assert.equal(stat.hourOut[9], 6_000, 'hour bucket uses the local hour')
  assert.equal(stat.hourHuman[9], 2)
  assert.equal(stat.companionMs, 61_000, 'presence = within-gap accumulation')
  assert.equal(stat.focusMs, 61_000, 'one unbroken focus segment')
  assert.equal(stat.peakTurnTokens, 6_000)
  assert.equal(stat.models['deepseek-official/deepseek-flash'], 2)
  assert.equal(stat.toolMs, 1_000)
  assert.equal(lastEffect.minuteOfDay, 9 * 60 + 1)

  // Re-folding the same seq must be a no-op for the caller.
  assert.equal(fold.shouldFold(8, 0, 8), false, 'already folded')
  // A forked prefix (inheritedEventCount > 0) is never counted again.
  assert.equal(fold.shouldFold(2, 3, -1), false, 'inherited prefix')
  assert.equal(fold.shouldFold(3, 3, -1), true, 'first own event')

  // ----------------------------------------------------------- aggregate math
  const ledger = emptyLedger(base, clock.timeZone)
  // Fold into one stat and aggregate each effect, exactly as the service does.
  const aggStat = fold.emptyStat(header)
  const scratch2 = fold.emptyScratch()
  for (const event of events) {
    const effect = fold.foldEvent(aggStat, event, scratch2, clock)
    if (effect !== null) aggregate.applyEffect(ledger, aggStat, effect, clock, { notices: false })
  }
  ledger.sessions[header.id] = aggStat
  aggregate.noteSessionCreated(ledger.profile, aggStat)
  const profile = ledger.profile
  const day = profile.days['2026-11-15']
  assert.ok(day, 'day bucket created')
  assert.equal(day.out, 6_000)
  assert.equal(day.turns, 2)
  assert.equal(day.ms, 61_000)
  assert.deepEqual(day.tools, ['read'])
  assert.deepEqual(day.sessions, ['session-alpha'])
  // 0 presence + 3 output + 2 turns + 2 tool = 7 XP
  assert.equal(day.xp, 7, 'day XP from the four capped components')
  assert.equal(profile.xp, 7)
  assert.equal(profile.hours.out[9], 6_000)
  assert.equal(profile.hours.human[9], 2)
  assert.equal(profile.totals.out, 6_000)
  assert.equal(profile.totals.turns, 2)
  assert.equal(profile.totals.sessions, 1)
  assert.equal(profile.streak.current, 1)
  assert.equal(profile.streak.best, 1)
  assert.equal(profile.records.longestSession.value, 2)
  assert.equal(profile.records.heaviestSession.value, 6_000)
  assert.equal(profile.records.focusBlock.value, 61_000)
  assert.equal(profile.records.tooliestSession.value, 1)
  assert.equal(profile.records.bestDay.value, 7)
  assert.equal(profile.records.latestNight, undefined, 'no night message yet')
  assert.equal(profile.notices.length, 0, 'growing inside one run is not a new record')

  // --------------------------------------------------------- XP caps per day
  const capLedger = emptyLedger(base, clock.timeZone)
  for (let index = 0; index < 12; index += 1) {
    aggregate.applyPresence(capLedger, 10 * 60_000, base, clock, { notices: false })
  }
  // 12 × 10 min = 120 min → 120 XP (cap is 240).
  assert.equal(capLedger.profile.days['2026-11-15'].xp, 120)
  for (let index = 0; index < 30; index += 1) {
    aggregate.applyPresence(capLedger, 10 * 60_000, base, clock, { notices: false })
  }
  assert.equal(capLedger.profile.days['2026-11-15'].xp, catalog.XP_CAPS.online, 'presence cap clips the increment')
  assert.equal(capLedger.profile.online.totalMs, 420 * 60_000, 'raw presence keeps accumulating')
  // A single tick is bounded so a sleeping tab cannot inflate the ledger.
  assert.equal(aggregate.applyPresence(capLedger, 86_400_000, base, clock, { notices: false }), 10 * 60_000)

  // ------------------------------------------------------------- level track
  const levelLedger = emptyLedger(base, clock.timeZone)
  levelLedger.profile.xp = 3_200
  let view = aggregate.levelView(levelLedger.profile)
  assert.equal(view.level, 6)
  assert.equal(view.name, '地月转移')
  assert.equal(view.next, 6_000)
  assert.equal(view.toNext, 2_800)
  levelLedger.profile.xp = 36_000
  view = aggregate.levelView(levelLedger.profile)
  assert.equal(view.level, 10)
  assert.equal(view.isMax, true)
  levelLedger.profile.xp = 36_000 * 3
  assert.equal(aggregate.levelView(levelLedger.profile).stars, 2, 'one star per 36k past 深空')

  // --------------------------------------------------------------- personality
  const nightLedger = emptyLedger(base, clock.timeZone)
  const nightProfile = nightLedger.profile
  nightProfile.totals.sessions = 4
  nightProfile.totals.turns = 80
  nightProfile.totals.tools = ['read', 'write', 'edit', 'grep', 'glob', 'pwsh', 'web_fetch', 'web_search']
  nightProfile.totals.delegations = 3
  nightProfile.months['2026-11'] = aggregate.emptyMonth()
  nightProfile.months['2026-11'].human[1] = 6
  nightProfile.months['2026-11'].human[3] = 4
  nightProfile.months['2026-11'].human[23] = 2
  nightProfile.months['2026-11'].human[10] = 8
  nightProfile.months['2026-11'].humanTotal = 20
  const personality = aggregate.buildView(nightLedger, clock, base).personality
  // 12 of 20 human messages inside 22:00–05:00 → 60% → 极夜
  assert.equal(personality.poles.period, 'deepNight')
  assert.equal(personality.poles.pace, 'long', '80 turns / 4 sessions = 20 >= 10')
  assert.equal(personality.poles.team, 'command')
  assert.equal(personality.poles.breadth, 'wide')
  assert.equal(personality.quad, 'night:long')

  const dayView = aggregate.buildView(ledger, clock, base)
  assert.equal(dayView.personality.poles.period, 'day')
  assert.equal(dayView.personality.quad, 'day:short')

  // ------------------------------------------------------------------ medals
  const medalView = aggregate.buildView(ledger, clock, base)
  const firstTurn = medalView.medals.find(medal => medal.id === 'firstTurn')
  assert.ok(firstTurn.at > 0, '首航 unlocks on the first turn')
  assert.equal(medalView.medals.filter(medal => medal.at > 0).length, 1)
  assert.equal(medalView.medals.length, 12)

  // ---------------------------------------------------------- medal artwork
  const { MedalArtwork } = await import('../plugins/dsh-tracks/server/medals.js')
  const artDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-tracks-medals-'))
  const artwork = new MedalArtwork({ directory: artDir, logger: { warn() {} } })
  await artwork.scan()
  assert.equal(artwork.urlFor('firstTurn'), '', 'no files means built-in glyphs')
  fs.writeFileSync(path.join(artDir, 'firstTurn.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="18" fill="none" stroke="#000"/></svg>')
  fs.writeFileSync(path.join(artDir, 'unknown.svg'), '<svg/>')
  fs.writeFileSync(path.join(artDir, 'note.txt'), 'ignored')
  await artwork.scan()
  const url = artwork.urlFor('firstTurn')
  assert.match(url, /^\/api\/plugins\/tracks\/medals\/firstTurn\.svg\?v=\d+$/)
  assert.equal(artwork.urlFor('unknown'), '', 'ids outside the catalog are ignored')
  assert.equal(artwork.urlFor('tenSessions'), '', 'medals without a file keep the glyph')
  const resolved = await artwork.resolve('/firstTurn.svg')
  assert.ok(resolved !== null && resolved.type === 'image/svg+xml')
  const again = await artwork.resolve('firstTurn.svg')
  assert.equal(again?.etag, resolved?.etag, 'resolution is stable')
  assert.equal(await artwork.resolve('../ledger.json'), null, 'path traversal is refused')
  assert.equal(await artwork.resolve('firstTurn.js'), null, 'extension must be an image')
  assert.equal(await artwork.resolve('unknown.svg'), null, 'unknown medal ids are refused')
  fs.rmSync(artDir, { recursive: true, force: true })

  // ------------------------------------------------------------- service wiring
  const artworkDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-tracks-medals2-'))
  fs.writeFileSync(path.join(artworkDir2, 'deepFocus.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-tracks-smoke-'))
  const backfillBase = Date.UTC(2026, 10, 10, 2, 0, 0)
  const fakeSessions = [
    {
      header: { id: 'session-bravo', createdAt: backfillBase, cwd: '/repo', isSeeded: false, version: 1, agentPreset: 'standard' },
      inheritedEventCount: 0,
      events: [
        { type: 'user/message', seq: 0, time: backfillBase, data: { role: 'user', source: { kind: 'user' }, content: [] } },
        { type: 'turn/end', seq: 1, time: backfillBase + 1_000, data: { turn: 1, reason: { kind: 'completed' } } },
        {
          type: 'assistant/message', seq: 2, time: backfillBase + 2_000,
          data: {
            turn: 1, step: 1, stream: [],
            message: { role: 'assistant', source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' }, content: [] },
            usage: { inputTokens: 10, outputTokens: 50_000 },
          },
        },
      ],
      title: '重构计费模块',
    },
    {
      // A fork: the first two events are an inherited prefix.
      header: { id: 'session-fork', createdAt: backfillBase + 60_000, cwd: '/repo', isSeeded: true, version: 1, parentSession: 'session-bravo' },
      inheritedEventCount: 2,
      events: [
        { type: 'user/message', seq: 0, time: backfillBase, data: { role: 'user', source: { kind: 'user' }, content: [] } },
        { type: 'turn/end', seq: 1, time: backfillBase + 1_000, data: { turn: 1, reason: { kind: 'completed' } } },
        { type: 'user/message', seq: 2, time: backfillBase + 120_000, data: { role: 'user', source: { kind: 'user' }, content: [] } },
        { type: 'turn/end', seq: 3, time: backfillBase + 121_000, data: { turn: 2, reason: { kind: 'completed' } } },
      ],
      title: '分叉试验',
    },
  ]
  const query = {
    async listSessions() {
      return fakeSessions.map(session => ({ header: session.header, live: false, persisted: true }))
    },
    async readSession(id) {
      const session = fakeSessions.find(item => item.header.id === id)
      if (session === undefined) throw new Error(`unknown session ${id}`)
      return { session: session.header, inheritedEventCount: session.inheritedEventCount, events: session.events }
    },
    async readTitle(id) {
      const session = fakeSessions.find(item => item.header.id === id)
      return { title: session.title, messageSeqs: [0], source: { kind: 'fallback' }, eventSeq: 9, updatedAt: backfillBase }
    },
  }
  const ctx = {
    get(name) {
      if (name === 'sessionQuery') return query
      if (name === 'sessionTitle') return { get: () => undefined }
      return undefined
    },
  }
  const service = new TracksService({
    ctx,
    directory,
    artworkDirectory: artworkDir2,
    logger: { warn() {} },
    autoBackfillDelay: 10 * 60_000,
  })
  service.ledger = emptyLedger(Date.now(), service.clock.timeZone)
  // `start()` is what normally flips this after loading the ledger from disk.
  service.ready = true
  await service.artwork.scan()
  const state = await service.startBackfill()
  assert.equal(state.running, false)
  assert.equal(state.total, 2)
  assert.equal(state.failed, 0)
  assert.equal(state.trigger, 'manual')
  assert.equal(state.added, 2, 'both sessions were new')
  assert.ok(state.folded > 0, 'events were folded')
  assert.equal(state.cancelled, false)
  const snapshot = service.snapshot()
  assert.equal(snapshot.totals.sessions, 2)
  assert.equal(snapshot.totals.turns, 2, 'the fork counts only its own turn')
  assert.equal(snapshot.totals.out, 50_000, 'the inherited prefix is not counted twice')
  assert.equal(snapshot.records.longestSession.value, 1)
  assert.equal(snapshot.records.heaviestSession.value, 50_000)
  assert.equal(snapshot.records.heaviestSession.sessionTitle, '重构计费模块')
  assert.equal(snapshot.recordCount, 8)
  assert.equal(snapshot.backfill.ready, true)
  assert.ok(snapshot.level.level >= 1)
  assert.equal(typeof snapshot.timeZone, 'string')
  // Artwork: the png dropped into the folder surfaces as an icon URL, and the
  // very first snapshot may precede the async scan, so check the second one.
  const iconOf = id => service.snapshot().medals.find(medal => medal.id === id)?.icon ?? ''
  assert.match(iconOf('deepFocus'), /^\/api\/plugins\/tracks\/medals\/deepFocus\.png\?v=\d+$/)
  assert.equal(iconOf('firstTurn'), '')

  // Idempotence: a second pass folds nothing new.
  const before = snapshot.totals.out
  const second = await service.startBackfill()
  assert.equal(second.folded, 0, 'a rescan of an up-to-date ledger folds nothing')
  assert.equal(second.added, 0, 'and reports no new sessions')
  assert.equal(service.snapshot().totals.out, before, 'backfill is idempotent')

  // Live path uses the same dedupe rule.
  const liveSession = fakeSessions[1]
  service.observe(
    { header: liveSession.header, inheritedEventCount: 2 },
    { type: 'turn/end', seq: 3, time: backfillBase + 121_000, data: { turn: 2, reason: { kind: 'completed' } } },
  )
  assert.equal(service.snapshot().totals.turns, 2, 'a duplicate live event is ignored')
  service.observe(
    { header: liveSession.header, inheritedEventCount: 2 },
    { type: 'turn/end', seq: 4, time: backfillBase + 200_000, data: { turn: 3, reason: { kind: 'completed' } } },
  )
  assert.equal(service.snapshot().totals.turns, 3, 'a new live event is folded')

  // Heartbeat.
  const tick = service.tick(30_000)
  assert.equal(tick.applied, 30_000)
  assert.ok(service.snapshot().totals.onlineMs >= 30_000)

  await service.dispose()
  fs.rmSync(artworkDir2, { recursive: true, force: true })
  assert.ok(fs.existsSync(path.join(directory, 'ledger.json')), 'ledger persisted on dispose')
  const persisted = JSON.parse(fs.readFileSync(path.join(directory, 'ledger.json'), 'utf8'))
  assert.equal(persisted.v, catalog.LEDGER_VERSION)
  assert.ok(persisted.sessions['session-bravo'])
  fs.rmSync(directory, { recursive: true, force: true })

  console.log('dsh-tracks host smoke: ok')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
