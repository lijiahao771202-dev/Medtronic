import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import OpenAI from 'openai'
import { speakGuided, stopSpeaking, getAudioContext, pauseSpeaking, resumeSpeaking } from '../utils/guidedTTS'
import { useRef } from 'react'

const presets = {
  morning: { title: '清晨正念', prompt: '生成一段关于清晨正念的冥想脚本，时长10分钟，在段落间加入 [pause:2s]，在放慢处用 [rate:-10%]。' },
  sleep: { title: '睡前正念', prompt: '生成一段关于睡前正念的冥想脚本，时长15分钟，帮助入睡，在段落间加入 [pause:2s]，在放慢处用 [rate:-10%]。' },
  'work-break': { title: '工作间隙正念', prompt: '生成一段关于工作间隙正念的冥想脚本，时长5分钟，缓解压力，在段落间加入 [pause:2s]，在放慢处用 [rate:-10%]。' },
  emotion: { title: '情绪调节正念', prompt: '生成一段关于情绪调节正念的冥想脚本，时长12分钟，平复焦虑，在段落间加入 [pause:2s]，在放慢处用 [rate:-10%]。' },
  'body-scan': { title: '身体扫描正念', prompt: '生成一段关于身体扫描正念的冥想脚本，时长16分钟，释放紧张，在段落间加入 [pause:2s]，在放慢处用 [rate:-10%]。' },
  'breathing-space': { title: '呼吸空间正念', prompt: '生成一段关于呼吸空间正念的冥想脚本，时长3分钟，重置状态，在段落间加入 [pause:2s]，在放慢处用 [rate:-10%]。' },
  'loving-kindness': { title: '慈悲正念', prompt: '生成一段关于慈悲正念的冥想脚本，时长10分钟，培养善意与同情心，合理使用 [pause:2s] 与 [rate:-10%]。' },
  gratitude: { title: '感恩正念', prompt: '生成一段关于感恩正念的冥想脚本，时长10分钟，专注生活中的美好，合理使用 [pause:2s] 与 [rate:-10%]。' },
}

const systemPrompt = `你是一名冥想脚本生成助手。请用中文生成适合朗读的冥想脚本，语气温柔，结构清晰，长度可供 3–6 分钟朗读。
脚本文本需内嵌以下内联指令以控制停顿与语速：
- [pause:...] 插入停顿（支持毫秒与秒，如 [pause:1500] 或 [pause:2s]）。
- [rate:...] 临时调整语速（支持百分比与倍速，如 [rate:-10%]、[rate:+5%]、[rate:0.9]）。
请合理在段落之间与关键语句后使用 [pause:...]，并在需要强调“放慢”或“略微加快”的句子前使用 [rate:...]。
要求：
1) 用自然标点组织语句；避免过度使用省略号；
2) 段落之间保持流畅，避免生硬的指令堆砌；
3) 最终只输出纯脚本文本，不要附加任何说明或标注。`

