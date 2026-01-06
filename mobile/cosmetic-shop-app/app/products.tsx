// app/products.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import client from '../src/api/client';

type Product = {
  id: number;
  name: string;
  price: number;
  mrp?: number | null;
  image?: string;
  calculated_discount_percent?: number | null;
};

export default function ProductsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const title = Array.isArray(params.title) ? params.title[0] : params.title || 'Products';
  const recoType = Array.isArray(params.recoType) ? params.recoType[0] : params.recoType;
  const baseProductId = Array.isArray(params.baseProductId) ? params.baseProductId[0] : params.baseProductId;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        // Recommendations endpoint returns a flat list array
        // We request limit=24 because that's the backend's max cap.
        const { data } = await client.get('/api/recommendations/', {
            params: {
                type: recoType || 'behavioral',
                limit: 24, 
                for_products: baseProductId || undefined
            }
        });
        
        const list = Array.isArray(data) ? data : [];
        setProducts(list);
      } catch (e) {
        setError('Failed to load products.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [recoType, baseProductId]);

  const renderItem = ({ item }: { item: Product }) => {
    const imageUrl = item.image || 'https://via.placeholder.com/400x400.png?text=Product';
    const price = Number(item.price || 0);
    const mrp = Number(item.mrp || 0);
    
    const hasDiscount = (item.calculated_discount_percent && item.calculated_discount_percent > 0) || (mrp > price && price > 0);
    const discountPercent = item.calculated_discount_percent 
        ? Math.round(item.calculated_discount_percent)
        : hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => router.push(`/product/${item.id}`)}
      >
        <View style={styles.imageWrap}>
            <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
        </View>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        <View style={styles.priceRow}>
            <Text style={styles.price}>₹{price.toFixed(0)}</Text>
            {hasDiscount && mrp > price && (
                <>
                    <Text style={styles.mrp}>₹{mrp.toFixed(0)}</Text>
                    <Text style={styles.discount}>{discountPercent}% OFF</Text>
                </>
            )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}><ActivityIndicator size="large" color="#D4AF37" /></View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{padding: 4}}>
             <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={{ width: 24 }} />
      </View>

      {error ? (
        <View style={styles.center}><Text style={styles.error}>{error}</Text></View>
      ) : !products.length ? (
        <View style={styles.center}>
             <Ionicons name="cube-outline" size={64} color="#ccc" />
             <Text style={styles.subtle}>No products found.</Text>
        </View>
      ) : (
        <FlatList
            data={products}
            keyExtractor={(item) => String(item.id)}
            numColumns={2}
            renderItem={renderItem}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={{ justifyContent: 'space-between' }}
            showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#eee', elevation: 2
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#333', maxWidth: '80%' },

  grid: { padding: 16, paddingBottom: 40 },

  card: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    marginBottom: 16,
    shadowColor: "#000", shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2
  },
  imageWrap: {
    width: '100%', height: 130,
    borderRadius: 8, backgroundColor: '#f9f9f9',
    marginBottom: 8, justifyContent: 'center', alignItems: 'center'
  },
  image: { width: '100%', height: '100%' },
  name: { fontSize: 12, fontWeight: '500', color: '#333', marginBottom: 4, height: 32 },
  
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  price: { fontSize: 14, fontWeight: '700', color: '#000', marginRight: 6 },
  mrp: { fontSize: 11, color: '#999', textDecorationLine: 'line-through', marginRight: 6 },
  discount: { fontSize: 11, color: '#E04F5F', fontWeight: '700' },

  subtle: { marginTop: 10, color: '#888', fontSize: 14 },
  error: { color: '#E04F5F', fontSize: 14 },
});
