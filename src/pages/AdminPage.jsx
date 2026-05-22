import React, { useState, useEffect } from 'react'
import { useRoles } from '../lib/useRoles'
import { useAuth } from '../lib/AuthContext'
import { useStudents, useColumnSchema } from '../lib/useStudents'
import { useSheetsSync } from '../lib/SheetsSyncContext'
import { useBatch } from '../lib/BatchContext'
import { usePendingChanges } from '../lib/PendingChangesContext'
import { cohortLabel, cohortYear, parseCohortId } from '../lib/batch'
import { OUR_COLS } from '../lib/columns'
import { PageHeader, Btn, Badge, Spinner, Modal, Input } from '../components/UI'
import CohortPicker from '../components/CohortPicker'
import { ROLES, ROLE_LABELS, CONFIGURABLE_FIELDS } from '../lib/permissions'
import {
  ShieldCheck, User, AlertTriangle, Sheet, RefreshCw, ExternalLink, CheckCircle,
  Database, Columns3, Plus, Archive, Crown
} from 'lucide-react'
import {
  collection, doc, setDoc, updateDoc, addDoc, getDoc, serverTimestamp, writeBatch as writeBatchFn
} from 'firebase/firestore'
import { db } from '../lib/firebase'

// Helper to derive cohort from a student doc
function studentCohort(s) {
  return s.cohort || 'unknown'
}

