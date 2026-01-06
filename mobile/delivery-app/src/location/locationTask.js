import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import client from "../api/client";

const TASK_NAME = "DELIVERY_LOCATION_TASK";

// Background Location Task
TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.log("❌ TASK ERROR:", error);
    return;
  }

  if (data?.locations?.length) {
    const { latitude, longitude } = data.locations[0].coords;

    console.log("📍 BG GPS:", latitude, longitude);

    try {
      await client.post("/api/delivery/update-location/", {
        latitude,
        longitude,
      });

      console.log("✅ GPS Sent to backend");
    } catch (err) {
      console.log("❌ GPS send error:", err.response?.data || err.message);
    }
  }
});

export { TASK_NAME };
