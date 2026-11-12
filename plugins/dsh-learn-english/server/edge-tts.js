import { createHash, randomBytes, randomUUID } from 'node:crypto'

import WebSocket from '../vendor/ws/index.js'

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const CHROMIUM_VERSION = '143.0.3650.75'
const CHROMIUM_MAJOR = CHROMIUM_VERSION.split('.')[0]
const EDGE_ENDPOINT = 'wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1'
const WIN_EPOCH_OFFSET = 11644473600
const GEC_PREFIX_WORDS = [
  0x79706f43, 0x68676972, 0x43282074, 0x694d2029, 0x736f7263, 0x2074666f, 0x70726f43, 0x7461726f,
  0x2e6e6f69, 0x6c6c4120, 0x67697220, 0x20737468, 0x65736572, 0x64657672, 0x0000002e,
]
const GEC_PREFIX_LENGTH = 57

export const EDGE_VOICES = Object.freeze([
  { id: 'en-US-AvaNeural', label: 'Ava', tone: 'Warm, clear' },
  { id: 'en-US-EmmaNeural', label: 'Emma', tone: 'Bright, friendly' },
  { id: 'en-US-AndrewNeural', label: 'Andrew', tone: 'Calm, natural' },
  { id: 'en-US-BrianNeural', label: 'Brian', tone: 'Casual, easygoing' },
])

function rotate16(value) {
  return ((value << 16) | (value >>> 16)) >>> 0
}

function toWords(buffer) {
  const padded = Buffer.alloc(Math.ceil(buffer.length / 8) * 8)
  buffer.copy(padded)
  const words = []
  for (let index = 0; index < padded.length; index += 4) words.push(padded.readUInt32LE(index))
  return words
}

function wordSwap(words, a, b) {
  let acc = 0
  let last = 0
  for (let index = 0; index < words.length; index += 2) {
    const x = words[index]
    const y = words[index + 1]
    let t = rotate16((Math.imul(rotate16(x), 0xef0569fb) + Math.imul(x, a)) >>> 0)
    let q = Math.imul(t, 0x76f50f34) >>> 0
    acc = (acc + Math.imul(rotate16(q), 0xc3efea97) + q) >>> 0
    t = rotate16((Math.imul(rotate16(y), 0xc31713db) + Math.imul(y, b)) >>> 0)
    q = Math.imul(t, 0x1881ce3c) >>> 0
    last = (Math.imul(rotate16(q), 0x35bd1ec9) + q) >>> 0
    acc = (acc + last) >>> 0
  }
  return [last, acc]
}

function reversible(words, a, b) {
  let state = 0
  let acc = 0
  for (let index = 0; index < words.length; index += 2) {
    state = Math.imul(state + words[index], a) >>> 0
    for (const constant of [0xcf98b111, 0x87085b9f, 0x12ceb96d, 0x257e1d83]) {
      state = Math.imul(rotate16(state), constant) >>> 0
    }
    let t = Math.imul(words[index + 1] + state, b) >>> 0
    t = Math.imul(rotate16(t), 0xa27416f5) >>> 0
    t = rotate16(Math.imul(rotate16(t), 0xd38396ff) >>> 0)
    acc = (acc + state) >>> 0
    state = Math.imul(rotate16(Math.imul(t, 0x7c932b89) >>> 0), 0xbfa49f69) >>> 0
    acc = (acc + state) >>> 0
  }
  return [state, acc]
}

export function generateSecMsGec(now = Date.now()) {
  let ticks = Math.floor(now / 1000)
  ticks += WIN_EPOCH_OFFSET
  ticks -= ticks % 300
  ticks *= 1e9 / 100
  const prefix = Buffer.alloc(GEC_PREFIX_LENGTH)
  for (let index = 0; index < GEC_PREFIX_WORDS.length; index += 1) {
    const offset = index * 4
    if (offset + 4 <= GEC_PREFIX_LENGTH) prefix.writeUInt32LE(GEC_PREFIX_WORDS[index], offset)
    else if (offset < GEC_PREFIX_LENGTH) prefix[offset] = GEC_PREFIX_WORDS[index] & 0xff
  }
  const suffix = Buffer.from(`${ticks.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`, 'ascii')
  const data = Buffer.concat([prefix, suffix])
  const digest = createHash('sha256').update(data).digest()
  const words = toWords(data)
  const a = (digest.readUInt32LE(0) | 1) >>> 0
  const b = (digest.readUInt32LE(4) | 1) >>> 0
  const [swap0, swap1] = wordSwap(words, a, b)
  const [rev0, rev1] = reversible(words, a, b)
  const code = Buffer.alloc(8)
  code.writeUInt32LE((swap0 ^ rev0) >>> 0, 0)
  code.writeUInt32LE((swap1 ^ rev1) >>> 0, 4)
  return `${code.toString('hex').toUpperCase()}-${digest.toString('hex').toUpperCase()}`
}

function escapeXml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll("'", '&apos;')
    .replaceAll('"', '&quot;')
}

function ssmlVoice(voice) {
  const match = /^([a-z]{2,})-([A-Z]{2,})-(.+Neural)$/.exec(String(voice ?? ''))
  if (!match) return 'Microsoft Server Speech Text to Speech Voice (en-US, AvaNeural)'
  return `Microsoft Server Speech Text to Speech Voice (${match[1]}-${match[2]}, ${match[3]})`
}

function formatRate(rate) {
  const numeric = Math.max(0.5, Math.min(2, Number(rate) || 1))
  const percent = Math.round((numeric - 1) * 100)
  return `${percent >= 0 ? '+' : ''}${percent}%`
}

