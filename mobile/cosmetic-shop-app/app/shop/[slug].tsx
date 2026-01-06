// app/shop/[slug].tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import client from '../../src/api/client';
import AppHeader from '../../src/components/AppHeader';
import { useNavBar } from '../../src/context/NavBarContext';
import AnimatedBackground from '../../src/components/AnimatedBackground'; 
import * as Location from 'expo-location'; 

type Shop = {
  id: number;
  slug?: string;
  name: string;
  village?: string;
  city?: string;
  postal_code?: string;
  address_line1?: string;
  cod_enabled?: boolean;
  returns_enabled?: boolean;
  latitude?: string | number;
  longitude?: string | number;
  delivery_radius?: number;
};

type Product = {
  id: number;
  name: string;
  price: number | string;
  mrp?: number | string | null;
  discount_percent?: number | null;
  calculated_discount_percent?: number | null;
  rating?: number | string | null;
  numReviews?: number | string | null;
  image?: string | null;
  thumbnail?: string | null;
};

type ProductsResponse =
  | {
      results?: Product[];
      products?: Product[];
      [key: string]: any;
    }
  | Product[];

const PER_PAGE = 25;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- HAVERSINE FORMULA ---
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

const getPrimaryImage = (p: Product) =>
  p.image ||
  p.thumbnail ||
  'https://via.placeholder.com/400x400.png?text=Product';

const getDiscountInfo = (product: Product) => {
  const price = parseFloat(String(product.price || 0)) || 0;
  const mrp = parseFloat(String(product.mrp || 0)) || 0;
  let percent =
    product.calculated_discount_percent ??
    product.discount_percent ??
    0;
  let showDiscount = false;

  if (mrp && price && mrp > price) {
    const calc = Math.round(((mrp - price) / mrp) * 100);
    if (!percent) percent = calc;
    showDiscount = calc > 0;
  } else if (percent && percent > 0) {
    showDiscount = true;
  }
  if (!showDiscount) percent = 0;
  return { showDiscount, mrp, price, percent };
};

