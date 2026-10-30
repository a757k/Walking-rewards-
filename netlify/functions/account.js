
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const ADMIN_WALKING_ID = "WR-FB2EDP6K";

const MAX_WALKING_SPEED_KMH = 12;
const MIN_ACCURACY_METERS = 60;
const MAX_POINT_DISTANCE_METERS = 150;
const MIN_POSITION_INTERVAL_SECONDS = 2;

const METRES_PER_STEP = 0.75;
const MAX_STEPS_PER_MINUTE = 220;
const MAX_TREADMILL_BATCH_STEPS = 500;

export default async function handler(req) {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
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

    const privateEmails = getStore({
      name: "walking-private-emails",
      consistency: "strong"
    });

    const body = await req.json();

    switch (body.action) {
      case "create":
      case "createAccount":
        return await createAccount(body, accounts);

      case "transfer":
      case "transferAccount":
        return await transferAccount(body, accounts);

      case "startWalk":
        return await startWalk(body, accounts, walks, "outdoor");

      case "startTreadmill":
        return await startWalk(body, accounts, walks, "treadmill");

      case "position":
        return await addPosition(body, accounts, walks);

      case "treadmillSteps":
        return await addTreadmillSteps(body, accounts, walks);

      case "finishWalk":
        return await finishWalk(body, accounts, walks);

      case "listRewards":
        return await listRewards(rewards, accounts);

      case "enterReward":
      case "reward":
        return await enterReward(body, accounts, rewards);

      case "adminListRewards":
        await requireAdmin(body, accounts);
        return await adminListRewards(rewards, accounts);

      case "adminCreateReward":
        await requireAdmin(body, accounts);
        return await adminCreateReward(body, rewards);

      case "adminUpdateReward":
        await requireAdmin(body, accounts);
        return await adminUpdateReward(body, rewards);

      case "adminDeleteReward":
        await requireAdmin(body, accounts);
        return await adminDeleteReward(body, rewards);

      case "adminApproveAward":
        await requireAdmin(body, accounts);
        return await adminApproveAward(body, rewards);

      case "adminMarkAwardSent":
        await requireAdmin(body, accounts);
        return await adminMarkAwardSent(body, rewards);

      default:
        return json({ error: "Unknown action." }, 400);
    }
  } catch (error) {
    console.error("Walking Rewards error:", error);

    return json(
      {
        error:
          error.message === "Admin authentication failed."
            ? error.message
            : "Server error. Please try again."
      },
      error.message === "Admin authentication failed." ? 401 : 500
    );
  }
}


/* ADMIN SECURITY */

async function requireAdmin(body, accounts) {
  const suppliedId = normalizeWalkingId(body.adminWalkingId);
  const suppliedPin = String(body.adminTransferPin || "").trim();

  if (suppliedId !== ADMIN_WALKING_ID || !suppliedPin) {
    throw new Error("Admin authentication failed.");
  }

  const adminAccount = await getAccount(accounts, ADMIN_WALKING_ID);

  if (!adminAccount || adminAccount.transferPin !== suppliedPin) {
    throw new Error("Admin authentication failed.");
  }
}


/* ACCOUNT CREATION */

async function createAccount(body, accounts) {
  let walkingId;
  let existingAccount;

  do {
    walkingId = generateWalkingId();
    existingAccount = await getAccount(accounts, walkingId);
  } while (existingAccount);

  const now = new Date().toISOString();

  const account = {
    walkingId,
    transferPin: generateTransferPin(),
    points: 0,
    totalDistance: 0,
    lifetimeDistance: 0,
    completedWalks: 0,
    createdAt: now,
    updatedAt: now
  };

  await accounts.setJSON(`account/${walkingId}`, account);

  return json({ success: true, account });
}


