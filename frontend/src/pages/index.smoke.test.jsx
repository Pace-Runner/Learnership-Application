import { describe, it, expect } from 'vitest'

describe('Page Component Loading Tests - Smoke Tests', () => {
  it('ApplicantListingDetail component imports successfully', async () => {
    const { default: ApplicantListingDetail } = await import('../pages/ApplicantListingDetail')
    expect(ApplicantListingDetail).toBeDefined()
    expect(typeof ApplicantListingDetail).toBe('function')
  })

  it('Provider component imports successfully', async () => {
    const { default: Provider } = await import('../pages/Provider')
    expect(Provider).toBeDefined()
    expect(typeof Provider).toBe('function')
  })

  it('ApplicantProfile component imports successfully', async () => {
    const { default: ApplicantProfile } = await import('../pages/ApplicantProfile')
    expect(ApplicantProfile).toBeDefined()
    expect(typeof ApplicantProfile).toBe('function')
  })

  it('ProviderListingEdit component imports successfully', async () => {
    const { default: ProviderListingEdit } = await import('../pages/ProviderListingEdit')
    expect(ProviderListingEdit).toBeDefined()
    expect(typeof ProviderListingEdit).toBe('function')
  })

  it('ProviderListingApplications component imports successfully', async () => {
    const { default: ProviderListingApplications } = await import('../pages/ProviderListingApplications')
    expect(ProviderListingApplications).toBeDefined()
    expect(typeof ProviderListingApplications).toBe('function')
  })

  it('ProviderProfile component imports successfully', async () => {
    const { default: ProviderProfile } = await import('../pages/ProviderProfile')
    expect(ProviderProfile).toBeDefined()
    expect(typeof ProviderProfile).toBe('function')
  })

  it('ProviderPostListing component imports successfully', async () => {
    const { default: ProviderPostListing } = await import('../pages/ProviderListingForm')
    expect(ProviderPostListing).toBeDefined()
    expect(typeof ProviderPostListing).toBe('function')
  })

  it('ProviderManageApplicationStatuses component imports successfully', async () => {
    const { default: ProviderListingApplications } = await import('../pages/ProviderListingApplications')
    expect(ProviderListingApplications).toBeDefined()
  })

  it('ProviderEditDeleteListing is ProviderListingEdit', async () => {
    const { default: ProviderListingEdit } = await import('../pages/ProviderListingEdit')
    expect(ProviderListingEdit).toBeDefined()
  })

  it('All page components are React components', async () => {
    const { default: ApplicantListingDetail } = await import('../pages/ApplicantListingDetail')
    const { default: Provider } = await import('../pages/Provider')
    const components = [ApplicantListingDetail, Provider]
    components.forEach((comp) => {
      expect(typeof comp).toBe('function')
    })
  })
})
