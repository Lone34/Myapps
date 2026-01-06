// src/notifications/NotificationNavigationHandler.tsx
import React, { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";

export default function NotificationNavigationHandler() {
  const router = useRouter();

  useEffect(() => {
    const subscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data: any =
          response.notification.request.content.data || {};
        const type = data.type;

        if (type === "order" && data.order_id) {
          // from send_order_delivered_notification
          router.push(`/orders/${data.order_id}`);
        } else if (type === "return" && data.order_id) {
          // from send_return_status_notification – go to order details
          router.push(`/orders/${data.order_id}`);
        } else if (type === "broadcast") {
          // manual admin broadcasts
          if (data.deep_link && typeof data.deep_link === "string") {
            // e.g. "/(tabs)", "/products", "/orders"
            router.push(data.deep_link as any);
          } else {
            // default: go to home/tabs
            router.push("/(tabs)");
          }
        } else {
          // Fallback – just go to tabs/home
          router.push("/(tabs)");
        }
      });

    return () => {
      subscription.remove();
    };
  }, [router]);

  return null;
}
