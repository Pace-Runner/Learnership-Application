import { describe, it, expect } from 'vitest'
import { validateForm, formatRandAmount } from './pages/ProviderListingEdit'

describe('ProviderListingEdit helpers', () => {
  it('validateForm reports errors for empty values and past dates', () => {
    const minDate = '2099-01-01'
    const empty = {
      title: '',
      type: 'Learnership',
      description: '',
      stipend: '',
      location: '',
      duration: '',
      requirements: '',
      closing_date: '',
    }

    const errors = validateForm(empty, minDate)
    expect(errors.title).toBeTruthy()
    expect(errors.description).toBeTruthy()
    expect(errors.location).toBeTruthy()
    expect(errors.duration).toBeTruthy()
    expect(errors.requirements).toBeTruthy()
    expect(errors.closing_date).toBeTruthy()
    expect(errors.stipend).toBeTruthy()
  })

  it('validateForm rejects past closing dates and invalid stipend', () => {
    const minDate = '2100-01-01'
    const form = {
      title: 'Title',
      type: 'Learnership',
      description: 'Desc',
      stipend: '-100',
      location: 'Loc',
      duration: '3 months',
      requirements: 'Reqs',
      closing_date: '2000-01-01',
    }

    const errors = validateForm(form, minDate)
    expect(errors.closing_date).toBe('Closing date cannot be in the past.')
    expect(errors.stipend).toBe('Stipend must be a positive number.')
  })

  it('formatRandAmount formats numbers and handles non-numeric input', () => {
    expect(formatRandAmount('abc')).toBe('R0')
    const formatted = formatRandAmount('4500')
    expect(formatted.startsWith('R')).toBe(true)
    expect(formatted.includes('4')).toBe(true)
  })
})
