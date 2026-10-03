import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const MAX_WALKING_SPEED_KMH = 12;
const MIN_ACCURACY_METERS = 60;
const MAX_POINT_DISTANCE_METERS = 150;
const MIN_POSITION_INTERVAL_SECONDS = 2;

const REWARD_COSTS = {
  "reward-10": 10,
  "reward-100": 50
};

export default async function handler(req) {
  try {
    if (req.method !== "POST") {
      return json({ success: false, error: "Method not allowed" }, 405);
    }

    // IMPORTANT:
    // Netlify Blobs stores are created inside the request handler.
    const accounts = getStore({
      name: "walking-accounts",
      consistency: "strong"
    });

    const walks = getStore({
      name: "walking-sessions",
      consistency: "strong"
    });

    const rewards = getStore({
      name: "walking-rewards",
      consistency: "strong"
    });

    const body = await req.json();

    switch (body.action) {
      case "createAccount":
        return await createAccount(accounts);

      case "transferAccount":
        return await transferAccount(body, accounts);

      case "startWalk":
        return await startWalk(body, accounts, walks);

      case "position":
        return await addPosition(body, accounts, walks);

      case "finishWalk":
        return await finishWalk(body, accounts, walks);

      case "reward":
        return await createRewardEntry(body, accounts, rewards);

      default:
        return json(
          {
            success: false,
            error: "Unknown action"
          },
          400
        );
    }
  } catch (error) {
    console.error("Account function error:", error);

    return json(
      {
        success: false,
        error: "Server error",
        details: error?.message || String(error)
      },
      500
    );
  }
}


/* =========================================================
   CREATE ACCOUNT
========================================================= */

