import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location'; // ✅ Import Location
import client from '../../../src/api/client';
import AppHeader from '../../../src/components/AppHeader';
import { useNavBar } from '../../../src/context/NavBarContext';
import AnimatedBackground from '../../../src/components/AnimatedBackground';

type Shop = {
  id: number;
  slug?: string;
  name: string;
  village?: string;
  city?: string;
  postal_code?: string;
  logo_url?: string | null;
  image_url?: string | null;
  cod_enabled?: boolean;
  returns_enabled?: boolean;
  distance_km?: number | null; // ✅ Added
  delivery_radius?: number;    // ✅ Added
};

type ShopsResponse =
  | {
      results: Shop[];
      page: number;
      pages: number;
      count: number;
    }
  | Shop[];

type Category = {
  id: number;
  name: string;
  slug: string;
  image_url?: string | null;
  shops_count?: number;
};

const CategoryShopsScreen: React.FC = () => {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { handleScroll: handleNavScroll } = useNavBar();

  const [category, setCategory] = useState<Category | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [count, setCount] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  
  // ✅ Location State
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);

  const extractShops = (data: ShopsResponse) => {
    if (Array.isArray(data)) {
      setShops(data);
      setCount(data.length);
    } else {
      setShops(data.results || []);
      setCount(typeof data.count === 'number' ? data.count : (data.results || []).length);
    }
  };

  // ✅ Get Location Function
  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // Permission denied, just load shops without distance sorting
        return null;
      }
      const location = await Location.getCurrentPositionAsync({});
      const coords = { lat: location.coords.latitude, lon: location.coords.longitude };
      setUserLocation(coords);
      return coords;
    } catch (e) {
      console.log('Location error:', e);
      return null;
    }
  };

  const load = async (isRefresh = false) => {
    if (!slug) return;
    try {
      if (!isRefresh) setLoading(true);
      setError('');

      // ✅ 1. Get location first (only on initial load or refresh)
      let currentLoc = userLocation;
      if (!currentLoc && (isRefresh || loading)) {
         currentLoc = await getLocation();
      }

      // 2. Load Category Info
      const catRes = await client.get<Category>(`/api/shop-categories/${slug}/`);
      setCategory(catRes.data);

      // 3. Prepare Params
      const params: any = { category: slug, page: 1, page_size: 24 };
      if (currentLoc) {
        params.lat = currentLoc.lat;
        params.lon = currentLoc.lon;
      }

      // 4. Load Shops
      const shopsRes = await client.get<ShopsResponse>('/api/shops/', { params });
      extractShops(shopsRes.data);

    } catch (e) {
      setError('Failed to load shops for this category.');
      setShops([]);
      setCount(null);
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const initial = (name?: string) =>
    name && name.trim().length > 0 ? name.trim()[0].toUpperCase() : 'S';

  const goToShop = (shop: Shop) => {
    const slugOrId = shop.slug || shop.id;
    router.push(`/shop/${slugOrId}`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <AnimatedBackground />

      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <AppHeader placeholder="Search shops, products..." />

      <View style={styles.topRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {category?.name || String(slug || 'Category')}
          </Text>
          {count !== null && (
            <Text style={styles.subtitle}>{count} shops</Text>
          )}
        </View>
      </View>

      {category?.image_url ? (
        <View style={styles.bannerWrap}>
          <Image source={{ uri: category.image_url }} style={styles.bannerImg} resizeMode="cover" />
          <View style={styles.bannerOverlay} />
          <Text style={styles.bannerText} numberOfLines={1}>
            {category.name}
          </Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4AF37" />
        }
        showsVerticalScrollIndicator={false}
        onScroll={handleNavScroll}
        scrollEventThrottle={16}
      >
        {loading && !shops.length ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#D4AF37" />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : shops.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No shops found in this category.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {shops.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.card}
                onPress={() => goToShop(s)}
                activeOpacity={0.9}
              >
                {s.logo_url || s.image_url ? (
                  <Image
                    source={{ uri: (s.logo_url || s.image_url)! }}
                    style={styles.image}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.initialWrapper}>
                    <Text style={styles.initialText}>{initial(s.name)}</Text>
                  </View>
                )}

                <View style={styles.cardBody}>
                  <Text style={styles.shopName} numberOfLines={2}>
                    {s.name}
                  </Text>
                  <Text style={styles.shopMeta} numberOfLines={1}>
                    {s.village || s.city || s.postal_code
                      ? [s.village, s.city, s.postal_code].filter(Boolean).join(', ')
                      : 'View shop'}
                  </Text>

                  {/* ✅ Badge Row with Distance Logic */}
                  <View style={styles.badgeRow}>
                    
                    {/* 1. Distance Badge */}
                    {s.distance_km != null && (
                      <View style={[styles.badgePill, styles.badgeBlue]}>
                        <Ionicons name="location-sharp" size={10} color="#60A5FA" style={{ marginRight: 2 }} />
                        <Text style={[styles.badgeText, styles.badgeTextBlue]}>
                          {s.distance_km.toFixed(1)} km
                        </Text>
                      </View>
                    )}

                    {/* 2. Extended Delivery Radius Badge */}
                    {s.delivery_radius && s.delivery_radius > 15 && (
                      <View style={[styles.badgePill, styles.badgeGreen]}>
                         <Text style={[styles.badgeText, styles.badgeTextGreen]}>
                          Delivers up to {s.delivery_radius}km
                        </Text>
                      </View>
                    )}

                    {/* 3. Existing COD/Return Badges */}
                    {s.cod_enabled === false && (
                      <View style={[styles.badgePill, styles.badgeRed]}>
                        <Text style={[styles.badgeText, styles.badgeTextRed]}>No COD</Text>
                      </View>
                    )}
                    {s.returns_enabled === false && (
                      <View style={[styles.badgePill, styles.badgeOrange]}>
                        <Text style={[styles.badgeText, styles.badgeTextOrange]}>No Returns</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default CategoryShopsScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#001A33' },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  subtitle: { color: '#D1D5DB', fontSize: 12, marginTop: 2 },

  bannerWrap: {
    marginHorizontal: 12,
    borderRadius: 16,
    overflow: 'hidden',
    height: 140,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    marginBottom: 10,
  },
  bannerImg: { width: '100%', height: '100%' },
  bannerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 70,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  bannerText: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    right: 12,
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },

  scrollContent: { padding: 12, paddingBottom: 40 },

  center: { paddingVertical: 50, alignItems: 'center' },
  emptyText: { color: '#CCCCCC', fontSize: 14 },
  errorText: { color: '#FFCDD2', fontSize: 14, textAlign: 'center' },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  card: {
    width: '48%',
    borderRadius: 14,
    marginBottom: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  image: { width: '100%', height: 160, backgroundColor: '#0B1220' },
  initialWrapper: {
    width: '100%',
    height: 160,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: { fontSize: 32, fontWeight: '700', color: '#D4AF37' },

  cardBody: { padding: 10 },
  shopName: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  shopMeta: { color: '#D1D5DB', fontSize: 11 },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    marginTop: 2,
  },
  badgeRed: { backgroundColor: 'rgba(244,67,54,0.15)' },
  badgeOrange: { backgroundColor: 'rgba(255,152,0,0.15)' },
  badgeBlue: { backgroundColor: 'rgba(37, 99, 235, 0.2)' },
  badgeGreen: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },

  badgeText: { fontSize: 10, fontWeight: '600' },
  badgeTextRed: { color: '#FF8A80' },
  badgeTextOrange: { color: '#FFCC80' },
  badgeTextBlue: { color: '#93C5FD' },
  badgeTextGreen: { color: '#6EE7B7' },
});
