import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import client from "../src/api/client";

const AUTH_BG = require("../assets/images/login-bg.png");

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim()) return alert("Enter your registered email");
    try {
      setLoading(true);
      const { data } = await client.post("users/password-reset/request/", {
        email: email.trim().toLowerCase(),
      });
      alert(data?.detail || "If this email is registered, a reset link has been sent.");
      router.back();
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail ||
        "Could not send reset email. Please try again.";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground source={AUTH_BG} style={styles.bgImage} resizeMode="cover">
      <View style={styles.overlay} />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.card}>
          <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color="#E5E7EB" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>
            Enter your registered email. We’ll send you a password reset link.
          </Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#D1D5DB"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <TouchableOpacity style={styles.primaryBtn} onPress={submit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Send Reset Link</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bgImage: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  container: { flex: 1, justifyContent: "center", padding: 16 },
  card: {
    backgroundColor: "rgba(17,24,39,0.55)",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  backRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 8 },
  backText: { color: "#E5E7EB", fontSize: 14 },
  title: { color: "#F9FAFB", fontSize: 20, fontWeight: "800", marginBottom: 6 },
  subtitle: { color: "#D1D5DB", fontSize: 13, marginBottom: 14 },
  label: { color: "#E5E7EB", marginBottom: 6, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#F9FAFB",
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: "#22C55E",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "800" },
});
