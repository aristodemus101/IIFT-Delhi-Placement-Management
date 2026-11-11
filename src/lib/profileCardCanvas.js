// Hand-draws a candidate profile card onto a canvas and returns a PNG blob.
// Zero dependencies. Retina-scaled (2x) for a crisp, professional image.

const W = 680          // logical width (px)
const PAD = 40
const SCALE = 2        // retina

const COLORS = {
  bg: '#ffffff',
  panel: '#f8fafc',       // faint section background
  headerBg: '#0f2a4a',    // deep institute navy
  headerAccent: '#c99a2e',// gold rule under header
  headerText: '#ffffff',
  headerSub: 'rgba(255,255,255,0.72)',
  name: '#0f172a',
  roll: '#64748b',
  section: '#0f2a4a',     // section heading
  label: '#94a3b8',
  value: '#1e293b',
  sub: '#64748b',
  rule: '#e8edf3',
  chipSipBg: '#fef6e3', chipSipText: '#8a5a00', chipSipBorder: '#f0d9a0',
  chipFinalBg: '#e6f6ee', chipFinalText: '#0a6b43', chipFinalBorder: '#b7e4cc',
  footer: '#94a3b8',
}

const FONT = 'Helvetica Neue, Helvetica, Arial, sans-serif'

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Wrap `text` into at most `maxLines` lines that each fit `maxW` at the current
// font. If it still overflows, the last line is ellipsised.
function wrapText(ctx, text, maxW, maxLines = 2) {
  const words = String(text).trim().split(/\s+/)
  const lines = []
  let line = ''
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width <= maxW || !line) {
      line = test
    } else {
      lines.push(line)
      line = w
      if (lines.length === maxLines - 1) {
        // last allowed line: pack the rest of the words, then ellipsise if needed
        const remaining = words.slice(i).join(' ')
        lines.push(fitText(ctx, remaining, maxW))
        return lines
      }
    }
  }
  if (line) lines.push(line)
  return lines
}

// Truncate a single-line string with an ellipsis so it fits maxW.
function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text
  let s = text
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1)
  return s + '…'
}

