import { useMemo, useState } from 'react'
import { getSessions, getSessionsByMonth } from '../utils/storage.js'

export default function Stats() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1) // 1-12

  const sessions = useMemo(() => getSessionsByMonth(year, month), [year, month])
  const totals = useMemo(() => calcTotals(sessions), [sessions])
  const calendar = useMemo(() => buildCalendar(year, month), [year, month])

  function prevMonth() {
    const d = new Date(year, month - 2, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
  }

  function nextMonth() {
    const d = new Date(year, month, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
  }

  const meditatedDays = new Set(sessions.map(s => new Date(s.date).getDate()))
  const moodCounts = countMoods(sessions)

  return (
    <div className="stats-page">
      <section className="month-switch glass-card">
        <button onClick={prevMonth}>上个月</button>
        <h3>{year}年 {month}月</h3>
        <button onClick={nextMonth}>下个月</button>
      </section>

      <section className="calendar glass-card">
        <div className="week-header">
          {['一','二','三','四','五','六','日'].map(d => (
            <div key={d} className="cell head">周{d}</div>
          ))}
        </div>
        <div className="grid">
          {calendar.map((cell, idx) => (
            <div key={idx} className={cell ? 'cell' : 'cell empty'}>
              {cell ? (
                <div className={meditatedDays.has(cell) ? 'day meditated' : 'day'}>
                  <span>{cell}</span>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="summary glass-card">
        <div className="summary-item">
          <div className="label">本月冥想总时长</div>
          <div className="value">{totals.totalMinutes} 分钟</div>
        </div>
        <div className="summary-item">
          <div className="label">本月冥想天数</div>
          <div className="value">{totals.days} 天</div>
        </div>
      </section>

      <section className="mood-tracking glass-card">
        <h4>心情统计</h4>
        <div className="mood-list">
          {Object.entries(moodCounts).map(([mood, count]) => (
            <div key={mood} className="mood-chip">
              <span>{mood}</span>
              <span className="count">{count}</span>
            </div>
          ))}
          {Object.keys(moodCounts).length === 0 && (
            <div className="empty-tip">本月暂无心情记录</div>
          )}
        </div>
      </section>

      <section className="history glass-card">
        <h4>历史记录（最新10条）</h4>
        <ul>
          {getSessions().slice(-10).reverse().map((s, i) => (
            <li key={i} className="history-item">
              <span>{s.date}</span>
              <span className="split">·</span>
              <span>{s.durationMinutes} 分钟</span>
              <span className="split">·</span>
              <span>{s.mood}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function calcTotals(list) {
  const totalMinutes = list.reduce((sum, s) => sum + (s.durationMinutes || 0), 0)
  const days = new Set(list.map(s => s.date)).size
  return { totalMinutes, days }
}

function countMoods(list) {
  const map = {}
  list.forEach(s => {
    if (!s.mood) return
    map[s.mood] = (map[s.mood] || 0) + 1
  })
  return map
}

// 构建当月日历（从周一开始），返回长度为 42 的数组（6周 * 7天）
function buildCalendar(year, month) {
  const first = new Date(year, month - 1, 1)
  const firstDay = first.getDay() // 0-6, 周日为0
  const daysInMonth = new Date(year, month, 0).getDate()

  // 使周一为第一列
  const offset = (firstDay === 0 ? 6 : firstDay - 1)
  const cells = new Array(42).fill(null)
  for (let i = 0; i < daysInMonth; i++) {
    cells[offset + i] = i + 1
  }
  return cells
}