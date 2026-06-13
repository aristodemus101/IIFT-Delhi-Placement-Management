import React from 'react'
import { Btn, Modal } from '../../components/UI'

export default function ColumnsModal({ open, onClose, allColumnDefs, visibleCols, setVisibleCols, toggleColumn }) {
  return (
    <Modal open={open} onClose={onClose} title="Show or hide columns" width={620}>
      <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
        Choose which columns appear in roster and exports. At least one column must remain visible.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Btn size="sm" variant="ghost" onClick={() => setVisibleCols(allColumnDefs.map(c => c.key))}>Select all</Btn>
        <Btn size="sm" variant="ghost" onClick={() => setVisibleCols(allColumnDefs.slice(0, 1).map(c => c.key))}>Show first only</Btn>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', maxHeight: 360, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, background: 'var(--surface2)' }}>
        {allColumnDefs.map(def => {
          const checked = visibleCols.includes(def.key)
          const disableUncheck = checked && visibleCols.length <= 1
          return (
            <label key={def.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: disableUncheck ? 'not-allowed' : 'pointer', opacity: disableUncheck ? 0.6 : 1 }}>
              <input type="checkbox" checked={checked} disabled={disableUncheck} onChange={() => toggleColumn(def.key)} />
              <span>{def.label}</span>
            </label>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
        <Btn variant="primary" onClick={onClose}>Done</Btn>
      </div>
    </Modal>
  )
}
