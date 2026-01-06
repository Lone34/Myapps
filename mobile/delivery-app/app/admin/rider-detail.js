// app/admin/rider-detail.js
import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import client from "../../src/api/client";
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import DateTimePicker from "@react-native-community/datetimepicker";

function filterByPeriod(items, period, dateGetter) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let startDate = null;

  if (period === "today") {
    startDate = startOfToday;
  } else if (period === "week") {
    // Start 7 days ago, normalized to local midnight
    const temp = new Date(now);
    temp.setDate(temp.getDate() - 7);
    startDate = new Date(temp.getFullYear(), temp.getMonth(), temp.getDate());
  } else if (period === "month") {
    // Start 30 days ago, normalized to local midnight
    const temp = new Date(now);
    temp.setDate(temp.getDate() - 30);
    startDate = new Date(temp.getFullYear(), temp.getMonth(), temp.getDate());
  } else {
    // "all"
    return items;
  }

  // Normalize both sides to local date only (ignore time zone differences)
  return items.filter((item) => {
    const raw = dateGetter(item);
    if (!raw) return false;
    const d = new Date(raw);
    const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return itemDate >= startDate;
  });
}


export default function AdminRiderDetailScreen() {
  const router = useRouter();
  const { riderId, riderName } = useLocalSearchParams();

  const [activeTab, setActiveTab] = useState("orders"); // "orders" | "cod"
  const [loading, setLoading] = useState(true);

  const [orders, setOrders] = useState([]);
  const [codData, setCodData] = useState(null);
  const [settlements, setSettlements] = useState([]);

  const [orderPeriod, setOrderPeriod] = useState("today"); // today|week|month|all
  const [orderSearch, setOrderSearch] = useState("");
  const [fromDate, setFromDate] = useState(null);      // Date | null
  const [toDate, setToDate] = useState(null);          // Date | null
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [savingSettlement, setSavingSettlement] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderModalVisible, setOrderModalVisible] = useState(false);

  const idInt = useMemo(() => parseInt(riderId, 10), [riderId]);

  const fetchAll = async () => {
    if (!idInt) return;
    setLoading(true);
    try {
      const [ordersRes, codRes, settRes] = await Promise.all([
        client.get(`/api/delivery/admin/riders/${idInt}/orders/?limit=200`),
        client.get(
          `/api/delivery/admin/riders/${idInt}/cod-history/?status=all&limit=300`
        ),
        client.get(`/api/delivery/admin/riders/${idInt}/settlements/?limit=100`),
      ]);

      setOrders(ordersRes.data.orders || []);
      setCodData(codRes.data || null);
      setSettlements(settRes.data.settlements || []);
    } catch (err) {
      console.error("Error loading rider detail", err?.response?.data || err);
      Alert.alert("Error", "Failed to load rider detail");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [idInt]);

  const codSummary = codData?.summary || {};
  const codRecords = codData?.records || [];
  const unsettledRecords = codRecords.filter((r) => r.status === "unsettled");

  // use the same date for filters everywhere
  const getOrderDate = (o) =>
    o.assignment_created_at ||
    o.delivered_at ||
    o.deliveredAt ||
    o.created_at ||
    o.createdAt;
  
  const formatDate = (d) => {
    if (!d) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  
  const filteredOrders = useMemo(() => {
    // 1) filter by period (today/week/month/all)
    const byPeriod = filterByPeriod(orders, orderPeriod, getOrderDate);
  
    // 2) optional custom date range (calendar)
    const byRange = byPeriod.filter((o) => {
      const raw = getOrderDate(o);
      if (!raw) return false;
  
      const d = new Date(raw);
      const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  
      if (fromDate) {
        const fromDay = new Date(
          fromDate.getFullYear(),
          fromDate.getMonth(),
          fromDate.getDate()
        );
        if (itemDay < fromDay) return false;
      }
  
      if (toDate) {
        const toDay = new Date(
          toDate.getFullYear(),
          toDate.getMonth(),
          toDate.getDate()
        );
        if (itemDay > toDay) return false;
      }
  
      return true;
    });
  
    // 3) search by order number
    const term = orderSearch.trim().toLowerCase();
    if (!term) return byRange;
  
    return byRange.filter((o) => {
      const idStr = String(
        o.order_number ?? o.order_id ?? o.id ?? ""
      ).toLowerCase();
      return idStr.includes(term);
    });
  }, [orders, orderPeriod, fromDate, toDate, orderSearch]);
  
  

  const openOrderDetails = (order) => {
    setSelectedOrder(order);
    setOrderModalVisible(true);
  };

  const closeOrderDetails = () => {
    setOrderModalVisible(false);
    setSelectedOrder(null);
  };

  const exportRiderPDF = async () => {
    if (!orders.length && !codRecords.length) {
      Alert.alert("No data", "There is no data to export for this rider yet.");
      return;
    }

    const riderTitle =
      riderName || codData?.rider?.name || `Rider #${riderId || ""}`;

    const filteredForPdf = filteredOrders.length ? filteredOrders : orders;

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; margin-bottom: 10px; }
            h2 { margin-top: 20px; margin-bottom: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border: 1px solid #ccc; font-size: 11px; padding: 4px; }
            th { background: #f4f4f4; }
          </style>
        </head>
        <body>
          <h1>KashmirCart Rider Ledger</h1>
          <p><b>Rider:</b> ${riderTitle}</p>
          <p><b>Filter:</b> ${orderPeriod.toUpperCase()}</p>

          <h2>COD Summary</h2>
          <p><b>Total COD:</b> ₹${codSummary.total_cod_amount || "0.00"}</p>
          <p><b>Unsettled COD:</b> ₹${
            codSummary.total_unsettled_amount || "0.00"
          }</p>
          <p><b>Settled COD:</b> ₹${
            codSummary.total_settled_amount || "0.00"
          }</p>

          <h2>Orders</h2>
          <table>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Village</th>
              <th>Total</th>
              <th>Pay</th>
              <th>COD</th>
              <th>Status</th>
            </tr>
            ${filteredForPdf
              .map((o) => {
                const orderId = o.order_id ?? o.id ?? "";
                const created =
                  o.created_at || o.createdAt || o.delivered_at || o.deliveredAt;
                const customer =
                  o.customer_name || o.shipping_name || o.shipping_city || "";
                const village =
                  o.shipping_city || o.shipping_village || o.shipping_state || "";
                const total =
                  o.total ||
                  o.total_price ||
                  o.order_total ||
                  o.grand_total ||
                  0;
                const pay = o.payment_method || "";
                const codInfo = o.cod
                  ? `${o.cod.cod_status || ""} ₹${o.cod.cod_amount || ""}`
                  : "";
                const status = o.order_status || o.delivery_status || "";

                return `
                  <tr>
                    <td>${orderId}</td>
                    <td>${created ? String(created).slice(0, 16) : ""}</td>
                    <td>${customer}</td>
                    <td>${village}</td>
                    <td>₹${total}</td>
                    <td>${pay}</td>
                    <td>${codInfo}</td>
                    <td>${status}</td>
                  </tr>
                `;
              })
              .join("")}
          </table>
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    const newUri = `${FileSystem.documentDirectory}Rider_${riderId}_${orderPeriod}.pdf`;
    await FileSystem.moveAsync({ from: uri, to: newUri });
    await Sharing.shareAsync(newUri);
  };

  if (loading && !codData && !orders.length) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading rider details…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const headerTitle =
    riderName || codData?.rider?.name || `Rider #${riderId || ""}`;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <Text style={styles.headerSub}>
            Unsettled COD: ₹{codSummary.total_unsettled_amount || "0.00"}
          </Text>
        </View>
        <TouchableOpacity style={styles.pdfBtn} onPress={exportRiderPDF}>
          <Ionicons name="download-outline" size={18} color="#fff" />
          <Text style={styles.pdfText}>PDF</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
            <View style={styles.tabsRow}>
              <TouchableOpacity
                style={[
                  styles.tabBtn,
                  activeTab === "orders" && styles.tabBtnActive,
                ]}
                onPress={() => setActiveTab("orders")}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === "orders" && styles.tabTextActive,
                  ]}
                >
                  Orders
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === "cod" && styles.tabBtnActive]}
                onPress={() => setActiveTab("cod")}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === "cod" && styles.tabTextActive,
                  ]}
                >
                  COD & Settlements
                </Text>
              </TouchableOpacity>
            </View>
      
            {activeTab === "orders" ? (
              <>
                {/* Orders period filter */}
                <View style={styles.filterBar}>
                  {["today", "week", "month", "all"].map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.filterChip,
                        orderPeriod === p && styles.filterChipActive,
                      ]}
                      onPress={() => setOrderPeriod(p)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          orderPeriod === p && styles.filterChipTextActive,
                        ]}
                      >
                        {p === "today"
                          ? "Today"
                          : p === "week"
                          ? "This Week"
                          : p === "month"
                          ? "This Month"
                          : "All"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {/* ✅ Search orders by number */}
                    <View style={styles.orderSearchRow}>
                      <Ionicons
                        name="search-outline"
                        size={16}
                        color="#6B7280"
                        style={{ marginRight: 6 }}
                      />
                      <TextInput
                        style={styles.orderSearchInput}
                        placeholder="Search by order number"
                        placeholderTextColor="#9CA3AF"
                        value={orderSearch}
                        onChangeText={setOrderSearch}
                        keyboardType="numeric"
                        returnKeyType="search"
                      />
                    </View>
                    {/* Custom date range filter (calendar) */}
                    <View style={styles.dateRangeRow}>
                      <TouchableOpacity
                        style={styles.dateChip}
                        onPress={() => setShowFromPicker(true)}
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={16}
                          color="#111827"
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.dateChipText}>
                          {fromDate ? `From: ${formatDate(fromDate)}` : "From date"}
                        </Text>
                      </TouchableOpacity>
                    
                      <TouchableOpacity
                        style={styles.dateChip}
                        onPress={() => setShowToPicker(true)}
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={16}
                          color="#111827"
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.dateChipText}>
                          {toDate ? `To: ${formatDate(toDate)}` : "To date"}
                        </Text>
                      </TouchableOpacity>
                    
                      {(fromDate || toDate) && (
                        <TouchableOpacity
                          style={styles.clearDateChip}
                          onPress={() => {
                            setFromDate(null);
                            setToDate(null);
                          }}
                        >
                          <Ionicons name="close-circle" size={18} color="#DC2626" />
                        </TouchableOpacity>
                      )}
                    </View>
                    
                    {/* Date pickers (shown when tapping chips) */}
                    {showFromPicker && (
                      <DateTimePicker
                        mode="date"
                        display={Platform.OS === "ios" ? "inline" : "default"}
                        value={fromDate || new Date()}
                        onChange={(event, selectedDate) => {
                          setShowFromPicker(false);
                          if (selectedDate) {
                            setFromDate(selectedDate);
                          }
                        }}
                      />
                    )}
                    
                    {showToPicker && (
                      <DateTimePicker
                        mode="date"
                        display={Platform.OS === "ios" ? "inline" : "default"}
                        value={toDate || new Date()}
                        onChange={(event, selectedDate) => {
                          setShowToPicker(false);
                          if (selectedDate) {
                            setToDate(selectedDate);
                          }
                        }}
                      />
                    )}
                <ScrollView style={styles.scroll}>
                  {filteredOrders.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyText}>
                        No orders for this period.
                      </Text>
                    </View>
                  ) : (
                    filteredOrders.map((o) => {
                      const orderId = o.order_id ?? o.id ?? "";
                      const total =
                        o.total ||
                        o.total_price ||
                        o.order_total ||
                        o.grand_total ||
                        0;
                      const payment = o.payment_method || "";
                      const customer =
                        o.customer_name || o.shipping_name || o.shipping_city || "";
                      const village =
                        o.shipping_city || o.shipping_village || o.shipping_state || "";
                      const delivered =
                        o.assignment_created_at ||
                        o.delivered_at ||
                        o.deliveredAt ||
                        o.created_at ||
                        o.createdAt;
                      const status = o.order_status || o.delivery_status || "";
      
                      const codInfo = o.cod
                        ? `COD ₹${o.cod.cod_amount || ""} (${o.cod.cod_status || ""})`
                        : "";
      
                      return (
                        <TouchableOpacity
                          key={orderId}
                          onPress={() => openOrderDetails(o)}
                          style={styles.orderCard}
                        >
                          <View style={styles.orderRow}>
                            <Text style={styles.orderTitle}>
                              Order #{orderId} • {payment}
                            </Text>
                            <Text style={styles.orderAmount}>₹{total}</Text>
                          </View>
                          <Text style={styles.orderMeta}>
                            {customer} • {village}
                          </Text>
                          <Text style={styles.orderMetaSmall}>
                            Status: {status} •{" "}
                            {delivered ? String(delivered).slice(0, 19) : ""}
                          </Text>
                          {codInfo ? (
                            <Text style={styles.orderMetaSmall}>{codInfo}</Text>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </>
            ) : (
        // COD TAB
        <ScrollView style={styles.scroll}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>COD Summary</Text>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, styles.cardGreen]}>
                <Text style={styles.summaryLabel}>Total COD</Text>
                <Text style={styles.summaryValue}>
                  ₹{codSummary.total_cod_amount || "0.00"}
                </Text>
              </View>
              <View style={[styles.summaryCard, styles.cardOrange]}>
                <Text style={styles.summaryLabel}>Unsettled</Text>
                <Text style={styles.summaryValue}>
                  ₹{codSummary.total_unsettled_amount || "0.00"}
                </Text>
              </View>
              <View style={[styles.summaryCard, styles.cardGray]}>
                <Text style={styles.summaryLabel}>Settled</Text>
                <Text style={styles.summaryValue}>
                  ₹{codSummary.total_settled_amount || "0.00"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Unsettled COD ({unsettledRecords.length})
            </Text>
            {unsettledRecords.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No unsettled COD records.</Text>
              </View>
            ) : (
              unsettledRecords.map((rec) => {
                const order = rec.order || {};
                const delivered =
                  order.delivered_at ||
                  order.deliveredAt ||
                  order.created_at ||
                  order.createdAt;
                return (
                  <View key={rec.id} style={styles.codCard}>
                    <View style={styles.orderRow}>
                      <Text style={styles.codAmount}>₹{rec.amount}</Text>
                      <Text style={styles.codId}>COD #{rec.id}</Text>
                    </View>
                    <Text style={styles.orderMeta}>
                      Order #{order.id || ""} • {order.payment_method || ""}
                    </Text>
                    <Text style={styles.orderMetaSmall}>
                      {order.shipping_city || ""} •{" "}
                      {order.shipping_phone || ""}
                    </Text>
                    {delivered ? (
                      <Text style={styles.orderMetaSmall}>
                        Delivered: {String(delivered).slice(0, 19)}
                      </Text>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Settlement History ({settlements.length})
            </Text>
            {settlements.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No settlements yet.</Text>
              </View>
            ) : (
              settlements.map((s) => (
                <View key={s.id} style={styles.settleCard}>
                  <View style={styles.orderRow}>
                    <Text style={styles.settleAmount}>₹{s.total_amount}</Text>
                    <Text style={styles.settleMeta}>
                      {s.method.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.orderMetaSmall}>
                    {String(s.created_at).slice(0, 19)}
                  </Text>
                  {s.reference ? (
                    <Text style={styles.orderMetaSmall}>
                      Ref: {s.reference}
                    </Text>
                  ) : null}
                  {s.note ? (
                    <Text style={styles.orderMetaSmall}>{s.note}</Text>
                  ) : null}
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* ORDER DETAIL MODAL */}
      <Modal
        visible={orderModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeOrderDetails}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {selectedOrder ? (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    Order #{selectedOrder.order_id ?? selectedOrder.id ?? ""}
                  </Text>
                  <TouchableOpacity onPress={closeOrderDetails}>
                    <Ionicons name="close" size={20} color="#111" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 400 }}>
                  {/* Basic */}
                  <Text style={styles.modalLabel}>Payment</Text>
                  <Text style={styles.modalValue}>
                    {selectedOrder.payment_method || "—"}
                  </Text>

                  <Text style={styles.modalLabel}>Total</Text>
                  <Text style={styles.modalValue}>
                    ₹
                    {selectedOrder.total ||
                      selectedOrder.total_price ||
                      selectedOrder.order_total ||
                      selectedOrder.grand_total ||
                      0}
                  </Text>

                  {/* COD */}
                  {selectedOrder.cod ? (
                    <>
                      <Text style={styles.modalLabel}>COD Info</Text>
                      <Text style={styles.modalValue}>
                        Status: {selectedOrder.cod.cod_status || "—"}
                      </Text>
                      <Text style={styles.modalValue}>
                        Amount: ₹{selectedOrder.cod.cod_amount || "0.00"}
                      </Text>
                    </>
                  ) : null}

                  {/* Shop / pickup */}
                  {selectedOrder.shop ? (
                    <>
                      <Text style={styles.modalLabel}>Pickup (Shop)</Text>
                      <Text style={styles.modalValue}>
                        {selectedOrder.shop.name || ""}
                      </Text>
                      <Text style={styles.modalValue}>
                        {selectedOrder.shop.address ||
                          selectedOrder.shop.village ||
                          ""}
                      </Text>
                      {selectedOrder.shop.phone ? (
                        <Text style={styles.modalValue}>
                          Phone: {selectedOrder.shop.phone}
                        </Text>
                      ) : null}
                    </>
                  ) : null}

                  {/* Customer / delivery */}
                  <Text style={styles.modalLabel}>Customer</Text>
                  <Text style={styles.modalValue}>
                    {selectedOrder.customer_name ||
                      selectedOrder.shipping_name ||
                      ""}
                  </Text>

                  <Text style={styles.modalLabel}>Delivery Address</Text>
                  <Text style={styles.modalValue}>
                    {selectedOrder.shipping_address ||
                      selectedOrder.shipping_address1 ||
                      ""}
                  </Text>
                  <Text style={styles.modalValue}>
                    {[
                      selectedOrder.shipping_city,
                      selectedOrder.shipping_state,
                      selectedOrder.shipping_pincode,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </Text>
                  {selectedOrder.shipping_phone ? (
                    <Text style={styles.modalValue}>
                      Phone: {selectedOrder.shipping_phone}
                    </Text>
                  ) : null}

                  {/* Status / times */}
                  <Text style={styles.modalLabel}>Status</Text>
                  <Text style={styles.modalValue}>
                    {selectedOrder.order_status ||
                      selectedOrder.delivery_status ||
                      "—"}
                  </Text>

                  <Text style={styles.modalLabel}>Created At</Text>
                  <Text style={styles.modalValue}>
                    {String(
                      selectedOrder.created_at ||
                        selectedOrder.createdAt ||
                        ""
                    ).slice(0, 19)}
                  </Text>

                  <Text style={styles.modalLabel}>Delivered At</Text>
                  <Text style={styles.modalValue}>
                    {String(
                      selectedOrder.delivered_at ||
                        selectedOrder.deliveredAt ||
                        ""
                    ).slice(0, 19)}
                  </Text>
                </ScrollView>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F9" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 8, fontSize: 14, color: "#555" },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#111827",
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },

  pdfBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4B5563",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pdfText: { color: "#fff", marginLeft: 4, fontSize: 12 },

  tabsRow: {
    flexDirection: "row",
    backgroundColor: "#E5E7EB",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
  },
  tabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#111827",
  },
  tabText: { fontSize: 13, color: "#6B7280" },
  tabTextActive: { color: "#111827", fontWeight: "600" },

  filterBar: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F3F4F6",
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#D1D5DB",
    marginRight: 6,
  },
  filterChipActive: { backgroundColor: "#111827" },
  filterChipText: { fontSize: 11, color: "#111827" },
  filterChipTextActive: { color: "#fff" },

  scroll: { flex: 1 },

  emptyBox: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { fontSize: 13, color: "#6B7280" },

  orderCard: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  orderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  orderAmount: { fontSize: 14, fontWeight: "700", color: "#111827" },
  orderMeta: { marginTop: 4, fontSize: 12, color: "#4B5563" },
  orderMetaSmall: { marginTop: 2, fontSize: 11, color: "#6B7280" },

  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
    color: "#111827",
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryCard: {
    flex: 1,
    marginRight: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  summaryLabel: { fontSize: 12, color: "#4B5563" },
  summaryValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  cardGreen: { backgroundColor: "#DCFCE7" },
  cardOrange: { backgroundColor: "#FEF3C7" },
  cardGray: { backgroundColor: "#E5E7EB" },

  codCard: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  codAmount: { fontSize: 16, fontWeight: "700", color: "#111827" },
  codId: { fontSize: 11, color: "#6B7280" },

  settleCard: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  settleAmount: { fontSize: 15, fontWeight: "700", color: "#111827" },
  settleMeta: { fontSize: 11, color: "#374151" },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    width: "90%",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  modalLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#4B5563",
  },
  modalValue: { fontSize: 12, color: "#111827" },
  dateRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    flex: 1,
  },
  dateChipText: {
    fontSize: 12,
    color: "#111827",
  },
  clearDateChip: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
});
