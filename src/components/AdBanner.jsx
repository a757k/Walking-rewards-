import { useEffect, useRef } from "react";

export default function AdBanner() {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || container.dataset.loaded === "true") {
      return;
    }

    container.dataset.loaded = "true";

    const optionsScript = document.createElement("script");

    optionsScript.text = `
      window.atOptions = {
        key: "151da19a65f2a87ee1e167c13cf0dfe9",
        format: "iframe",
        height: 50,
        width: 320,
        params: {}
      };
    `;

    const adScript = document.createElement("script");

    adScript.src =
      "https://bauval.org/22/151da19a65f2a87ee1e167c13cf0dfe9";

    adScript.async = true;

    container.appendChild(optionsScript);
    container.appendChild(adScript);

    return () => {
      container.innerHTML = "";
      container.dataset.loaded = "false";
    };
  }, []);

  return (
    <div className="ad-banner-wrapper">
      <div className="ad-banner-label">
        Advertisement
      </div>

      <div
        ref={containerRef}
        className="ad-banner-container"
      />
    </div>
  );
}
