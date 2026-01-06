import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import client from "../src/api/client"; 

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  text: "#111827",
  sub: "#6B7280",
  border: "rgba(17,24,39,0.10)",
  green: "#22C55E",
  amber: "#F59E0B",
  red: "#EF4444",
};

export default function PayoutHistoryScreen() {
  const router = useRouter();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get("/api/rider/payout-history/")
      .then(res => setData(res.data))
      .catch(e => console.log(e))
      .finally(() => setLoading(false));
  }, []);

  const renderItem = ({ item }) => {
    const isPaid = item.status === 'paid';
    const isPending = item.status === 'pending';
    
    let statusColor = COLORS.sub;
    let icon = "time-outline";
    
    if (isPaid) { statusColor = COLORS.green; icon = "checkmark-circle"; }
    else if (isPending) { statusColor = COLORS.amber; icon = "hourglass-outline"; }
    else { statusColor = COLORS.red; icon = "close-circle"; }

    return (
      <View style={styles.card}>
        <View style={styles.row}>
            <View>
                <Text style={styles.amount}>₹{Number(item.amount).toFixed(2)}</Text>
                <Text style={styles.date}>
                    {new Date(item.created_at).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                    })}
                </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
                <Ionicons name={icon} size={14} color={statusColor} />
                <Text style={[styles.statusText, { color: statusColor }]}>{item.status.toUpperCase()}</Text>
            </View>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.row}>
            <Text style={styles.meta}>Batch: {item.orders_count} Orders</Text>
            {isPaid && item.processed_at && (
                <Text style={styles.meta}>Paid: {new Date(item.processed_at).toLocaleDateString()}</Text>
            )}
        </View>
        
        {item.admin_note && (
            <View style={styles.noteBox}>
                <Text style={styles.noteText}>Note: {item.admin_note}</Text>
            </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Payout History</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.text} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <Text style={styles.empty}>No payout requests found.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 10, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  
  card: {
    backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount: { fontSize: 18, fontWeight: "900", color: COLORS.text },
  date: { fontSize: 12, color: COLORS.sub, marginTop: 2 },
  
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: "800" },
  
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  meta: { fontSize: 12, fontWeight: "600", color: COLORS.sub },
  
  noteBox: { marginTop: 10, padding: 8, backgroundColor: COLORS.bg, borderRadius: 8 },
  noteText: { fontSize: 12, color: COLORS.text, fontStyle: 'italic' },
  
  empty: { textAlign: 'center', marginTop: 40, color: COLORS.sub, fontWeight: "600" }
});
