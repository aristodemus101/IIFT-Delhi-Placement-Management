import React from 'react'
import { getVal } from '../../lib/columns'
import { Btn, Input, Modal } from '../../components/UI'
import { CheckCircle } from 'lucide-react'

export default function PlaceModal({ student, season, setSeason, form, setForm, onClose, onSubmit, busy }) {
  if (!student) return null

  return (
    <Modal open={!!student} onClose={onClose} title="Propose Placement">
      <div>
        <div style={{ marginBottom: 14 }}>
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
              <Input value={form.via} onChange={e => setForm(f => ({ ...f, via: e.target.value }))} placeholder="Case Comp / PPO / Finals Cycle / Lateral" style={{ width: '100%' }} />
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
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Company sector</label>
              <Input value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))} placeholder="Consulting / FMCG / BFSI" style={{ width: '100%' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Package</label>
            <Input value={form.package} onChange={e => setForm(f => ({ ...f, package: e.target.value }))} placeholder="e.g. 32 LPA" style={{ width: '100%' }} />
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
