import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
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
