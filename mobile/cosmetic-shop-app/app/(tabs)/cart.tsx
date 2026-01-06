// app/(tabs)/cart.tsx
import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  StatusBar,
  Animated,
  Easing
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../src/api/client';
import { clearCheckoutItems } from '../../src/utils/checkout';
import AppHeader from '../../src/components/AppHeader';
import AnimatedBackground from '../../src/components/AnimatedBackground';
// import * as Location from 'expo-location'; // ❌ REMOVED
import { useGlobalLocation } from '../../src/context/LocationContext'; // ✅ ADDED

type CartItem = any;
type Product = any;

// ✅ HAVERSINE FORMULA
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

const CartScreen = () => {
  const router = useRouter();

  const userInfo = useSelector(
    (state: any) => state.userLogin?.userInfo || state.user?.userInfo
  );

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CartItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [discountProducts, setDiscountProducts] = useState<Product[]>([]);
  const [exploreProducts, setExploreProducts] = useState<Product[]>([]);

  // ✅ USE GLOBAL LOCATION
  const { location: userLocation, refreshLocation } = useGlobalLocation();

  const extractItems = (data: any) =>
    data?.items || data?.cart_items || data?.data?.items || [];

  // ✅ Re-fetch recommendations when location updates (for distance sorting)
  useEffect(() => {
      if (userLocation && items.length > 0) {
          loadRecommendations(items, userLocation);
      }
  }, [userLocation]);

  const loadRecommendations = async (cartItems: CartItem[], location: {lat: number, lon: number} | null) => {
    try {
      const productIds = Array.from(
        new Set(
          cartItems.map((it: any) => it.product?.id).filter(Boolean)
        )
      );

      if (!productIds.length) return;

      const base = {
        context: 'cart',
        for_products: productIds.join(','),
        limit: 6,
        // ✅ Pass location params
        ...(location ? { lat: location.lat, lon: location.lon } : {}),
      };

      const [similarRes, discountRes, exploreRes] = await Promise.all([
        client.get('/api/recommendations/', {
          params: { ...base, type: 'same_category' },
        }),
        client.get('/api/recommendations/', {
          params: { ...base, type: 'discounts' },
        }),
        client.get('/api/recommendations/', {
          params: { ...base, type: 'behavioral' },
        }),
      ]);

      setSimilarProducts(similarRes.data || []);
      setDiscountProducts(discountRes.data || []);
      setExploreProducts(exploreRes.data || []);
    } catch (e) {
      console.log('Reco fetch error', e);
    }
  };

  const loadCart = useCallback(async () => {
    if (!userInfo) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      
      // Refresh global location to ensure we have fresh data for distances
      refreshLocation();

      const { data } = await client.get('/api/cart/');
      const parsed = extractItems(data);
      setItems(parsed);
      // Pass userLocation if available, else null
      await loadRecommendations(parsed, userLocation);
    } catch (e: any) {
      setError(
        e?.response?.data?.detail ||
          e?.message ||
          'Failed to load cart.'
      );
    } finally {
      setLoading(false);
    }
  }, [userInfo, userLocation]); // userLocation dependency ensures refresh if loc comes in late

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  useFocusEffect(
    useCallback(() => {
      loadCart();
    }, [loadCart])
  );

  const getVariationId = (item: any) =>
    item.variation?.id ||
    item.variation_id ||
    item.meta?.variation_id;

  const getUnitPrice = (item: any) =>
    Number(
      item.price ??
        item.variation?.price ??
        item.product?.price ??
        0
    );

  const getQty = (item: any) => Number(item.quantity || item.qty || 1);

  const getLineTotal = (item: any) =>
    getUnitPrice(item) * getQty(item);

  const totals = (() => {
    const itemsTotal = items.reduce(
      (sum, it) => sum + getLineTotal(it),
      0
    );
    let shipping =
      itemsTotal < 100 && itemsTotal > 0
        ? 20
        : itemsTotal < 200 && itemsTotal >= 100
        ? 10
        : 0;
    return {
      itemsPrice: itemsTotal,
      shippingPrice: shipping,
      taxPrice: 0,
      totalPrice: itemsTotal + shipping,
    };
  })();

  const updateQuantity = async (item: CartItem, newQty: number) => {
    if (!userInfo)
      return router.push('/login?redirect=/(tabs)/cart');
    const variationId = getVariationId(item);
    if (!variationId)
      return Alert.alert('Cart', 'Missing variation id.');

    try {
      if (newQty <= 0) return await removeItem(item);
      const { data } = await client.post('/api/cart/add/', {
        variation_id: variationId,
        quantity: newQty,
        replace: true,
      });
      const parsed = extractItems(data);
      setItems(parsed);
      await loadRecommendations(parsed, userLocation);
    } catch (e: any) {
      Alert.alert('Cart', 'Failed to update quantity.');
    }
  };

  // Build attribute line like: "Size: XXL | Color: Red"
  const buildVariantSubtitle = (
    product: any,
    variation: any,
    item?: any
  ) => {
    if (!product && !variation && !item) return '';

    const parts: string[] = [];

    if (variation) {
      const rawName = String(variation.name || '').trim();
      const rawValue = String(variation.value || '').trim();

      if (rawName && rawValue) {
        const key = rawName.toLowerCase();
        const prettyName =
          key === 'size'
            ? 'Size'
            : key === 'color' || key === 'colour'
            ? 'Color'
            : rawName.charAt(0).toUpperCase() + rawName.slice(1);

        parts.push(`${prettyName}: ${rawValue}`);
      }

      if (
        variation.extra_attrs &&
        typeof variation.extra_attrs === 'object'
      ) {
        Object.entries(variation.extra_attrs).forEach(([k, v]) => {
          const label =
            String(k).charAt(0).toUpperCase() +
            String(k).slice(1);
          const line = `${label}: ${v}`;
          if (!parts.includes(line)) parts.push(line);
        });
      }
    }

    const specs =
      (Array.isArray(product?.specifications) &&
        product.specifications) ||
      (Array.isArray(product?.attributes) &&
        product.attributes) ||
      [];

    specs.forEach((spec: any) => {
      const rawName = String(spec.name ?? spec.key ?? '').trim();
      const rawValue = String(spec.value ?? spec.val ?? '').trim();
      if (!rawName || !rawValue) return;

      const key = rawName.toLowerCase();
      if (
        ['color', 'colour', 'fabric', 'material'].includes(key)
      ) {
        const line = `${rawName}: ${rawValue}`;
        if (!parts.includes(line)) parts.push(line);
      }
    });

    const colorName =
      item?.color_name ||
      variation?.color_name ||
      (variation?.extra_attrs &&
        (variation.extra_attrs.color ||
          variation.extra_attrs.colour));

    if (colorName) {
      const line = `Color: ${String(colorName)}`;
      if (!parts.includes(line)) parts.push(line);
    }

    return parts.join(' | ');
  };

  const removeItem = async (item: CartItem) => {
    if (!userInfo)
      return router.push('/login?redirect=/(tabs)/cart');
    const variationId = getVariationId(item);
    if (!variationId)
      return Alert.alert('Cart', 'Missing variation id.');

    try {
      const { data } = await client.delete(
        `/api/cart/remove/${variationId}/`
      );
      const parsed = extractItems(data);
      setItems(parsed);
      await loadRecommendations(parsed, userLocation);
    } catch (e: any) {
      Alert.alert('Cart', 'Failed to remove item.');
    }
  };

  const goToCheckout = async () => {
    if (!userInfo)
      return router.push('/login?redirect=/checkout/summary');
    if (!items.length) return;
    try {
      await clearCheckoutItems();
      router.push('/checkout/summary');
    } catch (e: any) {
      Alert.alert('Checkout', 'Failed to start checkout.');
    }
  };

  // --- SHIMMER HEADER ---
  const ShimmerSectionHeader = ({ title, onViewAll }: { title: string; onViewAll?: () => void }) => {
    const glowAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        ])
      ).start();
    }, [glowAnim]);
    const borderColor = glowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(148,163,184,0.35)', '#D4AF37'],
    });
    return (
      <View style={styles.shimmerHeaderRow}>
        <Animated.View style={[styles.shimmerPill, { borderColor }]}>
          <Text style={styles.shimmerText}>{title}</Text>
        </Animated.View>
        {onViewAll && (
          <TouchableOpacity onPress={onViewAll}>
            <Text style={styles.viewAllGold}>VIEW ALL</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // --- GRID CARD (UPDATED DESIGN) ---
  const renderRecoSection = (
    title: string,
    list: Product[],
    typeKey: string
  ) => {
    if (!list?.length) return null;
    return (
      <View style={styles.recoContainer}>
        <ShimmerSectionHeader
          title={title}
          onViewAll={() =>
            router.push({
              pathname: '/listing',
              params: { 
                  recoType: typeKey, 
                  title: title,
                  lat: userLocation?.lat ? String(userLocation.lat) : undefined, // ✅ Pass loc
                  lon: userLocation?.lon ? String(userLocation.lon) : undefined
              },
            })
          }
        />
        <View style={styles.grid}>
          {list.slice(0, 6).map((item) => {
            const price = Number(item.price);
            const mrp = Number(item.mrp);
            const hasDiscount = mrp > price;
            const discount = hasDiscount
              ? Math.round(((mrp - price) / mrp) * 100)
              : 0;

            // ✅ DELIVERABLE LOGIC FOR RECO CARD
            let distanceKm = item?.shop?.distance_km ?? item?.distance_km ?? null;
            let badgeLabel = null;
            let badgeStyle = {};
            let badgeTextStyle = {};

            // Calc distance client-side if missing
            if (distanceKm === null && userLocation && item.shop?.latitude && item.shop?.longitude) {
                distanceKm = getDistanceFromLatLonInKm(
                    userLocation.lat,
                    userLocation.lon,
                    parseFloat(item.shop.latitude),
                    parseFloat(item.shop.longitude)
                );
            }

            if (distanceKm !== null && distanceKm !== undefined) {
                const distVal = Number(distanceKm);
                const radius = item.shop?.delivery_radius || 15;
                if (distVal <= radius) {
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
                key={item.id}
                style={styles.gridCard}
                activeOpacity={0.9}
                onPress={() =>
                  router.push({
                    pathname: '/product/[id]',
                    params: { 
                        id: item.id,
                        lat: userLocation?.lat ? String(userLocation.lat) : undefined,
                        lon: userLocation?.lon ? String(userLocation.lon) : undefined
                    },
                  })
                }
              >
                <View style={styles.gridImgWrapper}>
                  {item.image ? (
                    <Image
                      source={{ uri: item.image }}
                      style={styles.gridImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.gridPlaceholder} />
                  )}
                </View>

                {/* ✅ BADGE */}
                {badgeLabel && (
                    <View style={[styles.deliveryBadge, badgeStyle, {marginBottom: 4, alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 6}]}>
                        <Ionicons name={badgeLabel === "Deliverable" ? "checkmark-circle" : "close-circle"} size={10} color={badgeLabel === "Deliverable" ? "#86efac" : "#fecaca"} style={{marginRight: 3}} />
                        <Text style={[badgeTextStyle, {fontSize: 9}]}>{badgeLabel}</Text>
                    </View>
                )}

                <Text numberOfLines={2} style={styles.gridName}>
                  {item.name}
                </Text>

                <View style={styles.gridPriceRow}>
                  <View style={{flexDirection:'row', alignItems: 'baseline'}}>
                     <Text style={styles.gridPrice}>₹{price.toFixed(0)}</Text>
                     {hasDiscount && <Text style={styles.gridDiscountText}>{discount}% OFF</Text>}
                  </View>

                  {distanceKm !== null && (
                      <Text style={{fontSize: 9, color: '#9CA3AF'}}>
                          {Number(distanceKm).toFixed(1)} km
                      </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  if (loading && !items.length)
    return (
      <SafeAreaView style={styles.safeArea}>
        <AnimatedBackground />
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#D4AF37" />
        </View>
      </SafeAreaView>
    );

  if (!userInfo) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AnimatedBackground />
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>
            Missing Cart Items?
          </Text>
          <Text style={styles.emptySub}>
            Login to see the items you added previously
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() =>
              router.push('/login?redirect=/(tabs)/cart')
            }
          >
            <Text style={styles.primaryText}>Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <AnimatedBackground />
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      <AppHeader placeholder="Search in cart..." />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }} // Adjusted padding since footer is moved up
      >
        {items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>
              Your cart is empty!
            </Text>
            <Text style={styles.emptySub}>
              Explore our wide selection and find something you like
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.push('/')}
            >
              <Text style={styles.primaryText}>Shop Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.itemsContainer}>
              {items.map((item: any, idx) => {
                const product = item.product || {};
                const variation = item.variation || {};
                const qty = getQty(item);
                const variantSubtitle = buildVariantSubtitle(
                  product,
                  variation,
                  item
                );
                const unit = getUnitPrice(item);
                const mrp = Number(
                  item.mrp ?? product.mrp ?? 0
                );
                const hasDiscount = mrp > unit && mrp > 0;
                const discountPercent = hasDiscount
                  ? Math.round(((mrp - unit) / mrp) * 100)
                  : 0;

                // ✅ ITEM DISTANCE LOGIC
                let distVal = null;
                let badgeLabel = null;
                let badgeStyle = {};
                let badgeTextStyle = {};

                // prod.shop logic
                const shop = product?.shop;
                if (shop && userLocation && shop.latitude && shop.longitude) {
                    distVal = getDistanceFromLatLonInKm(
                        userLocation.lat, userLocation.lon,
                        parseFloat(shop.latitude), parseFloat(shop.longitude)
                    );
                    const radius = shop.delivery_radius || 15;
                    if (distVal <= radius) {
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
                  <View
                    key={`${product.id || idx}-${variation.id || 'v'}`}
                    style={styles.cartItem}
                  >
                    <View style={styles.cartItemTop}>
                      <TouchableOpacity
                        onPress={() =>
                          router.push({
                            pathname: '/product/[id]',
                            params: { 
                                id: product.id,
                                lat: userLocation?.lat ? String(userLocation.lat) : undefined, // ✅ Pass loc
                                lon: userLocation?.lon ? String(userLocation.lon) : undefined
                            },
                          })
                        }
                      >
                        <Image
                          source={{
                            uri:
                              product.image ||
                              'https://via.placeholder.com/80',
                          }}
                          style={styles.itemImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                      <View style={styles.itemDetails}>
                        
                        {/* ✅ BADGE IN ITEM ROW */}
                        {badgeLabel && (
                            <View style={[styles.deliveryBadge, badgeStyle, {marginBottom: 4, alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 6}]}>
                                <Ionicons name={badgeLabel === "Deliverable" ? "checkmark-circle" : "close-circle"} size={10} color={badgeLabel === "Deliverable" ? "#86efac" : "#fecaca"} style={{marginRight: 3}} />
                                <Text style={[badgeTextStyle, {fontSize: 9}]}>{badgeLabel}</Text>
                            </View>
                        )}

                        <TouchableOpacity
                          onPress={() =>
                            router.push({
                              pathname: '/product/[id]',
                              params: { 
                                  id: product.id,
                                  lat: userLocation?.lat ? String(userLocation.lat) : undefined,
                                  lon: userLocation?.lon ? String(userLocation.lon) : undefined
                              },
                            })
                          }
                        >
                          <Text
                            style={styles.itemTitle}
                            numberOfLines={2}
                          >
                            {product.name || 'Product'}
                          </Text>
                        </TouchableOpacity>
                        {variantSubtitle ? (
                          <Text
                            style={styles.itemVariant}
                            numberOfLines={2}
                          >
                            {variantSubtitle}
                          </Text>
                        ) : null}
                        <View style={styles.priceBlock}>
                          <Text style={styles.currentPrice}>
                            ₹{(unit * qty).toFixed(2)}
                          </Text>
                          {hasDiscount && (
                            <>
                              <Text style={styles.mrpPrice}>
                                ₹{(mrp * qty).toFixed(2)}
                              </Text>
                              <Text style={styles.discountOff}>
                                {discountPercent}% off
                              </Text>
                            </>
                          )}
                        </View>
                        
                        {distVal !== null && (
                            <Text style={{fontSize: 10, color: '#9CA3AF', marginTop: 2}}>
                                Distance: {distVal.toFixed(1)} km
                            </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.actionRow}>
                      <View style={styles.qtyContainer}>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() =>
                            updateQuantity(item, qty - 1)
                          }
                        >
                          <Text style={styles.qtyBtnText}>-</Text>
                        </TouchableOpacity>
                        <View style={styles.qtyDisplay}>
                          <Text style={styles.qtyText}>{qty}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() =>
                            updateQuantity(item, qty + 1)
                          }
                        >
                          <Text style={styles.qtyBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => removeItem(item)}
                      >
                        <Text style={styles.removeBtnText}>
                          REMOVE
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.billCard}>
              <Text style={styles.billTitle}>Price Details</Text>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>
                  Price ({items.length} items)
                </Text>
                <Text style={styles.billValue}>
                  ₹{totals.itemsPrice.toFixed(2)}
                </Text>
              </View>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Shipping Fee</Text>
                <Text
                  style={[
                    styles.billValue,
                    {
                      color:
                        totals.shippingPrice === 0
                          ? '#4ADE80'
                          : '#E5E7EB',
                    },
                  ]}
                >
                  {totals.shippingPrice === 0
                    ? 'Free'
                    : `₹${totals.shippingPrice.toFixed(2)}`}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalValue}>
                  ₹{totals.totalPrice.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* ✅ MOVED PLACE ORDER BUTTON HERE (Inside ScrollView) */}
            <View style={styles.inlineCheckoutContainer}>
              <View style={styles.inlineTotalRow}>
                 <Text style={styles.inlineTotalLabel}>Final Amount</Text>
                 <Text style={styles.inlineTotalValue}>₹{totals.totalPrice.toFixed(0)}</Text>
              </View>
              <TouchableOpacity
                style={styles.placeOrderBtnInline}
                onPress={goToCheckout}
              >
                <Text style={styles.placeOrderText}>Place Order</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {renderRecoSection(
              'Similar Products',
              similarProducts,
              'same_category'
            )}
            {renderRecoSection(
              'Biggest Discounts',
              discountProducts,
              'discounts'
            )}
            {renderRecoSection(
              'More to Explore',
              exploreProducts,
              'behavioral'
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default CartScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#001A33' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  // Empty State
  emptyContainer: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: 20,
    marginTop: 8,
    marginHorizontal: 12,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    color: '#E5E7EB',
    marginTop: 8,
    marginBottom: 24,
    textAlign: 'center',
  },
  errorText: {
    color: '#FFB4B4',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
  },

  primaryBtn: {
    backgroundColor: '#D4AF37',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
    elevation: 2,
  },
  primaryText: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 14,
  },

  // Cart Items
  itemsContainer: { marginBottom: 8, paddingHorizontal: 8 },
  cartItem: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cartItemTop: { flexDirection: 'row', marginBottom: 12 },
  itemImage: {
    width: 72,
    height: 72,
    marginRight: 16,
    borderRadius: 8,
    backgroundColor: '#0f172a',
  },
  itemDetails: { flex: 1, justifyContent: 'flex-start' },
  itemTitle: {
    fontSize: 14,
    color: '#F9FAFB',
    lineHeight: 18,
    marginBottom: 4,
  },
  itemVariant: { fontSize: 12, color: '#9CA3AF', marginBottom: 6 },
  priceBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  currentPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 8,
  },
  mrpPrice: {
    fontSize: 12,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  discountOff: {
    fontSize: 12,
    color: '#4ADE80',
    fontWeight: '600',
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.5)',
    paddingTop: 8,
  },
  qtyContainer: { flexDirection: 'row', alignItems: 'center' },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: {
    fontSize: 16,
    color: '#F9FAFB',
    fontWeight: '500',
  },
  qtyDisplay: {
    width: 36,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginHorizontal: 8,
    borderRadius: 6,
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F9FAFB',
  },
  removeBtn: { marginLeft: 24 },
  removeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF8A80',
  },

  // Bill Details
  billCard: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    padding: 16,
    marginBottom: 8,
    marginHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  billTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  billLabel: { fontSize: 14, color: '#E5E7EB' },
  billValue: { fontSize: 14, color: '#F9FAFB' },
  divider: {
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#4B5563',
    marginVertical: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ✅ INLINE CHECKOUT SECTION
  inlineCheckoutContainer: {
    backgroundColor: 'rgba(30,41,59,0.85)',
    marginHorizontal: 8,
    marginTop: 8,
    marginBottom: 20,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  inlineTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
  },
  inlineTotalLabel: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
  },
  inlineTotalValue: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '900',
  },
  placeOrderBtnInline: {
    backgroundColor: '#D4AF37',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 999,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  placeOrderText: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 16,
    marginRight: 8,
  },

  // Reco Grid
  recoContainer: {
    marginTop: 10,
    paddingBottom: 20,
    // No background, clean transparent layout
    marginHorizontal: 8,
  },
  recoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 4,
  },
  recoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFD95A',
  },

  shimmerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    marginTop: 12,
  },
  shimmerPill: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  shimmerText: {
    color: '#F9FAFB',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  viewAllGold: { color: '#D4AF37', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  // Updated Grid (Transparent & Cleaner)
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  gridCard: {
    width: '48%',
    marginRight: '2%',
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: 'transparent', // ✅ UPDATED
    padding: 6,
  },
  gridImgWrapper: {
    height: 150, // ✅ UPDATED: Taller
    width: '100%',
    marginBottom: 8,
    backgroundColor: '#020617',
    borderRadius: 16, // ✅ UPDATED: Rounder
    overflow: 'hidden',
    borderWidth: 1, 
    borderColor: '#1e293b' // ✅ UPDATED: Subtle border
  },
  gridImg: { width: '100%', height: '100%' },
  gridPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#111827',
  },
  gridName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 4,
    minHeight: 32,
  },
  gridPriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  gridPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 6,
  },
  gridMrp: {
    fontSize: 10,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    marginRight: 6,
  },
  gridDiscountText: {
    fontSize: 10,
    color: '#4ADE80',
    fontWeight: '700',
  },

  // --- Badge Styles ---
  deliveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeGreen: {
    backgroundColor: '#03221a', 
    borderColor: '#14532d',
  },
  badgeRed: {
    backgroundColor: '#3b0f14', 
    borderColor: '#7f1d1d',
  },
  badgeTextGreen: {
    fontSize: 11,
    fontWeight: '700',
    color: '#86efac', 
  },
  badgeTextRed: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fecaca', 
  },
});
