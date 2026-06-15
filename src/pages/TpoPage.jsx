import React, { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { usePermissions } from '../lib/usePermissions'
import { useMyTpoOutreach, useAllTpoOutreach, OUTREACH_STATUSES } from '../lib/useTpoOutreach'
import { useBatch } from '../lib/BatchContext'
import { cohortLabel } from '../lib/batch'
import { PageHeader, Btn, Badge, Spinner, Modal, Input, Select } from '../components/UI'
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react'

const STATUS_COLOR = {
  reached_out: 'gray',
  shortlisted: 'blue',
  offer_made:  'green',
  declined:    'red',
}

const EMPTY_FORM = {
  companyName:       '',
  roleTitle:         '',
  ctc:               '',
  fixedComponent:    '',
  variableComponent: '',
  studentsPlaced:    '',
  status:            'reached_out',
  cohorts:           [],
  notes:             '',
}

// Normalise legacy single-cohort entries to cohorts array
function normaliseCohorts(e) {
  if (e.cohorts && e.cohorts.length > 0) return e.cohorts
  if (e.cohort) return [e.cohort]
  return []
}

function OutreachForm({ initial, batches, onSave, onCancel, busy }) {
  const initCohorts = initial ? normaliseCohorts(initial) : []
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial, cohorts: initCohorts })
  const [err, setErr] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleCohort = (batchId) => {
    setForm(f => {
      const cur = f.cohorts || []
      return { ...f, cohorts: cur.includes(batchId) ? cur.filter(c => c !== batchId) : [...cur, batchId] }
    })
  }

  const handleSave = () => {
    if (!form.companyName.trim()) { setErr('Company name is required.'); return }
    if (!form.cohorts || form.cohorts.length === 0) { setErr('At least one cohort is required.'); return }
    const ctc = parseFloat(form.ctc)
    const fixed = parseFloat(form.fixedComponent)
    if (form.ctc !== '' && isNaN(ctc)) { setErr('CTC must be a number.'); return }
    if (form.fixedComponent !== '' && isNaN(fixed)) { setErr('Fixed component must be a number.'); return }
    if (!isNaN(ctc) && !isNaN(fixed) && fixed > ctc) { setErr('Fixed component cannot exceed CTC.'); return }
    setErr('')
    onSave({
      companyName:       form.companyName.trim(),
      roleTitle:         form.roleTitle.trim(),
      ctc:               form.ctc !== '' ? ctc : null,
      fixedComponent:    form.fixedComponent !== '' ? fixed : null,
      variableComponent: form.variableComponent !== '' ? parseFloat(form.variableComponent) : null,
      studentsPlaced:    form.studentsPlaced !== '' ? parseInt(form.studentsPlaced, 10) : null,
      status:            form.status,
      cohorts:           form.cohorts,
      notes:             form.notes.trim(),
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label style={labelStyle}>
          Company Name *
          <Input value={form.companyName} onChange={e => set('companyName', e.target.value)} placeholder="e.g. McKinsey & Company" />
        </label>
        <label style={labelStyle}>
          Role Title
          <Input value={form.roleTitle} onChange={e => set('roleTitle', e.target.value)} placeholder="e.g. Summer Analyst" />
        </label>
        <label style={labelStyle}>
          CTC (LPA)
          <Input type="number" min="0" step="0.1" value={form.ctc} onChange={e => set('ctc', e.target.value)} placeholder="e.g. 12.5" />
        </label>
        <label style={labelStyle}>
          Fixed Component (LPA)
          <Input type="number" min="0" step="0.1" value={form.fixedComponent} onChange={e => set('fixedComponent', e.target.value)} placeholder="e.g. 10.0" />
        </label>
        <label style={labelStyle}>
          Variable Component (LPA)
          <Input type="number" min="0" step="0.1" value={form.variableComponent} onChange={e => set('variableComponent', e.target.value)} placeholder="auto-computed or override" />
        </label>
        <label style={labelStyle}>
          Students Placed
          <Input type="number" min="0" step="1" value={form.studentsPlaced} onChange={e => set('studentsPlaced', e.target.value)} placeholder="e.g. 3" />
        </label>
        <label style={labelStyle}>
          Status
          <Select value={form.status} onChange={e => set('status', e.target.value)}>
            {OUTREACH_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </label>
        <div style={labelStyle}>
          Cohort(s) *
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface2)' }}>
            {batches.length === 0 ? (
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>No active cohorts</span>
            ) : batches.map(b => (
              <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 400, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={(form.cohorts || []).includes(b.id)}
                  onChange={() => toggleCohort(b.id)}
                  style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                {cohortLabel(b.id)}
              </label>
            ))}
          </div>
        </div>
      </div>
      <label style={labelStyle}>
        Notes
        <textarea
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Any context, contact details, next steps…"
          rows={3}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
        />
      </label>
      {err && <p style={{ color: 'var(--red, #dc2626)', fontSize: 13, margin: 0 }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Btn>
        <Btn variant="primary" onClick={handleSave} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Btn>
      </div>
    </div>
  )
}

// ── Own TPO view ─────────────────────────────────────────────────────────────

function MyOutreachView() {
  const { entries, loading, addEntry, updateEntry, deleteEntry } = useMyTpoOutreach()
  const { activeBatches } = useBatch()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const handleAdd = async (data) => {
    setBusy(true); setMsg('')
    try { await addEntry(data); setFormOpen(false) }
    catch (e) { setMsg('Error: ' + e.message) }
    setBusy(false)
  }

  const handleUpdate = async (data) => {
    setBusy(true); setMsg('')
    try { await updateEntry(editing.id, data); setEditing(null) }
    catch (e) { setMsg('Error: ' + e.message) }
    setBusy(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return
    try { await deleteEntry(id) }
    catch (e) { setMsg('Error: ' + e.message) }
  }

  if (loading) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="My Outreach"
        subtitle="Log companies you have reached out to and track outcomes"
        actions={<Btn variant="primary" size="sm" onClick={() => setFormOpen(true)}><Plus size={14} style={{ marginRight: 4 }} />Add Entry</Btn>}
      />

      {msg && <p style={{ padding: '8px 24px', color: 'var(--red, #dc2626)', fontSize: 13 }}>{msg}</p>}

      {entries.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-3)' }}>
          <Building2 size={36} />
          <p style={{ fontSize: 14 }}>No outreach entries yet. Click "Add Entry" to log your first company.</p>
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Company', 'Role', 'CTC (LPA)', 'Fixed (LPA)', 'Students Placed', 'Status', 'Cohort', ''].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.id} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)' }}>
                  <td style={tdStyle}><strong>{e.companyName}</strong></td>
                  <td style={tdStyle}>{e.roleTitle || '—'}</td>
                  <td style={tdStyle}>{e.ctc != null ? e.ctc : '—'}</td>
                  <td style={tdStyle}>{e.fixedComponent != null ? e.fixedComponent : '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{e.studentsPlaced != null ? e.studentsPlaced : '—'}</td>
                  <td style={tdStyle}>
                    <Badge color={STATUS_COLOR[e.status] || 'gray'}>
                      {OUTREACH_STATUSES.find(s => s.value === e.status)?.label || e.status}
                    </Badge>
                  </td>
                  <td style={tdStyle}>{normaliseCohorts(e).map(c => cohortLabel(c)).join(', ') || '—'}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                    <Btn variant="ghost" size="sm" onClick={() => setEditing(e)} style={{ padding: '2px 6px' }}><Pencil size={13} /></Btn>
                    <Btn variant="ghost" size="sm" onClick={() => handleDelete(e.id)} style={{ padding: '2px 6px', marginLeft: 4, color: 'var(--red, #dc2626)' }}><Trash2 size={13} /></Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Add Outreach Entry">
        <OutreachForm batches={activeBatches} onSave={handleAdd} onCancel={() => setFormOpen(false)} busy={busy} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Outreach Entry">
        {editing && (
          <OutreachForm
            initial={editing}
            batches={activeBatches}
            onSave={handleUpdate}
            onCancel={() => setEditing(null)}
            busy={busy}
          />
        )}
      </Modal>
    </div>
  )
}

// ── Admin / Faculty Coordinator read-only view ────────────────────────────────

function TpoSummaryCards({ entries, profiles, canSeeFinancials }) {
  // Build per-TPO stats
  const stats = {}
  entries.forEach(e => {
    const uid = e.tpoUid
    if (!stats[uid]) stats[uid] = { companies: 0, offers: 0, studentsPlaced: 0, ctcSum: 0, ctcCount: 0 }
    stats[uid].companies += 1
    if (e.status === 'offer_made') {
      stats[uid].offers += 1
      if (e.ctc != null && !isNaN(e.ctc)) { stats[uid].ctcSum += e.ctc; stats[uid].ctcCount += 1 }
    }
    if (e.studentsPlaced != null && !isNaN(e.studentsPlaced)) stats[uid].studentsPlaced += e.studentsPlaced
  })

  const uids = Object.keys(stats)
  if (uids.length === 0) return null

  return (
    <div style={{ padding: '14px 24px 0', display: 'flex', gap: 12, overflowX: 'auto' }}>
      {uids.map(uid => {
        const s = stats[uid]
        const profile = profiles[uid] || {}
        const avgCtc = s.ctcCount > 0 ? (s.ctcSum / s.ctcCount).toFixed(1) : null
        return (
          <div key={uid} style={{
            minWidth: 160, flexShrink: 0,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '12px 16px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
              {profile.displayName || uid}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.9 }}>
              <div>{s.companies} {s.companies === 1 ? 'company' : 'companies'}</div>
              <div>{s.offers} {s.offers === 1 ? 'offer' : 'offers'}</div>
              <div>{s.studentsPlaced} students placed</div>
              {canSeeFinancials && avgCtc && <div>Avg CTC: {avgCtc} LPA</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AllOutreachView() {
  const { entries, profiles, loading } = useAllTpoOutreach()
  const { activeBatches } = useBatch()
  const { canSeeFinancials } = usePermissions()
  const [cohortFilter, setCohortFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const filtered = entries.filter(e => {
    if (cohortFilter && !normaliseCohorts(e).includes(cohortFilter)) return false
    if (statusFilter && e.status !== statusFilter) return false
    return true
  })

  if (loading) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title="TPO Outreach" subtitle="All TPO outreach entries (read-only overview)" />

      <TpoSummaryCards entries={entries} profiles={profiles} canSeeFinancials={canSeeFinancials} />

      <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', background: 'var(--surface)', marginTop: 14 }}>
        <Select value={cohortFilter} onChange={e => setCohortFilter(e.target.value)} style={{ width: 180, height: 30, fontSize: 12 }}>
          <option value="">All cohorts</option>
          {activeBatches.map(b => <option key={b.id} value={b.id}>{cohortLabel(b.id)}</option>)}
        </Select>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 160, height: 30, fontSize: 12 }}>
          <option value="">All statuses</option>
          {OUTREACH_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </Select>
        <Badge color="gray">{filtered.length} entries</Badge>
      </div>

      {filtered.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 14 }}>
          No outreach data yet.
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['TPO', 'Company', 'Role', ...(canSeeFinancials ? ['CTC (LPA)', 'Fixed (LPA)'] : []), 'Students Placed', 'Status', 'Cohort'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => {
                const profile = profiles[e.tpoUid] || {}
                return (
                  <tr key={e.id} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)' }}>
                    <td style={tdStyle}>{profile.displayName || e.tpoUid}</td>
                    <td style={tdStyle}><strong>{e.companyName}</strong></td>
                    <td style={tdStyle}>{e.roleTitle || '—'}</td>
                    {canSeeFinancials && <td style={tdStyle}>{e.ctc != null ? e.ctc : '—'}</td>}
                    {canSeeFinancials && <td style={tdStyle}>{e.fixedComponent != null ? e.fixedComponent : '—'}</td>}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>{e.studentsPlaced != null ? e.studentsPlaced : '—'}</td>
                    <td style={tdStyle}>
                      <Badge color={STATUS_COLOR[e.status] || 'gray'}>
                        {OUTREACH_STATUSES.find(s => s.value === e.status)?.label || e.status}
                      </Badge>
                    </td>
                    <td style={tdStyle}>{normaliseCohorts(e).map(c => cohortLabel(c)).join(', ') || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Page entry point ─────────────────────────────────────────────────────────

export default function TpoPage() {
  const { isTpo } = useAuth()
  return isTpo ? <MyOutreachView /> : <AllOutreachView />
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const labelStyle = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontSize: 12, fontWeight: 600, color: 'var(--text-2)',
}

const thStyle = {
  padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11,
  color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em',
  borderBottom: '1px solid var(--border)', background: 'var(--surface)',
  position: 'sticky', top: 0, zIndex: 1,
}

const tdStyle = {
  padding: '8px 12px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle',
}
