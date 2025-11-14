import { useEffect, useRef, useState } from 'react'
import { getAudioContext, fetchAudioBuffer, pauseSpeaking, resumeSpeaking, stopSpeaking, beginPlaybackSession, isActiveToken } from '../utils/guidedTTS'
import { createSegmenter } from '../utils/streamSegmentation'
import { stripInlineDirectives } from '../utils/stripDirectives'
import OpenAI from 'openai'
import styles from './VoiceCall.module.css'

export default function VoiceCall() {
  const defaultPrompt = `你是一位专业的冥想引导（Meditation Guide）脚本作家、资深疗愈师、和富有经验的“节奏导演”。 你的唯一任务是生成高质量的、具有人性化关怀和强烈画面感的、适合 TTS 朗读的中文冥想引导脚本。

核心规则 1：内容质量与人性化关怀（疗愈作家）
这是你的首要标准。文本必须能引导听众进入一个宁静、接纳的想象空间。
• 语气（Tone）：必须是温柔的、包容的、接纳的、绝对不带评判的。
• 画面感（Imagery）：必须使用生动的、感官的词汇（如：温暖、柔软、流淌、蔚蓝、沉静）。你必须引导用户去“想象”、“看到”或“感受”具体的场景或身体感觉。
• 放松引导（Guidance）：你的脚本必须包含有效的放松结构（例如呼吸引导、身体扫描）。
• 核心：正念引导（处理分心）——在脚本中（至少 1–2 次）插入关于“处理走神”的引导：
  1) 告诉听众走神是完全正常的；
  2) 当察觉到走神时不要批评自己；
  3) 温柔地把注意力带回到呼吸或身体感受上。
• 禁止项（Avoid）：绝对禁止使用生硬、机械或书面化的语言；禁止说教。

核心规则 2：节奏与留白（节奏导演）
你必须自主控制脚本的节奏，营造“拟真”的停顿。
• 默认时长（Default Duration）：若未指定总时长，自主决定一个合理的总时长（通常 3–6 分钟）。
• 停顿与文本的比例（Pause Ratio）：脚本必须有大量留白；确保【所有 [pause:...] 的总时长】与【文本朗读时间】大致相当（例如 1:1 或更多）。
• 长停顿（Long Pauses）：在关键节点（如呼吸引导后、身体感受时）策略性使用长停顿（如 [pause:8s]、[pause:10s] 或更长）。
• 指令：必须使用 [pause:...]（支持秒 s 或毫秒 ms）和 [rate:...]（支持百分比或倍速）。

你的内部工作流程（Chain of Thought）：
当收到一个未指定时间的请求时：
1) 分析主题（如“缓解焦虑”）；
2) 设定目标（导演决策）：总时长约 4 分钟；
3) 分配时间（导演决策）：设定 1:1.5 的文稿/停顿比；
4) 撰写脚本（疗愈作家）：撰写高质量文本，包含“呼吸引导”“身体扫描”与“分心提醒”模块；
5) 插入停顿（节奏导演）：将停顿预算（含长停顿）策略性地插入到关键句后；
6) 输出：严格只输出纯脚本文本，不要任何解释或标题。

约束条件：
• 严格使用支持的指令；
• 使用自然标点符号；
• 最终只输出纯脚本文本，不包含任何解释、标题或你的内部计算过程。`
  const [status, setStatus] = useState('连接中')
  const [paused, setPaused] = useState(false)
  const [supportsSR, setSupportsSR] = useState(false)
  const [showPromptEditor, setShowPromptEditor] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState(defaultPrompt)
  const [recognizing, setRecognizing] = useState(false)
  const [followOriginal, setFollowOriginal] = useState(true)
  const canvasRef = useRef(null)
  const orbRef = useRef(null)
  const analyserRef = useRef(null)
  const rafRef = useRef(null)
  const scheduledStartRef = useRef(0)
  const segmenterRef = useRef(createSegmenter({ defaultRateStr: '+0%', defaultPitchStr: '+0Hz', enablePunctPause: true }))
  const recognitionRef = useRef(null)
  const playTokenRef = useRef(0)
  const fallbackUsedRef = useRef(false)
  const localSourcesRef = useRef([])
  const [showText, setShowText] = useState(false)
  const [userTexts, setUserTexts] = useState([])
  const [aiTexts, setAiTexts] = useState([])
  const micAnalyserRef = useRef(null)
  const micStreamRef = useRef(null)
  const micAmpRafRef = useRef(null)
  const micSilenceMsRef = useRef(0)
  const lastFinalRef = useRef('')
  const [proxyDetail, setProxyDetail] = useState({ status: null, error: '' })
  const [orbShift, setOrbShift] = useState({ x: 0, y: 0 })
  const [pauseInfo, setPauseInfo] = useState({ totalMs: 0, remainMs: 0 })
  const driftAccRef = useRef(0)
  const formatPauseLabel = (ms) => {
    const n = Math.max(0, Math.round(ms||0))
    if (n % 1000 === 0) return `[pause:${Math.round(n/1000)}s]`
    return `[pause:${n}ms]`
  }
  const openai = new OpenAI({ apiKey: import.meta.env.VITE_OPENAI_API_KEY, baseURL: 'https://api.deepseek.com', dangerouslyAllowBrowser: true })
  

  useEffect(() => {
    const ctx = getAudioContext()
    analyserRef.current = ctx.createAnalyser()
    analyserRef.current.fftSize = 1024
    scheduledStartRef.current = ctx.currentTime + 0.25
    const draw = () => {
      const a = analyserRef.current
      const bufLen = a.frequencyBinCount
      const arr = new Uint8Array(bufLen)
      a.getByteFrequencyData(arr)
      let energy = 0
      const start = Math.floor(bufLen*0.1), end = Math.floor(bufLen*0.35)
      for (let i=start;i<end;i++) energy += arr[i]
      energy = energy / ((end-start) * 255)
      const scale = 1 + Math.min(0.35, energy * 0.5)
      if (orbRef.current) {
        orbRef.current.style.transform = `scale(${scale})`
      }
      rafRef.current = requestAnimationFrame(draw)
    }
    draw()
    setupSTT()
    try {
      const saved = localStorage.getItem('voicecall-system-prompt')
      if (saved) setSystemPrompt(saved)
      else localStorage.setItem('voicecall-system-prompt', defaultPrompt)
    } catch {}
    const onResize = () => { if (canvasRef.current) { const c = canvasRef.current; const dpr = Math.max(1, Math.floor(window.devicePixelRatio||1)); const rect = c.getBoundingClientRect(); c.width = Math.floor(rect.width*dpr); c.height = Math.floor(rect.height*dpr) } }
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(rafRef.current||0); stopSpeaking(); if (recognitionRef.current) recognitionRef.current.stop() }
  }, [])

  async function waitUntilPointer() {
    const ctx = getAudioContext()
    while (true) {
      const now = ctx.currentTime
      const target = scheduledStartRef.current
      const delay = (target - now - 0.01)
      if (delay <= 0) break
      await new Promise(r => setTimeout(r, Math.min(200, Math.max(10, delay*1000))))
    }
  }

  function setupSTT() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setStatus('语音不可用'); return }
    setSupportsSR(true)
    const recog = new SR()
    recognitionRef.current = recog
    recog.lang = 'zh-CN'
    recog.continuous = true
    recog.interimResults = true
    recog.onstart = () => setStatus('正在聆听')
    recog.onerror = () => { setStatus('语音错误') }
    recog.onend = () => { setStatus('已连接'); setRecognizing(false) }
    recog.onresult = async (e) => {
      let interim = ''
      for (let i=e.resultIndex;i<e.results.length;i++) {
        const r = e.results[i]
        const t = r[0].transcript
        if (r.isFinal) lastFinalRef.current += t
        else interim += t
      }
      if (interim) setStatus('正在聆听')
      if (lastFinalRef.current) {
        const txt = lastFinalRef.current
        lastFinalRef.current = ''
        setUserTexts(v=>[...v,txt])
        await streamLLM(txt)
      }
    }
    setStatus('已连接')
  }

  function stopLocalSources() {
    try {
      localSourcesRef.current.forEach(src => { try { src.stop() } catch {} })
    } catch {}
    localSourcesRef.current = []
  }

  const startMicStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micStreamRef.current = stream
      const ctx = getAudioContext()
      const src = ctx.createMediaStreamSource(stream)
      micAnalyserRef.current = ctx.createAnalyser()
      micAnalyserRef.current.fftSize = 1024
      src.connect(micAnalyserRef.current)
      micSilenceMsRef.current = 0
      const sense = (tsPrev) => {
        const a = micAnalyserRef.current
        const len = a.fftSize
        const arr = new Uint8Array(len)
        a.getByteTimeDomainData(arr)
        let sum = 0
        for (let i=0;i<len;i++) sum += Math.abs(arr[i]-128)/128
        const amp = sum/len
        if (amp > 0.03) micSilenceMsRef.current = 0
        else micSilenceMsRef.current += 16
        if (recognizing && micSilenceMsRef.current > 1500) {
          try { recognitionRef.current && recognitionRef.current.stop() } catch {}
        }
        micAmpRafRef.current = requestAnimationFrame(sense)
      }
      micAmpRafRef.current = requestAnimationFrame(sense)
    } catch (e) {
      // ignore
    }
  }

  const stopMicStream = () => {
    cancelAnimationFrame(micAmpRafRef.current||0)
    const s = micStreamRef.current
    if (s) {
      s.getTracks().forEach(t=>t.stop())
      micStreamRef.current = null
    }
  }

  const toggleMic = async () => {
    if (!supportsSR || !recognitionRef.current) return
    if (!recognizing) {
      setRecognizing(true)
      try { recognitionRef.current.start() } catch {}
      try { await getAudioContext().resume() } catch {}
      await startMicStream()
    } else {
      setRecognizing(false)
      try { recognitionRef.current.stop() } catch {}
      stopMicStream()
    }
  }

  async function streamLLM(text) {
    setStatus('正在回应')
    stopLocalSources()
    stopSpeaking()
    playTokenRef.current = beginPlaybackSession()
    const ctx = getAudioContext()
    try { await ctx.resume() } catch {}
    scheduledStartRef.current = ctx.currentTime + 0.25
    const system = systemPrompt
    try {
      const resp = await fetch('http://localhost:8009/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system, user: text })
      })
      if (!resp.ok) {
        let msg = ''
        try { msg = await resp.text() } catch {}
        setProxyDetail({ status: resp.status||null, error: msg||'' })
        throw new Error('proxy_failed')
      } else {
        setProxyDetail({ status: resp.status||200, error: '' })
      }
      const reader = resp.body.getReader()
      const td = new TextDecoder()
      let acc = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        acc += td.decode(value, { stream: true })
        const parts = acc.split('\n\n')
        acc = parts.pop() || ''
        for (const chunk of parts) {
          const lines = chunk.split('\n')
          let dataLine = lines.find(l=>l.startsWith('data: ')) || ''
          const payload = dataLine.slice(6)
          if (payload === '[DONE]') { setStatus('已连接'); continue }
          try {
            const j = JSON.parse(payload)
            if (j && j.type === 'pause' && typeof j.ms === 'number') {
              scheduledStartRef.current += (j.ms||0)/1000
              setPauseInfo({ totalMs: j.ms||0, remainMs: j.ms||0 })
              const label = formatPauseLabel(j.ms||0)
              setAiTexts(v=>[...v, label])
            } else if (j && j.type === 'content' && j.text) {
              const textChunk = j.text
              setAiTexts(v=>[...v, textChunk])
              const segs = [...segmenterRef.current.push(textChunk)]
              for (const s of segs) {
                if (!isActiveToken(playTokenRef.current)) return
                if (s.type === 'pause') { 
                  scheduledStartRef.current += (s.pauseMs||0)/1000; 
                  setPauseInfo({ totalMs: s.pauseMs||0, remainMs: s.pauseMs||0 })
                  continue 
                }
                const phrase = stripInlineDirectives(s.phrase)
                if (!phrase) continue
                if (/^\s*\d+(?:\.\d+)?\s*(?:ms|s|秒)\s*$/i.test(phrase)) continue
                const buf = await fetchAudioBuffer(phrase, { voice:'zh-CN-XiaoxiaoNeural', rateStr:s.rateStr, pitchStr:s.pitchStr })
                const ctx2 = getAudioContext()
                try { await ctx2.resume() } catch {}
                const src = ctx2.createBufferSource()
                src.buffer = buf
                src.connect(analyserRef.current)
                analyserRef.current.connect(ctx2.destination)
                const targetStart = scheduledStartRef.current
                await waitUntilPointer()
                try { src.start() } catch { src.start() }
                localSourcesRef.current.push(src)
                const actualStart = ctx2.currentTime
                const drift = actualStart - targetStart
                if (Math.abs(drift) > 0.05) {
                  driftAccRef.current += drift
                }
                scheduledStartRef.current = Math.max(targetStart, actualStart) + (buf?.duration || 0)
                setPauseInfo(p => ({ totalMs: 0, remainMs: 0 }))
              }
            }
          } catch {}
        }
      }
      const tailSegs = [...segmenterRef.current.flush()]
      for (const s of tailSegs) {
        if (!isActiveToken(playTokenRef.current)) return
        if (s.type === 'pause') { 
          scheduledStartRef.current += (s.pauseMs||0)/1000; 
          setPauseInfo({ totalMs: s.pauseMs||0, remainMs: s.pauseMs||0 })
          continue 
        }
        const phrase = stripInlineDirectives(s.phrase)
        if (!phrase) continue
        if (/^\s*\d+(?:\.\d+)?\s*(?:ms|s|秒)\s*$/i.test(phrase)) continue
        const buf = await fetchAudioBuffer(phrase, { voice:'zh-CN-XiaoxiaoNeural', rateStr:s.rateStr, pitchStr:s.pitchStr })
        const ctx2 = getAudioContext()
        try { await ctx2.resume() } catch {}
        const src = ctx2.createBufferSource()
        src.buffer = buf
        src.connect(analyserRef.current)
        analyserRef.current.connect(ctx2.destination)
        const targetStart = scheduledStartRef.current
        await waitUntilPointer()
        try { src.start() } catch { src.start(); }
        localSourcesRef.current.push(src)
        const actualStart = ctx2.currentTime
        const drift = actualStart - targetStart
        if (Math.abs(drift) > 0.05) {
          driftAccRef.current += drift
        }
        scheduledStartRef.current = Math.max(targetStart, actualStart) + (buf?.duration || 0)
        setPauseInfo(p => ({ totalMs: 0, remainMs: 0 }))
      }
      setStatus('已连接')
    } catch (e) {
      setStatus('生成连接失败')
      if (!fallbackUsedRef.current) {
        fallbackUsedRef.current = true
        const fallback = '现在，请轻轻闭上眼睛。[pause:1500] 让呼吸自然流动。[pause:1200] 将注意力带到当下。[pause:1200]'
        setAiTexts(v=>[...v, fallback])
        const segs = [...segmenterRef.current.push(fallback)]
        for (const s of segs) {
        if (s.type === 'pause') { const ctxNow = getAudioContext().currentTime; scheduledStartRef.current = Math.max(scheduledStartRef.current, ctxNow) + ((s.pauseMs||0)/1000); continue }
          const phrase = stripInlineDirectives(s.phrase)
          if (!phrase) continue
          const buf = await fetchAudioBuffer(phrase, { voice:'zh-CN-XiaoxiaoNeural', rateStr:s.rateStr, pitchStr:s.pitchStr })
          const ctx2 = getAudioContext()
          try { await ctx2.resume() } catch {}
          const src = ctx2.createBufferSource()
          src.buffer = buf
          src.connect(analyserRef.current)
          analyserRef.current.connect(ctx2.destination)
          const now = ctx2.currentTime
          const startAt = Math.max(now + 0.02, scheduledStartRef.current)
          try { src.start(startAt) } catch { src.start(); scheduledStartRef.current = ctx2.currentTime }
          localSourcesRef.current.push(src)
          scheduledStartRef.current = startAt + (buf?.duration || 0)
        }
      }
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div className={styles.brand}>心愈</div>
        <div className={styles.statusWrap}>
          <span className={styles.statusDot} data-state={status}></span>
          <span className={styles.statusText}>{status}</span>
        </div>
        <div className={styles.actions}>
          <button className="btn-secondary" onClick={()=>setShowPromptEditor(s=>!s)}>提示词</button>
        </div>
      </div>

      <div className={styles.panelWrap}>
        <div className={styles.glassPanel}>
          <div className={styles.topRight}>
            <button className="btn-secondary" onClick={()=>setShowPromptEditor(s=>!s)}>提示词</button>
          </div>
          <div className={styles.panelInner}>
            <div ref={orbRef} className={styles.orb} />
          </div>
          <div className={styles.guideText}>{aiTexts.join('')}</div>
          <div className={styles.panelFooter}>
            {supportsSR && (
              <button className="btn-primary" onPointerDown={async()=>{ if (!recognizing) { setRecognizing(true); try { recognitionRef.current && recognitionRef.current.start() } catch {}; try { await getAudioContext().resume() } catch {}; await startMicStream() } }} onPointerUp={()=>{ if (recognizing) { setRecognizing(false); try { recognitionRef.current && recognitionRef.current.stop() } catch {}; stopMicStream() } }} onPointerLeave={()=>{ if (recognizing) { setRecognizing(false); try { recognitionRef.current && recognitionRef.current.stop() } catch {}; stopMicStream() } }} onPointerCancel={()=>{ if (recognizing) { setRecognizing(false); try { recognitionRef.current && recognitionRef.current.stop() } catch {}; stopMicStream() } }}>按住说话</button>
            )}
            <button className="btn-primary" onClick={()=>{ stopSpeaking(); if (recognitionRef.current) recognitionRef.current.stop(); window.history.back() }}>挂断</button>
          </div>
        </div>
      </div>

      <div className={styles.bottomBar}>
        {pauseInfo.totalMs > 0 && (
          <div className={styles.pauseInfo}>暂停中 {Math.round(pauseInfo.totalMs/1000)}s · 剩余 {Math.max(0, Math.ceil((scheduledStartRef.current - getAudioContext().currentTime)))}s</div>
        )}
        
        {proxyDetail.status && (
          <div className={styles.proxyInfo}>代理 {proxyDetail.status}{proxyDetail.error?` · ${String(proxyDetail.error).slice(0,80)}`:''}</div>
        )}
      </div>

      {showPromptEditor && (
        <div className={styles.promptSheet}>
          <textarea className={styles.promptTextarea} value={systemPrompt} onChange={(e)=>{ setSystemPrompt(e.target.value); try { localStorage.setItem('voicecall-system-prompt', e.target.value) } catch {} }} rows={4} />
        </div>
      )}

      {/* 文本显示移除，保持界面简洁 */}
    </div>
  )
}
