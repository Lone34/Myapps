import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Image,
  Animated,
} from 'react-native';
import { useRouter, useGlobalSearchParams } from 'expo-router';
import * as Location from 'expo-location'; // ✅ Ensure this is installed
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/api/client';

// ----------- HELPERS -----------
const toNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(
    typeof value === 'string'
      ? value.replace(/[^0-9.-]/g, '')
      : value
  );
  return Number.isFinite(n) ? n : null;
};

const getDiscountPercent = (p: any): number | null => {
  if (
    p.calculated_discount_percent !== undefined &&
    p.calculated_discount_percent !== null
  ) {
    const d = Number(p.calculated_discount_percent);
    return Number.isNaN(d) ? null : Math.round(d);
  }

  if (p.discount_percent !== undefined && p.discount_percent !== null) {
    const d = Number(p.discount_percent);
    return Number.isNaN(d) ? null : Math.round(d);
  }
  const price = toNumber(p.price);
  const mrp = toNumber(p.mrp);
  if (price && mrp && mrp > price) {
    return Math.round(((mrp - price) / mrp) * 100);
  }
  return null;
};

const getRatingInfo = (p: any) => {
  const rating =
    p.rating ??
    p.avg_rating ??
    p.average_rating ??
    null;
  const numReviews =
    p.numReviews ??
    p.num_reviews ??
    p.review_count ??
    null;
  return {
    rating: rating ? Number(rating) : null,
    numReviews,
  };
};

// ---------- SHIMMER TITLE ----------
const ShimmerTitle = ({ children }: { children: any }) => {
  const animated = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(animated, {
        toValue: 1,
        duration: 1700,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const translateX = animated.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 180],
  });

  return (
    <View style={styles.shimmerContainer}>
      <View style={styles.shimmerTitleWrap}>
        <Text style={styles.shimmerTitleText}>{children}</Text>
        <Animated.View
          style={[
            styles.shimmerOverlay,
            { transform: [{ translateX }] },
          ]}
        >
          <Animated.View style={styles.shimmerGradient} />
        </Animated.View>
      </View>
    </View>
  );
};

// ---------- SHOP CARD ----------
const ShopCard = ({
  shop,
  onPress,
}: {
  shop: any;
  onPress: () => void;
}) => {
  const logo =
    shop.logo ||
    shop.image ||
    (shop.images && shop.images[0]?.image) ||
    null;

  // ✅ Read distance from shop object
  const distance = shop.distance_km;

  return (
    <TouchableOpacity style={styles.shopCard} onPress={onPress}>
      {logo ? (
        <Image source={{ uri: logo }} style={styles.shopImage} />
      ) : (
        <View style={styles.shopImagePlaceholder}>
          <Text style={styles.shopInitial}>
            {String(shop?.name ?? '?')
              .charAt(0)
              .toUpperCase()}
          </Text>
        </View>
      )}

      <Text style={styles.shopName} numberOfLines={2}>
        {String(shop?.name ?? '')}
      </Text>

      {/* ✅ Distance Pill for Shop */}
      {distance != null && (
        <View style={styles.distPill}>
           <Ionicons name="location-sharp" size={10} color="#60A5FA" style={{marginRight: 2}} />
           <Text style={styles.distText}>{distance} km</Text>
        </View>
      )}

      {shop?.village && (
        <Text style={styles.shopMeta} numberOfLines={1}>
          {String(shop?.village ?? '')}
        </Text>
      )}
    </TouchableOpacity>
  );
};

