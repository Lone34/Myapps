// src/notifications/registerForPush.ts
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import client from "../api/client";

// Show alert when app is foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerDevicePushToken() {
  try {
    if (!Device.isDevice) {
      console.log("Push notifications require a physical device");
      return;
    }

    // Check & request permission
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Push notification permission not granted");
      return;
    }

    // Get Expo push token
    const projectId =
      (Constants as any)?.expoConfig?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId ??
      undefined;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    const expoPushToken = tokenData.data;
    console.log("Expo push token:", expoPushToken);

    // Send to backend: /api/users/register-push-token/
    await client.post("users/register-push-token/", {
      expo_push_token: expoPushToken,
    });
  } catch (error) {
    console.log("registerDevicePushToken error:", error);
  }
}
