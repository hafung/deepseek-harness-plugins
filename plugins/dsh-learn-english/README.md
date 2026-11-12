# Learn English

A private English studio inside DeepSeek Harness. The left-sidebar entry opens a full-height conversation surface, not the main session. Every reply is generated in natural American English, and each finished reply is synthesized by Edge TTS and the local Qwen3-TTS engine.

## Modes

- **Free talk** — Alex is a warm American English conversation partner. The model is instructed to reply only in English, keep the exchange conversational, and model corrections naturally.
- **Polish** — the latest message is *content to rewrite*, never a question to answer. Chinese, mixed language, or rough English is understood first, then expressed as everyday American English. If the input is already natural, it comes back unchanged. The visible output is only the final English version.
- The Host keeps a mode registry in `server/prompts.js`; adding another practice mode means adding one definition there plus its `MODE_ORDER`, `MODE_STYLE`, and dictionary entries in `client.js`.

## Voice

Each completed assistant reply triggers two independent synthesis jobs:

- **Edge TTS** — Microsoft's neural voice service. The Host implements the current `api.msedgeservices.com` WebSocket protocol, the `Sec-MS-GEC` v2 token, and MP3 streaming without an external npm dependency. A small vendored copy of [`ws`](https://github.com/websockets/ws) (MIT) provides the WebSocket upgrade headers. Default voice: `en-US-AvaNeural`.
- **Qwen3-TTS** — the local engine at `D:\DevTools\Qwen3-TTS\engine\qwen_tts.exe` with the 1.7B CustomVoice model. The Host serializes jobs so one CPU-bound synthesis runs at a time, uses `--int8`, and caches WAV files by content. Default speaker: `ryan`.

Edge is generated first and can auto-play. Qwen appears in the same message as soon as it is ready (the first run has to load the model, so it can take about a minute). Both engines can be played, paused, replayed, and downloaded from the message. The voice picker, speed (`0.85×`, `1×`, `1.15×`), and auto-read preference live in the page's settings popover.

Generated audio is cached under `$DSH_HOME/plugin-data/dsh-learn-english/audio`. The cache keeps the most recent 120 clips.

## Conversation storage

Conversations stay on the page and never create or jump to a main Session. The current thread for each mode is kept in browser `localStorage`; the model receives only the recent turns (up to 16) as request context. A Host-side post-check rejects non-English replies: if a non-Latin script or CJK punctuation appears, the reply is silently repaired once, and a safe English fallback is used if repair fails.

## HTTP routes

- `GET /api/plugins/learn-english/status` — current default model, engines, voice catalogs, and limits.
- `POST /api/plugins/learn-english/chat` — NDJSON stream of `meta`, `delta`, `refining`, `replace`, `done`, `error` events.
- `POST /api/plugins/learn-english/tts` — returns `audio/mpeg` (Edge) or `audio/wav` (Qwen).

The chat route is not a Session; it calls the configured default model through the Host `llm` service and is cancelled when the browser aborts the request.

## Configuration

The bundle works without configuration. Values can be overridden on the plugin row in the profile patch:

```yaml
- id: local-learn-english
  config:
    edgeVoice: en-US-AvaNeural
    qwenExe: D:\DevTools\Qwen3-TTS\engine\qwen_tts.exe
    qwenModelDir: D:\DevTools\Qwen3-TTS\models\qwen3-tts-1.7b-customvoice
    qwenSpeaker: ryan
    qwenThreads: 8
    provider: ''
    model: ''
    maxReplyTokens: 800
```

`qwenThreads` defaults to 8, the fastest setting measured on the target machine. Setting `provider` and `model` overrides the default model selection for this page.

## Notes

- Edge TTS is an online service and may change its protocol. The implementation is isolated in `server/edge-tts.js`; a failure is reported in the message's Edge chip without affecting Qwen.
- The local Qwen engine is optional. If the executable or model is missing, the Qwen chip reports `Unavailable`; the page and Edge voice continue to work.
- The vendored `ws` package retains its MIT license in `vendor/ws/LICENSE`.
