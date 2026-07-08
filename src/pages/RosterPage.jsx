import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useColumnSchema } from '../lib/useStudents'
import { useStudentsContext } from '../lib/StudentsContext'
import { usePendingChanges } from '../lib/PendingChangesContext'
import { useAuth } from '../lib/AuthContext'
import { usePermissions } from '../lib/usePermissions'
import { useSheetsSync } from '../lib/SheetsSyncContext'
import { useBatch } from '../lib/BatchContext'
import { getVal, OUR_COLS } from '../lib/columns'
import { cohortLabel } from '../lib/batch'
import { parseDataFile, exportToCSV, exportToTSV, exportToExcel } from '../lib/csv'
import { useSearch } from '../lib/useSearch'
import { useRosterPrefs } from './roster/useRosterPrefs'
import PlaceModal from './roster/PlaceModal'
import ImportModal from './roster/ImportModal'
import ColumnsModal from './roster/ColumnsModal'
import {
  PageHeader, Btn, Badge, CategoryBadge, Input, Select,
  Spinner, Modal, Table
} from '../components/UI'
import {
  Upload, Download, CheckCircle, Trash2, Eye, Search, Lock, ExternalLink, Sheet, GraduationCap
} from 'lucide-react'

const NUMERIC = ['cat', 'wx', 'ugpct', 'x10pct', 'x12pct', 'age', 'cat_score']

const newPlacementForm = () => ({
  date: new Date().toISOString().slice(0, 10),
  company: '', role: '', domain: '', sector: '', package: '', ctcNotes: '', via: '', location: '', finalStatus: '',
})

function studentCohort(s) { return s.cohort || 'unknown' }

