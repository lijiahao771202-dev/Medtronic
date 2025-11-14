let audioCtx = null
let activeSources = []
let currentPlayToken = 0

const defaultPauseMap = {
  '，': 350, '、': 350, '；': 350, ',': 350, ';': 350,
  '。': 700, '.': 700,
  '？': 900, '?': 900,
  '！': 900, '!': 900,
  '：': 500, ':': 500,
  '\n': 1200
}

function segmentsFromText(text, opts = {}) {
  const s = (text || '').trim()
  if (!s) return []
  const tokens = []
  const re = /(\[pause\s*:\s*(\d+(?:\.\d+)?)\s*(ms|s)?\s*\])|(\[rate\s*:\s*([+\-]?\d+(?:\.\d+)?)\s*(%|x)?\s*\])|([，、；,;。.!?？！：:])|(\n)|([^，、；,;。.!?？！：:\n\[]+)/gi
  let match
  while ((match = re.exec(s)) !== null) {
    const [full, pauseCmd, pauseNum, pauseUnit, rateCmd, rateNum, rateUnit, punct, newline, textChunk] = match
    if (pauseCmd) tokens.push({ type: 'pause_cmd', value: { num: parseFloat(pauseNum), unit: (pauseUnit || 'ms').toLowerCase() } })
    else if (rateCmd) tokens.push({ type: 'rate_cmd', value: { num: parseFloat(rateNum), unit: (rateUnit || '').toLowerCase() } })
    else if (punct) tokens.push({ type: 'punct', value: punct })
    else if (newline) tokens.push({ type: 'newline', value: '\n' })
    else if (textChunk) tokens.push({ type: 'text', value: textChunk })
  }
  const segs = []
  let currentPhrase = ''
  let currentRateStr = typeof opts.defaultRateStr === 'string' ? opts.defaultRateStr : '+0%'
  let currentPitchStr = typeof opts.defaultPitchStr === 'string' ? opts.defaultPitchStr : '+0Hz'
  const pushAudioIfNeeded = () => {
    const phrase = currentPhrase.trim()
    if (phrase) {
      segs.push({ type: 'audio', phrase, rateStr: currentRateStr, pitchStr: currentPitchStr })
      currentPhrase = ''
    }
  }
  const pushPause = (ms) => {
    const pauseMs = Math.max(0, ms | 0)
    if (pauseMs <= 0) return
    const last = segs[segs.length - 1]
    if (last && last.type === 'pause') last.pauseMs += pauseMs
    else segs.push({ type: 'pause', pauseMs })
  }
  for (const t of tokens) {
    if (t.type === 'text') currentPhrase += t.value
    else if (t.type === 'rate_cmd') {
      let percent
      if (t.value.unit === '%') percent = t.value.num
      else { const ratio = t.value.num; percent = (ratio - 1) * 100 }
      const rounded = Math.round(percent)
      currentRateStr = `${rounded >= 0 ? '+' : ''}${rounded}%`
    } else if (t.type === 'punct') {
      currentPhrase += t.value
      const pms = defaultPauseMap[t.value] || 0
      pushAudioIfNeeded()
      pushPause(pms)
    } else if (t.type === 'newline') {
      pushAudioIfNeeded()
      const pms = defaultPauseMap['\n'] || 0
      pushPause(pms)
    } else if (t.type === 'pause_cmd') {
      pushAudioIfNeeded()
      let ms = 0
      if (t.value.unit === 's') ms = Math.round(t.value.num * 1000)
      else ms = Math.round(t.value.num)
      pushPause(ms)
    }
  }
  pushAudioIfNeeded()
  return segs
}

function wsFetchBufferForPhrase(phrase, { voice, rateStr, pitchStr }) {
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket('ws://localhost:8008')
      ws.binaryType = 'arraybuffer'
      const chunks = []
      ws.onopen = () => { ws.send(JSON.stringify({ text: phrase, voice, rate: rateStr, pitch: pitchStr })) }
      ws.onmessage = (event) => { if (event.data instanceof ArrayBuffer) chunks.push(new Uint8Array(event.data)) }
      ws.onerror = reject
      ws.onclose = async () => {
        try {
          const total = chunks.reduce((sum, u8) => sum + u8.byteLength, 0)
          const merged = new Uint8Array(total)
          let offset = 0
          for (const u8 of chunks) { merged.set(u8, offset); offset += u8.byteLength }
          const arrayBuffer = merged.buffer
          if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
          if (audioCtx.state === 'suspended') { try { await audioCtx.resume() } catch {} }
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
          resolve(audioBuffer)
        } catch (e) { reject(e) }
      }
    } catch (e) { reject(e) }
  })
}

