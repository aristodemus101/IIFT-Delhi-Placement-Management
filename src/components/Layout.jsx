import React from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { usePendingChanges } from '../lib/PendingChangesContext'
import { useTheme } from '../lib/ThemeContext'
import {
  LayoutDashboard, Users, CheckSquare, ArrowLeftRight,
  LogOut, GraduationCap, ShieldCheck, ClipboardCheck, User, Sun, Moon
} from 'lucide-react'

export default function Layout() {
  const { user, role, logout } = useAuth()
  const { pendingCount } = usePendingChanges()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const isAdmin = role === 'admin'

  const handleLogout = async () => { await logout(); navigate('/login') }

  const NAV = [
    { to: '/',          icon: LayoutDashboard, label: 'Dashboard',    exact: true, adminOnly: false },
    { to: '/roster',    icon: Users,           label: 'Roster',       exact: false, adminOnly: false },
    { to: '/placed',    icon: CheckSquare,     label: 'Placed',       exact: false, adminOnly: false },
    { to: '/remapper',  icon: ArrowLeftRight,  label: 'Col. Remapper',exact: false, adminOnly: false },
    { to: '/approvals', icon: ClipboardCheck,  label: 'Approvals',    exact: false, adminOnly: true, badge: pendingCount },
    { to: '/admin',     icon: ShieldCheck,     label: 'Team Access',  exact: false, adminOnly: true },
  ]

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
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>IIFT Batch 2027</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 12px' }}>
          {NAV.filter(n => !n.adminOnly || isAdmin).map(({ to, icon: Icon, label, exact, badge }) => (
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
              <div style={{ fontSize: 10, color: isAdmin ? 'var(--accent)' : 'var(--text-3)', fontWeight: isAdmin ? 600 : 400 }}>
                {isAdmin ? '⬡ Admin' : 'Viewer'}
              </div>
            </div>
            <button onClick={handleLogout} style={{ border: 'none', background: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-3)', borderRadius: 4, display: 'flex' }} title="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
        <Outlet />
      </main>
    </div>
  )
}
