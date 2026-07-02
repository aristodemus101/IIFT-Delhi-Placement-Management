import React, { useState, useEffect } from 'react'
import { Modal, Btn, Input, Select } from '../../components/UI'
import { saveIntelRecord, blankIntelRecord, INTEL_SECTORS, INTEL_CYCLES } from '../../lib/intel'
import { useAuth } from '../../lib/AuthContext'

const KNOWN_COLLEGES = [
  'IIM Ahmedabad', 'IIM Bangalore', 'IIM Calcutta', 'IIM Lucknow',
  'IIM Kozhikode', 'IIM Indore', 'XLRI', 'SPJIMR', 'MDI Gurgaon',
  'FMS Delhi', 'IIFT Delhi', 'ISB', 'NMIMS', 'SIBM', 'IMT Ghaziabad',
  'JBIMS', 'Great Lakes', 'TAPMI', 'XIMB', 'IRMA',
]

const KNOWN_PROGRAMS = ['MBA', 'PGDM', 'PGP', 'PGPM', 'MMS', 'FPM', 'PGPBA']

export default function IntelEditModal({ open, onClose, record }) {
  const { user } = useAuth()
  const [form, setForm] = useState(blankIntelRecord())
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (open) {
      setForm(record ? { ...blankIntelRecord(), ...record } : blankIntelRecord())
      setErr('')
    }
  }, [open, record])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const setPoc = (key, val) => setForm(f => ({ ...f, poc: { ...f.poc, [key]: val } }))

  const handleSave = async () => {
    if (!form.recruiterName.trim()) { setErr('Recruiter name is required.'); return }
    setSaving(true); setErr('')
    try {
      await saveIntelRecord(form, user, record?._id || null)
      onClose()
    } catch (e) {
      setErr(e.message)
    }
    setSaving(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={record ? 'Edit Intel Record' : 'Add Intel Record'}
      width={720}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Row 1: Company */}
        <FieldSet label="Recruiter">
          <Grid cols={3}>
            <LabeledField label="Recruiter ID" hint="Uppercase, no spaces (auto-derived if blank)">
              <Input value={form.recruiterId} onChange={e => set('recruiterId', e.target.value.toUpperCase().replace(/\s/g, ''))}
                placeholder="ASIANPAINTS" style={{ width: '100%' }} />
            </LabeledField>
            <LabeledField label="Recruiter Name *">
              <Input value={form.recruiterName} onChange={e => set('recruiterName', e.target.value)}
                placeholder="Asian Paints" style={{ width: '100%' }} />
            </LabeledField>
            <LabeledField label="Alias / Short Name">
              <Input value={form.alias} onChange={e => set('alias', e.target.value)}
                placeholder="Asian Paints" style={{ width: '100%' }} />
            </LabeledField>
          </Grid>
          <Grid cols={3}>
            <LabeledField label="Sector">
              <Select value={form.sector} onChange={e => set('sector', e.target.value)} style={{ width: '100%' }}>
                <option value="">— Select —</option>
                {INTEL_SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </LabeledField>
            <LabeledField label="Function">
              <Input value={form.function} onChange={e => set('function', e.target.value)}
                placeholder="Marketing" style={{ width: '100%' }} />
            </LabeledField>
            <LabeledField label="Role(s) Mentioned">
              <Input value={form.rolesMentioned} onChange={e => set('rolesMentioned', e.target.value)}
                placeholder="Brand Manager, Category Manager" style={{ width: '100%' }} />
            </LabeledField>
          </Grid>
          <Grid cols={3}>
            <LabeledField label="Recruiter Type">
              <Input value={form.recruiterType} onChange={e => set('recruiterType', e.target.value)}
                placeholder="Legacy / New" style={{ width: '100%' }} />
            </LabeledField>
            <LabeledField label="Number of Offers">
              <Input value={form.numberOfOffers ?? ''} onChange={e => set('numberOfOffers', e.target.value ? parseInt(e.target.value) : null)}
                type="number" min={0} placeholder="2" style={{ width: '100%' }} />
            </LabeledField>
            <LabeledField label="Compensation">
              <Input value={form.compensation} onChange={e => set('compensation', e.target.value)}
                placeholder="18–24 LPA" style={{ width: '100%' }} />
            </LabeledField>
          </Grid>
        </FieldSet>

        {/* Row 2: Institution */}
        <FieldSet label="Institution">
          <Grid cols={3}>
            <LabeledField label="College Name">
              <Select value={form.collegeName} onChange={e => set('collegeName', e.target.value)} style={{ width: '100%' }}>
                <option value="">— Select —</option>
                {KNOWN_COLLEGES.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="__custom">Other (type below)</option>
              </Select>
              {form.collegeName === '__custom' && (
                <Input value={form._customCollege || ''} onChange={e => { set('_customCollege', e.target.value); set('collegeName', e.target.value) }}
                  placeholder="College name" style={{ width: '100%', marginTop: 6 }} />
              )}
            </LabeledField>
            <LabeledField label="Campus">
              <Input value={form.campus} onChange={e => set('campus', e.target.value)}
                placeholder="Main / Mumbai / Chennai" style={{ width: '100%' }} />
            </LabeledField>
            <LabeledField label="Program">
              <Select value={form.program} onChange={e => set('program', e.target.value)} style={{ width: '100%' }}>
                <option value="">— Select —</option>
                {KNOWN_PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
              </Select>
            </LabeledField>
          </Grid>
          <Grid cols={3}>
            <LabeledField label="Placement Year">
              <Input value={form.placementYear ?? ''} onChange={e => set('placementYear', e.target.value ? parseInt(e.target.value) : null)}
                type="number" min={2000} max={2100} placeholder="2024" style={{ width: '100%' }} />
            </LabeledField>
            <LabeledField label="Placement Cycle">
              <Select value={form.placementCycle} onChange={e => set('placementCycle', e.target.value)} style={{ width: '100%' }}>
                <option value="">— Select —</option>
                {INTEL_CYCLES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </LabeledField>
            <LabeledField label="Academic Batch">
              <Input value={form.academicBatch} onChange={e => set('academicBatch', e.target.value)}
                placeholder="2022-24" style={{ width: '100%' }} />
            </LabeledField>
          </Grid>
        </FieldSet>

        {/* Row 3: International */}
        <FieldSet label="International">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.internationalOpp}
                onChange={e => set('internationalOpp', e.target.checked)}
                style={{ cursor: 'pointer' }} />
              International Opportunity
            </label>
            {form.internationalOpp && (
              <Input value={form.internationalLoc} onChange={e => set('internationalLoc', e.target.value)}
                placeholder="Location (e.g. Singapore, Dubai)" style={{ width: 220 }} />
            )}
          </div>
        </FieldSet>

        {/* Row 4: Source */}
        <FieldSet label="Source">
          <Grid cols={3}>
            <LabeledField label="Source Report">
              <Input value={form.sourceReport} onChange={e => set('sourceReport', e.target.value)}
                placeholder="Filename or report name" style={{ width: '100%' }} />
            </LabeledField>
            <LabeledField label="Source Type">
              <Select value={form.sourceType} onChange={e => set('sourceType', e.target.value)} style={{ width: '100%' }}>
                <option value="">— Select —</option>
                <option>Logo Wall</option>
                <option>Placement Report</option>
                <option>Official Website</option>
                <option>LinkedIn</option>
                <option>Direct</option>
                <option>Other</option>
              </Select>
            </LabeledField>
            <LabeledField label="Evidence">
              <Input value={form.evidence} onChange={e => set('evidence', e.target.value)}
                placeholder="Brief description of source" style={{ width: '100%' }} />
            </LabeledField>
          </Grid>
          <LabeledField label="Remarks">
            <Input value={form.remarks} onChange={e => set('remarks', e.target.value)}
              placeholder="Any additional remarks" style={{ width: '100%' }} />
          </LabeledField>
        </FieldSet>

        {/* Row 5: POC */}
        <FieldSet label="Point of Contact">
          <Grid cols={3}>
            <LabeledField label="Name">
              <Input value={form.poc?.name || ''} onChange={e => setPoc('name', e.target.value)}
                placeholder="Recruiter contact" style={{ width: '100%' }} />
            </LabeledField>
            <LabeledField label="Email">
              <Input value={form.poc?.email || ''} onChange={e => setPoc('email', e.target.value)}
                type="email" placeholder="poc@company.com" style={{ width: '100%' }} />
            </LabeledField>
            <LabeledField label="Phone">
              <Input value={form.poc?.phone || ''} onChange={e => setPoc('phone', e.target.value)}
                placeholder="+91 98765 43210" style={{ width: '100%' }} />
            </LabeledField>
          </Grid>
        </FieldSet>

        {/* Row 6: Notes */}
        <FieldSet label="Notes">
          <textarea
            value={form.notes} onChange={e => set('notes', e.target.value)}
            rows={3}
            placeholder="Any intelligence, context, or follow-up notes…"
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--text)', fontSize: 13, resize: 'vertical',
              fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
            }}
          />
        </FieldSet>

        {err && <p style={{ color: 'var(--red-text)', fontSize: 13 }}>{err}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid var(--border)' }}>
          <Btn onClick={onClose} disabled={saving}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : record ? 'Save Changes' : 'Add Record'}
          </Btn>
        </div>
      </div>
    </Modal>
  )
}

function FieldSet({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  )
}

function Grid({ cols, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10 }}>
      {children}
    </div>
  )
}

function LabeledField({ label, hint, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5 }}>
        {label}
        {hint && <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: 10.5, marginLeft: 4 }}>({hint})</span>}
      </div>
      {children}
    </div>
  )
}
