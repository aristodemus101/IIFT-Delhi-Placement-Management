import React, { useMemo, useState } from 'react'
import { useStudentsContext } from '../lib/StudentsContext'
import { useBatch } from '../lib/BatchContext'
import { cohortLabel } from '../lib/batch'
import { getVal } from '../lib/columns'
import { PageHeader, Spinner, Badge, Input, TabBar } from '../components/UI'
import { useAuth } from '../lib/AuthContext'
import { Search } from 'lucide-react'
import TpoAnalytics from './analytics/TpoAnalytics'

function studentCohort(s) {
  return s.cohort || 'unknown'
}

const HIRED_STYLE = { bg: '#16a34a', text: '#fff', label: 'Hired' }

export default function AnalyticsPage() {
  const { isFacultyCoordinator } = useAuth()
  const { students, loading: studentsLoading } = useStudentsContext()
  const { scopedCohorts } = useBatch()

  const [activeTab, setActiveTab] = useState(isFacultyCoordinator ? 'tpo' : 'heatmap')
  const [studentSearch, setStudentSearch] = useState('')
  const [companySearch, setCompanySearch] = useState('')
  // cycle filter: '' = all, 'summer' = SIP only, 'final' = Final only
  const [cycleFilter, setCycleFilter] = useState('')

  // Students scoped to selected cohorts
  const scopedStudents = useMemo(() => {
    const ids = new Set(scopedCohorts)
    return students.filter(s => ids.has(studentCohort(s)))
  }, [students, scopedCohorts])

  // Build the heatmap purely from _placed_summer / _placed_final on student docs.
  // Each unique company name becomes a column.
  // Returns: { companies: string[], data: { [roll]: { [company]: 'summer'|'final'|'both' } } }
  const { companies, heatmapData } = useMemo(() => {
    const companySet = new Set()
    const data = {}

    for (const s of scopedStudents) {
      const roll = getVal(s, 'roll')
      if (!roll) continue
      data[roll] = {}

      const hasSummer = cycleFilter !== 'final' && s._placed_summer && s._placement_summer?.company
      const hasFinal  = cycleFilter !== 'summer' && s._placed_final  && s._placement_final?.company

      if (hasSummer) {
        const co = s._placement_summer.company
        companySet.add(co)
        data[roll][co] = data[roll][co] === 'final' ? 'both' : 'summer'
      }
      if (hasFinal) {
        const co = s._placement_final.company
        companySet.add(co)
        data[roll][co] = data[roll][co] === 'summer' ? 'both' : 'final'
      }
    }

    const companies = [...companySet].sort((a, b) => a.localeCompare(b))
    return { companies, heatmapData: data }
  }, [scopedStudents, cycleFilter])

  // Filter students
  const filteredStudents = useMemo(() => {
    const q = studentSearch.toLowerCase()
    let list = scopedStudents
    if (q) list = list.filter(s =>
      getVal(s, 'name').toLowerCase().includes(q) ||
      getVal(s, 'roll').toLowerCase().includes(q)
    )
    // Only show placed students (those with at least one hired cell)
    list = list.filter(s => {
      const roll = getVal(s, 'roll')
      return Object.keys(heatmapData[roll] || {}).length > 0
    })
    // Sort: placed first, then name
    return [...list].sort((a, b) => {
      const na = getVal(a, 'name'), nb = getVal(b, 'name')
      return na.localeCompare(nb)
    })
  }, [scopedStudents, studentSearch, heatmapData])

  // Filter companies
  const filteredCompanies = useMemo(() => {
    const q = companySearch.toLowerCase()
    if (!q) return companies
    return companies.filter(c => c.toLowerCase().includes(q))
  }, [companies, companySearch])

  if (studentsLoading && !isFacultyCoordinator) return <Spinner />

  const cohortLabel_ = scopedCohorts.length === 1 ? cohortLabel(scopedCohorts[0]) : `${scopedCohorts.length} cohorts`
  const placedCount = filteredStudents.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Analytics"
        subtitle={activeTab === 'heatmap' ? `${cohortLabel_} · Placement heatmap` : 'TPO Performance'}
      />

      <TabBar
        tabs={[
          !isFacultyCoordinator && { key: 'heatmap', label: 'Placement Heatmap' },
          { key: 'tpo', label: 'TPO Performance' },
        ].filter(Boolean)}
        active={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'tpo' && <TpoAnalytics />}

      {activeTab === 'heatmap' && <>
        {/* Filters */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 2 }}>Cycle:</span>
            {[['', 'All'], ['summer', 'Summer'], ['final', 'Final']].map(([val, label]) => (
              <button key={val} onClick={() => setCycleFilter(val)} style={{
                ...pillStyle,
                ...(cycleFilter === val ? pillActive : {}),
              }}>{label}</button>
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

        {/* Summary */}
        <div style={{ padding: '8px 24px', display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', background: 'var(--surface2)', flexWrap: 'wrap' }}>
          <Badge color="green">{placedCount} placed</Badge>
          <Badge color="gray">{filteredCompanies.length} companies</Badge>
          {scopedCohorts.map(id => <Badge key={id} color="blue">{cohortLabel(id)}</Badge>)}
        </div>

        {/* Heatmap table */}
        {filteredCompanies.length === 0 || filteredStudents.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 14 }}>
            {filteredStudents.length === 0 ? 'No placed students in the selected cohorts.' : 'No companies match the filter.'}
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 11, minWidth: '100%' }}>
              <thead>
                <tr>
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
                  }}>Cycle</th>
                  {filteredCompanies.map(co => (
                    <th key={co} style={{
                      position: 'sticky', top: 0, zIndex: 2,
                      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
                      borderRight: '1px solid var(--border)',
                      padding: '6px 4px', textAlign: 'center', fontWeight: 500,
                      fontSize: 10, color: 'var(--text-2)', minWidth: 72, maxWidth: 100,
                    }} title={co}>
                      <div style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '0 auto' }}>{co}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s, si) => {
                  const roll = getVal(s, 'roll')
                  const name = getVal(s, 'name')
                  const entries = heatmapData[roll] || {}
                  const rowBg = si % 2 === 0 ? 'var(--surface)' : 'var(--surface2)'

                  // Cycle badge label
                  const hasSummer = s._placed_summer
                  const hasFinal  = s._placed_final
                  const cycleLabel = hasSummer && hasFinal ? 'S + F' : hasSummer ? 'SIP' : hasFinal ? 'Final' : ''
                  const cycleBadgeColor = hasSummer && hasFinal ? '#7c3aed' : hasSummer ? '#d97706' : '#16a34a'

                  return (
                    <tr key={roll || si} style={{ background: rowBg }}>
                      <td style={{
                        position: 'sticky', left: 0, zIndex: 1,
                        background: rowBg, borderBottom: '1px solid var(--border)',
                        borderRight: '1px solid var(--border)',
                        padding: '6px 12px', whiteSpace: 'nowrap',
                      }}>
                        <div style={{ fontWeight: 500, fontSize: 12, color: 'var(--text)' }}>{name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{roll}</div>
                      </td>
                      <td style={{
                        position: 'sticky', left: 180, zIndex: 1,
                        background: rowBg, borderBottom: '1px solid var(--border)',
                        borderRight: '2px solid var(--border)',
                        padding: '6px 10px', textAlign: 'center',
                      }}>
                        {cycleLabel && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 3,
                            background: cycleBadgeColor, color: '#fff', whiteSpace: 'nowrap',
                          }}>{cycleLabel}</span>
                        )}
                      </td>
                      {filteredCompanies.map(co => {
                        const hit = entries[co]
                        const label = hit === 'both' ? 'S + F' : hit === 'summer' ? 'SIP' : hit === 'final' ? 'Final' : null
                        const bg = hit === 'both' ? '#7c3aed' : hit === 'summer' ? '#d97706' : '#16a34a'
                        return (
                          <td key={co} style={{
                            borderBottom: '1px solid var(--border)',
                            borderRight: '1px solid var(--border)',
                            padding: 3, textAlign: 'center', verticalAlign: 'middle',
                          }} title={hit ? `${name} — Hired at ${co} (${label})` : undefined}>
                            {label && (
                              <div style={{
                                background: bg, color: '#fff',
                                borderRadius: 4, padding: '2px 4px',
                                fontSize: 9, fontWeight: 600,
                                lineHeight: 1.4, display: 'inline-block',
                              }}>
                                {label}
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
      </>}
    </div>
  )
}

const pillStyle = {
  padding: '4px 11px', borderRadius: 20, fontSize: 11, fontWeight: 600,
  cursor: 'pointer', border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text-2)',
  display: 'flex', alignItems: 'center', gap: 4,
  transition: 'background 0.12s ease, color 0.12s ease, border-color 0.12s ease',
  lineHeight: 1.6,
}
const pillActive = {
  background: 'var(--accent-bg)', color: 'var(--accent-dark)',
  border: '1px solid color-mix(in srgb, var(--accent) 50%, transparent)',
}
