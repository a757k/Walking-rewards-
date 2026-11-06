import { useEffect, useRef, useState } from "react";

import Dashboard from "./components/Dashboard";
import Walk from "./components/Walk";
import Rewards from "./components/Rewards";
import Account from "./components/Account";
import Admin from "./components/Admin";
import AdBanner from "./components/AdBanner";
import PopUnder from "./components/PopUnder";

import { getAccount, saveAccount } from "./utils/storage";

const SMARTLINK =
  "https://araplhn.org/4/18626d8b0e3ef5c5fe42dacc09b3cef8";

function SponsorLink() {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "12px",
        margin: "12px auto",
      }}
    >
      <a
        href={SMARTLINK}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          padding: "11px 20px",
          borderRadius: "8px",
          background: "#2563eb",
          color: "#ffffff",
          textDecoration: "none",
          fontWeight: "600",
          fontSize: "14px",
        }}
      >
        Visit today's sponsor (optional)
      </a>
    </div>
  );
}

function DailyRewardBanner({ dailyReward }) {
  if (!dailyReward) return null;

  const rewards = [2, 4, 6, 8, 10];
  const currentDay = dailyReward.streakDay || 1;

  return (
    <section
      style={{
        margin: "14px 0",
        padding: "16px",
        borderRadius: "14px",
        background: "#17221d",
        border: "1px solid #31523d",
        color: "#ffffff",
      }}
    >
      <div style={{ fontWeight: "700", fontSize: "16px" }}>
        Daily login rewards
      </div>

      <p style={{ margin: "7px 0", color: "#c7d5cb", fontSize: "13px" }}>
        {dailyReward.alreadyClaimed
          ? `Today's reward has already been collected.`
          : `You've collected today's daily reward!`}
      </p>

      <div
        style={{
          display: "flex",
          gap: "7px",
          marginTop: "12px",
        }}
      >
        {rewards.map((points, index) => {
          const completed = index + 1 <= currentDay;

          return (
            <div
              key={index}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "9px 3px",
                borderRadius: "9px",
                background: completed ? "#315c3e" : "#26332c",
                border: completed
                  ? "1px solid #72b987"
                  : "1px solid #3b4940",
              }}
            >
              <div style={{ fontSize: "11px", color: "#d4e3d8" }}>
                Day {index + 1}
              </div>
              <div style={{ fontWeight: "700", marginTop: "4px" }}>
                {points}
              </div>
              <div style={{ fontSize: "10px", color: "#c7d5cb" }}>
                points
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ margin: "11px 0 0", fontSize: "12px", color: "#c7d5cb" }}>
        {currentDay === 5
          ? "You've completed the 5-day cycle. Your next reward starts again at 2 points."
          : `Keep logging in tomorrow to reach Day ${currentDay + 1}.`}
      </p>
    </section>
  );
}

export default function App() {
  const [page, setPage] = useState("account");
  const [account, setAccount] = useState(null);
  const [dailyReward, setDailyReward] = useState(null);
  const [dailyRewardError, setDailyRewardError] = useState("");

  const dailyClaimStarted = useRef(false);

  useEffect(() => {
    const saved = getAccount();

    if (saved && saved.walkingId) {
      setAccount(saved);
      setPage("home");
    } else {
      setAccount(null);
      setPage("account");
    }
  }, []);

  useEffect(() => {
    if (!account || !account.walkingId || !account.transferPin) {
      return;
    }

    if (dailyClaimStarted.current) {
      return;
    }

    dailyClaimStarted.current = true;

    async function claimDailyReward() {
      try {
        const timeZone =
          Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

        const response = await fetch("/.netlify/functions/account", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "claimDailyLogin",
            walkingId: account.walkingId,
            transferPin: account.transferPin,
            timeZone,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Daily reward could not be claimed.");
        }

        if (data.account) {
          saveAccount(data.account);
          setAccount(data.account);
        }

        setDailyReward({
          streakDay: data.streakDay || data.account?.dailyLoginStreakDay || 1,
          pointsAwarded: data.pointsAwarded || 0,
          alreadyClaimed: Boolean(data.alreadyClaimed),
        });

        setDailyRewardError("");
      } catch (error) {
        console.error("Daily reward error:", error);
        setDailyRewardError(
          "Your daily reward could not be checked. Please try again later."
        );
        dailyClaimStarted.current = false;
      }
    }

    claimDailyReward();
  }, [account]);

  function updateAccount(newAccount) {
    setAccount(newAccount);

    if (newAccount && newAccount.walkingId) {
      saveAccount(newAccount);
      setPage("home");
    } else {
      setAccount(null);
      setDailyReward(null);
      dailyClaimStarted.current = false;
      setPage("account");
    }
  }

  if (!account) {
    return (
      <div className="app">
        <PopUnder />

        <main className="main-content">
          <Account
            account={null}
            updateAccount={updateAccount}
            firstSetup={true}
          />
        </main>

        <SponsorLink />
        <AdBanner />
      </div>
    );
  }

  return (
    <div className="app">
      <PopUnder />

      <header className="topbar">
        <div>
          <h1>Walking Rewards</h1>
          <p>Walk more. Earn more.</p>
        </div>

        <button
          className="account-button"
          onClick={() => setPage("account")}
        >
          Account
        </button>
      </header>

      <main className="main-content">
        {page === "home" && (
          <>
            <DailyRewardBanner dailyReward={dailyReward} />

            {dailyRewardError && (
              <p style={{ color: "#e6a36b", fontSize: "13px" }}>
                {dailyRewardError}
              </p>
            )}

            <Dashboard
              account={account}
              setPage={setPage}
            />
          </>
        )}

        {page === "walk" && (
          <Walk
            account={account}
            updateAccount={updateAccount}
          />
        )}

        {page === "rewards" && (
          <Rewards
            account={account}
            updateAccount={updateAccount}
          />
        )}

        {page === "account" && (
          <Account
            account={account}
            updateAccount={updateAccount}
          />
        )}

        {page === "admin" && (
          <Admin />
        )}
      </main>

      <SponsorLink />
      <AdBanner />

      <nav className="bottom-nav">
        <button
          className={page === "home" ? "active" : ""}
          onClick={() => setPage("home")}
        >
          Home
        </button>

        <button
          className={page === "walk" ? "active" : ""}
          onClick={() => setPage("walk")}
        >
          Walk
        </button>

        <button
          className={page === "rewards" ? "active" : ""}
          onClick={() => setPage("rewards")}
        >
          Rewards
        </button>

        <button
          className={page === "account" ? "active" : ""}
          onClick={() => setPage("account")}
        >
          Account
        </button>

        <button
          className={page === "admin" ? "active" : ""}
          onClick={() => setPage("admin")}
        >
          Admin
        </button>
      </nav>
    </div>
  );
}