async function transferAccount(body, accounts) {
  const walkingId = normalizeWalkingId(body.walkingId);
  const transferPin = String(body.transferPin || "").trim();

  if (!walkingId || !transferPin) {
    return json({ error: "Walking ID and PIN are required." }, 400);
  }

  const account = await getAccount(accounts, walkingId);

  if (!account) {
    return json({ error: "Walking account not found." }, 404);
  }

  if (account.transferPin !== transferPin) {
    return json({ error: "Invalid transfer PIN." }, 401);
  }

  return json({ success: true, account });
}


/* WALK SESSION */

async function startWalk(body, accounts, walks, mode) {
  const walkingId = normalizeWalkingId(body.walkingId);
  const account = await getAccount(accounts, walkingId);

  if (!account) {
    return json({ error: "Walking account not found." }, 404);
  }

  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();

  const session = {
    sessionId,
    walkingId,
    mode,
    startedAt: now,
    finishedAt: null,
    distanceKm: 0,
    points: [],
    rejectedPoints: 0,
    totalSteps: 0,
    lastStepUpdateAt: now,
    stepBatches: 0,
    rejectedStepBatches: 0,
    finished: false
  };

  await walks.setJSON(`session/${sessionId}`, session);

  return json({ success: true, sessionId, mode });
}


/* OUTDOOR GPS */

async function addPosition(body, accounts, walks) {
  const walkingId = normalizeWalkingId(body.walkingId);
  const sessionId = String(body.sessionId || "");
  const position = body.position;

  if (!walkingId || !sessionId || !position) {
    return json({ error: "Missing walking data." }, 400);
  }

  const account = await getAccount(accounts, walkingId);

  if (!account) {
    return json({ error: "Walking account not found." }, 404);
  }

  const session = await getSession(walks, sessionId);

  if (!session || session.walkingId !== walkingId) {
    return json({ error: "Invalid walking session." }, 404);
  }

  if (session.finished) {
    return json({ error: "This walk has already finished." }, 400);
  }

  if (session.mode === "treadmill") {
    return json({ error: "GPS is not allowed in a treadmill session." }, 400);
  }

  const latitude = Number(position.latitude);
  const longitude = Number(position.longitude);
  const accuracy = Number(position.accuracy);
  const timestamp = Number(position.timestamp);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(timestamp) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return json({ error: "Invalid GPS data." }, 400);
  }

  if (
    !Number.isFinite(accuracy) ||
    accuracy < 0 ||
    accuracy > MIN_ACCURACY_METERS
  ) {
    session.rejectedPoints += 1;
    await saveSession(walks, session);

    return json({
      success: true,
      distanceKm: session.distanceKm,
      rejected: true,
      reason: "GPS accuracy is too weak."
    });
  }

  const newPoint = { latitude, longitude, accuracy, timestamp };
  const previous = session.points[session.points.length - 1];

  if (!previous) {
    session.points.push(newPoint);
    await saveSession(walks, session);

    return json({
      success: true,
      distanceKm: session.distanceKm,
      rejected: false
    });
  }

  const elapsedSeconds = (timestamp - previous.timestamp) / 1000;

  if (
    !Number.isFinite(elapsedSeconds) ||
    elapsedSeconds < MIN_POSITION_INTERVAL_SECONDS
  ) {
    session.rejectedPoints += 1;
    await saveSession(walks, session);

    return json({
      success: true,
      distanceKm: session.distanceKm,
      rejected: true,
      reason: "GPS updates are arriving too quickly."
    });
  }

  const meters = haversineMeters(
    previous.latitude,
    previous.longitude,
    latitude,
    longitude
  );

  const speedKmh = (meters / elapsedSeconds) * 3.6;

  if (
    speedKmh > MAX_WALKING_SPEED_KMH ||
    meters > MAX_POINT_DISTANCE_METERS
  ) {
    session.rejectedPoints += 1;
    await saveSession(walks, session);

    return json({
      success: true,
      distanceKm: session.distanceKm,
      rejected: true,
      reason: "Movement was too fast or the GPS jump was too large."
    });
  }

  session.points.push(newPoint);

  if (meters >= 3) {
    session.distanceKm += meters / 1000;
  }

  if (session.points.length > 2000) {
    session.points = session.points.slice(-1500);
  }

  await saveSession(walks, session);

  return json({
    success: true,
    distanceKm: session.distanceKm,
    rejected: false
  });
}


