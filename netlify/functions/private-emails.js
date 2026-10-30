
import { getStore } from "@netlify/blobs";

const ADMIN_WALKING_ID = "WR-FB2EDP6K";

export default async function handler(req) {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const body = await req.json();

    const accounts = getStore({
      name: "walking-accounts",
      consistency: "strong"
    });

    const privateEmails = getStore({
      name: "walking-private-emails",
      consistency: "strong"
    });

    // SAVE USER EMAIL DETAILS
    if (body.action === "saveEmails") {
      const walkingId = normalizeId(body.walkingId);
      const transferPin = String(body.transferPin || "");
      const email = normalizeEmail(body.email);
      const paypalEmail = normalizeEmail(body.paypalEmail);

      if (!walkingId || !transferPin || !email || !paypalEmail) {
        return json({
          error: "Please provide your Walking ID, PIN and both email addresses."
        }, 400);
      }

      if (!validEmail(email) || !validEmail(paypalEmail)) {
        return json({
          error: "Please enter valid email addresses."
        }, 400);
      }

      const account = await accounts.get(
        `account/${walkingId}`,
        { type: "json" }
      );

      if (!account) {
        return json({ error: "Account not found." }, 404);
      }

      if (String(account.transferPin) !== transferPin) {
        return json({ error: "Incorrect Transfer PIN." }, 401);
      }

      await privateEmails.setJSON(`email/${walkingId}`, {
        walkingId,
        email,
        paypalEmail,
        updatedAt: new Date().toISOString()
      });

      return json({
        success: true,
        message: "Email details saved successfully."
      });
    }

    // ADMIN: LIST ALL EMAIL RECORDS
    if (body.action === "adminListEmails") {
      const authorized = await verifyAdmin(body, accounts);

      if (!authorized) {
        return json({ error: "Admin authentication failed." }, 401);
      }

      const result = await privateEmails.list({
        prefix: "email/"
      });

      const records = [];

      for (const item of result.blobs || []) {
        const record = await privateEmails.get(item.key, {
          type: "json"
        });

        if (record) {
          records.push(record);
        }
      }

      records.sort((a, b) =>
        String(a.walkingId).localeCompare(String(b.walkingId))
      );

      return json({
        success: true,
        emails: records
      });
    }

    // ADMIN: GET ONE USER'S EMAIL RECORD
    if (body.action === "adminGetEmail") {
      const authorized = await verifyAdmin(body, accounts);

      if (!authorized) {
        return json({ error: "Admin authentication failed." }, 401);
      }

      const walkingId = normalizeId(body.walkingId);

      if (!walkingId) {
        return json({ error: "Walking ID is required." }, 400);
      }

      const record = await privateEmails.get(
        `email/${walkingId}`,
        { type: "json" }
      );

      if (!record) {
        return json({
          error: "No email details found for this account."
        }, 404);
      }

      return json({
        success: true,
        email: record
      });
    }

    return json({ error: "Unknown action." }, 400);

  } catch (error) {
    console.error("Private emails error:", error);

    return json({
      error: "Server error. Please try again."
    }, 500);
  }
}


// VERIFY ADMIN USING THE EXISTING ACCOUNT'S TRANSFER PIN
async function verifyAdmin(body, accounts) {
  const walkingId = normalizeId(body.adminWalkingId);
  const transferPin = String(body.adminTransferPin || "");

  if (walkingId !== ADMIN_WALKING_ID || !transferPin) {
    return false;
  }

  const adminAccount = await accounts.get(
    `account/${ADMIN_WALKING_ID}`,
    { type: "json" }
  );

  if (!adminAccount) {
    return false;
  }

  return String(adminAccount.transferPin) === transferPin;
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
