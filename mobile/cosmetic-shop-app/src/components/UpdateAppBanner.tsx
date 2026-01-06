// src/components/UpdateAppBanner.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';
import { isVersionLess } from '../utils/version';

type VersionInfo = {
  latest_version: string;
  min_supported_version: string;
  play_store_url: string;
};

const DISMISS_KEY = 'kashmircart_update_dismissed_version';

export default function UpdateAppBanner() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mustUpdate, setMustUpdate] = useState(false);
  const [shouldUpdate, setShouldUpdate] = useState(false);
  const [playStoreUrl, setPlayStoreUrl] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string>('0.0.0');
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    const check = async () => {
      try {
        setLoading(true);
        setError(null);

        // App version from native
        const currentVersion =
          Application.nativeApplicationVersion ||
          Application.applicationVersion ||
          '0.0.0';

        const { data } = await client.get<VersionInfo>(
          'mobile/app-version/'
        );

        const latest = data.latest_version || '0.0.0';
        const minSupported = data.min_supported_version || '0.0.0';

        setLatestVersion(latest);
        setPlayStoreUrl(data.play_store_url || null);

        const must = isVersionLess(currentVersion, minSupported);
        const should = !must && isVersionLess(currentVersion, latest);

        setMustUpdate(must);
        setShouldUpdate(should);

        // Check if user dismissed this latest version
        if (should) {
          try {
            const stored = await AsyncStorage.getItem(DISMISS_KEY);
            if (stored && stored === latest) {
              setDismissed(true);
            } else {
              setDismissed(false);
            }
          } catch (e) {
            // ignore storage error
          }
        } else {
          setDismissed(false);
        }
      } catch (e: any) {
        console.log('Update check error', e?.message || e);
        setError('Failed to check for updates.');
      } finally {
        setLoading(false);
      }
    };

    check();
  }, []);

  const openStore = () => {
    if (playStoreUrl) {
      Linking.openURL(playStoreUrl);
    }
  };

  const handleDismiss = async () => {
    // Only for optional updates
    if (!shouldUpdate || mustUpdate) return;
    setDismissed(true);
    try {
      if (latestVersion) {
        await AsyncStorage.setItem(DISMISS_KEY, latestVersion);
      }
    } catch (e) {
      // ignore errors
    }
  };

  // While loading: show nothing (or you can show a thin bar)
  if (loading) return null;

  // If no update required / available
  if ((!mustUpdate && !shouldUpdate) || !playStoreUrl) return null;

  // If optional update but user already dismissed for this version → hide
  if (shouldUpdate && dismissed && !mustUpdate) return null;

  const isForced = mustUpdate;

  return (
    <View
      style={[
        styles.container,
        isForced ? styles.forcedContainer : styles.optionalContainer,
      ]}
    >
      <View style={styles.textWrap}>
        <Text style={styles.title}>
          {isForced ? 'Update required' : 'Update available'}
        </Text>
        <Text style={styles.message}>
          {isForced
            ? 'A new version of KashmirCart is required to continue using the app.'
            : 'A newer version of KashmirCart is available. Update now for the best experience.'}
        </Text>
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}
      </View>

      <View style={styles.buttonsRow}>
        {/* Update button */}
        <TouchableOpacity style={styles.btn} onPress={openStore}>
          <Text style={styles.btnText}>Update</Text>
        </TouchableOpacity>

        {/* "Maybe later" only for optional updates */}
        {!isForced && (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleDismiss}
          >
            <Text style={styles.secondaryBtnText}>Later</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  forcedContainer: {
    backgroundColor: '#fee2e2',
    borderBottomWidth: 1,
    borderBottomColor: '#fca5a5',
  },
  optionalContainer: {
    backgroundColor: '#eff6ff',
    borderBottomWidth: 1,
    borderBottomColor: '#bfdbfe',
  },
  textWrap: { flex: 1 },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  message: {
    fontSize: 11,
    color: '#4b5563',
    marginTop: 2,
  },
  errorText: {
    marginTop: 4,
    fontSize: 10,
    color: '#b91c1c',
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#2563eb',
  },
  btnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  secondaryBtnText: {
    color: '#4b5563',
    fontSize: 11,
    fontWeight: '600',
  },
});
