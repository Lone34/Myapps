// app/shops/all.tsx
import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import client from '../../src/api/client';
import AppHeader from '../../src/components/AppHeader';
import { useNavBar } from '../../src/context/NavBarContext';
import AnimatedBackground from '../../src/components/AnimatedBackground';

type Shop = {
  id: number;
  slug?: string;
  name: string;
  village?: string;
  city?: string;
  postal_code?: string;
  address_line1?: string;
  logo_url?: string | null;
  image_url?: string | null;
  cod_enabled?: boolean;
  returns_enabled?: boolean;
};

type ShopsResponse =
  | {
      results: Shop[];
      page: number;
      pages: number;
      count: number;
    }
  | Shop[];

const AllShopsScreen: React.FC = () => {
  const router = useRouter();
  const { handleScroll: handleNavScroll } = useNavBar();

  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [count, setCount] = useState<number | null>(null);

  const extractShops = (data: ShopsResponse) => {
    if (Array.isArray(data)) {
      setShops(data);
      setCount(data.length);
    } else {
      setShops(data.results || []);
      setCount(
        typeof data.count === 'number' ? data.count : (data.results || []).length
      );
    }
  };

  const loadShops = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError('');
      const { data } = await client.get<ShopsResponse>('/api/shops/', {
        params: { page: 1, page_size: 24 },
      });
      extractShops(data);
    } catch (e: any) {
      setError('Failed to load shops. Please try again.');
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadShops(false);
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadShops(true);
  };

  const initial = (name?: string) =>
    name && name.trim().length > 0 ? name.trim()[0].toUpperCase() : 'S';

  const goToShop = (shop: Shop) => {
    const slugOrId = shop.slug || shop.id;
    router.push(`/shop/${slugOrId}`); // this matches your existing shop detail route :contentReference[oaicite:2]{index=2}
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <AnimatedBackground />

      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <AppHeader placeholder="Search shops, products..." />

      {/* Small toolbar */}
      <View style={styles.topRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>All Shops</Text>
          {count !== null && <Text style={styles.subTitle}>{count} found</Text>}
        </View>
      </View>

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
            <Text style={styles.emptyText}>No shops found.</Text>
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

                  <View style={styles.badgeRow}>
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

export default AllShopsScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#001A33' },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
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
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  subTitle: { color: '#D1D5DB', fontSize: 12, marginTop: 2 },

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
  image: { width: '100%', height: 210, backgroundColor: '#0B1220' },

  initialWrapper: {
    width: '100%',
    height: 210,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: { fontSize: 32, fontWeight: '700', color: '#D4AF37' },

  cardBody: { padding: 10 },
  shopName: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  shopMeta: { color: '#D1D5DB', fontSize: 11 },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  badgePill: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    marginTop: 2,
  },
  badgeRed: { backgroundColor: 'rgba(244,67,54,0.15)' },
  badgeOrange: { backgroundColor: 'rgba(255,152,0,0.15)' },
  badgeText: { fontSize: 10, fontWeight: '600' },
  badgeTextRed: { color: '#FF8A80' },
  badgeTextOrange: { color: '#FFCC80' },
});
