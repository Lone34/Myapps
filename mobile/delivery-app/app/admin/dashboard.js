// app/admin/dashboard.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import client from "../../src/api/client";
import { useRouter } from "expo-router";
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export default function AdminDashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState(null);
  const [period, setPeriod] = useState("today");
  const [riderSearch, setRiderSearch] = useState("");
  const load = async () => {
    try {
      setError("");
      const res = await client.get(
        `/api/delivery/admin/overview/?period=${period}`
      );
      setOverview(res.data);
    } catch (e) {
      console.log("Admin overview error:", e.response?.data || e.message);
      const msg =
        e.response?.data?.detail ||
        e.message ||
        "Could not load admin overview";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [period]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const logout = async () => {
    try {
      const AsyncStorage = (
        await import("@react-native-async-storage/async-storage")
      ).default;
      await AsyncStorage.removeItem("deliveryToken");
    } catch (e) {
      console.log("Logout error:", e);
    }
    router.replace("/login");
  };

  const exportPDF = async () => {
    if (!overview) return;
    const riders = overview.riders || [];
    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial; padding: 20px; }
            h1 { text-align:center; color:#111; }
            table { width:100%; border-collapse:collapse; margin-top:10px; }
            th, td { border:1px solid #ccc; padding:8px; font-size:12px; }
            th { background:#f4f4f4; text-align:left; }
            .summary { margin-bottom:20px; }
          </style>
        </head>
        <body>
          <h1>KashmirCart Delivery Admin Report (${period.toUpperCase()})</h1>
          <div class="summary">
            <p><b>Delivered:</b> ${overview.today?.delivered ?? 0}</p>
            <p><b>Failed:</b> ${overview.today?.failed ?? 0}</p>
            <p><b>Rejected:</b> ${overview.today?.rejected ?? 0}</p>
            <p><b>Total COD Collected:</b> ₹${(overview.lifetime?.cod_total || 0).toFixed(2)}</p>
          </div>
          <table>
            <tr>
              <th>Rider</th>
              <th>Village</th>
              <th>Phone</th>
              <th>Delivered</th>
              <th>Failed</th>
              <th>Rejected</th>
              <th>COD ₹</th>
            </tr>
            ${riders
              .map(
                (r) => `
              <tr>
                <td>${r.name || "-"}</td>
                <td>${r.village || "-"}</td>
                <td>${r.phone || "-"}</td>
                <td>${r.lifetime?.delivered || 0}</td>
                <td>${r.lifetime?.failed || 0}</td>
                <td>${r.lifetime?.rejected || 0}</td>
                <td>${(r.lifetime?.cod_total || 0).toFixed(2)}</td>
              </tr>`
              )
              .join("")}
          </table>
        </body>
      </html>
    `;
    const { uri } = await Print.printToFileAsync({ html });
    const newUri = `${FileSystem.documentDirectory}DeliveryDashboard_${period}.pdf`;
    await FileSystem.moveAsync({ from: uri, to: newUri });
    await Sharing.shareAsync(newUri);
  };

  if (loading && !overview) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 8 }}>Loading dashboard…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !overview) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.reloadBtn} onPress={load}>
            <Text style={styles.reloadText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const today = overview?.today || {};
  const life = overview?.lifetime || {};
  const riders = overview?.riders || [];
  const riderSearchTerm = riderSearch.trim().toLowerCase();
  const filteredRiders = !riderSearchTerm
    ? riders
    : riders.filter((r) => {
        const name = (r.name || "").toLowerCase();
        const village = (r.village || "").toLowerCase();
        const phone = (r.phone || "").toLowerCase();
        return (
          name.includes(riderSearchTerm) ||
          village.includes(riderSearchTerm) ||
          phone.includes(riderSearchTerm)
        );
      });
  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Delivery Admin</Text>
          <Text style={styles.headerSub}>Live overview & rider stats</Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => router.push("/admin/returns")}
            style={styles.returnsBtn}
          >
            <Ionicons name="refresh-circle" size={18} color="#fff" />
            <Text style={styles.returnsText}>Returns</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.topButtonDark}
            onPress={() => router.push("/admin/riders")}
          >
            <Text style={styles.topButtonTextCenter}>
              COD Summary{"\n"}View totals & settlements
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color="#fff" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Bar */}
      <View style={styles.filterBar}>
        {["today", "week", "month", "lifetime"].map((p) => (
          <TouchableOpacity
            key={p}
            style={[
              styles.filterBtn,
              period === p && styles.filterBtnActive,
            ]}
            onPress={() => setPeriod(p)}
          >
            <Text
              style={[
                styles.filterText,
                period === p && styles.filterTextActive,
              ]}
            >
              {p === "today"
                ? "Today"
                : p === "week"
                ? "This Week"
                : p === "month"
                ? "This Month"
                : "Lifetime"}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={exportPDF} style={styles.pdfBtn}>
          <Ionicons name="download-outline" size={18} color="#fff" />
          <Text style={styles.pdfText}>Export</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary ({period})</Text>
          <View style={styles.row}>
            <View style={[styles.card, styles.cardGreen]}>
              <Text style={styles.cardLabel}>Delivered</Text>
              <Text style={styles.cardValue}>{today.delivered || 0}</Text>
            </View>
            <View style={[styles.card, styles.cardRed]}>
              <Text style={styles.cardLabel}>Failed</Text>
              <Text style={styles.cardValue}>{today.failed || 0}</Text>
            </View>
            <View style={[styles.card, styles.cardGray]}>
              <Text style={styles.cardLabel}>Rejected</Text>
              <Text style={styles.cardValue}>{today.rejected || 0}</Text>
            </View>
          </View>

          <View style={[styles.card, styles.cardGold, { marginTop: 12 }]}>
            <Text style={styles.cardLabel}>Total COD Collected</Text>
            <Text style={styles.cardValueLarge}>
              ₹{(life.cod_total || 0).toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Riders</Text>
        
          {/* ✅ Search riders */}
          <View style={styles.searchBarRow}>
            <Ionicons
              name="search-outline"
              size={16}
              color="#6B7280"
              style={{ marginRight: 6 }}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search rider by name, village or phone"
              placeholderTextColor="#9CA3AF"
              value={riderSearch}
              onChangeText={setRiderSearch}
              returnKeyType="search"
            />
          </View>
        
          {!filteredRiders.length ? (
            <Text style={styles.emptyText}>No riders found.</Text>
          ) : (
            filteredRiders.map((r) => (
              <TouchableOpacity
                key={r.id}
                onPress={() =>
                  router.push({
                    pathname: "/admin/rider-detail",
                    params: { riderId: String(r.id), riderName: r.name || "" },
                  })
                }
                style={styles.riderCard}
              >
                <View style={styles.riderHeader}>
                  <View style={styles.riderAvatar}>
                    <Text style={styles.riderAvatarText}>
                      {(r.name || "?").trim().charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.riderName}>{r.name}</Text>
                    <Text style={styles.riderMeta}>
                      Village: {r.village || "—"}
                    </Text>
                    {r.phone ? (
                      <Text style={styles.riderMeta}>📞 {r.phone}</Text>
                    ) : null}
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color="#9CA3AF"
                    style={{ marginLeft: 8 }}
                  />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F9" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { color: "#B00020", fontSize: 14, textAlign: "center" },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#111827",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DC2626",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  logoutText: { color: "#fff", marginLeft: 4, fontSize: 12, fontWeight: "600" },
  returnsBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D4AF37",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
  },
  returnsText: {
    color: "#fff",
    marginLeft: 4,
    fontSize: 12,
    fontWeight: "600",
  },
  topButtonDark: {
    backgroundColor: "#1F2937",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  topButtonTextCenter: {
    color: "#fff",
    fontSize: 11,
    textAlign: "center",
    fontWeight: "500",
  },

  filterBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#E5E7EB",
  },
  filterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#D1D5DB",
  },
  filterBtnActive: { backgroundColor: "#111827" },
  filterText: { color: "#111827", fontSize: 12 },
  filterTextActive: { color: "#fff" },
  pdfBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4B5563",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pdfText: { color: "#fff", marginLeft: 4, fontSize: 12 },

  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
    color: "#111827",
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  card: { flex: 1, padding: 12, borderRadius: 12, marginRight: 8 },
  cardGreen: { backgroundColor: "#DCFCE7" },
  cardRed: { backgroundColor: "#FEE2E2" },
  cardGray: { backgroundColor: "#E5E7EB" },
  cardGold: { backgroundColor: "#FEF3C7" },
  cardLabel: { fontSize: 12, color: "#4B5563", marginBottom: 4 },
  cardValue: { fontSize: 18, fontWeight: "800", color: "#111827" },
  cardValueLarge: { fontSize: 20, fontWeight: "800", color: "#92400E" },
  emptyText: { fontSize: 13, color: "#6B7280" },
  riderCard: {
    backgroundColor: "#fff",
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  riderHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  riderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  riderAvatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  riderName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  riderMeta: { fontSize: 12, color: "#6B7280" },
  reloadBtn: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#111827",
    borderRadius: 999,
  },
  reloadText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  searchBarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: "#111827",
    paddingVertical: 4,
  },
});
