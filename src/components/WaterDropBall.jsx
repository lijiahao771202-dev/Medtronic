import { useEffect, useRef, useState } from 'react'
import styles from './WaterDropBall.module.css'

const PHASES = [
  { key: 'inhale', label: '吸气', seconds: 4 },
  { key: 'hold', label: '屏息', seconds: 7 },
  { key: 'exhale', label: '呼气', seconds: 8 },
]

function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2
}

export default function WaterDropBall({ running, minutes, showSliderValue }) {
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(PHASES[0].seconds)
  const [scale, setScale] = useState(0.9)
  const rafRef = useRef(null)
  const phaseStartRef = useRef(performance.now())

  useEffect(() => {
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
      const left = Math.ceil(current.seconds - elapsed)
      setSecondsLeft(left > 0 ? left : 0)

      const minScale = 0.80
      const maxScale = 1.20
      const e = easeInOutSine(t)
      let s = 1
      if (current.key === 'inhale') {
        s = minScale + (maxScale - minScale) * e
      } else if (current.key === 'hold') {
        s = maxScale + 0.01 * Math.sin(now / 500)
      } else if (current.key === 'exhale') {
        s = maxScale - (maxScale - minScale) * e
      }
      setScale(s)

      if (elapsed >= current.seconds) {
        setPhaseIndex((p) => (p + 1) % PHASES.length)
        phaseStartRef.current = now
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [running, phaseIndex])

  const current = PHASES[phaseIndex]

  return (
    <div className={styles.wrap}>
      <div style={{ position: 'relative', transform: `scale(${scale})` }} aria-label="water drop ball">
        <svg className={styles.drop} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="dropFill" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
              <stop offset="45%" stopColor="rgba(255,228,200,0.60)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.14)" />
            </radialGradient>
            <radialGradient id="dropHighlight" cx="35%" cy="25%" r="30%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
            <filter id="edgeGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g filter="url(#edgeGlow)">
            <circle cx="100" cy="100" r="80" fill="url(#dropFill)" stroke="rgba(255,255,255,0.65)" strokeWidth="2" />
            <ellipse cx="78" cy="70" rx="26" ry="20" fill="url(#dropHighlight)" />
          </g>
          <g>
            <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(255,0,0,0.05)" strokeWidth="2" />
            <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(0,255,255,0.05)" strokeWidth="2" />
          </g>
        </svg>
        <div className={styles.content}>
          <div className={styles.label}>{!running ? `${minutes} 分钟` : current.label}</div>
        </div>
      </div>
    </div>
  )
}