async function createAccount(accounts) {
  let walkingId;

  for (let i = 0; i < 20; i++) {
    const candidate = generateWalkingId();

    const existing = await accounts.get(
      `account/${candidate}`,
      { type: "json" }
    );

    if (!existing) {
      walkingId = candidate;
      break;
    }
  }

  if (!walkingId) {
    return json(
      {
        success: false,
        error: "Could not create a unique Walking ID"
      },
      500
    );
  }

  const transferPin = generateTransferPin();

  const account = {
    walkingId,
    transferPin,

    points: 0,

    totalDistance: 0,
    lifetimeDistance: 0,

    completedWalks: 0,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await accounts.setJSON(
    `account/${walkingId}`,
    account
  );

  return json({
    success: true,
    account
  });
}


/* =========================================================
   TRANSFER ACCOUNT
========================================================= */

async function transferAccount(body, accounts) {
  const walkingId = normalizeWalkingId(body.walkingId);
  const transferPin = String(body.transferPin || "").trim();

  if (!walkingId || !transferPin) {
    return json(
      {
        success: false,
        error: "Walking ID and transfer PIN are required"
      },
      400
    );
  }

  const account = await getAccount(
    accounts,
    walkingId
  );

  if (!account) {
    return json(
      {
        success: false,
        error: "Walking ID not found"
      },
      404
    );
  }

  if (account.transferPin !== transferPin) {
    return json(
      {
        success: false,
        error: "Incorrect transfer PIN"
      },
      401
    );
  }

  return json({
    success: true,
    account
  });
}


/* =========================================================
   START WALK
========================================================= */

async function startWalk(body, accounts, walks) {
  const walkingId = normalizeWalkingId(body.walkingId);

  if (!walkingId) {
    return json(
      {
        success: false,
        error: "Walking ID is required"
      },
      400
    );
  }

  const account = await getAccount(
    accounts,
    walkingId
  );

  if (!account) {
    return json(
      {
        success: false,
        error: "Account not found"
      },
      404
    );
  }

  const sessionId = crypto.randomUUID();

  const now = Date.now();

  const session = {
    sessionId,
    walkingId,

    startedAt: new Date(now).toISOString(),
    lastPositionAt: null,

    lastLatitude: null,
    lastLongitude: null,

    distanceMeters: 0,

    positions: [],

    finished: false,

    createdAt: new Date(now).toISOString()
  };

  await walks.setJSON(
    `walk/${sessionId}`,
    session
  );

  return json({
    success: true,
    sessionId,
    session
  });
}


/* =========================================================
   ADD GPS POSITION
========================================================= */

async function addPosition(body, accounts, walks) {
  const walkingId = normalizeWalkingId(body.walkingId);
  const sessionId = String(body.sessionId || "").trim();

  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const accuracy = Number(body.accuracy);

  if (!walkingId || !sessionId) {
    return json(
      {
        success: false,
        error: "Walking ID and session ID are required"
      },
      400
    );
  }

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return json(
      {
        success: false,
        error: "Invalid GPS coordinates"
      },
      400
    );
  }

  if (!Number.isFinite(accuracy)) {
    return json(
      {
        success: false,
        error: "Invalid GPS accuracy"
      },
      400
    );
  }

  if (accuracy > MIN_ACCURACY_METERS) {
    return json({
      success: false,
      ignored: true,
      reason: "GPS accuracy is too low"
    });
  }

  const account = await getAccount(
    accounts,
    walkingId
  );

  if (!account) {
    return json(
      {
        success: false,
        error: "Account not found"
      },
      404
    );
  }

  const session = await walks.get(
    `walk/${sessionId}`,
    { type: "json" }
  );

  if (!session) {
    return json(
      {
        success: false,
        error: "Walking session not found"
      },
      404
    );
  }

  if (session.walkingId !== walkingId) {
    return json(
      {
        success: false,
        error: "Session does not belong to this account"
      },
      403
    );
  }

  if (session.finished) {
    return json(
      {
        success: false,
        error: "Walking session is already finished"
      },
      400
    );
  }

  const now = Date.now();

  /*
   * First GPS point
   */
  if (
    session.lastLatitude === null ||
    session.lastLongitude === null ||
    session.lastPositionAt === null
  ) {
    session.lastLatitude = latitude;
    session.lastLongitude = longitude;
    session.lastPositionAt = now;

    session.positions.push({
      latitude,
      longitude,
      accuracy,
      timestamp: now
    });

    await walks.setJSON(
      `walk/${sessionId}`,
      session
    );

    return json({
      success: true,
      accepted: true,
      distanceMeters: session.distanceMeters
    });
  }

  const elapsedSeconds =
    (now - session.lastPositionAt) / 1000;

  if (elapsedSeconds < MIN_POSITION_INTERVAL_SECONDS) {
    return json({
      success: true,
      accepted: false,
      ignored: true,
      reason: "Position received too quickly",
      distanceMeters: session.distanceMeters
    });
  }

  const distanceMeters = haversineMeters(
    session.lastLatitude,
    session.lastLongitude,
    latitude,
    longitude
  );

  /*
   * Calculate speed.
   */
  const speedKmh =
    elapsedSeconds > 0
      ? (distanceMeters / 1000) /
        (elapsedSeconds / 3600)
      : Infinity;

  /*
   * Reject impossible jumps.
   */
  if (distanceMeters > MAX_POINT_DISTANCE_METERS) {
    return json({
      success: true,
      accepted: false,
      ignored: true,
      reason: "GPS jump too large",
      distanceMeters: session.distanceMeters
    });
  }

  /*
   * Reject unrealistic walking speed.
   */
  if (speedKmh > MAX_WALKING_SPEED_KMH) {
    return json({
      success: true,
      accepted: false,
      ignored: true,
      reason: "Walking speed too high",
      distanceMeters: session.distanceMeters
    });
  }

  /*
   * Ignore tiny GPS movement/noise.
   */
  if (distanceMeters >= 3) {
    session.distanceMeters += distanceMeters;
  }

  session.lastLatitude = latitude;
  session.lastLongitude = longitude;
  session.lastPositionAt = now;

  session.positions.push({
    latitude,
    longitude,
    accuracy,
    timestamp: now,
    distanceMeters,
    speedKmh
  });

  /*
   * Keep the session from becoming unnecessarily huge.
   */
  if (session.positions.length > 5000) {
    session.positions = session.positions.slice(-5000);
  }

  await walks.setJSON(
    `walk/${sessionId}`,
    session
  );

  return json({
    success: true,
    accepted: true,
    distanceMeters: session.distanceMeters,
    distanceKm: session.distanceMeters / 1000
  });
}


/* =========================================================
   FINISH WALK
========================================================= */

