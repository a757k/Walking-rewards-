import { useState } from "react";

import {
  saveAccount,
  clearAccount
} from "../utils/storage";

import {
  createAccount,
  transferAccount
} from "../utils/api";

export default function Account({
  account,
  updateAccount
}) {
  const [mode, setMode] =
    useState("view");

  const [walkingId, setWalkingId] =
    useState("");

  const [pin, setPin] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function createNewAccount() {
    setLoading(true);
    setMessage("");

    try {
      const serverAccount =
        await createAccount();

      saveAccount(
        serverAccount
      );

      updateAccount(
        serverAccount
      );

      setMessage(
        "Walking Account created successfully."
      );
    } catch (error) {
      setMessage(
        error.message ||
        "Could not create account."
      );
    } finally {
      setLoading(false);
    }
  }

  async function transfer() {
    if (!walkingId.trim()) {
      setMessage(
        "Enter your Walking ID."
      );

      return;
    }

    if (!pin.trim()) {
      setMessage(
        "Enter your transfer PIN."
      );

      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const result =
        await transferAccount(
          walkingId.trim(),
          pin.trim()
        );

      saveAccount(result);

      updateAccount(result);

      setMode("view");

      setWalkingId("");
      setPin("");

      setMessage(
        "Account transferred successfully."
      );
    } catch (error) {
      setMessage(
        error.message ||
        "Transfer failed."
      );
    } finally {
      setLoading(false);
    }
  }

  function removeLocalAccount() {
    clearAccount();

    updateAccount(null);

    setMessage(
      "This device's saved account has been removed."
    );
  }

  return (
    <div className="page">
      <section className="card">
        <h2>
          Your Walking Account
        </h2>

        {account ? (
          <>
            <div className="account-row">
              <span>
                Walking ID
              </span>

              <strong>
                {account.walkingId}
              </strong>
            </div>

            <div className="account-row">
              <span>
                Transfer PIN
              </span>

              <strong>
                {account.transferPin}
              </strong>
            </div>

            <p className="muted">
              Keep your Walking ID and PIN
              somewhere safe. They are used
              to recover your account on another
              device.
            </p>
          </>
        ) : (
          <button
            className="primary-button"
            onClick={
              createNewAccount
            }
            disabled={loading}
          >
            {loading
              ? "Creating..."
              : "Create Walking Account"}
          </button>
        )}
      </section>

      <section className="card">
        <h2>
          Move to another device
        </h2>

        {mode === "view" ? (
          <button
            className="secondary-button"
            onClick={() =>
              setMode("transfer")
            }
          >
            Transfer Account
          </button>
        ) : (
          <>
            <label>
              Walking ID
            </label>

            <input
              value={walkingId}
              onChange={(e) =>
                setWalkingId(
                  e.target.value
                )
              }
              placeholder="WR-XXXXXXXX"
              autoCapitalize="characters"
            />

            <label>
              Transfer PIN
            </label>

            <input
              value={pin}
              onChange={(e) =>
                setPin(
                  e.target.value
                )
              }
              placeholder="6-digit PIN"
              inputMode="numeric"
              maxLength={6}
            />

            <button
              className="primary-button"
              onClick={transfer}
              disabled={loading}
            >
              {loading
                ? "Transferring..."
                : "Transfer Account"}
            </button>
          </>
        )}
      </section>

      {message && (
        <div className="notice">
          {message}
        </div>
      )}

      <section className="card">
        <h2>
          This device
        </h2>

        <p className="muted">
          Removing the local copy does not
          delete the server account. You can
          recover it with your Walking ID and
          transfer PIN.
        </p>

        <button
          className="danger-button"
          onClick={
            removeLocalAccount
          }
        >
          Remove From This Device
        </button>
      </section>
    </div>
  );
}
