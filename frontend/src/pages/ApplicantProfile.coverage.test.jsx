import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const applicantState = vi.hoisted(() => ({
  userId: 'user-1',
  authEmail: '',
  qualificationError: null,
  skillTagsError: null,
  qualificationDelayMs: 0,
  skillTagsDelayMs: 0,
  profile: {
    id: 'profile-1',
    user_id: 'user-1',
    first_name: 'Taylor',
    last_name: 'Mokoena',
    phone: '0825551234',
    location: 'Gqeberha',
    date_of_birth: '2001-04-05',
    id_number: '0104055009087',
    cv_url: 'user-1/current-cv.pdf',
    about_me: 'Ready to learn and contribute.',
  },
  education: [
    {
      institution: 'Nelson Mandela University',
      qualification_id: 'qual-1',
      nqf_level: 4,
      year_completed: 2023,
    },
  ],
  skills: [{ skill_tag_id: 'skill-1' }],
  qualifications: [
    { id: 'qual-1', title: 'Business Administration Certificate', nqf_level: 4, saqa_id: '12345' },
    { id: 'qual-2', title: 'Project Management Diploma', nqf_level: 6, saqa_id: '67890' },
  ],
  skillTags: [
    { id: 'skill-1', name: 'Communication' },
    { id: 'skill-2', name: 'Excel' },
  ],
  profileFiles: [{ name: 'profile.png' }],
  docFiles: [{ name: 'current-cv.pdf', created_at: '2026-04-01T10:00:00.000Z' }],
  profileSignedUrl: 'https://signed.example/profile.png',
  cvSignedUrl: 'https://signed.example/current-cv.pdf',
  docSignedUrl: 'https://signed.example/document.pdf',
}))

const applicantSpies = vi.hoisted(() => ({
  getUser: vi.fn(),
  profileSelectMaybeSingle: vi.fn(),
  profileUpdate: vi.fn(),
  profileUpdateEq: vi.fn(),
  profileInsert: vi.fn(),
  profileInsertSingle: vi.fn(),
  educationOrder: vi.fn(),
  educationDeleteEq: vi.fn(),
  educationInsert: vi.fn(),
  skillsEq: vi.fn(),
  skillsDeleteEq: vi.fn(),
  skillsInsert: vi.fn(),
  skillTagsInsert: vi.fn(),
  skillTagsInsertSingle: vi.fn(),
  profileStorageList: vi.fn(),
  profileStorageCreateSignedUrl: vi.fn(),
  profileStorageUpload: vi.fn(),
  profileStorageRemove: vi.fn(),
  docsStorageList: vi.fn(),
  docsStorageCreateSignedUrl: vi.fn(),
  docsStorageUpload: vi.fn(),
  docsStorageRemove: vi.fn(),
  windowOpen: vi.fn(),
}))

