import React, { useMemo, useState } from 'react'
import { Btn, Modal, Badge } from '../../components/UI'
import { buildStudentProfile, profileToText } from '../../lib/studentProfile'
import { downloadProfileCard } from '../../lib/profileCardCanvas'
import { getVal } from '../../lib/columns'
import { FileDown, Download, Copy, Check } from 'lucide-react'

// Downloads a clean profile-card PNG per selected candidate. Replaces the old
// window.print() approach, which broke on mobile and clipped pages. Canvas
// rendering works everywhere (incl. phones), never clips, and needs no print
// dialog. Each candidate has its own Download button so every download is a
// distinct user gesture — mobile browsers block multi-downloads from one tap.
export default function ProfilePdfModal({ open, onClose, students }) {
  const [copiedId, setCopiedId] = useState(null)
  const [busyId, setBusyId] = useState(null)

  // Precompute the profile for each selected student.
  const items = useMemo(
    () => (open ? students.map(s => ({ id: s._id, student: s, profile: buildStudentProfile(s) })) : []),
    [open, students]
  )

  const download = async (item) => {
    setBusyId(item.id)
    try {
      await downloadProfileCard(item.profile, `${(item.profile.name || 'candidate').replace(/\s+/g, '_')} - IIFT Delhi.png`)
    } finally {
      setBusyId(null)
    }
  }

  const copy = (item) => {
    navigator.clipboard?.writeText(profileToText(item.profile)).then(() => {
      setCopiedId(item.id)
      setTimeout(() => setCopiedId(null), 1500)
    }).catch(() => {})
  }

  return (
    <Modal open={open} onClose={onClose} title="Download Profile Cards" width={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {students.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            Select one or more candidates in the roster first.
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
              Download a clean IIFT-branded profile card (PNG) for each selected candidate.
              Works on mobile — no print dialog.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Badge color="blue">{students.length} candidate{students.length === 1 ? '' : 's'}</Badge>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
              {items.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.profile.name || getVal(item.student, 'name') || 'Unnamed'}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {[item.profile.roll, item.profile.course, item.profile.gradYear && `'${String(item.profile.gradYear).slice(-2)}`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <button
                    onClick={() => copy(item)}
                    title="Copy details"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', fontSize: 11.5, fontWeight: 600, color: copiedId === item.id ? 'var(--green-text)' : 'var(--text-2)', fontFamily: 'var(--font-sans)', flexShrink: 0 }}
                  >
                    {copiedId === item.id ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                  </button>
                  <Btn size="sm" variant="primary" onClick={() => download(item)} disabled={busyId === item.id}>
                    <Download size={13} /> {busyId === item.id ? '…' : 'PNG'}
                  </Btn>
                </div>
              ))}
            </div>

            {students.length > 1 && (
              <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                Tap each candidate's <strong>PNG</strong> button to save their card. (Mobile browsers save one file per tap.)
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Btn onClick={onClose}>Done</Btn>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

export const ProfilePdfTriggerIcon = FileDown
