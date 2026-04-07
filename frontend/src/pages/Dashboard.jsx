export default function Dashboard({ onLogout }) {
  return (
    <div style={{ color: "white", padding: "40px" }}>
      <h1>Applicant Dashboard</h1>
      <p>Welcome applicant 👋</p>
      <button onClick={onLogout} className="admin-action-btn">
  Logout
</button>
    </div>
  )
}