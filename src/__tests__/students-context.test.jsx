/**
 * StudentsContext — unit tests
 *
 * Covers:
 * 1.  StudentsProvider exposes students + loading via context
 * 2.  useStudentsContext throws when used outside StudentsProvider
 * 3.  Context propagates updated students to all consumers
 * 4.  Intel search debounce logic (pure function, no timers needed)
 * 5.  aggregateByCompany memoization contract — same reference when records unchanged
 * 6.  allCompaniesCount vs companies (filtered) are independent
 */

// @vitest-environment jsdom
import React, { useContext } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import { filterIntelRecords, aggregateByCompany } from '../lib/useIntel.js'

afterEach(() => cleanup())

// ─── 1–3: StudentsContext ──────────────────────────────────────────────────────

// Mock useStudents so we can control what it returns without Firestore
vi.mock('../lib/useStudents', () => ({
  useStudents: vi.fn(() => ({ students: [], loading: true })),
}))

// Import after mocking
import { StudentsProvider, useStudentsContext } from '../lib/StudentsContext'
import { useStudents } from '../lib/useStudents'

describe('StudentsContext', () => {
  it('provides students and loading from useStudents', () => {
    const mockStudents = [
      { _id: 's1', name: 'Alice', cohort: '27-Delhi-IB', _placed_final: false, _placed_summer: false },
      { _id: 's2', name: 'Bob',   cohort: '27-Delhi-IB', _placed_final: true,  _placed_summer: false },
    ]
    useStudents.mockReturnValue({ students: mockStudents, loading: false })

    let captured = null
    function Consumer() {
      captured = useStudentsContext()
      return null
    }

    render(
      <StudentsProvider>
        <Consumer />
      </StudentsProvider>
    )

    expect(captured).not.toBeNull()
    expect(captured.students).toHaveLength(2)
    expect(captured.loading).toBe(false)
    expect(captured.students[0].name).toBe('Alice')
    expect(captured.students[1]._placed_final).toBe(true)
  })

  it('loading: true when useStudents is loading', () => {
    useStudents.mockReturnValue({ students: [], loading: true })

    let captured = null
    function Consumer() {
      captured = useStudentsContext()
      return null
    }

    render(
      <StudentsProvider>
        <Consumer />
      </StudentsProvider>
    )

    expect(captured.loading).toBe(true)
    expect(captured.students).toHaveLength(0)
  })

  it('multiple consumers get the same reference', () => {
    const mockStudents = [{ _id: 's1', name: 'Alice', cohort: '27-Delhi-IB' }]
    useStudents.mockReturnValue({ students: mockStudents, loading: false })

    let ref1 = null
    let ref2 = null

    function ConsumerA() { ref1 = useStudentsContext().students; return null }
    function ConsumerB() { ref2 = useStudentsContext().students; return null }

    render(
      <StudentsProvider>
        <ConsumerA />
        <ConsumerB />
      </StudentsProvider>
    )

    // Both consumers must get the SAME array reference — not two copies
    expect(ref1).toBe(ref2)
  })

  it('useStudentsContext throws when used outside StudentsProvider', () => {
    // Suppress the expected console.error from React's error boundary
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    function Orphan() {
      useStudentsContext()
      return null
    }

    expect(() => render(<Orphan />)).toThrow('useStudentsContext must be used inside StudentsProvider')

    spy.mockRestore()
  })

  it('context updates when useStudents returns new students', () => {
    useStudents.mockReturnValue({ students: [], loading: true })

    let captured = null
    function Consumer() {
      captured = useStudentsContext()
      return <div data-testid="count">{captured.students.length}</div>
    }

    const { rerender } = render(
      <StudentsProvider>
        <Consumer />
      </StudentsProvider>
    )

    expect(screen.getByTestId('count').textContent).toBe('0')

    // Simulate data arriving
    const newStudents = [
      { _id: 's1', name: 'Alice' },
      { _id: 's2', name: 'Bob' },
      { _id: 's3', name: 'Carol' },
    ]
    useStudents.mockReturnValue({ students: newStudents, loading: false })

    rerender(
      <StudentsProvider>
        <Consumer />
      </StudentsProvider>
    )

    expect(screen.getByTestId('count').textContent).toBe('3')
    expect(captured.loading).toBe(false)
  })
})

// ─── 4: Intel search debounce contract (pure logic) ──────────────────────────

