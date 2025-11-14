import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './DanmuStream.module.css'

const priority = [
  '念头像弹幕，来了又走，不执着就会自然飘远～',
  '别抓着念头的弹幕不放，松一松手，它就会悄悄溜走～',
  '念头的弹幕再热闹，不追着看，它就会自己滑出视野～',
  '像对待弹窗弹幕一样，看见念头，不点击、不执着，它就会飘走～',
  '念头像满屏弹幕，你只需轻轻别过眼，不纠结，它便会渐渐消散～',
]

const mindset = [
  '冥想不是控制思绪，是温柔陪伴每一个念头～',
  '接纳此刻的不完美，就是冥想最好的开始',
  '不用逼自己“静下来”，允许心慢慢沉淀',
  '走神不可怕，觉察到走神的瞬间就是进步',
  '带着包容心对待自己，冥想没有“对错”',
  '放下“必须放松”的执念，感受当下就好',
  '思绪像云朵飘来飘去，你只需要静静看着',
  '冥想是与自己对话，不是逃离现实呀',
  '不评判自己的状态，每一次体验都有意义',
  '慢下来，让呼吸成为连接身心的桥梁',
  '好奇地观察念头，不追随也不抗拒',
  '冥想时的“烦躁”，也是值得觉察的信号',
  '不用追求“空性”，接纳当下的一切感受',
  '温柔对待自己，哪怕只有一分钟的专注也很棒',
  '冥想不是“完成任务”，是享受当下的时光',
  '允许身体有不适感，带着觉察与之共处',
  '思绪纷飞也没关系，轻轻拉回呼吸就好',
  '放下期待，冥想的效果会悄悄到来',
  '此刻的你，已经在践行最棒的自我关怀',
  '不比较、不焦虑，专注自己的呼吸节奏',
  '冥想是接纳，不是改变当下的状态',
  '让心像湖面一样，允许涟漪，也会回归平静',
  '带着耐心练习，时间会给你答案',
  '走神是大脑的天性，不用责怪自己呀',
  '冥想时的“不专注”，也是专注的一部分',
  '放下执念，感受呼吸的自然起伏',
  '与自己的身体温柔对话，倾听它的声音',
  '不用刻意“放松”，觉察紧张也是一种放松',
  '每一次冥想都是新的体验，不必复制过去',
  '接纳杂念的存在，它们会慢慢自然消散',
  '冥想是培养觉察力，不是消灭念头',
  '带着善意对待自己，哪怕冥想中多次走神',
  '让呼吸引领你，回到当下这一刻',
  '不急于求成，冥想是一场长期的修行',
  '感受身心的连接，不被思绪带向过去未来',
  '接纳所有情绪，喜悦、烦躁都是生命的体验',
  '冥想时，只需要做“观察者”就好',
  '放下对“完美冥想”的追求，真实就是最好',
  '允许自己有“没状态”的一天，温柔重启就好',
  '冥想是爱自己的方式，慢慢走，不着急',
]

const notes = [
  '选择安静、通风的环境，减少外界干扰',
  '坐姿以舒适为准，腰背挺直但不紧绷',
  '初学者建议从5分钟开始，逐步延长时间',
  '不用刻意憋气，保持自然均匀的呼吸',
  '眼睛可轻闭，也可微睁注视前方固定点',
  '冥想前可以喝少量温水，避免空腹或过饱',
  '穿着宽松舒适的衣物，让身体无束缚感',
  '避免在极度疲惫或情绪崩溃时强行冥想',
  '冥想时身体不适，可轻轻调整姿势再继续',
  '不要对抗杂念，觉察到后轻轻拉回呼吸',
  '冥想后不要立刻起身，慢慢活动手脚和颈部',
  '固定每天练习的时间，形成肌肉记忆',
  '避免在嘈杂、人多的地方进行深度冥想',
  '不用追求特定的“冥想姿势”，舒服就好',
  '冥想时可以垫个薄坐垫，减轻臀部压力',
  '不要用“是否放松”来评判冥想的好坏',
  '初学者可借助引导语或轻音乐辅助练习',
  '冥想时如果犯困，可适当睁大眼睛或调整坐姿',
  '避免在冥想时思考工作、学习等琐事',
  '保持呼吸的自然节奏，不用刻意加深或加快',
  '冥想环境的光线以柔和为宜，避免强光直射',
  '不要强迫自己“必须有感悟”，顺其自然',
  '冥想前可简单拉伸，让身体更舒展',
  '避免佩戴过紧的首饰、眼镜，减少身体束缚',
  '如果冥想中情绪波动大，可暂停休息再继续',
  '不用模仿他人的冥想方式，找到适合自己的',
  '冥想时注意力放在呼吸上，不用关注其他感官',
  '长期练习建议固定一个专属的冥想角落',
  '避免在刚吃完大餐后立刻冥想，影响专注',
  '冥想时如果有外界干扰，接纳它，再拉回呼吸',
  '不要用手机等电子设备辅助，避免分心',
  '坐姿时双脚平放地面，保持身体稳定',
  '冥想的核心是“觉察”，不是“控制”',
  '避免在寒冷或炎热的环境中冥想，影响状态',
  '初学者可先从坐姿冥想开始，再尝试其他姿势',
  '冥想时不要刻意压抑情绪，允许它自然流动',
  '每天练习的时间不用太长，坚持才是关键',
  '冥想后可做简单的记录，追踪自己的状态',
  '避免在冥想时过度关注身体的某个部位',
  '遇到冥想瓶颈时，可暂停1-2天，再重新开始',
]

