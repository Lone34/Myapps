// app/(tabs)/home.js
import React, { useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fetchOrders, fetchStats } from "../../src/redux/slices/riderSlice";

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  text: "#111827",
  sub: "#6B7280",
  border: "rgba(17,24,39,0.10)",
  muted: "#9CA3AF",
  shadow: "#000",

  green: "#22C55E",
  red: "#EF4444",
  amber: "#F59E0B",
  blue: "#3B82F6",
  purple: "#8B5CF6",

  // Active order dark base (no white under RGB)
  activeBase: "#0B1220",
  activeText: "#F9FAFB",
  activeSub: "rgba(249,250,251,0.78)",
  activeChipBg: "rgba(255,255,255,0.10)",
  activeChipBorder: "rgba(255,255,255,0.14)",
};

const STATUS_META = {
  new: { fg: COLORS.blue, icon: "flash-outline" },
  accepted: { fg: COLORS.amber, icon: "hand-left-outline" },
  enroute: { fg: COLORS.purple, icon: "navigate-outline" },
  onway: { fg: COLORS.purple, icon: "navigate-outline" },
  delivered: { fg: COLORS.green, icon: "checkmark-circle-outline" },
  failed: { fg: COLORS.red, icon: "close-circle-outline" },
  cancelled: { fg: COLORS.red, icon: "ban-outline" },
  canceled: { fg: COLORS.red, icon: "ban-outline" },
};

// 🔥 FAST delivery helper
const isFastOrder = (o) => {
  const raw =
    o?.delivery_speed ??
    o?.deliverySpeed ??
    (o?.is_fast_delivery ? "fast" : "normal") ??
    "normal";
  return String(raw).toLowerCase() === "fast";
};

function StatusPill({ status, activeMode = false }) {
  const s = String(status || "").toLowerCase();
  const meta = STATUS_META[s] || STATUS_META.new;

  return (
    <View
      style={[
        styles.statusPill,
        { backgroundColor: activeMode ? "rgba(255,255,255,0.12)" : "rgba(59,130,246,0.10)" },
      ]}
    >
      <Ionicons name={meta.icon} size={14} color={activeMode ? "#fff" : meta.fg} />
      <Text style={[styles.statusPillText, { color: activeMode ? "#fff" : meta.fg }]}>
        {s.toUpperCase()}
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const dispatch = useDispatch();

  const { orders = [], loading = false } = useSelector((state) => state.rider) || {};

  // RGB flash animation
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    dispatch(fetchOrders());
    dispatch(fetchStats());

    const interval = setInterval(() => {
      dispatch(fetchOrders());
      dispatch(fetchStats());
    }, 8000);

    return () => clearInterval(interval);
  }, [dispatch]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(flash, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [flash]);

  // 🔥 Group orders with FAST priority
  const grouped = useMemo(() => {
    const list = Array.isArray(orders) ? orders : [];
    const getStatus = (o) => String(o?.delivery_status || o?.status || "").toLowerCase();

    const live = list.filter((o) =>
      ["new", "accepted", "enroute", "onway"].includes(getStatus(o))
    );

    const activeAll = live.filter((o) =>
      ["accepted", "enroute", "onway"].includes(getStatus(o))
    );
    const newAll = live.filter((o) => getStatus(o) === "new");

    return {
      activeFast: activeAll.filter(isFastOrder),
      activeNormal: activeAll.filter((o) => !isFastOrder(o)),
      newFast: newAll.filter(isFastOrder),
      newNormal: newAll.filter((o) => !isFastOrder(o)),
    };
  }, [orders]);

  const listData = useMemo(() => {
    const out = [];

    if (grouped.activeFast.length) {
      out.push({ __header: true, key: "af", title: "⚡ FAST DELIVERY (PRIORITY)" });
      grouped.activeFast.forEach((o) => out.push(o));
    }
    if (grouped.activeNormal.length) {
      out.push({ __header: true, key: "an", title: "Active Orders" });
      grouped.activeNormal.forEach((o) => out.push(o));
    }
    if (grouped.newFast.length) {
      out.push({ __header: true, key: "nf", title: "⚡ FAST – New Orders" });
      grouped.newFast.forEach((o) => out.push(o));
    }
    if (grouped.newNormal.length) {
      out.push({ __header: true, key: "nn", title: "New Orders" });
      grouped.newNormal.forEach((o) => out.push(o));
    }

    return out;
  }, [grouped]);

  const flashBg = flash.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [
      "rgba(255,0,90,0.75)",
      "rgba(0,180,255,0.75)",
      "rgba(0,255,140,0.75)",
    ],
  });

  const renderItem = ({ item }) => {
    if (item.__header) {
      return (
        <View style={styles.groupHeader}>
          <Text style={styles.groupHeaderText}>{item.title}</Text>
        </View>
      );
    }

    const id = item.id ?? item.order_id;
    const status = String(item.delivery_status ?? item.status ?? "").toLowerCase();
    const isActive = ["accepted", "enroute", "onway"].includes(status);
    const fast = isFastOrder(item);

    return (
      <TouchableOpacity
        style={[styles.orderCard, isActive && styles.orderCardActive]}
        onPress={() => router.push(`/order/${id}`)}
        activeOpacity={0.85}
      >
        {isActive && (
          <Animated.View style={[styles.rgbFill, { backgroundColor: flashBg }]} />
        )}

        <View style={styles.orderTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.orderTitle, isActive && styles.activeText]}>
              Order #{id}
            </Text>
            <Text
              style={[styles.orderSub, isActive && styles.activeSub]}
              numberOfLines={1}
            >
              {item.customer_name || item.customer_phone || "Customer"}
            </Text>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <StatusPill status={status} activeMode={isActive} />
            {fast && (
              <View style={styles.fastBadge}>
                <Ionicons name="flash" size={12} color="#fff" />
                <Text style={styles.fastBadgeText}>FAST</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.metaRow}>
          <Ionicons
            name="location-outline"
            size={16}
            color={isActive ? COLORS.activeSub : COLORS.sub}
          />
          <Text
            style={[styles.metaText, isActive && styles.activeSub]}
            numberOfLines={2}
          >
            {item.shipping_address || "Address not available"}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.metaChip, isActive && styles.metaChipActive]}>
            <Ionicons name="cash-outline" size={14} color="#fff" />
            <Text style={styles.metaChipText}>
              ₹{Number(item.total_price || 0).toFixed(0)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && listData.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.text} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Live Orders</Text>

      {listData.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: COLORS.sub }}>No orders right now</Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item, i) => item.key || `${item.id}-${i}`}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  container: { flex: 1, padding: 16, backgroundColor: COLORS.bg },
  heading: { fontSize: 22, fontWeight: "900", marginBottom: 10 },

  groupHeader: { marginVertical: 8 },
  groupHeaderText: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.sub,
    textTransform: "uppercase",
  },

  orderCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  orderCardActive: {
    backgroundColor: COLORS.activeBase,
    borderColor: "rgba(255,255,255,0.12)",
  },

  rgbFill: {
    ...StyleSheet.absoluteFillObject,
  },

  orderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },

  orderTitle: { fontSize: 18, fontWeight: "900" },
  orderSub: { fontSize: 12, color: COLORS.sub },
  activeText: { color: COLORS.activeText },
  activeSub: { color: COLORS.activeSub },

  metaRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  metaText: { flex: 1, fontSize: 12, color: COLORS.sub },

  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.blue,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  metaChipActive: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  metaChipText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusPillText: { fontSize: 10, fontWeight: "900" },

  fastBadge: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EF4444",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  fastBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
  },
});
