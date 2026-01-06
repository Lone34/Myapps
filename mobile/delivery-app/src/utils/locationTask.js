import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import client from "../api/client";

const TASK_NAME = "DELIVERY_LOCATION_TASK";

TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  if (error) return;

  const { locations } = data;
  const loc = locations[0];

  try {
    await client.post("/api/delivery/update-location/", {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    });
  } catch (e) {
    console.log("Location send error:", e.response?.data || e.message);
  }
});

export async function startLocationTracking() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return;

  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: 4000,
    distanceInterval: 3,
  });
}

export async function stopLocationTracking() {
  await Location.stopLocationUpdatesAsync(TASK_NAME);
}
