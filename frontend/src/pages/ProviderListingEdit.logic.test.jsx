import { describe, expect, it } from 'vitest'
import { formatRandAmount, validateForm } from './ProviderListingEdit'

describe('ProviderListingEdit logic tests', () => {
  it('validates the required fields and listing type', () => {
    const errors = validateForm(
      {
        title: '',
        type: 'Contract',
        description: '',
        stipend: '',
        location: '',
        duration: '',
        requirements: '',
        closing_date: '',
      },
      '2099-01-01',
    )

    expect(errors.title).toBe('Title is required.')
    expect(errors.type).toBe('Select a valid listing type.')
    expect(errors.description).toBe('Description is required.')
    expect(errors.stipend).toBe('Stipend is required.')
    expect(errors.location).toBe('Location is required.')
    expect(errors.duration).toBe('Duration is required.')
    expect(errors.requirements).toBe('Requirements are required.')
    expect(errors.closing_date).toBe('Closing date is required.')
  })

  it('rejects past closing dates and non-positive stipends', () => {
    const errors = validateForm(
      {
        title: 'Digital Literacy Programme',
        type: 'Learnership',
        description: 'Help learners build office and digital skills.',
        stipend: '-100',
        location: 'Cape Town',
        duration: '6 months',
        requirements: 'Basic computer literacy',
        closing_date: '2000-01-01',
      },
      '2025-01-01',
    )

    expect(errors.closing_date).toBe('Closing date cannot be in the past.')
    expect(errors.stipend).toBe('Stipend must be a positive number.')
  })

  it('formats rand amounts and falls back for invalid values', () => {
    expect(formatRandAmount('4200')).toBe('R4\u00a0200')
    expect(formatRandAmount('not-a-number')).toBe('R0')
  })
})