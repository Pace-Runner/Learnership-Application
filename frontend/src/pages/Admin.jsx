export default function Admin({ onLogout }) {
  return (
    <div style={{ color: "white", padding: "40px" }}>
      <h1>Admin Dashboard</h1>
      <button onClick={onLogout} className="admin-action-btn">
  Logout
</button>
    </div>
  )
}