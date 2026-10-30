
import { useState } from "react";

export default function Rewards({
  account
}) {
  const [message] = useState("");

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

      <section className="card">
        <h2>
          No rewards available yet
        </h2>

        <p className="muted">
          New rewards will appear here when
          they are created by the administrator.
          Check back later for cash prizes,
          gift cards and other rewards.
        </p>
      </section>

      <section className="card">
        <h2>
          How points work
        </h2>

        <p className="muted">
          Earn points through verified walking.
          Your points balance is saved to your
          Walking Rewards account.
        </p>

        <p className="muted">
          Reward entry costs and eligibility
          requirements will be displayed when
          an administrator publishes a reward.
        </p>
      </section>

    </div>
  );
}
