export default function WalkStats({ account }) {
  return (
    <section className="stats-grid">
      <div className="stat-card">
        <strong>
          {Number(
            account?.totalDistance || 0
          ).toFixed(1)}
        </strong>
        <span>Total km</span>
      </div>

      <div className="stat-card">
        <strong>
          {account?.completedWalks || 0}
        </strong>
        <span>Walks</span>
      </div>

      <div className="stat-card">
        <strong>
          {account?.points || 0}
        </strong>
        <span>Points</span>
      </div>
    </section>
  );
}
