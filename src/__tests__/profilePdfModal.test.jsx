// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ProfilePdfModal from '../pages/roster/ProfilePdfModal'

afterEach(cleanup)

const columnDefs = [{ key: 'name', label: 'Full Name' }, { key: 'roll', label: 'Roll No.' }]
const getValue = (student, key) => student[key]

describe('ProfilePdfModal', () => {
  it('renders nothing print-related when closed', () => {
    render(
      <ProfilePdfModal open={false} onClose={() => {}} students={[]} columnDefs={columnDefs} getValue={getValue} />
    )
    // Print root still mounts (so it exists in the DOM) but has no content while closed
    const root = document.getElementById('profile-print-root')
    expect(root).toBeTruthy()
    expect(root.innerHTML).toBe('')
  })

  it('shows an empty-state prompt when no students are selected', () => {
    render(
      <ProfilePdfModal open={true} onClose={() => {}} students={[]} columnDefs={columnDefs} getValue={getValue} />
    )
    expect(screen.getByText(/Select one or more candidates/i)).toBeTruthy()
  })

  it('shows the candidate count and print button when students are selected', () => {
    const students = [{ name: 'Alice', roll: '1A' }, { name: 'Bob', roll: '2A' }]
    render(
      <ProfilePdfModal open={true} onClose={() => {}} students={students} columnDefs={columnDefs} getValue={getValue} />
    )
    expect(screen.getByText('2 candidates')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Print \/ Save as PDF/i })).toBeTruthy()
  })

  it('populates the print root with one profile page per selected student', () => {
    const students = [{ name: 'Alice Verma', roll: '1A' }, { name: 'Bob Singh', roll: '2A' }]
    render(
      <ProfilePdfModal open={true} onClose={() => {}} students={students} columnDefs={columnDefs} getValue={getValue} />
    )
    const root = document.getElementById('profile-print-root')
    expect(root.querySelectorAll('.profile-page')).toHaveLength(2)
    expect(root.textContent).toContain('Alice Verma')
    expect(root.textContent).toContain('Bob Singh')
  })

  it('invokes window.print when the print button is clicked', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    const students = [{ name: 'Alice', roll: '1A' }]
    render(
      <ProfilePdfModal open={true} onClose={() => {}} students={students} columnDefs={columnDefs} getValue={getValue} />
    )
    fireEvent.click(screen.getByRole('button', { name: /Print \/ Save as PDF/i }))
    // requestAnimationFrame defers the call — flush it synchronously for the test
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        expect(printSpy).toHaveBeenCalled()
        printSpy.mockRestore()
        resolve()
      })
    })
  })

  it('does not crash when a student has no meaningful data in any visible column', () => {
    render(
      <ProfilePdfModal open={true} onClose={() => {}} students={[{}]} columnDefs={columnDefs} getValue={getValue} />
    )
    const root = document.getElementById('profile-print-root')
    expect(root.textContent).toContain('No additional details available')
  })
})
