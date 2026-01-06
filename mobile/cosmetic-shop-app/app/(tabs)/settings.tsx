// app/(tabs)/settings.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { logout } from '../../src/redux/actions/userActions';
import AppHeader from '../../src/components/AppHeader';
import { useNavBar } from '../../src/context/NavBarContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../../src/api/client';
import AnimatedBackground from '../../src/components/AnimatedBackground';

// Helper for rendering rows with icons
const RowLink = ({
  label,
  href,
  icon,
  danger = false,
}: {
  label: string;
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  danger?: boolean;
}) => (
  <Link href={href} asChild>
    <TouchableOpacity style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={[styles.iconBox, danger && styles.iconBoxDanger]}>
          <Ionicons
            name={icon}
            size={20}
            color={danger ? '#FF8A80' : '#F9FAFB'}
          />
        </View>
        <Text style={[styles.rowText, danger && styles.dangerText]}>
          {label}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
    </TouchableOpacity>
  </Link>
);

export default function SettingsScreen() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { handleScroll: handleNavScroll } = useNavBar();
  const userLogin = useSelector((state: any) => state.userLogin);
  const userInfo = userLogin?.userInfo;

  const handleLogout = async () => {
    try {
      try {
        await AsyncStorage.removeItem('userInfo');
        await AsyncStorage.removeItem('kashmircart_user');
      } catch (e) {
        console.log('Error clearing user storage', e);
      }

      try {
        if (client?.defaults?.headers?.common?.Authorization) {
          delete client.defaults.headers.common.Authorization;
        }
      } catch (e) {
        console.log('Error clearing auth header', e);
      }

      await dispatch<any>(logout());
      router.replace('/login');
    } catch (e) {
      console.log('Logout error', e);
      Alert.alert('Error', 'Could not logout. Please try again.');
    }
  };

  // ---------------- NOT LOGGED IN VIEW ----------------
  if (!userInfo) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AnimatedBackground />
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />

        {/* Global header (logo + search) */}
        <AppHeader placeholder="Search settings, orders, help..." />

        {/* Page title */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.loginCard}>
            <Text style={styles.loginTitle}>You&apos;re not logged in</Text>
            <Text style={styles.loginSubtitle}>
              Login or sign up to manage your profile, addresses, orders,
              wishlist and more.
            </Text>

            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => router.push('/login')}
            >
              <Ionicons
                name="log-in-outline"
                size={18}
                color="#FFFFFF"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.loginButtonText}>Login / Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------- LOGGED IN VIEW ----------------
  return (
    <SafeAreaView style={styles.safeArea}>
      <AnimatedBackground />
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Global header */}
      <AppHeader placeholder="Search settings, orders, help..." />

      {/* Page title */}
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        onScroll={handleNavScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* Menu Section */}
        <View style={styles.section}>
          <RowLink label="My Profile" href="/profile" icon="person-outline" />
          <View style={styles.divider} />

          <RowLink label="Addresses" href="/addresses" icon="location-outline" />
          <View style={styles.divider} />

          <RowLink label="My Orders" href="/orders" icon="receipt-outline" />
          <View style={styles.divider} />

          <RowLink label="Wishlist" href="/wishlist" icon="heart-outline" />
          <View style={styles.divider} />

          <RowLink label="Support" href="/support" icon="headset-outline" />
        </View>

        {/* Logout Section */}
        <View style={[styles.section, { marginTop: 20 }]}>
          <TouchableOpacity style={styles.row} onPress={handleLogout}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, styles.iconBoxDanger]}>
                <Ionicons
                  name="log-out-outline"
                  size={20}
                  color="#FF8A80"
                />
              </View>
              <Text style={[styles.rowText, styles.dangerText]}>Logout</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#001A33',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  section: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15,23,42,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
  },
  iconBoxDanger: {
    backgroundColor: 'rgba(127,29,29,0.9)',
    borderColor: 'rgba(248,113,113,0.6)',
  },
  rowText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#F9FAFB',
  },
  dangerText: {
    color: '#FFB4B4',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(148,163,184,0.4)',
    marginLeft: 66,
  },
  // --- Not-logged-in styles ---
  loginCard: {
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 3,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.6)',
  },
  loginTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E5E7EB',
    marginBottom: 6,
  },
  loginSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#2563EB',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