export function stopSpeaking() {
  activeSources.forEach(s => { try { s.stop() } catch {} })
  activeSources = []
  // 保留现有 AudioContext，避免后续连接出现跨上下文错误
  // 如需暂停请使用 pauseSpeaking()
}

export function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  return audioCtx
}

export async function pauseSpeaking() {
  if (audioCtx && audioCtx.state !== 'closed') { try { await audioCtx.suspend() } catch {} }
}

export async function resumeSpeaking() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (audioCtx.state === 'suspended') { try { await audioCtx.resume() } catch {} }
}

export async function speakGuided(textToSpeak, opts = {}) {
  activeSources.forEach(s => { try { s.stop() } catch {} })
  activeSources = []
  if (!textToSpeak) return
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (audioCtx.state === 'suspended') { try { await audioCtx.resume() } catch {} }
  const myToken = ++currentPlayToken
  const rateStr = typeof opts.rateStr === 'string' ? opts.rateStr : '-10%'
  const pitchStr = typeof opts.pitchStr === 'string' ? opts.pitchStr : '+0Hz'
  const voice = opts.voice || 'zh-CN-XiaoxiaoNeural'
  const segs = segmentsFromText(textToSpeak, { defaultRateStr: rateStr, defaultPitchStr: pitchStr })
  if (!segs.length) return
  const buffersPromises = new Array(segs.length).fill(null)
  const startAt0 = audioCtx.currentTime + 0.25
  let scheduledStart = startAt0
  const prefetchDepth = 2
  let firstStarted = false
  for (let i = 0, k = 0; i < segs.length && k < prefetchDepth; i++) {
    if (segs[i].type === 'audio') {
      buffersPromises[i] = wsFetchBufferForPhrase(segs[i].phrase, { voice, rateStr: segs[i].rateStr || rateStr, pitchStr: segs[i].pitchStr || pitchStr })
      k++
    }
  }
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]
    if (seg.type === 'pause') { scheduledStart += (seg.pauseMs || 0) / 1000; continue }
    if (!buffersPromises[i]) buffersPromises[i] = wsFetchBufferForPhrase(seg.phrase, { voice, rateStr: seg.rateStr || rateStr, pitchStr: seg.pitchStr || pitchStr })
    const buffer = await buffersPromises[i]
    if (myToken !== currentPlayToken) return
    const source = audioCtx.createBufferSource()
    source.buffer = buffer
    if (opts.analyser) {
      try {
        source.connect(opts.analyser)
        opts.analyser.connect(audioCtx.destination)
      } catch {}
    } else {
      source.connect(audioCtx.destination)
    }
    try { source.start(scheduledStart) } catch { source.start(); scheduledStart = audioCtx.currentTime }
    if (!firstStarted) {
      firstStarted = true
      try { typeof opts.onReady === 'function' && opts.onReady() } catch {}
    }
    activeSources.push(source)
    scheduledStart += buffer.duration
    let k = 0
    for (let j = i + 1; j < segs.length && k < prefetchDepth; j++) {
      if (segs[j].type === 'audio' && !buffersPromises[j]) {
        buffersPromises[j] = wsFetchBufferForPhrase(segs[j].phrase, { voice, rateStr: segs[j].rateStr || rateStr, pitchStr: segs[j].pitchStr || pitchStr })
        k++
      }
    }
  }
}

export async function fetchAudioBuffer(phrase, opts = {}) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  return wsFetchBufferForPhrase(phrase, { voice: opts.voice || 'zh-CN-XiaoxiaoNeural', rateStr: opts.rateStr || '-10%', pitchStr: opts.pitchStr || '+0Hz' })
}

export function beginPlaybackSession() {
  currentPlayToken += 1
  return currentPlayToken
}

export function isActiveToken(token) {
  return token === currentPlayToken
}

export function speakWebSpeech(phrase, opts = {}) {
  return new Promise((resolve) => {
    try {
      const synth = window.speechSynthesis
      if (!synth) return resolve()
      const u = new SpeechSynthesisUtterance(phrase)
      const lang = opts.lang || 'zh-CN'
      const voices = synth.getVoices() || []
      const v = voices.find(v => (v.lang || '').toLowerCase().startsWith(lang.toLowerCase()))
      if (v) u.voice = v
      // convert rateStr like '+10%' to ratio
      let rate = 1
      const r = (opts.rateStr || '').trim()
      if (r.endsWith('%')) {
        const n = parseFloat(r)
        rate = Math.max(0.5, Math.min(2, 1 + n/100))
      }
      u.rate = rate
      u.onend = () => resolve()
      u.onerror = () => resolve()
      try { synth.speak(u) } catch { resolve() }
    } catch { resolve() }
  })
}
