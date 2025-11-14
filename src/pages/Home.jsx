import { useEffect, useRef, useState } from 'react'
import WaterDropBall from '../components/WaterDropBall.jsx'
import DanmuStream from '../components/DanmuStream.jsx'
import MoodModal from '../components/MoodModal.jsx'
import { addSession, formatDateStr } from '../utils/storage.js'
import styles from './Home.module.css'

export default function Home() {
  const [minutes, setMinutes] = useState(10)
  const [running, setRunning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [showMood, setShowMood] = useState(false)
  const [showSliderValue, setShowSliderValue] = useState(false) // 新增状态来控制滑块值的显示
  const timerRef = useRef(null)
  const panelRef = useRef(null)
  const rafRef = useRef(null)
  const targetRef = useRef({ dx: 0, dy: 0 })
  const currentRef = useRef({ dx: 0, dy: 0 })

  useEffect(() => {
    if (!running) return
    const totalSeconds = minutes * 60
    setSecondsLeft(totalSeconds)
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          setRunning(false)
          setShowMood(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [running, minutes])

  function start() {
    setRunning(true)
    setSecondsLeft(minutes * 60)
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current)
    setRunning(false)
    setSecondsLeft(0)
  }

  function handleMoodConfirm({ mood, note }) {
    const now = new Date()
    addSession({
      date: formatDateStr(now),
      durationMinutes: minutes,
      mood,
      note: note || '',
      timestamp: now.toISOString(),
    })
    setShowMood(false)
  }

  const display = formatTime(secondsLeft)

  function animate() {
    const cur = currentRef.current
    const tar = targetRef.current
    cur.dx += (tar.dx - cur.dx) * 0.15
    cur.dy += (tar.dy - cur.dy) * 0.15
    const warp = Math.min(1, Math.sqrt(cur.dx * cur.dx + cur.dy * cur.dy))
    if (panelRef.current) {
      panelRef.current.style.setProperty('--dx', String(cur.dx))
      panelRef.current.style.setProperty('--dy', String(cur.dy))
      panelRef.current.style.setProperty('--warp', String(warp))
    }
    if (Math.abs(tar.dx - cur.dx) > 0.001 || Math.abs(tar.dy - cur.dy) > 0.001) {
      rafRef.current = requestAnimationFrame(animate)
    } else {
      rafRef.current = null
    }
  }

  function handleMouseMove(e) {
    const el = panelRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width - 0.5
    const ny = (e.clientY - rect.top) / rect.height - 0.5
    targetRef.current = { dx: nx * 0.8, dy: ny * 0.8 }
    if (!rafRef.current) rafRef.current = requestAnimationFrame(animate)
  }

  function handleMouseLeave() {
    targetRef.current = { dx: 0, dy: 0 }
    if (!rafRef.current) rafRef.current = requestAnimationFrame(animate)
  }

  return (
    <div className="home-page">
      <DanmuStream />
      <section className="breathing-section">
        <div
          ref={panelRef}
          className={styles.glassPanel}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <div className={styles.title}>呼吸冥想</div>
          <div className={styles.ballWrap}>
            <WaterDropBall running={running} minutes={minutes} showSliderValue={showSliderValue} />
          </div>
          <div className={styles.controls}>
            {!running ? (
              <>
                <div className={styles.sliderCapsule}>
                  <span className={styles.sliderMinLabel}>5分钟</span>
                  <input
                    type="range"
                    min={5}
                    max={40}
                    step={1}
                    value={minutes}
                    onChange={(e) => setMinutes(parseInt(e.target.value))}
                  />
                  <span className={styles.sliderMaxLabel}>40分钟</span>
                </div>
              </>
            ) : (
              <div className={styles.progress} title={display}>
                <div className={styles.progressFill} style={{ width: `${(secondsLeft / (minutes * 60)) * 100}%` }} />
              </div>
            )}
          </div>
          <div className={styles.actions}>
            {!running ? (
              <button className={`btn-primary ${styles.actionBtn}`} onClick={start}>开始冥想</button>
            ) : (
              <button className="btn-secondary" onClick={stop}>结束</button>
            )}
          </div>
        </div>
      </section>
      <MoodModal visible={showMood} onCancel={() => setShowMood(false)} onConfirm={handleMoodConfirm} />
    </div>
  )
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
