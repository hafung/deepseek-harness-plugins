import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import { methodNotAllowed, readJson, route, sendError, sendJson, writeNdjson } from './server/http.js'
import {
  containsNonEnglishScript,
  MODES,
  normalizePolishOutput,
  prepareMessages,
  repairPrompt,
  repairSystemPrompt,
  toSpeechText,
} from './server/prompts.js'
import { SpeechService } from './server/speech.js'

export const inject = ['webServer']

const API = '/api/plugins/learn-english'
const DEFAULT_CONFIG = {
  edgeVoice: 'en-US-AvaNeural',
  qwenExe: 'D:\\DevTools\\Qwen3-TTS\\engine\\qwen_tts.exe',
  qwenModelDir: 'D:\\DevTools\\Qwen3-TTS\\models\\qwen3-tts-1.7b-customvoice',
  qwenSpeaker: 'ryan',
  qwenThreads: 8,
  qwenStyle:
    'Speak like a warm, friendly American English teacher. Clear, natural, conversational, with a relaxed pace and a gentle smile in the voice.',
  provider: '',
  model: '',
  maxReplyTokens: 800,
}

function selectionOf(ctx, config) {
  if (config.provider && config.model) {
    return { provider: config.provider, model: config.model, source: 'config' }
  }
  try {
    const selection = ctx.get('agentDefaultModel')?.currentSelection?.()
    if (selection?.provider && selection?.model) {
      return { provider: selection.provider, model: selection.model, source: 'default' }
    }
  } catch {
    // The default model service may not be mounted in a narrow profile.
  }
  return undefined
}

function friendlyError(error) {
  const raw = String(error?.message ?? error ?? 'Unknown error').replace(/\s+/g, ' ').trim()
  const message = raw.slice(0, 500)
  if (/api.?key|credential|unauthori[sz]ed|401/i.test(message)) {
    return `The model is not authorized. Check the connected model account. (${message})`
  }
  if (/429|rate limit/i.test(message)) {
    return 'The model is rate-limited right now. Please try again in a moment.'
  }
  if (/timeout|timed out|ETIMEDOUT/i.test(message)) {
    return 'The model took too long to respond. Please try again.'
  }
  return message
}

async function repairEnglish({ llm, selection, text, signal, maxTokens }) {
  let repaired = ''
  const stream = llm.stream({
    provider: selection.provider,
    model: selection.model,
    system: repairSystemPrompt(),
    messages: [{ role: 'user', content: [{ type: 'text', text: repairPrompt(text) }] }],
    temperature: 0.1,
    maxTokens: Math.min(600, Math.max(160, maxTokens)),
    signal,
  })
  for await (const chunk of stream) {
    if (chunk.type === 'text-delta') repaired += chunk.text
    if (chunk.type === 'finish') {
      if (chunk.reason?.kind === 'error') throw new Error(chunk.reason.failure?.message ?? 'model error')
      if (chunk.reason?.kind === 'aborted') throw Object.assign(new Error('Model request was canceled.'), { aborted: true })
    }
  }
  return repaired.trim()
}

function fallbackEnglish(mode) {
  return mode === 'polish'
    ? "Could you send that again? I'll turn it into natural American English for you."
    : "Let's keep practicing in English. Could you tell me that again in English?"
}

