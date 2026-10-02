const ACCOUNT_KEY = "walking_rewards_account";

export function getAccount() {
  try {
    const saved = localStorage.getItem(ACCOUNT_KEY);

    if (!saved) {
      return null;
    }

    return JSON.parse(saved);
  } catch (error) {
    console.error("Could not load account:", error);
    return null;
  }
}

export function saveAccount(account) {
  localStorage.setItem(
    ACCOUNT_KEY,
    JSON.stringify(account)
  );
}

export function clearAccount() {
  localStorage.removeItem(ACCOUNT_KEY);
}

export function createLocalAccount() {
  const account = {
    walkingId: null,
    transferPin: null,
    points: 0,
    totalDistance: 0,
    lifetimeDistance: 0,
    completedWalks: 0,
    createdAt: new Date().toISOString()
  };

  saveAccount(account);

  return account;
}
