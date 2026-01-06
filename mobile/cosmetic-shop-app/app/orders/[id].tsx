// app/orders/[id].tsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Image,
  Animated,
  SafeAreaView,
  StatusBar,
  Linking,
  Platform,
  Dimensions
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import client from '../../src/api/client';
import { WebView } from 'react-native-webview';
import AppHeader from '../../src/components/AppHeader';
import AnimatedBackground from '../../src/components/AnimatedBackground';
import { useNavBar } from '../../src/context/NavBarContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ENABLE_MAP_TRACKING = true;

// ---------- helpers ----------
const toNumber = (v: any, fb = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

const formatDateTime = (val: any): string => {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return String(val);
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(val);
  }
};

// Is order delivered?
const isDelivered = (o: any): boolean => {
  if (!o) return false;
  return !!(
    o.isDelivered ||
    o.is_delivered ||
    o.delivery_status === 'delivered' ||
    o.deliveryStatus === 'delivered'
  );
};

// Is order cancelled?
const isCancelled = (o: any): boolean => {
  if (!o) return false;
  const st = String(
    o.delivery_status ||
    o.deliveryStatus ||
    o.status ||
    ''
  ).toLowerCase();
  return st === 'cancelled' || st === 'canceled';
};

const getCancelReason = (o: any): string => {
  return String(o?.cancel_reason || o?.cancelReason || '').trim();
};

const getCancelledAt = (o: any): any => {
  return o?.cancelled_at || o?.cancelledAt || null;
};

// Is payment completed?
const isPaid = (o: any): boolean => {
  if (!o) return false;
  // 1) Normal “paid” flags
  if (o.isPaid || o.is_paid || o.paidAt || o.paid_at) return true;
  // 2) COD considered paid once delivered
  const methodRaw = o.payment_method || o.paymentMethod || '';
  const method = String(methodRaw).toLowerCase();
  if (method === 'cod' && isDelivered(o)) return true;
  return false;
};

const API_BASE = (() => {
  const base = (client as any)?.defaults?.baseURL || '';
  return base.replace(/\/+$/, '');
})();

const buildImageUrl = (p?: string | null) => {
  if (!p) return null;
  const s = String(p);
  if (!s) return null;
  if (s.startsWith('http')) return s;
  if (!API_BASE) return s;
  return s.startsWith('/') ? `${API_BASE}${s}` : `${API_BASE}/${s}`;
};

const getItems = (order: any): any[] =>
  order?.items || order?.orderItems || order?.order_items || [];

const getExistingReturn = (order: any) => {
  const arr = order?.return_requests || order?.returns || order?.returnRequests || [];
  return Array.isArray(arr) && arr.length ? arr[0] : null;
};

const canRequestReturn = (order: any): boolean => {
  if (!isDelivered(order)) return false;
  const existing = getExistingReturn(order);
  if (existing) return false;
  
  const deliveredAt =
    order?.deliveredAt ||
    order?.delivered_at ||
    order?.delivered_on ||
    order?.delivered_on_date ||
    order?.updatedAt ||
    order?.updated_at;

  if (!deliveredAt) return true;

  try {
    const d = new Date(deliveredAt);
    if (Number.isNaN(d.getTime())) return true;
    const now = new Date();
    const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  } catch {
    return true;
  }
};

const getProductId = (it: any) =>
  it?.product?.id ??
  it?.product_id ??
  it?.productId ??
  (typeof it?.product === 'number' ? it.product : null);

const getItemName = (it: any, idx: number) =>
  it?.name || it?.product_name || it?.product?.name || `Item ${idx + 1}`;

const getItemImageRaw = (it: any): string | null => {
  const direct =
    it?.image ||
    it?.product_image ||
    it?.thumbnail ||
    it?.thumb ||
    it?.image_url ||
    it?.imageUrl ||
    it?.product?.image ||
    (Array.isArray(it?.product?.images) && it.product.images[0]?.image) ||
    null;
  return direct ? String(direct) : null;
};

const getItemColorName = (it: any): string | null => {
  const v = it?.variation || {};
  const extra = v?.extra_attrs || {};
  return (
    it?.color_name ||
    v?.color_name ||
    extra.color ||
    extra.colour ||
    null
  );
};

