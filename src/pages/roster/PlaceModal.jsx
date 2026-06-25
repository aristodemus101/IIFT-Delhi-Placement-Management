import React from 'react'
import { getVal } from '../../lib/columns'
import { Btn, Input, Select, Modal } from '../../components/UI'
import { CheckCircle } from 'lucide-react'

const VIA_OPTIONS_FINAL = [
  'Summer PPO',
  'Summer PPI',
  'Finals Cycle',
  'Case Competition',
  'Lateral / Direct',
  'Other',
]

const VIA_OPTIONS_SUMMER = [
  'Campus Placement',
  'Case Competition',
  'Lateral / Direct',
  'Other',
]

const FINAL_STATUS_OPTIONS = [
  'Convert',
  'PPI',
  'PPO',
  'Direct',
  'Other',
]

const SECTOR_OPTIONS = [
  'Automotive',
  'Banking & Financial Services',
  'Consulting & Professional Services',
  'FMCG & Consumer Products',
  'Industrial, Manufacturing & Conglomerates',
  'Leadership Programmes & Others',
  'Logistics, Trade & Supply Chain',
  'Pharma, Healthcare & Life Sciences',
  'Real Estate & Infrastructure',
  'Retail, Lifestyle & E-Commerce',
  'Technology & Telecom',
]

const LOCATION_OPTIONS = ['Domestic', 'International']

export default function PlaceModal({ student, season, setSeason, cohortCycle, form, setForm, onClose, onSubmit, busy }) {
  if (!student) return null

  // If the cohort has a defined active cycle, lock to it — no toggle needed
  const cycleLocked = !!cohortCycle

  return (
    <Modal open={!!student} onClose={onClose} title="Propose Placement">
      <div>
        <div style={{ marginBottom: 14 }}>
          {cycleLocked ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${season === 'summer' ? 'var(--amber)' : 'var(--accent)'}`, background: season === 'summer' ? 'var(--amber-bg)' : 'var(--accent-bg)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: season === 'summer' ? 'var(--amber-text)' : 'var(--accent-dark)' }}>
                {season === 'summer' ? 'Summer Internship' : 'Final Placement'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 4 }}>· cycle set on cohort</span>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                Placement cycle for <strong style={{ color: 'var(--text)', textTransform: 'none', letterSpacing: 0 }}>{getVal(student, 'name')}</strong>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[{ value: 'summer', label: 'Summer Internship' }, { value: 'final', label: 'Final Placement' }].map(opt => (
                  <button key={opt.value} onClick={() => setSeason(opt.value)} style={{
                    flex: 1, padding: '8px 0', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-sans)',
                    border: `1px solid ${season === opt.value ? (opt.value === 'summer' ? 'var(--amber)' : 'var(--accent)') : 'var(--border)'}`,
                    background: season === opt.value ? (opt.value === 'summer' ? 'var(--amber-bg)' : 'var(--accent-bg)') : 'var(--surface)',
                    color: season === opt.value ? (opt.value === 'summer' ? 'var(--amber-text)' : 'var(--accent-dark)') : 'var(--text-2)',
                  }}>{opt.label}</button>
                ))}
              </div>
            </>
          )}
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
            A second admin must approve before this is applied.
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Date of placement</label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Placed via</label>
              <Select value={form.via} onChange={e => setForm(f => ({ ...f, via: e.target.value }))} style={{ width: '100%' }}>
                <option value="">Select…</option>
                {(season === 'final' ? VIA_OPTIONS_FINAL : VIA_OPTIONS_SUMMER).map(v => <option key={v} value={v}>{v}</option>)}
              </Select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Company / Organisation</label>
            <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="e.g. McKinsey & Company" style={{ width: '100%' }} autoFocus />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Role</label>
              <Input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Analyst / Consultant" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Domain</label>
              <Input value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} placeholder="Finance / Marketing" style={{ width: '100%' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: season === 'final' ? '1fr 1fr' : '1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Company sector</label>
              <Select value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))} style={{ width: '100%' }}>
                <option value="">Select sector…</option>
                {SECTOR_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            {season === 'final' && (
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Final Status</label>
                <Select value={form.finalStatus} onChange={e => setForm(f => ({ ...f, finalStatus: e.target.value }))} style={{ width: '100%' }}>
                  <option value="">Select…</option>
                  {FINAL_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Package</label>
              <Input value={form.package} onChange={e => setForm(f => ({ ...f, package: e.target.value }))} placeholder="e.g. 32 LPA" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Location</label>
              <Select value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} style={{ width: '100%' }}>
                <option value="">Select…</option>
                {LOCATION_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </Select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Extra notes about CTC structure</label>
            <textarea
              value={form.ctcNotes}
              onChange={e => setForm(f => ({ ...f, ctcNotes: e.target.value }))}
              rows={3}
              placeholder="Fixed pay, variable, joining bonus, retention, ESOP etc."
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', background: 'var(--surface)',
                color: 'var(--text)', fontSize: 13, resize: 'vertical',
                fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="success" onClick={onSubmit} disabled={!form.company.trim() || busy}>
            <CheckCircle size={14} /> Submit Proposal
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
