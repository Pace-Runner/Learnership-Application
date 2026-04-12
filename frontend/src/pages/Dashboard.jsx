// Applicant workspace - search and filter learnership listings
// Shows quick stats, search form, and current listings

import { Link } from 'react-router-dom'
import './UserPages.css'

// Quick stats cards for applicant dashboard
const quickStats = [
  { label: 'Available listings', value: '18' },
  { label: 'Saved opportunities', value: '12' },
  { label: 'Documents uploaded', value: '04' },
]

const availableListings = [
  {
    type: 'Learnership',
    title: 'Business Administration NQF 4',
    meta: 'Cape Town | Monthly stipend: R4,500 | Closes 25 Apr',
  },
  {
    type: 'Internship',
    title: 'Junior IT Support Internship',
    meta: 'Johannesburg | 12 months | Closes 30 Apr',
  },
  {
    type: 'Apprenticeship',
    title: 'Electrical Trade Apprenticeship',
    meta: 'Durban | Trade-tested path | Closes 04 May',
  },
]

const listingFilters = ['All', 'Learnership', 'Internship', 'Apprenticeship']

// Applicant workspace component
export default function Dashboard({ onLogout }) {
  return (
    <main className="user-page applicant-theme user-discovery-shell">
      <section className="user-page-inner">
      <header className="user-hero">
        <section>
          <p className="user-kicker">Applicant Workspace</p>
          <h1>Find the right listings faster</h1>
          <p className="user-intro">
            Search and filter active listings, then jump into your profile page to manage
            your CV, certificates, bio, and profile photo.
          </p>
        </section>

        <nav className="user-nav-actions" aria-label="Applicant actions">
          <Link to="/profile" className="user-link-btn">Go to My Profile</Link>
          <button onClick={onLogout} className="user-logout-btn">Logout</button>
        </nav>
      </header>

      <section className="user-stat-grid" aria-label="Applicant quick stats">
        {quickStats.map((item) => (
          <article key={item.label} className="user-stat-card">
            <p>{item.label}</p>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="listing-search-panel" aria-label="Listing search">
        <form className="listing-search-form" onSubmit={(event) => event.preventDefault()}>
          <label htmlFor="listing-search" className="sr-only">Search listings</label>
          <input id="listing-search" type="search" placeholder="Search by title, location, or sector" />
          <label htmlFor="listing-filter" className="sr-only">Filter listing type</label>
          <select id="listing-filter" defaultValue="All">
            {listingFilters.map((filter) => (
              <option key={filter} value={filter}>{filter}</option>
            ))}
          </select>
          <button type="submit" className="user-action-btn search-btn">Search</button>
        </form>
      </section>

      <section className="user-content-grid">
        <article className="user-panel">
          <h2>Current Listings and Internships</h2>
          <ul className="user-list">
            {availableListings.map((item) => (
              <li key={item.title}>
                <span>{item.type}</span>
                <strong>{item.title}</strong>
                <small className="user-item-meta">{item.meta}</small>
              </li>
            ))}
          </ul>
        </article>
      </section>
      </section>
    </main>
  )
}