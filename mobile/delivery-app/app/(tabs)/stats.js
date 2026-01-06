import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  Platform,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import client from "../../src/api/client";

// --- THEME CONSTANTS ---
const COLORS = {
  primary: "#111827", // Dark Slate
  accent: "#2563EB",  // Blue
  bg: "#F3F4F6",      // Light Gray
  card: "#FFFFFF",
  text: "#1F2937",
  sub: "#6B7280",
  success: "#10B981", // Green
  danger: "#EF4444",  // Red
  warning: "#F59E0B", // Orange
  info: "#3B82F6",    // Blue
  border: "#E5E7EB",
};

// --- HELPER: FORMAT CURRENCY ---
const formatMoney = (amount) => {
  const n = Number(amount || 0);
  return "₹" + n.toFixed(0).replace(/(\d)(?=(\d\d)+\d$)/g, "$1,");
};

// --- HELPER: DATE FORMATTING ---
const formatDate = (dateObj) => {
  return dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
};

const getReadableDate = (dateObj) => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (dateObj.toDateString() === today.toDateString()) return "Today";
  if (dateObj.toDateString() === yesterday.toDateString()) return "Yesterday";
  
  return dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function StatsScreen() {
  const router = useRouter();
  
  // State
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // --- API CALL ---
  const fetchStats = async () => {
    try {
      const dateStr = formatDate(selectedDate);
      console.log("Fetching stats for:", dateStr);
      
      const res = await client.get(`/api/delivery/rider-stats/?date=${dateStr}`);
      setStats(res.data);
    } catch (e) {
      console.error("Stats Error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchStats();
  }, [selectedDate]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  // --- DATE NAVIGATION ---
  const changeDate = (days) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(["token", "rider_token", "user"]);
    router.replace("/login");
  };

  if (loading && !stats && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  const profile = stats?.profile || {};
  const data = stats?.stats || {};
  const cod = stats?.cod || {};

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      
      {/* --- HEADER --- */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSub}>Overview & Earnings</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        
        {/* --- PROFILE CARD --- */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile.name ? profile.name.charAt(0).toUpperCase() : "R"}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile.name || "Rider"}</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-sharp" size={14} color={COLORS.sub} />
              <Text style={styles.profileLoc}>{profile.location || "Unknown Location"}</Text>
            </View>
            <Text style={styles.profilePhone}>{profile.phone}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: profile.is_active ? '#DEF7EC' : '#FDE8E8' }]}>
            <Text style={[styles.statusText, { color: profile.is_active ? COLORS.success : COLORS.danger }]}>
              {profile.is_active ? "Active" : "Inactive"}
            </Text>
          </View>
        </View>

        {/* --- DATE SELECTOR --- */}
        <View style={styles.dateBar}>
          <TouchableOpacity onPress={() => changeDate(-1)} style={styles.arrowBtn}>
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          
          <View style={styles.dateCenter}>
            <MaterialCommunityIcons name="calendar-month-outline" size={20} color={COLORS.accent} />
            <Text style={styles.dateText}>{getReadableDate(selectedDate)}</Text>
          </View>

          <TouchableOpacity onPress={() => changeDate(1)} style={styles.arrowBtn}>
            <Ionicons name="chevron-forward" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* --- ORDER STATS GRID (Date Specific) --- */}
        <Text style={styles.sectionTitle}>Order Activity</Text>
        <View style={styles.grid}>
          <StatsCard 
            label="Delivered" 
            value={data.delivered} 
            icon="checkmark-circle" 
            color={COLORS.success} 
            bg="rgba(16, 185, 129, 0.1)"
          />
          <StatsCard 
            label="Returned" 
            value={data.returned} 
            icon="return-up-back" 
            color={COLORS.info} 
            bg="rgba(59, 130, 246, 0.1)"
          />
          <StatsCard 
            label="Failed" 
            value={data.failed} 
            icon="close-circle" 
            color={COLORS.danger} 
            bg="rgba(239, 68, 68, 0.1)"
          />
          <StatsCard 
            label="Rejected" 
            value={data.rejected} 
            icon="alert-circle" 
            color={COLORS.warning} 
            bg="rgba(245, 158, 11, 0.1)"
          />
        </View>

        {/* --- COD SECTION (Strict Financials) --- */}
        <Text style={styles.sectionTitle}>Cash Management</Text>
        
        {/* Cash In Hand Card (Most Important) */}
        <View style={styles.cashInHandCard}>
          <View style={styles.cihHeader}>
            <MaterialCommunityIcons name="hand-coin" size={28} color="#FFF" />
            <Text style={styles.cihTitle}>Cash in Hand</Text>
          </View>
          <Text style={styles.cihAmount}>{formatMoney(cod.cash_in_hand)}</Text>
          <Text style={styles.cihSub}>Amount to be settled with Admin</Text>
        </View>

        <View style={styles.financeRow}>
          <View style={styles.financeCard}>
            <Text style={styles.financeLabel}>Collected ({getReadableDate(selectedDate)})</Text>
            <Text style={[styles.financeValue, { color: COLORS.primary }]}>
              {formatMoney(cod.collected_date)}
            </Text>
          </View>

          <View style={styles.financeCard}>
            <Text style={styles.financeLabel}>Total Settled (Lifetime)</Text>
            <Text style={[styles.financeValue, { color: COLORS.success }]}>
              {formatMoney(cod.total_settled)}
            </Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// --- SUB-COMPONENT: STATS CARD ---
const StatsCard = ({ label, value, icon, color, bg }) => (
  <View style={[styles.statItem, { backgroundColor: COLORS.card }]}>
    <View style={[styles.iconWrap, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <View>
      <Text style={styles.statValue}>{value || 0}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  </View>
);

// --- STYLES ---
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: Platform.OS === 'android' ? 30 : 0 },
  
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: COLORS.bg,
  },
  headerTitle: { fontSize: 28, fontWeight: "bold", color: COLORS.primary },
  headerSub: { fontSize: 14, color: COLORS.sub, marginTop: 2 },
  logoutBtn: {
    padding: 10,
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
  },
  
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // Profile Card
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  avatarText: { color: "#FFF", fontSize: 20, fontWeight: "bold" },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  profileLoc: { fontSize: 13, color: COLORS.sub, marginLeft: 4 },
  profilePhone: { fontSize: 12, color: COLORS.sub, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: "600" },

  // Date Bar
  dateBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  arrowBtn: { padding: 10 },
  dateCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateText: { fontSize: 16, fontWeight: "600", color: COLORS.text },

  // Sections
  sectionTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginBottom: 12, marginLeft: 4 },

  // Stats Grid
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 24 },
  statItem: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginRight: 12 },
  statValue: { fontSize: 20, fontWeight: "800", color: COLORS.text },
  statLabel: { fontSize: 12, color: COLORS.sub, fontWeight: "500" },

  // Cash In Hand (Featured Card)
  cashInHandCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  cihHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  cihTitle: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "600", textTransform: "uppercase" },
  cihAmount: { color: "#FFF", fontSize: 36, fontWeight: "bold" },
  cihSub: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 4 },

  // Finance Row
  financeRow: { flexDirection: "row", justifyContent: "space-between" },
  financeCard: {
    width: "48%",
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  financeLabel: { fontSize: 12, color: COLORS.sub, marginBottom: 8, fontWeight: "600" },
  financeValue: { fontSize: 18, fontWeight: "800" },
});
