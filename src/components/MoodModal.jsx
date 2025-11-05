import { useState } from 'react'

const MOODS = ['放松', '平静', '专注', '开心', '焦虑', '疲惫']

export default function MoodModal({ visible, onCancel, onConfirm }) {
  const [mood, setMood] = useState('放松')
  const [note, setNote] = useState('')

  if (!visible) return null

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>冥想结束，记录一下此刻的心情</h3>
        <div className="mood-options">
          {MOODS.map(m => (
            <button
              key={m}
              className={m === mood ? 'mood-btn active' : 'mood-btn'}
              onClick={() => setMood(m)}
            >
              {m}
            </button>
          ))}
        </div>
        <textarea
          placeholder="想记录的备注（可选）"
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={3}
        />
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>稍后</button>
          <button className="btn-primary" onClick={() => onConfirm({ mood, note })}>保存</button>
        </div>
      </div>
    </div>
  )
}