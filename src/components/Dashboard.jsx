
export default function Dashboard({ account, setPage }) {
  const points = Number(account?.points || 0);

  const todayDistance = Number(
    account?.dailyDistanceKm || 0
  );

  const todayWalkingPoints = Number(
    account?.dailyWalkingPoints || 0
  );

  const lifetimeDistance = Number(
    account?.lifetimeDistance ?? account?.totalDistance ?? 0
  );

  return (
    <div className="dashboard">
      <section className="card">
        <h2>Welcome to Walking Rewards</h2>

        <p>
          Walk verified kilometres, earn points, and use your
          points for available rewards.
        </p>

        <p>
          <strong>How points work:</strong> Earn 1 point for every
          1 km walked. Distance accumulates across multiple walks,
          so even short walks count. Any remaining distance carries over.
        </p>
      </section>

      <section className="stats-grid">
        <div className="card">
          <span>Distance Today</span>
          <strong>{todayDistance.toFixed(2)} km</strong>
        </div>

        <div className="card">
          <span>Walking Points Today</span>
          <strong>{todayWalkingPoints}</strong>
        </div>

        <div className="card">
          <span>Lifetime Distance</span>
          <strong>{lifetimeDistance.toFixed(2)} km</strong>
        </div>

        <div className="card">
          <span>Points Balance</span>
          <strong>{points}</strong>
        </div>
      </section>

      <section className="dashboard-actions">
        <button
          className="primary-button"
          onClick={() => setPage("walk")}
        >
          Start Walking
        </button>

        <button
          className="secondary-button"
          onClick={() => setPage("rewards")}
        >
          View Rewards
        </button>
      </section>
    </div>
  );
}
