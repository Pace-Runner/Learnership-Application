import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const applicantState = vi.hoisted(() => ({
  userId: 'user-1',
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
  const supabase = {
    auth: {
      getUser: applicantSpies.getUser,
    },
    from: vi.fn((table) => {
      if (table === 'nqf_qualifications') {
        return {
          select: () => ({
            order: async () => ({ data: applicantState.qualifications, error: null }),
          }),
        }
      }

      if (table === 'skill_tags') {
        return {
          select: () => ({
            order: async () => ({ data: applicantState.skillTags, error: null }),
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

  applicantSpies.getUser.mockResolvedValue({ data: { user: { id: applicantState.userId } }, error: null })
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
    fireEvent.click(screen.getByRole('button', { name: 'Accounting Basics' }))

    await waitFor(() => expect(applicantSpies.skillTagsInsert).toHaveBeenCalled())

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
    expect(skillsPayload[0].skill_tag_id).toBe('skill-new')
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
})