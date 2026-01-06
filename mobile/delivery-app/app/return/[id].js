// app/return/[id].js  (NEW FILE)
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  Image,
  Modal,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import client from "../../src/api/client";

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

const fmtDate = (val) => {
  if (!val) return "";
  try {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return String(val).replace("T", " ").slice(0, 16);
    return d.toLocaleString();
  } catch (e) {
    return String(val).replace("T", " ").slice(0, 16);
  }
};

const normalizeReturn = (r) => {
  const shopRaw = r.shop || null;
  const shop = shopRaw
    ? { name: shopRaw.name || "", address: shopRaw.address || "", phone: shopRaw.phone || "" }
    : { name: r.shop_name || "", address: r.shop_address || "", phone: r.shop_phone || "" };

  const customer = r.customer || {
    name: r.customer_name || "Customer",
    phone: r.customer_phone || "",
    address: r.shipping_address || "",
  };

  return {
    id: r.id ?? r.return_id,
    status: r.status || "",
    reason: r.reason || "",
    created_at: r.created_at || r.requested_at || "",
    order_id: r.order_id || r.order || "",
    customer,
    shop,
    _raw: r,
  };
};

const STATUS_META = {
  pending: { bg: "rgba(59,130,246,0.12)", fg: COLORS.blue, icon: "flash-outline" },
  accepted: { bg: "rgba(245,158,11,0.14)", fg: COLORS.amber, icon: "hand-left-outline" },
  pickup_scheduled: { bg: "rgba(245,158,11,0.14)", fg: COLORS.amber, icon: "time-outline" },
  picked_up: { bg: "rgba(139,92,246,0.14)", fg: COLORS.purple, icon: "cube-outline" },
  delivered_back: { bg: "rgba(34,197,94,0.14)", fg: COLORS.green, icon: "checkmark-circle-outline" },
  delivered_to_shop: { bg: "rgba(34,197,94,0.14)", fg: COLORS.green, icon: "checkmark-circle-outline" },
  completed: { bg: "rgba(34,197,94,0.14)", fg: COLORS.green, icon: "checkmark-circle-outline" },
  refunded: { bg: "rgba(34,197,94,0.14)", fg: COLORS.green, icon: "cash-outline" },
};

function StatusPill({ status }) {
  const s = String(status || "").toLowerCase();
  const meta = STATUS_META[s] || { bg: "rgba(17,24,39,0.06)", fg: COLORS.text, icon: "information-circle-outline" };
  return (
    <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
      <Ionicons name={meta.icon} size={14} color={meta.fg} />
      <Text style={[styles.statusPillText, { color: meta.fg }]}>{(s || "unknown").toUpperCase()}</Text>
    </View>
  );
}

// --- Small helpers for showing order items nicely ---
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
      push(label, variation.value);
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