export function apply(ctx, rawConfig = {}) {
  const config = { ...DEFAULT_CONFIG, ...(rawConfig ?? {}) }
  const speech = new SpeechService(config)
  const logger = console

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${API}/status`,
    handler: route(async (request, response) => {
      if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed(response, 'GET, HEAD')
      const selection = selectionOf(ctx, config)
      let engines
      try {
        engines = await speech.status()
      } catch (error) {
        engines = {
          edge: { available: true, voice: config.edgeVoice, voices: [], detail: 'Edge TTS, online' },
          qwen: {
            available: false,
            voice: config.qwenSpeaker,
            voices: [],
            detail: 'Local engine unavailable',
            error: String(error?.message ?? error),
          },
        }
      }
      const payload = {
        ok: true,
        version: '1.0.0',
        model: selection
          ? { provider: selection.provider, model: selection.model, source: selection.source }
          : null,
        modes: Object.keys(MODES),
        engines,
        limits: { maxInputChars: 6000, maxSpeechChars: 2600 },
      }
      if (request.method === 'HEAD') {
        response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        response.end()
        return
      }
      sendJson(response, 200, payload)
    }),
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${API}/chat`,
    handler: route(async (request, response) => {
      if (request.method !== 'POST') return methodNotAllowed(response, 'POST')
      const body = await readJson(request, 256 * 1024)
      const mode = String(body.mode ?? '')
      if (!MODES[mode]) return sendError(response, 400, 'Unknown practice mode.')
      if (!Array.isArray(body.messages) || body.messages.length === 0) {
        return sendError(response, 400, 'A message is required.')
      }
      const llm = ctx.get('llm')
      const selection = selectionOf(ctx, config)
      if (!llm?.stream) return sendError(response, 503, 'The model service is not available in this profile.')
      if (!selection?.provider || !selection?.model) {
        return sendError(response, 503, 'Choose a default model in Harness before starting a conversation.')
      }
      let messages
      try {
        messages = prepareMessages(mode, body.messages)
      } catch (error) {
        return sendError(response, error?.status ?? 400, String(error?.message ?? error))
      }
      messages = messages.map(message =>
        message.role === 'assistant'
          ? {
              ...message,
              id: randomUUID(),
              source: {
                kind: 'model',
                provider: selection.provider,
                model: selection.model,
                replayState: undefined,
              },
            }
          : message,
      )

      const modeConfig = MODES[mode]
      const controller = new AbortController()
      let clientGone = false
      const onClose = () => {
        if (!response.writableEnded) {
          clientGone = true
          controller.abort()
        }
      }
      response.on('close', onClose)
      request.on('aborted', onClose)

      response.writeHead(200, {
        'content-type': 'application/x-ndjson; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        'x-accel-buffering': 'no',
        connection: 'keep-alive',
      })
      response.flushHeaders?.()
      writeNdjson(response, {
        type: 'meta',
        mode,
        model: selection.model,
        provider: selection.provider,
      })

      let text = ''
      let finishReason
      try {
        const maxTokens = Math.min(
          1600,
          Math.max(120, Number(config.maxReplyTokens) || modeConfig.maxTokens),
        )
        const stream = llm.stream({
          provider: selection.provider,
          model: selection.model,
          system: modeConfig.system,
          messages,
          temperature: modeConfig.temperature,
          maxTokens,
          signal: controller.signal,
        })
        for await (const chunk of stream) {
          if (chunk.type === 'text-delta') {
            text += chunk.text
            writeNdjson(response, { type: 'delta', text: chunk.text })
          }
          if (chunk.type === 'finish') {
            finishReason = chunk.reason
            if (chunk.reason?.kind === 'error') {
              throw new Error(chunk.reason.failure?.message ?? 'The model request failed.')
            }
            if (chunk.reason?.kind === 'aborted') {
              throw Object.assign(new Error('The model request was canceled.'), { aborted: true })
            }
          }
        }
        if (!finishReason) throw new Error('The model returned an incomplete reply.')
        if (!text.trim()) throw new Error('The model returned an empty reply.')

        let finalText = text.trim()
        if (mode === 'polish') {
          const normalized = normalizePolishOutput(finalText)
          if (normalized && normalized !== finalText) {
            finalText = normalized
            writeNdjson(response, { type: 'replace', text: finalText, reason: 'format' })
          }
        }

        if (containsNonEnglishScript(finalText)) {
          writeNdjson(response, { type: 'refining' })
          try {
            const repaired = await repairEnglish({
              llm,
              selection,
              text: finalText,
              signal: controller.signal,
              maxTokens: mode === 'polish' ? 520 : maxTokens,
            })
            if (repaired && !containsNonEnglishScript(repaired)) {
              finalText = mode === 'polish' ? normalizePolishOutput(repaired) : repaired
              writeNdjson(response, { type: 'replace', text: finalText, reason: 'english' })
            } else {
              finalText = fallbackEnglish(mode)
              writeNdjson(response, { type: 'replace', text: finalText, reason: 'english-fallback' })
            }
          } catch (error) {
            if (error?.aborted || controller.signal.aborted) throw error
            logger.warn?.('[dsh-learn-english] English repair failed:', error?.message ?? error)
            finalText = fallbackEnglish(mode)
            writeNdjson(response, { type: 'replace', text: finalText, reason: 'english-fallback' })
          }
        }

        writeNdjson(response, {
          type: 'done',
          text: finalText,
          model: selection.model,
          provider: selection.provider,
        })
      } catch (error) {
        if (!clientGone && !controller.signal.aborted) {
          writeNdjson(response, { type: 'error', message: friendlyError(error) })
        }
      } finally {
        response.removeListener('close', onClose)
        request.removeListener('aborted', onClose)
        if (!response.writableEnded && !response.destroyed) response.end()
      }
    }),
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${API}/tts`,
    handler: route(async (request, response) => {
      if (request.method !== 'POST') return methodNotAllowed(response, 'POST')
      const body = await readJson(request, 96 * 1024)
      const engine = String(body.engine ?? '')
      const speechText = toSpeechText(String(body.text ?? ''))
      if (!speechText) return sendError(response, 400, 'There is no text to speak.')
      if (speechText.length > 2600) return sendError(response, 413, 'This reply is too long for one audio clip.')

      const controller = new AbortController()
      let clientGone = false
      const onClose = () => {
        if (!response.writableEnded) {
          clientGone = true
          controller.abort()
        }
      }
      response.on('close', onClose)
      request.on('aborted', onClose)

      try {
        const result = await speech.synthesize({
          engine,
          text: speechText,
          voice: body.voice,
          rate: body.rate,
          signal: controller.signal,
        })
        if (clientGone || response.destroyed) return
        const audio = await readFile(result.file)
        response.writeHead(200, {
          'content-type': result.contentType,
          'content-length': audio.length,
          'cache-control': 'private, max-age=86400',
          'x-tts-engine': result.engine,
          'x-tts-voice': result.voice,
          'x-tts-cached': result.cached ? '1' : '0',
        })
        response.end(audio)
      } catch (error) {
        if (!clientGone && !controller.signal.aborted) {
          logger.warn?.(`[dsh-learn-english] ${engine || 'speech'} synthesis failed:`, error?.message ?? error)
          sendError(response, Number.isInteger(error?.status) ? error.status : 502, friendlyError(error))
        }
      } finally {
        response.removeListener('close', onClose)
        request.removeListener('aborted', onClose)
      }
    }),
  }))
}