// ---------- PRODUCT CARD ----------
const ProductCard = ({
  product,
  onPress,
}: {
  product: any;
  onPress: () => void;
}) => {
  const img =
    (product.images && product.images[0]?.image) ||
    product.image ||
    null;

  const priceNum = toNumber(product.price) ?? toNumber(product.mrp) ?? 0;
  const discount = getDiscountPercent(product);
  const { rating, numReviews } = getRatingInfo(product);

  const hasDiscount = discount !== null && discount > 0;
  const hasRating = rating !== null && rating > 0;

  // ✅ LOGIC: Delivery Status & Distance
  const shop = product.shop || {};
  const distance = shop.distance_km; // Calculated by backend
  // Use shop specific radius, OR default to 15km
  const deliveryLimit = shop.delivery_radius || 15; 

  let badgeLabel = null;
  let badgeStyle = {};
  let badgeTextStyle = {};
  let showDistance = false;

  if (distance !== null && distance !== undefined) {
    const distVal = Number(distance);
    showDistance = true;

    if (distVal <= deliveryLimit) {
      // ✅ Deliverable (Green)
      badgeLabel = "Deliverable";
      badgeStyle = styles.pillGreen;
      badgeTextStyle = styles.textGreen;
    } else {
      // ❌ Not Deliverable (Red)
      badgeLabel = "Not Deliverable";
      badgeStyle = styles.pillRed;
      badgeTextStyle = styles.textRed;
    }
  }

  return (
    <TouchableOpacity style={styles.productCard} onPress={onPress}>
      <View>
        {img && (
          <Image source={{ uri: img }} style={styles.productImage} />
        )}
        {/* Distance Overlay on Image (Optional visual improvement) */}
        {showDistance && (
          <View style={styles.imgOverlayDist}>
            <Text style={styles.imgOverlayText}>{Number(distance).toFixed(1)} km</Text>
          </View>
        )}
      </View>

      <View style={{paddingHorizontal: 8, paddingBottom: 8}}>
        
        {/* ✅ STATUS PILL */}
        {badgeLabel && (
           <View style={[styles.statusRow, badgeStyle]}>
              <Ionicons 
                name={badgeLabel === "Deliverable" ? "checkmark-circle" : "close-circle"} 
                size={12} 
                color={badgeLabel === "Deliverable" ? "#16a34a" : "#dc2626"} 
                style={{marginRight: 4}}
              />
              <Text style={badgeTextStyle}>{badgeLabel}</Text>
           </View>
        )}

        <Text style={styles.productName} numberOfLines={2}>
            {String(product?.name ?? '')}
        </Text>

        <Text style={styles.shopNameSmall} numberOfLines={1}>
            🏪 {product.shop?.name}
        </Text>

        {priceNum > 0 && (
            <View style={styles.priceRow}>
            <Text style={styles.productPrice}>
                ₹{priceNum.toFixed(2)}
            </Text>

            {hasDiscount && (
                <Text style={styles.productDiscount}>
                {discount}% OFF
                </Text>
            )}
            </View>
        )}

        {hasRating && (
            <Text style={styles.productRating}>
            ★ {rating!.toFixed(1)}
            {numReviews ? ` (${numReviews})` : ''}
            </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ---------- SEARCH SCREEN ----------
const SearchScreen = () => {
  const router = useRouter();
  const params = useGlobalSearchParams();

  const initialQ = (params.q as string) || '';
  const [keyword, setKeyword] = useState(initialQ);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [shops, setShops] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [userLocation, setUserLocation] = useState<{lat:number, lon:number} | null>(null);

  const [activeTab, setActiveTab] = useState<'all' | 'shops' | 'products'>(
    'all'
  );

  // ✅ ROBUST LOCATION FETCHING
  const getLocation = async () => {
      try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') return null;
          
          // Try last known first (fast)
          let loc = await Location.getLastKnownPositionAsync({});
          if (!loc) {
              // Fallback to current (slower but accurate)
              loc = await Location.getCurrentPositionAsync({});
          }
          if(loc) {
             return { lat: loc.coords.latitude, lon: loc.coords.longitude };
          }
          return null;
      } catch (e) {
          console.log("Location error", e);
          return null;
      }
  }

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setErr(null);

        // ✅ Get location if missing
        let currentLoc = userLocation;
        if (!currentLoc) {
            currentLoc = await getLocation();
            if(currentLoc) setUserLocation(currentLoc);
        }

        const query = (initialQ || keyword).trim(); 
        
        let url = query
          ? `/api/search/?q=${encodeURIComponent(query)}`
          : `/api/search/`;

        // ✅ Append Location
        if (currentLoc) {
            url += `${url.includes('?') ? '&' : '?'}lat=${currentLoc.lat}&lon=${currentLoc.lon}`;
        }

        const { data } = await api.get(url);

        setProducts(data?.products || []);
        setShops(data?.shops || []);
      } catch (e) {
        setErr('Failed to search. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [initialQ]); // Reload when query changes

  const submitSearch = () => {
    const trimmed = (keyword || '').trim();
    router.replace({
      pathname: '/search',
      params: trimmed ? { q: trimmed } : {},
    });
  };

  const shopCount = shops.length;
  const productCount = products.length;

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>◀</Text>
        </TouchableOpacity>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search products, shops..."
            placeholderTextColor="#6b7280"
            value={keyword}
            onChangeText={setKeyword}
            returnKeyType="search"
            onSubmitEditing={submitSearch}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={submitSearch}>
            <Text style={styles.searchBtnText}>Go</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.header}>
        {initialQ ? (
          <ShimmerTitle>Results for “{initialQ}”</ShimmerTitle>
        ) : (
          <ShimmerTitle>Explore</ShimmerTitle>
        )}

        <Text style={styles.headerSub}>
          {productCount} products • {shopCount} shops
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : err ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>{err}</Text>
        </View>
      ) : (
        <>
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]}
              onPress={() => setActiveTab('all')}
            >
              <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>All</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'shops' && styles.tabBtnActive]}
              onPress={() => setActiveTab('shops')}
            >
              <Text style={[styles.tabText, activeTab === 'shops' && styles.tabTextActive]}>Shops ({shopCount})</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'products' && styles.tabBtnActive]}
              onPress={() => setActiveTab('products')}
            >
              <Text style={[styles.tabText, activeTab === 'products' && styles.tabTextActive]}>Products ({productCount})</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {(activeTab === 'all' || activeTab === 'shops') && (
              <View style={styles.section}>
                <ShimmerTitle>Shops</ShimmerTitle>
                {shopCount === 0 ? (
                  <Text style={styles.emptyText}>No matching shops.</Text>
                ) : (
                  <View style={styles.shopsGrid}>
                    {shops.map((s) => (
                      <ShopCard
                        key={s.id}
                        shop={s}
                        onPress={() =>
                          router.push({
                            pathname: '/shop/[slug]',
                            params: { slug: String(s.slug || s.id) },
                          })
                        }
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            {(activeTab === 'all' || activeTab === 'products') && (
              <View style={styles.section}>
                <ShimmerTitle>Products</ShimmerTitle>
                {productCount === 0 ? (
                  <Text style={styles.emptyText}>No matching products.</Text>
                ) : (
                  <View style={styles.productsGrid}>
                    {products.map((p) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        onPress={() =>
                          router.push({
                            pathname: '/product/[id]',
                            params: { id: String(p.id) },
                          })
                        }
                      />
                    ))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
};

export default SearchScreen;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff', paddingTop: 14 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 8 },
  backText: { color: '#111827', fontSize: 20, marginRight: 8, fontWeight: '700' },
  searchRow: { flexDirection: 'row', flex: 1, alignItems: 'center' },
  searchInput: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, color: '#111827', fontSize: 14 },
  searchBtn: { marginLeft: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#2563eb' },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  header: { paddingHorizontal: 14, marginBottom: 8 },
  headerSub: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  tabsRow: { flexDirection: 'row', paddingHorizontal: 12, marginBottom: 10 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: '#f3f4f6', marginRight: 8 },
  tabBtnActive: { backgroundColor: '#2563eb' },
  tabText: { color: '#6b7280', fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#ffffff', fontWeight: '800' },
  scrollContent: { paddingHorizontal: 14, paddingBottom: 40 },
  section: { marginTop: 14 },
  emptyText: { color: '#9ca3af', fontSize: 13, marginTop: 6 },
  shimmerContainer: { marginBottom: 8 },
  shimmerTitleWrap: { backgroundColor: '#000000', paddingHorizontal: 18, paddingVertical: 7, borderRadius: 30, overflow: 'hidden', alignSelf: 'flex-start', position: 'relative' },
  shimmerTitleText: { color: '#ffffff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  shimmerOverlay: { position: 'absolute', top: 0, bottom: 0, width: 80, opacity: 0.4 },
  shimmerGradient: { flex: 1, backgroundColor: 'rgba(255,255,255,0.8)' },
  shopsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  shopCard: { width: '30%', backgroundColor: '#ffffff', borderRadius: 14, padding: 8, elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3 },
  shopImage: { width: '90%', height: 90, borderRadius: 10, marginBottom: 6, backgroundColor: '#f3f4f6' },
  shopImagePlaceholder: { width: '90%', height: 90, borderRadius: 10, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  shopInitial: { color: '#2563eb', fontWeight: '800', fontSize: 20 },
  shopName: { color: '#111827', fontSize: 12, fontWeight: '700' },
  shopMeta: { color: '#6b7280', fontSize: 11, marginTop: 1 },
  productsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 6 },
  productCard: { width: '48%', backgroundColor: '#ffffff', borderRadius: 14, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, overflow: 'hidden' },
  productImage: { width: '100%', height: 160, backgroundColor: '#f3f4f6', marginBottom: 6 },
  productName: { color: '#111827', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  productPrice: { color: '#16a34a', fontSize: 13, fontWeight: '800', marginRight: 6 },
  productDiscount: { color: '#dc2626', fontSize: 12, fontWeight: '700' },
  productRating: { color: '#6b7280', fontSize: 11, marginTop: 3 },
  centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#dc2626', fontWeight: '700' },

  // ---------- BADGES ----------
  distPill: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(37, 99, 235, 0.1)',
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 2, alignSelf: 'flex-start',
  },
  distText: { fontSize: 10, fontWeight: '600', color: '#2563eb' },
  
  distPillGreen: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(22, 163, 74, 0.1)',
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 2, alignSelf: 'flex-start',
  },
  distTextGreen: { fontSize: 10, fontWeight: '600', color: '#16a34a' },
  
  distPillRed: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(220, 38, 38, 0.1)',
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 2, alignSelf: 'flex-start',
  },
  distTextRed: { fontSize: 10, fontWeight: '600', color: '#dc2626' },    
  // New Styles for Product Card Update
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 6,
    marginTop: 6,
  },
  pillGreen: {
    backgroundColor: '#dcfce7', // light green bg
    borderWidth: 1,
    borderColor: '#bbf7d0'
  },
  textGreen: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16a34a', // green text
  },
  pillRed: {
    backgroundColor: '#fee2e2', // light red bg
    borderWidth: 1,
    borderColor: '#fecaca'
  },
  textRed: {
    fontSize: 10,
    fontWeight: '700',
    color: '#dc2626', // red text
  },
  imgOverlayDist: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  imgOverlayText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600'
  },
  shopNameSmall: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 4
  }
});
