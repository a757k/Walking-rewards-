export function calculateDistance(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const R = 6371;

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
      lat1 * Math.PI / 180
    ) *
    Math.cos(
      lat2 * Math.PI / 180
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

export function isWalkingSpeed(
  speedKmh
) {
  if (
    speedKmh === null ||
    speedKmh === undefined
  ) {
    return true;
  }

  return (
    speedKmh >= 0 &&
    speedKmh <= 12
  );
}

export function calculatePoints(
  oldDistance,
  newDistance
) {
  const oldMilestones =
    Math.floor(
      Number(oldDistance) / 5
    );

  const newMilestones =
    Math.floor(
      Number(newDistance) / 5
    );

  return Math.max(
    0,
    newMilestones -
      oldMilestones
  );
}
