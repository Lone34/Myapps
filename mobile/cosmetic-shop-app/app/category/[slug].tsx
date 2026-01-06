// app/category/[slug].tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import client from '../../src/api/client';
import AppHeader from '../../src/components/AppHeader';
import AnimatedBackground from '../../src/components/AnimatedBackground';
import { useNavBar } from '../../src/context/NavBarContext';

// --- Helpers ---
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

const toNumber = (value: any) => {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(typeof value === 'string' ? value.replace(/[^0-9.-]/g, '') : value);
  return Number.isFinite(n) ? n : 0;
};

// --- Types ---
type Product = {
  id: number;
  name: string;
  price: number;
  mrp?: number | null;
  image?: string;
  calculated_discount_percent?: number | null;
  shop?: {
    latitude?: string | number;
    longitude?: string | number;
    distance_km?: number;
    delivery_radius?: number;
  };
  distance_km?: number;
};

type Subcategory = {
  id: number | string; // Changed to allow string ID for 'all'
  name: string;
  slug: string;
  image?: string | null;
};

const NUM_COLUMNS = 2;

// --- Optimization: Extracted & Memoized Component ---
const ProductItem = React.memo(
  ({
    item,
    userLocation,
    onPress,
  }: {
    item: Product;
    userLocation: { lat: number; lon: number } | null;
    onPress: (id: string) => void;
  }) => {
    const img = item.image || null;
    const price = toNumber(item.price);
    const mrp = toNumber(item.mrp);
    const showDiscount = mrp > price;
    const discount = showDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0;

    // Distance Logic
    let distanceKm: number | null =
      (item?.shop?.distance_km as any) ?? (item?.distance_km as any) ?? null;

    let badgeLabel: 'Deliverable' | 'Not Deliverable' | null = null;
    let badgeStyle = null as any;
    let badgeTextStyle = null as any;

    if (
      distanceKm === null &&
      userLocation &&
      item.shop?.latitude !== undefined &&
      item.shop?.longitude !== undefined
    ) {
      distanceKm = getDistanceFromLatLonInKm(
        userLocation.lat,
        userLocation.lon,
        parseFloat(String(item.shop.latitude)),
        parseFloat(String(item.shop.longitude))
      );
    }

    if (distanceKm !== null && distanceKm !== undefined) {
      const distVal = Number(distanceKm);
      const radius = item.shop?.delivery_radius || 15;

      if (distVal <= radius) {
        badgeLabel = 'Deliverable';
        badgeStyle = styles.badgeGreen;
        badgeTextStyle = styles.badgeTextGreen;
      } else {
        badgeLabel = 'Not Deliverable';
        badgeStyle = styles.badgeRed;
        badgeTextStyle = styles.badgeTextRed;
      }
    }

    return (
      <TouchableOpacity
        style={styles.gridCard}
        activeOpacity={0.85}
        onPress={() => onPress(String(item.id))}
      >
        <View style={styles.gridImgWrapper}>
          {img ? (
            <Image
              source={{ uri: img }}
              style={styles.productImg}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.imgPlaceholder} />
          )}
        </View>

        <View style={styles.productInfo}>
          <View style={styles.topRow}>
            {badgeLabel ? (
              <View style={[styles.deliveryBadge, badgeStyle]}>
                <Ionicons
                  name={badgeLabel === 'Deliverable' ? 'checkmark-circle' : 'close-circle'}
                  size={10}
                  color={badgeLabel === 'Deliverable' ? '#86efac' : '#fecaca'}
                  style={styles.badgeIcon}
                />
                <Text style={[badgeTextStyle, styles.badgeTextSmall]}>{badgeLabel}</Text>
              </View>
            ) : (
              <View />
            )}

            {distanceKm !== null ? (
              <Text style={styles.distanceText}>{Number(distanceKm).toFixed(1)} km</Text>
            ) : (
              <View />
            )}
          </View>

          <Text numberOfLines={2} style={styles.productName}>
            {item.name}
          </Text>

          <View style={styles.priceRow}>
            <View style={styles.priceLeft}>
              <Text style={styles.productPrice}>₹{price.toFixed(0)}</Text>
              {showDiscount && <Text style={styles.productMrp}>₹{mrp.toFixed(0)}</Text>}
            </View>
          </View>

          {showDiscount && discount > 0 ? (
            <Text style={styles.discountText}>{discount}% OFF</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  }
);

export default function CategorySplitScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { handleScroll: handleNavScroll } = useNavBar();

  const [initLoading, setInitLoading] = useState(true);
  const [parentCategory, setParentCategory] = useState<any>(null);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);

  const lastScrollTs = useRef(0);
  const onProductsScroll = useCallback(
    (e: any) => {
      const now = Date.now();
      if (now - lastScrollTs.current > 80) {
        lastScrollTs.current = now;
        handleNavScroll?.(e);
      }
    },
    [handleNavScroll]
  );

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          const res = await Location.requestForegroundPermissionsAsync();
          status = res.status;
        }
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUserLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude });
        }
      } catch (e) {
        console.log('Location error', e);
      }
    })();
  }, []);

  useEffect(() => {
    if (slug) fetchCategoryInfo(slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const fetchCategoryInfo = async (catSlug: string) => {
    try {
      setInitLoading(true);
      // 1. Fetch category structure
      const { data } = await client.get(`/api/categories/${catSlug}/`);
      
      const mainCat = data.category || data;
      setParentCategory(mainCat);

      const subs = data.subcategories || [];
      
      // 2. 🌟 Create "All" option
      const allOption: Subcategory = {
        id: 'all',
        name: 'All',
        slug: mainCat.slug, // Uses parent slug to fetch everything
        image: mainCat.image, // Uses parent image
      };

      // 3. Prepend "All" to list
      setSubcategories([allOption, ...subs]);

      // 4. Default to "All" (Parent Slug)
      setSelectedSlug(mainCat.slug);
      fetchProducts(mainCat.slug, 1, true);

    } catch (e) {
      console.error('Error fetching category info:', e);
    } finally {
      setInitLoading(false);
    }
  };

  const fetchProducts = async (targetSlug: string, pageNum: number, shouldReset: boolean = false) => {
    if (shouldReset) {
      setLoadingProducts(true);
      setProducts([]);
      setHasMore(true);
    } else {
      if (!hasMore) return;
      setLoadingMore(true);
    }

    try {
      // 🌟 UPDATED: Use the powerful product search endpoint
      // include_children=true tells backend to look into parent AND sub-categories
      const { data } = await client.get(`/api/products/`, {
        params: { 
          category: targetSlug, 
          page: pageNum,
          include_children: true 
        },
      });

      const newProducts = data.products || data.results || [];

      if (newProducts.length === 0) {
        setHasMore(false);
      } else if (data.next === null) {
        setHasMore(false);
      }

      setProducts((prev) => {
        if (shouldReset) return newProducts;
        const existingIds = new Set(prev.map((p) => p.id));
        const filteredNew = newProducts.filter((p: Product) => !existingIds.has(p.id));
        if (filteredNew.length === 0 && newProducts.length > 0) setHasMore(false);
        return [...prev, ...filteredNew];
      });
    } catch (error) {
      console.log('Error fetching products', error);
      setHasMore(false);
    } finally {
      setLoadingProducts(false);
      setLoadingMore(false);
    }
  };

  const handleSelectSubcategory = useCallback(
    (subSlug: string) => {
      if (subSlug === selectedSlug) return;
      setSelectedSlug(subSlug);
      setPage(1);
      fetchProducts(subSlug, 1, true);
    },
    [selectedSlug]
  );

  const handleLoadMore = useCallback(() => {
    if (!hasMore || loadingMore || loadingProducts) return;
    const nextPage = page + 1;
    setPage(nextPage);
    if (selectedSlug) fetchProducts(selectedSlug, nextPage, false);
  }, [hasMore, loadingMore, loadingProducts, page, selectedSlug]);

  const handleProductPress = useCallback(
    (id: string) => {
      router.push({
        pathname: '/product/[id]',
        params: {
          id,
          lat: userLocation?.lat,
          lon: userLocation?.lon,
        },
      });
    },
    [router, userLocation]
  );

  const renderProductItem = useCallback(
    ({ item }: { item: Product }) => {
      return <ProductItem item={item} userLocation={userLocation} onPress={handleProductPress} />;
    },
    [userLocation, handleProductPress]
  );

  const productKeyExtractor = useCallback((item: Product) => String(item.id), []);
  
  // Key extractor can handle both string ('all') and number IDs
  const subKeyExtractor = useCallback((item: Subcategory) => String(item.id), []);

  const renderSidebarItem = useCallback(
    ({ item }: { item: Subcategory }) => {
      const slugKey = item.slug;
      
      // If "All" is selected (id 'all'), selectedSlug matches parent slug
      // If this item is 'all' (id 'all') AND selectedSlug matches parent slug -> selected
      // OR normal logic for others
      
      const isSelected = selectedSlug === slugKey && (item.id === 'all' ? true : item.id !== 'all');
      
      // Since both "All" button and actual Parent fetch might share same slug, 
      // simple slug comparison works fine usually. 
      // But if we want to be safe visually:
      const visualSelected = item.id === 'all' 
          ? (selectedSlug === parentCategory?.slug)
          : (selectedSlug === item.slug);

      const name = item.name;
      const image = item.image;

      return (
        <TouchableOpacity
          style={[styles.sidebarItem, visualSelected && styles.sidebarItemSelected]}
          onPress={() => handleSelectSubcategory(slugKey)}
          activeOpacity={0.8}
        >
          <View style={[styles.sidebarIconWrap, visualSelected && styles.sidebarIconSelected]}>
            {image ? (
              <Image source={{ uri: image }} style={styles.sidebarImg} resizeMode="cover" />
            ) : (
              <Text style={[styles.sidebarFallbackText, visualSelected && styles.sidebarFallbackTextSelected]}>
                {name.charAt(0)}
              </Text>
            )}
          </View>
          <Text numberOfLines={2} style={[styles.sidebarText, visualSelected && styles.sidebarTextSelected]}>
            {name}
          </Text>
        </TouchableOpacity>
      );
    },
    [selectedSlug, handleSelectSubcategory, parentCategory]
  );

  const renderFooter = useCallback(() => {
    if (loadingMore) return <ActivityIndicator size="small" color="#D4AF37" style={styles.footerLoader} />;
    if (!hasMore && products.length > 0) {
      return (
        <View style={styles.footerEnd}>
          <Text style={styles.footerEndText}>No more products</Text>
        </View>
      );
    }
    return <View style={styles.footerSpacer} />;
  }, [loadingMore, hasMore, products.length]);

  const selectedTitle = useMemo(() => {
    if (!selectedSlug) return parentCategory?.name;
    // If selected slug is parent slug, show "All Products" or Parent Name
    if (selectedSlug === parentCategory?.slug) return `All ${parentCategory?.name}`;
    
    const found = subcategories.find((s) => s.slug === selectedSlug);
    return found?.name || parentCategory?.name;
  }, [selectedSlug, subcategories, parentCategory?.name, parentCategory?.slug]);

  if (initLoading) {
    return (
      <View style={styles.loadingContainer}>
        <AnimatedBackground />
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <AnimatedBackground />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <AppHeader placeholder="Search in category..." />

      <View style={styles.splitContainer}>
        {/* SIDEBAR */}
        <View style={styles.sidebar}>
          <FlatList
            data={subcategories}
            keyExtractor={subKeyExtractor}
            renderItem={renderSidebarItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sidebarContent}
            removeClippedSubviews
            initialNumToRender={12}
            windowSize={7}
          />
        </View>

        {/* CONTENT */}
        <View style={styles.contentArea}>
          <View style={styles.contentHeader}>
            <Text style={styles.contentTitle}>{selectedTitle}</Text>
            <Text style={styles.productCount}>{products.length} Items</Text>
          </View>

          {loadingProducts && !products.length ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color="#D4AF37" />
            </View>
          ) : products.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="cube-outline" size={48} color={'rgba(255,255,255,0.3)'} />
              <Text style={styles.emptyText}>No products found</Text>
            </View>
          ) : (
            <FlashList
              data={products}
              keyExtractor={productKeyExtractor}
              renderItem={renderProductItem}
              numColumns={NUM_COLUMNS}
              estimatedItemSize={235}
              contentContainerStyle={styles.productsGrid}
              showsVerticalScrollIndicator={false}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={renderFooter}
              onScroll={onProductsScroll}
              scrollEventThrottle={16}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#001A33',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#001A33',
  },
  splitContainer: {
    flex: 1,
    flexDirection: 'row',
  },

  // --- Sidebar ---
  sidebar: {
    width: 85,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.1)',
  },
  sidebarContent: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  sidebarItem: {
    width: 70,
    alignItems: 'center',
    marginBottom: 20,
    justifyContent: 'center',
  },
  sidebarItemSelected: {},
  sidebarIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  sidebarIconSelected: {
    backgroundColor: '#D4AF37',
    borderColor: '#D4AF37',
  },
  sidebarImg: {
    width: '100%',
    height: '100%',
  },
  sidebarFallbackText: { color: '#888', fontSize: 12, fontWeight: '700' },
  sidebarFallbackTextSelected: { color: '#000' },
  sidebarText: {
    fontSize: 10,
    color: '#aaa',
    textAlign: 'center',
    width: '100%',
  },
  sidebarTextSelected: {
    color: '#D4AF37',
    fontWeight: '700',
  },

  // --- Content ---
  contentArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  contentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  productCount: {
    fontSize: 12,
    color: '#888',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#888',
    marginTop: 8,
    fontSize: 14,
  },

  // --- Product Grid ---
  productsGrid: {
    padding: 10,
    paddingBottom: 90,
  },

  // ✅ flat item
  gridCard: {
    flex: 1,
    padding: 6,
  },

  // ✅ only image box (not the whole card)
  gridImgWrapper: {
    height: 130,
    width: '100%',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    padding: 10,
  },
  productImg: {
    width: '100%',
    height: '100%',
  },
  imgPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 18,
  },

  productInfo: {
    marginTop: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  productName: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 16,
    minHeight: 32,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  priceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginRight: 6,
  },
  productMrp: {
    fontSize: 12,
    color: '#FFBDBD',
    textDecorationLine: 'line-through',
  },
  distanceText: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '700',
  },
  discountText: {
    fontSize: 11,
    color: '#8BC34A',
    fontWeight: '800',
    marginTop: 4,
  },

  // --- Badges ---
  deliveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeIcon: { marginRight: 4 },
  badgeTextSmall: { fontSize: 8, fontWeight: '700' },

  badgeGreen: { backgroundColor: '#03221a', borderColor: '#14532d' },
  badgeRed: { backgroundColor: '#3b0f14', borderColor: '#7f1d1d' },
  badgeTextGreen: { color: '#86efac' },
  badgeTextRed: { color: '#fecaca' },

  // --- Footer ---
  footerLoader: { marginVertical: 20 },
  footerEnd: { paddingVertical: 20, alignItems: 'center' },
  footerEndText: { color: '#666', fontSize: 12 },
  footerSpacer: { height: 40 },
});
