import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { usePermissions } from '../lib/usePermissions'
import { useStudentsContext } from '../lib/StudentsContext'
import { useIntel, filterIntelRecords, aggregateByCompany } from '../lib/useIntel'
import { softDeleteIntel } from '../lib/intel'
import { PageHeader, Btn, Badge, Spinner, Input, Select } from '../components/UI'
import {
  Upload, Plus, List, LayoutGrid, Columns, Search,
  AlertTriangle, CheckCircle, TrendingUp, Building2,
} from 'lucide-react'
import IntelTable, { sectorColor } from './intel/IntelTable'
import CompanyLogo from './intel/CompanyLogo'
import CompanyDrawer from './intel/CompanyDrawer'
import IntelEditModal from './intel/IntelEditModal'
import UploadModal from './intel/UploadModal'

const VIEW = { TABLE: 'table', CARDS: 'cards', BENCHMARK: 'benchmark' }

// Param names in the URL
const P = { search: 'q', college: 'college', year: 'year', cycle: 'cycle', sector: 'sector', program: 'program', iift: 'iift', view: 'view' }

export default function IntelPage() {
  const { user, role } = useAuth()
  const { canDo } = usePermissions()
  const canWrite  = canDo('writeIntel')
  const canUpload = canDo('uploadIntel')
  const canDelete = canDo('deleteIntel')

  const { students } = useStudentsContext()
  const { records, loading, error, colleges, years, sectors, programs, cycles } = useIntel({ students })

  // ── URL-synced filter state ──────────────────────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams()

  const college    = searchParams.get(P.college) || ''
  const year       = searchParams.get(P.year)    || ''
  const cycle      = searchParams.get(P.cycle)   || ''
  const sector     = searchParams.get(P.sector)  || ''
  const program    = searchParams.get(P.program) || ''
  const iiftFilter = searchParams.get(P.iift)    || ''
  const viewMode   = searchParams.get(P.view)    || VIEW.TABLE

  // Search input: local state (instant visual feedback) + URL (debounced, shareable)
  const [search, setSearch] = useState(searchParams.get(P.search) || '')
  const debouncedSearch = searchParams.get(P.search) || ''

  // Helper: update one param, preserve the rest, remove param when empty
  const setParam = useCallback((key, val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (val) next.set(key, val)
      else next.delete(key)
      return next
    }, { replace: true })
  }, [setSearchParams])

  const setCollege    = v => setParam(P.college, v)
  const setYear       = v => setParam(P.year, v)
  const setCycle      = v => setParam(P.cycle, v)
  const setSector     = v => setParam(P.sector, v)
  const setProgram    = v => setParam(P.program, v)
  const setIiftFilter = v => setParam(P.iift, v)
  const setViewMode   = v => setParam(P.view, v === VIEW.TABLE ? '' : v)

  // UI state — ephemeral, not in URL (drawer/modal/context-menu don't belong in URL)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [editRecord,     setEditRecord]     = useState(null)
  const [uploadOpen,     setUploadOpen]     = useState(false)
  const [ctxMenu,        setCtxMenu]        = useState(null)

  // Close context menu on outside click
  const ctxRef = useRef()
  useEffect(() => {
    if (!ctxMenu) return
    const handler = () => setCtxMenu(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [ctxMenu])

  // Debounce search to URL: push after 250ms idle, keeping local state instant
  useEffect(() => {
    const t = setTimeout(() => setParam(P.search, search), 250)
    return () => clearTimeout(t)
  }, [search])

  const filtered = useMemo(() => filterIntelRecords(records, {
    search: debouncedSearch, college, year, cycle, sector, program, iiftFilter,
  }), [records, debouncedSearch, college, year, cycle, sector, program, iiftFilter])

  const companies = useMemo(() => aggregateByCompany(filtered), [filtered])

  // Memoize total company count across ALL records (not filtered) — used in summary bar
  const allCompaniesCount = useMemo(() => aggregateByCompany(records).length, [records])

  // Summary counts
  const gapCount    = useMemo(() => records.filter(r => r._iiftStatus === 'gap').length, [records])
  const atIiftCount = useMemo(() => records.filter(r => r._iiftStatus === 'at_iift').length, [records])

  const handleContextMenu = (e, record) => {
    e.preventDefault(); e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY, record })
  }

  const handleDelete = async (record) => {
    if (!window.confirm(`Soft-delete "${record.recruiterName}"? This can be undone by an admin.`)) return
    await softDeleteIntel(record._id, user)
    if (selectedRecord?._id === record._id) setSelectedRecord(null)
  }

  const handleEdit = (record) => {
    setCtxMenu(null)
    setSelectedRecord(null)
    setEditRecord(record)
  }

  const clearFilters = () => {
    setSearch('')
    setSearchParams({}, { replace: true })
  }

  const hasFilters = search || college || year || cycle || sector || program || iiftFilter

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <PageHeader title="Intel" subtitle="Recruiter intelligence across B-schools" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: 'var(--red-text)', padding: 32 }}>
            <AlertTriangle size={32} style={{ marginBottom: 10 }} />
            <p style={{ fontWeight: 600 }}>Could not load Intel data</p>
            <p style={{ fontSize: 13, marginTop: 4, color: 'var(--text-3)' }}>{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Intel"
        subtitle={loading ? 'Loading…' : `${records.length.toLocaleString()} records across ${colleges.length} colleges`}
        actions={
          <div style={{ display: 'flex', gap: 6 }}>
            {canWrite && (
              <Btn size="sm" variant="ghost" onClick={() => setEditRecord({})}>
                <Plus size={13} /> Add Record
              </Btn>
            )}
            {canUpload && (
              <Btn size="sm" variant="primary" onClick={() => setUploadOpen(true)}>
                <Upload size={13} /> Upload Report
              </Btn>
            )}
          </div>
        }
      />

      {/* Summary bar */}
      {!loading && records.length > 0 && (
        <div style={{ display: 'flex', gap: 10, padding: '10px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0, overflowX: 'auto' }}>
          <SummaryChip
            icon={Building2} color="blue"
            label="Total Records" value={records.length.toLocaleString()}
          />
          <SummaryChip
            icon={CheckCircle} color="green"
            label="At IIFT" value={atIiftCount.toLocaleString()}
            active={iiftFilter === 'at_iift'} onClick={() => setIiftFilter(iiftFilter === 'at_iift' ? '' : 'at_iift')}
          />
          <SummaryChip
            icon={TrendingUp} color="amber"
            label="IIFT Gap" value={gapCount.toLocaleString()}
            active={iiftFilter === 'gap'} onClick={() => setIiftFilter(iiftFilter === 'gap' ? '' : 'gap')}
          />
          <SummaryChip
            icon={Building2} color="gray"
            label="Companies" value={allCompaniesCount.toLocaleString()}
          />
        </div>
      )}

      {/* Filter bar */}
      <div className="filter-bar" style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        {/* Search */}
        <div style={{ position: 'relative', minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search company, sector, role…"
            style={{ width: '100%', paddingLeft: 28 }}
          />
        </div>

        <Select value={college} onChange={e => setCollege(e.target.value)} style={{ width: 'auto' }}>
          <option value="">All colleges</option>
          {colleges.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>

        <Select value={year} onChange={e => setYear(e.target.value)} style={{ width: 'auto' }}>
          <option value="">All years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </Select>

        <Select value={cycle} onChange={e => setCycle(e.target.value)} style={{ width: 'auto' }}>
          <option value="">All cycles</option>
          {cycles.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>

        <Select value={sector} onChange={e => setSector(e.target.value)} style={{ width: 'auto' }}>
          <option value="">All sectors</option>
          {sectors.map(s => <option key={s} value={s}>{s}</option>)}
        </Select>

        <Select value={program} onChange={e => setProgram(e.target.value)} style={{ width: 'auto' }}>
          <option value="">All programs</option>
          {programs.map(p => <option key={p} value={p}>{p}</option>)}
        </Select>

        {hasFilters && (
          <Btn size="sm" variant="ghost" onClick={clearFilters}>Clear filters</Btn>
        )}

        <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 'auto' }}>
          {filtered.length.toLocaleString()} record{filtered.length !== 1 ? 's' : ''}
        </span>

        {/* View toggle */}
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
          {[
            [VIEW.TABLE,     List,       'Table view'],
            [VIEW.CARDS,     LayoutGrid, 'Card view'],
            [VIEW.BENCHMARK, Columns,    'Benchmark view'],
          ].map(([mode, Icon, title]) => (
            <button key={mode} onClick={() => setViewMode(mode)} title={title} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, border: 'none', cursor: 'pointer',
              background: viewMode === mode ? 'var(--accent-bg)' : 'var(--surface)',
              color: viewMode === mode ? 'var(--accent-dark)' : 'var(--text-3)',
              transition: 'background 0.12s ease, color 0.12s ease',
            }}>
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="page-content" style={{ flex: 1, overflow: 'auto', padding: viewMode === VIEW.TABLE ? 0 : '20px 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Spinner />
          </div>
        ) : records.length === 0 ? (
          <EmptyState canUpload={canUpload} onUpload={() => setUploadOpen(true)} onAdd={() => setEditRecord({})} canWrite={canWrite} />
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 240 }}>
            <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              No records match the current filters.
              <br />
              <button onClick={clearFilters} style={{ marginTop: 8, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 13, fontWeight: 600 }}>
                Clear all filters
              </button>
            </div>
          </div>
        ) : viewMode === VIEW.TABLE ? (
          <IntelTable
            key={filtered.length}
            records={filtered}
            onRowClick={setSelectedRecord}
            contextMenu={handleContextMenu}
          />
        ) : viewMode === VIEW.CARDS ? (
          <CardsView companies={companies} onCardClick={r => setSelectedRecord(r.appearances[0])} />
        ) : (
          <BenchmarkView companies={companies} onCardClick={r => setSelectedRecord(r.appearances[0])} />
        )}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          style={{
            position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 300,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, boxShadow: 'var(--shadow)', padding: 4, minWidth: 150,
          }}
        >
          <CtxItem onClick={() => { setSelectedRecord(ctxMenu.record); setCtxMenu(null) }}>View Details</CtxItem>
          {canWrite && <CtxItem onClick={() => handleEdit(ctxMenu.record)}>Edit Record</CtxItem>}
          {canDelete && (
            <CtxItem danger onClick={() => { handleDelete(ctxMenu.record); setCtxMenu(null) }}>
              Delete (soft)
            </CtxItem>
          )}
        </div>
      )}

      {/* Drawers & Modals */}
      {selectedRecord && (
        <CompanyDrawer
          record={selectedRecord}
          allRecords={records}
          iiftStudents={students}
          onClose={() => setSelectedRecord(null)}
          onEdit={handleEdit}
        />
      )}

      <IntelEditModal
        open={editRecord !== null}
        onClose={() => setEditRecord(null)}
        record={editRecord && Object.keys(editRecord).length > 0 ? editRecord : null}
      />

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  )
}

