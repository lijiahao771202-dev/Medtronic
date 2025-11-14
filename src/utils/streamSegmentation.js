export function createSegmenter(opts = {}) {
  let buf = ''
  let rateStr = typeof opts.defaultRateStr === 'string' ? opts.defaultRateStr : '-10%'
  let pitchStr = typeof opts.defaultPitchStr === 'string' ? opts.defaultPitchStr : '+0Hz'
  const punctOn = opts && typeof opts.enablePunctPause === 'boolean' ? opts.enablePunctPause : true
  const toAsciiDigits = (s) => s.replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFF10 + 0x30))
  const cnDigitMap = { '零':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9 }
  const cnNumToArabic = (s) => {
    if (!s) return ''
    s = s.replace(/\s+/g, '')
    if (s.includes('十')) {
      const [tensRaw, onesRaw] = s.split('十')
      const tens = tensRaw ? (cnDigitMap[tensRaw] ?? 0) : 1
      const ones = onesRaw ? (cnDigitMap[onesRaw] ?? 0) : 0
      const v = tens * 10 + ones
      return String(v)
    }
    const v = cnDigitMap[s]
    return typeof v === 'number' ? String(v) : ''
  }
  const normalizeForSeg = (s) => {
    let x = s || ''
    x = x.replace(/[\u200B\u200C\u200D\uFEFF\u00A0]/g, ' ')
    x = toAsciiDigits(x)
    x = x.replace(/([\[\uFF3B\u3010\(\uFF08\{\uFF5B]\s*pause\s*[:\uFF1A]\s*)([一二两三四五六七八九十]+)\s*(秒)/gi, (m, pre, num, unit) => pre + cnNumToArabic(num) + unit)
    return x
  }
  return {
    push(chunk) {
      buf += normalizeForSeg(chunk)
      const out = []
      const re = /([\[\uFF3B\u3010\(\uFF08\{\uFF5B]pause\s*[:\uFF1A]\s*([0-9\uFF10-\uFF19]+(?:\.[0-9\uFF10-\uFF19]+)?)\s*(ms|s|秒)?\s*[\]\uFF3D\u3011\)\uFF09\}\uFF5D])|([\[\uFF3B\u3010\(\uFF08\{\uFF5B]rate\s*[:\uFF1A]\s*([+\-]?[0-9\uFF10-\uFF19]+(?:\.[0-9\uFF10-\uFF19]+)?)\s*(%|x)?\s*[\]\uFF3D\u3011\)\uFF09\}\uFF5D])|([，、；,;。.!?？！：:…])|(\n)/gi
      let m
      let lastIndex = 0
      while ((m = re.exec(buf)) !== null) {
        const i = m.index
        if (i > lastIndex) {
          const phrase = buf.slice(lastIndex, i).trim()
          if (phrase) out.push({ type: 'audio', phrase, rateStr, pitchStr })
        }
        if (m[1]) {
          const num = parseFloat(toAsciiDigits(m[2]))
          const unitRaw = (m[3] || '').toLowerCase()
          if (!unitRaw) {
          } else {
            const ms = (unitRaw === 's' || unitRaw === '秒') ? Math.round(num * 1000) : Math.round(num)
            out.push({ type: 'pause', pauseMs: ms })
          }
        } else if (m[4]) {
          const unit = (m[6] || '').toLowerCase()
          const num = parseFloat(toAsciiDigits(m[5]))
          let pct
          if (unit === '%') pct = num
          else { pct = (num - 1) * 100 }
          const r = Math.round(pct)
          rateStr = `${r >= 0 ? '+' : ''}${r}%`
        } else {
          const pms = punctOn ? { '，':350,'、':350,'；':350,',':350,';':350,'。':700,'.':700,'？':900,'?':900,'！':900,'!':900,'：':500,':':500,'…':700,'\n':1200 }[m[7]||m[8]] || 0 : 0
          out.push({ type: 'pause', pauseMs: pms })
        }
        lastIndex = re.lastIndex
      }
      buf = buf.slice(lastIndex)
      return out
    },
    flush() {
      buf = normalizeForSeg(buf)
      const out = []
      const re = /([\[\uFF3B\u3010\(\uFF08\{\uFF5B]pause\s*[:\uFF1A]\s*([0-9\uFF10-\uFF19]+(?:\.[0-9\uFF10-\uFF19]+)?)\s*(ms|s|秒)?\s*[\]\uFF3D\u3011\)\uFF09\}\uFF5D])|([\[\uFF3B\u3010\(\uFF08\{\uFF5B]rate\s*[:\uFF1A]\s*([+\-]?[0-9\uFF10-\uFF19]+(?:\.[0-9\uFF10-\uFF19]+)?)\s*(%|x)?\s*[\]\uFF3D\u3011\)\uFF09\}\uFF5D])|([，、；,;。.!?？！：:…])|(\n)/gi
      let m
      let lastIndex = 0
      while ((m = re.exec(buf)) !== null) {
        const i = m.index
        if (i > lastIndex) {
          const phrase = buf.slice(lastIndex, i).trim()
          if (phrase) out.push({ type: 'audio', phrase, rateStr, pitchStr })
        }
        if (m[1]) {
          const num = parseFloat(toAsciiDigits(m[2]))
          const unitRaw = (m[3] || '').toLowerCase()
          if (!unitRaw) {
          } else {
            const ms = (unitRaw === 's' || unitRaw === '秒') ? Math.round(num * 1000) : Math.round(num)
            out.push({ type: 'pause', pauseMs: ms })
          }
        } else if (m[4]) {
          const unit = (m[6] || '').toLowerCase()
          const num = parseFloat(toAsciiDigits(m[5]))
          let pct
          if (unit === '%') pct = num
          else { pct = (num - 1) * 100 }
          const r = Math.round(pct)
          rateStr = `${r >= 0 ? '+' : ''}${r}%`
        } else {
          const pms = punctOn ? { '，':350,'、':350,'；':350,',':350,';':350,'。':700,'.':700,'？':900,'?':900,'！':900,'!':900,'：':500,':':500,'…':700,'\n':1200 }[m[7]||m[8]] || 0 : 0
          out.push({ type: 'pause', pauseMs: pms })
        }
        lastIndex = re.lastIndex
      }
      const tail = buf.slice(lastIndex).trim()
      if (tail) out.push({ type: 'audio', phrase: tail, rateStr, pitchStr })
      buf = ''
      return out
    }
  }
}
