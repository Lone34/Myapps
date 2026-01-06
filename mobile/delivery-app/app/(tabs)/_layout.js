import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  text: "#111827",
  sub: "#6B7280",
  border: "rgba(17,24,39,0.10)",
  muted: "#9CA3AF",
};

export default function Layout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 62 + Math.max(insets.bottom, 10);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: COLORS.text,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          marginTop: Platform.OS === "android" ? -2 : 0,
        },
        tabBarStyle: {
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 10,
          height: tabBarHeight,
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom, 12),
          borderTopWidth: 0,
          backgroundColor: COLORS.card,
          borderRadius: 18,
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: 14,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Orders",
          tabBarIcon: ({ color }) => (
            <Ionicons name="bicycle" size={22} color={color} />
          ),
        }}
      />

      {/* 💰 Wallet Tab */}
      <Tabs.Screen
        name="wallet"
        options={{
          title: "Earnings",
          tabBarIcon: ({ color }) => (
            <Ionicons name="wallet" size={22} color={color} />
          ),
        }}
      />
      
      {/* 📦 Active Returns Tab (Fixed: Removed href: null) */}
      <Tabs.Screen
        name="returns"
        options={{
          title: "Active Returns",
          tabBarIcon: ({ color }) => (
             <Ionicons name="cube-outline" size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="delivered"
        options={{
          title: "Delivered",
          tabBarIcon: ({ color }) => (
            <Ionicons name="checkmark-circle" size={22} color={color} />
          ),
        }}
      />

      {/* 📜 Returned History Tab */}
      <Tabs.Screen
        name="returned"
        options={{
          href: null,
          title: "History",
          tabBarIcon: ({ color }) => (
            <Ionicons name="time-outline" size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="failed"
        options={{
          title: "Failed",
          tabBarIcon: ({ color }) => (
            <Ionicons name="close-circle" size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="stats"
        options={{
          title: "Stats",
          tabBarIcon: ({ color }) => (
            <Ionicons name="stats-chart" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
