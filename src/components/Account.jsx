import { useState } from "react";
import {
  createAccount,
  transferAccount
} from "../utils/api";
import {
  saveAccount,
  clearAccount
} from "../utils/storage";

export default function Account({
  account,
  updateAccount,
  firstSetup = false
}) {
  const [mode, setMode] = useState("create");
  const [walkingId, setWalkingId] = useState("");
  const [transferPin, setTransferPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleCreate() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await createAccount();

      if (!result.account || !result.account.walkingId) {
        throw new Error("The server did not return an account.");
      }

      saveAccount(result.account);
      updateAccount(result.account);

      setMessage("Account created successfully.");
    } catch (err) {
      setError(err.message || "Could not create account.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTransfer() {
    const id = walkingId.trim().toUpperCase();
    const pin = transferPin.trim();

    if (!id || !pin) {
      setError("Enter both your Walking ID and Transfer PIN.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await transferAccount(id, pin);

      if (!result.account || !result.account.walkingId) {
        throw new Error("The server did not return your account.");
      }

      saveAccount(result.account);
      updateAccount(result.account);

      setMessage("Account transferred successfully.");
    } catch (err) {
      setError(err.message || "Could not transfer account.");
    } finally {
      setLoading(false);
    }
  }

  function handleRemoveLocalAccount() {
    clearAccount();
    updateAccount(null);
  }

  if (firstSetup || !account) {
    return (
      <div className="account-page">
        <div className="card">
          <h2>Walking Rewards</h2>

          <p>
            Create an account to start tracking your verified walking
            distance and rewards.
          </p>

          <div className="account-tabs">
            <button
              className={mode === "create" ? "active" : ""}
              onClick={() => {
                setMode("create");
                setError("");
                setMessage("");
              }}
            >
              Create Account
            </button>

            <button
              className={mode === "transfer" ? "active" : ""}
              onClick={() => {
                setMode("transfer");
                setError("");
                setMessage("");
              }}
            >
              Transfer Account
            </button>
          </div>

          {mode === "create" && (
            <div>
              <h3>Create a new account</h3>

              <p>
                Your account will receive a unique Walking ID and
                Transfer PIN.
              </p>

              <button
                className="primary-button"
                onClick={handleCreate}
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Account"}
              </button>
            </div>
          )}

          {mode === "transfer" && (
            <div>
              <h3>Transfer your account</h3>

              <input
                type="text"
                placeholder="Walking ID"
                value={walkingId}
                onChange={(e) => setWalkingId(e.target.value)}
                autoComplete="off"
              />

              <input
                type="text"
                inputMode="numeric"
                placeholder="Transfer PIN"
                value={transferPin}
                onChange={(e) => setTransferPin(e.target.value)}
                autoComplete="off"
              />

              <button
                className="primary-button"
                onClick={handleTransfer}
                disabled={loading}
              >
                {loading ? "Transferring..." : "Transfer Account"}
              </button>
            </div>
          )}

          {message && (
            <p className="success-message">
              {message}
            </p>
          )}

          {error && (
            <p className="error-message">
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="account-page">
      <div className="card">
        <h2>Your Account</h2>

        <div className="account-info">
          <div>
            <span>Walking ID</span>
            <strong>{account.walkingId}</strong>
          </div>

          <div>
            <span>Transfer PIN</span>
            <strong>{account.transferPin}</strong>
          </div>

          <div>
            <span>Points</span>
            <strong>{account.points || 0}</strong>
          </div>

          <div>
            <span>Total Distance</span>
            <strong>
              {Number(account.totalDistance || 0).toFixed(2)} km
            </strong>
          </div>
        </div>

        <p>
          Keep your Walking ID and Transfer PIN somewhere safe.
          They are used to recover your account on another device.
        </p>

        <button
          className="secondary-button"
          onClick={handleRemoveLocalAccount}
        >
          Remove This Device
        </button>
      </div>
    </div>
  );
}
