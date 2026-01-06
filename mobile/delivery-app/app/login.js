// app/login.js
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import client from "../src/api/client.js";

export default function LoginScreen() {
  const router = useRouter();

  // ✅ If already logged in, skip login screen
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("deliveryToken");
        if (token) {
          router.replace("/home");
        }
      } catch (e) {}
    })();
  }, []);


  const [email, setEmail] = useState("");       // login email
  const [password, setPassword] = useState(""); // login password
  const [showPass, setShowPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => {
    const e = String(email || "").trim();
    const p = String(password || "");
    return e.length > 2 && p.length >= 3 && !loading;
  }, [email, password, loading]);

  const handleLogin = async () => {
    if (!canSubmit) return;

    setError("");
    setLoading(true);

    try {
      // ✅ Rider-only login (admin portal removed)
      const url = "/api/delivery/login/";
      const payload = { email, password };

      const res = await client.post(url, payload);
      const data = res.data;

      const token =
        data?.access ||
        data?.token ||
        data?.accessToken ||
        data?.access_token ||
        null;

      if (!token) {
        const msg = data?.detail || "Login failed. Please check email and password.";
        setError(msg);
        setLoading(false);
        return;
      }

      await AsyncStorage.setItem("deliveryToken", String(token));
      await AsyncStorage.setItem("deliveryRefresh", data?.refresh ? String(data.refresh) : "");

      // Keep your old deliveryInfo structure
      await AsyncStorage.setItem(
        "deliveryInfo",
        JSON.stringify({
          rider_id: data?.rider_id,
          name: data?.name,
          village: data?.village,
        })
      );

      setLoading(false);
      router.replace("/home");
    } catch (err) {
      console.log("Login error:", err?.response?.data || err?.message);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Login failed";
      setError(String(msg));
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.logoBubble}>
            <Ionicons name="bicycle" size={22} color="#0B0B0B" />
          </View>
          <Text style={styles.brand}>KupwaraCart</Text>
          <Text style={styles.subtitle}>Delivery Login</Text>
        </View>

        <View style={styles.card}>
          {!!error && <Text style={styles.error}>{error}</Text>}

          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color="#6B7280" />
            <TextInput
              placeholder="Enter your email"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Password</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="#6B7280" />
            <TextInput
              placeholder="Enter your password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              secureTextEntry={!showPass}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity
              onPress={() => setShowPass((s) => !s)}
              style={styles.eyeBtn}
              accessibilityLabel={showPass ? "Hide password" : "Show password"}
            >
              <Ionicons
                name={showPass ? "eye-off-outline" : "eye-outline"}
                size={18}
                color="#6B7280"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, !canSubmit && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={!canSubmit}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginText}>Login</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.hint}>
            Use the delivery partner account credentials provided by admin.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0B0B0B",
  },
  container: {
    flexGrow: 1,
    padding: 18,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 14,
  },
  logoBubble: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "#D4AF37",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  brand: {
    color: "#F9FAFB",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  subtitle: {
    color: "#D1D5DB",
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
  },
  card: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    padding: 16,
    borderRadius: 18,
  },
  label: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  inputWrap: {
    height: 50,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  input: {
    flex: 1,
    height: 50,
    paddingHorizontal: 10,
    color: "#F9FAFB",
    fontSize: 15,
    fontWeight: "600",
  },
  eyeBtn: {
    padding: 6,
    marginLeft: 4,
  },
  loginBtn: {
    backgroundColor: "#D4AF37",
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 16,
  },
  loginBtnDisabled: {
    opacity: 0.5,
  },
  loginText: {
    color: "#0B0B0B",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  error: {
    color: "#FCA5A5",
    marginBottom: 10,
    textAlign: "center",
    fontWeight: "700",
  },
  hint: {
    color: "#9CA3AF",
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 16,
  },
});
