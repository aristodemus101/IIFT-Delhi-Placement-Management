import React, { useState } from 'react'
import { Btn, Badge, TabBar } from '../../components/UI'
import { X, Building2, MapPin, Calendar, Users, DollarSign, FileText, Edit2, Save } from 'lucide-react'
import { sectorColor } from './IntelTable'
import CompanyLogo from './CompanyLogo'
import { fuzzyMatch } from '../../lib/intel'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../lib/AuthContext'
import { usePermissions } from '../../lib/usePermissions'

const CYCLE_COLOR = { Finals: 'blue', Summer: 'amber', Lateral: 'gray' }

// Strict name match for IIFT history: normalise then check exact equality or
// containment. Deliberately avoids token-overlap so "Bandhan Bank" doesn't
// match "ICICI Bank", "Axis Bank" etc. via the shared "BANK" token.
function normalize(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}
function strictMatch(a, b) {
  if (!a || !b) return false
  const na = normalize(a), nb = normalize(b)
  return na === nb || na.includes(nb) || nb.includes(na)
}

// All intel records for the same recruiter (by name/alias fuzzy match)
function useAllRecordsForCompany(record, allRecords) {
  if (!record) return []
  return allRecords.filter(r =>
    r._id !== record._id && (
      fuzzyMatch(r.recruiterName, record.recruiterName) ||
      fuzzyMatch(r.alias, record.recruiterName)
    )
  )
}

