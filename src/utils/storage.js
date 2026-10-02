export default function Dashboard({ account, setPage }) {
  const points = account?.points || 0;
  const totalDistance = Number(account?.totalDistance || 0);
  const completedWalks = account?.completedWalks || 0;

  const progress = totalDistance % 5;
  const progressPercent = (progress / 5) * 100;

  return (
    <div className="dashboard">
      <section className="card">
        <h2>Welcome to Walking Rewards</h2>

        <p>
          Walk verified kilometres, earn points, and use your
          points for available rewards.
        </p>
      </section>

      <section className="stats-grid">
        <div className="card">
          <span>Points</span>
          <strong>{points}</strong>
        </div>

        <div className="card">
          <span>Total Distance</span>
          <strong>{totalDistance.toFixed(2)} km</strong>
        </div>

        <div className="card">
          <span>Completed Walks</span>
          <strong>{completedWalks}</strong>
        </div>
      </section>

      <section className="card">
        <h3>Next Point</h3>

        <p>
          {progress.toFixed(2)} km of 5 km completed
        </p>

        <div className="progress-container">
          <div
            className="progress-bar"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <p>
          {(5 - progress).toFixed(2)} km remaining
        </p>
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