/* TREADMILL STEPS */

async function addTreadmillSteps(body, accounts, walks) {
  const walkingId = normalizeWalkingId(body.walkingId);
  const sessionId = String(body.sessionId || "");
  const reportedSteps = Number(body.steps);

  if (
    !walkingId ||
    !sessionId ||
    !Number.isSafeInteger(reportedSteps) ||
    reportedSteps < 0
  ) {
    return json({ error: "Invalid treadmill step data." }, 400);
  }

  const account = await getAccount(accounts, walkingId);

  if (!account) {
    return json({ error: "Walking account not found." }, 404);
  }

  const session = await getSession(walks, sessionId);

  if (!session || session.walkingId !== walkingId) {
    return json({ error: "Invalid walking session." }, 404);
  }

  if (session.finished) {
    return json({ error: "This walk has already finished." }, 400);
  }

  if (session.mode !== "treadmill") {
    return json({ error: "This is not a treadmill session." }, 400);
  }

  const previousSteps = Number(session.totalSteps || 0);
  const additionalSteps = reportedSteps - previousSteps;

  if (additionalSteps <= 0) {
    return json({
      success: true,
      accepted: false,
      distanceKm: session.distanceKm,
      totalSteps: previousSteps,
      reason: "Duplicate or outdated step update."
    });
  }

  if (additionalSteps > MAX_TREADMILL_BATCH_STEPS) {
    session.rejectedStepBatches += 1;
    await saveSession(walks, session);

    return json({
      success: true,
      accepted: false,
      distanceKm: session.distanceKm,
      totalSteps: previousSteps,
      reason: "Step update was too large."
    });
  }

  const now = Date.now();
  const lastUpdate = new Date(
    session.lastStepUpdateAt || session.startedAt
  ).getTime();

  const elapsedSeconds = (now - lastUpdate) / 1000;

  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) {
    return json({
      success: true,
      accepted: false,
      distanceKm: session.distanceKm,
      totalSteps: previousSteps,
      reason: "Invalid step update timing."
    });
  }

  const stepsPerMinute = (additionalSteps / elapsedSeconds) * 60;

  if (stepsPerMinute > MAX_STEPS_PER_MINUTE) {
    session.rejectedStepBatches += 1;
    await saveSession(walks, session);

    return json({
      success: true,
      accepted: false,
      distanceKm: session.distanceKm,
      totalSteps: previousSteps,
      reason: "Step rate was too high."
    });
  }

  const addedDistanceKm = (additionalSteps * METRES_PER_STEP) / 1000;

  session.totalSteps = reportedSteps;
  session.distanceKm += addedDistanceKm;
  session.lastStepUpdateAt = new Date(now).toISOString();
  session.stepBatches += 1;

  await saveSession(walks, session);

  return json({
    success: true,
    accepted: true,
    totalSteps: session.totalSteps,
    distanceKm: session.distanceKm,
    addedDistanceKm
  });
}


/* FINISH WALK */

async function finishWalk(body, accounts, walks) {
  const walkingId = normalizeWalkingId(body.walkingId);
  const sessionId = String(body.sessionId || "");

  const account = await getAccount(accounts, walkingId);

  if (!account) {
    return json({ error: "Walking account not found." }, 404);
  }

  const session = await getSession(walks, sessionId);

  if (!session || session.walkingId !== walkingId) {
    return json({ error: "Invalid walking session." }, 404);
  }

  if (session.finished) {
    return json({ error: "Walk already finished." }, 400);
  }

  session.finished = true;
  session.finishedAt = new Date().toISOString();

  const oldDistance = Number(account.totalDistance || 0);
  const sessionDistance = Number(session.distanceKm || 0);
  const newDistance = oldDistance + sessionDistance;

  const oldMilestones = Math.floor(oldDistance);
  const newMilestones = Math.floor(newDistance);

  const earnedPoints = Math.max(0, newMilestones - oldMilestones);

  account.totalDistance = newDistance;
  account.lifetimeDistance =
    Number(account.lifetimeDistance || 0) + sessionDistance;
  account.completedWalks =
    Number(account.completedWalks || 0) + 1;
  account.points = Number(account.points || 0) + earnedPoints;
  account.updatedAt = new Date().toISOString();

  await accounts.setJSON(`account/${walkingId}`, account);
  await saveSession(walks, session);

  return json({
    success: true,
    mode: session.mode || "outdoor",
    distanceKm: sessionDistance,
    earnedPoints,
    account
  });
}


