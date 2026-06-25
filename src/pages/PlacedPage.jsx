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
import { Download, RotateCcw, Search, Eye, CheckCircle, Lock, ExternalLink, BarChart2 } from 'lucide-react'

const PLACEMENT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1uOzTID4iVhwjXuKynSICQmFDygYoQJC1N_q6QlumF68/edit'

function studentCohort(s) {
  return s.cohort || 'unknown'
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', padding: '12px 16px', minWidth: 130,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--text)', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
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

  const scopedStudents = useMemo(() => {
    const ids = new Set(scopedCohorts)
    return students.filter(s => ids.has(studentCohort(s)))
  }, [students, scopedCohorts])

  const totalInCohort = scopedStudents.length

  // Which cycles actually have placed students in this cohort
  const hasSummerData = useMemo(() => scopedStudents.some(s => s._placed_summer === true), [scopedStudents])
  const hasFinalData  = useMemo(() => scopedStudents.some(s => s._placed_final  === true), [scopedStudents])
  const availableCycles = useMemo(() => {
    const cycles = []
    if (hasSummerData) cycles.push('summer')
    if (hasFinalData)  cycles.push('final')
    // Always show at least the cohort's active cycle so you can record new placements
    if (!cycles.includes(selectedCohortCycle)) cycles.push(selectedCohortCycle)
    return cycles
  }, [hasSummerData, hasFinalData, selectedCohortCycle])

  // Auto-correct selectedSeason if it's not available for this cohort
  useEffect(() => {
    if (availableCycles.length > 0 && !availableCycles.includes(selectedSeason)) {
      setSelectedSeasonLocal(availableCycles[availableCycles.length - 1])
    }
  }, [availableCycles, selectedSeason])

  const placed = useMemo(() => {
    return scopedStudents.filter(s => {
      if (selectedSeason === 'summer') return s._placed_summer === true
      return s._placed_final === true
    })
  }, [scopedStudents, selectedSeason])

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

  // Stats computed from all placed (not just filtered)
  const stats = useMemo(() => {
    const placements = placed.map(s => getPlacement(s))
    const withPackage = placements.filter(p => p.package && /[\d]/.test(p.package))

    const isSummer = selectedSeason === 'summer'

    // Summer: stored as rupees/month (e.g. "60,000") → display as ₹/mo
    // Finals: stored as absolute rupees (e.g. "3250000") OR already LPA (e.g. "32.5")
    //         if value > 1000 → divide by 100000 to get LPA; otherwise treat as LPA directly
    const parsePackage = (pkg) => {
      const cleaned = String(pkg).replace(/,/g, '')
      const m = cleaned.match(/[\d.]+/)
      if (!m) return null
      const val = parseFloat(m[0])
      if (!isSummer && val > 1000) return parseFloat((val / 100000).toFixed(2))
      return val
    }

    const rawValues = withPackage.map(p => parsePackage(p.package)).filter(v => v !== null && v > 0)
    const avgRaw = rawValues.length ? rawValues.reduce((a, b) => a + b, 0) / rawValues.length : null
    const maxRaw = rawValues.length ? Math.max(...rawValues) : null

    const fmtVal = (v) => {
      if (v === null) return null
      if (isSummer) return `₹${Math.round(v).toLocaleString('en-IN')}/mo`
      return `${v.toFixed(1)} LPA`
    }

    const avgCtc = fmtVal(avgRaw)
    const maxCtc = fmtVal(maxRaw)

    const sectorCounts = {}
    placements.forEach(p => { if (p.sector) sectorCounts[p.sector] = (sectorCounts[p.sector] || 0) + 1 })
    const topSector = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])[0]

    const international = placements.filter(p => p.location === 'International').length
    const placementPct = totalInCohort ? Math.round((placed.length / totalInCohort) * 100) : 0

    return { avgCtc, maxCtc, topSector, international, placementPct }
  }, [placed, selectedSeason, totalInCohort])

  // Flat rows: all student fields + placement details merged together
  const exportRows = useMemo(() => filtered.map(s => {
    const pl = getPlacement(s)
    // Collect all student fields (skip internal _ fields)
    const studentFields = {}
    Object.entries(s).forEach(([k, v]) => {
      if (!k.startsWith('_') && k !== 'cohort') studentFields[k] = v
    })
    return {
      ...studentFields,
      cohort: studentCohort(s),
      placement_season: seasonLabel(selectedSeason),
      placement_company: pl.company || '',
      placement_role: pl.role || '',
      placement_domain: pl.domain || '',
      placement_sector: pl.sector || '',
      placement_location: pl.location || '',
      placement_via: pl.via || '',
      ...(selectedSeason === 'final' ? { placement_final_status: pl.finalStatus || '' } : {}),
      placement_package: pl.package || '',
      placement_ctc_notes: pl.ctcNotes || '',
      placement_date: pl.date || '',
    }
  }), [filtered, selectedSeason])

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000) }

  const proposeUnplace = async (s) => {
    await propose({
      type: 'unplace',
      cohort: studentCohort(s),
      season: selectedSeason,
      studentId: s._id,
      studentName: getVal(s, 'name'),
      studentRoll: getVal(s, 'roll'),
      currentCompany: getPlacedCompany(s),
    })
    flash(`Unplace proposal for ${getVal(s, 'name')} submitted — awaiting approval.`)
  }

  const canSeePlacement = fieldVisible(selectedSeason === 'summer' ? '_placement_summer' : '_placement_final')
  const canSeeCtc = fieldVisible('ctc')
  const canSeeStipend = fieldVisible('stipend')

  // Format a raw package value for display
  const fmtPackage = (pkg) => {
    if (!pkg) return '—'
    if (selectedSeason === 'summer') return `₹${pkg}/mo`
    const val = parseFloat(String(pkg).replace(/,/g, ''))
    if (isNaN(val)) return pkg
    if (val > 1000) return `${(val / 100000).toFixed(2)} LPA`
    return `${val} LPA`
  }

  const headers = [
    { label: 'Roll No.' },
    { label: 'Name' },
    { label: 'Gender' },
    { label: 'CAT %ile' },
    { label: 'Category' },
    { label: 'Work Ex' },
    { label: 'Company' },
    { label: 'Role' },
    { label: 'Sector' },
    { label: 'Location' },
    ...(fieldVisible('ctc') || fieldVisible('stipend') ? [{ label: selectedSeason === 'summer' ? 'Stipend' : 'CTC' }] : []),
    { label: 'Placed On' },
    { label: 'Actions' },
  ]

  const rows = filtered.map(s => {
    const placement = getPlacement(s)
    const company = canSeePlacement ? getPlacedCompany(s) : '—'
    const placedAt = getPlacedAt(s)
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
      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{placement.role || '—'}</span>,
      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{placement.sector || '—'}</span>,
      placement.location ? (
        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 20, background: placement.location === 'International' ? 'var(--accent-bg)' : 'var(--surface2)', color: placement.location === 'International' ? 'var(--accent-dark)' : 'var(--text-2)', border: `1px solid ${placement.location === 'International' ? '#BFDBFE' : 'var(--border)'}` }}>
          {placement.location}
        </span>
      ) : <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>,
      canSeeCtc || canSeeStipend ? (
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
          {selectedSeason === 'summer'
            ? (canSeeStipend ? fmtPackage(placement.package) : '—')
            : (canSeeCtc ? fmtPackage(placement.package) : '—')
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
          isAdmin && (
            <>
              <Btn size="sm" variant="ghost" onClick={() => window.open(PLACEMENT_SHEET_URL, '_blank')} title="Open placement results sheet">
                <ExternalLink size={13} /> Placement Sheet
              </Btn>
              <Btn size="sm" onClick={() => exportToCSV(exportRows, 'placed_students.csv')} disabled={!exportRows.length} title={!exportRows.length ? 'No placed records to export' : 'Export placed students with placement details'}>
                <Download size={13} /> Export Placed Sheet
              </Btn>
            </>
          )
        }
      />

      {/* Season tabs — only show cycles that exist for this cohort */}
      <div style={{ padding: '0 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 4 }}>
        {availableCycles.map(s => {
          const count = scopedStudents.filter(st => s === 'summer' ? st._placed_summer : st._placed_final).length
          const isActive = selectedCohortCycle === s
          return (
            <button key={s} onClick={() => setSelectedSeason(s)} style={{
              padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: selectedSeason === s ? 600 : 400,
              color: selectedSeason === s ? (s === 'summer' ? 'var(--amber-text)' : 'var(--accent-dark)') : 'var(--text-2)',
              borderBottom: selectedSeason === s ? `2px solid ${s === 'summer' ? 'var(--amber)' : 'var(--accent)'}` : '2px solid transparent',
              fontFamily: 'var(--font-sans)',
            }}>
              {s === 'summer' ? 'Summer Internship' : 'Final Placement'}
              <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, opacity: 0.7 }}>({count})</span>
              {isActive && <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 20, background: s === 'summer' ? 'var(--amber-bg)' : 'var(--accent-bg)', color: s === 'summer' ? 'var(--amber-text)' : 'var(--accent-dark)', border: `1px solid ${s === 'summer' ? 'var(--amber)' : 'var(--accent-border)'}` }}>active</span>}
            </button>
          )
        })}
      </div>

      {/* Stats bar */}
      {placed.length > 0 && (
        <div style={{ padding: '14px 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'stretch' }}>
          <StatCard
            label="Placed"
            value={placed.length}
            sub={totalInCohort ? `${stats.placementPct}% of cohort` : undefined}
            color="var(--green-text)"
          />
          {stats.avgCtc && (selectedSeason === 'summer' ? canSeeStipend : canSeeCtc) && (
            <StatCard
              label={selectedSeason === 'summer' ? 'Avg Stipend' : 'Avg CTC'}
              value={stats.avgCtc}
              sub={stats.maxCtc ? `Max ${stats.maxCtc}` : undefined}
            />
          )}
          {stats.topSector && (
            <StatCard
              label="Top Sector"
              value={stats.topSector[0].split(' ')[0]}
              sub={`${stats.topSector[1]} student${stats.topSector[1] !== 1 ? 's' : ''}`}
            />
          )}
          {stats.international > 0 && (
            <StatCard
              label="International"
              value={stats.international}
              sub={`${Math.round((stats.international / placed.length) * 100)}% of placed`}
              color="var(--accent-dark)"
            />
          )}
        </div>
      )}

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

      <Modal open={!!viewModal} onClose={() => setViewModal(null)} title={viewModal ? `${getVal(viewModal, 'name')} — ${getPlacedCompany(viewModal)}` : ''} width={520}>
        {viewModal && (() => {
          const pl = getPlacement(viewModal)
          return (
            <div style={{ display: 'grid', gap: 0 }}>
              {/* Student profile */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Student Profile</div>
              {[
                ['Roll No.', getVal(viewModal, 'roll')],
                ['Gender', getVal(viewModal, 'gender')],
                ['CAT Percentile', getVal(viewModal, 'cat')],
                ['Category', getVal(viewModal, 'category')],
                ['Work Experience', `${getVal(viewModal, 'wx')} months`],
                ['UG Degree', `${getVal(viewModal, 'ug')} — ${getVal(viewModal, 'ugpct')}%`],
                ['Class X', `${getVal(viewModal, 'x10pct')}%`],
                ['Class XII', `${getVal(viewModal, 'x12pct')}%`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-2)' }}>{k}</span>
                  <span style={{ fontWeight: 500 }}>{v || '—'}</span>
                </div>
              ))}

              {/* Placement details */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 16, marginBottom: 8 }}>Placement Details</div>
              {[
                ['Season', seasonLabel(selectedSeason)],
                ['Company', pl.company],
                ['Role', pl.role],
                pl.domain ? ['Domain', pl.domain] : null,
                ['Sector', pl.sector],
                ['Location', pl.location],
                ['Placed via', pl.via],
                selectedSeason === 'final' && pl.finalStatus ? ['Final Status', pl.finalStatus] : null,
                canSeeCtc || canSeeStipend ? [selectedSeason === 'summer' ? 'Stipend' : 'CTC', fmtPackage(pl.package)] : null,
                (canSeeCtc || canSeeStipend) && pl.ctcNotes ? ['CTC Notes', pl.ctcNotes] : null,
                ['Placed On', pl.placedAtIso ? new Date(pl.placedAtIso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : null],
              ].filter(Boolean).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-2)' }}>{k}</span>
                  <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: 280 }}>{v || '—'}</span>
                </div>
              ))}
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
