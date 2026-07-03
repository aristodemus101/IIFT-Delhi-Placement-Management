import React, { useEffect, useMemo, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { usePermissions } from '../lib/usePermissions'
import { usePendingChanges } from '../lib/PendingChangesContext'
import { useTheme } from '../lib/ThemeContext'
import { useBatch } from '../lib/BatchContext'
import { useStudents } from '../lib/useStudents'
import {
  LayoutDashboard, Users, CheckSquare, ArrowLeftRight, Activity,
  LogOut, ShieldCheck, ClipboardCheck, User, Sun, Moon, BarChart2, Briefcase, Info,
  ChevronLeft, ChevronRight, Telescope, Menu,
} from 'lucide-react'

function FilterPill({ active, onClick, children, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
        cursor: 'pointer', lineHeight: 1.6,
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'var(--accent-bg)' : 'var(--surface)',
        color: active ? 'var(--accent-dark)' : 'var(--text-2)',
        transition: 'background 0.12s ease, color 0.12s ease, border-color 0.12s ease',
      }}
    >{children}</button>
  )
}

function FilterGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', fontWeight: 700, marginBottom: 5 }}>{label}</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{children}</div>
    </div>
  )
}

export default function Layout() {
  const { user, role, logout } = useAuth()
  const { canAccessPage } = usePermissions()
  const { pendingCount } = usePendingChanges()
  const { theme, toggleTheme } = useTheme()
  const {
    selectedYearCode, setSelectedYearCode,
    selectedProgramme, setSelectedProgramme,
    selectedCampuses, setSelectedCampuses,
    scopedCohorts,
    activeBatches, batchesLoading,
    availableCampuses, availableProgrammes, availableYears,
    getCohortCycle,
  } = useBatch()
  const { students } = useStudents()
  const navigate = useNavigate()
  const location = useLocation()
  const [workspaceActions, setWorkspaceActions] = useState(null)

  // Desktop: sidebar collapse state, persisted across sessions
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('placementos-sidebar-collapsed') === '1'
  })

  // Narrow viewport detection (< 900px = overlay mode)
  const [isNarrow, setIsNarrow] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 900
  })

  // Narrow: overlay open state (always starts closed; not persisted)
  const [overlayOpen, setOverlayOpen] = useState(false)

  useEffect(() => {
    const update = () => setIsNarrow(window.innerWidth < 900)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Close overlay on route change (user tapped a nav link)
  useEffect(() => {
    if (isNarrow) setOverlayOpen(false)
  }, [location.pathname, isNarrow])

  // Close overlay on Escape
  useEffect(() => {
    if (!overlayOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setOverlayOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [overlayOpen])

  // Desktop: sidebar is compact when explicitly collapsed by user
  // Narrow: sidebar is always full-width when overlay is open (overlay handles sizing)
  const isCompactSidebar = !isNarrow && sidebarCollapsed

  const hasActiveCohorts = activeBatches.length > 0
  const courseAllLabel = 'All'

  const scopedStats = useMemo(() => {
    const inScope = new Set(scopedCohorts)
    let summerPlaced = 0
    let finalPlaced = 0
    let total = 0

    students.forEach(s => {
      if (!inScope.has(s.cohort || 'unknown')) return
      total += 1
      if (s._placed_summer) summerPlaced += 1
      if (s._placed_final) finalPlaced += 1
    })

    return { total, summerPlaced, finalPlaced }
  }, [students, scopedCohorts])

  // Cycle badge per scoped cohort for sidebar display
  const cohortCycleChips = useMemo(() => {
    return scopedCohorts.map(id => ({
      id,
      cycle: getCohortCycle(id),
    }))
  }, [scopedCohorts, getCohortCycle])

  const toggleCampus = (campus) => {
    if (selectedCampuses.includes(campus)) {
      setSelectedCampuses(selectedCampuses.filter(c => c !== campus))
    } else {
      setSelectedCampuses([...selectedCampuses, campus])
    }
  }

  const toggleYear = (yearCode) => {
    setSelectedYearCode(selectedYearCode === yearCode ? '' : yearCode)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const toggleSidebar = () => {
    setSidebarCollapsed(current => {
      const next = !current
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('placementos-sidebar-collapsed', next ? '1' : '0')
      }
      return next
    })
  }

  const NAV = [
    { to: '/',           icon: LayoutDashboard, label: 'Dashboard',  exact: true,  page: 'dashboard' },
    { to: '/roster',     icon: Users,           label: 'Roster',     exact: false, page: 'roster' },
    { to: '/placed',     icon: CheckSquare,     label: 'Placed',     exact: false, page: 'placed' },
    { to: '/activity',   icon: Activity,        label: 'Activity',   exact: false, page: 'activity' },
    { to: '/intel',      icon: Telescope,       label: 'Intel',      exact: false, page: 'intel' },
    { to: '/analytics',  icon: BarChart2,       label: 'Analytics',  exact: false, page: 'analytics' },
    { to: '/tpo',        icon: Briefcase,       label: 'TPO Outreach', exact: false, page: 'tpo' },
    { to: '/remapper',   icon: ArrowLeftRight,  label: 'Remapper',   exact: false, page: 'remapper' },
    { to: '/approvals',  icon: ClipboardCheck,  label: 'Approvals',  exact: false, page: 'approvals', badge: pendingCount },
    { to: '/admin',      icon: ShieldCheck,     label: 'Team Access', exact: false, page: 'admin' },
    { to: '/about',      icon: Info,            label: 'About',       exact: false, page: 'about' },
  ].filter(n => canAccessPage(n.page))

  // ── Shared sidebar content ─────────────────────────────────────────────────
  // Rendered inside both the inline desktop aside and the overlay panel.
  const sidebarContent = (compact) => (
    <>
      <div style={{ padding: compact ? '0 10px 14px' : '0 16px 16px', borderBottom: '1px solid var(--border)', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 0 : 10, justifyContent: compact ? 'center' : 'flex-start' }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }} aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="var(--accent)"/>
            <path d="M22 8 A10 10 0 1 0 22 24" stroke="white" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
            <path d="M19 13 A5 5 0 0 1 19 19" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.5"/>
            <circle cx="16" cy="16" r="2" fill="white"/>
          </svg>
          {!compact && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 13.5, letterSpacing: '-0.03em', lineHeight: 1.15, color: 'var(--text)' }}>PlacementOS</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1, fontWeight: 500 }}>IIFT Delhi</div>
            </div>
          )}
          {/* Desktop collapse button — only shown in inline sidebar when expanded */}
          {!isNarrow && !compact && (
            <button
              onClick={toggleSidebar}
              title="Collapse sidebar"
              style={{
                border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-3)',
                width: 26, height: 26, borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <ChevronLeft size={13} />
            </button>
          )}
          {/* Overlay close button */}
          {isNarrow && (
            <button
              onClick={() => setOverlayOpen(false)}
              title="Close menu"
              aria-label="Close navigation menu"
              style={{
                border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-3)',
                width: 26, height: 26, borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 'auto',
              }}
            >
              <ChevronLeft size={13} />
            </button>
          )}
        </div>
        {/* Desktop expand button — compact mode only */}
        {!isNarrow && compact && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
            <button
              onClick={toggleSidebar}
              title="Expand sidebar"
              style={{
                border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-3)',
                width: 26, height: 26, borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

      <nav style={{ flex: 1, padding: '6px 10px', overflowY: 'auto' }}>
        {!compact && (
          <div style={{ marginBottom: 10, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 10px 8px' }}>
            {hasActiveCohorts ? (
            <>
              {availableYears.length > 0 && (
                <FilterGroup label="Year">
                  <FilterPill active={!selectedYearCode} onClick={() => setSelectedYearCode('')}>All</FilterPill>
                  {availableYears.map(y => (
                    <FilterPill key={y} active={selectedYearCode === y} onClick={() => toggleYear(y)}>{y}</FilterPill>
                  ))}
                </FilterGroup>
              )}
              {availableProgrammes.length > 0 && (
                <FilterGroup label="Course">
                  <FilterPill active={!selectedProgramme} onClick={() => setSelectedProgramme('')}>{courseAllLabel}</FilterPill>
                  {availableProgrammes.map(p => (
                    <FilterPill key={p} active={selectedProgramme === p} onClick={() => setSelectedProgramme(p === selectedProgramme ? '' : p)}>{p}</FilterPill>
                  ))}
                </FilterGroup>
              )}
              {availableCampuses.length > 0 && (
                <FilterGroup label="Campus">
                  <FilterPill active={selectedCampuses.length === 0} onClick={() => setSelectedCampuses([])}>All</FilterPill>
                  {availableCampuses.map(c => {
                    const short = c === 'Gift City' ? 'GC' : c === 'Kakinada' ? 'KKD' : c === 'Kolkata' ? 'KOL' : c
                    return <FilterPill key={c} active={selectedCampuses.includes(c)} onClick={() => toggleCampus(c)} title={c}>{short}</FilterPill>
                  })}
                </FilterGroup>
              )}
              {batchesLoading ? (
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>Loading…</div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.8, marginTop: 6, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-2)' }}>{scopedStats.total}</span> students
                  <div style={{ display: 'flex', gap: 10, marginTop: 2, flexWrap: 'wrap' }}>
                    <span><span style={{ color: 'var(--amber-text)', fontWeight: 700 }}>{scopedStats.summerPlaced}</span> SIP</span>
                    <span><span style={{ color: 'var(--accent)', fontWeight: 700 }}>{scopedStats.finalPlaced}</span> Final</span>
                  </div>
                  {cohortCycleChips.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                      {cohortCycleChips.map(({ id, cycle }) => (
                        <span key={id} style={{
                          display: 'inline-flex', alignItems: 'center',
                          padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                          background: cycle === 'summer' ? 'var(--amber-bg)' : 'var(--accent-bg)',
                          color: cycle === 'summer' ? 'var(--amber-text)' : 'var(--accent-dark)',
                          border: `1px solid ${cycle === 'summer' ? 'var(--amber-border)' : 'color-mix(in srgb,var(--accent) 40%,transparent)'}`,
                        }}>
                          {(() => { const p = id.split('-'); return p.length >= 3 ? `${p[0]} ${p[p.length-1]}` : p[0] })()} · {cycle === 'summer' ? 'SIP' : 'Final'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
            ) : (
            <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6 }}>
              No active cohorts yet.
              <div style={{ marginTop: 8 }}>
                <button onClick={() => navigate('/admin')} style={{
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--text-2)', borderRadius: 20,
                  padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}>
                  Create the first cohort
                </button>
              </div>
            </div>
            )}
          </div>
        )}

        {NAV.map(({ to, icon: Icon, label, exact, badge }) => (
          <NavLink key={to} to={to} end={exact} style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            justifyContent: compact ? 'center' : 'flex-start',
            gap: compact ? 0 : 9,
            padding: compact ? '9px 0' : '8px 10px',
            borderRadius: 8,
            marginBottom: 1,
            textDecoration: 'none',
            fontSize: 13.5,
            fontWeight: isActive ? 600 : 450,
            background: isActive ? 'var(--accent-bg)' : 'transparent',
            color: isActive ? 'var(--accent-dark)' : 'var(--text-2)',
            border: `1px solid ${isActive ? 'color-mix(in srgb, var(--accent) 25%, transparent)' : 'transparent'}`,
            boxShadow: isActive ? 'inset 3px 0 0 var(--accent)' : 'none',
            transition: 'background var(--speed-fast) var(--easing-out), color var(--speed-fast) var(--easing-out)',
          })}
          onMouseEnter={e => {
            if (!e.currentTarget.className.includes('active')) {
              e.currentTarget.style.background = 'var(--surface2)'
              e.currentTarget.style.color = 'var(--text)'
            }
          }}
          onMouseLeave={e => {
            if (!e.currentTarget.className.includes('active')) {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-2)'
            }
          }}
          >
            <Icon size={15} strokeWidth={compact ? 2 : 1.8} />
            {!compact && <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>}
            {badge > 0 && (
              <span style={{
                marginLeft: compact ? 0 : 'auto',
                background: 'var(--accent)', color: '#fff',
                borderRadius: 999, fontSize: 10, fontWeight: 700,
                padding: '1px 6px', minWidth: 18, textAlign: 'center', lineHeight: 1.6,
              }}>
                {badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '10px 10px 8px', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            width: '100%', height: 32,
            display: 'flex', alignItems: 'center',
            justifyContent: compact ? 'center' : 'flex-start',
            gap: 8, borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-2)',
            fontSize: 12, fontWeight: 600, marginBottom: 8,
            paddingLeft: compact ? 0 : 10, cursor: 'pointer',
          }}
        >
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          {!compact && (theme === 'dark' ? 'Light mode' : 'Dark mode')}
        </button>

        {!compact && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '8px 10px', borderRadius: 10,
            background: 'var(--surface2)', border: '1px solid var(--border)',
          }}>
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User size={13} color="var(--text-3)" />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{user?.displayName}</div>
              <div style={{
                fontSize: 10, fontWeight: 700,
                color: role === 'admin' ? 'var(--accent)' : role === 'committee' ? 'var(--amber-text)' : role === 'tpo' ? 'var(--green-text)' : 'var(--text-3)',
                marginTop: 1, textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {role === 'admin' ? 'Admin' : role === 'committee' ? 'Committee' : role === 'tpo' ? 'TPO' : role === 'faculty_coordinator' ? 'Faculty Incharge' : role || ''}
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              style={{
                border: '1px solid var(--border)', background: 'var(--surface)',
                padding: 0, cursor: 'pointer', color: 'var(--text-3)',
                borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 26, height: 26, flexShrink: 0,
              }}
            >
              <LogOut size={13} />
            </button>
          </div>
        )}
      </div>
    </>
  )

  // ── Desktop layout (>= 900px): inline sidebar + main ──────────────────────
  if (!isNarrow) {
    return (
      <div style={{ display: 'flex', flexDirection: 'row', height: '100dvh', overflow: 'hidden' }}>
        <aside style={{
          width: isCompactSidebar ? 72 : 232,
          flexShrink: 0,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          padding: isCompactSidebar ? '12px 0' : '16px 0',
          height: '100dvh',
          overflow: 'hidden',
          transition: 'width 0.2s var(--easing)',
        }}>
          {sidebarContent(isCompactSidebar)}
        </aside>

        <main style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--surface2)' }}>
          {hasActiveCohorts && (
            <div className="workspace-bar" style={{
              padding: '5px 24px', borderBottom: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text-3)',
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 11, fontWeight: 500,
              justifyContent: 'space-between', flexWrap: 'wrap', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>Year {selectedYearCode || 'All'}</span>
                <span style={{ opacity: 0.35 }}>·</span>
                <span>Campus {selectedCampuses.length ? selectedCampuses.join(', ') : 'All'}</span>
                <span style={{ opacity: 0.35 }}>·</span>
                <span>Course {selectedProgramme || 'All'}</span>
              </div>
              {workspaceActions && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {workspaceActions}
                </div>
              )}
            </div>
          )}
          <div style={{ flex: 1, overflow: 'auto', minHeight: 0, background: 'var(--surface)' }}>
            <Outlet context={{ setWorkspaceActions }} />
          </div>
        </main>
      </div>
    )
  }

  // ── Narrow layout (< 900px): full-width content + overlay sidebar ──────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', position: 'relative' }}>

      {/* Slim top bar with hamburger */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', height: 48, flexShrink: 0,
        borderBottom: '1px solid var(--border)', background: 'var(--surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setOverlayOpen(true)}
            aria-label="Open navigation menu"
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 8, padding: 0,
            }}
          >
            <Menu size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="26" height="26" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }} aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="var(--accent)"/>
              <path d="M22 8 A10 10 0 1 0 22 24" stroke="white" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
              <path d="M19 13 A5 5 0 0 1 19 19" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.5"/>
              <circle cx="16" cy="16" r="2" fill="white"/>
            </svg>
            <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: '-0.03em', color: 'var(--text)' }}>PlacementOS</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {pendingCount > 0 && (
            <span style={{
              background: 'var(--accent)', color: '#fff',
              borderRadius: 999, fontSize: 10, fontWeight: 700,
              padding: '2px 7px', lineHeight: 1.5,
            }}>{pendingCount}</span>
          )}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              border: '1px solid var(--border)', background: 'var(--surface2)',
              width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)',
            }}
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>
        </div>
      </div>

      {/* Page content — full width, always visible */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0, background: 'var(--surface)' }}>
        <Outlet context={{ setWorkspaceActions }} />
      </div>

      {/* Overlay backdrop */}
      {overlayOpen && (
        <div
          onClick={() => setOverlayOpen(false)}
          aria-hidden="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
            animation: 'fadeIn 0.18s ease',
          }}
        />
      )}

      {/* Overlay sidebar panel */}
      <aside
        aria-label="Navigation menu"
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
          width: 260,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          padding: '16px 0',
          overflowY: 'auto',
          boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
          transform: overlayOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.22s cubic-bezier(0.32,0.72,0,1)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {sidebarContent(false)}
      </aside>
    </div>
  )
}
