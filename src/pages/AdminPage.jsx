import React, { useState } from 'react'
import { useRoles } from '../lib/useRoles'
import { useAuth } from '../lib/AuthContext'
import { useStudents, useColumnSchema } from '../lib/useStudents'
import { useSheetsSync } from '../lib/SheetsSyncContext'
import { useBatch } from '../lib/BatchContext'
import { batchLabel } from '../lib/batch'
import { OUR_COLS } from '../lib/columns'
import { PageHeader, Btn, Badge, Spinner, Modal } from '../components/UI'
import { ShieldCheck, User, AlertTriangle, Sheet, RefreshCw, ExternalLink, CheckCircle, Database, Columns3 } from 'lucide-react'

export default function AdminPage() {
  const { roles, loading, setRole, adminCount } = useRoles()
  const { user, isMasterAdmin } = useAuth()
  const { students } = useStudents()
  const { selectedBatch } = useBatch()
  const { schemaHeaders, setSchemaHeaders } = useColumnSchema(selectedBatch)
  const { connected, sheetUrl, lastSync, syncing, authorize, syncNow } = useSheetsSync()
  const [busy, setBusy] = useState(null)
  const [syncMsg, setSyncMsg] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authErr, setAuthErr] = useState('')
  const [schemaOpen, setSchemaOpen] = useState(false)
  const [schemaDraft, setSchemaDraft] = useState('')
  const [schemaMsg, setSchemaMsg] = useState('')

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

  const toggleRole = async (member) => {
    const newRole = member.role === 'admin' ? 'viewer' : 'admin'
    if (newRole === 'admin' && adminCount >= 4) {
      alert('Maximum 4 admins allowed (1 master + 3 regular). Demote an existing admin first.')
      return
    }
    if (newRole === 'viewer' && adminCount <= 1) {
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

  if (loading) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Team Access"
        subtitle="Manage who has admin (edit + approve) vs viewer (read-only) access"
      />

      <div style={{ padding: '20px 28px' }}>
        {/* Info banner */}
        <div style={{
          display: 'flex', gap: 10, background: 'var(--accent-bg)', border: '1px solid #BFDBFE',
          borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 20,
        }}>
          <ShieldCheck size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: 'var(--accent-text)', lineHeight: 1.6 }}>
            <strong>Master Admin</strong> (you) can manage roles and connect Google Sheets backup.&nbsp;
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
                  </div>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.email}
                </div>

                <div>
                  <Badge color={m.role === 'admin' ? 'blue' : 'gray'}>
                    {m.role === 'admin' ? <><ShieldCheck size={10} /> Admin</> : <><User size={10} /> Viewer</>}
                  </Badge>
                </div>

                <div>
                  {isSelf || !isMasterAdmin ? (
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>—</span>
                  ) : (
                    <Btn
                      size="sm"
                      variant={m.role === 'admin' ? 'ghost' : 'default'}
                      disabled={busy === m.uid}
                      onClick={() => toggleRole(m)}
                    >
                      {busy === m.uid ? '…' : m.role === 'admin' ? 'Make Viewer' : 'Make Admin'}
                    </Btn>
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

        <div style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Column Structure</h2>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
            Control visible headers for roster UI and imports for <strong>{batchLabel(selectedBatch)}</strong>. You can add, remove, rename, and reorder columns.
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
    </div>
  )
}
