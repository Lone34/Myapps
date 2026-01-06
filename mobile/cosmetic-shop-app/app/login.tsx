// Login / Register screen for KashmirCart with snowfall background + transparent card.

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import client from "../src/api/client";
import { registerDevicePushToken } from "../src/notifications/registerForPush";
import AnimatedBackground from "../src/components/AnimatedBackground";

import {
  USER_LOGIN_REQUEST,
  USER_LOGIN_SUCCESS,
  USER_LOGIN_FAIL,
  USER_REGISTER_REQUEST,
  USER_REGISTER_SUCCESS,
  USER_REGISTER_FAIL,
} from "../src/redux/constants/userConstants";

// Strong password validator
const isStrongPassword = (p: string) =>
  p.length >= 8 &&
  /[A-Z]/.test(p) &&
  /[a-z]/.test(p) &&
  /[0-9]/.test(p) &&
  /[^A-Za-z0-9]/.test(p);

// Helper: extract readable error from axios error
const extractErrorMessage = (error: any, fallback: string) => {
  const data = error?.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data)) {
    const first = data[0];
    if (typeof first === "string") return first;
    if (typeof first?.message === "string") return first.message;
  }
  if (typeof data.message === "string") return data.message;
  if (typeof data.error === "string") return data.error;
  return fallback;
};

// Normalize Indian phone number to +91XXXXXXXXXX
const normalizePhoneNumber = (raw: string): string => {
  if (!raw) return "";
  let t = raw.replace(/\s+/g, "");
  if (t.startsWith("+")) return t;
  t = t.replace(/^0+/, "");
  return "+91" + t;
};

