import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

/* =========================
   WALKING SETTINGS
========================= */

// Outdoor GPS checks
const MAX_WALKING_SPEED_KMH = 12;
const MIN_ACCURACY_METERS = 60;
const MAX_POINT_DISTANCE_METERS = 150;
const MIN_POSITION_INTERVAL_SECONDS = 2;

// Treadmill checks
const METRES_PER_STEP = 0.75;
const MAX_STEPS_PER_MINUTE = 220;
const MAX_TREADMILL_BATCH_STEPS = 500;

// Rewards
const POINTS_PER_KILOMETRE = 1;

const REWARD_COSTS = {
  "reward-10": 10,
  "reward-100": 50
};


/* =========================
   MAIN HANDLER
========================= */

export default async function handler(req) {
  if (req.method !== "POST") {
    return json(
      { error: "Method not allowed." },
      405
    );
  }

  try {
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
      case "create":
      case "createAccount":
        return await createAccount(accounts);

      case "transfer":
      case "transferAccount":
        return await transferAccount(
          body,
          accounts
        );

      case "startWalk":
        return await startWalk(
          body,
          accounts,
          walks,
          "outdoor"
        );

      case "startTreadmill":
        return await startWalk(
          body,
          accounts,
          walks,
          "treadmill"
        );

      case "position":
        return await addPosition(
          body,
          accounts,
          walks
        );

      case "treadmillSteps":
        return await addTreadmillSteps(
          body,
          accounts,
          walks
        );

      case "finishWalk":
        return await finishWalk(
          body,
          accounts,
          walks
        );

      case "reward":
        return await createRewardEntry(
          body,
          accounts,
          rewards
        );

      default:
        return json(
          {
            error: "Unknown action."
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
   ACCOUNT CREATION
========================= */

async function createAccount(accounts) {
  let walkingId;
  let existingAccount;

  do {
    walkingId = generateWalkingId();

    existingAccount = await accounts.get(
      `account/${walkingId}`,
      { type: "json" }
    );
  } while (existingAccount);

  const transferPin =
    generateTransferPin();

  const now = new Date().toISOString();

  const account = {
    walkingId,
    transferPin,
    points: 0,
    totalDistance: 0,
    lifetimeDistance: 0,
    completedWalks: 0,
    createdAt: now,
    updatedAt: now
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


/* =========================
   ACCOUNT TRANSFER
========================= */

async function transferAccount(
  body,
  accounts
) {
  const walkingId =
    normalizeWalkingId(body.walkingId);

  const transferPin = String(
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

  const account = await getAccount(
    accounts,
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

  if (account.transferPin !== transferPin) {
    return json(
      {
        error: "Invalid transfer PIN."
      },
      401
    );
  }

  return json({
    success: true,
    account
  });
}


/* =========================
   START WALK SESSION
========================= */

async function startWalk(
  body,
  accounts,
  walks,
  mode
) {
  const walkingId =
    normalizeWalkingId(body.walkingId);

  if (!walkingId) {
    return json(
      {
        error: "Walking ID is required."
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
        error:
          "Walking account not found."
      },
      404
    );
  }

  const sessionId =
    crypto.randomUUID();

  const now = new Date().toISOString();

  const session = {
    sessionId,
    walkingId,
    mode,
    startedAt: now,
    finishedAt: null,

    distanceKm: 0,

    // Outdoor GPS data
    points: [],
    rejectedPoints: 0,

    // Treadmill data
    totalSteps: 0,
    lastStepUpdateAt: now,
    stepBatches: 0,
    rejectedStepBatches: 0,

    finished: false
  };

  await walks.setJSON(
    `session/${sessionId}`,
    session
  );

  return json({
    success: true,
    sessionId,
    mode
  });
}


/* =========================
   OUTDOOR GPS TRACKING
========================= */

async function addPosition(
  body,
  accounts,
  walks
) {
  const walkingId =
    normalizeWalkingId(body.walkingId);

  const sessionId = String(
    body.sessionId || ""
  );

  const position = body.position;

  if (
    !walkingId ||
    !sessionId ||
    !position
  ) {
    return json(
      {
        error: "Missing walking data."
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
        error:
          "Walking account not found."
      },
      404
    );
  }

  const session = await getSession(
    walks,
    sessionId
  );

  if (!session) {
    return json(
      {
        error: "Walk session not found."
      },
      404
    );
  }

  if (session.walkingId !== walkingId) {
    return json(
      {
        error: "Invalid walking session."
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

  // Never allow GPS distance in a treadmill session.
  if (session.mode === "treadmill") {
    return json(
      {
        error:
          "GPS tracking is not allowed in a treadmill session."
      },
      400
    );
  }

  const latitude =
    Number(position.latitude);

  const longitude =
    Number(position.longitude);

  const accuracy =
    Number(position.accuracy);

  const timestamp =
    Number(position.timestamp);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(timestamp)
  ) {
    return json(
      {
        error: "Invalid GPS data."
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
        error: "Invalid GPS coordinates."
      },
      400
    );
  }

  if (
    !Number.isFinite(accuracy) ||
    accuracy > MIN_ACCURACY_METERS ||
    accuracy < 0
  ) {
    session.rejectedPoints += 1;

    await walks.setJSON(
      `session/${sessionId}`,
      session
    );

    return json({
      success: true,
      distanceKm: session.distanceKm,
      rejected: true,
      reason: "GPS accuracy is too weak."
    });
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
    session.points.push(newPoint);

    await walks.setJSON(
      `session/${sessionId}`,
      session
    );

    return json({
      success: true,
      distanceKm: session.distanceKm,
      rejected: false
    });
  }

  const elapsedSeconds =
    (timestamp - previous.timestamp) / 1000;

  if (
    !Number.isFinite(elapsedSeconds) ||
    elapsedSeconds < MIN_POSITION_INTERVAL_SECONDS
  ) {
    session.rejectedPoints += 1;

    await walks.setJSON(
      `session/${sessionId}`,
      session
    );

    return json({
      success: true,
      distanceKm: session.distanceKm,
      rejected: true,
      reason:
        "GPS updates are arriving too quickly."
    });
  }

  const meters = haversineMeters(
    previous.latitude,
    previous.longitude,
    latitude,
    longitude
  );

  const speedKmh =
    (meters / elapsedSeconds) * 3.6;

  if (
    speedKmh > MAX_WALKING_SPEED_KMH ||
    meters > MAX_POINT_DISTANCE_METERS
  ) {
    session.rejectedPoints += 1;

    await walks.setJSON(
      `session/${sessionId}`,
      session
    );

    return json({
      success: true,
      distanceKm: session.distanceKm,
      rejected: true,
      reason:
        "Movement was too fast or the GPS jump was too large."
    });
  }

  session.points.push(newPoint);

  if (meters >= 3) {
    session.distanceKm += meters / 1000;
  }

  if (session.points.length > 2000) {
    session.points =
      session.points.slice(-1500);
  }

  await walks.setJSON(
    `session/${sessionId}`,
    session
  );

  return json({
    success: true,
    distanceKm: session.distanceKm,
    rejected: false
  });
}


/* =========================
   TREADMILL STEP TRACKING
========================= */

async function addTreadmillSteps(
  body,
  accounts,
  walks
) {
  const walkingId =
    normalizeWalkingId(body.walkingId);

  const sessionId = String(
    body.sessionId || ""
  );

  // This must be the cumulative step count
  // since the treadmill session started.
  const reportedSteps =
    Number(body.steps);

  if (
    !walkingId ||
    !sessionId ||
    !Number.isSafeInteger(reportedSteps) ||
    reportedSteps < 0
  ) {
    return json(
      {
        error: "Invalid treadmill step data."
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
        error: "Walking account not found."
      },
      404
    );
  }

  const session = await getSession(
    walks,
    sessionId
  );

  if (!session) {
    return json(
      {
        error: "Walk session not found."
      },
      404
    );
  }

  if (session.walkingId !== walkingId) {
    return json(
      {
        error: "Invalid walking session."
      },
      403
    );
  }

  if (session.finished) {
    return json(
      {
        error: "This walk has already finished."
      },
      400
    );
  }

  // Do not mix treadmill and GPS tracking.
  if (session.mode !== "treadmill") {
    return json(
      {
        error:
          "This is not a treadmill session."
      },
      400
    );
  }

  const previousSteps =
    Number(session.totalSteps || 0);

  const additionalSteps =
    reportedSteps - previousSteps;

  // Reject duplicate, reset or replayed step counts.
  if (additionalSteps <= 0) {
    return json({
      success: true,
      accepted: false,
      distanceKm: session.distanceKm,
      totalSteps: previousSteps,
      reason:
        "Duplicate or outdated step update."
    });
  }

  if (
    additionalSteps >
    MAX_TREADMILL_BATCH_STEPS
  ) {
    session.rejectedStepBatches += 1;

    await walks.setJSON(
      `session/${sessionId}`,
      session
    );

    return json({
      success: true,
      accepted: false,
      distanceKm: session.distanceKm,
      totalSteps: previousSteps,
      reason:
        "Step update was too large."
    });
  }

  // Use server time, not the phone's timestamp.
  const now = Date.now();

  const lastUpdate = new Date(
    session.lastStepUpdateAt ||
    session.startedAt
  ).getTime();

  const elapsedSeconds =
    (now - lastUpdate) / 1000;

  if (
    !Number.isFinite(elapsedSeconds) ||
    elapsedSeconds <= 0
  ) {
    return json({
      success: true,
      accepted: false,
      distanceKm: session.distanceKm,
      totalSteps: previousSteps,
      reason:
        "Invalid step update timing."
    });
  }

  const stepsPerMinute =
    (additionalSteps / elapsedSeconds) * 60;

  if (
    stepsPerMinute >
    MAX_STEPS_PER_MINUTE
  ) {
    session.rejectedStepBatches += 1;

    await walks.setJSON(
      `session/${sessionId}`,
      session
    );

    return json({
      success: true,
      accepted: false,
      distanceKm: session.distanceKm,
      totalSteps: previousSteps,
      reason:
        "Step rate was too high."
    });
  }

  // Server calculates distance.
  // The client cannot submit its own distance.
  const addedDistanceKm =
    (additionalSteps * METRES_PER_STEP) / 1000;

  session.totalSteps = reportedSteps;

  session.distanceKm += addedDistanceKm;

  session.lastStepUpdateAt =
    new Date(now).toISOString();

  session.stepBatches += 1;

  await walks.setJSON(
    `session/${sessionId}`,
    session
  );

  return json({
    success: true,
    accepted: true,
    totalSteps: session.totalSteps,
    distanceKm: session.distanceKm,
    addedDistanceKm
  });
}


/* =========================
   FINISH WALK
========================= */

async function finishWalk(
  body,
  accounts,
  walks
) {
  const walkingId =
    normalizeWalkingId(body.walkingId);

  const sessionId = String(
    body.sessionId || ""
  );

  if (!walkingId || !sessionId) {
    return json(
      {
        error: "Missing walking data."
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
        error: "Walking account not found."
      },
      404
    );
  }

  const session = await getSession(
    walks,
    sessionId
  );

  if (!session) {
    return json(
      {
        error: "Walk session not found."
      },
      404
    );
  }

  if (session.walkingId !== walkingId) {
    return json(
      {
        error: "Invalid walking session."
      },
      403
    );
  }

  if (session.finished) {
    return json(
      {
        error: "Walk already finished."
      },
      400
    );
  }

  session.finished = true;

  session.finishedAt =
    new Date().toISOString();

  const oldDistance =
    Number(account.totalDistance || 0);

  const sessionDistance =
    Number(session.distanceKm || 0);

  const newDistance =
    oldDistance + sessionDistance;

  // Preserve 1 point per completed kilometre.
  const oldMilestones =
    Math.floor(
      oldDistance / POINTS_PER_KILOMETRE
    );

  const newMilestones =
    Math.floor(
      newDistance / POINTS_PER_KILOMETRE
    );

  const earnedPoints =
    Math.max(
      0,
      newMilestones - oldMilestones
    );

  account.totalDistance = newDistance;

  account.lifetimeDistance =
    Number(account.lifetimeDistance || 0) +
    sessionDistance;

  account.completedWalks =
    Number(account.completedWalks || 0) + 1;

  account.points =
    Number(account.points || 0) +
    earnedPoints;

  account.updatedAt =
    new Date().toISOString();

  await accounts.setJSON(
    `account/${walkingId}`,
    account
  );

  await walks.setJSON(
    `session/${sessionId}`,
    session
  );

  return json({
    success: true,
    mode: session.mode || "outdoor",
    distanceKm: sessionDistance,
    earnedPoints,
    account
  });
}


/* =========================
   REWARD ENTRIES
========================= */

async function createRewardEntry(
  body,
  accounts,
  rewards
) {
  const walkingId =
    normalizeWalkingId(body.walkingId);

  const rewardId = String(
    body.rewardId || ""
  );

  const cost = REWARD_COSTS[rewardId];

  if (!cost) {
    return json(
      {
        error: "Invalid reward."
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
        error: "Walking account not found."
      },
      404
    );
  }

  if (
    Number(account.points || 0) < cost
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

  account.updatedAt =
    new Date().toISOString();

  const entryId =
    crypto.randomUUID();

  const entry = {
    entryId,
    walkingId,
    rewardId,
    cost,
    createdAt: new Date().toISOString(),
    status: "active"
  };

  await rewards.setJSON(
    `entry/${entryId}`,
    entry
  );

  await accounts.setJSON(
    `account/${walkingId}`,
    account
  );

  return json({
    success: true,
    entry,
    account
  });
}


/* =========================
   DATABASE HELPERS
========================= */

async function getAccount(
  accounts,
  walkingId
) {
  if (!walkingId) {
    return null;
  }

  return await accounts.get(
    `account/${walkingId}`,
    { type: "json" }
  );
}


async function getSession(
  walks,
  sessionId
) {
  if (!sessionId) {
    return null;
  }

  return await walks.get(
    `session/${sessionId}`,
    { type: "json" }
  );
}


/* =========================
   GENERAL HELPERS
========================= */

function normalizeWalkingId(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}


function generateWalkingId() {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let result = "WR-";

  for (let i = 0; i < 8; i++) {
    result +=
      alphabet[
        Math.floor(
          Math.random() * alphabet.length
        )
      ];
  }

  return result;
}


function generateTransferPin() {
  return String(
    Math.floor(
      100000 + Math.random() * 900000
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
    (lat2 - lat1) * Math.PI / 180;

  const dLon =
    (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
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


function json(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      }
    }
  );
}
