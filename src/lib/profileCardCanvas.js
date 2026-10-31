// Hand-draws a candidate profile card onto a canvas and returns a PNG blob.
// Zero dependencies. Retina-scaled (2x) for a crisp, professional image.

const W = 640          // logical width (px)
const PAD = 36
const SCALE = 2        // retina

const COLORS = {
  bg: '#ffffff',
  headerBg: '#1d3557',   // deep institute navy
  headerText: '#ffffff',
  accent: '#1d4ed8',
  name: '#111827',
  label: '#6b7280',
  value: '#111827',
  sub: '#6b7280',
  rule: '#e5e7eb',
  chipSipBg: '#fef3c7', chipSipText: '#92400e',
  chipFinalBg: '#d1fae5', chipFinalText: '#065f46',
  footer: '#9ca3af',
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Draw the card, return { blob, dataUrl } via a Promise.
export function drawProfileCard(profile, { institute = 'IIFT DELHI' } = {}) {
  // Compute dynamic height based on which sections are present.
  const fields = [
    ['Official Email', profile.officialEmail],
    ['Contact', profile.mobile],
    ['Class X', profile.x10 ? `${profile.x10}%` : ''],
    ['Class XII', profile.x12 ? `${profile.x12}%` : ''],
    ['UG Score', profile.ug ? `${profile.ug}%` : ''],
    ['Work Experience', profile.workEx ? `${profile.workEx} months` : ''],
    ['Most Recent Company', profile.recentCompany],
  ].filter(([, v]) => v)

  const chips = []
  if (profile.sipCompany) chips.push({ kind: 'SIP', text: profile.sipCompany })
  if (profile.finalCompany) chips.push({ kind: 'Final', text: profile.finalCompany })

  const HEADER_H = 92
  const NAME_BLOCK_H = 78
  const rows = Math.ceil(fields.length / 2)
  const ROW_H = 52
  const fieldsH = rows * ROW_H + 24
  const chipsH = chips.length ? (chips.length * 40 + 30) : 0
  const FOOTER_H = 44
  const H = HEADER_H + NAME_BLOCK_H + fieldsH + chipsH + FOOTER_H + PAD

  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')
  ctx.scale(SCALE, SCALE)

  // Card background
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, W, H)

  // Header band
  ctx.fillStyle = COLORS.headerBg
  ctx.fillRect(0, 0, W, HEADER_H)
  ctx.fillStyle = COLORS.headerText
  ctx.font = '700 22px Georgia, serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(institute, PAD, HEADER_H / 2 - 10)
  ctx.font = '600 12px Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.fillText('CANDIDATE PROFILE', PAD, HEADER_H / 2 + 14)

  let y = HEADER_H + 26

  // Name + sub-line (course · class of year)
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = COLORS.name
  ctx.font = '700 26px Arial, sans-serif'
  const nameStr = profile.name || 'Unnamed'
  ctx.fillText(nameStr, PAD, y)
  if (profile.roll) {
    const nameW = ctx.measureText(nameStr).width
    ctx.fillStyle = COLORS.sub
    ctx.font = '600 14px Arial, sans-serif'
    ctx.fillText(profile.roll, PAD + nameW + 12, y)
  }
  y += 24
  const subParts = [profile.course, profile.gradYear ? `Class of ${profile.gradYear}` : ''].filter(Boolean)
  if (subParts.length) {
    ctx.fillStyle = COLORS.sub
    ctx.font = '400 14px Arial, sans-serif'
    ctx.fillText(subParts.join('  ·  '), PAD, y)
  }
  y += 22

  // Divider
  ctx.strokeStyle = COLORS.rule
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke()
  y += 22

  // Two-column fields
  const colW = (W - PAD * 2 - 24) / 2
  fields.forEach(([label, value], i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const fx = PAD + col * (colW + 24)
    const fy = y + row * ROW_H
    ctx.fillStyle = COLORS.label
    ctx.font = '600 10px Arial, sans-serif'
    ctx.fillText(label.toUpperCase(), fx, fy)
    ctx.fillStyle = COLORS.value
    ctx.font = '600 15px Arial, sans-serif'
    ctx.fillText(fitText(ctx, String(value), colW), fx, fy + 20)
  })
  y += rows * ROW_H + 8

  // Placement chips
  if (chips.length) {
    ctx.strokeStyle = COLORS.rule
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke()
    y += 22
    chips.forEach(ch => {
      const isSip = ch.kind === 'SIP'
      const chipBg = isSip ? COLORS.chipSipBg : COLORS.chipFinalBg
      const chipTx = isSip ? COLORS.chipSipText : COLORS.chipFinalText
      ctx.font = '700 11px Arial, sans-serif'
      const labelText = isSip ? 'SIP' : 'FINAL'
      const labelW = ctx.measureText(labelText).width + 16
      roundRect(ctx, PAD, y - 14, labelW, 22, 5)
      ctx.fillStyle = chipBg; ctx.fill()
      ctx.fillStyle = chipTx
      ctx.fillText(labelText, PAD + 8, y + 1)
      ctx.fillStyle = COLORS.value
      ctx.font = '600 15px Arial, sans-serif'
      ctx.fillText(fitText(ctx, ch.text, W - PAD * 2 - labelW - 14), PAD + labelW + 10, y + 1)
      y += 40
    })
    y += 2
  }

  // Footer
  ctx.fillStyle = COLORS.footer
  ctx.font = '400 11px Arial, sans-serif'
  const gen = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  ctx.fillText(`Generated ${gen}`, PAD, H - 20)

  return new Promise(resolve => {
    canvas.toBlob(blob => {
      resolve({ blob, dataUrl: canvas.toDataURL('image/png') })
    }, 'image/png')
  })
}

// Truncate a string with an ellipsis so it fits maxW at the current font.
function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text
  let s = text
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1)
  return s + '…'
}

// Trigger a browser download of the card PNG for a profile.
export async function downloadProfileCard(profile, filename) {
  const { blob } = await drawProfileCard(profile)
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `${(profile.name || 'candidate').replace(/\s+/g, '_')}_profile.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
