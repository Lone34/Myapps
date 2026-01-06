// app/_layout.tsx
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { Provider } from 'react-redux';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AnimatedSplash from '../src/components/AnimatedSplash';
import NotificationNavigationHandler from '../src/notifications/NotificationNavigationHandler';

// ✅ IMPORTANT: use the mobile store (AsyncStorage), NOT src/redux/store.js
import store, { rehydrateUser } from '../src/redux/mobileStore';
import BottomNavMobile from '../src/components/BottomNavMobile';
import { NavBarProvider } from '../src/context/NavBarContext';
import { LocationProvider } from '../src/context/LocationContext'; 

// ✅ NEW: Import Voice Search Provider
import { VoiceSearchProvider } from '../src/context/VoiceSearchContext';

// 🔔 Update banner
import UpdateAppBanner from '../src/components/UpdateAppBanner';

// 🌐 GLOBAL network error hook
import client, { setNetworkErrorHandler } from '../src/api/client';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  // Global network error state
  const [networkError, setNetworkError] = useState(false);
  const [networkErrorMessage, setNetworkErrorMessage] = useState('');
  const [retrying, setRetrying] = useState(false);

  // 🔁 When this changes, we remount the navigation tree (soft app reset)
  const [navResetKey, setNavResetKey] = useState(0);

  useEffect(() => {
    (async () => {
      // Restore user from AsyncStorage and set axios auth header
      await rehydrateUser();
      setReady(true);
    })();

    // Register global network error handler once
    setNetworkErrorHandler((hasError, err) => {
      if (hasError) {
        setNetworkError(true);
        const msg =
          (err && (err.message || err.code)) ||
          'Network error. Please check your connection.';
        setNetworkErrorMessage(msg);
      } else {
        setNetworkError(false);
        setNetworkErrorMessage('');
      }
    });
  }, []);

  const handleGlobalRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      // Simple "ping" to see if backend is reachable again.
      // Using /home/ because your API client will turn it into /api/home/ automatically.
      await client.get(`/home/?_t=${Date.now()}`);

      // ✅ Network/server is back:
      // - Hide banner
      // - Soft-reset navigation so all screens remount & re-fetch
      setNetworkError(false);
      setNetworkErrorMessage('');
      setNavResetKey((k) => k + 1);
    } catch (e) {
      // Still offline or server down – keep banner visible
      // (User can tap Retry again)
    } finally {
      setRetrying(false);
    }
  };

  if (!ready) {
    return <AnimatedSplash />;
  }

  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <NavBarProvider>
          {/* ✅ WRAPPED WITH LOCATION PROVIDER */}
          <LocationProvider>
            {/* ✅ WRAPPED WITH VOICE SEARCH PROVIDER (So it works everywhere) */}
            <VoiceSearchProvider>

              {/* 🔔 Handle notification taps globally */}
              <NotificationNavigationHandler />

              {/* 👇 Everything inside this View gets remounted when navResetKey changes */}
              <View style={{ flex: 1 }} key={navResetKey}>
                {/* 🌐 GLOBAL NETWORK ERROR BANNER */}
                {networkError && (
                  <View style={styles.networkBanner}>
                    <Text style={styles.networkBannerText} numberOfLines={2}>
                      {networkErrorMessage ||
                        'Network error. Please check your connection.'}
                    </Text>
                    <TouchableOpacity
                      style={styles.networkBannerButton}
                      onPress={handleGlobalRetry}
                      disabled={retrying}
                    >
                      <Text style={styles.networkBannerButtonText}>
                        {retrying ? 'Retrying…' : 'Retry'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* 🔔 update banner at top of the app (below network banner) */}
                <UpdateAppBanner />

                <Stack screenOptions={{ headerShown: false }}>
                  {/* Auth / entry */}
                  <Stack.Screen name="index" />
                  <Stack.Screen name="login" />

                  {/* Main tab layout */}
                  <Stack.Screen name="(tabs)" />

                  {/* Product / category */}
                  <Stack.Screen name="product/[id]" />
                  <Stack.Screen name="category/[slug]" />

                  {/* Orders & Returns */}
                  <Stack.Screen name="orders/index" />
                  <Stack.Screen name="orders/[id]" />
                  <Stack.Screen name="orders/[id]/return" />
                  <Stack.Screen name="my-returns" />

                  {/* Profile / Addresses / Support */}
                  <Stack.Screen name="profile" />
                  <Stack.Screen name="addresses" />
                  <Stack.Screen name="support" />
                </Stack>

                {/* Global bottom navbar on every page */}
                <BottomNavMobile />
              </View>
            </VoiceSearchProvider>
          </LocationProvider>
        </NavBarProvider>
      </Provider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  networkBanner: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 0 : 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'android' ? 32 : 20,
    paddingBottom: 8,
    paddingHorizontal: 12,
    backgroundColor: '#D32F2F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2000,
  },
  networkBannerText: {
    color: '#fff',
    fontSize: 12,
    flex: 1,
    marginRight: 8,
  },
  networkBannerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
  },
  networkBannerButtonText: {
    color: '#D32F2F',
    fontWeight: '700',
    fontSize: 12,
  },
});
