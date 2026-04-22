import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const jsPdfOutputMock = vi.fn(() => new Blob(['pdf-bytes'], { type: 'application/pdf' }))

vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(function mockJsPdfConstructor() {
    return {
    setFontSize: vi.fn(),
    text: vi.fn(),
    addPage: vi.fn(),
    splitTextToSize: vi.fn((text) => [text]),
    output: jsPdfOutputMock,
    }
  }),
}))

import Admin from './Admin'

afterEach(() => {
  cleanup()
})

test('ADMIN-REPORTS-ACCEPTANCE-1: admin page no longer shows application totals or date filters', () => {
  render(
    <Admin
      onLogout={vi.fn()}
      listings={[]}
      reportApplications={[]}
      userRole="Admin"
      isAuthenticated={true}
    />,
  )

  expect(screen.queryByText(/Total Applications Submitted/i)).toBeNull()
  expect(screen.queryByText(/Placed Applications/i)).toBeNull()
  expect(screen.queryByText(/Placement Rate/i)).toBeNull()
  expect(screen.queryByLabelText(/report start date/i)).toBeNull()
  expect(screen.queryByLabelText(/report end date/i)).toBeNull()
  expect(screen.queryByRole('button', { name: /apply date range/i })).toBeNull()
  expect(screen.queryByRole('button', { name: /reset to last 30 days/i })).toBeNull()
})

test('ADMIN-REPORTS-ACCEPTANCE-2: admin can export full moderation report as CSV', async () => {
  const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:csv-report')
  const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  const originalCreateElement = document.createElement.bind(document)
  const anchorClickSpy = vi.fn()
  let createdAnchor = null

  const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
    if (String(tagName).toLowerCase() === 'a') {
      const anchor = originalCreateElement('a', options)
      anchor.click = anchorClickSpy
      createdAnchor = anchor
      return anchor
    }

    return originalCreateElement(tagName, options)
  })

  render(
    <Admin
      onLogout={vi.fn()}
      userRole="Admin"
      isAuthenticated={true}
      listings={[
        { id: 'p-1', title: 'Pending Listing', provider: 'Provider A', status: 'Pending' },
        { id: 'a-1', title: 'Approved Listing', provider: 'Provider B', status: 'Approved' },
        { id: 'r-1', title: 'Removed Listing', provider: 'Provider C', status: 'Removed' },
      ]}
      reportApplications={[]}
    />,
  )

  fireEvent.change(screen.getByLabelText(/export format/i), { target: { value: 'csv' } })
  fireEvent.click(screen.getByRole('button', { name: /^export report$/i }))

  await waitFor(() => {
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1)
    expect(anchorClickSpy).toHaveBeenCalledTimes(1)
    expect(createdAnchor?.download).toMatch(/\.csv$/)
    expect(screen.getByText(/Moderation report exported as CSV/i)).toBeTruthy()
  })

  createElementSpy.mockRestore()
  createObjectUrlSpy.mockRestore()
  revokeObjectUrlSpy.mockRestore()
})

test('ADMIN-REPORTS-ACCEPTANCE-3: admin can export full moderation report as PDF', async () => {
  const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf-report')
  const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  const originalCreateElement = document.createElement.bind(document)
  const anchorClickSpy = vi.fn()
  let createdAnchor = null

  const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
    if (String(tagName).toLowerCase() === 'a') {
      const anchor = originalCreateElement('a', options)
      anchor.click = anchorClickSpy
      createdAnchor = anchor
      return anchor
    }

    return originalCreateElement(tagName, options)
  })

  render(
    <Admin
      onLogout={vi.fn()}
      userRole="Admin"
      isAuthenticated={true}
      listings={[
        { id: 'p-1', title: 'Pending Listing', provider: 'Provider A', status: 'Pending' },
        { id: 'a-1', title: 'Approved Listing', provider: 'Provider B', status: 'Approved' },
        { id: 'r-1', title: 'Removed Listing', provider: 'Provider C', status: 'Removed' },
      ]}
      reportApplications={[]}
    />,
  )

  fireEvent.change(screen.getByLabelText(/export format/i), { target: { value: 'pdf' } })
  fireEvent.click(screen.getByRole('button', { name: /^export report$/i }))

  await waitFor(() => {
    expect(jsPdfOutputMock).toHaveBeenCalled()
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1)
    expect(anchorClickSpy).toHaveBeenCalledTimes(1)
    expect(createdAnchor?.download).toMatch(/\.pdf$/)
    expect(screen.getByText(/Moderation report exported as PDF/i)).toBeTruthy()
  })

  createElementSpy.mockRestore()
  createObjectUrlSpy.mockRestore()
  revokeObjectUrlSpy.mockRestore()
})
