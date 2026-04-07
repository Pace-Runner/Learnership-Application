import { test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

test('redirects to home when accessing protected route without login', () => {
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <App />
    </MemoryRouter>
  )

  expect(screen.getByText(/BUILDING TALENT/i)).toBeTruthy()
})