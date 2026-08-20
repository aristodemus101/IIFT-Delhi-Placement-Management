import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useTemplates } from '../lib/useStudents'
import { useStudentsContext } from '../lib/StudentsContext'
import { useBatch } from '../lib/BatchContext'
import { autoMapColumns, OUR_COLS, getVal } from '../lib/columns'
import { geminiAutoMap } from '../lib/gemini'
import { exportRemapped } from '../lib/csv'
import { parseCohortId, PROGRAMMES } from '../lib/batch'
import { PageHeader, Btn, Badge, Input, Select, Spinner, Modal } from '../components/UI'
import {
  ArrowRight, ArrowLeft, Wand2, Download, Save, Trash2,
  LayoutTemplate, CheckCircle, Users, RotateCcw, Lock, ChevronRight,
} from 'lucide-react'

function getSection(s) {
  return s['Section'] || s['section'] || ''
}

// ─── Step progress bar ────────────────────────────────────────────────────────

function StepBar({ step }) {
  const steps = ['Paste columns', 'Verify mappings', 'Select & export']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 20 }}>
      {steps.map((label, i) => {
        const n = i + 1
        const done   = n < step
        const active = n === step
        const locked = n > step
        const accent = active ? 'var(--accent)' : done ? 'var(--green)' : 'var(--border)'
        const textC  = active ? 'var(--accent)' : done ? 'var(--green-text)' : 'var(--text-3)'
        return (
          <React.Fragment key={n}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                border: `2px solid ${accent}`,
                background: done ? 'var(--green-bg)' : active ? 'var(--accent-bg)' : 'var(--surface2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {done
                  ? <CheckCircle size={13} color="var(--green)" />
                  : locked
                    ? <Lock size={10} color="var(--text-3)" />
                    : <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{n}</span>
                }
              </div>
              <span style={{ fontSize: 12, fontWeight: active ? 600 : 500, color: textC, whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 2, margin: '0 10px',
                background: done ? 'var(--green)' : 'var(--border)',
                minWidth: 24,
              }} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── Step 1 summary card (shown when step > 1) ───────────────────────────────

function Step1Summary({ companyCols, onEdit }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--green-border)',
      borderRadius: 'var(--radius)', padding: '14px 18px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <CheckCircle size={15} color="var(--green)" style={{ flexShrink: 0 }} />
        <div>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Step 1 — Columns pasted</span>
          <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 10 }}>
            {companyCols.length} column{companyCols.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 420 }}>
          {companyCols.slice(0, 5).map(c => (
            <span key={c} style={{
              fontSize: 11, fontFamily: 'var(--font-mono)',
              padding: '1px 6px', borderRadius: 3,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              color: 'var(--text-2)', whiteSpace: 'nowrap',
            }}>{c}</span>
          ))}
          {companyCols.length > 5 && (
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>+{companyCols.length - 5} more</span>
          )}
        </div>
      </div>
      <Btn size="sm" variant="ghost" onClick={onEdit}>
        <ArrowLeft size={12} /> Edit columns
      </Btn>
    </div>
  )
}

// ─── Step 2 summary card (shown when step > 2) ───────────────────────────────

function Step2Summary({ mappings, onEdit }) {
  const autoCount   = mappings.filter(m => m.auto && m.ourKey).length
  const manualCount = mappings.filter(m => !m.auto && m.ourKey).length
  const skipCount   = mappings.filter(m => !m.ourKey).length
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--green-border)',
      borderRadius: 'var(--radius)', padding: '14px 18px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <CheckCircle size={15} color="var(--green)" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>Step 2 — Mappings confirmed</span>
        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: 'var(--green-bg)', color: 'var(--green-text)', border: '1px solid var(--green-border)' }}>
          ✓ {autoCount} auto
        </span>
        {manualCount > 0 && (
          <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: 'var(--amber-bg)', color: 'var(--amber-text)', border: '1px solid var(--amber-border)' }}>
            ✎ {manualCount} manual
          </span>
        )}
        {skipCount > 0 && (
          <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: 'var(--surface2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
            — {skipCount} skipped
          </span>
        )}
      </div>
      <Btn size="sm" variant="ghost" onClick={onEdit}>
        <ArrowLeft size={12} /> Edit mappings
      </Btn>
    </div>
  )
}

// ─── Locked step placeholder ──────────────────────────────────────────────────

