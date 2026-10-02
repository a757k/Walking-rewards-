import { useEffect, useRef, useState } from "react";
import {
  startGPS
} from "../utils/gps";

import {
  startMotionTracking
} from "../utils/motion";

import {
  getAccount,
  saveAccount
} from "../utils/storage";

import {
  startWalkSession,
  sendWalkPosition,
  finishWalkSession
} from "../utils/api";

export default function Walk({
  account,
  updateAccount
}) {
  const [running, setRunning] = useState(false);
  const [distance, setDistance] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [steps, setSteps] = useState(0);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [status, setStatus] = useState(
    "Ready to start"
  );

  const gpsCleanup = useRef(null);
  const motionCleanup = useRef(null);

  const sessionId = useRef(null);
  const lastPosition = useRef(null);
  const lastPositionTime = useRef(null);

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, []);

  function stopTracking() {
    if (gpsCleanup.current) {
      gpsCleanup.current();
      gpsCleanup.current = null;
    }

    if (motionCleanup.current) {
      motionCleanup.current();
      motionCleanup.current = null;
    }
  }

  async function beginWalk() {
    if (!navigator.geolocation) {
      setStatus(
        "GPS is not supported on this device."
      );
      return;
    }

    if (!account?.walkingId) {
      setStatus(
        "Your Walking Account has not been created yet."
      );
      return;
    }

    try {
      setStatus("Starting verified walk...");

      const result =
        await startWalkSession(
          account.walkingId
        );

      sessionId.current =
        result.sessionId;

      lastPosition.current = null;
      lastPositionTime.current = null;

      setDistance(0);
      setSpeed(0);
      setSteps(0);

      setRunning(true);

      setStatus(
        "GPS verification is active."
      );

      gpsCleanup.current =
        startGPS(
          async (position) => {
            const {
              latitude,
              longitude,
              accuracy,
              speed: gpsSpeed
            } = position.coords;

            setGpsAccuracy(accuracy);

            if (accuracy > 60) {
              setStatus(
                "GPS accuracy is weak. Move somewhere with a clearer signal."
              );

              return;
            }

            const now = Date.now();

            let calculatedSpeed = 0;

            if (
              lastPosition.current &&
              lastPositionTime.current
            ) {
              const distanceMeters =
                calculateDistanceMeters(
                  lastPosition.current.latitude,
                  lastPosition.current.longitude,
                  latitude,
                  longitude
                );

              const seconds =
                (now -
                  lastPositionTime.current) /
                1000;

              if (seconds > 0) {
                calculatedSpeed =
                  (distanceMeters / seconds) *
                  3.6;
              }
            }

            const displayedSpeed =
              gpsSpeed !== null &&
              gpsSpeed !== undefined
                ? Math.max(
                    0,
                    gpsSpeed * 3.6
                  )
                : calculatedSpeed;

            setSpeed(
              Number(
                displayedSpeed.toFixed(1)
              )
            );

            try {
              const result =
                await sendWalkPosition(
                  account.walkingId,
                  sessionId.current,
                  {
                    latitude,
                    longitude,
                    accuracy,
                    timestamp: now
                  }
                );

              setDistance(
                Number(
                  result.distanceKm || 0
                )
              );

              if (result.rejected) {
                setStatus(
                  result.reason ||
                  "GPS point rejected."
                );
              } else {
                setStatus(
                  "Walk is being verified."
                );
              }
            } catch (error) {
              console.error(error);

              setStatus(
                "Connection problem while verifying GPS."
              );
            }

            lastPosition.current = {
              latitude,
              longitude
            };

            lastPositionTime.current =
              now;
          },
          (error) => {
            setStatus(
              error.message ||
              "Unable to access GPS."
            );
          }
        );

      motionCleanup.current =
        startMotionTracking(
          (motion) => {
            if (
              motion.steps !== undefined
            ) {
              setSteps(
                motion.steps
              );
            }
          }
        );
    } catch (error) {
      console.error(error);

      setStatus(
        error.message ||
        "Could not start the walk."
      );
    }
  }

  async function finishWalk() {
    if (!sessionId.current) {
      return;
    }

    setStatus(
      "Finishing and verifying walk..."
    );

    stopTracking();

    try {
      const result =
        await finishWalkSession(
          account.walkingId,
          sessionId.current
        );

      const current =
        getAccount() || account;

      const updated = {
        ...current,

        points:
          result.account.points,

        totalDistance:
          result.account.totalDistance,

        lifetimeDistance:
          result.account.lifetimeDistance,

        completedWalks:
          result.account.completedWalks
      };

      saveAccount(updated);
      updateAccount(updated);

      setRunning(false);
      sessionId.current = null;
      lastPosition.current = null;
      lastPositionTime.current = null;

      setDistance(
        result.distanceKm || 0
      );

      if (result.earnedPoints > 0) {
        setStatus(
          `Walk complete! You earned ${result.earnedPoints} point${
            result.earnedPoints === 1
              ? ""
              : "s"
          }.`
        );
      } else {
        setStatus(
          `Walk complete. ${Number(
            result.distanceKm || 0
          ).toFixed(2)} km verified.`
        );
      }
    } catch (error) {
      console.error(error);

      setRunning(false);
      sessionId.current = null;

      setStatus(
        error.message ||
        "Could not finish the walk."
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
          {Number(distance).toFixed(2)}
        </div>

        <p className="km-label">
          kilometres
        </p>

        <div className="walk-metrics">
          <div>
            <strong>
              {speed.toFixed(1)}
            </strong>

            <span>
              km/h
            </span>
          </div>

          <div>
            <strong>
              {steps}
            </strong>

            <span>
              steps
            </span>
          </div>

          <div>
            <strong>
              {gpsAccuracy
                ? `${Math.round(
                    gpsAccuracy
                  )}m`
                : "--"}
            </strong>

            <span>
              GPS accuracy
            </span>
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
          Keep GPS enabled and carry your
          phone normally. Suspicious movement
          speeds and invalid GPS jumps can be
          rejected.
        </p>
      </section>
    </div>
  );
}

function calculateDistanceMeters(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const R = 6371000;

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
