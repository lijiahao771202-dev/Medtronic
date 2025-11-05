// 简单的本地存储工具，用于保存冥想记录

const STORAGE_KEY = 'meditation_sessions'

export function getSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    console.error('读取冥想记录失败', e)
    return []
  }
}

export function addSession(session) {
  const list = getSessions()
  list.push(session)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function getSessionsByMonth(year, month) {
  // month: 1-12
  const list = getSessions()
  return list.filter(s => {
    const d = new Date(s.date)
    return d.getFullYear() === year && (d.getMonth() + 1) === month
  })
}

export function getSessionsByDateStr(dateStr) {
  // dateStr: YYYY-MM-DD
  const list = getSessions()
  return list.filter(s => s.date === dateStr)
}

export function formatDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}