/* PUBLIC REWARDS */

async function listRewards(rewards, accounts) {
  const allRewards = await getAllRewards(rewards);

  for (const reward of allRewards) {
    await drawIfExpired(reward, rewards, accounts);
  }

  const refreshed = await getAllRewards(rewards);

  const publicRewards = refreshed
    .filter(reward => reward.status === "active")
    .map(reward => ({
      rewardId: reward.rewardId,
      title: reward.title,
      type: reward.type,
      description: reward.description,
      prizeValue: reward.prizeValue,
      image: reward.image || "",
      expiresAt: reward.expiresAt,
      entryCost: reward.entryCost,
      eligibility: reward.eligibility,
      winnersCount: reward.winnersCount,
      entryCount: (reward.entries || []).length,
      status: reward.status
    }));

  return json({ success: true, rewards: publicRewards });
}


async function enterReward(body, accounts, rewards) {
  const walkingId = normalizeWalkingId(body.walkingId);
  const rewardId = String(body.rewardId || "");

  if (!walkingId || !rewardId) {
    return json({ error: "Missing reward information." }, 400);
  }

  const account = await getAccount(accounts, walkingId);

  if (!account) {
    return json({ error: "Walking account not found." }, 404);
  }

  const reward = await rewards.get(`reward/${rewardId}`, { type: "json" });

  if (!reward) {
    return json({ error: "Reward not found." }, 404);
  }

  await drawIfExpired(reward, rewards, accounts);

  const refreshedReward = await rewards.get(
    `reward/${rewardId}`,
    { type: "json" }
  );

  if (!refreshedReward || refreshedReward.status !== "active") {
    return json({
      error: "This reward is no longer accepting entries."
    }, 400);
  }

  const cost = Number(refreshedReward.entryCost || 0);

  if (!Number.isSafeInteger(cost) || cost < 0) {
    return json({ error: "Invalid reward entry cost." }, 400);
  }

  if (Number(account.points || 0) < cost) {
    return json({ error: "You do not have enough points." }, 400);
  }

  const entry = {
    entryId: crypto.randomUUID(),
    walkingId,
    createdAt: new Date().toISOString()
  };

  refreshedReward.entries = refreshedReward.entries || [];
  refreshedReward.entries.push(entry);

  account.points = Number(account.points || 0) - cost;
  account.updatedAt = new Date().toISOString();

  await rewards.setJSON(`reward/${rewardId}`, refreshedReward);
  await accounts.setJSON(`account/${walkingId}`, account);

  return json({ success: true, entry, account });
}


/* ADMIN: LIST REWARDS */

async function adminListRewards(rewards, accounts) {
  const allRewards = await getAllRewards(rewards);

  for (const reward of allRewards) {
    await drawIfExpired(reward, rewards, accounts);
  }

  const refreshed = await getAllRewards(rewards);

  return json({ success: true, rewards: refreshed });
}


/* ADMIN: CREATE REWARD */

