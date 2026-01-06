import React, { useEffect, useState } from "react";
import { Stack, usePathname, useRouter } from "expo-router";
import { View, ActivityIndicator, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Provider } from "react-redux";
import store from "../src/redux/store";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import "../src/location/locationTask";
import { stopTracking } from "../src/location/stopTracking";
import client from "../src/api/client";
import { registerDeliveryPushToken } from "../src/notifications/registerPushToken";
import { Ionicons } from "@expo/vector-icons";

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  text: "#111827",
  sub: "#6B7280",
  border: "rgba(17,24,39,0.10)",
  shadow: "#000",
};

function RootContent() {
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("deliveryToken");

        if (token) {
          // set axios Authorization header for delivery app
          client.defaults.headers.common.Authorization = `Bearer ${token}`;

          // register Expo push token for this rider
          await registerDeliveryPushToken();
        }
      } catch (e) {
        console.log("Delivery app: error restoring token or registering push token", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLogout = async () => {
    try {
      // stop background location tracking for this rider
      await stopTracking();
    } catch (e) {
      console.log("stopTracking error:", e);
    }

    try {
      // clear stored auth data
      await AsyncStorage.multiRemove(["deliveryToken", "deliveryRefresh", "deliveryInfo"]);
    } catch (e) {
      console.log("logout storage error:", e);
    }

    router.replace("/login");
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.text} />
        <Text style={{ marginTop: 10, color: COLORS.sub, fontWeight: "700" }}>Starting…</Text>
      </View>
    );
  }

  // hide top bar only on login screen
  const showTopBar = pathname && pathname !== "/login";

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {showTopBar && (
        <SafeAreaView edges={["top"]} style={styles.topSafe}>
          <View style={styles.topBar}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={styles.brandDot} />
              <View>
                <Text style={styles.appTitle}>KupwaraCart Delivery</Text>
                <Text style={styles.appSub}>Delivery Partner</Text>
              </View>
            </View>

            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} activeOpacity={0.85}>
              <Ionicons name="log-out-outline" size={16} color="#fff" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}

      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="home" />
          <Stack.Screen name="order/[id]" />
          <Stack.Screen name="map/[id]" />
          <Stack.Screen name="admin/dashboard" />
          <Stack.Screen name="admin/returns" />
        </Stack>
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <RootContent />
      </Provider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, backgroundColor: COLORS.bg, justifyContent: "center", alignItems: "center" },

  topSafe: { backgroundColor: COLORS.bg },
  topBar: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  brandDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.text },

  appTitle: { fontSize: 15, fontWeight: "900", color: COLORS.text },
  appSub: { marginTop: 2, fontSize: 11, fontWeight: "800", color: COLORS.sub },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: COLORS.text,
  },
  logoutText: { color: "#fff", fontSize: 12, fontWeight: "900" },
});
