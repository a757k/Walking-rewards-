
import { useEffect, useState } from "react";

import Dashboard from "./components/Dashboard";
import Walk from "./components/Walk";
import Rewards from "./components/Rewards";
import Account from "./components/Account";
import AdBanner from "./components/AdBanner";
import PopUnder from "./components/PopUnder";

import { getAccount } from "./utils/storage";

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

export default function App() {
  const [page, setPage] = useState("account");
  const [account, setAccount] = useState(null);

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

  function updateAccount(newAccount) {
    setAccount(newAccount);

    if (newAccount && newAccount.walkingId) {
      setPage("home");
    } else {
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
          <Dashboard
            account={account}
            setPage={setPage}
          />
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
      </nav>
    </div>
  );
}
