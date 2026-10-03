```jsx
import { useState } from "react";
import RewardCard from "./RewardCard";

import {
  enterReward
} from "../utils/api";

import {
  saveAccount
} from "../utils/storage";

export default function Rewards({
  account,
  updateAccount
}) {
  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [selectedReward, setSelectedReward] =
    useState(null);

  const [paypal, setPaypal] =
    useState("");

  const [email, setEmail] =
    useState("");

  const rewards = [
    {
      id: "reward-10",
      title: "$10 Sponsored Reward",
      description:
        "Use points to enter this sponsored reward draw.",
      cost: 10
    },

    {
      id: "reward-100",
      title: "$100 Sponsored Reward",
      description:
        "Use points to enter this larger sponsored reward draw.",
      cost: 50
    }
  ];

  function selectReward(reward) {
    if (!account?.walkingId) {
      setMessage(
        "Your Walking Account is not available."
      );

      return;
    }

    if (
      Number(account.points || 0) <
      reward.cost
    ) {
      setMessage(
        `You need ${reward.cost} points.`
      );

      return;
    }

    setMessage("");
    setPaypal("");
    setEmail("");
    setSelectedReward(reward);
  }

  function cancelEntry() {
    if (loading) {
      return;
    }

    setSelectedReward(null);
    setPaypal("");
    setEmail("");
    setMessage("");
  }

  async function confirmEntry() {
    if (!selectedReward) {
      return;
    }

    if (!paypal.trim()) {
      setMessage(
        "PayPal email/address is required."
      );

      return;
    }

    if (!account?.walkingId) {
      setMessage(
        "Your Walking Account is not available."
      );

      return;
    }

    if (
      Number(account.points || 0) <
      selectedReward.cost
    ) {
      setMessage(
        `You need ${selectedReward.cost} points.`
      );

      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const result =
        await enterReward(
          account.walkingId,
          selectedReward.id,
          paypal.trim(),
          email.trim()
        );

      saveAccount(
        result.account
      );

      updateAccount(
        result.account
      );

      setSelectedReward(null);
      setPaypal("");
      setEmail("");

      setMessage(
        `Entry created successfully. You used ${selectedReward.cost} points.`
      );
    } catch (error) {
      setMessage(
        error.message ||
        "Could not create entry."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <section className="card">
        <p className="small-label">
          AVAILABLE POINTS
        </p>

        <div className="big-number">
          {account?.points || 0}
        </div>

        <p>
          points
        </p>
      </section>

      {message && (
        <div className="notice">
          {message}
        </div>
      )}

      {selectedReward && (
        <section className="card">
          <p className="small-label">
            LOTTERY ENTRY
          </p>

          <h2>
            {selectedReward.title}
          </h2>

          <p className="muted">
            Enter your payment details
            before submitting your entry.
          </p>

          <label>
            PayPal email/address *
          </label>

          <input
            type="text"
            value={paypal}
            onChange={(event) =>
              setPaypal(
                event.target.value
              )
            }
            placeholder="your-paypal@example.com"
            autoComplete="off"
          />

          <label>
            Contact email (optional)
          </label>

          <input
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(
                event.target.value
              )
            }
            placeholder="your@email.com"
            autoComplete="email"
          />

          <p className="muted">
            Your PayPal address is required
            so the prize can be sent if you
            are selected. Your contact email
            is optional.
          </p>

          <div className="reward-bottom">
            <button
              className="disabled-button"
              disabled={loading}
              onClick={cancelEntry}
            >
              Cancel
            </button>

            <button
              className="primary-button"
              disabled={
                loading ||
                !paypal.trim()
              }
              onClick={confirmEntry}
            >
              {loading
                ? "Submitting..."
                : `Confirm Entry (${selectedReward.cost} points)`}
            </button>
          </div>
        </section>
      )}

      {!selectedReward &&
        rewards.map(
          (reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              onSelect={
                selectReward
              }
              availablePoints={
                account?.points || 0
              }
              loading={loading}
            />
          )
        )}

      <section className="card">
        <h2>
          How points work
        </h2>

        <p className="muted">
          Points are earned through verified
          walking milestones. Reward entries
          are recorded securely server-side.
        </p>
      </section>
    </div>
  );
}
```
