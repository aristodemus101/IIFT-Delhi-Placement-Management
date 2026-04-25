import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useStudents, useColumnSchema } from '../lib/useStudents'
import { usePendingChanges } from '../lib/PendingChangesContext'
import { useAuth } from '../lib/AuthContext'
import { useSheetsSync } from '../lib/SheetsSyncContext'
import { useBatch } from '../lib/BatchContext'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { getVal, OUR_COLS } from '../lib/columns'
import { batchLabel, batchShortLabel, normalizeBatch } from '../lib/batch'
import { parseDataFile, exportToCSV, exportToTSV, exportToExcel } from '../lib/csv'
import {
  PageHeader, Btn, Badge, CategoryBadge, Input, Select,
  Spinner, Modal, Table
} from '../components/UI'
import {
  Upload, Download, CheckCircle, Trash2, Eye, AlertTriangle, Search, Lock, ExternalLink, Sheet
} from 'lucide-react'

const NUMERIC = ['cat', 'wx', 'ugpct', 'x10pct', 'x12pct', 'age', 'cat_score']
const DEFAULT_FILTERS = { name: '', catMin: '', wxMin: '', category: '', gender: '', pwdOnly: false }

const newPlacementForm = () => ({
  date: new Date().toISOString().slice(0, 10),
  company: '',
  role: '',
  sector: '',
  package: '',
  ctcNotes: '',
  via: '',
})

