// src/components/UI.jsx
import React from 'react'

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 10,
      padding: '14px 28px 10px',
      borderBottom: '1px solid var(--border)',
      background: 'color-mix(in srgb, var(--surface) 88%, transparent)',
      backdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column', gap: 8
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-xbold)', letterSpacing: '-0.03em', lineHeight: 'var(--leading-tight)', color: 'var(--text)' }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 'var(--text-md)', color: 'var(--text-2)', marginTop: 3, lineHeight: 'var(--leading-normal)' }}>{subtitle}</p>}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          flexWrap: 'wrap',
          marginLeft: 'auto',
        }}>
          {actions}
        </div>
      </div>
    </div>
  )
}

export function Btn({ children, variant = 'default', size = 'md', onClick, disabled, style = {}, ...props }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    borderRadius: 'var(--radius-sm)', fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1, fontFamily: 'var(--font-sans)',
    ...(size === 'sm' ? { padding: '6px 11px', fontSize: 12 } : { padding: '8px 14px', fontSize: 13 })
  }
  const variants = {
    default:  { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' },
    primary:  { background: 'var(--accent)', color: '#fff', border: '1px solid transparent' },
    success:  { background: 'var(--green-bg)', color: 'var(--green-text)', border: '1px solid var(--green-border)' },
    danger:   { background: 'var(--red-bg)', color: 'var(--red-text)', border: '1px solid var(--red-border)' },
    ghost:    { background: 'transparent', color: 'var(--text-2)', border: '1px solid transparent' },
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }} {...props}>
      {children}
    </button>
  )
}

export function Badge({ children, color = 'gray' }) {
  const colors = {
    gray:   { bg: 'var(--surface2)', text: 'var(--text-2)', border: 'var(--border)' },
    green:  { bg: 'var(--green-bg)', text: 'var(--green-text)', border: 'var(--green-border)' },
    amber:  { bg: 'var(--amber-bg)', text: 'var(--amber-text)', border: 'var(--amber-border)' },
    red:    { bg: 'var(--red-bg)',   text: 'var(--red-text)',   border: 'var(--red-border)' },
    blue:   { bg: 'var(--accent-bg)',text: 'var(--accent-text)', border: '#BFDBFE' },
    purple: { bg: 'var(--purple-bg)',text: 'var(--purple-text)', border: '#DDD6FE' },
  }
  const c = colors[color] || colors.gray
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 7px', borderRadius: 20, fontSize: 11, fontWeight: 500,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`
    }}>{children}</span>
  )
}

export function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: '16px 20px', flex: 1, minWidth: 120, minHeight: 132,
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)', fontWeight: 'var(--weight-medium)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 40, fontWeight: 'var(--weight-semibold)', letterSpacing: '-0.02em', lineHeight: 1, color: color || 'var(--text)', marginBottom: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>{sub}</div>}
    </div>
  )
}

export function Input({ style = {}, ...props }) {
  return (
    <input style={{
      height: 36, padding: '0 10px', borderRadius: 12,
      border: '1px solid var(--border)', background: 'var(--surface2)',
      color: 'var(--text)', fontSize: 13, outline: 'none',
      ...style
    }}
    onFocus={e => {
      e.target.style.borderColor = 'var(--accent)'
      e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent)'
    }}
    onBlur={e => {
      e.target.style.borderColor = 'var(--border)'
      e.target.style.boxShadow = 'none'
    }}
    {...props} />
  )
}

export function Select({ style = {}, children, ...props }) {
  const arrow = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%236B7280' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E")`
  return (
    <select style={{
      height: 40, padding: '0 38px 0 12px', borderRadius: 14,
      border: '1px solid var(--border)', background: 'var(--surface2)',
      color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer',
      appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
      backgroundImage: arrow,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 12px center',
      backgroundSize: '12px 8px',
      lineHeight: 1.2,
      transition: 'border-color .16s ease, box-shadow .16s ease, background-color .16s ease',
      ...style
    }}
    onFocus={e => {
      e.target.style.borderColor = 'var(--accent)'
      e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent)'
    }}
    onBlur={e => {
      e.target.style.borderColor = 'var(--border)'
      e.target.style.boxShadow = 'none'
    }}
    onMouseEnter={e => {
      if (document.activeElement !== e.target) e.target.style.backgroundColor = 'color-mix(in srgb, var(--surface2) 78%, var(--surface))'
    }}
    onMouseLeave={e => {
      if (document.activeElement !== e.target) e.target.style.backgroundColor = 'var(--surface2)'
    }}
    {...props}>{children}</select>
  )
}

export function Table({ headers, rows, emptyMessage = 'No data', onRowContextMenu }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} onClick={h.onClick} style={{
                textAlign: 'left', padding: '9px 14px',
                fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
                background: 'color-mix(in srgb, var(--surface2) 85%, transparent)', borderBottom: '1px solid var(--border)',
                whiteSpace: 'nowrap', cursor: h.onClick ? 'pointer' : 'default',
                textTransform: 'uppercase', letterSpacing: '0.04em',
                userSelect: 'none'
              }}>
                {h.label}{h.sorted ? (h.sorted === 1 ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>{emptyMessage}</td></tr>
          ) : rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
              onContextMenu={onRowContextMenu ? (e) => onRowContextMenu(e, i) : undefined}
              onMouseEnter={e => { Array.from(e.currentTarget.cells).forEach(c => c.style.background = 'color-mix(in srgb, var(--surface2) 75%, transparent)') }}
              onMouseLeave={e => { Array.from(e.currentTarget.cells).forEach(c => c.style.background = '') }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '9px 14px', whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Modal({ open, onClose, title, children, width = 520 }) {
  if (!open) return null
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      padding: 16
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', borderRadius: 20,
        width, maxWidth: '100%', maxHeight: '85vh', overflow: 'auto',
        boxShadow: 'var(--shadow)', border: '1px solid var(--border)'
      }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>{title}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4, fontSize: 18 }}>×</button>
        </div>
        <div style={{ padding: '20px' }}>{children}</div>
      </div>
    </div>
  )
}

export function CategoryBadge({ category }) {
  const map = {
    'General': 'blue', 'OBC - NCL': 'amber', 'OBC': 'amber',
    'SC': 'purple', 'ST': 'red', 'EWS': 'green'
  }
  return <Badge color={map[category] || 'gray'}>{category || '—'}</Badge>
}

export function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        border: '2px solid var(--border)', borderTopColor: 'var(--text)',
        animation: 'spin 0.7s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
