export function startMotionTracking(
  callback
) {
  if (
    typeof window === "undefined" ||
    !("DeviceMotionEvent" in window)
  ) {
    return () => {};
  }

  let stepCount = 0;
  let lastAcceleration = 0;
  let lastStepTime = 0;

  function handleMotion(event) {
    const acceleration =
      event.accelerationIncludingGravity;

    if (!acceleration) {
      return;
    }

    const x = acceleration.x || 0;
    const y = acceleration.y || 0;
    const z = acceleration.z || 0;

    const magnitude =
      Math.sqrt(
        x * x +
        y * y +
        z * z
      );

    const difference =
      Math.abs(
        magnitude -
        lastAcceleration
      );

    const now = Date.now();

    /*
      Basic step detection.
      It is deliberately conservative and is not
      intended to replace HealthKit/Health Connect.
    */

    if (
      difference > 1.4 &&
      now - lastStepTime > 350
    ) {
      stepCount++;
      lastStepTime = now;

      callback({
        steps: stepCount
      });
    }

    lastAcceleration = magnitude;
  }

  window.addEventListener(
    "devicemotion",
    handleMotion
  );

  return () => {
    window.removeEventListener(
      "devicemotion",
      handleMotion
    );
  };
}

export function stopMotionTracking(
  cleanup
) {
  if (typeof cleanup === "function") {
    cleanup();
  }
}
