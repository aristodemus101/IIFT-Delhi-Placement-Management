import React, { useEffect, useMemo, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { usePermissions } from '../lib/usePermissions'
import { usePendingChanges } from '../lib/PendingChangesContext'
import { useTheme } from '../lib/ThemeContext'
import { useBatch } from '../lib/BatchContext'
import { useStudents } from '../lib/useStudents'
import { Badge } from './UI'
import {
  LayoutDashboard, Users, CheckSquare, ArrowLeftRight, Activity,
  LogOut, GraduationCap, ShieldCheck, ClipboardCheck, User, Sun, Moon, BarChart2, Briefcase, Info,
  ChevronLeft, ChevronRight
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
  const [workspaceActions, setWorkspaceActions] = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('placementos-sidebar-collapsed') === '1'
  })
  const [isNarrowViewport, setIsNarrowViewport] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 900
  })

  useEffect(() => {
    const updateViewport = () => setIsNarrowViewport(window.innerWidth < 900)

    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  const isCompactSidebar = sidebarCollapsed || isNarrowViewport

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
    { to: '/analytics',  icon: BarChart2,       label: 'Analytics',  exact: false, page: 'analytics' },
    { to: '/tpo',        icon: Briefcase,       label: 'TPO Outreach', exact: false, page: 'tpo' },
    { to: '/remapper',   icon: ArrowLeftRight,  label: 'Remapper',   exact: false, page: 'remapper' },
    { to: '/approvals',  icon: ClipboardCheck,  label: 'Approvals',  exact: false, page: 'approvals', badge: pendingCount },
    { to: '/admin',      icon: ShieldCheck,     label: 'Team Access', exact: false, page: 'admin' },
    { to: '/about',      icon: Info,            label: 'About',       exact: false, page: 'about' },
  ].filter(n => canAccessPage(n.page))

  return (
    <div style={{ display: 'flex', flexDirection: isNarrowViewport ? 'column' : 'row', height: '100vh', overflow: 'hidden' }}>
      <aside style={{
        width: isCompactSidebar ? 72 : 232,
        flexShrink: 0,
        background: 'var(--surface)',
        borderRight: isNarrowViewport ? 'none' : '1px solid var(--border)',
        borderBottom: isNarrowViewport ? '1px solid var(--border)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        padding: isCompactSidebar ? '12px 0' : '16px 0',
        height: isNarrowViewport ? 'auto' : '100vh',
        overflow: 'hidden',
        transition: 'width 0.2s var(--easing)',
      }}>
        <div style={{ padding: isCompactSidebar ? '0 10px 14px' : '0 16px 16px', borderBottom: '1px solid var(--border)', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isCompactSidebar ? 0 : 10, justifyContent: isCompactSidebar ? 'center' : 'flex-start' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9, flexShrink: 0,
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(37,99,235,0.35)',
            }}>
              <GraduationCap size={16} color="#fff" />
            </div>
            {!isCompactSidebar && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5, letterSpacing: '-0.03em', lineHeight: 1.15, color: 'var(--text)' }}>PlacementOS</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1, fontWeight: 500 }}>IIFT Delhi</div>
              </div>
            )}
            {!isNarrowViewport && !isCompactSidebar && (
              <button
                onClick={toggleSidebar}
                title="Collapse sidebar"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--text-3)',
                  width: 26, height: 26,
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ChevronLeft size={13} />
              </button>
            )}
            {!isNarrowViewport && isCompactSidebar && (
              <button
                onClick={toggleSidebar}
                title="Expand sidebar"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--text-3)',
                  width: 26, height: 26,
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: 10,
                }}
              >
                <ChevronRight size={13} />
              </button>
            )}
          </div>
        </div>

        <nav style={{ flex: 1, padding: '6px 10px', overflowY: 'auto' }}>
          {!isCompactSidebar && (
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
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              gap: sidebarCollapsed ? 0 : 9,
              padding: sidebarCollapsed ? '9px 0' : '8px 10px',
              borderRadius: 8,
              marginBottom: 1,
              textDecoration: 'none',
              fontSize: 13.5,
              fontWeight: isActive ? 600 : 450,
              background: isActive ? 'var(--accent-bg)' : 'transparent',
              color: isActive ? 'var(--accent-dark)' : 'var(--text-2)',
              border: `1px solid ${isActive ? 'color-mix(in srgb, var(--accent) 25%, transparent)' : 'transparent'}`,
              boxShadow: isActive ? 'inset 3px 0 0 var(--accent)' : 'none',
              transition: 'background var(--speed-fast) var(--easing-out), color var(--speed-fast) var(--easing-out), box-shadow var(--speed-fast) var(--easing-out)',
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
              <Icon size={15} strokeWidth={isCompactSidebar ? 2 : 1.8} />
              {!sidebarCollapsed && <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>}
              {badge > 0 && (
                <span style={{
                  marginLeft: sidebarCollapsed ? 0 : 'auto',
                  background: 'var(--accent)',
                  color: '#fff',
                  borderRadius: 999, fontSize: 10, fontWeight: 700,
                  padding: '1px 6px', minWidth: 18, textAlign: 'center',
                  lineHeight: 1.6,
                }}>
                  {badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '10px 10px 8px', borderTop: '1px solid var(--border)' }}>
          {/* Theme toggle — compact icon when sidebar collapsed */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              width: '100%',
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCompactSidebar ? 'center' : 'flex-start',
              gap: 8,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface2)',
              color: 'var(--text-2)',
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 8,
              paddingLeft: isCompactSidebar ? 0 : 10,
              cursor: 'pointer',
            }}
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            {!isCompactSidebar && (theme === 'dark' ? 'Light mode' : 'Dark mode')}
          </button>

          {!isCompactSidebar && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '8px 10px',
              borderRadius: 10,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
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
      </aside>

      <main style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--surface2)' }}>
        {hasActiveCohorts && (
          <div style={{
            padding: '5px 16px',
            margin: '10px 16px 0',
            borderRadius: 10,
            background: 'var(--workspace-bg)',
            border: '1px solid var(--workspace-border)',
            color: 'var(--workspace-text)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11.5,
            fontWeight: 600,
            letterSpacing: '0.01em',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ opacity: 0.7, fontWeight: 500 }}>Viewing:</span>
              <span>Year {selectedYearCode || 'All'}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>Campus {selectedCampuses.length ? selectedCampuses.join(', ') : 'All'}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>Course {selectedProgramme || 'All'}</span>
            </div>
            {workspaceActions ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {workspaceActions}
              </div>
            ) : null}
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', minHeight: 0, background: 'var(--surface)' }}>
          <Outlet context={{ setWorkspaceActions }} />
        </div>
      </main>
    </div>
  )
}
