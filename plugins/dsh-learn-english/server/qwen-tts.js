import { spawn } from 'node:child_process'
import { access, stat } from 'node:fs/promises'
import path from 'node:path'

export const QWEN_VOICES = Object.freeze([
  { id: 'ryan', label: 'Ryan', tone: 'Warm, natural' },
  { id: 'serena', label: 'Serena', tone: 'Clear, gentle' },
  { id: 'aiden', label: 'Aiden', tone: 'Bright, friendly' },
])

const DEFAULT_STYLE =
  'Speak like a warm, friendly American English teacher. Clear, natural, conversational, with a relaxed pace and a gentle smile in the voice.'
const DEFAULT_TIMEOUT_MS = 240_000

export async function inspectQwen({ exe, modelDir }) {
  try {
    await access(exe)
    await access(path.join(modelDir, 'model.safetensors'))
    const info = await stat(exe)
    return { available: true, exe, modelDir, size: info.size }
  } catch (error) {
    return {
      available: false,
      exe,
      modelDir,
      error: String(error?.message ?? error),
    }
  }
}

export function synthesizeQwen({
  text,
  exe,
  modelDir,
  speaker = 'ryan',
  rate = 1,
  threads = 8,
  style = DEFAULT_STYLE,
  output,
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  if (!/^[a-z0-9_-]{2,32}$/i.test(String(speaker ?? ''))) {
    return Promise.reject(new Error('Invalid Qwen speaker.'))
  }
  const args = [
    '-d', modelDir,
    '-t', String(text),
    '-o', output,
    '-s', String(speaker),
    '-l', 'English',
    '-I', String(style || DEFAULT_STYLE),
    '--int8',
    '--max-duration', '90',
    '--rate', String(Math.max(0.5, Math.min(2, Number(rate) || 1))),
    '-j', String(Math.max(1, Math.min(64, Number(threads) || 8))),
    '-S',
  ]

  return new Promise((resolve, reject) => {
    let settled = false
    let timer
    let stderr = ''
    let stdout = ''
    const child = spawn(exe, args, {
      cwd: path.dirname(exe),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const cleanup = () => {
      if (timer) clearTimeout(timer)
      timer = undefined
      if (signal) signal.removeEventListener('abort', onAbort)
    }
    const finish = (error, value) => {
      if (settled) return
      settled = true
      cleanup()
      if (error) reject(error)
      else resolve(value)
    }
    const onAbort = () => {
      try {
        child.kill('SIGKILL')
      } catch {
        // The process may have exited already.
      }
      finish(Object.assign(new Error('Speech synthesis was canceled.'), { aborted: true }))
    }

    if (signal) {
      if (signal.aborted) {
        onAbort()
        return
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }

    timer = setTimeout(() => {
      try {
        child.kill('SIGKILL')
      } catch {
        // The process may have exited already.
      }
      finish(new Error('Local Qwen TTS timed out. The first run can take a little longer.'))
    }, timeoutMs)

    child.stdout.on('data', chunk => {
      stdout = `${stdout}${chunk.toString('utf8')}`.slice(-1200)
    })
    child.stderr.on('data', chunk => {
      stderr = `${stderr}${chunk.toString('utf8')}`.slice(-4000)
    })
    child.on('error', error => {
      finish(new Error(`Could not start Qwen TTS: ${error?.message ?? error}`))
    })
    child.on('exit', async code => {
      if (settled) return
      if (code !== 0) {
        const detail = stderr.trim() || stdout.trim()
        finish(new Error(`Qwen TTS exited with code ${code}${detail ? `: ${detail.slice(-800)}` : ''}`))
        return
      }
      try {
        const info = await stat(output)
        if (!info.size || info.size < 100) throw new Error('Qwen TTS produced an empty audio file.')
        finish(null, output)
      } catch (error) {
        finish(new Error(`Qwen TTS did not produce audio: ${error?.message ?? error}`))
      }
    })
  })
}
