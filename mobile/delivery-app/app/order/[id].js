import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Linking,
  Image,
  Modal,
  Pressable,
  Animated,
  PanResponder,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
// REMOVED: react-native-maps (the cause of the crash)
// ADDED: WebView for crash-proof OSM
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import client from "../../src/api/client";
import { startTracking } from "../../src/location/startTracking";
import { stopTracking } from "../../src/location/stopTracking";

// ---------------- Constants ----------------
const FAIL_REASONS = [
  { code: "addr_bad", text: "Incorrect / incomplete address" },
  { code: "no_one", text: "No one available to receive" },
  { code: "no_contact", text: "Unable to contact customer" },
  { code: "closed", text: "Shop / house closed" },
  { code: "restricted", text: "Restricted / inaccessible area" },
  { code: "reschedule", text: "Customer asked to reschedule" },
  { code: "cod_money", text: "COD amount not ready" },
  { code: "weather", text: "Bad weather / unsafe" },
  { code: "logistics", text: "Vehicle / logistics issue" },
  { code: "damage", text: "Package damaged" },
];

const REJECT_REASONS = [
  { code: "busy", text: "Busy – another task" },
  { code: "vehicle", text: "Vehicle issue" },
  { code: "far", text: "Too far from pickup area" },
  { code: "oor", text: "Out of assigned area" },
  { code: "safety", text: "Safety concerns" },
  { code: "pay", text: "Compensation too low" },
  { code: "personal", text: "Personal reason" },
];

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  text: "#111827",
  sub: "#6B7280",
  border: "rgba(17,24,39,0.10)",
  muted: "#9CA3AF",
  shadow: "#000",
  green: "#22C55E",
  red: "#EF4444",
  amber: "#F59E0B",
  blue: "#3B82F6",
  purple: "#8B5CF6",
};

// ---------------- Helpers ----------------
const buildVariantChips = (it) => {
  const chips = [];
  const added = new Set();

  const push = (label, value) => {
    if (!value) return;
    const str = String(value).trim();
    if (!str) return;

    const key = str.toLowerCase();
    if (added.has(key)) return;
    added.add(key);

    let display = str;
    if (label) {
      const niceLabel = label.charAt(0).toUpperCase() + label.slice(1);
      if (key.startsWith(niceLabel.toLowerCase() + ":")) display = str;
      else display = `${niceLabel}: ${str}`;
    }
    chips.push(display);
  };

  const color = it.color_name || it.color || it.colour;
  if (color) push("Color", color);

  const variation = it.variation || it.meta?.variation || {};

  if (variation.value) {
    let label = variation.name || "Option";
    if (label.toLowerCase() === "color" || label.toLowerCase() === "colour") {
      if (!color) push("Color", variation.value);
    } else {
      if (!color || String(variation.value).toLowerCase() !== String(color).toLowerCase()) {
        push(label, variation.value);
      }
    }
  }

  if (typeof it.display_attributes === "string") {
    it.display_attributes.split("/").forEach((p) => {
      const val = p.trim();
      if (!val) return;
      const alreadyExists = [...added].some((existing) => existing.includes(val.toLowerCase()));
      if (!alreadyExists) push(null, val);
    });
  }

  return chips;
};

const getItemName = (it, idx) => it.product_name || it.name || it.product?.name || `Item ${idx + 1}`;
const getItemQty = (it) => Number(it.quantity ?? it.qty ?? 1) || 1;

const toNum = (v) => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const formatDateTime = (val) => {
  if (!val) return "N/A";
  try {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return String(val);
    return d.toLocaleString();
  } catch (e) {
    return String(val);
  }
};

const getStatusLower = (o) => String(o?.delivery_status || o?.deliveryStatus || o?.status || "").toLowerCase();

const isCancelledOrder = (o) => {
  const st = getStatusLower(o);
  return st === "cancelled" || st === "canceled";
};

const getCancelReason = (o) => String(o?.cancel_reason || o?.cancelReason || "").trim();
const getCancelledAt = (o) => o?.cancelled_at || o?.cancelledAt || null;

