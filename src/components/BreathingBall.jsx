import { useEffect, useRef, useState } from 'react'

// 4-7-8 呼吸法：吸气4秒、屏息7秒、呼气8秒
const PHASES = [
  { key: 'inhale', label: '吸气', seconds: 4 },
  { key: 'hold', label: '屏息', seconds: 7 },
  { key: 'exhale', label: '呼气', seconds: 8 },
]

function easeInOutSine(t) {
  // t: 0-1
  return -(Math.cos(Math.PI * t) - 1) / 2
}

export default function BreathingBall({ running, minutes, showSliderValue }) {
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(PHASES[0].seconds)
  const [scale, setScale] = useState(0.9)
  const rafRef = useRef(null)
  const phaseStartRef = useRef(performance.now())

  useEffect(() => {
    // 重置到吸气阶段
    setPhaseIndex(0)
    setSecondsLeft(PHASES[0].seconds)
    phaseStartRef.current = performance.now()
    setScale(0.9)
  }, [running])

  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }

    const tick = (now) => {
      const current = PHASES[phaseIndex]
      const elapsed = (now - phaseStartRef.current) / 1000
      const t = Math.max(0, Math.min(elapsed / current.seconds, 1))

      // 倒计时（向上取整，避免显示0之前的突兀）
      const left = Math.ceil(current.seconds - elapsed)
      setSecondsLeft(left > 0 ? left : 0)

      // 平滑缩放范围（降低最大尺寸，更舒适）
      const minScale = 0.80
      const maxScale = 1.20
      const e = easeInOutSine(t)
      let s = 1
      if (current.key === 'inhale') {
        s = minScale + (maxScale - minScale) * e
      } else if (current.key === 'hold') {
        // 维持最大值，加入轻微的呼吸抖动，提升“活”感
        s = maxScale + 0.01 * Math.sin(now / 500)
      } else if (current.key === 'exhale') {
        s = maxScale - (maxScale - minScale) * e
      }
      setScale(s)

      if (elapsed >= current.seconds) {
        // 切换到下一个阶段
        setPhaseIndex((p) => (p + 1) % PHASES.length)
        phaseStartRef.current = now
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [running, phaseIndex])

  const current = PHASES[phaseIndex]

  return (
    <div className="breathing">
      <div
        className="ball"
        style={{ transform: `scale(${scale})` }}
        aria-label="breathing ball"
      >
        <div className="ball-content">
          <div className="phase">
            {!running ? `${minutes} 分钟` : current.label}
          </div>
        </div>
      </div>
    </div>
  )
}