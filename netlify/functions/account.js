import {
  getStore
} from "@netlify/blobs";

import crypto from "node:crypto";

const accounts =
  getStore({
    name: "walking-accounts",
    consistency: "strong"
  });

const walks =
  getStore({
    name: "walking-sessions",
    consistency: "strong"
  });

const rewards =
  getStore({
    name: "walking-rewards",
    consistency: "strong"
  });

const MAX_WALKING_SPEED_KMH = 12;

const MIN_ACCURACY_METERS = 60;

const MAX_POINT_DISTANCE_METERS = 150;

const MIN_POSITION_INTERVAL_SECONDS = 2;

const REWARD_COSTS = {
  "reward-10": 10,
  "reward-100": 50
};

export default async function handler(
  req
) {
  if (req.method !== "POST") {
    return json(
      {
        error:
          "Method not allowed."
      },
      405
    );
  }

  try {
    const body =
      await req.json();

    switch (body.action) {
      case "create":
        return await createAccount();

      case "transfer":
        return await transferAccount(
          body
        );

      case "startWalk":
        return await startWalk(
          body
        );

      case "position":
        return await addPosition(
          body
        );

      case "finishWalk":
        return await finishWalk(
          body
        );

      case "reward":
        return await createRewardEntry(
          body
        );

      default:
        return json(
          {
            error:
              "Unknown action."
          },
          400
        );
    }
  } catch (error) {
    console.error(
      "Walking Rewards error:",
      error
    );

    return json(
      {
        error:
          "Server error. Please try again."
      },
      500
    );
  }
}

/* =========================
   ACCOUNT
========================= */

async function createAccount() {
  let walkingId;

  do {
    walkingId =
      generateWalkingId();
  } while (
    await accounts.get(
      `account/${walkingId}`
    )
  );

  const transferPin =
    generateTransferPin();

  const account = {
    walkingId,
    transferPin,

    points: 0,

    totalDistance: 0,

    lifetimeDistance: 0,

    completedWalks: 0,

    createdAt:
      new Date().toISOString()
  };

  await accounts.setJSON(
    `account/${walkingId}`,
    account
  );

  return json(
    account,
    200
  );
}

async function transferAccount(body) {
  const walkingId =
    normalizeWalkingId(
      body.walkingId
    );

  const transferPin =
    String(
      body.transferPin || ""
    ).trim();

  if (!walkingId || !transferPin) {
    return json(
      {
        error:
          "Walking ID and PIN are required."
      },
      400
    );
  }

  const account =
    await accounts.get(
      `account/${walkingId}`,
      {
        type: "json"
      }
    );

  if (!account) {
    return json(
      {
        error:
          "Walking account not found."
      },
      404
    );
  }

  if (
    account.transferPin !==
    transferPin
  ) {
    return json(
      {
        error:
          "Invalid transfer PIN."
      },
      401
    );
  }

  return json(
    account,
    200
  );
}

/* =========================
   WALK START
========================= */

async function startWalk(body) {
  const walkingId =
    normalizeWalkingId(
      body.walkingId
    );

  const account =
    await getAccount(
      walkingId
    );

  if (!account) {
    return json(
      {
        error:
          "Walking account not found."
      },
      404
    );
  }

  const sessionId =
    crypto.randomUUID();

  const session = {
    sessionId,

    walkingId,

    startedAt:
      new Date().toISOString(),

    finishedAt: null,

    distanceKm: 0,

    points: [],

    rejectedPoints: 0,

    finished: false
  };

  await walks.setJSON(
    `session/${sessionId}`,
    session
  );

  return json(
    {
      sessionId
    },
    200
  );
}

/* =========================
   GPS POSITION
========================= */

