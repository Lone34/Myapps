// app/checkout/payment.tsx

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
  TextInput,
  BackHandler,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import RazorpayCheckout from 'react-native-razorpay';
import AppHeader from '../../src/components/AppHeader';
import AnimatedBackground from '../../src/components/AnimatedBackground';
import client from '../../src/api/client';
import { useNavBar } from '../../src/context/NavBarContext';

import {
  loadCheckoutItems,
  fetchCartFromBackend,
  loadShippingAddressLocal,
  unitPriceOf,
  qtyOf,
  calcShipping,
  clearCheckoutItems,
} from '../../src/utils/checkout';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Simple distance helper (km)
const haversineKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  if (
    lat1 == null ||
    lon1 == null ||
    lat2 == null ||
    lon2 == null
  ) {
    return null;
  }

  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371; // Earth radius in km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Default limits
const COD_RADIUS_KM = 20;
const NEARBY_RADIUS_KM = 14;

const CHECKOUT_DELIVERY_SPEED_KEY = '@checkout_delivery_speed';

const PaymentScreen = () => {
  const router = useRouter();
  const { handleScroll: handleNavScroll } = useNavBar();
  const userInfo = useSelector(
    (s: any) => s.userLogin?.userInfo || s.user?.userInfo
  );

  const [loading, setLoading] = useState(true);
  const [processingType, setProcessingType] = useState<'COD' | 'Online' | null>(null);
  const submitLockRef = useRef(false);

  const [method, setMethod] = useState<'Razorpay' | 'COD'>('Razorpay');
  const [usingBuyNow, setUsingBuyNow] = useState(false);
  const [sourceItems, setSourceItems] = useState<any[]>([]);
  const [shippingAddress, setShipping] = useState<any | null>(null);

  // ✅ Delivery option chosen in Summary (Normal / Fast)
  const [deliverySpeed, setDeliverySpeed] = useState<'normal' | 'fast'>('normal');

  // Global Delivery Blocking
  const [deliveryBlocked, setDeliveryBlocked] = useState(false);
  const [deliveryBlockedReason, setDeliveryBlockedReason] = useState<string | null>(null);
  const [codBackendDistanceBlocked, setCodBackendDistanceBlocked] = useState(false);

  // Nearby alternative products
  const [altLoading, setAltLoading] = useState(false);
  const [altProducts, setAltProducts] = useState<any[]>([]);
  const [altError, setAltError] = useState<string | null>(null);

  // -------- COUPON STATE --------
  const [couponCode, setCouponCode] = useState('');
  const [couponInfo, setCouponInfo] = useState<null | {
    code: string;
    discountAmount: number;
    description?: string;
  }>(null);
  const [couponApplying, setCouponApplying] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Coupon List (Inline)
  const [showCouponList, setShowCouponList] = useState(false);
  const [couponListLoading, setCouponListLoading] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
  const [couponListError, setCouponListError] = useState<string | null>(null);

  // ✅ Prevent Hardware Back Button when processing
  useEffect(() => {
    const onBackPress = () => {
      if (processingType) return true;
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [processingType]);

  // -------- INIT --------
  useEffect(() => {
    const init = async () => {
      if (!userInfo) {
        router.replace('/login?redirect=/checkout/payment');
        return;
      }
      try {
        setLoading(true);
        const addr = await loadShippingAddressLocal();
        if (!addr) {
          router.replace('/checkout/shipping');
          return;
        }
        setShipping(addr);

        // ✅ Load saved delivery option from Summary
        try {
          const rawSpeed = await AsyncStorage.getItem(CHECKOUT_DELIVERY_SPEED_KEY);
          setDeliverySpeed(rawSpeed === 'fast' ? 'fast' : 'normal');
        } catch {}

        const buyNow = await loadCheckoutItems();
        if (buyNow.length) {
          setUsingBuyNow(true);
          setSourceItems(buyNow);
        } else {
          const cart = await fetchCartFromBackend();
          const items = cart.cart_items || cart.items || cart.data?.items || [];
          if (!items.length) {
            Alert.alert('Payment', 'Your cart is empty.');
            router.replace('/(tabs)/cart');
            return;
          }
          setUsingBuyNow(false);
          setSourceItems(items);
        }
      } catch (e: any) {
        Alert.alert('Payment', e?.response?.data?.detail || e?.message || 'Failed to load payment data.');
        router.replace('/(tabs)/cart');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [userInfo]);

  // -------- PRICING --------
  const itemsPrice = useMemo(
    () => sourceItems.reduce((sum, it) => sum + unitPriceOf(it, usingBuyNow) * qtyOf(it, usingBuyNow), 0),
    [sourceItems, usingBuyNow]
  );

  const baseShippingPrice = useMemo(() => calcShipping(itemsPrice), [itemsPrice]);
  const fastDeliveryFee = deliverySpeed === 'fast' ? 20 : 0;

  // ✅ Shipping shown to user = base shipping + ₹20 if Fast selected
  const shippingPrice = useMemo(
    () => baseShippingPrice + fastDeliveryFee,
    [baseShippingPrice, fastDeliveryFee]
  );

  const grandTotal = useMemo(() => itemsPrice + shippingPrice, [itemsPrice, shippingPrice]);

  const couponDiscount = couponInfo?.discountAmount || 0;
  const payableTotal = useMemo(() => {
    const raw = grandTotal - couponDiscount;
    return raw < 0 ? 0 : raw;
  }, [grandTotal, couponDiscount]);

  const orderItems = useMemo(
    () => sourceItems.map((it) => ({
        variation_id: it.variation?.id || it.variation_id || it.meta?.variation_id,
        qty: qtyOf(it, usingBuyNow),
      })),
    [sourceItems, usingBuyNow]
  );

  // -------- DELIVERY CHECKS --------
  useEffect(() => {
    if (!sourceItems.length || !shippingAddress) return;
    let blocked = false;
    let reason = '';
    const cLat = parseFloat(String(shippingAddress?.latitude ?? shippingAddress?.lat ?? ''));
    const cLng = parseFloat(String(shippingAddress?.longitude ?? shippingAddress?.lng ?? ''));

    // Per-shop delivery radius
    for (const it of sourceItems) {
      const shop = it?.shop || it?.product?.shop || it?.meta?.shop;
      if (!shop) continue;

      const shopRadius = Number(shop.delivery_radius ?? 15);
      const sLat = parseFloat(String(shop.latitude ?? ''));
      const sLng = parseFloat(String(shop.longitude ?? ''));

      if (!Number.isFinite(sLat) || !Number.isFinite(sLng)) continue;
      const dist = haversineKm(cLat, cLng, sLat, sLng);
      if (dist != null && dist > shopRadius) {
        blocked = true;
        reason = `🚫 Delivery not available: "${shop.name}" only delivers within ${shopRadius} km.`;
        break;
      }
    }

    setDeliveryBlocked(blocked);
    setDeliveryBlockedReason(blocked ? reason : null);
  }, [sourceItems, shippingAddress]);

  // COD restrictions from distance (local)
  const codBlockedByDistance = useMemo(() => {
    if (!shippingAddress || !sourceItems.length) return false;
    const cLat = parseFloat(String(shippingAddress?.latitude ?? shippingAddress?.lat ?? ''));
    const cLng = parseFloat(String(shippingAddress?.longitude ?? shippingAddress?.lng ?? ''));

    for (const it of sourceItems) {
      const shop = it?.shop || it?.product?.shop || it?.meta?.shop;
      if (!shop) continue;
      const sLat = parseFloat(String(shop.latitude ?? ''));
      const sLng = parseFloat(String(shop.longitude ?? ''));
      if (!Number.isFinite(sLat) || !Number.isFinite(sLng)) continue;
      const dist = haversineKm(cLat, cLng, sLat, sLng);
      if (dist != null && dist > COD_RADIUS_KM) return true;
    }
    return false;
  }, [shippingAddress, sourceItems]);

  // Items must be near enough for COD (or backend may block too)
  const codAllowedForCart = useMemo(() => {
    if (deliveryBlocked) return false;
    if (codBackendDistanceBlocked) return false;
    if (codBlockedByDistance) return false;

    // If any product explicitly blocks COD
    for (const it of sourceItems) {
      const v = it.variation || it.meta?.variation;
      const codOk = v?.cod_available ?? it?.cod_available ?? true;
      if (codOk === false) return false;
    }
    return true;
  }, [deliveryBlocked, codBackendDistanceBlocked, codBlockedByDistance, sourceItems]);

  // -------- AUTH CONFIG --------
  const authConfig = useMemo(() => {
    const token =
      userInfo?.access ||
      userInfo?.token ||
      userInfo?.accessToken ||
      userInfo?.data?.token;
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }, [userInfo]);

  const buildShippingPayload = () => {
    if (!shippingAddress) return null;
    return {
      address: shippingAddress.address || shippingAddress.street || '',
      city: shippingAddress.city || '',
      postalCode: shippingAddress.postalCode || shippingAddress.pincode || shippingAddress.zip || '',
      country: shippingAddress.country || 'India',
      phone: shippingAddress.phone || shippingAddress.mobile || '',
      fullName: shippingAddress.fullName || shippingAddress.name || '',
      latitude: shippingAddress.latitude ?? shippingAddress.lat,
      longitude: shippingAddress.longitude ?? shippingAddress.lng,
    };
  };

  const handlePaymentError = (e: any) => {
    const msg =
      e?.description ||
      e?.message ||
      e?.error?.description ||
      e?.error?.message ||
      e?.response?.data?.detail ||
      'Payment failed.';
    const lower = String(msg || '').toLowerCase();
    if (lower.includes('cancel')) {
      Alert.alert('Payment cancelled', 'Payment was cancelled.');
      return;
    }
    Alert.alert('Payment', msg);
  };

  // -------- COUPON HANDLERS --------
  const applyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) {
      setCouponError('Enter a coupon code.');
      return;
    }
    setCouponApplying(true);
    setCouponError(null);
    try {
      const { data } = await client.post(
        '/api/coupons/apply/',
        { code, itemsPrice, paymentMethod: method },
        authConfig
      );
      const discountAmount =
        Number(data?.discountAmount ?? data?.discount_amount ?? data?.discount ?? 0) || 0;
      const appliedCode = data?.code || code;
      setCouponInfo({ code: appliedCode, discountAmount, description: data?.description });
      setShowCouponList(false);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Invalid coupon.';
      setCouponInfo(null);
      setCouponError(msg);
    } finally {
      setCouponApplying(false);
    }
  };

  const removeCoupon = () => {
    setCouponInfo(null);
    setCouponCode('');
    setCouponError(null);
  };

  const applyFromList = async (code: string) => {
    setCouponCode(code);
    setCouponApplying(true);
    setCouponError(null);
    try {
      const { data } = await client.post(
        '/api/coupons/apply/',
        { code, itemsPrice, paymentMethod: method },
        authConfig
      );
      const discountAmount =
        Number(data?.discountAmount ?? data?.discount_amount ?? data?.discount ?? 0) || 0;
      const appliedCode = data?.code || code;
      setCouponInfo({ code: appliedCode, discountAmount, description: data?.description });
      setCouponError(null);
      setShowCouponList(true);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Invalid coupon.';
      setCouponInfo(null);
      setCouponError(msg);
    } finally {
      setCouponApplying(false);
      setShowCouponList(true);
    }
  };

  const fetchCoupons = async () => {
    if (showCouponList) { setShowCouponList(false); return; }

    setShowCouponList(true);
    setCouponListLoading(true);
    setCouponListError(null);
    try {
      const { data } = await client.get('/api/coupons/available/', { ...authConfig, params: { itemsPrice, paymentMethod: method } });
      setAvailableCoupons(Array.isArray(data) ? data : data?.results || data?.coupons || []);
    } catch (e: any) {
      setCouponListError('Unable to load coupons.');
    } finally {
      setCouponListLoading(false);
    }
  };

  // -------- NEARBY ALT PRODUCTS --------
  const fetchNearbyAlternatives = useCallback(async () => {
    if (!shippingAddress || !sourceItems.length) return;

    setAltLoading(true);
    setAltError(null);
    try {
      const ids = sourceItems
        .map((it) => it?.product?.id || it?.product_id || it?.meta?.product_id)
        .filter(Boolean);
      if (!ids.length) {
        setAltProducts([]);
        return;
      }

      const lat = shippingAddress?.latitude ?? shippingAddress?.lat;
      const lng = shippingAddress?.longitude ?? shippingAddress?.lng;

      const { data } = await client.get('/api/products/nearby-alternatives/', {
        ...authConfig,
        params: { product_ids: ids.join(','), lat, lng, radius_km: NEARBY_RADIUS_KM },
      });
      setAltProducts(Array.isArray(data) ? data : data?.results || data?.products || []);
    } catch (e: any) {
      setAltError('Unable to load nearby alternatives.');
      setAltProducts([]);
    } finally {
      setAltLoading(false);
    }
  }, [shippingAddress, sourceItems, authConfig]);

  useEffect(() => {
    if (!deliveryBlocked) return;
    fetchNearbyAlternatives();
  }, [deliveryBlocked, fetchNearbyAlternatives]);

  // -------- PLACE ORDER: COD --------
  const placeCOD = async () => {
    const shippingPayload = buildShippingPayload();
    if (!shippingPayload || submitLockRef.current || processingType || deliveryBlocked) return;

    submitLockRef.current = true;
    setProcessingType('COD');

    try {
      const { data } = await client.post('/api/orders/add/', {
        orderItems, shippingAddress: shippingPayload, paymentMethod: 'COD', couponCode: couponInfo?.code,
        delivery_speed: deliverySpeed,
        deliverySpeed: deliverySpeed,
      }, authConfig);

      await clearCheckoutItems();
      AsyncStorage.setItem(CHECKOUT_DELIVERY_SPEED_KEY, 'normal').catch(() => {});
      const orderId = data?.order?.id || data?.id;
      router.replace(orderId ? `/orders/${orderId}` : '/orders');
    } catch (e: any) {
      // Backend can block COD by distance
      const detail = e?.response?.data?.detail || '';
      if (String(detail).toLowerCase().includes('cod') && String(detail).toLowerCase().includes('distance')) {
        setCodBackendDistanceBlocked(true);
      }
      handlePaymentError(e);
      setProcessingType(null);
      submitLockRef.current = false;
    }
  };

  // -------- PLACE ORDER: RAZORPAY --------
  const placeRazorpay = async () => {
    const shippingPayload = buildShippingPayload();
    if (!shippingPayload || submitLockRef.current || processingType || deliveryBlocked) return;

    submitLockRef.current = true;
    setProcessingType('Online');

    try {
      const { data } = await client.post('/api/orders/add/', {
        orderItems, shippingAddress: shippingPayload, paymentMethod: 'Razorpay', couponCode: couponInfo?.code,
        delivery_speed: deliverySpeed,
        deliverySpeed: deliverySpeed,
      }, authConfig);

      const { razorpayOrderId, razorpayKeyId, amount, order, name, email, phone } = data || {};
      if (!razorpayOrderId) throw new Error('Razorpay init failed.');

      const options = {
        key: razorpayKeyId,
        amount: String(Math.round(Number(amount))),
        currency: 'INR',
        name: name || 'The Kashmir Cart',
        description: `Order #${order.id}`,
        order_id: razorpayOrderId,
        prefill: {
          name: userInfo?.name || shippingAddress.fullName,
          email: email || userInfo.email,
          contact: phone || shippingAddress.phone,
        },
        theme: { color: '#d4a94f' },
      };

      const paymentData = await RazorpayCheckout.open(options);

      const verify = async () => client.post('/api/orders/razorpay/verify/', {
        orderId: order.id,
        razorpay_payment_id: paymentData.razorpay_payment_id,
        razorpay_order_id: paymentData.razorpay_order_id,
        razorpay_signature: paymentData.razorpay_signature,
      }, authConfig);

      await verify();
      await clearCheckoutItems();
      AsyncStorage.setItem(CHECKOUT_DELIVERY_SPEED_KEY, 'normal').catch(() => {});
      router.replace(`/orders/${order.id}`);

    } catch (e: any) {
      // If user cancelled Razorpay, do not show a scary error
      if (e?.code && e.code === 0) {
        setProcessingType(null);
        submitLockRef.current = false;
        return;
      }
      handlePaymentError(e);
      setProcessingType(null);
      submitLockRef.current = false;
    }
  };

  const onPay = () => {
    if (processingType) return;
    if (method === 'COD') placeCOD();
    else placeRazorpay();
  };

  if (loading && !sourceItems.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <AnimatedBackground />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <AppHeader placeholder="Search products..." />

      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => !processingType && router.back()} disabled={!!processingType}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        onScroll={handleNavScroll}
        scrollEventThrottle={16}
      >
        {/* Delivery Blocked */}
        {deliveryBlocked && (
          <View style={styles.blockedBox}>
            <Text style={styles.blockedTitle}>Delivery blocked</Text>
            <Text style={styles.blockedReason}>{deliveryBlockedReason || 'Some items are outside delivery range.'}</Text>

            <View style={{ height: 10 }} />

            <Text style={styles.blockedHint}>
              Try replacing items with nearby alternatives (within {NEARBY_RADIUS_KM} km).
            </Text>

            {altLoading ? (
              <View style={{ marginTop: 12 }}>
                <ActivityIndicator color="#D4AF37" />
              </View>
            ) : altError ? (
              <Text style={styles.altError}>{altError}</Text>
            ) : altProducts.length ? (
              <View style={styles.sectionContainer}>
                <Text style={styles.hintText}>Nearby alternatives</Text>
                <View style={styles.gridContainer}>
                  {altProducts.slice(0, 6).map((p: any) => (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.gridCard}
                      activeOpacity={0.9}
                      onPress={() => router.push(`/product/${p.id}`)}
                    >
                      <View style={styles.gridImgWrapper}>
                        <Image source={{ uri: p.image || p.thumbnail || p.main_image }} style={styles.gridImg} contentFit="cover" />
                      </View>
                      <View style={styles.gridInfo}>
                        <Text style={styles.gridName} numberOfLines={1}>{p.name}</Text>
                        <Text style={styles.gridPrice}>₹{Number(p.price || 0).toFixed(0)}</Text>
                        {p.distance_km != null && (
                          <Text style={styles.gridDist}>{Number(p.distance_km).toFixed(1)} km away</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              <Text style={styles.altError}>No nearby alternatives found.</Text>
            )}
          </View>
        )}

        {/* Shipping address */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Shipping</Text>
            <TouchableOpacity onPress={() => !processingType && router.push('/checkout/shipping')} disabled={!!processingType}>
              <Text style={styles.linkText}>Change</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.addrLine}>
            {shippingAddress?.fullName || shippingAddress?.name || ''}
          </Text>
          <Text style={styles.addrLine}>
            {shippingAddress?.address || shippingAddress?.street || ''}
          </Text>
          <Text style={styles.addrLine}>
            {shippingAddress?.city || ''}{shippingAddress?.postalCode || shippingAddress?.pincode ? ` - ${shippingAddress?.postalCode || shippingAddress?.pincode}` : ''}
          </Text>
          {!!shippingAddress?.phone && (
            <Text style={styles.addrLine}>Phone: {shippingAddress.phone}</Text>
          )}
        </View>

        {/* Payment methods */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Method</Text>

          <View style={{ height: 10 }} />

          <TouchableOpacity
            style={[styles.pmOption, method === 'Razorpay' && styles.pmSelected]}
            onPress={() => !deliveryBlocked && setMethod('Razorpay')}
            disabled={deliveryBlocked}
            activeOpacity={0.85}
          >
            <View style={styles.radioOuter}>
              {method === 'Razorpay' && <View style={styles.radioInner} />}
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.pmTitle}>Online Payment</Text>
              <Text style={styles.pmSub}>UPI, Card, Netbanking (Razorpay)</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pmOption, method === 'COD' && styles.pmSelected, (!codAllowedForCart) && styles.pmDisabled]}
            onPress={() => codAllowedForCart && !deliveryBlocked && setMethod('COD')}
            disabled={!codAllowedForCart || deliveryBlocked}
            activeOpacity={0.85}
          >
            <View style={styles.radioOuter}>
              {method === 'COD' && <View style={styles.radioInner} />}
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.pmTitle}>Cash on Delivery</Text>
              <Text style={styles.pmSub}>
                {!codAllowedForCart
                  ? (codBlockedByDistance ? `Not available beyond ${COD_RADIUS_KM} km for COD` : 'Not available for these items')
                  : 'Pay upon delivery'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Totals & Coupons (Transparent) */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Items Total</Text>
            <Text style={styles.value}>₹{itemsPrice.toFixed(0)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Delivery</Text>
            <Text style={styles.value}>{deliverySpeed === 'fast' ? 'Fast (Priority)' : 'Normal'}</Text>
          </View>

          {deliverySpeed === 'fast' && (
            <View style={styles.row}>
              <Text style={styles.label}>Fast delivery fee</Text>
              <Text style={styles.value}>₹20</Text>
            </View>
          )}

          <View style={styles.row}>
            <Text style={styles.label}>{deliverySpeed === 'fast' ? 'Shipping (Fast)' : 'Shipping'}</Text>
            <Text style={[styles.value, { color: shippingPrice === 0 ? '#4CAF50' : '#FFF' }]}>
              {shippingPrice === 0 ? 'FREE' : `₹${shippingPrice}`}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Coupon Section */}
          {couponInfo ? (
            <View style={styles.appliedCouponContainer}>
              <View style={styles.appliedLeft}>
                <Ionicons name="pricetag" size={16} color="#15803d" />
                <Text style={styles.appliedCode}>{couponInfo.code}</Text>
              </View>
              <Text style={styles.appliedAmount}>- ₹{couponInfo.discountAmount}</Text>
              <TouchableOpacity onPress={removeCoupon} style={styles.removeCouponBtn}>
                <Ionicons name="close" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.couponRow}>
                <TextInput
                  value={couponCode}
                  onChangeText={setCouponCode}
                  placeholder="Enter coupon code"
                  placeholderTextColor="#aaa"
                  style={styles.couponInput}
                  editable={!processingType}
                />
                <TouchableOpacity
                  style={[styles.applyBtn, couponApplying && styles.applyBtnDisabled]}
                  onPress={applyCoupon}
                  disabled={couponApplying || !!processingType}
                >
                  <Text style={styles.applyBtnText}>{couponApplying ? '...' : 'APPLY'}</Text>
                </TouchableOpacity>
              </View>

              {!!couponError && <Text style={styles.couponError}>{couponError}</Text>}
            </>
          )}

          <TouchableOpacity onPress={fetchCoupons} disabled={!!processingType} style={styles.inlineCouponListBtn}>
            <Ionicons name="list" size={16} color="#D4AF37" />
            <Text style={styles.inlineCouponListBtnText}>
              {showCouponList ? 'Hide available coupons' : 'Show available coupons'}
            </Text>
          </TouchableOpacity>

          {showCouponList && (
            <View style={styles.inlineCouponList}>
              {couponListLoading ? (
                <ActivityIndicator color="#D4AF37" />
              ) : couponListError ? (
                <Text style={styles.couponError}>{couponListError}</Text>
              ) : availableCoupons.length ? (
                availableCoupons.map((c: any) => (
                  <View key={c.code} style={styles.couponListItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.couponListCode}>{c.code}</Text>
                      <Text style={styles.couponListDesc} numberOfLines={2}>{c.description || 'Discount coupon'}</Text>
                    </View>
                    <TouchableOpacity onPress={() => applyFromList(c.code)} disabled={couponApplying || !!processingType}>
                      <Text style={styles.applyTextLink}>Apply</Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={styles.couponListDesc}>No coupons available right now.</Text>
              )}
            </View>
          )}
        </View>

        {/* Pay Button */}
        <TouchableOpacity
          style={[styles.payBtn, (!!processingType || deliveryBlocked) && styles.payBtnDisabled]}
          onPress={onPay}
          disabled={!!processingType || deliveryBlocked}
          activeOpacity={0.9}
        >
          <Text style={styles.payBtnText}>
            {processingType ? 'PROCESSING...' : `PLACE ORDER • ₹${payableTotal.toFixed(0)}`}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Overlay */}
      {!!processingType && (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <ActivityIndicator size="large" color="#D4AF37" />
            <Text style={styles.overlayTitle}>Processing</Text>
            <Text style={styles.overlaySub}>
              Please don’t go back while payment is processing.
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default PaymentScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 50 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },

  headerBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },

  card: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  linkText: { color: '#D4AF37', fontSize: 13, fontWeight: '800' },

  addrLine: { color: '#ddd', fontSize: 12, marginTop: 2 },

  pmOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 10,
  },
  pmSelected: {
    borderColor: 'rgba(212,175,55,0.65)',
    backgroundColor: 'rgba(212,175,55,0.10)',
  },
  pmDisabled: { opacity: 0.5 },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D4AF37',
  },
  pmTitle: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  pmSub: { color: '#ccc', fontSize: 12, marginTop: 2 },

  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 6 },
  label: { color: '#ccc', fontSize: 13 },
  value: { color: '#FFF', fontSize: 13, fontWeight: '800' },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 12 },

  couponRow: { flexDirection: 'row', gap: 10 },
  couponInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    color: '#FFF',
    fontSize: 13,
  },
  applyBtn: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 14,
    borderRadius: 12,
    justifyContent: 'center',
  },
  applyBtnDisabled: { opacity: 0.7 },
  applyBtnText: { color: '#000', fontWeight: '900', fontSize: 12 },

  couponError: { color: '#ff6b6b', fontSize: 12, marginTop: 8 },

  appliedCouponContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    padding: 10,
    borderRadius: 12,
  },
  appliedLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  appliedCode: { color: '#86efac', fontWeight: '900' },
  appliedAmount: { color: '#86efac', fontWeight: '900', marginRight: 8 },
  removeCouponBtn: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    padding: 6,
    borderRadius: 10,
  },

  inlineCouponListBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineCouponListBtnText: { color: '#D4AF37', fontWeight: '800', fontSize: 12 },
  inlineCouponList: {
    marginTop: 10,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 14,
    padding: 8,
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
  },
  couponListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  dashedBorder: { flex: 1 },
  couponListCode: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  couponListDesc: { fontSize: 11, color: '#ccc' },
  applyTextLink: { color: '#D4AF37', fontWeight: '700', fontSize: 12 },

  // 🌟 Grid View Styles
  sectionContainer: { marginTop: 24 },
  hintText: { color: '#aaa', fontSize: 12, marginBottom: 12 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  gridImgWrapper: { width: '100%', height: 120, backgroundColor: '#333' },
  gridImg: { width: '100%', height: '100%' },
  gridInfo: { padding: 8 },
  gridName: { color: '#FFF', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  gridPrice: { color: '#D4AF37', fontSize: 13, fontWeight: '700' },
  gridDist: { color: '#94a3b8', fontSize: 11 },

  // Pay Button (Moved & Styled)
  payBtn: {
    backgroundColor: '#D4AF37',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#D4AF37',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  payBtnDisabled: { backgroundColor: '#555', opacity: 0.7 },
  payBtnText: { color: '#000', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

  // Overlay
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  overlayCard: {
    width: '70%',
    backgroundColor: '#FFF',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  overlayTitle: { fontSize: 18, fontWeight: '700', marginTop: 16, color: '#000' },
  overlaySub: { fontSize: 13, color: '#666', marginTop: 8, textAlign: 'center' },

  // Blocked box
  blockedBox: {
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  blockedTitle: { color: '#fecaca', fontWeight: '900', fontSize: 14 },
  blockedReason: { color: '#fee2e2', marginTop: 6, fontSize: 12, lineHeight: 16 },
  blockedHint: { color: '#fecaca', fontSize: 12 },

  altError: { color: '#fecaca', marginTop: 10, fontSize: 12 },
});