// ---------------- UI helpers ----------------
const StatusPill = ({ status }) => {
  const s = String(status || "").toLowerCase();

  const meta =
    s === "delivered"
      ? { bg: "rgba(34,197,94,0.12)", fg: COLORS.green, icon: "checkmark-circle-outline" }
      : s === "failed"
      ? { bg: "rgba(239,68,68,0.12)", fg: COLORS.red, icon: "close-circle-outline" }
      : s === "reject" || s === "rejected"
      ? { bg: "rgba(245,158,11,0.12)", fg: COLORS.amber, icon: "hand-left-outline" }
      : s === "accepted"
      ? { bg: "rgba(245,158,11,0.12)", fg: COLORS.amber, icon: "hand-left-outline" }
      : s === "onway" || s === "enroute"
      ? { bg: "rgba(139,92,246,0.14)", fg: COLORS.purple, icon: "navigate-outline" }
      : s === "cancelled" || s === "canceled"
      ? { bg: "rgba(239,68,68,0.12)", fg: COLORS.red, icon: "ban-outline" }
      : { bg: "rgba(59,130,246,0.12)", fg: COLORS.blue, icon: "flash-outline" };

  return (
    <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
      <Ionicons name={meta.icon} size={14} color={meta.fg} />
      <Text style={[styles.statusPillText, { color: meta.fg }]}>{(s || "unknown").toUpperCase()}</Text>
    </View>
  );
};

