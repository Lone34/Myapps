// app/category/index.tsx
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
import client from '../../src/api/client';

type Product = {
  id: number;
  name: string;
  image?: string | null;
  price?: any;
  mrp?: any;
  calculated_discount_percent?: any;
};

export default function CategoryIndexScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Normalize params
  const search = Array.isArray(params.search) ? params.search[0] : params.search;
  const section = Array.isArray(params.section) ? params.section[0] : params.section;
  const urlParam = Array.isArray(params.url) ? params.url[0] : params.url;

  const [title, setTitle] = useState('Products');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isPaginated, setIsPaginated] = useState(false); // Track if endpoint supports pages

  useEffect(() => {
    setProducts([]);
    setPage(1);
    setHasMore(false);
    fetchData(1);
  }, [search, section, urlParam]);

  const fetchData = async (pageNum: number) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      setError('');

      let endpoint = '/api/products/';
      let query: any = { page: pageNum, page_size: 25 }; // Backend Limit
      let label = 'Products';

      // 1. Determine Endpoint
      if (section === 'hot_deals') {
        endpoint = '/api/products/hot-deals/';
        label = 'Hot Deals';
        // Hot Deals is usually a fixed list, no pagination in standard view
        delete query.page; 
        delete query.page_size;
      } else if (section === 'new_arrivals') {
        endpoint = '/api/products/new-arrivals/';
        label = 'New Arrivals';
        delete query.page;
        delete query.page_size;
      } else if (section === 'todays_special') {
        endpoint = '/api/products/todays-special/';
        label = "Today's Special";
      } else if (search) {
        endpoint = '/api/products/';
        query.keyword = search; // Use 'keyword' for search in your backend
        label = `Search: ${search}`;
      } else if (urlParam) {
         // Handle special URLs
         label = 'Collection';
         // Add logic if needed
      }

      if (pageNum === 1) setTitle(label);

      console.log(`Fetching ${label} from ${endpoint}`);
      let res;
      try {
         res = await client.get(endpoint, { params: query });
      } catch(err: any) {
         // Fallback for Today's Special if endpoint missing
         if (section === 'todays_special') {
             res = await client.get('/api/products/', { params: { ...query, ordering: '-created_at' } });
         } else {
             throw err;
         }
      }

      const data = res.data;
      let newItems: Product[] = [];
      let nextExists = false;

      // 2. Handle Response Format (List vs Pagination)
      if (Array.isArray(data)) {
         // It's a flat list (Hot Deals / New Arrivals)
         newItems = data;
         nextExists = false; // Disable load more for flat lists
         if (pageNum === 1) setIsPaginated(false);
      } else {
         // It's paginated (Search / Products)
         newItems = data.results || data.products || [];
         nextExists = !!data.next;
         if (pageNum === 1) setIsPaginated(true);
      }

      if (pageNum === 1) {
        setProducts(newItems);
      } else {
        setProducts(prev => [...prev, ...newItems]);
      }
      
      setHasMore(nextExists);

    } catch (err: any) {
      console.error('Category index error', err);
      if (pageNum === 1) {
          setError('Failed to load products. Please check your connection.');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!loading && !loadingMore && hasMore && isPaginated) {
      const next = page + 1;
      setPage(next);
      fetchData(next);
    }
  };

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

  const renderFooter = () => {
      if (!loadingMore) return <View style={{height: 40}} />;
      return <View style={styles.footerLoader}><ActivityIndicator size="small" color="#D4AF37" /></View>;
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
            keyExtractor={(item, index) => String(item.id) + index}
            numColumns={2}
            renderItem={renderItem}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={{ justifyContent: 'space-between' }}
            showsVerticalScrollIndicator={false}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FA' },
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
  footerLoader: { paddingVertical: 20, alignItems: 'center' }
});
