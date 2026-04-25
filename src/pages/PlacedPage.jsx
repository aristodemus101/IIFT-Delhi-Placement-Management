import React, { useState, useMemo } from 'react'
import { useStudents } from '../lib/useStudents'
import { usePendingChanges } from '../lib/PendingChangesContext'
import { useAuth } from '../lib/AuthContext'
import { useBatch } from '../lib/BatchContext'
import { batchLabel, normalizeBatch } from '../lib/batch'
import { getVal } from '../lib/columns'
import { exportToCSV } from '../lib/csv'
import { PageHeader, Btn, Badge, CategoryBadge, Input, Spinner, Table, Modal } from '../components/UI'
import { Download, RotateCcw, Search, Eye, CheckCircle, Lock } from 'lucide-react'

export default function PlacedPage() {
  const { students, loading } = useStudents()
  const { propose } = usePendingChanges()
  const { isAdmin } = useAuth()
  const { selectedBatch } = useBatch()
  const [search, setSearch] = useState('')
  const [viewModal, setViewModal] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')

  const placed = students.filter(s => normalizeBatch(s._batch) === selectedBatch && s._placed)

  const filtered = useMemo(() => {
    if (!search) return placed
    const q = search.toLowerCase()
    return placed.filter(s =>
      getVal(s, 'name').toLowerCase().includes(q) ||
      getVal(s, 'roll').toLowerCase().includes(q) ||
      (s._placedCompany || '').toLowerCase().includes(q)
    )
  }, [placed, search])

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000) }

  const proposeUnplace = async (s) => {
    await propose({
      type: 'unplace',
      batch: selectedBatch,
      studentId: s._id,
      studentName: getVal(s, 'name'),
      studentRoll: getVal(s, 'roll'),
      currentCompany: s._placedCompany,
    })
    flash(`Unplace proposal for ${getVal(s, 'name')} submitted — awaiting approval.`)
  }

  const headers = [
    { label: 'Roll No.' },
    { label: 'Name' },
    { label: 'Gender' },
    { label: 'CAT %ile' },
    { label: 'Category' },
    { label: 'Work Ex' },
    { label: 'Company' },
    { label: 'Placed On' },
    { label: 'Actions' },
  ]

  const rows = filtered.map(s => [
    <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{getVal(s, 'roll')}</span>,
    <span style={{ fontWeight: 500 }}>{getVal(s, 'name')}</span>,
    <span style={{ color: 'var(--text-2)' }}>{getVal(s, 'gender')}</span>,
    <strong>{parseFloat(getVal(s, 'cat')).toFixed(2) || '—'}</strong>,
    <CategoryBadge category={getVal(s, 'category')} />,
    <span>{getVal(s, 'wx') || '0'} mo</span>,
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 12, background: 'var(--green-bg)', color: 'var(--green-text)', border: '1px solid var(--green-border)', fontWeight: 500 }}>
      {s._placedCompany || '—'}
    </span>,
    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
      {s._placedAt ? new Date(s._placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
    </span>,
    <div style={{ display: 'flex', gap: 6 }}>
      <Btn size="sm" variant="ghost" onClick={() => setViewModal(s)}><Eye size={13} /></Btn>
      {isAdmin && (
        <Btn size="sm" variant="ghost" onClick={() => proposeUnplace(s)} title="Propose unplace">
          <RotateCcw size={13} /> Unplace
        </Btn>
      )}
    </div>
  ])

  if (loading) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Placed Students"
        subtitle={`${batchLabel(selectedBatch)} · ${placed.length} student${placed.length !== 1 ? 's' : ''} placed so far`}
        actions={
          <>
            <Badge color={selectedBatch === 'summer' ? 'amber' : 'blue'}>{selectedBatch === 'summer' ? 'Summer Batch' : 'Final Batch'}</Badge>
            <Btn size="sm" onClick={() => exportToCSV(filtered, 'placed_students.csv')} disabled={!filtered.length} title={!filtered.length ? 'No placed records to export' : 'Export placed students'}>
              <Download size={13} /> Export Placed Sheet
            </Btn>
          </>
        }
      />

      {!isAdmin && (
        <div style={{ margin: '12px 28px 0', padding: '9px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-2)' }}>
          <Lock size={13} /> You have read-only access. Contact an admin to make changes.
        </div>
      )}

      {successMsg && (
        <div style={{ margin: '12px 28px 0', padding: '10px 14px', background: 'var(--green-bg)', color: 'var(--green-text)', border: '1px solid var(--green-border)', borderRadius: 'var(--radius-sm)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
          <CheckCircle size={14} /> {successMsg}
        </div>
      )}

      <div style={{ padding: '14px 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 10 }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <Input placeholder="Name, Roll No., or Company" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 28, width: 260 }} />
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <Table headers={headers} rows={rows} emptyMessage={placed.length ? 'No matches' : 'No placements recorded yet'} />
      </div>

      <Modal open={!!viewModal} onClose={() => setViewModal(null)} title={viewModal ? `${getVal(viewModal, 'name')} — ${viewModal._placedCompany}` : ''} width={480}>
        {viewModal && (
          <div style={{ display: 'grid', gap: 12 }}>
            {[
              ['Roll No.', getVal(viewModal, 'roll')],
              ['CAT Percentile', getVal(viewModal, 'cat')],
              ['Category', getVal(viewModal, 'category')],
              ['Work Experience', `${getVal(viewModal, 'wx')} months`],
              ['UG Degree', `${getVal(viewModal, 'ug')} — ${getVal(viewModal, 'ugpct')}%`],
              ['Class X', `${getVal(viewModal, 'x10pct')}%`],
              ['Class XII', `${getVal(viewModal, 'x12pct')}%`],
              ['Placed At', viewModal._placedCompany],
              ['Placed On', viewModal._placedAt ? new Date(viewModal._placedAt).toLocaleDateString('en-IN') : '—'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-2)' }}>{k}</span>
                <span style={{ fontWeight: 500 }}>{v || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
