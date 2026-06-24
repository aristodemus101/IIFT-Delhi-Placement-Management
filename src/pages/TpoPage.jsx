import React, { useEffect, useRef, useState } from 'react'
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

export const SECTORS = [
  { value: 'Agri & Allied Industries', label: 'Agri & Allied Industries' },
  { value: 'Airlines & Aviation', label: 'Airlines & Aviation' },
  { value: 'Automobile', label: 'Automobile' },
  { value: 'Banking', label: 'Banking' },
  { value: 'Conglomerates', label: 'Conglomerates' },
  { value: 'E-Commerce', label: 'E-Commerce' },
  { value: 'EPC (Engineering, Procurement & Construction)', label: 'EPC (Engineering, Procurement & Construction)' },
  { value: 'Export Companies', label: 'Export Companies' },
  { value: 'Facilities Management', label: 'Facilities Management' },
  { value: 'Fintech & Payment Gateways', label: 'Fintech & Payment Gateways' },
  { value: 'FMCD (Consumer Durables)', label: 'FMCD (Consumer Durables)' },
  { value: 'FMCG', label: 'FMCG' },
  { value: 'FSI (Financial Services & Insurance)', label: 'FSI (Financial Services & Insurance)' },
  { value: 'Hotel', label: 'Hotel' },
  { value: 'IT & ITES', label: 'IT & ITES' },
  { value: 'Logistics & Supply Chain', label: 'Logistics & Supply Chain' },
  { value: 'Manufacturing', label: 'Manufacturing' },
  { value: 'Market Research & Consulting', label: 'Market Research & Consulting' },
  { value: 'Media', label: 'Media' },
  { value: 'Oil, Power, Energy & Semiconductor', label: 'Oil, Power, Energy & Semiconductor' },
  { value: 'Pharma', label: 'Pharma' },
  { value: 'Real Estate, Sanitaryware, Tiles, Cement & Paints', label: 'Real Estate, Sanitaryware, Tiles, Cement & Paints' },
  { value: 'Retail', label: 'Retail' },
  { value: 'Telecom', label: 'Telecom' },
]

const CAMPUSES = ['Delhi', 'Gift City', 'Kakinada', 'Kolkata']

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
  // KPI fields
  season:            'summer',
  isNew:             false,
  isMultiCampus:     false,
  isInternational:   false,
  sector:            '',
  isPremium:         false,
  isLateral:         false,
  campus:            [],
}

// Normalise legacy single-cohort entries to cohorts array
function normaliseCohorts(e) {
  if (e.cohorts && e.cohorts.length > 0) return e.cohorts
  if (e.cohort) return [e.cohort]
  return []
}

