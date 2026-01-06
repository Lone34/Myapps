// app/listing.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image'; 
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import client from '../src/api/client';
import AppHeader from '../src/components/AppHeader';
import AnimatedBackground from '../src/components/AnimatedBackground';
import { useNavBar } from '../src/context/NavBarContext';
import { useGlobalLocation } from '../src/context/LocationContext';

const { width } = Dimensions.get('window');

// --- Helper: Clean Numbers ---
const toNumber = (value: any) => {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(typeof value === 'string' ? value.replace(/[^0-9.-]/g, '') : value);
  return Number.isFinite(n) ? n : 0;
};

// --- Helper: Distance ---
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

type Product = {
  id: number;
  name: string;
  price: number;
  mrp?: number | null;
  image?: string;
  images?: { image: string }[];
  calculated_discount_percent?: number | null;
  shop?: {
    id: number;
    name: string;
    distance_km?: number | null;
    latitude?: string | number;
    longitude?: string | number;
    delivery_radius?: number;
  };
  distance_km?: number | null;
};

export default function ListingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { handleScroll: handleNavScroll } = useNavBar();
  const { location: userLocation } = useGlobalLocation();

  // --- PARAMS ---
  const title = (Array.isArray(params.title) ? params.title[0] : params.title) || 'Products';
  const type = Array.isArray(params.type) ? params.type[0] : params.type;
  const key = Array.isArray(params.key) ? params.key[0] : params.key;
  const baseProductId = Array.isArray(params.baseProductId) ? params.baseProductId[0] : params.baseProductId;

  // --- STATE ---
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Use a ref to prevent double-fetching
  const isFetchingRef = useRef(false);

  // Handle passed-in products (e.g. from an ad)
  const initialProductsRef = useRef<Product[]>([]);
  if (params.products && initialProductsRef.current.length === 0) {
    try {
      const raw = Array.isArray(params.products) ? params.products[0] : params.products;
      if (raw) initialProductsRef.current = JSON.parse(raw);
    } catch (e) {
      console.log("JSON Parse error:", e);
    }
  }

  // --- FETCH LOGIC ---
  const fetchData = async (pageNum: number, isRefresh = false) => {
    // Prevent fetching if already busy or if no more data (unless refreshing)
    if (isFetchingRef.current) return;
    if (!hasMore && pageNum > 1 && !isRefresh) return;

    // Use passed products if available
    if (type === 'ad_products' && initialProductsRef.current.length > 0) {
      setProducts(initialProductsRef.current);
      setLoading(false);
      setHasMore(false);
      return;
    }

    try {
      isFetchingRef.current = true; // Lock
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      setError('');

      let endpoint = '/api/products/';
      let query: any = { page: pageNum, page_size: 24 };

      // Add location
      if (userLocation) {
        query.lat = userLocation.lat;
        query.lon = userLocation.lon;
      }

      // Route Logic
      if (type === 'section') {
        if (key === 'hot_deals') endpoint = '/api/products/hot-deals/';
        else if (key === 'new_arrivals') endpoint = '/api/products/new-arrivals/';
        else if (key === 'todays_special') endpoint = '/api/products/todays-special/';
      } else if (type === 'reco') {
        endpoint = '/api/recommendations/';
        query = { 
          ...query, 
          type: key, 
          limit: 30, 
          context: 'listing', 
          for_products: baseProductId 
        };
      } else if (type === 'search') {
        endpoint = '/api/search/unified/'; 
        query.q = key;
      } else if (type === 'nearby') {
        endpoint = '/api/recommendations/nearby-products/';
        query.limit = 50;
      }

      console.log(`[Listing] Fetching: ${endpoint} Page: ${pageNum}`);

      let res;
      try {
        res = await client.get(endpoint, { params: query });
      } catch (err: any) {
        // 🛡️ HANDLE 404 (Page Not Found) AS END OF LIST
        if (err.response && err.response.status === 404) {
            console.log("Page not found, assuming end of list.");
            setHasMore(false);
            setLoadingMore(false);
            setLoading(false);
            isFetchingRef.current = false;
            return; // Stop here
        }

        // Fallback for todays_special if endpoint missing
        if (key === 'todays_special') {
          res = await client.get('/api/products/', { params: { ordering: '-created_at', page_size: 24 } });
        } else {
          throw err;
        }
      }

      const data = res.data;
      let newItems: Product[] = [];
      let nextExists = false;

      if (Array.isArray(data)) {
        newItems = data;
        // If array is smaller than page_size, we reached the end
        nextExists = newItems.length >= 24; 
      } else {
        newItems = data.results || data.products || [];
        nextExists = !!data.next;
        // If "next" url is null, OR items are fewer than requested, assume end
        if (!data.next || newItems.length < 24) nextExists = false;
        // Exception: if exactly 24 items and no next link provided by some APIs
        if (!data.next && newItems.length === 24) nextExists = false; 
      }

      if (pageNum === 1) {
        setProducts(newItems);
      } else {
        setProducts((prev) => {
          const currentIds = new Set(prev.map((p) => p.id));
          const uniqueNew = newItems.filter((p) => !currentIds.has(p.id));
          return [...prev, ...uniqueNew];
        });
      }
      
      setHasMore(nextExists);

    } catch (err) {
      console.error('Listing Error:', err);
      if (pageNum === 1) setError('Could not load products.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isFetchingRef.current = false; // Unlock
    }
  };

  useEffect(() => {
    setProducts([]);
    setPage(1);
    setHasMore(true);
    fetchData(1, true);
  }, [type, key, baseProductId, userLocation]);

  const loadNextPage = () => {
    if (!loading && !loadingMore && hasMore) {
      const next = page + 1;
      setPage(next);
      fetchData(next);
    }
  };

  // --- RENDER ITEM ---
  const renderItem = ({ item }: { item: Product }) => {
    const imgSource = item.images?.[0]?.image || item.image || null;
    const price = toNumber(item.price);
    const mrp = toNumber(item.mrp);
    const showDiscount = mrp > price;
    const discount = showDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0;

    let distanceKm = item.shop?.distance_km ?? item.distance_km ?? null;
    if (distanceKm === null && userLocation && item.shop?.latitude && item.shop?.longitude) {
      distanceKm = getDistanceFromLatLonInKm(
        userLocation.lat,
        userLocation.lon,
        Number(item.shop.latitude),
        Number(item.shop.longitude)
      );
    }

    let isDeliverable = false;
    if (distanceKm !== null) {
      const radius = item.shop?.delivery_radius || 15;
      isDeliverable = distanceKm <= radius;
    }

    return (
      <TouchableOpacity
        style={styles.cardContainer}
        activeOpacity={0.8}
        onPress={() =>
          router.push({
            pathname: '/product/[id]',
            params: {
              id: item.id,
              lat: userLocation?.lat,
              lon: userLocation?.lon,
            },
          })
        }
      >
        <View style={styles.cardContent}>
          <View style={styles.imageWrapper}>
            {imgSource ? (
              <Image
                source={{ uri: imgSource }}
                style={styles.productImage}
                contentFit="cover"
                transition={300}
              />
            ) : (
              <View style={styles.placeholderImage} />
            )}
            {showDiscount && discount > 0 && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>{discount}%</Text>
              </View>
            )}
          </View>

          <View style={styles.infoWrapper}>
            {distanceKm !== null && (
              <View style={styles.badgeRow}>
                <Ionicons 
                  name={isDeliverable ? "checkmark-circle" : "close-circle"} 
                  size={10} 
                  color={isDeliverable ? "#4ADE80" : "#F87171"} 
                />
                <Text style={[styles.badgeText, { color: isDeliverable ? "#4ADE80" : "#F87171" }]}>
                  {isDeliverable ? "Deliverable" : "No Delivery"}
                </Text>
              </View>
            )}

            <Text numberOfLines={2} style={styles.productName}>{item.name}</Text>

            <View style={styles.priceRow}>
              <View style={styles.priceBlock}>
                <Text style={styles.price}>₹{price.toFixed(0)}</Text>
                {showDiscount && <Text style={styles.mrp}>₹{mrp.toFixed(0)}</Text>}
              </View>
              {distanceKm !== null && (
                <Text style={styles.distanceText}>{distanceKm.toFixed(1)} km</Text>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // --- FOOTER (BUTTON LOGIC) ---
  const renderFooter = () => {
    if (loadingMore) {
        return (
            <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#D4AF37" />
                <Text style={styles.loadingText}>Loading more...</Text>
            </View>
        );
    }

    if (!hasMore && products.length > 0) {
        return (
            <View style={styles.footerLoader}>
                <Ionicons name="checkmark-done-circle" size={24} color="#64748B" />
                <Text style={styles.endText}>You've reached the end</Text>
            </View>
        );
    }

    if (hasMore && products.length > 0) {
        return (
            <View style={styles.footerContainer}>
                <TouchableOpacity onPress={loadNextPage} style={styles.loadMoreBtn} activeOpacity={0.8}>
                    <Text style={styles.loadMoreText}>Load Next Page</Text>
                    <Ionicons name="arrow-down" size={16} color="#000" style={{marginLeft: 6}} />
                </TouchableOpacity>
            </View>
        );
    }

    return <View style={{ height: 80 }} />;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AnimatedBackground />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#D4AF37" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <AnimatedBackground />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <AppHeader />

      <View style={styles.glassHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      </View>

      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchData(1, true)} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !products.length ? (
        <View style={styles.center}>
          <Ionicons name="cube-outline" size={64} color="#334155" />
          <Text style={styles.emptyText}>No items found.</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          numColumns={2}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          showsVerticalScrollIndicator={false}
          onScroll={handleNavScroll}
          scrollEventThrottle={16}
          // Removed onEndReached to stop auto-scroll issues
          ListFooterComponent={renderFooter}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#020617' }, 
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  glassHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
  },
  backBtn: { padding: 4, marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#F8FAFC', flex: 1 },

  listContent: { padding: 12, paddingBottom: 100 },

  cardContainer: {
    width: '48%',
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  cardContent: { padding: 4 },
  imageWrapper: {
    height: 170,
    width: '100%',
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  productImage: { width: '100%', height: '100%' },
  placeholderImage: { width: '100%', height: '100%', backgroundColor: '#334155' },
  
  discountBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#FF007F',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountText: { color: '#FFF', fontSize: 10, fontWeight: '800' },

  infoWrapper: { paddingHorizontal: 2 },
  
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  badgeText: { fontSize: 9, fontWeight: '700', marginLeft: 4 },

  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 4,
    lineHeight: 18,
    minHeight: 36,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  priceBlock: { flexDirection: 'row', alignItems: 'baseline' },
  price: { fontSize: 15, fontWeight: '700', color: '#F8FAFC', marginRight: 6 },
  mrp: { fontSize: 11, color: '#94A3B8', textDecorationLine: 'line-through' },
  distanceText: { fontSize: 10, color: '#38BDF8', fontWeight: '600' },

  errorText: { color: '#EF4444', fontSize: 14, marginBottom: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#D4AF37', borderRadius: 20 },
  retryText: { color: '#000', fontWeight: '700' },
  emptyText: { color: '#64748B', marginTop: 12, fontSize: 14 },

  // --- FOOTER BUTTON STYLES ---
  footerContainer: {
      paddingVertical: 30,
      alignItems: 'center',
      width: '100%',
  },
  loadMoreBtn: {
      backgroundColor: '#D4AF37',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 30,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#D4AF37',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
  },
  loadMoreText: {
      color: '#000',
      fontWeight: '800',
      fontSize: 13,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
  },
  footerLoader: { 
      paddingVertical: 30, 
      alignItems: 'center', 
      justifyContent: 'center',
      opacity: 0.8
  },
  loadingText: {
      color: '#D4AF37',
      fontSize: 12,
      marginTop: 8,
      fontWeight: '600'
  },
  endText: {
      color: '#64748B',
      fontSize: 12,
      marginTop: 6,
      fontWeight: '500',
      fontStyle: 'italic'
  }
});
