// src/pages/RemapperPage.jsx
import React, { useState, useMemo } from 'react'
import { useStudents } from '../lib/useStudents'
import { useTemplates } from '../lib/useStudents'
import { useBatch } from '../lib/BatchContext'
import { batchLabel, batchShortLabel, normalizeBatch } from '../lib/batch'
import { autoMapColumns, OUR_COLS } from '../lib/columns'
import { exportRemapped } from '../lib/csv'
import { PageHeader, Btn, Badge, Input, Select, Spinner, Modal } from '../components/UI'
import { ArrowRight, Wand2, Download, Save, Trash2, LayoutTemplate, CheckCircle, AlertCircle } from 'lucide-react'

export default function RemapperPage() {
  const { students, loading } = useStudents()
  const { templates, saveTemplate, deleteTemplate } = useTemplates()
  const { selectedBatch } = useBatch()

  const [rawCols, setRawCols] = useState('')
  const [mappings, setMappings] = useState(null)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [savedMsg, setSavedMsg] = useState('')

  const companyCols = useMemo(() =>
    rawCols.split(/[\n,]+/).map(s => s.trim()).filter(Boolean),
    [rawCols]
  )

  const doAutoMap = () => {
    if (!companyCols.length) return
    setMappings(autoMapColumns(companyCols))
  }

  const setMapping = (i, key) => {
    setMappings(prev => prev.map((m, idx) => idx === i ? { ...m, ourKey: key, auto: false } : m))
  }

  const loadTemplate = (t) => {
    setMappings(t.mappings)
    setRawCols(t.mappings.map(m => m.companyCol).join('\n'))
  }

  const doSaveTemplate = async () => {
    if (!templateName.trim()) return
    await saveTemplate(templateName.trim(), mappings)
    setSavedMsg(`Template "${templateName}" saved`)
    setTemplateName(''); setSaveModalOpen(false)
    setTimeout(() => setSavedMsg(''), 3000)
  }

  const scopedStudents = students.filter(s => normalizeBatch(s._batch) === selectedBatch)
  const activeStudents = scopedStudents.filter(s => !s._placed)
  const autoCount = mappings ? mappings.filter(m => m.auto).length : 0
  const manualCount = mappings ? mappings.filter(m => !m.auto && m.ourKey).length : 0
  const skipCount = mappings ? mappings.filter(m => !m.ourKey).length : 0

  if (loading) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <PageHeader
        title="Column Remapper"
        subtitle={`Map company column formats to your fields, export ready-to-send CSVs · ${batchLabel(selectedBatch)}`}
      />

      <div style={{ padding: '24px 28px', display: 'grid', gridTemplateColumns: mappings ? '1fr 1.8fr' : '1fr', gap: 20 }}>

        {/* Left: input + templates */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Step 1 */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
              Step 1 — paste company columns
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
                outline: 'none', lineHeight: 1.6
              }}
            />
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Btn variant="primary" onClick={doAutoMap} disabled={!companyCols.length}>
                <Wand2 size={13} /> Auto-map {companyCols.length ? `${companyCols.length} columns` : ''}
              </Btn>
              {companyCols.length > 0 && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{companyCols.length} columns detected</span>}
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

        {/* Right: mapping grid + export */}
        {mappings && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Step 2 — review mappings
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: 'var(--green-bg)', color: 'var(--green-text)', border: '1px solid var(--green-border)' }}>
                  ✓ {autoCount} auto
                </span>
                {manualCount > 0 && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: 'var(--amber-bg)', color: 'var(--amber-text)', border: '1px solid var(--amber-border)' }}>
                  ✎ {manualCount} manual
                </span>}
                {skipCount > 0 && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: 'var(--surface2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                  — {skipCount} skipped
                </span>}
              </div>
            </div>

            <div style={{ overflowY: 'auto', maxHeight: 420 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>Company Column</th>
                    <th style={{ width: 28, background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}></th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>Our Field</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((m, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '7px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {m.auto ? (
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
                            fontSize: 12, cursor: 'pointer', outline: 'none'
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

            <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <Btn variant="primary" onClick={() => exportRemapped(activeStudents, mappings, `company_format_${batchShortLabel(selectedBatch).toLowerCase()}_active.csv`)} disabled={!activeStudents.length}>
                <Download size={13} /> Export Active ({activeStudents.length})
              </Btn>
              <Btn onClick={() => exportRemapped(scopedStudents, mappings, `company_format_${batchShortLabel(selectedBatch).toLowerCase()}_all.csv`)} disabled={!scopedStudents.length}>
                <Download size={13} /> Export All
              </Btn>
              <Btn onClick={() => setSaveModalOpen(true)} style={{ marginLeft: 'auto' }}>
                <Save size={13} /> Save Template
              </Btn>
            </div>
          </div>
        )}
      </div>

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
    </div>
  )
}
