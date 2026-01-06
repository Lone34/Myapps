// app/admin/riders.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import client from "../../src/api/client";

export default function AdminRidersScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);

  const fetchSummary = async () => {
    try {
      setError("");
      const { data } = await client.get("/api/delivery/admin/cod/summary/");
      setSummary(data);
    } catch (err) {
      console.error("Error fetching COD summary", err?.response?.data || err);
      setError("Failed to load COD summary");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSummary();
  };

  const openRiderDetail = (rider) => {
    router.push({
      pathname: "/admin/rider-detail",
      params: {
        riderId: String(rider.rider_id),
        riderName: rider.name,
      },
    });
  };

  if (loading && !summary) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading riders COD summary...</Text>
      </SafeAreaView>
    );
  }

  if (error && !summary) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchSummary}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const totals = summary?.totals || {};
  const riders = summary?.per_rider || [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Delivery Partners – COD</Text>
        <Text style={styles.subtitle}>
          Total COD: ₹{totals.total_cod_amount || "0.00"} | Unsettled: ₹
          {totals.total_unsettled || "0.00"}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {riders.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No COD records yet.</Text>
          </View>
        ) : (
          riders.map((rider) => (
            <TouchableOpacity
              key={rider.rider_id}
              style={styles.card}
              onPress={() => openRiderDetail(rider)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.riderName}>{rider.name}</Text>
                <Text style={styles.riderVillage}>{rider.village}</Text>
              </View>
              <Text style={styles.riderPhone}>{rider.phone}</Text>

              <View style={styles.row}>
                <View style={styles.chip}>
                  <Text style={styles.chipLabel}>COD Orders</Text>
                  <Text style={styles.chipValue}>{rider.cod_orders}</Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipLabel}>Total COD</Text>
                  <Text style={styles.chipValue}>₹{rider.cod_amount}</Text>
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.chip, styles.unsettledChip]}>
                  <Text style={styles.chipLabel}>Unsettled</Text>
                  <Text style={styles.chipValue}>
                    ₹{rider.unsettled_amount}
                  </Text>
                </View>
                <View style={[styles.chip, styles.settledChip]}>
                  <Text style={styles.chipLabel}>Settled</Text>
                  <Text style={styles.chipValue}>₹{rider.settled_amount}</Text>
                </View>
              </View>

              {rider.last_settlement_at && (
                <Text style={styles.lastSettleText}>
                  Last settlement: {String(rider.last_settlement_at).slice(0, 19)}
                </Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, fontSize: 14, color: "#555" },
  errorText: { color: "#d00", fontSize: 14, marginBottom: 8 },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#000",
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontWeight: "600" },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#ddd",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#111" },
  subtitle: { marginTop: 4, fontSize: 13, color: "#666" },
  scroll: { flex: 1 },
  emptyBox: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { fontSize: 14, color: "#666" },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  riderName: { fontSize: 16, fontWeight: "700", color: "#111" },
  riderVillage: { fontSize: 13, color: "#555" },
  riderPhone: { marginTop: 2, fontSize: 13, color: "#333" },
  row: {
    flexDirection: "row",
    marginTop: 10,
    justifyContent: "space-between",
  },
  chip: {
    flex: 1,
    marginRight: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  unsettledChip: { backgroundColor: "#fff2e0" },
  settledChip: { backgroundColor: "#e0f9ea" },
  chipLabel: { fontSize: 11, color: "#666" },
  chipValue: { marginTop: 2, fontSize: 14, fontWeight: "700", color: "#111" },
  lastSettleText: {
    marginTop: 8,
    fontSize: 11,
    color: "#777",
  },
});
