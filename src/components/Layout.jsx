import React from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { usePendingChanges } from '../lib/PendingChangesContext'
import {
  LayoutDashboard, Users, CheckSquare, ArrowLeftRight,
  LogOut, GraduationCap, ShieldCheck, ClipboardCheck, User
} from 'lucide-react'

export default function Layout() {
  const { user, role, logout } = useAuth()
  const { pendingCount } = usePendingChanges()
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
        width: 220, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', padding: '20px 0',
      }}>
        {/* Logo */}
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>PlacementOS</div>
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
              fontSize: 14, fontWeight: isActive ? 500 : 400, transition: 'all 0.15s',
              background: isActive ? 'var(--surface2)' : 'transparent',
              color: isActive ? 'var(--text)' : 'var(--text-2)',
            })}>
              <Icon size={16} />
              {label}
              {badge > 0 && (
                <span style={{ marginLeft: 'auto', background: 'var(--text)', color: 'var(--surface)', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>
                  {badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div style={{ padding: '12px 12px 0', borderTop: '1px solid var(--border)' }}>
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

      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>
    </div>
  )
}