export default function ReturnDetails() {
  const { id } = useLocalSearchParams(); // return id
  const router = useRouter();

  const [ret, setRet] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);

  // Image preview (optional, same style you use in orders)
  const [previewImage, setPreviewImage] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  const openPhone = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  // ✅ same backend functions you already use
  const updateStatus = async (rid, status) => client.post(`/api/returns/${rid}/status/`, { status });
  const acceptReturn = async (rid) => client.post(`/api/returns/${rid}/accept/`);

  const load = async () => {
    try {
      setLoading(true);

      // 1) Load returns list and find this return
      const res = await client.get("/api/returns/pending/");
      const arr = Array.isArray(res.data) ? res.data : [];
      const foundRaw = arr.find((x) => String(x.id ?? x.return_id) === String(id));

      if (!foundRaw) {
        setRet(null);
        setOrder(null);
        return;
      }

      const found = normalizeReturn(foundRaw);
      setRet(found);

      // 2) Also load the order details (so you get items + totals)
      const orderId = found.order_id ? String(found.order_id) : null;
      if (!orderId) {
        setOrder(null);
        return;
      }

      let o = null;

      // Try same pattern as your order detail screen (active → delivered → failed)
      try {
        const a = await client.get("/api/delivery/active-orders/");
        o = (a.data || []).find((x) => String(x.id) === orderId);
      } catch (e) {}

      if (!o) {
        try {
          const d = await client.get("/api/delivery/delivered-orders/");
          o = (d.data || []).find((x) => String(x.id) === orderId);
        } catch (e) {}
      }

      if (!o) {
        try {
          const f = await client.get("/api/delivery/failed-orders/");
          o = (f.data || []).find((x) => String(x.id) === orderId);
        } catch (e) {}
      }

      setOrder(o || null);
    } catch (e) {
      setRet(null);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [id]);

  const statusLower = String(ret?.status || "").toLowerCase();
  const isPending = statusLower === "pending";
  const isAccepted = statusLower === "accepted" || statusLower === "pickup_scheduled";
  const isPicked = statusLower === "picked_up" || statusLower === "picked" || statusLower === "pickup";
  const isDone =
    statusLower === "delivered_to_shop" ||
    statusLower === "delivered_back" ||
    statusLower === "completed" ||
    statusLower === "delivered" ||
    statusLower === "refunded";

  const markPickedUp = async () => {
    if (!ret) return;
    Alert.alert("Mark picked up?", "Confirm that you have picked up this return.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes",
        onPress: async () => {
          setBtnLoading(true);
          try {
            // safe accept first (if already accepted, backend may reject; ignore)
            try {
              await acceptReturn(ret.id);
            } catch (_) {}
            await updateStatus(ret.id, "picked_up");
            await load();
          } catch (e) {
            Alert.alert("Error", e?.response?.data?.detail || "Could not update");
          } finally {
            setBtnLoading(false);
          }
        },
      },
    ]);
  };

  const markReturnedToShop = async () => {
    if (!ret) return;
    Alert.alert("Mark returned?", "Confirm that you returned the item to the shop.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes",
        onPress: async () => {
          setBtnLoading(true);
          try {
            // Your backend accepts delivered_back via /status/ :contentReference[oaicite:4]{index=4}
            try {
              await updateStatus(ret.id, "delivered_back");
            } catch (e1) {
              // fallback (in case backend uses delivered_to_shop in future)
              await updateStatus(ret.id, "delivered_to_shop");
            }
            Alert.alert("Done", "Return marked as completed.", [
              { text: "OK", onPress: () => router.replace("/returns") },
            ]);
          } catch (e) {
            Alert.alert("Error", e?.response?.data?.detail || "Could not update");
          } finally {
            setBtnLoading(false);
          }
        },
      },
    ]);
  };

  const doAccept = async () => {
    if (!ret) return;
    setBtnLoading(true);
    try {
      await acceptReturn(ret.id);
      Alert.alert("Accepted", "Return accepted successfully");
      await load();
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.detail || "Could not accept");
    } finally {
      setBtnLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.text} />
        <Text style={{ marginTop: 10, color: COLORS.sub, fontWeight: "700" }}>Loading return…</Text>
      </View>
    );
  }

  if (!ret) {
    return (
      <View style={styles.center}>
        <Text style={{ color: COLORS.sub, fontWeight: "900" }}>Return not found or already completed.</Text>
        <TouchableOpacity style={[styles.btn, styles.btnGhost, { marginTop: 12 }]} onPress={() => router.replace("/returns")}>
          <Text style={[styles.btnText, { color: COLORS.text }]}>BACK TO RETURNS</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const shop = ret.shop || {};
  const customer = ret.customer || {};
  const when = fmtDate(ret.created_at);

  const items = order?.items || [];
  const totalPrice = Number(order?.total_price || 0);
  const shippingCharge = Number(order?.shipping_price || 0);
  const itemsTotal = Math.max(0, totalPrice - shippingCharge);

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.pageHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.85}>
            <Ionicons name="chevron-back" size={20} color={COLORS.text} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Return #{ret.id}</Text>
            <Text style={styles.pageSub} numberOfLines={1}>
              {ret.order_id ? `Order #${ret.order_id}` : "Order"} {when ? `• ${when}` : ""}
            </Text>
          </View>

          <StatusPill status={statusLower} />
        </View>

        {/* Return info */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.text} />
            <Text style={styles.cardTitle}>Return Details</Text>
          </View>

          <Text style={styles.k}>Status</Text>
          <Text style={styles.v}>{(statusLower || "n/a").toUpperCase()}</Text>

          {ret.reason ? (
            <>
              <Text style={[styles.k, { marginTop: 10 }]}>Reason</Text>
              <Text style={styles.v}>{ret.reason}</Text>
            </>
          ) : null}

          {ret.order_id ? (
            <>
              <Text style={[styles.k, { marginTop: 10 }]}>Order ID</Text>
              <Text style={styles.v}>#{ret.order_id}</Text>
            </>
          ) : null}

          {when ? (
            <>
              <Text style={[styles.k, { marginTop: 10 }]}>Requested At</Text>
              <Text style={styles.v}>{when}</Text>
            </>
          ) : null}
        </View>

        {/* Customer */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="person-outline" size={16} color={COLORS.text} />
            <Text style={styles.cardTitle}>Customer</Text>
          </View>

          <Text style={styles.k}>Name</Text>
          <Text style={styles.v}>{customer.name || "N/A"}</Text>

          <Text style={[styles.k, { marginTop: 10 }]}>Address</Text>
          <Text style={styles.v}>{customer.address || "N/A"}</Text>

          <Text style={[styles.k, { marginTop: 10 }]}>Phone</Text>
          <TouchableOpacity onPress={() => openPhone(customer.phone)} activeOpacity={0.85}>
            <Text style={[styles.v, { color: customer.phone ? COLORS.blue : COLORS.muted }]}>
              {customer.phone || "N/A"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Shop */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="storefront-outline" size={16} color={COLORS.text} />
            <Text style={styles.cardTitle}>Pickup Shop</Text>
          </View>

          <Text style={styles.k}>Name</Text>
          <Text style={styles.v}>{shop.name || "N/A"}</Text>

          <Text style={[styles.k, { marginTop: 10 }]}>Address</Text>
          <Text style={styles.v}>{shop.address || "N/A"}</Text>

          <Text style={[styles.k, { marginTop: 10 }]}>Phone</Text>
          <TouchableOpacity onPress={() => openPhone(shop.phone)} activeOpacity={0.85}>
            <Text style={[styles.v, { color: shop.phone ? COLORS.blue : COLORS.muted }]}>
              {shop.phone || "N/A"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Order Items + Totals (from delivery order endpoints) */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="cart-outline" size={16} color={COLORS.text} />
            <Text style={styles.cardTitle}>Order Items</Text>
          </View>

          {!items.length ? (
            <Text style={styles.v}>Items not available (order not found in delivery lists).</Text>
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
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => {
                        setPreviewImage(img);
                        setPreviewVisible(true);
                      }}
                    >
                      <Image source={{ uri: img }} style={styles.itemImage} />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.itemImagePlaceholder}>
                      <Text style={styles.itemImagePlaceholderText}>No image</Text>
                    </View>
                  )}

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.itemTitle} numberOfLines={2}>
                      {name}
                    </Text>

                    {chips.length > 0 ? (
                      <View style={styles.variantRow}>
                        {chips.map((txt, i) => (
                          <View key={i} style={styles.variantPill}>
                            <Text style={styles.variantText}>{txt}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    <View style={styles.itemMetaRow}>
                      <Text style={styles.itemPrice}>₹{Number.isFinite(price) ? price.toFixed(0) : "0"}</Text>
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
            <Text style={styles.k}>Shipping</Text>
            <Text style={styles.v}>₹{shippingCharge.toFixed(0)}</Text>
          </View>

          <View style={[styles.summaryRow, { marginTop: 8 }]}>
            <Text style={[styles.k, { fontWeight: "900", color: COLORS.text }]}>Grand total</Text>
            <Text style={[styles.bigValue, { fontSize: 18 }]}>₹{totalPrice.toFixed(0)}</Text>
          </View>

          {!!order?.payment_method ? (
            <View style={[styles.summaryRow, { marginTop: 10 }]}>
              <Text style={styles.k}>Payment</Text>
              <Text style={styles.v}>{order.payment_method}</Text>
            </View>
          ) : null}
        </View>

        {/* Actions */}
        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>Actions</Text>
          <Text style={styles.actionSub}>Process this return step-by-step.</Text>

          {btnLoading ? <ActivityIndicator style={{ marginTop: 12 }} color={COLORS.text} /> : null}

          {!btnLoading && !isDone && isPending ? (
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={doAccept} activeOpacity={0.88}>
              <Text style={styles.btnText}>ACCEPT RETURN</Text>
            </TouchableOpacity>
          ) : null}

          {!btnLoading && !isDone && (isPending || isAccepted) && !isPicked ? (
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={markPickedUp} activeOpacity={0.88}>
              <Text style={styles.btnText}>MARK PICKED UP</Text>
            </TouchableOpacity>
          ) : null}

          {!btnLoading && !isDone && isPicked ? (
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={markReturnedToShop} activeOpacity={0.88}>
              <Text style={styles.btnText}>MARK RETURNED TO SHOP</Text>
            </TouchableOpacity>
          ) : null}

          {isDone ? (
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.v, { color: COLORS.green }]}>This return is completed.</Text>
              <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => router.replace("/returns")} activeOpacity={0.88}>
                <Text style={[styles.btnText, { color: COLORS.text }]}>BACK TO RETURNS</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Image Preview */}
      <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
        <Pressable style={styles.previewOverlay} onPress={() => setPreviewVisible(false)}>
          {previewImage ? <Image source={{ uri: previewImage }} style={styles.previewImage} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
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

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: "900", color: COLORS.text },

  k: { fontSize: 12, fontWeight: "800", color: COLORS.sub },
  v: { fontSize: 13, fontWeight: "800", color: COLORS.text, marginTop: 4, lineHeight: 18 },
  bigValue: { fontSize: 16, fontWeight: "900", color: COLORS.text },

  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusPillText: { fontSize: 11, fontWeight: "900" },

  // Items
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  itemImage: { width: 58, height: 58, borderRadius: 14, backgroundColor: "rgba(17,24,39,0.06)" },
  itemTitle: { fontSize: 14, fontWeight: "900", color: COLORS.text },
  itemMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  itemPrice: { fontSize: 14, fontWeight: "900", color: COLORS.text },
  itemQty: { fontSize: 12, fontWeight: "900", color: COLORS.sub },

  variantRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  variantPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(17,24,39,0.06)", marginRight: 6, marginTop: 6 },
  variantText: { fontSize: 11, color: COLORS.sub, fontWeight: "800" },

  itemImagePlaceholder: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: "rgba(17,24,39,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  itemImagePlaceholderText: { fontSize: 10, color: COLORS.sub, fontWeight: "800" },

  // Summary
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },

  // Actions
  actionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8,
    marginBottom: 12,
  },
  actionTitle: { fontSize: 15, fontWeight: "900", color: COLORS.text },
  actionSub: { marginTop: 4, fontSize: 12, fontWeight: "800", color: COLORS.sub, lineHeight: 18 },

  btn: { paddingVertical: 12, borderRadius: 14, marginTop: 10, alignItems: "center" },
  btnPrimary: { backgroundColor: COLORS.text },
  btnGhost: { backgroundColor: "rgba(17,24,39,0.06)" },
  btnText: { color: "#fff", textAlign: "center", fontSize: 13, fontWeight: "900" },

  // Preview
  previewOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center" },
  previewImage: { width: "90%", height: "70%" },
});
