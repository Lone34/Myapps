import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import client from "../api/client"; // same axios client you use for delivery app API

export async function registerDeliveryPushToken() {
  try {
    // Ask for permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Push permission not granted for delivery app");
      return;
    }

    // Get Expo push token
    const tokenResponse = await Notifications.getExpoPushTokenAsync();
    const token = tokenResponse.data;
    console.log("Delivery expo push token:", token);

    // Send to backend (rider must be logged in: Authorization header already set)
    await client.post("/api/users/register-push-token/", {
      expo_push_token: token,
    });
  } catch (err) {
    console.log("Error registering delivery push token:", err);
  }
}