async function adminCreateReward(body, rewards) {
  const title = String(body.title || "").trim();
  const type = String(body.type || "").trim().toLowerCase();
  const description = String(body.description || "").trim();
  const expiresAt = String(body.expiresAt || "");
  const prizeValue = String(body.prizeValue || "").trim();
  const eligibility = String(body.eligibility || "").trim();
  const image = String(body.image || "").trim();

  const allowedTypes = ["cash", "gift-card", "voucher", "physical", "other"];

  if (!title || !description || !expiresAt || !allowedTypes.includes(type)) {
    return json({ error: "Complete the reward details correctly." }, 400);
  }

  const expiryTime = new Date(expiresAt).getTime();

  if (!Number.isFinite(expiryTime) || expiryTime <= Date.now()) {
    return json({ error: "Expiry must be a future date and time." }, 400);
  }

  const entryCost = Number(body.entryCost ?? 0);
  const winnersCount = Number(body.winnersCount ?? 1);

  if (
    !Number.isSafeInteger(entryCost) ||
    entryCost < 1 ||
    !Number.isSafeInteger(winnersCount) ||
    winnersCount < 1 ||
    winnersCount > 20
  ) {
    return json({ error: "Invalid entry cost or winner count." }, 400);
  }

  const rewardId = crypto.randomUUID();

  const reward = {
    rewardId,
    title,
    type,
    description,
    prizeValue,
    eligibility,
    image,
    expiresAt: new Date(expiryTime).toISOString(),
    entryCost,
    winnersCount,
    entries: [],
    winners: [],
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await rewards.setJSON(`reward/${rewardId}`, reward);

  return json({ success: true, reward });
}


/* ADMIN: UPDATE REWARD */

async function adminUpdateReward(body, rewards) {
  const rewardId = String(body.rewardId || "");

  const reward = await rewards.get(`reward/${rewardId}`, { type: "json" });

  if (!reward) {
    return json({ error: "Reward not found." }, 404);
  }

  if (reward.status !== "active") {
    return json({ error: "Only active rewards can be edited." }, 400);
  }

  if ((reward.entries || []).length > 0) {
    return json({
      error: "This reward already has entries and cannot be edited."
    }, 400);
  }

  const editableFields = [
    "title",
    "type",
    "description",
    "prizeValue",
    "eligibility",
    "image"
  ];

  for (const field of editableFields) {
    if (body[field] !== undefined) {
      reward[field] = String(body[field]).trim();
    }
  }

  if (body.entryCost !== undefined) {
    const cost = Number(body.entryCost);

    if (!Number.isSafeInteger(cost) || cost < 1) {
      return json({ error: "Invalid entry cost." }, 400);
    }

    reward.entryCost = cost;
  }

  if (body.winnersCount !== undefined) {
    const count = Number(body.winnersCount);

    if (!Number.isSafeInteger(count) || count < 1 || count > 20) {
      return json({ error: "Invalid winner count." }, 400);
    }

    reward.winnersCount = count;
  }

  if (body.expiresAt !== undefined) {
    const expiry = new Date(body.expiresAt).getTime();

    if (!Number.isFinite(expiry) || expiry <= Date.now()) {
      return json({ error: "Expiry must be a future date and time." }, 400);
    }

    reward.expiresAt = new Date(expiry).toISOString();
  }

  reward.updatedAt = new Date().toISOString();

  await rewards.setJSON(`reward/${rewardId}`, reward);

  return json({ success: true, reward });
}


/* ADMIN: DELETE REWARD */

async function adminDeleteReward(body, rewards) {
  const rewardId = String(body.rewardId || "");

  const reward = await rewards.get(`reward/${rewardId}`, { type: "json" });

  if (!reward) {
    return json({ error: "Reward not found." }, 404);
  }

  if ((reward.entries || []).length > 0 || reward.winners?.length) {
    return json({
      error: "Rewards with entries or winners cannot be deleted."
    }, 400);
  }

  await rewards.delete(`reward/${rewardId}`);

  return json({ success: true });
}


/* RANDOM DRAW */

async function drawIfExpired(reward, rewards, accounts) {
  if (
    !reward ||
    reward.status !== "active" ||
    Date.now() < new Date(reward.expiresAt).getTime()
  ) {
    return;
  }

  const entries = reward.entries || [];

  if (entries.length === 0) {
    reward.status = "expired-no-entries";
    reward.drawnAt = new Date().toISOString();

    await rewards.setJSON(`reward/${reward.rewardId}`, reward);
    return;
  }

  const shuffled = [...entries];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const winnerCount = Math.min(
    Number(reward.winnersCount || 1),
    shuffled.length
  );

  const selected = shuffled.slice(0, winnerCount);

  const privateEmails = getStore({
    name: "walking-private-emails",
    consistency: "strong"
  });

  const winners = [];

  for (const selectedEntry of selected) {
    const emailRecord = await privateEmails.get(
      `email/${selectedEntry.walkingId}`,
      { type: "json" }
    );

    winners.push({
      walkingId: selectedEntry.walkingId,
      email: emailRecord?.email || "",
      paypalEmail: emailRecord?.paypalEmail || "",
      status: "pending-approval",
      approvedAt: null,
      sentAt: null,
      selectedAt: new Date().toISOString()
    });
  }

  reward.winners = winners;
  reward.status = "draw-completed";
  reward.drawnAt = new Date().toISOString();

  await rewards.setJSON(`reward/${reward.rewardId}`, reward);
}


/* ADMIN: APPROVE WINNER */

async function adminApproveAward(body, rewards) {
  const rewardId = String(body.rewardId || "");
  const walkingId = normalizeWalkingId(body.walkingId);

  const reward = await rewards.get(`reward/${rewardId}`, { type: "json" });

  if (!reward) {
    return json({ error: "Reward not found." }, 404);
  }

  const winner = (reward.winners || []).find(
    item => item.walkingId === walkingId
  );

  if (!winner) {
    return json({ error: "Winner not found." }, 404);
  }

  if (winner.status !== "pending-approval") {
    return json({ error: "This award is not awaiting approval." }, 400);
  }

  winner.status = "approved";
  winner.approvedAt = new Date().toISOString();

  await rewards.setJSON(`reward/${rewardId}`, reward);

  return json({ success: true, reward });
}


/* ADMIN: MARK AWARD SENT */

async function adminMarkAwardSent(body, rewards) {
  const rewardId = String(body.rewardId || "");
  const walkingId = normalizeWalkingId(body.walkingId);
  const reference = String(body.paymentReference || "").trim();

  const reward = await rewards.get(`reward/${rewardId}`, { type: "json" });

  if (!reward) {
    return json({ error: "Reward not found." }, 404);
  }

  const winner = (reward.winners || []).find(
    item => item.walkingId === walkingId
  );

  if (!winner) {
    return json({ error: "Winner not found." }, 404);
  }

  if (winner.status !== "approved") {
    return json({ error: "Approve this award before marking it sent." }, 400);
  }

  winner.status = "sent";
  winner.sentAt = new Date().toISOString();
  winner.paymentReference = reference;

  if (reward.winners.every(item => item.status === "sent")) {
    reward.status = "completed";
  }

  await rewards.setJSON(`reward/${rewardId}`, reward);

  return json({ success: true, reward });
}


/* STORAGE HELPERS */

async function getAllRewards(rewards) {
  const result = await rewards.list({ prefix: "reward/" });
  const items = [];

  for (const blob of result.blobs || []) {
    const reward = await rewards.get(blob.key, { type: "json" });
    if (reward) items.push(reward);
  }

  return items;
}


async function getAccount(accounts, walkingId) {
  if (!walkingId) return null;

  return await accounts.get(`account/${walkingId}`, { type: "json" });
}


async function getSession(walks, sessionId) {
  if (!sessionId) return null;

  return await walks.get(`session/${sessionId}`, { type: "json" });
}


async function saveSession(walks, session) {
  await walks.setJSON(`session/${session.sessionId}`, session);
}


/* GENERAL HELPERS */

function normalizeWalkingId(value) {
  return String(value || "").trim().toUpperCase();
}


function generateWalkingId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "WR-";

  for (let i = 0; i < 8; i++) {
    result += alphabet[crypto.randomInt(0, alphabet.length)];
  }

  return result;
}


function generateTransferPin() {
  return String(crypto.randomInt(100000, 1000000));
}


function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;

  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}