// Draw the card, return { blob, dataUrl } via a Promise.
export function drawProfileCard(profile, { institute = 'IIFT DELHI' } = {}) {
  const colW = (W - PAD * 2 - 28) / 2     // two-column field width

  // ── Content model: grouped sections of fields ──────────────────────────────
  // Each field: { label, value, full? } — `full` spans both columns (long text).
  const personal = [
    { label: 'Official Email', value: profile.officialEmail },
    { label: 'Personal Email', value: profile.personalEmail },
    { label: 'Contact', value: profile.mobile },
    { label: 'Date of Birth', value: profile.dob },
    { label: "Father's Name", value: profile.father },
    { label: "Mother's Name", value: profile.mother },
    { label: 'Permanent Address', value: profile.address, full: true },
  ].filter(f => f.value)

  const academics = [
    { label: 'Class X', value: profile.x10 ? `${profile.x10}%` : '' },
    { label: 'Class XII', value: profile.x12 ? `${profile.x12}%` : '' },
    { label: 'UG Score', value: profile.ug ? `${profile.ug}%` : '' },
    { label: 'Work Experience', value: profile.workEx ? `${profile.workEx} months` : '' },
    { label: 'UG Degree & College', value: profile.ugDegreeCollege, full: true },
    { label: 'Most Recent Company', value: profile.recentCompany, full: true },
  ].filter(f => f.value)

  const chips = []
  if (profile.sipCompany) chips.push({ kind: 'SIP', text: profile.sipCompany })
  if (profile.finalCompany) chips.push({ kind: 'Final', text: profile.finalCompany })

  // ── Measure height: we need a temp ctx to measure wrapped full-width rows ───
  const measureCanvas = document.createElement('canvas')
  const mctx = measureCanvas.getContext('2d')

  const ROW_H = 50          // a half-width field row
  const FULL_LABEL_H = 15
  const FULL_LINE_H = 19
  const SECTION_HEAD_H = 34

  // Height of one section given its fields.
  function sectionHeight(fields) {
    if (!fields.length) return 0
    let h = SECTION_HEAD_H
    const halfFields = fields.filter(f => !f.full)
    const fullFields = fields.filter(f => f.full)
    h += Math.ceil(halfFields.length / 2) * ROW_H
    for (const f of fullFields) {
      mctx.font = `600 15px ${FONT}`
      const lines = wrapText(mctx, f.value, W - PAD * 2, 2)
      h += FULL_LABEL_H + lines.length * FULL_LINE_H + 12
    }
    return h + 10
  }

  const HEADER_H = 104
  const NAME_BLOCK_H = 84
  const personalH = sectionHeight(personal)
  const academicsH = sectionHeight(academics)
  const chipsH = chips.length ? (SECTION_HEAD_H + chips.length * 44) : 0
  const FOOTER_H = 46
  const H = HEADER_H + NAME_BLOCK_H + personalH + academicsH + chipsH + FOOTER_H

  // ── Render ─────────────────────────────────────────────────────────────────
  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')
  ctx.scale(SCALE, SCALE)

  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, W, H)

  // Header band + gold rule
  ctx.fillStyle = COLORS.headerBg
  ctx.fillRect(0, 0, W, HEADER_H)
  ctx.fillStyle = COLORS.headerAccent
  ctx.fillRect(0, HEADER_H - 4, W, 4)

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = COLORS.headerText
  ctx.font = `700 25px Georgia, 'Times New Roman', serif`
  ctx.fillText(institute, PAD, 48)
  ctx.font = `600 11px ${FONT}`
  ctx.fillStyle = COLORS.headerSub
  ctx.save()
  // letter-spaced subtitle
  const sub = 'CANDIDATE PROFILE'
  let sx = PAD
  for (const ch of sub) { ctx.fillText(ch, sx, 70); sx += ctx.measureText(ch).width + 2 }
  ctx.restore()
  // right-aligned generated date
  const gen = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  ctx.font = `400 11px ${FONT}`
  ctx.fillStyle = COLORS.headerSub
  ctx.textAlign = 'right'
  ctx.fillText(`Generated ${gen}`, W - PAD, 70)
  ctx.textAlign = 'left'

  // Name block
  let y = HEADER_H + 44
  ctx.fillStyle = COLORS.name
  ctx.font = `700 28px ${FONT}`
  const nameStr = profile.name || 'Unnamed'
  const nameFit = fitText(ctx, nameStr, W - PAD * 2 - 80)
  ctx.fillText(nameFit, PAD, y)
  if (profile.roll) {
    const nameW = ctx.measureText(nameFit).width
    ctx.fillStyle = COLORS.roll
    ctx.font = `600 15px ${FONT}`
    ctx.fillText(profile.roll, PAD + nameW + 14, y)
  }
  y += 24
  const subParts = [profile.course, profile.gradYear ? `Class of ${profile.gradYear}` : ''].filter(Boolean)
  if (subParts.length) {
    ctx.fillStyle = COLORS.sub
    ctx.font = `400 14px ${FONT}`
    ctx.fillText(subParts.join('   ·   '), PAD, y)
  }
  y += 24

  // Section renderer
  function drawSectionHeading(title) {
    ctx.fillStyle = COLORS.section
    ctx.font = `700 11px ${FONT}`
    let tx = PAD
    for (const ch of title.toUpperCase()) { ctx.fillText(ch, tx, y); tx += ctx.measureText(ch).width + 1.5 }
    // rule to the right of the label
    ctx.strokeStyle = COLORS.rule
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(tx + 10, y - 4); ctx.lineTo(W - PAD, y - 4); ctx.stroke()
    y += SECTION_HEAD_H - 12
  }

  function drawFields(fields) {
    const half = fields.filter(f => !f.full)
    const full = fields.filter(f => f.full)
    // two-column half fields
    half.forEach((f, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const fx = PAD + col * (colW + 28)
      const fy = y + row * ROW_H
      ctx.fillStyle = COLORS.label
      ctx.font = `600 9.5px ${FONT}`
      ctx.fillText(f.label.toUpperCase(), fx, fy)
      ctx.fillStyle = COLORS.value
      ctx.font = `600 15px ${FONT}`
      ctx.fillText(fitText(ctx, String(f.value), colW), fx, fy + 20)
    })
    y += Math.ceil(half.length / 2) * ROW_H
    // full-width fields (wrapped)
    full.forEach(f => {
      ctx.fillStyle = COLORS.label
      ctx.font = `600 9.5px ${FONT}`
      ctx.fillText(f.label.toUpperCase(), PAD, y)
      ctx.fillStyle = COLORS.value
      ctx.font = `600 15px ${FONT}`
      const lines = wrapText(ctx, String(f.value), W - PAD * 2, 2)
      lines.forEach((ln, i) => ctx.fillText(ln, PAD, y + FULL_LABEL_H + 4 + i * FULL_LINE_H))
      y += FULL_LABEL_H + lines.length * FULL_LINE_H + 12
    })
    y += 10
  }

  if (personal.length) { drawSectionHeading('Personal Details'); drawFields(personal) }
  if (academics.length) { drawSectionHeading('Academics & Experience'); drawFields(academics) }

  // Placement chips
  if (chips.length) {
    drawSectionHeading('Placement')
    chips.forEach(ch => {
      const isSip = ch.kind === 'SIP'
      const chipBg = isSip ? COLORS.chipSipBg : COLORS.chipFinalBg
      const chipTx = isSip ? COLORS.chipSipText : COLORS.chipFinalText
      const chipBd = isSip ? COLORS.chipSipBorder : COLORS.chipFinalBorder
      ctx.font = `700 10.5px ${FONT}`
      const labelText = isSip ? 'SIP' : 'FINAL'
      const labelW = ctx.measureText(labelText).width + 20
      roundRect(ctx, PAD, y - 13, labelW, 24, 6)
      ctx.fillStyle = chipBg; ctx.fill()
      ctx.strokeStyle = chipBd; ctx.lineWidth = 1; ctx.stroke()
      ctx.fillStyle = chipTx
      ctx.fillText(labelText, PAD + 10, y + 3)
      ctx.fillStyle = COLORS.value
      ctx.font = `600 15px ${FONT}`
      ctx.fillText(fitText(ctx, ch.text, W - PAD * 2 - labelW - 14), PAD + labelW + 12, y + 3)
      y += 44
    })
    y += 2
  }

  // Footer rule + institute mark
  ctx.strokeStyle = COLORS.rule
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PAD, H - 34); ctx.lineTo(W - PAD, H - 34); ctx.stroke()
  ctx.fillStyle = COLORS.footer
  ctx.font = `400 11px ${FONT}`
  ctx.fillText('Indian Institute of Foreign Trade, Delhi — Placement Committee', PAD, H - 16)

  return new Promise(resolve => {
    canvas.toBlob(blob => {
      resolve({ blob, dataUrl: canvas.toDataURL('image/png') })
    }, 'image/png')
  })
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
