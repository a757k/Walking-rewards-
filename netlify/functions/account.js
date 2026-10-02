import crypto from "crypto";

const accounts = new Map();

function generateId() {
  return (
    "WR-" +
    crypto
      .randomBytes(5)
      .toString("hex")
      .toUpperCase()
  );
}

function generatePin() {
  return String(
    Math.floor(
      100000 +
      Math.random() * 900000
    )
  );
}

function createAccount() {
  const walkingId = generateId();
  const transferPin = generatePin();

  const account = {
    walkingId,
    transferPin,
    points: 0,
    totalDistance: 0,
    lifetimeDistance: 0,
    completedWalks: 0,
    createdAt: new Date().toISOString()
  };

  accounts.set(
    walkingId,
    account
  );

  return account;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({
        error: "Method not allowed"
      })
    };
  }

  try {
    const body =
      JSON.parse(event.body || "{}");

    if (body.action === "create") {
      const account =
        createAccount();

      return {
        statusCode: 200,
        body: JSON.stringify(account)
      };
    }

    if (body.action === "transfer") {
      const account =
        accounts.get(body.walkingId);

      if (
        !account ||
        account.transferPin !==
          body.transferPin
      ) {
        return {
          statusCode: 401,
          body: JSON.stringify({
            error:
              "Invalid Walking ID or PIN."
          })
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify(account)
      };
    }

    if (body.action === "distance") {
      const account =
        accounts.get(body.walkingId);

      if (!account) {
        return {
          statusCode: 404,
          body: JSON.stringify({
            error:
              "Account not found."
          })
        };
      }

      const distance =
        Number(body.distance || 0);

      const earnedPoints =
        Number(
          body.earnedPoints || 0
        );

      account.totalDistance +=
        distance;

      account.lifetimeDistance +=
        distance;

      account.completedWalks += 1;

      account.points +=
        earnedPoints;

      accounts.set(
        account.walkingId,
        account
      );

      return {
        statusCode: 200,
        body: JSON.stringify(account)
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Unknown action."
      })
    };
  } catch (error) {
    console.error(error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error:
          "Internal server error."
      })
    };
  }
}
