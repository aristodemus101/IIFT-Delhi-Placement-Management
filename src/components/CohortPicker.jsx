// Structured cohort picker: year dropdown + campus dropdown + programme dropdown
// Enforces campus×programme validity rules defined in batch.js
import React, { useState, useEffect } from 'react'
import {
  cohortYearOptions, CAMPUSES, PROGRAMMES,
  campusesForProgramme, programmesForCampus,
  makeCohortId, parseCohortId, cohortLabel,
} from '../lib/batch'

const selectStyle = {
  height: 34, padding: '0 10px', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', background: 'var(--surface)',
  color: 'var(--text)', fontSize: 13, cursor: 'pointer', outline: 'none',
  minWidth: 0,
}

/**
 * Props:
 *   value        — cohort ID string e.g. 'D27-Delhi-IB'
 *   onChange     — (id: string) => void
 *   disabled     — bool
 *   showPreview  — bool, shows the resolved label below (default true)
 */
export default function CohortPicker({ value = '', onChange, disabled = false, showPreview = true }) {
  const parsed = parseCohortId(value)
  const [year, setYear]   = useState(parsed.yearCode || '')
  const [campus, setCampus] = useState(parsed.campus || '')
  const [prog, setProg]   = useState(parsed.programme || '')

  // Sync outward whenever internal state changes
  useEffect(() => {
    onChange?.(makeCohortId(year, campus, prog))
  }, [year, campus, prog]) // eslint-disable-line react-hooks/exhaustive-deps

  // When programme changes, if the current campus is no longer valid, clear it
  const handleProg = (p) => {
    setProg(p)
    if (p && campus && !campusesForProgramme(p).includes(campus)) {
      setCampus('')
    }
  }

  // When campus changes, if current programme is no longer valid, clear it
  const handleCampus = (c) => {
    setCampus(c)
    if (c && prog && !programmesForCampus(c).includes(prog)) {
      setProg('')
    }
  }

  const validCampuses = campusesForProgramme(prog)
  const validProgs    = programmesForCampus(campus)
  const yearOptions   = cohortYearOptions()
  const resolvedId    = makeCohortId(year, campus, prog)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {/* Year */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Year</div>
          <select value={year} onChange={e => setYear(e.target.value)} disabled={disabled} style={{ ...selectStyle, width: '100%' }}>
            <option value="">— select —</option>
            {yearOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Campus */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Campus</div>
          <select value={campus} onChange={e => handleCampus(e.target.value)} disabled={disabled} style={{ ...selectStyle, width: '100%' }}>
            <option value="">— select —</option>
            {CAMPUSES.map(c => (
              <option key={c} value={c} disabled={!validCampuses.includes(c)}>
                {c}{!validCampuses.includes(c) ? ' (n/a)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Programme */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Programme</div>
          <select value={prog} onChange={e => handleProg(e.target.value)} disabled={disabled} style={{ ...selectStyle, width: '100%' }}>
            <option value="">— select —</option>
            {PROGRAMMES.map(p => (
              <option key={p} value={p} disabled={campus ? !validProgs.includes(p) : false}>
                {p}{campus && !validProgs.includes(p) ? ' (n/a)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showPreview && resolvedId && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-2)', padding: '6px 10px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          Cohort ID: <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{resolvedId}</strong>
          <span style={{ color: 'var(--text-3)', marginLeft: 8 }}>"{cohortLabel(resolvedId)}"</span>
        </div>
      )}
    </div>
  )
}
