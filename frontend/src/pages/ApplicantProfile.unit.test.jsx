import { describe, test, expect } from 'vitest'
import { createEducationRow, isCvFile, getFriendlySupabaseError } from './ApplicantProfile'

describe('ApplicantProfile helpers', () => {
  test('createEducationRow returns empty education object', () => {
    const row = createEducationRow()
    expect(row).toEqual({ institution: '', qualification_id: '', nqf_level: '', year_completed: '' })
  })

  test('isCvFile accepts pdf and docx and rejects other types', () => {
    const pdf = new File(['a'], 'resume.pdf', { type: 'application/pdf' })
    const docx = new File(['b'], 'cv.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    const txt = new File(['c'], 'notes.txt', { type: 'text/plain' })

    expect(isCvFile(pdf)).toBe(true)
    expect(isCvFile(docx)).toBe(true)
    expect(isCvFile(txt)).toBe(false)
  })

  test('getFriendlySupabaseError maps common codes to friendly messages', () => {
    expect(getFriendlySupabaseError({ code: '42501', message: 'row-level security failed' }, 'fallback')).toContain('permission')
    expect(getFriendlySupabaseError({ code: '23503', message: 'foreign key' }, 'fallback')).toContain('incomplete')
    expect(getFriendlySupabaseError({ code: '23505', message: 'duplicate key' }, 'fallback')).toContain('already exists')
    expect(getFriendlySupabaseError({ code: '22P02', message: 'invalid input syntax' }, 'fallback')).toContain('invalid format')
    expect(getFriendlySupabaseError({ message: 'failed to fetch' }, 'fallback')).toContain('Network error')
    expect(getFriendlySupabaseError(null, 'fallback')).toBe('fallback')
  })
})
