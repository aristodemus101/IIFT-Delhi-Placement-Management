import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useStudentsContext } from '../lib/StudentsContext'
import { usePendingChanges } from '../lib/PendingChangesContext'
import { useAuth } from '../lib/AuthContext'
import { useBatch } from '../lib/BatchContext'
import { cohortLabel, seasonLabel } from '../lib/batch'
import { getVal } from '../lib/columns'
import { exportToCSV } from '../lib/csv'
import { usePermissions } from '../lib/usePermissions'
import { PageHeader, Btn, Badge, CategoryBadge, Input, Spinner, Table, Modal, TabBar } from '../components/UI'
import { Download, RotateCcw, Search, Eye, CheckCircle, Lock, ExternalLink, Columns, Building2, Users, ChevronDown } from 'lucide-react'

const PLACEMENT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1uOzTID4iVhwjXuKynSICQmFDygYoQJC1N_q6QlumF68/edit'

function studentCohort(s) {
  return s.cohort || 'unknown'
}

function StatCard({ label, value, sub, color }) {
  const accentColor = color || 'var(--text)'
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '14px 18px', minWidth: 130,
      position: 'relative', overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: accentColor, opacity: 0.7, borderRadius: '12px 12px 0 0',
      }} />
      <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accentColor, lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

export default function PlacedPage() {
  const { students, loading } = useStudentsContext()
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
  const [showColPicker, setShowColPicker] = useState(false)
  const [hiddenCols, setHiddenCols] = useState(new Set())
  const [viewMode, setViewMode] = useState('students') // 'students' | 'companies'
  const [expandedCompany, setExpandedCompany] = useState(null)

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

  // Company-level grouping
  const companyGroups = useMemo(() => {
    const map = {}
    placed.forEach(s => {
      const pl = getPlacement(s)
      const co = pl.company || 'Unknown'
      if (!map[co]) map[co] = { company: co, students: [], sector: pl.sector || '', roles: {}, packages: [] }
      map[co].students.push(s)
      if (pl.role) map[co].roles[pl.role] = (map[co].roles[pl.role] || 0) + 1
      if (pl.package) {
        const cleaned = String(pl.package).replace(/,/g, '')
        const m = cleaned.match(/[\d.]+/)
        if (m) {
          const v = parseFloat(m[0])
          const lpa = selectedSeason === 'summer' ? null : v > 1000 ? parseFloat((v / 100000).toFixed(2)) : v
          if (lpa) map[co].packages.push(lpa)
        }
      }
    })
    return Object.values(map)
      .map(g => {
        const topRole = Object.entries(g.roles).sort((a, b) => b[1] - a[1])[0]
        const avgPkg = g.packages.length ? (g.packages.reduce((a, b) => a + b, 0) / g.packages.length).toFixed(1) : null
        const maxPkg = g.packages.length ? Math.max(...g.packages).toFixed(1) : null
        return { ...g, topRole: topRole?.[0], avgPkg, maxPkg, count: g.students.length }
      })
      .sort((a, b) => b.count - a.count)
  }, [placed, selectedSeason])

  const filteredCompanies = useMemo(() => {
    if (!search) return companyGroups
    const q = search.toLowerCase()
    return companyGroups.filter(g =>
      g.company.toLowerCase().includes(q) ||
      (g.sector || '').toLowerCase().includes(q) ||
      (g.topRole || '').toLowerCase().includes(q)
    )
  }, [companyGroups, search])

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
    const s = String(pkg).trim()
    if (selectedSeason === 'summer') {
      // If already contains a recognised unit, display as-is (e.g. "2.5 LPA", "₹25,000")
      if (/lpa|lakh|₹|rs\.|inr/i.test(s)) return s
      const val = parseFloat(s.replace(/,/g, ''))
      // Bare number: if > 1000 treat as rupees/month, otherwise as LPA/month
      if (!isNaN(val)) return val > 1000 ? `₹${val.toLocaleString('en-IN')}/mo` : `${val} LPA/mo`
      return s
    }
    const val = parseFloat(s.replace(/,/g, ''))
    if (isNaN(val)) return s
    if (val > 1000) return `${(val / 100000).toFixed(2)} LPA`
    return `${val} LPA`
  }

  // All possible columns — key used to toggle visibility
  const allColDefs = [
    { key: 'roll',     label: 'Roll No.',  alwaysShow: true },
    { key: 'name',     label: 'Name',      alwaysShow: true },
    { key: 'gender',   label: 'Gender' },
    { key: 'cat',      label: 'CAT %ile' },
    { key: 'category', label: 'Category' },
    { key: 'wx',       label: 'Work Ex' },
    { key: 'company',  label: 'Company',   alwaysShow: true },
    { key: 'role',     label: 'Role' },
    { key: 'domain',   label: 'Domain' },
    { key: 'sector',   label: 'Sector' },
    { key: 'location', label: 'Location' },
    ...((canSeeCtc || canSeeStipend) ? [{ key: 'package', label: selectedSeason === 'summer' ? 'Stipend' : 'CTC' }] : []),
    { key: 'via',      label: 'Via' },
    ...(selectedSeason === 'final' ? [{ key: 'finalStatus', label: 'Final Status' }] : []),
    { key: 'placedOn', label: 'Placed On' },
    { key: 'actions',  label: 'Actions',   alwaysShow: true },
  ]

  const visibleColDefs = allColDefs.filter(c => c.alwaysShow || !hiddenCols.has(c.key))
  const visibleKeys = new Set(visibleColDefs.map(c => c.key))

  const headers = visibleColDefs.map(c => ({ label: c.label }))

  const rows = filtered.map(s => {
    const placement = getPlacement(s)
    const company = canSeePlacement ? getPlacedCompany(s) : '—'
    const placedAt = getPlacedAt(s)

    const cellMap = {
      roll:     <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{getVal(s, 'roll')}</span>,
      name:     <span style={{ fontWeight: 500 }}>{getVal(s, 'name')}</span>,
      gender:   <span style={{ color: 'var(--text-2)' }}>{getVal(s, 'gender')}</span>,
      cat:      <strong>{parseFloat(getVal(s, 'cat')).toFixed(2) || '—'}</strong>,
      category: <CategoryBadge category={getVal(s, 'category')} />,
      wx:       <span>{getVal(s, 'wx') ? `${getVal(s, 'wx')} mo` : '—'}</span>,
      company:  canSeePlacement ? (
        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 12, background: selectedSeason === 'summer' ? 'var(--amber-bg)' : 'var(--green-bg)', color: selectedSeason === 'summer' ? 'var(--amber-text)' : 'var(--green-text)', border: `1px solid ${selectedSeason === 'summer' ? 'var(--amber)' : 'var(--green-border)'}`, fontWeight: 500 }}>
          {company}
        </span>
      ) : <span style={{ color: 'var(--text-3)', fontSize: 12 }}>Hidden</span>,
      role:     <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{placement.role || '—'}</span>,
      domain:   <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{placement.domain || '—'}</span>,
      sector:   <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{placement.sector || '—'}</span>,
      location: placement.location ? (
        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 20, background: placement.location === 'International' ? 'var(--accent-bg)' : 'var(--surface2)', color: placement.location === 'International' ? 'var(--accent-dark)' : 'var(--text-2)', border: `1px solid ${placement.location === 'International' ? '#BFDBFE' : 'var(--border)'}` }}>
          {placement.location}
        </span>
      ) : <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>,
      package:  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
        {selectedSeason === 'summer' ? (canSeeStipend ? fmtPackage(placement.package) : '—') : (canSeeCtc ? fmtPackage(placement.package) : '—')}
      </span>,
      via:      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{placement.via || '—'}</span>,
      finalStatus: <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{placement.finalStatus || '—'}</span>,
      placedOn: <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
        {placedAt ? new Date(placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
      </span>,
      actions: <div style={{ display: 'flex', gap: 6 }}>
        {canSeePlacement && <Btn size="sm" variant="ghost" onClick={() => setViewModal(s)}><Eye size={13} /></Btn>}
        {canDo('proposeUnplace') && (
          <Btn size="sm" variant="ghost" onClick={() => proposeUnplace(s)} title="Propose unplace">
            <RotateCcw size={13} /> Unplace
          </Btn>
        )}
      </div>,
    }
    return visibleColDefs.map(c => cellMap[c.key] ?? null)
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
      <TabBar
        tabs={availableCycles.map(s => {
          const count = scopedStudents.filter(st => s === 'summer' ? st._placed_summer : st._placed_final).length
          return {
            key: s,
            label: `${s === 'summer' ? 'Summer Internship' : 'Final Placement'} (${count})`,
            color: s === 'summer' ? 'var(--amber-text)' : 'var(--accent)',
          }
        })}
        active={selectedSeason}
        onChange={setSelectedSeason}
      />

      {/* Stats bar */}
      {placed.length > 0 && (
        <div className="stats-bar" style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'stretch' }}>
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

      <div className="filter-bar" style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <Input
            placeholder={viewMode === 'companies' ? 'Company, sector, or role…' : 'Name, Roll No., or Company'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 28, width: 240 }}
          />
        </div>
        {viewMode === 'students' && (
          <Btn size="sm" variant="ghost" onClick={() => setShowColPicker(true)}>
            <Columns size={13} /> Columns {hiddenCols.size > 0 && `(${allColDefs.filter(c => !c.alwaysShow).length - hiddenCols.size}/${allColDefs.filter(c => !c.alwaysShow).length})`}
          </Btn>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {[['students', Users, 'Students'], ['companies', Building2, 'Companies']].map(([mode, Icon, label]) => (
            <button
              key={mode}
              onClick={() => { setViewMode(mode); setSearch(''); setExpandedCompany(null) }}
              title={label}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 11px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: viewMode === mode ? 'var(--accent-bg)' : 'var(--surface)',
                color: viewMode === mode ? 'var(--accent-dark)' : 'var(--text-3)',
                transition: 'background var(--speed-fast) var(--easing-out), color var(--speed-fast) var(--easing-out)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'students' ? (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <Table headers={headers} rows={rows} emptyMessage={placed.length ? 'No matches' : `No ${seasonLabel(selectedSeason).toLowerCase()} placements recorded yet`} />
        </div>
      ) : (
        <div className="page-content" style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {filteredCompanies.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200, color: 'var(--text-3)', fontSize: 14 }}>
              {placed.length === 0 ? `No ${seasonLabel(selectedSeason).toLowerCase()} placements recorded yet.` : 'No companies match the search.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Summary line */}
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, color: 'var(--text-2)' }}>{filteredCompanies.length}</span> companies ·{' '}
                <span style={{ fontWeight: 700, color: 'var(--text-2)' }}>{placed.length}</span> students placed
              </div>
              {filteredCompanies.map(g => {
                const isExpanded = expandedCompany === g.company
                const isSummer = selectedSeason === 'summer'
                return (
                  <div key={g.company} style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', overflow: 'hidden',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'box-shadow var(--speed-fast) var(--easing-out)',
                  }}>
                    {/* Company row */}
                    <div
                      onClick={() => setExpandedCompany(isExpanded ? null : g.company)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '13px 18px', cursor: 'pointer',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Company initial avatar */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: isSummer ? 'var(--amber-bg)' : 'var(--accent-bg)',
                        border: `1px solid ${isSummer ? 'var(--amber)' : 'color-mix(in srgb, var(--accent) 35%, transparent)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 800,
                        color: isSummer ? 'var(--amber-text)' : 'var(--accent-dark)',
                        letterSpacing: '-0.02em',
                      }}>
                        {g.company.charAt(0).toUpperCase()}
                      </div>

                      {/* Name + meta */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>{g.company}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {g.topRole && <span>{g.topRole}</span>}
                          {g.sector && <><span style={{ opacity: 0.4 }}>·</span><span>{g.sector}</span></>}
                        </div>
                      </div>

                      {/* Stats chips */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '4px 10px', borderRadius: 20,
                          background: isSummer ? 'var(--amber-bg)' : 'var(--green-bg)',
                          border: `1px solid ${isSummer ? 'var(--amber)' : 'var(--green-border)'}`,
                          color: isSummer ? 'var(--amber-text)' : 'var(--green-text)',
                          fontSize: 12, fontWeight: 700,
                        }}>
                          <Users size={11} />
                          {g.count} student{g.count !== 1 ? 's' : ''}
                        </div>
                        {g.avgPkg && (canSeeCtc || canSeeStipend) && !isSummer && (
                          <div style={{
                            padding: '4px 10px', borderRadius: 20,
                            background: 'var(--surface2)', border: '1px solid var(--border)',
                            fontSize: 12, fontWeight: 600, color: 'var(--text-2)',
                          }}>
                            avg {g.avgPkg} LPA
                            {g.maxPkg && g.maxPkg !== g.avgPkg && <span style={{ color: 'var(--text-3)', fontWeight: 400 }}> · max {g.maxPkg}</span>}
                          </div>
                        )}
                        <div style={{ color: 'var(--text-3)', marginLeft: 4, transition: 'transform 0.15s ease', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                          <ChevronDown size={15} />
                        </div>
                      </div>
                    </div>

                    {/* Expanded student list */}
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
                        {g.students.map((s, i) => {
                          const pl = getPlacement(s)
                          return (
                            <div key={s._id} style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              padding: '9px 18px 9px 68px',
                              borderBottom: i < g.students.length - 1 ? '1px solid var(--border)' : 'none',
                              fontSize: 13,
                            }}>
                              <span style={{ fontWeight: 500, flex: 1 }}>{getVal(s, 'name')}</span>
                              <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{getVal(s, 'roll')}</span>
                              {pl.role && <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{pl.role}</span>}
                              {(canSeeCtc || canSeeStipend) && pl.package && (
                                <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>{fmtPackage(pl.package)}</span>
                              )}
                              {canSeePlacement && (
                                <Btn size="sm" variant="ghost" onClick={() => setViewModal(s)} style={{ padding: '3px 7px' }}>
                                  <Eye size={12} />
                                </Btn>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <Modal open={showColPicker} onClose={() => setShowColPicker(false)} title="Show or hide columns" width={560}>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
          Choose which columns appear in the table. Roll No., Name, Company and Actions are always shown.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Btn size="sm" variant="ghost" onClick={() => setHiddenCols(new Set())}>Show all</Btn>
          <Btn size="sm" variant="ghost" onClick={() => setHiddenCols(new Set(allColDefs.filter(c => !c.alwaysShow).map(c => c.key)))}>Hide all</Btn>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', maxHeight: 320, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, background: 'var(--surface2)' }}>
          {allColDefs.filter(c => !c.alwaysShow).map(c => (
            <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
              <input type="checkbox" checked={!hiddenCols.has(c.key)} onChange={() => setHiddenCols(prev => {
                const next = new Set(prev)
                next.has(c.key) ? next.delete(c.key) : next.add(c.key)
                return next
              })} style={{ accentColor: 'var(--accent)' }} />
              <span>{c.label}</span>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <Btn variant="primary" onClick={() => setShowColPicker(false)}>Done</Btn>
        </div>
      </Modal>

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
