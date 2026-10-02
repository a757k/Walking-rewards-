import { useState } from "react";
import {
  getAccount,
  saveAccount,
  clearAccount,
  createLocalAccount
} from "../utils/storage";
import {
  createAccount,
  transferAccount
} from "../utils/api";

export default function Account({
  account,
  updateAccount
}) {
  const [mode, setMode] = useState("view");
  const [walkingId, setWalkingId] = useState("");
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");

  async function createNewAccount() {
    setMessage("Creating account...");

    try {
      const server =
        await createAccount();

      const local = {
        ...createLocalAccount(),
        walkingId: server.walkingId,
        transferPin: server.transferPin
      };

      saveAccount(local);
      updateAccount(local);

      setMessage(
        "Account created successfully."
      );
    } catch (error) {
      setMessage(
        "Could not create a server account."
      );
    }
  }

  async function transfer() {
    if (!walkingId || !pin) {
      setMessage(
        "Enter your Walking ID and transfer PIN."
      );
      return;
    }

    setMessage("Transferring account...");

    try {
      const result =
        await transferAccount(
          walkingId,
          pin
        );

      saveAccount(result);
      updateAccount(result);

      setMode("view");

      setMessage(
        "Account transferred successfully."
      );
    } catch (error) {
      setMessage(
        error.message ||
        "Transfer failed."
      );
    }
  }

  function resetLocal() {
    clearAccount();

    const fresh = createLocalAccount();

    updateAccount(fresh);

    setMessage(
      "Local account reset."
    );
  }

  return (
    <div className="page">
      <section className="card">
        <h2>Your Walking Account</h2>

        {account ? (
          <>
            <div className="account-row">
              <span>Walking ID</span>
              <strong>
                {account.walkingId || "Not created"}
              </strong>
            </div>

            <div className="account-row">
              <span>Transfer PIN</span>
              <strong>
                {account.transferPin || "Not created"}
              </strong>
            </div>

            <p className="muted">
              Keep these details private. They allow you
              to move your walking progress to another
              device.
            </p>
          </>
        ) : (
          <button
            className="primary-button"
            onClick={createNewAccount}
          >
            Create Walking Account
          </button>
        )}
      </section>

      <section className="card">
        <h2>Move to another device</h2>

        {mode === "view" ? (
          <button
            className="secondary-button"
            onClick={() => setMode("transfer")}
          >
            Transfer Account
          </button>
        ) : (
          <>
            <label>Walking ID</label>

            <input
              value={walkingId}
              onChange={(e) =>
                setWalkingId(e.target.value)
              }
              placeholder="Enter Walking ID"
            />

            <label>Transfer PIN</label>

            <input
              value={pin}
              onChange={(e) =>
                setPin(e.target.value)
              }
              placeholder="Enter PIN"
              inputMode="numeric"
            />

            <button
              className="primary-button"
              onClick={transfer}
            >
              Transfer
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
        <h2>Local data</h2>

        <p className="muted">
          Your current device keeps a local copy of your
          account information for offline continuity.
        </p>

        <button
          className="danger-button"
          onClick={resetLocal}
        >
          Reset Local Account
        </button>
      </section>
    </div>
  );
}
