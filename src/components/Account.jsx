
import { useState } from "react";
import {
  createAccount,
  transferAccount,
  saveEmails
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
  const [email, setEmail] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleCreate() {
    const normalEmail = email.trim().toLowerCase();
    const paymentEmail = paypalEmail.trim().toLowerCase();

    if (!normalEmail || !paymentEmail) {
      setError("Enter both your normal email and PayPal email.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    let createdAccount = null;

    try {
      const result = await createAccount();

      if (!result.account || !result.account.walkingId) {
        throw new Error("The server did not return an account.");
      }

      createdAccount = result.account;

      await saveEmails(
        createdAccount.walkingId,
        createdAccount.transferPin,
        normalEmail,
        paymentEmail
      );

      saveAccount(createdAccount);
      updateAccount(createdAccount);

      setMessage("Account created and email details saved successfully.");
    } catch (err) {
      if (createdAccount) {
        saveAccount(createdAccount);
        updateAccount(createdAccount);

        setError(
          "Your account was created, but your email details could not be saved. Keep your Walking ID and PIN safe. Please contact support before creating another account. Error: " +
          (err.message || "Unknown error.")
        );
      } else {
        setError(err.message || "Could not create account.");
      }
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

              <label>Normal email address</label>
              <input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />

              <label>PayPal email address</label>
              <input
                type="email"
                placeholder="Your PayPal email address"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                autoComplete="off"
                required
              />

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
                type="password"
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
            <p className="success-message">{message}</p>
          )}

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