async function finishWalk(body, accounts, walks) {
  const walkingId = normalizeWalkingId(body.walkingId);
  const sessionId = String(body.sessionId || "").trim();

  if (!walkingId || !sessionId) {
    return json(
      {
        success: false,
        error: "Walking ID and session ID are required"
      },
      400
    );
  }

  const account = await getAccount(
    accounts,
    walkingId
  );

  if (!account) {
    return json(
      {
        success: false,
        error: "Account not found"
      },
      404
    );
  }

  const session = await walks.get(
    `walk/${sessionId}`,
    { type: "json" }
  );

  if (!session) {
    return json(
      {
        success: false,
        error: "Walking session not found"
      },
      404
    );
  }

  if (session.walkingId !== walkingId) {
    return json(
      {
        success: false,
        error: "Session does not belong to this account"
      },
      403
    );
  }

  if (session.finished) {
    return json(
      {
        success: false,
        error: "Walking session is already finished"
      },
      400
    );
  }

  const walkDistanceMeters = Math.max(
    0,
    Number(session.distanceMeters) || 0
  );

  const previousTotalDistance =
    Number(account.totalDistance) || 0;

  const newTotalDistance =
    previousTotalDistance +
    walkDistanceMeters;

  /*
   * One point for every completed 5 km milestone.
   */
  const previousMilestones = Math.floor(
    previousTotalDistance / 5000
  );

  const newMilestones = Math.floor(
    newTotalDistance / 5000
  );

  const earnedPoints = Math.max(
    0,
    newMilestones - previousMilestones
  );

  account.totalDistance = newTotalDistance;

  account.lifetimeDistance =
    (Number(account.lifetimeDistance) || 0) +
    walkDistanceMeters;

  account.completedWalks =
    (Number(account.completedWalks) || 0) + 1;

  account.points =
    (Number(account.points) || 0) +
    earnedPoints;

  account.updatedAt =
    new Date().toISOString();

  session.finished = true;
  session.finishedAt =
    new Date().toISOString();

  session.earnedPoints = earnedPoints;

  await accounts.setJSON(
    `account/${walkingId}`,
    account
  );

  await walks.setJSON(
    `walk/${sessionId}`,
    session
  );

  return json({
    success: true,

    account,

    session,

    walkDistanceMeters,

    walkDistanceKm:
      walkDistanceMeters / 1000,

    earnedPoints
  });
}


/* =========================================================
   CREATE REWARD ENTRY
========================================================= */

async function createRewardEntry(body, accounts, rewards) {
  const walkingId = normalizeWalkingId(body.walkingId);
  const rewardId = String(body.rewardId || "").trim();

  if (!walkingId || !rewardId) {
    return json(
      {
        success: false,
        error: "Walking ID and reward ID are required"
      },
      400
    );
  }

  const cost = REWARD_COSTS[rewardId];

  if (!cost) {
    return json(
      {
        success: false,
        error: "Invalid reward"
      },
      400
    );
  }

  const account = await getAccount(
    accounts,
    walkingId
  );

  if (!account) {
    return json(
      {
        success: false,
        error: "Account not found"
      },
      404
    );
  }

  const currentPoints =
    Number(account.points) || 0;

  if (currentPoints < cost) {
    return json(
      {
        success: false,
        error: "Not enough points"
      },
      400
    );
  }

  const rewardEntryId =
    crypto.randomUUID();

  const rewardEntry = {
    rewardEntryId,

    walkingId,

    rewardId,

    cost,

    status: "entered",

    createdAt:
      new Date().toISOString()
  };

  account.points =
    currentPoints - cost;

  account.updatedAt =
    new Date().toISOString();

  await accounts.setJSON(
    `account/${walkingId}`,
    account
  );

  await rewards.setJSON(
    `reward/${rewardEntryId}`,
    rewardEntry
  );

  return json({
    success: true,

    account,

    reward: rewardEntry
  });
}


/* =========================================================
   GET ACCOUNT
========================================================= */

async function getAccount(accounts, walkingId) {
  return await accounts.get(
    `account/${walkingId}`,
    { type: "json" }
  );
}


/* =========================================================
   WALKING ID
========================================================= */

function normalizeWalkingId(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}


function generateWalkingId() {
  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let randomPart = "";

  for (let i = 0; i < 8; i++) {
    randomPart +=
      characters[
        Math.floor(
          Math.random() * characters.length
        )
      ];
  }

  return `WR-${randomPart}`;
}


/* =========================================================
   TRANSFER PIN
========================================================= */

function generateTransferPin() {
  return String(
    Math.floor(
      100000 +
      Math.random() * 900000
    )
  );
}


/* =========================================================
   HAVERSINE DISTANCE
========================================================= */

function haversineMeters(
  latitude1,
  longitude1,
  latitude2,
  longitude2
) {
  const earthRadiusMeters = 6371000;

  const lat1 =
    (latitude1 * Math.PI) / 180;

  const lat2 =
    (latitude2 * Math.PI) / 180;

  const deltaLat =
    ((latitude2 - latitude1) * Math.PI) /
    180;

  const deltaLon =
    ((longitude2 - longitude1) * Math.PI) /
    180;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadiusMeters * c;
}


/* =========================================================
   JSON RESPONSE
========================================================= */

function json(data, status = 200) {
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
