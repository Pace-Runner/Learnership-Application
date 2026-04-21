import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import Admin from './Admin'

afterEach(() => {
  cleanup()
})

function getKpiValue(label) {
  const cardLabel = screen.getByText(label)
  const card = cardLabel.closest('article')
  expect(card).toBeTruthy()
  return card.querySelector('strong')?.textContent
}

test('ADMIN-REPORTS-ACCEPTANCE-1: Admin sees total application volume and placement rates with date filtering', () => {
  const reportApplications = [
    { status: 'Accepted', applied_at: '2026-04-01T10:15:00Z' },
    { status: 'Offered', applied_at: '2026-04-10T09:30:00Z' },
    { status: 'Rejected', applied_at: '2026-04-12T08:45:00Z' },
    { status: 'Received', applied_at: '2026-03-22T11:00:00Z' },
  ]

  render(
    <Admin
      onLogout={vi.fn()}
      listings={[]}
      reportApplications={reportApplications}
      userRole="Admin"
      isAuthenticated={true}
    />,
  )

  expect(getKpiValue('Total Applications Submitted')).toBe('4')
  expect(getKpiValue('Placed Applications')).toBe('2')
  expect(getKpiValue('Placement Rate')).toBe('50%')

  fireEvent.change(screen.getByLabelText(/report start date/i), {
    target: { value: '2026-04-01' },
  })
  fireEvent.change(screen.getByLabelText(/report end date/i), {
    target: { value: '2026-04-30' },
  })
  fireEvent.click(screen.getByRole('button', { name: /apply date range/i }))

  expect(getKpiValue('Total Applications Submitted')).toBe('3')
  expect(getKpiValue('Placed Applications')).toBe('2')
  expect(getKpiValue('Placement Rate')).toBe('66.7%')
})
