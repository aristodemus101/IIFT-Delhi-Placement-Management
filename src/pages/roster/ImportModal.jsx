import React from 'react'
import { cohortLabel } from '../../lib/batch'
import CohortPicker from '../../components/CohortPicker'
import { Btn, Modal, Spinner } from '../../components/UI'
import { Upload, CheckCircle } from 'lucide-react'

export function ImportCohortNote({ cohortId, students }) {
  const count = students.filter(s => (s.cohort || 'unknown') === cohortId).length
  return (
    <div style={{ fontSize: 13, color: 'var(--text-2)', padding: '8px 12px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
      {count > 0
        ? <>Adding to existing: <strong>{cohortLabel(cohortId)}</strong> ({count} students already)</>
        : <>Will create new cohort: <strong>{cohortLabel(cohortId || '…')}</strong></>
      }
    </div>
  )
}

export default function ImportModal({
  open, onClose,
  step, importCohort, setImportCohort,
  importCycle, setImportCycle,
  importFile, importParsed,
  importing, importMsg,
  replaceOnImport, setReplaceOnImport,
  includeSipData, setIncludeSipData,
  students, selectedCohort, changes,
  onChooseFile, onProposeImport,
  lastImportSummary,
  onReset,
}) {
  return (
    <Modal
      open={open}
      onClose={() => { if (importing) return; onClose() }}
      title="Import Students"
      width={540}
    >
      {step === 1 && (
        <div style={{ display: 'grid', gap: 16 }}>
          {(() => {
            const queued = changes.filter(c => c.status === 'pending' && c.type === 'import')
            return queued.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--accent-dark)' }}>
                <CheckCircle size={14} />
                {queued.length} import{queued.length > 1 ? 's' : ''} queued for approval — you can queue another below.
              </div>
            ) : null
          })()}

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Cohort</label>
            <CohortPicker value={importCohort} onChange={setImportCohort} showPreview={!!importCohort} />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Current placement cycle</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[{ value: 'summer', label: 'Summer Internship (SIP)' }, { value: 'final', label: 'Final Placement' }].map(opt => (
                <button key={opt.value} onClick={() => setImportCycle(opt.value)} disabled={includeSipData} style={{
                  flex: 1, padding: '8px 0', borderRadius: 'var(--radius-sm)', cursor: includeSipData ? 'default' : 'pointer',
                  fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-sans)',
                  border: `1px solid ${importCycle === opt.value ? (opt.value === 'summer' ? 'var(--amber)' : 'var(--accent)') : 'var(--border)'}`,
                  background: importCycle === opt.value ? (opt.value === 'summer' ? 'var(--amber-bg)' : 'var(--accent-bg)') : 'var(--surface)',
                  color: importCycle === opt.value ? (opt.value === 'summer' ? 'var(--amber-text)' : 'var(--accent-dark)') : 'var(--text-2)',
                  opacity: includeSipData && opt.value === 'summer' ? 0.4 : 1,
                }}>{opt.label}</button>
              ))}
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 12px', border: `1px solid ${includeSipData ? 'var(--amber)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', background: includeSipData ? 'var(--amber-bg)' : 'var(--surface2)' }}>
            <input type="checkbox" checked={includeSipData} onChange={e => setIncludeSipData(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: includeSipData ? 'var(--amber-text)' : 'var(--text-2)' }}>Summer (SIP) data already in file</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.5 }}>
                File includes SIP Status, SIP Company, SIP Role, DOP etc. Students with <em>SIP Status = Placed</em> will be marked as Summer placed. Cycle will be set to <strong>Final</strong>.
              </div>
            </div>
          </label>

          <ImportCohortNote cohortId={importCohort || selectedCohort} students={students} />

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-2)', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: replaceOnImport ? 'var(--amber-bg)' : 'var(--surface2)' }}>
            <input type="checkbox" checked={replaceOnImport} onChange={e => setReplaceOnImport(e.target.checked)} />
            Replace existing students in this cohort on import
          </label>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" onClick={onChooseFile} disabled={!importCohort}>
              <Upload size={13} /> Choose File →
            </Btn>
          </div>
        </div>
      )}

      {step === 2 && importParsed && (
        <div style={{ display: 'grid', gap: 16 }}>
          {importing ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '24px 0' }}>
              <Spinner />
              <div style={{ fontSize: 13, color: 'var(--text-2)', textAlign: 'center' }}>
                Uploading {importParsed.rows.length} rows…<br />
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>This may take a few seconds for large files.</span>
              </div>
              {importMsg && <p style={{ fontSize: 13, color: 'var(--red-text)', margin: 0, textAlign: 'center' }}>{importMsg}</p>}
            </div>
          ) : (
            <>
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', fontSize: 13 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>File: {importFile?.name}</div>
                <div style={{ color: 'var(--text-2)' }}>{importParsed.rows.length} rows · {importParsed.headers.length} columns</div>
                <div style={{ color: 'var(--text-3)', marginTop: 4 }}>
                  Target cohort: <strong>{cohortLabel(importCohort || selectedCohort)}</strong>
                  {replaceOnImport && <span style={{ color: 'var(--amber-text)', marginLeft: 8 }}>(replacing existing)</span>}
                  {includeSipData && <span style={{ color: 'var(--amber-text)', marginLeft: 8 }}>· Summer SIP data included → cycle set to Final</span>}
                </div>
              </div>
              {importMsg && <p style={{ fontSize: 13, color: 'var(--red-text)', margin: 0 }}>{importMsg}</p>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Btn onClick={() => onReset(1)}>Back</Btn>
                <Btn variant="primary" onClick={onProposeImport} disabled={importing}>
                  <CheckCircle size={13} /> Propose Import
                </Btn>
              </div>
            </>
          )}
        </div>
      )}

      {step === 3 && lastImportSummary && (
        <div style={{ display: 'grid', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '16px 0' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--green-bg)', border: '1px solid var(--green-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={24} color="var(--green-text)" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Import proposed</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                {lastImportSummary.rowCount} students → <strong>{cohortLabel(lastImportSummary.cohortId)}</strong>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
                Waiting for a second admin to approve in Approvals.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <Btn onClick={() => onReset(1)}>
              <Upload size={13} /> Import another file
            </Btn>
            <Btn variant="primary" onClick={onClose}>Done</Btn>
          </div>
        </div>
      )}
    </Modal>
  )
}
