import * as Location from "expo-location";
import { TASK_NAME } from "./locationTask";

export const startTracking = async () => {
  console.log("🚀 Starting background GPS...");

  // STEP 1 — Foreground permission
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") {
    console.log("❌ Foreground location not granted");
    throw new Error("Foreground location required");
  }
  console.log("✔ Foreground permission granted");

  // STEP 2 — Background permission
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") {
    console.log("❌ Background location not granted");
    throw new Error("Background location required");
  }
  console.log("✔ Background permission granted");

  // STEP 3 — Start background updates
  const running = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);

  if (!running) {
    await Location.startLocationUpdatesAsync(TASK_NAME, {
      accuracy: Location.Accuracy.Highest,
      timeInterval: 5000,
      distanceInterval: 5,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "Delivery Tracking Active",
        notificationBody: "Your live location is being shared.",
      },
    });

    console.log("✅ Background GPS started");
  } else {
    console.log("ℹ Tracking already running");
  }
};