function LockedStep({ n, label }) {
  return (
    <div style={{
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '14px 18px',
      display: 'flex', alignItems: 'center', gap: 10, opacity: 0.55,
    }}>
      <Lock size={13} color="var(--text-3)" />
      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Step {n} — {label}</span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const SELECTION_MODES = [
  { value: 'all',       label: 'All students' },
  { value: 'ytp',       label: 'Yet to place (unplaced)' },
  { value: 'programme', label: 'By programme (IB / BA)' },
  { value: 'section',   label: 'By section (A / B / C / D)' },
  { value: 'email',     label: 'By email list' },
]

export default function RemapperPage() {
  const { students, loading } = useStudentsContext()
  const { templates, saveTemplate, deleteTemplate } = useTemplates()
  const { scopedCohorts } = useBatch()

  // ── Wizard step (1 | 2 | 3) ──────────────────────────────────────────────
  const [step, setStep] = useState(1)

  // ── Step 1 state ─────────────────────────────────────────────────────────
  const [rawCols, setRawCols]         = useState('')
  const [autoMapping, setAutoMapping] = useState(false)
  const [autoMapErr, setAutoMapErr]   = useState('')

  // ── Step 2 state ─────────────────────────────────────────────────────────
  const [mappings, setMappings] = useState(null)

  // ── Step 3 state ─────────────────────────────────────────────────────────
  const [selMode, setSelMode]           = useState('all')
  const [selProgramme, setSelProgramme] = useState('IB')
  const [selSection, setSelSection]     = useState('A')
  const [selEmails, setSelEmails]       = useState('')
  const [selCohort, setSelCohort]       = useState('all')

  // ── Template save modal ──────────────────────────────────────────────────
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  // templateName intentionally persists between modal opens — cleared only on successful save
  const [templateName, setTemplateName]   = useState('')
  const [savedMsg, setSavedMsg]           = useState('')

  // ── Confirm dialog state (used for destructive back/reset actions) ───────
  const [confirmDialog, setConfirmDialog] = useState(null)
  // confirmDialog: { message, onConfirm } | null

  const step1Ref = useRef(null)
  const step2Ref = useRef(null)
  const step3Ref = useRef(null)

  // Scroll to active step on advance
  useEffect(() => {
    const ref = step === 1 ? step1Ref : step === 2 ? step2Ref : step3Ref
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step])

  const companyCols = useMemo(() =>
    rawCols.split(/[\n,]+/).map(s => s.trim()).filter(Boolean),
    [rawCols]
  )

  // ── Auto-map (Step 1 → Step 2) ───────────────────────────────────────────

  const doAutoMap = async () => {
    if (!companyCols.length) return
    setAutoMapErr('')
    const geminiKey = import.meta.env.VITE_GEMINI_KEY
    setAutoMapping(true)
    try {
      const result = geminiKey
        ? await geminiAutoMap(companyCols, OUR_COLS)
        : autoMapColumns(companyCols)
      setMappings(result)
      setStep(2)
    } catch (e) {
      console.error('Gemini auto-map failed, falling back to synonym match:', e)
      setAutoMapErr('AI mapping failed — used keyword fallback instead.')
      setMappings(autoMapColumns(companyCols))
      setStep(2)
    } finally {
      setAutoMapping(false)
    }
  }

  // If mappings already exist and the user clicks auto-map again (back in step 1),
  // warn them first.
  const handleAutoMap = () => {
    if (mappings) {
      setConfirmDialog({
        message: 'Re-mapping will replace your current column mappings. Continue?',
        onConfirm: () => { setMappings(null); doAutoMap() },
      })
    } else {
      doAutoMap()
    }
  }

  const setMapping = (i, key) => {
    setMappings(prev => prev.map((m, idx) => idx === i ? { ...m, ourKey: key, auto: false } : m))
  }

  // ── Template ops ─────────────────────────────────────────────────────────

  const loadTemplate = (t) => {
    const doLoad = () => {
      setMappings(t.mappings)
      setRawCols(t.mappings.map(m => m.companyCol).join('\n'))
      setStep(2)
    }
    if (mappings && step >= 2) {
      setConfirmDialog({
        message: `Loading "${t.name}" will replace your current mappings. Continue?`,
        onConfirm: doLoad,
      })
    } else {
      doLoad()
    }
  }

  const doSaveTemplate = async () => {
    if (!templateName.trim()) return
    await saveTemplate(templateName.trim(), mappings)
    setSavedMsg(`Template "${templateName}" saved`)
    setTemplateName('')  // clear name on successful save
    setSaveModalOpen(false)
    setTimeout(() => setSavedMsg(''), 3000)
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  // Step 1 → back from step 2: keep rawCols, clear mappings
  const backToStep1 = () => {
    setConfirmDialog({
      message: 'Going back will clear your current mappings. Continue?',
      onConfirm: () => { setMappings(null); setStep(1) },
    })
  }

  // Step 2 → back from step 3: no destructive change, no confirm needed
  const backToStep2 = () => setStep(2)

  // Step 2 → forward to step 3
  const confirmMappings = () => setStep(3)

  // Full reset
  const doReset = () => {
    setConfirmDialog({
      message: 'Start over? All columns, mappings, and selections will be cleared.',
      onConfirm: () => {
        setRawCols('')
        setMappings(null)
        setAutoMapErr('')
        setSelMode('all')
        setSelProgramme('IB')
        setSelSection('A')
        setSelEmails('')
        setSelCohort('all')
        setSavedMsg('')
        setStep(1)
      },
    })
  }

  // ── Student selection (Step 3) ────────────────────────────────────────────

  const scopedStudents = useMemo(() => {
    if (!scopedCohorts.length) return []
    const ids = selCohort === 'all' ? new Set(scopedCohorts) : new Set([selCohort])
    return students.filter(s => ids.has(s.cohort || 'unknown'))
  }, [students, scopedCohorts, selCohort])

  const availableSections = useMemo(() => {
    const s = new Set(scopedStudents.map(getSection).filter(Boolean))
    return [...s].sort()
  }, [scopedStudents])

  const selectedStudents = useMemo(() => {
    switch (selMode) {
      case 'ytp':
        return scopedStudents.filter(s => !s._placed_final && !s._placed_summer && !s._placed)
      case 'programme':
        return scopedStudents.filter(s => parseCohortId(s.cohort).programme === selProgramme)
      case 'section':
        return scopedStudents.filter(s => getSection(s).toUpperCase() === selSection)
      case 'email': {
        const emailSet = new Set(
          selEmails.split(/[\n,]+/).map(e => e.trim().toLowerCase()).filter(Boolean)
        )
        if (!emailSet.size) return []
        return scopedStudents.filter(s => {
          const official = (getVal(s, 'official_email') || '').toLowerCase()
          const personal = (getVal(s, 'email') || '').toLowerCase()
          return emailSet.has(official) || emailSet.has(personal)
        })
      }
      default:
        return scopedStudents
    }
  }, [scopedStudents, selMode, selProgramme, selSection, selEmails])

  const scopeLabel = scopedCohorts.length === 1
    ? scopedCohorts[0]
    : scopedCohorts.length > 1
      ? `${scopedCohorts.length} cohorts`
      : 'no cohort'

  const autoCount   = mappings ? mappings.filter(m => m.auto && m.ourKey).length : 0
  const manualCount = mappings ? mappings.filter(m => !m.auto && m.ourKey).length : 0
  const skipCount   = mappings ? mappings.filter(m => !m.ourKey).length : 0

  if (loading) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <PageHeader
        title="Column Remapper"
        subtitle={`Prepare a student export in a company's column format · ${scopeLabel}`}
      />

      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Progress bar + start-over */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <StepBar step={step} />
          {step > 1 && (
            <Btn size="sm" variant="ghost" onClick={doReset} style={{ flexShrink: 0, color: 'var(--text-3)' }}>
              <RotateCcw size={12} /> Start over
            </Btn>
          )}
        </div>

        {/* ── Step 1 ───────────────────────────────────────────────────── */}
        <div ref={step1Ref}>
          {step > 1 ? (
            <Step1Summary companyCols={companyCols} onEdit={backToStep1} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 20px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                    Step 1 — Paste company columns
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10, lineHeight: 1.6 }}>
                    Paste the header row from the company's template (comma or newline separated)
                  </p>
                  <textarea
                    value={rawCols}
                    onChange={e => setRawCols(e.target.value)}
                    placeholder={'Student Name\nCAT Percentile\nWork Experience (months)\n10th Marks\n12th Marks\nGraduation %\nCategory\n...'}
                    style={{
                      width: '100%', height: 160, padding: '10px 12px',
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface)', color: 'var(--text)',
                      fontSize: 13, fontFamily: 'var(--font-mono)', resize: 'vertical',
                      outline: 'none', lineHeight: 1.6, boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Btn variant="primary" onClick={handleAutoMap} disabled={!companyCols.length || autoMapping}>
                      {autoMapping
                        ? <><Spinner size={13} /> Mapping…</>
                        : <><Wand2 size={13} /> Auto-map {companyCols.length ? `${companyCols.length} columns` : ''}</>
                      }
                    </Btn>
                    {companyCols.length > 0 && !autoMapping && (
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{companyCols.length} columns detected</span>
                    )}
                    {autoMapErr && (
                      <span style={{ fontSize: 12, color: 'var(--amber-text)' }}>{autoMapErr}</span>
                    )}
                  </div>
                </div>

                {/* Saved Templates */}
                {templates.length > 0 && (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 20px' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                      <LayoutTemplate size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                      Saved Templates
                    </div>
                    {templates.map(t => (
                      <div key={t._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{t.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t.mappings?.length} columns</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Btn size="sm" onClick={() => loadTemplate(t)}>Load</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => { if (confirm(`Delete "${t.name}"?`)) deleteTemplate(t._id) }}>
                            <Trash2 size={12} />
                          </Btn>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}
        </div>

        {/* ── Step 2 ───────────────────────────────────────────────────── */}
        <div ref={step2Ref}>
          {step === 1 ? (
            <LockedStep n={2} label="Verify mappings" />
          ) : step > 2 ? (
            <Step2Summary mappings={mappings} onEdit={backToStep2} />
          ) : (
            /* step === 2 */
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Step 2 — Verify mappings
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: 'var(--green-bg)', color: 'var(--green-text)', border: '1px solid var(--green-border)' }}>
                    ✓ {autoCount} auto
                  </span>
                  {manualCount > 0 && (
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: 'var(--amber-bg)', color: 'var(--amber-text)', border: '1px solid var(--amber-border)' }}>
                      ✎ {manualCount} manual
                    </span>
                  )}
                  {skipCount > 0 && (
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: 'var(--surface2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                      — {skipCount} skipped
                    </span>
                  )}
                </div>
              </div>

              <div style={{ overflowY: 'auto', maxHeight: 380 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>Company Column</th>
                      <th style={{ width: 28, background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}></th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>Our Field</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings && mappings.map((m, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '7px 8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {m.auto && m.ourKey ? (
                              <CheckCircle size={12} color="var(--green)" style={{ flexShrink: 0 }} />
                            ) : m.ourKey ? (
                              <span style={{ width: 12, height: 12, flexShrink: 0, borderRadius: 2, background: 'var(--amber-bg)', border: '1px solid var(--amber-border)', display: 'inline-block' }} />
                            ) : (
                              <span style={{ width: 12, height: 12, flexShrink: 0, borderRadius: 2, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'inline-block' }} />
                            )}
                            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{m.companyCol}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>→</td>
                        <td style={{ padding: '7px 8px' }}>
                          <select
                            value={m.ourKey || ''}
                            onChange={e => setMapping(i, e.target.value || null)}
                            style={{
                              width: '100%', height: 30, padding: '0 8px', border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)', background: 'var(--surface)', color: 'var(--text)',
                              fontSize: 12, cursor: 'pointer', outline: 'none',
                            }}
                          >
                            <option value="">— skip this column —</option>
                            {OUR_COLS.map(col => (
                              <option key={col.key} value={col.key}>{col.label}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {savedMsg && (
                <div style={{ padding: '8px 12px', background: 'var(--green-bg)', color: 'var(--green-text)', border: '1px solid var(--green-border)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                  <CheckCircle size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />{savedMsg}
                </div>
              )}

              {/* Step 2 actions */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                <Btn variant="ghost" onClick={backToStep1}>
                  <ArrowLeft size={13} /> Edit columns
                </Btn>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn onClick={() => setSaveModalOpen(true)}>
                    <Save size={13} /> Save Template
                  </Btn>
                  <Btn variant="primary" onClick={confirmMappings}>
                    Confirm mappings <ChevronRight size={13} />
                  </Btn>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Step 3 ───────────────────────────────────────────────────── */}
        <div ref={step3Ref}>
          {step < 3 ? (
            <LockedStep n={3} label="Select students & export" />
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
                Step 3 — Select students &amp; export
              </div>

              {/* Cohort selector — shown only when multiple cohorts are in scope */}
              {scopedCohorts.length > 1 && (
                <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>Cohort:</span>
                  <select
                    value={selCohort}
                    onChange={e => setSelCohort(e.target.value)}
                    style={{
                      height: 30, padding: '0 8px', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', background: 'var(--surface)',
                      color: 'var(--text)', fontSize: 13, cursor: 'pointer', outline: 'none',
                    }}
                  >
                    <option value="all">All cohorts ({scopedCohorts.length})</option>
                    {scopedCohorts.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {/* Mode selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Who to include</div>
                  {SELECTION_MODES.map(m => (
                    <label key={m.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: selMode === m.value ? 'var(--text)' : 'var(--text-2)' }}>
                      <input
                        type="radio"
                        name="selMode"
                        value={m.value}
                        checked={selMode === m.value}
                        onChange={() => setSelMode(m.value)}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      {m.label}
                    </label>
                  ))}
                </div>

                {/* Sub-options */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  {selMode === 'programme' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Programme</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {PROGRAMMES.map(p => (
                          <button key={p} onClick={() => setSelProgramme(p)} style={{
                            padding: '5px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                            background: selProgramme === p ? 'var(--accent)' : 'var(--surface)',
                            color: selProgramme === p ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                          }}>
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selMode === 'section' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Section</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {(availableSections.length ? availableSections : ['A', 'B', 'C', 'D']).map(sec => (
                          <button key={sec} onClick={() => setSelSection(sec)} style={{
                            width: 38, height: 38, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                            background: selSection === sec ? 'var(--accent)' : 'var(--surface)',
                            color: selSection === sec ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                          }}>
                            {sec}
                          </button>
                        ))}
                      </div>
                      {availableSections.length === 0 && (
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>No Section field found in student data for this cohort.</div>
                      )}
                    </div>
                  )}

                  {selMode === 'email' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Student emails (comma or newline separated)</div>
                      <textarea
                        value={selEmails}
                        onChange={e => setSelEmails(e.target.value)}
                        placeholder={'student1@iift.edu\nstudent2@iift.edu\n...'}
                        style={{
                          width: '100%', height: 100, padding: '8px 10px', boxSizing: 'border-box',
                          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface)', color: 'var(--text)',
                          fontSize: 12, fontFamily: 'var(--font-mono)', resize: 'vertical', outline: 'none',
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Count + export */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end', justifyContent: 'flex-start', minWidth: 180 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                    <Users size={13} color="var(--text-3)" />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedStudents.length}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>student{selectedStudents.length !== 1 ? 's' : ''} selected</span>
                  </div>
                  <Btn
                    variant="primary"
                    disabled={!selectedStudents.length}
                    onClick={() => {
                      const modeLabel = selMode === 'ytp' ? 'unplaced'
                        : selMode === 'programme' ? selProgramme.toLowerCase()
                        : selMode === 'section' ? `section_${selSection.toLowerCase()}`
                        : selMode === 'email' ? 'custom'
                        : 'all'
                      const cohortLabel = selCohort === 'all' ? scopeLabel : selCohort
                      exportRemapped(selectedStudents, mappings, `${cohortLabel.replace(/\s+/g, '_')}_${modeLabel}.csv`)
                    }}
                  >
                    <Download size={13} /> Export {selectedStudents.length ? `(${selectedStudents.length})` : ''}
                  </Btn>
                  <Btn onClick={() => setSaveModalOpen(true)}>
                    <Save size={13} /> Save Template
                  </Btn>
                </div>
              </div>

              {/* Step 3 back nav */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <Btn variant="ghost" onClick={backToStep2}>
                  <ArrowLeft size={13} /> Edit mappings
                </Btn>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Save template modal */}
      <Modal open={saveModalOpen} onClose={() => setSaveModalOpen(false)} title="Save mapping template">
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14, lineHeight: 1.6 }}>
          Save this column mapping so you can reuse it next time this company sends their format.
        </p>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Template name</label>
        <Input
          value={templateName}
          onChange={e => setTemplateName(e.target.value)}
          placeholder="e.g. McKinsey Format, Bain & Co, BCG..."
          style={{ width: '100%', marginBottom: 16 }}
          onKeyDown={e => e.key === 'Enter' && doSaveTemplate()}
          autoFocus
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn onClick={() => setSaveModalOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={doSaveTemplate} disabled={!templateName.trim()}>
            <Save size={13} /> Save
          </Btn>
        </div>
      </Modal>

      {/* Confirm dialog */}
      <Modal
        open={!!confirmDialog}
        onClose={() => setConfirmDialog(null)}
        title="Are you sure?"
        width={400}
      >
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 20, lineHeight: 1.6 }}>
          {confirmDialog?.message}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn onClick={() => setConfirmDialog(null)}>Cancel</Btn>
          <Btn variant="danger" onClick={() => { confirmDialog?.onConfirm(); setConfirmDialog(null) }}>
            Continue
          </Btn>
        </div>
      </Modal>
    </div>
  )
}
