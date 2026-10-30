
import { useState } from "react";

const ADMIN_WALKING_ID = "WR-FB2EDP6K";

export default function Admin() {
  const [transferPin, setTransferPin] = useState("");
  const [emails, setEmails] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [error, setError] = useState("");

  async function loadEmails(pin) {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/.netlify/functions/private-emails",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            action: "adminListEmails",
            adminWalkingId: ADMIN_WALKING_ID,
            adminTransferPin: pin
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load email records.");
      }

      setEmails(data.emails || []);
      setLoggedIn(true);
    } catch (err) {
      setLoggedIn(false);
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();

    if (!transferPin.trim()) {
      setError("Enter your admin Transfer PIN.");
      return;
    }

    await loadEmails(transferPin.trim());
  }

  const filteredEmails = emails.filter((record) => {
    const query = search.trim().toLowerCase();

    return (
      String(record.walkingId || "").toLowerCase().includes(query) ||
      String(record.email || "").toLowerCase().includes(query) ||
      String(record.paypalEmail || "").toLowerCase().includes(query)
    );
  });

  function handleLogout() {
    setLoggedIn(false);
    setTransferPin("");
    setEmails([]);
    setSearch("");
    setError("");
  }

  if (!loggedIn) {
    return (
      <div className="account-page">
        <div className="card">
          <h2>Admin Login</h2>

          <p>Enter your admin Transfer PIN to view private user email records.</p>

          <form onSubmit={handleLogin}>
            <input
              type="password"
              inputMode="numeric"
              placeholder="Admin Transfer PIN"
              value={transferPin}
              onChange={(event) => setTransferPin(event.target.value)}
              autoComplete="off"
            />

            <button
              className="primary-button"
              type="submit"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          {error && (
            <p className="error-message">{error}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="account-page">
      <div className="card">
        <h2>Admin Dashboard</h2>

        <p>
          Private email records: <strong>{emails.length}</strong>
        </p>

        <input
          type="search"
          placeholder="Search Walking ID or email..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="dashboard-actions">
          <button
            className="primary-button"
            onClick={() => loadEmails(transferPin)}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            className="secondary-button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>

        {error && (
          <p className="error-message">{error}</p>
        )}

        {filteredEmails.length === 0 ? (
          <p>No email records found.</p>
        ) : (
          <div className="admin-email-list">
            {filteredEmails.map((record) => (
              <div
                className="card"
                key={record.walkingId}
              >
                <h3>{record.walkingId}</h3>

                <p>
                  <strong>Normal email:</strong>
                  <br />
                  {record.email}
                </p>

                <p>
                  <strong>PayPal email:</strong>
                  <br />
                  {record.paypalEmail}
                </p>

                <small>
                  Last updated:{" "}
                  {record.updatedAt
                    ? new Date(record.updatedAt).toLocaleString()
                    : "Unknown"}
                </small>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
