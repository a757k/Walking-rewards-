
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

function getDateInTimeZone(timeZone) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }
}

function getSavedDailyReward(saved) {
  if (!saved?.dailyLoginLastClaimDate) return null;

  const timeZone =
    saved.dailyLoginTimeZone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    "UTC";

  const today = getDateInTimeZone(timeZone);

  if (saved.dailyLoginLastClaimDate !== today) {
    return null;
  }

  return {
    streakDay: saved.dailyLoginStreakDay || 1,
    pointsAwarded: 0,
    alreadyClaimed: true,
  };
}

function SponsorLink() {
  return (
    <div style={{ textAlign: "center", padding: "12px", margin: "12px auto" }}>
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

function DailyRewardBanner({
  dailyReward,
  onClaim,
  claiming,
  error,
}) {
  const rewards = [2, 4, 6, 8, 10];
  const currentDay = dailyReward?.streakDay || 1;
  const alreadyClaimed = dailyReward?.alreadyClaimed;

  return (
    <section
      style={{
        margin: "14px 0",
        padding: "18px",
        borderRadius: "14px",
        background: "#17221d",
        border: "1px solid #31523d",
        color: "#ffffff",
      }}
    >
      <div style={{ fontWeight: "700", fontSize: "18px" }}>
        Daily login rewards
      </div>

      <p style={{ color: "#c7d5cb", fontSize: "13px" }}>
        Collect points every day and build your streak!
      </p>

      <div style={{ display: "flex", gap: "7px", marginTop: "14px" }}>
        {rewards.map((points, index) => (
          <div
            key={index}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "9px 3px",
              borderRadius: "9px",
              background:
                index + 1 <= currentDay ? "#315c3e" : "#26332c",
              border: "1px solid #3b4940",
            }}
          >
            <div style={{ fontSize: "11px" }}>Day {index + 1}</div>
            <div style={{ fontWeight: "700", marginTop: "4px" }}>
              {points}
            </div>
            <div style={{ fontSize: "10px" }}>points</div>
          </div>
        ))}
      </div>

      {alreadyClaimed ? (
        <div
          style={{
            marginTop: "15px",
            padding: "12px",
            background: "#26332c",
            borderRadius: "9px",
            textAlign: "center",
            fontWeight: "600",
          }}
        >
          ✓ Today's reward collected!
        </div>
      ) : (
        <button
          onClick={onClaim}
          disabled={claiming}
          style={{
            width: "100%",
            marginTop: "16px",
            padding: "14px",
            border: "none",
            borderRadius: "9px",
            background: claiming ? "#53665a" : "#78c78c",
            color: "#102016",
            fontWeight: "800",
            fontSize: "15px",
            cursor: claiming ? "wait" : "pointer",
          }}
        >
          {claiming ? "Collecting..." : "COLLECT DAILY REWARD"}
        </button>
      )}

      {dailyReward?.pointsAwarded > 0 && (
        <p style={{ textAlign: "center", color: "#91dfa5" }}>
          +{dailyReward.pointsAwarded} points added!
        </p>
      )}

      {error && (
        <p style={{ color: "#ffaaaa", fontSize: "13px" }}>{error}</p>
      )}

      <p style={{ fontSize: "11px", color: "#aebeb2", textAlign: "center" }}>
        Collect once per local calendar day.
      </p>
    </section>
  );
}

export default function App() {
  const [page, setPage] = useState("account");
  const [account, setAccount] = useState(null);
  const [dailyReward, setDailyReward] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [dailyRewardError, setDailyRewardError] = useState("");

  const claimStarted = useRef(false);

  useEffect(() => {
    const saved = getAccount();

    if (saved && saved.walkingId) {
      setAccount(saved);
      setDailyReward(getSavedDailyReward(saved));
      setPage("home");
    } else {
      setAccount(null);
      setPage("account");
    }
  }, []);

  async function claimDailyReward() {
    if (!account || !account.walkingId || !account.transferPin) return;
    if (claimStarted.current) return;

    claimStarted.current = true;
    setClaiming(true);
    setDailyRewardError("");

    if (Math.random() < 0.3) {
      window.open(SMARTLINK, "_blank", "noopener,noreferrer");
    }

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
        throw new Error(data.message || "Could not collect your daily reward.");
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
    } catch (error) {
      console.error("Daily reward error:", error);
      setDailyRewardError(
        error.message || "Your reward could not be collected. Try again."
      );
      claimStarted.current = false;
    } finally {
      setClaiming(false);
    }
  }

  function updateAccount(newAccount) {
    setAccount(newAccount);

    if (newAccount && newAccount.walkingId) {
      saveAccount(newAccount);
      setPage("home");
    } else {
      setAccount(null);
      setDailyReward(null);
      claimStarted.current = false;
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
            <DailyRewardBanner
              dailyReward={dailyReward}
              onClaim={claimDailyReward}
              claiming={claiming}
              error={dailyRewardError}
            />

            <Dashboard account={account} setPage={setPage} />
          </>
        )}

        {page === "walk" && (
          <Walk account={account} updateAccount={updateAccount} />
        )}

        {page === "rewards" && (
          <Rewards account={account} updateAccount={updateAccount} />
        )}

        {page === "account" && (
          <Account account={account} updateAccount={updateAccount} />
        )}

        {page === "admin" && <Admin />}
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
