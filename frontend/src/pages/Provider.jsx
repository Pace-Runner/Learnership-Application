export default function Provider({ onLogout }) {
  return (
    <div style={{ color: "white", padding: "40px" }}>
      <h1>Provider Dashboard</h1>
      <p>Welcome provider 👋</p>
      <button onClick={onLogout} className="admin-action-btn">
        Logout
      </button>
    </div>
  )
}