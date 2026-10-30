
import { useEffect, useState } from "react";

export default function Rewards({ account }) {
  const [rewards, setRewards] = useState([]);
  const [points, setPoints] = useState(account?.points || 0);
  const [transferPin, setTransferPin] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState("");

  const walkingId = account?.walkingId || account?.id;
  const pin = account?.transferPin || transferPin;

  async function request(data) {
    const response = await fetch("/.netlify/functions/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      throw new Error(result.error || result.message || "Request failed.");
    }

    return result;
  }

  async function loadRewards() {
    setLoading(true);
    try {
      const result = await request({
        action: "listRewards",
        walkingId
      });

      setRewards(result.rewards || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (walkingId) loadRewards();
  }, [walkingId]);

  async function enterReward(reward) {
    if (!walkingId) {
      setMessage("Please sign in to your account first.");
      return;
    }

    if (!pin) {
      setMessage("Enter your Transfer PIN to enter a reward draw.");
      return;
    }

    const rewardId = reward.rewardId || reward.id;

    if (!rewardId) {
      setMessage("This reward is missing its ID. Contact the administrator.");
      return;
    }

    setEntering(rewardId);
    setMessage("");

    try {
      const result = await request({
        action: "enterReward",
        walkingId,
        transferPin: pin,
        rewardId
      });

      if (typeof result.points === "number") {
        setPoints(result.points);
      } else if (result.account && typeof result.account.points === "number") {
        setPoints(result.account.points);
      } else {
        setPoints(current => Math.max(0, current - Number(reward.entryCost || 0)));
      }

      setMessage("Entry successful!");
      await loadRewards();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setEntering("");
    }
  }

  function dateText(value) {
    if (!value) return "Closing date not specified";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Closing date not specified"
      : `Closes ${date.toLocaleString()}`;
  }

  function entryCount(reward) {
    return Array.isArray(reward.entries) ? reward.entries.length : 0;
  }

  return (
    <div className="page">
      <section className="card">
        <p className="small-label">AVAILABLE POINTS</p>
        <div className="big-number">{points}</div>
        <p>points</p>
      </section>

      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}

      {!account?.transferPin && (
        <section className="card">
          <h3>Confirm your account</h3>
          <p className="muted">
            Enter your Transfer PIN when you want to enter a draw.
          </p>
          <input
            type="password"
            inputMode="numeric"
            placeholder="Transfer PIN"
            value={transferPin}
            onChange={event => setTransferPin(event.target.value)}
          />
        </section>
      )}

      <section className="card">
        <h2>Available rewards</h2>

        {loading ? (
          <p className="muted">Loading rewards...</p>
        ) : rewards.length === 0 ? (
          <p className="muted">
            No rewards are available right now. Check back when the
            administrator publishes a new draw.
          </p>
        ) : (
          <div className="reward-list">
            {rewards.map((reward, index) => {
              const id = reward.rewardId || reward.id || index;
              const cost = Number(reward.entryCost || 0);
              const enoughPoints = points >= cost;
              const closed =
                reward.status === "closed" ||
                reward.status === "completed" ||
                (reward.expiresAt && new Date(reward.expiresAt) <= new Date());

              return (
                <article className="card reward-card" key={id}>
                  {reward.image && (
                    <img
                      src={reward.image}
                      alt={reward.title || "Reward"}
                      style={{
                        width: "100%",
                        maxHeight: "220px",
                        objectFit: "cover",
                        borderRadius: "12px"
                      }}
                    />
                  )}

                  <h3>{reward.title || "Reward draw"}</h3>

                  {reward.description && (
                    <p className="muted">{reward.description}</p>
                  )}

                  {reward.prizeValue && (
                    <p>
                      <strong>Prize:</strong> {reward.prizeValue}
                    </p>
                  )}

                  <p>
                    <strong>Entry cost:</strong> {cost} points
                  </p>

                  <p>
                    <strong>Entries:</strong> {entryCount(reward)}
                  </p>

                  {reward.winnersCount && (
                    <p>
                      <strong>Winners:</strong> {reward.winnersCount}
                    </p>
                  )}

                  {reward.eligibility && (
                    <p className="muted">
                      {reward.eligibility}
                    </p>
                  )}

                  <p className="muted">
                    {dateText(reward.expiresAt)}
                  </p>

                  {closed ? (
                    <p className="muted">This draw is closed.</p>
                  ) : (
                    <button
                      type="button"
                      disabled={!enoughPoints || entering === id}
                      onClick={() => enterReward(reward)}
                    >
                      {entering === id
                        ? "Entering..."
                        : enoughPoints
                          ? `Enter for ${cost} points`
                          : `Need ${cost - points} more points`}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={loadRewards}
          disabled={loading}
        >
          Refresh rewards
        </button>
      </section>

      <section className="card">
        <h2>How points work</h2>
        <p className="muted">
          Earn points through verified walking. Each reward displays
          its entry cost and closing date. You can enter the same draw
          more than once, provided you have enough points.
        </p>
      </section>
    </div>
  );
}
