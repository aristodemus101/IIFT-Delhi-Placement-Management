import React, { useState } from 'react'
import { doc, updateDoc, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { Trash2, ExternalLink, Copy, Check } from 'lucide-react'
import { Sheet } from 'lucide-react'
import { Modal, Btn, Badge } from '../../components/UI'
import { useStages, useApplicants, advanceStage, STAGE_TYPES } from '../../lib/useOpportunities'
import { OPPORTUNITY_ACTIONS, ACTION_META } from '../../config/opportunityActions'
import { generateWhatsAppMessage, parseShortlist } from '../../lib/gemini'
import { BATCH_LABEL, STATUS_LABEL, typeColor, TypeIcon, normalizeOpportunityType } from './OppCard'
import { PasteStep, MessageStep, MessageBox, PreviewStep } from './PostModal'
import { serverTimestamp } from 'firebase/firestore'
import { blankOpportunity } from '../../lib/useOpportunities'

import {
  MessageSquare, Users, Award, Bell, FileText, XCircle, Plus,
} from 'lucide-react'

const ICON_MAP = { MessageSquare, Users, Award, Sheet, Bell, FileText, XCircle, Plus }

const NEEDS_PASTE = new Set([
  'release_shortlist', 'post_interview', 'post_final_selection', 'post_submission',
])
const MESSAGE_ONLY = new Set([
  'generate_announcement', 'generate_shortlist_msg', 'generate_interview_msg',
  'generate_final_msg', 'generate_reminder', 'generate_event_msg',
])
const TRACKER_ACTIONS = new Set([
  'create_eoi_tracker', 'create_shortlist_tracker', 'create_interview_tracker',
  'create_final_tracker', 'create_attendance_tracker',
])

export default function DetailModal({ opp, isAdmin, user, students, sheetsConnected, createTracker, addStageTab, propose, getCohortCycle, onClose }) {
  const stages = useStages(opp.id)
  const applicants = useApplicants(opp.id)
  const [tab, setTab] = useState('info')
  const [stageFlow, setStageFlow] = useState(null)
  const [editOpen, setEditOpen] = useState(false)

  return (
    <Modal open onClose={onClose} title={opp.title || 'Opportunity'} width={720}>
      <div style={{ display: 'flex', gap: 2, marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[
          { key: 'info',       label: 'Details' },
          { key: 'stages',     label: `Timeline (${stages.length})` },
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

      {tab === 'info'       && <InfoTab opp={opp} isAdmin={isAdmin} setStageFlow={setStageFlow} setEditOpen={setEditOpen} />}
      {tab === 'stages'     && <StagesTab stages={stages} />}
      {tab === 'applicants' && <ApplicantsTab applicants={applicants} />}

      {editOpen && (
        <EditModal opp={opp} onClose={() => setEditOpen(false)} />
      )}

      {stageFlow && (
        <StageFlowModal
          opp={opp} flow={stageFlow} user={user} students={students}
          sheetsConnected={sheetsConnected} createTracker={createTracker}
          addStageTab={addStageTab} propose={propose}
          getCohortCycle={getCohortCycle}
          onClose={() => setStageFlow(null)}
        />
      )}
    </Modal>
  )
}

function InfoTab({ opp, isAdmin, setStageFlow, setEditOpen }) {
  const [showAll, setShowAll] = useState(false)
  const displayType = normalizeOpportunityType(opp.type)

  const rows = [
    { label: 'Type',          value: opp.via ? `${displayType} · via ${opp.via}` : displayType },
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
    { label: 'EOI Form', url: opp.eoi_link },
    { label: 'Apply',    url: opp.apply_link },
    { label: 'Tracker',  url: opp.tracker_link },
  ].filter(l => l.url)

  const configEntry    = OPPORTUNITY_ACTIONS[displayType] || OPPORTUNITY_ACTIONS[opp.type]
  const allActionKeys  = Object.keys(ACTION_META)
  const configuredKeys = configEntry?.actions || allActionKeys
  const visibleKeys    = showAll ? allActionKeys : configuredKeys

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

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {links.map(({ label, url }) => (
          <Btn key={label} size="sm" variant="ghost" onClick={() => window.open(url, '_blank')}>{label} →</Btn>
        ))}
        {isAdmin && (
          <Btn size="sm" variant="ghost" onClick={() => setEditOpen(true)} style={{ marginLeft: 'auto' }}>Edit ✎</Btn>
        )}
      </div>

      {isAdmin && opp.status !== 'closed' && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Actions
            {!showAll && configuredKeys.length < allActionKeys.length && (
              <button onClick={() => setShowAll(true)} style={{ marginLeft: 10, fontSize: 11, fontWeight: 600, color: 'var(--accent)', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>Show all →</button>
            )}
            {showAll && (
              <button onClick={() => setShowAll(false)} style={{ marginLeft: 10, fontSize: 11, fontWeight: 600, color: 'var(--text-3)', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>← Show suggested</button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {visibleKeys.map(actionKey => {
              const meta = ACTION_META[actionKey]
              if (!meta) return null
              const Icon = ICON_MAP[meta.icon] || MessageSquare
              const isSuggested = configuredKeys.includes(actionKey)
              return (
                <button
                  key={actionKey}
                  onClick={() => setStageFlow({ type: actionKey, meta })}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: isSuggested ? 'var(--surface)' : 'color-mix(in srgb, var(--surface2) 60%, transparent)', cursor: 'pointer', textAlign: 'left', opacity: isSuggested ? 1 : 0.6 }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                    <Icon size={12} />{meta.label}
                    {!isSuggested && <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 400 }}>not in config</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>{meta.description}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {isAdmin && opp.notes && (
        <div style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber-text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Internal Notes (admin only)</div>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{opp.notes}</div>
        </div>
      )}

      {isAdmin && opp.status === 'closed' && (
        <div style={{ fontSize: 13, color: 'var(--text-3)', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          This opportunity is closed.
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

function EditModal({ opp, onClose }) {
  const [parsed, setParsed] = useState({ ...blankOpportunity(), ...opp })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const handleSave = async () => {
    setBusy(true); setErr('')
    try {
      const { id, createdAt, postedBy, _whatsappMessage, ...fields } = parsed
      await updateDoc(doc(db, 'opportunities', opp.id), { ...fields, updatedAt: serverTimestamp() })
      onClose()
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  return (
    <Modal open onClose={onClose} title="Edit Opportunity" width={700}>
      <PreviewStep
        parsed={parsed}
        setParsed={setParsed}
        busy={busy}
        err={err}
        onBack={onClose}
        onNext={handleSave}
        nextLabel={busy ? 'Saving…' : 'Save Changes'}
        backLabel="Cancel"
      />
    </Modal>
  )
}

function StageFlowModal({ opp, flow, user, students, sheetsConnected, createTracker, addStageTab, propose, getCohortCycle, onClose }) {
  const meta          = flow.meta || ACTION_META[flow.type] || {}
  const actionKey     = flow.type
  const stageLabel    = meta.label || actionKey
  const trackerConfig = meta.tracker || null

  const isMessageOnly = MESSAGE_ONLY.has(actionKey)
  const isTrackerOnly = TRACKER_ACTIONS.has(actionKey)
  const isMarkClosed  = actionKey === 'mark_closed'
  const needsPaste    = NEEDS_PASTE.has(actionKey)

  const initialStep = isTrackerOnly ? 'tracker' : isMessageOnly ? 'confirm' : needsPaste ? 'paste' : 'confirm'

  const [step, setStep]               = useState(initialStep)
  const [rawText, setRawText]         = useState('')
  const [matched, setMatched]         = useState([])
  const [studentMode, setStudentMode] = useState('matched')
  const [message, setMessage]         = useState('')
  const [waLink, setWaLink]           = useState('')
  const [trackerLink, setTrackerLink] = useState('')
  const [trackerCreating, setTrackerCreating] = useState(false)
  const [busy, setBusy]               = useState(false)
  const [err, setErr]                 = useState('')

  const resolveStudents = () => {
    if (studentMode === 'all') return students
    if (studentMode === 'ytp') {
      // Filter YTP based on opp applicability
      const ap = opp.applicability || 'final'
      if (ap === 'summer') return students.filter(s => !s._placed_summer)
      return students.filter(s => !s._placed_final)
    }
    return matched
  }

  const handleParseShortlist = async () => {
    setBusy(true); setErr('')
    try { const result = await parseShortlist(rawText, students); setMatched(result); setStep('review') }
    catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const handleCreateTracker = async () => {
    if (!sheetsConnected) { setErr('Connect Google Sheets in Team Access first.'); return }
    setTrackerCreating(true); setErr('')
    try {
      const studentsForTracker = resolveStudents()
      let result
      if (opp.trackerSheetId) {
        result = await addStageTab(opp.trackerSheetId, trackerConfig, studentsForTracker)
      } else {
        result = await createTracker(opp.title, studentsForTracker, trackerConfig)
        await updateDoc(doc(db, 'opportunities', opp.id), { trackerSheetId: result.spreadsheetId })
      }
      setTrackerLink(result.sheetUrl)
      if (isTrackerOnly) {
        await advanceStage(opp.id, actionKey, { trackerLink: result.sheetUrl, studentCount: resolveStudents().length }, user)
        onClose()
      }
    } catch (e) { setErr(e.message) }
    setTrackerCreating(false)
  }

  const handleGenerateMessage = async () => {
    setBusy(true); setErr('')
    try {
      const extra = { whatsappGroupLink: waLink, trackerLink, actionType: actionKey }
      if (actionKey === 'post_final_selection') {
        extra.selectedStudents = matched.map(s => `${s.name} (${s.roll})${s.role ? ' — ' + s.role : ''}`).join('\n')
      }
      setMessage(await generateWhatsAppMessage(opp, actionKey, extra))
      setStep('message')
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const handleMarkClosed = async () => {
    setBusy(true); setErr('')
    try { await updateDoc(doc(db, 'opportunities', opp.id), { status: 'closed' }); onClose() }
    catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const handleSave = async () => {
    setBusy(true); setErr('')
    try {
      const statusByAction = {
        release_shortlist: 'shortlisted', post_interview: 'interviewing',
        post_final_selection: 'selected', post_submission: 'shortlisted',
      }
      for (const s of matched) {
        await setDoc(
          doc(db, 'opportunities', opp.id, 'applicants', s.roll || s.email),
          { ...s, status: statusByAction[actionKey] || 'shortlisted', updatedAt: new Date() },
          { merge: true }
        )
        if (actionKey === 'post_final_selection') {
          const dbStudent = students.find(st =>
            (st['Roll No.'] && st['Roll No.'] === s.roll) ||
            (st['Official Email ID (d27/ba27)'] && st['Official Email ID (d27/ba27)'] === s.email) ||
            (st['Personal Email ID'] && st['Personal Email ID'] === s.email)
          )
          if (!dbStudent) continue
          // Derive cohort and its active cycle from student doc
          const cohortId = dbStudent.cohort || null
          const season = getCohortCycle ? getCohortCycle(cohortId) : 'final'
          await propose({
            type: 'place_from_activity',
            studentId: dbStudent._id,
            studentName: s.name || dbStudent['Full Name'] || `${dbStudent['First Name'] || ''} ${dbStudent['Last Name'] || ''}`.trim(),
            studentRoll: s.roll || dbStudent['Roll No.'] || '',
            company: opp.organization || '',
            cohort: cohortId,
            season,
            opportunityId: opp.id,
            opportunityTitle: opp.title || '',
            opportunityType: normalizeOpportunityType(opp.type) || '',
            placementDetails: {
              company: opp.organization || '',
              role: s.role || '',
              via: `Activity — ${opp.title || ''}`,
              package: opp.ctc || opp.stipend || '',
            },
          })
        }
      }
      await advanceStage(opp.id, actionKey, {
        message, trackerLink, whatsappGroupLink: waLink, studentCount: matched.length,
        pendingApproval: actionKey === 'post_final_selection',
      }, user)
      onClose()
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  if (isMarkClosed) {
    return (
      <Modal open onClose={onClose} title="Mark as Closed" width={480}>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
          Are you sure you want to close <strong>{opp.title}</strong>? No further actions will be available.
        </p>
        {err && <div style={{ fontSize: 13, color: 'var(--red-text)', marginBottom: 8 }}>{err}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="danger" onClick={handleMarkClosed} disabled={busy}>{busy ? 'Closing…' : 'Yes, Mark Closed'}</Btn>
        </div>
      </Modal>
    )
  }

  const reviewProps = {
    opp, matched, setMatched, studentMode, setStudentMode, students,
    waLink, setWaLink, trackerLink, setTrackerLink,
    trackerConfig, sheetsConnected, trackerCreating,
    onCreateTracker: handleCreateTracker, busy, err,
  }

  if (isTrackerOnly) {
    return (
      <Modal open onClose={onClose} title={stageLabel} width={580}>
        <ReviewStep {...reviewProps} matched={[]} setMatched={() => {}} onBack={onClose} onNext={null} trackerOnly />
      </Modal>
    )
  }

  return (
    <Modal open onClose={onClose} title={stageLabel} width={700}>
      {step === 'confirm' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4, lineHeight: 1.6 }}>{meta.description}</p>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>Gemini will use the current opportunity details to generate the message.</p>
          {err && <div style={{ fontSize: 13, color: 'var(--red-text)', marginBottom: 8 }}>{err}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" onClick={handleGenerateMessage} disabled={busy}>{busy ? 'Generating…' : 'Generate Message →'}</Btn>
          </div>
        </div>
      )}
      {step === 'paste' && (
        <PasteStep rawText={rawText} setRawText={setRawText} busy={busy} err={err}
          placeholder={`Paste the ${stageLabel.toLowerCase()} text here…\n\nInclude names, roll numbers, any links etc.`}
          onNext={handleParseShortlist} nextLabel="Match to Student DB →" onClose={onClose}
        />
      )}
      {step === 'review' && (
        <ReviewStep {...reviewProps} onBack={() => setStep('paste')} onNext={handleGenerateMessage} />
      )}
      {step === 'message' && (
        <MessageStep message={message} setMessage={setMessage} busy={busy} err={err}
          onBack={() => needsPaste ? setStep('review') : setStep('confirm')}
          onPost={needsPaste ? handleSave : onClose}
          label={actionKey === 'post_final_selection' ? 'Submit for Approval' : needsPaste ? 'Save & Record Stage' : 'Done'}
        />
      )}
    </Modal>
  )
}

function ReviewStep({
  opp, matched, setMatched, studentMode, setStudentMode, students,
  waLink, setWaLink, trackerLink, setTrackerLink,
  trackerConfig, sheetsConnected, trackerCreating, onCreateTracker,
  busy, err, onBack, onNext, trackerOnly = false,
}) {
  const ap = opp?.applicability || 'final'
  const ytpCount = students.filter(s => ap === 'summer' ? !s._placed_summer : !s._placed_final).length
  const studentModeLabel = {
    matched: `Shortlisted only (${matched.length})`,
    ytp:     `All yet-to-be-placed (${ytpCount})`,
    all:     `Entire batch (${students.length})`,
  }

  return (
    <>
      <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>
        Gemini matched <strong>{matched.length}</strong> student{matched.length !== 1 ? 's' : ''} from the DB. Review the list, set up the tracker, then generate the WhatsApp message.
      </p>

      {matched.length > 0 ? (
        <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', position: 'sticky', top: 0 }}>
                {['Roll', 'Name', 'Role', ''].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-3)', fontSize: 11, width: h === '' ? 28 : 'auto' }}>{h}</th>
                ))}
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
        <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '8px 0', marginBottom: 14 }}>No students matched from the pasted text. You can still create the tracker with a broader student set.</div>
      )}

      {trackerConfig && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: 14, background: 'var(--surface2)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sheet size={13} /> Create Tracker — <span style={{ color: 'var(--accent-dark)' }}>{trackerConfig.sheetTitle}</span> tab
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>Students to include in tracker</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(studentModeLabel).map(([mode, label]) => (
                <button key={mode} onClick={() => setStudentMode(mode)} style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${studentMode === mode ? 'var(--accent)' : 'var(--border)'}`,
                  background: studentMode === mode ? 'var(--accent-bg)' : 'var(--surface)',
                  color: studentMode === mode ? 'var(--accent-dark)' : 'var(--text-2)',
                }}>{label}</button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
            Sheet: <strong>{trackerConfig.sheetTitle}</strong> · Columns: Roll No. | Name | Official Email | <strong>{trackerConfig.colHeader}</strong> (Yes/No dropdown, default No)
            {opp.trackerSheetId && <span style={{ marginLeft: 6, color: 'var(--amber-text)' }}>· Adds a new tab to existing tracker</span>}
          </div>
          {trackerLink ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Badge color="green">Tracker created</Badge>
              <a href={trackerLink} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ExternalLink size={11} /> Open Sheet
              </a>
              <button onClick={() => setTrackerLink('')} style={{ fontSize: 11, color: 'var(--text-3)', border: 'none', background: 'none', cursor: 'pointer', marginLeft: 4 }}>Re-create</button>
            </div>
          ) : (
            <Btn size="sm" variant={sheetsConnected ? 'primary' : 'default'} onClick={onCreateTracker} disabled={trackerCreating || !sheetsConnected}>
              <Sheet size={12} /> {trackerCreating ? 'Creating…' : sheetsConnected ? 'Create Tracker Sheet' : 'Connect Sheets first (Team Access)'}
            </Btn>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'WhatsApp Group Link', val: waLink, set: setWaLink, placeholder: 'https://chat.whatsapp.com/…' },
          { label: 'Tracker Link (auto-filled above, or paste)', val: trackerLink, set: setTrackerLink, placeholder: 'https://docs.google.com/…' },
        ].map(({ label, val, set, placeholder }) => (
          <div key={label} style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>{label}</label>
            <input value={val} onChange={e => set(e.target.value)} placeholder={placeholder}
              style={{ width: '100%', height: 32, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', padding: '0 10px', fontSize: 13, fontFamily: 'var(--font-sans)' }} />
          </div>
        ))}
      </div>

      {err && <div style={{ fontSize: 13, color: 'var(--red-text)', marginBottom: 8 }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn onClick={onBack}>← Back</Btn>
        {!trackerOnly && onNext && (
          <Btn variant="primary" onClick={onNext} disabled={busy}>{busy ? 'Generating…' : 'Generate WhatsApp Message →'}</Btn>
        )}
      </div>
    </>
  )
}
