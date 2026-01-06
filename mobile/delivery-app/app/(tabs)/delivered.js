import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  FlatList,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import client from "../../src/api/client";

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  text: "#111827",
  sub: "#6B7280",
  border: "rgba(17,24,39,0.10)",
  muted: "#9CA3AF",
  shadow: "#000",
  green: "#22C55E",
};

const fmtDate = (val) => {
  if (!val) return "";
  try {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return String(val).replace("T", " ").slice(0, 16);
    return d.toLocaleString();
  } catch (e) {
    return String(val).replace("T", " ").slice(0, 16);
  }
};

export default function DeliveredScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDelivered = async () => {
    try {
      const res = await client.get("/api/delivery/delivered-orders/");
      setOrders(res.data || []);
    } catch (e) {
      console.log("Delivered orders error:", e.response?.data || e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDelivered();
  }, []);

  const totalCount = orders?.length || 0;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.text} />
        <Text style={{ marginTop: 10, color: COLORS.sub }}>Loading delivered orders…</Text>
      </View>
    );
  }

  if (!orders.length) {
    return (
      <View style={styles.center}>
        <View style={styles.emptyIcon}>
          <Ionicons name="checkmark-done-outline" size={22} color={COLORS.green} />
        </View>
        <Text style={styles.emptyTitle}>No delivered orders yet</Text>
        <Text style={styles.emptySub}>Your delivered orders will appear here.</Text>
      </View>
    );
  }

  const renderItem = ({ item }) => {
    const dateText = fmtDate(item.delivered_at);
    const total = Number(item.total_price || 0);
    const shipping = Number(item.shipping_price || 0);

    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => router.push(`/order/${item.id}`)}>
        <View style={styles.topRow}>
          <Text style={styles.title}>Order #{item.id}</Text>
          <View style={styles.pill}>
            <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.green} />
            <Text style={styles.pillText}>DELIVERED</Text>
          </View>
        </View>

        <View style={styles.row}>
          <Ionicons name="location-outline" size={16} color={COLORS.sub} />
          <Text style={styles.addr} numberOfLines={2}>{item.shipping_address || "Address not available"}</Text>
        </View>

        <View style={[styles.metaRow, { marginTop: 10 }]}>
          <View style={styles.metaChip}>
            <Ionicons name="cash-outline" size={14} color={COLORS.sub} />
            <Text style={styles.metaChipText}>₹{Number.isFinite(total) ? total.toFixed(0) : "0"}</Text>
          </View>

          <View style={styles.metaChip}>
            <Ionicons name="cube-outline" size={14} color={COLORS.sub} />
            <Text style={styles.metaChipText}>Ship ₹{Number.isFinite(shipping) ? shipping.toFixed(0) : "0"}</Text>
          </View>

          <View style={{ flex: 1 }} />
          <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
        </View>

        {dateText ? (
          <Text style={styles.dateText}>Delivered: {dateText}</Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Delivered</Text>
        <Text style={styles.count}>{totalCount}</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 140, paddingTop: 6 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 16, paddingTop: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg, paddingHorizontal: 20 },

  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  heading: { fontSize: 22, fontWeight: "900", color: COLORS.text },
  count: { fontSize: 14, fontWeight: "900", color: COLORS.sub, backgroundColor: "rgba(17,24,39,0.06)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8,
  },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  title: { fontSize: 16, fontWeight: "900", color: COLORS.text },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(34,197,94,0.12)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: "900", color: COLORS.green },

  row: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  addr: { flex: 1, fontSize: 13, fontWeight: "700", color: COLORS.sub, lineHeight: 18 },

  metaRow: { flexDirection: "row", alignItems: "center" },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(17,24,39,0.04)",
    marginRight: 8,
  },
  metaChipText: { fontSize: 12, fontWeight: "900", color: COLORS.text },

  dateText: { marginTop: 10, fontSize: 12, fontWeight: "800", color: COLORS.sub },
  emptyIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: "rgba(34,197,94,0.12)", alignItems: "center", justifyContent: "center" },
  emptyTitle: { marginTop: 10, fontSize: 18, fontWeight: "900", color: COLORS.text },
  emptySub: { marginTop: 6, fontSize: 13, fontWeight: "700", color: COLORS.sub, textAlign: "center", lineHeight: 18 },
});
