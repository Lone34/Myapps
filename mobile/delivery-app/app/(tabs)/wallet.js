import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Alert,
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
  green: "#22C55E",
  blue: "#3B82F6",
  red: "#EF4444",
};

export default function WalletScreen() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [btnLoading, setBtnLoading] = useState(false);

  const fetchWallet = async () => {
    try {
      const res = await client.get("/api/rider/wallet/");
      setData(res.data);
    } catch (e) {
      console.log("Wallet fetch error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchWallet(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchWallet();
  }, []);

  const handleRequestPayout = async () => {
    Alert.alert(
      "Confirm Payout",
      "Request payout for your oldest 20 orders?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Request",
          onPress: async () => {
            setBtnLoading(true);
            try {
              await client.post("/api/rider/payout/");
              Alert.alert("Success", "Payout request sent! Check History tab.");
              fetchWallet(); 
            } catch (e) {
              Alert.alert("Error", e.response?.data?.detail || "Request failed");
            } finally {
              setBtnLoading(false);
            }
          },
        },
      ]
    );
  };

  // Helper date formatter
  const fmtDate = (dateStr) => {
    if(!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    });
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.text} /></View>;

  const unpaidCount = data?.unpaid_orders_count || 0;
  const target = 20;
  const canWithdraw = unpaidCount >= target;
  const progress = Math.min(100, (unpaidCount / target) * 100);
  
  // Get transactions from API (or empty array if undefined)
  const transactions = data?.recent_transactions || [];

  return (
    <ScrollView 
      style={styles.container} 
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Earnings</Text>
        <TouchableOpacity 
            style={styles.historyBtn} 
            onPress={() => router.push("/payouts")}
        >
            <Ionicons name="time-outline" size={20} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceValue}>₹{Number(data?.available_balance || 0).toFixed(2)}</Text>
        <Text style={styles.balanceSub}>For {unpaidCount} unpaid orders</Text>
        
        {/* Payout / Lock Logic */}
        {canWithdraw ? (
            <TouchableOpacity 
              style={[styles.actionBtn, btnLoading && { opacity: 0.7 }]}
              onPress={handleRequestPayout}
              disabled={btnLoading}
            >
              {btnLoading ? <ActivityIndicator color="#fff" size="small"/> : <Ionicons name="card-outline" size={18} color="#fff" />}
              <Text style={styles.actionBtnText}>Request Payout (20 Orders)</Text>
            </TouchableOpacity>
        ) : (
            <View style={styles.lockedBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.lockedTitle}>Unlock Payout</Text>
                  <Text style={styles.lockedCount}>{unpaidCount}/{target}</Text>
              </View>
              <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.lockedSub}>
                  Complete {target - unpaidCount} more orders to request next batch.
              </Text>
            </View>
        )}
      </View>

      {/* NEW: Recent Transactions List */}
      {transactions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {transactions.map((txn, index) => (
            <View key={index} style={styles.txnRow}>
               <View style={[styles.txnIcon, { backgroundColor: txn.amount < 0 ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)" }]}>
                  <Ionicons 
                    name={txn.amount < 0 ? "remove" : "add"} 
                    size={18} 
                    color={txn.amount < 0 ? COLORS.red : COLORS.green} 
                  />
               </View>
               <View style={{ flex: 1 }}>
                  <Text style={styles.txnDesc} numberOfLines={1}>{txn.description}</Text>
                  <Text style={styles.txnDate}>{fmtDate(txn.created_at)}</Text>
               </View>
               <Text style={[styles.txnAmount, { color: txn.amount < 0 ? COLORS.red : COLORS.green }]}>
                 {txn.amount < 0 ? "-" : "+"}₹{Math.abs(txn.amount)}
               </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={20} color={COLORS.sub} />
        <Text style={styles.infoText}>
            Your balance only shows orders that haven't been requested yet. Once you request a payout, those 20 orders move to the "History" tab.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 16 },
  header: { marginTop: 14, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: "900", color: COLORS.text },
  historyBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  
  balanceCard: {
    backgroundColor: COLORS.card, borderRadius: 22, padding: 24, marginBottom: 24,
    borderWidth: 1, borderColor: COLORS.border, elevation: 2,
  },
  balanceLabel: { fontSize: 13, fontWeight: "700", color: COLORS.sub, textTransform: "uppercase" },
  balanceValue: { fontSize: 42, fontWeight: "900", color: COLORS.text, marginTop: 8 },
  balanceSub: { fontSize: 14, fontWeight: "600", color: COLORS.green, marginBottom: 20 },
  
  actionBtn: {
    backgroundColor: COLORS.text, paddingVertical: 14, borderRadius: 14, 
    flexDirection: "row", alignItems: "center", justifyContent: 'center', gap: 8
  },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  lockedBox: {
    backgroundColor: COLORS.bg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(0,0,0,0.03)"
  },
  lockedTitle: { fontSize: 13, fontWeight: "800", color: COLORS.text },
  lockedCount: { fontSize: 13, fontWeight: "800", color: COLORS.blue },
  lockedSub: { fontSize: 12, color: COLORS.sub, marginTop: 8 },
  progressBarBg: { height: 8, backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 10, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: COLORS.blue, borderRadius: 10 },

  // Recent Activity Styles
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text, marginBottom: 12 },
  txnRow: { 
    flexDirection: 'row', alignItems: 'center', gap: 12, 
    backgroundColor: COLORS.card, padding: 12, marginBottom: 8, 
    borderRadius: 14, borderWidth: 1, borderColor: COLORS.border 
  },
  txnIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  txnDesc: { fontSize: 13, fontWeight: "700", color: COLORS.text, flex: 1 },
  txnDate: { fontSize: 11, color: COLORS.sub, marginTop: 2 },
  txnAmount: { fontSize: 15, fontWeight: "800" },

  infoBox: { flexDirection: 'row', gap: 10, padding: 12, backgroundColor: "rgba(59,130,246,0.08)", borderRadius: 12 },
  infoText: { flex: 1, fontSize: 13, color: COLORS.sub, lineHeight: 18 },
});
