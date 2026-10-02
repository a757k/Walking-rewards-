export function startGPS(
  onPosition,
  onError
) {
  if (!navigator.geolocation) {
    onError(
      new Error(
        "Geolocation is not supported."
      )
    );

    return () => {};
  }

  const watchId =
    navigator.geolocation.watchPosition(
      onPosition,
      onError,
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000
      }
    );

  return () => {
    navigator.geolocation.clearWatch(
      watchId
    );
  };
}

export function getCurrentPosition() {
  return new Promise(
    (resolve, reject) => {
      if (!navigator.geolocation) {
        reject(
          new Error(
            "Geolocation is not supported."
          )
        );

        return;
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000
        }
      );
    }
  );
}
