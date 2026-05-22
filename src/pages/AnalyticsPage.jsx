import React, { useMemo, useState, useEffect } from 'react'
import { collectionGroup, onSnapshot, query, collection, orderBy } from 'firebase/firestore'
import { db, auth } from '../lib/firebase'
import { useStudents } from '../lib/useStudents'
import { useBatch } from '../lib/BatchContext'
import { cohortLabel, seasonLabel } from '../lib/batch'
import { getVal } from '../lib/columns'
import { PageHeader, Spinner, Badge, Input } from '../components/UI'
import { Search } from 'lucide-react'

// Stage rank — higher = further in the process
const STAGE_RANK = { applied: 1, shortlisted: 2, interviewing: 3, selected: 4, rejected: -1 }
const STAGE_LABEL = { applied: 'Applied', shortlisted: 'Shortlisted', interviewing: 'Interview', selected: 'Offer', rejected: 'Rejected' }

// Cell colours by stage
const CELL_STYLE = {
  selected:     { bg: '#16a34a', text: '#fff', label: 'Offer' },
  interviewing: { bg: '#d97706', text: '#fff', label: 'Interview' },
  shortlisted:  { bg: '#ca8a04', text: '#fff', label: 'Shortlisted' },
  applied:      { bg: '#cbd5e1', text: '#334155', label: 'Applied' },
  rejected:     { bg: '#fca5a5', text: '#7f1d1d', label: 'Rejected' },
}

function useAllApplicants() {
  const [applicants, setApplicants] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub = null
    const unsubAuth = auth.onAuthStateChanged(u => {
      if (unsub) { unsub(); unsub = null }
      if (!u) { setApplicants([]); setLoading(false); return }
      // collectionGroup reads every /opportunities/{id}/applicants subcollection at once
      unsub = onSnapshot(
        collectionGroup(db, 'applicants'),
        snap => {
          setApplicants(snap.docs.map(d => ({
            ...d.data(),
            _oppId: d.ref.parent.parent.id,
          })))
          setLoading(false)
        },
        () => setLoading(false)
      )
    })
    return () => { unsubAuth(); if (unsub) unsub() }
  }, [])

  return { applicants, loading }
}

function useAllOpportunities() {
  const [opps, setOpps] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub = null
    const unsubAuth = auth.onAuthStateChanged(u => {
      if (unsub) { unsub(); unsub = null }
      if (!u) { setOpps([]); setLoading(false); return }
      const q = query(collection(db, 'opportunities'), orderBy('createdAt', 'desc'))
      unsub = onSnapshot(q, snap => {
        setOpps(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
      }, () => setLoading(false))
    })
    return () => { unsubAuth(); if (unsub) unsub() }
  }, [])

  return { opps, loading }
}

function studentCohort(s) {
  return s.cohort || 'unknown'
}

