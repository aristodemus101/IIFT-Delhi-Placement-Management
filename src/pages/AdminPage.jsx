import React, { useState } from 'react'
import { useRoles } from '../lib/useRoles'
import { useAuth } from '../lib/AuthContext'
import { PageHeader, Btn, Badge, Spinner } from '../components/UI'
import { ShieldCheck, User, AlertTriangle } from 'lucide-react'

export default function AdminPage() {
  const { roles, loading, setRole, adminCount } = useRoles()
  const { user } = useAuth()
  const [busy, setBusy] = useState(null)

  const sorted = [...roles].sort((a, b) => {
    if (a.role === b.role) return (a.displayName || '').localeCompare(b.displayName || '')
    return a.role === 'admin' ? -1 : 1
  })

  const toggleRole = async (member) => {
    const newRole = member.role === 'admin' ? 'viewer' : 'admin'
    if (newRole === 'admin' && adminCount >= 3) {
      alert('Maximum 3 admins allowed. Demote an existing admin first.')
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
            <strong>Admin</strong> users can propose changes (place, delete, import) and approve proposals
            made by <em>other</em> admins. No admin can approve their own change.&nbsp;
            <strong>Viewer</strong> users have read-only access — they can view and download data but
            cannot modify anything. <strong>Maximum 3 admins.</strong>
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
                  {isSelf ? (
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
          Admin count: {adminCount}/3 · Members appear here automatically after their first login.
        </div>
      </div>
    </div>
  )
}
