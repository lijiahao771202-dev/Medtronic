import React, { useEffect, useMemo, useState } from 'react'

/**
 * NarrationPlayer
 * 逐字显示一行行文本，每行结束自动停顿，再播放下一行。
 * 不使用语音合成，仅以“引导式文字”的方式呈现节奏。
 */
export default function NarrationPlayer({
  lines = [],
  charSpeed = 50, // 每个字出现的间隔（毫秒）
  pauseMs = 1500, // 每行结束后的停顿（毫秒）
  autoStart = false,
  onDone,
  onPause,
  onReset,
  onStart,
}) {
  const safeLines = useMemo(() => Array.isArray(lines) ? lines.filter(Boolean) : [], [lines])

  const [status, setStatus] = useState(autoStart ? 'playing' : 'idle') // idle | playing | paused | done
  const [lineIndex, setLineIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [display, setDisplay] = useState('')
  // 已移除：语音朗读状态

  // 播放逻辑：当 status === 'playing' 时，根据 charSpeed 逐字显示；
  // 行内显示完成后，如果开启 speakOnStart，则等待该行的语音朗读结束，再等待 pauseMs 进入下一行；否则直接等待 pauseMs 进入下一行。
  useEffect(() => {
    if (status !== 'playing') return

    const currentLine = safeLines[lineIndex] ?? ''

    if (charIndex < currentLine.length) {
      const t = setTimeout(() => {
        setCharIndex((c) => c + 1)
        setDisplay(currentLine.slice(0, charIndex + 1))
      }, charSpeed)
      return () => clearTimeout(t)
    }
  }, [status, safeLines, lineIndex, charIndex, charSpeed, pauseMs, onDone])

  // 当一行文字显示完成后，等待 pauseMs 进入下一行
  useEffect(() => {
    if (status !== 'playing') return
    const currentLine = safeLines[lineIndex] ?? ''
    if (charIndex < currentLine.length) return

    const t = setTimeout(() => {
      if (lineIndex + 1 < safeLines.length) {
        setLineIndex((i) => i + 1)
        setCharIndex(0)
        setDisplay('')
      } else {
        setStatus('done')
        onDone?.()
      }
    }, pauseMs)
    return () => clearTimeout(t)
  }, [status, safeLines, lineIndex, charIndex, pauseMs, onDone])
  // 已移除：开始播放每一行时触发语音朗读的副作用

  function start() {
    if (safeLines.length === 0) return
    setStatus('playing')
    try { onStart?.() } catch {}
  }

  function pause() {
    setStatus('paused')
    onPause?.()
  }

  function reset() {
    setStatus('idle')
    setLineIndex(0)
    setCharIndex(0)
    setDisplay('')
    onReset?.()
  }

  const nextLines = useMemo(() => {
    return safeLines.slice(lineIndex + (display ? 1 : 0), lineIndex + 3)
  }, [safeLines, lineIndex, display])

  return (
    <div className="narration-player">
      <div className="controls" style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        {status !== 'playing' ? (
          <button className="btn-primary" onClick={start} disabled={safeLines.length === 0}>
            {status === 'paused' ? '继续' : '开始引导'}
          </button>
        ) : (
          <button className="btn-secondary" onClick={pause}>暂停</button>
        )}
        <button className="btn-secondary" onClick={reset}>重置</button>
      </div>

      {safeLines.length === 0 ? (
        <p className="tip">请先生成脚本，然后点击“开始引导”。</p>
      ) : (
        <div className="text-area" style={{
          borderRadius: '12px',
          padding: '16px',
          background: 'rgba(255,255,255,0.6)',
          color: '#222',
          minHeight: '120px',
          lineHeight: 1.8,
        }}>
          {/* 当前行（逐字显示） */}
          <div style={{ fontSize: '1.1rem', marginBottom: '6px' }}>
            {display}
            {status === 'playing' && <span className="caret" style={{ display: 'inline-block', width: '10px', background: '#222', marginLeft: '2px', animation: 'blink 1s step-end infinite' }}></span>}
          </div>
          {/* 后续行（淡显，帮助预判） */}
          {nextLines.map((l, idx) => (
            <div key={idx} style={{ opacity: 0.5 }}>{l}</div>
          ))}
        </div>
      )}

      {/* 简单样式 */}
      <style>
        {`
          @keyframes blink { 50% { opacity: 0; } }
          .narration-player .btn-primary, .narration-player .btn-secondary {
            padding: 8px 12px;
            border-radius: 8px;
            border: none;
            cursor: pointer;
          }
        `}
      </style>
    </div>
  )
}