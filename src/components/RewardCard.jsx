export default function RewardCard({
  reward,
  onSelect,
  availablePoints,
  loading
}) {
  const canUse =
    Number(availablePoints || 0) >=
    Number(reward.cost);

  return (
    <section className="card reward-card">
      <div>
        <p className="small-label">
          SPONSORED REWARD
        </p>

        <h2>
          {reward.title}
        </h2>

        <p className="muted">
          {reward.description}
        </p>
      </div>

      <div className="reward-bottom">
        <strong>
          {reward.cost} points
        </strong>

        <button
          className={
            canUse
              ? "primary-button"
              : "disabled-button"
          }
          disabled={
            !canUse || loading
          }
          onClick={() =>
            onSelect(reward)
          }
        >
          {loading
            ? "Processing..."
            : canUse
            ? "Enter"
            : "Not Enough"}
        </button>
      </div>
    </section>
  );
}