export default function AdminPage() {
  const { roles, loading, setRole, adminCount, adminUsers } = useRoles()
  const { user, isMasterAdmin, isAdmin } = useAuth()
  const { students } = useStudents()
  const { selectedCohort, batches, activeBatches, archivedBatches, selectedSeason } = useBatch()
  const { schemaHeaders, setSchemaHeaders } = useColumnSchema(selectedCohort || 'default')
  const { connected, sheetUrl, lastSync, syncing, authorize, syncNow } = useSheetsSync()
  const [busy, setBusy] = useState(null)
  const [syncMsg, setSyncMsg] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authErr, setAuthErr] = useState('')
  const [schemaOpen, setSchemaOpen] = useState(false)
  const [schemaDraft, setSchemaDraft] = useState('')
  const [schemaMsg, setSchemaMsg] = useState('')

  // Cohort management state
  const [createCohortOpen, setCreateCohortOpen] = useState(false)
  const [newCohortId, setNewCohortId] = useState('')
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

  // Master admin transfer state
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferTarget, setTransferTarget] = useState('')
  const [transferBusy, setTransferBusy] = useState(false)
  const [transferMsg, setTransferMsg] = useState('')

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
    if (newRole === 'admin' && adminCount >= 4) {
      alert('Maximum 4 admins allowed (1 master + 3 regular). Demote an existing admin first.')
      return
    }
    if (member.role === 'admin' && newRole !== 'admin' && adminCount <= 1) {
      alert('At least one admin must remain.')
      return
    }
    setBusy(member.uid)
    try { await setRole(member.uid, newRole) } catch (e) { alert(e.message) }
    setBusy(null)
  }

  const openSchemaEditor = () => {
    const base = (schemaHeaders && schemaHeaders.length ? schemaHeaders : OUR_COLS.map(c => c.label)).join('\n')
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
        season: selectedSeason,
        status: 'active',
        createdAt: serverTimestamp(),
        createdBy: { uid: user.uid, name: user.displayName },
      }, { merge: true })
      setCohortMsg(`Cohort "${cohortLabel(newCohortId)}" created.`)
      setCreateCohortOpen(false)
      setNewCohortId('')
      setTimeout(() => setCohortMsg(''), 4000)
    } catch (e) {
      setCohortMsg('Error: ' + e.message)
    }
    setCohortBusy(false)
  }

  const handleArchiveCohort = async (cohortId) => {
    if (!window.confirm(`Archive cohort "${cohortLabel(cohortId)}"? It will be hidden from the cohort switcher.`)) return
    setCohortBusy(true)
    try {
      await updateDoc(doc(db, 'batches', cohortId), { status: 'archived', archivedAt: serverTimestamp() })
      setCohortMsg(`Cohort "${cohortLabel(cohortId)}" archived.`)
      setTimeout(() => setCohortMsg(''), 4000)
    } catch (e) {
      setCohortMsg('Error: ' + e.message)
    }
    setCohortBusy(false)
  }

  const handleTransferMasterAdmin = async () => {
    if (!transferTarget) return
    const target = roles.find(r => r.uid === transferTarget)
    if (!target) return
    if (!window.confirm(`Transfer Master Admin to ${target.displayName || target.email}?\n\nYou will immediately lose master admin privileges. This cannot be undone without database access.`)) return

    setTransferBusy(true); setTransferMsg('')
    try {
      const wb = writeBatchFn(db)
      wb.update(doc(db, 'roles', user.uid), { isMasterAdmin: false })
      wb.update(doc(db, 'roles', transferTarget), { isMasterAdmin: true, role: 'admin' })
      await wb.commit()
      await addDoc(collection(db, 'auditLog'), {
        type: 'master_admin_transfer',
        fromUid: user.uid,
        fromName: user.displayName,
        toUid: transferTarget,
        toName: target.displayName || target.email,
        transferredAt: serverTimestamp(),
      })
      setTransferMsg('Master admin transferred successfully.')
      setTransferOpen(false)
    } catch (e) {
      setTransferMsg('Error: ' + e.message)
    }
    setTransferBusy(false)
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
            Maximum <strong>1 master + 3 regular admins</strong>.
          </div>
        </div>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
            display: 'grid', gridTemplateColumns: '1fr 180px 120px 100px',
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
            return (
              <div key={m.uid} style={{
                display: 'grid', gridTemplateColumns: '1fr 180px 120px 100px',
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
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{m.displayName || '(no name)'}</div>
                    {isSelf && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>You</div>}
                    {m.isMasterAdmin && <div style={{ fontSize: 11, color: 'var(--amber-text)' }}>Master Admin</div>}
                  </div>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.email}
                </div>

                <div>
                  <Badge color={m.role === 'admin' ? 'blue' : m.role === 'committee' ? 'amber' : 'gray'}>
                    {m.role === 'admin' ? <><ShieldCheck size={10} /> Admin</>
                     : m.role === 'committee' ? <><User size={10} /> Committee</>
                     : <><User size={10} /> Viewer</>}
                  </Badge>
                </div>

                <div>
                  {isSelf || !isMasterAdmin ? (
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>—</span>
                  ) : (
                    <select
                      value={m.role || 'viewer'}
                      disabled={busy === m.uid}
                      onChange={e => changeRole(m, e.target.value)}
                      style={{
                        height: 28, padding: '0 8px', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)', background: 'var(--surface)',
                        color: 'var(--text)', fontSize: 12, cursor: 'pointer',
                      }}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
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
          Admin count: {adminCount}/4 (1 master + 3 regular) · Members appear here automatically after their first login.
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
                display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px',
                fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                <span>Cohort</span>
                <span>Status</span>
                <span>Students</span>
                <span></span>
              </div>

              {[...activeBatches, ...archivedBatches].map((b, i) => {
                const count = studentCountForCohort(b.id)
                const isActive = b.status === 'active'
                const allBatches = [...activeBatches, ...archivedBatches]
                return (
                  <div key={b.id} style={{
                    display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px',
                    padding: '12px 16px', alignItems: 'center',
                    borderBottom: i < allBatches.length - 1 ? '1px solid var(--border)' : 'none',
                    opacity: isActive ? 1 : 0.6,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{b.label || cohortLabel(b.id)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{b.id} · Year {b.year || cohortYear(b.id)}</div>
                    </div>
                    <div>
                      <Badge color={isActive ? 'blue' : 'gray'}>
                        {isActive ? 'Active' : 'Archived'}
                      </Badge>
                    </div>
                    <div style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{count}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {isAdmin && isActive && (
                        <Btn size="sm" variant="ghost" onClick={() => handleArchiveCohort(b.id)} disabled={cohortBusy}>
                          <Archive size={12} />
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
              Active columns: <strong>{(schemaHeaders && schemaHeaders.length) || OUR_COLS.length}</strong>
            </div>
            {schemaMsg && <div style={{ fontSize: 13, color: 'var(--green-text)', marginBottom: 8 }}>{schemaMsg}</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn size="sm" onClick={openSchemaEditor}>Edit Column Structure</Btn>
              <Btn
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await setSchemaHeaders(OUR_COLS.map(c => c.label), user)
                  setSchemaMsg('Reset to canonical column structure.')
                  setTimeout(() => setSchemaMsg(''), 4000)
                }}
              >
                Reset to Canonical
              </Btn>
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

        {/* ── Master Admin Transfer ────────────────────────────────────── */}
        {isMasterAdmin && (
          <div style={{ marginTop: 32, marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Master Admin Transfer</h2>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
              Transfer your master admin privileges to another admin. This is immediate and cannot be undone without database access.
            </p>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 10, color: 'var(--amber-text)' }}>
                <Crown size={14} />
                Current master admin: <strong>{user?.displayName}</strong>
              </div>
              {transferMsg && (
                <div style={{ fontSize: 13, color: transferMsg.startsWith('Error') ? 'var(--red-text)' : 'var(--green-text)', marginBottom: 10 }}>
                  {transferMsg}
                </div>
              )}
              <Btn variant="ghost" onClick={() => { setTransferTarget(''); setTransferOpen(true) }}>
                Transfer Master Admin…
              </Btn>
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
      <Modal open={createCohortOpen} onClose={() => { setCreateCohortOpen(false); setNewCohortId('') }} title="Create New Cohort" width={480}>
        <div style={{ display: 'grid', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>
            Select the graduating year, campus, and programme. Campuses that don't offer a programme are shown as disabled.
          </p>
          <CohortPicker value={newCohortId} onChange={setNewCohortId} />
          {cohortMsg && (
            <div style={{ fontSize: 13, color: cohortMsg.startsWith('Error') ? 'var(--red-text)' : 'var(--green-text)' }}>
              {cohortMsg}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn onClick={() => { setCreateCohortOpen(false); setNewCohortId('') }}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreateCohort} disabled={cohortBusy || !newCohortId}>
              <Plus size={13} /> Create Cohort
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Master Admin Transfer Modal */}
      <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title="Transfer Master Admin" width={480}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', gap: 10, background: 'var(--amber-bg)', border: '1px solid var(--amber)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', fontSize: 13, color: 'var(--amber-text)' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              This is immediate and cannot be undone from the UI. Only transfer to someone you trust completely.
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Transfer to admin</label>
            <select
              value={transferTarget}
              onChange={e => setTransferTarget(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 13,
                fontFamily: 'var(--font-sans)',
              }}
            >
              <option value="">Select an admin…</option>
              {adminUsers.filter(a => a.uid !== user?.uid).map(a => (
                <option key={a.uid} value={a.uid}>{a.displayName || a.email}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn onClick={() => setTransferOpen(false)}>Cancel</Btn>
            <Btn variant="danger" onClick={handleTransferMasterAdmin} disabled={!transferTarget || transferBusy}>
              <Crown size={13} /> Transfer Master Admin
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
