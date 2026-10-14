import { describe, it, expect } from 'vitest'
import limits from '../../functions/apolloLimits.js'

const {
  normalizeLinkedinUrl, looksLikeLinkedinUrl, dedupeAndValidate,
  checkPerCallCaps, checkDailyPhoneBudget, checkHourlyRate, estimateCredits,
  resolveCompany, cleanTitle, apolloQuery,
  MAX_PEOPLE_PER_CALL, MAX_PHONE_REVEALS_PER_CALL, MAX_APOLLO_CALLS_PER_HOUR,
  DEFAULT_DAILY_PHONE_BUDGET,
} = limits

// ─── normalizeLinkedinUrl ────────────────────────────────────────────────────

describe('normalizeLinkedinUrl', () => {
  it('strips protocol, www, trailing slash, query, and hash; lowercases', () => {
    expect(normalizeLinkedinUrl('https://www.LinkedIn.com/in/Jane-Doe/'))
      .toBe('linkedin.com/in/jane-doe')
    expect(normalizeLinkedinUrl('http://linkedin.com/in/john?utm=x#top'))
      .toBe('linkedin.com/in/john')
  })

  it('treats URLs that differ only by protocol/www/trailing slash as the same', () => {
    const a = normalizeLinkedinUrl('https://www.linkedin.com/in/x/')
    const b = normalizeLinkedinUrl('linkedin.com/in/x')
    expect(a).toBe(b)
  })

  it('returns empty string for falsy input', () => {
    expect(normalizeLinkedinUrl('')).toBe('')
    expect(normalizeLinkedinUrl(null)).toBe('')
    expect(normalizeLinkedinUrl(undefined)).toBe('')
  })
})

// ─── looksLikeLinkedinUrl ────────────────────────────────────────────────────

describe('looksLikeLinkedinUrl', () => {
  it('accepts valid /in/ profile URLs including country subdomains', () => {
    expect(looksLikeLinkedinUrl('https://www.linkedin.com/in/jane-doe')).toBe(true)
    expect(looksLikeLinkedinUrl('https://in.linkedin.com/in/someone')).toBe(true)
  })

  it('rejects non-profile and non-linkedin URLs', () => {
    expect(looksLikeLinkedinUrl('https://linkedin.com/company/acme')).toBe(false)
    expect(looksLikeLinkedinUrl('https://example.com/in/x')).toBe(false)
    expect(looksLikeLinkedinUrl('just some text')).toBe(false)
    expect(looksLikeLinkedinUrl('')).toBe(false)
  })
})

// ─── dedupeAndValidate ───────────────────────────────────────────────────────

describe('dedupeAndValidate', () => {
  it('de-duplicates by normalized URL, preserving first-occurrence order', () => {
    const { valid, duplicates } = dedupeAndValidate([
      'https://www.linkedin.com/in/alice/',
      'linkedin.com/in/alice',       // dup of #1
      'https://linkedin.com/in/bob',
    ])
    expect(valid.map(v => v.normalized)).toEqual(['linkedin.com/in/alice', 'linkedin.com/in/bob'])
    expect(duplicates).toHaveLength(1)
  })

  it('separates invalid URLs', () => {
    const { valid, invalid } = dedupeAndValidate([
      'https://linkedin.com/in/ok',
      'https://example.com/notlinkedin',
      '',
      '   ',
    ])
    expect(valid).toHaveLength(1)
    expect(invalid).toEqual(['https://example.com/notlinkedin'])
  })

  it('handles empty/nullish input', () => {
    expect(dedupeAndValidate([])).toEqual({ valid: [], invalid: [], duplicates: [] })
    expect(dedupeAndValidate(null)).toEqual({ valid: [], invalid: [], duplicates: [] })
  })
})

// ─── checkPerCallCaps ────────────────────────────────────────────────────────

describe('checkPerCallCaps', () => {
  it('rejects zero', () => {
    expect(checkPerCallCaps(0, false).ok).toBe(false)
  })

  it('allows up to the people cap for email-only', () => {
    expect(checkPerCallCaps(MAX_PEOPLE_PER_CALL, false).ok).toBe(true)
    expect(checkPerCallCaps(MAX_PEOPLE_PER_CALL + 1, false).ok).toBe(false)
  })

  it('applies the tighter phone cap when phone is requested', () => {
    expect(checkPerCallCaps(MAX_PHONE_REVEALS_PER_CALL, true).ok).toBe(true)
    expect(checkPerCallCaps(MAX_PHONE_REVEALS_PER_CALL + 1, true).ok).toBe(false)
    // same count is fine for email-only
    expect(checkPerCallCaps(MAX_PHONE_REVEALS_PER_CALL + 1, false).ok).toBe(true)
  })
})

// ─── checkDailyPhoneBudget ───────────────────────────────────────────────────

