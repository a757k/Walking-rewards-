import { useEffect, useRef, useState } from "react";
import { startGPS, stopGPS } from "../utils/gps";
import { startMotionTracking, stopMotionTracking } from "../utils/motion";
import { getAccount, saveAccount } from "../utils/storage";
import { addDistance } from "../utils/api";

export default function Walk({ account, updateAccount }) {
  const [running, setRunning] = useState(false);
  const [distance, setDistance] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [steps, setSteps] = useState(0);
  const [status, setStatus] = useState(
    "Ready to start"
  );
  const [gpsAccuracy, setGpsAccuracy] = useState(null);

  const gpsCleanup = useRef(null);
  const motionCleanup = useRef(null);
  const startTime = useRef(null);
  const lastPosition = useRef(null);
  const verifiedDistance = useRef(0);
  const lastStepCount = useRef(0);

  useEffect(() => {
    return () => {
      stopEverything();
    };
  }, []);

  function stopEverything() {
    if (gpsCleanup.current) {
      gpsCleanup.current();
      gpsCleanup.current = null;
    }

    if (motionCleanup.current) {
      motionCleanup.current();
      motionCleanup.current = null;
    }
  }

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;

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

  function beginWalk() {
    if (!navigator.geolocation) {
      setStatus("GPS is not supported on this device.");
      return;
    }

    setRunning(true);
    setDistance(0);
    setSteps(0);
    setSpeed(0);
    setStatus("Getting GPS location...");

    startTime.current = Date.now();
    lastPosition.current = null;
    verifiedDistance.current = 0;

    gpsCleanup.current = startGPS(
      (position) => {
        const {
          latitude,
          longitude,
          accuracy,
          speed: gpsSpeed
        } = position.coords;

        setGpsAccuracy(accuracy);

        if (accuracy > 50) {
          setStatus(
            "GPS accuracy is weak. Move somewhere with a clearer signal."
          );
          return;
        }

        setStatus("Walking is being verified.");

        if (gpsSpeed !== null) {
          setSpeed(
            Math.max(0, gpsSpeed * 3.6)
          );
        }

        if (lastPosition.current) {
          const segment = calculateDistance(
            lastPosition.current.latitude,
            lastPosition.current.longitude,
            latitude,
            longitude
          );

          const elapsed =
            (Date.now() - startTime.current) / 1000;

          const segmentSpeed =
            elapsed > 0
              ? segment / elapsed * 3600
              : 0;

          /*
            Reject obviously impossible movement.
            This is only one anti-cheat layer.
          */
          if (
            segment > 0 &&
            segmentSpeed <= 12
          ) {
            verifiedDistance.current += segment;

            setDistance(
              verifiedDistance.current
            );
          }
        }

        lastPosition.current = {
          latitude,
          longitude
        };
      },
      (error) => {
        setStatus(
          error.message ||
          "Unable to access GPS."
        );
      }
    );

    motionCleanup.current =
      startMotionTracking((motion) => {
        if (motion.steps !== undefined) {
          lastStepCount.current =
            motion.steps;

          setSteps(motion.steps);
        }
      });
  }

  async function finishWalk() {
    stopEverything();
    setRunning(false);

    const walked =
      verifiedDistance.current;

    if (walked < 0.01) {
      setStatus("No meaningful verified distance recorded.");
      return;
    }

    const existing =
      getAccount() || account;

    if (!existing) {
      setStatus("Account not found.");
      return;
    }

    const oldDistance =
      Number(existing.totalDistance || 0);

    const newDistance =
      oldDistance + walked;

    const oldPoints =
      Number(existing.points || 0);

    const oldCompletedWalks =
      Number(existing.completedWalks || 0);

    const oldLifetime =
      Number(existing.lifetimeDistance || 0);

    const oldFiveKm =
      Math.floor(oldDistance / 5);

    const newFiveKm =
      Math.floor(newDistance / 5);

    const earned =
      Math.max(0, newFiveKm - oldFiveKm);

    const updated = {
      ...existing,
      totalDistance: newDistance,
      lifetimeDistance:
        oldLifetime + walked,
      points:
        oldPoints + earned,
      completedWalks:
        oldCompletedWalks + 1
    };

    saveAccount(updated);
    updateAccount(updated);

    try {
      await addDistance(
        updated.walkingId,
        walked,
        earned
      );
    } catch (error) {
      console.error(error);
    }

    setDistance(0);
    verifiedDistance.current = 0;

    if (earned > 0) {
      setStatus(
        `Walk complete! You earned ${earned} point${
          earned === 1 ? "" : "s"
        }.`
      );
    } else {
      setStatus(
        `Walk complete. You walked ${walked.toFixed(
          2
        )} km.`
      );
    }
  }

  return (
    <div className="page">
      <section className="card walk-card">
        <p className="small-label">
          VERIFIED DISTANCE
        </p>

        <div className="distance-number">
          {distance.toFixed(2)}
        </div>

        <p className="km-label">kilometres</p>

        <div className="walk-metrics">
          <div>
            <strong>
              {speed.toFixed(1)}
            </strong>
            <span>km/h</span>
          </div>

          <div>
            <strong>{steps}</strong>
            <span>steps</span>
          </div>

          <div>
            <strong>
              {gpsAccuracy
                ? `${Math.round(gpsAccuracy)}m`
                : "--"}
            </strong>
            <span>GPS accuracy</span>
          </div>
        </div>

        <div className="status-box">
          {status}
        </div>

        {!running ? (
          <button
            className="primary-button large"
            onClick={beginWalk}
          >
            Start Walk
          </button>
        ) : (
          <button
            className="danger-button large"
            onClick={finishWalk}
          >
            Finish Walk
          </button>
        )}

        <p className="warning-text">
          Keep GPS enabled and carry your phone naturally.
          The app rejects suspicious movement speeds.
        </p>
      </section>
    </div>
  );
}
