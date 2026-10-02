async function request(
  endpoint,
  options = {}
) {
  const response = await fetch(
    `/.netlify/functions/${endpoint}`,
    {
      headers: {
        "Content-Type":
          "application/json",
        ...(options.headers || {})
      },
      ...options
    }
  );

  const data =
    await response.json()
      .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Request failed."
    );
  }

  return data;
}

export async function createAccount() {
  return request(
    "account",
    {
      method: "POST",
      body: JSON.stringify({
        action: "create"
      })
    }
  );
}

export async function transferAccount(
  walkingId,
  transferPin
) {
  return request(
    "account",
    {
      method: "POST",
      body: JSON.stringify({
        action: "transfer",
        walkingId,
        transferPin
      })
    }
  );
}

export async function addDistance(
  walkingId,
  distance,
  earnedPoints
) {
  return request(
    "account",
    {
      method: "POST",
      body: JSON.stringify({
        action: "distance",
        walkingId,
        distance,
        earnedPoints
      })
    }
  );
}