vi.mock('../lib/supabaseClient', () => {
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  const supabase = {
    auth: {
      getUser: applicantSpies.getUser,
    },
    from: vi.fn((table) => {
      if (table === 'nqf_qualifications') {
        return {
          select: () => ({
            order: async () => {
              if (applicantState.qualificationDelayMs > 0) {
                await delay(applicantState.qualificationDelayMs)
              }
              return { data: applicantState.qualifications, error: applicantState.qualificationError }
            },
          }),
        }
      }

      if (table === 'skill_tags') {
        return {
          select: () => ({
            order: async () => {
              if (applicantState.skillTagsDelayMs > 0) {
                await delay(applicantState.skillTagsDelayMs)
              }
              return { data: applicantState.skillTags, error: applicantState.skillTagsError }
            },
          }),
          insert: applicantSpies.skillTagsInsert.mockImplementation((payload) => ({
            select: () => ({
              single: applicantSpies.skillTagsInsertSingle.mockImplementation(async () => ({
                data: { id: 'skill-new', ...payload },
                error: null,
              })),
            }),
          })),
        }
      }

      if (table === 'applicant_profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: applicantSpies.profileSelectMaybeSingle,
            }),
          }),
          update: applicantSpies.profileUpdate.mockImplementation((payload) => ({
            eq: applicantSpies.profileUpdateEq.mockImplementation(async () => ({ error: null, payload })),
          })),
          insert: applicantSpies.profileInsert.mockImplementation((payload) => ({
            select: () => ({
              single: applicantSpies.profileInsertSingle.mockImplementation(async () => ({
                data: { id: 'profile-new', ...payload },
                error: null,
              })),
            }),
          })),
          delete: () => ({
            eq: async () => ({ error: null }),
          }),
        }
      }

      if (table === 'applicant_education') {
        return {
          select: () => ({
            eq: () => ({
              order: applicantSpies.educationOrder,
            }),
          }),
          delete: () => ({
            eq: applicantSpies.educationDeleteEq.mockResolvedValue({ error: null }),
          }),
          insert: applicantSpies.educationInsert.mockResolvedValue({ error: null }),
        }
      }

      if (table === 'applicant_skills') {
        return {
          select: () => ({
            eq: applicantSpies.skillsEq,
          }),
          delete: () => ({
            eq: applicantSpies.skillsDeleteEq.mockResolvedValue({ error: null }),
          }),
          insert: applicantSpies.skillsInsert.mockResolvedValue({ error: null }),
        }
      }

      return {
        select: () => ({
          eq: async () => ({ data: null, error: null }),
        }),
      }
    }),
    storage: {
      from: vi.fn((bucket) => {
        if (bucket === 'profile-images') {
          return {
            list: applicantSpies.profileStorageList,
            createSignedUrl: applicantSpies.profileStorageCreateSignedUrl,
            upload: applicantSpies.profileStorageUpload,
            remove: applicantSpies.profileStorageRemove,
          }
        }

        if (bucket === 'applicant-documents') {
          return {
            list: applicantSpies.docsStorageList,
            createSignedUrl: applicantSpies.docsStorageCreateSignedUrl,
            upload: applicantSpies.docsStorageUpload,
            remove: applicantSpies.docsStorageRemove,
          }
        }

        return {
          list: async () => ({ data: [], error: null }),
          createSignedUrl: async () => ({ data: null, error: null }),
          upload: async () => ({ data: null, error: null }),
          remove: async () => ({ data: null, error: null }),
        }
      }),
    },
  }

  return {
    hasSupabaseConfig: true,
    supabase,
  }
})

const loadApplicantProfile = async () => (await import('./ApplicantProfile')).default

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  vi.clearAllMocks()
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn()
  }
  applicantState.profile = {
    id: 'profile-1',
    user_id: 'user-1',
    first_name: 'Taylor',
    last_name: 'Mokoena',
    phone: '0825551234',
    location: 'Gqeberha',
    date_of_birth: '2001-04-05',
    id_number: '0104055009087',
    cv_url: 'user-1/current-cv.pdf',
    about_me: 'Ready to learn and contribute.',
  }
  applicantState.education = [
    {
      institution: 'Nelson Mandela University',
      qualification_id: 'qual-1',
      nqf_level: 4,
      year_completed: 2023,
    },
  ]
  applicantState.skills = [{ skill_tag_id: 'skill-1' }]
  applicantState.authEmail = ''
  applicantState.qualificationError = null
  applicantState.skillTagsError = null
  applicantState.qualificationDelayMs = 0
  applicantState.skillTagsDelayMs = 0

  applicantSpies.getUser.mockResolvedValue({
    data: { user: { id: applicantState.userId, email: applicantState.authEmail } },
    error: null,
  })
  applicantSpies.profileSelectMaybeSingle.mockResolvedValue({ data: applicantState.profile, error: null })
  applicantSpies.educationOrder.mockResolvedValue({ data: applicantState.education, error: null })
  applicantSpies.skillsEq.mockResolvedValue({ data: applicantState.skills, error: null })
  applicantSpies.profileStorageList.mockResolvedValue({ data: applicantState.profileFiles, error: null })
  applicantSpies.profileStorageCreateSignedUrl.mockResolvedValue({
    data: { signedUrl: applicantState.profileSignedUrl },
    error: null,
  })
  applicantSpies.docsStorageList.mockResolvedValue({ data: applicantState.docFiles, error: null })
  applicantSpies.docsStorageCreateSignedUrl.mockResolvedValue({
    data: { signedUrl: applicantState.docSignedUrl },
    error: null,
  })
  applicantSpies.profileStorageUpload.mockResolvedValue({ error: null })
  applicantSpies.profileStorageRemove.mockResolvedValue({ error: null })
  applicantSpies.docsStorageUpload.mockResolvedValue({ error: null })
  applicantSpies.docsStorageRemove.mockResolvedValue({ error: null })
  applicantSpies.profileUpdateEq.mockResolvedValue({ error: null })
  applicantSpies.profileUpdate.mockImplementation((payload) => ({
    eq: applicantSpies.profileUpdateEq.mockImplementation(async () => ({ error: null, payload })),
  }))
  applicantSpies.profileInsert.mockResolvedValue({ error: null })
  applicantSpies.profileInsertSingle.mockResolvedValue({ data: { id: 'profile-new' }, error: null })
  applicantSpies.educationDeleteEq.mockResolvedValue({ error: null })
  applicantSpies.educationInsert.mockResolvedValue({ error: null })
  applicantSpies.skillsDeleteEq.mockResolvedValue({ error: null })
  applicantSpies.skillsInsert.mockResolvedValue({ error: null })
  applicantSpies.windowOpen.mockImplementation(() => null)
  window.open = applicantSpies.windowOpen
})

