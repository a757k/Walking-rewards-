import { useEffect, useState } from "react";
import Dashboard from "./components/Dashboard";
import Walk from "./components/Walk";
import Rewards from "./components/Rewards";
import Account from "./components/Account";
import { getAccount } from "./utils/storage";

export default function App() {
  const [page, setPage] = useState("home");
  const [account, setAccount] = useState(null);

  useEffect(() => {
    const saved = getAccount();

    if (saved) {
      setAccount(saved);
    }
  }, []);

  function updateAccount(newAccount) {
    setAccount(newAccount);
  }

  return (
    <div className="app">
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
