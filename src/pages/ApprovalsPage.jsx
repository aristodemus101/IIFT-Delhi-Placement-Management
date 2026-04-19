import React, { useState } from 'react'
import { usePendingChanges } from '../lib/PendingChangesContext'
import { useAuth } from '../lib/AuthContext'
import { PageHeader, Btn, Badge, Spinner, Modal } from '../components/UI'
import {
  CheckCircle, XCircle, Clock, CheckSquare, Trash2,
  Upload, RotateCcw, AlertTriangle, User
} from 'lucide-react'

const TYPE_META = {
  place:    { icon: CheckSquare, label: 'Mark Placed',   color: 'green'  },
  unplace:  { icon: RotateCcw,   label: 'Unplace',       color: 'amber'  },
  delete:   { icon: Trash2,      label: 'Delete Student', color: 'red'   },
  import:   { icon: Upload,      label: 'Import CSV',    color: 'blue'   },
  clearAll: { icon: AlertTriangle, label: 'Clear All',   color: 'red'    },
}

function changeDescription(c) {
  switch (c.type) {
    case 'place':    return `Place ${c.studentName} (${c.studentRoll}) → ${c.company}`
    case 'unplace':  return `Unplace ${c.studentName} (${c.studentRoll}) from ${c.currentCompany}`
    case 'delete':   return `Permanently delete ${c.studentName} (${c.studentRoll})`
    case 'import':   return `Import ${c.rowCount} student${c.rowCount !== 1 ? 's' : ''} from CSV`
    case 'clearAll': return `Delete all ${c.studentCount} students from database`
    default:         return c.type
  }
}

function fmtTime(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function ApprovalsPage() {
  const { changes, loading, approve, reject } = usePendingChanges()
  const { user } = useAuth()
  const [tab, setTab] = useState('pending')
  const [reviewing, setReviewing] = useState(null) // { change, action }
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const filtered = tab === 'all'
    ? changes
    : changes.filter(c => c.status === tab)

  const openReview = (change, action) => { setReviewing({ change, action }); setNote(''); setErr('') }

  const submitReview = async () => {
    if (!reviewing) return
    setBusy(true); setErr('')
    try {
      if (reviewing.action === 'approve') await approve(reviewing.change._id, note)
      else await reject(reviewing.change._id, note)
      setReviewing(null)
    } catch (e) {
      setErr(e.message)
    }
    setBusy(false)
  }

  const tabs = [
    { key: 'pending',  label: 'Pending',  count: changes.filter(c => c.status === 'pending').length },
    { key: 'approved', label: 'Approved', count: null },
    { key: 'rejected', label: 'Rejected', count: null },
    { key: 'all',      label: 'All',      count: null },
  ]

  if (loading) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Approvals"
        subtitle="Proposed changes that require a second admin to approve before being applied"
      />

      {/* Tabs */}
      <div style={{ padding: '0 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 4 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
            color: tab === t.key ? 'var(--text)' : 'var(--text-2)',
            borderBottom: tab === t.key ? '2px solid var(--text)' : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)',
          }}>
            {t.label}
            {t.count > 0 && (
              <span style={{ background: 'var(--text)', color: 'var(--surface)', borderRadius: 10, fontSize: 11, padding: '1px 6px', fontWeight: 600 }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-3)', fontSize: 14 }}>
            {tab === 'pending' ? 'No pending changes — everything is up to date.' : 'Nothing here yet.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(c => {
              const meta = TYPE_META[c.type] || {}
              const Icon = meta.icon || Clock
              const isOwn = c.proposedBy === user?.uid
              const isPending = c.status === 'pending'

              return (
                <div key={c._id} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', padding: '16px 20px',
                  borderLeft: `3px solid ${isPending ? 'var(--amber)' : c.status === 'approved' ? 'var(--green)' : 'var(--red-text)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                        background: 'var(--surface2)', border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={16} color={`var(--${meta.color === 'red' ? 'red-text' : meta.color === 'green' ? 'green-text' : meta.color === 'amber' ? 'amber-text' : 'accent-text'})`} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Badge color={meta.color}>{meta.label}</Badge>
                          {isOwn && isPending && <Badge color="gray">Your proposal</Badge>}
                          {!isPending && (
                            <Badge color={c.status === 'approved' ? 'green' : 'red'}>
                              {c.status === 'approved' ? '✓ Approved' : '✗ Rejected'}
                            </Badge>
                          )}
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 6px', color: 'var(--text)' }}>
                          {changeDescription(c)}
                        </p>
                        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-3)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <User size={11} /> Proposed by {c.proposedByName}
                          </span>
                          <span><Clock size={11} style={{ verticalAlign: 'middle' }} /> {fmtTime(c.proposedAt)}</span>
                          {!isPending && c.reviewedByName && (
                            <span>
                              {c.status === 'approved' ? '✓' : '✗'} Reviewed by {c.reviewedByName} · {fmtTime(c.reviewedAt)}
                            </span>
                          )}
                        </div>
                        {c.note && (
                          <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-2)', fontStyle: 'italic', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '6px 10px' }}>
                            "{c.note}"
                          </p>
                        )}
                      </div>
                    </div>

                    {isPending && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {isOwn ? (
                          <span style={{ fontSize: 12, color: 'var(--text-3)', padding: '6px 10px' }}>
                            Awaiting another admin
                          </span>
                        ) : (
                          <>
                            <Btn size="sm" variant="success" onClick={() => openReview(c, 'approve')}>
                              <CheckCircle size={13} /> Approve
                            </Btn>
                            <Btn size="sm" variant="danger" onClick={() => openReview(c, 'reject')}>
                              <XCircle size={13} /> Reject
                            </Btn>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Review Modal */}
      <Modal
        open={!!reviewing}
        onClose={() => setReviewing(null)}
        title={reviewing?.action === 'approve' ? 'Approve Change' : 'Reject Change'}
      >
        {reviewing && (
          <div>
            <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 16, fontSize: 13 }}>
              <strong>{changeDescription(reviewing.change)}</strong>
              <div style={{ color: 'var(--text-2)', marginTop: 4, fontSize: 12 }}>
                Proposed by {reviewing.change.proposedByName}
              </div>
            </div>

            {reviewing.action === 'approve' && reviewing.change.type === 'clearAll' && (
              <div style={{ display: 'flex', gap: 8, background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 16 }}>
                <AlertTriangle size={15} color="var(--red-text)" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 13, color: 'var(--red-text)' }}>
                  This will permanently delete {reviewing.change.studentCount} students. This cannot be undone.
                </p>
              </div>
            )}

            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
              Note <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={reviewing.action === 'reject' ? 'Reason for rejection…' : 'Any notes…'}
              rows={3}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', background: 'var(--surface)',
                color: 'var(--text)', fontSize: 13, resize: 'vertical',
                fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
              }}
            />

            {err && (
              <p style={{ marginTop: 10, fontSize: 13, color: 'var(--red-text)' }}>{err}</p>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <Btn onClick={() => setReviewing(null)} disabled={busy}>Cancel</Btn>
              <Btn
                variant={reviewing.action === 'approve' ? 'success' : 'danger'}
                onClick={submitReview}
                disabled={busy}
              >
                {busy ? 'Processing…' : reviewing.action === 'approve' ? <><CheckCircle size={13} /> Confirm Approval</> : <><XCircle size={13} /> Confirm Rejection</>}
              </Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