function buildSsml({ text, voice, rate }) {
  return (
    "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>" +
    `<voice name='${escapeXml(ssmlVoice(voice))}'>` +
    `<prosody pitch='+0Hz' rate='${formatRate(rate)}' volume='+0%'>` +
    escapeXml(text) +
    '</prosody></voice></speak>'
  )
}

function connectHeaders() {
  const muid = randomBytes(16).toString('hex').toUpperCase()
  return {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' +
      ` (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR}.0.0.0 Safari/537.36` +
      ` Edg/${CHROMIUM_MAJOR}.0.0.0`,
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Accept-Language': 'en-US,en;q=0.9',
    Pragma: 'no-cache',
    'Cache-Control': 'no-cache',
    Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
    Cookie: `muid=${muid};`,
  }
}

function splitText(text, maxBytes = 3600) {
  const encoded = Buffer.from(text, 'utf8')
  if (encoded.length <= maxBytes) return [text]
  const chunks = []
  let remaining = text
  while (Buffer.byteLength(remaining, 'utf8') > maxBytes) {
    const candidate = Array.from(remaining).slice(0, 1800).join('')
    let splitAt = Math.max(candidate.lastIndexOf('. '), candidate.lastIndexOf('! '), candidate.lastIndexOf('? '))
    if (splitAt < candidate.length * 0.45) splitAt = Math.max(candidate.lastIndexOf(' '), candidate.length / 2)
    if (splitAt <= 0) splitAt = Math.min(candidate.length, 1800)
    chunks.push(remaining.slice(0, splitAt + 1).trim())
    remaining = remaining.slice(splitAt + 1).trim()
  }
  if (remaining) chunks.push(remaining)
  return chunks
}

function synthesizeChunk({ text, voice, rate, signal }) {
  return new Promise((resolve, reject) => {
    const connectId = randomUUID().replaceAll('-', '')
    const params = new URLSearchParams({
      ConnectionId: connectId,
      'Ocp-Apim-Subscription-Key': TRUSTED_CLIENT_TOKEN,
      'Sec-MS-GEC': generateSecMsGec(),
      'Sec-MS-GEC-Version': `2-${CHROMIUM_VERSION}`,
    })
    const ws = new WebSocket(`${EDGE_ENDPOINT}?${params.toString()}`, {
      headers: connectHeaders(),
      handshakeTimeout: 15_000,
      perMessageDeflate: true,
    })
    const audio = []
    let settled = false
    let timer

    const cleanup = () => {
      if (timer) clearTimeout(timer)
      timer = undefined
      if (signal) signal.removeEventListener('abort', onAbort)
      try {
        ws.close()
      } catch {
        // Socket already closed.
      }
    }

    const finish = (error, value) => {
      if (settled) return
      settled = true
      cleanup()
      if (error) reject(error)
      else resolve(value)
    }

    const onAbort = () => finish(Object.assign(new Error('Speech synthesis was canceled.'), { aborted: true }))
    if (signal) {
      if (signal.aborted) {
        onAbort()
        return
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }

    timer = setTimeout(() => finish(new Error('Edge TTS timed out. Check your network connection.')), 35_000)

    ws.on('open', () => {
      const timestamp = new Date().toString()
      ws.send(
        `X-Timestamp:${timestamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
          JSON.stringify({
            context: {
              synthesis: {
                audio: {
                  metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: true },
                  outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
                },
              },
            },
          }),
      )
      ws.send(
        `X-RequestId:${connectId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${timestamp}\r\nPath:ssml\r\n\r\n` +
          buildSsml({ text, voice, rate }),
      )
    })

    ws.on('message', (data, isBinary) => {
      if (!isBinary) {
        const message = data.toString('utf8')
        if (message.includes('Path:turn.end')) {
          if (!audio.length) {
            finish(new Error('Edge TTS returned no audio.'))
            return
          }
          finish(null, Buffer.concat(audio))
        }
        return
      }
      const packet = Buffer.isBuffer(data) ? data : Buffer.from(data)
      if (packet.length < 4) return
      const headerLength = packet.readUInt16BE(0)
      const headerEnd = 2 + headerLength
      if (headerEnd > packet.length) return
      const header = packet.subarray(2, headerEnd).toString('latin1')
      if (!header.includes('Path:audio')) return
      const payload = packet.subarray(headerEnd)
      if (payload.length) audio.push(payload)
    })

    ws.on('unexpected-response', (_request, response) => {
      finish(new Error(`Edge TTS handshake failed (${response.statusCode ?? 'unknown'}).`))
      response.resume()
    })

    ws.on('error', error => {
      finish(new Error(`Edge TTS connection failed: ${error?.message ?? error}`))
    })

    ws.on('close', (code, reason) => {
      if (settled) return
      const detail = reason?.length ? `: ${reason.toString('utf8')}` : ''
      finish(new Error(`Edge TTS closed before the reply was complete (${code}${detail}).`))
    })
  })
}

export async function synthesizeEdge({ text, voice = 'en-US-AvaNeural', rate = 1, signal }) {
  const chunks = splitText(String(text ?? '').trim())
  if (!chunks.length) throw new Error('There is no text to speak.')
  const parts = []
  for (const chunk of chunks) {
    let lastError
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        parts.push(await synthesizeChunk({ text: chunk, voice, rate, signal }))
        lastError = undefined
        break
      } catch (error) {
        if (error?.aborted || signal?.aborted) throw error
        lastError = error
        if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 450))
      }
    }
    if (lastError) throw lastError
  }
  return Buffer.concat(parts)
}