function pickOne(src) {
  const idx = Math.floor(Math.random() * src.length)
  return src[idx]
}

export default function DanmuStream() {
  const all = useMemo(() => [...priority, ...mindset, ...notes], [])
  const [items, setItems] = useState([])
  const lanesRef = useRef(Math.floor(Math.random() * 2) + 2) // 2-3 条轨道，降低密度
  const nextLaneRef = useRef(0)
  const genRef = useRef(null)
  const priorityIdxRef = useRef(0)
  const recoverRef = useRef(null)

  const makeItem = () => {
    const lanes = lanesRef.current
    const text = priorityIdxRef.current < priority.length
      ? priority[priorityIdxRef.current++]
      : pickOne(all)
    const lane = nextLaneRef.current % lanes
    nextLaneRef.current += 1
    const delay = Math.random() * 0.8
    const dur = 26 + Math.floor(Math.random() * 8)
    const popChance = 0.35
    const popDelay = Math.random() * (dur * 0.35) + dur * 0.35
    return { id: `${Date.now()}-${Math.random()}`, text, lane, delay, dur, pop: Math.random() < popChance, popDelay }
  }

  const pushIfSlot = () => {
    setItems(prev => {
      if (prev.length >= 4) return prev
      const item = makeItem()
      // 安排移除与爆炸时序
      if (item.pop) {
        setTimeout(() => {
          setItems(p => p.map(x => x.id === item.id ? { ...x, pop: true } : x))
        }, item.popDelay * 1000)
        setTimeout(() => {
          setItems(p => p.filter(x => x.id !== item.id))
          // 移除后快速补位，减少留白
          if (!recoverRef.current) recoverRef.current = setTimeout(() => { pushIfSlot(); recoverRef.current = null }, 600)
        }, (item.popDelay + 1.9) * 1000)
      } else {
        setTimeout(() => {
          setItems(p => p.filter(x => x.id !== item.id))
          if (!recoverRef.current) recoverRef.current = setTimeout(() => { pushIfSlot(); recoverRef.current = null }, 600)
        }, (item.delay + item.dur) * 1000)
      }
      return [...prev, item]
    })
  }

  const onClickPop = (id) => {
    setItems(prev => {
      const exists = prev.find(x => x.id === id)
      if (!exists) return prev
      if (exists.pop) return prev
      const updated = prev.map(x => x.id === id ? { ...x, pop: true, popDelay: 0 } : x)
      setTimeout(() => {
        setItems(p => p.filter(x => x.id !== id))
        if (!recoverRef.current) recoverRef.current = setTimeout(() => { pushIfSlot(); recoverRef.current = null }, 600)
      }, 1900)
      return updated
    })
  }

  useEffect(() => {
    const lanes = lanesRef.current
    const initialCount = Math.floor(Math.random() * 3) + 2 // 初始2-4条
    const start = []
    for (let i = 0; i < initialCount; i++) {
      const base = makeItem()
      const lane = i % lanes
      const delay = (i % 2) * 0.6
      const dur = 26 + (i % 6)
      const popChance = 0.30
      const popDelay = Math.random() * (dur * 0.35) + dur * 0.35
      start.push({ ...base, lane, delay, dur, pop: Math.random() < popChance, popDelay })
    }
    setItems(start)
    // 为初始元素安排生命周期与补位
    start.forEach(item => {
      if (item.pop) {
        setTimeout(() => {
          setItems(p => p.map(x => x.id === item.id ? { ...x, pop: true } : x))
        }, item.popDelay * 1000)
        setTimeout(() => {
          setItems(p => p.filter(x => x.id !== item.id))
          if (!recoverRef.current) recoverRef.current = setTimeout(() => { pushIfSlot(); recoverRef.current = null }, 600)
        }, (item.popDelay + 1.9) * 1000)
      } else {
        setTimeout(() => {
          setItems(p => p.filter(x => x.id !== item.id))
          if (!recoverRef.current) recoverRef.current = setTimeout(() => { pushIfSlot(); recoverRef.current = null }, 600)
        }, (item.delay + item.dur) * 1000)
      }
    })

    genRef.current = setInterval(() => {
      pushIfSlot()
    }, 5000 + Math.floor(Math.random() * 3000)) // 5-8s 逐条生成，降低留白

    return () => { if (genRef.current) clearInterval(genRef.current) }
  }, [all])

  useEffect(() => {
    if (recoverRef.current) { clearTimeout(recoverRef.current); recoverRef.current = null }
    if (items.length <= 1) {
      recoverRef.current = setTimeout(() => { pushIfSlot(); recoverRef.current = null }, 800 + Math.floor(Math.random() * 600))
    }
  }, [items])

  const lanes = lanesRef.current
  const rows = Array.from({ length: lanes }, () => [])
  items.forEach(it => { rows[it.lane].push(it) })

  return (
    <div className={styles.container}>
      {rows.map((row, r) => (
        <div className={styles.lane} key={`lane-${r}`}>
          {row.map((it) => (
            <div
              key={it.id}
              className={`${styles.item} ${it.pop ? styles.popNow : ''}`}
              style={{ top: 0, '--md': `${it.dur}s`, '--delay': `${it.delay}s`, '--popDelay': `${it.popDelay || 0}s` }}
              onClick={() => onClickPop(it.id)}
            >
              <span className={styles.content}>{it.text}</span>
              <span className={styles.tooltip}>何必揪着念头的弹幕不放？轻轻松开执念，它自会飘向远方～</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}