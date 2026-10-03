```javascript
async function request(endpoint, options = {}) {
  const response = await fetch(
    "/.netlify/functions/" + endpoint,
    {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    }
  );

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.error || "Request failed."
    );
  }

  return data;
}

export async function createAccount() {
  return request("account", {
    method: "POST",
    body: JSON.stringify({
      action: "create"
    })
  });
}

export async function transferAccount(
  walkingId,
  transferPin
) {
  return request("account", {
    method: "POST",
    body: JSON.stringify({
      action: "transfer",
      walkingId,
      transferPin
    })
  });
}

export async function startWalkSession(
  walkingId
) {
  return request("account", {
    method: "POST",
    body: JSON.stringify({
      action: "startWalk",
      walkingId
    })
  });
}

export async function sendWalkPosition(
  walkingId,
  sessionId,
  position
) {
  return request("account", {
    method: "POST",
    body: JSON.stringify({
      action: "position",
      walkingId,
      sessionId,
      position
    })
  });
}

export async function finishWalkSession(
  walkingId,
  sessionId
) {
  return request("account", {
    method: "POST",
    body: JSON.stringify({
      action: "finishWalk",
      walkingId,
      sessionId
    })
  });
}

export async function enterReward(
  walkingId,
  rewardId,
  paypal,
  email
) {
  return request("account", {
    method: "POST",
    body: JSON.stringify({
      action: "reward",
      walkingId,
      rewardId,
      paypal,
      email
    })
  });
}
```