// ── Sub-views ─────────────────────────────────────────────────────────────────

function CardsView({ companies, onCardClick }) {
  const grouped = useMemo(() => {
    const map = {}
    companies.forEach(c => {
      const s = c.sector || 'Other'
      if (!map[s]) map[s] = []
      map[s].push(c)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [companies])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {grouped.map(([sector, comps]) => (
        <div key={sector}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', marginBottom: 10 }}>
            {sector} <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>({comps.length})</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            {comps.map(c => (
              <CompanyCard key={c._key} company={c} onClick={() => onCardClick(c)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function CompanyCard({ company, onClick }) {
  const [hovered, setHovered] = useState(false)
  const colleges = [...new Set(company.appearances.map(a => a.collegeName).filter(Boolean))].slice(0, 3)
  const years    = [...new Set(company.appearances.map(a => a.placementYear).filter(Boolean))].sort((a, b) => b - a)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px',
        background: 'var(--surface)', cursor: 'pointer',
        boxShadow: hovered ? 'var(--shadow)' : 'var(--shadow-sm)',
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'box-shadow 0.15s ease, transform 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <CompanyLogo name={company.recruiterName} size={32} sector={company.sector} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {company.recruiterName}
          </div>
          {company.sector && (
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{company.sector}</div>
          )}
        </div>
        <Badge color={company._iiftStatus === 'at_iift' ? 'green' : 'amber'} style={{ flexShrink: 0 }}>
          {company._iiftStatus === 'at_iift' ? '✓ IIFT' : 'Gap'}
        </Badge>
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {colleges.map(c => (
          <span key={c} style={{ fontSize: 10.5, color: 'var(--text-3)', background: 'var(--surface2)', borderRadius: 4, padding: '2px 6px' }}>{c}</span>
        ))}
        {years.length > 0 && (
          <span style={{ fontSize: 10.5, color: 'var(--text-3)', background: 'var(--surface2)', borderRadius: 4, padding: '2px 6px', fontVariantNumeric: 'tabular-nums' }}>
            {years[0]}{years.length > 1 ? `–${years[years.length - 1]}` : ''}
          </span>
        )}
        <span style={{ fontSize: 10.5, color: 'var(--text-3)', background: 'var(--surface2)', borderRadius: 4, padding: '2px 6px' }}>
          {company.appearances.length} record{company.appearances.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}

function BenchmarkView({ companies, onCardClick }) {
  const atIift = companies.filter(c => c._iiftStatus === 'at_iift')
  const gap    = companies.filter(c => c._iiftStatus === 'gap')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <BenchmarkColumn
        title="At IIFT"
        count={atIift.length}
        color="green"
        description="Placed at IIFT in the last 2 years"
        companies={atIift}
        onCardClick={onCardClick}
      />
      <BenchmarkColumn
        title="IIFT Gap"
        count={gap.length}
        color="amber"
        description="At peer colleges but not IIFT recently"
        companies={gap}
        onCardClick={onCardClick}
      />
    </div>
  )
}

function BenchmarkColumn({ title, count, color, description, companies, onCardClick }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        background: `var(--${color}-bg)`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: `var(--${color}-text)` }}>{title}</span>
        <Badge color={color}>{count}</Badge>
        <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 2 }}>{description}</span>
      </div>
      <div style={{ maxHeight: 600, overflowY: 'auto' }}>
        {companies.map(c => (
          <div
            key={c._key}
            onClick={() => onCardClick(c)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 14px', borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
            onMouseLeave={e => e.currentTarget.style.background = ''}
          >
            <CompanyLogo name={c.recruiterName} size={26} sector={c.sector} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.recruiterName}
              </div>
              {c.sector && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.sector}</div>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              {c.appearances.length} record{c.appearances.length !== 1 ? 's' : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ canUpload, canWrite, onUpload, onAdd }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300 }}>
      <div style={{
        textAlign: 'center', padding: 40,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)',
      }}>
        <Building2 size={36} color="var(--text-3)" style={{ marginBottom: 14 }} />
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
          No Intel data yet
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20, maxWidth: 320, lineHeight: 1.5 }}>
          Upload an annual placement report or add individual recruiter records to start building your competitive intelligence database.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {canWrite && (
            <Btn size="sm" variant="ghost" onClick={onAdd}><Plus size={13} /> Add Record</Btn>
          )}
          {canUpload && (
            <Btn size="sm" variant="primary" onClick={onUpload}><Upload size={13} /> Upload Report</Btn>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryChip({ icon: Icon, color, label, value, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
        borderRadius: 8, border: `1px solid ${active ? `var(--${color}-border)` : 'var(--border)'}`,
        background: active ? `var(--${color}-bg)` : 'var(--surface2)',
        cursor: onClick ? 'pointer' : 'default',
        flexShrink: 0,
        transition: 'border-color 0.12s ease, background 0.12s ease',
      }}
    >
      <Icon size={13} color={`var(--${color}-text, var(--text-3))`} />
      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

function CtxItem({ onClick, danger, children }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '8px 12px', fontSize: 13, border: 'none', fontFamily: 'var(--font-sans)',
        background: hovered ? 'var(--surface2)' : 'transparent',
        color: danger ? 'var(--red-text)' : 'var(--text)',
        cursor: 'pointer', borderRadius: 7,
        transition: 'background 0.1s ease',
      }}
    >
      {children}
    </button>
  )
}
