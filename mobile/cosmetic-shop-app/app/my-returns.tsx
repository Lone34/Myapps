// app/my-returns.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  StyleSheet,
} from 'react-native';
import client from '../src/api/client';

export default function MyReturnsScreen() {
  const [returnsData, setReturnsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const { data } = await client.get('/api/returns/my/');
        setReturnsData(Array.isArray(data) ? data : []);
      } catch (e: any) {
        console.log('Returns load error', e?.response?.data || e?.message);
        setError('Could not load returns.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <Text style={styles.order}>Order #{item.order_id}</Text>
      <Text style={styles.status}>Status: {item.status}</Text>
      <Text style={styles.meta}>
        Created: {String(item.created_at || '').substring(0, 10)}
      </Text>
      {item.reason && (
        <Text style={styles.meta} numberOfLines={2}>
          Reason: {item.reason}
        </Text>
      )}
    </View>
  );

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>My Returns</Text>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      )}

      {!loading && error !== '' && (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      )}

      {!loading && !error && returnsData.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.empty}>You have no return requests.</Text>
        </View>
      )}

      {!loading && !error && returnsData.length > 0 && (
        <FlatList
          data={returnsData}
          keyExtractor={(r) => String(r.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  center: { alignItems: 'center', paddingTop: 24 },
  error: { color: '#ff4d4f' },
  empty: { color: '#9ca3af' },
  card: {
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#101010',
  },
  order: { color: '#fff', fontWeight: '600', marginBottom: 2 },
  status: { color: '#f97316', fontSize: 12 },
  meta: { color: '#9ca3af', fontSize: 11 },
});
