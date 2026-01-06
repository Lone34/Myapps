import * as Location from "expo-location";
import { TASK_NAME } from "./locationTask";

export const stopTracking = async () => {
  const hasTask = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);

  if (!hasTask) {
    console.log("⚠ No tracking task running");
    return;
  }

  await Location.stopLocationUpdatesAsync(TASK_NAME);

  console.log("🛑 Background tracking stopped");
};
