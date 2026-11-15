// Medal artwork lookup. The 12 badges have built-in glyphs in the client half;
// this module is the override path: drop `<id>.svg` / `<id>.png` into the
// package's `medals/` directory and the panel shows that file instead.
//
// The directory is rescanned on a miss, so a file added while the Host runs
// appears without a restart (the first `/state` after the rescan carries it).

import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'

import { MEDAL_IDS } from './catalog.js'

const EXTENSIONS = ['.svg', '.png', '.webp', '.jpg', '.jpeg']

const MEDIA_TYPES = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

/** A public path segment must never escape the artwork directory. */
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

export class MedalArtwork {
  /**
   * @param {object} options
   * @param {string} options.directory absolute path of the `medals` folder.
   * @param {object} [options.logger]
   */
  constructor({ directory, logger = console }) {
    this.directory = directory
    this.logger = logger
    this.index = new Map()
    this.scannedAt = 0
    this.scanning = null
    this.version = 0
  }

  /** Read the directory once; safe to call as often as you like. */
  async scan() {
    if (this.scanning !== null) return this.scanning
    this.scanning = (async () => {
      const next = new Map()
      try {
        const entries = await readdir(this.directory, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isFile()) continue
          const extension = path.extname(entry.name).toLowerCase()
          if (!EXTENSIONS.includes(extension)) continue
          const id = path.basename(entry.name, path.extname(entry.name))
          if (!MEDAL_IDS.includes(id)) continue
          try {
            const info = await stat(path.join(this.directory, entry.name))
            // Later extensions lose to the earlier preferred one.
            if (next.has(id)) continue
            next.set(id, {
              id,
              file: entry.name,
              extension,
              bytes: info.size,
              mtime: Math.round(info.mtimeMs),
              type: MEDIA_TYPES[extension] ?? 'application/octet-stream',
            })
          } catch {
            // A file that vanished between readdir and stat is simply absent.
          }
        }
      } catch (error) {
        if (error?.code !== 'ENOENT') {
          this.logger.warn?.(`[dsh-tracks] medal artwork unreadable: ${error?.message ?? error}`)
        }
      }
      this.index = next
      this.scannedAt = Date.now()
      this.version += 1
      return this.index
    })()
    try {
      return await this.scanning
    } finally {
      this.scanning = null
    }
  }

  /** Rescan at most once every `maxAge` ms (called from the sync snapshot). */
  refreshIfStale(maxAge = 5000) {
    if (this.scanning !== null) return
    if (Date.now() - this.scannedAt < maxAge) return
    void this.scan()
  }

  entry(id) {
    return this.index.get(id)
  }

  /** Public URL for one medal's artwork, or '' when the badge uses its glyph. */
  urlFor(id) {
    const entry = this.index.get(id)
    if (entry === undefined) return ''
    return `/api/plugins/tracks/medals/${entry.id}${entry.extension}?v=${entry.mtime}`
  }

  /**
   * Resolve a request path segment (already stripped of the route prefix) to a
   * servable file. Returns `null` for anything outside the managed set.
   */
  async resolve(requested) {
    const name = String(requested ?? '').replace(/^\/+/, '')
    if (name === '' || !SAFE_NAME.test(name)) return null
    const extension = path.extname(name).toLowerCase()
    if (!EXTENSIONS.includes(extension)) return null
    const id = path.basename(name, path.extname(name))
    if (!MEDAL_IDS.includes(id)) return null
    let entry = this.index.get(id)
    if (entry === undefined || entry.file !== name) {
      await this.scan()
      entry = this.index.get(id)
    }
    if (entry === undefined || entry.file !== name) return null
    return {
      path: path.join(this.directory, entry.file),
      type: entry.type,
      etag: `"${entry.id}-${entry.mtime}-${entry.bytes}"`,
      mtime: entry.mtime,
      bytes: entry.bytes,
    }
  }
}
