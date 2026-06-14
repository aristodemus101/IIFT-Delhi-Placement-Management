import React, { useState, useEffect } from 'react'
import { useRoles } from '../lib/useRoles'
import { useAuth } from '../lib/AuthContext'
import { useStudents, useColumnSchema } from '../lib/useStudents'
import { useSheetsSync } from '../lib/SheetsSyncContext'
import { useBatch } from '../lib/BatchContext'
import { usePendingChanges } from '../lib/PendingChangesContext'
import { cohortLabel, cohortYear, parseCohortId } from '../lib/batch'
import { PageHeader, Btn, Badge, Spinner, Modal, Input } from '../components/UI'
import CohortPicker from '../components/CohortPicker'
import { ROLES, ROLE_LABELS, CONFIGURABLE_FIELDS } from '../lib/permissions'
import {
  ShieldCheck, User, AlertTriangle, Sheet, RefreshCw, ExternalLink, CheckCircle,
  Database, Columns3, Plus, Archive, RotateCcw, Crown, Trash2, Briefcase, GraduationCap
} from 'lucide-react'
import {
  collection, doc, setDoc, updateDoc, getDoc, getDocs, query, where,
  serverTimestamp, writeBatch as writeBatchFn, deleteDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

// Helper to derive cohort from a student doc
function studentCohort(s) {
  return s.cohort || 'unknown'
}

export default function AdminPage() {
  const { roles, loading, setRole, adminCount, adminUsers } = useRoles()
  const { user, isMasterAdmin, isAdmin, toggleMasterAdmin } = useAuth()
  const { students } = useStudents()
  const { selectedCohort, batches, activeBatches, archivedBatches, getCohortCycle, setCohortCycle } = useBatch()
  const { schemaHeaders, setSchemaHeaders } = useColumnSchema(selectedCohort || 'default')
  const { connected, sheetUrl, lastSync, syncing, authorize, syncNow } = useSheetsSync()
  const { propose } = usePendingChanges()
  const [busy, setBusy] = useState(null)
  const [pendingRoles, setPendingRoles] = useState({})
  const [masterAdminBusy, setMasterAdminBusy] = useState(null)
  const [syncMsg, setSyncMsg] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authErr, setAuthErr] = useState('')
  const [schemaOpen, setSchemaOpen] = useState(false)
  const [schemaDraft, setSchemaDraft] = useState('')
  const [schemaMsg, setSchemaMsg] = useState('')

  // Cohort management state
  const [createCohortOpen, setCreateCohortOpen] = useState(false)
  const [newCohortId, setNewCohortId] = useState('')
  const [newCohortCycle, setNewCohortCycle] = useState('summer')
  const [cohortBusy, setCohortBusy] = useState(false)
  const [cohortMsg, setCohortMsg] = useState('')

  // Field visibility permissions state
  const [fieldPerms, setFieldPerms] = useState({})   // fieldKey → roles[]
  const [fieldPermsBusy, setFieldPermsBusy] = useState(false)
  const [fieldPermsMsg, setFieldPermsMsg] = useState('')

  // Load field permissions config on mount
  useEffect(() => {
    getDoc(doc(db, 'config', 'rolePermissions')).then(snap => {
      if (snap.exists()) setFieldPerms(snap.data())
    })
  }, [])

  const saveFieldPerms = async () => {
    setFieldPermsBusy(true); setFieldPermsMsg('')
    try {
      await setDoc(doc(db, 'config', 'rolePermissions'), fieldPerms)
      setFieldPermsMsg('Saved.')
      setTimeout(() => setFieldPermsMsg(''), 3000)
    } catch (e) { setFieldPermsMsg('Error: ' + e.message) }
    setFieldPermsBusy(false)
  }

  const toggleFieldRole = (fieldKey, role, defaultRoles) => {
    const current = fieldPerms[fieldKey] ?? defaultRoles
    const next = current.includes(role) ? current.filter(r => r !== role) : [...current, role]
    // Admin always has access — enforce it
    const enforced = next.includes('admin') ? next : ['admin', ...next]
    setFieldPerms(prev => ({ ...prev, [fieldKey]: enforced }))
  }

  const sorted = [...roles].sort((a, b) => {
    if (a.role === b.role) return (a.displayName || '').localeCompare(b.displayName || '')
    return a.role === 'admin' ? -1 : 1
  })

  const handleAuthorize = async () => {
    setAuthBusy(true); setAuthErr('')
    try { await authorize() }
    catch (e) { setAuthErr(e.message) }
    setAuthBusy(false)
  }

  const handleSyncNow = async () => {
    setSyncMsg('')
    try {
      const { active, placed } = await syncNow(students)
      setSyncMsg(`Synced ${active} active + ${placed} placed students.`)
      setTimeout(() => setSyncMsg(''), 5000)
    } catch (e) { setSyncMsg('Error: ' + e.message) }
  }

  const changeRole = async (member, newRole) => {
    if (newRole === member.role) return
    if (member.role === 'admin' && newRole !== 'admin' && adminCount <= 1) {
      alert('At least one admin must remain.')
      return
    }
    setBusy(member.uid)
    try { await setRole(member.uid, newRole) } catch (e) { alert(e.message) }
    setBusy(null)
  }

  const handleToggleMasterAdmin = async (member) => {
    const newVal = !member.isMasterAdmin
    setMasterAdminBusy(member.uid)
    try { await toggleMasterAdmin(member.uid, newVal) } catch (e) { alert(e.message) }
    setMasterAdminBusy(null)
  }

  const openSchemaEditor = () => {
    const base = (schemaHeaders && schemaHeaders.length ? schemaHeaders : []).join('\n')
    setSchemaDraft(base)
    setSchemaOpen(true)
  }

  const saveSchema = async () => {
    const parsed = schemaDraft.split('\n').map(s => s.trim()).filter(Boolean)
    const seen = new Set()
    const headers = parsed.filter(h => {
      if (seen.has(h)) return false
      seen.add(h)
      return true
    })
    if (!headers.length) return
    await setSchemaHeaders(headers, user)
    setSchemaMsg(`Column structure saved (${headers.length} columns).`)
    setSchemaOpen(false)
    setTimeout(() => setSchemaMsg(''), 4000)
  }

  const handleCreateCohort = async () => {
    if (!newCohortId) { setCohortMsg('Please select year, campus, and programme.'); return }
    const { yearCode, campus, programme } = parseCohortId(newCohortId)
    if (!yearCode || !campus || !programme) { setCohortMsg('Please select year, campus, and programme.'); return }
    setCohortBusy(true); setCohortMsg('')
    try {
      const year = cohortYear(newCohortId)
      await setDoc(doc(db, 'batches', newCohortId), {
        id: newCohortId,
        label: cohortLabel(newCohortId),
        year: year || new Date().getFullYear(),
        campus,
        programme,
        activeCycle: newCohortCycle,
        status: 'active',
        createdAt: serverTimestamp(),
        createdBy: { uid: user.uid, name: user.displayName },
      }, { merge: true })
      setCohortMsg(`Cohort "${cohortLabel(newCohortId)}" created.`)
      setCreateCohortOpen(false)
      setNewCohortId('')
      setNewCohortCycle('summer')
      setTimeout(() => setCohortMsg(''), 4000)
    } catch (e) {
      setCohortMsg('Error: ' + e.message)
    }
    setCohortBusy(false)
  }

  const handleToggleArchiveCohort = async (cohortId, currentlyActive) => {
    const label = cohortLabel(cohortId)
    if (currentlyActive) {
      if (!window.confirm(`Archive cohort "${label}"? It will be hidden from the cohort switcher but data is kept.`)) return
    }
    setCohortBusy(true)
    try {
      await updateDoc(doc(db, 'batches', cohortId), {
        status: currentlyActive ? 'archived' : 'active',
        ...(currentlyActive ? { archivedAt: serverTimestamp() } : { restoredAt: serverTimestamp() }),
      })
      setCohortMsg(`Cohort "${label}" ${currentlyActive ? 'archived' : 'restored'}.`)
      setTimeout(() => setCohortMsg(''), 4000)
    } catch (e) {
      setCohortMsg('Error: ' + e.message)
    }
    setCohortBusy(false)
  }

  const handleClearStudents = async (cohortId) => {
    const label = cohortLabel(cohortId)
    const count = students.filter(s => s.cohort === cohortId).length
    if (!count) { setCohortMsg('No students to clear.'); return }
    if (!window.confirm(`Clear all ${count} students from "${label}"?\n\nThe cohort itself is kept. A second admin must approve before records are deleted.`)) return
    setCohortBusy(true); setCohortMsg('')
    try {
      const ids = students.filter(s => s.cohort === cohortId).map(s => s._id)
      await propose({ type: 'clearAll', cohort: cohortId, studentIds: ids, studentCount: ids.length })
      setCohortMsg(`Clear proposal for "${label}" submitted — awaiting approval.`)
      setTimeout(() => setCohortMsg(''), 5000)
    } catch (e) {
      setCohortMsg('Error: ' + e.message)
    }
    setCohortBusy(false)
  }

  const handleDeleteCohort = async (cohortId) => {
    const label = cohortLabel(cohortId)
    if (!window.confirm(`DELETE cohort "${label}"?\n\nThis will permanently delete the cohort and ALL student records in it. This cannot be undone.`)) return
    setCohortBusy(true); setCohortMsg('')
    try {
      // Delete all student docs in this cohort in batches of 500
      const snap = await getDocs(query(collection(db, 'students'), where('cohort', '==', cohortId)))
      const chunks = []
      let current = writeBatchFn(db)
      let count = 0
      snap.docs.forEach(d => {
        current.delete(d.ref)
        count++
        if (count % 500 === 0) { chunks.push(current); current = writeBatchFn(db) }
      })
      if (count % 500 !== 0) chunks.push(current)
      await Promise.all(chunks.map(b => b.commit()))
      await deleteDoc(doc(db, 'batches', cohortId))
      setCohortMsg(`Cohort "${label}" and ${snap.size} student${snap.size !== 1 ? 's' : ''} deleted.`)
      setTimeout(() => setCohortMsg(''), 5000)
    } catch (e) {
      setCohortMsg('Error: ' + e.message)
    }
    setCohortBusy(false)
  }

  const studentCountForCohort = (cohortId) => students.filter(s => studentCohort(s) === cohortId).length

  if (loading) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Team Access"
        subtitle="Manage team roles: Admin · Committee Member · Viewer"
      />

      <div style={{ padding: '20px 28px', overflow: 'auto' }}>
        {/* Info banner */}
        <div style={{
          display: 'flex', gap: 10, background: 'var(--accent-bg)', border: '1px solid #BFDBFE',
          borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 20,
        }}>
          <ShieldCheck size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: 'var(--accent-text)', lineHeight: 1.6 }}>
            <strong>Admin</strong> — full access, propose + approve changes.&nbsp;
            <strong>Committee Member</strong> — read access + Placed/Analytics pages, no financials.&nbsp;
            <strong>Viewer</strong> — roster + activity only, no placement data.&nbsp;
            <strong>Admin</strong> users can propose changes (place, delete, import) and approve proposals
            made by <em>other</em> admins — no admin can approve their own change.&nbsp;
            <strong>Viewer</strong> users have read-only access: view and download only, no edits.&nbsp;
            <strong>Master Admin</strong> status can be toggled per admin using the crown icon.
          </div>
        </div>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
            display: 'grid', gridTemplateColumns: '1fr 180px 120px 160px',
            fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            <span>Member</span>
            <span>Email</span>
            <span>Role</span>
            <span></span>
          </div>

          {sorted.map((m, i) => {
            const isSelf = m.uid === user?.uid
            const pendingRole = pendingRoles[m.uid]
            const hasPendingChange = pendingRole !== undefined && pendingRole !== m.role
            return (
              <div key={m.uid} style={{
                display: 'grid', gridTemplateColumns: '1fr 180px 120px 160px',
                padding: '12px 16px', alignItems: 'center',
                borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none',
                background: isSelf ? 'var(--surface2)' : 'transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {m.photoURL ? (
                    <img src={m.photoURL} alt="" style={{ width: 30, height: 30, borderRadius: '50%' }} />
                  ) : (
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={14} color="var(--text-3)" />
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {m.displayName || '(no name)'}
                      {isMasterAdmin && !isSelf && m.role === 'admin' && (
                        <button
                          onClick={() => handleToggleMasterAdmin(m)}
                          disabled={masterAdminBusy === m.uid}
                          title={m.isMasterAdmin ? 'Remove master admin' : 'Grant master admin'}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: '1px 3px',
                            color: m.isMasterAdmin ? 'var(--amber-text)' : 'var(--text-3)',
                            opacity: masterAdminBusy === m.uid ? 0.5 : 1,
                            display: 'inline-flex', alignItems: 'center',
                          }}
                        >
                          <Crown size={13} />
                        </button>
                      )}
                    </div>
                    {isSelf && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>You</div>}
                    {m.isMasterAdmin && <div style={{ fontSize: 11, color: 'var(--amber-text)' }}>Master Admin</div>}
                  </div>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.email}
                </div>

                <div>
                  <Badge color={
                    m.role === 'admin'               ? 'blue'
                    : m.role === 'committee'         ? 'amber'
                    : m.role === 'tpo'               ? 'green'
                    : m.role === 'faculty_coordinator' ? 'blue'
                    : 'gray'
                  }>
                    {m.role === 'admin'               ? <><ShieldCheck size={10} /> Admin</>
                     : m.role === 'committee'         ? <><User size={10} /> Committee</>
                     : m.role === 'tpo'               ? <><Briefcase size={10} /> TPO</>
                     : m.role === 'faculty_coordinator' ? <><GraduationCap size={10} /> Faculty Coord</>
                     : <><User size={10} /> Viewer</>}
                  </Badge>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isSelf || !isMasterAdmin ? (
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>—</span>
                  ) : (
                    <>
                      <select
                        value={pendingRoles[m.uid] ?? m.role ?? 'viewer'}
                        disabled={busy === m.uid}
                        onChange={e => setPendingRoles(p => ({ ...p, [m.uid]: e.target.value }))}
                        style={{
                          height: 28, padding: '0 8px', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)', background: 'var(--surface)',
                          color: 'var(--text)', fontSize: 12, cursor: 'pointer',
                        }}
                      >
                        {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                      {hasPendingChange && (
                        <Btn
                          size="sm"
                          variant="primary"
                          disabled={busy === m.uid}
                          onClick={async () => {
                            await changeRole(m, pendingRoles[m.uid])
                            setPendingRoles(p => { const n = { ...p }; delete n[m.uid]; return n })
                          }}
                        >
                          {busy === m.uid ? 'Saving…' : 'Save'}
                        </Btn>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}

          {sorted.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              No team members yet. They will appear here after their first login.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 14, fontSize: 12, color: 'var(--text-3)' }}>
          <AlertTriangle size={12} />
          Admin count: {adminCount} · Members appear here automatically after their first login. · Master admin can be toggled per admin using the <Crown size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> icon.
        </div>

        {/* ── Field Visibility ───────────────────────────────────────────── */}
        {isMasterAdmin && (
          <div style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>Field Visibility</h2>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14, lineHeight: 1.6 }}>
              Control which roles can see sensitive fields. Admins always have full access.
            </p>
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 14px', fontWeight: 600, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)' }}>Field</th>
                    {ROLES.map(r => (
                      <th key={r} style={{ textAlign: 'center', padding: '8px 14px', fontWeight: 600, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', minWidth: 100 }}>
                        {ROLE_LABELS[r]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CONFIGURABLE_FIELDS.map((field, i) => {
                    const currentRoles = fieldPerms[field.key] ?? field.defaultRoles
                    return (
                      <tr key={field.key} style={{ borderBottom: i < CONFIGURABLE_FIELDS.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 500 }}>{field.label}</td>
                        {ROLES.map(r => {
                          const checked = currentRoles.includes(r)
                          const isAdmin = r === 'admin'
                          return (
                            <td key={r} style={{ textAlign: 'center', padding: '10px 14px' }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={isAdmin}
                                title={isAdmin ? 'Admins always have access' : undefined}
                                onChange={() => toggleFieldRole(field.key, r, field.defaultRoles)}
                                style={{ width: 16, height: 16, cursor: isAdmin ? 'not-allowed' : 'pointer', accentColor: 'var(--accent)' }}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
              <Btn variant="primary" onClick={saveFieldPerms} disabled={fieldPermsBusy}>
                <CheckCircle size={13} /> {fieldPermsBusy ? 'Saving…' : 'Save Field Visibility'}
              </Btn>
              {fieldPermsMsg && <span style={{ fontSize: 13, color: fieldPermsMsg.startsWith('Error') ? 'var(--red-text)' : 'var(--green-text)' }}>{fieldPermsMsg}</span>}
            </div>
          </div>
        )}

        {/* ── Cohort Management ─────────────────────────────────────────── */}
        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Cohort Management</h2>
            {isAdmin && (
              <Btn size="sm" variant="primary" onClick={() => { setNewCohortId(''); setCreateCohortOpen(true) }}>
                <Plus size={13} /> Create Cohort
              </Btn>
            )}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
            Manage placement cohorts. Use programme suffixes to separate IB and BA (e.g. D27-IB, D27-BA). Each cohort tracks Summer and Final placements independently.
          </p>

          {cohortMsg && (
            <div style={{ fontSize: 13, color: cohortMsg.startsWith('Error') ? 'var(--red-text)' : 'var(--green-text)', marginBottom: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
              {!cohortMsg.startsWith('Error') && <CheckCircle size={13} />} {cohortMsg}
            </div>
          )}

          {batches.length === 0 ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px 22px', fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>
              No cohorts yet. Create a cohort or import students to get started.
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <div style={{
                padding: '10px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
                display: 'grid', gridTemplateColumns: '1fr 140px 80px 60px 100px',
                fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                <span>Cohort</span>
                <span>Active Cycle</span>
                <span>Status</span>
                <span>Students</span>
                <span></span>
              </div>

              {[...activeBatches, ...archivedBatches].map((b, i) => {
                const count = studentCountForCohort(b.id)
                const isActive = b.status === 'active'
                const cycle = getCohortCycle(b.id)
                const allBatches = [...activeBatches, ...archivedBatches]
                return (
                  <div key={b.id} style={{
                    display: 'grid', gridTemplateColumns: '1fr 140px 80px 60px 100px',
                    padding: '12px 16px', alignItems: 'center',
                    borderBottom: i < allBatches.length - 1 ? '1px solid var(--border)' : 'none',
                    opacity: isActive ? 1 : 0.6,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{b.label || cohortLabel(b.id)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{b.id} · Year {b.year || cohortYear(b.id)}</div>
                    </div>
                    <div>
                      {isAdmin && isActive ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          {[{ v: 'summer', label: 'SIP' }, { v: 'final', label: 'Final' }].map(opt => (
                            <button key={opt.v} onClick={() => setCohortCycle(b.id, opt.v)} style={{
                              padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                              border: `1px solid ${cycle === opt.v ? (opt.v === 'summer' ? 'var(--amber)' : 'var(--accent)') : 'var(--border)'}`,
                              background: cycle === opt.v ? (opt.v === 'summer' ? 'var(--amber-bg)' : 'var(--accent-bg)') : 'var(--surface)',
                              color: cycle === opt.v ? (opt.v === 'summer' ? 'var(--amber-text)' : 'var(--accent-dark)') : 'var(--text-2)',
                              fontFamily: 'var(--font-sans)',
                            }}>{opt.label}</button>
                          ))}
                        </div>
                      ) : (
                        <Badge color={cycle === 'summer' ? 'amber' : 'blue'}>
                          {cycle === 'summer' ? 'SIP' : 'Final'}
                        </Badge>
                      )}
                    </div>
                    <div>
                      <Badge color={isActive ? 'blue' : 'gray'}>
                        {isActive ? 'Active' : 'Archived'}
                      </Badge>
                    </div>
                    <div style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{count}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {isAdmin && (
                        <Btn size="sm" variant="ghost" onClick={() => handleToggleArchiveCohort(b.id, isActive)} disabled={cohortBusy} title={isActive ? 'Archive cohort' : 'Restore cohort'}>
                          {isActive ? <Archive size={12} /> : <RotateCcw size={12} />}
                        </Btn>
                      )}
                      {isAdmin && (
                        <Btn size="sm" variant="ghost" onClick={() => handleClearStudents(b.id)} disabled={cohortBusy} title="Propose clearing all students from this cohort (requires second admin approval)">
                          <Database size={12} /> Clear
                        </Btn>
                      )}
                      {isMasterAdmin && (
                        <Btn size="sm" variant="danger" onClick={() => handleDeleteCohort(b.id)} disabled={cohortBusy} title="Permanently delete cohort and all students">
                          <Trash2 size={12} />
                        </Btn>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Column Structure</h2>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
            Control visible headers for roster UI and imports for <strong>{selectedCohort ? cohortLabel(selectedCohort) : 'selected cohort'}</strong>. You can add, remove, rename, and reorder columns.
          </p>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 10 }}>
              <Columns3 size={14} />
              Active columns: <strong>{schemaHeaders?.length || 0}</strong>
            </div>
            {schemaMsg && <div style={{ fontSize: 13, color: 'var(--green-text)', marginBottom: 8 }}>{schemaMsg}</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn size="sm" onClick={openSchemaEditor}>Edit Column Structure</Btn>
            </div>
          </div>
        </div>

        {/* ── Google Sheets Backup ─────────────────────────────────────── */}
        {isMasterAdmin && (
          <div style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Google Sheets Backup</h2>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
              Every approved change is automatically logged to your Google Sheet.
              Use "Sync Now" to refresh the full roster and placed-student snapshots.
            </p>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Status row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: connected ? 'var(--green)' : 'var(--text-3)',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>
                  {connected ? 'Connected to Google Sheets' : 'Not connected'}
                </span>
                {lastSync && (
                  <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 'auto' }}>
                    Last synced: {lastSync.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                )}
              </div>

              {syncMsg && (
                <div style={{ fontSize: 13, color: syncMsg.startsWith('Error') ? 'var(--red-text)' : 'var(--green-text)', display: 'flex', gap: 6, alignItems: 'center' }}>
                  {!syncMsg.startsWith('Error') && <CheckCircle size={13} />} {syncMsg}
                </div>
              )}

              {authErr && (
                <p style={{ fontSize: 13, color: 'var(--red-text)' }}>{authErr}</p>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn onClick={handleAuthorize} disabled={authBusy}>
                  <Sheet size={13} /> {connected ? 'Reconnect Sheets' : 'Connect Google Sheets'}
                </Btn>
                {connected && (
                  <Btn variant="primary" onClick={handleSyncNow} disabled={syncing}>
                    <RefreshCw size={13} /> {syncing ? 'Syncing…' : 'Sync Full Snapshot Now'}
                  </Btn>
                )}
                {sheetUrl && (
                  <Btn variant="ghost" onClick={() => window.open(sheetUrl, '_blank')}>
                    <ExternalLink size={13} /> Open Sheet
                  </Btn>
                )}
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <strong style={{ color: 'var(--text-2)' }}>Sheet structure:</strong>
                &nbsp;"Change Log" (auto-appended on every approval) ·
                "Roster Snapshot" + "Placed Snapshot" (overwritten on Sync Now).<br />
                The access token lasts ~1 hour — reconnect if auto-logging stops working.
              </div>
            </div>
          </div>
        )}

        {/* ── Firestore Scheduled Backup instructions ──────────────────── */}
        {isMasterAdmin && (
          <div style={{ marginTop: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Firestore Database Backup</h2>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
              Enable daily automatic Firestore exports to Google Cloud Storage — your true disaster-recovery layer.
            </p>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px 22px' }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <Database size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
                  One-time setup — takes 5 minutes. After this, Firestore is fully backed up daily
                  and can be restored in minutes even if the entire project has an outage.
                </p>
              </div>
              <ol style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 2, paddingLeft: 20, margin: 0 }}>
                <li>Open <strong>Firebase Console → Firestore → Managed Backups</strong> (left sidebar)</li>
                <li>Click <strong>"Create backup schedule"</strong></li>
                <li>Set recurrence to <strong>Daily</strong>, retention to <strong>7 days</strong></li>
                <li>Click <strong>Save</strong> — Firebase handles everything from here</li>
              </ol>
              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <Btn variant="ghost" size="sm" onClick={() => window.open('https://console.firebase.google.com/project/placement-management-6133f/firestore/databases/-default-/backups', '_blank')}>
                  <ExternalLink size={12} /> Open Firebase Backups Page
                </Btn>
              </div>
            </div>
          </div>
        )}

        {/* ── Master Admin note ────────────────────────────────────────── */}
        {isMasterAdmin && (
          <div style={{ marginTop: 32, marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Master Admin</h2>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--amber-text)' }}>
                <Crown size={14} />
                <strong>You are a Master Admin.</strong>
              </div>
              Master admin status can be toggled per admin using the <Crown size={12} style={{ display: 'inline', verticalAlign: 'middle', color: 'var(--amber-text)' }} /> crown icon next to each admin's name in the table above.
              Multiple master admins are supported. Master admins can manage all roles and toggle master admin status for other admins.
            </div>
          </div>
        )}
      </div>

      <Modal open={schemaOpen} onClose={() => setSchemaOpen(false)} title="Edit column structure" width={680}>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>
          One column header per line. Order here is the order shown in the UI.
        </p>
        <textarea
          value={schemaDraft}
          onChange={e => setSchemaDraft(e.target.value)}
          style={{
            width: '100%',
            minHeight: 280,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface2)',
            color: 'var(--text)',
            padding: 10,
            fontSize: 13,
            lineHeight: 1.55,
            resize: 'vertical',
            fontFamily: 'var(--font-sans)',
            marginBottom: 12,
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn onClick={() => setSchemaOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={saveSchema}>Save Structure</Btn>
        </div>
      </Modal>

      {/* Create Cohort Modal */}
      <Modal open={createCohortOpen} onClose={() => { setCreateCohortOpen(false); setNewCohortId(''); setNewCohortCycle('summer') }} title="Create New Cohort" width={480}>
        <div style={{ display: 'grid', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>
            Select the graduating year, campus, and programme. Then set which placement cycle this cohort is currently in.
          </p>
          <CohortPicker value={newCohortId} onChange={setNewCohortId} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Current placement cycle</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[{ value: 'summer', label: 'Summer Internship (SIP)' }, { value: 'final', label: 'Final Placement' }].map(opt => (
                <button key={opt.value} onClick={() => setNewCohortCycle(opt.value)} style={{
                  flex: 1, padding: '8px 0', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-sans)',
                  border: `1px solid ${newCohortCycle === opt.value ? (opt.value === 'summer' ? 'var(--amber)' : 'var(--accent)') : 'var(--border)'}`,
                  background: newCohortCycle === opt.value ? (opt.value === 'summer' ? 'var(--amber-bg)' : 'var(--accent-bg)') : 'var(--surface)',
                  color: newCohortCycle === opt.value ? (opt.value === 'summer' ? 'var(--amber-text)' : 'var(--accent-dark)') : 'var(--text-2)',
                }}>{opt.label}</button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>You can change this later in the cohort list.</div>
          </div>
          {cohortMsg && (
            <div style={{ fontSize: 13, color: cohortMsg.startsWith('Error') ? 'var(--red-text)' : 'var(--green-text)' }}>
              {cohortMsg}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn onClick={() => { setCreateCohortOpen(false); setNewCohortId(''); setNewCohortCycle('summer') }}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreateCohort} disabled={cohortBusy || !newCohortId}>
              <Plus size={13} /> Create Cohort
            </Btn>
          </div>
        </div>
      </Modal>

    </div>
  )
}
