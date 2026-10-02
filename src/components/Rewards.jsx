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

  async function selectReward(reward) {
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

    setLoading(true);
    setMessage("");

    try {
      const result =
        await enterReward(
          account.walkingId,
          reward.id
        );

      saveAccount(
        result.account
      );

      updateAccount(
        result.account
      );

      setMessage(
        `Entry created successfully. You used ${reward.cost} points.`
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

      {rewards.map(
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
          are recorded server-side.
        </p>
      </section>
    </div>
  );
}