describe('ApplicantProfile coverage', () => {
  test('loads profile, education, skills, and uploaded files from Supabase', async () => {
    const ApplicantProfile = await loadApplicantProfile()

    render(
      <MemoryRouter>
        <ApplicantProfile onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    expect(await screen.findByDisplayValue('Taylor')).toBeTruthy()
    expect(screen.getByDisplayValue('Mokoena')).toBeTruthy()
    expect(screen.getByDisplayValue('0825551234')).toBeTruthy()
    expect(screen.getByDisplayValue('Gqeberha')).toBeTruthy()
    expect(screen.getByDisplayValue('0104055009087')).toBeTruthy()
    expect(screen.getByDisplayValue('Ready to learn and contribute.')).toBeTruthy()
    expect(await screen.findByText('Business Administration Certificate (NQF 4)')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Remove Communication' })).toBeTruthy()
    expect(screen.getByText(/Current CV:/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Open uploaded CV/i }).getAttribute('href')).toBe(
      applicantState.docSignedUrl,
    )
    expect(screen.getByRole('button', { name: /Delete profile picture/i }).disabled).toBe(false)
    expect(screen.getByAltText('Applicant profile')).toBeTruthy()
  })

  test('creates a new applicant profile and saves education plus skills to Supabase', async () => {
    applicantState.profile = null
    applicantSpies.profileSelectMaybeSingle.mockResolvedValue({ data: null, error: null })
    applicantSpies.educationOrder.mockResolvedValue({ data: [], error: null })
    applicantSpies.skillsEq.mockResolvedValue({ data: [], error: null })

    const ApplicantProfile = await loadApplicantProfile()

    render(
      <MemoryRouter>
        <ApplicantProfile onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    await screen.findByText('Personal details')

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ayesha' } })
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Naidoo' } })
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '0812345678' } })
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Pretoria' } })
    fireEvent.change(screen.getByLabelText('ID number'), { target: { value: '0202025009088' } })
    fireEvent.change(screen.getByLabelText('Institution'), { target: { value: 'Tshwane University of Technology' } })
    fireEvent.change(screen.getByLabelText('Qualification'), { target: { value: 'qual-2' } })
    fireEvent.change(screen.getByLabelText('NQF level'), { target: { value: '6' } })
    fireEvent.change(screen.getByLabelText('Year completed'), { target: { value: '2024' } })
    fireEvent.click(screen.getByRole('button', { name: 'Communication' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove Communication' })).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Save full profile' }))

    await waitFor(() => expect(applicantSpies.profileInsertSingle).toHaveBeenCalled())
    expect(applicantSpies.educationInsert).toHaveBeenCalled()
    expect(applicantSpies.skillsInsert).toHaveBeenCalled()

    const insertedProfilePayload = applicantSpies.profileInsert.mock.calls[0]?.[0]
    expect(insertedProfilePayload.user_id).toBe(applicantState.userId)
    expect(insertedProfilePayload.first_name).toBe('Ayesha')
    expect(insertedProfilePayload.last_name).toBe('Naidoo')

    const educationPayload = applicantSpies.educationInsert.mock.calls[0]?.[0]
    expect(educationPayload[0].qualification_id).toBe('qual-2')
    expect(educationPayload[0].nqf_level).toBe(6)

    const skillsPayload = applicantSpies.skillsInsert.mock.calls[0]?.[0]
    expect(skillsPayload[0].skill_tag_id).toBe('skill-1')
  })

  test('validates CV uploads, persists CV url, and opens uploaded documents', async () => {
    const ApplicantProfile = await loadApplicantProfile()

    render(
      <MemoryRouter>
        <ApplicantProfile onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    await screen.findByDisplayValue('Taylor')

    const fileInputs = document.querySelectorAll('input[type="file"]')
    const cvInput = fileInputs[1]
    const documentInput = fileInputs[2]

    fireEvent.change(cvInput, {
      target: { files: [new File(['bad'], 'cv.txt', { type: 'text/plain' })] },
    })

    expect(screen.getByText('Only PDF and DOCX files are allowed for CV uploads.')).toBeTruthy()

    fireEvent.change(cvInput, {
      target: { files: [new File(['cv'], 'updated-cv.pdf', { type: 'application/pdf' })] },
    })

    await waitFor(() => expect(applicantSpies.docsStorageUpload).toHaveBeenCalled())
    expect(applicantSpies.profileUpdateEq).toHaveBeenCalled()

    const cvUpdatePayload = applicantSpies.profileUpdate.mock.calls.at(-1)?.[0]
    expect(cvUpdatePayload.cv_url).toContain('updated-cv.pdf')

    fireEvent.change(documentInput, {
      target: { files: [new File(['doc'], 'supporting-doc.pdf', { type: 'application/pdf' })] },
    })

    await waitFor(() => expect(applicantSpies.docsStorageUpload).toHaveBeenCalledTimes(2))

    applicantSpies.docsStorageCreateSignedUrl.mockClear()
    applicantSpies.windowOpen.mockClear()

    fireEvent.click(screen.getByRole('button', { name: /current-cv\.pdf/i }))

    await waitFor(() => expect(applicantSpies.docsStorageCreateSignedUrl).toHaveBeenCalled())
    await waitFor(() => expect(applicantSpies.windowOpen).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /Delete document/i }))
    await waitFor(() => expect(applicantSpies.docsStorageRemove).toHaveBeenCalled())
    expect(applicantSpies.profileUpdateEq).toHaveBeenCalledWith('user_id', applicantState.userId)
  })

  test('keeps unsaved personal details and selected skills after CV upload', async () => {
    const ApplicantProfile = await loadApplicantProfile()

    render(
      <MemoryRouter>
        <ApplicantProfile onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    await screen.findByDisplayValue('Taylor')

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Neo' } })
    
    const fileInputs = document.querySelectorAll('input[type="file"]')
    const cvInput = fileInputs[1]

    fireEvent.change(cvInput, {
      target: { files: [new File(['cv'], 'draft-cv.pdf', { type: 'application/pdf' })] },
    })

    await waitFor(() => expect(applicantSpies.docsStorageUpload).toHaveBeenCalled())

    expect(screen.getByDisplayValue('Neo')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Remove Communication' })).toBeTruthy()
  })

  test('blocks submission when required fields are missing', async () => {
    const ApplicantProfile = await loadApplicantProfile()

    render(
      <MemoryRouter>
        <ApplicantProfile onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    await screen.findByDisplayValue('Taylor')
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save full profile' }))

    const messages = await screen.findAllByText('First name is required.')
    expect(messages.length).toBeGreaterThan(0)
    expect(applicantSpies.profileUpdateEq).not.toHaveBeenCalled()
    expect(applicantSpies.profileInsertSingle).not.toHaveBeenCalled()
  })

  test('supports multiple education entries and saves all of them', async () => {
    const ApplicantProfile = await loadApplicantProfile()

    render(
      <MemoryRouter>
        <ApplicantProfile onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    await screen.findByDisplayValue('Taylor')
    fireEvent.click(screen.getByRole('button', { name: 'Add education entry' }))

    fireEvent.change(screen.getByLabelText('Institution', { selector: '#education-institution-1' }), {
      target: { value: 'Cape Peninsula University of Technology' },
    })
    fireEvent.change(screen.getByLabelText('Qualification', { selector: '#education-qualification-1' }), {
      target: { value: 'qual-2' },
    })
    fireEvent.change(screen.getByLabelText('NQF level', { selector: '#education-nqf-level-1' }), {
      target: { value: '6' },
    })
    fireEvent.change(screen.getByLabelText('Year completed', { selector: '#education-year-1' }), {
      target: { value: '2025' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save full profile' }))

    await waitFor(() => expect(applicantSpies.educationInsert).toHaveBeenCalled())
    const payload = applicantSpies.educationInsert.mock.calls.at(-1)?.[0] || []
    expect(payload.length).toBe(2)
    expect(payload.some((row) => row.institution.includes('Cape Peninsula'))).toBe(true)
  })

  test('allows selecting multiple skills and saves all selected values', async () => {
    const ApplicantProfile = await loadApplicantProfile()

    render(
      <MemoryRouter>
        <ApplicantProfile onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    await screen.findByDisplayValue('Taylor')
    fireEvent.click(screen.getByRole('button', { name: 'View all skills' }))
    fireEvent.click(screen.getByRole('button', { name: 'Excel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save full profile' }))

    await waitFor(() => expect(applicantSpies.skillsInsert).toHaveBeenCalled())
    const payload = applicantSpies.skillsInsert.mock.calls.at(-1)?.[0] || []
    const selectedIds = payload.map((row) => row.skill_tag_id)
    expect(selectedIds).toContain('skill-1')
    expect(selectedIds).toContain('skill-2')
  })

  test('edits an existing profile and re-saves updated values', async () => {
    const ApplicantProfile = await loadApplicantProfile()

    render(
      <MemoryRouter>
        <ApplicantProfile onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    await screen.findByDisplayValue('Taylor')
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Durban' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save full profile' }))

    await waitFor(() => expect(applicantSpies.profileUpdateEq).toHaveBeenCalled())
    const updatePayload = applicantSpies.profileUpdate.mock.calls.at(-1)?.[0]
    expect(updatePayload.location).toBe('Durban')
  })

  test('rejects oversized CV files before upload', async () => {
    const ApplicantProfile = await loadApplicantProfile()

    render(
      <MemoryRouter>
        <ApplicantProfile onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    await screen.findByDisplayValue('Taylor')
    const fileInputs = document.querySelectorAll('input[type="file"]')
    const cvInput = fileInputs[1]

    const largeFile = new File(['tiny'], 'too-large.pdf', { type: 'application/pdf' })
    Object.defineProperty(largeFile, 'size', { value: 5 * 1024 * 1024 + 1 })

    fireEvent.change(cvInput, { target: { files: [largeFile] } })

    expect(screen.getByText('The selected CV is too large. Maximum size is 5MB.')).toBeTruthy()
    expect(applicantSpies.docsStorageUpload).not.toHaveBeenCalled()
  })

  test('unauthenticated users cannot start CV upload', async () => {
    applicantSpies.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const ApplicantProfile = await loadApplicantProfile()

    render(
      <MemoryRouter>
        <ApplicantProfile onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    await screen.findByText('Profile and documents')
    fireEvent.click(screen.getByRole('button', { name: 'Upload CV' }))

    expect(screen.getByText('Please sign in first. Uploads are only available for authenticated users.')).toBeTruthy()
    expect(applicantSpies.docsStorageUpload).not.toHaveBeenCalled()
  })

  test('shows loading state while dropdown data is fetching', async () => {
    applicantState.qualificationDelayMs = 30
    applicantState.skillTagsDelayMs = 30
    const ApplicantProfile = await loadApplicantProfile()

    render(
      <MemoryRouter>
        <ApplicantProfile onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Loading qualification and skills data...')).toBeTruthy()
    await screen.findByDisplayValue('Taylor')
  })

  test('shows dropdown error when qualification or skills fetch fails', async () => {
    applicantState.qualificationError = { message: 'failed' }
    const ApplicantProfile = await loadApplicantProfile()

    render(
      <MemoryRouter>
        <ApplicantProfile onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Could not load qualification and skills options right now.')).toBeTruthy()
  })

  test('renders NQF level options from 1 to 10 in education section', async () => {
    const ApplicantProfile = await loadApplicantProfile()

    render(
      <MemoryRouter>
        <ApplicantProfile onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    await screen.findByDisplayValue('Taylor')
    const nqfSelect = screen.getByLabelText('NQF level', { selector: '#education-nqf-level-0' })
    const optionLabels = Array.from(nqfSelect.querySelectorAll('option')).map((option) => option.textContent)

    expect(optionLabels).toContain('NQF level 1')
    expect(optionLabels).toContain('NQF level 10')
    expect(optionLabels.filter((label) => String(label).startsWith('NQF level ')).length).toBe(10)
  })

  test('replaces old CV url when a second valid CV is uploaded', async () => {
    const ApplicantProfile = await loadApplicantProfile()

    render(
      <MemoryRouter>
        <ApplicantProfile onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    await screen.findByDisplayValue('Taylor')
    const fileInputs = document.querySelectorAll('input[type="file"]')
    const cvInput = fileInputs[1]

    fireEvent.change(cvInput, {
      target: { files: [new File(['cv1'], 'first-cv.pdf', { type: 'application/pdf' })] },
    })
    await waitFor(() => expect(applicantSpies.docsStorageUpload).toHaveBeenCalledTimes(1))

    fireEvent.change(cvInput, {
      target: { files: [new File(['cv2'], 'second-cv.pdf', { type: 'application/pdf' })] },
    })
    await waitFor(() => expect(applicantSpies.docsStorageUpload).toHaveBeenCalledTimes(2))

    const latestUpdatePayload = applicantSpies.profileUpdate.mock.calls.at(-1)?.[0]
    expect(latestUpdatePayload.cv_url).toContain('second-cv.pdf')
  })
})