async function addPosition(body) {
  const walkingId =
    normalizeWalkingId(
      body.walkingId
    );

  const sessionId =
    String(
      body.sessionId || ""
    );

  const position =
    body.position;

  if (
    !walkingId ||
    !sessionId ||
    !position
  ) {
    return json(
      {
        error:
          "Missing walking data."
      },
      400
    );
  }

  const account =
    await getAccount(
      walkingId
    );

  if (!account) {
    return json(
      {
        error:
          "Walking account not found."
      },
      404
    );
  }

  const session =
    await walks.get(
      `session/${sessionId}`,
      {
        type: "json"
      }
    );

  if (!session) {
    return json(
      {
        error:
          "Walk session not found."
      },
      404
    );
  }

  if (
    session.walkingId !==
    walkingId
  ) {
    return json(
      {
        error:
          "Invalid walking session."
      },
      403
    );
  }

  if (session.finished) {
    return json(
      {
        error:
          "This walk has already finished."
      },
      400
    );
  }

  const latitude =
    Number(
      position.latitude
    );

  const longitude =
    Number(
      position.longitude
    );

  const accuracy =
    Number(
      position.accuracy
    );

  const timestamp =
    Number(
      position.timestamp
    );

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(timestamp)
  ) {
    return json(
      {
        error:
          "Invalid GPS data."
      },
      400
    );
  }

  if (
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return json(
      {
        error:
          "Invalid GPS coordinates."
      },
      400
    );
  }

  if (
    Number.isFinite(accuracy) &&
    accuracy > MIN_ACCURACY_METERS
  ) {
    return json(
      {
        distanceKm:
          session.distanceKm,

        rejected: true,

        reason:
          "GPS accuracy is too weak."
      },
      200
    );
  }

  const newPoint = {
    latitude,
    longitude,
    accuracy,
    timestamp
  };

  const previous =
    session.points[
      session.points.length - 1
    ];

  if (!previous) {
    session.points.push(
      newPoint
    );

    await walks.setJSON(
      `session/${sessionId}`,
      session
    );

    return json(
      {
        distanceKm:
          session.distanceKm,

        rejected: false
      },
      200
    );
  }

  const elapsedSeconds =
    Math.max(
      0.1,
      (timestamp -
        previous.timestamp) /
        1000
    );

  if (
    elapsedSeconds <
    MIN_POSITION_INTERVAL_SECONDS
  ) {
    return json(
      {
        distanceKm:
          session.distanceKm,

        rejected: true,

        reason:
          "GPS updates are arriving too quickly."
      },
      200
    );
  }

  const meters =
    haversineMeters(
      previous.latitude,
      previous.longitude,
      latitude,
      longitude
    );

  const speedKmh =
    (meters /
      elapsedSeconds) *
    3.6;

  /*
    Reject impossible movement.
  */

  if (
    speedKmh >
      MAX_WALKING_SPEED_KMH ||
    meters >
      MAX_POINT_DISTANCE_METERS
  ) {
    session.rejectedPoints += 1;

    await walks.setJSON(
      `session/${sessionId}`,
      session
    );

    return json(
      {
        distanceKm:
          session.distanceKm,

        rejected: true,

        reason:
          "Movement was too fast or the GPS jump was too large."
      },
      200
    );
  }

  /*
    Ignore tiny GPS noise.
  */

  if (meters < 3) {
    session.points.push(
      newPoint
    );

    await walks.setJSON(
      `session/${sessionId}`,
      session
    );

    return json(
      {
        distanceKm:
          session.distanceKm,

        rejected: false
      },
      200
    );
  }

  session.distanceKm +=
    meters / 1000;

  session.points.push(
    newPoint
  );

  /*
    Keep the session reasonably small.
    We don't need every single point forever.
  */

  if (
    session.points.length >
    2000
  ) {
    session.points =
      session.points.slice(
        -1500
      );
  }

  await walks.setJSON(
    `session/${sessionId}`,
    session
  );

  return json(
    {
      distanceKm:
        session.distanceKm,

      rejected: false
    },
    200
  );
}

/* =========================
   FINISH WALK
========================= */

