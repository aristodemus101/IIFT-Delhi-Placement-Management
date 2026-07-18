import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Modal, Btn } from '../../components/UI'
import { postOpportunity, blankOpportunity } from '../../lib/useOpportunities'
import { parseOpportunity, generateWhatsAppMessage } from '../../lib/gemini'
import { TYPES } from './OppCard'
import {
  CAMPUS_ENGAGEMENT_SUBTYPE_OPTIONS,
  inferCampusEngagementSubtype,
  VIA_OPTIONS,
  normalizeActivityType,
  normalizeCampusEngagementSubtype,
  typeHasVia,
  typeHasSubtype,
  typeIsCaseComp,
  typeIsHiringDrive,
} from '../../config/activityTaxonomy'

const VALID_APPLICABILITY = new Set(['summer', 'final', 'both'])

function normalizeParsedOpportunity(result) {
  const parsed = { ...blankOpportunity(), ...result }
  const rawType = String(parsed.type || '').trim()
  const lowerType = rawType.toLowerCase()

  if (parsed.applicability && !VALID_APPLICABILITY.has(parsed.applicability)) {
    parsed.applicability = 'both'
  }

  if (parsed.via && !VIA_OPTIONS.includes(parsed.via)) {
    parsed.via = ''
  }

  parsed.type = normalizeActivityType(parsed.type)

  if (parsed.type === 'Campus Engagement') {
    parsed.subtype = normalizeCampusEngagementSubtype(parsed.subtype || parsed.engagementType || inferCampusEngagementSubtype(rawType))
    parsed.via = '' // via is irrelevant for Campus Engagement
  } else {
    parsed.subtype = '' // subtype is irrelevant for Hiring / Live Project
  }

  // Sanitize numeric field from Gemini (may come as string)
  if (parsed.expected_hires != null) {
    const n = parseInt(parsed.expected_hires, 10)
    parsed.expected_hires = isNaN(n) ? null : n
  }
  // Sanitize process_mode
  if (parsed.process_mode && !['Online', 'Offline', 'Hybrid'].includes(parsed.process_mode)) {
    parsed.process_mode = ''
  }
  // Sanitize tracks — Gemini may return string or array
  if (parsed.tracks && !Array.isArray(parsed.tracks)) {
    parsed.tracks = String(parsed.tracks).split(',').map(s => s.trim()).filter(Boolean)
  }

  if (rawType && !TYPES.includes(rawType)) {
    if (lowerType.includes('case') || lowerType.includes('competition') || lowerType.includes('challenge') || lowerType.includes('hackathon')) {
      parsed.type = 'Case Comp'
    } else if (lowerType.includes('live')) {
      parsed.type = 'Live Project'
    } else if (lowerType.includes('event') || lowerType.includes('workshop') || lowerType.includes('lecture') || lowerType.includes('webinar') || lowerType.includes('alumni')) {
      parsed.type = 'Campus Engagement'
      parsed.subtype = normalizeCampusEngagementSubtype(parsed.subtype || inferCampusEngagementSubtype(rawType))
    } else if (lowerType.includes('intern') || lowerType.includes('sip')) {
      parsed.type = 'Hiring'
    } else {
      parsed.type = 'Hiring'
    }
  }

  return parsed
}