function OutreachForm({ initial, batches, onSave, onCancel, onDirtyChange, busy }) {
  const initCohorts = initial ? normaliseCohorts(initial) : []
  const initCampus  = initial?.campus || []
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial, cohorts: initCohorts, campus: initCampus })
  const [err, setErr] = useState('')
  const originalRef = useRef(null)

  useEffect(() => {
    originalRef.current = JSON.stringify({ ...EMPTY_FORM, ...initial, cohorts: initCohorts, campus: initCampus })
  }, [initial, initCohorts, initCampus])

  const currentSnapshot = JSON.stringify(form)
  const isDirty = originalRef.current !== null && currentSnapshot !== originalRef.current

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (typeof onDirtyChange === 'function') onDirtyChange(isDirty)
  }, [isDirty, onDirtyChange])

  const toggleCohort = (batchId) => {
    setForm(f => {
      const cur = f.cohorts || []
      return { ...f, cohorts: cur.includes(batchId) ? cur.filter(c => c !== batchId) : [...cur, batchId] }
    })
  }

  const toggleCampus = (c) => {
    setForm(f => {
      const cur = f.campus || []
      return { ...f, campus: cur.includes(c) ? cur.filter(x => x !== c) : [...cur, c] }
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
      season:            form.season,
      isNew:             !!form.isNew,
      isMultiCampus:     !!form.isMultiCampus,
      isInternational:   !!form.isInternational,
      sector:            form.sector || null,
      isPremium:         !!form.isPremium,
      isLateral:         !!form.isLateral,
      campus:            form.campus || [],
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
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
      {/* KPI Classification */}
      <div style={{ border: '1px solid color-mix(in srgb, var(--accent) 18%, var(--border))', borderRadius: 16, padding: 16, background: 'linear-gradient(180deg, color-mix(in srgb, var(--accent-bg) 55%, var(--surface2)) 0%, var(--surface2) 100%)', display: 'flex', flexDirection: 'column', gap: 14, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent-text)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>KPI Classification</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Track the outreach flags and placement context in one place.</div>
          </div>
          <Badge color="blue">Required for reporting</Badge>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <label style={labelStyle}>
            Season *
            <Select value={form.season} onChange={e => set('season', e.target.value)}>
              <option value="summer">Summer Internship</option>
              <option value="final">Final Placement</option>
            </Select>
          </label>
          <label style={labelStyle}>
            Sector
            <Select value={form.sector || ''} onChange={e => set('sector', e.target.value)}>
              <option value="">— Select sector —</option>
              {SECTORS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </label>
        </div>
        <div style={labelStyle}>
          Campus(es)
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)' }}>
            {CAMPUSES.map(c => (
              <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 400, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={(form.campus || []).includes(c)}
                  onChange={() => toggleCampus(c)}
                  style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                {c}
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', paddingTop: 2 }}>
          {[
            { key: 'isNew',           label: 'New recruiting organisation' },
            { key: 'isMultiCampus',   label: 'Multi-campus recruiter' },
            { key: 'isInternational', label: 'International opportunity' },
            { key: 'isPremium',       label: 'Premium / dream company' },
            { key: 'isLateral',       label: 'Lateral hire opportunity' },
          ].map(({ key, label }) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 400, cursor: 'pointer', color: 'var(--text)' }}>
              <input
                type="checkbox"
                checked={!!form[key]}
                onChange={e => set(key, e.target.checked)}
                style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              {label}
            </label>
          ))}
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
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid var(--border)', position: 'sticky', bottom: 0, background: 'linear-gradient(180deg, color-mix(in srgb, var(--surface) 65%, transparent) 0%, var(--surface) 40%)', backdropFilter: 'blur(10px)', marginInline: -20, paddingInline: 20, paddingBottom: 4 }}>
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
  const [confirmClose, setConfirmClose] = useState(null)
  const [addDirty, setAddDirty] = useState(false)
  const [editDirty, setEditDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const requestClose = (mode) => {
    const dirty = mode === 'edit' ? editDirty : addDirty
    if (dirty) {
      setConfirmClose(mode)
      return
    }
    if (mode === 'edit') setEditing(null)
    else setFormOpen(false)
  }

  const handleAdd = async (data) => {
    setBusy(true); setMsg('')
    try { await addEntry(data); setAddDirty(false); setFormOpen(false) }
    catch (e) { setMsg('Error: ' + e.message) }
    setBusy(false)
  }

  const handleUpdate = async (data) => {
    setBusy(true); setMsg('')
    try { await updateEntry(editing.id, data); setEditDirty(false); setEditing(null) }
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
        actions={<Btn variant="primary" size="sm" onClick={() => { setAddDirty(false); setFormOpen(true) }}><Plus size={14} style={{ marginRight: 4 }} />Add Entry</Btn>}
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
                    <Btn variant="ghost" size="sm" onClick={() => { setEditDirty(false); setEditing(e) }} style={{ padding: '2px 6px' }}><Pencil size={13} /></Btn>
                    <Btn variant="ghost" size="sm" onClick={() => handleDelete(e.id)} style={{ padding: '2px 6px', marginLeft: 4, color: 'var(--red, #dc2626)' }}><Trash2 size={13} /></Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={formOpen} onClose={() => requestClose('add')} title="Add Outreach Entry" width={760}>
        <OutreachForm batches={activeBatches} onSave={handleAdd} onCancel={() => requestClose('add')} busy={busy} onDirtyChange={setAddDirty} />
      </Modal>

      <Modal open={!!editing} onClose={() => requestClose('edit')} title="Edit Outreach Entry" width={760}>
        {editing && (
          <OutreachForm
            initial={editing}
            batches={activeBatches}
            onSave={handleUpdate}
            onCancel={() => requestClose('edit')}
            busy={busy}
            onDirtyChange={setEditDirty}
          />
        )}
      </Modal>

      <Modal
        open={!!confirmClose}
        onClose={() => setConfirmClose(null)}
        title="Unsaved changes"
        width={420}
        closeOnBackdropClick={false}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
            You have unsaved edits. Do you want to discard them or keep editing?
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Btn variant="ghost" onClick={() => setConfirmClose(null)}>Keep editing</Btn>
            <Btn variant="danger" onClick={() => {
              if (confirmClose === 'edit') {
                setEditing(null)
                setEditDirty(false)
              } else {
                setFormOpen(false)
                setAddDirty(false)
              }
              setConfirmClose(null)
            }}>Discard</Btn>
          </div>
        </div>
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

const FLAG_COLS = [
  { key: 'isNew',           short: 'New' },
  { key: 'isMultiCampus',   short: 'Multi' },
  { key: 'isInternational', short: 'Intl' },
  { key: 'isPremium',       short: 'Premium' },
  { key: 'isLateral',       short: 'Lateral' },
]

function FlagChips({ entry }) {
  const active = FLAG_COLS.filter(f => entry[f.key])
  if (!active.length) return <span style={{ color: 'var(--text-3)' }}>—</span>
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {active.map(f => (
        <span key={f.key} style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99, background: 'var(--accent-bg)', color: 'var(--accent-text)', border: '1px solid #BFDBFE' }}>
          {f.short}
        </span>
      ))}
    </div>
  )
}

function AllOutreachView() {
  const { entries, profiles, loading } = useAllTpoOutreach()
  const { activeBatches } = useBatch()
  const { canSeeFinancials } = usePermissions()
  const [cohortFilter, setCohortFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tpoFilter, setTpoFilter] = useState('')

  // Build TPO list from profiles
  const tpoList = Object.entries(profiles).map(([uid, p]) => ({ uid, name: p.displayName || uid }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const filtered = entries.filter(e => {
    if (tpoFilter && e.tpoUid !== tpoFilter) return false
    if (cohortFilter && !normaliseCohorts(e).includes(cohortFilter)) return false
    if (statusFilter && e.status !== statusFilter) return false
    return true
  })

  if (loading) return <Spinner />

  const headers = [
    'TPO', 'Company', 'Role',
    ...(canSeeFinancials ? ['CTC (LPA)', 'Fixed (LPA)'] : []),
    'Students Placed', 'Status', 'Season', 'Sector', 'Campus', 'Flags', 'Cohort',
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title="TPO Outreach" subtitle="All TPO outreach entries (read-only overview)" />

      <TpoSummaryCards entries={tpoFilter ? filtered : entries} profiles={profiles} canSeeFinancials={canSeeFinancials} />

      <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', background: 'var(--surface)', marginTop: 14 }}>
        <Select value={tpoFilter} onChange={e => setTpoFilter(e.target.value)} style={{ width: 170, height: 30, fontSize: 12 }}>
          <option value="">All TPOs</option>
          {tpoList.map(t => <option key={t.uid} value={t.uid}>{t.name}</option>)}
        </Select>
        <Select value={cohortFilter} onChange={e => setCohortFilter(e.target.value)} style={{ width: 160, height: 30, fontSize: 12 }}>
          <option value="">All cohorts</option>
          {activeBatches.map(b => <option key={b.id} value={b.id}>{cohortLabel(b.id)}</option>)}
        </Select>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 150, height: 30, fontSize: 12 }}>
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
                {headers.map(h => <th key={h} style={thStyle}>{h}</th>)}
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
                    <td style={tdStyle}>
                      {e.season ? (
                        <Badge color={e.season === 'summer' ? 'amber' : 'blue'}>
                          {e.season === 'summer' ? 'Summer' : 'Final'}
                        </Badge>
                      ) : '—'}
                    </td>
                    <td style={tdStyle}>{e.sector || '—'}</td>
                    <td style={{ ...tdStyle, maxWidth: 120 }}>{(e.campus || []).join(', ') || '—'}</td>
                    <td style={tdStyle}><FlagChips entry={e} /></td>
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