export default function AnalyticsPage() {
  const { students, loading: studentsLoading } = useStudents()
  const { scopedCohorts, selectedSeason } = useBatch()
  const { applicants, loading: appsLoading } = useAllApplicants()
  const { opps, loading: oppsLoading } = useAllOpportunities()

  const [studentSearch, setStudentSearch] = useState('')
  const [companySearch, setCompanySearch] = useState('')
  const [stageFilter, setStageFilter] = useState('') // '' = all

  const loading = studentsLoading || appsLoading || oppsLoading

  // Students in scope
  const scopedStudents = useMemo(() => {
    const ids = new Set(scopedCohorts)
    return students.filter(s => ids.has(studentCohort(s)))
  }, [students, scopedCohorts])

  // Build oppId → company map
  const oppMap = useMemo(() => {
    const m = {}
    opps.forEach(o => { m[o.id] = o })
    return m
  }, [opps])

  // Build roll → { oppId: highestStage } map
  const heatmapData = useMemo(() => {
    // roll → { [oppId]: status }
    const m = {}
    applicants.forEach(a => {
      const roll = a.roll || a.id
      if (!roll) return
      if (!m[roll]) m[roll] = {}
      const existing = m[roll][a._oppId]
      const existingRank = STAGE_RANK[existing] || 0
      const newRank = STAGE_RANK[a.status] || 0
      if (newRank > existingRank) m[roll][a._oppId] = a.status
    })
    return m
  }, [applicants])

  // Which companies appear at all in the heatmap for scoped students
  const activeOppIds = useMemo(() => {
    const rolls = new Set(scopedStudents.map(s => getVal(s, 'roll')))
    const oppSet = new Set()
    Object.entries(heatmapData).forEach(([roll, oppEntries]) => {
      if (rolls.has(roll)) Object.keys(oppEntries).forEach(id => oppSet.add(id))
    })
    // Sort by company name
    return [...oppSet].sort((a, b) => {
      const ca = oppMap[a]?.organization || oppMap[a]?.title || ''
      const cb = oppMap[b]?.organization || oppMap[b]?.title || ''
      return ca.localeCompare(cb)
    })
  }, [heatmapData, scopedStudents, oppMap])

  // Apply filters
  const filteredStudents = useMemo(() => {
    const q = studentSearch.toLowerCase()
    let list = scopedStudents
    if (q) list = list.filter(s =>
      getVal(s, 'name').toLowerCase().includes(q) ||
      getVal(s, 'roll').toLowerCase().includes(q)
    )
    if (stageFilter) {
      list = list.filter(s => {
        const roll = getVal(s, 'roll')
        const entries = heatmapData[roll] || {}
        return Object.values(entries).some(status => status === stageFilter)
      })
    }
    // Sort by shortlist count desc
    return [...list].sort((a, b) => {
      const ra = getVal(a, 'roll'), rb = getVal(b, 'roll')
      const ca = Object.keys(heatmapData[ra] || {}).length
      const cb = Object.keys(heatmapData[rb] || {}).length
      return cb - ca
    })
  }, [scopedStudents, studentSearch, stageFilter, heatmapData])

  const filteredOppIds = useMemo(() => {
    const q = companySearch.toLowerCase()
    if (!q) return activeOppIds
    return activeOppIds.filter(id => {
      const o = oppMap[id]
      return (o?.organization || o?.title || '').toLowerCase().includes(q)
    })
  }, [activeOppIds, companySearch, oppMap])

  if (loading) return <Spinner />

  const cohortLabel_ = scopedCohorts.length === 1 ? cohortLabel(scopedCohorts[0]) : `${scopedCohorts.length} cohorts`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Analytics"
        subtitle={`${cohortLabel_} · ${seasonLabel(selectedSeason)} · Student × Company pipeline heatmap`}
      />

      {/* Legend + filters */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', background: 'var(--surface)' }}>
        {/* Stage legend / filter */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 2 }}>Stage:</span>
          <button onClick={() => setStageFilter('')} style={{ ...pillStyle, ...(stageFilter === '' ? pillActive : {}) }}>All</button>
          {Object.entries(CELL_STYLE).map(([stage, { bg, text, label }]) => (
            <button key={stage} onClick={() => setStageFilter(stageFilter === stage ? '' : stage)} style={{
              ...pillStyle,
              background: stageFilter === stage ? bg : 'var(--surface)',
              color: stageFilter === stage ? text : 'var(--text-2)',
              border: `1px solid ${stageFilter === stage ? bg : 'var(--border)'}`,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: bg, display: 'inline-block', marginRight: 4 }} />
              {label}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
            <Input placeholder="Student…" value={studentSearch} onChange={e => setStudentSearch(e.target.value)} style={{ paddingLeft: 28, width: 150, height: 30, fontSize: 12 }} />
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
            <Input placeholder="Company…" value={companySearch} onChange={e => setCompanySearch(e.target.value)} style={{ paddingLeft: 28, width: 150, height: 30, fontSize: 12 }} />
          </div>
        </div>
      </div>

      {/* Summary chips */}
      <div style={{ padding: '8px 24px', display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', background: 'var(--surface2)', flexWrap: 'wrap' }}>
        <Badge color="blue">{filteredStudents.length} students</Badge>
        <Badge color="gray">{filteredOppIds.length} companies</Badge>
        {scopedCohorts.map(id => <Badge key={id} color="blue">{cohortLabel(id)}</Badge>)}
      </div>

      {/* Heatmap */}
      {filteredOppIds.length === 0 || filteredStudents.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 14 }}>
          {filteredStudents.length === 0 ? 'No students match the current filters.' : 'No pipeline data yet — post opportunities and release shortlists in the Activity tab.'}
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11, minWidth: '100%' }}>
            <thead>
              <tr>
                {/* Sticky student column header */}
                <th style={{
                  position: 'sticky', left: 0, top: 0, zIndex: 3,
                  background: 'var(--surface)', borderBottom: '1px solid var(--border)',
                  borderRight: '1px solid var(--border)',
                  padding: '8px 12px', textAlign: 'left', fontWeight: 600,
                  fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em',
                  minWidth: 180, whiteSpace: 'nowrap',
                }}>
                  Student · Roll
                </th>
                <th style={{
                  position: 'sticky', left: 180, top: 0, zIndex: 3,
                  background: 'var(--surface)', borderBottom: '1px solid var(--border)',
                  borderRight: '2px solid var(--border)',
                  padding: '8px 10px', textAlign: 'center', fontWeight: 600,
                  fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em',
                  minWidth: 50, whiteSpace: 'nowrap',
                }}>
                  #
                </th>
                {filteredOppIds.map(id => {
                  const o = oppMap[id]
                  const company = o?.organization || o?.title || id
                  return (
                    <th key={id} style={{
                      position: 'sticky', top: 0, zIndex: 2,
                      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
                      borderRight: '1px solid var(--border)',
                      padding: '6px 4px', textAlign: 'center', fontWeight: 500,
                      fontSize: 10, color: 'var(--text-2)', minWidth: 72, maxWidth: 90,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }} title={company}>
                      <div style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', margin: '0 auto' }}>{company}</div>
                      {o?.via && <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 400 }}>{o.via}</div>}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s, si) => {
                const roll = getVal(s, 'roll')
                const name = getVal(s, 'name')
                const entries = heatmapData[roll] || {}
                const shortlistCount = Object.values(entries).filter(st => STAGE_RANK[st] >= STAGE_RANK.shortlisted).length
                const rowBg = si % 2 === 0 ? 'var(--surface)' : 'var(--surface2)'

                return (
                  <tr key={roll || si} style={{ background: rowBg }}>
                    {/* Sticky name cell */}
                    <td style={{
                      position: 'sticky', left: 0, zIndex: 1,
                      background: rowBg, borderBottom: '1px solid var(--border)',
                      borderRight: '1px solid var(--border)',
                      padding: '6px 12px', whiteSpace: 'nowrap',
                    }}>
                      <div style={{ fontWeight: 500, fontSize: 12, color: 'var(--text)' }}>{name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{roll}</div>
                    </td>
                    {/* Shortlist count */}
                    <td style={{
                      position: 'sticky', left: 180, zIndex: 1,
                      background: rowBg, borderBottom: '1px solid var(--border)',
                      borderRight: '2px solid var(--border)',
                      padding: '6px 10px', textAlign: 'center',
                      fontWeight: 700, fontSize: 12,
                      color: shortlistCount > 4 ? 'var(--green-text)' : shortlistCount > 1 ? 'var(--amber-text)' : 'var(--text-3)',
                    }}>
                      {shortlistCount || '—'}
                    </td>
                    {/* Stage cells */}
                    {filteredOppIds.map(oppId => {
                      const status = entries[oppId]
                      const style = status ? CELL_STYLE[status] : null
                      return (
                        <td key={oppId} style={{
                          borderBottom: '1px solid var(--border)',
                          borderRight: '1px solid var(--border)',
                          padding: 3, textAlign: 'center', verticalAlign: 'middle',
                        }} title={status ? `${name} — ${STAGE_LABEL[status] || status}` : undefined}>
                          {style && (
                            <div style={{
                              background: style.bg, color: style.text,
                              borderRadius: 4, padding: '2px 4px',
                              fontSize: 9, fontWeight: 600,
                              lineHeight: 1.4, display: 'inline-block',
                            }}>
                              {style.label}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const pillStyle = {
  padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
  cursor: 'pointer', border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text-2)',
  display: 'flex', alignItems: 'center',
}
const pillActive = {
  background: 'var(--accent-bg)', color: 'var(--accent-dark)',
  border: '1px solid var(--accent)',
}
