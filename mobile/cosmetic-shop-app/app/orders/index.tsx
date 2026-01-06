// app/orders/index.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import client from '../../src/api/client';

function getTotal(o: any): number {
  const v = o.totalPrice ?? o.total_price ?? o.total ?? o.total_amount ?? o.amount ?? 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

// ✅ Same logic as detail page
function isDelivered(o: any): boolean {
  if (!o) return false;

  if (o.isDelivered || o.is_delivered) return true;

  const st = String(
    o.delivery_status ||
    o.deliveryStatus ||
    o.status ||
    ''
  ).toLowerCase();

  return st === 'delivered';
}

// ✅ Treat COD + delivered as paid
function isPaid(o: any): boolean {
  if (!o) return false;

  // normal online-paid indicators
  if (o.isPaid || o.is_paid || o.paidAt || o.paid_at) {
    return true;
  }

  // COD → paid once delivered
  const methodRaw = o.payment_method || o.paymentMethod || '';
  const method = String(methodRaw).toLowerCase();

  if (method === 'cod' && isDelivered(o)) {
    return true;
  }

  return false;
}

// ✅ Any hard failure (failed / rejected / cancelled)
function isFailedStatus(o: any): boolean {
  if (!o) return false;
  const st = String(o.delivery_status || o.status || '').toLowerCase();

  return (
    st === 'failed' ||
    st === 'rejected' ||
    st === 'cancelled' ||
    st === 'canceled'
  );
}


export default function MyOrdersScreen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const { data } = await client.get('/api/orders/myorders/');
        setOrders(Array.isArray(data) ? data : data.orders || []);
      } catch (e: any) {
        setError('Could not load orders.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const renderOrder = ({ item }: { item: any }) => {
    const created = item.created_at || item.createdAt || item.date || '';
    const total = getTotal(item);
    const delivered = isDelivered(item);
    const paid = isPaid(item);
    const failed = isFailedStatus(item);
    return (
      <TouchableOpacity 
        activeOpacity={0.9}
        style={styles.orderCard} 
        onPress={() => router.push(`/orders/${item.id}`)}
      >
        <View style={styles.cardHeader}>
            <View>
                <Text style={styles.orderId}>Order #{item.id}</Text>
                <Text style={styles.date}>{created ? String(created).substring(0, 10) : ''}</Text>
            </View>
            <View style={styles.priceTag}>
                <Text style={styles.total}>₹{total.toFixed(0)}</Text>
            </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardFooter}>
          <View style={styles.statusRow}>
            {failed ? (
              // 🔴 Failed / rejected / cancelled → show ONLY FAILED
              <View style={[styles.statusChip, styles.bgRed]}>
                <Text style={[styles.statusText, styles.textRed]}>FAILED</Text>
              </View>
            ) : (
              <>
                {/* 💰 Paid / Unpaid (COD delivered counts as PAID) */}
                <View
                  style={[
                    styles.statusChip,
                    paid ? styles.bgGreen : styles.bgYellow,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      paid ? styles.textGreen : styles.textYellow,
                    ]}
                  >
                    {paid ? 'PAID' : 'UNPAID'}
                  </Text>
                </View>
        
                {/* 🚚 Delivery status */}
                <View
                  style={[
                    styles.statusChip,
                    delivered ? styles.bgGreen : styles.bgBlue,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      delivered ? styles.textGreen : styles.textBlue,
                    ]}
                  >
                    {delivered ? 'DELIVERED' : 'PROCESSING'}
                  </Text>
                </View>
              </>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      {/* Added marginTop to push header down */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{padding: 4}}>
             <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>My Orders</Text>
        
        <Link href="/my-returns" asChild>
          <TouchableOpacity style={styles.returnsBtn}>
            <Text style={styles.returnsText}>View Returns</Text>
            <Ionicons name="arrow-forward" size={12} color="#F57C00" style={{marginLeft: 4}} />
          </TouchableOpacity>
        </Link>
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#D4AF37" />
        </View>
      )}

      {!loading && error !== '' && (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      )}

      {!loading && !error && orders.length === 0 && (
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={64} color="#ccc" />
          <Text style={styles.empty}>You have no orders yet.</Text>
          <TouchableOpacity style={styles.shopBtn} onPress={() => router.push('/')}>
             <Text style={styles.shopBtnText}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && orders.length > 0 && (
        <FlatList
          data={orders}
          keyExtractor={(o) => String(o.id)}
          renderItem={renderOrder}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F9FA' },
  
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#eee',
    marginTop: Platform.OS === 'android' ? 40 : 0, // Pushed down for Android
  },
  title: { fontSize: 18, fontWeight: '700', color: '#333' },
  returnsBtn: { 
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 6, paddingHorizontal: 12, 
    backgroundColor: '#FFF3E0', borderRadius: 20,
    borderWidth: 1, borderColor: '#FFE0B2'
  },
  returnsText: { color: '#F57C00', fontSize: 12, fontWeight: '700' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: '#D32F2F' },
  empty: { color: '#888', marginTop: 16, fontSize: 16 },
  
  shopBtn: { marginTop: 20, backgroundColor: '#D4AF37', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  shopBtnText: { color: '#fff', fontWeight: '700' },

  listContent: { padding: 16, paddingBottom: 100 },
  
  // Card
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    shadowColor: "#000", shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderId: { fontSize: 16, fontWeight: '700', color: '#333' },
  date: { fontSize: 12, color: '#888', marginTop: 2 },
  priceTag: { backgroundColor: '#F5F5F5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  total: { fontSize: 14, fontWeight: '800', color: '#333' },
  
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 12 },
  
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  
  bgGreen: { backgroundColor: '#E8F5E9' },
  bgYellow: { backgroundColor: '#FFF8E1' },
  bgBlue: { backgroundColor: '#E3F2FD' },
  bgRed: { backgroundColor: '#FFEBEE' },   // NEW
  textRed: { color: '#D32F2F' },           // NEW

  
  statusText: { fontSize: 10, fontWeight: '700' },
  textGreen: { color: '#2E7D32' },
  textYellow: { color: '#FBC02D' },
  textBlue: { color: '#1565C0' },
});