const ShopDetailScreen: React.FC = () => {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const insets = useSafeAreaInsets();
  const { handleScroll: handleNavScroll } = useNavBar();

  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState('');

  const [productsPage, setProductsPage] = useState<number>(1);
  const [hasMoreProducts, setHasMoreProducts] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  // User Location
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
            const res = await Location.requestForegroundPermissionsAsync();
            if (res.status !== 'granted') return;
        }
        let pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      } catch (e) {
        console.log("Loc error shop:", e);
      }
    })();
  }, []);

  // --- Load shop info ---
  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const { data } = await client.get<Shop>(`/api/shops/${slug}/`);
        setShop(data);
      } catch (e: any) {
        console.log('Shop info error', e);
      }
    })();
  }, [slug]);

  // --- Load first page of products ---
  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        setLoadingProducts(true);
        setProductsError('');
        setProducts([]);
        setProductsPage(1);
        setHasMoreProducts(false);

        const { data } = await client.get<ProductsResponse>(
          '/api/products/',
          {
            params: {
              shop: slug,
              page: 1,
              page_size: PER_PAGE,
            },
          }
        );

        let list: Product[] = [];
        if (Array.isArray(data)) {
          list = data;
        } else {
          list = data.results || data.products || [];
        }

        setProducts(list || []);
        setProductsPage(1);
        setHasMoreProducts((list || []).length === PER_PAGE);
      } catch (e: any) {
        console.log('Shop products error (first page)', e);
        setProductsError('Failed to load products for this shop.');
      } finally {
        setLoadingProducts(false);
      }
    })();
  }, [slug]);

  const loadMoreProducts = async () => {
    if (loadingMore) return;
    if (!hasMoreProducts) return;
    if (!slug) return;

    try {
      setLoadingMore(true);
      const nextPage = productsPage + 1;

      const { data } = await client.get<ProductsResponse>(
        '/api/products/',
        {
          params: {
            shop: slug,
            page: nextPage,
            page_size: PER_PAGE,
          },
        }
      );

      let list: Product[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else {
        list = data.results || data.products || [];
      }

      if (list && list.length) {
        setProducts((prev) => [...prev, ...list]);
        setProductsPage(nextPage);
        setHasMoreProducts(list.length === PER_PAGE);
      } else {
        setHasMoreProducts(false);
      }
    } catch (e) {
      console.log('loadMoreProducts error', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const goToProduct = (p: Product) =>
    router.push({
      pathname: '/product/[id]',
      params: {
        id: String(p.id),
        shop: String(slug),
        lat: userLocation?.lat, 
        lon: userLocation?.lon
      },
    });

  const locationLine = shop
    ? [shop.village, shop.city, shop.postal_code]
        .filter(Boolean)
        .join(', ')
    : '';

  // Calculate distance from user to this specific shop
  let shopDistanceKm: number | null = null;
  if (shop && userLocation && shop.latitude && shop.longitude) {
      shopDistanceKm = getDistanceFromLatLonInKm(
          userLocation.lat,
          userLocation.lon,
          parseFloat(String(shop.latitude)),
          parseFloat(String(shop.longitude))
      );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <AnimatedBackground />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <AppHeader placeholder="Search in this shop..." />

      {/* Shop-specific toolbar (Glass) */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color="#F9FAFB" />
        </TouchableOpacity>

        <View>
          <Text style={styles.headerTitle}>
            {shop?.name || 'Shop Details'}
          </Text>
          <Text style={styles.headerSub}>
            {locationLine || 'Loading location...'}
          </Text>

          {shopDistanceKm !== null && (
             <Text style={{fontSize: 11, color: '#D4AF37', marginTop: 2, fontWeight:'600'}}>
                 {shopDistanceKm.toFixed(1)} km away
             </Text>
          )}

          {shop && (
            <View style={styles.badgeRow}>
              {shop.cod_enabled === false && (
                <View style={[styles.badgePill, styles.badgeRed]}>
                  <Text style={[styles.badgeText, styles.badgeTextRed]}>No COD</Text>
                </View>
              )}
              {shop.returns_enabled === false && (
                <View style={[styles.badgePill, styles.badgeOrange]}>
                  <Text style={[styles.badgeText, styles.badgeTextOrange]}>No Returns</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 40 + insets.bottom + 80 },
        ]}
        onScroll={handleNavScroll}
        scrollEventThrottle={16}
      >
        {/* Products Grid */}
        {loadingProducts ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#D4AF37" />
          </View>
        ) : productsError ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{productsError}</Text>
          </View>
        ) : products.length === 0 ? (
          <View style={styles.center}>
            <Ionicons
              name="cube-outline"
              size={64}
              color="#64748B"
            />
            <Text style={styles.emptyText}>
              No products found in this shop.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.productsGrid}>
              {products.map((p) => {
                const {
                  showDiscount,
                  mrp,
                  price,
                  percent,
                } = getDiscountInfo(p);

                // Deliverable Logic
                let badgeLabel = null;
                let badgeStyle = {};
                let badgeTextStyle = {};

                if (shopDistanceKm !== null) {
                    const radius = shop?.delivery_radius || 15;
                    if (shopDistanceKm <= radius) {
                        badgeLabel = "Deliverable";
                        badgeStyle = styles.badgeGreen;
                        badgeTextStyle = styles.badgeTextGreen;
                    } else {
                        badgeLabel = "Not Deliverable";
                        badgeStyle = styles.badgeRed;
                        badgeTextStyle = styles.badgeTextRed;
                    }
                }

                return (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.productCard}
                    onPress={() => goToProduct(p)}
                    activeOpacity={0.9}
                  >
                    <View style={styles.imageWrapper}>
                      <Image
                        source={{ uri: getPrimaryImage(p) }}
                        style={styles.productImage}
                        resizeMode="cover"
                      />
                    </View>

                    {/* ✅ BADGE */}
                    {badgeLabel && (
                        <View style={[styles.deliveryBadge, badgeStyle, {marginBottom: 4, alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 6}]}>
                            <Ionicons 
                                name={badgeLabel === "Deliverable" ? "checkmark-circle" : "close-circle"} 
                                size={10} 
                                color={badgeLabel === "Deliverable" ? "#86efac" : "#fecaca"} 
                                style={{marginRight: 3}} 
                            />
                            <Text style={[badgeTextStyle, {fontSize: 9}]}>{badgeLabel}</Text>
                        </View>
                    )}

                    <View style={styles.productBody}>
                      <Text
                        style={styles.productName}
                        numberOfLines={2}
                      >
                        {p.name}
                      </Text>

                      <View style={styles.priceRow}>
                        <Text style={styles.productPrice}>
                          ₹
                          {price && (price as any).toFixed
                            ? (price as any).toFixed(0)
                            : price}
                        </Text>
                        {showDiscount && mrp > price && (
                          <Text style={styles.discountText}>
                            {percent}% OFF
                          </Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {hasMoreProducts && (
              <View style={styles.loadMoreContainer}>
                <TouchableOpacity
                  style={styles.loadMoreBtn}
                  onPress={loadMoreProducts}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.loadMoreText}>
                      Load more
                    </Text>
                  )}
                </TouchableOpacity>
                <Text style={styles.loadMoreMeta}>
                  Page {productsPage}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default ShopDetailScreen;

const styles = StyleSheet.create({
  // 🔹 Dark Theme Base
  safeArea: { flex: 1, backgroundColor: '#001A33' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.35)', // Glass
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#F9FAFB' },
  headerSub: { fontSize: 12, color: '#9CA3AF' },

  // badges (shop info)
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  badgePill: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginRight: 4, marginTop: 2 },
  badgeRed: { backgroundColor: 'rgba(220, 38, 38, 0.3)' },
  badgeOrange: { backgroundColor: 'rgba(234, 88, 12, 0.3)' },
  badgeText: { fontSize: 10, fontWeight: '600' },
  badgeTextRed: { color: '#fecaca' },
  badgeTextOrange: { color: '#fed7aa' },

  scrollContent: { paddingHorizontal: 12, paddingVertical: 16 },

  center: { paddingVertical: 50, alignItems: 'center' },
  emptyText: { color: '#94A3B8', fontSize: 14, marginTop: 10 },
  errorText: { color: '#EF4444', fontSize: 14, textAlign: 'center' },

  // ✅ PRODUCTS GRID (Updated to match HomeScreen)
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 4, 
  },

  // ✅ PRODUCT CARD (Transparent, No Border)
  productCard: {
    width: '50%', // 2 columns
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 10,
    marginBottom: 4,
    backgroundColor: 'transparent', // Transparent background
  },
  
  // ✅ IMAGE WRAPPER (Rounded, Grey/Dark BG)
  imageWrapper: {
    height: 160,
    width: '100%',
    marginBottom: 6,
    backgroundColor: '#020617', // Dark placeholder bg
    borderRadius: 16, // Rounded corners
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e293b', // Subtle border
  },
  productImage: { width: '100%', height: '100%' },

  productBody: { paddingHorizontal: 2, marginTop: 2 },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0', // Light Text
    marginBottom: 2,
    lineHeight: 17,
    height: 34, 
  },

  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  productPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FACC15', // Gold Price
    marginRight: 6,
  },
  productMrp: {
    fontSize: 13,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  discountText: {
    fontSize: 10,
    color: '#4ADE80', // Green Discount
    fontWeight: '700',
  },

  // Load more
  loadMoreContainer: { marginTop: 8, marginBottom: 16, alignItems: 'center' },
  loadMoreBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: '#D4AF37' },
  loadMoreText: { color: '#111827', fontWeight: '700', fontSize: 13 },
  loadMoreMeta: { marginTop: 4, fontSize: 11, color: '#6b7280' },

  // --- Badge Styles ---
  deliveryBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  badgeGreen: { backgroundColor: '#03221a', borderColor: '#14532d' },
  badgeRed: { backgroundColor: '#3b0f14', borderColor: '#7f1d1d' },
  badgeTextGreen: { fontSize: 11, fontWeight: '700', color: '#86efac' },
  badgeTextRed: { fontSize: 11, fontWeight: '700', color: '#fecaca' },
});