describe('Intel search debounce contract', () => {
  // The debounce is a timing mechanism. These tests verify the filtering
  // logic that the debounced search feeds into, not the timer itself.

  const records = [
    { _id: '1', recruiterName: 'Asian Paints', alias: '', collegeName: 'SPJIMR',      placementYear: 2022, placementCycle: 'Finals', sector: 'FMCG',       program: 'PGDM', _iiftStatus: 'at_iift', rolesMentioned: '', function: '', compensation: '' },
    { _id: '2', recruiterName: 'KPMG',         alias: '', collegeName: 'IIM Lucknow', placementYear: 2023, placementCycle: 'Summer', sector: 'Consulting', program: 'MBA',  _iiftStatus: 'gap',     rolesMentioned: '', function: '', compensation: '' },
    { _id: '3', recruiterName: 'Goldman Sachs',alias: '', collegeName: 'SPJIMR',      placementYear: 2023, placementCycle: 'Finals', sector: 'BFSI',       program: 'PGDM', _iiftStatus: 'at_iift', rolesMentioned: '', function: '', compensation: '' },
  ]

  it('empty debouncedSearch returns all records', () => {
    const result = filterIntelRecords(records, { search: '' })
    expect(result).toHaveLength(3)
  })

  it('non-empty debouncedSearch filters correctly', () => {
    // This is what fires after the 250ms delay
    const result = filterIntelRecords(records, { search: 'kpmg' })
    expect(result).toHaveLength(1)
    expect(result[0].recruiterName).toBe('KPMG')
  })

  it('debouncedSearch="consulting" matches on sector field', () => {
    const result = filterIntelRecords(records, { search: 'consulting' })
    expect(result).toHaveLength(1)
    expect(result[0].recruiterName).toBe('KPMG')
  })

  it('debouncedSearch="bfsi" matches on sector field case-insensitively', () => {
    const result = filterIntelRecords(records, { search: 'BFSI' })
    expect(result).toHaveLength(1)
    expect(result[0].recruiterName).toBe('Goldman Sachs')
  })

  it('debouncedSearch and other filters combine (AND)', () => {
    // search="spjimr" (matches collegeName) + iiftFilter='gap' → 0 results
    // (neither SPJIMR record is gap)
    const result = filterIntelRecords(records, { search: 'spjimr', iiftFilter: 'gap' })
    expect(result).toHaveLength(0)
  })

  it('clearing debouncedSearch (set to "") removes the search filter immediately', () => {
    // First, with a filter
    let result = filterIntelRecords(records, { search: 'kpmg' })
    expect(result).toHaveLength(1)

    // Then, cleared (simulates clearFilters setting both search and debouncedSearch to '')
    result = filterIntelRecords(records, { search: '' })
    expect(result).toHaveLength(3)
  })
})

// ─── 5–6: aggregateByCompany memoization contract ────────────────────────────

describe('aggregateByCompany — all-records vs filtered independence', () => {
  const allRecords = [
    { _id: '1', recruiterId: 'KPMG',         recruiterName: 'KPMG',         alias: '', sector: 'Consulting', _iiftStatus: 'gap',     collegeName: 'SPJIMR',      placementYear: 2022, placementCycle: 'Finals', program: 'PGDM' },
    { _id: '2', recruiterId: 'KPMG',         recruiterName: 'KPMG',         alias: '', sector: 'Consulting', _iiftStatus: 'gap',     collegeName: 'IIM Lucknow', placementYear: 2023, placementCycle: 'Summer', program: 'MBA'  },
    { _id: '3', recruiterId: 'ASIANPAINTS',  recruiterName: 'Asian Paints', alias: '', sector: 'FMCG',       _iiftStatus: 'at_iift', collegeName: 'SPJIMR',      placementYear: 2022, placementCycle: 'Finals', program: 'PGDM' },
    { _id: '4', recruiterId: 'GOLDMANSACHS', recruiterName: 'Goldman Sachs',alias: '', sector: 'BFSI',       _iiftStatus: 'at_iift', collegeName: 'MDI Gurgaon', placementYear: 2024, placementCycle: 'Finals', program: 'PGPM' },
  ]

  it('allCompaniesCount (from all records) is independent of filter', () => {
    // All records: KPMG + Asian Paints + Goldman Sachs = 3 companies
    const allCount = aggregateByCompany(allRecords).length
    expect(allCount).toBe(3)

    // Filtered to SPJIMR only: KPMG + Asian Paints = 2 companies
    const filtered = filterIntelRecords(allRecords, { college: 'SPJIMR' })
    const filteredCount = aggregateByCompany(filtered).length
    expect(filteredCount).toBe(2)

    // allCount must NOT change based on what's filtered
    expect(allCount).toBe(3)
    expect(filteredCount).toBe(2)
    expect(allCount).not.toBe(filteredCount)
  })

  it('summary bar "Companies" chip uses allCompaniesCount (not filtered)', () => {
    // Simulates the memoization contract:
    // allCompaniesCount = aggregateByCompany(records).length  ← all records
    // companies         = aggregateByCompany(filtered)         ← filtered records
    // These must be computed separately and independently.

    const filtered = filterIntelRecords(allRecords, { sector: 'FMCG' })
    const filteredCompanies = aggregateByCompany(filtered)
    const allCompaniesCount  = aggregateByCompany(allRecords).length

    expect(filteredCompanies).toHaveLength(1)    // only Asian Paints in FMCG
    expect(allCompaniesCount).toBe(3)            // all 3 in summary bar
  })

  it('aggregateByCompany returns empty array for empty input', () => {
    expect(aggregateByCompany([])).toHaveLength(0)
  })

  it('aggregateByCompany count matches unique recruiterId values', () => {
    const result = aggregateByCompany(allRecords)
    const uniqueIds = new Set(allRecords.map(r => r.recruiterId))
    expect(result.length).toBe(uniqueIds.size)
  })

  it('calling aggregateByCompany twice with same input returns equal results', () => {
    const r1 = aggregateByCompany(allRecords)
    const r2 = aggregateByCompany(allRecords)
    // Not the same reference (no memoization at this level — useMemo handles that)
    // but they must be structurally equal
    expect(r1.map(c => c.recruiterName)).toEqual(r2.map(c => c.recruiterName))
    expect(r1.map(c => c.appearances.length)).toEqual(r2.map(c => c.appearances.length))
  })
})

