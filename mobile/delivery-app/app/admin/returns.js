// app/admin/returns.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import client from "../../src/api/client";

export default function AdminReturnsScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [returnsList, setReturnsList] = useState([]);
  const [tab, setTab] = useState("pending"); // "pending" | "completed"

  // modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMode, setRefundMode] = useState("UPI");
  const [refundRef, setRefundRef] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [saving, setSaving] = useState(false);
  
  const load = async () => {
    try {
      setLoading(true);
      setError("");
      // admin_list_returns at /api/admin/returns/
      const res = await client.get("/api/admin/returns/");
      setReturnsList(res.data || []);
    } catch (e) {
      console.log("Admin returns load error:", e?.response?.data || e.message);
      setError(
        e?.response?.data?.detail ||
          e?.response?.data ||
          "Could not load return requests."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredReturns = returnsList.filter((rr) => {
    const s = (rr.status || "").toLowerCase();
  
    const closedStatuses = ["completed", "rejected", "refunded"];
  
    if (tab === "pending") {
      // show only open / in-progress returns
      return !closedStatuses.includes(s);
    }
  
    // Completed tab: show refunded + completed + rejected
    return closedStatuses.includes(s);
  });
  

  const openRefundModal = (rr) => {
    setSelectedReturn(rr);
    setRefundAmount(
      rr.refund_amount !== null && rr.refund_amount !== undefined
        ? String(rr.refund_amount)
        : ""
    );
    setRefundMode(rr.refund_mode || "UPI");
    setRefundRef(rr.refund_reference || "");
    setAdminNote(rr.admin_note || "");
    setModalVisible(true);
  };

  const closeRefundModal = () => {
    setModalVisible(false);
    setSelectedReturn(null);
    setRefundAmount("");
    setRefundMode("UPI");
    setRefundRef("");
    setAdminNote("");
  };

  const markRefunded = async () => {
    if (!selectedReturn) return;

    if (!refundAmount) {
      Alert.alert("Missing amount", "Please enter refund amount.");
      return;
    }

    try {
      setSaving(true);
      const id = selectedReturn.id;
      // new admin endpoint (no /delivery/ here)
      const payload = {
        status: "completed",
        refund_amount: refundAmount,
        refund_mode: refundMode,
        refund_reference: refundRef,
        admin_note: adminNote,
      };
      const res = await client.post(
        `/api/admin/returns/${id}/mark-refunded/`,
        payload
      );
      console.log("Mark refunded resp:", res.data);

      await load();
      closeRefundModal();
      Alert.alert("Saved", "Return marked as refunded.");
    } catch (e) {
      console.log("Mark refunded error:", e?.response?.data || e.message);
      Alert.alert(
        "Error",
        e?.response?.data?.detail ||
          e?.response?.data ||
          "Could not update refund status."
      );
    } finally {
      setSaving(false);
    }
  };

  const renderStatusBadge = (status) => {
    const s = (status || "").toLowerCase();
    let bg = "#EEE";
    let txt = "#555";

    if (s === "pending") {
      bg = "#FFF8E1";
      txt = "#F9A825";
    } else if (["accepted", "pickup_scheduled", "picked_up"].includes(s)) {
      bg = "#E3F2FD";
      txt = "#1565C0";
    } else if (s === "delivered_to_shop") {
      bg = "#E8F5E9";
      txt = "#2E7D32";
    } else if (s === "completed") {
      bg = "#E8F5E9";
      txt = "#2E7D32";
    } else if (s === "rejected") {
      bg = "#FFEBEE";
      txt = "#C62828";
    }

    return (
      <View style={[styles.statusBadge, { backgroundColor: bg }]}>
        <Text style={[styles.statusText, { color: txt }]}>
          {String(status || "").replace(/_/g, " ")}
        </Text>
      </View>
    );
  };

  if (loading && !returnsList.length) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 8 }}>Loading returns…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginRight: 8, padding: 4 }}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Delivery Admin</Text>
            <Text style={styles.headerSub}>Returns & refunds</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabChip, tab === "pending" && styles.tabChipActive]}
          onPress={() => setTab("pending")}
        >
          <Text
            style={[
              styles.tabChipText,
              tab === "pending" && styles.tabChipTextActive,
            ]}
          >
            Pending / In progress
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabChip, tab === "completed" && styles.tabChipActive]}
          onPress={() => setTab("completed")}
        >
          <Text
            style={[
              styles.tabChipText,
              tab === "completed" && styles.tabChipTextActive,
            ]}
          >
            Completed / Rejected
          </Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color="#B00020"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      ) : null}

      {/* List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
      >
        {!filteredReturns.length ? (
          <Text style={styles.emptyText}>
            No {tab === "pending" ? "pending" : "completed"} returns.
          </Text>
        ) : (
            filteredReturns.map((rr) => {
              // ✅ Make sure we handle both "order: 40" and "order: { id: 40, ... }"
              const orderId =
                rr.order_id ||
                (typeof rr.order === "number" ? rr.order : rr.order?.id) ||
                "";

              const customerName =
                rr.customer_name ||
                rr.order?.user?.first_name ||
                rr.order?.user?.username ||
                "";

              const phone =
                rr.phone || rr.order?.shipping_phone || rr.order?.phone || "";

              const address =
                rr.order?.shipping_address || rr.shipping_address || "";

              const statusLower = (rr.status || "").toLowerCase();

              // ✅ Closed in UI when completed / rejected / refunded
              const isClosed = ["completed", "rejected", "refunded"].includes(
                statusLower
              );

            return (
              <View key={rr.id} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <View>
                    <Text style={styles.cardTitle}>Order #{orderId}</Text>
                    <Text style={styles.cardSub}>
                      Return #{rr.id}
                      {customerName ? ` • ${customerName}` : ""}
                    </Text>
                  </View>
                  {renderStatusBadge(rr.status)}
                </View>

                {rr.reason ? (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.sectionLabel}>Reason</Text>
                    <Text style={styles.sectionValue}>{rr.reason}</Text>
                  </View>
                ) : null}

                <View style={{ marginTop: 8 }}>
                  <Text style={styles.sectionLabel}>Customer</Text>
                  <Text style={styles.sectionValue}>
                    {customerName || "—"}
                    {phone ? `\n📞 ${phone}` : ""}
                    {address ? `\n📍 ${address}` : ""}
                  </Text>
                </View>

                {/* Money summary */}
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.moneyLine}>
                    Order total: ₹{Number(rr.order_total || 0).toFixed(2)}
                  </Text>
                  <Text style={styles.moneyLineSmall}>
                    Items: ₹{Number(rr.items_total || 0).toFixed(2)} · Shipping: ₹
                    {Number(rr.shipping_price || 0).toFixed(2)}
                  </Text>
                </View>

                <View style={{ marginTop: 8 }}>
                  <Text style={styles.sectionLabel}>Bank / UPI</Text>
                  <Text style={styles.sectionValue}>
                    {rr.bank_account_name
                      ? `Name: ${rr.bank_account_name}\n`
                      : ""}
                    {rr.bank_account_number
                      ? `A/c: ${rr.bank_account_number}\n`
                      : ""}
                    {rr.ifsc ? `IFSC: ${rr.ifsc}\n` : ""}
                    {rr.upi_id ? `UPI: ${rr.upi_id}` : ""}
                    {!rr.bank_account_name &&
                      !rr.bank_account_number &&
                      !rr.ifsc &&
                      !rr.upi_id &&
                      "Not provided"}
                  </Text>
                </View>

                {(rr.refund_amount ||
                  rr.refund_reference ||
                  rr.admin_note ||
                  rr.refund_mode) && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.sectionLabel}>Refund info</Text>
                    <Text style={styles.sectionValue}>
                      {rr.refund_amount
                        ? `Amount: ₹${Number(rr.refund_amount).toFixed(2)}\n`
                        : ""}
                      {rr.refund_mode ? `Mode: ${rr.refund_mode}\n` : ""}
                      {rr.refund_reference
                        ? `Ref: ${rr.refund_reference}\n`
                        : ""}
                      {rr.admin_note ? `Note: ${rr.admin_note}` : ""}
                    </Text>
                  </View>
                )}

                {!isClosed && (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={() => openRefundModal(rr)}
                    >
                      <Text style={styles.primaryBtnText}>
                        Mark Refunded / Update
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeRefundModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Mark as refunded</Text>
            {selectedReturn ? (
              <Text style={styles.modalSub}>
                Return #{selectedReturn.id} • Order #
                {selectedReturn.order_id || selectedReturn.order?.id}
              </Text>
            ) : null}

            <Text style={styles.modalLabel}>Refund amount (₹)</Text>
            <TextInput
              value={refundAmount}
              onChangeText={setRefundAmount}
              keyboardType="decimal-pad"
              style={styles.modalInput}
              placeholder="e.g. 250.00"
            />

            <Text style={styles.modalLabel}>Refund mode</Text>
            <TextInput
              value={refundMode}
              onChangeText={setRefundMode}
              style={styles.modalInput}
              placeholder="UPI / Bank / Cash"
            />

            <Text style={styles.modalLabel}>Reference / txn id</Text>
            <TextInput
              value={refundRef}
              onChangeText={setRefundRef}
              style={styles.modalInput}
              placeholder="UPI ref / bank ref"
            />

            <Text style={styles.modalLabel}>Admin note</Text>
            <TextInput
              value={adminNote}
              onChangeText={setAdminNote}
              style={[styles.modalInput, { height: 70 }]}
              multiline
              placeholder="Any notes about this refund…"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#ECEFF1" }]}
                onPress={closeRefundModal}
                disabled={saving}
              >
                <Text style={[styles.modalBtnText, { color: "#37474F" }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#16A34A" }]}
                onPress={markRefunded}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F9" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#111827",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  headerSub: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },

  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  tabChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
    marginRight: 8,
  },
  tabChipActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  tabChipText: {
    fontSize: 12,
    color: "#4B5563",
    fontWeight: "600",
  },
  tabChipTextActive: {
    color: "#fff",
  },

  errorBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#FEE2E2",
    flexDirection: "row",
    alignItems: "center",
  },
  errorBannerText: { color: "#B00020", fontSize: 12, flex: 1 },

  emptyText: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 30,
  },

  card: {
    backgroundColor: "#fff",
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  cardSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },

  sectionLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    textTransform: "uppercase",
  },
  sectionValue: {
    fontSize: 13,
    color: "#374151",
    marginTop: 2,
  },

  moneyLine: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "600",
  },
  moneyLineSmall: {
    fontSize: 11,
    color: "#4B5563",
    marginTop: 2,
  },

  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  primaryBtn: {
    backgroundColor: "#D4AF37",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  modalSub: { fontSize: 12, color: "#6B7280", marginBottom: 10 },
  modalLabel: { fontSize: 12, color: "#6B7280", marginTop: 8 },
  modalInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
    fontSize: 13,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 14,
  },
  modalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 8,
  },
  modalBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
