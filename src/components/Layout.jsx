import React, { useMemo, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { usePermissions } from '../lib/usePermissions'
import { usePendingChanges } from '../lib/PendingChangesContext'
import { useTheme } from '../lib/ThemeContext'
import { useBatch } from '../lib/BatchContext'
import { useStudents } from '../lib/useStudents'
import { cohortLabel, seasonLabel } from '../lib/batch'
import { Badge, Btn, Modal } from './UI'
import {
  LayoutDashboard, Users, CheckSquare, ArrowLeftRight, Activity,
  LogOut, GraduationCap, ShieldCheck, ClipboardCheck, User, Sun, Moon, BarChart2
} from 'lucide-react'

export default function Layout() {
  const { user, role, logout } = useAuth()
  const { canAccessPage } = usePermissions()
  const { pendingCount } = usePendingChanges()
  const { theme, toggleTheme } = useTheme()
  const {
    selectedSeason, setSelectedSeason,
    selectedProgramme, setSelectedProgramme,
    selectedCampuses, setSelectedCampuses,
    scopedCohorts, selectedCohort,
    activeBatches, batchesLoading,
    availableCampuses, availableProgrammes,
  } = useBatch()
  const { students } = useStudents()
  const navigate = useNavigate()
  const isAdmin = role === 'admin'
  const [workspaceActions, setWorkspaceActions] = useState(null)

  // Aggregate stats across all scoped cohorts
  const scopedStats = useMemo(() => {
    const inScope = new Set(scopedCohorts)
    let summerYtp = 0, summerPlaced = 0, finalYtp = 0, finalPlaced = 0, total = 0
    students.forEach(s => {
      const c = s.cohort || s._batch?.split('_')[0] || 'unknown'
      if (!inScope.has(c)) return
      total++
      if (s._placed_summer) summerPlaced++; else summerYtp++
      if (s._placed_final)  finalPlaced++;  else finalYtp++
    })
    return { total, summerYtp, summerPlaced, finalYtp, finalPlaced }
  }, [students, scopedCohorts])

  const toggleCampus = (campus) => {
    if (selectedCampuses.includes(campus)) {
      setSelectedCampuses(selectedCampuses.filter(c => c !== campus))
    } else {
      setSelectedCampuses([...selectedCampuses, campus])
    }
  }

  const handleLogout = async () => { await logout(); navigate('/login') }

  const NAV = [
    { to: '/',           icon: LayoutDashboard, label: 'Dashboard',     exact: true,  page: 'dashboard' },
    { to: '/roster',     icon: Users,           label: 'Roster',        exact: false, page: 'roster' },
    { to: '/placed',     icon: CheckSquare,     label: 'Placed',        exact: false, page: 'placed' },
    { to: '/activity',   icon: Activity,        label: 'Activity',      exact: false, page: 'activity' },
    { to: '/analytics',  icon: BarChart2,       label: 'Analytics',     exact: false, page: 'analytics' },
    { to: '/remapper',   icon: ArrowLeftRight,  label: 'Col. Remapper', exact: false, page: 'remapper' },
    { to: '/approvals',  icon: ClipboardCheck,  label: 'Approvals',     exact: false, page: 'approvals', badge: pendingCount },
    { to: '/admin',      icon: ShieldCheck,     label: 'Team Access',   exact: false, page: 'admin' },
  ].filter(n => canAccessPage(n.page))

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{
        width: 236,
        flexShrink: 0,
        background: 'color-mix(in srgb, var(--surface) 88%, transparent)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 0',
        backdropFilter: 'blur(20px)',
      }}>
        {/* Logo */}
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'var(--accent-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em', lineHeight: 1.2 }}>PlacementOS</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>IIFT Delhi</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 12px', overflowY: 'auto' }}>
          <div style={{ marginBottom: 12, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 8 }}>

            {/* Season */}
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', fontWeight: 600, marginBottom: 5 }}>Season</div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
              {['summer', 'final'].map(s => (
                <button key={s} onClick={() => setSelectedSeason(s)} style={{
                  flex: 1, padding: '5px 0', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 11,
                  border: `1px solid ${selectedSeason === s ? (s === 'summer' ? 'var(--amber)' : 'var(--accent)') : 'var(--border)'}`,
                  background: selectedSeason === s ? (s === 'summer' ? 'var(--amber-bg)' : 'var(--accent-bg)') : 'var(--surface)',
                  color: selectedSeason === s ? (s === 'summer' ? 'var(--amber-text)' : 'var(--accent-dark)') : 'var(--text-2)',
                }}>
                  {s === 'summer' ? 'Summer' : 'Final'}
                </button>
              ))}
            </div>

            {/* Programme filter */}
            {availableProgrammes.length > 0 && (
              <>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', fontWeight: 600, marginBottom: 5 }}>Programme</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                  <button onClick={() => setSelectedProgramme('')} style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${!selectedProgramme ? 'var(--accent)' : 'var(--border)'}`,
                    background: !selectedProgramme ? 'var(--accent-bg)' : 'var(--surface)',
                    color: !selectedProgramme ? 'var(--accent-dark)' : 'var(--text-2)',
                  }}>All</button>
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

            {/* Campus filter */}
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

            {/* Scope summary */}
            {batchesLoading ? (
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Loading…</div>
            ) : activeBatches.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>No cohorts — import to create one</div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>
                <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>{scopedCohorts.length}</span> cohort{scopedCohorts.length !== 1 ? 's' : ''} ·{' '}
                <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>{scopedStats.total}</span> students ·{' '}
                {selectedSeason === 'summer'
                  ? <><span style={{ color: 'var(--green-text)', fontWeight: 600 }}>{scopedStats.summerPlaced}</span> placed</>
                  : <><span style={{ color: 'var(--accent-dark)', fontWeight: 600 }}>{scopedStats.finalPlaced}</span> placed</>
                }
              </div>
            )}
          </div>

          {NAV.map(({ to, icon: Icon, label, exact, badge }) => (
            <NavLink key={to} to={to} end={exact} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
              borderRadius: 'var(--radius-sm)', marginBottom: 2, textDecoration: 'none',
              fontSize: 14, fontWeight: isActive ? 600 : 500,
              background: isActive ? 'var(--accent-bg)' : 'transparent',
              color: isActive ? 'var(--accent-dark)' : 'var(--text-2)',
              border: `1px solid ${isActive ? 'color-mix(in srgb, var(--accent) 35%, transparent)' : 'transparent'}`,
            })}>
              <Icon size={16} />
              {label}
              {badge > 0 && (
                <span style={{ marginLeft: 'auto', background: 'var(--accent-dark)', color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>
                  {badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer actions */}
        <div style={{ padding: '12px 12px 0', borderTop: '1px solid var(--border)' }}>
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
                {role === 'admin' ? '⬡ Admin' : role === 'committee' ? '◈ Committee' : 'Viewer'}
              </div>
            </div>
            <button onClick={handleLogout} style={{ border: 'none', background: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-3)', borderRadius: 4, display: 'flex' }} title="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'transparent', borderTop: '2px solid var(--workspace-border)' }}>
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
            {scopedCohorts.length === 0 ? (
              <Badge color="gray">No cohorts selected</Badge>
            ) : scopedCohorts.length === 1 ? (
              <Badge color="blue">{cohortLabel(scopedCohorts[0])}</Badge>
            ) : (
              <Badge color="blue">{scopedCohorts.length} cohorts</Badge>
            )}
            <Badge color={selectedSeason === 'summer' ? 'amber' : 'blue'}>
              {seasonLabel(selectedSeason)}
            </Badge>
            Workspace
          </div>
          {workspaceActions ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {workspaceActions}
            </div>
          ) : null}
        </div>
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <Outlet context={{ setWorkspaceActions }} />
        </div>
      </main>

    </div>
  )
}