const getItemSizeValue = (it: any): string | null => {
  const v = it?.variation || {};
  return v?.value ? String(v.value) : null;
};

// ---------- OSM / Leaflet HTML ----------
const buildOsmHtml = (
  center: { latitude: number; longitude: number } | null,
  shop: { latitude: number; longitude: number } | null,
  customer: { latitude: number; longitude: number } | null,
) => {
  const fallbackLat = center?.latitude ?? shop?.latitude ?? customer?.latitude ?? 0;
  const fallbackLon = center?.longitude ?? shop?.longitude ?? customer?.longitude ?? 0;

  const shopMarkerJs = shop
    ? `L.marker([${shop.latitude}, ${shop.longitude}], { title: "Shop" }).addTo(map).bindPopup("Shop");`
    : '';

  const customerMarkerJs = customer
    ? `L.marker([${customer.latitude}, ${customer.longitude}], { title: "Customer" }).addTo(map).bindPopup("You");`
    : '';

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="initial-scale=1, maximum-scale=1, width=device-width" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #001A33; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      var map = L.map('map').setView([${fallbackLat}, ${fallbackLon}], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(map);

      ${shopMarkerJs}
      ${customerMarkerJs}

      var riderMarker = null;
      var routeLine = null;

      function updateRider(lat, lon, customerLat, customerLon) {
        var icon = L.icon({
            iconUrl: 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png',
            iconSize: [32, 32],
            iconAnchor: [16, 32]
        });

        if (!riderMarker) {
          riderMarker = L.marker([lat, lon], { icon: icon }).addTo(map);
        } else {
          riderMarker.setLatLng([lat, lon]);
        }

        if (typeof customerLat === 'number' && typeof customerLon === 'number') {
          var pts = [[lat, lon], [customerLat, customerLon]];
          if (!routeLine) {
            routeLine = L.polyline(pts, { color: "#D4AF37", weight: 4, dashArray: '10, 10' }).addTo(map);
          } else {
            routeLine.setLatLngs(pts);
          }
          map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
        } else {
          map.setView([lat, lon], 15);
        }
      }

      function handleMessage(event) {
        try {
          var msg = JSON.parse(event.data);
          if (msg.type === 'updateRider') {
            updateRider(msg.lat, msg.lon, msg.customerLat, msg.customerLon);
          }
        } catch (err) {}
      }

      document.addEventListener('message', handleMessage);
      window.addEventListener('message', handleMessage);
    </script>
  </body>
</html>
`;
};

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = String(id);
  const router = useRouter();
  const { handleScroll: handleNavScroll } = useNavBar(); // ✅ Hook for navbar hiding

  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [err, setErr] = useState('');
  const [productThumbs, setProductThumbs] = useState<Record<string, string>>({});

  // NEW: live tracking state
  const [liveLocation, setLiveLocation] = useState<any | null>(null);
  const [liveErr, setLiveErr] = useState<string>('');

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current; // New pop animation

  const webViewRef = useRef<any>(null);

  useEffect(() => {
    if (order) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true })
      ]).start();
    }
  }, [order]);

  const load = async () => {
    try {
      setLoading(true);
      setErr('');
      const { data } = await client.get(`/api/orders/${orderId}/`);
      setOrder(data?.order || data);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || 'Could not load order details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!orderId) {
      setErr('Order not found.');
      setLoading(false);
      return;
    }
    load();
  }, [orderId]);

  // Periodic Refresh
  useEffect(() => {
    const interval = setInterval(() => {
      if (!order || (!isDelivered(order) && !isCancelled(order))) {
        load();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [orderId, order]);

  // Derived Data
  // Derived Data
  const total = useMemo(() => toNumber(order?.total_price ?? order?.total ?? 0), [order]);
  const shippingPrice = useMemo(() => toNumber(order?.shipping_price ?? 0), [order]);

  const deliverySpeed = useMemo(() => {
    const raw =
      order?.delivery_speed ??
      order?.deliverySpeed ??
      (order?.is_fast_delivery ? 'fast' : 'normal') ??
      'normal';
    const s = String(raw || 'normal').toLowerCase();
    return s === 'fast' ? 'fast' : 'normal';
  }, [order]);

  const shippingExtra = useMemo(() => {
    const raw =
      order?.shipping_extra_price ??
      order?.shippingExtraPrice ??
      (deliverySpeed === 'fast' ? 20 : 0);
    return toNumber(raw, 0);
  }, [order, deliverySpeed]);

  const couponDiscount = useMemo(() => toNumber(order?.coupon_discount_amount ?? 0), [order]);

  const itemsTotal = useMemo(() => {
    const snap = toNumber(order?.items_price ?? 0);
    return snap > 0 ? snap : total - shippingPrice + couponDiscount;
  }, [order, total, shippingPrice, couponDiscount]);


  const items = useMemo(() => getItems(order || {}), [order]);
  
  const hasNonReturnableItem = useMemo(() =>
    (items || []).some((it: any) => it?.is_returnable === false || it?.product?.is_returnable === false),
    [items]
  );
  
  const canReturnFinal = !hasNonReturnableItem && canRequestReturn(order);
  const activePartner = order?.assigned_partner || null;
  const activePartnerId = activePartner?.id || null;
  const failureReason = order?.failure_reason || order?.delivery_failure_reason || null;
  const rawStatus = String(
    (order as any)?.delivery_status ||
    (order as any)?.deliveryStatus ||
    (order as any)?.status ||
    ''
  );
  const isFailedStatus = rawStatus.toLowerCase() === 'failed';
  const isCancelledStatus = isCancelled(order);
  const cancelReason = getCancelReason(order);
  const cancelledAt = getCancelledAt(order);

  const canCancelOrder = useMemo(() => {
    if (!order) return false;
    if (isDelivered(order)) return false;
    if (isFailedStatus) return false;
    if (isCancelledStatus) return false;
    const st = rawStatus.toLowerCase();
    if (['accepted', 'enroute', 'onway', 'delivered'].includes(st)) return false;
    return true;
  }, [order, isFailedStatus, isCancelledStatus, rawStatus]);

  const submitCancel = async (reason: string) => {
    if (!orderId || cancelLoading) return;
    try {
      setCancelLoading(true);
      const { data } = await client.post(`/api/orders/${orderId}/cancel/`, { reason });
      setOrder(data?.order || data);
      Alert.alert('Order cancelled', 'Your order has been cancelled.');
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Could not cancel order.';
      Alert.alert('Could not cancel', msg);
    } finally {
      setCancelLoading(false);
    }
  };

  const onPressCancel = () => {
    Alert.alert(
      'Cancel this order?',
      'Choose a reason (you cannot cancel after pickup).',
      [
        { text: 'Ordered by mistake', onPress: () => submitCancel('Ordered by mistake') },
        { text: 'Changed my mind', onPress: () => submitCancel('Changed my mind') },
        { text: 'Delivery taking too long', onPress: () => submitCancel('Delivery taking too long') },
        { text: 'Other', onPress: () => submitCancel('Cancelled by user') },
        { text: 'Keep order', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  // Live Tracking Polling
  useEffect(() => {
    let cancelled = false;
    let timer: any = null;

    const fetchLive = async () => {
      try {
        if (!orderId || !activePartnerId || !order || isDelivered(order) || isCancelled(order)) return;
        const res = await client.get(`/api/delivery/order/${orderId}/live-location/`);
        if (cancelled) return;
        setLiveLocation(res.data);
      } catch (e: any) {
        if (!cancelled) setLiveErr(e?.response?.data?.detail || '');
      } finally {
        if (!cancelled) timer = setTimeout(fetchLive, 10000);
      }
    };

    if (activePartnerId && order && !isDelivered(order) && !isCancelled(order)) fetchLive();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [orderId, activePartnerId, order?.delivery_status]);

  // Image Fetching
  useEffect(() => {
    const fetchMissing = async () => {
      const candidates = items
        .map((it) => ({ it, id: getProductId(it) }))
        .filter(({ it, id }) => id && !getItemImageRaw(it) && !productThumbs[String(id)]);

      if (!candidates.length) return;
      try {
        const uniqueIds = Array.from(new Set(candidates.map((c) => String(c.id))));
        const results = await Promise.allSettled(uniqueIds.map((pid) => client.get(`/api/products/${pid}/`)));
        const updates: Record<string, string> = {};
        results.forEach((res, idx) => {
          if (res.status === 'fulfilled') {
            const p = res.value?.data || {};
            const raw = p.image || (Array.isArray(p.images) && p.images[0]?.image) || null;
            if (raw) updates[uniqueIds[idx]] = buildImageUrl(raw) || '';
          }
        });
        if (Object.keys(updates).length) setProductThumbs((prev) => ({ ...prev, ...updates }));
      } catch {}
    };
    if (items.length) fetchMissing();
  }, [items, productThumbs]);

  // Map Data
  const riderCoordinate = liveLocation?.delivery_partner?.latitude ? { latitude: Number(liveLocation.delivery_partner.latitude), longitude: Number(liveLocation.delivery_partner.longitude) } : null;
  const shopCoordinate = liveLocation?.shop?.latitude ? { latitude: Number(liveLocation.shop.latitude), longitude: Number(liveLocation.shop.longitude) } : null;
  const customerCoordinate = liveLocation?.customer?.latitude ? { latitude: Number(liveLocation.customer.latitude), longitude: Number(liveLocation.customer.longitude) } : null;
  
  const mapCenter = riderCoordinate || shopCoordinate || customerCoordinate;
  const hasValidMapCenter = !!mapCenter;
  const mapHtml = useMemo(() => buildOsmHtml(mapCenter, shopCoordinate, customerCoordinate), [mapCenter, shopCoordinate, customerCoordinate]);

  useEffect(() => {
    if (!webViewRef.current || !riderCoordinate) return;
    const msg = JSON.stringify({ type: 'updateRider', lat: riderCoordinate.latitude, lon: riderCoordinate.longitude, customerLat: customerCoordinate?.latitude, customerLon: customerCoordinate?.longitude });
    try { webViewRef.current.postMessage(msg); } catch {}
  }, [riderCoordinate, customerCoordinate]);

  const continueShopping = () => router.replace('/(tabs)');
  const openProduct = (it: any) => {
    const pid = getProductId(it);
    if (!pid) return;
    router.push({ pathname: '/product/[id]', params: { id: String(pid) } });
  };

  if (loading && !order) return (
    <SafeAreaView style={styles.safeArea}>
        <AnimatedBackground />
        <View style={styles.center}><ActivityIndicator size="large" color="#D4AF37" /></View>
    </SafeAreaView>
  );

  if (!order) return (
    <SafeAreaView style={styles.safeArea}>
        <AnimatedBackground />
        <View style={styles.center}><Text style={styles.errorText}>{err || 'Order not found.'}</Text></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <AnimatedBackground />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Global Header & Toolbar */}
      <AppHeader placeholder="Search products..." />
      
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#F9FAFB" />
        </TouchableOpacity>
        <Text style={styles.toolbarTitle}>Order #{order.id}</Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        onScroll={handleNavScroll}
        scrollEventThrottle={16}
      >
        
        {/* 1. Animated Greetings Card */}
        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                <Animated.View style={[styles.successIconCircle, { transform: [{ scale: scaleAnim }] }]}>
                    <Ionicons name={isFailedStatus ? "close" : "checkmark"} size={40} color="#fff" />
                </Animated.View>
                <Text style={styles.animatedTitle}>
                    {isCancelledStatus ? 'Order Cancelled' : isFailedStatus ? 'Order Failed' : 'Thank You!'}
                </Text>
                <Text style={styles.animatedSub}>
                    {isCancelledStatus ? 'This order was cancelled.' : isFailedStatus ? 'Something went wrong.' : 'Your order is confirmed.'}
                </Text>
            </View>

            <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Placed On</Text>
                <Text style={styles.metaValue}>{formatDateTime(order.created_at || new Date())}</Text>
            </View>

            {isCancelledStatus && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Cancelled On</Text>
                <Text style={styles.metaValue}>{formatDateTime(cancelledAt || new Date())}</Text>
              </View>
            )}

            <View style={styles.badgeRow}>
                <View style={[styles.badge, isPaid(order) ? styles.badgeGreen : styles.badgeYellow]}>
                    <Text style={[styles.badgeText, isPaid(order) ? styles.textGreen : styles.textYellow]}>
                        {isPaid(order) ? 'PAID' : 'PAYMENT PENDING'}
                    </Text>
                </View>
                <View style={[styles.badge, isDelivered(order) ? styles.badgeGreen : isFailedStatus ? styles.badgeRed : styles.badgeBlue]}>
                    <Text style={[styles.badgeText, isDelivered(order) ? styles.textGreen : isFailedStatus ? styles.textRed : styles.textBlue]}>
                        {isDelivered(order) ? 'DELIVERED' : isCancelledStatus ? 'CANCELLED' : isFailedStatus ? 'FAILED' : 'PROCESSING'}
                    </Text>
                </View>
            {canCancelOrder && (
              <TouchableOpacity
                style={[styles.returnBtn, { marginTop: 12 }]}
                onPress={onPressCancel}
                disabled={cancelLoading}
              >
                {cancelLoading ? (
                  <ActivityIndicator />
                ) : (
                  <Text style={styles.returnBtnText}>Cancel Order</Text>
                )}
              </TouchableOpacity>
            )}
            </View>
        </Animated.View>

        {/* 2. Order Items */}
        <View style={styles.card}>
            <Text style={styles.sectionTitle}>Items</Text>
            {items.map((it, idx) => {
                const qty = toNumber(it.quantity ?? it.qty ?? 1, 1);
                const price = toNumber(it.price, 0);
                const name = getItemName(it, idx);
                const pid = getProductId(it);
                const raw = getItemImageRaw(it);
                const imgUrl = buildImageUrl(raw) || productThumbs[String(pid)] || null;
                const colorName = getItemColorName(it);
                const sizeValue = getItemSizeValue(it);

                return (
                    <TouchableOpacity key={idx} style={styles.itemRow} activeOpacity={0.7} onPress={() => pid && openProduct(it)}>
                        <View style={styles.itemImgWrapper}>
                            {imgUrl ? (
                                <Image source={{ uri: imgUrl }} style={styles.itemImg} resizeMode="cover" />
                            ) : (
                                <Ionicons name="image-outline" size={24} color="#555" />
                            )}
                        </View>
                        <View style={styles.itemInfo}>
                            <Text style={styles.itemName} numberOfLines={2}>{name}</Text>
                            <View style={styles.attrRow}>
                                {colorName && <View style={styles.attrBadge}><Text style={styles.attrText}>{colorName}</Text></View>}
                                {sizeValue && <View style={styles.attrBadge}><Text style={styles.attrText}>{sizeValue}</Text></View>}
                            </View>
                            <View style={styles.priceRow}>
                                <Text style={styles.qtyText}>x{qty}</Text>
                                <Text style={styles.priceText}>₹{(price * qty).toFixed(0)}</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                );
            })}
        </View>

        {/* 3. Status & Tracking */}
        <View style={styles.card}>
            <Text style={styles.sectionTitle}>Delivery Status</Text>

            {isCancelledStatus && (
              <View style={{ marginTop: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)', backgroundColor: 'rgba(239,68,68,0.10)' }}>
                <Text style={{ color: '#ef4444', fontWeight: '800' }}>This order is cancelled</Text>
                {!!cancelReason && <Text style={styles.waitingText}>Reason: {cancelReason}</Text>}
                {!!cancelledAt && <Text style={styles.waitingText}>Cancelled at: {formatDateTime(cancelledAt)}</Text>}
              </View>
            )}

            {!isCancelledStatus && (
              <>
            
            {/* Live Status Text */}
            {!isDelivered(order) && !isFailedStatus && liveLocation?.phase && (
                <View style={styles.statusBox}>
                    <Text style={styles.statusBoxText}>
                       {liveLocation.phase === 'at_shop' ? 'Rider at Shop' : 
                        liveLocation.phase === 'on_the_way' ? 'Rider on the way' :
                        liveLocation.phase === 'approaching' ? 'Rider is nearby' :
                        liveLocation.phase === 'near_customer' ? 'Arriving Now' : 'Processing'}
                    </Text>
                </View>
            )}

            {/* Rider Info */}
            {activePartner ? (
                <View style={styles.riderRow}>
                    <View style={styles.riderAvatar}>
                        <Ionicons name="person" size={20} color="#D4AF37" />
                    </View>
                    <View>
                        <Text style={styles.riderName}>{activePartner.name}</Text>
                        {activePartner.phone_number && <Text style={styles.riderPhone}>{activePartner.phone_number}</Text>}
                    </View>
                    {/* Call Button */}
                    {activePartner.phone_number && (
                        <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${activePartner.phone_number}`)}>
                            <Ionicons name="call" size={18} color="#000" />
                        </TouchableOpacity>
                    )}
                </View>
            ) : (
                <Text style={styles.waitingText}>{isFailedStatus ? failureReason : 'Assigning Rider...'}</Text>
            )}

            {/* Live Map */}
            {activePartner && !isDelivered(order) && !isFailedStatus && ENABLE_MAP_TRACKING && hasValidMapCenter && (
                <View style={styles.mapContainer}>
                    <WebView
                        ref={webViewRef}
                        style={styles.map}
                        source={{ html: mapHtml }}
                        scrollEnabled={false}
                        onLoad={() => {
                            if (!riderCoordinate) return;
                            const msg = JSON.stringify({ type: 'updateRider', lat: riderCoordinate.latitude, lon: riderCoordinate.longitude, customerLat: customerCoordinate?.latitude, customerLon: customerCoordinate?.longitude });
                            try { webViewRef.current?.postMessage(msg); } catch {}
                        }}
                    />
                    {liveLocation?.eta_minutes && (
                        <View style={styles.etaBadge}>
                            <Text style={styles.etaText}>~ {liveLocation.eta_minutes} mins</Text>
                        </View>
                    )}
                </View>
            )}
              </>
            )}
        </View>

        {/* 4. Payment Details */}
        <View style={styles.card}>
            <Text style={styles.sectionTitle}>Payment</Text>
            <View style={styles.billRow}><Text style={styles.billLabel}>Item Total</Text><Text style={styles.billValue}>₹{itemsTotal.toFixed(2)}</Text></View>
            <View style={styles.billRow}><Text style={styles.billLabel}>Shipping</Text><Text style={[styles.billValue, shippingPrice === 0 && {color:'#4ade80'}]}>{shippingPrice === 0 ? 'FREE' : `₹${shippingPrice}`}</Text></View>
            {couponDiscount > 0 && (
                <View style={styles.billRow}><Text style={styles.billLabel}>Coupon</Text><Text style={[styles.billValue, {color:'#ef4444'}]}>-₹{couponDiscount.toFixed(2)}</Text></View>
            )}
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Delivery</Text>
              <Text style={styles.billValue}>
                {deliverySpeed === 'fast' ? 'Fast (Priority)' : 'Normal'}
              </Text>
            </View>

            {deliverySpeed === 'fast' && (
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Fast delivery fee</Text>
                <Text style={styles.billValue}>₹{shippingExtra.toFixed(0)}</Text>
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.billRow}><Text style={styles.billTotalLabel}>Grand Total</Text><Text style={styles.billTotalValue}>₹{total.toFixed(2)}</Text></View>
        </View>

        {/* 5. Returns */}
        <View style={styles.card}>
            {getExistingReturn(order) ? (
                <View style={styles.infoBox}>
                    <Ionicons name="information-circle" size={20} color="#60A5FA" />
                    <Text style={styles.infoBoxText}>Return Status: {String(getExistingReturn(order).status).toUpperCase()}</Text>
                </View>
            ) : canReturnFinal ? (
                <TouchableOpacity style={styles.returnBtn} onPress={() => router.push(`/orders/${orderId}/return`)}>
                    <Text style={styles.returnBtnText}>Request Return</Text>
                </TouchableOpacity>
            ) : (
                <Text style={styles.waitingText}>Return available within 7 days of delivery.</Text>
            )}
        </View>

        <TouchableOpacity style={styles.shopBtn} onPress={continueShopping}>
            <Text style={styles.shopBtnText}>Continue Shopping</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#001A33' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#ef4444', fontSize: 16 },
  
  // Header
  toolbar: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.3)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  backBtn: { padding: 4 },
  toolbarTitle: { color: '#F9FAFB', fontSize: 18, fontWeight: '700', marginLeft: 16 },
  
  scrollContent: { padding: 16, paddingBottom: 80 },

  // Cards
  card: { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  
  // Success Animation
  successIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#22c55e', justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowColor: '#22c55e', shadowOpacity: 0.5, shadowRadius: 10, elevation: 10 },
  animatedTitle: { fontSize: 22, fontWeight: '800', color: '#F9FAFB', marginBottom: 4 },
  animatedSub: { fontSize: 14, color: '#94A3B8', marginBottom: 16 },
  
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12, marginBottom: 12 },
  metaLabel: { color: '#94A3B8', fontSize: 13 },
  metaValue: { color: '#F9FAFB', fontWeight: '600', fontSize: 13 },

  // Badges
  badgeRow: { flexDirection: 'row', gap: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  badgeGreen: { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: '#22c55e' },
  badgeYellow: { backgroundColor: 'rgba(234,179,8,0.15)', borderColor: '#eab308' },
  badgeBlue: { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: '#3b82f6' },
  badgeRed: { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: '#ef4444' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  textGreen: { color: '#4ade80' },
  textYellow: { color: '#facc15' },
  textBlue: { color: '#60a5fa' },
  textRed: { color: '#f87171' },

  // Items
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#F9FAFB', marginBottom: 12 },
  itemRow: { flexDirection: 'row', marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 10 },
  itemImgWrapper: { width: 50, height: 50, borderRadius: 8, backgroundColor: '#1e293b', marginRight: 12, overflow: 'hidden' },
  itemImg: { width: '100%', height: '100%' },
  itemInfo: { flex: 1, justifyContent: 'center' },
  itemName: { color: '#F9FAFB', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  attrRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  attrBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  attrText: { color: '#cbd5e1', fontSize: 10 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  qtyText: { color: '#94A3B8', fontSize: 12 },
  priceText: { color: '#D4AF37', fontWeight: '700', fontSize: 13 },

  // Tracking
  statusBox: { backgroundColor: 'rgba(212,175,55,0.15)', padding: 8, borderRadius: 8, marginBottom: 12, alignItems: 'center' },
  statusBoxText: { color: '#D4AF37', fontWeight: '700', fontSize: 13 },
  riderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  riderAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  riderName: { color: '#F9FAFB', fontWeight: '600', fontSize: 14 },
  riderPhone: { color: '#94A3B8', fontSize: 12 },
  callBtn: { marginLeft: 'auto', backgroundColor: '#D4AF37', padding: 8, borderRadius: 20 },
  waitingText: { color: '#94A3B8', fontSize: 13, fontStyle: 'italic' },
  
  // Map
  mapContainer: { height: 200, borderRadius: 12, overflow: 'hidden', marginTop: 10, borderWidth: 1, borderColor: '#1e293b' },
  map: { flex: 1 },
  etaBadge: { position: 'absolute', bottom: 10, right: 10, backgroundColor: '#000', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  etaText: { color: '#D4AF37', fontWeight: '700', fontSize: 11 },

  // Bill
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  billLabel: { color: '#94A3B8', fontSize: 13 },
  billValue: { color: '#F9FAFB', fontSize: 13, fontWeight: '500' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 8 },
  billTotalLabel: { color: '#F9FAFB', fontSize: 15, fontWeight: '700' },
  billTotalValue: { color: '#D4AF37', fontSize: 18, fontWeight: '700' },

  // Actions
  infoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59,130,246,0.15)', padding: 10, borderRadius: 8 },
  infoBoxText: { color: '#60A5FA', marginLeft: 8, fontWeight: '600' },
  returnBtn: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ef4444', alignItems: 'center' },
  returnBtnText: { color: '#ef4444', fontWeight: '700' },
  shopBtn: { backgroundColor: '#D4AF37', padding: 16, borderRadius: 30, alignItems: 'center', marginTop: 10, marginBottom: 20 },
  shopBtnText: { color: '#000', fontWeight: '700', fontSize: 16 },
});
