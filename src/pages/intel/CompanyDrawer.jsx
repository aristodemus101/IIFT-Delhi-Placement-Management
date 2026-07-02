import React, { useState } from 'react'
import { Btn, Badge, TabBar } from '../../components/UI'
import { X, Building2, MapPin, Calendar, Users, DollarSign, FileText, Edit2, Save } from 'lucide-react'
import { sectorColor } from './IntelTable'
import { fuzzyMatch } from '../../lib/intel'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../lib/AuthContext'
import { usePermissions } from '../../lib/usePermissions'

const CYCLE_COLOR = { Finals: 'blue', Summer: 'amber', Lateral: 'gray' }

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

  // IIFT students placed at this company (fuzzy)
  const iiftMatches = iiftStudents.filter(s => {
    const fc = s._placement_final?.company || ''
    const sc = s._placement_summer?.company || ''
    return (s._placed_final && fuzzyMatch(fc, record.recruiterName)) ||
           (s._placed_summer && fuzzyMatch(sc, record.recruiterName))
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
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: sectorColor(record.sector),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 800, color: '#fff',
          }}>
            {(record.recruiterName || '?')[0].toUpperCase()}
          </div>
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
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
                All appearances of this recruiter across colleges and years ({related.length + 1} record{related.length !== 0 ? 's' : ''})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[record, ...related].map(r => (
                  <div key={r._id} style={{
                    border: `1px solid ${r._id === record._id ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 8, padding: '10px 12px',
                    background: r._id === record._id ? 'var(--accent-bg)' : 'var(--surface2)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{r.collegeName || '—'} {r.campus ? `· ${r.campus}` : ''}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                          {[r.placementYear, r.placementCycle, r.program].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {r.numberOfOffers != null && (
                          <Badge color="gray">{r.numberOfOffers} offer{r.numberOfOffers !== 1 ? 's' : ''}</Badge>
                        )}
                        {r.compensation && <Badge color="green">{r.compensation}</Badge>}
                      </div>
                    </div>
                    {r.rolesMentioned && (
                      <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>{r.rolesMentioned}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
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
