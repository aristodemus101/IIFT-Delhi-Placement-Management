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
        width: isCompactSidebar ? 80 : 236,
        flexShrink: 0,
        background: 'color-mix(in srgb, var(--surface) 88%, transparent)',
        borderRight: isNarrowViewport ? 'none' : '1px solid var(--border)',
        borderBottom: isNarrowViewport ? '1px solid var(--border)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        padding: isCompactSidebar ? '16px 0' : '20px 0',
        backdropFilter: 'blur(20px)',
        height: isNarrowViewport ? 'auto' : '100vh',
        overflow: 'hidden',
      }}>
        <div style={{ padding: isCompactSidebar ? '0 12px 16px' : '0 20px 24px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
          <div style={{ display: 'flex', flexDirection: isCompactSidebar ? 'column' : 'row', alignItems: 'center', gap: isCompactSidebar ? 8 : 10, justifyContent: 'center' }}>
            <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'var(--accent-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap size={18} color="#fff" />
            </div>
            {!isCompactSidebar && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em', lineHeight: 1.2 }}>PlacementOS</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>IIFT Delhi</div>
              </div>
            )}
            {!isNarrowViewport && (
              <button
                onClick={toggleSidebar}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                style={{
                  marginLeft: isCompactSidebar ? 0 : 'auto',
                  marginTop: 0,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text-2)',
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>
            )}
          </div>
        </div>

        <nav style={{ flex: 1, padding: '8px 12px', overflowY: 'auto' }}>
          {!isCompactSidebar && (
            <div style={{ marginBottom: 12, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 8 }}>
              {hasActiveCohorts ? (
              <>
                {availableYears.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', fontWeight: 600, marginBottom: 5 }}>Year</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                      <button onClick={() => setSelectedYearCode('')} style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        border: `1px solid ${!selectedYearCode ? 'var(--accent)' : 'var(--border)'}`,
                        background: !selectedYearCode ? 'var(--accent-bg)' : 'var(--surface)',
                        color: !selectedYearCode ? 'var(--accent-dark)' : 'var(--text-2)',
                      }}>All</button>
                      {availableYears.map(y => (
                        <button key={y} onClick={() => toggleYear(y)} style={{
                          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          border: `1px solid ${selectedYearCode === y ? 'var(--accent)' : 'var(--border)'}`,
                          background: selectedYearCode === y ? 'var(--accent-bg)' : 'var(--surface)',
                          color: selectedYearCode === y ? 'var(--accent-dark)' : 'var(--text-2)',
                        }}>{y}</button>
                      ))}
                    </div>
                  </>
                )}

                {availableProgrammes.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', fontWeight: 600, marginBottom: 5 }}>Course</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                      <button onClick={() => setSelectedProgramme('')} style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        border: `1px solid ${!selectedProgramme ? 'var(--accent)' : 'var(--border)'}`,
                        background: !selectedProgramme ? 'var(--accent-bg)' : 'var(--surface)',
                        color: !selectedProgramme ? 'var(--accent-dark)' : 'var(--text-2)',
                      }}>{courseAllLabel}</button>
                      {availableProgrammes.map(p => (
                        <button key={p} onClick={() => setSelectedProgramme(p === selectedProgramme ? '' : p)} style={{
                          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          border: `1px solid ${selectedProgramme === p ? 'var(--accent)' : 'var(--border)'}`,
                          background: selectedProgramme === p ? 'var(--accent-bg)' : 'var(--surface)',
                          color: selectedProgramme === p ? 'var(--accent-dark)' : 'var(--text-2)',
                        }}>{p}</button>
                      ))}
                    </div>
                  </>
                )}

                {availableCampuses.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', fontWeight: 600, marginBottom: 5 }}>Campus</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                      <button onClick={() => setSelectedCampuses([])} style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        border: `1px solid ${selectedCampuses.length === 0 ? 'var(--accent)' : 'var(--border)'}`,
                        background: selectedCampuses.length === 0 ? 'var(--accent-bg)' : 'var(--surface)',
                        color: selectedCampuses.length === 0 ? 'var(--accent-dark)' : 'var(--text-2)',
                      }}>All</button>
                      {availableCampuses.map(c => {
                        const short = c === 'Gift City' ? 'GC' : c === 'Kakinada' ? 'KKD' : c === 'Kolkata' ? 'KOL' : c
                        const active = selectedCampuses.includes(c)
                        return (
                          <button key={c} onClick={() => toggleCampus(c)} title={c} style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                            background: active ? 'var(--accent-bg)' : 'var(--surface)',
                            color: active ? 'var(--accent-dark)' : 'var(--text-2)',
                          }}>{short}</button>
                        )
                      })}
                    </div>
                  </>
                )}

                {batchesLoading ? (
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Loading…</div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.8 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>{scopedStats.total}</span> students
                    <span style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                      <span><span style={{ color: 'var(--amber-text)', fontWeight: 600 }}>{scopedStats.summerPlaced}</span> SIP placed</span>
                      <span><span style={{ color: 'var(--accent-dark)', fontWeight: 600 }}>{scopedStats.finalPlaced}</span> Final placed</span>
                    </span>
                    {cohortCycleChips.length > 0 && (
                      <span style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                        {cohortCycleChips.map(({ id, cycle }) => (
                          <span key={id} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                            background: cycle === 'summer' ? 'var(--amber-bg)' : 'var(--accent-bg)',
                            color: cycle === 'summer' ? 'var(--amber-text)' : 'var(--accent-dark)',
                            border: `1px solid ${cycle === 'summer' ? 'var(--amber)' : 'color-mix(in srgb,var(--accent) 40%,transparent)'}`,
                          }}>
                            {(() => { const p = id.split('-'); return p.length >= 3 ? `${p[0]} ${p[p.length-1]}` : p[0] })()} · {cycle === 'summer' ? 'SIP' : 'Final'}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                )}
              </>
              ) : (
              <div style={{ marginTop: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6 }}>
                No active cohorts yet.
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => navigate('/admin')} style={{
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text-2)',
                    borderRadius: 20,
                    padding: '5px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
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
              display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', gap: sidebarCollapsed ? 0 : 10, padding: sidebarCollapsed ? '9px 0' : '9px 10px',
              borderRadius: 'var(--radius-sm)', marginBottom: 2, textDecoration: 'none',
              fontSize: 14, fontWeight: isActive ? 600 : 500,
              background: isActive ? 'var(--accent-bg)' : 'transparent',
              color: isActive ? 'var(--accent-dark)' : 'var(--text-2)',
              border: `1px solid ${isActive ? 'color-mix(in srgb, var(--accent) 35%, transparent)' : 'transparent'}`,
            })}>
              <Icon size={16} />
              {!sidebarCollapsed && label}
              {badge > 0 && (
                <span style={{ marginLeft: sidebarCollapsed ? 0 : 'auto', background: 'var(--accent-dark)', color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>
                  {badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '12px 12px 0', borderTop: '1px solid var(--border)' }}>
          {!sidebarCollapsed && (
            <>
              <button
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                style={{
                  width: '100%',
                  height: 34,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--text-2)',
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={14} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.displayName}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: role === 'admin' ? 'var(--accent)' : role === 'committee' ? 'var(--amber-text)' : 'var(--text-3)' }}>
                    {role === 'admin' ? '⬡ Admin' : role === 'committee' ? '◈ Committee' : role === 'tpo' ? '◆ TPO' : role === 'faculty_coordinator' ? '◇ Faculty Incharge' : role || ''}
                  </div>
                </div>
                <button onClick={handleLogout} style={{ border: 'none', background: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-3)', borderRadius: 4, display: 'flex' }} title="Sign out">
                  <LogOut size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'transparent', borderTop: '2px solid var(--workspace-border)' }}>
        {hasActiveCohorts && (
          <div style={{
            padding: '6px 12px',
            margin: '8px 14px 0',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--workspace-bg)',
            border: '1px solid var(--workspace-border)',
            color: 'var(--workspace-text)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            fontWeight: 600,
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Badge color="gray">Year {selectedYearCode || 'All'} · Campus {selectedCampuses.length ? selectedCampuses.join(', ') : 'All'} · Course {selectedProgramme || 'All'}</Badge>
            </div>
            {workspaceActions ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {workspaceActions}
              </div>
            ) : null}
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <Outlet context={{ setWorkspaceActions }} />
        </div>
      </main>
    </div>
  )
}
