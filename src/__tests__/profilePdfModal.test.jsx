// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

// Mock the canvas download so the test doesn't need a real canvas/toBlob.
const downloadSpy = vi.fn(() => Promise.resolve())
vi.mock('../lib/profileCardCanvas', () => ({
  downloadProfileCard: (...args) => downloadSpy(...args),
}))

import ProfilePdfModal from '../pages/roster/ProfilePdfModal'

const student = (over = {}) => ({
  _id: over._id || 'x1',
  cohort: '28-Delhi-IB',
  'Full Name': over.name || 'Alice Verma',
  'Roll No.': over.roll || '1A',
  'Official Institute Email ID': 'alice_d28@iift.edu',
  ...over,
})

afterEach(cleanup)
beforeEach(() => { downloadSpy.mockClear() })

describe('ProfilePdfModal (canvas download)', () => {
  it('shows an empty-state prompt when no students are selected', () => {
    render(<ProfilePdfModal open={true} onClose={() => {}} students={[]} />)
    expect(screen.getByText(/Select one or more candidates/i)).toBeTruthy()
  })

  it('lists each selected candidate with a PNG and Copy button', () => {
    const students = [student({ _id: 'a', name: 'Alice Verma' }), student({ _id: 'b', name: 'Bob Singh', 'Roll No.': '2A' })]
    render(<ProfilePdfModal open={true} onClose={() => {}} students={students} />)
    expect(screen.getByText('2 candidates')).toBeTruthy()
    expect(screen.getByText('Alice Verma')).toBeTruthy()
    expect(screen.getByText('Bob Singh')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /PNG/i })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /Copy/i })).toHaveLength(2)
  })

  it('downloads the card PNG when a candidate PNG button is clicked', async () => {
    render(<ProfilePdfModal open={true} onClose={() => {}} students={[student({ name: 'Alice Verma' })]} />)
    fireEvent.click(screen.getByRole('button', { name: /PNG/i }))
    await waitFor(() => expect(downloadSpy).toHaveBeenCalledTimes(1))
    // filename is "<Name> - IIFT Delhi.png"
    expect(downloadSpy.mock.calls[0][1]).toMatch(/Alice_Verma - IIFT Delhi\.png/)
  })

  it('copies the profile details when Copy is clicked', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.assign(navigator, { clipboard: { writeText } })
    render(<ProfilePdfModal open={true} onClose={() => {}} students={[student({ name: 'Alice Verma' })]} />)
    fireEvent.click(screen.getByRole('button', { name: /Copy/i }))
    await waitFor(() => expect(writeText).toHaveBeenCalled())
    expect(writeText.mock.calls[0][0]).toContain('Alice Verma')
  })

  it('does not crash for a student with minimal data', () => {
    render(<ProfilePdfModal open={true} onClose={() => {}} students={[{ _id: 'z', cohort: '' }]} />)
    expect(screen.getByText('1 candidate')).toBeTruthy()
    expect(screen.getByRole('button', { name: /PNG/i })).toBeTruthy()
  })
})
