import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
  red: "#EF4444",
  amber: "#F59E0B",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  activeTab: "#111827",
  inactiveTab: "#E5E7EB",
};

// --- Helper Functions ---
const fmtDate = (val) => {
  if (!val) return "";
  try {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return String(val).replace("T", " ").slice(0, 16);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return String(val);
  }
};

const normalizeReturn = (r) => {
  // Handle inconsistent shop data structure from different endpoints
  const shopRaw = r.shop || {};
  const shop = { 
    name: shopRaw.name || r.shop_name || "Unknown Shop", 
    address: shopRaw.address || r.shop_address || "", 
    phone: shopRaw.phone || r.shop_phone || "" 
  };

  const customer = r.customer || {
    name: r.customer_name || "Customer",
    phone: r.customer_phone || "",
    address: r.shipping_address || "",
  };

  const items = r.items || [];

  return {
    id: r.id ?? r.return_id,
    status: r.status || "",
    reason: r.reason || "",
    created_at: r.created_at || r.requested_at || r.completed_at || "",
    order_id: r.order_id || r.order || "",
    refund_amount: r.refund_amount,
    customer,
    shop,
    items,
    _raw: r,
  };
};

const STATUS_META = {
  pending: { bg: "rgba(59,130,246,0.12)", fg: COLORS.blue, icon: "flash-outline" },
  accepted: { bg: "rgba(245,158,11,0.14)", fg: COLORS.amber, icon: "hand-left-outline" },
  pickup_scheduled: { bg: "rgba(245,158,11,0.14)", fg: COLORS.amber, icon: "time-outline" },
  picked_up: { bg: "rgba(139,92,246,0.14)", fg: COLORS.purple, icon: "cube-outline" },
  delivered_to_shop: { bg: "rgba(34,197,94,0.14)", fg: COLORS.green, icon: "checkmark-circle" },
  completed: { bg: "rgba(34,197,94,0.14)", fg: COLORS.green, icon: "checkmark-done" },
  refunded: { bg: "rgba(34,197,94,0.14)", fg: COLORS.green, icon: "cash-outline" },
};

function StatusPill({ status }) {
  const s = String(status || "").toLowerCase();
  const meta = STATUS_META[s] || { bg: "rgba(17,24,39,0.06)", fg: COLORS.text, icon: "information-circle-outline" };
  return (
    <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
      <Ionicons name={meta.icon} size={14} color={meta.fg} />
      <Text style={[styles.statusPillText, { color: meta.fg }]}>{(s || "unknown").toUpperCase()}</Text>
    </View>
  );
}