export default function GenerateScript() {
  const { type } = useParams()
  const preset = presets[type] || { title: '脚本生成', prompt: '生成一段冥想脚本，长度 5 分钟。' }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [text, setText] = useState('')
  const [showPrompt, setShowPrompt] = useState(false)
  const [promptText, setPromptText] = useState(preset.prompt)
  const canvasRef = useRef(null)
  const analyserRef = useRef(null)
  const rafRef = useRef(null)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [tipIndex, setTipIndex] = useState(0)
  const progressTimerRef = useRef(null)
  const tipTimerRef = useRef(null)

  const attitudes = ['不评判','耐心','初学者心态','信任','不求','接纳','放下']

  const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    baseURL: 'https://api.deepseek.com',
    dangerouslyAllowBrowser: true,
  })

  async function generate() {
    setLoading(true)
    setError(null)
    // 清理上一次动画并停止播放
    cancelAnimationFrame(rafRef.current || 0)
    stopSpeaking()
    // 初始化进度与提示轮播
    setProgress(0)
    clearInterval(progressTimerRef.current)
    clearInterval(tipTimerRef.current)
    progressTimerRef.current = setInterval(() => {
      setProgress(prev => prev < 95 ? Math.min(95, prev + 1) : prev)
    }, 120)
    tipTimerRef.current = setInterval(() => {
      setTipIndex(prev => (prev + 1) % attitudes.length)
    }, 2500)
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: promptText },
      ]
      const res = await openai.chat.completions.create({ model: 'deepseek-chat', messages })
      const content = res.choices?.[0]?.message?.content || ''
      setText(content)
      if (!analyserRef.current) {
        const ctx = getAudioContext()
        analyserRef.current = ctx.createAnalyser()
        analyserRef.current.fftSize = 1024
      }
      // 非阻塞启动播放，立即隐藏加载动画
      speakGuided(content, { voice: 'zh-CN-XiaoxiaoNeural', rateStr: '-10%', pitchStr: '+0Hz', analyser: analyserRef.current, onReady: () => {
        setProgress(100)
        clearInterval(progressTimerRef.current)
        clearInterval(tipTimerRef.current)
        setLoading(false)
      } })
      // start draw loop
      const canvas = canvasRef.current
      if (canvas && analyserRef.current) {
        const ctx2d = canvas.getContext('2d')
        const bufferLength = analyserRef.current.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)
        const draw = () => {
          analyserRef.current.getByteFrequencyData(dataArray)
          ctx2d.clearRect(0,0,canvas.width,canvas.height)
          const barWidth = Math.max(2, (canvas.width / bufferLength) * 1.6)
          let x = 0
          for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i]
            const barHeight = (v / 255) * canvas.height * 0.8
            ctx2d.fillStyle = '#5aa0b3'
            ctx2d.fillRect(x, (canvas.height - barHeight)/2, barWidth, barHeight)
            x += barWidth + 1
          }
          rafRef.current = requestAnimationFrame(draw)
        }
        cancelAnimationFrame(rafRef.current || 0)
        draw()
      }
    } catch (e) {
      setError('生成失败，请稍后再试')
      console.error(e)
      clearInterval(progressTimerRef.current)
      clearInterval(tipTimerRef.current)
      setLoading(false)
    }
  }

  useEffect(() => { generate() }, [type])

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current || 0)
      stopSpeaking()
      clearInterval(progressTimerRef.current)
      clearInterval(tipTimerRef.current)
    }
  }, [])

  return (
    <div className="agent-page" style={{ padding: '12px' }}>
      <h2 className="gen-title">{preset.title}</h2>
      <div className="gen-controls">
        <button className="btn-secondary" onClick={() => setShowPrompt(s => !s)}>{showPrompt ? '收起提示词' : '提示词'}</button>
        {showPrompt && (
          <button className="btn-primary" onClick={generate} disabled={loading}>{loading ? '生成中...' : '用此提示词生成'}</button>
        )}
      </div>
      {showPrompt && (
        <div style={{ maxWidth: 900, width: '80%', margin: '0 auto' }}>
          <textarea rows={4} value={promptText} onChange={e => setPromptText(e.target.value)} style={{ width: '100%', resize: 'vertical' }} />
        </div>
      )}
      <div className="gen-controls">
        <button className="btn-secondary" onClick={async () => { if (paused) { await resumeSpeaking(); setPaused(false) } else { await pauseSpeaking(); setPaused(true) } }}>{paused ? '继续' : '暂停'}</button>
        <button className="btn-secondary" onClick={() => window.history.back()}>返回</button>
      </div>
        {loading && (
          <div className="gen-progress">
            <div className="gen-tip">{attitudes[tipIndex]}</div>
            <div className="bar"><div className="fill" style={{ width: `${progress}%` }} /></div>
          </div>
        )}
        {!loading && (
          <canvas ref={canvasRef} className="waveform" width={800} height={120} />
        )}
        {error && <p className="error-message" style={{ color: 'tomato' }}>{error}</p>}
    </div>
  )
}
