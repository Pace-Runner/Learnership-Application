// Applicant profile management - upload photos, bio, and documents

import { Link } from 'react-router-dom'
import './UserPages.css'

// Sample uploaded documents
const uploadedDocs = [
  { name: 'CV - Thandi_Mokoena.pdf', updated: 'Updated 2 days ago' },
  { name: 'Matric_Certificate.pdf', updated: 'Updated 3 weeks ago' },
  { name: 'IT_Support_Badge.pdf', updated: 'Updated 1 month ago' },
]

// Applicant profile page component
export default function ApplicantProfile({ onLogout }) {
  return (
    <main className="user-page applicant-theme profile-shell">
      <section className="user-page-inner">
      <header className="user-hero profile-header">
        <section>
          <p className="user-kicker">Applicant Profile</p>
          <h1>Profile and documents</h1>
          <p className="user-intro">
            Keep your profile complete so applications are easier to review by employers and training providers.
          </p>
        </section>

        <nav className="user-nav-actions" aria-label="Profile actions">
          <Link to="/dashboard" className="user-link-btn">Back to Listings</Link>
          <button onClick={onLogout} className="user-logout-btn">Logout</button>
        </nav>
      </header>

      <section className="profile-grid">
        <article className="user-panel profile-card">
          <h2>Profile Picture</h2>
          <figure className="avatar-frame" aria-label="Profile avatar placeholder">
            <span>TM</span>
          </figure>
          <button type="button" className="user-action-btn">Upload profile picture</button>
        </article>

        <article className="user-panel profile-card">
          <h2>About Me</h2>
          <p className="user-panel-copy">
            Ambitious entry-level candidate interested in business administration and digital operations roles.
          </p>
          <button type="button" className="user-action-btn">Edit profile description</button>
        </article>
      </section>

      <section className="user-panel document-panel">
        <h2>My Documents</h2>
        <p className="user-panel-copy">Manage your uploaded CV and supporting certificates in one place.</p>

        <ul className="user-list doc-list">
          {uploadedDocs.map((doc) => (
            <li key={doc.name}>
              <strong>{doc.name}</strong>
              <small className="user-item-meta">{doc.updated}</small>
            </li>
          ))}
        </ul>

        <menu className="doc-action-row">
          <li><button type="button" className="user-action-btn">View uploaded CV</button></li>
          <li><button type="button" className="user-action-btn">View certificates</button></li>
          <li><button type="button" className="user-action-btn">Upload new document</button></li>
        </menu>
      </section>
      </section>
    </main>
  )
}
