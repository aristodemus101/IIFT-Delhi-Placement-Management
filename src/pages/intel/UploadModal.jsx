import React, { useState, useRef, useCallback } from 'react'
import { Modal, Btn, Badge } from '../../components/UI'
import { Upload, AlertTriangle, CheckCircle, FileSpreadsheet, X } from 'lucide-react'
import { parseIntelRows, uploadIntelBatch } from '../../lib/intel'
import { useAuth } from '../../lib/AuthContext'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'

const PHASE = { IDLE: 'idle', PARSED: 'parsed', UPLOADING: 'uploading', DONE: 'done', ERROR: 'error' }

export default function UploadModal({ open, onClose }) {
  const { user } = useAuth()
  const [phase, setPhase]         = useState(PHASE.IDLE)
  const [fileName, setFileName]   = useState('')
  const [records, setRecords]     = useState([])
  const [warnings, setWarnings]   = useState([])
  const [parseErr, setParseErr]   = useState('')
  const [progress, setProgress]   = useState({ done: 0, total: 0 })
  const [result, setResult]       = useState(null)
  const [isDragging, setDragging] = useState(false)
  const fileRef = useRef()

  const reset = () => {
    setPhase(PHASE.IDLE); setFileName(''); setRecords([]); setWarnings([])
    setParseErr(''); setProgress({ done: 0, total: 0 }); setResult(null)
  }

  const handleClose = () => { reset(); onClose() }

  const parseFile = useCallback(file => {
    if (!file) return
    setFileName(file.name)
    setParseErr('')

    const reader = new FileReader()
    reader.onload = async e => {
      try {
        const { read, utils } = await import('xlsx')
        const data = e.target.result
        const wb = read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rawRows = utils.sheet_to_json(ws, { defval: '' })
        const { records: parsed, warnings: warns } = parseIntelRows(rawRows)
        if (parsed.length === 0) {
          setParseErr('No valid rows found. Check that your file has the expected column headers.')
          setPhase(PHASE.IDLE)
          return
        }
        setRecords(parsed)
        setWarnings(warns)
        setPhase(PHASE.PARSED)
      } catch (err) {
        setParseErr(`Could not parse file: ${err.message}`)
        setPhase(PHASE.IDLE)
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleFileChange = e => { if (e.target.files[0]) parseFile(e.target.files[0]) }

  const handleDrop = e => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }

  const handleUpload = async () => {
    setPhase(PHASE.UPLOADING)
    setProgress({ done: 0, total: records.length })

    const importBatchId = `upload-${Date.now()}-${user.uid.slice(0, 6)}`

    try {
      const { inserted, updated, errors } = await uploadIntelBatch({
        records,
        user,
        importBatchId,
        onProgress: (done, total) => setProgress({ done, total }),
      })

      // Audit log entry
      await addDoc(collection(db, 'auditLog'), {
        type:        'intel_upload',
        importBatch: importBatchId,
        rowCount:    records.length,
        inserted,
        updated,
        errors:      errors.length,
        uploadedBy:  user.uid,
        uploadedAt:  serverTimestamp(),
        fileName,
      })

      setResult({ inserted, updated, errors })
      setPhase(PHASE.DONE)
    } catch (err) {
      setParseErr(err.message)
      setPhase(PHASE.ERROR)
    }
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <Modal open={open} onClose={handleClose} title="Upload Intel Report" width={680}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── IDLE / Drop zone ── */}
        {phase === PHASE.IDLE && (
          <>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)',
                padding: '40px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                background: isDragging ? 'var(--accent-bg)' : 'var(--surface2)',
                transition: 'border-color 0.15s ease, background 0.15s ease',
              }}
            >
              <FileSpreadsheet size={36} style={{ color: isDragging ? 'var(--accent)' : 'var(--text-3)', marginBottom: 12 }} />
              <p style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>
                Drop your Excel file here
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                Supports .xlsx, .xls, .csv · First sheet will be used
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
                or <span style={{ color: 'var(--accent)', fontWeight: 600 }}>click to browse</span>
              </p>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} style={{ display: 'none' }} />

            {parseErr && (
              <div style={{ display: 'flex', gap: 8, background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: 8, padding: '10px 14px' }}>
                <AlertTriangle size={15} color="var(--red-text)" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 13, color: 'var(--red-text)' }}>{parseErr}</p>
              </div>
            )}

            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text)' }}>Expected column headers</strong><br />
              Recruiter ID · Recruiter Name · Alias · Placement Year · Placement Cycle ·
              College Name · Campus · Program · Sector · Function · Role Mentioned ·
              Number of Offers · Compensation · Source Report · Source Type · Evidence · Remarks · Notes<br />
              <span style={{ color: 'var(--text-3)' }}>Column names are case-insensitive. Unknown columns are ignored.</span>
            </div>
          </>
        )}

        {/* ── PARSED / Preview ── */}
        {phase === PHASE.PARSED && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileSpreadsheet size={18} color="var(--accent)" />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{fileName}</span>
              <Badge color="blue">{records.length} rows</Badge>
              <button onClick={reset} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-3)', marginLeft: 'auto', padding: 4 }}>
                <X size={14} />
              </button>
            </div>

            {warnings.length > 0 && (
              <div style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-border)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                  <AlertTriangle size={14} color="var(--amber-text)" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber-text)' }}>{warnings.length} row{warnings.length !== 1 ? 's' : ''} skipped</span>
                </div>
                <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12, color: 'var(--amber-text)' }}>
                  {warnings.slice(0, 5).map((w, i) => <li key={i}>{w}</li>)}
                  {warnings.length > 5 && <li>…and {warnings.length - 5} more</li>}
                </ul>
              </div>
            )}

            {/* Preview table */}
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
                Preview — first 10 rows of {records.length} total
              </p>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8, maxHeight: 300 }}>
                <table style={{ minWidth: 600, width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)' }}>
                      {['Company', 'College', 'Year', 'Cycle', 'Program', 'Sector', 'Offers'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.slice(0, 10).map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '7px 10px', fontWeight: 600 }}>{r.recruiterName || '—'}</td>
                        <td style={{ padding: '7px 10px', color: 'var(--text-2)' }}>{r.collegeName || '—'}</td>
                        <td style={{ padding: '7px 10px', color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>{r.placementYear || '—'}</td>
                        <td style={{ padding: '7px 10px', color: 'var(--text-2)' }}>{r.placementCycle || '—'}</td>
                        <td style={{ padding: '7px 10px', color: 'var(--text-2)' }}>{r.program || '—'}</td>
                        <td style={{ padding: '7px 10px', color: 'var(--text-2)' }}>{r.sector || '—'}</td>
                        <td style={{ padding: '7px 10px', color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>{r.numberOfOffers ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <Btn onClick={reset}>Choose Different File</Btn>
              <Btn variant="primary" onClick={handleUpload}>
                <Upload size={13} /> Upload {records.length} Records
              </Btn>
            </div>
          </>
        )}

        {/* ── UPLOADING / Progress ── */}
        {phase === PHASE.UPLOADING && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
              Uploading {progress.total} records…
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 100, height: 8, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{
                height: '100%', width: `${pct}%`, borderRadius: 100,
                background: 'var(--accent)',
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
              {progress.done} / {progress.total} — {pct}%
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
              Writing in batches of 499. Do not close this window.
            </p>
          </div>
        )}

        {/* ── DONE ── */}
        {phase === PHASE.DONE && result && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <CheckCircle size={40} color="var(--green-text)" style={{ marginBottom: 14 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Upload Complete</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 16 }}>
              <Stat label="Inserted" value={result.inserted} color="green" />
              <Stat label="Updated" value={result.updated} color="blue" />
              {result.errors.length > 0 && <Stat label="Errors" value={result.errors.length} color="red" />}
            </div>
            {result.errors.length > 0 && (
              <p style={{ fontSize: 12, color: 'var(--red-text)', marginBottom: 12 }}>
                {result.errors.join(' · ')}
              </p>
            )}
            <Btn variant="primary" onClick={handleClose}>Done</Btn>
          </div>
        )}

        {/* ── ERROR ── */}
        {phase === PHASE.ERROR && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <AlertTriangle size={36} color="var(--red-text)" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Upload Failed</div>
            <p style={{ fontSize: 13, color: 'var(--red-text)', marginBottom: 16 }}>{parseErr}</p>
            <Btn onClick={reset}>Try Again</Btn>
          </div>
        )}
      </div>
    </Modal>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 18px', minWidth: 80 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: `var(--${color}-text)`, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{label}</div>
    </div>
  )
}
