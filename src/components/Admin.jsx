
import { useState } from "react";

const ADMIN_WALKING_ID = "WR-FB2EDP6K";

const emptyForm = {
  title: "",
  type: "physical",
  description: "",
  prizeValue: "",
  eligibility: "",
  image: "",
  entryCost: "1",
  winnersCount: "1",
  expiresAt: ""
};

async function sendRequest(endpoint, payload) {
  const response = await fetch(`/.netlify/functions/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

export default function Admin() {
  const [transferPin, setTransferPin] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [rewards, setRewards] = useState([]);
  const [emails, setEmails] = useState([]);
  const [emailSearch, setEmailSearch] = useState("");

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const [activeTab, setActiveTab] = useState("create");

  function adminCredentials() {
    return {
      adminWalkingId: ADMIN_WALKING_ID,
      adminTransferPin: transferPin.trim()
    };
  }

  async function loadDashboard(pin = transferPin) {
    setLoading(true);
    setError("");
    setMessage("");

    const credentials = {
      adminWalkingId: ADMIN_WALKING_ID,
      adminTransferPin: pin.trim()
    };

    try {
      const rewardData = await sendRequest("account", {
        action: "adminListRewards",
        ...credentials
      });

      setRewards(rewardData.rewards || []);
      setLoggedIn(true);

      try {
        const emailData = await sendRequest("private-emails", {
          action: "adminListEmails",
          ...credentials
        });

        setEmails(emailData.emails || []);
      } catch (emailError) {
        setError(
          "Draw dashboard loaded, but email records could not load: " +
          emailError.message
        );
      }
    } catch (err) {
      setLoggedIn(false);
      setError(err.message || "Admin login failed.");
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

    await loadDashboard();
  }

  function updateForm(event) {
    const { name, value } = event.target;

    setForm(previous => ({
      ...previous,
      [name]: value
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function handleCreateOrUpdate(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        ...adminCredentials(),
        ...form,
        entryCost: Number(form.entryCost),
        winnersCount: Number(form.winnersCount)
      };

      if (editingId) {
        await sendRequest("account", {
          action: "adminUpdateReward",
          ...payload,
          rewardId: editingId
        });

        setMessage("Prize draw updated successfully.");
      } else {
        await sendRequest("account", {
          action: "adminCreateReward",
          ...payload
        });

        setMessage("Prize draw created successfully.");
      }

      resetForm();
      await refreshRewards();
    } catch (err) {
      setError(err.message || "Could not save the prize draw.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshRewards() {
    const data = await sendRequest("account", {
      action: "adminListRewards",
      ...adminCredentials()
    });

    setRewards(data.rewards || []);
  }

  async function refreshEmails() {
    const data = await sendRequest("private-emails", {
      action: "adminListEmails",
      ...adminCredentials()
    });

    setEmails(data.emails || []);
  }

  function editReward(reward) {
    if (reward.status !== "active" || (reward.entries || []).length > 0) {
      setError("Only active draws with no entries can be edited.");
      return;
    }

    setForm({
      title: reward.title || "",
      type: reward.type || "physical",
      description: reward.description || "",
      prizeValue: reward.prizeValue || "",
      eligibility: reward.eligibility || "",
      image: reward.image || "",
      entryCost: String(reward.entryCost || 1),
      winnersCount: String(reward.winnersCount || 1),
      expiresAt: reward.expiresAt
        ? new Date(reward.expiresAt).toISOString().slice(0, 16)
        : ""
    });

    setEditingId(reward.rewardId);
    setActiveTab("create");
    setError("");
    setMessage("Editing: " + reward.title);
  }

  async function deleteReward(rewardId) {
    if (!window.confirm("Are you sure you want to delete this draw?")) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      await sendRequest("account", {
        action: "adminDeleteReward",
        ...adminCredentials(),
        rewardId
      });

      setMessage("Prize draw deleted.");
      await refreshRewards();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function approveWinner(rewardId, walkingId) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await sendRequest("account", {
        action: "adminApproveAward",
        ...adminCredentials(),
        rewardId,
        walkingId
      });

      setMessage("Winner approved.");
      await refreshRewards();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function markWinnerSent(rewardId, walkingId) {
    const reference = window.prompt(
      "Enter the payment or delivery reference (optional):"
    );

    if (reference === null) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      await sendRequest("account", {
        action: "adminMarkAwardSent",
        ...adminCredentials(),
        rewardId,
        walkingId,
        paymentReference: reference
      });

      setMessage("Prize marked as sent.");
      await refreshRewards();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshAll() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await refreshRewards();
      await refreshEmails();
      setMessage("Dashboard refreshed.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    setLoggedIn(false);
    setTransferPin("");
    setRewards([]);
    setEmails([]);
    setEmailSearch("");
    setError("");
    setMessage("");
    resetForm();
  }

  const filteredEmails = emails.filter(record => {
    const query = emailSearch.trim().toLowerCase();

    return (
      String(record.walkingId || "").toLowerCase().includes(query) ||
      String(record.email || "").toLowerCase().includes(query) ||
      String(record.paypalEmail || "").toLowerCase().includes(query)
    );
  });

  if (!loggedIn) {
    return (
      <div className="account-page">
        <div className="card">
          <h2>Admin Login</h2>
          <p>Enter your admin account's existing Transfer PIN.</p>

          <form onSubmit={handleLogin}>
            <input
              type="password"
              inputMode="numeric"
              placeholder="Admin Transfer PIN"
              value={transferPin}
              onChange={event => setTransferPin(event.target.value)}
              autoComplete="off"
              required
            />

            <button
              className="primary-button"
              type="submit"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          {error && <p className="error-message">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="account-page">
      <div className="card">
        <h2>Admin Dashboard</h2>

        <p>
          <strong>Prize draws:</strong> {rewards.length}
        </p>

        <p>
          <strong>Private email records:</strong> {emails.length}
        </p>

        <div className="dashboard-actions">
          <button
            className="primary-button"
            onClick={refreshAll}
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

        {error && <p className="error-message">{error}</p>}
        {message && <p>{message}</p>}

        <div className="dashboard-actions">
          <button
            className="secondary-button"
            onClick={() => {
              setActiveTab("create");
              setError("");
              setMessage("");
            }}
          >
            Create Draw
          </button>

          <button
            className="secondary-button"
            onClick={() => {
              setActiveTab("draws");
              setError("");
              setMessage("");
            }}
          >
            Manage Draws
          </button>

          <button
            className="secondary-button"
            onClick={() => {
              setActiveTab("winners");
              setError("");
              setMessage("");
            }}
          >
            Winners
          </button>

          <button
            className="secondary-button"
            onClick={() => {
              setActiveTab("emails");
              setError("");
              setMessage("");
            }}
          >
            User Emails
          </button>
        </div>

        {activeTab === "create" && (
          <section>
            <h3>{editingId ? "Edit Prize Draw" : "Create a Prize Draw"}</h3>

            <form onSubmit={handleCreateOrUpdate}>
              <label>Prize name</label>
              <input
                name="title"
                value={form.title}
                onChange={updateForm}
                placeholder="Example: Wireless headphones"
                required
              />

              <label>Prize type</label>
              <select
                name="type"
                value={form.type}
                onChange={updateForm}
              >
                <option value="physical">Physical prize</option>
                <option value="cash">Cash</option>
                <option value="gift-card">Gift card</option>
                <option value="voucher">Voucher</option>
                <option value="other">Other</option>
              </select>

              <label>Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={updateForm}
                placeholder="Describe the prize..."
                required
              />

              <label>Prize value (optional)</label>
              <input
                name="prizeValue"
                value={form.prizeValue}
                onChange={updateForm}
                placeholder="Example: QAR 250"
              />

              <label>Image URL (optional)</label>
              <input
                name="image"
                type="url"
                value={form.image}
                onChange={updateForm}
                placeholder="https://example.com/prize.jpg"
              />

              {form.image && (
                <div>
                  <p>Image preview:</p>
                  <img
                    src={form.image}
                    alt="Prize preview"
                    style={{
                      width: "100%",
                      maxWidth: "260px",
                      borderRadius: "12px",
                      objectFit: "contain"
                    }}
                  />
                </div>
              )}

              <label>Eligibility (optional)</label>
              <input
                name="eligibility"
                value={form.eligibility}
                onChange={updateForm}
                placeholder="Example: Open to all users"
              />

              <label>Points per entry</label>
              <input
                name="entryCost"
                type="number"
                min="1"
                step="1"
                value={form.entryCost}
                onChange={updateForm}
                required
              />

              <label>Number of winners</label>
              <input
                name="winnersCount"
                type="number"
                min="1"
                max="20"
                step="1"
                value={form.winnersCount}
                onChange={updateForm}
                required
              />

              <label>Draw closing date and time</label>
              <input
                name="expiresAt"
                type="datetime-local"
                value={form.expiresAt}
                onChange={updateForm}
                required
              />

              <button
                className="primary-button"
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Saving..."
                  : editingId
                    ? "Save Changes"
                    : "Create Prize Draw"}
              </button>

              {editingId && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={resetForm}
                >
                  Cancel Editing
                </button>
              )}
            </form>
          </section>
        )}

        {activeTab === "draws" && (
          <section>
            <h3>Manage Prize Draws</h3>

            {rewards.length === 0 ? (
              <p>No prize draws have been created.</p>
            ) : (
              rewards.map(reward => (
                <div className="card" key={reward.rewardId}>
                  {reward.image && (
                    <img
                      src={reward.image}
                      alt={reward.title}
                      style={{
                        width: "100%",
                        maxWidth: "240px",
                        borderRadius: "12px"
                      }}
                    />
                  )}

                  <h3>{reward.title}</h3>
                  <p>{reward.description}</p>
                  <p><strong>Status:</strong> {reward.status}</p>
                  <p><strong>Entry cost:</strong> {reward.entryCost} points</p>
                  <p><strong>Entries:</strong> {(reward.entries || []).length}</p>
                  <p><strong>Winners:</strong> {reward.winnersCount}</p>
                  <p>
                    <strong>Closes:</strong>{" "}
                    {new Date(reward.expiresAt).toLocaleString()}
                  </p>

                  {reward.status === "active" &&
                    (reward.entries || []).length === 0 && (
                      <button
                        className="secondary-button"
                        onClick={() => editReward(reward)}
                      >
                        Edit
                      </button>
                    )}

                  {reward.status === "active" &&
                    (reward.entries || []).length === 0 && (
                      <button
                        className="secondary-button"
                        onClick={() => deleteReward(reward.rewardId)}
                        disabled={loading}
                      >
                        Delete
                      </button>
                    )}

                  {reward.winners?.length > 0 && (
                    <div>
                      <strong>Selected winners:</strong>
                      {reward.winners.map((winner, index) => (
                        <p key={`${winner.walkingId}-${index}`}>
                          {winner.walkingId} — {winner.status}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </section>
        )}

        {activeTab === "winners" && (
          <section>
            <h3>Winner Management</h3>

            {rewards.filter(reward => reward.winners?.length > 0).length === 0 ? (
              <p>No winners have been selected yet.</p>
            ) : (
              rewards
                .filter(reward => reward.winners?.length > 0)
                .map(reward => (
                  <div className="card" key={reward.rewardId}>
                    <h3>{reward.title}</h3>

                    {reward.winners.map((winner, index) => (
                      <div key={`${winner.walkingId}-${index}`}>
                        <p><strong>Walking ID:</strong> {winner.walkingId}</p>
                        <p><strong>Email:</strong> {winner.email || "Not available"}</p>
                        <p>
                          <strong>PayPal email:</strong>{" "}
                          {winner.paypalEmail || "Not available"}
                        </p>
                        <p><strong>Status:</strong> {winner.status}</p>

                        {winner.status === "pending-approval" && (
                          <button
                            className="primary-button"
                            disabled={loading}
                            onClick={() =>
                              approveWinner(reward.rewardId, winner.walkingId)
                            }
                          >
                            Approve Winner
                          </button>
                        )}

                        {winner.status === "approved" && (
                          <button
                            className="primary-button"
                            disabled={loading}
                            onClick={() =>
                              markWinnerSent(reward.rewardId, winner.walkingId)
                            }
                          >
                            Mark Prize as Sent
                          </button>
                        )}

                        {winner.status === "sent" && (
                          <p>Prize sent successfully.</p>
                        )}

                        <hr />
                      </div>
                    ))}
                  </div>
                ))
            )}
          </section>
        )}

        {activeTab === "emails" && (
          <section>
            <h3>User Email Records</h3>

            <input
              type="search"
              placeholder="Search Walking ID or email..."
              value={emailSearch}
              onChange={event => setEmailSearch(event.target.value)}
            />

            <p>Records: {filteredEmails.length}</p>

            {filteredEmails.length === 0 ? (
              <p>No email records found.</p>
            ) : (
              filteredEmails.map(record => (
                <div className="card" key={record.walkingId}>
                  <h3>{record.walkingId}</h3>
                  <p>
                    <strong>Normal email:</strong><br />
                    {record.email}
                  </p>
                  <p>
                    <strong>PayPal email:</strong><br />
                    {record.paypalEmail}
                  </p>
                  <small>
                    Updated:{" "}
                    {record.updatedAt
                      ? new Date(record.updatedAt).toLocaleString()
                      : "Unknown"}
                  </small>
                </div>
              ))
            )}
          </section>
        )}
      </div>
    </div>
  );
}
