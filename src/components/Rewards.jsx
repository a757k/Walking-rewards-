import { useState } from "react";
import RewardCard from "./RewardCard";

export default function Rewards({ account, updateAccount }) {
  const [message, setMessage] = useState("");

  const rewards = [
    {
      id: "reward-10",
      title: "$10 Sponsored Reward",
      description:
        "Use points toward a sponsored reward draw.",
      cost: 10
    },
    {
      id: "reward-100",
      title: "$100 Sponsored Reward",
      description:
        "Use points toward a larger sponsored reward draw.",
      cost: 50
    }
  ];

  function selectReward(reward) {
    if (!account) {
      setMessage("Account not available.");
      return;
    }

    if (account.points < reward.cost) {
      setMessage(
        `You need ${reward.cost} points for this reward.`
      );
      return;
    }

    /*
      This demo deducts points locally.
      The actual draw/winner system must be handled
      securely on the server before launch.
    */

    const updated = {
      ...account,
      points: account.points - reward.cost
    };

    localStorage.setItem(
      "walking_rewards_account",
      JSON.stringify(updated)
    );

    updateAccount(updated);

    setMessage(
      `You used ${reward.cost} points.`
    );
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

        <p>points</p>
      </section>

      {message && (
        <div className="notice">
          {message}
        </div>
      )}

      {rewards.map((reward) => (
        <RewardCard
          key={reward.id}
          reward={reward}
          onSelect={selectReward}
          availablePoints={account?.points || 0}
        />
      ))}

      <section className="card">
        <h2>Important</h2>

        <p className="muted">
          Rewards depend on available sponsors and the
          final published rules. No purchase is required
          to earn walking points.
        </p>
      </section>
    </div>
  );
}