export default function ReturnsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("active"); 
  
  const [activeData, setActiveData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // ✅ 1. Active Returns
      const resActive = await client.get("/api/returns/pending/");
      const activeArr = Array.isArray(resActive.data) ? resActive.data : [];
      setActiveData(activeArr.map(normalizeReturn));

      // ✅ 2. History Returns (FIXED URL: Added /api/)
      const resHistory = await client.get("/api/delivery/completed-returns/");
      const histArr = Array.isArray(resHistory.data) ? resHistory.data : [];
      setHistoryData(histArr.map(normalizeReturn));

    } catch (e) {
      console.log("Error fetching returns:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const t = setInterval(() => {
      if (activeTab === 'active') loadData();
    }, 15000);
    return () => clearInterval(t);
  }, [activeTab]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Sort Active
  const sortedActive = useMemo(() => {
    return [...activeData].sort((a, b) => b.id - a.id);
  }, [activeData]);

  // Sort History
  const sortedHistory = useMemo(() => {
    return [...historyData].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [historyData]);

  const renderActiveItem = ({ item }) => {
    const status = String(item.status || "").toLowerCase();
    
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/return/${item.id}`)}
        activeOpacity={0.85}
      >
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Return #{item.id}</Text>
            <Text style={styles.sub}>Order #{item.order_id} • {fmtDate(item.created_at)}</Text>
          </View>
          <StatusPill status={status} />
        </View>

        <View style={styles.divider} />

        <View style={styles.metaRow}>
          <Ionicons name="storefront-outline" size={16} color={COLORS.sub} />
          <Text style={styles.metaText} numberOfLines={1}>{item.shop.name}</Text>
        </View>
        <Text style={styles.addressText}>{item.shop.address}</Text>

        <View style={[styles.metaRow, { marginTop: 8 }]}>
          <Ionicons name="person-outline" size={16} color={COLORS.sub} />
          <Text style={styles.metaText} numberOfLines={1}>{item.customer.name}</Text>
        </View>
        <Text style={styles.addressText}>{item.customer.address}</Text>
        
        <View style={styles.actionHint}>
           <Text style={styles.actionHintText}>Tap to manage pickup</Text>
           <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderHistoryItem = ({ item }) => {
    return (
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View>
            <Text style={[styles.title, { color: COLORS.sub }]}>Return #{item.id}</Text>
            <Text style={styles.date}>{fmtDate(item.created_at)}</Text>
          </View>
          <View style={styles.doneBadge}>
             <Ionicons name="checkmark-done" size={12} color="#fff" />
             <Text style={styles.doneText}>COMPLETED</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.metaRow}>
           <Ionicons name="storefront" size={14} color={COLORS.text} />
           <Text style={styles.shopName}>{item.shop.name}</Text>
        </View>
        <Text style={styles.addressText}>{item.shop.address}</Text>

        <View style={styles.itemsContainer}>
          {item.items.slice(0, 3).map((it, idx) => (
            <View key={idx} style={styles.miniItem}>
               <Text style={styles.miniItemText}>
                 {it.qty}x {it.name}
               </Text>
            </View>
          ))}
          {item.items.length > 3 && (
            <Text style={styles.moreItems}>+{item.items.length - 3} more items</Text>
          )}
        </View>
      </View>
    );
  };

  const dataToShow = activeTab === "active" ? sortedActive : sortedHistory;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Returns</Text>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === "active" && styles.tabActive]}
          onPress={() => setActiveTab("active")}
        >
          <Text style={[styles.tabText, activeTab === "active" && styles.tabTextActive]}>Active ({activeData.length})</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === "history" && styles.tabActive]}
          onPress={() => setActiveTab("history")}
        >
          <Text style={[styles.tabText, activeTab === "history" && styles.tabTextActive]}>History</Text>
        </TouchableOpacity>
      </View>

      {loading && dataToShow.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.text} />
        </View>
      ) : (
        <FlatList
          data={dataToShow}
          keyExtractor={(it) => String(it.id)}
          renderItem={activeTab === "active" ? renderActiveItem : renderHistoryItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name={activeTab === "active" ? "cube-outline" : "time-outline"} size={48} color={COLORS.muted} />
              <Text style={styles.emptyText}>
                {activeTab === "active" ? "No active returns." : "No returned history yet."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { marginTop: 14, marginBottom: 12 },
  heading: { fontSize: 24, fontWeight: "900", color: COLORS.text },
  tabsContainer: { flexDirection: "row", backgroundColor: COLORS.card, borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 },
  tabActive: { backgroundColor: COLORS.activeTab },
  tabText: { fontSize: 13, fontWeight: "700", color: COLORS.sub },
  tabTextActive: { color: "#fff" },
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border, elevation: 2 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  sub: { fontSize: 12, color: COLORS.sub, marginTop: 2, fontWeight: "600" },
  date: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusPillText: { fontSize: 10, fontWeight: "800" },
  doneBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.green, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  doneText: { fontSize: 10, fontWeight: "800", color: "#fff" },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  metaText: { fontSize: 13, fontWeight: "700", color: COLORS.text, flex: 1 },
  shopName: { fontSize: 14, fontWeight: "800", color: COLORS.text },
  addressText: { fontSize: 12, color: COLORS.sub, marginLeft: 22, marginBottom: 4 },
  itemsContainer: { marginTop: 10, backgroundColor: COLORS.bg, padding: 8, borderRadius: 8 },
  miniItem: { marginBottom: 4 },
  miniItemText: { fontSize: 12, color: COLORS.text, fontWeight: "600" },
  moreItems: { fontSize: 11, color: COLORS.sub, marginTop: 2, fontStyle: "italic" },
  actionHint: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4 },
  actionHintText: { fontSize: 11, color: COLORS.primary, fontWeight: "700" },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyText: { marginTop: 12, fontSize: 14, fontWeight: "600", color: COLORS.sub },
});
