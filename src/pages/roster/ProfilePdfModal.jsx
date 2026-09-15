import React, { useMemo, useRef, useState } from 'react'
import { Btn, Modal, Badge } from '../../components/UI'
import { buildProfilesHtml } from '../../lib/profilePdf'
import { FileDown, Printer } from 'lucide-react'
import './profilePrint.css'

// Renders a modal that previews the profile document for the selected
// students, then triggers the browser's native print-to-PDF dialog scoped
// to a hidden #profile-print-root via the @media print rules in
// profilePrint.css. No PDF library needed — output is real, selectable
// text, not a rasterized image.
export default function ProfilePdfModal({
  open, onClose, students, columnDefs, getValue, institute = 'IIFT Delhi', batchLabel = '',
}) {
  const printRootRef = useRef(null)
  const [printing, setPrinting] = useState(false)

  const html = useMemo(() => {
    if (!open || !students.length) return ''
    return buildProfilesHtml({ students, columnDefs, getValue, institute, batchLabel })
  }, [open, students, columnDefs, getValue, institute, batchLabel])

  const handlePrint = () => {
    setPrinting(true)
    // Let the print root paint before invoking the print dialog
    requestAnimationFrame(() => {
      window.print()
      setPrinting(false)
    })
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Candidate Profile PDF" width={560}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
            Generates one profile page per selected candidate, using the columns currently visible
            in the roster. Fields with no data are omitted automatically.
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge color="blue">{students.length} candidate{students.length === 1 ? '' : 's'}</Badge>
            <Badge color="gray">{columnDefs.length} visible column{columnDefs.length === 1 ? '' : 's'}</Badge>
          </div>

          {students.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              Select one or more candidates in the roster first.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-3)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', lineHeight: 1.6 }}>
                In the print dialog, set <strong>Destination</strong> to <strong>Save as PDF</strong>. Each candidate prints on their own page — {students.length > 1 ? `${students.length} pages total.` : '1 page total.'}
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Btn onClick={onClose}>Cancel</Btn>
                <Btn variant="primary" onClick={handlePrint} disabled={printing}>
                  <Printer size={13} /> {printing ? 'Opening print dialog…' : 'Print / Save as PDF'}
                </Btn>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Off-screen print surface — only visible to the browser's print engine */}
      <div id="profile-print-root" ref={printRootRef} dangerouslySetInnerHTML={{ __html: html }} />
    </>
  )
}

export const ProfilePdfTriggerIcon = FileDown
