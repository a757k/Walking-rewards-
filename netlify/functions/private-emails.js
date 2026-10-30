
import { getStore } from "@netlify/blobs";

const ADMIN_WALKING_ID = "WR-FB2EDP6K";
const ADMIN_TRANSFER_PIN = "538623";

function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(data)
  };
}

function normalizeId(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function verifyAdmin(body) {
  return (
    normalizeId(body.adminWalkingId) === ADMIN_WALKING_ID &&
    String(body.adminTransferPin || "") === ADMIN_TRANSFER_PIN
  );
}

export default async function handler(event) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const accounts = getStore({
      name: "walking-accounts",
      consistency: "strong"
    });

    const privateEmails = getStore({
      name: "walking-private-emails",
      consistency: "strong"
    });

    // SAVE A USER'S EMAIL DETAILS
    if (body.action === "saveEmails") {
      const walkingId = normalizeId(body.walkingId);
      const transferPin = String(body.transferPin || "");
      const email = normalizeEmail(body.email);
      const paypalEmail = normalizeEmail(body.paypalEmail);

      if (!walkingId || !transferPin || !email || !paypalEmail) {
        return jsonResponse(400, {
          error: "Please provide your Walking ID, Transfer PIN and both email addresses."
        });
      }

      if (!validEmail(email) || !validEmail(paypalEmail)) {
        return jsonResponse(400, {
          error: "Please enter valid email addresses."
        });
      }

      const account = await accounts.get(walkingId, {
        type: "json"
      });

      if (!account) {
        return jsonResponse(404, {
          error: "Account not found."
        });
      }

      if (String(account.transferPin || "") !== transferPin) {
        return jsonResponse(401, {
          error: "Incorrect Transfer PIN."
        });
      }

      await privateEmails.setJSON(`email/${walkingId}`, {
        walkingId,
        email,
        paypalEmail,
        updatedAt: new Date().toISOString()
      });

      return jsonResponse(200, {
        success: true,
        message: "Email details saved."
      });
    }

    // ADMIN: VIEW ALL EMAIL DETAILS
    if (body.action === "adminListEmails") {
      if (!(await verifyAdmin(body))) {
        return jsonResponse(401, {
          error: "Admin authentication failed."
        });
      }

      const result = await privateEmails.list({
        prefix: "email/"
      });

      const records = [];

      for (const item of result.blobs || []) {
        const record = await privateEmails.get(item.key, {
          type: "json"
        });

        if (record) records.push(record);
      }

      return jsonResponse(200, {
        success: true,
        emails: records
      });
    }

    // ADMIN: VIEW ONE USER'S EMAIL DETAILS
    if (body.action === "adminGetEmail") {
      if (!(await verifyAdmin(body))) {
        return jsonResponse(401, {
          error: "Admin authentication failed."
        });
      }

      const walkingId = normalizeId(body.walkingId);

      if (!walkingId) {
        return jsonResponse(400, {
          error: "Walking ID is required."
        });
      }

      const record = await privateEmails.get(`email/${walkingId}`, {
        type: "json"
      });

      if (!record) {
        return jsonResponse(404, {
          error: "No email details found for this account."
        });
      }

      return jsonResponse(200, {
        success: true,
        email: record
      });
    }

    return jsonResponse(400, {
      error: "Unknown action."
    });

  } catch (error) {
    console.error("Private emails function error:", error);

    return jsonResponse(500, {
      error: "A server error occurred."
    });
  }
}