async function finishWalk(body) {
  const walkingId =
    normalizeWalkingId(
      body.walkingId
    );

  const sessionId =
    String(
      body.sessionId || ""
    );

  const account =
    await getAccount(
      walkingId
    );

  if (!account) {
    return json(
      {
        error:
          "Walking account not found."
      },
      404
    );
  }

  const session =
    await walks.get(
      `session/${sessionId}`,
      {
        type: "json"
      }
    );

  if (!session) {
    return json(
      {
        error:
          "Walk session not found."
      },
      404
    );
  }

  if (
    session.walkingId !==
    walkingId
  ) {
    return json(
      {
        error:
          "Invalid walking session."
      },
      403
    );
  }

  if (session.finished) {
    return json(
      {
        error:
          "Walk already finished."
      },
      400
    );
  }

  session.finished = true;

  session.finishedAt =
    new Date().toISOString();

  /*
    Points are calculated from the server's
    verified distance.
  */

  const oldDistance =
    Number(
      account.totalDistance || 0
    );

  const newDistance =
    oldDistance +
    session.distanceKm;

  const oldMilestones =
    Math.floor(
      oldDistance / 5
    );

  const newMilestones =
    Math.floor(
      newDistance / 5
    );

  const earnedPoints =
    Math.max(
      0,
      newMilestones -
        oldMilestones
    );

  account.totalDistance =
    newDistance;

  account.lifetimeDistance =
    Number(
      account.lifetimeDistance || 0
    ) +
    session.distanceKm;

  account.completedWalks =
    Number(
      account.completedWalks || 0
    ) + 1;

  account.points =
    Number(
      account.points || 0
    ) +
    earnedPoints;

  await accounts.setJSON(
    `account/${walkingId}`,
    account
  );

  await walks.setJSON(
    `session/${sessionId}`,
    session
  );

  return json(
    {
      distanceKm:
        session.distanceKm,

      earnedPoints,

      account
    },
    200
  );
}

/* =========================
   REWARDS
========================= */

async function createRewardEntry(
  body
) {
  const walkingId =
    normalizeWalkingId(
      body.walkingId
    );

  const rewardId =
    String(
      body.rewardId || ""
    );

  const cost =
    REWARD_COSTS[
      rewardId
    ];

  if (!cost) {
    return json(
      {
        error:
          "Invalid reward."
      },
      400
    );
  }

  const account =
    await getAccount(
      walkingId
    );

  if (!account) {
    return json(
      {
        error:
          "Walking account not found."
      },
      404
    );
  }

  if (
    Number(account.points || 0) <
    cost
  ) {
    return json(
      {
        error:
          "You do not have enough points."
      },
      400
    );
  }

  account.points -= cost;

  const entryId =
    crypto.randomUUID();

  const entry = {
    entryId,

    walkingId,

    rewardId,

    cost,

    createdAt:
      new Date().toISOString(),

    status:
      "active"
  };

  await rewards.setJSON(
    `entry/${entryId}`,
    entry
  );

  await accounts.setJSON(
    `account/${walkingId}`,
    account
  );

  return json(
    {
      entry,

      account
    },
    200
  );
}

/* =========================
   HELPERS
========================= */

async function getAccount(
  walkingId
) {
  if (!walkingId) {
    return null;
  }

  return accounts.get(
    `account/${walkingId}`,
    {
      type: "json"
    }
  );
}

function normalizeWalkingId(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toUpperCase();
}

function generateWalkingId() {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let result = "WR-";

  for (
    let i = 0;
    i < 8;
    i++
  ) {
    result +=
      alphabet[
        Math.floor(
          Math.random() *
            alphabet.length
        )
      ];
  }

  return result;
}

function generateTransferPin() {
  return String(
    Math.floor(
      100000 +
        Math.random() *
          900000
    )
  );
}

function haversineMeters(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const R = 6371000;

  const dLat =
    (lat2 - lat1) *
    Math.PI /
    180;

  const dLon =
    (lon2 - lon1) *
    Math.PI /
    180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(
      lat1 *
        Math.PI /
        180
    ) *
    Math.cos(
      lat2 *
        Math.PI /
        180
    ) *
    Math.sin(dLon / 2) ** 2;

  return (
    R *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}

function json(
  data,
  status = 200
) {
  return new Response(
    JSON.stringify(data),
    {
      status,

      headers: {
        "Content-Type":
          "application/json",

        "Cache-Control":
          "no-store"
      }
    }
  );
}