export default function CompanyDrawer({ record, allRecords, iiftStudents, onClose, onEdit }) {
  const { user } = useAuth()
  const { canDo } = usePermissions()
  const canWrite = canDo('writeIntel')

  const [tab, setTab] = useState('overview')
  const [pocDraft, setPocDraft] = useState(null)  // null = not editing
  const [saving, setSaving] = useState(false)

  const related = useAllRecordsForCompany(record, allRecords)

  // IIFT students placed at this company.
  // Uses containment-only match (not token overlap) to avoid false positives
  // from shared generic tokens like "Bank", "Capital", "Finance" etc.
  const iiftMatches = iiftStudents.filter(s => {
    const fc = s._placement_final?.company  || ''
    const sc = s._placement_summer?.company || ''
    return (s._placed_final   && strictMatch(fc, record.recruiterName)) ||
           (s._placed_summer  && strictMatch(sc, record.recruiterName))
  })

  if (!record) return null

  const startPocEdit = () => setPocDraft({
    name:  record.poc?.name  || '',
    email: record.poc?.email || '',
    phone: record.poc?.phone || '',
    notes: record.notes || '',
    compensation: record.compensation || '',
  })

  const savePoc = async () => {
    setSaving(true)
    try {
      await updateDoc(doc(db, 'intel', record._id), {
        poc: { name: pocDraft.name, email: pocDraft.email, phone: pocDraft.phone },
        notes: pocDraft.notes,
        compensation: pocDraft.compensation,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      })
      setPocDraft(null)
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { key: 'overview',  label: 'Overview' },
    { key: 'iift',      label: `IIFT History ${iiftMatches.length ? `(${iiftMatches.length})` : ''}` },
    { key: 'all',       label: `All Records ${related.length ? `(${related.length + 1})` : ''}` },
    { key: 'poc',       label: 'POC & Notes' },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(2px)' }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 520, maxWidth: '95vw',
        zIndex: 200, background: 'var(--surface)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow)',
        animation: 'slideInRight 0.22s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12, flexShrink: 0 }}>
          <CompanyLogo name={record.recruiterName} size={40} sector={record.sector} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', letterSpacing: '-0.02em' }}>
              {record.recruiterName}
            </div>
            {record.alias && record.alias !== record.recruiterName && (
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>aka {record.alias}</div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {record.sector && <Badge color="gray">{record.sector}</Badge>}
              <Badge color={record._iiftStatus === 'at_iift' ? 'green' : 'amber'}>
                {record._iiftStatus === 'at_iift' ? 'At IIFT' : 'IIFT Gap'}
              </Badge>
              {record.placementCycle && <Badge color={CYCLE_COLOR[record.placementCycle] || 'gray'}>{record.placementCycle}</Badge>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {canWrite && (
              <Btn size="sm" variant="ghost" onClick={() => onEdit(record)}>
                <Edit2 size={13} /> Edit
              </Btn>
            )}
            <button
              onClick={onClose}
              style={{ border: 'none', background: 'var(--surface2)', cursor: 'pointer', color: 'var(--text-2)', padding: 6, borderRadius: 6, display: 'flex' }}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <TabBar tabs={tabs} active={tab} onChange={setTab} style={{ borderBottom: '1px solid var(--border)' }} />

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '18px 20px' }}>

          {/* ── Overview ── */}
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Section label="Recruiter Details">
                <Field icon={Building2} label="College" value={[record.collegeName, record.campus].filter(Boolean).join(' · ')} />
                <Field icon={Calendar} label="Year" value={record.placementYear} />
                <Field label="Cycle" value={record.placementCycle} />
                <Field label="Program" value={record.program} />
                <Field label="Recruiter Type" value={record.recruiterType} />
              </Section>
              <Section label="Placement Details">
                <Field label="Sector" value={record.sector} />
                <Field label="Function" value={record.function} />
                <Field label="Role(s)" value={record.rolesMentioned} />
                <Field icon={Users} label="Offers" value={record.numberOfOffers} />
                <Field icon={DollarSign} label="Compensation" value={record.compensation} emphasis />
                {record.internationalOpp && (
                  <Field icon={MapPin} label="International" value={record.internationalLoc || 'Yes'} />
                )}
              </Section>
              <Section label="Source">
                <Field label="Source Report" value={record.sourceReport} />
                <Field label="Source Type" value={record.sourceType} />
                <Field label="Evidence" value={record.evidence} />
                <Field label="Remarks" value={record.remarks} />
              </Section>
            </div>
          )}

          {/* ── IIFT History ── */}
          {tab === 'iift' && (
            <div>
              {iiftMatches.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '40px 0', fontSize: 14 }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Not at IIFT (last 2 years)</div>
                  <div style={{ fontSize: 12 }}>This recruiter has not placed students at IIFT Delhi recently.<br />First seen at {record.collegeName || 'a peer college'}{record.placementYear ? ` in ${record.placementYear}` : ''}.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
                    {iiftMatches.length} IIFT student{iiftMatches.length !== 1 ? 's' : ''} placed at this company
                  </p>
                  {iiftMatches.map(s => (
                    <div key={s._id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: 'var(--surface2)' }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name || s['Student Name'] || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                        {s._placed_final ? `Final · ${s._placement_final?.company} · ${s._placement_final?.role || ''}` : ''}
                        {s._placed_summer ? `Summer · ${s._placement_summer?.company} · ${s._placement_summer?.role || ''}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── All Records ── */}
          {tab === 'all' && (
            <AllRecordsGrouped records={[record, ...related]} activeId={record._id} />
          )}

          {/* ── POC & Notes ── */}
          {tab === 'poc' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {pocDraft === null ? (
                <>
                  <Section label="Point of Contact">
                    <Field label="Name" value={record.poc?.name} />
                    <Field label="Email" value={record.poc?.email} />
                    <Field label="Phone" value={record.poc?.phone} />
                  </Section>
                  <Section label="Compensation">
                    <Field icon={DollarSign} label="Package / CTC" value={record.compensation} emphasis />
                  </Section>
                  <Section label="Notes">
                    {record.notes
                      ? <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{record.notes}</p>
                      : <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>No notes yet.</p>}
                  </Section>
                  {canWrite && (
                    <Btn size="sm" variant="ghost" onClick={startPocEdit}>
                      <Edit2 size={13} /> Edit POC & Notes
                    </Btn>
                  )}
                </>
              ) : (
                <>
                  <label style={{ display: 'block' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 5 }}>POC Name</div>
                    <input value={pocDraft.name} onChange={e => setPocDraft(p => ({ ...p, name: e.target.value }))}
                      style={inputStyle} placeholder="Contact name" />
                  </label>
                  <label style={{ display: 'block' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 5 }}>Email</div>
                    <input value={pocDraft.email} onChange={e => setPocDraft(p => ({ ...p, email: e.target.value }))}
                      style={inputStyle} placeholder="poc@company.com" type="email" />
                  </label>
                  <label style={{ display: 'block' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 5 }}>Phone</div>
                    <input value={pocDraft.phone} onChange={e => setPocDraft(p => ({ ...p, phone: e.target.value }))}
                      style={inputStyle} placeholder="+91 98765 43210" />
                  </label>
                  <label style={{ display: 'block' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 5 }}>Compensation</div>
                    <input value={pocDraft.compensation} onChange={e => setPocDraft(p => ({ ...p, compensation: e.target.value }))}
                      style={inputStyle} placeholder="e.g. 18–24 LPA" />
                  </label>
                  <label style={{ display: 'block' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 5 }}>Notes</div>
                    <textarea value={pocDraft.notes} onChange={e => setPocDraft(p => ({ ...p, notes: e.target.value }))}
                      rows={4} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-sans)' }}
                      placeholder="Any intelligence, context, or follow-up notes…" />
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn size="sm" variant="primary" onClick={savePoc} disabled={saving}>
                      <Save size={13} /> {saving ? 'Saving…' : 'Save'}
                    </Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setPocDraft(null)} disabled={saving}>Cancel</Btn>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}

const CYCLE_ORDER = ['Finals', 'Summer', 'Lateral']
const CYCLE_COLOR_MAP = { Finals: 'blue', Summer: 'amber', Lateral: 'gray' }

function AllRecordsGrouped({ records, activeId }) {
  // Group: cycle → college → year → program
  const byCycle = {}
  for (const r of records) {
    const cycle   = r.placementCycle || 'Unknown'
    const college = [r.collegeName, r.campus].filter(Boolean).join(' · ') || '—'
    const year    = r.placementYear || '—'
    const program = r.program || '—'
    ;(byCycle[cycle] ??= {})[college] ??= {}
    ;(byCycle[cycle][college][year] ??= {})[program] ??= []
    byCycle[cycle][college][year][program].push(r)
  }

  const cycles = CYCLE_ORDER.filter(c => byCycle[c]).concat(
    Object.keys(byCycle).filter(c => !CYCLE_ORDER.includes(c)).sort()
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
        {records.length} record{records.length !== 1 ? 's' : ''} across colleges and years
      </p>

      {cycles.map(cycle => {
        const colleges = Object.keys(byCycle[cycle]).sort()
        return (
          <div key={cycle}>
            {/* Cycle header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Badge color={CYCLE_COLOR_MAP[cycle] || 'gray'}>{cycle}</Badge>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                {Object.values(byCycle[cycle]).reduce((n, yrs) =>
                  n + Object.values(yrs).reduce((m, progs) =>
                    m + Object.values(progs).reduce((k, rs) => k + rs.length, 0), 0), 0)
                } record{Object.values(byCycle[cycle]).reduce((n, yrs) => n + Object.values(yrs).reduce((m, progs) => m + Object.values(progs).reduce((k, rs) => k + rs.length, 0), 0), 0) !== 1 ? 's' : ''}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 4 }}>
              {colleges.map(college => {
                const years = Object.keys(byCycle[cycle][college]).sort((a, b) => b - a)
                return (
                  <div key={college} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    {/* College header */}
                    <div style={{
                      padding: '7px 12px', background: 'color-mix(in srgb, var(--surface2) 70%, transparent)',
                      borderBottom: '1px solid var(--border)',
                      fontSize: 12, fontWeight: 600, color: 'var(--text)',
                    }}>
                      {college}
                    </div>

                    {/* Year rows */}
                    {years.map((year, yi) => {
                      const programs = Object.keys(byCycle[cycle][college][year]).sort()
                      return programs.map((program, pi) => {
                        const recs = byCycle[cycle][college][year][program]
                        const isActive = recs.some(r => r._id === activeId)
                        const isLast = yi === years.length - 1 && pi === programs.length - 1
                        return (
                          <div
                            key={`${year}-${program}`}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '7px 12px',
                              borderBottom: isLast ? 'none' : '1px solid color-mix(in srgb, var(--border) 50%, transparent)',
                              background: isActive ? 'var(--accent-bg)' : 'transparent',
                            }}
                          >
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{year}</span>
                              {program !== '—' && (
                                <span style={{ fontSize: 11, color: 'var(--text-3)', background: 'var(--surface2)', borderRadius: 4, padding: '1px 6px' }}>{program}</span>
                              )}
                              {isActive && (
                                <span style={{ fontSize: 10, color: 'var(--accent-dark)', fontWeight: 600, background: 'var(--accent-bg)', borderRadius: 4, padding: '1px 6px', border: '1px solid var(--accent-border, var(--accent))' }}>this record</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              {recs[0].numberOfOffers != null && (
                                <span style={{ fontSize: 11, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>{recs[0].numberOfOffers} offer{recs[0].numberOfOffers !== 1 ? 's' : ''}</span>
                              )}
                              {recs[0].compensation && (
                                <Badge color="green">{recs[0].compensation}</Badge>
                              )}
                            </div>
                          </div>
                        )
                      })
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
    </div>
  )
}

function Field({ label, value, icon: Icon, emphasis }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
      {Icon && <Icon size={13} style={{ color: 'var(--text-3)', marginTop: 2, flexShrink: 0 }} />}
      <span style={{ color: 'var(--text-3)', flexShrink: 0, minWidth: 90 }}>{label}</span>
      <span style={{ color: 'var(--text)', fontWeight: emphasis ? 600 : 400 }}>{value}</span>
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text)', fontSize: 13, boxSizing: 'border-box',
  fontFamily: 'var(--font-sans)',
}