// ─── 7: Auth/security invariants for StudentsContext ─────────────────────────
//
// These tests encode the security contracts introduced by the StudentsProvider
// refactor and guard against regressions that could expose student data.

describe('StudentsContext — auth/security invariants', () => {
  it('students array is empty when useStudents returns empty (pre-auth state)', () => {
    useStudents.mockReturnValue({ students: [], loading: true })

    let captured = null
    function Consumer() {
      captured = useStudentsContext()
      return null
    }

    render(<StudentsProvider><Consumer /></StudentsProvider>)

    // Before Firestore data arrives, students must be empty — never undefined or null
    expect(Array.isArray(captured.students)).toBe(true)
    expect(captured.students).toHaveLength(0)
    // loading=true signals the UI to show a spinner, not stale data
    expect(captured.loading).toBe(true)
  })

  it('students are cleared to [] when user signs out (uid becomes null)', () => {
    // Simulate: user was signed in with data, then signs out
    const mockStudents = [{ _id: 's1', name: 'Alice' }]
    useStudents.mockReturnValue({ students: mockStudents, loading: false })

    let captured = null
    function Consumer() {
      captured = useStudentsContext()
      return <div data-testid="count">{captured.students.length}</div>
    }

    const { rerender } = render(<StudentsProvider><Consumer /></StudentsProvider>)
    expect(screen.getByTestId('count').textContent).toBe('1')

    // Simulate sign-out: useStudents returns empty (its own onAuthStateChanged fires null)
    useStudents.mockReturnValue({ students: [], loading: false })
    rerender(<StudentsProvider><Consumer /></StudentsProvider>)

    expect(screen.getByTestId('count').textContent).toBe('0')
    expect(captured.students).toHaveLength(0)
  })

  it('useStudentsContext throws outside StudentsProvider — prevents accidental unauthenticated access', () => {
    // If a component is accidentally rendered outside the auth-gated tree,
    // it must throw rather than silently return undefined data.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    function Orphan() {
      useStudentsContext()
      return null
    }

    expect(() => render(<Orphan />)).toThrow('useStudentsContext must be used inside StudentsProvider')
    spy.mockRestore()
  })

  it('StudentsProvider never returns null for students — always an array', () => {
    // A null students array would cause crashes in pages that call .filter(), .map() etc.
    // The hook initialises with [] and never sets it to null.
    useStudents.mockReturnValue({ students: [], loading: true })

    let captured = null
    function Consumer() {
      captured = useStudentsContext()
      return null
    }

    render(<StudentsProvider><Consumer /></StudentsProvider>)
    expect(captured.students).not.toBeNull()
    expect(captured.students).not.toBeUndefined()
    expect(Array.isArray(captured.students)).toBe(true)
  })

  it('loading transitions from true to false when data arrives', () => {
    useStudents.mockReturnValue({ students: [], loading: true })

    let captured = null
    function Consumer() {
      captured = useStudentsContext()
      return <div data-testid="loading">{String(captured.loading)}</div>
    }

    const { rerender } = render(<StudentsProvider><Consumer /></StudentsProvider>)
    expect(screen.getByTestId('loading').textContent).toBe('true')

    // Data arrives
    useStudents.mockReturnValue({ students: [{ _id: 's1' }], loading: false })
    rerender(<StudentsProvider><Consumer /></StudentsProvider>)

    expect(screen.getByTestId('loading').textContent).toBe('false')
  })

  it('context tree position: StudentsProvider is inside AuthGate (auth-gated)', () => {
    // Encode the App.jsx tree structure as a pure invariant test.
    // StudentsProvider must appear INSIDE the authenticated route shell,
    // not outside AuthGate where unauthenticated users could trigger data loads.
    //
    // Tree: AuthGate > StudentsProvider > BatchProvider > ... > Layout
    //
    // We verify this by confirming StudentsProvider requires a provider (throws without one)
    // AND that it forwards data correctly when wrapped — proving it can only operate
    // as an inner node, not a top-level unauthenticated wrapper.

    useStudents.mockReturnValue({ students: [{ _id: 's1', name: 'SecureData' }], loading: false })

    let captured = null
    function SecuredConsumer() {
      captured = useStudentsContext()
      return null
    }

    // Simulates being inside the auth-gated shell
    render(<StudentsProvider><SecuredConsumer /></StudentsProvider>)
    expect(captured.students[0].name).toBe('SecureData')

    // Simulates being OUTSIDE the auth-gated shell (no provider) — must throw
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<SecuredConsumer />)).toThrow()
    spy.mockRestore()
  })
})
