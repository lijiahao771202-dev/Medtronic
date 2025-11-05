import { useState, useEffect, useRef } from 'react'
import OpenAI from 'openai';
import NarrationPlayer from '../components/NarrationPlayer.jsx'

export default function Agent() {
  const [prompt, setPrompt] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [systemPrompt, setSystemPrompt] = useState("你是一个冥想脚本生成助手，请根据用户提供的提示词生成一段冥想脚本。");

  // 人声录音（非语音合成）
  const [audioSrc, setAudioSrc] = useState(null)
  const audioRef = useRef(null)
  // 已移除：本地TTS相关引用与配置

  // 本地 TTS 参数：音色、语速、音量
  // 已移除：本地TTS参数（音色、语速、音量）

  // 新增：本地 CosyVoice2 TTS（GPU）集成
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState('中文女')
  const [ttsBusy, setTtsBusy] = useState(false)
  const TTS_BASE = 'http://127.0.0.1:8008'

  const openai = new OpenAI({
    apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com',
    dangerouslyAllowBrowser: true, // 允许在浏览器环境中运行
  });

  async function generateMeditationScript() {
    setLoading(true);
    setError(null);
    setGeneratedText(''); // Clear previous generated text

    try {
      const response = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        stream: false,
      });
      setGeneratedText(response.choices[0].message.content);
    } catch (err) {
      console.error("Error generating meditation script:", err);
      setError("生成冥想脚本失败，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }


  // 预留：接入 Coze 平台 TTS 的示例
  // async function speakWithCoze() {
  //   const res = await fetch('/api/coze-tts', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ text }),
  //   })
  //   const audioBlob = await res.blob()
  //   const url = URL.createObjectURL(audioBlob)
  //   const audio = new Audio(url)
  //   audio.play()
  // }

  // 清理上传的音频 URL
  useEffect(() => {
    return () => {
      if (audioSrc) URL.revokeObjectURL(audioSrc)
    }
  }, [audioSrc])

  // 获取本地 TTS 可用音色列表
  useEffect(() => {
    async function fetchVoices() {
      try {
        const res = await fetch(`${TTS_BASE}/voices`)
        const data = await res.json()
        if (Array.isArray(data.voices)) {
          setVoices(data.voices)
          if (data.voices.length && !data.voices.includes(selectedVoice)) {
            setSelectedVoice(data.voices[0])
          }
        }
      } catch (e) {
        console.warn('获取音色列表失败，使用默认列表', e)
        setVoices(['中文女', '中文男', '英文女', '英文男'])
      }
    }
    fetchVoices()
  }, [])

  async function speakWithCosyVoice() {
    if (!generatedText) return
    setTtsBusy(true)
    try {
      const res = await fetch(`${TTS_BASE}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: generatedText, voice: selectedVoice, mode: 'sft' })
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const wavB64 = data.audio_base64
      const blob = new Blob([Uint8Array.from(atob(wavB64), c => c.charCodeAt(0))], { type: 'audio/wav' })
      const url = URL.createObjectURL(blob)
      setAudioSrc(url)
      if (audioRef.current) {
        audioRef.current.src = url
        try { audioRef.current.currentTime = 0; audioRef.current.play() } catch {}
      }
    } catch (err) {
      console.error('本地 TTS 合成失败：', err)
      setError('本地 TTS 合成失败，请检查服务器是否已启动、模型是否已下载。')
    } finally {
      setTtsBusy(false)
    }
  }


  // 将文本拆分为行：优先按换行拆分；否则按句末标点拆分
  function splitToLines(str) {
    const s = (str || '').trim()
    if (!s) return []
    if (/\r?\n/.test(s)) {
      return s.split(/\r?\n/).map(t => t.trim()).filter(Boolean)
    }
    // 按句末中英文标点拆分（保留标点）
    return s.split(/(?<=[。！？；.!?;])/).map(t => t.trim()).filter(Boolean)
  }


  return (
    <div className="agent-page glass-card">
      <h3>智能体（脚本生成与引导）</h3>
      <p className="tip">在这里，你可以输入提示词让智能体生成冥想脚本。</p>

      <div className="deepseek-generator">
        <h4>系统提示词 (System Prompt):</h4>
        <textarea
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          rows={3}
          placeholder="设置智能体的角色和指令，例如：你是一个冥想脚本生成助手..."
        />
        <h4>用户提示词 (User Prompt):</h4>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={4}
          placeholder="输入你的冥想脚本提示词，例如：生成一段关于放松身心的冥想脚本..."
        />
        <button className="btn-primary" onClick={generateMeditationScript} disabled={loading}>
          {loading ? '生成中...' : '生成冥想脚本'}
        </button>
        {error && <p className="error-message">{error}</p>}
        {generatedText && (
          <div className="generated-script">
            <h4>生成的冥想脚本:</h4>
            <p>{generatedText}</p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
              <label>
                音色：
                <select value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}>
                  {voices.map(v => (<option key={v} value={v}>{v}</option>))}
                </select>
              </label>
              <button className="btn-primary" onClick={speakWithCosyVoice} disabled={ttsBusy}>
                {ttsBusy ? '合成中...' : '用本地 TTS 朗读'}
              </button>
              <audio ref={audioRef} controls style={{ height: 28 }} />
            </div>
          </div>
        )}
      </div>

      <hr /> {/* 分隔线 */}

      <hr />

      <h3>脚本引导</h3>
      {/* 模式提示：已移除所有 TTS 相关功能，当前为“文字引导模式”（无系统语音）。 */}
      <p className="tip">
        当前为“文字引导模式”。如果你在本地另行部署了 TTS，请直接在你的系统中播放生成的文本或将音频接入到本应用外部播放链路。
      </p>
      <NarrationPlayer
        lines={splitToLines(generatedText)}
        charSpeed={50}
        pauseMs={1500}
        // 已移除：本页面触发的语音朗读逻辑
        onStart={() => {
          // 录音模式：开始播放上传的音频
          if (audioRef.current && audioSrc) {
            try { audioRef.current.currentTime = 0; audioRef.current.play() } catch {}
          }
        }}
        onPause={() => {
          // 暂停录音或本地TTS的当前音频
          if (audioRef.current && audioSrc) { try { audioRef.current.pause() } catch {} }
        }}
        onReset={() => {
          // 重置录音或本地TTS
          if (audioRef.current && audioSrc) { try { audioRef.current.pause(); audioRef.current.currentTime = 0 } catch {} }
        }}
      />
    </div>
  )
}