describe('checkDailyPhoneBudget', () => {
  it('allows when under budget', () => {
    const r = checkDailyPhoneBudget(10, 5, 250)
    expect(r.ok).toBe(true)
    expect(r.allowedPhone).toBe(5)
  })

  it('allows exactly up to the budget', () => {
    const r = checkDailyPhoneBudget(245, 5, 250)
    expect(r.ok).toBe(true)
    expect(r.allowedPhone).toBe(5)
  })

  it('partially allows when the request would exceed budget', () => {
    const r = checkDailyPhoneBudget(248, 5, 250)
    expect(r.ok).toBe(false)
    expect(r.allowedPhone).toBe(2) // only 2 slots left
    expect(r.error).toMatch(/only 2/)
  })

  it('fully rejects when budget is exhausted', () => {
    const r = checkDailyPhoneBudget(250, 5, 250)
    expect(r.ok).toBe(false)
    expect(r.allowedPhone).toBe(0)
    expect(r.error).toMatch(/exhausted/)
  })

  it('defaults to 250/day', () => {
    expect(DEFAULT_DAILY_PHONE_BUDGET).toBe(250)
    const r = checkDailyPhoneBudget(0, 250)
    expect(r.ok).toBe(true)
  })
})

// ─── checkHourlyRate ─────────────────────────────────────────────────────────

describe('checkHourlyRate', () => {
  it('allows under the hourly cap', () => {
    expect(checkHourlyRate(100, 50).ok).toBe(true)
  })

  it('rejects when the batch would exceed the hourly cap', () => {
    const r = checkHourlyRate(MAX_APOLLO_CALLS_PER_HOUR - 10, 50)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/10 calls left/)
  })
})

// ─── estimateCredits ─────────────────────────────────────────────────────────

describe('estimateCredits', () => {
  it('computes 1/email and 8/phone worst case', () => {
    expect(estimateCredits(10, 4)).toEqual({ email: 10, phoneWorstCase: 32, totalWorstCase: 42 })
  })

  it('handles email-only (no phones)', () => {
    expect(estimateCredits(5, 0)).toEqual({ email: 5, phoneWorstCase: 0, totalWorstCase: 5 })
  })
})

// ─── resolveCompany ──────────────────────────────────────────────────────────

describe('resolveCompany', () => {
  it('prefers organization.name', () => {
    expect(resolveCompany({ organization: { name: 'Hero Future Energies' }, account: { name: 'X' } }))
      .toBe('Hero Future Energies')
  })

  it('falls back to account.name', () => {
    expect(resolveCompany({ account: { name: 'Acme Corp' } })).toBe('Acme Corp')
  })

  it('falls back to the current employment history entry', () => {
    const person = {
      employment_history: [
        { organization_name: 'Old Co', current: false },
        { organization_name: 'Current Co', current: true },
      ],
    }
    expect(resolveCompany(person)).toBe('Current Co')
  })

  it('uses the first employment history entry when none is flagged current', () => {
    const person = { employment_history: [{ organization_name: 'First Co' }] }
    expect(resolveCompany(person)).toBe('First Co')
  })

  it('falls back to a bare organization_name field', () => {
    expect(resolveCompany({ organization_name: 'Bare Co' })).toBe('Bare Co')
  })

  it('extracts the company from a "Title @ Company" headline as a last resort', () => {
    // This is exactly the real case seen in production: company only in the title.
    const person = { title: 'Assistant General Manager - HR @ Hero Future Energies' }
    expect(resolveCompany(person)).toBe('Hero Future Energies')
  })

  it('prefers a structured org field over the title-embedded one', () => {
    const person = { organization: { name: 'Structured Co' }, title: 'Manager @ Headline Co' }
    expect(resolveCompany(person)).toBe('Structured Co')
  })

  it('returns empty string when nothing is present', () => {
    expect(resolveCompany({})).toBe('')
    expect(resolveCompany(null)).toBe('')
  })
})

describe('cleanTitle', () => {
  it('strips a trailing "@ Company" when the company was pulled from the title', () => {
    const person = { title: 'Assistant General Manager - HR @ Hero Future Energies' }
    expect(cleanTitle(person, 'Hero Future Energies')).toBe('Assistant General Manager - HR')
  })

  it('leaves the title untouched when the company came from a structured field', () => {
    const person = { title: 'Assistant General Manager - HR' }
    expect(cleanTitle(person, 'Hero Future Energies')).toBe('Assistant General Manager - HR')
  })

  it('handles missing title or company', () => {
    expect(cleanTitle({}, 'X')).toBe('')
    expect(cleanTitle({ title: 'Manager' }, '')).toBe('Manager')
  })
})

describe('apolloQuery', () => {
  it('expands array values into repeated key[]=v pairs (Apollo form)', () => {
    const qs = apolloQuery({ person_titles: ['CHRO', 'Head of HR'], organization_ids: ['abc123'], page: 1 })
    // URLSearchParams encodes spaces as '+' (a valid query-string space); normalize for the assertion.
    expect(decodeURIComponent(qs).replace(/\+/g, ' ')).toBe('person_titles[]=CHRO&person_titles[]=Head of HR&organization_ids[]=abc123&page=1')
  })

  it('skips empty, null, and undefined values', () => {
    const qs = apolloQuery({ a: '', b: null, c: undefined, d: 'keep', e: [] })
    expect(qs).toBe('d=keep')
  })

  it('skips empty entries inside arrays', () => {
    const qs = apolloQuery({ person_titles: ['CHRO', '', null] })
    expect(decodeURIComponent(qs)).toBe('person_titles[]=CHRO')
  })

  it('handles empty/nullish params object', () => {
    expect(apolloQuery({})).toBe('')
    expect(apolloQuery(null)).toBe('')
  })
})