export default function RosterPage() {
  const { students, loading } = useStudentsContext()
  const { scopedCohorts, selectedCohort, selectedCohortCycle, selectedYearCode, selectedCampuses, selectedProgramme, batchesLoading, activeBatches } = useBatch()
  const { schemaHeaders } = useColumnSchema(selectedCohort || 'default')
  const { propose, changes } = usePendingChanges()
  const { isAdmin, user } = useAuth()
  const { canDo } = usePermissions()
  const { playgroundUrl, playgroundPushing, pushToPlayground, connected: sheetsConnected } = useSheetsSync()
  const { setWorkspaceActions } = useOutletContext()

  // Modal / UI state
  const [placeModal, setPlaceModal]       = useState(null)
  const [placeSeason, setPlaceSeason]     = useState('final')
  const [placementForm, setPlacementForm] = useState(newPlacementForm)
  const [viewModal, setViewModal]         = useState(null)
  const [rowMenu, setRowMenu]             = useState(null)
  const [columnsOpen, setColumnsOpen]     = useState(false)
  const [actionsOpen, setActionsOpen]     = useState(false)
  const [exportOpen, setExportOpen]       = useState(false)

  // Import state
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importing, setImporting]             = useState(false)
  const [importMsg, setImportMsg]             = useState('')
  const [importCohort, setImportCohort]       = useState('')
  const [importFile, setImportFile]           = useState(null)
  const [importParsed, setImportParsed]       = useState(null)
  const [importStep, setImportStep]           = useState(1)
  const [importCycle, setImportCycleRaw]       = useState('summer')
  const [includeSipData, setIncludeSipDataRaw] = useState(false)
  const [lastImportSummary, setLastImportSummary] = useState(null)
  const [replaceOnImport, setReplaceOnImport] = useState(false)

  const setImportCycle = (c) => { setImportCycleRaw(c) }
  const setIncludeSipData = (val) => {
    setIncludeSipDataRaw(val)
    if (val) setImportCycleRaw('final')
  }

  // Feedback state
  const [busy, setBusy]                   = useState(false)
  const [successMsg, setSuccessMsg]       = useState('')
  const [playgroundMsg, setPlaygroundMsg] = useState('')

  const fileRef    = useRef()
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  // Auto-fill cohort + cycle when import modal opens
  useEffect(() => {
    if (importModalOpen && !importCohort && selectedCohort) {
      setImportCohort(selectedCohort)
      setImportCycle(selectedCohortCycle || 'final')
    }
  }, [importModalOpen, selectedCohort, importCohort, selectedCohortCycle])

  const _scopedIds     = useMemo(() => new Set(scopedCohorts), [scopedCohorts])
  const scopedStudents = useMemo(() => students.filter(s => _scopedIds.has(studentCohort(s))), [students, _scopedIds])
  const { searchTerm, setSearchTerm, match: searchMatch } = useSearch(scopedStudents)
  const hasStudents     = scopedStudents.length > 0
  const hasActiveCohorts = activeBatches.length > 0
  // Derive columns: schema order (stipend stripped), then any extra keys from docs
  const allColumnDefs = useMemo(() => {
    const docKeys = new Set()
    for (const s of scopedStudents) {
      for (const k of Object.keys(s)) {
        if (!k.startsWith('_') && k !== 'cohort') docKeys.add(k)
      }
    }

    if (docKeys.size === 0) {
      return [
        { key: 'name', label: 'Name', sortKey: 'name' },
        { key: 'roll', label: 'Roll No.', sortKey: 'roll' },
      ]
    }

    const ordered = []
    const seen = new Set()
    for (const h of (schemaHeaders || [])) {
      if (docKeys.has(h) && !seen.has(h)) {
        seen.add(h)
        ordered.push({ key: h, label: h, sortKey: h })
      }
    }
    for (const k of docKeys) {
      if (!seen.has(k)) ordered.push({ key: k, label: k, sortKey: k })
    }
    return ordered
  }, [scopedStudents, schemaHeaders])

  const {
    sortCol, setSortCol, sortDir, setSortDir,
    filters, setF, clearFilters: clearPrefsFilters,
    visibleCols, setVisibleCols, toggleColumn,
    prefsReady,
  } = useRosterPrefs({ user, allColumnDefs, selectedCohort })

  const clearFilters = () => clearPrefsFilters(setSearchTerm)

  const visibleDefs = useMemo(() => {
    if (!visibleCols.length) return allColumnDefs
    const set = new Set(visibleCols)
    return allColumnDefs.filter(c => set.has(c.key))
  }, [allColumnDefs, visibleCols])

  // Derive unique values for any column key from current cohort data
  const colValueMap = useMemo(() => {
    const map = {}
    OUR_COLS.forEach(col => {
      const vals = new Set()
      scopedStudents.forEach(s => { const v = String(getVal(s, col.key) || '').trim(); if (v) vals.add(v) })
      if (vals.size > 0) map[col.key] = [...vals].sort()
    })
    return map
  }, [scopedStudents])

  const categoryOptions = useMemo(() => {
    const vals = new Set()
    scopedStudents.forEach(s => { const v = String(getVal(s, 'category') || '').trim(); if (v) vals.add(v) })
    return Array.from(vals).sort((a, b) => a.localeCompare(b))
  }, [scopedStudents])

  const genderOptions = useMemo(() => {
    const vals = new Set()
    scopedStudents.forEach(s => { const v = String(getVal(s, 'gender') || '').trim(); if (v) vals.add(v) })
    return Array.from(vals).sort((a, b) => a.localeCompare(b))
  }, [scopedStudents])

  const sortOptions = useMemo(
    () => visibleDefs.map(def => ({ value: def.sortKey, label: def.label })),
    [visibleDefs]
  )

  // Reset sort col if it disappears from visible columns
  useEffect(() => {
    if (!sortOptions.length) return
    if (sortOptions.some(o => o.value === sortCol)) return
    const schemaNameCol = allColumnDefs.find(c => /full name|name/i.test(c.label))
    setSortCol(schemaNameCol?.sortKey || sortOptions[0].value)
    setSortDir(1)
  }, [sortCol, sortOptions, allColumnDefs])

  const getCellValue = (student, headerOrKey) => {
    if (student?.[headerOrKey] !== undefined && student?.[headerOrKey] !== null) return student[headerOrKey]
    const col = OUR_COLS.find(c => c.key === headerOrKey || c.label === headerOrKey)
    return col ? (col.path(student) || '') : ''
  }

  const filtered = useMemo(() => scopedStudents.filter((s, i) => {
    if (searchMatch && !searchMatch.has(i)) return false
    if (filters.catMin && parseFloat(getVal(s, 'cat')) < parseFloat(filters.catMin)) return false
    if (filters.wxMin && parseFloat(getVal(s, 'wx')) < parseFloat(filters.wxMin)) return false
    if (filters.category && getVal(s, 'category') !== filters.category) return false
    if (filters.gender   && getVal(s, 'gender')   !== filters.gender)   return false
    if (filters.pwdOnly && (getVal(s, 'pwd') || '').toLowerCase() !== 'yes') return false
    if (filters.columnFilters?.length) {
      for (const { colKey, value } of filters.columnFilters) {
        if (value && String(getVal(s, colKey) || '').trim() !== value) return false
      }
    }
    if (filters.placementStatus) {
      // scope placement filter to the cohort's active cycle
      const cycle = selectedCohortCycle || 'final'
      const isPlaced = cycle === 'summer' ? !!s._placed_summer : !!s._placed_final
      if (filters.placementStatus === 'placed' && !isPlaced) return false
      if (filters.placementStatus === 'ytp'    &&  isPlaced) return false
    }
    return true
  }), [scopedStudents, searchMatch, filters.catMin, filters.wxMin, filters.category, filters.gender, filters.pwdOnly, filters.columnFilters, filters.placementStatus, selectedCohortCycle])

  const sortedFiltered = useMemo(() => {
    const out = [...filtered]
    out.sort((a, b) => {
      const vaRaw = getCellValue(a, sortCol)
      const vbRaw = getCellValue(b, sortCol)
      const vaNum = parseFloat(vaRaw)
      const vbNum = parseFloat(vbRaw)
      const bothNumeric = !Number.isNaN(vaNum) && !Number.isNaN(vbNum)
      if (bothNumeric) return vaNum > vbNum ? sortDir : vaNum < vbNum ? -sortDir : 0
      if (NUMERIC.includes(sortCol)) {
        const na = Number.isNaN(vaNum) ? 0 : vaNum
        const nb = Number.isNaN(vbNum) ? 0 : vbNum
        return na > nb ? sortDir : na < nb ? -sortDir : 0
      }
      const va = String(vaRaw || '').toLowerCase()
      const vb = String(vbRaw || '').toLowerCase()
      return va > vb ? sortDir : va < vb ? -sortDir : 0
    })
    return out
  }, [filtered, sortCol, sortDir])

  const exportRows = useMemo(() => sortedFiltered.map(s => {
    const out = {}
    visibleDefs.forEach(def => { out[def.label] = getCellValue(s, def.sortKey) || '' })
    return out
  }), [sortedFiltered, visibleDefs])

  const handleSort = col => {
    if (sortCol === col) setSortDir(d => -d)
    else { setSortCol(col); setSortDir(1) }
  }

  const flash = msg => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000) }

  const openPlaceModal = student => {
    setPlaceModal(student)
    setPlaceSeason(selectedCohortCycle)
    setPlacementForm(newPlacementForm())
  }

  // Close row context menu on click/scroll/resize
  useEffect(() => {
    if (!rowMenu) return
    const close = () => setRowMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [rowMenu])

  // Workspace toolbar buttons
  useEffect(() => {
    setWorkspaceActions(
      <>
        <Btn size="sm" variant="ghost" onClick={() => setColumnsOpen(true)} title="Show or hide columns">Columns</Btn>
        <Btn size="sm" variant="ghost" onClick={() => setExportOpen(true)} disabled={!exportRows.length} title={!exportRows.length ? 'No rows to export' : 'Download filtered data'}>
          <Download size={13} /> Export
        </Btn>
        <Btn size="sm" variant="ghost" onClick={() => setActionsOpen(true)}>Actions</Btn>
        {isAdmin && (
          <Btn size="sm" variant="primary" onClick={() => { setImportStep(1); setImportFile(null); setImportParsed(null); setImportMsg(''); if (fileRef.current) fileRef.current.value = ''; setImportModalOpen(true) }} disabled={importing}>
            <Upload size={13} /> {importing ? 'Importing…' : 'Import File'}
          </Btn>
        )}
      </>
    )
    return () => setWorkspaceActions(null)
  }, [setWorkspaceActions, selectedCohort, isAdmin, canDo, exportRows.length, importing])

  // ── Action handlers ────────────────────────────────────────────────────────

  const handlePushPlayground = async () => {
    setPlaygroundMsg('')
    try {
      const now = new Date()
      const dateStr = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
      // Label reflects what's actually visible: cohort scope + row count
      const cohortPart = scopedCohorts.length === 1 ? scopedCohorts[0] : `${scopedCohorts.length} cohorts`
      const label = `${cohortPart} · ${dateStr}`
      const rows = exportRows.map(r => visibleDefs.map(d => r[d.label] ?? ''))
      const headers = visibleDefs.map(d => d.label)
      const { sheetUrl, tabName, count } = await pushToPlayground({ rows, headers, label })
      setPlaygroundMsg(`✓ ${count} rows pushed as "${tabName}"`)
      setTimeout(() => setPlaygroundMsg(''), 8000)
    } catch (e) { setPlaygroundMsg('Error: ' + e.message) }
  }

  const handleImportFileChosen = async e => {
    const file = e.target.files[0]; if (!file) return
    try {
      const parsed = await parseDataFile(file, {})
      setImportFile(file); setImportParsed(parsed); setImportStep(2)
    } catch (err) { setImportMsg('Could not read file: ' + err.message) }
    e.target.value = ''
  }

  const handleProposeImport = async () => {
    if (!importParsed) return
    const cohortId = (importCohort || selectedCohort || '').trim()
    if (!cohortId) { setImportMsg('Select a cohort before importing.'); return }
    setImporting(true); setImportMsg('')
    const rowCount = importParsed.rows.length
    let succeeded = false
    try {
      await propose({ type: 'import', file: importFile, rowCount, headers: importParsed.headers, cohort: cohortId, activeCycle: importCycle, replaceExisting: replaceOnImport, updateSchema: true, includeSipData })
      succeeded = true
    } catch (err) {
      setImportMsg('Upload failed: ' + (err.message || err.code || 'Unknown error'))
    }
    setImporting(false)
    if (succeeded) { setLastImportSummary({ rowCount, cohortId }); setImportStep(3) }
  }

  const proposePlace = async () => {
    const company = placementForm.company.trim()
    if (!company) return
    const placementDate = placementForm.date || new Date().toISOString().slice(0, 10)
    const placedAtIso = new Date(`${placementDate}T00:00:00`).toISOString()
    setBusy(true)
    try {
      await propose({
        type: 'place', cohort: studentCohort(placeModal), season: placeSeason,
        studentId: placeModal._id, studentName: getVal(placeModal, 'name'), studentRoll: getVal(placeModal, 'roll'),
        company, placementDetails: { date: placementDate, company, role: placementForm.role.trim(), domain: placementForm.domain.trim(), sector: placementForm.sector.trim(), location: placementForm.location.trim(), package: placementForm.package.trim(), ctcNotes: placementForm.ctcNotes.trim(), via: placementForm.via.trim(), finalStatus: placementForm.finalStatus.trim(), placedAtIso },
      })
      flash(`Placement proposal for ${getVal(placeModal, 'name')} submitted — awaiting approval.`)
      setPlaceModal(null); setPlacementForm(newPlacementForm())
    } catch (e) { alert(e.message) }
    setBusy(false)
  }

  const proposeDelete = async s => {
    await propose({ type: 'delete', cohort: studentCohort(s), studentId: s._id, studentName: getVal(s, 'name'), studentRoll: getVal(s, 'roll') })
    flash(`Deletion of ${getVal(s, 'name')} proposed — awaiting approval.`)
  }


  // ── Table rows ─────────────────────────────────────────────────────────────

  const dynamicHeaders = [
    ...visibleDefs.map(def => ({ label: def.label, onClick: () => handleSort(def.sortKey), sorted: sortCol === def.sortKey ? sortDir : 0 })),
    { label: 'Actions', onClick: null },
  ]

  const rows = sortedFiltered.map(s => {
    const actionCell = (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {canDo('proposePlace') && (
          <Btn size="sm" variant="success" onClick={() => openPlaceModal(s)} title="Propose placement"><CheckCircle size={13} /> Place</Btn>
        )}
        {s._placed_summer && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: 'var(--amber-bg)', color: 'var(--amber-text)', border: '1px solid var(--amber)', whiteSpace: 'nowrap' }}>SIP ✓</span>}
        {s._placed_final  && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: 'var(--green-bg)', color: 'var(--green-text)', border: '1px solid var(--green-border)', whiteSpace: 'nowrap' }}>Final ✓</span>}
        <Btn size="sm" variant="ghost" onClick={() => setViewModal(s)} title="View details"><Eye size={13} /></Btn>
        {canDo('proposeDelete') && (
          <Btn size="sm" variant="ghost" onClick={() => proposeDelete(s)} title="Propose deletion"><Trash2 size={13} /></Btn>
        )}
      </div>
    )
    return [
      ...visibleDefs.map(def => <span key={def.key}>{getCellValue(s, def.key) || '—'}</span>),
      actionCell,
    ]
  })

  if (loading || batchesLoading) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Roster"
        subtitle={hasActiveCohorts ? `${scopedCohorts.length} cohort${scopedCohorts.length !== 1 ? 's' : ''} · ${sortedFiltered.length} students shown` : 'No active cohorts yet — create the first cohort to get started.'}
      />

      {isAdmin && <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xls,.xlsx" style={{ display: 'none' }} onChange={handleImportFileChosen} />}

      {!isAdmin && (
        <div style={{ margin: '12px 24px 0', padding: '9px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-2)' }}>
          <Lock size={13} /> You have read-only access. Contact an admin to make changes.
        </div>
      )}

      {successMsg && (
        <div style={{ margin: '12px 24px 0', padding: '10px 14px', background: 'var(--green-bg)', color: 'var(--green-text)', border: '1px solid var(--green-border)', borderRadius: 10, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
          <CheckCircle size={14} /> {successMsg}
        </div>
      )}

      {importMsg && (
        <div style={{ margin: '12px 24px 0', padding: '10px 14px', background: 'var(--red-bg)', color: 'var(--red-text)', border: '1px solid var(--red-border)', borderRadius: 10, fontSize: 13 }}>
          {importMsg}
        </div>
      )}

      {playgroundMsg && (
        <div style={{ margin: '12px 24px 0', padding: '10px 14px', background: playgroundMsg.startsWith('Error') ? 'var(--red-bg)' : 'var(--accent-bg)', color: playgroundMsg.startsWith('Error') ? 'var(--red-text)' : 'var(--accent-text)', border: `1px solid ${playgroundMsg.startsWith('Error') ? 'var(--red-border)' : '#BFDBFE'}`, borderRadius: 10, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
          {!playgroundMsg.startsWith('Error') && <ExternalLink size={13} />}
          {playgroundMsg}
          {playgroundUrl && !playgroundMsg.startsWith('Error') && (
            <button onClick={() => window.open(playgroundUrl, '_blank')} style={{ marginLeft: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 600, textDecoration: 'underline', fontSize: 13, fontFamily: 'var(--font-sans)' }}>Open Sheet →</button>
          )}
        </div>
      )}

      {hasActiveCohorts ? (
        <>
          {/* ── Toolbar ─────────────────────────────────────────────────────
              Row 1: search (full-width on mobile, max 320px on desktop)
              Row 2: horizontally-scrollable filter strip — never wraps,
                     no overflow on any screen size. Sort lives here too.
          ──────────────────────────────────────────────────────────────── */}
          {(() => {
            const activeFilterCount = [
              filters.catMin, filters.wxMin,
              filters.category, filters.gender, filters.placementStatus, filters.pwdOnly,
              ...(filters.columnFilters || []).map(f => f.value),
            ].filter(Boolean).length
            const sortActive = sortCol !== 'name' || sortDir !== 1

            const arrow = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236B7280' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E")`
            const chip = { height:30, padding:'0 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:12, fontFamily:'var(--font-sans)', outline:'none', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, boxSizing:'border-box' }
            const chipSelect = { ...chip, paddingRight:26, appearance:'none', WebkitAppearance:'none', backgroundImage:arrow, backgroundRepeat:'no-repeat', backgroundPosition:'right 8px center' }

            return (
              <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
                <style>{`.rfs{scrollbar-width:none;-ms-overflow-style:none}.rfs::-webkit-scrollbar{display:none}`}</style>

                {/* Single toolbar row — scrolls horizontally on narrow screens */}
                <div className="rfs" style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', overflowX:'auto', WebkitOverflowScrolling:'touch' }}>

                  {/* Search */}
                  <div style={{ position:'relative', flexShrink:0 }}>
                    <Search size={12} style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)', pointerEvents:'none' }} />
                    <input
                      placeholder="Search…"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      style={{ ...chip, paddingLeft:26, width:160 }}
                    />
                  </div>

                  {/* ── Scores group ── */}
                  <div style={{ display:'flex', alignItems:'center', gap:4, padding:'0 6px', borderRadius:8, background:'var(--surface2)', border:'1px solid var(--border)', flexShrink:0 }}>
                    <input style={{ ...chip, width:58, border:'none', background:'transparent', padding:'0 4px' }} placeholder="CAT ≥" inputMode="numeric" value={filters.catMin} onChange={e => setF('catMin', e.target.value.replace(/[^\d.]/g, ''))} />
                    <div style={{ width:1, height:12, background:'var(--border)' }} />
                    <input style={{ ...chip, width:52, border:'none', background:'transparent', padding:'0 4px' }} placeholder="WX ≥" inputMode="numeric" value={filters.wxMin} onChange={e => setF('wxMin', e.target.value.replace(/[^\d.]/g, ''))} />
                  </div>

                  {/* ── Demographics group ── */}
                  <div style={{ display:'flex', alignItems:'center', gap:4, padding:'0 4px', borderRadius:8, background:'var(--surface2)', border:'1px solid var(--border)', flexShrink:0 }}>
                    <select style={{ ...chipSelect, border:'none', background:'transparent' }} value={filters.category} onChange={e => setF('category', e.target.value)}>
                      <option value="">Category</option>
                      {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <div style={{ width:1, height:12, background:'var(--border)' }} />
                    <select style={{ ...chipSelect, border:'none', background:'transparent' }} value={filters.gender} onChange={e => setF('gender', e.target.value)}>
                      <option value="">Gender</option>
                      {genderOptions.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>

                  {/* ── Placement status group ── */}
                  <div style={{ display:'flex', alignItems:'center', gap:6, padding:'0 8px', borderRadius:8, background:'var(--surface2)', border:'1px solid var(--border)', flexShrink:0, height:30 }}>
                    <select style={{ ...chipSelect, border:'none', background:'transparent' }} value={filters.placementStatus || ''} onChange={e => setF('placementStatus', e.target.value)}>
                      <option value="">Status</option>
                      <option value="placed">Placed ({selectedCohortCycle === 'summer' ? 'SIP' : 'Final'})</option>
                      <option value="ytp">YTP ({selectedCohortCycle === 'summer' ? 'SIP' : 'Final'})</option>
                    </select>
                    <div style={{ width:1, height:12, background:'var(--border)' }} />
                    <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, cursor:'pointer', color:'var(--text-2)', whiteSpace:'nowrap' }}>
                      <input type="checkbox" checked={filters.pwdOnly} onChange={e => setF('pwdOnly', e.target.checked)} />
                      PWD
                    </label>
                  </div>

                  {/* ── Column filters group ── */}
                  {(filters.columnFilters || []).map((cf, i) => {
                    const colDef = OUR_COLS.find(c => c.key === cf.colKey)
                    return (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:0, flexShrink:0 }}>
                        <span style={{ ...chip, display:'flex', alignItems:'center', gap:4, paddingRight:4, borderRight:'none', borderRadius:'8px 0 0 8px', background:'var(--accent-bg)', borderColor:'var(--accent)', color:'var(--accent-dark)', cursor:'default' }}>
                          <span style={{ color:'var(--text-3)', fontSize:11 }}>{colDef?.label?.split(' ')[0] || cf.colKey}:</span>
                          <span style={{ fontWeight:600 }}>{cf.value}</span>
                        </span>
                        <button
                          onClick={() => setF('columnFilters', filters.columnFilters.filter((_, j) => j !== i))}
                          style={{ ...chip, width:22, padding:0, borderLeft:'none', borderRadius:'0 8px 8px 0', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-3)', background:'var(--accent-bg)', borderColor:'var(--accent)' }}
                          title="Remove filter"
                        >×</button>
                      </div>
                    )
                  })}

                  {/* + Filter button — column picker → value picker */}
                  <ColumnFilterPicker
                    colValueMap={colValueMap}
                    activeColKeys={(filters.columnFilters || []).map(f => f.colKey)}
                    onAdd={(colKey, value) => setF('columnFilters', [...(filters.columnFilters || []), { colKey, value }])}
                    chip={chip}
                    chipSelect={chipSelect}
                  />

                  <div style={{ width:1, height:14, background:'var(--border)', flexShrink:0 }} />

                  {/* ── Sort group ── */}
                  <select style={{ ...chipSelect, maxWidth:120 }} value={sortCol} onChange={e => setSortCol(e.target.value)}>
                    {sortOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>

                  <button
                    onClick={() => setSortDir(d => -d)}
                    title={sortDir === 1 ? 'Ascending' : 'Descending'}
                    style={{ ...chip, width:30, padding:0, display:'inline-flex', alignItems:'center', justifyContent:'center', fontWeight:700, ...(sortActive ? { borderColor:'var(--accent)', background:'var(--accent-bg)', color:'var(--accent)' } : { color:'var(--text-3)' }) }}
                  >{sortDir === 1 ? '↑' : '↓'}</button>

                  {/* Spacer pushes count to the right on wide screens */}
                  <div style={{ flex:1, minWidth:8 }} />

                  {/* Count — always visible, right-anchored */}
                  <span style={{ fontSize:12, color:'var(--text-3)', fontWeight:500, whiteSpace:'nowrap', fontVariantNumeric:'tabular-nums', flexShrink:0 }}>
                    {sortedFiltered.length}<span style={{ opacity:0.4 }}> / {scopedStudents.length}</span>
                  </span>

                  {(activeFilterCount > 0 || searchTerm) && (
                    <button onClick={clearFilters} style={{ ...chip, borderColor:'var(--accent)', background:'var(--accent-bg)', color:'var(--accent-text)', fontWeight:600 }}>
                      {activeFilterCount > 0 ? `${activeFilterCount} · Clear` : 'Clear'}
                    </button>
                  )}

                  {sortActive && (
                    <button onClick={() => { setSortCol('name'); setSortDir(1) }} style={{ ...chip, color:'var(--text-3)' }}>
                      Reset
                    </button>
                  )}

                </div>
              </div>
            )
          })()}

          <div style={{ flex: 1, overflow: 'auto' }}>
            <Table
              headers={dynamicHeaders}
              rows={rows}
              emptyMessage={scopedStudents.length ? 'No matches' : 'No roster yet. Import a file.'}
              onRowContextMenu={canDo('proposePlace') ? (e, idx) => {
                const target = sortedFiltered[idx]
                if (!target) return
                e.preventDefault()
                setRowMenu({ student: target, x: Math.min(e.clientX, window.innerWidth - 220), y: Math.min(e.clientY, window.innerHeight - 100) })
              } : undefined}
            />
          </div>
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 400, width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '32px 24px', textAlign: 'center', color: 'var(--text-2)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <GraduationCap size={20} color="var(--text-3)" />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>No active cohorts yet.</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 16 }}>Create a cohort, then import the file for that season.</div>
            {isAdmin && <Btn variant="primary" onClick={() => setImportModalOpen(true)}>Import file</Btn>}
          </div>
        </div>
      )}

      {/* Row context menu */}
      {canDo('proposePlace') && rowMenu && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', left: rowMenu.x, top: rowMenu.y, zIndex: 1200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', minWidth: 190, padding: 4 }}>
          <button onClick={() => { openPlaceModal(rowMenu.student); setRowMenu(null) }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-sans)', transition: 'background 0.12s ease' }}>
            Mark candidate as placed
          </button>
          <button onClick={() => { proposeDelete(rowMenu.student); setRowMenu(null) }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--red-bg)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--red-text)', fontFamily: 'var(--font-sans)', transition: 'background 0.12s ease' }}>
            Signed Out
          </button>
        </div>
      )}

      {/* Modals */}
      <PlaceModal
        student={placeModal}
        season={placeSeason} setSeason={setPlaceSeason}
        cohortCycle={selectedCohortCycle}
        form={placementForm} setForm={setPlacementForm}
        onClose={() => setPlaceModal(null)}
        onSubmit={proposePlace}
        busy={busy}
      />

      {/* View Student Modal */}
      <Modal open={!!viewModal} onClose={() => setViewModal(null)} title={viewModal ? getVal(viewModal, 'name') : ''} width={640}>
        {viewModal && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
            {allColumnDefs.map(({ key: label }) => {
              const val = getCellValue(viewModal, label)
              if (!val || val === 'NA' || val === '0') return null
              return (
                <div key={label} style={{ paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13 }}>{val}</div>
                </div>
              )
            })}
          </div>
        )}
      </Modal>


      <ColumnsModal
        open={columnsOpen} onClose={() => setColumnsOpen(false)}
        allColumnDefs={allColumnDefs} visibleCols={visibleCols}
        setVisibleCols={setVisibleCols} toggleColumn={toggleColumn}
      />

      {/* Export */}
      <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="Export filtered roster" width={500}>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>
          Exports include only the currently filtered rows and visible columns.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn onClick={() => { exportToCSV(exportRows, 'filtered_roster.csv'); setExportOpen(false) }} disabled={!exportRows.length}><Download size={13} /> CSV</Btn>
          <Btn variant="ghost" onClick={() => { exportToTSV(exportRows, 'filtered_roster.tsv'); setExportOpen(false) }} disabled={!exportRows.length}>TSV</Btn>
          <Btn variant="ghost" onClick={() => { exportToExcel(exportRows, 'filtered_roster.xlsx'); setExportOpen(false) }} disabled={!exportRows.length}>Excel</Btn>
        </div>
      </Modal>

      {/* Actions */}
      <Modal open={actionsOpen} onClose={() => setActionsOpen(false)} title="Roster actions" width={520}>
        <div style={{ display: 'grid', gap: 10 }}>

          {/* Playground section */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Playground Sheet</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 4 }}>
            Push the current filtered view as a new tab in the shared Google Sheet. Each push creates a new tab — your previous tabs are preserved.
          </div>

          {isAdmin && (
            <Btn
              variant="ghost"
              onClick={async () => { await handlePushPlayground() }}
              disabled={playgroundPushing || !exportRows.length}
              title={!exportRows.length ? 'No rows to push' : `Push ${exportRows.length} currently visible rows`}
            >
              <Sheet size={13} />
              {playgroundPushing ? 'Pushing…' : `Push ${exportRows.length} filtered rows to Playground`}
            </Btn>
          )}

          {playgroundUrl ? (
            <Btn variant="ghost" onClick={() => window.open(playgroundUrl, '_blank')}>
              <ExternalLink size={13} /> Open Playground Sheet
            </Btn>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>
              No pushes yet — the sheet link will appear here after the first push.
            </div>
          )}

        </div>
      </Modal>

      <ImportModal
        open={importModalOpen}
        onClose={() => { setImportModalOpen(false); setImportFile(null); setImportParsed(null); setImportStep(1); setImportCohort(''); setImportCycleRaw(selectedCohortCycle || 'final'); setIncludeSipDataRaw(false); setLastImportSummary(null); if (fileRef.current) fileRef.current.value = '' }}
        step={importStep}
        importCohort={importCohort} setImportCohort={setImportCohort}
        importCycle={importCycle} setImportCycle={setImportCycle}
        importFile={importFile} importParsed={importParsed}
        importing={importing} importMsg={importMsg}
        replaceOnImport={replaceOnImport} setReplaceOnImport={setReplaceOnImport}
        includeSipData={includeSipData} setIncludeSipData={setIncludeSipData}
        students={students} selectedCohort={selectedCohort} changes={changes}
        onChooseFile={() => fileRef.current.click()}
        onProposeImport={handleProposeImport}
        lastImportSummary={lastImportSummary}
        onReset={step => { setImportStep(step); setImportFile(null); setImportParsed(null); setImportCohort(''); setReplaceOnImport(false); setIncludeSipDataRaw(false); setLastImportSummary(null); if (fileRef.current) fileRef.current.value = '' }}
      />
    </div>
  )
}

