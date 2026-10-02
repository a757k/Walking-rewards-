import { useEffect, useState } from "react";
import WalkStats from "./WalkStats";
import ProgressBar from "./ProgressBar";
import { createLocalAccount, getAccount, saveAccount } from "../utils/storage";
import { createAccount } from "../utils/api";

export default function Dashboard({ account, setPage }) {
  const [currentAccount, setCurrentAccount] = useState(account);

  useEffect(() => {
    async function setup() {
      if (account) {
        setCurrentAccount(account);
        return;
      }

      let local = getAccount();

      if (!local) {
        local = createLocalAccount();

        try {
          const serverAccount = await createAccount();

          local = {
            ...local,
            walkingId: serverAccount.walkingId,
            transferPin: serverAccount.transferPin
          };

          saveAccount(local);
        } catch (error) {
          console.error("Account server setup failed:", error);
        }
      }

      setCurrentAccount(local);
    }

    setup();
  }, [account]);

  if (!currentAccount) {
    return (
      <section className="card">
        <h2>Loading...</h2>
      </section>
    );
  }

  const distance = Number(currentAccount.totalDistance || 0);

  const progress = Math.min(
    100,
    (distance % 5) / 5 * 100
  );

  return (
    <div className="page">
      <section className="hero-card">
        <p className="small-label">YOUR POINTS</p>

        <div className="big-number">
          {currentAccount.points || 0}
        </div>

        <p>points</p>

        <button
          className="primary-button"
          onClick={() => setPage("walk")}
        >
          Start Walking
        </button>
      </section>

      <WalkStats account={currentAccount} />

      <section className="card">
        <div className="section-header">
          <h2>Next point</h2>
          <span>
            {(5 - (distance % 5)).toFixed(2)} km
          </span>
        </div>

        <ProgressBar value={progress} />

        <p className="muted">
          Walk 5 verified kilometres to earn another point.
        </p>
      </section>

      <section className="card">
        <h2>How it works</h2>

        <div className="steps">
          <div>
            <strong>1</strong>
            <span>Start a walk</span>
          </div>

          <div>
            <strong>2</strong>
            <span>Walk naturally with GPS on</span>
          </div>

          <div>
            <strong>3</strong>
            <span>Complete 5 verified km</span>
          </div>

          <div>
            <strong>4</strong>
            <span>Earn points for rewards</span>
          </div>
        </div>
      </section>
    </div>
  );
}
