const ACCOUNT_KEY = "walking_rewards_account";

export function getAccount() {
  try {
    const saved = localStorage.getItem(ACCOUNT_KEY);

    if (!saved) {
      return null;
    }

    const account = JSON.parse(saved);

    if (!account || !account.walkingId) {
      return null;
    }

    return account;
  } catch (error) {
    console.error("Failed to load local account:", error);
    return null;
  }
}

export function saveAccount(account) {
  if (!account || !account.walkingId) {
    throw new Error("Cannot save an invalid account.");
  }

  localStorage.setItem(
    ACCOUNT_KEY,
    JSON.stringify(account)
  );
}

export function clearAccount() {
  localStorage.removeItem(ACCOUNT_KEY);
}
