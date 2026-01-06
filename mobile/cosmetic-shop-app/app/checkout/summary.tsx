// app/checkout/summary.tsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../../src/components/AppHeader';
import client from '../../src/api/client';
import { useNavBar } from '../../src/context/NavBarContext';
import AnimatedBackground from '../../src/components/AnimatedBackground';
import { useGlobalLocation } from '../../src/context/LocationContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  loadCheckoutItems,
  fetchCartFromBackend,
  unitPriceOf,
  qtyOf,
  calcShipping,
} from '../../src/utils/checkout';

type AnyItem = any;
type Product = any;
const CHECKOUT_DELIVERY_SPEED_KEY = '@checkout_delivery_speed';

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

const SummaryScreen = () => {
  const router = useRouter();
  const { handleScroll: handleNavScroll } = useNavBar();
  const userInfo = useSelector((s: any) => s.userLogin?.userInfo || s.user?.userInfo);

  const [loading, setLoading] = useState(true);
  const [usingBuyNow, setUsingBuyNow] = useState(false);
  const [sourceItems, setSourceItems] = useState<AnyItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [discountProducts, setDiscountProducts] = useState<Product[]>([]);
  const [exploreProducts, setExploreProducts] = useState<Product[]>([]);

  const { location: userLocation, refreshLocation } = useGlobalLocation();

  useEffect(() => {
    const init = async () => {
      try {
        if (!userInfo) {
          router.replace('/login?redirect=/checkout/summary');
          return;
        }
        setLoading(true);
        refreshLocation();
        const buyNowItems = await loadCheckoutItems();
        if (buyNowItems.length) {
          setUsingBuyNow(true);
          setSourceItems(buyNowItems);
          await loadRecommendations(buyNowItems, userLocation);
        } else {
          const cart = await fetchCartFromBackend();
          const items = cart.cart_items || cart.items || cart.data?.items || [];
          if (!items.length) setError('Your cart is empty.');
          setUsingBuyNow(false);
          setSourceItems(items);
          await loadRecommendations(items, userLocation);
        }
      } catch (e: any) {
        setError(e?.response?.data?.detail || e?.message || 'Failed to load summary.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [userInfo]);

  const loadRecommendations = async (items: AnyItem[], location: {lat: number, lon: number} | null) => {
    try {
      const productIds = Array.from(new Set(items.map((it: any) => it.product?.id || it.meta?.product?.id).filter(Boolean)));
      const base = { context: 'summary', for_products: productIds.join(','), limit: 6, ...(location ? { lat: location.lat, lon: location.lon } : {}) };
      const [similarRes, discountRes, exploreRes] = await Promise.all([
        client.get('/api/recommendations/', { params: { ...base, type: 'same_category' } }),
        client.get('/api/recommendations/', { params: { ...base, type: 'discounts' } }),
        client.get('/api/recommendations/', { params: { ...base, type: 'behavioral' } }),
      ]);
      setSimilarProducts(similarRes.data || []);
      setDiscountProducts(discountRes.data || []);
      setExploreProducts(exploreRes.data || []);
    } catch {}
  };

  const itemsPrice = useMemo(() => sourceItems.reduce((sum, it) => sum + unitPriceOf(it, usingBuyNow) * qtyOf(it, usingBuyNow), 0), [sourceItems, usingBuyNow]);
  const [deliverySpeed, setDeliverySpeed] = useState<'normal' | 'fast'>('normal');

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CHECKOUT_DELIVERY_SPEED_KEY);
        if (raw) setDeliverySpeed(raw === 'fast' ? 'fast' : 'normal');
      } catch {}
    })();
  }, []);

  const setDeliverySpeedAndPersist = async (next: 'normal' | 'fast') => {
    setDeliverySpeed(next);
    try { await AsyncStorage.setItem(CHECKOUT_DELIVERY_SPEED_KEY, next); } catch {}
  };

  const baseShippingPrice = useMemo(() => calcShipping(itemsPrice), [itemsPrice]);
  const shippingPrice = useMemo(() => baseShippingPrice + (deliverySpeed === 'fast' ? 20 : 0), [baseShippingPrice, deliverySpeed]);
  const totalPrice = useMemo(() => itemsPrice + shippingPrice, [itemsPrice, shippingPrice]);

  const goToShipping = () => router.push('/checkout/shipping');

  const RenderRecoSection = ({ title, list, typeKey }: { title: string; list: Product[]; typeKey: string }) => {
    if (!list?.length) return null;
    return (
      <View style={styles.recoContainer}>
        <View style={styles.shimmerHeaderRow}>
          <View style={styles.shimmerPill}><Text style={styles.shimmerText}>{title}</Text></View>
        </View>
        <View style={styles.grid}>
          {list.map((p: any) => (
            <TouchableOpacity key={p.id} style={styles.gridCard} onPress={() => router.push({ pathname: '/product/[id]', params: { id: p.id } })}>
              <View style={styles.gridImgWrapper}><Image source={{ uri: p.image }} style={styles.gridImg} resizeMode="contain" /></View>
              <Text numberOfLines={1} style={styles.gridName}>{p.name}</Text>
              <Text style={styles.gridPrice}>₹{Number(p.price).toFixed(0)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  if (loading) return <SafeAreaView style={styles.safeArea}><ActivityIndicator style={{flex:1}} color="#D4AF37" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <AnimatedBackground />
      <StatusBar barStyle="light-content" />
      <AppHeader placeholder="Search products..." />

      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#F9FAFB" /></TouchableOpacity>
        <Text style={styles.toolbarTitle}> Order Summary</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        onScroll={handleNavScroll}
        scrollEventThrottle={16}
      >
        {/* Items Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Items ({sourceItems.length})</Text>
          {sourceItems.map((it, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Image source={{ uri: it.product?.image || it.meta?.product?.image }} style={styles.itemImage} />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{it.product?.name || it.meta?.product?.name}</Text>
                <Text style={styles.itemPrice}>₹{unitPriceOf(it, usingBuyNow)} x {qtyOf(it, usingBuyNow)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Price Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Price Details</Text>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal</Text><Text style={styles.summaryValue}>₹{itemsPrice.toFixed(0)}</Text></View>
          
          <View style={styles.deliveryBlock}>
             <Text style={styles.deliveryBlockTitle}>Delivery Option</Text>
             <View style={styles.deliveryPillsRow}>
                <TouchableOpacity onPress={() => setDeliverySpeedAndPersist('normal')} style={[styles.deliveryPill, deliverySpeed === 'normal' && styles.deliveryPillActive]}>
                  <Text style={[styles.deliveryPillText, deliverySpeed === 'normal' && styles.deliveryPillTextActive]}>Normal</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setDeliverySpeedAndPersist('fast')} style={[styles.deliveryPill, deliverySpeed === 'fast' && styles.deliveryPillActive, {marginLeft: 10}]}>
                  <Text style={[styles.deliveryPillText, deliverySpeed === 'fast' && styles.deliveryPillTextActive]}>Fast (+₹20)</Text>
                </TouchableOpacity>
             </View>
          </View>

          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Shipping</Text><Text style={styles.summaryValue}>₹{shippingPrice}</Text></View>
          <View style={[styles.summaryRow, {marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 10}]}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>₹{totalPrice.toFixed(0)}</Text>
          </View>
        </View>

        {/* ✅ ACTION BUTTON MOVED HERE: After Price Details, Before Recommendations */}
        <View style={styles.inlineActionContainer}>
            <TouchableOpacity style={styles.proceedBtn} onPress={goToShipping}>
                <Text style={styles.proceedBtnText}>Continue to Payment</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
        </View>

        {/* Recommendations */}
        <RenderRecoSection title="Similar Products" list={similarProducts} typeKey="same_category" />
        <RenderRecoSection title="Biggest Discounts" list={discountProducts} typeKey="discounts" />
        <RenderRecoSection title="More to Explore" list={exploreProducts} typeKey="behavioral" />
      </ScrollView>
    </SafeAreaView>
  );
};

export default SummaryScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#001A33' },
  toolbar: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.3)' },
  toolbarTitle: { fontSize: 18, fontWeight: '700', color: '#F9FAFB' },
  card: { margin: 16, padding: 16, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cardHeader: { fontSize: 16, fontWeight: '800', color: '#F9FAFB', marginBottom: 12 },
  itemRow: { flexDirection: 'row', marginBottom: 12 },
  itemImage: { width: 50, height: 50, borderRadius: 8 },
  itemInfo: { marginLeft: 12, justifyContent: 'center' },
  itemName: { color: '#F9FAFB', fontSize: 14, fontWeight: '600' },
  itemPrice: { color: '#FACC15', fontSize: 13 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { color: '#CBD5E1' },
  summaryValue: { color: '#F9FAFB', fontWeight: '700' },
  totalLabel: { color: '#F9FAFB', fontSize: 16, fontWeight: '800' },
  totalValue: { color: '#D4AF37', fontSize: 18, fontWeight: '900' },
  
  // ✅ NEW BUTTON CONTAINER
  inlineActionContainer: {
    paddingHorizontal: 16,
    marginVertical: 10,
  },
  proceedBtn: {
    backgroundColor: '#D4AF37',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#D4AF37',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  proceedBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, marginRight: 8 },

  deliveryBlock: { marginVertical: 12, padding: 10, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10 },
  deliveryBlockTitle: { color: '#F9FAFB', fontSize: 12, marginBottom: 8, fontWeight: '700' },
  deliveryPillsRow: { flexDirection: 'row' },
  deliveryPill: { flex: 1, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center' },
  deliveryPillActive: { borderColor: '#D4AF37', backgroundColor: 'rgba(212,175,55,0.1)' },
  deliveryPillText: { color: '#CBD5E1', fontSize: 12 },
  deliveryPillTextActive: { color: '#D4AF37', fontWeight: '800' },

  recoContainer: { marginTop: 20 },
  shimmerHeaderRow: { paddingHorizontal: 16, marginBottom: 10 },
  shimmerPill: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: '#D4AF37' },
  shimmerText: { color: '#F9FAFB', fontSize: 12, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  gridCard: { width: '46%', margin: '2%', backgroundColor: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 10 },
  gridImgWrapper: { height: 100, backgroundColor: '#fff', borderRadius: 8, marginBottom: 8 },
  gridImg: { width: '100%', height: '100%' },
  gridName: { color: '#E5E7EB', fontSize: 11 },
  gridPrice: { color: '#F9FAFB', fontWeight: '700' },
});
