export function stripInlineDirectives(s) {
  if (!s) return ''
  return s
    .replace(/[\[\uFF3B]\s*(?:pause|rate)[^\]\uFF3D]*[\]\uFF3D]?/gi, '')
    .replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFF10 + 0x30))
    .replace(/\b\d+(?:\.\d+)?\s*(?:ms|s|秒)\b/gi, '')
    .trim()
}
