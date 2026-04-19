import React, { useState, useMemo, useRef } from 'react'
import { useStudents } from '../lib/useStudents'
import { usePendingChanges } from '../lib/PendingChangesContext'
import { useAuth } from '../lib/AuthContext'
import { getVal, OUR_COLS } from '../lib/columns'
import { parseCSVFile, exportToCSV } from '../lib/csv'
import {
  PageHeader, Btn, Badge, CategoryBadge, Input, Select,
  Spinner, Modal, Table
} from '../components/UI'
import {
  Upload, Download, CheckCircle, Trash2, Eye, AlertTriangle, Search, Lock
} from 'lucide-react'

const NUMERIC = ['cat', 'wx', 'ugpct', 'x10pct', 'x12pct', 'age', 'cat_score']

export default function RosterPage() {
  const { students, loading } = useStudents()
  const { propose } = usePendingChanges()
  const { isAdmin } = useAuth()

  const [sortCol, setSortCol] = useState('cat')
  const [sortDir, setSortDir] = useState(-1)
  const [filters, setFilters] = useState({ name: '', catMin: '', wxMin: '', category: '', gender: '', pwdOnly: false })
  const [placeModal, setPlaceModal] = useState(null)
  const [placeCompany, setPlaceCompany] = useState('')
  const [viewModal, setViewModal] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const fileRef = useRef()

  const active = students.filter(s => !s._placed)

  const filtered = useMemo(() => {
    let rows = active.filter(s => {
      const name = getVal(s, 'name').toLowerCase()
      const roll = getVal(s, 'roll').toLowerCase()
      if (filters.name && !name.includes(filters.name.toLowerCase()) && !roll.includes(filters.name.toLowerCase())) return false
      if (filters.catMin && parseFloat(getVal(s, 'cat')) < parseFloat(filters.catMin)) return false
      if (filters.wxMin && parseFloat(getVal(s, 'wx')) < parseFloat(filters.wxMin)) return false
      if (filters.category && getVal(s, 'category') !== filters.category) return false
      if (filters.gender && getVal(s, 'gender') !== filters.gender) return false
      if (filters.pwdOnly && (getVal(s, 'pwd') || '').toLowerCase() !== 'yes') return false
      return true
    })
    rows.sort((a, b) => {
      let va = getVal(a, sortCol), vb = getVal(b, sortCol)
      if (NUMERIC.includes(sortCol)) { va = parseFloat(va) || 0; vb = parseFloat(vb) || 0 }
      return va > vb ? sortDir : va < vb ? -sortDir : 0
    })
    return rows
  }, [active, filters, sortCol, sortDir])

  const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }))
  const clearFilters = () => setFilters({ name: '', catMin: '', wxMin: '', category: '', gender: '', pwdOnly: false })
  const handleSort = col => {
    if (sortCol === col) setSortDir(d => -d)
    else { setSortCol(col); setSortDir(-1) }
  }

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000) }

  const handleImport = async e => {
    const file = e.target.files[0]; if (!file) return
    setImporting(true); setImportMsg('')
    try {
      const rows = await parseCSVFile(file)
      await propose({ type: 'import', rows, rowCount: rows.length })
      flash(`Import of ${rows.length} students proposed — awaiting approval from another admin.`)
    } catch (err) {
      setImportMsg('Import failed: ' + err.message)
    }
    setImporting(false)
    fileRef.current.value = ''
  }

  const proposePlace = async () => {
    if (!placeCompany.trim()) return
    setBusy(true)
    try {
      await propose({
        type: 'place',
        studentId: placeModal._id,
        studentName: getVal(placeModal, 'name'),
        studentRoll: getVal(placeModal, 'roll'),
        company: placeCompany.trim(),
      })
      flash(`Placement proposal for ${getVal(placeModal, 'name')} submitted — awaiting approval.`)
      setPlaceModal(null); setPlaceCompany('')
    } catch (e) { alert(e.message) }
    setBusy(false)
  }

  const proposeDelete = async (s) => {
    await propose({
      type: 'delete',
      studentId: s._id,
      studentName: getVal(s, 'name'),
      studentRoll: getVal(s, 'roll'),
    })
    flash(`Deletion of ${getVal(s, 'name')} proposed — awaiting approval.`)
  }

  const proposeClearAll = async () => {
    await propose({
      type: 'clearAll',
      studentIds: students.map(s => s._id),
      studentCount: students.length,
    })
    flash(`Clear-all proposed — awaiting approval from another admin.`)
    setConfirmClear(false)
  }

  const headers = [
    { label: 'Roll No.',  onClick: () => handleSort('roll'),     sorted: sortCol === 'roll' ? sortDir : 0 },
    { label: 'Name',      onClick: () => handleSort('name'),     sorted: sortCol === 'name' ? sortDir : 0 },
    { label: 'Gender',    onClick: () => handleSort('gender'),   sorted: sortCol === 'gender' ? sortDir : 0 },
    { label: 'CAT %ile',  onClick: () => handleSort('cat'),      sorted: sortCol === 'cat' ? sortDir : 0 },
    { label: 'Category',  onClick: () => handleSort('category'), sorted: sortCol === 'category' ? sortDir : 0 },
    { label: 'Work Ex',   onClick: () => handleSort('wx'),       sorted: sortCol === 'wx' ? sortDir : 0 },
    { label: 'UG Degree', onClick: () => handleSort('ug'),       sorted: sortCol === 'ug' ? sortDir : 0 },
    { label: 'UG %',      onClick: () => handleSort('ugpct'),    sorted: sortCol === 'ugpct' ? sortDir : 0 },
    { label: 'XII %',     onClick: () => handleSort('x12pct'),   sorted: sortCol === 'x12pct' ? sortDir : 0 },
    { label: 'X %',       onClick: () => handleSort('x10pct'),   sorted: sortCol === 'x10pct' ? sortDir : 0 },
    { label: 'Actions',   onClick: null },
  ]

  const rows = filtered.map(s => [
    <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{getVal(s, 'roll')}</span>,
    <span style={{ fontWeight: 500 }}>{getVal(s, 'name')}</span>,
    <span style={{ color: 'var(--text-2)' }}>{getVal(s, 'gender')}</span>,
    <strong style={{ fontSize: 13 }}>{parseFloat(getVal(s, 'cat')).toFixed(2) || '—'}</strong>,
    <CategoryBadge category={getVal(s, 'category')} />,
    <span>{getVal(s, 'wx') || '0'} mo</span>,
    <span style={{ fontSize: 12 }}>{getVal(s, 'ug')}</span>,
    <span>{parseFloat(getVal(s, 'ugpct')).toFixed(1) || '—'}%</span>,
    <span>{parseFloat(getVal(s, 'x12pct')).toFixed(1) || '—'}%</span>,
    <span>{parseFloat(getVal(s, 'x10pct')).toFixed(1) || '—'}%</span>,
    <div style={{ display: 'flex', gap: 6 }}>
      <Btn size="sm" variant="ghost" onClick={() => setViewModal(s)} title="View details"><Eye size={13} /></Btn>
      {isAdmin && (
        <>
          <Btn size="sm" variant="success" onClick={() => { setPlaceModal(s); setPlaceCompany('') }} title="Propose placement">
            <CheckCircle size={13} /> Place
          </Btn>
          <Btn size="sm" variant="ghost" onClick={() => proposeDelete(s)} title="Propose deletion">
            <Trash2 size={13} />
          </Btn>
        </>
      )}
    </div>
  ])

  if (loading) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Roster"
        subtitle={`${filtered.length} of ${active.length} available candidates`}
        actions={
          <>
            {isAdmin && (
              <Btn size="sm" variant="ghost" onClick={() => setConfirmClear(true)} style={{ color: 'var(--red-text)' }}>
                <Trash2 size={13} /> Clear All
              </Btn>
            )}
            <Btn size="sm" onClick={() => exportToCSV(filtered, 'filtered_roster.csv')}>
              <Download size={13} /> Export
            </Btn>
            {isAdmin && (
              <>
                <Btn size="sm" variant="primary" onClick={() => fileRef.current.click()} disabled={importing}>
                  <Upload size={13} /> {importing ? 'Importing…' : 'Import CSV'}
                </Btn>
                <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
              </>
            )}
          </>
        }
      />

      {/* Viewer notice */}
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

      {importMsg && (
        <div style={{ margin: '12px 28px 0', padding: '10px 14px', background: 'var(--red-bg)', color: 'var(--red-text)', border: '1px solid var(--red-border)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
          {importMsg}
        </div>
      )}

      {/* Filters */}
      <div style={{ padding: '14px 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <Input placeholder="Name or Roll No." value={filters.name} onChange={e => setF('name', e.target.value)} style={{ paddingLeft: 28, width: 200 }} />
        </div>
        <Input placeholder="CAT %ile ≥" type="number" value={filters.catMin} onChange={e => setF('catMin', e.target.value)} style={{ width: 110 }} />
        <Input placeholder="Work ex ≥ (mo)" type="number" value={filters.wxMin} onChange={e => setF('wxMin', e.target.value)} style={{ width: 130 }} />
        <Select value={filters.category} onChange={e => setF('category', e.target.value)}>
          <option value="">All categories</option>
          {['General', 'OBC - NCL', 'SC', 'ST', 'EWS'].map(c => <option key={c}>{c}</option>)}
        </Select>
        <Select value={filters.gender} onChange={e => setF('gender', e.target.value)}>
          <option value="">All genders</option>
          <option>Male</option><option>Female</option>
        </Select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--text-2)' }}>
          <input type="checkbox" checked={filters.pwdOnly} onChange={e => setF('pwdOnly', e.target.checked)} />
          PWD only
        </label>
        <Btn size="sm" variant="ghost" onClick={clearFilters}>Clear</Btn>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <Table headers={headers} rows={rows} emptyMessage={active.length ? 'No candidates match filters' : 'No candidates yet — import a CSV to get started'} />
      </div>

      {/* Propose Placement Modal */}
      <Modal open={!!placeModal} onClose={() => setPlaceModal(null)} title="Propose Placement">
        {placeModal && (
          <div>
            <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
              Proposing placement for <strong>{getVal(placeModal, 'name')}</strong>.
              A second admin will need to approve before the change is applied.
            </div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Company / Organisation</label>
            <Input
              value={placeCompany}
              onChange={e => setPlaceCompany(e.target.value)}
              placeholder="e.g. McKinsey & Company"
              style={{ width: '100%', marginBottom: 16 }}
              onKeyDown={e => e.key === 'Enter' && proposePlace()}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn onClick={() => setPlaceModal(null)}>Cancel</Btn>
              <Btn variant="success" onClick={proposePlace} disabled={!placeCompany.trim() || busy}>
                <CheckCircle size={14} /> Submit Proposal
              </Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* View Student Modal */}
      <Modal open={!!viewModal} onClose={() => setViewModal(null)} title={viewModal ? getVal(viewModal, 'name') : ''} width={640}>
        {viewModal && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
            {OUR_COLS.slice(0, 40).map(col => {
              const val = col.path(viewModal)
              if (!val || val === 'NA' || val === '0') return null
              return (
                <div key={col.key} style={{ paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{col.label}</div>
                  <div style={{ fontSize: 13 }}>{val}</div>
                </div>
              )
            })}
          </div>
        )}
      </Modal>

      {/* Confirm Clear All */}
      <Modal open={confirmClear} onClose={() => setConfirmClear(false)} title="Propose clearing all data?">
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20 }}>
          <AlertTriangle size={18} color="var(--amber)" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
            This will submit a proposal to delete all {students.length} students. A second admin must approve before anything is deleted.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn onClick={() => setConfirmClear(false)}>Cancel</Btn>
          <Btn variant="danger" onClick={proposeClearAll}>
            <Trash2 size={13} /> Submit Proposal
          </Btn>
        </div>
      </Modal>
    </div>
  )
}
