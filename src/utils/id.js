export function generateWalkingId() {
  const letters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ";

  let result = "WR-";

  for (let i = 0; i < 8; i++) {
    result +=
      letters[
        Math.floor(
          Math.random() *
          letters.length
        )
      ];
  }

  return result;
}

export function generateTransferPin() {
  return String(
    Math.floor(
      100000 +
      Math.random() * 900000
    )
  );
}
