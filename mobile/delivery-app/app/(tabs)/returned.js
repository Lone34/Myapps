// app/(tabs)/returned.js
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Image,
  RefreshControl,
  TouchableOpacity,
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
  amber: "#F59E0B",
  green: "#22C55E",
};

export default function ReturnedHistoryScreen() {
  const router = useRouter();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReturns = async () => {
    try {
      // 🔥 UPDATED API URL
      const res = await client.get("/delivery/completed-returns/");
      setData(res.data);
    } catch (e) {
      console.log("Error fetching returns history:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchReturns(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReturns();
  }, []);

  const renderItem = ({ item }) => {
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.idBadge}>
            <Ionicons name="refresh" size={14} color={COLORS.green} />
            <Text style={styles.idText}>Return #{item.id}</Text>
          </View>
          <Text style={styles.date}>
            {new Date(item.completed_at).toLocaleDateString("en-IN", {
               day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
            })}
          </Text>
        </View>

        <View style={styles.locationRow}>
            <Ionicons name="storefront-outline" size={16} color={COLORS.text} />
            <View>
                <Text style={styles.shopName}>{item.shop_name}</Text>
                <Text style={styles.address}>{item.shop_address || "Address N/A"}</Text>
            </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.footer}>
             <Text style={styles.reasonLabel}>Items:</Text>
             <Text style={styles.reasonText}>{item.items_summary || "No item details"}</Text>
        </View>
        
        {item.reason && (
            <View style={{marginTop: 4, flexDirection: 'row', gap: 6}}>
                <Text style={styles.reasonLabel}>Reason:</Text>
                <Text style={styles.reasonText}>{item.reason}</Text>
            </View>
        )}
      </View>
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.text}/></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Returned History</Text>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={48} color={COLORS.sub} />
            <Text style={styles.emptyText}>No returns completed yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 16 },
  header: { marginTop: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: "900", color: COLORS.text },
  
  card: {
    backgroundColor: COLORS.card, borderRadius: 18, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.border, elevation: 2,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  
  idBadge: { 
    flexDirection: 'row', alignItems: 'center', gap: 6, 
    backgroundColor: COLORS.green + "15", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 
  },
  idText: { fontSize: 13, fontWeight: "800", color: COLORS.green },
  date: { fontSize: 12, color: COLORS.sub, fontWeight: "600" },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  shopName: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  address: { fontSize: 12, color: COLORS.sub },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },

  footer: { flexDirection: 'row', gap: 6 },
  reasonLabel: { fontSize: 12, fontWeight: "700", color: COLORS.sub },
  reasonText: { fontSize: 12, color: COLORS.text, flex: 1 },

  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyText: { marginTop: 10, fontSize: 14, fontWeight: "700", color: COLORS.sub },
});