export default function LoginScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { userInfo } = useSelector((state: any) => state.userLogin || {});

  // ======== Auth Logic ========
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginTab, setLoginTab] = useState<"email" | "phone">("email");

  // Login (email)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  // Phone OTP Login (TEMP DISABLED, but kept for future)
  const [phone, setPhone] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);

  // Register (step 1 – details)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [dob, setDob] = useState("");
  const [dobDate, setDobDate] = useState<Date | null>(null);
  const [dobPickerVisible, setDobPickerVisible] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Register (step 2 – OTP + password)
  const [regOtpStep, setRegOtpStep] = useState(false);
  const [regEmailOtp, setRegEmailOtp] = useState("");
  const [regPhoneOtp, setRegPhoneOtp] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regCPassword, setRegCPassword] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regPasswordVisible, setRegPasswordVisible] = useState(false);
  const [regCPasswordVisible, setRegCPasswordVisible] = useState(false);

  // Register OTP resend timer (in seconds)
  const [regOtpTimer, setRegOtpTimer] = useState(0);

  const saveUser = async (raw: any) => {
    const base = raw.user || raw.user_info || raw;
    const token = raw.token || raw.access || raw.access_token || base.token || null;
    const finalUser = { ...base, token };

    dispatch({ type: USER_LOGIN_SUCCESS, payload: finalUser });
    dispatch({ type: USER_REGISTER_SUCCESS, payload: finalUser });

    if (finalUser.token) {
      client.defaults.headers.common.Authorization = `Bearer ${finalUser.token}`;
    } else {
      delete client.defaults.headers.common.Authorization;
    }

    try {
      const json = JSON.stringify(finalUser);
      await AsyncStorage.setItem("userInfo", json);
      await AsyncStorage.setItem("kashmircart_user", json);
    } catch (err) {
      console.log("Failed to save user to storage", err);
    }

    try {
      await registerDevicePushToken(finalUser.token);
    } catch (err) {
      console.log("Failed to register device push token", err);
    }

    router.replace("/(tabs)");
  };

  useEffect(() => {
    (async () => {
      try {
        if (userInfo?.token) return;

        let raw = await AsyncStorage.getItem("userInfo");
        if (!raw) raw = await AsyncStorage.getItem("kashmircart_user");
        if (!raw) return;

        const stored = JSON.parse(raw);
        if (!stored?.token) return;

        dispatch({ type: USER_LOGIN_SUCCESS, payload: stored });
        dispatch({ type: USER_REGISTER_SUCCESS, payload: stored });

        client.defaults.headers.common.Authorization = `Bearer ${stored.token}`;
      } catch (err) {
        console.log("Failed to restore user from storage", err);
      }
    })();
  }, []);

  useEffect(() => {
    if (userInfo?.token) router.replace("/(tabs)");
  }, [userInfo]);

  useEffect(() => {
    let interval: any = null;
    if (regOtpStep && regOtpTimer > 0) {
      interval = setInterval(() => {
        setRegOtpTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [regOtpStep, regOtpTimer]);

  const openTerms = () => router.push("/legal/terms");
  const openPrivacy = () => router.push("/legal/terms");

  const loginEmail = async () => {
    if (!email || !password) return alert("Enter email and password");
    try {
      setEmailLoading(true);
      dispatch({ type: USER_LOGIN_REQUEST });
      const { data } = await client.post("users/login/", {
        username: email,
        password,
      });
      await saveUser(data);
    } catch (error: any) {
      console.log("loginEmail error", error);
      const msg = extractErrorMessage(error, "Invalid login");
      alert(msg);
      dispatch({ type: USER_LOGIN_FAIL });
    } finally {
      setEmailLoading(false);
    }
  };

  const sendOtp = async () => {
    if (!phone) return alert("Enter phone number");
    try {
      setPhoneLoading(true);
      const fullPhone = normalizePhoneNumber(phone);
      await client.post("users/login/send-phone-otp/", {
        phone_number: fullPhone,
      });
      setOtpStep(true);
    } catch (error: any) {
      console.log("sendOtp error", error);
      const msg = extractErrorMessage(error, "Failed to send OTP. Please try again.");
      alert(msg);
    } finally {
      setPhoneLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!phoneOtp) return alert("Enter OTP");
    try {
      setPhoneLoading(true);
      const { data } = await client.post("users/login/verify-phone-otp/", {
        otp: phoneOtp,
      });
      await saveUser(data);
    } catch (error: any) {
      console.log("verifyOtp error", error);
      const msg = extractErrorMessage(error, "Invalid OTP");
      alert(msg);
    } finally {
      setPhoneLoading(false);
    }
  };

  const sendRegOtp = async () => {
    if (!firstName || !lastName || !regEmail || !regPhone || !dob)
      return alert("All fields are required");

    if (!acceptedTerms) {
      alert("You must agree to the Terms & Conditions to create an account.");
      return;
    }
    const emailNorm = (regEmail || "").trim().toLowerCase();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm);
    if (!emailOk) return alert("Please enter a valid email address.");

    try {
      setRegLoading(true);
      dispatch({ type: USER_REGISTER_REQUEST });

      const fullRegPhone = normalizePhoneNumber(regPhone);

      await client.post("users/register/send-otp/", {
        first_name: firstName,
        last_name: lastName,
        email: emailNorm,
        phone_number: fullRegPhone,
        dob,
        password: "Temp123@",
      });

      setRegOtpStep(true);
      setRegOtpTimer(60);
    } catch (error: any) {
      console.log("sendRegOtp error", error);
      const msg = extractErrorMessage(
        error,
        "Failed to send OTP. Please check your details."
      );
      alert(msg);
      dispatch({ type: USER_REGISTER_FAIL });
    } finally {
      setRegLoading(false);
    }
  };

  const resendRegOtp = async () => {
    if (regOtpTimer > 0) return;

    if (!firstName || !lastName || !regEmail || !regPhone || !dob) {
      alert("Please check your details and try again.");
      return;
    }

    try {
      setRegLoading(true);
      dispatch({ type: USER_REGISTER_REQUEST });

      const fullRegPhone = normalizePhoneNumber(regPhone);

      await client.post("users/register/send-otp/", {
        first_name: firstName,
        last_name: lastName,
        email: regEmail,
        phone_number: fullRegPhone,
        dob,
        password: "Temp123@",
      });

      setRegOtpTimer(60);
      alert("A new OTP has been sent to your email.");
    } catch (error: any) {
      console.log("resendRegOtp error", error);
      const msg = extractErrorMessage(error, "Failed to resend OTP. Please try again.");
      alert(msg);
      dispatch({ type: USER_REGISTER_FAIL });
    } finally {
      setRegLoading(false);
    }
  };

  const verifyRegOtp = async () => {
    if (!regEmailOtp) return alert("Enter the email OTP");
    if (regPassword !== regCPassword) return alert("Passwords mismatch");
    if (!isStrongPassword(regPassword)) {
      return alert(
        "Weak password. Use at least 8 characters with uppercase, lowercase, number and symbol."
      );
    }

    try {
      setRegLoading(true);
      const { data } = await client.post("users/register/verify-otp/", {
        email_otp: regEmailOtp,
        // phone_otp TEMP DISABLED: regPhoneOtp,
        password: regPassword,
      });
      await saveUser(data);
    } catch (error: any) {
      console.log("verifyRegOtp error", error);
      const msg = extractErrorMessage(error, "Invalid OTP");
      alert(msg);
    } finally {
      setRegLoading(false);
    }
  };

  const onDobChange = (_: any, selected?: Date) => {
    if (Platform.OS !== "ios") setDobPickerVisible(false);
    if (selected) {
      setDobDate(selected);
      const y = selected.getFullYear();
      const m = String(selected.getMonth() + 1).padStart(2, "0");
      const d = String(selected.getDate()).padStart(2, "0");
      setDob(`${y}-${m}-${d}`);
    }
  };

  return (
    <View style={styles.root}>
      <AnimatedBackground />
      <View style={styles.overlay} />

      <KeyboardAvoidingView
        style={styles.kbContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand header */}
          <View style={styles.brandHeader}>
            <View>
              <Text style={styles.brandTitle}>KupwaraCart</Text>
              <Text style={styles.brandSubtitle}>
                Delivery In Minutes
              </Text>
            </View>
            <Ionicons name="bag-handle-outline" size={32} color="#22C55E" />
          </View>

          {/* Card (glass) */}
          <View style={styles.card}>
            {/* Mode switch row */}
            <View style={styles.modeSwitchRow}>
              <TouchableOpacity
                style={[styles.modeButton, mode === "login" && styles.modeButtonActive]}
                onPress={() => {
                  setMode("login");
                  setRegOtpStep(false);
                }}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    mode === "login" && styles.modeButtonTextActive,
                  ]}
                >
                  Login
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modeButton, mode === "register" && styles.modeButtonActive]}
                onPress={() => setMode("register")}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    mode === "register" && styles.modeButtonTextActive,
                  ]}
                >
                  Register
                </Text>
              </TouchableOpacity>
            </View>

            {/* LOGIN MODE */}
            {mode === "login" ? (
              <>
                {/* email / phone tabs */}
                <View style={styles.tabRow}>
                  <TouchableOpacity
                    style={[styles.tabBtn, loginTab === "email" && styles.tabActive]}
                    onPress={() => setLoginTab("email")}
                  >
                    <Text style={[styles.tabText, loginTab === "email" && styles.tabTextActive]}>
                      Email Login
                    </Text>
                  </TouchableOpacity>

                  {/* PHONE-OTP TEMP DISABLED TAB (kept for future)
                  <TouchableOpacity
                    style={[styles.tabBtn, loginTab === "phone" && styles.tabActive]}
                    onPress={() => setLoginTab("phone")}
                  >
                    <Text style={[styles.tabText, loginTab === "phone" && styles.tabTextActive]}>
                      Phone OTP
                    </Text>
                  </TouchableOpacity>
                  */}
                </View>

                {loginTab === "email" ? (
                  <>
                    <Text style={styles.fieldLabel}>Email</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="you@example.com"
                      placeholderTextColor="#D1D5DB"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                    />

                    <Text style={styles.fieldLabel}>Password</Text>
                    <View style={styles.inputRow}>
                      <TextInput
                        style={[styles.input, styles.inputFlex]}
                        placeholder="Password"
                        placeholderTextColor="#D1D5DB"
                        secureTextEntry={!passwordVisible}
                        value={password}
                        onChangeText={setPassword}
                      />
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => setPasswordVisible((prev) => !prev)}
                      >
                        <Ionicons
                          name={passwordVisible ? "eye-off-outline" : "eye-outline"}
                          size={20}
                          color="#9CA3AF"
                        />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      onPress={() => router.push("/forgot-password")}
                      style={styles.forgotBtn}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.forgotText}>Forgot password?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.primaryBtn} onPress={loginEmail}>
                      {emailLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Sign In</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {!otpStep ? (
                      <>
                        <Text style={styles.fieldLabel}>Phone Number</Text>
                        <View style={styles.phoneRow}>
                          <View style={styles.phoneCodeBox}>
                            <Text style={styles.phoneCodeText}>+91</Text>
                          </View>
                          <TextInput
                            style={[styles.input, styles.phoneInput]}
                            placeholder="Enter phone number"
                            placeholderTextColor="#D1D5DB"
                            keyboardType="phone-pad"
                            value={phone}
                            onChangeText={setPhone}
                          />
                        </View>
                        <TouchableOpacity style={styles.primaryBtn} onPress={sendOtp}>
                          {phoneLoading ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <Text style={styles.primaryBtnText}>Send OTP</Text>
                          )}
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <Text style={styles.fieldLabel}>Enter OTP</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Enter 6-digit OTP"
                          placeholderTextColor="#D1D5DB"
                          keyboardType="number-pad"
                          value={phoneOtp}
                          onChangeText={setPhoneOtp}
                        />
                        <TouchableOpacity style={styles.primaryBtn} onPress={verifyOtp}>
                          {phoneLoading ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <Text style={styles.primaryBtnText}>Verify & Login</Text>
                          )}
                        </TouchableOpacity>
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                {!regOtpStep ? (
                  <>
                    <Text style={styles.fieldLabel}>First Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="First Name"
                      placeholderTextColor="#D1D5DB"
                      value={firstName}
                      onChangeText={setFirstName}
                    />

                    <Text style={styles.fieldLabel}>Last Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Last Name"
                      placeholderTextColor="#D1D5DB"
                      value={lastName}
                      onChangeText={setLastName}
                    />

                    <Text style={styles.fieldLabel}>Email Address</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="you@example.com"
                      placeholderTextColor="#D1D5DB"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={regEmail}
                      onChangeText={setRegEmail}
                    />

                    <Text style={styles.fieldLabel}>Phone Number (Use Your Own Phone Number)</Text>
                    <View style={styles.phoneRow}>
                      <View style={styles.phoneCodeBox}>
                        <Text style={styles.phoneCodeText}>+91</Text>
                      </View>
                      <TextInput
                        style={[styles.input, styles.phoneInput]}
                        placeholder="10-digit phone"
                        placeholderTextColor="#D1D5DB"
                        keyboardType="phone-pad"
                        value={regPhone}
                        onChangeText={setRegPhone}
                      />
                    </View>

                    <Text style={styles.fieldLabel}>Date of Birth</Text>
                    <TouchableOpacity
                      style={[styles.input, styles.dobButton]}
                      onPress={() => setDobPickerVisible(true)}
                    >
                      <Text style={[styles.dobText, !dob && { color: "#9CA3AF" }]}>
                        {dob || "YYYY-MM-DD"}
                      </Text>
                      <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
                    </TouchableOpacity>

                    {dobPickerVisible && (
                      <DateTimePicker
                        value={dobDate || new Date(2000, 0, 1)}
                        mode="date"
                        display="spinner"
                        maximumDate={new Date()}
                        onChange={onDobChange}
                      />
                    )}

                    <View style={{ marginTop: 8, marginBottom: 4 }}>
                      <TouchableOpacity
                        style={styles.termsRow}
                        activeOpacity={0.8}
                        onPress={() => setAcceptedTerms((prev) => !prev)}
                      >
                        <Ionicons
                          name={acceptedTerms ? "checkbox-outline" : "square-outline"}
                          size={20}
                          color={acceptedTerms ? "#22C55E" : "#9CA3AF"}
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.termsText}>
                          I agree to the{" "}
                          <Text style={styles.termsLink} onPress={openTerms}>
                            Terms & Conditions
                          </Text>{" "}
                          and{" "}
                          <Text style={styles.termsLink} onPress={openPrivacy}>
                            Privacy Policy
                          </Text>
                          .
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.primaryBtn} onPress={sendRegOtp}>
                      {regLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Send OTP</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View style={styles.regOtpHeaderRow}>
                      <TouchableOpacity
                        style={styles.regOtpBackBtn}
                        onPress={() => {
                          setRegOtpStep(false);
                          setRegEmailOtp("");
                          setRegPassword("");
                          setRegCPassword("");
                          setRegOtpTimer(0);
                        }}
                      >
                        <Ionicons name="arrow-back" size={18} color="#F9FAFB" />
                        <Text style={styles.regOtpBackText}>Edit details</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          setMode("login");
                          setRegOtpStep(false);
                        }}
                      >
                        <Text style={styles.regOtpSigninText}>
                          Already have an account? Sign in
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.fieldLabel}>Email OTP sent to {regEmail}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter OTP from email"
                      placeholderTextColor="#D1D5DB"
                      value={regEmailOtp}
                      onChangeText={setRegEmailOtp}
                      keyboardType="number-pad"
                    />

                    <View style={styles.resendRow}>
                      {regOtpTimer > 0 ? (
                        <Text style={styles.resendText}>
                          Didn&apos;t receive the OTP? Resend in {regOtpTimer}s
                        </Text>
                      ) : (
                        <TouchableOpacity onPress={resendRegOtp} disabled={regLoading}>
                          <Text style={styles.resendLink}>Resend OTP</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <Text style={styles.fieldLabel}>Password</Text>
                    <View style={styles.inputRow}>
                      <TextInput
                        style={[styles.input, styles.inputFlex]}
                        placeholder="Create a strong password"
                        placeholderTextColor="#D1D5DB"
                        secureTextEntry={!regPasswordVisible}
                        value={regPassword}
                        onChangeText={setRegPassword}
                      />
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => setRegPasswordVisible((prev) => !prev)}
                      >
                        <Ionicons
                          name={regPasswordVisible ? "eye-off-outline" : "eye-outline"}
                          size={20}
                          color="#9CA3AF"
                        />
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.fieldLabel}>Confirm Password</Text>
                    <View style={styles.inputRow}>
                      <TextInput
                        style={[styles.input, styles.inputFlex]}
                        placeholder="Confirm password"
                        placeholderTextColor="#D1D5DB"
                        secureTextEntry={!regCPasswordVisible}
                        value={regCPassword}
                        onChangeText={setRegCPassword}
                      />
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => setRegCPasswordVisible((prev) => !prev)}
                      >
                        <Ionicons
                          name={regCPasswordVisible ? "eye-off-outline" : "eye-outline"}
                          size={20}
                          color="#9CA3AF"
                        />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.primaryBtn} onPress={verifyRegOtp}>
                      {regLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Verify & Register</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </View>

          <Text style={styles.footerText}>©️ All rights reservedd</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#001A33",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.55)",
  },
  kbContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
  },

  // ✅ FIXED: flexDirection must be "row"
  brandHeader: {
    flexDirection: "center",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },
  brandTitle: {
    fontSize: 40,
    fontWeight: "700",
    color: "#F9FAFB",
  },
  brandSubtitle: {
    fontSize: 17,
    color: "#CBD5E1",
    marginTop: 2,
  },

  // ✅ Glass card
  card: {
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  modeSwitchRow: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 999,
    marginBottom: 16,
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
  },
  modeButtonActive: {
    backgroundColor: "#22C55E",
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#E5E7EB",
  },
  modeButtonTextActive: {
    color: "#0B1120",
  },

  tabRow: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 999,
    padding: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: "#16A34A",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#9CA3AF",
  },
  tabTextActive: {
    color: "#F9FAFB",
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E5E7EB",
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    color: "#F9FAFB",
    marginBottom: 8,
    fontSize: 14,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  inputFlex: {
    flex: 1,
  },
  eyeButton: {
    marginLeft: 8,
    padding: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  primaryBtn: {
    backgroundColor: "#22C55E",
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 10,
  },
  primaryBtnText: {
    color: "#0B1120",
    fontSize: 15,
    fontWeight: "800",
  },

  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  phoneCodeBox: {
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderTopLeftRadius: 999,
    borderBottomLeftRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    marginRight: 0,
  },
  phoneCodeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F9FAFB",
  },
  phoneInput: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    marginBottom: 8,
  },

  dobButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dobText: {
    fontSize: 14,
    color: "#E5E7EB",
  },

  footerText: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 12,
    color: "#CBD5E1",
  },

  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    color: "#CBD5E1",
  },
  termsLink: {
    color: "#22C55E",
    textDecorationLine: "underline",
    fontWeight: "700",
  },

  regOtpHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 8,
  },
  regOtpBackBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  regOtpBackText: {
    marginLeft: 4,
    fontSize: 12,
    color: "#E5E7EB",
    fontWeight: "700",
  },
  regOtpSigninText: {
    fontSize: 12,
    color: "#22C55E",
    textDecorationLine: "underline",
    fontWeight: "700",
  },

  resendRow: { marginTop: 4, marginBottom: 8 },
  resendText: { fontSize: 12, color: "#CBD5E1" },
  resendLink: {
    fontSize: 12,
    color: "#22C55E",
    textDecorationLine: "underline",
    fontWeight: "700",
  },

  forgotBtn: {
    alignSelf: "flex-end",
    marginTop: 2,
    marginBottom: 6,
  },
  forgotText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#93C5FD",
  },
});
