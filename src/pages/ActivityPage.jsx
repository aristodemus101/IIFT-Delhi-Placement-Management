import React, { useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useStudents } from '../lib/useStudents'
import {
  useOpportunities, useStages, useApplicants,
  postOpportunity, advanceStage, deleteOpportunity,
  STAGE_TYPES, blankOpportunity,
} from '../lib/useOpportunities'
import { PageHeader, Btn, Badge, Modal, Select, Spinner } from '../components/UI'
import {
  Plus, Trash2, Briefcase, Trophy, FlaskConical,
  GraduationCap, CalendarClock, ChevronRight, Copy, Check,
  MessageSquare, Users, Award,
} from 'lucide-react'

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_META = {
  'SIP Hiring':   { icon: GraduationCap, color: 'green'  },
  'Hiring':       { icon: Briefcase,     color: 'blue'   },
  'Case Comp':    { icon: Trophy,        color: 'amber'  },
  'Live Project': { icon: FlaskConical,  color: 'purple' },
  'Event':        { icon: CalendarClock, color: 'gray'   },
}
const TYPES = Object.keys(TYPE_META)
const BATCH_COLOR = { final: 'blue', summer: 'amber', both: 'gray' }
const BATCH_LABEL = { final: 'Final', summer: 'Summer', both: 'Both' }
const STATUS_COLOR = { open: 'green', shortlisted: 'amber', interviewing: 'blue', closed: 'gray' }
const STATUS_LABEL = { open: 'Open', shortlisted: 'Shortlisted', interviewing: 'Interviewing', closed: 'Closed' }

function typeColor(t) { return TYPE_META[t]?.color || 'gray' }
function TypeIcon({ type, size = 13 }) {
  const Icon = TYPE_META[type]?.icon || Briefcase
  return <Icon size={size} />
}

// ── Gemini helpers ────────────────────────────────────────────────────────────

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_KEY}`

async function callGemini(prompt) {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  return raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
}

async function parseOpportunity(rawText) {
  const prompt = `
You are a placement cell data extractor for IIFT Delhi MBA program.
Extract structured data from the opportunity text and return ONLY valid JSON with EXACTLY these keys.
Use null for any field not mentioned. Do not add extra keys.

{
  "title": "short title string",
  "type": "one of: SIP Hiring | Hiring | Case Comp | Live Project | Event",
  "organization": "company or organiser name",
  "applicability": "one of: summer | final | both",
  "roles": ["array of role strings, empty array if none"],
  "stipend": "stipend string e.g. ₹20,000–30,000/month, or null",
  "ctc": "CTC string e.g. 18 LPA, or null",
  "duration": "e.g. 2 months, or null",
  "location": "location string or null",
  "deadline": "deadline as stated in text, or null",
  "eligibility": "eligibility string or null — e.g. Mandatory for all YTP students",
  "eoi_link": "Google Form URL if present, else null",
  "apply_link": "direct application URL if present (different from EOI form), else null",
  "tracker_link": "Google Sheets tracker URL if present, else null",
  "description": "1-2 sentence summary of the opportunity, max 280 chars"
}

Text:
${rawText}
`
  const json = await callGemini(prompt)
  return JSON.parse(json)
}

async function generateWhatsAppMessage(opp, stageType, extra = {}) {
  const stageLabel = STAGE_TYPES[stageType]
  const prompt = `
You are drafting a WhatsApp announcement for IIFT Delhi placement committee.
Match the tone and format of these real examples:

Example 1 (opportunity):
*Altius Investech || SIP Application*
Dear Batch,
Altius Investech has opened its applications for summer internship.
*Roles on Offer:*
1. Research Analyst Intern
2. B2B Channel Growth Manager Intern
*Stipend:* 20,000 - 30,000 per month
*Location:* Kolkata
*Duration:* 2 months
*EOI:* https://forms.gle/...
*Deadline:* 9:30 PM, 7th January
*All CRCAD Rules Apply*

