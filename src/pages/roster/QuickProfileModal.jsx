import React, { useMemo, useState, useEffect } from 'react'
import { Modal, Btn, Badge } from '../../components/UI'
import { getVal } from '../../lib/columns'
import { cohortLabel } from '../../lib/batch'
import { useSearch } from '../../lib/useSearch'
import { buildStudentProfile, profileToText } from '../../lib/studentProfile'
import { downloadProfileCard } from '../../lib/profileCardCanvas'
import { Search, Download, Copy, Check } from 'lucide-react'

// Global quick-lookup: search any student across ALL cohorts, view a clean
// profile, download it as an image or copy the details.
export default function QuickProfileModal({ open, onClose, students }) {
  const { searchTerm, setSearchTerm, match } = useSearch(students)
  const [selected, setSelected] = useState(null)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // Reset state each time the modal opens.
  useEffect(() => {
    if (open) { setSearchTerm(''); setSelected(null); setCopied(false) }
  }, [open])

  // Matching students (cap the list so typing stays snappy with thousands).
  const results = useMemo(() => {
    if (!searchTerm.trim()) return []
    const out = []
    for (let i = 0; i < students.length && out.length < 40; i++) {
      if (!match || match.has(i)) out.push(students[i])
    }
    return out
  }, [students, match, searchTerm])

  const profile = useMemo(() => (selected ? buildStudentProfile(selected) : null), [selected])

  const handleCopy = () => {
    if (!profile) return
    navigator.clipboard?.writeText(profileToText(profile)).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  const handleDownload = async () => {
    if (!profile) return
    setDownloading(true)
    try { await downloadProfileCard(profile) } finally { setDownloading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Quick Profile Lookup" width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
          Search any candidate across all cohorts by name, roll, email, or company.
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input
            autoFocus
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setSelected(null) }}
            placeholder="Start typing a name, roll, email…"
            style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}
          />
        </div>

        {/* Results list (hidden once a candidate is picked) */}
        {!selected && searchTerm.trim() && (
          <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {results.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: 16 }}>No candidates match.</div>
            ) : results.map(s => (
              <button
                key={s._id}
                onClick={() => setSelected(s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {getVal(s, 'name') || 'Unnamed'}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {getVal(s, 'roll')}{getVal(s, 'roll') ? ' · ' : ''}{cohortLabel(s.cohort)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Selected profile preview */}
        {profile && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <div style={{ background: '#1d3557', color: '#fff', padding: '10px 16px' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{profile.name || 'Unnamed'}</div>
              <div style={{ fontSize: 11.5, opacity: 0.8 }}>
                {[profile.course, profile.gradYear && `Class of ${profile.gradYear}`].filter(Boolean).join('  ·  ')}
              </div>
            </div>
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 18px' }}>
              <Field label="Official Email" value={profile.officialEmail} />
              <Field label="Contact" value={profile.mobile} />
              <Field label="Class X" value={profile.x10 ? `${profile.x10}%` : ''} />
              <Field label="Class XII" value={profile.x12 ? `${profile.x12}%` : ''} />
              <Field label="UG Score" value={profile.ug ? `${profile.ug}%` : ''} />
              <Field label="Work Ex" value={profile.workEx ? `${profile.workEx} months` : ''} />
              <Field label="Most Recent Company" value={profile.recentCompany} wide />
              {profile.sipCompany && <Field label="SIP Company" value={profile.sipCompany} wide chip="SIP" />}
              {profile.finalCompany && <Field label="Final Company" value={profile.finalCompany} wide chip="Final" />}
            </div>
          </div>
        )}

        {/* Actions */}
        {profile && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Btn variant="ghost" onClick={() => setSelected(null)}>Back to search</Btn>
            <Btn variant="ghost" onClick={handleCopy}>
              {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy details</>}
            </Btn>
            <Btn variant="primary" onClick={handleDownload} disabled={downloading}>
              <Download size={14} /> {downloading ? 'Preparing…' : 'Download image'}
            </Btn>
          </div>
        )}
      </div>
    </Modal>
  )
}

function Field({ label, value, wide, chip }) {
  if (!value) return null
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : 'auto' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
        {chip && <Badge color={chip === 'SIP' ? 'amber' : 'green'}>{chip}</Badge>}
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', wordBreak: 'break-word' }}>{value}</div>
    </div>
  )
}