export default function PostModal({ user, onClose }) {
  const [step, setStep]       = useState('paste')
  const [rawText, setRawText] = useState('')
  const [parsed, setParsed]   = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy]       = useState(false)
  const [err, setErr]         = useState('')

  const handleParse = async () => {
    setBusy(true); setErr('')
    try {
      const result = await parseOpportunity(rawText)
      setParsed(normalizeParsedOpportunity(result))
      setStep('preview')
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const handleGenerateMessage = async () => {
    setBusy(true); setErr('')
    try {
      setMessage(await generateWhatsAppMessage(parsed, 'opportunity'))
      setStep('message')
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const handlePost = async () => {
    setBusy(true); setErr('')
    try {
      await postOpportunity({ ...parsed, _whatsappMessage: message }, user)
      onClose()
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  return (
    <Modal open onClose={onClose} title="Post Opportunity" width={700}>
      {step === 'paste' && (
        <PasteStep rawText={rawText} setRawText={setRawText} busy={busy} err={err} onNext={handleParse} onClose={onClose} />
      )}
      {step === 'preview' && parsed && (
        <PreviewStep parsed={parsed} setParsed={setParsed} busy={busy} err={err} onBack={() => setStep('paste')} onNext={handleGenerateMessage} />
      )}
      {step === 'message' && (
        <MessageStep message={message} setMessage={setMessage} busy={busy} err={err} onBack={() => setStep('preview')} onPost={handlePost} label="Post Opportunity" />
      )}
    </Modal>
  )
}

export function PasteStep({ rawText, setRawText, busy, err, placeholder, onNext, nextLabel = 'Parse with Gemini →', onClose }) {
  return (
    <>
      <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10, lineHeight: 1.6 }}>
        Paste the text in any format — WhatsApp message, email, announcement, etc. Gemini will extract the structured data.
      </p>
      <textarea
        value={rawText}
        onChange={e => setRawText(e.target.value)}
        placeholder={placeholder || 'Paste opportunity text here…'}
        style={{ width: '100%', minHeight: 180, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface2)', color: 'var(--text)', padding: 12, fontSize: 13, lineHeight: 1.6, resize: 'vertical', fontFamily: 'var(--font-sans)', marginBottom: 10 }}
      />
      {err && <div style={{ fontSize: 13, color: 'var(--red-text)', marginBottom: 8 }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={onNext} disabled={busy || !rawText.trim()}>
          {busy ? 'Processing…' : nextLabel}
        </Btn>
      </div>
    </>
  )
}

// Base fields always shown
const BASE_FIELD_DEFS = [
  { key: 'title',         label: 'Title',         type: 'text' },
  { key: 'type',          label: 'Type',          type: 'select', options: TYPES },
  // subtype shown only for Campus Engagement (injected dynamically)
  // via shown only for Hiring / Live Project (injected dynamically)
  { key: 'organization',  label: 'Organization',  type: 'text' },
  { key: 'applicability', label: 'Applicability', type: 'select', options: [{ value: 'summer', label: 'Summer' }, { value: 'final', label: 'Final' }, { value: 'both', label: 'Both' }] },
  { key: 'roles',         label: 'Roles',         type: 'text', hint: 'comma separated', transform: v => Array.isArray(v) ? v.join(', ') : v, parse: v => v.split(',').map(s => s.trim()).filter(Boolean) },
  { key: 'stipend',       label: 'Stipend',       type: 'text' },
  { key: 'ctc',           label: 'CTC',           type: 'text' },
  { key: 'duration',      label: 'Duration',      type: 'text' },
  { key: 'location',      label: 'Location',      type: 'text' },
  { key: 'deadline',      label: 'Deadline',      type: 'text' },
  { key: 'eligibility',   label: 'Eligibility',   type: 'text' },
  { key: 'eoi_link',      label: 'EOI Link',      type: 'text' },
  { key: 'apply_link',    label: 'Apply Link',    type: 'text' },
  { key: 'tracker_link',  label: 'Tracker Link',  type: 'text' },
  { key: 'description',   label: 'Description',   type: 'textarea' },
  { key: 'notes',         label: 'Internal Notes', type: 'textarea' },
]

const HIRING_FIELD_DEFS = [
  { key: 'spoc',           label: 'SPOC',           type: 'text',   hint: 'Committee member POC' },
  { key: 'expected_hires', label: 'Expected Hires',  type: 'number' },
  { key: 'process_date',   label: 'Process Date',    type: 'date' },
  { key: 'process_mode',   label: 'Process Mode',    type: 'select', options: ['', 'Offline', 'Online', 'Hybrid'] },
]

const CASE_COMP_FIELD_DEFS = [
  { key: 'tracks',    label: 'Tracks',     type: 'text', hint: 'comma separated e.g. Strategy, Finance, Analytics', transform: v => Array.isArray(v) ? v.join(', ') : (v || ''), parse: v => v.split(',').map(s => s.trim()).filter(Boolean) },
  { key: 'team_size', label: 'Team Size',  type: 'text', hint: 'e.g. 2-3 members' },
  { key: 'prize',     label: 'Prize / PPI',type: 'text', hint: 'e.g. Campus winner gets PPI' },
]

const SUBTYPE_DEF = { key: 'subtype', label: 'Subtype', type: 'select', options: ['', ...CAMPUS_ENGAGEMENT_SUBTYPE_OPTIONS] }
const VIA_DEF     = { key: 'via',     label: 'Via (placement route)', type: 'select', options: ['', ...VIA_OPTIONS] }

function getFieldDefs(type) {
  const defs = [...BASE_FIELD_DEFS]
  const typeIdx = defs.findIndex(f => f.key === 'type')
  if (typeHasSubtype(type))  defs.splice(typeIdx + 1, 0, SUBTYPE_DEF)
  if (typeHasVia(type))      defs.splice(typeIdx + 1, 0, VIA_DEF)
  if (typeIsCaseComp(type))  defs.push(...CASE_COMP_FIELD_DEFS)
  if (typeIsHiringDrive(type)) defs.push(...HIRING_FIELD_DEFS)
  return defs
}

export function PreviewStep({ parsed, setParsed, busy, err, onBack, onNext, nextLabel = 'Generate WhatsApp Message →', backLabel = '← Edit Text' }) {
  const set = (key, val, fieldDef) => {
    const v = fieldDef?.parse ? fieldDef.parse(val) : val
    setParsed(p => {
      const next = { ...p, [key]: v }
      if (key === 'type') {
        next.type = normalizeActivityType(v)
        // Campus Engagement: clear via (irrelevant); default subtype
        if (next.type === 'Campus Engagement') {
          next.via = ''
          if (!next.subtype) next.subtype = 'Guest Lecture'
        } else {
          // Hiring / Live Project: clear subtype (irrelevant)
          next.subtype = ''
        }
      }
      if (key === 'subtype') next.subtype = normalizeCampusEngagementSubtype(v)
      return next
    })
  }

  const fieldDefs = getFieldDefs(parsed.type)

  return (
    <>
      <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>Review and edit before generating the WhatsApp message.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14, maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
        {fieldDefs.map(f => {
          const raw = parsed[f.key]
          const display = f.transform ? f.transform(raw) : (raw == null ? '' : String(raw))
          return (
            <div key={f.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13 }}>
              <span style={{ width: 110, flexShrink: 0, color: 'var(--text-3)', fontWeight: 600, paddingTop: f.type === 'textarea' ? 6 : 8, fontSize: 12 }}>{f.label}</span>
              {f.type === 'select' ? (
                <select value={display} onChange={e => set(f.key, e.target.value, f)}
                  style={{ flex: 1, height: 32, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', padding: '0 10px', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
                  {f.options.map(o => typeof o === 'string' ? <option key={o} value={o}>{o || 'None'}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea value={display} onChange={e => set(f.key, e.target.value, f)}
                  style={{ flex: 1, minHeight: 60, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', padding: '6px 10px', fontSize: 13, resize: 'vertical', fontFamily: 'var(--font-sans)' }} />
              ) : (
                <input
                  type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                  value={display}
                  onChange={e => set(f.key, f.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value, f)}
                  placeholder={f.hint || ''}
                  style={{ flex: 1, height: 32, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', padding: '0 10px', fontSize: 13, fontFamily: 'var(--font-sans)' }} />
              )}
            </div>
          )
        })}
      </div>
      {err && <div style={{ fontSize: 13, color: 'var(--red-text)', marginBottom: 8 }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn onClick={onBack}>{backLabel}</Btn>
        <Btn variant="primary" onClick={onNext} disabled={busy}>{busy ? '…' : nextLabel}</Btn>
      </div>
    </>
  )
}

export function MessageStep({ message, setMessage, busy, err, onBack, onPost, label }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>
        WhatsApp-ready message generated. Copy and float it on the batch group.
      </p>
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          style={{ width: '100%', minHeight: 220, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface2)', color: 'var(--text)', padding: 12, fontSize: 13, lineHeight: 1.7, resize: 'vertical', fontFamily: 'var(--font-sans)' }}
        />
        <button onClick={handleCopy} style={{ position: 'absolute', top: 8, right: 8, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-2)' }}>
          {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
        </button>
      </div>
      {err && <div style={{ fontSize: 13, color: 'var(--red-text)', marginBottom: 8 }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn onClick={onBack}>← Back</Btn>
        <Btn variant="primary" onClick={onPost} disabled={busy}>{busy ? 'Saving…' : label}</Btn>
      </div>
    </>
  )
}

export function MessageBox({ message }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => { navigator.clipboard.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <div style={{ position: 'relative', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 36px 10px 12px', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginTop: 4, marginBottom: 4 }}>
      {message}
      <button onClick={handleCopy} style={{ position: 'absolute', top: 6, right: 6, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 2 }} title="Copy">
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  )
}
