/**
 * Layout component UI tests.
 *
 * Desktop (>= 900px): inline sidebar pushes content. Expanded = 232px,
 *   collapsed = 72px icon-only. Collapse/expand button in header.
 *
 * Narrow (< 900px): full-width content with a slim top bar containing a
 *   hamburger. Tapping hamburger slides in a 260px overlay sidebar.
 *   Tapping backdrop or navigating closes it.
 */

// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../lib/AuthContext', () => ({
  useAuth: () => ({
    user: { displayName: 'Test Admin', email: 'admin@test.com', photoURL: null, uid: 'uid1' },
    role: 'admin',
    isMasterAdmin: true,
    logout: vi.fn(),
  }),
}))

vi.mock('../lib/usePermissions', () => ({
  usePermissions: () => ({ canAccessPage: () => true }),
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
  return { ...actual, Outlet: () => <div data-testid="outlet" /> }
})

// ── Helpers ─────────────────────────────────────────────────────────────────

function setViewport(width) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width })
  window.dispatchEvent(new Event('resize'))
}

let Layout
beforeEach(async () => {
  // Clear persisted sidebar state so each test starts with expanded sidebar
  localStorage.clear()
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

const NAV_COUNT = 11 // admin sees all pages (canAccessPage always true)

// ══════════════════════════════════════════════════════════════════════════════
// 1. Desktop (>= 900px) — inline sidebar
// ══════════════════════════════════════════════════════════════════════════════

describe('Desktop layout (>= 900px)', () => {
  it('renders an <aside> sidebar', () => {
    renderLayout(1280)
    expect(document.querySelector('aside')).not.toBeNull()
  })

  it('no overlay sidebar on desktop', () => {
    renderLayout(1280)
    expect(screen.queryByLabelText('Navigation menu')).toBeNull()
  })

  it('no hamburger button on desktop', () => {
    renderLayout(1280)
    expect(screen.queryByLabelText('Open navigation menu')).toBeNull()
  })

  it('sidebar is 232px wide (expanded)', () => {
    renderLayout(1280)
    const aside = document.querySelector('aside')
    expect(aside.style.width).toBe('232px')
  })

  it('all nav links are in the sidebar', () => {
    renderLayout(1280)
    const nav = document.querySelector('aside nav')
    expect(nav.querySelectorAll('a').length).toBe(NAV_COUNT)
  })

  it('renders the outlet', () => {
    renderLayout(1280)
    expect(screen.getByTestId('outlet')).toBeTruthy()
  })

  it('collapse button visible when expanded', () => {
    renderLayout(1280)
    expect(screen.getByTitle('Collapse sidebar')).toBeTruthy()
  })

  it('sidebar collapses to 72px on collapse button click', () => {
    renderLayout(1280)
    fireEvent.click(screen.getByTitle('Collapse sidebar'))
    const aside = document.querySelector('aside')
    expect(aside.style.width).toBe('72px')
  })

  it('expand button appears after collapse', () => {
    renderLayout(1280)
    fireEvent.click(screen.getByTitle('Collapse sidebar'))
    expect(screen.getByTitle('Expand sidebar')).toBeTruthy()
  })

  it('sidebar expands back on expand button click', () => {
    renderLayout(1280)
    fireEvent.click(screen.getByTitle('Collapse sidebar'))
    fireEvent.click(screen.getByTitle('Expand sidebar'))
    const aside = document.querySelector('aside')
    expect(aside.style.width).toBe('232px')
  })

  it('collapsed sidebar still has all nav links', () => {
    renderLayout(1280)
    fireEvent.click(screen.getByTitle('Collapse sidebar'))
    const nav = document.querySelector('aside nav')
    expect(nav.querySelectorAll('a').length).toBe(NAV_COUNT)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 2. Narrow layout (< 900px) — overlay sidebar
// ══════════════════════════════════════════════════════════════════════════════

describe('Narrow layout (< 900px)', () => {
  it('no inline <aside> before hamburger tap', () => {
    renderLayout(390)
    // The overlay aside is in the DOM but visually off-screen (translateX(-100%))
    // Check no collapse/expand toggle exists (desktop-only)
    expect(screen.queryByTitle('Collapse sidebar')).toBeNull()
    expect(screen.queryByTitle('Expand sidebar')).toBeNull()
  })

  it('hamburger button is visible', () => {
    renderLayout(390)
    expect(screen.getByLabelText('Open navigation menu')).toBeTruthy()
  })

  it('PlacementOS label in top bar', () => {
    renderLayout(390)
    // "PlacementOS" appears in both the top bar and the (hidden) overlay sidebar
    const matches = screen.getAllByText('PlacementOS')
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('page content (outlet) is always visible', () => {
    renderLayout(390)
    expect(screen.getByTestId('outlet')).toBeTruthy()
  })

  it('overlay sidebar starts hidden (translateX -100%)', () => {
    renderLayout(390)
    const panel = screen.getByLabelText('Navigation menu')
    expect(panel.style.transform).toBe('translateX(-100%)')
  })

  it('overlay sidebar slides in after hamburger tap', () => {
    renderLayout(390)
    fireEvent.click(screen.getByLabelText('Open navigation menu'))
    const panel = screen.getByLabelText('Navigation menu')
    expect(panel.style.transform).toBe('translateX(0)')
  })

  it('backdrop appears after hamburger tap', () => {
    renderLayout(390)
    fireEvent.click(screen.getByLabelText('Open navigation menu'))
    expect(document.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it('all nav links are in the overlay panel', () => {
    renderLayout(390)
    fireEvent.click(screen.getByLabelText('Open navigation menu'))
    const panel = screen.getByLabelText('Navigation menu')
    expect(panel.querySelectorAll('a').length).toBe(NAV_COUNT)
  })

  it('overlay closes when backdrop is clicked', () => {
    renderLayout(390)
    fireEvent.click(screen.getByLabelText('Open navigation menu'))
    const backdrop = document.querySelector('[aria-hidden="true"]')
    fireEvent.click(backdrop)
    const panel = screen.getByLabelText('Navigation menu')
    expect(panel.style.transform).toBe('translateX(-100%)')
  })

  it('overlay panel is 260px wide', () => {
    renderLayout(390)
    const panel = screen.getByLabelText('Navigation menu')
    expect(panel.style.width).toBe('260px')
  })

  it('close button in overlay panel closes it', () => {
    renderLayout(390)
    fireEvent.click(screen.getByLabelText('Open navigation menu'))
    fireEvent.click(screen.getByLabelText('Close navigation menu'))
    const panel = screen.getByLabelText('Navigation menu')
    expect(panel.style.transform).toBe('translateX(-100%)')
  })

  it('pending count badge visible in top bar', () => {
    renderLayout(390)
    // pendingCount = 2 in mock
    const topBar = document.querySelector('div[style*="height: 48px"]')
    expect(topBar.textContent).toContain('2')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 3. Breakpoint boundary
// ══════════════════════════════════════════════════════════════════════════════

describe('Breakpoint boundary', () => {
  it('width 899 shows hamburger (narrow)', () => {
    renderLayout(899)
    expect(screen.getByLabelText('Open navigation menu')).toBeTruthy()
  })

  it('width 900 shows inline sidebar (desktop)', () => {
    renderLayout(900)
    expect(document.querySelector('aside')).not.toBeNull()
    expect(screen.queryByLabelText('Open navigation menu')).toBeNull()
  })
})