Example 2 (shortlist):
*Royal Brothers || Shortlist*
Dear Batch,
PFA the shortlist for Royal Brothers. Please join the WhatsApp group and mark the tracker:
*Tracker*: https://...
*Process Group*: https://...
*Deadline:* 9:00 AM, 21 February 2026
*All CRCAD Rules Apply*

Now write a WhatsApp message for stage: "${stageLabel}"

Opportunity details (use only what's relevant and non-null):
${JSON.stringify({ ...opp, ...extra }, null, 2)}

${extra.whatsappGroupLink ? `WhatsApp group link: ${extra.whatsappGroupLink}` : ''}
${extra.selectedStudents ? `Selected students:\n${extra.selectedStudents}` : ''}

Rules:
- Use *bold* for headers
- Keep it concise
- End with *All CRCAD Rules Apply*
- Return ONLY the message text, no explanation, no markdown code block
`
  return callGemini(prompt)
}

async function parseShortlist(rawText, students) {
  // Build a compact student lookup for Gemini context
  const lookup = students.map(s => ({
    roll: s['Roll No.'] || s.roll || '',
    name: [s['First Name'], s['Last Name']].filter(Boolean).join(' ') || s['Full Name'] || '',
    email: s['Official Email ID (d27/ba27)'] || s.official_email || '',
  })).filter(s => s.roll || s.name)

  const prompt = `
You are matching a shortlist text to a student database for IIFT Delhi placement committee.
Student names in announcements follow the pattern "FirstName LastName_RollNo_Batch_Year" e.g. "Vaibhav Verma_46A_BA_27".

Student database (roll, name, email):
${JSON.stringify(lookup.slice(0, 300))}

Shortlist text:
${rawText}

Return ONLY valid JSON array of matched students. For each matched student include:
{
  "roll": "roll number from DB",
  "name": "full name from DB",
  "email": "official email from DB",
  "role": "role they are shortlisted for, or null"
}

Only include students you can confidently match. If a name appears in the text but you cannot match to DB, skip them.
`
  const json = await callGemini(prompt)
  return JSON.parse(json)
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ActivityPage() {
  const { user, role } = useAuth()
  const isAdmin = role === 'admin'
  const { students } = useStudents()
  const { opportunities, loading } = useOpportunities()

  const [typeFilter, setTypeFilter]   = useState('all')
  const [batchFilter, setBatchFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const [detailOpp, setDetailOpp]     = useState(null)
  const [postOpen, setPostOpen]       = useState(false)

  const filtered = useMemo(() => opportunities.filter(o => {
    if (typeFilter !== 'all' && o.type !== typeFilter) return false
    if (batchFilter !== 'all') {
      const ap = o.applicability || 'both'
      if (ap !== 'both' && ap !== batchFilter) return false
    }
    if (statusFilter !== 'all' && o.status !== statusFilter) return false
    return true
  }), [opportunities, typeFilter, batchFilter, statusFilter])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Activity"
        subtitle="Opportunities posted by the placement committee"
        actions={isAdmin && (
          <Btn variant="primary" size="sm" onClick={() => setPostOpen(true)}>
            <Plus size={13} /> Post Opportunity
          </Btn>
        )}
      />

      {/* Filters */}
      <div style={{ padding: '10px 28px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ height: 32, fontSize: 12 }}>
          <option value="all">All types</option>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Select value={batchFilter} onChange={e => setBatchFilter(e.target.value)} style={{ height: 32, fontSize: 12 }}>
          <option value="all">All batches</option>
          <option value="final">Final</option>
          <option value="summer">Summer</option>
        </Select>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ height: 32, fontSize: 12 }}>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="shortlisted">Shortlisted</option>
          <option value="interviewing">Interviewing</option>
          <option value="closed">Closed</option>
        </Select>
        <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 'auto' }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Feed */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 60, fontSize: 13 }}>
            {opportunities.length === 0
              ? 'No opportunities yet. Admins can post via the button above.'
              : 'No results match the current filters.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14, alignItems: 'start' }}>
            {filtered.map(opp => (
              <OppCard
                key={opp.id}
                opp={opp}
                isAdmin={isAdmin}
                onOpen={() => setDetailOpp(opp)}
                onDelete={() => deleteOpportunity(opp.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Post modal */}
      {postOpen && (
        <PostModal
          user={user}
          onClose={() => setPostOpen(false)}
        />
      )}

      {/* Detail / pipeline modal */}
      {detailOpp && (
        <DetailModal
          opp={detailOpp}
          isAdmin={isAdmin}
          user={user}
          students={students}
          onClose={() => setDetailOpp(null)}
        />
      )}
    </div>
  )
}

// ── Opportunity Card ──────────────────────────────────────────────────────────

function OppCard({ opp, isAdmin, onOpen, onDelete }) {
  const ap = opp.applicability || 'both'
  const dateStr = opp.createdAt?.toDate
    ? opp.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : ''

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${opp.title}"?`)) return
    await onDelete()
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top colour strip by type */}
      <div style={{ height: 3, background: `var(--${typeColor(opp.type) === 'gray' ? 'border' : typeColor(opp.type) + '-border'})` }} />

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, marginBottom: 2 }}>{opp.title || 'Untitled'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{opp.organization || '—'}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
            {(opp.stipend || opp.ctc) && (
              <div style={{ fontSize: 13, fontWeight: 700 }}>{opp.stipend || opp.ctc}</div>
            )}
            {opp.duration && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{opp.duration}</div>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          <Badge color={typeColor(opp.type)}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <TypeIcon type={opp.type} size={10} />{opp.type || 'Other'}
            </span>
          </Badge>
          <Badge color={BATCH_COLOR[ap]}>{BATCH_LABEL[ap] || ap}</Badge>
          <Badge color={STATUS_COLOR[opp.status] || 'gray'}>{STATUS_LABEL[opp.status] || opp.status}</Badge>
          {opp.location && <Badge color="gray">{opp.location}</Badge>}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>{dateStr}</span>
        </div>

        {opp.roles?.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
            {opp.roles.slice(0, 2).join(' · ')}{opp.roles.length > 2 ? ` +${opp.roles.length - 2}` : ''}
          </div>
        )}

        {opp.description && (
          <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
            {opp.description.length > 160 ? opp.description.slice(0, 160) + '…' : opp.description}
          </div>
        )}

        {opp.deadline && (
          <div style={{ fontSize: 11, color: 'var(--amber-text)', fontWeight: 600 }}>Deadline: {opp.deadline}</div>
        )}

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
          <Btn size="sm" onClick={onOpen} style={{ flex: 1 }}>
            View & Manage <ChevronRight size={11} />
          </Btn>
          {isAdmin && (
            <button onClick={handleDelete} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 6, borderRadius: 6, display: 'flex' }} title="Delete">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Post Opportunity Modal (Gemini parse flow) ────────────────────────────────

function PostModal({ user, onClose }) {
  const [step, setStep]       = useState('paste')  // paste | preview | message
  const [rawText, setRawText] = useState('')
  const [parsed, setParsed]   = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy]       = useState(false)
  const [err, setErr]         = useState('')

  const handleParse = async () => {
    setBusy(true); setErr('')
    try {
      const result = await parseOpportunity(rawText)
      setParsed({ ...blankOpportunity(), ...result })
      setStep('preview')
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const handleGenerateMessage = async () => {
    setBusy(true); setErr('')
    try {
      const msg = await generateWhatsAppMessage(parsed, 'opportunity')
      setMessage(msg)
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
        <PasteStep
          rawText={rawText} setRawText={setRawText}
          busy={busy} err={err}
          onNext={handleParse} onClose={onClose}
        />
      )}
      {step === 'preview' && parsed && (
        <PreviewStep
          parsed={parsed} setParsed={setParsed}
          busy={busy} err={err}
          onBack={() => setStep('paste')}
          onNext={handleGenerateMessage}
        />
      )}
      {step === 'message' && (
        <MessageStep
          message={message} setMessage={setMessage}
          busy={busy} err={err}
          onBack={() => setStep('preview')}
          onPost={handlePost}
          label="Post Opportunity"
        />
      )}
    </Modal>
  )
}

// ── Detail / Pipeline Modal ───────────────────────────────────────────────────

function DetailModal({ opp, isAdmin, user, students, onClose }) {
  const stages = useStages(opp.id)
  const applicants = useApplicants(opp.id)
  const [tab, setTab] = useState('info')  // info | stages | shortlist | message
  const [stageFlow, setStageFlow] = useState(null)  // {type, step, ...}

  return (
    <Modal open onClose={onClose} title={opp.title || 'Opportunity'} width={720}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[
          { key: 'info', label: 'Details' },
          { key: 'stages', label: `Timeline (${stages.length})` },
          { key: 'applicants', label: `Students (${applicants.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 14px', fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
            border: 'none', background: 'none', cursor: 'pointer',
            color: tab === t.key ? 'var(--accent-dark)' : 'var(--text-2)',
            borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'info' && (
        <InfoTab opp={opp} isAdmin={isAdmin} user={user} students={students} setStageFlow={setStageFlow} />
      )}
      {tab === 'stages' && <StagesTab stages={stages} />}
      {tab === 'applicants' && <ApplicantsTab applicants={applicants} />}

      {/* Stage advance flows */}
      {stageFlow && (
        <StageFlowModal
          opp={opp} flow={stageFlow} user={user} students={students}
          onClose={() => setStageFlow(null)}
        />
      )}
    </Modal>
  )
}

function InfoTab({ opp, isAdmin, user, students, setStageFlow }) {
  const rows = [
    { label: 'Type',          value: opp.type },
    { label: 'Organization',  value: opp.organization },
    { label: 'Applicable to', value: BATCH_LABEL[opp.applicability] || opp.applicability },
    { label: 'Status',        value: STATUS_LABEL[opp.status] || opp.status },
    { label: 'Roles',         value: opp.roles?.join(', ') },
    { label: 'Stipend',       value: opp.stipend },
    { label: 'CTC',           value: opp.ctc },
    { label: 'Duration',      value: opp.duration },
    { label: 'Location',      value: opp.location },
    { label: 'Deadline',      value: opp.deadline },
    { label: 'Eligibility',   value: opp.eligibility },
    { label: 'Posted by',     value: opp.postedBy?.name },
    { label: 'Posted on',     value: opp.createdAt?.toDate?.()?.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) },
  ].filter(r => r.value)

  const links = [
    { label: 'EOI Form',     url: opp.eoi_link },
    { label: 'Apply',        url: opp.apply_link },
    { label: 'Tracker',      url: opp.tracker_link },
  ].filter(l => l.url)

  const nextStages = {
    open:         { type: 'shortlist',  label: 'Release Shortlist', icon: Users },
    shortlisted:  { type: 'interview',  label: 'Post Interview Round', icon: MessageSquare },
    interviewing: { type: 'selected',   label: 'Post Final Selection', icon: Award },
  }
  const next = nextStages[opp.status]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {opp.description && (
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: 0 }}>{opp.description}</p>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <tbody>
          {rows.map(({ label, value }) => (
            <tr key={label} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px 0', color: 'var(--text-3)', fontWeight: 600, width: 130, verticalAlign: 'top' }}>{label}</td>
              <td style={{ padding: '8px 0', color: 'var(--text)' }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {links.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {links.map(({ label, url }) => (
            <Btn key={label} size="sm" variant="ghost" onClick={() => window.open(url, '_blank')}>
              {label} →
            </Btn>
          ))}
        </div>
      )}

      {isAdmin && next && opp.status !== 'closed' && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', gap: 8 }}>
          <Btn variant="primary" size="sm" onClick={() => setStageFlow({ type: next.type })}>
            <next.icon size={13} /> {next.label}
          </Btn>
          <Btn size="sm" variant="ghost" onClick={() => setStageFlow({ type: 'message' })}>
            <MessageSquare size={13} /> Generate Message
          </Btn>
        </div>
      )}
    </div>
  )
}

function StagesTab({ stages }) {
  if (!stages.length) return <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '20px 0' }}>No stages recorded yet.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {stages.map((s, i) => (
        <div key={s.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-bg)', border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent-dark)' }}>{i + 1}</div>
            {i < stages.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 16, background: 'var(--border)', marginTop: 2 }} />}
          </div>
          <div style={{ flex: 1, paddingBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{STAGE_TYPES[s.type] || s.type}</div>
            {s.message && <MessageBox message={s.message} />}
            {s.trackerLink && <a href={s.trackerLink} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }}>Tracker →</a>}
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
              {s.createdBy?.name} · {s.createdAt?.toDate?.()?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ApplicantsTab({ applicants }) {
  if (!applicants.length) return <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '20px 0' }}>No students linked yet. Use "Release Shortlist" to add students.</div>

  const statusColor = { applied: 'gray', shortlisted: 'amber', interviewing: 'blue', selected: 'green', rejected: 'red' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr auto', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        <span>Roll</span><span>Name</span><span>Email</span><span>Status</span>
      </div>
      {applicants.map(a => (
        <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr auto', gap: 8, padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: 13, alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>{a.roll}</span>
          <span>{a.name}</span>
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{a.email}</span>
          <Badge color={statusColor[a.status] || 'gray'}>{a.status}</Badge>
        </div>
      ))}
    </div>
  )
}

// ── Stage Advance Flow Modal ──────────────────────────────────────────────────

function StageFlowModal({ opp, flow, user, students, onClose }) {
  const [step, setStep]         = useState('paste')
  const [rawText, setRawText]   = useState('')
  const [matched, setMatched]   = useState([])
  const [message, setMessage]   = useState('')
  const [waLink, setWaLink]     = useState('')
  const [trackerLink, setTrackerLink] = useState('')
  const [busy, setBusy]         = useState(false)
  const [err, setErr]           = useState('')

  const isMessageOnly = flow.type === 'message'
  const stageLabel = STAGE_TYPES[flow.type] || 'Update'

  // For message-only: jump straight to message generation
  const handleGenerateMessageOnly = async () => {
    setBusy(true); setErr('')
    try {
      const msg = await generateWhatsAppMessage(opp, 'opportunity')
      setMessage(msg)
      setStep('message')
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const handleParseShortlist = async () => {
    setBusy(true); setErr('')
    try {
      const result = await parseShortlist(rawText, students)
      setMatched(result)
      setStep('review')
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const handleGenerateStageMessage = async () => {
    setBusy(true); setErr('')
    try {
      const extra = { whatsappGroupLink: waLink, trackerLink }
      if (flow.type === 'selected') {
        extra.selectedStudents = matched.map(s => `${s.name} (${s.roll})${s.role ? ' — ' + s.role : ''}`).join('\n')
      }
      const msg = await generateWhatsAppMessage(opp, flow.type, extra)
      setMessage(msg)
      setStep('message')
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const handleSave = async () => {
    setBusy(true); setErr('')
    try {
      if (!isMessageOnly) {
        // Write each matched student to applicants subcollection
        const statusByStage = { shortlist: 'shortlisted', interview: 'interviewing', selected: 'selected' }
        const { doc, setDoc, collection } = await import('firebase/firestore')
        const { db } = await import('../lib/firebase')
        for (const s of matched) {
          await setDoc(
            doc(db, 'opportunities', opp.id, 'applicants', s.roll || s.email),
            { ...s, status: statusByStage[flow.type] || 'shortlisted', updatedAt: new Date() },
            { merge: true }
          )
        }
        await advanceStage(opp.id, flow.type, {
          message,
          trackerLink,
          whatsappGroupLink: waLink,
          studentCount: matched.length,
        }, user)
      }
      onClose()
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  return (
    <Modal open onClose={onClose} title={isMessageOnly ? 'Generate WhatsApp Message' : stageLabel} width={680}>
      {isMessageOnly && step === 'paste' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>Generate a WhatsApp announcement for the current state of this opportunity.</p>
          {err && <div style={{ fontSize: 13, color: 'var(--red-text)', marginBottom: 8 }}>{err}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" onClick={handleGenerateMessageOnly} disabled={busy}>{busy ? 'Generating…' : 'Generate Message'}</Btn>
          </div>
        </div>
      )}

      {!isMessageOnly && step === 'paste' && (
        <PasteStep
          rawText={rawText} setRawText={setRawText}
          busy={busy} err={err}
          placeholder={`Paste the ${stageLabel.toLowerCase()} text here…\n\nE.g. paste the WhatsApp message with names, roll numbers, tracker link, WhatsApp group link etc.`}
          onNext={handleParseShortlist}
          nextLabel="Match to Student DB →"
          onClose={onClose}
        />
      )}

      {step === 'review' && (
        <ReviewStep
          matched={matched} setMatched={setMatched}
          waLink={waLink} setWaLink={setWaLink}
          trackerLink={trackerLink} setTrackerLink={setTrackerLink}
          busy={busy} err={err}
          onBack={() => setStep('paste')}
          onNext={handleGenerateStageMessage}
        />
      )}

      {step === 'message' && (
        <MessageStep
          message={message} setMessage={setMessage}
          busy={busy} err={err}
          onBack={() => isMessageOnly ? onClose() : setStep('review')}
          onPost={isMessageOnly ? onClose : handleSave}
          label={isMessageOnly ? 'Done' : `Save & Advance Stage`}
        />
      )}
    </Modal>
  )
}

// ── Shared step components ────────────────────────────────────────────────────

function PasteStep({ rawText, setRawText, busy, err, placeholder, onNext, nextLabel = 'Parse with Gemini →', onClose }) {
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

function PreviewStep({ parsed, setParsed, busy, err, onBack, onNext }) {
  const FIELD_DEFS = [
    { key: 'title',        label: 'Title',        type: 'text' },
    { key: 'type',         label: 'Type',         type: 'select', options: TYPES },
    { key: 'organization', label: 'Organization', type: 'text' },
    { key: 'applicability',label: 'Applicability',type: 'select', options: ['summer', 'final', 'both'] },
    { key: 'roles',        label: 'Roles',        type: 'text', hint: 'comma separated', transform: v => Array.isArray(v) ? v.join(', ') : v, parse: v => v.split(',').map(s => s.trim()).filter(Boolean) },
    { key: 'stipend',      label: 'Stipend',      type: 'text' },
    { key: 'ctc',          label: 'CTC',          type: 'text' },
    { key: 'duration',     label: 'Duration',     type: 'text' },
    { key: 'location',     label: 'Location',     type: 'text' },
    { key: 'deadline',     label: 'Deadline',     type: 'text' },
    { key: 'eligibility',  label: 'Eligibility',  type: 'text' },
    { key: 'eoi_link',     label: 'EOI Link',     type: 'text' },
    { key: 'apply_link',   label: 'Apply Link',   type: 'text' },
    { key: 'tracker_link', label: 'Tracker Link', type: 'text' },
    { key: 'description',  label: 'Description',  type: 'textarea' },
  ]

  const set = (key, val, fieldDef) => {
    const parsed_val = fieldDef?.parse ? fieldDef.parse(val) : val
    setParsed(p => ({ ...p, [key]: parsed_val }))
  }

  return (
    <>
      <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>Review and edit before generating the WhatsApp message.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14, maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
        {FIELD_DEFS.map(f => {
          const raw = parsed[f.key]
          const display = f.transform ? f.transform(raw) : (raw == null ? '' : String(raw))
          return (
            <div key={f.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13 }}>
              <span style={{ width: 110, flexShrink: 0, color: 'var(--text-3)', fontWeight: 600, paddingTop: f.type === 'textarea' ? 6 : 8, fontSize: 12 }}>{f.label}</span>
              {f.type === 'select' ? (
                <select value={display} onChange={e => set(f.key, e.target.value, f)}
                  style={{ flex: 1, height: 32, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', padding: '0 10px', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea value={display} onChange={e => set(f.key, e.target.value, f)}
                  style={{ flex: 1, minHeight: 60, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', padding: '6px 10px', fontSize: 13, resize: 'vertical', fontFamily: 'var(--font-sans)' }} />
              ) : (
                <input value={display} onChange={e => set(f.key, e.target.value, f)}
                  placeholder={f.hint || ''}
                  style={{ flex: 1, height: 32, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', padding: '0 10px', fontSize: 13, fontFamily: 'var(--font-sans)' }} />
              )}
            </div>
          )
        })}
      </div>
      {err && <div style={{ fontSize: 13, color: 'var(--red-text)', marginBottom: 8 }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn onClick={onBack}>← Edit Text</Btn>
        <Btn variant="primary" onClick={onNext} disabled={busy}>{busy ? 'Generating…' : 'Generate WhatsApp Message →'}</Btn>
      </div>
    </>
  )
}

function ReviewStep({ matched, setMatched, waLink, setWaLink, trackerLink, setTrackerLink, busy, err, onBack, onNext }) {
  return (
    <>
      <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>
        Gemini matched <strong>{matched.length}</strong> student{matched.length !== 1 ? 's' : ''} from the student database. Review before proceeding.
      </p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>WhatsApp Group Link</label>
          <input value={waLink} onChange={e => setWaLink(e.target.value)} placeholder="https://chat.whatsapp.com/…"
            style={{ width: '100%', height: 32, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', padding: '0 10px', fontSize: 13, fontFamily: 'var(--font-sans)' }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>Tracker Link</label>
          <input value={trackerLink} onChange={e => setTrackerLink(e.target.value)} placeholder="https://docs.google.com/…"
            style={{ width: '100%', height: 32, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', padding: '0 10px', fontSize: 13, fontFamily: 'var(--font-sans)' }} />
        </div>
      </div>

      {matched.length > 0 ? (
        <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-3)', fontSize: 11 }}>Roll</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-3)', fontSize: 11 }}>Name</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-3)', fontSize: 11 }}>Role</th>
                <th style={{ padding: '6px 10px', width: 30 }}></th>
              </tr>
            </thead>
            <tbody>
              {matched.map((s, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '7px 10px', fontWeight: 600 }}>{s.roll}</td>
                  <td style={{ padding: '7px 10px' }}>{s.name}</td>
                  <td style={{ padding: '7px 10px', color: 'var(--text-2)' }}>{s.role || '—'}</td>
                  <td style={{ padding: '7px 10px' }}>
                    <button onClick={() => setMatched(m => m.filter((_, j) => j !== i))}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 2 }}>
                      <Trash2 size={11} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '12px 0', marginBottom: 12 }}>No students matched. You can still generate a message.</div>
      )}

      {err && <div style={{ fontSize: 13, color: 'var(--red-text)', marginBottom: 8 }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn onClick={onBack}>← Back</Btn>
        <Btn variant="primary" onClick={onNext} disabled={busy}>{busy ? 'Generating…' : 'Generate WhatsApp Message →'}</Btn>
      </div>
    </>
  )
}

function MessageStep({ message, setMessage, busy, err, onBack, onPost, label }) {
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

function MessageBox({ message }) {
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