// ── Column filter picker ───────────────────────────────────────────────────────
// Step 1: pick a column. Step 2: pick a value from that column's data.
function ColumnFilterPicker({ colValueMap, activeColKeys, onAdd, chip, chipSelect }) {
  const [step, setStep]       = useState(0)   // 0=closed 1=pick-col 2=pick-val
  const [colKey, setColKey]   = useState('')
  const ref                   = useRef()

  // Close on outside click
  useEffect(() => {
    if (step === 0) return
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setStep(0) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [step])

  // Filterable columns: has values in data, skip a few noisy/freetext ones
  const SKIP = new Set(['name', 'firstName', 'middleName', 'lastName', 'email', 'official_email', 'mobile', 'mobile2', 'address', 'pincode', 'cat_scorecard', 'dob', 'father', 'mother', 'roll'])
  const pickableCols = OUR_COLS.filter(c => colValueMap[c.key] && !SKIP.has(c.key))

  const values = colKey ? (colValueMap[colKey] || []) : []

  if (step === 0) {
    return (
      <button
        style={{ ...chip, color: 'var(--text-3)', display:'flex', alignItems:'center', gap:4 }}
        onClick={() => setStep(1)}
      >
        <span style={{ fontSize:15, lineHeight:1 }}>+</span> Filter
      </button>
    )
  }

  return (
    <div ref={ref} style={{ position:'relative', flexShrink:0 }}>
      {step === 1 && (
        <select
          autoFocus
          size={1}
          style={{ ...chipSelect, minWidth:160 }}
          value=""
          onChange={e => { if (e.target.value) { setColKey(e.target.value); setStep(2) } }}
        >
          <option value="" disabled>Pick column…</option>
          {pickableCols.map(c => (
            <option key={c.key} value={c.key} disabled={activeColKeys.includes(c.key)}>
              {c.label.length > 40 ? c.label.slice(0, 40) + '…' : c.label}
              {activeColKeys.includes(c.key) ? ' ✓' : ''}
            </option>
          ))}
        </select>
      )}
      {step === 2 && (
        <select
          autoFocus
          size={1}
          style={{ ...chipSelect, minWidth:160 }}
          value=""
          onChange={e => {
            if (e.target.value) { onAdd(colKey, e.target.value); setColKey(''); setStep(0) }
          }}
        >
          <option value="" disabled>Pick value…</option>
          {values.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      )}
    </div>
  )
}
