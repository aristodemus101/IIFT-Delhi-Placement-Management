import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useStudents } from '../lib/useStudents'
import { usePendingChanges } from '../lib/PendingChangesContext'
import { useAuth } from '../lib/AuthContext'
import { useBatch } from '../lib/BatchContext'
import { cohortLabel, seasonLabel } from '../lib/batch'
import { getVal } from '../lib/columns'
import { exportToCSV } from '../lib/csv'
import { usePermissions } from '../lib/usePermissions'
import { PageHeader, Btn, Badge, CategoryBadge, Input, Spinner, Table, Modal } from '../components/UI'
import { Download, RotateCcw, Search, Eye, CheckCircle, Lock } from 'lucide-react'

// Helper to derive cohort from a student doc
function studentCohort(s) {
  return s.cohort || 'unknown'
}

export default function PlacedPage() {
  const { students, loading } = useStudents()
  const { propose } = usePendingChanges()
  const { isAdmin } = useAuth()
  const { scopedCohorts, selectedCohort, selectedCohortCycle, setLastSeason, batchesLoading } = useBatch()
  const [selectedSeason, setSelectedSeasonLocal] = useState(selectedCohortCycle)

  const prevCycleRef = useRef(selectedCohortCycle)
  useEffect(() => {
    if (prevCycleRef.current !== selectedCohortCycle) {
      setSelectedSeasonLocal(selectedCohortCycle)
      prevCycleRef.current = selectedCohortCycle
    }
  }, [selectedCohortCycle])

  const setSelectedSeason = (s) => {
    setSelectedSeasonLocal(s)
    setLastSeason(s)
  }
  const { fieldVisible, canDo } = usePermissions()
  const [search, setSearch] = useState('')
  const [viewModal, setViewModal] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')

  // Filter by cohort, then by season's placed flag
  const placed = useMemo(() => {
    const ids = new Set(scopedCohorts)
    return students.filter(s => {
      if (!ids.has(studentCohort(s))) return false
      if (selectedSeason === 'summer') return s._placed_summer === true
      return s._placed_final === true
    })
  }, [students, scopedCohorts, selectedSeason])

  // Get the right placement object for the selected season
  const getPlacement = (s) => {
    if (selectedSeason === 'summer') return s._placement_summer || {}
    return s._placement_final || {}
  }

  const getPlacedCompany = (s) => getPlacement(s).company || '—'
  const getPlacedAt = (s) => getPlacement(s).placedAtIso || null

  const filtered = useMemo(() => {
    if (!search) return placed
    const q = search.toLowerCase()
    return placed.filter(s =>
      getVal(s, 'name').toLowerCase().includes(q) ||
      getVal(s, 'roll').toLowerCase().includes(q) ||
      (getPlacedCompany(s) || '').toLowerCase().includes(q)
    )
  }, [placed, search, selectedSeason])

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000) }

  const proposeUnplace = async (s) => {
    await propose({
      type: 'unplace',
      cohort: studentCohort(s),  // derived from the student's own doc
      season: selectedSeason,
      studentId: s._id,
      studentName: getVal(s, 'name'),
      studentRoll: getVal(s, 'roll'),
      currentCompany: getPlacedCompany(s),
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
    ...(fieldVisible('ctc') || fieldVisible('stipend') ? [{ label: selectedSeason === 'summer' ? 'Stipend' : 'CTC' }] : []),
    { label: 'Placed On' },
    { label: 'Actions' },
  ]

  const placementKey = selectedSeason === 'summer' ? '_placement_summer' : '_placement_final'
  const canSeePlacement = fieldVisible(placementKey)
  const canSeeCtc = fieldVisible('ctc')
  const canSeeStipend = fieldVisible('stipend')

  const rows = filtered.map(s => {
    const company = canSeePlacement ? getPlacedCompany(s) : '—'
    const placedAt = getPlacedAt(s)
    const placement = getPlacement(s)
    return [
      <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{getVal(s, 'roll')}</span>,
      <span style={{ fontWeight: 500 }}>{getVal(s, 'name')}</span>,
      <span style={{ color: 'var(--text-2)' }}>{getVal(s, 'gender')}</span>,
      <strong>{parseFloat(getVal(s, 'cat')).toFixed(2) || '—'}</strong>,
      <CategoryBadge category={getVal(s, 'category')} />,
      <span>{getVal(s, 'wx') || '0'} mo</span>,
      canSeePlacement ? (
        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 12, background: selectedSeason === 'summer' ? 'var(--amber-bg)' : 'var(--green-bg)', color: selectedSeason === 'summer' ? 'var(--amber-text)' : 'var(--green-text)', border: `1px solid ${selectedSeason === 'summer' ? 'var(--amber)' : 'var(--green-border)'}`, fontWeight: 500 }}>
          {company}
        </span>
      ) : <span style={{ color: 'var(--text-3)', fontSize: 12 }}>Hidden</span>,
      canSeeCtc || canSeeStipend ? (
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
          {selectedSeason === 'summer'
            ? (canSeeStipend ? placement.stipend || '—' : '—')
            : (canSeeCtc ? placement.ctc || '—' : '—')
          }
        </span>
      ) : null,
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
        {placedAt ? new Date(placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
      </span>,
      <div style={{ display: 'flex', gap: 6 }}>
        {canSeePlacement && <Btn size="sm" variant="ghost" onClick={() => setViewModal(s)}><Eye size={13} /></Btn>}
        {canDo('proposeUnplace') && (
          <Btn size="sm" variant="ghost" onClick={() => proposeUnplace(s)} title="Propose unplace">
            <RotateCcw size={13} /> Unplace
          </Btn>
        )}
      </div>
    ].filter(cell => cell !== null)
  })

  if (loading || batchesLoading) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Placed Students"
        subtitle={`${scopedCohorts.length === 1 ? cohortLabel(scopedCohorts[0]) : `${scopedCohorts.length} cohorts`} · ${seasonLabel(selectedSeason)} · ${placed.length} student${placed.length !== 1 ? 's' : ''} placed`}
        actions={
          <>
            <Btn size="sm" onClick={() => exportToCSV(filtered, 'placed_students.csv')} disabled={!filtered.length} title={!filtered.length ? 'No placed records to export' : 'Export placed students'}>
              <Download size={13} /> Export Placed Sheet
            </Btn>
          </>
        }
      />

      {/* Season tabs */}
      <div style={{ padding: '0 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 4 }}>
        {['summer', 'final'].map(s => (
          <button key={s} onClick={() => setSelectedSeason(s)} style={{
            padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: selectedSeason === s ? 600 : 400,
            color: selectedSeason === s ? (s === 'summer' ? 'var(--amber-text)' : 'var(--accent-dark)') : 'var(--text-2)',
            borderBottom: selectedSeason === s ? `2px solid ${s === 'summer' ? 'var(--amber)' : 'var(--accent)'}` : '2px solid transparent',
            fontFamily: 'var(--font-sans)',
          }}>
            {s === 'summer' ? 'Summer Internship' : 'Final Placement'}
            <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, opacity: 0.7 }}>
              ({(() => { const ids = new Set(scopedCohorts); return students.filter(st => ids.has(studentCohort(st)) && (s === 'summer' ? st._placed_summer : st._placed_final)).length })()} )
            </span>
          </button>
        ))}
      </div>

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
        <Table headers={headers} rows={rows} emptyMessage={placed.length ? 'No matches' : `No ${seasonLabel(selectedSeason).toLowerCase()} placements recorded yet`} />
      </div>

      <Modal open={!!viewModal} onClose={() => setViewModal(null)} title={viewModal ? `${getVal(viewModal, 'name')} — ${getPlacedCompany(viewModal)}` : ''} width={480}>
        {viewModal && (() => {
          const pl = getPlacement(viewModal)
          return (
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                ['Roll No.', getVal(viewModal, 'roll')],
                ['CAT Percentile', getVal(viewModal, 'cat')],
                ['Category', getVal(viewModal, 'category')],
                ['Work Experience', `${getVal(viewModal, 'wx')} months`],
                ['UG Degree', `${getVal(viewModal, 'ug')} — ${getVal(viewModal, 'ugpct')}%`],
                ['Class X', `${getVal(viewModal, 'x10pct')}%`],
                ['Class XII', `${getVal(viewModal, 'x12pct')}%`],
                ['Season', seasonLabel(selectedSeason)],
                ['Company', pl.company || '—'],
                ['Role', pl.role || '—'],
                ['Package', pl.package || '—'],
                ['Placed On', pl.placedAtIso ? new Date(pl.placedAtIso).toLocaleDateString('en-IN') : '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-2)' }}>{k}</span>
                  <span style={{ fontWeight: 500 }}>{v || '—'}</span>
                </div>
              ))}
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
