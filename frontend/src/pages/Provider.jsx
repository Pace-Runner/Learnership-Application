// Provider workspace - manage learnership listings and applicants
// Shows quick actions, stats, and listing overview

const providerStats = [
  { label: 'Active listings', value: '09' },
  { label: 'New applicants', value: '31' },
  { label: 'Listings needing review', value: '04' },
]

const listingOverview = [
  {
    type: 'Learnership',
    title: 'Business Administration NQF 4',
    meta: 'Cape Town | Applicants applied: 14 | Shortlisted: 6',
    detail: 'Best applicants: Thandi Mokoena, Ayanda P., Nathi Dlamini',
    status: 'Needs screening notes',
  },
  {
    type: 'Apprenticeship',
    title: 'Electrical Trade Apprenticeship',
    meta: 'Durban | Applicants applied: 8 | Interview-ready: 3',
    detail: 'Best applicants: Kabelo M., Sipho T., Lerato N.',
    status: 'Interview slots open',
  },
  {
    type: 'Learnership',
    title: 'Retail Operations NQF 3',
    meta: 'Johannesburg | Applicants applied: 9 | Profile matches: 5',
    detail: 'Best applicants: Ayesha K., Zinhle M., Musa R.',
    status: 'Awaiting posting copy',
  },
]

const providerActions = [
  'Create a new listing',
  'Review applicants',
  'Publish selected listing',
]

// Provider workspace component  
export default function Provider({ onLogout }) {
  return (
    <main className="user-page provider-theme provider-shell">
      <section className="user-page-inner">
        <header className="user-hero provider-hero">
          <section>
            <p className="user-kicker">Provider Workspace</p>
            <h1>Manage your learnership pipeline</h1>
            <p className="user-intro">
              Post opportunities, review applicant fit, and keep each listing aligned with the
              programme requirements before it goes live.
            </p>
          </section>

          <nav className="user-nav-actions" aria-label="Provider actions">
            <button type="button" className="user-link-btn">
              New Listing
            </button>
            <button onClick={onLogout} className="user-logout-btn">
              Logout
            </button>
          </nav>
        </header>

        <section className="provider-actions-panel user-panel">
          <header>
            <p className="provider-panel-kicker">Quick actions</p>
            <h2>Keep posting moving</h2>
            <p className="user-panel-copy">
              Use the shortcuts below to draft, review, and publish listings without leaving the
              workspace.
            </p>
          </header>

          <menu className="provider-action-row">
            {providerActions.map((action) => (
              <li key={action}>
                <button type="button" className="user-action-btn">
                  {action}
                </button>
              </li>
            ))}
          </menu>
        </section>

        <section className="user-stat-grid" aria-label="Provider quick stats">
          {providerStats.map((item) => (
            <article key={item.label} className="user-stat-card">
              <p>{item.label}</p>
              <strong>{item.value}</strong>
            </article>
          ))}
        </section>

        <section className="provider-grid provider-grid-single">
          <article className="user-panel provider-panel">
            <header className="provider-panel-head">
              <section>
                <p className="provider-panel-kicker">Listing overview</p>
                <h2>Applicants by listing</h2>
              </section>
              <span className="status-chip status-chip-soft">Focused on posting workflow</span>
            </header>

            <ul className="user-list provider-list">
              {listingOverview.map((item) => (
                <li key={item.title}>
                  <span>{item.type}</span>
                  <strong>{item.title}</strong>
                  <small className="user-item-meta">{item.meta}</small>
                  <small className="provider-detail">{item.detail}</small>
                  <small className="status-chip">{item.status}</small>
                </li>
              ))}
            </ul>
          </article>

          <article className="user-panel provider-panel">
            <header className="provider-panel-head">
              <section>
                <p className="provider-panel-kicker">Posting checklist</p>
                <h2>Before you publish</h2>
              </section>
              <span className="status-chip status-chip-soft">Ready for review</span>
            </header>

            <p className="provider-note provider-checklist-note">
              Make sure the listing clearly states the qualification level, closing date, location,
              stipend, and the kind of applicant you want to attract.
            </p>

            <ul className="provider-checklist">
              <li>Qualification and NQF level confirmed</li>
              <li>Applicant profile requirements written clearly</li>
              <li>Posting dates and contact details checked</li>
              <li>Compliance docs attached before publish</li>
            </ul>
          </article>
        </section>
      </section>
    </main>
  )
}