import { useEffect, useRef, useState } from 'react'
import BreathingBall from '../components/BreathingBall.jsx'
import MoodModal from '../components/MoodModal.jsx'
import { addSession, formatDateStr } from '../utils/storage.js'
import styles from './Home.module.css'; // 导入 CSS Modules

export default function Home() {
  const [minutes, setMinutes] = useState(10)
  const [running, setRunning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [showMood, setShowMood] = useState(false)
  const [showSliderValue, setShowSliderValue] = useState(false) // 新增状态来控制滑块值的显示
  const timerRef = useRef(null)

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

  return (
    <div className="home-page">
      <section className="breathing-section">
        <div className={styles.glassPanel}> {/* 应用液态玻璃面板样式 */}
          <BreathingBall running={running} minutes={minutes} showSliderValue={showSliderValue} />

          <div className="controls-inline">
            {!running ? (
              <>
                <input
                  type="range"
                  min={5}
                  max={40}
                  step={1}
                  value={minutes}
                  onChange={(e) => setMinutes(parseInt(e.target.value))}
                  onMouseDown={() => setShowSliderValue(true)} // 按下时显示
                  onMouseUp={() => setShowSliderValue(false)}   // 抬起时隐藏
                  onTouchStart={() => setShowSliderValue(true)} // 触摸开始时显示
                  onTouchEnd={() => setShowSliderValue(false)}   // 触摸结束时隐藏
                />
                {/* {showSliderValue && <div className="range-value">{minutes} 分钟</div>} */}
              </>
            ) : (
              <>
                <div className={styles.progress} title={display}>
                  <div
                    className="progress-fill"
                    style={{ width: `${(secondsLeft / (minutes * 60)) * 100}%` }}
                  />
                </div>
              </>
            )}
          </div>
          <div className="actions">
            {!running ? (
              <button className="btn-primary" onClick={start}>开始冥想</button>
            ) : (
              <button className="btn-secondary" onClick={stop}>结束</button>
            )}
          </div>
        </div> {/* Close glassPanel div */}
      </section>

      <MoodModal
        visible={showMood}
        onCancel={() => setShowMood(false)}
        onConfirm={handleMoodConfirm}
      />
    </div>
  )
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}