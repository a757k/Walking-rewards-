
import { useEffect } from "react";

function getQatarDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Qatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = {};

  for (const part of parts) {
    values[part.type] = part.value;
  }

  return `${values.year}-${values.month}-${values.day}`;
}

export default function PopUnder() {
  useEffect(() => {
    const today = getQatarDate();

    const sessionKey = `walkingRewardsPopUnderSession_${today}`;
    const countKey = `walkingRewardsAppOpenCount_${today}`;

    try {
      // Don't count a refresh or repeat render in the same tab.
      if (sessionStorage.getItem(sessionKey) === "counted") {
        return;
      }

      sessionStorage.setItem(sessionKey, "counted");

      const previousCount =
        Number(localStorage.getItem(countKey)) || 0;

      const openingCount = previousCount + 1;

      localStorage.setItem(
        countKey,
        String(openingCount)
      );

      // Only load the pop-under on the second opening.
      if (openingCount !== 2) {
        return;
      }

      // Prevent duplicate script loading in the same page.
      if (window.__walkingRewardsPopUnderLoaded) {
        return;
      }

      window.__walkingRewardsPopUnderLoaded = true;

      const script = document.createElement("script");

      script.setAttribute("data-cfasync", "false");

      script.src =
        "https://abscloud.org/1/58768197514eb5c6ff45fc0e807d8fad";

      script.async = true;

      document.body.appendChild(script);
    } catch (error) {
      console.error(
        "Pop-under frequency tracking failed:",
        error
      );
    }
  }, []);

  return null;
}
