import { describe, it, expect } from 'vitest'
import { groupByCompany, tallyByExtractor, contactsToExportRows, pageWindow } from '../lib/outreachStats'

describe('pageWindow', () => {
  it('returns all pages when total fits within maxButtons', () => {
    expect(pageWindow(1, 5, 10)).toEqual([1, 2, 3, 4, 5])
    expect(pageWindow(3, 10, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('windows around the current page with ellipses and always shows first/last', () => {
    const w = pageWindow(10, 20, 10)
    expect(w[0]).toBe(1)
    expect(w[w.length - 1]).toBe(20)
    expect(w).toContain(10)
    expect(w).toContain('…')
  })

  it('never exceeds maxButtons + 2 ellipses and includes the current page', () => {
    for (const cur of [1, 2, 7, 15, 19, 20]) {
      const w = pageWindow(cur, 20, 10)
      expect(w).toContain(cur)
      expect(w.filter(x => x !== '…').length).toBeLessThanOrEqual(10)
      expect(w[0]).toBe(1)
      expect(w[w.length - 1]).toBe(20)
    }
  })

  it('no ellipsis at the start when current is near page 1', () => {
    const w = pageWindow(2, 20, 10)
    expect(w.slice(0, 3)).toEqual([1, 2, 3]) // contiguous from 1
  })
})

const contacts = [
  { id: '1', name: 'A', company: 'Goldman Sachs', email: 'a@x.com', phone: '1', enrichedBy: { email: 'nishtha_d28@iift.edu' } },
  { id: '2', name: 'B', company: 'Goldman Sachs', email: 'b@x.com', enrichedBy: { email: 'nishtha_d28@iift.edu' } },
  { id: '3', name: 'C', company: 'McKinsey', email: 'c@x.com', enrichedBy: { email: 'vibhav_ba28@iift.edu' } },
  { id: '4', name: 'D', company: '', email: 'd@x.com', enrichedBy: { email: 'vibhav_ba28@iift.edu' } },
]

describe('groupByCompany', () => {
  it('groups contacts by company, sorted by count desc', () => {
    const g = groupByCompany(contacts)
    expect(g[0]).toMatchObject({ company: 'Goldman Sachs', count: 2 })
    expect(g.map(x => x.company)).toEqual(['Goldman Sachs', 'McKinsey', 'Unknown company'])
  })

  it('labels empty company as "Unknown company"', () => {
    const g = groupByCompany(contacts)
    const unknown = g.find(x => x.company === 'Unknown company')
    expect(unknown.count).toBe(1)
    expect(unknown.contacts[0].id).toBe('4')
  })

  it('keeps the contacts under each group', () => {
    const g = groupByCompany(contacts)
    const gs = g.find(x => x.company === 'Goldman Sachs')
    expect(gs.contacts.map(c => c.id).sort()).toEqual(['1', '2'])
  })

  it('handles empty input', () => {
    expect(groupByCompany([])).toEqual([])
  })
})

describe('tallyByExtractor', () => {
  it('counts contacts per extractor, sorted by count desc', () => {
    const t = tallyByExtractor(contacts)
    expect(t).toEqual([
      { email: 'nishtha_d28@iift.edu', label: 'nishtha_d28', count: 2 },
      { email: 'vibhav_ba28@iift.edu', label: 'vibhav_ba28', count: 2 },
    ])
  })

  it('buckets missing extractor as "unknown"', () => {
    const t = tallyByExtractor([{ id: 'x' }, { id: 'y', enrichedBy: {} }])
    expect(t).toEqual([{ email: 'unknown', label: 'unknown', count: 2 }])
  })
})

describe('contactsToExportRows', () => {
  it('flattens contacts into labelled export rows', () => {
    const rows = contactsToExportRows([contacts[0]])
    expect(rows[0]).toMatchObject({
      'Name': 'A', 'Company': 'Goldman Sachs', 'Email': 'a@x.com', 'Phone': '1',
      'Extracted By': 'nishtha_d28@iift.edu',
    })
    // every documented column key is present even when empty
    expect(Object.keys(rows[0])).toEqual([
      'Name', 'Title', 'Company', 'Email', 'Phone', 'Phone Status', 'Location',
      'LinkedIn', 'Match Confidence', 'Extracted By', 'Extracted At',
    ])
  })

  it('formats a Firestore-style timestamp for Extracted At', () => {
    const rows = contactsToExportRows([{ enrichedAt: { seconds: 1760000000 } }])
    expect(rows[0]['Extracted At']).toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  it('leaves Extracted At empty when absent', () => {
    const rows = contactsToExportRows([{ name: 'X' }])
    expect(rows[0]['Extracted At']).toBe('')
  })
})
