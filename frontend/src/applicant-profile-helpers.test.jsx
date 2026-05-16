import { describe, it, expect } from 'vitest'
import {
  createEducationRow,
  isCvFile,
  getFriendlySupabaseError,
} from './pages/ApplicantProfile'

describe('ApplicantProfile Helpers', () => {
  describe('createEducationRow', () => {
    it('returns education row with empty fields', () => {
      const row = createEducationRow()
      expect(row).toEqual({
        institution: '',
        qualification_id: '',
        nqf_level: '',
        year_completed: '',
      })
    })

    it('returns a new object each time', () => {
      const row1 = createEducationRow()
      const row2 = createEducationRow()
      expect(row1).not.toBe(row2)
      expect(row1).toEqual(row2)
    })

    it('allows modifying the returned row without affecting a new row', () => {
      const row1 = createEducationRow()
      row1.institution = 'University of Test'
      const row2 = createEducationRow()
      expect(row2.institution).toBe('')
    })
  })

  describe('isCvFile', () => {
    it('accepts .pdf files', () => {
      const file = { name: 'resume.pdf', type: 'application/pdf' }
      expect(isCvFile(file)).toBe(true)
    })

    it('accepts .doc files', () => {
      const file = { name: 'resume.doc', type: 'application/msword' }
      expect(isCvFile(file)).toBe(true)
    })

    it('accepts .docx files', () => {
      const file = {
        name: 'resume.docx',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }
      expect(isCvFile(file)).toBe(true)
    })

    it('rejects non-CV file extensions', () => {
      const file = { name: 'image.jpg', type: 'image/jpeg' }
      expect(isCvFile(file)).toBe(false)
    })

    it('rejects unsupported file types', () => {
      const file = { name: 'data.csv', type: 'text/csv' }
      expect(isCvFile(file)).toBe(false)
    })

    it('accepts files by extension when type is missing', () => {
      const file = { name: 'resume.pdf', type: '' }
      expect(isCvFile(file)).toBe(true)
    })

    it('accepts files by type when name is missing', () => {
      const file = { name: '', type: 'application/pdf' }
      expect(isCvFile(file)).toBe(true)
    })

    it('is case-insensitive for extensions', () => {
      const file1 = { name: 'Resume.PDF', type: '' }
      const file2 = { name: 'Resume.Pdf', type: '' }
      const file3 = { name: 'Resume.pDf', type: '' }
      expect(isCvFile(file1)).toBe(true)
      expect(isCvFile(file2)).toBe(true)
      expect(isCvFile(file3)).toBe(true)
    })

    it('rejects files with no name and no type', () => {
      const file = { name: '', type: '' }
      expect(isCvFile(file)).toBe(false)
    })

    it('rejects null file object', () => {
      expect(isCvFile({ name: null, type: null })).toBe(false)
    })

    it('rejects undefined file name and type', () => {
      expect(isCvFile({})).toBe(false)
    })
  })

  describe('getFriendlySupabaseError', () => {
    it('returns fallback message when error is null', () => {
      const result = getFriendlySupabaseError(null, 'Default error message')
      expect(result).toBe('Default error message')
    })

    it('returns fallback message when error is undefined', () => {
      const result = getFriendlySupabaseError(undefined, 'Default error message')
      expect(result).toBe('Default error message')
    })

    it('handles row-level security error (code 42501)', () => {
      const error = { code: '42501', message: 'Permission denied' }
      const result = getFriendlySupabaseError(error, 'Fallback')
      expect(result).toContain('do not have permission')
      expect(result).toContain('RLS SQL')
    })

    it('handles row-level security error (message)', () => {
      const error = { code: 'OTHER', message: 'row-level security error' }
      const result = getFriendlySupabaseError(error, 'Fallback')
      expect(result).toContain('do not have permission')
      expect(result).toContain('RLS SQL')
    })

    it('handles foreign key error (code 23503)', () => {
      const error = { code: '23503', message: 'FK constraint violation' }
      const result = getFriendlySupabaseError(error, 'Fallback')
      expect(result).toContain('account link is incomplete')
    })

    it('handles foreign key error (message)', () => {
      const error = { code: 'OTHER', message: 'FOREIGN KEY violation' }
      const result = getFriendlySupabaseError(error, 'Fallback')
      expect(result).toContain('account link is incomplete')
    })

    it('handles duplicate error (code 23505)', () => {
      const error = { code: '23505', message: 'Duplicate key' }
      const result = getFriendlySupabaseError(error, 'Fallback')
      expect(result).toContain('already exists')
    })

    it('handles duplicate error (message)', () => {
      const error = { code: 'OTHER', message: 'DUPLICATE key' }
      const result = getFriendlySupabaseError(error, 'Fallback')
      expect(result).toContain('already exists')
    })

    it('handles invalid input syntax error (code 22P02)', () => {
      const error = { code: '22P02', message: 'Invalid syntax' }
      const result = getFriendlySupabaseError(error, 'Fallback')
      expect(result).toContain('invalid format')
    })

    it('handles invalid input syntax error (message)', () => {
      const error = { code: 'OTHER', message: 'Invalid input syntax for type integer' }
      const result = getFriendlySupabaseError(error, 'Fallback')
      expect(result).toContain('invalid format')
    })

    it('handles network error (failed to fetch)', () => {
      const error = { code: 'OTHER', message: 'Failed to fetch' }
      const result = getFriendlySupabaseError(error, 'Fallback')
      expect(result).toContain('Network error')
    })

    it('handles network error (network)', () => {
      const error = { code: 'OTHER', message: 'Network connection lost' }
      const result = getFriendlySupabaseError(error, 'Fallback')
      expect(result).toContain('Network error')
    })

    it('returns original error message when no pattern matches', () => {
      const error = { code: 'UNKNOWN', message: 'Some other error' }
      const result = getFriendlySupabaseError(error, 'Fallback')
      expect(result).toBe('Some other error')
    })

    it('returns error message (not code) when error message is empty', () => {
      const error = { code: '42501', message: '' }
      const result = getFriendlySupabaseError(error, 'Fallback')
      expect(result).toContain('do not have permission')
    })

    it('handles case-insensitive error messages', () => {
      const error1 = { code: 'OTHER', message: 'ROW-LEVEL SECURITY error' }
      const error2 = { code: 'OTHER', message: 'Row-Level Security Error' }
      const error3 = { code: 'OTHER', message: 'row-level security error' }
      expect(getFriendlySupabaseError(error1, 'Fallback')).toContain('do not have permission')
      expect(getFriendlySupabaseError(error2, 'Fallback')).toContain('do not have permission')
      expect(getFriendlySupabaseError(error3, 'Fallback')).toContain('do not have permission')
    })

    it('prioritizes error code over message', () => {
      const error = { code: '42501', message: 'Some network error' }
      const result = getFriendlySupabaseError(error, 'Fallback')
      expect(result).toContain('do not have permission')
      expect(result).not.toContain('Network error')
    })

    it('handles error with no message property', () => {
      const error = { code: '23505' }
      const result = getFriendlySupabaseError(error, 'Fallback')
      expect(result).toContain('already exists')
    })
  })
})