// ---------------- iPhone-style Slide to confirm ----------------
const SlideToUnlock = ({ text = "slide to confirm", color = "#22C55E", onSlideComplete, disabled = false }) => {
  const THUMB_W = 64;
  const INSET = 6;

  const [trackW, setTrackW] = useState(0);

  const x = useRef(new Animated.Value(0)).current;
  const hint = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(false);

  const maxX = Math.max(0, trackW - (THUMB_W + INSET * 2));
  const safeMax = Math.max(1, maxX);

  const progress = x.interpolate({
    inputRange: [0, safeMax],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const labelOpacity = progress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [1, 0.65, 0.15],
    extrapolate: "clamp",
  });

  const arrowOpacity = progress.interpolate({
    inputRange: [0, 0.86, 1],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  const checkOpacity = progress.interpolate({
    inputRange: [0, 0.86, 1],
    outputRange: [0, 0, 1],
    extrapolate: "clamp",
  });

  const glowOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.0, 0.18],
    extrapolate: "clamp",
  });

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(hint, {
        toValue: 1,
        duration: 1400,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => {
      try {
        loop.stop();
      } catch (e) {}
    };
  }, []);

  const hintX = hint.interpolate({
    inputRange: [0, 1],
    outputRange: [-18, 18],
  });

  const reset = () => {
    doneRef.current = false;
    Animated.spring(x, {
      toValue: 0,
      speed: 18,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  };

  const finish = async () => {
    if (disabled || doneRef.current) return;
    doneRef.current = true;

    Animated.spring(x, {
      toValue: maxX,
      speed: 20,
      bounciness: 0,
      useNativeDriver: true,
    }).start(async () => {
      try {
        await onSlideComplete?.();
      } finally {
        setTimeout(() => reset(), 350);
      }
    });
  };

  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: (_, g) => !disabled && Math.abs(g.dx) > 2,
      onPanResponderMove: (_, g) => {
        if (disabled || doneRef.current) return;
        const dx = Math.max(0, Math.min(maxX, g.dx));
        x.setValue(dx);
      },
      onPanResponderRelease: (_, g) => {
        if (disabled || doneRef.current) return;
        const dx = Math.max(0, Math.min(maxX, g.dx));
        const reached = dx >= maxX * 0.92; // like old iPhone slider (must reach end)
        if (reached) finish();
        else reset();
      },
      onPanResponderTerminate: () => reset(),
    });
  }, [disabled, maxX]);

  return (
    <View style={[styles.slideBox, disabled ? { opacity: 0.45 } : null]} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
      <View style={styles.slideTrack}>
        <Animated.View style={[styles.slideGlow, { backgroundColor: color, opacity: glowOpacity }]} />

        <Animated.View style={[styles.slideHintRow, { transform: [{ translateX: hintX }] }]}>
          <Ionicons name="chevron-forward" size={18} color="rgba(17,24,39,0.22)" />
          <Ionicons name="chevron-forward" size={18} color="rgba(17,24,39,0.18)" />
          <Ionicons name="chevron-forward" size={18} color="rgba(17,24,39,0.14)" />
        </Animated.View>

        <Animated.Text style={[styles.slideText, { opacity: labelOpacity }]} numberOfLines={1}>
          {text}
        </Animated.Text>

        <Animated.View
          style={[
            styles.slideThumb,
            {
              width: THUMB_W,
              transform: [{ translateX: x }],
              left: 6,
            },
          ]}
          {...panResponder.panHandlers}
        >
          <View style={styles.slideThumbInner}>
            <Animated.View style={{ position: "absolute", opacity: arrowOpacity }}>
              <Ionicons name="chevron-forward" size={22} color={color} />
            </Animated.View>
            <Animated.View style={{ position: "absolute", opacity: checkOpacity }}>
              <Ionicons name="checkmark" size={22} color={color} />
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

export default function OrderDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [shop, setShop] = useState(null);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);

  // Live location
  const [live, setLive] = useState(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState(null);

  // Image Preview
  const [previewImage, setPreviewImage] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  // Reasons
  const [reasonVisible, setReasonVisible] = useState(false);
  const [reasonMode, setReasonMode] = useState(null); // "reject" | "failed"

  // Toast popup
  const [toast, setToast] = useState({ visible: false, title: "", sub: "", kind: "success" });
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastY = useRef(new Animated.Value(-14)).current;
  const toastTimerRef = useRef(null);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(toastOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(toastY, { toValue: -14, duration: 160, useNativeDriver: true }),
    ]).start(() => setToast((p) => ({ ...p, visible: false })));
  };

  const showToast = (title, sub = "", kind = "success") => {
    try {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    } catch (e) {}

    setToast({ visible: true, title, sub, kind });

    toastOpacity.setValue(0);
    toastY.setValue(-14);

    Animated.parallel([
      Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(toastY, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();

    toastTimerRef.current = setTimeout(() => hideToast(), 1350);
  };

  // -------- Load Order Details --------
  const load = async () => {
    try {
      let found = null;
      try {
        const res = await client.get("/api/delivery/active-orders/");
        found = (res.data || []).find((o) => String(o.id) === String(id));
      } catch (err) { console.log("active check fail", err.message); }

      if (!found) {
        try {
          const res2 = await client.get("/api/delivery/delivered-orders/");
          found = (res2.data || []).find((o) => String(o.id) === String(id));
        } catch (err2) { console.log("delivered check fail", err2.message); }
      }

      if (!found) {
        try {
          const res3 = await client.get("/api/delivery/failed-orders/");
          found = (res3.data || []).find((o) => String(o.id) === String(id));
        } catch (err3) { console.log("failed check fail", err3.message); }
      }

      if (!found) {
        setData(null);
        setItems([]);
        setShop(null);
        setPayment(null);
        setLoading(false);
        return;
      }

      setData(found);
      setItems(found.items || []);
      setShop(found.shop || null);
      setPayment({ method: found.payment_method, status: found.payment_status });

      if (isCancelledOrder(found)) {
        try { await stopTracking(); } catch (e) {}
        setLive(null);
        setLiveError(null);
        setLiveLoading(false);
      }
    } catch (e) {
      console.log("Order detail error:", e.response?.data || e.message);
    }
    setLoading(false);
  };

  const loadLive = async () => {
    if (isCancelledOrder(data)) {
      setLive(null);
      setLiveError(null);
      setLiveLoading(false);
      return;
    }
    try {
      const res = await client.get(`/api/delivery/order/${id}/live-location/`);
      setLive(res.data);
      setLiveError(null);
    } catch (e) {
      setLiveError(e.response?.data?.detail || "Could not load live map");
    }
    setLiveLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    setLiveLoading(true);
    loadLive();
    if (isCancelledOrder(data)) return;
    const interval = setInterval(loadLive, 10000);
    return () => clearInterval(interval);
  }, [id, data?.status, data?.delivery_status]);

  const updateStatus = async (status, extra = {}) => {
    if (!data) return;
    if (isCancelledOrder(data)) {
      showToast("Cancelled", "Order was cancelled.", "error");
      return;
    }
    setBtnLoading(true);
    try {
      await client.post("/api/delivery/update-status/", { order_id: data.id, status, ...extra });
      if (status === "accept") {
        await startTracking();
        showToast("Great! Order accepted", "", "success");
        await load();
      } else if (status === "eta") {
        showToast("ETA Updated", "ETA set successfully", "info");
        await load();
      } else if (status === "onway") {
        await startTracking();
        showToast("Nice! Make fast delivery now", "", "info");
        await load();
      } else if (status === "delivered") {
        await stopTracking();
        showToast("Congrats! You made it", "", "success");
        setTimeout(() => router.replace("/home"), 700);
      } else if (status === "reject" || status === "failed") {
        await stopTracking();
        router.replace("/home");
      } else {
        await load();
      }
    } catch (e) {
      showToast("Error", e.response?.data?.detail || "Could not update", "error");
    } finally {
      setBtnLoading(false);
    }
  };

  const openReasonPicker = (mode) => {
    setReasonMode(mode);
    setReasonVisible(true);
  };

  const pickReason = (reasonText) => {
    if (!reasonMode) return;
    setReasonVisible(false);
    updateStatus(reasonMode === "reject" ? "reject" : "failed", { reason: reasonText, mode: reasonMode });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.text} />
        <Text style={{ marginTop: 10, color: COLORS.sub, fontWeight: "700" }}>Loading order…</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={{ color: COLORS.sub, fontWeight: "800" }}>Order not found.</Text>
      </View>
    );
  }

  const shipping = { name: data.customer_name || "", full: data.shipping_address || "", phone: data.customer_phone || "" };
  const totalPrice = Number(data.total_price || 0);
  const shippingCharge = Number(data.shipping_price || 0);
  const deliverySpeed =
    String(
      data?.delivery_speed ??
      data?.deliverySpeed ??
      (data?.is_fast_delivery ? "fast" : "normal")
    ).toLowerCase() === "fast"
      ? "fast"
      : "normal";
  
  const fastFee = Number(data.shipping_extra_price || (deliverySpeed === "fast" ? 20 : 0));
  const baseShipping = Math.max(0, shippingCharge - fastFee);
  
  const itemsTotal = Math.max(0, totalPrice - shippingCharge);
  const grandTotal = totalPrice;
  const paymentMethod = data.payment_method || "";
  const isPaid = !!data.is_paid;

  const shopLat = toNum(live?.shop?.lat ?? live?.shop?.latitude);
  const shopLon = toNum(live?.shop?.lon ?? live?.shop?.longitude);
  const riderLat = toNum(live?.delivery_partner?.latitude ?? live?.rider?.latitude);
  const riderLon = toNum(live?.delivery_partner?.longitude ?? live?.rider?.longitude);
  const customerLat = toNum(live?.customer_location?.latitude);
  const customerLon = toNum(live?.customer_location?.longitude);

  const centerLat = riderLat ?? customerLat ?? shopLat ?? 34.083658;
  const centerLon = riderLon ?? customerLon ?? shopLon ?? 74.797368;

  const statusLower = getStatusLower(data);
  const isCancelled = isCancelledOrder(data);
  const cancelReason = getCancelReason(data);
  const cancelledAt = getCancelledAt(data);

  const canAccept = statusLower === "new";
  const isAccepted = statusLower === "accepted";
  const isEnroute = ["onway", "enroute"].includes(statusLower);
  const isTerminal = ["delivered", "failed", "cancelled", "canceled"].includes(statusLower);
  const reasonText = !isCancelled ? (data.reason || data.failure_reason || data.rejection_reason) : null;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
        <View style={styles.pageHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.85}>
            <Ionicons name="chevron-back" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Order #{data.id}</Text>
            <Text style={styles.pageSub} numberOfLines={1}>{shipping.name || "Customer"}</Text>
          </View>
          <StatusPill status={statusLower} />
          {deliverySpeed === "fast" && (
            <View style={styles.fastBanner}>
              <Ionicons name="flash" size={18} color="#fff" />
              <Text style={styles.fastBannerText}>
                FAST DELIVERY • PRIORITY ORDER
              </Text>
            </View>
          )}
        </View>

        {isCancelled && (
          <View style={styles.cancelBanner}>
            <View style={styles.cancelBannerRow}>
              <Ionicons name="ban-outline" size={18} color={COLORS.red} />
              <Text style={styles.cancelBannerTitle}>Order Cancelled</Text>
            </View>
            <Text style={styles.cancelBannerText}>Reason: {cancelReason || "Cancelled by customer"}</Text>
            <Text style={styles.cancelBannerText}>At: {formatDateTime(cancelledAt)}</Text>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.text} />
            <Text style={styles.cardTitle}>Status</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={styles.bigValue}>{(statusLower || "n/a").toUpperCase()}</Text>
            {!isCancelled && <StatusPill status={statusLower} />}
          </View>
          {reasonText && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.k}>Reason</Text>
              <Text style={styles.v}>{reasonText}</Text>
            </View>
          )}
        </View>
        {/* Add this inside your ScrollView in [id].js */}
        
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="navigate-outline" size={16} color={COLORS.text} />
            <Text style={styles.cardTitle}>Trip Details</Text>
          </View>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={styles.k}>Distance</Text>
              <Text style={styles.bigValue}>{data.distance_km || 0} km</Text>
            </View>
            <View>
              <Text style={styles.k}>Est. Earning</Text>
              <Text style={[styles.bigValue, { color: COLORS.green }]}>
                ₹{(25 + Math.max(0, (data.distance_km || 0) - 2) * 10).toFixed(0)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="cart-outline" size={16} color={COLORS.text} />
            <Text style={styles.cardTitle}>Items</Text>
          </View>
          {!items.length ? (
            <Text style={styles.v}>No items found.</Text>
          ) : (
            items.map((it, idx) => {
              const name = getItemName(it, idx);
              const qty = getItemQty(it);
              const chips = buildVariantChips(it);
              const img = it.image_url;
              const price = Number(it.price || 0);
              return (
                <View key={it.id || idx} style={styles.itemRow}>
                  {img ? (
                    <TouchableOpacity activeOpacity={0.85} onPress={() => { setPreviewImage(img); setPreviewVisible(true); }}>
                      <Image source={{ uri: img }} style={styles.itemImage} />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.itemImagePlaceholder}><Text style={styles.itemImagePlaceholderText}>No image</Text></View>
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.itemTitle} numberOfLines={2}>{name}</Text>
                    {chips.length > 0 && (
                      <View style={styles.variantRow}>
                        {chips.map((txt, i) => <View key={i} style={styles.variantPill}><Text style={styles.variantText}>{txt}</Text></View>)}
                      </View>
                    )}
                    <View style={styles.itemMetaRow}>
                      <Text style={styles.itemPrice}>₹{price.toFixed(0)}</Text>
                      <Text style={styles.itemQty}>Qty: {qty}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="wallet-outline" size={16} color={COLORS.text} />
            <Text style={styles.cardTitle}>Payment Summary</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.k}>Items total</Text>
            <Text style={styles.v}>₹{itemsTotal.toFixed(0)}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.k}>Delivery</Text>
            <Text style={styles.v}>
              {deliverySpeed === "fast" ? "Fast (Priority)" : "Normal"}
            </Text>
          </View>
          
          {deliverySpeed === "fast" && (
            <View style={styles.summaryRow}>
              <Text style={styles.k}>Fast delivery fee</Text>
              <Text style={styles.v}>₹{fastFee.toFixed(0)}</Text>
            </View>
          )}
          
          <View style={styles.summaryRow}>
            <Text style={styles.k}>Shipping</Text>
            <Text style={styles.v}>₹{shippingCharge.toFixed(0)}</Text>
          </View>
          
          <View style={[styles.summaryRow, { marginTop: 8 }]}>
            <Text style={[styles.k, { fontWeight: "900", color: COLORS.text }]}>Grand total</Text>
            <Text style={[styles.bigValue, { fontSize: 18 }]}>₹{grandTotal.toFixed(0)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.k}>Payment</Text>
            <Text style={styles.v}>{paymentMethod === "COD" ? "Cash on Delivery" : paymentMethod}{isPaid ? " • Paid" : ""}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="person-outline" size={16} color={COLORS.text} />
            <Text style={styles.cardTitle}>Customer</Text>
          </View>
          <Text style={styles.k}>Name</Text>
          <Text style={styles.v}>{shipping.name || "N/A"}</Text>
          <Text style={[styles.k, { marginTop: 10 }]}>Address</Text>
          <Text style={styles.v}>{shipping.full || "N/A"}</Text>
          <Text style={[styles.k, { marginTop: 10 }]}>Phone</Text>
          <TouchableOpacity onPress={() => shipping.phone && Linking.openURL(`tel:${shipping.phone}`)}>
            <Text style={[styles.v, { color: shipping.phone ? COLORS.blue : COLORS.muted }]}>{shipping.phone || "N/A"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="storefront-outline" size={16} color={COLORS.text} />
            <Text style={styles.cardTitle}>Pickup Shop</Text>
          </View>
          <Text style={styles.k}>Name</Text>
          <Text style={styles.v}>{shop?.name || "N/A"}</Text>
          <Text style={[styles.k, { marginTop: 10 }]}>Address</Text>
          <Text style={styles.v}>{shop?.address || "N/A"}</Text>
          <Text style={[styles.k, { marginTop: 10 }]}>Phone</Text>
          <TouchableOpacity onPress={() => shop?.phone && Linking.openURL(`tel:${shop.phone}`)}>
            <Text style={[styles.v, { color: shop?.phone ? COLORS.blue : COLORS.muted }]}>{shop?.phone || "N/A"}</Text>
          </TouchableOpacity>
        </View>

        {/* --- CRASH-PROOF LIVE MAP (STREET MAP WITH CUSTOM ICONS) --- */}
        <View style={[styles.card, { height: 340, padding: 0, overflow: 'hidden' }]}>
          <View style={{ padding: 14, paddingBottom: 0, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="map-outline" size={16} color={COLORS.text} />
            <Text style={styles.cardTitle}>Live Delivery Route</Text>
          </View>
        
          {isCancelled ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
               <Ionicons name="map-outline" size={40} color={COLORS.muted} />
               <Text style={{ color: COLORS.sub, marginTop: 8, fontWeight: '700' }}>Tracking disabled for cancelled orders.</Text>
            </View>
          ) : liveLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={COLORS.text} />
              <Text style={{ marginTop: 8, color: COLORS.sub, fontWeight: '700' }}>Loading Map...</Text>
            </View>
          ) : (
            <WebView
              style={{ flex: 1, marginTop: 10 }}
              originWhitelist={['*']}
              scrollEnabled={false} // Prevents accidental scrolling of the whole page while interacting with map
              source={{
                html: `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
                  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
                  <style>
                    body { margin: 0; padding: 0; background: #f9f9f9; }
                    #map { height: 100vh; width: 100vw; }
                            
                    /* Custom Icon Styling */
                    .marker-pin {
                      width: 34px;
                      height: 34px;
                      border-radius: 50% 50% 50% 0;
                      background: #fff;
                      position: absolute;
                      transform: rotate(-45deg);
                      left: 50%;
                      top: 50%;
                      margin: -17px 0 0 -17px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      box-shadow: 0 4px 10px rgba(0,0,0,0.2);
                      border: 2px solid white;
                    }
        
                    .marker-pin span {
                      transform: rotate(45deg);
                      font-size: 20px;
                    }
        
                    .bg-rider { background: #3B82F6; }   /* Blue */
                    .bg-shop { background: #F59E0B; }    /* Orange */
                    .bg-customer { background: #22C55E; } /* Green */
                  </style>
                </head>
                <body>
                  <div id="map"></div>
                  <script>
                    var map = L.map('map', { zoomControl: false }).setView([${centerLat}, ${centerLon}], 14);
                            
                    // Add standard OpenStreetMap layer
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                      attribution: '© OSM'
                    }).addTo(map);
        
                    var bounds = [];
        
                    // Function to create beautiful HTML markers
                    function createIcon(emoji, colorClass) {
                      return L.divIcon({
                        className: 'custom-div-icon',
                        html: "<div class='marker-pin " + colorClass + "'><span>" + emoji + "</span></div>",
                        iconSize: [30, 42],
                        iconAnchor: [15, 42]
                      });
                    }
       
                    // Define the 3 main points
                    var locations = [
                      { lat: ${shopLat}, lon: ${shopLon}, label: "SHOP", icon: "🏪", cls: "bg-shop" },
                      { lat: ${riderLat}, lon: ${riderLon}, label: "YOU", icon: "🛵", cls: "bg-rider" },
                      { lat: ${customerLat}, lon: ${customerLon}, label: "DROP", icon: "📍", cls: "bg-customer" }
                    ];
        
                    locations.forEach(function(loc) {
                      if(loc.lat && loc.lon && loc.lat !== 0) {
                        L.marker([loc.lat, loc.lon], { icon: createIcon(loc.icon, loc.cls) })
                         .addTo(map)
                         .bindPopup("<b>" + loc.label + "</b>");
                                
                        bounds.push([loc.lat, loc.lon]);
                      }
                    });
        
                    // Ensure the map fits all markers perfectly on any screen size
                    if(bounds.length > 0) {
                      map.fitBounds(bounds, { 
                        padding: [50, 50],
                        maxZoom: 16 
                      });
                    }
                  </script>
                </body>
                </html>
                        `
              }}
            />
          )}
        </View>

        <View style={{ marginTop: 8 }}>
          {isCancelled ? (
            <View style={styles.actionCard}>
              <Text style={styles.actionTitle}>Actions Disabled</Text>
              <SlideToUnlock text="slide to accept" color={COLORS.green} disabled onSlideComplete={() => {}} />
            </View>
          ) : btnLoading ? (
            <ActivityIndicator color={COLORS.text} size="large" style={{ marginTop: 10 }} />
          ) : (
            <View>
              {canAccept && !isTerminal && (
                <View style={styles.actionCard}>
                  <Text style={styles.actionTitle}>New Order</Text>
                  <SlideToUnlock text="slide to accept" color={COLORS.green} onSlideComplete={() => updateStatus("accept")} />
                  <SlideToUnlock text="slide to reject" color={COLORS.amber} onSlideComplete={() => openReasonPicker("reject")} />
                </View>
              )}
              {isAccepted && !isTerminal && (
                <View style={styles.actionCard}>
                  <Text style={styles.actionTitle}>Accepted</Text>
                  <View style={styles.etaRow}>
                    {[5, 10, 20].map((m) => (
                      <TouchableOpacity key={m} style={styles.etaBtn} onPress={() => updateStatus("eta", { eta: m })}><Text style={styles.etaText}>{m} min</Text></TouchableOpacity>
                    ))}
                  </View>
                  <SlideToUnlock text="slide to enroute" color={COLORS.purple} onSlideComplete={() => updateStatus("onway")} />
                  <SlideToUnlock text="slide to failed" color={COLORS.red} onSlideComplete={() => openReasonPicker("failed")} />
                </View>
              )}
              {isEnroute && !isTerminal && (
                <View style={styles.actionCard}>
                  <Text style={styles.actionTitle}>En Route</Text>
                  <SlideToUnlock text="slide to delivered" color={COLORS.green} onSlideComplete={() => updateStatus("delivered")} />
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* MODALS & TOASTS (Identical to original) */}
      <Modal visible={reasonVisible} transparent animationType="slide" onRequestClose={() => setReasonVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setReasonVisible(false)}>
          <Pressable style={[styles.modalCard, { maxHeight: "70%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{reasonMode === "reject" ? "Reject Order" : "Mark as Failed"}</Text>
              <TouchableOpacity onPress={() => setReasonVisible(false)} style={styles.modalClose}><Ionicons name="close" size={18} color={COLORS.text} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(reasonMode === "reject" ? REJECT_REASONS : FAIL_REASONS).map((r) => (
                <TouchableOpacity key={r.code} style={styles.reasonRow} onPress={() => pickReason(r.text)}><Text style={styles.reasonText}>{r.text}</Text><Ionicons name="chevron-forward" size={18} color={COLORS.muted} /></TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
        <Pressable style={styles.previewOverlay} onPress={() => setPreviewVisible(false)}>
          {previewImage && <Image source={{ uri: previewImage }} style={styles.previewImage} resizeMode="contain" />}
        </Pressable>
      </Modal>

      {toast.visible && (
        <View pointerEvents="none" style={styles.toastHost}>
          <Animated.View style={[styles.toastCard, { opacity: toastOpacity, transform: [{ translateY: toastY }] }]}>
            <Ionicons name={toast.kind === "error" ? "close-circle-outline" : "checkmark-circle-outline"} size={18} color={toast.kind === "error" ? COLORS.red : COLORS.green} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.toastTitle, { color: toast.kind === "error" ? COLORS.red : COLORS.green }]}>{toast.title}</Text>
              {toast.sub && <Text style={styles.toastSub}>{toast.sub}</Text>}
            </View>
          </Animated.View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 14, backgroundColor: COLORS.bg },
  pageHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(17,24,39,0.06)", alignItems: "center", justifyContent: "center" },
  pageTitle: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  pageSub: { marginTop: 2, fontSize: 12, fontWeight: "800", color: COLORS.sub },
  card: { backgroundColor: COLORS.card, borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border, elevation: 8 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: "900", color: COLORS.text },
  k: { fontSize: 12, fontWeight: "800", color: COLORS.sub },
  v: { fontSize: 13, fontWeight: "800", color: COLORS.text, marginTop: 4, lineHeight: 18 },
  bigValue: { fontSize: 16, fontWeight: "900", color: COLORS.text },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusPillText: { fontSize: 11, fontWeight: "900" },
  cancelBanner: { backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.22)", padding: 12, borderRadius: 18, marginBottom: 12 },
  cancelBannerTitle: { fontSize: 14, fontWeight: "900", color: COLORS.red },
  cancelBannerText: { fontSize: 12, fontWeight: "800", color: COLORS.text, marginTop: 2 },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  itemImage: { width: 58, height: 58, borderRadius: 14, backgroundColor: "rgba(17,24,39,0.06)" },
  itemTitle: { fontSize: 14, fontWeight: "900", color: COLORS.text },
  itemMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  itemPrice: { fontSize: 14, fontWeight: "900", color: COLORS.text },
  itemQty: { fontSize: 12, fontWeight: "900", color: COLORS.sub },
  variantRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  variantPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(17,24,39,0.06)", marginRight: 6, marginTop: 6 },
  variantText: { fontSize: 11, color: COLORS.sub, fontWeight: "800" },
  itemImagePlaceholder: { width: 58, height: 58, borderRadius: 14, backgroundColor: "rgba(17,24,39,0.06)", alignItems: "center", justifyContent: "center" },
  itemImagePlaceholderText: { fontSize: 10, color: COLORS.sub, fontWeight: "800" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  actionCard: { backgroundColor: COLORS.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: COLORS.border, elevation: 8, marginBottom: 12 },
  actionTitle: { fontSize: 15, fontWeight: "900", color: COLORS.text },
  etaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  etaBtn: { backgroundColor: "rgba(17,24,39,0.06)", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14 },
  etaText: { fontSize: 12, fontWeight: "900", color: COLORS.text },
  slideBox: { marginTop: 10 },
  slideTrack: { height: 54, borderRadius: 18, backgroundColor: "rgba(17,24,39,0.08)", borderWidth: 1, borderColor: "rgba(17,24,39,0.12)", justifyContent: "center", overflow: "hidden" },
  slideGlow: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  slideHintRow: { position: "absolute", right: 18, flexDirection: "row", alignItems: "center" },
  slideText: { textAlign: "center", fontSize: 13, fontWeight: "900", color: "rgba(17,24,39,0.70)" },
  slideThumb: { position: "absolute", top: 6, bottom: 6, borderRadius: 16, justifyContent: "center" },
  slideThumbInner: { flex: 1, borderRadius: 16, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", elevation: 10, borderWidth: 1, borderColor: "rgba(17,24,39,0.08)" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  modalCard: { width: "100%", backgroundColor: COLORS.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 },
  modalTitle: { fontSize: 16, fontWeight: "900", color: COLORS.text },
  modalClose: { width: 36, height: 36, borderRadius: 14, backgroundColor: "rgba(17,24,39,0.06)", alignItems: "center", justifyContent: "center" },
  reasonRow: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: "rgba(17,24,39,0.02)", flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  reasonText: { fontSize: 13, fontWeight: "900", color: COLORS.text, flex: 1, marginRight: 10 },
  previewOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center" },
  previewImage: { width: "90%", height: "70%" },
  toastHost: { position: "absolute", top: 12, left: 16, right: 16, alignItems: "center", zIndex: 9999 },
  toastCard: { width: "100%", borderRadius: 18, paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: "rgba(17,24,39,0.10)", backgroundColor: "rgba(255,255,255,0.96)", flexDirection: "row", alignItems: "center", elevation: 12 },
  toastTitle: { fontSize: 13, fontWeight: "900" },
  toastSub: { marginTop: 2, fontSize: 12, fontWeight: "800", color: COLORS.sub },
  fastBanner: {
    marginTop: 10,
    backgroundColor: "#EF4444",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fastBannerText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
  },
});
