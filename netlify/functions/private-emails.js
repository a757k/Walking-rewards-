
import { getStore } from "@netlify/blobs";

const ADMIN_WALKING_ID = "WR-FB2EDP6K";

export default async function handler(req) {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const accounts = getStore({
      name: "walking-accounts",
      consistency: "strong"
    });

    const privateEmails = getStore({
      name: "walking-private-emails",
      consistency: "strong"
    });

    const body = await req.json();

    switch (body.action) {
      case "saveEmails":
        return await saveEmails(
          body,
          accounts,
          privateEmails
        );

      case "adminListEmails":
        return await adminListEmails(
          body,
          privateEmails
        );

      case "adminGetEmail":
        return await adminGetEmail(
          body,
          privateEmails
        );

      default:
        return json({ error: "Unknown action." }, 400);
    }
  } catch (error) {
    console.error("Private email error:", error);

    return json(
      { error: "Server error. Please try again." },
      500
    );
  }
}


/* =========================
   SAVE USER EMAILS
========================= */

async function saveEmails(
  body,
  accounts,
  privateEmails
) {
  const walkingId = normalizeWalkingId(
    body.walkingId
  );

  const transferPin = String(
    body.transferPin || ""
  ).trim();

  const email = normalizeEmail(body.email);
  const paypalEmail = normalizeEmail(
    body.paypalEmail
  );

  if (
    !walkingId ||
    !transferPin ||
    !isValidEmail(email) ||
    !isValidEmail(paypalEmail)
  ) {
    return json({
      error: "Enter a valid normal email and PayPal email."
    }, 400);
  }

  const account = await accounts.get(
    `account/${walkingId}`,
    { type: "json" }
  );

  if (!account || account.transferPin !== transferPin) {
    return json({
      error: "Invalid Walking ID or transfer PIN."
    }, 401);
  }

  const record = {
    walkingId,
    email,
    paypalEmail,
    updatedAt: new Date().toISOString()
  };

  await privateEmails.setJSON(
    `email/${walkingId}`,
    record
  );

  return json({
    success: true,
    message: "Email details saved."
  });
}


/* =========================
   ADMIN AUTHENTICATION
========================= */

function authenticateAdmin(body) {
  const configuredPassword =
    process.env.ADMIN_PASSWORD;

  if (!configuredPassword) {
    return false;
  }

  return (
    normalizeWalkingId(body.adminWalkingId) ===
      ADMIN_WALKING_ID &&
    String(body.adminPassword || "") ===
      configuredPassword
  );
}


/* =========================
   ADMIN: VIEW ALL EMAILS
========================= */

async function adminListEmails(
  body,
  privateEmails
) {
  if (!authenticateAdmin(body)) {
    return json({
      error: "Administrator authentication failed."
    }, 401);
  }

  const result = await privateEmails.list({
    prefix: "email/"
  });

  const records = [];

  for (const item of result.blobs || []) {
    const record = await privateEmails.get(
      item.key,
      { type: "json" }
    );

    if (record) {
      records.push(record);
    }
  }

  return json({
    success: true,
    emails: records
  });
}


/* =========================
   ADMIN: VIEW ONE USER
========================= */

async function adminGetEmail(
  body,
  privateEmails
) {
  if (!authenticateAdmin(body)) {
    return json({
      error: "Administrator authentication failed."
    }, 401);
  }

  const walkingId = normalizeWalkingId(
    body.walkingId
  );

  if (!walkingId) {
    return json({
      error: "Walking ID is required."
    }, 400);
  }

  const record = await privateEmails.get(
    `email/${walkingId}`,
    { type: "json" }
  );

  if (!record) {
    return json({
      error: "Email record not found."
    }, 404);
  }

  return json({
    success: true,
    record
  });
}


/* =========================
   HELPERS
========================= */

function normalizeWalkingId(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}


function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}


function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
