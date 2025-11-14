export function normalizeInlineDirectives(input) {
  let s = input || ''
  // Normalize pause: default to seconds when unit missing
  s = s.replace(/\[\s*pause\s*:\s*(\d+(?:\.\d+)?)\s*\]/gi, (_m, num) => `[${'pause'}:${num}s]`)
  // Normalize pause with Chinese unit
  s = s.replace(/\[\s*pause\s*:\s*(\d+(?:\.\d+)?)\s*(毫秒|ms|秒|s)\s*\]/gi, (_m, num, unit) => {
    const u = /毫秒|ms/i.test(unit) ? 'ms' : 's'
    return `[pause:${num}${u}]`
  })
  // Normalize rate textual descriptors
  s = s.replace(/\[\s*rate\s*:\s*(slow|slower|fast|faster)\s*\]/gi, (_m, word) => {
    const w = word.toLowerCase()
    const map = { slow: '-10%', slower: '-15%', fast: '+10%', faster: '+15%' }
    return `[rate:${map[w] || '-10%'}]`
  })
  // Normalize rate ratio like 0.9 or 1.1
  s = s.replace(/\[\s*rate\s*:\s*(\d+(?:\.\d+)?)\s*\]/gi, (_m, ratio) => {
    const r = parseFloat(ratio)
    if (isFinite(r)) {
      const pct = Math.round((r - 1) * 100)
      const sign = pct >= 0 ? '+' : ''
      return `[rate:${sign}${pct}%]`
    }
    return `[rate:+0%]`
  })
  // Normalize rate with x suffix
  s = s.replace(/\[\s*rate\s*:\s*(\d+(?:\.\d+)?)\s*x\s*\]/gi, (_m, ratio) => {
    const r = parseFloat(ratio)
    const pct = Math.round((r - 1) * 100)
    const sign = pct >= 0 ? '+' : ''
    return `[rate:${sign}${pct}%]`
  })
  // Clamp percentage values to reasonable range
  s = s.replace(/\[\s*rate\s*:\s*([+\-]?\d+)\s*%\s*\]/gi, (_m, n) => {
    let v = parseInt(n, 10)
    if (!isFinite(v)) v = 0
    if (v > 50) v = 50
    if (v < -50) v = -50
    const sign = v >= 0 ? '+' : ''
    return `[rate:${sign}${v}%]`
  })
  return s
}

