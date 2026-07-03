/**
 * Layout component UI tests — sidebar rendering across viewport widths.
 *
 * The layout is always a left sidebar + main content (row direction).
 * On narrow viewports (< 900px) the sidebar collapses to 72px icon-only mode.
 * There is no bottom tab bar or top-bar mode — the sidebar works at all widths.
 */

// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ── Minimal mocks so Layout can mount without Firebase ──────────────────────

vi.mock('../lib/AuthContext', () => ({
  useAuth: () => ({
    user: { displayName: 'Test Admin', email: 'admin@test.com', photoURL: null, uid: 'uid1' },
    role: 'admin',
    isMasterAdmin: true,
    logout: vi.fn(),
  }),
}))

vi.mock('../lib/usePermissions', () => ({
  usePermissions: () => ({
    canAccessPage: () => true,
  }),
}))

vi.mock('../lib/PendingChangesContext', () => ({
  usePendingChanges: () => ({ pendingCount: 2 }),
}))

vi.mock('../lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}))

vi.mock('../lib/BatchContext', () => ({
  useBatch: () => ({
    selectedYearCode: '27', setSelectedYearCode: vi.fn(),
    selectedProgramme: '', setSelectedProgramme: vi.fn(),
    selectedCampuses: [], setSelectedCampuses: vi.fn(),
    scopedCohorts: ['27-Delhi-IB'],
    activeBatches: [{ id: '27-Delhi-IB' }],
    batchesLoading: false,
    availableCampuses: ['Delhi', 'Kakinada'],
    availableProgrammes: ['IB', 'BA'],
    availableYears: ['27'],
    getCohortCycle: () => 'final',
  }),
}))

vi.mock('../lib/useStudents', () => ({
  useStudents: () => ({ students: [] }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    Outlet: () => <div data-testid="outlet" />,
  }
})

// ── Helpers ─────────────────────────────────────────────────────────────────

function setViewport(width) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width })
  window.dispatchEvent(new Event('resize'))
}

let Layout
beforeEach(async () => {
  vi.resetModules()
  const mod = await import('../components/Layout.jsx')
  Layout = mod.default
})

afterEach(() => {
  cleanup()
  vi.resetModules()
})

function renderLayout(width) {
  setViewport(width)
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Layout />
    </MemoryRouter>
  )
}

// All 11 nav items visible to an admin (canAccessPage always true)
const ALL_NAV_FIRST_WORDS = [
  'Dashboard', 'Roster', 'Placed', 'Activity', 'Intel',
  'Analytics', 'TPO', 'Remapper', 'Approvals', 'Team', 'About',
]

// ══════════════════════════════════════════════════════════════════════════════
// 1. Structure — always sidebar, never bottom tab bar
// ══════════════════════════════════════════════════════════════════════════════

describe('Layout structure', () => {
  it('always renders a sidebar <aside>', async () => {
    renderLayout(390)
    expect(document.querySelector('aside')).not.toBeNull()
  })

  it('never renders a bottom tab bar on mobile width', async () => {
    renderLayout(390)
    expect(document.querySelector('nav[data-mobile-nav]')).toBeNull()
  })

  it('never renders a bottom tab bar on desktop width', async () => {
    renderLayout(1280)
    expect(document.querySelector('nav[data-mobile-nav]')).toBeNull()
  })

  it('outer container is always row direction', async () => {
    renderLayout(390)
    const root = document.querySelector('div[style*="flex"]')
    // The root flex container should be row (sidebar left, main right)
    expect(root.style.flexDirection).toBe('row')
  })

  it('renders the page outlet', async () => {
    renderLayout(390)
    expect(screen.getByTestId('outlet')).toBeTruthy()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 2. Nav items — all accessible pages always reachable
// ══════════════════════════════════════════════════════════════════════════════

describe('Nav items', () => {
  it('sidebar contains all accessible nav links on mobile width', async () => {
    renderLayout(390)
    const aside = document.querySelector('aside')
    const links = aside.querySelectorAll('a')
    expect(links.length).toBe(ALL_NAV_FIRST_WORDS.length)
  })

  it('sidebar contains all accessible nav links on desktop width', async () => {
    renderLayout(1280)
    const aside = document.querySelector('aside')
    const nav = aside.querySelector('nav')
    const links = nav.querySelectorAll('a')
    expect(links.length).toBe(ALL_NAV_FIRST_WORDS.length)
  })

  it('pending count badge appears on Approvals link', async () => {
    renderLayout(1280)
    const aside = document.querySelector('aside')
    // Badge text "2" should appear (pendingCount = 2 in mock)
    expect(aside.textContent).toContain('2')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 3. Compact sidebar on narrow screens (< 900px)
// ══════════════════════════════════════════════════════════════════════════════

describe('Compact sidebar (< 900px)', () => {
  it('sidebar is 72px wide on 390px viewport', async () => {
    renderLayout(390)
    const aside = document.querySelector('aside')
    expect(aside.style.width).toBe('72px')
  })

  it('sidebar is 72px wide on 768px viewport', async () => {
    renderLayout(768)
    const aside = document.querySelector('aside')
    expect(aside.style.width).toBe('72px')
  })

  it('sidebar is 72px wide at the 899px boundary', async () => {
    renderLayout(899)
    const aside = document.querySelector('aside')
    expect(aside.style.width).toBe('72px')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 4. Full sidebar on wide screens (>= 900px)
// ══════════════════════════════════════════════════════════════════════════════

describe('Full sidebar (>= 900px)', () => {
  it('sidebar is 232px wide at 900px', async () => {
    renderLayout(900)
    const aside = document.querySelector('aside')
    expect(aside.style.width).toBe('232px')
  })

  it('sidebar is 232px wide on desktop', async () => {
    renderLayout(1280)
    const aside = document.querySelector('aside')
    expect(aside.style.width).toBe('232px')
  })

  it('PlacementOS text label is visible on wide sidebar', async () => {
    renderLayout(1280)
    expect(screen.getByText('PlacementOS')).toBeTruthy()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 5. Sidebar collapse toggle (desktop only)
// ══════════════════════════════════════════════════════════════════════════════

describe('Sidebar collapse toggle', () => {
  it('collapse button is visible on wide desktop sidebar', async () => {
    renderLayout(1280)
    const collapseBtn = screen.queryByTitle('Collapse sidebar')
    expect(collapseBtn).not.toBeNull()
  })

  it('no collapse button on narrow viewport (sidebar already compact)', async () => {
    renderLayout(390)
    const collapseBtn = screen.queryByTitle('Collapse sidebar')
    expect(collapseBtn).toBeNull()
  })
})
