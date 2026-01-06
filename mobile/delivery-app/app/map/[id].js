import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from "react-native";
import MapView, { Marker, UrlTile } from "react-native-maps";
import { useLocalSearchParams } from "expo-router";
import client from "../../src/api/client";

export default function MapScreen() {
  const { id } = useLocalSearchParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const toNum = (val) => {
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  };

  const load = async () => {
    try {
      const res = await client.get(
        `/api/delivery/order/${id}/live-location/`
      );
      console.log("LIVE MAP DATA:", res.data);
      setData(res.data);
    } catch (err) {
      console.log("Map load error:", err.response?.data || err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={{ marginTop: 10 }}>Loading map…</Text>
      </View>
    );
  }

  const shopLat = toNum(data.shop?.latitude);
  const shopLon = toNum(data.shop?.longitude);

  const riderLat = toNum(data.delivery_partner?.latitude);
  const riderLon = toNum(data.delivery_partner?.longitude);

  const customerLat = toNum(data.customer_location?.latitude);
  const customerLon = toNum(data.customer_location?.longitude);

  // ✅ Proper center logic (no crashing anymore)
  const centerLat =
    riderLat ??
    customerLat ??
    shopLat ??
    34.0837; // fallback Srinagar
  const centerLon =
    riderLon ??
    customerLon ??
    shopLon ??
    74.7973;

  return (
    <View style={styles.container}>
      <MapView
        style={{ flex: 1 }}
        region={{
          latitude: centerLat,
          longitude: centerLon,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
      >
        {/* Smooth map tiles */}
        <UrlTile
          urlTemplate="https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png"
          maximumZ={19}
        />

        {/* SHOP MARKER */}
        {shopLat && shopLon && (
          <Marker
            coordinate={{
              latitude: shopLat,
              longitude: shopLon,
            }}
            title={`Shop: ${data.shop?.name}`}
            description={data.shop?.address}
            pinColor="orange"
          />
        )}

        {/* RIDER MARKER */}
        {riderLat && riderLon && (
          <Marker
            coordinate={{
              latitude: riderLat,
              longitude: riderLon,
            }}
            title="You (Delivery Partner)"
            pinColor="blue"
          />
        )}

        {/* CUSTOMER MARKER */}
        {customerLat && customerLon && (
          <Marker
            coordinate={{
              latitude: customerLat,
              longitude: customerLon,
            }}
            title="Customer Location"
            description="Drop location"
            pinColor="green"
          />
        )}
      </MapView>

      {/* Bottom Navigation */}
      <View style={styles.bottomBox}>
        {customerLat && customerLon ? (
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() =>
              Linking.openURL(
                `https://www.google.com/maps/dir/?api=1&destination=${customerLat},${customerLon}`
              )
            }
          >
            <Text style={styles.navText}>Navigate to Customer</Text>
          </TouchableOpacity>
        ) : (
          <Text style={{ textAlign: "center", color: "#666" }}>
            Customer location not available yet...
          </Text>
        )}

        {shopLat && shopLon && (
          <TouchableOpacity
            style={[styles.navBtn, { backgroundColor: "#f39c12", marginTop: 10 }]}
            onPress={() =>
              Linking.openURL(
                `https://www.google.com/maps/dir/?api=1&destination=${shopLat},${shopLon}`
              )
            }
          >
            <Text style={styles.navText}>Navigate to Shop</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  bottomBox: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: "#fff",
    padding: 12,
    borderTopWidth: 1,
    borderColor: "#ddd",
  },
  navBtn: {
    backgroundColor: "#1a73e8",
    paddingVertical: 12,
    borderRadius: 10,
  },
  navText: {
    color: "#fff",
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
  },
});