export default function RosterPage() {
  const { students, loading } = useStudents()
  const { selectedBatch } = useBatch()
  const { schemaHeaders } = useColumnSchema(selectedBatch)
  const { propose } = usePendingChanges()
  const { isAdmin, user } = useAuth()
  const { playgroundUrl, playgroundPushing, pushToPlayground, connected: sheetsConnected } = useSheetsSync()
  const { setWorkspaceActions } = useOutletContext()

  const [sortCol, setSortCol] = useState('name')
  const [sortDir, setSortDir] = useState(1)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [placeModal, setPlaceModal] = useState(null)
  const [placementForm, setPlacementForm] = useState(newPlacementForm)
  const [viewModal, setViewModal] = useState(null)
  const [rowMenu, setRowMenu] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [importing, setImporting] = useState(false)
  const [replaceOnImport, setReplaceOnImport] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [playgroundMsg, setPlaygroundMsg] = useState('')
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [visibleCols, setVisibleCols] = useState([])
  const [prefsReady, setPrefsReady] = useState(false)
  const fileRef = useRef()

  const scopedStudents = students.filter(s => normalizeBatch(s._batch) === selectedBatch)
  const active = scopedStudents.filter(s => !s._placed)
  const hasStudents = scopedStudents.length > 0
  const schemaCols = useMemo(() => (schemaHeaders || []).filter(Boolean), [schemaHeaders])
  const usingSchema = schemaCols.length > 0

  const fallbackColumnDefs = useMemo(() => [
    { key: 'roll', label: 'Roll No.', sortKey: 'roll' },
    { key: 'name', label: 'Name', sortKey: 'name' },
    { key: 'gender', label: 'Gender', sortKey: 'gender' },
    { key: 'cat', label: 'CAT %ile', sortKey: 'cat' },
    { key: 'category', label: 'Category', sortKey: 'category' },
    { key: 'wx', label: 'Work Ex', sortKey: 'wx' },
    { key: 'ug', label: 'UG Degree', sortKey: 'ug' },
    { key: 'ugpct', label: 'UG %', sortKey: 'ugpct' },
    { key: 'x12pct', label: 'XII %', sortKey: 'x12pct' },
    { key: 'x10pct', label: 'X %', sortKey: 'x10pct' },
  ], [])

  const allColumnDefs = useMemo(() => {
    if (usingSchema) {
      return schemaCols.map(h => ({ key: h, label: h, sortKey: h }))
    }
    return fallbackColumnDefs
  }, [usingSchema, schemaCols, fallbackColumnDefs])

  useEffect(() => {
    setPrefsReady(false)
    setVisibleCols(prev => {
      const allKeys = allColumnDefs.map(c => c.key)
      if (!allKeys.length) return []
      if (!prev.length) return allKeys
      const prevSet = new Set(prev)
      const filtered = allKeys.filter(k => prevSet.has(k))
      return filtered.length ? filtered : allKeys
    })
  }, [allColumnDefs])

  useEffect(() => {
    if (!user?.uid || !allColumnDefs.length) {
      setPrefsReady(true)
      return
    }

    let cancelled = false
    const loadPrefs = async () => {
      try {
        const snap = await getDoc(doc(db, 'userPrefs', user.uid))
        if (!snap.exists() || cancelled) {
          if (!cancelled) setPrefsReady(true)
          return
        }

        const rosterRoot = snap.data()?.roster || {}
        const roster = rosterRoot[selectedBatch] || rosterRoot
        if (typeof roster.sortCol === 'string' && roster.sortCol) setSortCol(roster.sortCol)
        if (roster.sortDir === 1 || roster.sortDir === -1) setSortDir(roster.sortDir)
        if (roster.filters && typeof roster.filters === 'object') {
          setFilters({ ...DEFAULT_FILTERS, ...roster.filters })
        } else {
          setFilters(DEFAULT_FILTERS)
        }

        if (Array.isArray(roster.visibleCols) && roster.visibleCols.length) {
          const valid = new Set(allColumnDefs.map(c => c.key))
          const next = roster.visibleCols.filter(k => valid.has(k))
          if (next.length) setVisibleCols(next)
        }
      } catch (e) {
        console.error('Failed to load roster preferences:', e)
      } finally {
        if (!cancelled) setPrefsReady(true)
      }
    }

    loadPrefs()
    return () => { cancelled = true }
  }, [user?.uid, allColumnDefs, selectedBatch])

  useEffect(() => {
    if (!user?.uid || !prefsReady || !visibleCols.length) return
    const t = setTimeout(() => {
      setDoc(doc(db, 'userPrefs', user.uid), {
        roster: {
          [selectedBatch]: {
            sortCol,
            sortDir,
            visibleCols,
            filters,
            updatedAt: serverTimestamp(),
          },
        },
      }, { merge: true }).catch(err => console.error('Failed to save roster preferences:', err))
    }, 250)
    return () => clearTimeout(t)
  }, [user?.uid, prefsReady, sortCol, sortDir, visibleCols, filters, selectedBatch])

  const visibleDefs = useMemo(() => {
    if (!visibleCols.length) return allColumnDefs
    const visibleSet = new Set(visibleCols)
    return allColumnDefs.filter(c => visibleSet.has(c.key))
  }, [allColumnDefs, visibleCols])

  const categoryOptions = useMemo(() => {
    const vals = new Set()
    active.forEach(s => {
      const v = String(getVal(s, 'category') || '').trim()
      if (v) vals.add(v)
    })
    return Array.from(vals).sort((a, b) => a.localeCompare(b))
  }, [active])

  const genderOptions = useMemo(() => {
    const vals = new Set()
    active.forEach(s => {
      const v = String(getVal(s, 'gender') || '').trim()
      if (v) vals.add(v)
    })
    return Array.from(vals).sort((a, b) => a.localeCompare(b))
  }, [active])

  const sortOptions = useMemo(
    () => visibleDefs.map(def => ({ value: def.sortKey, label: def.label })),
    [visibleDefs]
  )

  useEffect(() => {
    if (!sortOptions.length) return
    const hasCurrent = sortOptions.some(o => o.value === sortCol)
    if (hasCurrent) return

    const schemaNameCol = allColumnDefs.find(c => /full name|name/i.test(c.label))
    const next = schemaNameCol?.sortKey || sortOptions[0].value
    setSortCol(next)
    setSortDir(1)
  }, [sortCol, sortOptions, allColumnDefs])

  const filtered = useMemo(() => {
    return active.filter(s => {
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
  }, [active, filters])

  const getCellValue = (student, headerOrKey) => {
    if (student?.[headerOrKey] !== undefined && student?.[headerOrKey] !== null) return student[headerOrKey]
    const col = OUR_COLS.find(c => c.key === headerOrKey || c.label === headerOrKey)
    return col ? (col.path(student) || '') : ''
  }

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

  const exportRows = useMemo(() => {
    return sortedFiltered.map(s => {
      const out = {}
      visibleDefs.forEach(def => {
        out[def.label] = getCellValue(s, def.sortKey) || ''
      })
      return out
    })
  }, [sortedFiltered, visibleDefs])

  const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }))
  const clearFilters = () => setFilters(DEFAULT_FILTERS)
  const handleSort = col => {
    if (sortCol === col) setSortDir(d => -d)
    else { setSortCol(col); setSortDir(1) }
  }

  const toggleColumn = key => {
    setVisibleCols(prev => {
      if (prev.includes(key)) {
        if (prev.length <= 1) return prev
        return prev.filter(k => k !== key)
      }
      const nextSet = new Set([...prev, key])
      return allColumnDefs.filter(c => nextSet.has(c.key)).map(c => c.key)
    })
  }

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000) }

  const openPlaceModal = (student) => {
    setPlaceModal(student)
    setPlacementForm(newPlacementForm())
  }

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

  useEffect(() => {
    setWorkspaceActions(
      <>
        <Btn size="sm" variant="ghost" onClick={() => setColumnsOpen(true)} title="Show or hide columns">
          Columns
        </Btn>
        <Btn size="sm" variant="ghost" onClick={() => setExportOpen(true)} disabled={!exportRows.length} title={!exportRows.length ? 'No rows to export' : 'Download filtered data'}>
          <Download size={13} /> Export
        </Btn>
        {isAdmin && (
          <Btn size="sm" variant="ghost" onClick={() => setActionsOpen(true)}>
            Actions
          </Btn>
        )}
        {isAdmin && (
          <Btn size="sm" variant="primary" onClick={() => fileRef.current.click()} disabled={importing}>
            <Upload size={13} /> {importing ? 'Importing…' : 'Import File'}
          </Btn>
        )}
      </>
    )

    return () => setWorkspaceActions(null)
  }, [setWorkspaceActions, selectedBatch, isAdmin, exportRows.length, importing])

  const handlePushPlayground = async () => {
    setPlaygroundMsg('')
    try {
      const { count } = await pushToPlayground(scopedStudents)
      setPlaygroundMsg(`${count} ${batchShortLabel(selectedBatch)} batch students pushed to playground sheet.`)
      setTimeout(() => setPlaygroundMsg(''), 5000)
    } catch (e) {
      setPlaygroundMsg('Error: ' + e.message)
    }
  }

  const handleImport = async e => {
    const file = e.target.files[0]; if (!file) return
    setImporting(true); setImportMsg('')
    try {
      const { rows, headers } = await parseDataFile(file)
      await propose({
        type: 'import',
        rows,
        headers,
        rowCount: rows.length,
        batch: selectedBatch,
        replaceExisting: replaceOnImport,
        updateSchema: true,
      })
      flash(`${replaceOnImport ? 'Replace + import' : 'Import'} of ${rows.length} students to ${batchLabel(selectedBatch)} (${headers.length} columns) proposed — awaiting approval from another admin.`)
    } catch (err) {
      setImportMsg('Import failed: ' + err.message)
    }
    setImporting(false)
    fileRef.current.value = ''
  }

  const proposePlace = async () => {
    const company = placementForm.company.trim()
    if (!company) return

    const placementDate = placementForm.date || new Date().toISOString().slice(0, 10)
    const placedAtIso = new Date(`${placementDate}T00:00:00`).toISOString()

    setBusy(true)
    try {
      await propose({
        type: 'place',
        batch: selectedBatch,
        studentId: placeModal._id,
        studentName: getVal(placeModal, 'name'),
        studentRoll: getVal(placeModal, 'roll'),
        company,
        placementDetails: {
          date: placementDate,
          company,
          role: placementForm.role.trim(),
          sector: placementForm.sector.trim(),
          package: placementForm.package.trim(),
          ctcNotes: placementForm.ctcNotes.trim(),
          via: placementForm.via.trim(),
          placedAtIso,
        },
      })
      flash(`Placement proposal for ${getVal(placeModal, 'name')} submitted — awaiting approval.`)
      setPlaceModal(null)
      setPlacementForm(newPlacementForm())
    } catch (e) { alert(e.message) }
    setBusy(false)
  }

  const proposeDelete = async (s) => {
    await propose({
      type: 'delete',
      batch: selectedBatch,
      studentId: s._id,
      studentName: getVal(s, 'name'),
      studentRoll: getVal(s, 'roll'),
    })
    flash(`Deletion of ${getVal(s, 'name')} proposed — awaiting approval.`)
  }

  const proposeClearAll = async () => {
    if (!hasStudents) {
      setImportMsg('No students to clear.')
      return
    }
    await propose({
      type: 'clearAll',
      batch: selectedBatch,
      studentIds: scopedStudents.map(s => s._id),
      studentCount: scopedStudents.length,
    })
    flash(`Clear-all for ${batchLabel(selectedBatch)} proposed — awaiting approval from another admin.`)
    setConfirmClear(false)
    setActionsOpen(false)
  }

  const dynamicHeaders = [
    ...visibleDefs.map(def => ({
      label: def.label,
      onClick: () => handleSort(def.sortKey),
      sorted: sortCol === def.sortKey ? sortDir : 0,
    })),
    { label: 'Actions', onClick: null },
  ]

  const renderFallbackCell = (student, key) => {
    if (key === 'roll') return <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{getVal(student, 'roll')}</span>
    if (key === 'name') return <span style={{ fontWeight: 500 }}>{getVal(student, 'name')}</span>
    if (key === 'gender') return <span style={{ color: 'var(--text-2)' }}>{getVal(student, 'gender')}</span>
    if (key === 'cat') return <strong style={{ fontSize: 13 }}>{parseFloat(getVal(student, 'cat')).toFixed(2) || '—'}</strong>
    if (key === 'category') return <CategoryBadge category={getVal(student, 'category')} />
    if (key === 'wx') return <span>{getVal(student, 'wx') || '0'} mo</span>
    if (key === 'ug') return <span style={{ fontSize: 12 }}>{getVal(student, 'ug')}</span>
    if (key === 'ugpct') return <span>{parseFloat(getVal(student, 'ugpct')).toFixed(1) || '—'}%</span>
    if (key === 'x12pct') return <span>{parseFloat(getVal(student, 'x12pct')).toFixed(1) || '—'}%</span>
    if (key === 'x10pct') return <span>{parseFloat(getVal(student, 'x10pct')).toFixed(1) || '—'}%</span>
    const val = getCellValue(student, key)
    return <span>{val || '—'}</span>
  }

  const rows = sortedFiltered.map(s => {
    const actionCell = (
      <div style={{ display: 'flex', gap: 6 }}>
        <Btn size="sm" variant="ghost" onClick={() => setViewModal(s)} title="View details"><Eye size={13} /></Btn>
        {isAdmin && (
          <>
            <Btn size="sm" variant="success" onClick={() => openPlaceModal(s)} title="Propose placement">
              <CheckCircle size={13} /> Place
            </Btn>
            <Btn size="sm" variant="ghost" onClick={() => proposeDelete(s)} title="Propose deletion">
              <Trash2 size={13} />
            </Btn>
          </>
        )}
      </div>
    )

    return [
      ...visibleDefs.map(def => usingSchema ? <span key={def.key}>{getCellValue(s, def.sortKey) || '—'}</span> : renderFallbackCell(s, def.key)),
      actionCell,
    ]
  })

  if (loading) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Roster"
        subtitle={`${batchLabel(selectedBatch)} · ${sortedFiltered.length} of ${active.length} available candidates · ${visibleDefs.length} visible columns`}
      />

      {isAdmin && <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xls,.xlsx" style={{ display: 'none' }} onChange={handleImport} />}

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

      {playgroundMsg && (
        <div style={{ margin: '12px 28px 0', padding: '10px 14px', background: playgroundMsg.startsWith('Error') ? 'var(--red-bg)' : 'var(--accent-bg)', color: playgroundMsg.startsWith('Error') ? 'var(--red-text)' : 'var(--accent-text)', border: `1px solid ${playgroundMsg.startsWith('Error') ? 'var(--red-border)' : '#BFDBFE'}`, borderRadius: 'var(--radius-sm)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
          {!playgroundMsg.startsWith('Error') && <ExternalLink size={13} />}
          {playgroundMsg}
          {playgroundUrl && !playgroundMsg.startsWith('Error') && (
            <button onClick={() => window.open(playgroundUrl, '_blank')} style={{ marginLeft: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 600, textDecoration: 'underline', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
              Open Sheet →
            </button>
          )}
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
          {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={filters.gender} onChange={e => setF('gender', e.target.value)}>
          <option value="">All genders</option>
          {genderOptions.map(g => <option key={g} value={g}>{g}</option>)}
        </Select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--text-2)' }}>
          <input type="checkbox" checked={filters.pwdOnly} onChange={e => setF('pwdOnly', e.target.checked)} />
          PWD only
        </label>
        <Select value={sortCol} onChange={e => setSortCol(e.target.value)} title="Sort by column">
          {sortOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </Select>
        <Select value={sortDir === 1 ? 'asc' : 'desc'} onChange={e => setSortDir(e.target.value === 'asc' ? 1 : -1)} title="Sort direction">
          <option value="asc">A-Z / Low-High</option>
          <option value="desc">Z-A / High-Low</option>
        </Select>
        <Btn size="sm" variant="ghost" onClick={clearFilters}>Clear</Btn>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <Table
          headers={dynamicHeaders}
          rows={rows}
          emptyMessage={active.length ? 'No candidates match filters' : 'No candidates yet — import a file (CSV/TSV/TXT/XLS/XLSX) to get started'}
          onRowContextMenu={isAdmin ? (e, idx) => {
            const target = sortedFiltered[idx]
            if (!target) return
            e.preventDefault()
            setRowMenu({
              student: target,
              x: Math.min(e.clientX, window.innerWidth - 220),
              y: Math.min(e.clientY, window.innerHeight - 100),
            })
          } : undefined}
        />
      </div>

      {isAdmin && rowMenu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: rowMenu.x,
            top: rowMenu.y,
            zIndex: 1200,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow)',
            minWidth: 190,
            padding: 6,
          }}
        >
          <button
            onClick={() => {
              openPlaceModal(rowMenu.student)
              setRowMenu(null)
            }}
            style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}
          >
            Mark candidate as placed
          </button>
          <button
            onClick={() => {
              proposeDelete(rowMenu.student)
              setRowMenu(null)
            }}
            style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--red-text)', fontFamily: 'var(--font-sans)' }}
          >
            Signed Out
          </button>
        </div>
      )}

      {/* Propose Placement Modal */}
      <Modal open={!!placeModal} onClose={() => setPlaceModal(null)} title="Propose Placement">
        {placeModal && (
          <div>
            <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
              Proposing placement for <strong>{getVal(placeModal, 'name')}</strong>.
              A second admin will need to approve before the change is applied.
            </div>
            <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Date of placement</label>
                  <Input
                    type="date"
                    value={placementForm.date}
                    onChange={e => setPlacementForm(f => ({ ...f, date: e.target.value }))}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Placed via</label>
                  <Input
                    value={placementForm.via}
                    onChange={e => setPlacementForm(f => ({ ...f, via: e.target.value }))}
                    placeholder="Case Comp / PPO / Finals Cycle / Lateral"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Company / Organisation</label>
                <Input
                  value={placementForm.company}
                  onChange={e => setPlacementForm(f => ({ ...f, company: e.target.value }))}
                  placeholder="e.g. McKinsey & Company"
                  style={{ width: '100%' }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Role</label>
                  <Input
                    value={placementForm.role}
                    onChange={e => setPlacementForm(f => ({ ...f, role: e.target.value }))}
                    placeholder="Analyst / Consultant"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Company sector</label>
                  <Input
                    value={placementForm.sector}
                    onChange={e => setPlacementForm(f => ({ ...f, sector: e.target.value }))}
                    placeholder="Consulting / FMCG / BFSI"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Package</label>
                <Input
                  value={placementForm.package}
                  onChange={e => setPlacementForm(f => ({ ...f, package: e.target.value }))}
                  placeholder="e.g. 32 LPA"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Extra notes about CTC structure</label>
                <textarea
                  value={placementForm.ctcNotes}
                  onChange={e => setPlacementForm(f => ({ ...f, ctcNotes: e.target.value }))}
                  rows={3}
                  placeholder="Fixed pay, variable, joining bonus, retention, ESOP etc."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: 13,
                    resize: 'vertical',
                    fontFamily: 'var(--font-sans)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn onClick={() => setPlaceModal(null)}>Cancel</Btn>
              <Btn variant="success" onClick={proposePlace} disabled={!placementForm.company.trim() || busy}>
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
            {(usingSchema ? schemaCols : OUR_COLS.slice(0, 60).map(c => c.label)).map(label => {
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

      {/* Confirm Clear All */}
      <Modal open={confirmClear} onClose={() => setConfirmClear(false)} title="Propose clearing all data?">
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20 }}>
          <AlertTriangle size={18} color="var(--amber)" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
            This will submit a proposal to delete all {scopedStudents.length} students from <strong>{batchLabel(selectedBatch)}</strong>. A second admin must approve before anything is deleted.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn onClick={() => setConfirmClear(false)}>Cancel</Btn>
          <Btn variant="danger" onClick={proposeClearAll} disabled={!hasStudents}>
            <Trash2 size={13} /> Submit Proposal
          </Btn>
        </div>
      </Modal>

      {/* Column Visibility */}
      <Modal open={columnsOpen} onClose={() => setColumnsOpen(false)} title="Show or hide columns" width={620}>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
          Choose which columns appear in roster and exports. At least one column must remain visible.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Btn size="sm" variant="ghost" onClick={() => setVisibleCols(allColumnDefs.map(c => c.key))}>Select all</Btn>
          <Btn size="sm" variant="ghost" onClick={() => setVisibleCols(allColumnDefs.slice(0, 1).map(c => c.key))}>Show first only</Btn>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', maxHeight: 360, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, background: 'var(--surface2)' }}>
          {allColumnDefs.map(def => {
            const checked = visibleCols.includes(def.key)
            const disableUncheck = checked && visibleCols.length <= 1
            return (
              <label key={def.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: disableUncheck ? 'not-allowed' : 'pointer', opacity: disableUncheck ? 0.6 : 1 }}>
                <input type="checkbox" checked={checked} disabled={disableUncheck} onChange={() => toggleColumn(def.key)} />
                <span>{def.label}</span>
              </label>
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <Btn variant="primary" onClick={() => setColumnsOpen(false)}>Done</Btn>
        </div>
      </Modal>

      {/* Export */}
      <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="Export filtered roster" width={500}>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>
          Exports include only the currently filtered rows and visible columns.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn onClick={() => { exportToCSV(exportRows, 'filtered_roster.csv'); setExportOpen(false) }} disabled={!exportRows.length}>
            <Download size={13} /> CSV
          </Btn>
          <Btn variant="ghost" onClick={() => { exportToTSV(exportRows, 'filtered_roster.tsv'); setExportOpen(false) }} disabled={!exportRows.length}>
            TSV
          </Btn>
          <Btn variant="ghost" onClick={() => { exportToExcel(exportRows, 'filtered_roster.xlsx'); setExportOpen(false) }} disabled={!exportRows.length}>
            Excel
          </Btn>
        </div>
      </Modal>

      {/* Actions */}
      <Modal open={actionsOpen} onClose={() => setActionsOpen(false)} title="Roster actions" width={560}>
        <div style={{ display: 'grid', gap: 14 }}>
          {playgroundUrl && (
            <Btn variant="ghost" onClick={() => window.open(playgroundUrl, '_blank')}>
              <ExternalLink size={13} /> Open Playground
            </Btn>
          )}

          <Btn variant="ghost" onClick={handlePushPlayground} disabled={playgroundPushing || !sheetsConnected} title={!sheetsConnected ? 'Connect Sheets in Team Access first' : 'Push current roster to playground sheet'}>
            <Sheet size={13} /> {playgroundPushing ? 'Pushing…' : `Push ${batchShortLabel(selectedBatch)} to Playground`}
          </Btn>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-2)', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: replaceOnImport ? 'var(--amber-bg)' : 'var(--surface2)' }}>
            <input type="checkbox" checked={replaceOnImport} onChange={e => setReplaceOnImport(e.target.checked)} />
            Replace existing {batchShortLabel(selectedBatch)} roster on next import
          </label>

          <Btn variant="danger" onClick={() => { setConfirmClear(true); setActionsOpen(false) }} disabled={!hasStudents}>
            <Trash2 size={13} /> Clear All
          </Btn>
        </div>
      </Modal>
    </div>
  )
}
